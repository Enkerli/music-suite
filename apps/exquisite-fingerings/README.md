# Exquisite Fingerings

An interactive web application for exploring fingerings on the Intuitive Instruments Exquis controller.

## Features

### Grid Display
- Accurate hex grid representation of the Exquis controller
- **Portrait mode** (peaks up/down): 11 chromatic rows alternating 6 and 5 pads
- **Landscape mode** (flats up/down): Same layout rotated 90° clockwise
- Interval layout: Northwest diagonal = minor third up, Northeast diagonal = major third up

### Musical Highlighting
- Select key and scale/chord type to highlight pads
- Supported types: Major scale, Natural minor, Major triad, Minor 7th, Dominant 7th
- Custom pitch class support (0-11, comma-separated)
- Three label modes: Pitch class (0-11), Note names, MIDI numbers

### Fingering System
- **Enable Fingering Mode** to assign finger numbers (1-5) to pads
- Choose between **Left hand** (blue) and **Right hand** (red) fingerings
- Click pads to assign the currently selected finger
- Keyboard shortcuts: Press keys 1-5 to select finger number
- Click the same fingering to remove it
- Visual display: Fingering numbers appear above pad labels

### Pattern Management
- Save fingering patterns with custom names
- Patterns store: fingerings, key, scale/chord type, and base MIDI note
- Load saved patterns from dropdown
- Delete patterns you no longer need
- Patterns are stored in browser localStorage

### MIDI Output
- **WebMIDI support** for Chromium-based browsers (Chrome, Brave, Edge)
- Send MIDI notes to connected devices (highlights pads on physical Exquis)
- Click pads to play individual MIDI notes
- Optional: Auto-send all highlighted notes when changing scale/chord
- **Safari-compatible**: App works fully in Safari (except MIDI Out)

## Usage

### Basic Navigation
1. Choose orientation: Portrait or Landscape
2. Select a key and scale/chord type
3. Adjust base MIDI note if needed (default: 48 = C3)
4. Switch between label modes to see different information

### Creating Fingerings
1. Enable Fingering Mode checkbox
2. Select a hand (Left or Right)
3. Click finger buttons 1-5 (or press keys 1-5)
4. Click pads to assign the selected finger
5. Click again on a pad with the same fingering to remove it
6. Click "Clear All Fingerings" to start over

### Saving Patterns
1. Create your fingering pattern
2. Enter a descriptive name (e.g., "C Major Scale - Right Hand")
3. Click "Save Pattern"
4. Pattern is saved and can be loaded later

### MIDI Setup (Chromium browsers only)
1. Connect your Exquis controller via USB
2. Click "Enable MIDI Output" and grant permission
3. Select "Exquis" from the MIDI Device dropdown
4. Click pads to hear notes and see them light up on the controller
5. Enable "Send MIDI on pad highlight" to automatically light up all pads in a scale/chord

## Browser Compatibility

- **Chrome/Brave/Edge**: Full functionality including MIDI Out
- **Safari** (macOS/iOS/iPadOS): All features except MIDI Out
- Works on desktop and tablets

## About the Exquis Layout

The Exquis uses a hex grid layout with these musical properties:

- **Chromatic rows**: Each row is staggered by a minor third (3 semitones)
- **Diagonal intervals**:
  - Northwest: Minor third up
  - Northeast: Major third up
- **Isomorphic**: Chord and scale shapes are the same in all keys
- **Compact**: Complex 5-note chords playable with one hand
- **Two "strands"**: Scales alternate between columns; root position shifts by octave

This layout is optimized for stacked thirds (triads, 7ths, 9ths, etc.) and makes chord voicings very intuitive once you learn the shapes.

## Future Plans

- Integration with the MIDIsplainer chord dictionary
- Export fingering patterns as JSON
- Import community-contributed patterns
- Plugin versions (AUv3, VST3, AU)
- More chord/scale presets
- Fingering recommendations based on common patterns

## Technical Details

- Single HTML file with embedded CSS and JavaScript
- No external dependencies
- Uses SVG for grid rendering
- LocalStorage for pattern persistence
- WebMIDI API for MIDI communication

## License

Open source - feel free to use and modify for your own Exquis explorations!
