# Narrative Use Case Scenarios

**Last updated:** 2026-02-12

## Overview

This document presents narrative use case scenarios showing MIDIcurator in action. Each scenario is a "day in the life" story demonstrating how personas use the tool to solve real problems. Scenarios use real component names, actual keyboard shortcuts, and cite specific code when relevant.

**Purpose**:
- Make abstract design principles concrete through storytelling
- Demonstrate value propositions through realistic workflows
- Highlight accessibility wins and learning moments
- Provide onboarding inspiration and documentation examples

**Scenario Structure**:
- **Setting**: Context and background
- **Challenge**: Problem the user faces
- **MIDIcurator in Action**: Step-by-step workflow with specific UI elements
- **Resolution**: Successful outcome
- **Key Insights**: Lessons learned, design principles demonstrated

---

## Scenario 1: Riley's Accessibility Win — Screen Reader Success Story

### Setting

**Tuesday, 3:00 PM — Riley's dorm room, UC Berkeley**

Riley Chen (19, computer science major, blind, JAWS screen reader user) has just finished a data structures lecture. They want to unwind by exploring MIDI patterns from a free sample pack they downloaded last week. Riley tried GarageBand last month but gave up after 20 minutes — the piano roll was completely silent to their screen reader, and buttons were unlabeled.

Riley heard about MIDIcurator from an accessibility subreddit. The post mentioned: "First music tool that actually works with JAWS." Riley is skeptical but willing to try one more time.

### Challenge

**Riley's Inner Monologue**:
> "I just want to understand what notes are in this MIDI file without asking my roommate to look at the screen. Why is music software so hostile to blind people? Even the 'accessible' tools only work halfway."

**Specific Problems**:
- Piano roll visualizations are canvas-based (invisible to screen readers)
- Buttons use icons without text labels (screen reader announces "button" with no context)
- Playback state changes silently (no confirmation audio is playing)
- Modal workflows require mouse interaction (no keyboard alternatives)

### MIDIcurator in Action

#### Step 1: First Impressions (0:00 - 0:30)

Riley opens Chrome and navigates to MIDIcurator's web app.

**Riley's JAWS announces**:
> "MIDI Curator — MIDI Pattern Analysis and Curation Tool, main page. Skip to clip details, link. Skip to clip library, link."

**Riley's Reaction**:
> "Wait, skip links? Already better than most music software."

Riley presses Tab. JAWS announces:
> "Skip to clip details, link."

Riley presses Enter. Focus jumps to main content area, skipping the entire sidebar.

**Code Reference** (10-accessibility-plan.md, Tier 2.2):
```tsx
// MidiCurator.tsx
<a href="#main-content" className="mc-skip-link">
  Skip to clip details
</a>
<main id="main-content" className="mc-main" role="main">
  <ClipDetail clip={selectedClip} />
</main>
```

**Riley's Thought**:
> "Okay, this is promising. Skip links are a good sign."

---

#### Step 2: Loading Sample Progressions (0:30 - 1:00)

Riley tabs backward to find the sidebar, discovers "Load sample progressions" button.

**JAWS announces**:
> "Load sample progressions, button. 30 preloaded MIDI clips with common chord progressions."

Riley presses Enter.

**Live region announces**:
> "Loading 30 clips. Analyzing chord progressions."

After 2 seconds:
> "30 clips loaded. First result: II-V-I in C."

**Code Reference** (10-accessibility-plan.md, Tier 1.4):
```tsx
// ProgressionGenerator.tsx
const [announcement, setAnnouncement] = useState('');

const loadProgressions = () => {
  setAnnouncement('Loading 30 clips. Analyzing chord progressions.');
  // ... load logic ...
  setAnnouncement(`30 clips loaded. First result: ${clips[0].name}`);
};

return (
  <>
    <button onClick={loadProgressions} aria-label="Load sample progressions">
      Load Progressions
    </button>
    <div role="status" aria-live="polite" className="sr-only">
      {announcement}
    </div>
  </>
);
```

**Riley's Reaction**:
> "Holy crap, it actually announced what happened! This never happens in music software!"

---

#### Step 3: Selecting a Clip (1:00 - 1:30)

Riley tabs through clip cards in sidebar.

**JAWS announces each card**:
> "II-V-I in C, 42 notes, detected chord Dm7, button. Press Enter to select."

> "I-IV-V in G, 36 notes, detected chord G major, button."

Riley returns to first clip, presses Enter.

**Live region announces**:
> "II-V-I in C selected. 42 notes, 8 bars, 120 BPM."

**Code Reference** (10-accessibility-plan.md, Tier 1.1):
```tsx
// ClipCard.tsx
<div
  className={`mc-clip-card ${selected ? 'mc-clip-card--selected' : ''}`}
  onClick={() => onSelect(clip.id)}
  role="button"
  tabIndex={0}
  aria-label={`${clip.name}, ${clip.gesture.notes.length} notes, detected chord ${clip.harmonic.detectedChord?.symbol || 'Unknown'}`}
  aria-pressed={selected}
  onKeyDown={(e) => e.key === 'Enter' && onSelect(clip.id)}
>
  {/* Visual card content */}
</div>
```

**Riley's Thought**:
> "I can actually navigate this with my keyboard. And it tells me what's selected. This is unreal."

---

#### Step 4: Understanding the Piano Roll (1:30 - 2:30)

Riley tabs to main content, reaches piano roll area.

**JAWS announces**:
> "Piano roll visualization: 42 notes spanning C3 to G5, 8 bars, 120 BPM, image. Press Enter to explore note list."

Riley presses Enter (or continues tabbing to find note list).

**JAWS announces visually-hidden note list**:
> "Note 1: D4, bar 1 beat 1, quarter note, velocity 80. Note 2: F4, bar 1 beat 1, quarter note, velocity 72. Note 3: A4, bar 1 beat 1, quarter note, velocity 76. Note 4: C5, bar 1 beat 1, quarter note, velocity 68."

Riley presses Page Down to skip ahead in note list.

> "Note 15: G4, bar 2 beat 1, quarter note, velocity 82..."

**Code Reference** (10-accessibility-plan.md, Tier 1.3):
```tsx
// PianoRoll.tsx
const noteDescriptions = useMemo(() => {
  return clip.gesture.notes.slice(0, 50).map((note, i) => {
    const pitchName = noteName(note.pitch);
    const bar = Math.floor(note.tick / clip.gesture.ticks_per_bar) + 1;
    const beat = Math.floor((note.tick % clip.gesture.ticks_per_bar) / clip.gesture.ticks_per_beat) + 1;
    return `Note ${i + 1}: ${pitchName}, bar ${bar} beat ${beat}, velocity ${note.velocity}`;
  }).join('. ');
}, [clip]);

return (
  <>
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={`Piano roll visualization: ${clip.gesture.notes.length} notes spanning ${minPitch} to ${maxPitch}, ${numBars} bars`}
      aria-describedby="piano-roll-notes"
      tabIndex={0}
    />
    <div id="piano-roll-notes" className="sr-only">
      {noteDescriptions}
      {clip.gesture.notes.length > 50 && ` (showing first 50 of ${clip.gesture.notes.length} notes)`}
    </div>
  </>
);
```

**Riley's Reaction**:
> "I CAN ACTUALLY UNDERSTAND THE NOTES! This is the first time I've ever accessed piano roll information with my screen reader. I might cry."

---

#### Step 5: Playing the Pattern (2:30 - 3:00)

Riley tabs to keyboard shortcuts bar (or presses Space directly).

**JAWS announces**:
> "Keyboard shortcuts. Space: Play/Pause. S: Scissors mode. D: Download. G: Generate 5 variants."

Riley presses Space.

**Playback starts. Live region announces**:
> "Playing."

Riley hears MIDI playback through their speakers (four chord progression).

**During playback, live region announces each chord** (debounced to avoid spam):
> "Bar 1: Dm7."
> (2 seconds pass)
> "Bar 2: G7."
> (2 seconds pass)
> "Bar 3: Cmaj7."

Riley presses Space again.

**Live region announces**:
> "Paused."

**Code Reference** (10-accessibility-plan.md, Tier 1.4):
```tsx
// TransportBar.tsx
export function TransportBar({ isPlaying, onPlayPause }) {
  return (
    <div className="mc-transport">
      <button
        onClick={onPlayPause}
        aria-label={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
      >
        {isPlaying ? '⏸' : '▶'}
      </button>

      {/* Live region for playback state */}
      <div role="status" aria-live="polite" className="sr-only">
        {isPlaying ? 'Playing' : 'Paused'}
      </div>
    </div>
  );
}
```

**Riley's Reaction**:
> "I KNOW IT'S PLAYING! It actually told me! This is a miracle!"

---

#### Step 6: Understanding the Chord Bar (3:00 - 3:30)

Riley tabs to chord bar.

**JAWS announces**:
> "Chord progression. List with 3 items."

Riley presses Down arrow to navigate list items.

**JAWS announces each chord**:
> "Bar 1: Dm7, Dorian minor seventh chord, list item."
> "Bar 2: G7, dominant seventh chord, list item."
> "Bar 3: Cmaj7, major seventh chord, list item."

**Code Reference** (10-accessibility-plan.md, Tier 1.1):
```tsx
// ChordBar.tsx
<div className="mc-chord-bar" role="list" aria-label="Chord progression">
  {segments.map((seg, i) => (
    <div
      key={i}
      className="mc-chord-bar-cell"
      role="listitem"
      aria-label={`Bar ${i + 1}: ${seg.chord?.symbol}, ${seg.chord?.fullName}`}
      style={{ width: `${seg.widthPercent}%` }}
    >
      <span className="mc-chord-bar-symbol">{seg.chord?.symbol}</span>
    </div>
  ))}
</div>
```

**Riley's Thought**:
> "I understand the chord progression. I know which bar each chord is in. This is the level of detail I've been begging for in music software."

---

#### Step 7: Navigating to Another Clip (3:30 - 4:00)

Riley remembers "↑↓ Clips" shortcut from shortcuts bar.

Riley presses Down arrow.

**Live region announces**:
> "I-IV-V in G selected. 36 notes, 4 bars, 110 BPM."

Riley presses Space to play new pattern.

**Live region announces**:
> "Playing."

Riley listens, then presses Up arrow to return to previous clip.

**Live region announces**:
> "II-V-I in C selected. 42 notes, 8 bars, 120 BPM."

**Code Reference** (10-accessibility-plan.md, Tier 1.4):
```tsx
// MidiCurator.tsx
const [clipAnnouncement, setClipAnnouncement] = useState('');

const selectClip = useCallback((clip: Clip) => {
  setSelectedClip(clip);
  setClipAnnouncement(
    `${clip.name} selected. ${clip.gesture.notes.length} notes, ${numBars} bars, ${clip.bpm} BPM.`
  );
}, []);

return (
  <>
    {/* UI components */}
    <div role="status" aria-live="polite" className="sr-only">
      {clipAnnouncement}
    </div>
  </>
);
```

**Riley's Reaction**:
> "I can explore different patterns without losing my place. This is how music software should work."

---

### Resolution

Riley spends the next 20 minutes exploring sample progressions, playing patterns, and reading chord progressions. Riley successfully:
- Loaded 30 sample progressions independently
- Played and paused patterns with Space key
- Understood note information via piano roll text alternative
- Navigated chord progressions with arrow keys
- Compared different patterns by switching clips

**Riley's Verdict** (posted to accessibility subreddit):
> "I just used MIDIcurator for 30 minutes and I'm honestly emotional. This is the first music tool that actually works with JAWS. I could navigate everything with my keyboard, I heard announcements for playback state, and I could actually READ THE PIANO ROLL NOTES. Blind musicians: this tool is for us. Thank you to whoever built this."

**Confidence Level**: 9/10 (would be 10/10 with scissors mode keyboard support)

---

### Key Insights

**Design Principles Demonstrated**:
1. **Accessibility is Foundational** (Principle 4): Every feature works with screen reader and keyboard
2. **Explicit Over Implicit** (Principle 7): State changes announced via live regions
3. **Progressive Disclosure** (Principle 6): Piano roll summary first, detailed note list available on demand

**Technical Implementations That Made This Possible**:
- ARIA labels on all interactive elements (buttons, clip cards, piano roll)
- ARIA live regions for dynamic content (playback state, clip selection)
- Text alternative for canvas-based piano roll (aria-describedby with note list)
- Keyboard shortcuts for all actions (Space, arrow keys, S, D, G)
- Semantic HTML (role="list", role="button", role="status")

**Impact**:
- Riley can now explore MIDI patterns independently (no sighted assistance)
- Riley feels empowered to re-engage with music technology
- Riley advocates for accessibility in music tech spaces (blog post, conference talk)

**Related Documents**:
- [01-personas.md](01-personas.md) — Riley (Accessibility-First Learner) persona
- [04-journey-maps.md](04-journey-maps.md) — Riley's First Pattern journey
- [09-accessibility-audit.md](09-accessibility-audit.md) — Barriers that would block Riley
- [10-accessibility-plan.md](10-accessibility-plan.md) — Remediations that enabled Riley's success

---

## Scenario 2: Jordan's First Pattern — Discovery Moment

### Setting

**Saturday, 10:00 AM — Jordan's apartment, Portland**

Jordan Martinez (24, content creator, GarageBand user, self-taught) wakes up with creative energy. They want to make a lo-fi hip-hop beat but their usual sample pack folders are a mess. File names like "chord_loop_043.mid" and "jazzy_progression_v2.mid" mean nothing. Jordan has 200+ MIDI files and can't remember which ones have the "dreamy" vibe they're going for.

Jordan remembers seeing MIDIcurator mentioned in a YouTube comment: "Helped me organize 500 samples in 30 minutes." Jordan decides to try it.

### Challenge

**Jordan's Inner Monologue**:
> "I know I have loops that sound 'dreamy' but I can't find them. I've been clicking through samples for 20 minutes and I'm losing the creative spark. There has to be a better way."

**Specific Problems**:
- File names don't describe harmonic content
- Folder organization is arbitrary ("Chill Vibes", "Dark Moods")
- No way to filter by chord type or progression
- Trial-and-error browsing kills creative flow

### MIDIcurator in Action

#### Step 1: Batch Import (10:00 - 10:05)

Jordan opens MIDIcurator in Chrome. They drag their entire "Sample_Pack_Vol3" folder (50 MIDI files) onto the DropZone.

**Visual feedback**:
- DropZone highlights on drag-over
- "Uploading 50 files..." message appears
- Progress bar: "Analyzing: 12 of 50 files"

**Audio cue** (optional): Subtle beep when upload completes

**Progress bar updates every second**:
> Analyzing: 25 of 50 files...
> Analyzing: 50 of 50 files...

**Completion announcement** (via toast notification):
> "50 clips loaded. Start exploring!"

**Code Reference** (10-accessibility-plan.md, Tier 1.4):
```tsx
// MidiCurator.tsx
const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });

const handleFileUpload = async (files: File[]) => {
  setImportProgress({ current: 0, total: files.length });

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    // ... parse and import logic ...
    setImportProgress({ current: i + 1, total: files.length });
  }

  // Completion
  setImportProgress({ current: 0, total: 0 });
  showToast(`${files.length} clips loaded. Start exploring!`);
};

return (
  <>
    {importProgress.total > 0 && (
      <div className="mc-progress-bar">
        Analyzing: {importProgress.current} of {importProgress.total} files
      </div>
    )}
  </>
);
```

**Jordan's Reaction**:
> "Okay, it's doing something. I can see progress. That's already better than dragging files into GarageBand and waiting in silence."

---

#### Step 2: First Exploration (10:05 - 10:10)

Jordan sees 50 clips in sidebar, each showing:
- File name
- Detected chord (e.g., "Dm7", "Cmaj7", "Unknown")
- Note count

Jordan clicks first clip: "chord_loop_043.mid"

**StatsGrid shows**:
- BPM: 110
- Notes: 48
- Bars: 8
- Detected Chord: **Dm7**

**ChordBar shows**: Single cell with "Dm7" across all 8 bars

**PianoRoll shows**: Notes visualized (Jordan sees four-note voicing)

Jordan presses Space. Pattern plays.

**Jordan's Thought**:
> "Oh! This has a minor seventh chord. That's why it sounds 'dreamy'. I never knew what to call it before."

---

#### Step 3: Discovery — The "Minor" Pattern (10:10 - 10:15)

Jordan types "minor" into filter input (sidebar).

**Sidebar updates**: Shows 18 clips (out of 50) with "minor" in chord name or tags

Jordan clicks through 5 clips, pressing Space to play each one.

**Jordan notices**:
- "chord_loop_043.mid" → Dm7 (dreamy)
- "jazzy_progression_v2.mid" → Am7 (dreamy)
- "dark_vibes_01.mid" → Em7 (dreamy)
- "chill_loop_12.mid" → Cm7 (dark)
- "moody_pattern.mid" → Fm7 (dark)

**Jordan's Inner Monologue**:
> "Wait... they ALL have minor seventh chords. That's the common thread! I've been calling them 'dreamy' but they're actually minor seventh chords. Mind = blown."

---

#### Step 4: Tagging by Vibe (10:15 - 10:20)

Jordan selects "chord_loop_043.mid" (first dreamy loop).

Jordan clicks tag input, types "dreamy", presses Enter.

**Visual feedback**: "dreamy" tag appears below clip name

Jordan presses Down arrow to next clip ("jazzy_progression_v2.mid"), adds "dreamy" tag.

Jordan repeats for 3 more clips.

**Jordan's Thought**:
> "Now I can find my 'dreamy' loops instantly instead of clicking through 200 files."

---

#### Step 5: The Big Discovery — ii-V-I (10:20 - 10:25)

Jordan clicks "jazzy_progression_v2.mid" (which they just tagged "dreamy").

**ChordBar shows THREE cells** (auto-segmented by detectChordsPerBar):
- Bar 1-2: **Dm7**
- Bar 3-4: **G7**
- Bar 5-8: **Cmaj7**

Jordan presses Space. Pattern plays.

**Jordan's Reaction**:
> "Whoa! This one has THREE different chords, not just one. And it sounds really complete, like it resolves at the end."

Jordan clicks second "dreamy" clip: "smooth_jazz_loop.mid"

**ChordBar shows**:
- **Am7** → **D7** → **Gmaj7**

Jordan notices:
- First chord: minor seventh
- Second chord: dominant seventh (7)
- Third chord: major seventh (maj7)

**Jordan's Epiphany**:
> "They have the same PATTERN! Minor seventh, then seventh, then major seventh. Is there a name for this?"

Jordan searches Google: "minor seventh to seventh to major seventh progression"

**Google result**: "ii-V-I progression — the most common progression in jazz"

**Jordan's Reaction**:
> "OH MY GOD. I've been using this progression without knowing it! This is a ii-V-I!"

---

#### Step 6: Finding More ii-V-I Progressions (10:25 - 10:30)

Jordan filters by "Dm7" (hoping to find more ii-V-I in C major).

**Sidebar shows**: 3 clips with Dm7

Jordan clicks each one:
- Clip 1: Dm7 → G7 → Cmaj7 (classic ii-V-I) ✅
- Clip 2: Dm7 (single chord, no progression) ❌
- Clip 3: Dm7 → Am7 → G7 (different progression) ❌

**Jordan's Thought**:
> "Okay, so not all Dm7 chords are part of ii-V-I. I need to look at the full progression, not just the first chord."

Jordan creates new tag: "ii-V-I"

Jordan applies it to 3 clips with minor → dominant → major progression.

---

#### Step 7: Generating Variant (10:30 - 10:35)

Jordan likes "chord_loop_043.mid" (Dm7 chord) but it has too many notes (busy voicing).

Jordan adjusts density slider to **0.75** (sparser).

Jordan presses **V** key (generate 1 variant).

**Visual feedback**: "Generating variant..." → "chord_loop_043_d0.60.mid added to library"

Jordan presses Down arrow to select new variant.

Jordan presses Space to play.

**Jordan's Reaction**:
> "Perfect! This version is simpler. I can layer this under my drums without it sounding cluttered."

Jordan presses **D** key to download.

**File downloads**: "chord_loop_043_d0.60.mid"

---

#### Step 8: Starting Production (10:35 - 10:40)

Jordan imports "chord_loop_043_d0.60.mid" into GarageBand.

**GarageBand timeline shows**:
- MIDI region with notes
- Text marker: "Dm7" (chord label preserved via MIDI text event)

Jordan adds drums, bass, and atmospheric pad.

**Jordan's Thought**:
> "I just learned more about chord progressions in 30 minutes than I did in a year of making beats. And I finally organized my sample library. This tool is a game-changer."

---

### Resolution

Jordan successfully:
- Imported 50 MIDI files and analyzed chords automatically
- Discovered that "dreamy" loops share minor seventh chords
- Learned what a ii-V-I progression is through pattern recognition
- Tagged files with personal vocabulary ("dreamy", "ii-V-I")
- Generated sparser variant for production use
- Exported and used pattern in new track

**Jordan's Verdict** (posted to r/WeAreTheMusicMakers):
> "Just found MIDIcurator and holy sh*t. I've been making beats for 3 years and never understood chord progressions. I spent 30 minutes exploring my sample pack and suddenly everything makes sense. I know what a ii-V-I is now! And my 200 MIDI files are finally organized. If you're self-taught like me, this tool is a must-have."

**Confidence Level**: 10/10 (exceeded expectations)

---

### Key Insights

**Design Principles Demonstrated**:
1. **Progressive Disclosure** (Principle 6): Chord symbols shown first, full names available on click
2. **Curation Over Production** (Principle 1): Analysis and organization, not creation
3. **Analysis is Assistive** (Principle 2): Chord detection helped learning, didn't dictate answers

**Learning Outcomes**:
- Jordan learned music theory through exploration, not textbooks
- Jordan built mental model of harmony through pattern recognition
- Jordan connected theory ("ii-V-I") to sound ("dreamy, resolving")

**Technical Features That Enabled Discovery**:
- Batch import with automatic chord detection
- Filter by chord name or tag
- ChordBar visualization reveals progressions
- Custom tagging enables personal vocabulary
- Variant generation supports experimentation

**Impact**:
- Jordan organized 200+ file library in 30 minutes
- Jordan learned harmonic patterns incidentally (not forced)
- Jordan feels confident talking about music theory with collaborators
- Jordan's production workflow accelerated (finds samples faster)

**Related Documents**:
- [01-personas.md](01-personas.md) — Jordan (GarageBand Explorer) persona
- [04-journey-maps.md](04-journey-maps.md) — Jordan's Chord Discovery journey
- [03-problem-statements.md](03-problem-statements.md) — HMW 2.1 (Help casual users discover patterns)

---

## Scenario 3: Aisha's Library Rescue — Organizing 800 Files

### Setting

**Sunday, 2:00 PM — Aisha's home studio, Brooklyn**

Dr. Aisha Okonkwo (42, music production professor, session musician) has been putting off a digital housekeeping task for months: organizing 20 years of MIDI files scattered across three external drives. Student submissions, session sketches, transcribed solos, sample pack purchases, personal compositions — 800+ files with no coherent organization system.

Aisha's current "system":
- Folders like "Jazz/ii-V-I/Bebop/Fast" (too deep, breaks at scale)
- Spreadsheet with file names and notes (unsustainable, no playback integration)
- Many files with names like "untitled_042.mid" or "student_submission_2019_03.mid"

Aisha's colleague recommended MIDIcurator: "It's for people like us — respects your expertise, doesn't dumb things down."

### Challenge

**Aisha's Inner Monologue**:
> "I need a library system that works at scale. 800 files today, 1000 next year. I need semantic tagging, not folder hierarchies. And I need to be able to override the algorithm when it's wrong — I don't trust black box tools."

**Specific Problems**:
- Folder hierarchies don't scale (same file fits multiple categories)
- No way to search by harmonic content (e.g., "find all sus4 chords")
- Manual spreadsheet maintenance is unsustainable
- Forgot what patterns she has (duplicates, forgotten gems)

### MIDIcurator in Action

#### Step 1: Testing with Small Batch (2:00 - 2:05)

Aisha imports 20 files to test the tool.

**Observation**: Chord detection runs automatically, results appear in sidebar.

Aisha spot-checks 5 random clips:
- Clip 1: "F#dim7" detected → **Correct** ✅
- Clip 2: "Cmaj7" detected → **Correct** ✅
- Clip 3: "Bbsus4" detected → **Correct** ✅
- Clip 4: "Cdim" detected → **Incorrect**, should be "Cdim7" ❌
- Clip 5: "Unknown (0,4,7)" → **No template match** (augmented chord not in dictionary)

**Aisha's Assessment**:
> "~80% accuracy. Good enough. As long as I can override the errors, I'm satisfied."

---

#### Step 2: Overriding Incorrect Detection (2:05 - 2:10)

Aisha selects Clip 4 ("Cdim" mislabeled).

Aisha clicks chord symbol in StatsGrid, inline editor appears.

**Current text**: "Cdim"

Aisha types: "Cdim7", presses Enter.

**Visual feedback**: ChordBar updates to show "Cdim7"

**Persistence check**: Aisha switches to different clip, then returns to Clip 4.

**Result**: "Cdim7" override preserved ✅

**Aisha's Thought**:
> "Good. My correction stuck. This tool trusts me."

---

#### Step 3: Batch Import — 800 Files (2:10 - 2:20)

Aisha drags entire "MIDI_Archive_2005-2025" folder onto DropZone (800 files).

**Progress indicator**:
> "Analyzing: 100 of 800 files..."
> "Analyzing: 400 of 800 files..."
> "Analyzing: 800 of 800 files..."

**Elapsed time**: ~5 minutes (background processing, UI remains responsive)

**Completion toast**:
> "800 clips loaded. Start organizing!"

**Aisha's Reaction**:
> "Five minutes for 800 files. Not bad. And I could browse existing clips while it ran."

---

#### Step 4: Discovering Slash Chords (2:20 - 2:30)

Aisha types "slash" into filter.

**Sidebar shows**: 12 clips with slash chords (e.g., "C/E", "Dm/F", "G/B")

Aisha clicks first result: "session_sketch_2018_04.mid"

**ChordBar shows**: "C/E" (C major with E bass)

Aisha plays pattern, analyzes voicing.

**Aisha's Thought**:
> "I forgot I had this! This is an unusual voice leading example. I could use this in class."

Aisha adds tags: "slash-voicing", "class-example", "transcribe-later"

---

#### Step 5: Creating Custom Taxonomy (2:30 - 3:00)

Aisha creates semantic tag system:
- **Genre tags**: "bebop", "modal-jazz", "gospel", "neo-soul"
- **Function tags**: "turnaround", "ii-V-I", "tritone-sub", "modal-interchange"
- **Source tags**: "student-submission-2024", "session-sketch", "transcription"
- **Status tags**: "class-example", "transcribe-later", "performance-ready"

Aisha applies tags to 50 clips over 30 minutes (spot-checking as she goes).

**Example workflow**:
1. Filter by "dim" (diminished chords) → 8 results
2. Apply "bebop" tag to 3 clips with fast diminished passing chords
3. Filter by "sus4" → 6 results
4. Apply "modal-jazz" tag to 2 clips with suspended sounds

**Aisha's Thought**:
> "This is exactly what I needed. I'm building a semantic index of my archive."

---

#### Step 6: Finding Teaching Examples (3:00 - 3:15)

**Monday morning**: Aisha needs 3 examples of ii-V-I progressions for tomorrow's class.

**Old workflow** (before MIDIcurator):
- Open "Jazz" folder (200 files)
- Browse subfolders: "ii-V-I" (50 files)
- Click through 10 files, listening to each
- Manually check if they're clear examples (not cluttered)
- **Time**: ~15 minutes

**New workflow** (with MIDIcurator):
- Type "ii-V-I" into filter → 18 results
- Filter further: Add "class-example" tag → 4 results
- Spot-check 4 clips, select best 3
- Press D key to download each
- **Time**: <2 minutes

**Aisha's Reaction**:
> "I just saved 13 minutes. Multiply that by 100 times per semester and I've saved HOURS."

---

#### Step 7: Exporting with Metadata (3:15 - 3:20)

Aisha selects 3 ii-V-I examples for class.

Aisha downloads each with D key.

**Exported MIDI files include** (via MIDI text events):
- Chord labels: "Dm7", "G7", "Cmaj7"
- BPM: 120
- Source: "Generated with MIDIcurator"
- Tags: "ii-V-I", "class-example"

**Round-trip test**: Aisha imports exported file back into MIDIcurator.

**Result**: All metadata preserved ✅ (chord labels, tags, BPM)

**Aisha's Thought**:
> "Perfect. My students can open these in any DAW and see the chord labels. And if I re-import them, nothing is lost."

---

#### Step 8: Recommending to Colleagues (3:20 onwards)

**Faculty meeting, Tuesday**:

Colleague: "Aisha, how do you organize your MIDI files? I have 300 and I'm drowning."

Aisha: "I use MIDIcurator. Organized 800 files last weekend. Game-changer."

Colleague: "Does it respect your corrections? I don't trust auto-detection."

Aisha: "Yes! That's the best part. When the algorithm is wrong, I override it. My corrections stick. It's assistive, not authoritative."

Colleague: "Can I filter by chord type?"

Aisha: "Yes. I found 12 slash chords I forgot I had. And I created custom tags like 'gospel-turnaround' and 'tritone-sub'. It's semantic search, not folder hierarchies."

Colleague: "I'm trying it this weekend."

---

### Resolution

Aisha successfully:
- Imported 800 MIDI files in 5 minutes
- Organized archive with semantic tags (genre, function, source, status)
- Overrode incorrect chord detections (algorithm respected expertise)
- Discovered 12 forgotten slash chord patterns
- Found teaching examples in <2 minutes (vs. 15 minutes before)
- Exported files with metadata intact (round-trip fidelity)
- Recommended tool to colleagues (professional endorsement)

**Aisha's Verdict** (email to MIDIcurator developer):
> "I've been looking for this tool for 10 years. I organized 800 MIDI files last weekend — something I'd been putting off for months. The override feature is critical; I trust the tool to preserve my expertise. The semantic tagging replaced my broken folder hierarchy. I'm recommending this to every music educator I know. This is professional-grade."

**Confidence Level**: 10/10 (exceeds professional standards)

---

### Key Insights

**Design Principles Demonstrated**:
1. **Analysis is Assistive, Not Authoritative** (Principle 2): Aisha could override detections, corrections persisted
2. **Preserve Meaning** (Principle 5): Metadata round-trip preserved all user data
3. **Curation Over Production** (Principle 1): Tool organizes existing files, doesn't create new ones

**Productivity Gains**:
- Library organization: 800 files in 2 hours (vs. weeks of manual spreadsheet work)
- Teaching prep: Find examples in 2 minutes (vs. 15 minutes browsing folders)
- Discovery: Found 12 forgotten patterns (would never have browsed entire archive manually)

**Technical Features That Enabled Success**:
- Batch import with background processing (scaled to 800 files)
- Custom tagging with Unicode support (semantic taxonomy)
- Override persistence (IndexedDB + MIDI text events)
- Filter by chord type or tag (instant search across 800 files)
- Metadata round-trip (chord labels, tags, BPM preserved)

**Impact**:
- Aisha's archive is now navigable (semantic search replaces folder browsing)
- Aisha saves hours per semester (teaching prep accelerated)
- Aisha confident in tool (respects expertise, preserves corrections)
- Aisha advocates for tool (professional recommendation)

**Related Documents**:
- [01-personas.md](01-personas.md) — Aisha (Theory-Savvy Curator) persona
- [04-journey-maps.md](04-journey-maps.md) — Aisha's Library Organization journey
- [03-problem-statements.md](03-problem-statements.md) — HMW 3.1, 3.2 (Organize large libraries, preserve metadata)

---

## Scenario 4: Sam's Pattern Analysis — Systematic Exploration

### Setting

**Friday, 7:00 PM — Sam's apartment, Montreal**

Sam Kowalski (31, software engineer, autistic, modular synth enthusiast) has 300 MIDI files from their modular synth patch sessions. Sam wants to analyze harmonic patterns systematically: find all augmented chords, identify whole-tone scales, categorize voicing types (spread, closed, drop-2).

Sam struggles with tools that have hidden modes, unpredictable behavior, or vague error messages. Sam needs explicit state visibility and predictable interactions.

**Sam's Requirements**:
- Explicit state (no hidden modes)
- Predictable behavior (same action always produces same result)
- Transparent results (show pitch-class sets, not just chord names)
- Reversible actions (can undo segmentation, overrides)

### Challenge

**Sam's Inner Monologue**:
> "I need to know what will happen when I click something. Surprises are stressful. I want to analyze 300 files and categorize them by voicing type, but most music software is a black box. I need transparency."

**Specific Problems**:
- DAWs hide mode state (am I in arrangement view or session view?)
- Auto-detection algorithms don't show confidence scores or alternatives
- Unclear which actions are reversible (anxiety-inducing)

### MIDIcurator in Action

#### Step 1: First Interaction — Checking Explicit State (7:00 - 7:05)

Sam opens MIDIcurator, imports single test file ("augmented_chord_experiment.mid").

Sam observes interface for explicit state indicators:
- **Scissors button**: Inactive (no highlight, no border) ✅
- **Keyboard shortcuts bar**: Visible at bottom (reference always available) ✅
- **Play button**: Shows "▶" symbol (not playing) ✅
- **ChordBar**: Shows detected chord "C+" (augmented) ✅

Sam presses S key to toggle scissors mode.

**Visual feedback**:
- Scissors button: **Highlighted border** ✅
- Piano roll cursor: Changes to **crosshair** ✅
- Button aria-pressed: "true" (for screen readers) ✅

**Sam's Thought**:
> "Good. I can SEE that scissors mode is active. No ambiguity."

Sam presses S again to exit.

**Visual feedback**:
- Scissors button: **Border removed** ✅
- Cursor: Returns to **default arrow** ✅

**Sam's Assessment**:
> "Predictable toggle. Same key in and out. State is always visible. This is how all software should work."

---

#### Step 2: Finding Augmented Chords (7:05 - 7:10)

Sam imports 300 MIDI files (batch upload).

Sam types "aug" into filter.

**Sidebar shows**: 4 clips with augmented chords

Sam clicks each clip, verifies:
- Clip 1: "C+" (augmented) → **Correct** ✅
- Clip 2: "F#aug" (augmented) → **Correct** ✅
- Clip 3: "Unknown (0,4,8)" → **No template, but pitch-class set shown** ✅
- Clip 4: "Caug" (alternative spelling) → **Correct** ✅

**Sam's Thought**:
> "Only 4 augmented chords in 300 files. That's the data point I needed. And when the algorithm didn't recognize one, it showed me the pitch-class set instead of forcing a wrong answer. Transparency."

---

#### Step 3: Categorizing Voicing Types (7:10 - 7:30)

Sam creates custom tags for voicing analysis:
- "voicing-spread" (notes >octave apart)
- "voicing-closed" (notes within octave)
- "voicing-drop2" (second voice dropped octave)
- "voicing-rootless" (no root note)

Sam filters by "m7" (minor seventh chords) → 42 results

Sam analyzes first 10 clips, checking piano roll for voicing:
- Clip 1: Dm7 with notes D-F-A-C (closed) → Tag: "voicing-closed"
- Clip 2: Dm7 with notes D-A-C-F (spread) → Tag: "voicing-spread"
- Clip 3: Dm7 with notes F-A-C-D (rootless, no D in bass) → Tag: "voicing-rootless"

**Sam's Thought**:
> "This is exactly what I wanted. I'm building a systematic taxonomy of voicing types. 300 files categorized by the weekend."

---

#### Step 4: Testing Reversibility (7:30 - 7:35)

Sam tests whether actions are reversible (critical for anxiety management).

**Test 1: Segmentation Boundaries**
- Sam enters scissors mode, places boundary at bar 4
- Sam clicks boundary to remove (or presses Delete key)
- **Result**: Boundary removed ✅

**Test 2: Chord Override**
- Sam overrides "Dm7" to "Dm6" (expert knowledge)
- Sam clicks "Revert to detected" button
- **Result**: Returns to "Dm7" ✅

**Test 3: Variant Generation**
- Sam generates variant with density 0.5
- Original clip unchanged (variant is new file) ✅
- Sam deletes variant (no confirmation needed for non-original) ✅

**Sam's Assessment**:
> "All actions are reversible. I can experiment without anxiety. This is good design."

---

#### Step 5: Discovering Whole-Tone Pattern (7:35 - 7:45)

Sam filters by "Unknown" (unrecognized chords).

**Sidebar shows**: 15 clips with no template match

Sam clicks first clip: "Unknown (0,2,4,6,8,10)"

**Sam's Analysis**:
> "Pitch-class set: 0,2,4,6,8,10. That's a whole-tone scale! C-D-E-F#-G#-A#. The algorithm couldn't name it, but it gave me the data to figure it out."

Sam adds tag: "whole-tone-scale"

Sam filters remaining "Unknown" clips, finds 7 more whole-tone patterns.

**Sam's Thought**:
> "The algorithm was assistive, not authoritative. It said 'I don't know, here's the data' instead of guessing wrong. I trust that."

---

#### Step 6: Exporting Analysis (7:45 - 7:50)

Sam wants to export voicing taxonomy for blog post.

**Workaround** (no built-in export): Sam manually copies data to spreadsheet:
- "voicing-closed": 28 clips
- "voicing-spread": 15 clips
- "voicing-drop2": 9 clips
- "voicing-rootless": 6 clips

**Sam's Thought**:
> "Would be nice to export tag counts as CSV. But I can work with this."

---

### Resolution

Sam successfully:
- Imported 300 MIDI files
- Found 4 augmented chords systematically (not browsing randomly)
- Categorized 58 clips by voicing type (spread, closed, drop2, rootless)
- Discovered 8 whole-tone scale patterns (unrecognized by algorithm, transparent pitch-class sets)
- Tested reversibility (all actions undoable)
- Built custom taxonomy with precise terminology

**Sam's Verdict** (blog post: "Accessible Music Tools for Autistic Musicians"):
> "MIDIcurator is the most predictable music software I've used. State is always explicit (scissors mode button highlights), interactions are reversible (boundaries can be removed), and the algorithm is transparent (shows pitch-class sets when it doesn't know). I analyzed 300 MIDI files and never felt anxious about breaking something. This is accessibility done right."

**Confidence Level**: 9/10 (would be 10/10 with CSV export for tag counts)

---

### Key Insights

**Design Principles Demonstrated**:
1. **Explicit Over Implicit** (Principle 7): Scissors mode state always visible
2. **Analysis is Assistive, Not Authoritative** (Principle 2): Pitch-class sets shown for unrecognized chords
3. **Reversible Actions Build Trust** (Principle 8): All actions undoable

**Neurodiversity Support**:
- Explicit state reduces anxiety (no hidden modes)
- Predictable interactions build trust (same key toggles in/out)
- Transparency enables learning (pitch-class sets, not forced guesses)
- Reversibility enables experimentation (no fear of breaking things)

**Technical Features That Enabled Success**:
- Scissors mode with visible state (button highlight, cursor change)
- Pitch-class set display for unrecognized chords (transparency)
- Undo for segmentation boundaries (reversibility)
- Custom tagging with precise terminology (user-defined taxonomy)

**Impact**:
- Sam analyzed 300 files systematically (would take weeks manually)
- Sam discovered 8 whole-tone patterns (algorithmic discovery)
- Sam felt confident experimenting (no anxiety about breaking things)
- Sam advocates for accessible music tools (blog post, conference talk)

**Related Documents**:
- [01-personas.md](01-personas.md) — Sam (Neurodiverse Pattern-Seeker) persona
- [04-journey-maps.md](04-journey-maps.md) — Sam's Scissors Workflow journey
- [03-problem-statements.md](03-problem-statements.md) — HMW 1.3 (Design for neurodivergent users)

---

## Scenario 5: Marcus's Teaching Moment — Classroom Use

### Setting

**Thursday, 10:00 AM — Lincoln High School music classroom, Chicago**

Marcus Johnson (38, high school music teacher) is teaching a lesson on jazz harmony to 25 students (ages 14-18). Today's topic: ii-V-I progressions. Students have diverse backgrounds: some read notation fluently, others play by ear exclusively. Marcus needs a tool that demonstrates harmonic concepts visually without requiring notation literacy.

**Lesson plan**:
1. Play example of ii-V-I progression
2. Students identify chord changes by ear
3. Explain harmonic function (ii = preparation, V = tension, I = resolution)
4. Generate simpler variant for beginners
5. Export for homework (students remix in GarageBand)

### Challenge

**Marcus's Inner Monologue**:
> "I need to keep 25 teenagers engaged for 50 minutes. If I spend 10 minutes fumbling with software, I've lost them. And I have 3 students with ADHD in the front row — they'll tune out if I'm not visual and interactive."

**Specific Problems**:
- GarageBand piano roll doesn't show chord analysis
- Notation software requires literacy (excludes students who don't read music)
- No easy way to demonstrate harmonic function visually

### MIDIcurator in Action

#### Step 1: Pre-Class Setup (9:55 - 10:00)

Marcus opens MIDIcurator on laptop, connects to projector.

Marcus presses "Load sample progressions", selects "II-V-I in C".

**UI projected on classroom screen** (25 students can see):
- Piano roll: Notes visualized clearly
- Chord bar: Three cells labeled "Dm7", "G7", "Cmaj7"
- Stats grid: BPM 120, 8 bars, 42 notes

**Setup time**: <2 minutes

**Marcus's Thought**:
> "Good. I'm ready before the bell rings."

---

#### Step 2: Playing the Pattern (10:00 - 10:05)

**Marcus** (to class): "Listen to this progression. Close your eyes. Tell me what you hear."

Marcus presses Space.

**Pattern plays** (Dm7 → G7 → Cmaj7).

**Student callouts**:
- "Minor!" (referring to Dm7)
- "Tension!" (referring to G7)
- "Home!" (referring to Cmaj7)
- "It sounds jazzy!"

**Marcus**: "Exactly! You heard three different chords. Now watch."

Marcus plays pattern again, pointing to chord bar cells as they play.

**Marcus**: "This is called a two-five-one progression. Two, five, one. It's in thousands of jazz and pop songs."

---

#### Step 3: Explaining Harmonic Function (10:05 - 10:10)

Marcus pauses playback.

**Marcus** (pointing to chord bar cells on projector):
- "Bar 1-2: Dm7. The two chord. It prepares us for something."
- "Bar 3-4: G7. The five chord. It creates tension. It wants to resolve."
- "Bar 5-8: Cmaj7. The one chord. Home. Resolution."

**Student question**: "Why is it called two-five-one?"

**Marcus**: "Great question! In the key of C major, D minor is the second chord of the scale. G is the fifth. C is the first, or home. Two, five, one."

**Student question**: "Can we try it in a different key?"

**Marcus**: "Absolutely! Let me show you."

*(Marcus searches for transpose feature, realizes it's not exposed in UI. Workaround: Marcus uses leadsheet input to manually create G major version.)*

**Marcus** (typing in LeadsheetInput): "Am7 | D7 | Gmaj7"

**Result**: New clip generated in G major.

Marcus plays new pattern.

**Students**: "Same feeling, different notes!"

---

#### Step 4: Generating Simpler Variant (10:10 - 10:15)

**Marcus**: "This version has a lot of notes. Let me make a simpler one for beginners who want to play it on piano."

Marcus adjusts density slider to **0.5** (sparser).

Marcus presses **V** key (generate 1 variant).

**Visual feedback** (projected on screen):
- "Generating variant..."
- New clip appears: "II-V-I in C_d0.48.mid"

Marcus presses Down arrow to select variant.

Marcus presses Space to play.

**Students**: "That's easier! I could play that."

**Marcus**: "Exactly. Same chords, fewer notes."

---

#### Step 5: Exporting for Homework (10:15 - 10:20)

**Marcus**: "I'm going to give you both versions. Your homework is to import them into GarageBand and add drums."

Marcus presses **D** key to download simpler variant.

Marcus uploads file to Google Classroom.

**Marcus** (to class): "Download 'II-V-I in C_d0.48.mid' from Google Classroom. Import it into GarageBand. Add drums, bass, whatever you want. Due Monday."

**Students**: "Can we change the chords?"

**Marcus**: "Yes! Remix it. Make it yours. Just keep the two-five-one structure."

---

#### Step 6: Student Independent Work (10:20 - 10:40)

Students open GarageBand on school Chromebooks.

Students import MIDI file.

**GarageBand timeline shows**:
- MIDI region with notes
- Text marker: "Dm7" (chord label preserved)

Students add software drums, bass lines, atmospheric pads.

**Student 1** (to friend): "This actually sounds jazzy!"

**Student 2**: "I changed the BPM to 90. Makes it more chill."

**Marcus** (walking around, giving feedback): "Nice! You're already experimenting."

---

#### Step 7: Class Discussion (10:40 - 10:50)

**Marcus**: "Okay, who wants to play their remix?"

*(Three students play their versions on classroom speakers.)*

**Marcus**: "Notice how they all sound different, but they have the same harmonic structure. Two-five-one. That's the power of chord progressions."

**Student question**: "Are there other progressions?"

**Marcus**: "Hundreds! Next week: the one-four-five progression. It's in every rock and pop song."

**Bell rings**

**Students**: "Thanks, Mr. Johnson!"

---

### Resolution

Marcus successfully:
- Demonstrated ii-V-I progression visually (piano roll + chord bar)
- Students identified chord changes by ear (80%+ accuracy)
- Explained harmonic function (ii = preparation, V = tension, I = resolution)
- Generated simpler variant in <10 seconds (no workflow interruption)
- Exported files with chord labels intact (students saw labels in GarageBand)
- Students remixed patterns (successful homework integration)

**Marcus's Verdict** (staff meeting):
> "I used MIDIcurator in class this week and it was perfect. Students saw the chord progression visually, identified changes by ear, and remixed patterns for homework. Setup took 2 minutes. The variant generator let me scaffold complexity on the fly. I'm using this every week."

**Confidence Level**: 9/10 (would be 10/10 with transpose control in UI)

---

### Key Insights

**Design Principles Demonstrated**:
1. **Progressive Disclosure** (Principle 6): Simple chord symbols visible, detail available on demand
2. **Reversible Actions Build Trust** (Principle 8): Variants don't overwrite originals (students can experiment)
3. **Preserve Meaning** (Principle 5): Chord labels preserved in exported MIDI (students see them in GarageBand)

**Pedagogical Wins**:
- Visual + auditory learning (piano roll + playback)
- Scaffolded complexity (dense version → sparse version)
- Independent exploration (students remix patterns)
- Inclusive (notation literacy not required)

**Technical Features That Enabled Success**:
- Sample progressions (instant setup, no file hunting)
- Keyboard shortcuts (live demos without mouse fumbling)
- Variant generator (customize examples for different skill levels)
- Metadata export (chord labels preserved in GarageBand)

**Impact**:
- Lesson completed in 50 minutes (no overtime)
- Students engaged and confident (80%+ identified chords correctly)
- Homework integrated seamlessly (students used tool independently)
- Marcus will use tool weekly (part of curriculum)

**Related Documents**:
- [01-personas.md](01-personas.md) — Marcus (Music Educator) persona
- [04-journey-maps.md](04-journey-maps.md) — Marcus's Classroom Demo journey
- [03-problem-statements.md](03-problem-statements.md) — HMW 2.3 (Support pedagogical use cases)

---

## Cross-Scenario Themes

### Success Patterns

**What Works Across All Scenarios**:
1. **Keyboard shortcuts** enable confident workflows (Space, S, D, G, V)
2. **Chord detection** provides instant harmonic insights (80-90% accuracy)
3. **Custom tagging** replaces rigid folder hierarchies
4. **Variant generation** supports learning and scaffolding
5. **Metadata round-trip** preserves user overrides and labels

### Common Delights

**Moments That Exceeded Expectations**:
- **Riley**: "I can actually READ THE PIANO ROLL NOTES!"
- **Jordan**: "I finally understand what a ii-V-I is!"
- **Aisha**: "I found 12 slash chords I forgot I had!"
- **Sam**: "This is the most predictable music software I've used."
- **Marcus**: "Students identified chords by ear — 80% accuracy!"

### Remaining Friction Points

**What Could Still Improve**:
1. **Progress indicator** for batch imports (reduces anxiety)
2. **Transpose control** in UI (currently requires workaround)
3. **ChordBar playhead highlighting** during playback (visual reinforcement)
4. **Chord detail tooltips** (progressive disclosure)
5. **CSV export** for tag counts (systematic analysis)

---

## Related Documents

- [01-personas.md](01-personas.md) — Detailed persona profiles
- [04-journey-maps.md](04-journey-maps.md) — User journey maps
- [03-problem-statements.md](03-problem-statements.md) — HMW questions addressed
- [11-principles.md](11-principles.md) — Design principles demonstrated

---

## Revision History

- **2026-02-12**: Initial scenarios created (Phase 2 of Design Thinking foundation)
- Future: Update with real user testimonials after launch
