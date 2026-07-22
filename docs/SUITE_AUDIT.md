# Suite audit — 2026-07-22

*A four-dimension pass across all nine repos: (1) functional reality vs
theater, (2) build & validation health, (3) doc accuracy, (4) identity &
cross-repo integrity. Read-only investigation; every finding cites its
evidence. What this pass could **not** exercise — real audio, a real DAW
host, a real iPad — is stated plainly at the end. If a finding here
disagrees with an older doc, this file is newer; fix the older doc.*

## Method & honest limits

Verified from source, git history, and this session's real build runs on
the user's Mac and Linux boxes. **Not** verified (no audio stack, no DAW,
no iOS device in this environment): that any plugin actually *sounds*
right, hosts correctly, or that AUv3 registers on a device. So Dimension 1
for the C++ plugins is "the code is real and does what it says" — not "it
was heard." That boundary is the single most important caveat in this
document, and it is exactly where the suite's residual risk lives.

## Executive summary — the five that matter

1. **`VST3 on Linux` is not actually built for five of the seven plugins**,
   despite the enkerli-juce fix that restored it. The five helper repos
   include `EnkerliPlugin.cmake` from a **vendored submodule pinned six
   commits back** (`76a01b0`), which predates the fix. Only DrawnQurve
   (own inline CMake) builds Linux VST3 today. **This corrects what was
   reported earlier this session** — the fix is merged to enkerli-juce but
   inert until each repo bumps its pin. [D4/D2, HIGH]
2. **A class of C++ plugin changes was committed "not build-verified"** —
   written in an environment with no JUCE/Xcode, never compiled or
   DAW-tested (Serpe's `polyLock`/step-lock scheduler, PitchFold's Snap
   Strength). Real code, real intent, zero compile coverage. This is the
   largest functional-reality risk in the suite. [D1, HIGH]
3. **`BUILD.md` now overclaims Linux VST3** (my edit this session), ahead
   of what actually builds. Either bump the pins (finding 1) to make it
   true, or walk the claim back. [D3, HIGH]
4. **Named theater is honestly tracked, not hidden** — PitchFold's Mono
   Merge / Swing / Time-engine-in-JS are documented as non-functional in
   `KT_SUMMARY.md` and `PITCHFOLD_AUDIT.md`. The value of Mono Merge was
   delivered elsewhere (a Workspace module). This is a decision-to-make
   (keep/cut/build the dead params), not a hidden defect. [D1, MED]
5. **Plugin identity is clean.** All seven 4-char codes are distinct,
   manufacturer `Enke` is shared correctly, bundle IDs don't collide, and
   the suite-build manifest matches every repo. Nothing to fix here — noted
   because "plugin-codes-are-forever" is load-bearing. [D4, OK]

Severity: **HIGH** = affects what ships / contradicts a stated claim ·
**MED** = real gap, scoped · **LOW** = cosmetic / informational · **OK** =
verified sound.

> **Update, 2026-07-22 (same day): action 1 done.** All five helper repos
> (midicurator-plugin `2d379da`, progression-studio-plugin `409afe3`,
> PitchFold `01a2aed`, rhythm_pattern_explorer `0e25f78`, workspace-plugin
> `ad65bc3`) had their `enkerli-juce` submodule pin bumped `76a01b0 →
> 9b41fb4`. This resolves findings **1** and **3**: those repos now build
> Linux VST3, and `BUILD.md`'s claim is truthful. **Still needs a real
> Linux build to confirm the VST3 target actually appears** (verified by
> logic — the new pin's Linux FORMATS is `LV2 VST3 Standalone` — not yet by
> a compile). To pick it up: `git pull --recurse-submodules` (updates the
> submodule to the new pin) then rebuild.
>
> **Action 4 also done** (Vane Linux VST3, `f45d555`): Vane's inline CMake now
> defaults to the desktop WebView build with `LV2 VST3 Standalone`; the
> headless MODEP/Pi build is opt-in via `-DVANE_LINUX_HEADLESS=ON`. **All seven
> plugins now build Linux VST3** (five via the pin bump, DrawnQurve already
> did, Vane here) — pending the same real-compile confirmation. Findings 2
> (build-verify the new C++) and 5 (PitchFold dead params) remain open.

---

## Dimension 1 — Functional reality vs theater

The JS/TS engine layer is genuinely well-covered: **1528 tests green** this
session, and the shared packages (`theory`, `upi`, `proggen`,
`accompaniment`, `voice-routing`, `control`, `protocol`, …) carry real
algorithmic tests. Plugin DSP source is largely theater-marker-clean
(TODO/stub/placeholder counts: PitchFold 0, Serpe 0, Workspace 0,
MIDIcurator 0, ProgGenie 0; Vane 9, DrawnQurve 5 — mostly notes, worth a
glance, not alarming). The suite already runs an honest internal audit
trail (`KT_SUMMARY.md`, `PITCHFOLD_AUDIT.md`, `GLORIARP_NEXT.md`,
`SERPE_POLY.md`) that names its own dead spots. This pass confirms that
trail is still accurate and adds the systemic risk below.

| Finding | Sev | Evidence | Fix |
|---|---|---|---|
| **C++ changes committed but never compiled/DAW-tested** — Serpe `computePolyLaneStepPolymeter` + `polyLock` APVTS param (`PolyClock.h`), PitchFold Snap Strength / pad C++. All flagged "not build-verified" in KT docs. | HIGH | `KT_SUMMARY.md` §2, §Feature-matrix rows 70/75; authoring env has no JUCE/Xcode | Compile + DAW pass on a Mac before relying on these; treat as "written, not shipped" |
| **PitchFold Mono Merge / Swing** — UI + APVTS params exist, no engine reads them (both C++ and JS). | MED | `KT_SUMMARY.md` matrix rows 71–72; `PITCHFOLD_AUDIT.md` | Decide: cut the dead params, or build the engine. Value already exists as the Workspace `mono-merge` module. |
| **PitchFold Time engine** — real in C++, no JS twin. | MED | matrix row 73 | Intentional asymmetry; documented. Port only if the webapp needs it. |
| **Vane never adopted `@enkerli/voice-routing`** — named as a candidate in KT item 8, still open. | LOW | `KT_SUMMARY.md` lines 77–81; nothing in `apps/vane` touched | Optional; Vane's own tuning path may not need it. |
| **Vane's pluginval-AU timeout was a harness artifact, now resolved.** Native `auval -strict` passes ~30s; the slow bridge-driven pluginval AU rung was dropped (`9b41fb4`). | OK | this session; enkerli-juce `9b41fb4` | Done — Vane's DSP was never the problem. |

**Bottom line:** the theater that exists is *known and named*. The real
exposure is finding-2 — code that is genuine but has never been through a
compiler, sitting in `main` on several plugin repos.

---

## Dimension 2 — Build & validation health

| Finding | Sev | Evidence | Fix |
|---|---|---|---|
| **Linux VST3 not built for the 5 helper repos + Vane** (see D4 for the mechanism). User's Linux Workspace run built Standalone/CLAP/LV2, **no VST3 target**. | HIGH | user's 2026-07-22 Linux log; submodule pin `76a01b0`; Vane inline CMake `_vane_linux_formats = LV2 Standalone` | Bump submodule pins (D4-fix-1); decide Vane separately |
| **Linux builds otherwise green**, honestly reported — the silent-OK-on-failure bug is fixed (`7ba8126`), the swift-gate-on-Linux and LV2-headless (xvfb) blockers are fixed. | OK | user's 2026-07-22 run: 7/7 OK after pulling the plugin repos | — |
| **macOS ladder green** — strict native auval + pluginval(VST3) across the set after the Vane fix. | OK | user's 2026-07-22 Mac run | — |
| **"Not build-verified" C++ (overlaps D1-2)** — no compile coverage for the newest plugin C++. | HIGH | KT docs | Mac compile pass |
| Container artifacts (NOT suite issues, noted so an in-container re-audit isn't misled): `/workspace/workspace-plugin` is an empty stub here (real one is `workspace-plugin-real`); `vane`/`pitchfold`/`drawnqurve` are lowercase (the case-insensitive `suite-build` lookup covers this). | LOW | `git status` in those dirs | none — local only |

---

## Dimension 3 — Doc accuracy

| Finding | Sev | Evidence | Fix |
|---|---|---|---|
| **`BUILD.md` overclaims Linux VST3** for the helper repos (introduced this session, ahead of reality). | HIGH | `BUILD.md` §Quickstart / §4.1 vs the stale-pin reality | Land the pin bumps (makes it true), or qualify the claim as "after a submodule bump" |
| `INVENTORY.md` is accurate to *current* reality (lists Workspace Linux as LV2/CLAP, no VST3) — but omits Serpe's Linux formats entirely. | LOW | `INVENTORY.md` lines 15, 20 | Add Serpe LV2/CLAP/Standalone; refresh the VST3 rows in the same pass as the pin bump |
| **Docs are unusually honest overall** — dated, caveated, self-flagging ("not build-verified", "still theater"). This is a strength; the failures above are recency drift, not systemic dishonesty. | OK | `KT_SUMMARY.md`, `PITCHFOLD_AUDIT.md` | keep the discipline |

---

## Dimension 4 — Identity & cross-repo integrity

| Finding | Sev | Evidence | Fix |
|---|---|---|---|
| **Plugin identity clean** — codes `Mcur / Prst / Pqf1 / VAne / RPEd / Dqau / Wksp` all distinct; mfr `Enke` shared correctly; bundle IDs distinct; suite-build manifest matches every repo. | OK | each repo's `CMakeLists.txt`; `suite-build` manifest | none |
| **All 5 submodule pins stale at `76a01b0`** (6 commits / one archetype change behind `enkerli-juce`). The *only* archetype change they miss is the VST3-Linux restore (`5d10a95`) — everything else recent is `tools/`, run from the sibling, so already live. | HIGH | `git ls-tree HEAD enkerli-juce` in each repo; `git log 76a01b0..HEAD -- cmake/` = just `5d10a95` | In each of midicurator-plugin, progression-studio-plugin, PitchFold, rhythm_pattern_explorer, workspace-plugin: `git -C enkerli-juce checkout <new-sha> && git add enkerli-juce && git commit` |
| **Two build patterns** — 5 repos use the `enkerli_add_*_plugin` helper (submodule-governed); Vane & DrawnQurve use inline `juce_add_plugin` with their own FORMATS. So an enkerli-juce archetype fix reaches only the 5, and only after a pin bump; Vane/DrawnQurve need separate edits by hand. | MED (arch) | Vane CMake line 175, DrawnQurve line 124 ("off the shared archetype") | Not a bug — but any "fix once in enkerli-juce" plan must account for the two off-archetype repos |
| **Bundle-ID casing inconsistent** — `com.enkerli.PitchFold/Vane/DrawnQurve` (capitalized) vs `com.enkerli.serpe/workspace` (lowercase). | LOW | each CMake | **Do not "fix"** — these are frozen (PitchFold's comment: installed devices key off it). Cosmetic only. |

---

## Prioritized actions

1. **Bump the 5 helper repos' `enkerli-juce` submodule pins** to current
   `main`. Single highest-leverage fix: makes Linux VST3 real for those
   five, brings them current, and makes `BUILD.md` truthful. [HIGH]
2. **Build-verify the "not build-verified" C++** (Serpe `polyLock`,
   PitchFold Snap Strength) on a Mac, in a DAW. Real code that has never
   compiled. [HIGH]
3. **Reconcile `BUILD.md`'s Linux-VST3 claim** — automatically satisfied by
   action 1; until then it overclaims. [HIGH]
4. **Decide Vane's Linux VST3** — its inline CMake is deliberately
   LV2/Standalone (MODEP-oriented). Add VST3 if desktop-Linux VST3 matters;
   otherwise document the deliberate omission. Needs your call. [MED]
5. **Resolve PitchFold's dead params** (Mono Merge / Swing) — cut or build.
   Value already lives in the Workspace `mono-merge` module. [MED]
6. **Optional**: Vane adopt `@enkerli/voice-routing`; add Serpe Linux
   formats to `INVENTORY.md`. [LOW]

## What this audit could not verify

No audio device, DAW, or iPad in this environment. So: no plugin was
*heard*; AU/AUv3/VST3/CLAP *hosting* was not exercised beyond auval/
pluginval; AUv3 device registration is untested; and the "not
build-verified" C++ (actions 2) remains exactly that. Everything above is
grounded in source, git state, and this session's real build logs — but
the last mile (real host, real device, real ears) is yours to walk, and is
where the suite's remaining risk is concentrated.
