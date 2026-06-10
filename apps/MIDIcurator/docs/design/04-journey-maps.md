# User Journey Maps

**Last updated:** 2026-02-12

## Overview

This document presents detailed user journeys for MIDIcurator's five personas, with special emphasis on accessibility workflows. Each journey traces a complete task from initial goal through completion, mapping touchpoints, emotions, current support levels, and improvement opportunities.

**Journey Prioritization**:
- **PRIORITY 1 & 2**: Accessibility-first journeys (Riley, Sam) address critical WCAG violations
- **Journeys 3-5**: Learning, organization, and pedagogy workflows

**Journey Structure**:
- **Goal**: What the user wants to accomplish
- **Stages**: 5-8 key steps from start to finish
- **Touchpoints**: Specific components, UI elements, keyboard shortcuts
- **Emotions**: Highs (confidence, delight) and lows (frustration, confusion)
- **Current Support**: ✅ Works well, ⚠️ Partial, ❌ Missing/broken
- **Barriers**: Specific accessibility issues (references 09-accessibility-audit.md)
- **Improvements**: Proposed remediations (references 10-accessibility-plan.md)
- **Success Criteria**: Measurable outcomes

---

## Journey 1 (PRIORITY): Riley's First Pattern — Screen Reader User

### Persona Context

**Riley Chen** (19, blind, JAWS screen reader user, keyboard-only)

**Goal**: Import a MIDI file, hear it play, understand what chords are present, and feel confident using music software for the first time.

**Why This Journey Matters**: Riley represents users completely blocked by accessibility barriers. This journey tests whether MIDIcurator delivers on its foundational principle: "Accessibility is Foundational."

---

### Journey Stages

#### Stage 1: Discovering MIDIcurator

**Actions**:
- Riley hears about MIDIcurator from accessibility subreddit recommendation
- Opens website in Chrome with JAWS screen reader
- Expects to encounter usual barriers (unlabeled buttons, silent canvas)

**Touchpoints**:
- Browser tab title: "MIDIcurator — MIDI Pattern Analysis and Curation Tool"
- Skip link: "Skip to clip details"
- Sidebar header: `<h1>MIDI Curator</h1>`

**Emotions**: 😐 Cautiously hopeful but expecting frustration (past trauma from inaccessible music software)

**Current Support**: ⚠️ Partial
- ✅ HTML page loads, screen reader can navigate
- ❌ No skip links implemented (09-accessibility-audit.md, Section 2.4)
- ❌ No semantic headings (09-accessibility-audit.md, Section 2.4)

**Barriers**:
- No bypass mechanism to skip sidebar (Riley must tab through entire library)
- Page title not verified (may be generic "React App")

**Improvements Needed** (10-accessibility-plan.md):
- Tier 2.2: Add skip links ("Skip to clip details", "Skip to clip library")
- Tier 2.3: Convert divs to semantic `<h1>`, `<h2>`, `<aside>`, `<main>`

**Success Criteria**:
- Riley can navigate to main content area in <5 Tab presses

---

#### Stage 2: Loading Sample Progressions

**Actions**:
- Riley tabs through interface, discovers "Load sample progressions" button
- Presses Enter, hears "30 clips loaded"
- Tabs to clip card, hears: "II-V-I in C, button, contains 42 notes, detected chord Dm7"

**Touchpoints**:
- `ProgressionGenerator` button: "Load sample progressions"
- `ClipCard` component (first result): "II-V-I in C"
- Sidebar clip list

**Emotions**: 😊 Surprised and pleased — screen reader actually announced useful information!

**Current Support**: ⚠️ Partial
- ✅ Button exists with visible text label
- ❌ Button has no aria-label (generic "button" announcement)
- ❌ ClipCard lacks aria-label with chord/note info
- ❌ No live region announces "30 clips loaded"

**Barriers** (09-accessibility-audit.md):
- Section 1.1: ClipCard has no ARIA label (screen reader announces generic content)
- Section 4.1: Missing role="button", aria-label="II-V-I in C, 42 notes, detected chord Dm7"
- Section 1.4: No live region for dynamic content announcement

**Improvements Needed** (10-accessibility-plan.md):
- Tier 1.1: Add aria-label to all buttons
- Tier 1.1: Add aria-label to ClipCard with chord info
- Tier 1.4: Add aria-live region for "30 clips loaded" announcement

**Success Criteria**:
- Screen reader announces: "Load sample progressions, button" (on focus)
- After click: Live region announces "30 clips loaded"
- ClipCard announces: "II-V-I in C, 42 notes, Dm7 chord, button"

---

#### Stage 3: Selecting and Exploring a Clip

**Actions**:
- Riley presses Enter on "II-V-I in C" clip card
- Focus moves to main content area
- Riley tabs through stats grid, hears: "BPM 120, Notes 42, Bars 8"
- Riley continues tabbing, searching for piano roll information

**Touchpoints**:
- `ClipCard` (activated)
- `StatsGrid` component: BPM, note count, bar count
- `PianoRoll` canvas element

**Emotions**: 😟 → 😢 Frustration building — piano roll is completely silent

**Current Support**: ❌ Critical Failure
- ✅ StatsGrid has visible text (but not semantic `<dl>`)
- ❌ PianoRoll canvas has NO aria-label or aria-describedby
- ❌ Canvas is completely invisible to screen readers

**Barriers** (09-accessibility-audit.md):
- Section 1.1 (CRITICAL): Piano roll canvas missing text alternative
- Section 4.1 (CRITICAL): Canvas lacks role="img", aria-label, aria-describedby
- **Riley cannot access any note information** — complete blocker

**Improvements Needed** (10-accessibility-plan.md):
- Tier 1.3: Add aria-label with summary: "Piano roll: 42 notes spanning C3 to G5, 8 bars"
- Tier 1.3: Add aria-describedby with note list:
  ```html
  <div id="piano-roll-notes" className="sr-only">
    Note 1: C4, bar 1 beat 1, quarter note, velocity 80.
    Note 2: E4, bar 1 beat 1, quarter note, velocity 72.
    ...
  </div>
  ```

**Success Criteria**:
- Screen reader announces: "Piano roll: 42 notes spanning C3 to G5, 8 bars, image"
- Riley can access detailed note list via aria-describedby
- Note list truncated at 50 notes with "(showing first 50 of 120)"

---

#### Stage 4: Playing the Pattern

**Actions**:
- Riley remembers seeing "Space: Play/Pause" in shortcuts bar
- Presses Space key
- Pattern plays, but Riley unsure if anything happened (no audio cue, no announcement)

**Touchpoints**:
- `KeyboardShortcutsBar`: "Space Play/Pause"
- `TransportBar` play button
- Playback engine (Web MIDI or Audio Context)

**Emotions**: 😕 Confused — did it play? Is audio working? No feedback received.

**Current Support**: ❌ Critical Failure
- ✅ Space key triggers play/pause
- ❌ No live region announces "Playing" or "Paused"
- ❌ Playback state change is completely silent to screen readers

**Barriers** (09-accessibility-audit.md):
- Section 1.4: No ARIA live region for playback state
- Section 4.1: TransportBar button lacks aria-label="Play (Space)" or aria-pressed state

**Improvements Needed** (10-accessibility-plan.md):
- Tier 1.4: Add live region to TransportBar:
  ```tsx
  <div role="status" aria-live="polite" className="sr-only">
    {isPlaying ? 'Playing' : 'Paused'}
  </div>
  ```
- Tier 1.1: Add aria-label to play button: "Play (Space)" / "Pause (Space)"

**Success Criteria**:
- Pressing Space announces "Playing" via live region
- Pressing Space again announces "Paused"
- TransportBar button has accessible name

---

#### Stage 5: Navigating Chord Bar

**Actions**:
- Riley continues tabbing, reaches chord bar area
- Screen reader announces: "Dm7" (no context)
- Riley confused — which bar? Is this detected or user-entered?

**Touchpoints**:
- `ChordBar` component
- Chord bar cells (divs with chord symbols)

**Emotions**: 😐 Partial information received, but lacking context

**Current Support**: ⚠️ Partial
- ✅ Chord symbol text is announced ("Dm7")
- ❌ No context (bar number, detected vs. override)
- ❌ No indication of current playback position

**Barriers** (09-accessibility-audit.md):
- Section 1.1: ChordBar cells lack aria-label with bar number
- Section 4.1: Cells should use role="listitem" with aria-label="Bar 1: Dm7, Dorian minor seventh"

**Improvements Needed** (10-accessibility-plan.md):
- Tier 1.1: Add role="list" to ChordBar, role="listitem" to cells
- Tier 1.1: Add aria-label="Bar 1: Dm7, Dorian minor seventh chord"
- Tier 2 (future): Add aria-current="true" to cell at playhead position

**Success Criteria**:
- Screen reader announces: "List with 8 items" (on ChordBar focus)
- Each cell announces: "Bar 1: Dm7, Dorian minor seventh chord, list item"
- Current bar highlighted during playback (aria-current="true")

---

#### Stage 6: Using Keyboard Shortcuts

**Actions**:
- Riley wants to explore other clips
- Remembers "↑↓ Clips" from shortcuts bar
- Presses ↓ arrow key, next clip loads
- No announcement of which clip loaded (silent transition)

**Touchpoints**:
- `KeyboardShortcutsBar`: "↑↓ Clips"
- `useKeyboardShortcuts` hook (MidiCurator.tsx)
- Clip selection logic

**Emotions**: 😕 Feature works but lacks feedback — did it change?

**Current Support**: ⚠️ Partial
- ✅ Arrow keys navigate clips (functionality works)
- ❌ No live region announces new clip name
- ❌ Focus doesn't move to new clip card (remains in shortcuts bar)

**Barriers** (09-accessibility-audit.md):
- Section 1.4: No live region for clip selection announcement
- Section 2.4: Focus order may be unexpected (focus should follow selection?)

**Improvements Needed** (10-accessibility-plan.md):
- Tier 1.4: Add live region announcement:
  ```tsx
  <div role="status" aria-live="polite" className="sr-only">
    {selectedClip?.name} selected, {selectedClip?.gesture.notes.length} notes
  </div>
  ```
- Tier 2 (optional): Move focus to selected ClipCard for clarity

**Success Criteria**:
- Pressing ↓ announces: "I-IV-V in G selected, 36 notes"
- Pressing ↑ announces: "II-V-I in C selected, 42 notes"

---

#### Stage 7: Attempting Scissors Mode

**Actions**:
- Riley reads about scissors tool in keyboard shortcuts: "S Scissors"
- Presses S key
- Scissors mode activates (visually), but no announcement
- Riley attempts to place boundary with keyboard (no method exists)

**Touchpoints**:
- `KeyboardShortcutsBar`: "S Scissors"
- Scissors mode button (visual-only indicator)
- `PianoRoll` canvas (mouse-only boundary placement)

**Emotions**: 😞 → 😢 Frustration and defeat — feature completely inaccessible

**Current Support**: ❌ Complete Failure
- ✅ S key toggles scissors mode
- ❌ No announcement that mode changed
- ❌ No keyboard method to place boundaries (mouse-only)
- ❌ Scissors button lacks aria-pressed="true" state

**Barriers** (09-accessibility-audit.md):
- Section 2.1 (CRITICAL): Scissors boundary placement is mouse-only
- Section 4.1: Scissors button lacks aria-pressed state
- Section 1.4: No live region announces "Scissors mode active"

**Improvements Needed** (10-accessibility-plan.md):
- Tier 1.5 (CRITICAL): Add keyboard alternative for boundary placement:
  - Arrow keys (←→) move cursor along grid
  - Enter or Space places boundary at cursor position
  - Delete removes boundary under cursor
- Tier 1.1: Add aria-pressed="true" to scissors button when active
- Tier 1.4: Add live region: "Scissors mode active. Use arrow keys to navigate, Enter to place boundary."

**Success Criteria**:
- Pressing S announces: "Scissors mode active. Use arrow keys to navigate, Enter to place boundary."
- Arrow keys move cursor, screen reader announces position: "Bar 2, beat 3"
- Enter places boundary, announces: "Boundary placed at bar 2"
- Pressing S again announces: "Scissors mode inactive"

---

#### Stage 8: Reflecting on Experience

**Actions**:
- Riley successfully played a pattern and heard chords
- Riley frustrated by piano roll being silent and scissors mode being inaccessible
- Riley considers: "Is this better than other music software?"

**Touchpoints**:
- Overall experience across all components

**Emotions**: 😐 → 😊 Cautiously optimistic — saw potential but hit major blockers

**Current Support**: ⚠️ Mixed
- ✅ Basic navigation works (Tab, Space, arrow keys)
- ✅ Some components have accessible text (StatsGrid, ChordBar symbols)
- ❌ Critical features blocked (piano roll, scissors mode)
- ❌ Lack of feedback (live regions missing)

**Barriers Summary**:
- Piano roll completely silent (blocks understanding of musical content)
- Scissors mode inaccessible (blocks segmentation workflow)
- Playback state silent (no confirmation audio is playing)
- Dynamic content changes unannounced (clip switching, variant generation)

**Improvements Needed** (Summary):
- **Tier 1 (Critical)**: ARIA labels, focus indicators, piano roll text alternative, live regions, keyboard alternatives for scissors
- **Tier 2 (Important)**: Skip links, semantic HTML, better focus management

**Success Criteria for Journey Completion**:
- Riley can complete entire workflow independently (import → play → understand chords → segment)
- Riley describes MIDIcurator as "the first music tool that works with my screen reader"
- Task completion time: <5 minutes for first pattern exploration

---

### Current Journey Outcome

**Status**: ⚠️ PARTIALLY SUCCESSFUL

**What Worked**:
- Riley could load sample progressions (button was clickable)
- Riley could play pattern with Space key (keyboard shortcut worked)
- Riley heard chord symbols announced (text content accessible)

**What Failed**:
- Piano roll was completely silent (critical failure)
- Scissors mode inaccessible via keyboard (critical failure)
- No feedback for state changes (playing, clip switching)
- Missing context for chord bar (which bar? detected or override?)

**Riley's Verdict**:
> "This is better than GarageBand, but I still can't do everything. The piano roll is silent, which is frustrating, but at least I can hear the chords. If they fix the piano roll and scissors tool, this could actually work for me."

**Confidence Level**: 4/10 (hopeful but blocked by critical barriers)

---

## Journey 2 (PRIORITY): Sam's Scissors Workflow — Keyboard-Only User

### Persona Context

**Sam Kowalski** (31, autistic, software engineer, prefers keyboard-first interaction, needs explicit state)

**Goal**: Import a 16-bar MIDI file, segment it into four 4-bar phrases, detect chords for each segment independently, and feel confident the tool behaved predictably.

**Why This Journey Matters**: Tests explicit state visibility, keyboard alternatives for all interactions, and predictable behavior — all critical for neurodivergent users.

---

### Journey Stages

#### Stage 1: Importing a MIDI File

**Actions**:
- Sam drags "jazz_progression_16bars.mid" onto DropZone
- File uploads, chord detection runs
- Sam waits for feedback (did it work?)

**Touchpoints**:
- `DropZone` component (drag-and-drop area)
- File import logic (`handleFileUpload` in MidiCurator.tsx)
- Chord detection (`detectChord` from chord-detect.ts)

**Emotions**: 😐 Neutral — Sam expects modern file upload to work

**Current Support**: ✅ Works Well
- ✅ DropZone accepts drag-and-drop
- ✅ File parses and imports to IndexedDB
- ✅ Chord detection runs automatically

**Barriers**: None

**Improvements Needed**: None for basic import

**Success Criteria**:
- File imports in <2 seconds
- Clip appears in sidebar with detected chord label

---

#### Stage 2: Understanding Current State

**Actions**:
- Sam clicks imported clip, views piano roll and chord bar
- Sam sees "Cmaj7" detected for entire 16 bars (too coarse)
- Sam wants to segment into 4-bar phrases for finer analysis

**Touchpoints**:
- `PianoRoll` (displays notes across 16 bars)
- `ChordBar` (single cell showing "Cmaj7")
- `StatsGrid` (shows "Bars: 16")

**Emotions**: 😐 Neutral — tool behaving as expected so far

**Current Support**: ✅ Works Well
- ✅ Piano roll shows full 16 bars
- ✅ Chord bar shows single detected chord
- ✅ Stats grid provides bar count

**Barriers**: None (current state is clear visually)

**Improvements Needed**: None for this stage

**Success Criteria**:
- Sam can see full pattern at a glance
- Chord bar clearly shows single chord across all bars

---

#### Stage 3: Activating Scissors Mode

**Actions**:
- Sam reads keyboard shortcuts bar: "S Scissors"
- Sam presses S key
- Sam looks for visual feedback (is scissors mode active?)

**Touchpoints**:
- `KeyboardShortcutsBar`: "S Scissors"
- Scissors mode button (should show active state)
- Piano roll cursor (should change to crosshair or scissors icon)

**Emotions**: 😕 → 😊 Initial uncertainty, then relief when state becomes clear

**Current Support**: ⚠️ Partial
- ✅ S key toggles scissors mode
- ⚠️ Scissors button shows active state visually (border/highlight)
- ❌ No aria-pressed="true" for screen readers
- ❌ Cursor changes but no text announcement

**Barriers** (09-accessibility-audit.md):
- Section 4.1: Scissors button lacks aria-pressed state
- Section 1.4: No live region announces "Scissors mode active"

**Improvements Needed** (10-accessibility-plan.md):
- Tier 1.1: Add aria-pressed="true" when active
- Tier 1.4: Add live region: "Scissors mode active. Use arrow keys to navigate, Enter to place boundary."

**Success Criteria**:
- Visual indicator CLEAR (button highlighted, cursor changed)
- Sam confident mode is active (no ambiguity)
- Pressing S again exits mode (predictable toggle)

---

#### Stage 4: Placing Boundaries with Keyboard (CRITICAL BLOCKER)

**Actions**:
- Sam attempts to use arrow keys to navigate piano roll
- Sam presses Enter to place boundary (expecting it to work)
- Nothing happens — Sam realizes placement requires mouse click

**Touchpoints**:
- `PianoRoll` canvas (currently mouse-only for boundary placement)
- `handleMouseDown` in PianoRoll.tsx (no keyboard equivalent)

**Emotions**: 😞 → 😠 Frustration turns to anger — feature is inaccessible

**Current Support**: ❌ Complete Failure
- ✅ Scissors mode activates
- ❌ No keyboard method to place boundaries (mouse-only)
- ❌ Arrow keys do nothing in piano roll
- ❌ Enter/Space keys do nothing in piano roll

**Barriers** (09-accessibility-audit.md):
- Section 2.1 (CRITICAL): Scissors boundary placement is mouse-only interaction
- **Sam is blocked from completing task** — cannot segment pattern

**Improvements Needed** (10-accessibility-plan.md):
- Tier 1.5 (CRITICAL): Add keyboard alternative:
  ```tsx
  // Pseudocode for keyboard scissors placement
  const [scissorsCursor, setScissorsCursor] = useState(0);

  const handleScissorsKeyboard = (e: KeyboardEvent) => {
    if (!scissorsMode) return;

    if (e.key === 'ArrowRight') {
      setScissorsCursor(prev => prev + gridStep); // Move cursor right
    }
    if (e.key === 'ArrowLeft') {
      setScissorsCursor(prev => prev - gridStep); // Move cursor left
    }
    if (e.key === 'Enter' || e.key === ' ') {
      onBoundaryAdd(snapForScissors(scissorsCursor)); // Place boundary
    }
    if (e.key === 'Delete') {
      // Remove closest boundary
    }
  };
  ```

**Success Criteria**:
- Arrow keys (←→) move visible cursor along piano roll grid
- Cursor snaps to bar lines or beat divisions
- Enter places boundary at cursor position
- Visual feedback shows boundary immediately (vertical line)
- Sam completes segmentation in <30 seconds

---

#### Stage 5: Workaround — Using Mouse (Current Reality)

**Actions**:
- Sam switches to mouse (reluctantly)
- Sam clicks at bar 4, bar 8, bar 12 to create four segments
- Boundaries appear, chord bar updates to show four cells

**Touchpoints**:
- Mouse click handler in PianoRoll.tsx
- `onBoundaryAdd` callback
- `ChordBar` updates with four segments

**Emotions**: 😠 → 😐 Anger subsides to resignation — feature works but workflow interrupted

**Current Support**: ✅ Works (but defeats keyboard-first principle)
- ✅ Mouse click places boundaries
- ✅ Boundaries snap to bar lines
- ✅ ChordBar updates immediately

**Barriers**:
- Keyboard-first workflow violated (defeats accessibility principle)
- Sam's preference ignored (explicit state violated if mode changes cursor but doesn't enable keyboard control)

**Improvements Needed**: See Stage 4 (Tier 1.5)

**Success Criteria** (workaround):
- Mouse clicks place boundaries accurately
- Visual feedback immediate (no delay)

---

#### Stage 6: Reviewing Segmented Chords

**Actions**:
- Sam views updated chord bar: "Cmaj7 | Dm7 | G7 | Cmaj7"
- Sam uses arrow keys (←→) to navigate segments
- Sam sees piano roll highlight current segment

**Touchpoints**:
- `ChordBar` with four cells
- Arrow key navigation (←→ Segments)
- Piano roll highlighting (segment range)

**Emotions**: 😊 Satisfaction — segmentation revealed harmonic progression

**Current Support**: ✅ Works Well
- ✅ Arrow keys navigate segments
- ✅ Piano roll highlights current segment
- ✅ Chord bar shows progression clearly

**Barriers**: None

**Improvements Needed**: None for this stage

**Success Criteria**:
- Sam sees classic I-ii-V-I progression revealed by segmentation
- Sam feels confident analysis is correct

---

#### Stage 7: Checking Explicit State

**Actions**:
- Sam switches to different clip, then returns to segmented clip
- Sam checks: Are boundaries preserved? Is scissors mode still active?

**Touchpoints**:
- Clip selection (arrow keys ↑↓)
- Segmentation persistence (IndexedDB)
- Scissors mode state (should reset to inactive)

**Emotions**: 😐 → 😊 Neutral expectation, pleased when state matches prediction

**Current Support**: ✅ Works Well
- ✅ Boundaries persist across clip switches
- ✅ Scissors mode resets to inactive (predictable)
- ✅ Returning to clip shows preserved segmentation

**Barriers**: None

**Improvements Needed**: None (good explicit state management)

**Success Criteria**:
- Boundaries persist after clip switch (no data loss)
- Scissors mode inactive on return (predictable reset)
- Sam trusts tool to preserve work

---

#### Stage 8: Exiting Scissors Mode

**Actions**:
- Sam presses S key again to exit scissors mode
- Sam looks for confirmation (is mode inactive now?)

**Touchpoints**:
- Scissors mode toggle (S key)
- Visual indicator (button unhighlighted)
- Cursor returns to normal

**Emotions**: 😊 Confidence — mode toggle is predictable and explicit

**Current Support**: ✅ Works Well
- ✅ S key exits scissors mode
- ✅ Visual indicator clears (button unhighlighted)
- ✅ Cursor returns to default

**Barriers**: None

**Improvements Needed**: None for basic toggle

**Success Criteria**:
- Sam confident mode is inactive (visual + behavior match)
- Predictable interaction (same key toggles in and out)

---

### Current Journey Outcome

**Status**: ⚠️ PARTIALLY SUCCESSFUL

**What Worked**:
- File import smooth and automatic
- Chord detection provided coarse analysis
- Segmentation revealed harmonic progression clearly
- Explicit state mostly visible (scissors mode, boundary preservation)

**What Failed**:
- **Critical blocker**: Scissors mode requires mouse to place boundaries (defeats keyboard-first principle)
- Workaround forces Sam to use mouse (frustrating)

**Sam's Verdict**:
> "This tool has good bones. The segmentation feature is exactly what I need, and I love that scissors mode is explicit and predictable. But requiring mouse clicks to place boundaries is a dealbreaker. Fix that and I'm all in."

**Confidence Level**: 7/10 (would be 10/10 with keyboard scissors placement)

---

## Journey 3: Jordan's Chord Discovery — Learning Progressions

### Persona Context

**Jordan Martinez** (24, GarageBand user, self-taught, no theory training, ADHD traits)

**Goal**: Explore 50 MIDI files from a sample pack, discover which ones have similar "groovy" vibes, learn what a "ii-V-I" progression is through pattern recognition.

---

### Journey Stages

#### Stage 1: Discovering MIDIcurator

**Actions**:
- Jordan downloads 50 MIDI files from free sample pack (file names: "chord_loop_043.mid", "jazzy_progression_v2.mid")
- Jordan frustrated by meaningless file names
- Jordan searches "MIDI chord analysis tool" and finds MIDIcurator

**Touchpoints**:
- Web search → GitHub/website
- Landing page

**Emotions**: 😕 → 😐 Frustrated by file organization, cautiously hopeful

**Current Support**: ✅ Tool exists, discoverable

**Barriers**: None

**Improvements Needed**: None

**Success Criteria**:
- Jordan finds MIDIcurator within 5 minutes of searching

---

#### Stage 2: Batch Import

**Actions**:
- Jordan drags all 50 MIDI files onto DropZone at once
- Files upload and chord detection runs in background
- Jordan waits... no progress indicator shown

**Touchpoints**:
- `DropZone` (batch file drag-and-drop)
- `handleFileUpload` loop (processes 50 files sequentially)
- IndexedDB storage

**Emotions**: 😕 → 😐 Uncertain if it's working — stares at screen waiting

**Current Support**: ⚠️ Partial
- ✅ Batch upload works
- ❌ No progress indicator ("Analyzing: 12 of 50 files")
- ❌ UI may freeze if detection is synchronous

**Barriers** (03-problem-statements.md):
- HMW 5.1: Handle large batch imports without blocking UI
- No visual feedback during processing

**Improvements Needed** (10-accessibility-plan.md):
- Tier 1.4: Add progress indicator (aria-live region + visual progress bar)
- Background analysis (Web Worker or async iteration)

**Success Criteria**:
- Progress bar shows: "Analyzing: 12 of 50 files"
- UI remains responsive (can browse existing clips while import runs)
- Completion announced: "50 files analyzed" (live region)

---

#### Stage 3: Filtering by Vibe

**Actions**:
- Jordan sees 50 clips in sidebar (overwhelming!)
- Jordan types "minor" into filter input
- Sidebar shows 12 clips with minor chords

**Touchpoints**:
- `Sidebar` filter input
- Tag filtering logic (tagIndex)

**Emotions**: 😊 Delight — filter actually works!

**Current Support**: ✅ Works Well
- ✅ Filter input searches tags and chord names
- ✅ Results update in real-time

**Barriers**: None

**Improvements Needed**: None for basic filtering

**Success Criteria**:
- Typing "minor" shows 12 clips with minor chords
- Typing "jazzy" shows clips Jordan previously tagged

---

#### Stage 4: Discovering ii-V-I Pattern

**Actions**:
- Jordan clicks first filtered clip, sees chord bar: "Dm7 → G7 → Cmaj7"
- Jordan clicks second clip, sees: "Em7 → A7 → Dmaj7"
- Jordan notices pattern: minor seventh → dominant seventh → major seventh
- Jordan thinks: "These sound similar! Is there a name for this?"

**Touchpoints**:
- `ChordBar` (displays progression)
- `StatsGrid` (shows chord details)
- Piano roll (visual reinforcement)

**Emotions**: 😊 → 😃 Excitement — discovery moment!

**Current Support**: ✅ Works Well
- ✅ Chord bar clearly shows progression
- ✅ Pattern is visually consistent across clips

**Barriers**: None

**Improvements Needed**: None for discovery (progressive disclosure working)

**Success Criteria**:
- Jordan recognizes pattern across 3+ clips
- Jordan curious about pattern name (learning moment)

---

#### Stage 5: Learning Terminology

**Actions**:
- Jordan clicks on "Dm7" in chord bar
- Tooltip or inline detail reveals: "D Dorian minor seventh"
- Jordan searches "ii-V-I progression" online, reads explanation

**Touchpoints**:
- `ChordBar` cell (hover or click for detail)
- External learning resources

**Emotions**: 😃 Confidence — music theory feels accessible

**Current Support**: ⚠️ Partial
- ⚠️ Chord symbols shown, but no inline explanation of progression type
- ✅ Chord names clear (not overly technical)

**Barriers**: None critical (external learning fills gap)

**Improvements Needed** (future feature):
- Tier 3: Add pattern recognition ("This is a ii-V-I progression, common in jazz")

**Success Criteria**:
- Jordan learns "ii-V-I" name within 10 minutes of discovery
- Jordan feels "I finally get what jazz musicians mean!"

---

#### Stage 6: Tagging by Vibe

**Actions**:
- Jordan adds custom tag "groovy-jazz" to three clips with ii-V-I progressions
- Jordan later filters by "groovy-jazz" and finds all three

**Touchpoints**:
- `TagEditor` component
- Tag input and save logic

**Emotions**: 😊 Satisfaction — library organization finally makes sense

**Current Support**: ✅ Works Well
- ✅ Custom tags work
- ✅ Filter supports custom tags

**Barriers**: None

**Improvements Needed**: None

**Success Criteria**:
- Jordan organizes 50 files with 5-10 custom tags in 30 minutes
- Jordan finds patterns 80% faster than browsing folders

---

#### Stage 7: Generating Variants

**Actions**:
- Jordan likes one progression but wants "simpler version for learning"
- Jordan presses G key, generates 5 variants with different densities
- Jordan plays density 0.5 variant (sparser, easier to play on keyboard)

**Touchpoints**:
- `KeyboardShortcutsBar`: "G Generate 5"
- Variant generation (`generateVariants` in MidiCurator.tsx)
- Density transform (`transformGesture` in transform.ts)

**Emotions**: 😃 → 😊 Delight — tool is helping learning, not just organizing

**Current Support**: ✅ Works Well
- ✅ G key generates 5 variants instantly
- ✅ Variants show density in filename ("_d0.50.mid")

**Barriers**: None

**Improvements Needed**: None for basic generation

**Success Criteria**:
- Jordan generates variants of 5 favorite patterns
- Jordan keeps 2-3 variants per original (successful exploration)

---

#### Stage 8: Exporting for GarageBand

**Actions**:
- Jordan presses D key to download variant
- File exports with chord labels preserved (MIDI text events)
- Jordan imports to GarageBand, sees chord symbols in timeline

**Touchpoints**:
- `KeyboardShortcutsBar`: "D Download"
- Export logic (`downloadMIDI` in midi-export.ts)
- MIDI metadata round-trip

**Emotions**: 😊 Success — workflow complete, ready to produce music

**Current Support**: ✅ Works Well
- ✅ D key downloads current clip
- ✅ Metadata preserved (chord labels, BPM)

**Barriers**: None

**Improvements Needed**: None

**Success Criteria**:
- Exported MIDI opens in GarageBand with chord labels intact
- Jordan uses pattern in new track (successful learning-to-production pipeline)

---

### Current Journey Outcome

**Status**: ✅ SUCCESSFUL

**What Worked**:
- Batch import organized chaos into searchable library
- Filter enabled discovery of similar patterns
- Chord bar visualization revealed harmonic relationships
- Custom tagging empowered personal organization
- Variant generation supported learning (simpler versions)

**What Could Improve**:
- Progress indicator during batch import (avoid "is it working?" uncertainty)
- Pattern name detection ("This is a ii-V-I progression")

**Jordan's Verdict**:
> "This is exactly what I needed. I finally understand why some of my loops sound 'jazzy' — they're all ii-V-I progressions! I've organized 50 files and learned more music theory in 30 minutes than I did in a year of YouTube tutorials."

**Confidence Level**: 9/10 (would be 10/10 with progress indicator)

---

## Journey 4: Aisha's Library Organization — 500+ Files

### Persona Context

**Dr. Aisha Okonkwo** (42, music professor, Berklee grad, 2000+ MIDI files, keyboard-first workflow)

**Goal**: Import 500 MIDI files from decade-old archive, auto-analyze chords, override incorrect detections, organize with semantic tags, and feel confident metadata will persist.

---

### Journey Stages

#### Stage 1: Assessing Tool Capabilities

**Actions**:
- Aisha reads documentation (ARCHITECTURE.md, README.md)
- Aisha verifies: Does it respect my expertise? Can I override detections?
- Aisha decides to test with 500-file batch (high-stakes decision)

**Touchpoints**:
- Documentation
- Design principles (02-principles.md: "Analysis is Assistive, Not Authoritative")

**Emotions**: 😐 → 😊 Skeptical at first, pleased by principle alignment

**Current Support**: ✅ Principles documented clearly

**Barriers**: None

**Improvements Needed**: None (documentation reassures expert users)

**Success Criteria**:
- Aisha confident tool respects expertise before importing

---

#### Stage 2: Batch Import (500 Files)

**Actions**:
- Aisha drags 500 MIDI files onto DropZone (entire archive folder)
- Import runs for 2-3 minutes (auto-detection for each file)
- Aisha monitors progress (or walks away to make coffee)

**Touchpoints**:
- `DropZone` batch import
- Background analysis (needs Web Worker or async iteration)
- IndexedDB storage

**Emotions**: 😕 → 😊 Initial anxiety ("will this freeze?"), relief when it works

**Current Support**: ⚠️ Partial
- ✅ Batch import works
- ❌ UI may freeze for large batches
- ❌ No progress indicator

**Barriers** (03-problem-statements.md):
- HMW 5.1: Handle large batch imports without blocking UI
- HMW 3.1: Organize large MIDI libraries without rigid hierarchies

**Improvements Needed** (10-accessibility-plan.md):
- Tier 1.4: Add progress indicator + live region
- Background analysis in Web Worker

**Success Criteria**:
- 500 files analyzed in <5 minutes
- UI remains responsive during analysis
- Aisha can browse existing clips while import runs

---

#### Stage 3: Spot-Checking Detections

**Actions**:
- Aisha filters by "dim" (diminished chords)
- Aisha finds 8 results, clicks first clip
- Aisha sees: "F#dim7" — correct!
- Aisha clicks second clip, sees: "Cdim" — incorrect, should be "Cdim7"

**Touchpoints**:
- Filter input (sidebar)
- `ChordBar` (displays detected chord)
- `StatsGrid` (chord symbol)

**Emotions**: 😐 → 😕 Expected some errors, ready to override

**Current Support**: ✅ Detection works (with expected errors)

**Barriers**: None (errors are acceptable if overridable)

**Improvements Needed**: None for detection (algorithm is assistive, not authoritative)

**Success Criteria**:
- Aisha finds 8 diminished chords in 500 files (discovery)
- Detection accuracy ~90% (acceptable for assistive tool)

---

#### Stage 4: Overriding Incorrect Detection

**Actions**:
- Aisha clicks "Cdim" in chord bar
- Inline editor appears (or input field in StatsGrid)
- Aisha types "Cdim7", presses Enter
- Chord bar updates, override persists

**Touchpoints**:
- `ChordBar` cell (click to edit)
- `StatsGrid` chord input (current override mechanism)
- Override persistence (IndexedDB)

**Emotions**: 😊 Satisfaction — tool respects expertise

**Current Support**: ✅ Works Well
- ✅ StatsGrid chord input accepts custom chord symbols
- ✅ Override persists across sessions

**Barriers**: None

**Improvements Needed**: None (override works as designed)

**Success Criteria**:
- Aisha overrides 10-20 chords across 500 files
- Overrides persist after browser restart
- Aisha trusts tool to preserve corrections

---

#### Stage 5: Creating Custom Taxonomy

**Actions**:
- Aisha creates tags: "bebop-line", "modal-interchange", "gospel-turnaround", "student-submission-2024"
- Aisha applies "bebop-line" to 12 clips
- Aisha filters by "bebop-line", finds all 12 instantly

**Touchpoints**:
- `TagEditor` component
- Custom tag creation
- Tag filtering

**Emotions**: 😊 → 😃 Joy — library finally organized semantically

**Current Support**: ✅ Works Well
- ✅ Custom tags work
- ✅ Filter searches tags
- ✅ Tag index enables fast lookups

**Barriers**: None

**Improvements Needed**: None

**Success Criteria**:
- Aisha organizes 500 files with 20-30 custom tags in 2 hours
- Aisha finds examples for class in <10 seconds (vs. 10 minutes browsing folders)

---

#### Stage 6: Exporting for Teaching

**Actions**:
- Aisha filters by "ii-V-I", finds 15 examples
- Aisha selects 3 best examples, downloads as ZIP
- Aisha imports to DAW, confirms chord labels preserved

**Touchpoints**:
- Batch export (`downloadAllClips` or `downloadVariantsAsZip`)
- MIDI metadata round-trip (chord labels as text events)

**Emotions**: 😊 Confidence — metadata fidelity confirmed

**Current Support**: ✅ Works Well
- ✅ Export preserves chord labels (MIDI text events)
- ✅ Batch download available

**Barriers**: None

**Improvements Needed**: None

**Success Criteria**:
- Exported MIDI files open in Ableton with chord labels intact
- Students receive files with embedded metadata (no separate PDF needed)

---

#### Stage 7: Discovering Forgotten Gems

**Actions**:
- Aisha filters by "slash" (slash chords)
- Aisha finds 5 clips with unusual voicings (C/E, Dm/F)
- Aisha tags them "transcribe-later" for personal study

**Touchpoints**:
- Slash chord detection (bassPc in ChordMatch)
- Filter search

**Emotions**: 😃 Delight — tool surfaced patterns she forgot she had

**Current Support**: ✅ Works Well
- ✅ Slash chord detection implemented (bassPc, bassName)
- ✅ Slash chords filterable

**Barriers**: None

**Improvements Needed**: None

**Success Criteria**:
- Aisha discovers 5+ patterns she forgot existed ("I didn't know I had this!")
- Aisha feels archive is finally navigable

---

#### Stage 8: Recommending to Colleagues

**Actions**:
- Aisha shows MIDIcurator to colleague at faculty meeting
- Colleague asks: "Does it respect my corrections?"
- Aisha demonstrates override and persistence

**Touchpoints**:
- Override workflow
- Documentation (design principles)

**Emotions**: 😊 Pride — tool worthy of professional recommendation

**Current Support**: ✅ Works Well

**Barriers**: None

**Improvements Needed**: None

**Success Criteria**:
- Colleague adopts tool for own library
- Aisha contributes feature requests (engaged power user)

---

### Current Journey Outcome

**Status**: ✅ HIGHLY SUCCESSFUL

**What Worked**:
- Batch import scaled to 500 files
- Override respected expert knowledge
- Custom taxonomy enabled semantic organization
- Filter enabled rapid discovery
- Metadata round-trip preserved corrections
- Tool surfaced forgotten patterns

**What Could Improve**:
- Progress indicator during batch import (reduce anxiety)
- Keyboard shortcut for batch tagging (currently manual)

**Aisha's Verdict**:
> "This tool respects my expertise. I can finally organize 20 years of MIDI files in a way that makes sense. The override feature is critical — I trust the tool to preserve my corrections, not override them. I'm recommending this to every music educator I know."

**Confidence Level**: 10/10 (professional-grade tool)

---

## Journey 5: Marcus's Classroom Demo — Music Educator

### Persona Context

**Marcus Johnson** (38, high school music teacher, community workshop facilitator)

**Goal**: Project MIDIcurator on classroom screen, demonstrate ii-V-I progression to 25 students, generate simpler variant for beginners, export for homework.

---

### Journey Stages

#### Stage 1: Pre-Class Setup

**Actions**:
- Marcus opens MIDIcurator on laptop, connects to projector
- Marcus loads sample progressions (30 preloaded examples)
- Marcus selects "II-V-I in C" for demonstration

**Touchpoints**:
- `ProgressionGenerator` ("Load sample progressions" button)
- Projector display (large screen, students 10+ feet away)

**Emotions**: 😐 Neutral — standard class setup

**Current Support**: ✅ Works Well
- ✅ Sample progressions load instantly
- ✅ UI readable on projector (high contrast)

**Barriers**: None

**Improvements Needed**: None for basic projection

**Success Criteria**:
- Setup complete in <2 minutes
- UI visible from back of classroom

---

#### Stage 2: Live Demonstration

**Actions**:
- Marcus presses Space, pattern plays
- Marcus asks: "What did you hear?"
- Students call out: "minor", "tension", "home"
- Marcus points to chord bar cells as they highlight during playback

**Touchpoints**:
- `TransportBar` (Space key, play button)
- `ChordBar` (playhead highlighting during playback)
- `PianoRoll` (visual reinforcement)

**Emotions**: 😊 → 😃 Students engaged, learning moment

**Current Support**: ⚠️ Partial
- ✅ Space key plays pattern
- ✅ Piano roll shows notes clearly
- ⚠️ ChordBar cells NOT highlighted during playback (current limitation)

**Barriers** (future enhancement):
- ChordBar doesn't show current playback position visually
- Students can't see which chord is playing at each moment

**Improvements Needed** (future feature):
- Tier 2: Add playhead highlighting to ChordBar cells (aria-current="true" + visual highlight)

**Success Criteria**:
- Students identify chord changes by ear (3 out of 5 correct)
- Marcus doesn't need to manually point at chords (visual highlight does it)

---

#### Stage 3: Explaining Progression

**Actions**:
- Marcus says: "This is called a two-five-one. It's in thousands of jazz and pop songs."
- Marcus clicks each chord bar cell, reads tooltip: "Dm7: D Dorian minor seventh"
- Students take notes

**Touchpoints**:
- `ChordBar` cells (click for detail)
- Tooltip or inline expansion (progressive disclosure)

**Emotions**: 😊 Students understanding, Marcus confident in tool

**Current Support**: ⚠️ Partial
- ✅ Chord symbols clear
- ⚠️ No tooltip/inline detail for full chord names (current limitation)

**Barriers**:
- No easy way to reveal "D Dorian minor seventh" without external explanation

**Improvements Needed** (future feature):
- Tier 2: Add tooltip or click-to-expand for chord detail

**Success Criteria**:
- Students write down "ii-V-I" in notes
- Students understand harmonic function (ii = preparation, V = tension, I = resolution)

---

#### Stage 4: Generating Simpler Variant

**Actions**:
- Marcus says: "This version has a lot of notes. Let me make a simpler one for beginners."
- Marcus adjusts density slider to 0.5, presses V (generate 1 variant)
- Sparser variant appears, Marcus plays it

**Touchpoints**:
- Density slider (`TransformControls`)
- `KeyboardShortcutsBar`: "V Generate 1"
- Variant generation

**Emotions**: 😃 Students impressed — teacher customizing in real-time

**Current Support**: ✅ Works Well
- ✅ Density slider adjusts multiplier
- ✅ V key generates 1 variant instantly

**Barriers**: None

**Improvements Needed**: None

**Success Criteria**:
- Variant has 50% fewer notes (easier for students to play)
- Marcus generates variant in <10 seconds (no workflow interruption)

---

#### Stage 5: Exporting for Homework

**Actions**:
- Marcus presses D key, downloads variant
- Marcus uploads to Google Classroom
- Students download and import to GarageBand

**Touchpoints**:
- `KeyboardShortcutsBar`: "D Download"
- Export logic (MIDI with metadata)

**Emotions**: 😊 Workflow complete, students have practice material

**Current Support**: ✅ Works Well
- ✅ Export preserves chord labels
- ✅ Students can open file in any DAW

**Barriers**: None

**Improvements Needed**: None

**Success Criteria**:
- Students import file and see chord labels in GarageBand
- Students remix pattern for homework assignment

---

#### Stage 6: Student Question — "Can we try it in a different key?"

**Actions**:
- Marcus searches for transpose feature (not yet implemented)
- Marcus workaround: manually creates progression in G major using leadsheet input

**Touchpoints**:
- `LeadsheetInput` component
- `transposeProgression` function (exists in code, not exposed in UI)

**Emotions**: 😕 Minor frustration — feature exists but not accessible

**Current Support**: ⚠️ Partial
- ✅ Transpose function exists in codebase (`transposeProgression` in progressions.ts)
- ❌ No UI control to transpose existing clip

**Barriers** (future feature request):
- Transpose feature not exposed in UI (requires leadsheet workaround)

**Improvements Needed** (future feature):
- Tier 3: Add transpose control (dropdown: "Transpose to: [C, G, D, F, etc.]")

**Success Criteria**:
- Marcus transposes progression to G major in <10 seconds
- Students see same harmonic function in different key

---

#### Stage 7: Reflecting on Lesson

**Actions**:
- Marcus reviews lesson success: Students understood ii-V-I, generated practice files
- Marcus thinks: "This tool saved me 20 minutes of setup compared to notation software."

**Touchpoints**:
- Overall workflow efficiency

**Emotions**: 😊 Satisfaction — tool enhanced pedagogy

**Current Support**: ✅ Works Well

**Barriers**: None critical

**Improvements Needed**: None

**Success Criteria**:
- Lesson completed in 50-minute period (no overtime)
- Students engaged and confident
- Marcus will use tool again next week

---

#### Stage 8: Sharing with Colleagues

**Actions**:
- Marcus shows MIDIcurator to music department colleagues
- Colleagues ask: "Does it work with projector?" "Can students use it on Chromebooks?"
- Marcus demos successfully

**Touchpoints**:
- Browser compatibility (Chrome, Safari, Firefox)
- Responsive design (Chromebook screens)

**Emotions**: 😊 Pride — tool worthy of professional recommendation

**Current Support**: ✅ Works Well
- ✅ Browser-based (no installation required)
- ✅ Responsive design (works on Chromebooks)

**Barriers**: None

**Improvements Needed**: None

**Success Criteria**:
- Colleague adopts tool for own classes
- Marcus recommends at professional development workshop

---

### Current Journey Outcome

**Status**: ✅ HIGHLY SUCCESSFUL

**What Worked**:
- Instant setup with sample progressions
- Keyboard shortcuts enabled live demos without mouse fumbling
- Variant generation customized examples for different skill levels
- Export provided students with practice materials
- Browser-based tool worked on school computers

**What Could Improve**:
- ChordBar playhead highlighting (visual reinforcement during playback)
- Transpose control in UI (currently requires workaround)
- Tooltip/detail view for chord names (progressive disclosure)

**Marcus's Verdict**:
> "This is the best tool I've found for teaching harmony visually. My students finally see what a ii-V-I looks like, not just hear it. The variant generator lets me scaffold complexity perfectly. I'm using this every week."

**Confidence Level**: 9/10 (would be 10/10 with transpose control)

---

## Cross-Journey Analysis

### Common Success Patterns

**What Works Across All Journeys**:
1. **Keyboard shortcuts** enable efficient workflows (Space, S, D, G, V)
2. **Chord detection** provides instant harmonic analysis (80-90% accuracy acceptable)
3. **Tag-based organization** replaces rigid folder hierarchies
4. **Variant generation** supports learning and exploration
5. **Metadata round-trip** preserves user overrides and chord labels

### Common Barriers

**What Blocks Multiple Personas**:
1. **Piano roll silence** (blocks Riley, frustrates Sam)
2. **Scissors mode mouse-only** (blocks Riley and Sam, frustrates Aisha)
3. **No progress indicator** (creates anxiety for Jordan, Aisha during batch imports)
4. **Missing state announcements** (confuses Riley, frustrates Sam)
5. **No playhead highlighting in ChordBar** (reduces pedagogy effectiveness for Marcus)

### Priority Ranking (Based on Journey Impact)

**Tier 1 (Critical — Blocks Core Use Cases)**:
1. Piano roll text alternative (blocks Riley entirely)
2. Keyboard scissors placement (blocks Riley, Sam)
3. Focus indicators (blocks keyboard-only users)
4. ARIA labels on all controls (blocks Riley)
5. Live regions for state changes (blocks Riley, confuses Sam)

**Tier 2 (Important — Improves Usability)**:
1. Progress indicator for batch imports (reduces anxiety for Jordan, Aisha)
2. ChordBar playhead highlighting (improves pedagogy for Marcus)
3. Transpose control in UI (enhances Marcus's workflow)
4. Skip links (speeds navigation for Riley)

**Tier 3 (Enhanced — Exceeds Expectations)**:
1. Pattern name detection ("This is a ii-V-I")
2. Chord detail tooltips (progressive disclosure)
3. High-contrast theme option
4. Audio cues for boundaries

---

## Journey-Based Success Metrics

### Quantitative

**Journey 1 (Riley)**:
- Task completion: 80%+ independently (no sighted assistance)
- Time to first playback: <2 minutes
- WCAG AA compliance: Lighthouse score ≥95

**Journey 2 (Sam)**:
- Scissors segmentation: 100% keyboard-accessible
- Boundary placement time: <30 seconds (keyboard)
- State visibility: 100% explicit (no hidden modes)

**Journey 3 (Jordan)**:
- Pattern discovery: 3+ similar progressions in <10 minutes
- Library organization: 50 files tagged in 30 minutes
- Learning moment: "I finally get what a ii-V-I is!"

**Journey 4 (Aisha)**:
- Batch import: 500 files analyzed in <5 minutes
- Override accuracy: 100% preserved across sessions
- Discovery: 5+ forgotten patterns surfaced

**Journey 5 (Marcus)**:
- Lesson setup: <2 minutes
- Student engagement: 80%+ identify chords correctly
- Variant generation: <10 seconds (no workflow interruption)

### Qualitative

**User Testimonials (Target)**:
- Riley: "First music tool that works with my screen reader"
- Sam: "Predictable and transparent — no surprises"
- Jordan: "I learned more in 30 minutes than a year of tutorials"
- Aisha: "Respects my expertise — I trust it"
- Marcus: "Best tool for teaching harmony visually"

---

## Related Documents

- [01-personas.md](01-personas.md) — Detailed persona profiles
- [03-problem-statements.md](03-problem-statements.md) — HMW questions addressed by journeys
- [09-accessibility-audit.md](09-accessibility-audit.md) — Barriers referenced in journeys
- [10-accessibility-plan.md](10-accessibility-plan.md) — Remediation roadmap
- [11-principles.md](11-principles.md) — Design principles guiding solutions

---

## Revision History

- **2026-02-12**: Initial journey maps created (Phase 2 of Design Thinking foundation)
- Future: Update after user testing validates assumptions
