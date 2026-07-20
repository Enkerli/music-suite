# Glossary

*Started 2026-07-15. Plain definitions of the suite's recurring terms — the
apps, the shared concepts, the conventions, the content model, and the
control plane — so a newcomer (person or agent) can read the other docs
without reverse-engineering the vocabulary. Grouped, not alphabetized, so
related terms sit together; a term's authority (the file or doc that owns
it) is named where one exists. Living document.*

## Plain-language basics (the words the [user guide](USER_GUIDE.md) leans on)

- **MIDI** — the common language musical devices and programs use to say
  "play this note now, this hard" or "turn this knob." It carries
  instructions, not sound.
- **MIDI file (SMF)** — those instructions saved as a `.mid` file any
  music program can open. Suite exports embed the full chord information
  so other suite tools can read the *meaning* back, not just the notes.
- **WebMIDI** — the browser feature that lets a web page talk MIDI to
  your hardware. Chromium browsers (Chrome, Edge, Brave) have it; Safari
  and Firefox don't — suite apps then show "No Web MIDI" and everything
  except talking to gear still works.
- **DAW** — digital audio workstation: a music-making program
  (GarageBand, Logic, Live, Reaper, AUM…). Hosts plugins.
- **Plugin** — a tool that runs *inside* a DAW, synced to its tempo and
  transport. Seven suite tools ship as plugins. A **standalone** is the
  same tool as its own app, no DAW needed.
- **Chord** — a group of notes sounded together. A **chord progression**
  is a sequence of chords — the harmonic skeleton most music hangs on.
- **Scale** — a set of notes that sound like they belong together; the
  pool a melody draws from.
- **Pattern** — a rhythm as a loop of steps; steps that sound are
  **onsets**. See UPI below for the notation.
- **Groove** — a rhythmic accompaniment figure (a bassline, a comping
  pattern); in the suite, GloriArp makes these.
- **Tempo / BPM** — speed, in beats per minute.
- **Bus** — the Workspace's shared message channel: modules publish
  chords/patterns/scales and any module (or another tab) can react.
  The machinery behind it is the control plane, below.

## The apps (the `@enkerli/library` `AppId` vocabulary)

The controlled list is `APPS` in `@enkerli/library` — the one authority for
naming a sender/target in the protocol.

- **Vane** — flagship wind-controller instrument (JUCE 8 plugin; a WASM voice
  powers the browser standalone). Persona 1's tool.
- **Serpe** — rhythm engine and pattern explorer; home of the **UPI**
  notation language. (Repo: `rhythm_pattern_explorer`.)
- **DrawnQurve** — gesture/automation source; draw or record curves
  ("qurves") that drive MIDI. Now polyphonic (per-lane multiple qurves).
- **PitchFold** — PCS quantizer: folds incoming pitch into a chosen
  pitch-class set.
- **PickPCS** — pitch-class-set explorer; the canonical *sender* of a
  `scale` message (PickPCS → PitchFold is the shipped pair).
- **MIDIcurator** — clip library and analysis (gesture/harmonic/leadsheet);
  the only app with i18n today, and the one with a full design-research set
  (`apps/MIDIcurator/docs/design/`).
- **ProgGenie** (progression-studio) — chord-progression generator/editor;
  the deepest adopter of `@enkerli/ui`. (App id: `proggenie`.)
- **Chord Dictionary** — the 167-quality chord reference.
- **exquisite-fingerings** — fingering builder for isomorphic grid
  instruments (Exquis / Launchpad-style). (App id: `exquisite-fingerings`.)
- **style-gallery** — the design-system showcase (not a user tool).
- **external** — the reserved sender id for anything outside the suite (a
  CLI-originated message, a DAW, a Shortcut).

## Conventions

- **Leftmost = LSB** — in any bitmask, element *i* is bit *i* (2^*i*);
  hex/octal/decimal digits read little-endian. A deliberate, re-decided
  choice ([CONVENTIONS.md](../CONVENTIONS.md)), not to be "fixed."
- **Structural spelling** — interval degree fixes the note letter, semitone
  size fixes the alteration (from G♯, the major third is B♯). Bare PCS stay
  unspelled. Authority: `spelling.ts`.
- **Derived-statistics-only corpus** — the private jazz corpus never ships;
  only regenerated transition tables/trigrams do ([HANDOFF.md](../HANDOFF.md) §5).
- **Integration before features** — the moratorium: no new features until
  integration is robust ([MASTER_PLAN.md](MASTER_PLAN.md) §0).

## Musical objects & notations

Full catalogue in [NOTATION_SYSTEMS.md](NOTATION_SYSTEMS.md); the short
definitions:

- **PCS (pitch-class set)** — a subset of the 12 pitch classes; canonical
  form is a 12-bit **mask** (C major = 2741). See also **mask**.
- **Mask** — an integer bitfield (leftmost = LSB). A *pc-mask* is 12 bits; a
  *rhythm-mask* has one bit per step.
- **Onset** — a step that sounds, in a rhythm pattern.
- **UPI** — Serpe's pattern-notation language (`E(3,8)` Euclidean, etc.);
  the engine is the `@enkerli/upi` package-promotion candidate.
- **Euclidean rhythm** — onsets spread as evenly as possible over N steps
  (`E(beats, steps, rotation)`).
- **Barlow indispensability** — a ranking of metric positions by structural
  weight; drives Serpe's syncopation scoring and onset add/remove.
- **Qurve** — a DrawnQurve curve: a drawn/recorded shape that modulates a
  MIDI stream. A NOTE lane may hold several (polyphony).
- **Roman numeral / degree chord** — a key-relative chord label (`ii`,
  `V7`, `♭VII`); case encodes quality.
- **Taxicab / L1 voice leading** — total semitone motion between voicings
  (Tymoczko); `voiceLeading.ts`.
- **Leadsheet / Progression** — the shared canonical type for a chord
  progression (key + sections + bars), with SMF round-trip; the first real
  app-to-app data flow.

## The content model (`@enkerli/library`, LIS-informed)

Authority: [LIBRARY_SPEC.md](LIBRARY_SPEC.md).

- **Item / envelope** — every piece of user content (preset, patch,
  progression, clip, wavetable, qurve, control-map…) wrapped with a stable
  **identity**, **provenance**, controlled-vocabulary values, and facets.
- **Identity** — a stable id independent of title/filename; renames never
  orphan references.
- **Provenance** — the recorded chain of where an item came from (derived
  from, generated by, sourced from, under what license/evidence).
- **Authority control** — musical/technical values come from controlled
  vocabularies (`@enkerli/theory` for keys/qualities/masks; `manifold` for
  controllers), not free text. Free-text **tags** coexist as a separate
  field.
- **Facet** — an orthogonal axis for finding items (kind × app × key × mood
  × status…), as opposed to a folder path.
- **LibraryBrowser** — the shared, config-driven browse/search/filter UI
  (`@enkerli/ui` `createLibraryBrowser`) every app is meant to instantiate.

## The control & interop plane

Authority: [CONTROL_PLANE.md](CONTROL_PLANE.md); code in
`@enkerli/protocol` + `@enkerli/cli`.

- **SuiteMessage** — the versioned JSON envelope (`from`/`to`/`type`/`body`)
  every inter-tool message uses.
- **Transport** — a carrier of SuiteMessages. **SysEx** (over MIDI) and
  **stdio-NDJSON** (one JSON message per line, for headless pipes) exist;
  App-Group and BroadcastChannel are planned.
- **Manifest** — a tool's declared addressable surface: its **params** and
  **commands**. Self-describing (it is itself a `manifest` message).
- **Param** — a named, ranged, unit-carrying value on a tool; set/reported/
  observed via a `param` message. The unit of modulation and automation.
- **Command** — a named action on a tool (`next-pattern`, `mutate`),
  invoked via a `command` message with named, validated args.
- **Binding** — a mapping from an input (keystroke, MIDI CC/note) to a
  `param` or `command`. A saved set of bindings is a **control-map**
  (a library kind).
- **Headless** — running with no GUI/DAW/plugin host: node scripts, console
  binaries, CI, a Linux (MODEP) box. Inventory in [HEADLESS.md](HEADLESS.md).

## Platform & packaging

- **JUCE / WebView / bridge** — plugins are JUCE shells; UIs are web apps
  embedded via a `BridgedWebView`; the `enkerli::…` bridge carries MIDI/file
  I/O. Traps are logged in enkerli-juce `TESTING.md`.
- **LV2 / CLAP / AUv3 / VST3 / AU** — the plugin formats; **LV2** and
  **CLAP** are the headless-capable Linux/desktop paths (MODEP, headless
  Ardour, `clap-validator`).
- **MODEP / Patchbox OS / Ubuntu Studio** — the headless Linux targets.
- **Persona** — a named design target the suite builds for; **seven** in
  [personas.md](personas.md) (reconciled 2026-07-15 — the earlier five plus
  the curious newcomer and the systematic maker).
