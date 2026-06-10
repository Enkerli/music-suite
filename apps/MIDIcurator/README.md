# MIDIcurator

A web-based MIDI pattern analysis and transformation tool. Import MIDI clips, detect chords, visualize on a piano roll, play back with WebAudio, and generate density variants — all in the browser with no backend required.

**[Live Demo](https://enkerli.github.io/MIDIcurator/)**

## Features

- **MIDI Import/Export** — Drag-and-drop `.mid` files; export clips and variants as MIDI
- **Piano Roll** — Canvas-based visualization with velocity coloring, grid lines, and playhead
- **Chord Detection** — 104 chord qualities via decimal-fingerprint lookup with per-bar segmentation
- **WebAudio Playback** — Triangle-wave synthesis with transport controls (play/pause/stop)
- **Density Transforms** — Generate 0.5x–1.5x density variants of any pattern
- **Clip Library** — IndexedDB-backed local database with tagging, rating, and search
- **Light/Dark Mode** — CSS custom property theming with toggle
- **Keyboard Shortcuts** — Space (play/pause), D (download), V (variants), and more
- **ZIP Export** — Bundle variant families into a single download

## Tech Stack

| Layer | Tech |
|-------|------|
| UI | React 18 + TypeScript (strict) |
| Build | Vite 6 |
| Audio | WebAudio API (triangle oscillators) |
| Visualization | Canvas API |
| Storage | IndexedDB |
| Tests | Vitest (111 tests) |

Zero runtime dependencies beyond React.

## Getting Started

```bash
npm install
npm run dev        # Dev server at localhost:5173
npm run build      # Production build to dist/
npm run preview    # Preview production build
npm test           # Run test suite
```

## Architecture

```
src/
├── lib/           # Pure TypeScript — chord detection, MIDI I/O,
│   │                piano roll math, playback engine, transforms
│   └── __tests__/ # 8 test files, 1,500+ lines
├── components/    # React UI (MidiCurator, PianoRoll, ChordBar,
│                    StatsGrid, TransportBar, Sidebar, etc.)
├── hooks/         # usePlayback, useDatabase, useKeyboardShortcuts
└── types/         # Clip, Note, Gesture, Harmonic, DetectedChord
```

**Design principle**: All music logic lives in stateless, testable pure functions in `lib/`. React components handle rendering and state; hooks bridge the two.

## Development Log

### Session 1 — Feb 2, 2026
**Foundation**

Scaffolded the project with Vite + React + TypeScript. Added Vitest and foundational unit tests for the lib modules. Wrote ROADMAP.md defining the phased development plan and decision rules (150% rule, branch-per-phase, atomic commits).

> 3 commits · `86ac92e`–`c704ad1`

### Session 2 — Feb 3, 2026
**Phase B (Piano Roll + Playback) and Phase A (Harmonic Awareness)**

Big day. Completed Phase B in the morning: canvas piano roll with grid lines, velocity-colored notes, and a WebAudio playback engine with transport controls. Merged to main and released **v0.2.0**.

Then pivoted to Phase A: ported the MIDIsplainer chord dictionary (104 qualities), built the detection engine with 12-rotation brute-force + subset matching, wired per-bar chord segmentation into the UI (ChordBar, StatsGrid, ClipCard). Added light mode, "clear all" button, dynamic chord display at playhead. Fixed a MIDI parser meta-event bug and added sustained-note chord detection. 69 new tests.

> 8 commits · `35e69da`–`f671e5e`

### Session 3 — Feb 4, 2026
**Pitch class set fallback**

Added graceful fallback when a chord can't be recognized: displays the pitch class set instead of leaving the field blank. Improves robustness for non-standard voicings.

> 1 commit · `9d238a2`

### Session 4 — Feb 6, 2026
**Documentation + GitHub Pages deployment**

Project documentation (this README), development timeline, and GitHub Pages deployment setup for early prototype sharing.

## Roadmap

| Phase | Version | Status | Goal |
|-------|---------|--------|------|
| **B** | 0.2.x | Done | Piano roll + playback |
| **A** | 0.3.x | In progress | Harmonic awareness (chord detection) |
| A-V | — | Planned | Chord validation (third-party comparison) |
| C1 | 0.4.x | Planned | Single-chord realization (voice leading) |
| C2 | 0.5.x | Planned | Progression application |
| D | 0.6.x | Planned | Serpe integration (Euclidean rhythms) |
| C3 | 0.7.x | Planned | Markov progression generation |
| G | 0.8.x | Planned | Curation + taxonomy |
| E | 0.9.x | Planned | Feedback + live learning |
| **F** | **1.0.0** | Planned | **JUCE plugin (DAW integration)** |

See [ROADMAP.md](ROADMAP.md) for the full plan, decision rules, and risk assessment.

## License

All rights reserved.
