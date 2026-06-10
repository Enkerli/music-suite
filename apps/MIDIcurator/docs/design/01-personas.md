# User Personas

**Last updated:** 2026-02-12

## Overview

This document presents five detailed personas representing the primary user archetypes for MIDIcurator. Each persona is grounded in the #MTILT mission (Music Tech: Inclusive Learning & Teaching) and reflects diverse abilities, learning styles, and musical backgrounds.

**Personas**:
1. **The GarageBand Explorer** — Casual creator discovering patterns by ear
2. **The Theory-Savvy Curator** — Advanced musician organizing vast libraries
3. **The Accessibility-First Learner** — User with disabilities learning music tech
4. **The Neurodiverse Pattern-Seeker** — Autistic musician who thinks in systems
5. **The Music Educator** — Teacher using MIDIcurator for classroom learning

---

## Persona 1: The GarageBand Explorer

### Demographics
- **Name**: Jordan Martinez
- **Age**: 24
- **Occupation**: Content creator, part-time barista
- **Location**: Portland, Oregon
- **Musical background**: Self-taught, no formal training
- **Tech proficiency**: High (daily DAW user, YouTube tutorial learner)

### Background & Context

Jordan discovered music production through GarageBand on iPad three years ago. They make lo-fi hip-hop beats by layering loops from sample packs and adding drums. Jordan has a good ear for what sounds "groovy" but cannot explain why certain chord progressions work. They rely heavily on trial-and-error and matching loops by ear.

Jordan has collected 200+ MIDI files from free sample packs but struggles to organize them. File names like "chord_loop_043.mid" or "jazzy_progression_v2.mid" provide no meaningful information. Jordan wants to understand the patterns they love without feeling overwhelmed by music theory terminology.

### Goals & Motivations

**Primary Goals**:
- Find interesting MIDI chord progressions quickly
- Understand why certain patterns sound "groovy" or "jazzy"
- Organize sample library by vibe or feeling, not technical terms
- Learn music theory concepts through exploration, not textbooks

**Success Looks Like**:
- Discovering that a "ii-V-I" progression appears in their favorite loops
- Finding similar patterns across different sample packs
- Feeling confident saying "this is a Dorian progression" to collaborators
- Building a mental model of harmony through repeated listening

### Pain Points with Current Tools

**DAWs (GarageBand, GarageBand iOS)**:
- No automatic chord detection or analysis
- MIDI files just show piano roll with colored notes
- No way to search by harmonic content or chord type

**Sample Pack Websites**:
- Preview audio clips but no harmonic metadata
- Folder organization is arbitrary (folders like "Chill Vibes" or "Dark Moods")
- Cannot filter by chord progression type

**Music Theory Apps (Teoria, Tenuto)**:
- Disconnected from real music-making workflow
- Abstract exercises (interval training, chord spelling quizzes)
- No connection to MIDI patterns Jordan already uses

### Desired Experience with MIDIcurator

Jordan wants to:
1. **Drag-and-drop MIDI files** and see instant harmonic analysis
2. **Hear patterns play immediately** (Space bar shortcut)
3. **See chord symbols** displayed clearly without jargon
4. **Discover patterns** through visual feedback (piano roll colors, chord bar)
5. **Tag by feeling** ("dreamy", "groovy", "dark") alongside detected chords
6. **Generate variations** to explore "what if this was denser?"
7. **Learn incidentally** — notice "oh, this chord shows up in all my favorite loops!"

**Key Interaction**: Jordan drags 50 MIDI files into MIDIcurator. The tool auto-detects chords for all files in the background. Jordan types "minor" into the filter and finds 12 files. Clicks one, sees "Dm7 → Am7 → Gmaj7" in the chord bar. Jordan tags it "sad-vibes" and "ii-V-I". Now all similar progressions are findable. This feels productive and insightful.

### Accessibility Needs

**Cognitive Considerations**:
- **ADHD traits**: Short attention span for dense text, needs immediate visual feedback
- **Prefers visual learning**: Piano roll visualization more helpful than text descriptions
- **Non-linear exploration**: Jumps between clips, tries things, learns by discovery

**Design Implications**:
- Minimize text-heavy instructions
- Provide instant audio playback (Space bar)
- Use color and visual hierarchy for quick scanning
- No time pressure or forced workflows
- Allow non-destructive experimentation (undo, variants don't overwrite originals)

### Assistive Technology Used
- None (no visual, auditory, or motor impairments)
- May benefit from keyboard shortcuts for efficiency (arrow keys to navigate clips)

### Key Quotes

**About Music Theory**:
> "I want to find cool patterns without having to know what a seventh chord is."

**About Learning**:
> "I learn best by messing around and seeing what happens, not by reading explanations."

**About Organization**:
> "I have 200 MIDI files and I can't remember which ones have that 'dreamy' vibe I like."

**About Success**:
> "If I can find three chord progressions that all sound 'jazzy' and understand what they have in common, that's a win."

### Success Metrics

**Quantitative**:
- Organizes 50+ MIDI files with tags in first session (30 minutes)
- Generates 5 variants of a favorite pattern and keeps 2
- Finds chord progressions by tag/filter 80% faster than browsing folders

**Qualitative**:
- Feels confident talking about chord progressions with collaborators
- Notices harmonic patterns in other music they listen to
- Describes learning experience as "playful" and "insightful" (not "overwhelming")

**Behavioral**:
- Returns to MIDIcurator before starting new music projects (becomes part of workflow)
- Shares favorite patterns with online communities (Reddit, Discord)
- Recommends tool to other GarageBand users

---

## Persona 2: The Theory-Savvy Curator

### Demographics
- **Name**: Dr. Aisha Okonkwo
- **Age**: 42
- **Occupation**: Music production professor, session musician (piano/keys)
- **Location**: Brooklyn, New York
- **Musical background**: Berklee graduate, jazz piano, 20+ years experience
- **Tech proficiency**: Very high (Ableton Live power user, Max/MSP, command-line tools)

### Background & Context

Aisha teaches music production at a community college and performs with a jazz trio on weekends. Over two decades, she has accumulated 2,000+ MIDI files: student submissions, session sketches, transcribed solos, sample pack purchases, and personal compositions. Her current organization system is an ad-hoc folder hierarchy that no longer scales.

Aisha knows music theory deeply but wants tools that reveal unusual voicings, unexpected harmonic relationships, or pattern anomalies she might have missed. She values productivity and expects software to respect her expertise (no "dumbed down" interfaces or unhelpful wizards).

### Goals & Motivations

**Primary Goals**:
- **Organize vast MIDI library** with semantic metadata (chord quality, key, voicing)
- **Discover outliers and surprises** in her collection (unusual progressions, rare voicings)
- **Extract teaching materials** (find examples of ii-V-I for class demonstrations)
- **Accelerate session prep** (find piano comping patterns for upcoming gigs)
- **Preserve provenance** (remember which MIDI came from which student or project)

**Success Looks Like**:
- Finding all "sus4" chords across 2,000 files in 5 seconds
- Identifying three MIDI files with slash chords she forgot she had
- Exporting chord progressions with metadata intact for handouts
- Building custom tag taxonomies (e.g., "bebop", "modal", "gospel-turnaround")

### Pain Points with Current Tools

**Folder Hierarchies**:
- Folders like "Jazz/" → "ii-V-I/" → "Bebop/" → "Fast/" break down at scale
- Same file could fit multiple categories (is it "Modal" or "Dorian" or "Jazz"?)
- Renaming folders is tedious and risks breaking references

**DAWs (Ableton Live)**:
- Clip browser shows waveforms, not harmonic content
- Searching by file name is unreliable ("clip_042.mid" tells nothing)
- No batch tagging or metadata editing

**Spreadsheets / Manual Logs**:
- Aisha tried maintaining a spreadsheet with file names and chord progressions
- Keeping it updated is unsustainable
- No integration with playback or visual analysis

**Existing MIDI Analyzers**:
- Tools like "MIDI Analyzer" (web-based) detect chords but don't persist metadata
- No library management or batch processing
- Export results as CSV, but no round-trip to MIDI files

### Desired Experience with MIDIcurator

Aisha wants to:
1. **Batch import 500 files** and auto-analyze chords in background
2. **Filter by harmonic criteria** (all minor seventh chords, all slash chords)
3. **Override incorrect detections** with her expert knowledge
4. **Tag with custom taxonomies** ("bebop-line", "gospel-cadence", "student-submission-2024")
5. **Generate teaching examples** (export progressions for class handouts)
6. **Preserve metadata** when exporting (round-trip MIDI with embedded chord data)
7. **Keyboard-driven workflow** (no mouse clicking for productivity)

**Key Interaction**: Aisha drags 500 MIDI files into MIDIcurator. While cooking dinner, the tool analyzes all files. Later, she types "slash" into the filter and finds 8 files with slash chords (C/E, Dm/F, etc.). She clicks one, sees the piano roll, and notices an unusual voicing she wants to transcribe. She tags it "transcribe-later" and "slash-voicing-study". This feels like finally having a librarian for her MIDI chaos.

### Accessibility Needs

**Sensory Considerations**:
- **Mild hearing loss** (age-related, high frequencies affected)
- Relies on visual feedback (waveform displays, chord symbols, piano roll)
- Prefers adjustable playback volume and clear visual cues for playback state

**Design Implications**:
- Visual playback indicator (progress bar, highlighted chord bar cells)
- No reliance on subtle audio cues (beeps, clicks) for critical feedback
- High contrast themes for readability
- Keyboard shortcuts for all actions (reduces physical strain from mouse use)

### Assistive Technology Used
- None currently, but benefits from:
  - Large monitor (27" display for detailed piano roll work)
  - Keyboard-first workflow (reduces mouse strain after hours of editing)
  - Dark theme (reduces eye strain during late-night sessions)

### Key Quotes

**About Organization**:
> "I have 2,000 MIDI files and I can't find the one I need when I need it."

**About Expertise**:
> "I don't need the tool to teach me theory. I need it to surface patterns I didn't notice."

**About Productivity**:
> "If I have to click five times to tag a file, I won't do it. Keyboard shortcuts or bust."

**About Teaching**:
> "I need to find three examples of ii-V-I progressions for tomorrow's class. My current system is 'hope I remember which folder'."

### Success Metrics

**Quantitative**:
- Tags 500 MIDI files in 2 hours (via batch import + auto-detection + spot-checking)
- Finds teaching examples 90% faster than folder browsing
- Discovers 5+ patterns she had forgotten about ("I didn't know I had this!")

**Qualitative**:
- Describes tool as "respecting my expertise" (not dumbed-down)
- Feels confident metadata will persist (round-trip fidelity)
- Recommends to colleagues and students

**Behavioral**:
- Integrates MIDIcurator into weekly workflow (library maintenance, session prep)
- Uses exported progressions in class handouts
- Contributes feature requests or bug reports (engaged power user)

---

## Persona 3: The Accessibility-First Learner

### Demographics
- **Name**: Riley Chen
- **Age**: 19
- **Occupation**: College student (computer science major)
- **Location**: Berkeley, California
- **Musical background**: Piano lessons ages 8-12, stopped due to access barriers
- **Tech proficiency**: High (programmer, uses screen reader daily)

### Background & Context

Riley is blind and has used JAWS screen reader since age 10. They learned piano as a child but stopped lessons in middle school because notation software was inaccessible and piano teachers relied heavily on visual cues. Riley discovered coding through accessible tools (VS Code with screen reader extensions) and now wants to re-engage with music through MIDI production.

Riley tried GarageBand but found the interface frustrating (unlabeled buttons, canvas-based piano roll that screen readers ignore). They want to learn music production but need tools designed for keyboard-first, screen-reader-first interaction. Riley is tech-savvy and willing to learn keyboard shortcuts if they are well-documented and logical.

### Goals & Motivations

**Primary Goals**:
- **Learn MIDI music production** without visual barriers
- **Understand chord progressions** through auditory and textual feedback
- **Create simple compositions** independently (no sighted assistance)
- **Explore sample libraries** to find patterns that inspire them
- **Prove to themselves** that music tech can be accessible

**Success Looks Like**:
- Importing a MIDI file and hearing it play (independently, no help)
- Navigating to a specific bar and understanding which chord is playing
- Editing a chord and hearing the result immediately
- Generating a variant and comparing it to the original
- Feeling empowered, not frustrated, by music software

### Pain Points with Current Tools

**DAWs (GarageBand, Ableton Live)**:
- Piano roll is visual canvas with no ARIA labels or text alternatives
- Buttons and controls are unlabeled or use icons without alt text
- Playback state changes are silent (no "Playing" or "Paused" announcement)
- Keyboard shortcuts exist but are inconsistent or undocumented

**Music Notation Software (MuseScore)**:
- Better accessibility than DAWs (NVDA support, keyboard navigation)
- But focuses on traditional notation, not MIDI production workflow
- Riley wants to work with patterns, not full scores

**Online MIDI Tools**:
- Many use Flash or canvas without fallbacks
- No keyboard navigation or screen reader support
- Riley gave up after 10 minutes of frustration

### Desired Experience with MIDIcurator

Riley wants to:
1. **Tab through all controls** with logical focus order (sidebar → stats → transport → piano roll)
2. **Hear ARIA labels** for every button ("Play (Space)", "Scissors tool (S)")
3. **Receive live announcements** ("Playing", "Chord detected: Dm7", "Boundary placed at bar 3")
4. **Navigate piano roll with keyboard** (arrow keys to move, Enter to select)
5. **Hear note information** (aria-describedby with note list: "C4, bar 1 beat 1, velocity 80")
6. **Use all features without mouse** (range selection, scissors placement)
7. **Discover shortcuts easily** (keyboard shortcuts bar is screen-reader-accessible)

**Key Interaction**: Riley opens MIDIcurator for the first time. They press Tab, and their screen reader announces: "MIDI Curator, application. Skip to clip details, link." Riley presses Enter. Focus moves to main content. Riley presses Tab again: "Load sample progressions, button." Riley presses Enter. Screen reader announces: "30 clips loaded. II-V-I in C, clip card, button." Riley navigates to the clip, presses Space, and hears the pattern play. An ARIA live region announces: "Playing. Chord: Dm7." Riley thinks: "This actually works!"

### Accessibility Needs

**Primary Disability**: Blindness
- **Assistive Technology**: JAWS screen reader (Windows)
- **Input Method**: Keyboard only (no mouse)

**Critical Requirements**:
- **ARIA labels** on all interactive elements (buttons, inputs, custom widgets)
- **ARIA live regions** for dynamic content (playback state, chord detection)
- **Keyboard alternatives** for all mouse-only interactions
- **Text alternatives** for visual content (piano roll canvas description)
- **Focus indicators** (not visible to Riley, but ensures logical focus order)
- **Semantic HTML** (headings, landmarks) for screen reader navigation

**Secondary Needs**:
- **Documentation in plain language** (avoid jargon, define terms)
- **Keyboard shortcut reference** (accessible via screen reader)
- **Predictable interactions** (Space always plays/pauses, S always toggles scissors)

### Assistive Technology Used

**Primary**:
- **JAWS screen reader** (version 2024, Windows 11)
- **Keyboard navigation** (Tab, Shift+Tab, Arrow keys, Enter, Space)

**Secondary**:
- **Braille display** (40-cell, for reading chord symbols and note names)
- **High contrast theme** (for sighted collaborators viewing their screen)

### Key Quotes

**About Accessibility**:
> "I just want music software that works with my screen reader. Is that too much to ask?"

**About Learning**:
> "I can learn complex keyboard shortcuts if you tell me what they do. Don't hide features in visual-only menus."

**About Frustration**:
> "I tried GarageBand for 20 minutes. The piano roll was completely silent. I gave up."

**About Success**:
> "If I can import a MIDI file, hear it play, and understand the chords, that would be huge."

### Success Metrics

**Quantitative**:
- Completes onboarding workflow (import → play → identify chord) independently in <5 minutes
- Navigates to any clip using keyboard only (no mouse)
- Places segmentation boundary using keyboard (arrow keys + Enter)

**Qualitative**:
- Describes MIDIcurator as "the first music tool that actually works with my screen reader"
- Feels empowered, not frustrated, during music exploration
- Recommends to other blind musicians in online communities

**Behavioral**:
- Uses MIDIcurator weekly to explore MIDI patterns
- Creates original compositions using adapted patterns
- Advocates for accessibility in music tech spaces (blog posts, conference talks)

---

## Persona 4: The Neurodiverse Pattern-Seeker

### Demographics
- **Name**: Sam Kowalski
- **Age**: 31
- **Occupation**: Software engineer, hobbyist electronic music producer
- **Location**: Montreal, Quebec
- **Musical background**: Self-taught synthesizer player, modular synth enthusiast
- **Tech proficiency**: Very high (programmer, Linux user, command-line comfortable)
- **Neurodiversity**: Autistic (diagnosed at age 25)

### Background & Context

Sam is autistic and thinks in systems and patterns. They excel at recognizing structures in code, music, and visual design. Sam was drawn to electronic music because synthesizers have logical, predictable controls (knobs with labeled parameters, not ambiguous artistic metaphors). Sam struggles with tools that rely on implicit assumptions, hidden features, or unpredictable behavior.

Sam has collected 300+ MIDI files from modular synth patch sessions. They want to analyze harmonic patterns systematically but find most music software frustrating because states are hidden (what mode am I in?), actions are reversible without clear undo paths, and error messages are vague ("Invalid input" — what's invalid?).

### Goals & Motivations

**Primary Goals**:
- **Analyze MIDI patterns systematically** (find all files with augmented chords)
- **Understand harmonic relationships** through visual structure (piano roll grids, chord bar alignment)
- **Predict tool behavior** (if I click this, what will happen? Will it be reversible?)
- **Categorize patterns** with precise taxonomy (not vague tags like "chill vibes")
- **Build mental models** of harmony through pattern recognition

**Success Looks Like**:
- Discovering that 8 out of 300 files use whole-tone scales
- Understanding why certain chord progressions feel "resolved" (visual and harmonic patterns)
- Creating a personal taxonomy of voicing types (spread, closed, drop-2, rootless)
- Feeling confident the tool will behave predictably every time

### Pain Points with Current Tools

**DAWs (Ableton Live, FL Studio)**:
- **Hidden modes**: Am I in arrangement view or session view? What does this button do in this context?
- **Unpredictable interactions**: Right-click menus change based on context (overwhelming)
- **Vague feedback**: "Processing..." (how long? what's happening?)
- **Non-obvious undo**: Some actions are reversible, some aren't (anxiety-inducing)

**Music Theory Software**:
- **Ambiguous terminology**: "Chord quality" vs. "chord type" vs. "chord flavor" (inconsistent)
- **Implicit assumptions**: Tools assume you know what a "sus chord" is without defining it
- **No visual confirmation**: Click "Detect chord" → result appears, but was detection successful or did it fail silently?

### Desired Experience with MIDIcurator

Sam wants to:
1. **See explicit state at all times** (scissors mode active? selection range visible? playback state?)
2. **Predict interactions** (if I press S, scissors mode toggles — always, every time)
3. **Receive clear feedback** ("Chord detected: Dm7" not "Detection complete")
4. **Understand reversibility** (can I undo this? is the original clip preserved?)
5. **Use precise terminology** ("Dorian minor seventh" not "jazzy minor chord")
6. **Navigate systematically** (keyboard shortcuts in a logical grid: arrows for navigation, Space for play, S for scissors)
7. **Avoid time pressure** (no auto-save, no modal dialogs that disappear)

**Key Interaction**: Sam enters scissors mode by pressing S. The scissors button shows active state (highlighted border, aria-pressed="true"). Sam navigates the piano roll with arrow keys (cursor moves along grid). Sam presses Enter at bar 3. A live region announces: "Boundary placed at bar 3." The chord bar updates to show two segments. Sam presses S again to exit scissors mode. The button returns to inactive state. This feels predictable and reversible.

### Accessibility Needs

**Neurodiversity Considerations (Autism)**:
- **Explicit state visibility**: No hidden modes or context-dependent behavior
- **Predictable interactions**: Same action always produces same result
- **Clear feedback**: Text announcements, visual confirmation, no ambiguity
- **Low sensory load**: No flashing animations, sudden sounds, or overwhelming visual noise
- **Structured taxonomy**: Precise terminology (not metaphorical language)
- **Logical keyboard shortcuts**: Arrow keys for navigation (not arbitrary keys)

**Design Implications**:
- Show mode state visibly (scissors button highlighted when active)
- Announce state changes via ARIA live regions
- Use consistent terminology across all UI elements
- Provide undo/redo for all actions (or clearly mark non-reversible actions)
- Avoid modal dialogs with auto-dismiss (stay visible until user dismisses)
- No time-based interactions (no "click within 2 seconds" patterns)

### Assistive Technology Used
- None formally, but benefits from:
  - **Keyboard shortcuts** (reduces cognitive load from mouse hunting)
  - **High contrast themes** (reduces visual processing effort)
  - **Text-based interfaces** (predictable, scannable)

### Key Quotes

**About Predictability**:
> "I need to know what will happen when I click something. Surprises are stressful."

**About Explicit State**:
> "If there's a mode I need to be in, show me. Don't make me guess."

**About Learning**:
> "I learn by building mental models. Show me the structure, not just the surface."

**About Success**:
> "If I can analyze 300 files and find every augmented chord, that's exactly what I want."

### Success Metrics

**Quantitative**:
- Identifies all files with specific chord types (augmented, diminished, sus4) in <10 seconds
- Uses scissors tool without errors (predictable grid snapping, clear boundary placement)
- Generates variants with full understanding of what changed (explicit density parameter)

**Qualitative**:
- Describes tool as "predictable" and "transparent" (no hidden surprises)
- Feels confident using all features without anxiety
- Recommends to other autistic musicians

**Behavioral**:
- Uses MIDIcurator as primary MIDI organization tool (replaces folder hierarchies)
- Creates custom tagging taxonomies (precise, systematic)
- Contributes detailed bug reports or feature requests (engaged user)

---

## Persona 5: The Music Educator

### Demographics
- **Name**: Marcus Johnson
- **Age**: 38
- **Occupation**: High school music teacher, community workshop facilitator
- **Location**: Chicago, Illinois
- **Musical background**: Conservatory-trained composer, jazz guitarist
- **Tech proficiency**: Medium-high (uses GarageBand, Soundtrap, Noteflight in classroom)

### Background & Context

Marcus teaches music technology to high school students (ages 14-18) and runs weekend workshops for adult beginners. His students have diverse backgrounds: some read notation fluently, others have never touched an instrument. Marcus wants tools that help him demonstrate harmonic concepts visually, without requiring students to master notation first.

Marcus uses MIDI extensively in class: students analyze popular songs, compose original loops, and learn chord progressions by ear. He needs tools that work on school computers (no budget for expensive software), support collaborative learning (students gather around one screen), and provide shareable examples (export for homework).

### Goals & Motivations

**Primary Goals**:
- **Demonstrate harmonic concepts** visually (show ii-V-I progression on piano roll)
- **Support diverse learners** (visual, auditory, kinesthetic learning styles)
- **Create shareable examples** (export MIDI files with chord labels for student practice)
- **Scaffold complexity** (start with simple major chords, progress to jazz voicings)
- **Assess student understanding** (have students identify chord progressions, generate variations)

**Success Looks Like**:
- Projecting MIDIcurator on classroom screen, students identify chord changes by ear
- Students discover "oh, this pop song uses the same progression as that jazz standard!"
- Exporting 10 example progressions for homework (students remix them in GarageBand)
- Students feel confident talking about harmony (not intimidated by theory jargon)

### Pain Points with Current Tools

**DAWs (GarageBand, Soundtrap)**:
- No automatic chord detection (Marcus has to explain chords manually)
- Piano roll shows notes but doesn't highlight harmonic function
- Students get distracted by production features (mixing, effects) instead of focusing on harmony

**Notation Software (MuseScore, Noteflight)**:
- Requires notation literacy (excludes students who don't read music)
- No playback loop feature for repeated listening
- Export to MIDI loses metadata (chord labels disappear)

**Online Chord Analyzers**:
- Work for single files, not batch analysis
- No library management (students can't organize examples)
- No pedagogical features (e.g., "generate simpler version for beginners")

### Desired Experience with MIDIcurator

Marcus wants to:
1. **Project MIDIcurator on classroom screen** (large, readable fonts)
2. **Load sample progressions** (ii-V-I, I-IV-V, modal progressions) instantly
3. **Play patterns in loop mode** (students listen repeatedly, identify chords)
4. **Highlight current chord visually** (chord bar cell highlights during playback)
5. **Generate variations** (show students "what if this was denser?" or "what if we removed some notes?")
6. **Export with metadata** (MIDI files include chord labels for homework)
7. **Use keyboard shortcuts during live demos** (Space to play, arrows to navigate, G to generate)

**Key Interaction**: Marcus projects MIDIcurator on classroom screen. He presses "Load sample progressions" and selects "II-V-I in C". The piano roll shows the pattern. Marcus presses Space. The pattern plays and the chord bar highlights each chord in sequence: Dm7 (bar 1), G7 (bar 2), Cmaj7 (bar 3). Marcus asks: "What did you hear?" Students call out: "minor", "tension", "home". Marcus says: "Exactly! This is called a two-five-one. It's in thousands of jazz and pop songs." Students nod. One asks: "Can we try it in a different key?" Marcus types "transpose" and demonstrates. This feels like effective pedagogy.

### Accessibility Needs

**Classroom Considerations**:
- **Diverse learners**: Students with ADHD, dyslexia, autism, hearing loss, visual impairments
- **Group learning**: Large screen projection (font sizes 16px+)
- **Multiple modalities**: Visual (piano roll), auditory (playback), kinesthetic (students play patterns on keyboards)

**Design Implications**:
- High contrast themes for projector visibility
- Keyboard shortcuts for live demos (reduce mouse fumbling)
- Clear visual hierarchy (students sitting 10 feet away can see chord symbols)
- No reliance on color alone (colorblind students)
- Audio cues for playback state (hearing-impaired students benefit from visual cues too)

### Assistive Technology Used
- None personally, but classroom may include:
  - **Screen magnification** (low vision students)
  - **Closed captions** (if MIDIcurator had video tutorials)
  - **Keyboard-only navigation** (students with motor impairments)

### Key Quotes

**About Pedagogy**:
> "I need tools that help students see harmony, not just hear it."

**About Accessibility**:
> "My students have diverse needs. The tool has to work for everyone, not just the neurotypical kid in the front row."

**About Workflow**:
> "If I have to spend 10 minutes setting up a demo, I've lost the class. It needs to be instant."

**About Success**:
> "If students leave class saying 'I finally get what a ii-V-I is,' that's a win."

### Success Metrics

**Quantitative**:
- Demonstrates harmonic concept to 25 students in <5 minutes (quick setup)
- Exports 10 example progressions for homework in <2 minutes
- Students identify chord progressions in 3 out of 5 listening examples (assessment)

**Qualitative**:
- Students describe learning as "visual and hands-on" (not abstract)
- Students feel confident experimenting (low-stakes exploration)
- Colleagues ask for MIDIcurator demo (tool spreads to other teachers)

**Behavioral**:
- Uses MIDIcurator weekly in lesson plans (becomes part of curriculum)
- Students use MIDIcurator for independent projects (homework, compositions)
- Marcus recommends tool in professional development workshops

---

## Cross-Persona Analysis

### Shared Needs Across All Personas

1. **Instant audio playback** (Space bar) — all personas want to hear patterns quickly
2. **Visual feedback** (piano roll, chord bar) — supports diverse learning styles
3. **Keyboard shortcuts** — power users and accessibility users both benefit
4. **Undo/reversibility** — reduces anxiety, supports experimentation
5. **Plain language** (or clear terminology) — from "GarageBand Explorer" to "Educator"
6. **Local-first storage** — privacy, no account barriers
7. **Metadata persistence** — round-trip fidelity matters to curators and educators

### Divergent Needs Requiring Design Balance

**Simplicity vs. Power**:
- Jordan (Explorer) wants minimal jargon and playful discovery
- Aisha (Curator) wants precise terminology and advanced filtering
- **Design Solution**: Progressive disclosure (simple by default, advanced features discoverable)

**Visual vs. Non-Visual**:
- Jordan, Sam, Marcus rely heavily on piano roll visualization
- Riley (Accessibility-First) needs text alternatives and audio feedback
- **Design Solution**: Dual representation (visual piano roll + aria-describedby text list)

**Exploration vs. Pedagogy**:
- Jordan and Sam want to explore freely without guidance
- Marcus (Educator) wants structured examples and scaffolded complexity
- **Design Solution**: Sample progressions + custom library (both workflows supported)

### Accessibility as Shared Foundation

All personas benefit from accessibility-first design:
- **Jordan** (ADHD): Explicit state, keyboard shortcuts, no time pressure
- **Aisha** (hearing loss): Visual feedback, high contrast themes
- **Riley** (blindness): Screen reader support, keyboard navigation
- **Sam** (autism): Predictable interactions, clear feedback, explicit state
- **Marcus** (diverse classroom): Multiple modalities, high contrast, keyboard shortcuts

**Key Insight**: Designing for Riley (most constrained) makes the tool better for everyone.

---

## Related Documents

- [02-empathy-maps.md](02-empathy-maps.md) — Say/Think/Do/Feel for each persona
- [03-problem-statements.md](03-problem-statements.md) — HMW questions derived from persona pain points
- [04-journey-maps.md](04-journey-maps.md) — User journeys for each persona
- [09-accessibility-audit.md](09-accessibility-audit.md) — Detailed accessibility barriers affecting Riley and others
- [11-principles.md](11-principles.md) — Design principles informed by persona needs

---

## Revision History

- **2026-02-12**: Initial personas created (Phase 1 of Design Thinking foundation)
- Future: Validate with real users, refine based on usability testing feedback
