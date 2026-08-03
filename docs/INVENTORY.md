# Suite inventory — every tool and module, one line each

*Started 2026-07-19 as the tracking base for the plain-language
documentation pass: if it isn't listed here, it won't get documented.
Names and one-liners are checked against the code (package descriptions,
module registries, CMake targets) — update this file in the same commit
that adds or removes a deliverable. Vocabulary lives in
[GLOSSARY.md](GLOSSARY.md); build steps in [../BUILD.md](../BUILD.md).*

## Plugins (7 repos, JUCE on enkerli-juce except Vane/DrawnQurve)

| Plugin | Code | Formats | What it does |
|---|---|---|---|
| Vane | `aumu VAne` | AU·VST3·CLAP·Standalone·AUv3; LV2·VST3·CLAP·Standalone on Linux (desktop default; `-DVANE_LINUX_HEADLESS=ON` for MODEP/Pi = LV2·Standalone) | Breath-first wind-controller synth; WASM voice powers the browser standalone |
| Serpe | `aumi RPEd` | AU·VST3·Standalone·AUv3; LV2·VST3·CLAP·Standalone on Linux | Rhythm-pattern engine; UPI notation; engine-authoritative WebView UI |
| DrawnQurve | — | AU·AUv3·VST3·Standalone (macOS/iPadOS); VST3·LV2·Standalone (Linux) | Draw/record gesture curves ("qurves") that drive MIDI; polyphonic lanes |
| PitchFold | `aumi Pqf1` | AU·VST3·Standalone·AUv3·LV2 | Folds incoming pitch into a chosen pitch-class set |
| ProgGenie | `aumi Prst` | AU·VST3·Standalone·AUv3 | Chord-progression generator/editor over corpus statistics |
| MIDIcurator | `aumi Mcur` | AU·VST3·Standalone·AUv3 | Clip library and curation; host-synced auditioning; file-backed library |
| Suite Workspace | `aumi Wksp` | AU·VST3·Standalone·AUv3; LV2·VST3·CLAP·Standalone on Linux | The workspace webapp in a DAW: bus notes out as host MIDI, host MIDI in to bindings |

## Webapps (11, on Pages: `…/music-suite/apps/<slug>/`)

workspace · proggenie · midicurator · serpe · pitchfold · vane ·
drawnqurve · pickpcs · chord-dictionary · exquisite · style-gallery
— see GLOSSARY.md for what each one is; four (serpe, pitchfold, vane,
drawnqurve) are the same code the plugins embed.

## Packages (15, `@enkerli/*`, TypeScript/JS)

| Package | One line (from its manifest) |
|---|---|
| theory | Zero-dependency music theory core: pitch classes, PCS, chords, voice leading, rhythm |
| ui | Design tokens + shared web components (browsers and JUCE WebViews) |
| midi | Standard MIDI File writing (promoted from MIDIcurator) |
| webmidi | Shared real-time Web MIDI layer (wrapper over WEBMIDI.js) |
| upi | Serpe's UPI rhythm engine: notation, generators, transforms, analysis |
| proggen | ProgGenie's progression engine: Markov/trigram generation, curation, voicing |
| accompaniment | GloriArp's engine: curated phrases reharmonized across a progression, seeded |
| control | Binding layer: keyboard / MIDI-CC / MIDI-note → param/command via tool manifests |
| drumsynth | A small synthesised drum kit — x0x-style voices, no samples, eight sounds on eight distinct pitch classes. Renders hits for `msuite upi --wav`, the examples and the Workspace |
| voice-routing | Voice routing primitives: round-robin Voice Split + priority note-stealing Mono Merge (extracted from PitchFold, KT item 8) |
| protocol | SysEx-JSON message protocol: versioned envelope, 7-bit codec, chunking |
| library | LIS-informed content envelope (identity, provenance, facets) |
| corpus-tools | Lead-sheet corpus pipeline (no corpus data ships) |
| codegen | Lua/C++ generation from theory data |
| cli | `msuite` — the headless tools (below) |

## `msuite` CLI (15 commands)

`accompany` · `bind` · `bridge` · `chord` · `describe` · `drums` ·
`generate` · `pattern` · `play` · `recv` · `render` · `send` · `smf` ·
`style` ·
`upi` — matrix of what runs where: [HEADLESS.md](HEADLESS.md).

## Workspace modules (20, `apps/workspace/modules.js` `MODULES`)

Control Surface · Vane Synth · Drum Kit · Drum Style · Pattern (UPI) · PCS Pads ·
Voice Split ·
Mono Merge · Pattern Transforms · Pattern Player · Rhythm Analysis ·
Progression · GloriArp · Keys · Chord Namer · Recorder · Library ·
Bindings · Bus Monitor · Bridge (CLI)
*(PCS Pads · Voice Split · Mono Merge are the KT-item-8 additions.)*

## Data & foundation repos

- **enkerli-juce** — the shared plugin foundation (archetypes, bridge,
  schedulers, validate.sh ladder).
- **manifold** — controller capability database (YAML).
- **vane-wavetable-library** — wavetable banks + provenance metadata.
- **JazzPatterns** — melodic vocabulary (ODbL; keep the notice).
- **Jazz Progs and Gen** *(private, local-only)* — corpus + planning
  document of record.

## Documentation set (docs/)

CODE_CENSUS (dead code + stopped migrations, 2026-07-27) · GLOSSARY (vocabulary) · BUILD (all build commands) · HEADLESS (CLI/where
things run) · MASTER_PLAN (roadmap spine) · USE_CASES · CONTROL_PLANE ·
WORKSPACE_PLUGIN · GLORIARP_BRIEF + GLORIARP_AUDIT · LIBRARY_SPEC +
schemas/ · JUCE_INDEPENDENCE · A11Y_TEST_PLAN + A11Y_AUDIT + UX_AUDIT ·
BROWSER_TEST · NOTATION_SYSTEMS · JAM · personas · site (single-source
site copy) · **HANDOFF.md** (repo root — start there).
