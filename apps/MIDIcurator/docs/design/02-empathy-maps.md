# Empathy Maps

**Last updated:** 2026-02-12

## Overview

This document provides empathy maps for each persona, capturing what they **say**, **think**, **do**, and **feel** in key scenarios. Empathy maps help us understand user emotions, motivations, and pain points beyond surface behaviors.

**Format for Each Map**:
- **Says**: Direct quotes (what users verbalize to others)
- **Thinks**: Internal thoughts, concerns, decision-making (often unspoken)
- **Does**: Observable behaviors, actions, workarounds
- **Feels**: Emotions experienced (frustration, joy, confusion, confidence)

---

## Persona 1: The GarageBand Explorer (Jordan Martinez)

### Scenario: First Time Using MIDIcurator

#### Says
- "I have no idea what a seventh chord is, but this sounds groovy."
- "How do I organize these MIDI files? The file names are useless."
- "I learn best by trying things, not reading manuals."
- "Can I filter by vibe instead of technical terms?"

#### Thinks
- *I hope this tool doesn't overwhelm me with music theory jargon.*
- *I wish I could just drag files in and see what happens.*
- *If I press this button, will it break anything?*
- *I bet the people who made this assume everyone knows theory.*
- *I recognize that sound! I've heard that chord progression before.*

#### Does
- Drags 50 MIDI files from sample pack folder into MIDIcurator
- Presses Space bar to hear pattern play immediately
- Clicks through clips rapidly, listening for "groovy" sounds
- Types "minor" into filter box to narrow results
- Tags clips with personal descriptions ("sad-vibes", "dreamy", "dark")
- Generates 5 variants of a favorite pattern, listens to all, keeps 2
- Shares screenshot of chord bar on Discord with caption "finally understanding harmony!"

#### Feels
- **Curiosity** (initial exploration)
- **Overwhelm** (if too much technical terminology appears)
- **Delight** (when discovering patterns across multiple files)
- **Confidence** (when successfully organizing 50 files in 30 minutes)
- **Insight** ("Aha!" moment when noticing ii-V-I appears in favorite loops)
- **Frustration** (if UI requires music theory knowledge to proceed)

---

### Scenario: Encountering an Unrecognized Chord

#### Says
- "Why does this say 'Unknown (0,3,7)'? What does that mean?"
- "The chord sounds cool, but I have no idea what to call it."
- "Can I just tag it 'weird-chord' and move on?"

#### Thinks
- *I'm not smart enough to understand this.*
- *Maybe music theory is just not for me.*
- *I wish the tool would explain what those numbers mean.*
- *Wait, those numbers are the piano keys? That's kind of cool.*
- *I'll come back to this later when I understand more.*

#### Does
- Hovers over "Unknown (0,3,7)" to see if there's a tooltip (none exists)
- Presses Space to hear the pattern again, focusing on the chord
- Tags the clip "unrecognized-chord" for future investigation
- Moves on to a different clip (doesn't get blocked by confusion)
- Posts question in online forum: "What does '0,3,7' mean in MIDIcurator?"

#### Feels
- **Confusion** (numbers instead of chord names)
- **Curiosity** (wants to understand, not blocked)
- **Relief** (can tag and move on, not forced to resolve immediately)
- **Mild inadequacy** (feels like they "should" know what this means)
- **Hope** (maybe the community can explain)

---

## Persona 2: The Theory-Savvy Curator (Dr. Aisha Okonkwo)

### Scenario: Organizing 500 MIDI Files

#### Says
- "I need to find all minor seventh chords across 2,000 files in 5 seconds."
- "This folder hierarchy is unsustainable. I need semantic metadata."
- "I trust my ear more than any auto-detection algorithm."
- "If the tool detected 'Cm7' but I hear 'Cm6', I need to override it."

#### Thinks
- *Finally, a tool that respects my expertise.*
- *I hope the auto-detection is accurate, but I'll verify spot-checks.*
- *If I can export with metadata intact, this will save hours of work.*
- *I wonder if the tool handles slash chords correctly.*
- *This is the librarian I've been missing for 20 years.*

#### Does
- Drags 500 MIDI files into MIDIcurator while cooking dinner
- Returns 30 minutes later to find all chords auto-detected
- Filters by "slash" to find files with bass notes (C/E, Dm/F)
- Clicks through results, listens critically, overrides 3 incorrect detections
- Tags files with precise taxonomy: "bebop-line", "gospel-turnaround", "modal-interchange"
- Exports 10 files for class handouts (metadata preserved in MIDI file)
- Adds custom tag "transcribe-later" for unusual voicings

#### Feels
- **Relief** (finally, a scalable organization system)
- **Satisfaction** (watching 500 files analyze in background)
- **Trust** (can override detections, not locked into tool's interpretation)
- **Productivity** (accomplished in 2 hours what would take days manually)
- **Surprise** (discovered 5 files she had forgotten about)
- **Professional pride** (tool respects her expertise, doesn't dumb down)

---

### Scenario: Preparing for Jazz Trio Gig

#### Says
- "I need piano comping patterns with rootless voicings."
- "Let me filter by 'rootless' tag and see what I've collected."
- "I'll use these three progressions as starting points for tonight's setlist."

#### Thinks
- *I hope I tagged these correctly six months ago.*
- *If the filter doesn't work, I'll waste 20 minutes browsing folders.*
- *I should add a tag for 'performance-ready' vs. 'sketch'.*
- *This voicing is too dense for trio setting — I'll generate a sparser variant.*

#### Does
- Opens MIDIcurator 30 minutes before rehearsal
- Types "rootless" into filter, finds 12 files
- Listens to each, selects 3 progressions
- Generates 1 variant at 0.75 density (less busy for trio context)
- Exports selected files to USB drive for rehearsal
- Tags the variant "trio-rehearsal-2026-02-12" for future reference

#### Feels
- **Urgency** (rehearsal starts soon, needs to find material quickly)
- **Confidence** (trusts her tagging system, knows she'll find what she needs)
- **Efficiency** (found perfect progressions in 10 minutes)
- **Gratitude** (past-Aisha tagged files well, present-Aisha benefits)
- **Creative readiness** (has material to bring to rehearsal, can focus on performance)

---

## Persona 3: The Accessibility-First Learner (Riley Chen)

### Scenario: First Time Using MIDIcurator with Screen Reader

#### Says (to JAWS screen reader)
- "Find heading level 1."
- "Click 'Load sample progressions' button."
- "List all buttons on this page."
- "Read current line."

#### Thinks
- *Please let this tool actually work with my screen reader.*
- *If the piano roll is silent, I'll give up like I did with GarageBand.*
- *I bet they forgot to add ARIA labels, just like every other music tool.*
- *Wait, this button is actually labeled! That's rare.*
- *I can do this. I can learn music production independently.*

#### Does
- Opens MIDIcurator, presses Tab to start keyboard navigation
- JAWS announces: "Skip to clip details, link" (skip link works!)
- Presses Tab to reach "Load sample progressions" button, presses Enter
- JAWS announces: "30 clips loaded. II-V-I in C, clip card, button."
- Navigates to clip with arrow keys, presses Enter to select
- Presses Space bar (playback starts)
- JAWS announces (via live region): "Playing. Chord: Dm7."
- Smiles (first music tool that actually announces playback state!)

#### Feels
- **Anxiety** (anticipating another frustrating experience)
- **Hope** (willing to try one more time)
- **Surprise** (skip link works! buttons are labeled!)
- **Relief** (screen reader announces playback state)
- **Empowerment** ("I did this myself, no sighted help needed")
- **Joy** (discovering a tool designed for accessibility)
- **Belonging** (finally, a music tool that includes me)

---

### Scenario: Placing a Segmentation Boundary (Keyboard-Only)

#### Says
- "Press S to enter scissors mode."
- "Navigate to bar 3 with arrow keys."
- "Press Enter to place boundary."

#### Thinks
- *I hope scissors mode has a keyboard alternative, not just mouse clicks.*
- *If this only works with a mouse, I'm stuck.*
- *Wait, the instructions say 'arrow keys + Enter' — that might work!*
- *I hope the live region announces when the boundary is placed.*
- *This is exactly what I need — predictable keyboard interactions.*

#### Does
- Presses S (scissors mode activates)
- JAWS announces: "Scissors tool active. Navigate with arrow keys, press Enter to place boundary."
- Presses right arrow 6 times (moves cursor to bar 3)
- JAWS announces position: "Cursor at bar 3, beat 1."
- Presses Enter
- JAWS announces (live region): "Boundary placed at bar 3."
- Chord bar updates (JAWS reads new chord list)
- Presses S again to exit scissors mode
- JAWS announces: "Scissors tool inactive."

#### Feels
- **Determination** (going to make this work)
- **Relief** (keyboard alternative exists!)
- **Confidence** (following clear instructions)
- **Success** (placed boundary independently)
- **Validation** ("I'm capable of using music software")
- **Gratitude** (developers thought about accessibility)
- **Advocacy** (will recommend this tool to other blind musicians)

---

## Persona 4: The Neurodiverse Pattern-Seeker (Sam Kowalski)

### Scenario: Entering Scissors Mode for the First Time

#### Says
- "I need to know if scissors mode is on or off at all times."
- "What happens if I press S right now? Will it toggle or do something unexpected?"
- "Is this action reversible? Can I remove boundaries later?"

#### Thinks
- *I need to predict what will happen before I click.*
- *If the button doesn't show active state, I'll be anxious.*
- *Hidden modes are stressful. Show me what state I'm in.*
- *If pressing S twice does different things, that's confusing.*
- *I want a clear mental model: S = toggle, always.*

#### Does
- Reads keyboard shortcuts bar: "S: Scissors tool"
- Hovers over scissors button (tooltip appears: "Scissors tool — click to place boundaries (S)")
- Presses S (button changes color, shows highlighted border)
- Notices aria-pressed attribute (if inspecting with dev tools)
- Observes cursor change in piano roll (visual confirmation)
- Presses S again (button returns to normal state)
- Tests toggle 3 times (S on, S off, S on) to confirm predictable behavior
- Reads live region announcement (if present): "Scissors tool active."

#### Feels
- **Anxiety** (before pressing S the first time)
- **Relief** (button shows active state visually)
- **Trust** (behavior is predictable and reversible)
- **Confidence** (can predict what S will do every time)
- **Calm** (explicit state reduces cognitive load)
- **Satisfaction** (tool behaves logically, respects my need for clarity)

---

### Scenario: Analyzing 300 Files for Augmented Chords

#### Says
- "I want to find every file with an augmented chord."
- "I'll type 'aug' into the filter and see what happens."
- "If the filter returns partial matches, I'll refine the query."

#### Thinks
- *I hope the filter searches chord symbols, not just file names.*
- *If it returns 0 results, I'll know my files don't have augmented chords.*
- *I'll systematically check each result to verify accuracy.*
- *This is exactly the kind of pattern analysis I love.*
- *I'm building a taxonomy of voicing types in my mind.*

#### Does
- Types "aug" into filter box
- Filter returns 8 results (all contain "aug" in chord symbol)
- Clicks through each result, listens, verifies chord quality
- Tags all 8 files with custom tag: "augmented-chords"
- Exports list of file names to spreadsheet for personal records
- Generates variant of one file to hear augmented chord in different context
- Adds tag "whole-tone-scale" to 3 files (noticed pattern)

#### Feels
- **Focus** (deeply engaged in systematic analysis)
- **Satisfaction** (finding patterns across large dataset)
- **Excitement** (discovering unexpected harmonic relationships)
- **Competence** (tool supports my analytical thinking style)
- **Flow state** (lost in pattern-seeking, time passes unnoticed)
- **Pride** (built a precise taxonomy of voicing types)

---

## Persona 5: The Music Educator (Marcus Johnson)

### Scenario: Demonstrating ii-V-I Progression to Class

#### Says (to students)
- "Listen to this progression. What do you hear?"
- "This is called a two-five-one. It's in thousands of jazz and pop songs."
- "Watch the chord bar as it plays. See how it highlights each chord?"
- "Can anyone identify the chord that sounds like 'home'?"

#### Thinks
- *I need students to see and hear the progression simultaneously.*
- *If the playback lags or the visual feedback is unclear, I'll lose them.*
- *I should loop this 3 times so everyone hears it.*
- *I hope the projector shows the chord symbols clearly (16px font minimum).*
- *I'll ask students to identify chords by ear, then reveal the labels.*

#### Does
- Projects MIDIcurator on classroom screen (laptop connected to projector)
- Presses "Load sample progressions" button
- Selects "II-V-I in C" from list
- Presses Space bar (pattern plays, chord bar highlights in sync)
- Pauses playback, asks: "What did you hear?"
- Students call out: "minor", "tension", "home"
- Marcus presses Space again, plays pattern 2 more times
- Points to chord bar on screen: "Dm7, G7, Cmaj7"
- Generates 1 variant at 0.5 density (simpler version for beginners)
- Exports both files for students to practice in GarageBand

#### Feels
- **Confidence** (tool works reliably for live demos)
- **Engagement** (students are focused and participating)
- **Effectiveness** (visual + audio reinforces learning)
- **Pride** (students understand harmonic concept in 5 minutes)
- **Gratitude** (tool supports diverse learners — visual, auditory, kinesthetic)
- **Hope** (students leave class excited about harmony, not intimidated)

---

### Scenario: Student Asks About Slash Chords

#### Says
- "Great question! A slash chord has a different bass note than the root."
- "Let me find an example in MIDIcurator."
- "See this chord? C/E means C major with E in the bass."

#### Thinks
- *I hope MIDIcurator has a file with slash chords tagged.*
- *If I have to explain without an example, it'll be abstract.*
- *I'll filter by "slash" and see if any samples exist.*
- *Perfect — this example shows the bass note clearly in the piano roll.*
- *Students will understand better seeing and hearing it simultaneously.*

#### Does
- Types "slash" into filter box (if tagged), or searches for "C/E" in chord symbols
- Finds 2 files with slash chords
- Selects one, presses Space (pattern plays)
- Points to piano roll: "See that low E? That's the bass note, not the root."
- Points to chord bar: "C/E — C major chord over E bass"
- Generates variant to show how voicing changes with different bass notes
- Exports file for student to analyze at home

#### Feels
- **Preparedness** (tool has examples ready for spontaneous questions)
- **Clarity** (can demonstrate concept visually and aurally)
- **Professionalism** (didn't have to say "I'll show you next week")
- **Satisfaction** (student "aha!" moment is visible)
- **Enthusiasm** (tool makes advanced concepts accessible)

---

## Cross-Persona Emotional Patterns

### Common Positive Emotions

**All personas experience**:
- **Relief** when the tool behaves predictably (neurodiversity-friendly)
- **Delight** when discovering unexpected patterns (learning moments)
- **Confidence** when accomplishing tasks independently (empowerment)
- **Satisfaction** when organizing/understanding large datasets (productivity)
- **Trust** when the tool respects expertise or provides overrides (agency)

### Common Negative Emotions (Current Barriers)

**All personas risk experiencing**:
- **Frustration** if accessibility barriers block core features (Riley especially)
- **Overwhelm** if UI shows too much at once without progressive disclosure (Jordan, Sam)
- **Anxiety** if actions are non-reversible or state is hidden (Sam especially)
- **Inadequacy** if tool assumes music theory knowledge (Jordan especially)
- **Distrust** if auto-detection is wrong and cannot be overridden (Aisha)

### Emotional Goals (Design Targets)

**Design should maximize**:
- **Empowerment** (users feel capable, not blocked)
- **Insight** ("Aha!" moments, pattern recognition)
- **Flow** (deep engagement without friction)
- **Belonging** (tool designed for "people like me")
- **Trust** (predictable, transparent, reversible)

**Design should minimize**:
- **Confusion** (unclear terminology, hidden state)
- **Frustration** (accessibility barriers, mouse-only interactions)
- **Anxiety** (non-reversible actions, unpredictable behavior)
- **Exclusion** (assumptions about ability, background, or knowledge)

---

## Related Documents

- [01-personas.md](01-personas.md) — Full persona details
- [03-problem-statements.md](03-problem-statements.md) — HMW questions derived from pain points
- [04-journey-maps.md](04-journey-maps.md) — User journeys showing emotional arcs
- [11-principles.md](11-principles.md) — Design principles addressing emotional needs

---

## Revision History

- **2026-02-12**: Initial empathy maps created (Phase 1 of Design Thinking foundation)
- Future: Refine based on usability testing feedback and real user interviews
