# Systems Map: MIDIcurator in the Music Creation Ecosystem

**Last updated:** 2026-02-12

## Overview

This document maps MIDIcurator's position within the broader music technology ecosystem. It identifies inputs (where MIDI files come from), processing (what MIDIcurator uniquely does), outputs (what users take away), adjacent tools (complementary software), and complementary workflows (how the tool fits into real creative processes).

**Key Insight**: MIDIcurator occupies the **curatorial layer** between sample acquisition and music production — a space currently underserved by existing tools.

---

## System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                   MUSIC CREATION ECOSYSTEM                      │
└─────────────────────────────────────────────────────────────────┘

INPUTS                    PROCESSING                   OUTPUTS
(Sources) ────────────▶  (MIDIcurator) ────────────▶  (Destinations)

Sample Libraries          Chord Detection              DAWs
  • Splice                • Auto-analysis              • Ableton Live
  • Loopcloud             • Pattern recognition        • FL Studio
  • LANDR                 • Slash chord detection      • GarageBand
  • Free packs            • Enharmonic spelling        • Logic Pro
                                                       • Reaper
User Creations           Library Curation
  • DAW exports           • Tag-based organization    Notation Software
  • MIDI transcriptions   • Filtering by harmony       • MuseScore
  • Recorded performances • Custom taxonomies          • Noteflight
  • Student submissions   • Semantic metadata          • Sibelius

Online Sources           Variant Generation           Learning Tools
  • MIDI databases        • Density control            • iReal Pro
  • BitMIDI               • Quantization variants      • ChordieApp
  • FreeMIDI.org          • Voicing exploration        • Teoria.js
  • Hooktheory            • Pattern derivation         • Music theory apps

Pedagogical Content      Accessibility Layer          Learners
  • Method books          • Screen reader support      • Students
  • Theory examples       • Keyboard-first interface   • Musicians
  • Classroom demos       • Plain language labels      • Composers
                          • Progressive disclosure     • Educators
```

---

## 1. Inputs: Where MIDI Files Come From

### 1.1 Commercial Sample Libraries

**Sources**:
- **Splice** — Subscription sample marketplace (10M+ samples, MIDI included)
- **Loopcloud** — Cloud-based sample browser with MIDI loops
- **LANDR Samples** — Curated loops and progressions
- **Producer Loops**, **Sample Magic** — Genre-specific MIDI packs

**User Pain Point**: Sample libraries provide MIDI files but no harmonic metadata. Users download 200+ MIDI patterns with generic file names (e.g., "progression_042.mid", "chord_loop_jazzy_v3.mid") and cannot filter by harmonic content.

**MIDIcurator Value**: Batch analyze all downloaded MIDI files, tag by chord type, key, and harmonic function. Users discover "I have 12 files with ii-V-I progressions and didn't even know it."

---

### 1.2 User-Created MIDI

**Sources**:
- **DAW exports** — Ableton Live, FL Studio, Logic Pro, GarageBand clips
- **MIDI transcriptions** — Users transcribe songs from audio, create MIDI reference files
- **Session sketches** — Producers save harmonic ideas during jam sessions
- **Student submissions** — Music teachers receive MIDI homework assignments

**User Pain Point**: Over time, users accumulate hundreds of MIDI fragments with no organization system. Folders like "Session Ideas 2023" or "Random Progressions" become junk drawers.

**MIDIcurator Value**: Retroactively analyze and organize years of accumulated MIDI files. Discover forgotten patterns ("I wrote this three years ago and never used it!").

---

### 1.3 Online MIDI Databases

**Sources**:
- **BitMIDI** — Free MIDI file repository (100,000+ files)
- **FreeMIDI.org** — Classical and pop MIDI transcriptions
- **MuseScore Community** — User-uploaded MIDI exports
- **Hooktheory TheoryTab** — Chord progressions from popular songs (downloadable as MIDI)

**User Pain Point**: Downloading MIDI from online repositories is a treasure hunt. Quality varies wildly. No harmonic filtering ("show me all files with diminished chords").

**MIDIcurator Value**: Import batch downloads, filter by detected harmony, keep only useful patterns. Export curated subset back to DAW.

---

### 1.4 Pedagogical and Method Book MIDI

**Sources**:
- **Music theory textbooks** — Companion MIDI files for chord examples
- **Online courses** — Coursera, Udemy, Skillshare MIDI exercises
- **Classroom handouts** — Teachers create example progressions for students

**User Pain Point**: Educational MIDI files are scattered across multiple sources (book CDs, email attachments, LMS downloads). Students lose files or forget which example demonstrated which concept.

**MIDIcurator Value**: Centralized library for all pedagogical MIDI. Students tag by lesson topic ("ii-V-I examples", "modal interchange", "slash chords").

---

## 2. Processing: What MIDIcurator Does Uniquely

### 2.1 Harmonic Analysis (Core Capability)

**Unique Capabilities**:
1. **Automatic chord detection** — 104 chord qualities including extended jazz voicings
2. **Slash chord detection** — Identifies bass note inversions (e.g., C/E, Dm/F)
3. **Enharmonic spelling** — Key-context-aware note spelling (B♯ in F♯ major, not C)
4. **Pitch-class set fallback** — Shows "Unknown (0,3,7)" when chord doesn't match templates
5. **User override persistence** — Experts can correct detections, overrides persist across sessions

**What No Other Tool Does**:
- **Captain Chords / Scaler**: Generate chords but don't analyze uploaded MIDI with slash chord detection
- **Online MIDI analyzers**: Detect chords but don't persist metadata or support user overrides
- **DAWs**: Show piano roll but no harmonic analysis (notes without meaning)

---

### 2.2 Library Curation and Organization

**Unique Capabilities**:
1. **Tag-based organization** — User-defined tags (genre, mood, harmonic function)
2. **Harmonic filtering** — Search by chord type ("all files with sus4 chords")
3. **Semantic metadata** — Chord labels, key, detected progressions stored in IndexedDB
4. **Variant families** — Group original patterns with generated variants
5. **Provenance tracking** — Remember where MIDI files came from (sample pack, student submission)

**What No Other Tool Does**:
- **File browsers / Finder**: No harmonic metadata, only file names
- **DAW clip browsers**: Show waveforms, not chord content
- **Spreadsheets**: Manual entry, no playback integration

---

### 2.3 Pattern Transformation and Learning

**Unique Capabilities**:
1. **Density variants** — Generate sparser/denser voicings (e.g., "what if this had fewer notes?")
2. **Quantization variants** — Explore rhythmic variations (straight vs. swung)
3. **Voicing shapes** — Transform between spread, closed, drop-2 voicings (future)
4. **Transposition** — Transpose progressions to different keys with correct enharmonic spelling
5. **Progressive disclosure** — Show simple chord names by default, reveal pitch-class sets on demand

**What No Other Tool Does**:
- **Music theory apps (Teoria, Tenuto)**: Abstract exercises, not applied to user's actual MIDI files
- **iReal Pro**: Generates playback from chord charts, doesn't analyze existing MIDI
- **DAWs**: Transpose MIDI but no harmonic analysis or variant generation

---

### 2.4 Accessibility-First Design

**Unique Capabilities**:
1. **Screen reader support** — Piano roll with ARIA labels, text alternatives for canvas visualizations
2. **Keyboard-first interaction** — All features accessible without mouse (Tab, Space, arrow keys)
3. **ARIA live regions** — Announce playback state, chord detection, boundary placement
4. **Plain language** — Accessible terminology, progressive disclosure of complexity
5. **High contrast themes** — Readable on projectors, low vision users

**What No Other Tool Does**:
- **All DAWs (Ableton, FL Studio, GarageBand)**: Piano roll is visual canvas, inaccessible to screen readers
- **Music notation software (MuseScore)**: Better accessibility than DAWs but focused on notation, not MIDI patterns
- **Online tools**: Flash or canvas-based, no keyboard navigation

---

## 3. Outputs: What Users Take Away

### 3.1 To DAWs (Primary Workflow)

**Format**: MIDI files with embedded metadata (text events, round-trip fidelity)

**User Workflow**:
1. User imports 50 MIDI files from sample pack into MIDIcurator
2. Auto-detection labels chords, user tags by mood ("dreamy", "tense")
3. User filters for "minor seventh chords" and finds 8 matches
4. User exports curated subset (8 files) with chord labels embedded
5. User imports 8 files into Ableton Live for production work

**Value Proposition**: Users bring organized, understood patterns into DAW. No more "which file had that progression I liked?"

**Affected Personas**:
- **Jordan** (GarageBand Explorer): Exports tagged patterns to GarageBand for beat-making
- **Aisha** (Theory-Savvy Curator): Exports curated progressions for session work

---

### 3.2 To Notation Software (Pedagogical Workflow)

**Format**: MIDI files for import into MuseScore, Noteflight, Sibelius

**User Workflow**:
1. **Marcus** (Music Educator) loads sample progressions in MIDIcurator
2. Demonstrates ii-V-I progression on classroom projector
3. Generates variants (dense, sparse, quantized)
4. Exports variants as MIDI files for students
5. Students import MIDI into MuseScore, add notation, analyze in homework

**Value Proposition**: Educators prepare teaching materials efficiently. Students receive MIDI files with harmonic context already analyzed.

**Affected Personas**:
- **Marcus** (Music Educator): Exports example progressions for class handouts
- **Jordan** (GarageBand Explorer): Exports patterns to MuseScore to learn notation

---

### 3.3 To Learning Tools (Knowledge Transfer)

**Format**: Chord progression labels, harmonic insights, pattern relationships

**User Workflow**:
1. **Jordan** discovers that 5 favorite MIDI files all use "ii-V-I" progression
2. Jordan searches YouTube: "what is a two five one progression?"
3. Jordan gains music theory understanding through pattern recognition
4. Jordan applies insight to create original progressions in DAW

**Value Proposition**: Users learn music theory concepts through their own music, not abstract exercises.

**Affected Personas**:
- **Jordan** (GarageBand Explorer): "Accidental learner" gains theory insights through exploration
- **Sam** (Neurodiverse Pattern-Seeker): Builds mental models of harmony through systematic analysis

---

### 3.4 To Learners and Collaborators (Sharing)

**Format**: Tagged MIDI libraries, curated collections, shared knowledge

**User Workflow**:
1. **Aisha** (Theory-Savvy Curator) curates 50 bebop MIDI progressions
2. Exports collection with tags ("bebop-line", "ii-V-I", "modal")
3. Shares collection with students or online communities (Reddit, Discord)
4. Recipients import into their own MIDIcurator libraries, add their own tags

**Value Proposition**: Expert knowledge becomes shareable artifact. Communities build collective MIDI libraries with semantic metadata.

**Affected Personas**:
- **Aisha** (Theory-Savvy Curator): Shares curated examples with students and colleagues
- **Marcus** (Music Educator): Distributes pedagogical MIDI libraries to classes

---

## 4. Adjacent Tools: Complementary Ecosystem

### 4.1 Digital Audio Workstations (DAWs)

**Tools**: Ableton Live, FL Studio, Logic Pro, GarageBand, Reaper, Bitwig Studio

**Relationship to MIDIcurator**: DAWs are production environments. MIDIcurator is curatorial environment.

**Complementary Strengths**:
- **DAWs excel at**: Recording, mixing, synthesis, effects, multi-track arrangement, audio rendering
- **MIDIcurator excels at**: Chord detection, harmonic analysis, library organization, pattern exploration

**Integration Points**:
- **Import**: Users export MIDI clips from DAW, analyze in MIDIcurator
- **Export**: Users import analyzed MIDI back into DAW with metadata intact
- **No Overlap**: MIDIcurator intentionally avoids DAW features (no recording, no mixing, no audio)

**User Quote** (Jordan):
> "I use MIDIcurator to understand my sample library, then GarageBand to make beats. They're different jobs."

---

### 4.2 Sample Library Platforms

**Tools**: Splice, Loopcloud, LANDR Samples, Producer Loops

**Relationship to MIDIcurator**: Sample platforms provide MIDI files. MIDIcurator organizes them.

**Complementary Strengths**:
- **Sample platforms excel at**: Discovery (browse by genre, BPM), preview audio, download management
- **MIDIcurator excels at**: Post-download organization, harmonic filtering, tagging, understanding patterns

**Integration Points**:
- **Workflow**: User downloads 50 MIDI loops from Splice → imports into MIDIcurator → filters by harmonic content → exports curated subset to DAW
- **No Direct Integration**: No API access to Splice/Loopcloud (desktop software, closed ecosystems)

**User Quote** (Aisha):
> "Splice gives me the files. MIDIcurator tells me what's in them."

---

### 4.3 Music Theory Learning Apps

**Tools**: Teoria.js, Tenuto, Complete Music Reading Trainer, ChordieApp, iReal Pro

**Relationship to MIDIcurator**: Theory apps teach concepts abstractly. MIDIcurator applies concepts to user's real music.

**Complementary Strengths**:
- **Theory apps excel at**: Structured lessons, interval ear training, chord spelling quizzes, flashcards
- **MIDIcurator excels at**: Applied learning (analyze patterns user already uses), pattern recognition, discovery-based learning

**Integration Points**:
- **Sequential Workflow**: User learns "what is a ii-V-I progression?" in theory app → discovers ii-V-I patterns in their own MIDI library in MIDIcurator → applies knowledge in DAW
- **No Technical Integration**: Separate tools, complementary pedagogical approaches

**User Quote** (Jordan):
> "Teoria taught me what a seventh chord is. MIDIcurator showed me where I've been using them all along."

---

### 4.4 Chord Generation Tools

**Tools**: Captain Chords, Scaler 2, Hooktheory, ChordPulse

**Relationship to MIDIcurator**: Generative tools create progressions. MIDIcurator analyzes existing progressions.

**Complementary Strengths**:
- **Chord generators excel at**: Suggesting progressions, MIDI keyboard input, real-time playback, DAW plugin integration
- **MIDIcurator excels at**: Analyzing uploaded MIDI, library organization, user overrides, educational focus

**Integration Points**:
- **Complementary Workflow**: User generates progression in Captain Chords → exports MIDI → imports into MIDIcurator → tags and organizes → exports to DAW
- **Overlap**: Both detect chords, but MIDIcurator focuses on uploaded files, not generation

**User Quote** (Aisha):
> "Captain Chords helps me write new progressions. MIDIcurator helps me understand and organize what I already have."

---

### 4.5 Notation Software

**Tools**: MuseScore, Noteflight, Sibelius, Finale, Dorico

**Relationship to MIDIcurator**: Notation software represents music visually as scores. MIDIcurator represents music as patterns.

**Complementary Strengths**:
- **Notation software excels at**: Traditional notation, orchestral scores, part extraction, publishing
- **MIDIcurator excels at**: Pattern-based workflows (8-32 bar loops), harmonic metadata, tag-based organization

**Integration Points**:
- **Import**: Users export MIDI from MuseScore → analyze in MIDIcurator
- **Export**: Users export MIDI from MIDIcurator → import into MuseScore for notation
- **Pedagogical Bridge**: Teachers use MIDIcurator to demonstrate harmony, students transcribe in MuseScore

**User Quote** (Marcus):
> "I use MIDIcurator to show students harmonic patterns on screen. They transcribe in MuseScore for homework."

---

### 4.6 Accessibility Tools

**Tools**: NVDA, JAWS, VoiceOver (screen readers), ZoomText (screen magnification), Dragon NaturallySpeaking (voice control)

**Relationship to MIDIcurator**: Assistive tech enables access. MIDIcurator designed for screen-reader-first interaction.

**Complementary Strengths**:
- **Assistive tech**: Reads ARIA labels, announces live regions, enables keyboard navigation
- **MIDIcurator**: Provides semantic HTML, ARIA landmarks, text alternatives for visualizations

**Integration Points**:
- **Technical**: MIDIcurator uses ARIA labels, live regions, keyboard shortcuts that screen readers consume
- **Philosophical**: Accessibility as foundation (Design Principle 4)

**User Quote** (Riley):
> "JAWS is my interface to the computer. MIDIcurator is the first music tool that actually speaks to JAWS properly."

---

## 5. Complementary Workflows: MIDIcurator in Action

### Workflow 1: The Sample Pack Organizer (Jordan's Workflow)

**Scenario**: Jordan downloads 200 MIDI files from Splice, needs to organize them.

**Steps**:
1. **Acquire**: Download "Lo-Fi Hip-Hop MIDI Pack" from Splice (200 files, $30)
2. **Import**: Drag entire folder into MIDIcurator
3. **Analyze**: MIDIcurator detects chords for all 200 files in background
4. **Explore**: Jordan plays random clips, discovers favorites
5. **Tag**: Jordan adds tags ("dreamy", "sad-vibes", "groovy") alongside auto-detected chords
6. **Filter**: Jordan types "minor" into filter, finds 45 files with minor chords
7. **Curate**: Jordan exports 20 favorite patterns to "Curated" folder
8. **Produce**: Jordan imports 20 files into GarageBand, makes beats

**Value Proposition**: Jordan transforms 200 unorganized files into a curated library in 30 minutes. Now finds patterns by vibe and harmonic content, not trial-and-error browsing.

**Tools in Ecosystem**:
- **Splice** (sample acquisition) → **MIDIcurator** (curation) → **GarageBand** (production)

---

### Workflow 2: The Session Musician Prepper (Aisha's Workflow)

**Scenario**: Aisha has a jazz gig Friday, needs to review comping patterns.

**Steps**:
1. **Library**: Aisha has 2,000 MIDI files organized in MIDIcurator (accumulated over 5 years)
2. **Filter**: Aisha types "ii-V-I" into filter, finds 32 matches
3. **Refine**: Aisha filters further: "jazz" tag + "rootless" tag, finds 8 patterns
4. **Review**: Aisha plays each pattern, reminds herself of voicing shapes
5. **Generate**: Aisha generates density variants of one pattern (sparser voicings for soft sections)
6. **Export**: Aisha exports 5 patterns to Ableton Live, creates session template
7. **Perform**: At the gig, Aisha uses patterns as comping reference

**Value Proposition**: Aisha prepares for gig in 15 minutes instead of 2 hours. Finds exactly the patterns she needs through semantic filtering.

**Tools in Ecosystem**:
- **Ableton Live** (original sessions) → **MIDIcurator** (library management) → **Ableton Live** (performance template)

---

### Workflow 3: The Music Educator's Classroom Demo (Marcus's Workflow)

**Scenario**: Marcus needs to demonstrate ii-V-I progressions to 25 high school students.

**Steps**:
1. **Prepare**: Marcus loads sample progressions in MIDIcurator (30 preloaded examples)
2. **Select**: Marcus chooses "II-V-I in C" progression
3. **Project**: Marcus projects MIDIcurator on classroom screen (via HDMI)
4. **Play**: Marcus presses Space, pattern plays in loop mode
5. **Highlight**: Chord bar highlights each chord during playback (Dm7, G7, Cmaj7)
6. **Discuss**: Marcus asks students: "What did you hear?" (call-and-response pedagogy)
7. **Variants**: Marcus generates variants (dense, sparse) to show voicing differences
8. **Export**: Marcus exports 10 example progressions for homework (students remix in GarageBand)
9. **Homework**: Students import MIDI into MuseScore, add notation, analyze chords

**Value Proposition**: Marcus demonstrates harmonic concepts visually and audibly in 5 minutes. Students receive curated MIDI files with chord labels for independent practice.

**Tools in Ecosystem**:
- **MIDIcurator** (classroom demo) → **GarageBand** (student production) → **MuseScore** (student analysis)

---

### Workflow 4: The Accessibility Pioneer (Riley's Workflow)

**Scenario**: Riley (blind, JAWS screen reader user) wants to explore MIDI patterns independently.

**Steps**:
1. **Discover**: Riley finds MIDIcurator via accessibility subreddit recommendation
2. **Navigate**: Riley uses Tab key, hears skip links ("Skip to clip details")
3. **Load**: Riley presses Enter on "Load sample progressions", hears "30 clips loaded"
4. **Select**: Riley tabs through clip cards, hears: "II-V-I in C, 42 notes, detected chord Dm7"
5. **Play**: Riley presses Space, hears pattern play, live region announces "Playing, chord: Dm7"
6. **Explore**: Riley tabs to piano roll, hears note list: "Note 1: D4, bar 1 beat 1, velocity 80"
7. **Understand**: Riley builds mental model of progression through repeated listening and text alternatives
8. **Export**: Riley exports pattern to GarageBand (via keyboard shortcuts), continues production work

**Value Proposition**: Riley uses music software independently for the first time. No sighted assistance required.

**Tools in Ecosystem**:
- **JAWS screen reader** (assistive tech) + **MIDIcurator** (accessible analysis) → **GarageBand** (production with VoiceOver support)

---

### Workflow 5: The Pattern Researcher (Sam's Workflow)

**Scenario**: Sam (autistic, systematic thinker) wants to catalog all augmented chords in their library.

**Steps**:
1. **Library**: Sam has 300 MIDI files from modular synth sessions
2. **Import**: Sam drags all files into MIDIcurator, analysis runs in background
3. **Filter**: Sam types "augmented" into chord filter
4. **Discover**: Sam finds 8 files with augmented chords (didn't know they had these)
5. **Tag**: Sam creates precise taxonomy: "aug-triad", "aug-seventh", "whole-tone"
6. **Analyze**: Sam opens each file, studies voicing patterns
7. **Mental Model**: Sam builds understanding: "Augmented chords appear in 2.7% of my library"
8. **Create**: Sam uses insights to compose new patterns in modular synth

**Value Proposition**: Sam satisfies systematic curiosity through precise filtering and taxonomy. Builds mental models of harmonic patterns.

**Tools in Ecosystem**:
- **Modular synthesizer** (creation) → **MIDIcurator** (analysis) → **Modular synthesizer** (informed creation)

---

## 6. Ecosystem Position Statement: The Curatorial Layer

### MIDIcurator's Unique Niche

**Analogy**: MIDIcurator is to MIDI files what Lightroom is to photos.

- **Adobe Lightroom**: Organize, tag, filter, batch process photos (but not Photoshop)
- **MIDIcurator**: Organize, tag, filter, analyze MIDI patterns (but not a DAW)

**The Curatorial Gap**:
- **Before production**: Users need to understand and organize patterns before using them
- **After acquisition**: Sample packs and online MIDI databases provide no organization
- **Between learning and doing**: Music theory apps teach concepts, DAWs produce music, but nothing bridges the gap

**MIDIcurator fills this gap**: The tool that helps users understand what they have before they use it.

---

### Why This Position Matters

**User Pain Point** (from all personas):
> "I have hundreds of MIDI files and I can't find the one I need when I need it."

**Existing Solutions Are Inadequate**:
- **File browsers**: Sort by name/date, no harmonic metadata
- **DAW clip browsers**: Show waveforms, no chord detection
- **Spreadsheets**: Manual entry, disconnected from playback
- **Online analyzers**: One-off analysis, no library management

**MIDIcurator's Value**: Persistent, organized, semantic understanding of MIDI libraries.

---

### Strategic Differentiation

**What MIDIcurator Is**:
- A MIDI pattern analyzer and library curator
- A learning tool that reveals harmonic insights through exploration
- An accessibility-first interface for musicians with disabilities
- A bridge between sample acquisition and music production

**What MIDIcurator Is Not**:
- A DAW (no recording, mixing, or multi-track production)
- A notation editor (no score engraving or publishing)
- A chord generator (analyzes existing patterns, doesn't create new ones)
- A plugin (standalone web app, local-first storage)

**Design Principle 1** (Curation Over Production):
> MIDIcurator prepares and explains music patterns. It does not replace DAWs or notation software.

---

## 7. Future Ecosystem Integration Opportunities

### 7.1 Direct Integration with Sample Platforms

**Opportunity**: Splice/Loopcloud API integration for automatic import and tagging.

**User Workflow**:
1. User downloads MIDI pack from Splice
2. Splice API notifies MIDIcurator of new files
3. MIDIcurator auto-imports and analyzes
4. User opens MIDIcurator, sees curated library ready

**Barriers**: Splice/Loopcloud have no public APIs, desktop software is closed-source.

**Alternative**: Browser extension or file system watcher for automatic import.

---

### 7.2 DAW Plugin Integration

**Opportunity**: Ableton Live or FL Studio plugin that embeds MIDIcurator inside DAW.

**User Workflow**:
1. User opens Ableton Live, launches MIDIcurator plugin
2. User drags MIDI clip from DAW track into MIDIcurator panel
3. MIDIcurator analyzes clip, shows chord detection
4. User exports analyzed clip back to DAW track with metadata

**Barriers**: Plugin development requires different architecture (VST/AU), conflicts with web-first design.

**Decision**: Stick with standalone web app, maintain clear separation of concerns (Design Principle 1).

---

### 7.3 Community MIDI Library Sharing

**Opportunity**: Public repository of tagged MIDI progressions (like GitHub for MIDI).

**User Workflow**:
1. Aisha curates 50 bebop progressions in MIDIcurator
2. Aisha exports library as shareable .zip file (MIDI + metadata JSON)
3. Aisha uploads to community repository (e.g., MIDIcurator Hub)
4. Other users download, import into their libraries
5. Community builds collective knowledge base

**Considerations**: Copyright (sample packs have licenses), moderation (quality control), hosting costs.

**Potential**: Aligns with #MTILT mission (inclusive learning through shared resources).

---

### 7.4 Mobile / iPadOS App

**Opportunity**: Native iOS app for iPad users (touch-optimized interface).

**User Workflow**:
1. Jordan uses MIDIcurator on iPad while commuting
2. Touch gestures for navigation (swipe between clips, pinch to zoom piano roll)
3. Export directly to GarageBand iOS via Files app integration

**Barriers**: Native app development requires Swift/SwiftUI, separate codebase from web app.

**Accessibility Win**: iPadOS has strong VoiceOver support (Design Principle 4).

**Roadmap**: Phase 4+ (after web accessibility baseline established).

---

## 8. Ecosystem Impact: What Changes When MIDIcurator Exists?

### For Producers (Jordan, Aisha)

**Before MIDIcurator**:
- 200+ MIDI files in folder hierarchies with generic names
- Trial-and-error browsing to find patterns
- Forgotten progressions buried in archives
- No harmonic metadata, only file names

**After MIDIcurator**:
- Organized library with semantic tags and chord labels
- Filter by harmonic content ("show me all sus4 chords")
- Rediscover forgotten gems through filtering
- Understand patterns before using them

---

### For Educators (Marcus)

**Before MIDIcurator**:
- Manually create example progressions for each lesson
- Demo harmony by playing piano (students without notation literacy excluded)
- Export MIDI from DAW with no metadata (students get unlabeled files)

**After MIDIcurator**:
- Load preloaded sample progressions instantly
- Project visual + auditory harmonic analysis for all learning styles
- Export MIDI with chord labels for student homework

---

### For Accessibility Users (Riley)

**Before MIDIcurator**:
- GarageBand piano roll is silent to screen readers
- Music software requires sighted assistance
- Feeling excluded from music technology

**After MIDIcurator**:
- First music tool that works with screen reader independently
- Piano roll with text alternatives (note list via aria-describedby)
- Keyboard-first workflow, ARIA live region announcements
- Feeling empowered to explore music without barriers

---

### For Systematic Learners (Sam)

**Before MIDIcurator**:
- No way to filter MIDI library by specific harmonic criteria
- Manual spreadsheet tracking (unsustainable)
- Hidden modes and implicit state in existing tools (anxiety-inducing)

**After MIDIcurator**:
- Precise filtering ("all augmented chords", "all slash chords")
- Explicit state (scissors mode visible, no surprises)
- Build mental models through systematic pattern analysis

---

## 9. Related Documents

**Personas**:
- [01-personas.md](01-personas.md) — User archetypes and their workflows

**Design Principles**:
- [11-principles.md](11-principles.md) — Principle 1 (Curation Over Production), Principle 4 (Accessibility)

**User Journeys**:
- [04-journey-maps.md](04-journey-maps.md) — Detailed workflows for each persona
- [05-scenarios.md](05-scenarios.md) — Narrative use cases showing MIDIcurator in action

**Competitive Analysis**:
- [07-competitive-analysis.md](07-competitive-analysis.md) — Benchmarking existing tools

**Stakeholder Mapping**:
- [08-stakeholders.md](08-stakeholders.md) — Primary, secondary, tertiary stakeholder groups

---

## Revision History

- **2026-02-12**: Initial systems map (Phase 3 of Design Thinking foundation)
- Future: Update based on ecosystem partnerships, API integrations, community feedback

---

**The curatorial layer has always been missing from music technology. MIDIcurator fills that gap.**
