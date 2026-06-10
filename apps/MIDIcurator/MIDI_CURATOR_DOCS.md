# MIDI Curator - Project Documentation

## What We Built

A **browser-based MIDI pattern curation and transformation tool** that runs entirely locally with no backend required.

### Current Features (v0.1)

#### ✅ Core Functionality
- **Import MIDI files** - Drag & drop or file browser
- **Parse MIDI** - Pure JavaScript parser (no dependencies)
- **Extract gesture/harmonic layers** - Two-layer separation model
- **Store locally** - IndexedDB for persistence across sessions
- **Tag & organize** - Free-form tags, search/filter
- **BPM editing** - Click to edit, auto-detects from filename (e.g., "112-bpm")

#### ✅ Transformation Engine
- **Density transformation** - Add/remove notes (0.25x to 2.0x)
- **Quantization** - Snap to grid (50% strength default)
- **Velocity scaling** - Adjust dynamics
- **Gesture preservation** - Maintains rhythm/feel while changing density
- **Harmonic matching** - Pitch arrays stay synchronized with gesture

#### ✅ Generation Modes
1. **Generate 5 Variants** (G key) - Creates 0.5x, 0.75x, 1.0x, 1.25x, 1.5x
2. **Generate 1 Variant** (V key) - Uses custom slider value
3. **Slider control** - 0.25x to 2.0x with preset buttons
4. **Preview** - Shows target note count before generating

#### ✅ Export & Download
- **Individual download** (D key) - Single MIDI file
- **ZIP batch export** - All variants in one archive
- **Smart filenames** - Includes actual density: `filename_d2.35.mid`
- **Preserves tempo** - Uses original ticks-per-beat
- **Pure JS ZIP** - No external dependencies

#### ✅ UI/UX
- **Keyboard shortcuts** - D, G, V, Delete
- **Inline BPM editing** - Click value to edit
- **Debug info** - Timing diagnostics
- **Provenance tracking** - Know which clips generated which
- **Visual indicators** - Blue dot for generated clips
- **Live feedback** - Note count preview

---

## Architecture

### Two-Layer Model

**Gesture Layer** (rhythm/timing):
```javascript
{
  onsets: [0, 240, 480, ...],      // tick positions
  durations: [120, 120, ...],       // note lengths
  velocities: [100, 80, ...],       // dynamics
  density: 4.0,                     // notes per beat
  syncopation_score: 0.3,           // off-beat metric
  ticks_per_beat: 96,               // from original file
  ticks_per_bar: 384
}
```

**Harmonic Layer** (pitch):
```javascript
{
  pitches: [60, 62, 64, ...],      // MIDI note numbers
  pitchClasses: [0, 2, 4, ...]     // pitch classes (0-11)
}
```

### Storage Schema (IndexedDB)

**clips** - Main clip records
- id, filename, imported_at, bpm
- gesture (JSON), harmonic (JSON)
- rating, notes, tags
- source (for variants)

**tags** - Many-to-many tagging
- clipId, tag, added_at

**buckets** - Collections (not yet implemented in UI)

### Transform Pipeline

```
Source Clip
    ↓
[Extract gesture + harmonic]
    ↓
[Transform gesture]
  - Adjust density (add/remove notes)
  - Quantize (snap to grid)
  - Scale velocities
    ↓
[Update harmonic to match]
  - Remove pitches for removed notes
  - Duplicate pitches for added notes
    ↓
[Create variant clip]
    ↓
Store & display
```

---

## What Works Well

✅ **Pure browser implementation** - No build step, no server  
✅ **MIDI parsing/export** - Handles various ticks-per-beat values  
✅ **Density transformation** - Actually changes note count  
✅ **BPM detection** - From filename or tempo events  
✅ **Keyboard-driven workflow** - Fast iteration  
✅ **ZIP export** - Clean batch downloads  
✅ **Provenance** - Always know the source  

---

## Known Limitations

### Current Issues
1. **No audio playback** - Can't audition files in-app (must download)
2. **Limited transformations** - Only density, quantization, velocity
3. **No visual feedback** - Can't see piano roll
4. **Fixed quantization** - Always 50% strength, 16th note grid
5. **Basic density algorithm** - Removes highest velocity, adds interpolated
6. **No undo** - Operations are immediate
7. **No bucket UI** - Database ready but no interface
8. **No syncopation control** - Metric computed but not adjustable
9. **No chord realization** - Harmonic layer stores pitches but doesn't remap to chords
10. **No Markov synthesis** - Two-layer spec included it, not implemented

### Technical Debt
- No error boundaries in React
- No loading states during DB operations
- No confirmation dialogs before delete
- Gesture features computed but not fully used
- IndexedDB operations not wrapped in try/catch

---

## Roadmap to Full Vision

### Phase 1: Audition & Visualization (High Priority)

**Goal**: See and hear clips without downloading

#### A. WebAudio Playback
```javascript
// Add to each clip in sidebar
<button onClick={() => playClip(clip)}>▶</button>

function playClip(clip) {
  const audioContext = new AudioContext();
  // Use Web MIDI API or synthesize with WebAudio
  // Play gesture.onsets + harmonic.pitches
}
```

**Implementation notes**:
- Use **Tone.js** (or pure WebAudio) for synthesis
- Simple sine/square wave is fine for audition
- Transport controls: play/pause/stop
- Visual feedback: highlight current note

#### B. Piano Roll Visualization
```javascript
// Canvas-based mini piano roll
function PianoRoll({ gesture, harmonic, width, height }) {
  // Draw horizontal bars for each note
  // X-axis = time (ticks)
  // Y-axis = pitch (MIDI note)
  // Color = velocity
}
```

**Features**:
- **Minimap in sidebar** - Small overview of each clip
- **Large view when selected** - Full editor-style
- **Zoom/pan** - See details
- **Hover to highlight** - Note info on mouseover
- **Click to select** - Future: manual editing

**Implementation approach**:
1. Create `<canvas>` component
2. Draw background grid (beats/bars)
3. Draw notes as rectangles: `(onset, pitch) -> (onset+duration, pitch)`
4. Add zoom controls
5. Add playhead during playback

#### C. A/B Comparison
```javascript
// Compare original vs variant side-by-side
<SplitView>
  <PianoRoll clip={originalClip} />
  <PianoRoll clip={variantClip} />
</SplitView>
```

---

### Phase 2: More Transformations (Medium Priority)

**Goal**: More ways to manipulate gesture

#### A. Syncopation Control
```javascript
// Add to transform UI
<Slider 
  label="Syncopation" 
  value={syncopation}
  onChange={setSyncopation}
  min={-1} max={1}
/>

function adjustSyncopation(gesture, shift) {
  // Shift notes toward/away from beats
  // Already sketched in original spec
}
```

#### B. Velocity Envelope
```javascript
// Shape dynamics over time
<EnvelopeEditor 
  points={velocityEnvelope}
  onChange={setVelocityEnvelope}
/>

// Apply curve to velocities
function applyEnvelope(gesture, envelope) {
  return gesture.velocities.map((v, i) => {
    const position = i / gesture.velocities.length;
    const multiplier = interpolate(envelope, position);
    return clamp(v * multiplier, 1, 127);
  });
}
```

#### C. Duration Shaping
- **Legato/Staccato** slider
- **Duration randomization** - Add human feel
- **Gate percentage** - Quick way to adjust all durations

#### D. Microtiming
- **Swing** amount (delays offbeats)
- **Humanize** - Randomize timing slightly
- **Groove templates** - Apply feel from other clips

---

### Phase 3: Chord Realization (Medium Priority)

**Goal**: Re-map patterns to different chords/progressions

#### A. Chord Input
```javascript
// Add chord selector to clip
<ChordInput 
  value={clip.chord}
  onChange={chord => updateClip({ ...clip, chord })}
/>
```

#### B. Chord Quantization
```javascript
function realizeOnChord(gesture, harmonic, newChord) {
  // Parse chord: "Dm7" -> { root: 2, quality: 'min7' }
  // Map pitches to new chord tones
  // Preserve relative intervals where possible
}
```

#### C. Progression Support
```javascript
// Multi-chord patterns
<ProgressionEditor 
  bars={gesture.num_bars}
  progression={[
    { bar: 0, chord: 'C' },
    { bar: 1, chord: 'Am' },
    { bar: 2, chord: 'F' },
    { bar: 3, chord: 'G' }
  ]}
/>
```

---

### Phase 4: Markov Synthesis (Lower Priority)

**Goal**: Generate new patterns from corpus

#### A. Corpus Selection
```javascript
// Select multiple clips as training data
<BucketSelector 
  selected={trainingBucket}
  onChange={setBucket}
/>
```

#### B. Model Training
```javascript
// Build Markov model from gesture tokens
function trainModel(gestures) {
  const model = new MarkovModel(order: 3);
  for (const gesture of gestures) {
    const tokens = tokenize(gesture);
    model.add(tokens);
  }
  return model;
}
```

#### C. Generation
```javascript
// Sample from model
<GenerateFromCorpus 
  bucket={bucket}
  targetDensity={density}
  temperature={temp}
  numVariants={n}
/>
```

---

### Phase 5: Advanced Curation (Lower Priority)

#### A. Bucket UI
- Visual folders
- Drag & drop assignment
- Hierarchical organization
- Bucket-based generation

#### B. Ratings & Filtering
- Star ratings (already in DB)
- Filter by rating
- Sort by date, density, syncopation
- Advanced search

#### C. Batch Operations
- Select multiple clips
- Bulk tag
- Bulk transform
- Bulk delete

#### D. Keyboard Macros
- Assign tags to keys 1-9
- Quick tagging workflow
- Already in DB schema

---

## Technical Implementation Priorities

### Must-Have Next
1. **WebAudio playback** - Most important missing feature
2. **Piano roll visualization** - Visual feedback is critical
3. **More transform controls** - Expose syncopation, duration, velocity

### Nice-to-Have
4. **Undo/redo stack** - Better UX for experimentation
5. **Loading states** - Visual feedback for DB operations
6. **Error handling** - Graceful failures
7. **Export project** - Download entire DB as JSON

### Polish
8. **Themes** - Light/dark mode
9. **Keyboard shortcuts help** - Modal with all shortcuts
10. **Tour/onboarding** - Guide for first-time users

---

## Code Structure

```
midi-curator.jsx
├── ZIP Creator (pure JS)
├── MIDI Parser (pure JS)
├── MIDI Export (pure JS)
├── IndexedDB wrapper (MidiDB class)
├── Gesture extraction
├── Harmonic extraction
├── Transform functions
│   ├── transformGesture()
│   └── adjustDensity(), quantize(), scaleVelocity()
├── React Components
│   ├── Main app container
│   ├── Sidebar (file list)
│   ├── Detail view (selected clip)
│   ├── Transform controls
│   └── Keyboard shortcuts
└── Event handlers
```

### Adding New Features

**To add a transform**:
1. Add UI control (slider/button)
2. Add state for parameter
3. Update `transformGesture()` function
4. Update `generateVariant()` to pass parameter

**To add visualization**:
1. Create new component with `<canvas>`
2. Pass gesture + harmonic as props
3. Draw in useEffect when data changes
4. Add to detail view

**To add playback**:
1. Initialize AudioContext
2. Create synthesizer (Tone.js or WebAudio)
3. Schedule notes from gesture + harmonic
4. Add transport controls

---

## Design Principles

1. **Local-first** - No server, no cloud
2. **Gesture > Harmony** - Rhythm is more important than pitch
3. **Visual feedback** - Show what's happening
4. **Keyboard-driven** - Fast iteration
5. **Provenance** - Always track sources
6. **No magic** - Explicit controls, predictable results
7. **Experimentation** - Make it easy to try things

---

## Files & Naming

**Current convention**:
- Import: `Midnight_Strut_112-bpm.mid`
- Variant: `Midnight_Strut_112-bpm_d2.35.mid`
- ZIP: `Midnight_Strut_112-bpm_variants.zip`

**Why density number instead of multiplier**:
- More meaningful: "d2.35" tells you actual notes-per-beat
- Easier to compare: Sort by density in file browser
- Independent of source: Don't need to know what was multiplied

---

## Usage Examples

### Workflow 1: Simplify a Busy Pattern
1. Import busy MIDI file (density 6.0)
2. Set slider to **0.5x**
3. Press **V** (generate variant)
4. Check sidebar: new clip with density ~3.0
5. Press **D** to download
6. Import into DAW, sounds cleaner

### Workflow 2: Create Variations
1. Import good groove (density 4.0)
2. Press **G** (generate 5 variants)
3. Get: d2.0, d3.0, d4.0, d5.0, d6.0
4. Click "Download All Variants as ZIP"
5. Unzip, audition in DAW
6. Pick favorites, use in project

### Workflow 3: Iterative Refinement
1. Import source
2. Generate variant at 0.8x
3. Select variant, generate at 1.2x
4. Select that, generate at 0.9x
5. Build library of related grooves
6. Tag best ones
7. Export collection

---

## Next Session Ideas

1. **Add WebAudio playback** - Hear clips in browser
2. **Add simple piano roll** - Visual feedback
3. **Add syncopation control** - More transform options
4. **Add undo/redo** - Better UX
5. **Add batch export** - Select multiple, download zip

The foundation is solid. The two-layer model works. Now it needs **visibility** (piano roll) and **audibility** (playback).

---

**Current State**: ✅ Core functionality complete, ready for polish and features  
**Next Priority**: 🎵 Playback + 🎹 Visualization  
**License**: CC0-1.0 (Public Domain)
