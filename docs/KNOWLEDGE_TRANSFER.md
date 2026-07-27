# Knowledge transfer — the 2026-07-19 triage plan, for the next agent

*Written 2026-07-19 at session end, for a coding agent (Sonnet 5, Opus
4.8, or any successor) picking up the ranked plan in
`SUITE_AUDIT_AND_PLAN.md` §10 (private repo — see below) with no access
to the session that produced it. The plan says WHAT and in what order;
this doc carries the session knowledge that makes each item executable:
where the seams are, what was already verified, and which traps are
already paid for.*

*Cross-cutting status as of 2026-07-20: `docs/KT_SUMMARY.md` — what
shipped across items 2/4/5/8/9, a feature-availability matrix (which
surface — webapp, plugin, CLI, MIDIcurator, Workspace — each feature
actually reaches), and an explicit limitations section (a real
color-contrast bug found and fixed, and a gap found and closed same day:
Serpe's JUCE plugin used to only ever play polyrhythm, never polymeter —
now both are real there, see item 9). Read it before this doc if you
want the "what actually happened" view rather than the per-item plan.
`docs/DESIGN_AGENT_QUESTIONS.md` — five short questions for whoever
picks up the design pass, topped by the Serpe rings' resemblance to
Lascabettes's Rhythmic Circle. Beyond the original 9-item plan:
`docs/GLORIARP_NEXT.md` §3g (2026-07-21) — style models can now learn
from a real chord progression, not just one vamped chord, so a corpus's
own voice leading (a leading tone into the next chord) gets captured,
not just its vocabulary against one frame. MIDIcurator's existing "learn
family as style" button already routes through it automatically.*

## 0. Read order, then rules

Read first: [`HANDOFF.md`](../HANDOFF.md) (repo map — repos, remotes,
local paths) → [`BUILD.md`](../BUILD.md) (every build command; it wins
over any other doc) → [`docs/INVENTORY.md`](INVENTORY.md) (every
deliverable) → [`CONVENTIONS.md`](../CONVENTIONS.md). The planning
document of record is `SUITE_AUDIT_AND_PLAN.md` in the **private** repo
`~/Desktop/Jazz Progs and Gen` (local-only by design; the jazz corpus
lives there, gitignored, and is **never** published or quoted).

Non-negotiables that override your instincts:
- **Leftmost = LSB** bit order and **structural note spelling** are
  decisions, not bugs (`CONVENTIONS.md`). Tresillo = `0x94` = d73.
- **Copy is plain and humble.** No hype, no marketing voice, no "songs"
  framing. Site copy is single-sourced in `docs/site.md`.
- **Verify, never assume.** This session's pattern held every time:
  auval validates the *installed* component (a broken build can still
  "pass"); a "successful" cmake build can ship a hollow bundle; a fresh
  clone is the only proof instructions work; a browser click-through is
  the only proof a React change didn't break hooks order. `validate.sh`
  in enkerli-juce encodes the automatable ladder — use it after every
  plugin-affecting change.
- **Committed WebUI bundles do not track the monorepo.** MIDIcurator and
  ProgGenie embed a committed `WebUI/index.html`; regenerate it
  (`node WebUI/build.mjs <path-to-monorepo-app>`) whenever the app moved
  (BUILD.md has the one-line staleness check). This bit twice in July.
- **Design decisions get flagged for the design pass**, not over-built
  (a Claude Design UX pass is a standing arrangement). Functional
  first-passes in the established grammar are fine; new visual language
  is not yours to invent.
- Commits end with: `Co-Authored-By: <your model name> <noreply@anthropic.com>`.

State when this was written: every repo clean and pushed; monorepo at
1347/1347 tests; all seven plugins through the automatable ladder the
same day (BUILD.md §6 matrix). A one-time scheduled task fires
2026-07-20 02:05 EDT (design-audit implementation + user guide) and
**references the current repo paths** — relevant to item 1 below.

## 1. Centralize checkouts + env exports (S–M · ★★★) — DONE, 2026-07-20

The 2026-07-20 02:05 scheduled task this item was gated on never
actually fired (confirmed: no trigger for it exists), and Alex ran
through the centralization independently, later, by hand — the physical
move (repos under `~/Documents/Coding`/`~/Coding`, shell profile
`MUSIC_SUITE`/`JUCE_PATH` exports, deleting the stray duplicate
`~/music-suite` checkout) happened on Alex's own machines, outside any
agent session's reach.

Checked what's left reachable from *this* repo: nothing. `webui.local.cmake`
files are per-plugin-repo and gitignored — a fresh sibling checkout
never has one, so there's nothing to update or delete from here.
`scripts/apps.local.json` doesn't exist in this checkout either (also
gitignored, also just an override with a working default — confirmed
`sync-apps.mjs` already degrades gracefully with per-slug skip-and-warn
when a path isn't found, exactly as its own doc comment claims).
`.claude/launch.json` lives in the private planning repo, out of scope
by design. The "prove it: one archetype plugin configures with no
override and no fetch" step needs a real JUCE toolchain on Alex's own
machine — not verifiable from a JUCE-less container either way.

## 2. One build script (M · ★★★) — DONE 2026-07-20

`enkerli-juce/tools/suite-build` shipped (enkerli-juce commit "tools/
suite-build: one command for any (or all) of the seven plugin repos";
`BUILD.md` updated with a "Quick:" line per repo). Wraps `validate.sh`
unchanged; adds the Linux leg; `all` skips a repo that isn't checked out
yet instead of dying.

**Run-verified on macOS 2026-07-27** against the real root
(`~/Documents/Coding`), and four gaps closed in the process (enkerli-juce
`219957b`):
- the `--formats` target names its own `--help` flagged as best-effort
  guesses were **right except `auv3`**, which is the iPadOS format for the
  six archetype repos and a macOS target only for Vane — asking Serpe for
  it aborted the whole repo with `No rule to make target Serpe_AUv3`.
  Targets are now filtered against what configure actually produced, so an
  unavailable format is a reported skip and the rest still build;
- shared packages are built first (`@enkerli/*` → `packages/*/dist`, which
  is **gitignored**, so the two committed bundles were being regenerated
  against whatever stale dist was on disk);
- the nested layout resolved `MUSIC_SUITE` to a `music-suite/music-suite`
  that cannot exist;
- the `--formats` path built serially (no `-j`).

Still not verified by machine: a full `--ladder` (auval + pluginval) run
across all seven, and everything Linux — `--formats`/xvfb/LV2 legs are
written but only Alex's miniPC can prove them.

Original brief, for reference:

`BUILD.md` is the human spec; make an executable one. Seed from
`enkerli-juce/tools/validate.sh` (already: macOS build → hollow-bundle
check → iOS compile → auval → pluginval, with real exit-code checks —
keep those; they each encode a paid-for lesson). Wanted shape:
`suite-build <repo|all> [--formats au,vst3,clap,lv2] [--ladder]
[--fresh] [--ios]`, platform-aware (macOS full ladder; Linux
LV2/Standalone/CLAP, no auval). Keep it in enkerli-juce `tools/` so all
repos share it via the submodule; BUILD.md then documents *the script*
per repo instead of per-repo incantations. Don't break `validate.sh`'s
CI users (midicurator/proggenie CI call it via reusable workflows).

## 3. Names (S mechanics + Alex's decision · ★★) — DECIDED, 2026-07-20

Both calls made:
- **ProgGenie official** — confirmed, no change from today's reality
  (product strings already say ProgGenie). Mechanics still open, not yet
  executed: rename the repo (`progression-studio-plugin` →
  `proggenie-plugin`; GitHub redirects old URLs) and update doc
  references. **Never touch** plugin code `Prst` or bundle id — plugin
  identity breaks host sessions (plugin-codes-are-forever, enkerli-juce
  docs). Deliberately not done in this pass: the doc says its own real
  cost is "enumerate the Pages URL across HANDOFF/BUILD/
  A11Y_TEST_PLAN/scheduled user guide/plugin READMEs" — that's real
  surface, worth its own dedicated pass rather than a rushed partial
  rename that leaves stale references somewhere.
- **Suite name: MTILT.** Not the current `music-suite` and not
  MIDIsplainer — MTILT is the suite's name going forward. Same
  mechanics gap as above (Pages URL, doc references, plugin READMEs) —
  not executed here; noting the decision so it's not re-litigated, and
  the rename itself can be batched with ProgGenie's for one clean pass
  rather than two separate churns through the same doc set. npm scope
  `@enkerli/*` is unaffected either way.

## 4. MIDIcurator variants × GloriArp (M–L · ★★★) — DONE 2026-07-20

The core loop shipped: `clipFamily(clip, allClips)` in `gloriarp-clip.ts`
generalizes MIDIcurator's existing `source`/`sourceFilename` variant
linking (VP intensity siblings, density/quantize transforms, GloriArp
alike — `vpSiblings` in MidiCurator.tsx was the VP-only special case,
this is the general one). `learnStyleModelFromFamily` folds a clip's WHOLE
family into ONE style model (statistics across the ladder, not one
throwaway single-take model per rung); `generateDensityFamily` (+
`GrooveClipRequest.density`, threaded to `samplePhrase`) generates a
×¼…×1½ family from a model in one call, refusing a plain-phrase style with
a named reason. Both save through the EXACT same variant idiom (tagged
sibling clips) so they sit in the UI exactly like any other variant.
GrooveGenerator.tsx: "learn family (N) as style" beside the existing
per-clip learn button, "generate variant family" beside Generate. 10 new
tests in `gloriarp-clip.test.ts` (368/368 MIDIcurator, 1365/1365 monorepo).
Click-tested for real: `npm run dev` + Playwright/Chromium against the
actual running webapp (a real browser, not a component test) — imported a
clip, learned its family (size 1) as a model, generated the ×¼…×1½ family
from it, confirmed the message/dropdown/tags, then confirmed the ORIGINAL
clip's family count correctly grows 1→6 once its five generated variants
link back via source/sourceFilename. One real bug this caught and fixed:
"1 clips" grammar in the learn-family message (not caught by any unit
test — nobody asserted the exact string with a family of exactly one).
Not tested in the actual JUCE plugin (no toolchain in this environment).

Remaining/open: per-density custom UI (currently the fixed ladder only,
though `generateDensityFamily` itself takes any preset list); by-ear check
that a family-learned model's sampled variants actually feel like their
source ladder, not mush (untested — no ears here, docs/GLORIARP_NEXT.md
§3b's own open question for the whole statistics arc).

Original brief, for reference:

Both live in `apps/MIDIcurator`. The GloriArp side:
`src/lib/gloriarp-clip.ts` (styles, `importStyleFromJson`,
`allStyleNames`, learn-from-clip via `extractPhrase`) and
`src/components/GrooveGenerator.tsx` (panel; note its collapsed-state
early return — hooks must stay above it, a React #310 was already paid
for there). The variants system is MIDIcurator's existing clip-variant
model (search `variant` in `src/lib`). The idea: variants as style
sources — learn a style per variant, generate variants from a style.
Design the data flow first (a variant is a clip; `extractPhrase`
already eats clips), and keep `phrase.json`/`style-model.json` as the
interchange (CLI `msuite style learn` reads/writes the same contracts).

## 5. Continuous morphing accompaniment (L–XL · ★★★) — DONE, 2026-07-20

All four named dimensions now shipped for real, engine + CLI:
`express.ts`'s single blanket `morph` split into independent
`morphNotes`/`morphPocket` (note order / timing-dynamics wander
separately now — `morph` stays as a blanket alias, byte-identical to
before when used alone), `articulate.ts`'s `rests` gained pass-
awareness it never had at all (`morphRests` + `pass` — WHICH steps skip
now wanders across loop repeats; previously the same steps dropped every
single pass, full stop), and `inflect.ts` gained both **accents**
(`morphAccents` — pass-aware wandering of its own EXISTING sforzando/
marcato and staccato/tenuto choices) and **slides** (`slide` + `glideMs`
— eligible legato transitions promoted to an audible portamento glide;
Vane already auto-glides on connected note-changes, so the whole feature
was posting a nonzero `glide-time`, plus standard MIDI CC5/CC65
portamento in the `.mid`/rawmidi writers). All four dimensions share the
same `passSeed` three-stream (stable/per-pass/gate) discipline, now
exported from express.ts. Reaches `groove()`, `msuite accompany`
(`--morph-notes`/`--morph-pocket`/`--morph-rests`/`--morph-accents`/
`--slide`/`--glide-ms`, CLI-smoke-tested for real — including a real
`.mid` byte scan confirming CC5/CC65 land, and a pass-0-vs-pass-1 diff
confirming `morphAccents` actually wanders while `pass` alone changes
nothing), and MIDIcurator's `GrooveClipRequest` (data layer). 17 new
engine tests + 3 Vane control tests + 3 midiout tests + MIDIcurator
coverage, 1391/1391 monorepo, vectors regenerated with zero diff both
times. Full writeup: docs/GLORIARP_NEXT.md §3e (notes/pocket/rests) and
§3f (accents/slides).

**NOT done, on purpose**: no UI knobs added anywhere (this item's own
"design-pass involvement for the UI" note — the existing single `morph`
knob in the workspace module / MIDIcurator stays as the only UI surface,
now correctly aliasing all four engine dimensions, until a design pass
decides the actual layout — including whether `morphAccents`/`slide`
deserve their own knobs or stay folded into `morph`). Vane's glide is
untested by ear/real audio — this environment has no audio device; it's
verified structurally only (correct bytes, correct order, correct
values).

Original brief, for reference:

The direction Alex described: Bram Bos Troublemaker / Rozeta Bassline
feel — a loop that *mutates continuously* with per-dimension
probabilities (note order, accents, slides, skip-step) instead of
regenerating wholesale. The cheap first slice exists: **GloriArp live
loops already regenerate per pass** (monorepo commit "GloriArp live
loops: per-pass regeneration + ProgGenie bus handoff", 2026-07-19) —
expose per-dimension morph amounts on that path instead of full
regeneration. Engine home: `packages/accompaniment` (deterministic,
seeded, trace-explained — keep all three properties; a morph step
should be reproducible from (seed, passIndex)). Surfaces: workspace
`gloriarp` module, MIDIcurator GrooveGenerator, `msuite accompany`.
Slides/accents already exist as express/inflect dimensions in the
package — read `src/express.test.ts` / `src/inflect.test.ts` first.
This is polyphonic-aware (comping shipped 2026-07-19: "GloriArp:
polyphonic MIDI (EP comping)"). Design-pass involvement for the UI.

## 6. Shared library across the suite (L · ★★★, staged)

The spec is `docs/LIBRARY_SPEC.md` + `docs/schemas/library-item.schema.json`
(ajv-validated; vocabulary now includes `pattern` and `control-map`).
Already real: `@enkerli/library` package (48 tests) and a
`library-browser` UI component. MIDIcurator's clip library already
persists as an envelope index (2026-07-05 commit). Remaining rungs, in
spec order: ProgGenie's three kinds → qurves (blocked: DrawnQurve state
chunk only — needs save-as-file first) → Vane presets / Serpe presets
as `payloadRef` wraps → manifold controller setups → multilane rhythm
patterns + accompaniment styles (new kinds already in the schema).
The iPadOS cross-app dream needs the App Group
(`group.com.enkerli.suite`) — gated on Apple-account provisioning,
steps written in the private plan doc §6 backlog.

## 7. Exquisite Fingerings as plugin/standalone, Exquis dev mode (L · ★★★, spike M first) — roadmap, 2026-07-20

Alex's call: stays on the roadmap. Main advantage of the plugin path is
working from an iPad rather than only a desktop browser — worth keeping
in mind when this gets picked up, since it argues for the plugin/AUv3
route over standalone-app-first if the two end up close on effort.

The AUv3 shell is cheap — the consolidation recipe is proven five times
(move nothing; plugin repo embeds `apps/exquisite-fingerings` via the
same CMake probing; aumi archetype; ~1.1k LOC shell like
MIDIcurator/ProgGenie). The UNKNOWN is **Exquis developer mode**: SysEx
control of pad LEDs/layout from the app (the reverse of today's
fingering *display*). The dev-mode SysEx spec had already been shared
and turned out to be sitting in the repo as a committed PDF
(`apps/exquisite-fingerings/Exquis_Dev_Mode_EN.pdf`) — third-party
manufacturer documentation (Dualo's; the PDF's own embedded metadata
points to `dualo.com/en/support`), not something this repo should
redistribute. **Fixed 2026-07-20**: gitignored, untracked (`git rm
--cached`, kept on disk locally), and `exquis-devmode.js`'s header
comment now points at the original source instead of implying an
in-repo spec. `manifold/controllers/mpe-surface/exquis.yaml` (a
separate repo) is the capability record and should GAIN whatever a dev-
mode spike learns. Spike first: prove one pad-LED write over
`@enkerli/webmidi` from the webapp using that spec. Only then decide
plugin vs standalone-app-first. Note: the hardware's pad palette is
already canon in the suite (`packages/ui/components/pitch-class-colors.js`
— derived from Alex's Exquis layout file).

## 8. PitchFold feature evaluation (M · ★★) — DONE, 2026-07-20

Audit doc: `docs/PITCHFOLD_AUDIT.md`. Read the webapp fully and
cross-referenced every parameter against the real plugin's C++ source
(`Enkerli/PitchFold`, added to the session for this). Headline: **Voice
Split earns its promotion** (clean, correct, C++/JS parity, genuinely
engine-agnostic) — recommend extracting it as a shared module (Vane
poly, Workspace). Three parameters turned out to be pure theater —
automatable/UI-visible but provably zero-effect in both engines: **Mono
Merge** (a whole voice mode + 4 sub-modes), **Swing**, **Snap Strength**
(`quantStrength`, host-automatable, no UI at all). The known
pad-override wart is real and worse than "unresolved" — pad selection
in the standalone webapp is 100% cosmetic (the quantizer never resolves
through the selected pad's mask/root; works correctly in the real
plugin). New finding not previously flagged: **the whole Time tab is
inert in the standalone webapp** — no JS time-quantizer twin exists at
all, only pitch + voice were ported. Also found: ~1,517 lines of dead
native-UI C++ pre-dating the WebView migration (compiled into nothing),
a stale bit-order doc comment in `PCSEngine.h`, and fully dead
MIDI-pad-trigger code in `ChordPadBank`. Full keep/promote/drop table
in the audit doc — no code changed, per the brief.

**Follow-up, same day** (audit doc's own "Follow-up" section has the
full detail): the cheap findings actually got implemented, not just
roadmapped — pad-override fixed in the standalone webapp
(`apps/pitchfold/engine/pads.js`, tested), `quantStrength` wired
end-to-end (webapp + `Enkerli/PitchFold` C++, not build-verified),
Voice Split promoted to `packages/voice-routing`
(`@enkerli/voice-routing`, PitchFold's own engine now uses it), the
dead C++ headers deleted, the stale comment fixed. New: two Workspace
modules (`pcs-pads`, `voice-split`) — PCS Pads broadcasts `scale` bus
messages on the SAME contract PickPCS/PitchFold already share (zero
changes needed either side); Voice Split reuses the shared package to
re-route `note` messages round-robin, verified over the real cross-tab
bus. Mono Merge and a standalone Time-engine port stayed on the
roadmap — both turned out to need real new logic (mono note-stealing;
a wall-clock scheduling model instead of TimeQuantizer's block-based
one), not a mechanical port, so "shouldn't be too difficult" didn't
fully hold there. 1442/1442 monorepo.

**Reprioritized, same day**: Alex's call — Mono Merge/Swing/Time-engine
made sense given the original brief's PageFail "Cality" inspiration, but
given how Workspace has become the suite's actual cross-app integration
surface since, these may be better spent as Workspace features (a
shared note-router module, the same instinct behind `voice-split`) than
rebuilt twice inside PitchFold's own two engines. Staying on the
roadmap, not descoped — see `docs/PITCHFOLD_AUDIT.md`'s "Reprioritized"
note.

## 9. Serpe concentric circles (M–L · ★★) — DONE, 2026-07-20

Nested-rings renderer for the poly lane data model shipped, webapp-only.
New `createPolyCircleView(host, opts)` in `apps/serpe/engine/render.js`
(same imperative `.update()` shape as `createCircleView`/`createStepView`
— framework-agnostic, reusable by the plugin WebView). Wired into
`PolyLanesPanel` as a **Rows/Circle** view toggle (`main.jsx`), sitting
beside the existing Cycle/Step lock toggle; the per-lane control rows
(mute, note, channel, offset badge) stay exactly as they were either way
— Circle only swaps the flat `.poly-cells` strip for one shared ring
graphic above them.

Geometry calls made (all reversible, flagged for the actual design pass
before polishing, per this item's own note):
- **Rings nest outer→inner in lane DECLARATION order** (lane 0 outermost
  — kick outer, hat inner, the drum-notation instinct). Arbitrary, easy
  to flip later.
- **Restrained**: guide ring + a bold downbeat tick (anchors step 0 at
  12 o'clock, the SAME angular origin as the mono circle view, so the
  ticks visibly line up in a column across rings) + step dots, sized/
  haloed exactly like the mono view's accent treatment. No onset polygon
  or center-of-gravity per ring (fine for one ring, noisy across three
  or four).

7 new render.js tests + a Playwright click-through against a real dev
build (typed a 3-lane poly pattern, confirmed 3 ring groups render,
confirmed the Rows↔Circle toggle swaps the DOM correctly). 1398/1398
monorepo.

**v2, same day**: two follow-ups, both requested rather than left as
flagged warts.

- **Contrast fix.** v1's per-lane color cycled the mono view's full
  4-token palette (`ink`/`rose`/`moss`/`plum`); `rose` IS the
  accent-amber token (`--es-dim-pressure`), so a lane landing on it had
  its own accented onsets rendering the same fill as its unaccented
  ones (the halo ring still disambiguated, but the color signal that
  works for every other lane silently didn't). Fixed by giving
  `createPolyCircleView`'s automatic rotation its own 3-color subset
  (`ink`/`moss`/`plum`) that excludes `rose` entirely — `laneColor()`
  itself still accepts `rose` as an explicit, deliberate choice (e.g. a
  mono ring a caller colors on purpose), only the AUTOMATIC per-lane
  cycling avoids it now. Zero possible collision for any lane count.
  2 new regression tests (guide-stroke never equals the accent token;
  an accented dot's fill differs from its own ring's unaccented dots,
  checked across all 4 rotation slots).
- **Step lock support (v2).** The v1 "cycle lock only" restriction
  turned out to be an overcautious call, not a real constraint:
  `lane.steps`/`lane.accents` are properties of the PARSED pattern, not
  of how it's scheduled, so the ring geometry (radius, step count,
  downbeat position) is identical either way — `createPolyCircleView`
  never actually referenced `polyLock` at all. What genuinely differs
  between the two locks is only the ANIMATED playhead: under cycle lock
  every ring's downbeat returns to 12 o'clock in wall-clock sync (the
  "lines across lanes" read); under step lock each ring's `lanePh[i]`
  still highlights correctly (same mechanism, already lock-agnostic),
  it just won't stay lined up between lcm realignment points. Both are
  legitimate static readings of the same division of 360°. Removed the
  `circleOk`/disabled-button gate and the polyLock→polyView fallback
  effect entirely — Circle is now available under both locks, verified
  via Playwright (ring count and rendering identical switching Cycle →
  Step). Also removed the now-dead `.seg button:disabled` CSS rule that
  existed only for that gate — didn't want to ship the exact "looks
  wired, nothing calls it" pattern the PitchFold audit (item 8, same
  day) just spent a whole doc criticizing.

9 render.js tests total, 1400/1400 monorepo.

**Polymeter in the real plugin, DONE 2026-07-20 (same day as the
directive naming it "the most important" item).** Separate from the ring
work above but discovered while doing it: `rhythm_pattern_explorer`'s
`Source/Core/PolyClock.h` (the plugin's own audio-thread scheduler, not
the webapp's `apps/serpe/engine/poly-clock.js`) only ever implemented
cycle lock — polymeter (step lock) was real in the webapp alone. Closed
same day: `PolyClock.h` gained `computePolyLaneStepPolymeter` (additive,
not a refactor of the hand-verified `computePolyLaneStep`), a new
`polyLock` `AudioParameterChoice` param, `processPolyLanes()` branches on
it, and the webapp's Cycle/Step toggle now actually reaches the plugin
(`sendParamActual('polyLock', ...)` in `main.jsx`, `PARAM_MAP` entry in
`juce-bridge.js`) instead of being a fully inert control there. New
coprime-step-count (7 vs 11, lcm 77) conformance tests added to
`PolyConformanceTests.cpp`. Full account, including the "not
build-verified — no JUCE/Xcode here" caveat that applies to every C++
change made in this environment: `docs/SERPE_POLY.md` §3b.

## Loose threads that are NOT plan items (don't drop them)

- **Linux re-verify** (Alex's machine): `npm test` on the miniPC should
  now be fully green (vitest config + event-driven CLI tests, both
  pushed 2026-07-19). If the two `--loop` tests still fail there, the
  bug is real and Linux-specific — investigate the CLI's SIGINT path,
  not the harness.
- **iPad verifies pending**: ProgGenie standalone chip should read
  "MIDI · native" (rebundled `653912b`); MIDIcurator GloriArp `.json`
  import via document picker (rebundled `90d0dff`); both need a
  Standalone-scheme reinstall to refresh the AUv3s.
- **The 02:05 scheduled task** produces `docs/USER_GUIDE.md`, a
  DesignAuditJuly19 report, and possibly glossary additions — reconcile
  with anything you write, don't duplicate.
- **Workspace plugin field notes** (`docs/WORKSPACE_PLUGIN.md` §5b):
  DAW sync, keep-playing-with-GUI-closed (loop state must move to the
  C++ side — the WebView is not a place for running state), Control
  Surface→Vane, Recorder→SMF. These predate the triage and stay queued.
- **Vane field notes** (`~/Vane/ROADMAP.md`, 2026-07-19): breathless
  mode (velocity-only envelopes feeding the real amplitude model — do
  NOT add a generic ADSR; the amplitude model in that file's history is
  the law), PhysMod lab harness (bore-damping kill repro), narrow-range
  PhysMod modulation.

## Trap index (each cost a real debugging session once)

WKWebView: no `window.confirm/prompt`, no `<input type=file>` (use
bridge `openFile`/`saveFile`), no downloads, IndexedDB unreliable under
`juce://` → file-backed state over the bridge. iOS signing lapses are
an Apple-account issue, never a code regression. AUv3s need one
Standalone run on a real iPad to register. `auval` validates the
INSTALLED component. esbuild errors print `[ERROR]`, not `error:`.
React components with early returns: hooks above the return. Vitest
without explicit roots sweeps nested checkouts. A fixed pre-kill delay
in a subprocess test is a hardware assumption. Fresh-clone verification
finds what incremental checkouts hide — run it before claiming
"builds from scratch".
