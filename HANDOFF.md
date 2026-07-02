# Enkerli Music Suite — handoff

*Written 2026-07-01 so the project can be picked up through other means —
another person, another agent, another toolchain — without access to any
prior conversation history. Everything here was verified against the repos
on that date.*

## 1. What this is

A suite of music tools (harmony, rhythm, gesture, pitch-collection,
curation, sound) being integrated into cross-platform, user-friendly
modules: shared TypeScript theory/UI packages, web apps, and JUCE-shelled
plugins (AU, VST3, AUv3, LV2, standalone) for macOS, iPadOS, Linux
(Ubuntu Studio / Patchbox OS), and Windows. Everything is **Public
Domain**. Design goals: accessibility, responsiveness, adaptability,
localization, security, privacy, fairness — and a Library-&-Information-
Sciences-informed model for patches/presets/profiles/assets/content.

Three principles that override habit:
- **The conventions are deliberate.** Leftmost = LSB bit order and
  structural (enharmonic-correct) note spelling are decisions, not
  accidents — do not "fix" them toward common practice. See
  [CONVENTIONS.md](CONVENTIONS.md).
- **No new features until integration is robust.** Feature wishlists exist
  and wait (SUITE_AUDIT_AND_PLAN.md §6, in the private repo — see §5).
- **Copy stays plain and humble** — no hype, no "songs" framing; all site
  copy is single-sourced in [docs/site.md](docs/site.md).

## 2. Repo map

| Repo | Where | Role |
|---|---|---|
| **music-suite** (this repo) | github.com/Enkerli/music-suite | Monorepo: `packages/` (theory, ui, midi, webmidi, codegen, corpus-tools), `apps/` (ten web UIs incl. the plugin WebViews), `docs/` (Pages site, generated from `site.md` by CI) |
| **enkerli-juce** | github.com/Enkerli/enkerli-juce | The shared plugin foundation: ~921 LOC C++/ObjC (BridgedWebView, MidiClipScheduler, MidiInputCollector, FileImport/Export) + CMake archetypes encoding host-quirk scar tissue; TESTING.md is the validation ladder |
| **Vane** | github.com/Enkerli/Vane (local: `~/Vane`) | Flagship instrument (JUCE 8). `Tools/wasm/` builds its real DSP to WASM for the browser standalone |
| **rhythm_pattern_explorer** (Serpe) | github.com/Enkerli/rhythm_pattern_explorer (local: `~/Desktop/rhythm_pattern_explorer`) | Rhythm engine, production plugin. `Documentation/FEATURE_PARITY.md` is the recovery scope for the WebView UI — the ledger, not the design doc, is authoritative |
| **DrawnQurve** | github.com/Enkerli/DrawnQurve (local: `~/DrawnQurve`) | Gesture/automation source; JUCE 7, native UI — the monorepo `apps/drawnqurve` WebUI is its future |
| **PitchFold** | github.com/Enkerli/PitchFold (local: `~/Desktop/PitchFold`) | PCS quantizer; the WebView-pattern pathfinder |
| **progression-studio-plugin** (ProgGenie) | github.com/Enkerli/progression-studio-plugin | Thin shell (~1.1k LOC) over `apps/progression-studio` |
| **midicurator-plugin** | github.com/Enkerli/midicurator-plugin | Thin shell (~1.1k LOC) over `apps/MIDIcurator` |
| manifold, vane-wavetable-library, JazzPatterns | GitHub (Enkerli) | Data repos: controller capabilities (YAML), wavetable bank + provenance metadata, melodic vocabulary (ODbL — keep the notice) |
| **Jazz Progs and Gen** | **local only, no remote — by design** | See §5. The planning document of record lives here |

## 3. Build, test, deploy

**Monorepo:** `npm install && npm test` (Vitest; 847 tests green as of
2026-07-01). The TS packages must be compiled before app tests/builds can
resolve them — `npm install` does this automatically (`prepare` runs
`tsc -b` over the packages) and `pretest` re-runs it incrementally, so the
two commands above are genuinely sufficient from a fresh clone
(clone-verified 2026-07-01). App bundles: `npm run build -w <app-name>`
(e.g. `-w progression-studio`). The Pages site + app bundles deploy via
GitHub Actions (`ci:` commits of 2026-06-24/28 define it): shared packages
build first, then apps rebuild into `docs/apps/`.

**Plugins:** CMake per repo; the enkerli-juce archetypes carry the
format flags. The **validation ladder** (enkerli-juce `TESTING.md`, plus
`DEVICE_TESTING_CHECKLIST.md`) is: build matrix → macOS `auval` →
pluginval 8 (strictness 10) → WKWebView smoke → iOS cross-compile →
real hosts on ≥2 physical iPads (AUM registration ritual documented).
**Known recurring trap:** the iOS *signed* build fails whenever the Apple
dev account / provisioning lapses — an account issue, never a code
regression; don't rebuild to rediscover it.

**WKWebView traps already solved once** (grep TESTING.md before
re-fighting): `window.confirm/prompt` are no-ops; `juce://` opaque origin
breaks IndexedDB (MIDIcurator's library is file-backed over the bridge for
this reason); downloads need `enkerli::exportBytes`; editor-lifetime
`callAsync` lambdas need `Component::SafePointer`.

**Repo hygiene wart:** PitchFold tracks its `build-macos/` directory, so
every rebuild dirties the tree (48 modified objects at handoff time).
Untracking build dirs is queued cleanup, not data loss.

## 4. The two load-bearing conventions

1. **Bit order: leftmost = LSB, everywhere** (re-decided 2026-06-22 after
   a two-week MSB experiment was reverted). Element *i* is bit *i* (2^i);
   hex/octal digits read little-endian; tresillo = `0x94` = d73.
   Reference codecs + cross-language vectors: `packages/theory`.
   External formats (SMF, Apple Loops) keep their native order.
2. **Note spelling is structural**: interval degree fixes the letter,
   semitone size fixes the alteration (from G♯, the major third is B♯,
   never C). Bare PCS stay chromatic (no context, no proper spelling).
   `spelling.ts` in `@enkerli/theory`, vectors pinned.

## 5. The private corpus (most valuable, most at-risk asset)

`~/Desktop/Jazz Progs and Gen` — local git repo, **no remote, on purpose**:
the 2,623 jazz-standard lead sheets (`corpora/`, ~14 MB) are **never
published** (upstream: Carey Bunks's corpus / Impro-Visor imaginary book).
Note carefully: **`corpora/` is gitignored**, so git operations (and git
bundles) do *not* cover it — file-level backup is required.

- Only **derived statistics** ship: transition tables + trigrams,
  regenerated by `@enkerli/corpus-tools` (`regenerated/REGENERATION.md`
  in the private repo describes the audit).
- **Backups (2026-07-01):** iCloud Drive `Backups/` holds
  `jazz-progs-and-gen-2026-07-01.bundle` (all git refs, clone-verified)
  **and** `jazz-corpora-2026-07-01.tar.gz` (2,691 files,
  sha256-verified). Refresh both when the repo changes; keep a second
  off-machine copy when an external disk is available.
- The suite's **planning document of record** is
  `SUITE_AUDIT_AND_PLAN.md` in that repo: audit, architecture, phase
  history, the §6 track queue + backlog triage, the §7 Leadsheet spec,
  and the §8 July-2026 sprint plan.

## 6. Where the work stands / what's open

- **Done and stable:** theory/ui/midi/webmidi package layer; ten web apps
  on Pages; six plugins through the validation ladder; ProgGenie's full
  design-decisions arc (Q1–Q6); the Leadsheet/Progression shared type +
  SMF round-trip (first real app-to-app data flow); Vane's browser
  standalone (WASM voice, MPE over WebMIDI).
- **Open queues, in priority order:**
  1. **Serpe parity closeout** — `Documentation/FEATURE_PARITY.md`:
     remaining ✗/⚠ rows mostly fall to one structural fix (plugin sends
     UPI straight to the C++ engine; UI renders engine state).
  2. **Track B remainder** (§6 of the plan doc): component adoption
     (range-slider into PitchFold, arming chrome, sections).
  3. **Track C remainder**: passing-dim insertion wiring, JI/tuning
     thread, music-model items.
  4. **Track D (deferred by design)**: live suite messaging; the
     ProgGenie→MIDIcurator App-Group inbox is **gated on the Apple
     Developer account** (steps written out in the plan doc §6 backlog).
- **Content model specified, unimplemented:** [docs/LIBRARY_SPEC.md](docs/LIBRARY_SPEC.md)
  + [docs/schemas/library-item.schema.json](docs/schemas/library-item.schema.json)
  — the LIS-informed envelope for patches/presets/profiles/progressions/
  wavetables (identity, provenance, authority control, facets), with a
  mapping table for every existing content kind and a staged MVP path
  (ProgGenie kinds first). Known gap it surfaced: DrawnQurve qurves exist
  only inside plugin state chunks — not yet first-class content.
- **Platform decision pending:** [docs/JUCE_INDEPENDENCE.md](docs/JUCE_INDEPENDENCE.md)
  — measured footprint, options, effort/risk estimates, and a staged
  recommendation (CLAP desktop shells, JUCE-kept AUv3, identical web UI).
- **Deprioritized (2026-07-01):** PWA packaging and the Safari-WebMIDI
  alternative — both remain written up (plan doc §8) but neither blocks
  anything.

## 7. Accessibility — state and testing prep

Testing will be carried out through specialized means. **Start here:
[docs/A11Y_TEST_PLAN.md](docs/A11Y_TEST_PLAN.md)** — the self-sufficient
test package (scope, URLs, personas as lenses, component semantics with
known thin spots, plugin-WebView differences, reporting format). Backing
material:
- **Automated floor:** `packages/ui/tools/contrast-audit.mjs` verifies 36
  WCAG-AA contrast contracts over the token themes — run after any token
  change.
- **Design commitments:** `packages/ui/DESIGN.md` (a11y/personas/
  localization/theming checklist), `docs/personas.md` (five personas,
  including an accessibility-first performer), `packages/ui/HANDOFF.md`
  (component-level notes).
- **Component semantics:** the shared components (pcs-ring, pitch-grid,
  piano-roll, section, range-slider, leadsheet-editor) are keyboard-
  operable by construction (tabindex, Enter/Space, focus rings); color is
  never the only encoding (shape/texture/label pair it — e.g. the Q5 pad
  grid's fill+edge+glyph roles).
- **Not yet done anywhere:** a screen-reader (VoiceOver) pass on real
  pages, and any localization implementation (no string extraction
  exists; the requirement is documented in DESIGN.md).
- Live app URLs for testing: the Pages site serves all ten apps from
  `docs/apps/` (chord-dictionary, drawnqurve, exquisite, midicurator,
  pickpcs, pitchfold, proggenie, serpe, style-gallery, vane).

## 8. If you only read one thing

Read `SUITE_AUDIT_AND_PLAN.md` in the private repo (§2 architecture, §6
queue, §8 sprint). Then CONVENTIONS.md. Then, before touching any plugin,
enkerli-juce TESTING.md — every trap in it was paid for once already.
