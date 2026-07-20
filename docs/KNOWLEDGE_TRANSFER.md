# Knowledge transfer — the 2026-07-19 triage plan, for the next agent

*Written 2026-07-19 at session end, for a coding agent (Sonnet 5, Opus
4.8, or any successor) picking up the ranked plan in
`SUITE_AUDIT_AND_PLAN.md` §10 (private repo — see below) with no access
to the session that produced it. The plan says WHAT and in what order;
this doc carries the session knowledge that makes each item executable:
where the seams are, what was already verified, and which traps are
already paid for.*

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

## 1. Centralize checkouts + env exports (S–M · ★★★)

Alex is consolidating all repos under `~/Documents/Coding` (Mac) /
`~/Coding` (Linux), each plugin repo a **sibling** of `music-suite`.
The build system is already location-flexible — three probed layouts
(sibling / nested-inside-monorepo / `MUSIC_SUITE` env) plus a
`JUCE_PATH` env probe before any JUCE fetch — so the move is mechanics:

1. **Do not move anything before the 2026-07-20 02:05 scheduled task
   has run** (its prompt hardcodes `~/Desktop/music-suite` etc.), or
   update that task's prompt first (`update_scheduled_task`).
2. Move the repos. Current Mac locations are in HANDOFF.md's repo map
   (note the strays: `~/Vane`, `~/DrawnQurve`, and a second monorepo
   checkout at `~/music-suite` that exists only as their sibling —
   after centralizing, delete that duplicate checkout).
3. Update or delete the per-repo gitignored `webui.local.cmake` files
   (with true siblings the default just works), `scripts/apps.local.json`
   (sync-apps paths), and `.claude/launch.json` in the private repo
   (dev-server paths).
4. Add to shell profiles on BOTH machines:
   `export MUSIC_SUITE=$HOME/Documents/Coding/music-suite` (adjust per
   OS) and `export JUCE_PATH=<local JUCE clone>` (Linux especially —
   no `/Applications/JUCE` there, so this is what stops per-repo
   fetches).
5. Prove it: one archetype plugin (`workspace-plugin` is smallest) and
   Vane must configure with no `webui.local.cmake` and no fetch.

## 2. One build script (M · ★★★) — DONE 2026-07-20

`enkerli-juce/tools/suite-build` shipped (enkerli-juce commit "tools/
suite-build: one command for any (or all) of the seven plugin repos";
`BUILD.md` updated with a "Quick:" line per repo). Wraps `validate.sh`
unchanged; adds the Linux leg; `all` skips a repo that isn't checked out
yet instead of dying. **Not run-verified** — built and dry-run-traced
without a JUCE/Xcode toolchain (Linux container); a real `--ladder` pass on
Mac is the remaining check before trusting it fully. `--formats` target-
name guessing (`<Product>_VST3` etc.) is best-effort, flagged as such in
its own `--help`.

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

## 3. Names (S mechanics + Alex's decision · ★★)

Two separate decisions, both Alex's — prepare a short NAMES memo, don't
choose:
- **ProgGenie official**: product strings already say ProgGenie. The
  mechanical rename is the repo (`progression-studio-plugin` →
  `proggenie-plugin`; GitHub redirects old URLs) and doc references.
  **Never touch** plugin code `Prst` or bundle id — plugin identity
  breaks host sessions (plugin-codes-are-forever, enkerli-juce docs).
- **Suite name**: candidates Alex likes are **MIDIsplainer** and
  **MTILT** ("Music Technology: Inclusive Learning & Teaching") vs the
  current music-suite. Real costs to enumerate: the Pages URL
  (`enkerli.github.io/music-suite/...` appears in HANDOFF, BUILD,
  A11Y_TEST_PLAN, the scheduled user guide, plugin READMEs), npm scope
  `@enkerli/*` (unaffected), and the copy-tone rule (MIDIsplainer is a
  joke name — check it against the plain/humble register with Alex).

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

## 7. Exquisite Fingerings as plugin/standalone, Exquis dev mode (L · ★★★, spike M first)

The AUv3 shell is cheap — the consolidation recipe is proven five times
(move nothing; plugin repo embeds `apps/exquisite-fingerings` via the
same CMake probing; aumi archetype; ~1.1k LOC shell like
MIDIcurator/ProgGenie). The UNKNOWN is **Exquis developer mode**: SysEx
control of pad LEDs/layout from the app (the reverse of today's
fingering *display*). Spike first: find the Exquis dev-mode SysEx spec
(Intuitive Instruments publishes one; `manifold/controllers/mpe-surface/
exquis.yaml` is the capability record and should GAIN whatever the
spike learns), then prove one pad-LED write over `@enkerli/webmidi`
from the webapp. Only then decide plugin vs standalone-app-first. Note:
the hardware's pad palette is already canon in the suite
(`packages/ui/components/pitch-class-colors.js` — derived from Alex's
Exquis layout file).

## 8. PitchFold feature evaluation (M · ★★)

Alex's words: features "thrown together haphazardly"; **voice
splitting** is the named promotion candidate. Engine: plugin repo
`Source/PCS/PCSEngine.h` with a JS twin in
`apps/pitchfold/engine/{pcs,voices}.js` (VoiceProcessor modes — read
these first). Deliverable is an audit doc (what each feature does, used
or vestigial, keep/promote/drop), not code. If voice splitting gets
promoted, consider it a shared module (other tools want voice routing —
Vane poly, Workspace). Known open wart: pad-override is unresolved in
the standalone (pad→active-mask happens in C++ only).

## 9. Serpe concentric circles (M–L · ★★)

Polymeter lanes rendered as nested rings. The data model shipped
2026-07-18 ("Serpe Poly: webapp lanes view — polymeter playback with
Keil offsets") — this item is a *renderer* for it. Seam:
`apps/serpe/engine/render.js` (SVG views via refs; the existing circle
view is single-ring). Geometry is the design decision (ring per lane,
shared angular origin, accents as the existing amber) — flag for the
design pass before polishing. Reminder: display must mirror the
engine's accent branch exactly (`Documentation/FEATURE_PARITY.md` tail
notes tell that whole story — read them before touching Serpe display
code).

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
