# Exquisite Fingerings - Architecture

## Overview

This project uses a modular architecture designed to support both a web application and future plugin development (AUv3, VST3). The core logic is completely separated from the UI, allowing it to be reused across different platforms.

## Directory Structure

```
exquisite-fingerings/
├── src/
│   ├── core/           # Core logic (platform-independent)
│   ├── ui/             # UI components (web-specific)
│   ├── data/           # Data files and catalogs
│   ├── utils/          # Utility functions
│   ├── assets/         # CSS, images, etc.
│   ├── index.html      # Entry point
│   └── app.js          # Main application controller
├── tests/              # Unit tests
├── docs/               # Built webapp (GitHub Pages)
├── plugin/             # Future plugin code
└── docs-md/            # Documentation
```

## Core Modules

### `core/music.js`
Music theory fundamentals:
- Pitch class operations
- Note name conversions
- Pitch class sets (scales, chords)
- Binary representation (12-bit for PCS)
- Transposition and intervals

**Key Functions:**
- `getPitchClasses(key, setType)` - Get PCS for a key and scale/chord
- `pcsToBinary(pcs)` / `binaryToPcs(binary)` - Binary conversion
- `midiToNoteName(midiNote)` - MIDI to note name
- `transposePcs(pcs, semitones)` - Transpose a PCS

### `core/grid.js`
Exquis hex grid geometry:
- Grid structure (11 rows, alternating 6/5 pads)
- Pad indexing and coordinates
- MIDI note mapping
- SVG geometry calculations
- Neighbor and distance calculations

**Key Constants:**
- `ROW_COUNT = 11`
- `ROW_START` - Starting pad index for each row
- `INTERVAL_VECTORS` - Musical intervals on the grid

**Key Functions:**
- `getPadIndex(row, col)` - Global pad index
- `getRowCol(padIndex)` - Reverse lookup
- `getMidiNote(row, col, baseMidi)` - MIDI note for pad
- `getCellCenter(row, col)` - SVG coordinates
- `getHexPoints(cx, cy, size)` - Hexagon SVG points

### `core/midi.js`
MIDI I/O via WebMIDI API:
- Device management
- Note on/off messages
- Hold duration and octave range
- Chord playback with stagger

**MIDIManager Class:**
- `init()` - Initialize WebMIDI
- `selectOutputDevice(deviceId)` - Select MIDI device
- `playNote(midiNote, velocity, duration)` - Play note
- `playChord(midiNotes, ...)` - Play chord
- `enableHold()` / `disableHold()` - Toggle hold mode

### `core/fingering.js`
Fingering system and ergonomic analysis:
- Fingering pattern storage
- Ergonomic analysis
- Fingering suggestions

**FingeringPattern Class:**
- `setFingering(row, col, hand, finger)` - Assign fingering
- `getFingering(row, col)` - Get fingering for pad
- `toJSON()` / `fromJSON()` - Serialization

**ErgoAnalyzer Class:**
- `analyzePattern(pattern)` - Calculate ergonomic score
- `suggestFingerings(pads, hand)` - Auto-suggest fingerings
- Hand size profiles (small/medium/large)

## UI Components

### `ui/svg-grid.js`
SVG renderer for the hex grid:
- Renders all pads with labels
- Highlights pitch classes
- Displays fingering numbers
- Handles orientation (portrait/landscape)

**GridRenderer Class:**
- `setOrientation(orientation)` - Portrait/landscape
- `setHighlightedPCs(pcs)` - Highlight pitch classes
- `setFingeringPattern(pattern)` - Display fingerings
- `render()` - Render complete grid

### `app.js`
Main application controller:
- Wires together all components
- Manages application state
- Handles UI events
- Saves/loads settings and patterns

**ExquisFingerings Class:**
- State management
- Event handling
- Pattern management
- MIDI control

## Utilities

### `utils/storage.js`
LocalStorage wrapper:
- `savePattern(name, data)` - Save fingering pattern
- `loadPattern(name)` - Load pattern
- `saveSettings(settings)` - Save app settings
- `exportPattern(name)` / `importPattern(json)` - JSON export/import

## Data Flow

1. **User Input** → UI Controls (sidebar)
2. **Controls** → App State (ExquisFingerings)
3. **App State** → Core Logic (music.js, grid.js, fingering.js)
4. **Core Logic** → GridRenderer
5. **GridRenderer** → SVG Display

For MIDI:
1. **User Action** → App
2. **App** → MIDIManager
3. **MIDIManager** → WebMIDI API
4. **WebMIDI** → Physical Device (Exquis)

## Testing

Tests are in `tests/` with parallel structure to `src/core/`:
- `tests/core/music.test.js` - Music theory tests
- `tests/core/grid.test.js` - Grid geometry tests

Using Vitest for fast, modern testing.

## Build Process

1. **Development**: `npm run dev` (Vite dev server)
2. **Testing**: `npm test`
3. **Production**: `npm run build` (outputs to `docs/`)

Vite bundles:
- `src/index.html` → `docs/index.html`
- `src/**/*.js` → `docs/assets/main-[hash].js`
- `src/assets/css/*.css` → `docs/assets/main-[hash].css`

## Plugin Architecture (Future)

The core modules (`core/`) are designed to be platform-independent:
- No DOM dependencies
- No browser-specific APIs (except in `core/midi.js`)
- Pure JavaScript classes and functions

For plugin development:
1. Reuse `core/` modules as-is
2. Replace `ui/` with plugin UI framework
3. Replace `core/midi.js` with plugin MIDI API
4. Reference template: https://github.com/Enkerli/iPad-AUv3-MIDI-Template

## Grid Layout Bug Fix

**Note**: The original `xKey.html` had a bug where `ROW_LENGTH` returned 6/5 pads but `ROW_START` was calculated with +4/+3 increments. This has been fixed:

- **Original (buggy)**: `ROW_START = [0, 4, 7, 11, 14, 18, 21, 25, 28, 32, 35]`
- **Corrected**: `ROW_START = [0, 6, 11, 17, 22, 28, 33, 39, 44, 50, 55]`

This matches the actual Exquis hardware layout with 6/5 pads per row.

## Dependencies

- **Vite**: Build tool and dev server
- **Vitest**: Testing framework
- **jsdom**: DOM environment for tests

Zero runtime dependencies - vanilla JavaScript only!
