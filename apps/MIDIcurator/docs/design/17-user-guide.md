# MIDIcurator User Guide

**Last updated:** 2026-02-12

## Welcome to MIDIcurator

MIDIcurator helps you understand, organize, and explore MIDI chord progressions. Whether you're a producer organizing sample packs, an educator demonstrating harmony concepts, or a learner discovering music theory through patterns, MIDIcurator makes MIDI files meaningful.

**What MIDIcurator Does**:
- Detects chords in MIDI files automatically
- Organizes patterns with tags and filters
- Generates variants (denser, sparser versions)
- Exports with chord labels preserved

**What MIDIcurator Doesn't Do**:
- It's not a DAW (use GarageBand, Ableton, Logic for production)
- It doesn't edit audio or record MIDI
- It focuses on short patterns (8-32 bars), not full songs

---

## Getting Started

### Step 1: Import Your First File

**Option A: Use Sample Progressions** (recommended for first-time users)
1. Click **"Load sample progressions"** in the sidebar
2. 30 example patterns load instantly
3. Click any pattern to view it

**Option B: Import Your Own Files**
1. Drag MIDI files onto the gray dropzone
2. Or click the dropzone and browse for files
3. Files analyze automatically (chord detection runs in background)

**What Happens Next**:
- Your file appears in the sidebar with detected chord (e.g., "Dm7")
- Click the clip to see full analysis

---

### Step 2: Hear It Play

**Keyboard Shortcut** (fastest):
- Press **Space** to play/pause

**Mouse Method**:
- Click the **▶ Play** button in the transport controls

**What You'll See**:
- Piano roll shows notes lighting up as they play
- Current time displays in MM:SS format
- Press **Space** again to pause

**Tip**: Click **Loop** button to repeat playback.

---

### Step 3: Understanding the Interface

**Sidebar (Left)**:
- Your MIDI file library
- Filter input to search by name, tag, or chord
- Click any clip to view details

**Main Area (Right)**:
- **Stats Grid**: BPM, note count, bar count, detected chord
- **Chord Bar**: Shows detected chord per bar (blue symbols)
- **Leadsheet Bar** (optional): User-defined chords (green symbols)
- **Piano Roll**: Visual representation of notes over time
- **Transform Controls**: Density slider to generate variants

---

## Understanding Chord Detection

### How It Works

MIDIcurator analyzes MIDI notes in each bar and matches them to a database of 104 chord types. Detection looks at:
- Which pitch classes are present (C, E, G = C major)
- Note density (how many notes per beat)
- Harmonic context (previous bar's chord)

**Colors**:
- **Blue** (Chord Bar): Detected from MIDI notes
- **Green** (Leadsheet Bar): User-defined or imported from leadsheet

**Accuracy**: ~80-90% for common chords. You can always override incorrect detections.

---

### Chord Bar Explained

Each cell shows one bar's detected chord:

```
[Dm7] [Am7 D7] [Gmaj7] [—]
 Bar 1  Bar 2    Bar 3   Bar 4 (empty)
```

**Multiple Chords Per Bar**:
- Bar 2 shows "Am7 D7" (two chords in one bar)
- Tool detects sub-bar chord changes automatically

**Empty Bars**:
- "—" means no notes detected
- Previous bar's chord "resonates" (implied continuation)

---

### Overriding Detected Chords

**Why Override?**
- Detector made a mistake ("Cdim7" but you know it's "Cm6")
- You want a specific interpretation ("Dm7" vs. "Dm6" are both valid)

**How to Override**:
1. Click the chord symbol in the Chord Bar or Stats Grid
2. Type new chord symbol (e.g., "Cmaj7", "F#dim")
3. Press **Enter** to save, **Escape** to cancel

**Supported Formats**:
- Root: C, D♭, F♯ (use Unicode symbols or plain b/#)
- Quality: maj7, m7, dim, aug, sus4, 7, etc.
- Slash chords: C/E, Dm/F (root note / bass note)

**Examples**:
- `Cmaj7` = C major seventh
- `Dbm7` = D♭ minor seventh
- `F#dim` = F♯ diminished
- `C/E` = C major with E in bass (slash chord)

---

## Organizing Your Library

### Filtering Clips

Use the **Filter** input at the top of the sidebar:

**Search by Chord**:
- Type `minor` to find all minor chords
- Type `dim` to find diminished chords
- Type `slash` to find slash chords (C/E, Dm/F)

**Search by Tag**:
- Type `groovy` to find clips you tagged "groovy"
- Type any custom tag you've created

**Search by Name**:
- Type part of the filename (e.g., `jazz_progression`)

---

### Adding Tags

Tags help you organize by vibe, genre, or project:

1. Select a clip
2. Scroll to **Tags** section in main area
3. Type tag name (e.g., "groovy-jazz", "dark-vibes", "student-submission-2024")
4. Click **Add Tag**

**Tag Ideas**:
- **Vibes**: groovy, dark, dreamy, uplifting, sad
- **Genres**: jazz, pop, gospel, bebop, modal
- **Projects**: album-01, client-XYZ, workshop-2024
- **Theory**: ii-V-I, modal-interchange, slash-chords

**Tip**: Use lowercase with hyphens for consistency (e.g., `groovy-jazz` not `Groovy Jazz`).

---

### Batch Operations

**Download All Clips** (sidebar button):
- Exports all clips as ZIP file
- Chord labels preserved as MIDI text events

**Clear All Clips** (sidebar button):
- Removes all clips from library (cannot be undone)
- Local storage only — original files safe

---

## Creating Variants

Variants are transformed versions of your pattern — useful for:
- Creating simpler versions for learning
- Generating denser versions for production
- Exploring "what if this had 50% fewer notes?"

### Density Slider

**Location**: Transform Controls section

**How It Works**:
- 1.0 = original (all notes)
- 0.5 = 50% of notes (sparser)
- 0.3 = 30% of notes (very sparse)

**Preview**: Tool shows estimated note count before generating.

---

### Generating Variants

**Option 1: Generate 5 Variants** (keyboard: **G**)
- Creates 5 clips at densities: 0.3, 0.5, 0.7, 0.9, 1.0
- Useful for comparing multiple options

**Option 2: Generate 1 Variant** (keyboard: **V**)
- Creates 1 clip at current density slider setting
- Faster if you know exact density you want

**What Happens**:
- New clips appear in sidebar with suffix `_d0.50` (density 0.5)
- Original clip is preserved (variants are copies)
- Variant chips are grouped together (small dot • indicates variant family)

**Tip**: Listen to all 5 variants, delete the ones you don't like, keep 1-2 favorites.

---

## Advanced: Segmentation (Scissors Tool)

### What Is Segmentation?

Segmentation divides a long pattern into phrases. Useful when:
- Tool detects one chord for entire 16-bar pattern (too coarse)
- You want finer harmonic analysis (per 4-bar phrase)
- You want to analyze chord changes within bars

### How to Segment

1. Select a clip (8+ bars recommended)
2. Press **S** key to enter scissors mode
   - Scissors button turns orange
   - Cursor changes to scissors icon
3. Click on piano roll at bar lines where you want boundaries (e.g., bar 4, 8, 12)
4. Chord bar updates to show segmented chords
5. Press **S** again to exit scissors mode

**Keyboard Alternative** (accessibility):
- Press **Arrow keys** to move cursor along grid
- Press **Enter** to place boundary at cursor position
- Press **Delete** to remove boundary under cursor

**Remove Boundaries**:
- Right-click or Shift+click on boundary to remove
- Or delete all: Clear All Clips → re-import

---

## Advanced: Leadsheet Input

### What Is Leadsheet?

Leadsheet is a musician's shorthand — chord symbols written above bars:

```
Dm7 | Am7 D7 | Gmaj7 | Cmaj7
```

This means:
- Bar 1: Dm7
- Bar 2: Am7 then D7 (two chords)
- Bar 3: Gmaj7
- Bar 4: Cmaj7

### Entering Leadsheet

1. Select a clip
2. Find **Leadsheet Input** row (above Chord Bar)
3. Type chord progression using bar format: `Dm7 | Am7 D7 | Gmaj7`
4. Press Enter
5. Green Leadsheet Bar appears above blue Chord Bar

**Format Rules**:
- Use `|` (pipe) to separate bars
- Use space to separate chords within a bar
- Use `NC` for no chord (e.g., `Dm7 | NC | Gmaj7`)
- Use `%` or `—` to repeat previous bar

**Comparing Detected vs. Leadsheet**:
- **Green (top)**: What you said the chords should be
- **Blue (bottom)**: What the tool detected
- Mismatches reveal errors (detector wrong? or leadsheet wrong?)

---

## Exporting and Sharing

### Download Single Clip

**Keyboard**: Press **D**
**Mouse**: Click clip → Download button

**What You Get**:
- `.mid` file with original notes
- Chord labels embedded as MIDI text events (CC Event 0x01)
- BPM and time signature preserved

**DAW Compatibility**:
- Most DAWs (Ableton, Logic, GarageBand) show text events in timeline
- Import the file and see chord labels above bars

---

### Download All Clips (ZIP)

**Location**: Sidebar, below clip list

**What You Get**:
- ZIP file containing all clips
- Filenames include density suffix (`_d0.50.mid`)
- Chord labels preserved in each file

---

## Keyboard Shortcuts Reference

**Playback**:
- **Space**: Play/Pause
- **Escape**: Stop

**Navigation**:
- **↑/↓**: Navigate clips (previous/next)
- **←/→**: Navigate segments (when segmented)

**Tools**:
- **S**: Toggle scissors mode (segmentation)
- **R**: Toggle range selection mode (future)

**Actions**:
- **G**: Generate 5 variants
- **V**: Generate 1 variant (at current density)
- **D**: Download current clip
- **Enter**: Save inline edit (BPM, chord override)
- **Escape**: Cancel inline edit or exit mode

**Tip**: Keyboard shortcuts are visible at the bottom of the screen.

---

## Accessibility Features

MIDIcurator is designed for screen readers, keyboard-only users, and neurodivergent users.

### Screen Reader Support

**Tested With**:
- NVDA (Windows)
- JAWS (Windows)
- VoiceOver (macOS)

**Key Features**:
- All buttons have ARIA labels ("Play (Space)", "Scissors tool")
- Piano roll has text alternative (list of notes via aria-describedby)
- Chord bar announces bar number and chord name ("Bar 1: Dm7, Dorian minor seventh")
- Live regions announce state changes ("Playing", "Scissors mode active")

**Navigation**:
- Press **Tab** to move through controls
- Press **Enter** or **Space** to activate buttons
- Screen reader announces current focus and state

---

### Keyboard-Only Navigation

**No Mouse Required**:
- All features accessible via keyboard
- Range selection: Shift+Arrow keys (or R key for selection mode)
- Scissors placement: Arrow keys + Enter (in scissors mode)
- Focus indicators visible (2px outline around focused element)

---

### Neurodiversity Support

**Explicit State**:
- Scissors mode shows orange button (always visible)
- No hidden modes or time-based auto-exits
- Mode state announced via live regions

**Predictability**:
- Same action always produces same result (Space = play/pause every time)
- Undo/redo not needed (variants don't overwrite originals)
- No auto-save (user controls when data changes)

**Low Sensory Load**:
- No flashing animations
- No sudden sounds (user controls playback)
- High contrast themes (dark and light)

---

## FAQs and Troubleshooting

### "Why doesn't my MIDI file import?"

**Possible Causes**:
- File is not actually MIDI (check extension: `.mid` or `.midi`)
- File is corrupted (try opening in a DAW first)
- Multi-track MIDI (MIDIcurator extracts first track only)

**Solution**: Try importing a sample progression first. If that works, the issue is file-specific.

---

### "Chord detection is wrong — it says Cm7 but I hear C7"

**This is normal**. Chord detection is ~80-90% accurate. Override it:
1. Click the chord symbol
2. Type `C7`
3. Press Enter

Your override persists forever (saves to local storage).

---

### "I imported 50 files but they're not showing up"

**Check Filter**: Clear the filter input (delete any text) — files may be filtered out.

**Check Progress**: Large batches take 1-2 minutes to analyze. Look for progress indicator (future feature).

---

### "How do I delete a clip?"

Currently, you cannot delete individual clips. Workaround:
1. Click **Clear All Clips** (sidebar button)
2. Re-import only the files you want

**Future**: Per-clip delete button planned.

---

### "Can I transpose a pattern to a different key?"

Not yet (UI not implemented). Workaround:
1. Use Leadsheet Input to enter progression in new key
2. Or use DAW transpose function after exporting

**Future**: Transpose dropdown planned.

---

### "Does MIDIcurator work on mobile?"

**iPad/Tablet**: Partial support. Touch gestures work but some interactions (scissors mode) are unreliable.

**Phone**: Not recommended. Screen too small for piano roll visualization.

**Best Experience**: Desktop or laptop with keyboard.

---

### "Where is my data stored?"

**Local Storage Only**:
- All MIDI files and tags stored in browser's IndexedDB
- No cloud sync, no account required
- Clearing browser data deletes your library (backup with ZIP export!)

**Privacy**: Your files never leave your computer. No server uploads.

---

## Glossary

**Bar**: A segment of music, typically 4 beats. Also called a "measure."

**BPM**: Beats per minute (tempo). 120 BPM = 2 beats per second.

**Chord**: Three or more notes played together. Example: C + E + G = C major.

**Chord Progression**: A sequence of chords. Example: Dm7 → G7 → Cmaj7 (ii-V-I).

**Density**: How many notes are in a pattern. Density 1.0 = all notes, 0.5 = half the notes.

**Gesture**: MIDIcurator's internal term for a MIDI pattern (notes + timing + metadata).

**Leadsheet**: Chord symbols written above bars (musician shorthand).

**Piano Roll**: Visual representation of notes (pitch on Y-axis, time on X-axis).

**Pitch Class**: Note name without octave. C4 and C5 are both pitch class "C."

**PPQ (Pulses Per Quarter)**: MIDI timing resolution. 480 PPQ = 480 ticks per quarter note.

**Segmentation**: Dividing a pattern into phrases (using scissors tool).

**Slash Chord**: Chord with specific bass note. C/E = C major with E in bass.

**Tick**: Smallest unit of MIDI time. 480 ticks = 1 quarter note (if 480 PPQ).

**Variant**: Transformed version of a pattern (denser, sparser, etc.).

---

## Getting Help

**Documentation**:
- This guide (17-user-guide.md)
- Design principles (11-principles.md)
- Accessibility features (09-accessibility-audit.md)

**Community**:
- GitHub Issues: Report bugs or request features
- Discord/Reddit: Connect with other users (links TBD)

**Contact**:
- Email: (project maintainer email)
- GitHub: (repository URL)

---

## Credits

MIDIcurator is built with:
- React + TypeScript + Vite
- ToneTransport for playback
- IndexedDB for local storage
- 104 chord qualities in dictionary

**Design Philosophy**: #MTILT (Music Tech: Inclusive Learning & Teaching)

---

## Revision History

- **2026-02-12**: Initial user guide (plain language, neurodiversity-friendly)
- Future: Update after usability testing, add video tutorials
