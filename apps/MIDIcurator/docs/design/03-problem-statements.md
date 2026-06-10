# Problem Statements

**Last updated:** 2026-02-12

## Overview

This document frames design challenges as "How Might We" (HMW) questions derived from persona pain points and empathy maps. HMW questions are open-ended, actionable, and generative — they invite multiple solutions rather than prescribing specific features.

**Format**:
- **HMW Question**: Framed as opportunity, not constraint
- **Affected Personas**: Which users experience this pain point
- **Current Pain Points**: Specific problems from existing tools
- **Desired Outcomes**: What success looks like
- **Constraints**: Technical, philosophical, or accessibility considerations

---

## Problem Category 1: Accessibility & Inclusion

### HMW 1.1: Make Piano Roll Accessible to Screen Reader Users

**Affected Personas**: Riley (Accessibility-First Learner), Marcus (Educator with diverse students)

**Current Pain Points**:
- Canvas-based piano roll is completely silent to screen readers
- No text alternative or ARIA description for note information
- Blind users cannot access pitch, timing, or velocity data
- Existing DAWs treat piano roll as purely visual component

**Desired Outcomes**:
- Riley can understand what notes are present without sighted assistance
- Screen reader announces note list: "C4, bar 1 beat 1, velocity 80"
- Riley can navigate notes with keyboard (arrow keys, Enter to select)
- Piano roll summary available via aria-label: "42 notes spanning C3 to G5, 8 bars"

**Constraints**:
- Canvas is performance-optimized for rendering (cannot use DOM elements per note)
- Text list must update when clip changes or selection updates
- Large clips (500+ notes) may need pagination or "first 50 notes" summary
- Must not degrade performance for sighted users

**Related Documents**:
- [09-accessibility-audit.md](09-accessibility-audit.md) — Section 1.1 (Text Alternatives)
- [10-accessibility-plan.md](10-accessibility-plan.md) — Tier 1.3 (Piano Roll Text Alternative)

---

### HMW 1.2: Support Keyboard-Only Users for All Interactions

**Affected Personas**: Riley (keyboard-only), Sam (prefers keyboard), Aisha (productivity)

**Current Pain Points**:
- Piano roll range selection requires mouse drag (no keyboard alternative)
- Scissors boundary placement requires mouse click (no keyboard placement)
- No visible focus indicators during keyboard navigation
- Tab order not explicitly tested or managed

**Desired Outcomes**:
- All mouse interactions have keyboard equivalents (Shift+Arrow for selection, Arrow+Enter for scissors)
- Focus is always visible (2px outline, WCAG AA compliant)
- Tab order is logical (sidebar → stats → transport → piano roll)
- Keyboard users complete all tasks as efficiently as mouse users

**Constraints**:
- Keyboard shortcuts must not conflict with browser defaults (Ctrl+F, Ctrl+T)
- Arrow keys for piano roll navigation must coexist with grid-based scissors cursor
- Focus indicators must be visible in both dark and light themes

**Related Documents**:
- [09-accessibility-audit.md](09-accessibility-audit.md) — Section 2.1 (Keyboard Accessible)
- [10-accessibility-plan.md](10-accessibility-plan.md) — Tier 1.2, 1.5 (Focus Indicators, Keyboard Alternatives)

---

### HMW 1.3: Design for Neurodivergent Users (Autism, ADHD)

**Affected Personas**: Sam (autistic), Jordan (ADHD traits), students in Marcus's class

**Current Pain Points**:
- Hidden modes and implicit state cause anxiety (am I in scissors mode or not?)
- Unpredictable interactions (does this button save or preview?)
- No visual confirmation of actions (was the boundary placed?)
- Overwhelming initial UI (all features visible at once)

**Desired Outcomes**:
- Explicit state visibility (scissors button shows active state, aria-pressed="true")
- Predictable interactions (S always toggles scissors mode, every time)
- Clear feedback (live regions announce "Boundary placed at bar 3")
- Progressive disclosure (simple tasks obvious, advanced tasks discoverable)

**Constraints**:
- Explicit state must not clutter UI for neurotypical users
- Live region announcements must not spam screen reader users
- Visual feedback must be perceivable in both themes (high contrast)

**Related Documents**:
- [01-personas.md](01-personas.md) — Sam (Neurodiverse Pattern-Seeker)
- [11-principles.md](11-principles.md) — Principle 7 (Explicit Over Implicit)

---

## Problem Category 2: Learning & Discovery

### HMW 2.1: Help Casual Users Discover Harmonic Patterns Without Theory Knowledge

**Affected Personas**: Jordan (GarageBand Explorer), students in Marcus's class

**Current Pain Points**:
- MIDI files named "chord_loop_043.mid" provide no harmonic information
- DAWs show notes but don't explain harmonic function
- Music theory apps use abstract terminology ("dominant seventh") without real-world examples
- Users cannot predict which loops will sound good together (same key, compatible chords?)

**Desired Outcomes**:
- Jordan imports 50 MIDI files and sees instant harmonic analysis (auto-detected chords)
- Chord symbols appear in plain language ("Dm7" not "D Dorian minor seventh")
- Visual feedback highlights harmonic relationships (chord bar shows progression over time)
- Jordan notices patterns ("oh, these three files all use ii-V-I!")
- Tagging by harmonic content makes loops findable ("show me all minor seventh chords")

**Constraints**:
- Auto-detection must be fast (< 100ms per file) for 50-file batch imports
- Terminology must balance simplicity (for Jordan) and precision (for Aisha)
- Visual design must not overwhelm users with too much information at once

**Related Documents**:
- [01-personas.md](01-personas.md) — Jordan (GarageBand Explorer)
- [11-principles.md](11-principles.md) — Principle 6 (Progressive Disclosure)

---

### HMW 2.2: Reveal Finer Detail Progressively (Concentric Clarity)

**Affected Personas**: Jordan (beginner), Sam (systematic learner), Marcus (scaffolded pedagogy)

**Current Pain Points**:
- Tools either hide complexity entirely (over-simplified) or show everything at once (overwhelming)
- Beginners need simple chord names ("Dm7"), advanced users want pitch-class sets ("0,3,7")
- No way to toggle between coarse and fine detail

**Desired Outcomes**:
- Default view shows chord symbols (e.g., "Dm7")
- Hover or click reveals finer detail (e.g., "D Dorian minor seventh, notes: D F A C")
- Unrecognized chords show pitch-class sets ("Unknown (0,3,7)") with explanation
- Marcus can show simple view to beginners, then reveal complexity when ready
- Jordan learns progressively without feeling overwhelmed

**Constraints**:
- Tooltips must be keyboard-accessible (not just hover)
- Screen readers must announce detail level (aria-expanded for progressive disclosure)
- Default view must satisfy 80% of use cases (don't force users to dig for basic info)

**Related Documents**:
- [ARCHITECTURE.md](../../ARCHITECTURE.md) — Section on "Concentric Clarity"
- [OPEN_NOTES.md](../../OPEN_NOTES.md) — Transparency and explicit state

---

### HMW 2.3: Support Pedagogical Use Cases (Classroom, Workshops)

**Affected Personas**: Marcus (Music Educator)

**Current Pain Points**:
- DAWs are too complex for 50-minute class sessions
- Cannot demonstrate harmonic concepts visually without extensive setup
- Export formats lose metadata (chord labels disappear when students open files)
- No "beginner-friendly" version of patterns (all samples are production-ready, dense)

**Desired Outcomes**:
- Marcus projects MIDIcurator on classroom screen, loads sample progression in <10 seconds
- Chord bar highlights in sync with playback (students see and hear simultaneously)
- Marcus generates simpler variant (0.5 density) for beginners
- Exports files with metadata intact (students see chord labels in their DAWs)
- Students use MIDIcurator independently for homework (intuitive enough for self-guided learning)

**Constraints**:
- Projector visibility requires large fonts (16px+) and high contrast
- Classroom computers may have old browsers (must support modern but not bleeding-edge features)
- Export metadata must use standard MIDI text events (compatible with major DAWs)

**Related Documents**:
- [01-personas.md](01-personas.md) — Marcus (Music Educator)
- [METADATA_MIDI.md](../../METADATA_MIDI.md) — Round-trip fidelity scheme

---

## Problem Category 3: Organization & Productivity

### HMW 3.1: Organize Large MIDI Libraries Without Rigid Hierarchies

**Affected Personas**: Aisha (Theory-Savvy Curator), Jordan (growing library)

**Current Pain Points**:
- Folder hierarchies break down at scale (200+ files)
- Same file fits multiple categories (is "Dorian_loop.mid" in "Modal/" or "Jazz/"?)
- Renaming files or folders is tedious and error-prone
- No way to filter by harmonic content (e.g., "show me all suspended chords")

**Desired Outcomes**:
- Aisha imports 500 files, auto-analysis runs in background
- Tag-based organization replaces folders (files can have multiple tags)
- Filter by harmonic criteria ("sus4", "slash chords", "minor seventh")
- Search combines file name, tags, and detected chords
- Tag taxonomies are custom (Aisha creates "bebop-line", "gospel-turnaround")

**Constraints**:
- IndexedDB storage must scale to 2,000+ files without performance degradation
- Filters must return results instantly (<100ms for 2,000-file library)
- Tags must support Unicode (Japanese, Arabic, emoji characters)

**Related Documents**:
- [01-personas.md](01-personas.md) — Aisha (Theory-Savvy Curator)
- [11-principles.md](11-principles.md) — Principle 1 (Curation Over Production)

---

### HMW 3.2: Preserve Provenance and Metadata Round-Trip

**Affected Personas**: Aisha (provenance matters), Marcus (export for students)

**Current Pain Points**:
- Exported MIDI files lose metadata (chord labels, tags, source attribution)
- Variant relationships are invisible (which file is a variant of which?)
- No way to trace "where did this MIDI come from?" after batch import

**Desired Outcomes**:
- Exported MIDI includes chord labels as text events (readable in other DAWs)
- Variant metadata embeds in file ("variant of original.mid, density 0.75")
- Re-importing exported file preserves tags, chord overrides, segmentation
- Provenance visible in UI ("imported 2025-01-15", "variant of clip_042")

**Constraints**:
- Metadata must use standard MIDI text events (compatible with GarageBand, Ableton)
- File size increase must be minimal (<5% for typical 8-bar pattern)
- Round-trip must preserve user overrides (not just auto-detected chords)

**Related Documents**:
- [METADATA_MIDI.md](../../METADATA_MIDI.md) — Text event scheme
- [11-principles.md](11-principles.md) — Principle 5 (Preserve Meaning)

---

### HMW 3.3: Make Variant Generation Transparent and Useful

**Affected Personas**: Jordan (exploration), Aisha (finding inspiration), Marcus (creating teaching examples)

**Current Pain Points**:
- "Generate 5 variants" is a black box (what changed? why these 5?)
- Variants may sound worse than original (algorithm doesn't match user taste)
- No way to specify "make this simpler" vs. "make this denser"
- Variant files clutter library (cannot tell variant from original)

**Desired Outcomes**:
- Density slider provides explicit control (0.5 = sparser, 1.5 = denser)
- Variant metadata clearly labels relationship ("variant of original, density 0.75")
- Preview variants before committing to library (generate → listen → keep or delete)
- Variants group visually (original + 5 variants shown together)
- Marcus generates 0.5 density variant for beginner students (explicit, predictable)

**Constraints**:
- Transform algorithm must preserve harmonic skeleton (chord progression stays same)
- Generated files must be named distinctively (e.g., "original_d0.75.mid")
- Variants must not overwrite originals (non-destructive)

**Related Documents**:
- [ARCHITECTURE.md](../../ARCHITECTURE.md) — Transform layer
- [01-personas.md](01-personas.md) — Jordan, Aisha use cases

---

## Problem Category 4: Trust & Transparency

### HMW 4.1: Make Chord Detection Results Trustworthy But Overridable

**Affected Personas**: Aisha (expert), Marcus (pedagogical accuracy)

**Current Pain Points**:
- Auto-detection algorithms make mistakes (Cm7 detected as Cm6)
- Users cannot override or correct results
- No confidence score or alternative interpretations shown
- "Black box" detection feels authoritative, not assistive

**Desired Outcomes**:
- Chord detection shows pitch-class sets for unrecognized chords (transparency)
- Aisha can override detected chord with her expert knowledge
- Override persists across sessions (not reset on reload)
- Ambiguous chords show alternatives ("Could be Cm7 or Cm6")
- Tool positions itself as assistant, not authority

**Constraints**:
- Override UI must be discoverable but not intrusive (inline edit, keyboard shortcut)
- Overrides must persist in IndexedDB and export to MIDI (round-trip fidelity)
- Detection confidence must not clutter UI (progressive disclosure)

**Related Documents**:
- [11-principles.md](11-principles.md) — Principle 2 (Analysis is Assistive, Not Authoritative)
- [HARMONY_ENGINE.md](../../HARMONY_ENGINE.md) — Chord detection algorithm

---

### HMW 4.2: Reduce Anxiety Through Reversible Actions

**Affected Personas**: Sam (anxiety around non-reversible actions), Jordan (experimentation)

**Current Pain Points**:
- Destructive actions (delete clip, clear all) have no confirmation
- No undo history for segmentation or chord overrides
- Users fear "breaking" their library (anxiety blocks experimentation)

**Desired Outcomes**:
- All destructive actions require confirmation ("Delete all clips? This cannot be undone.")
- Segmentation boundaries are removable (click to delete, or Delete key)
- Chord overrides can be reset to auto-detected value ("Revert to detected")
- Variants don't overwrite originals (safe to generate and discard)
- Users feel confident experimenting ("I can always undo this")

**Constraints**:
- Confirmation dialogs must be keyboard-accessible (Enter to confirm, Escape to cancel)
- Undo history must not consume excessive storage (limit to last 10 actions?)
- Reversibility must be explicit in UI ("This action can be undone")

**Related Documents**:
- [11-principles.md](11-principles.md) — Principle 8 (Reversible Actions Build Trust)
- [10-accessibility-plan.md](10-accessibility-plan.md) — Tier 2.5 (Confirmation Dialogs)

---

## Problem Category 5: Performance & Usability

### HMW 5.1: Handle Large Batch Imports Without Blocking UI

**Affected Personas**: Aisha (500-file imports), Jordan (50-file imports)

**Current Pain Points**:
- Synchronous chord detection blocks UI (app freezes during import)
- No progress indicator for background analysis
- Users unsure if import succeeded or failed (silence)

**Desired Outcomes**:
- Batch import runs in background (Web Worker or async iteration)
- Progress bar shows "Analyzing: 42 of 500 files"
- UI remains responsive during analysis (can browse existing clips)
- Live region announces completion ("500 files analyzed")

**Constraints**:
- Web Workers cannot access IndexedDB directly (must message main thread)
- Progress updates must not spam screen readers (debounce to every 10 files)
- Background analysis must not degrade playback performance

**Related Documents**:
- [10-accessibility-plan.md](10-accessibility-plan.md) — Tier 1.4 (ARIA Live Regions)

---

### HMW 5.2: Support iPadOS and Touch Interactions

**Affected Personas**: Jordan (iPad user), Marcus (classroom iPad carts)

**Current Pain Points**:
- Touch events broken on iPadOS (documented in OPEN_NOTES.md)
- Piano roll selection doesn't work with finger drag
- Scissors mode requires precise tap (difficult on small touch targets)

**Desired Outcomes**:
- Touch events work identically to mouse events (drag to select, tap to place)
- Touch targets meet iOS Human Interface Guidelines (44×44px minimum)
- Multi-touch gestures support (pinch to zoom piano roll?)
- No accidental scrolling during piano roll interaction

**Constraints**:
- Touch events must coexist with mouse events (desktop users)
- `touchAction: 'none'` prevents browser gestures (may block accessibility features)
- iPad Safari has unique quirks (test on real device)

**Related Documents**:
- [OPEN_NOTES.md](../../OPEN_NOTES.md) — iPadOS touch handling bug
- [10-accessibility-plan.md](10-accessibility-plan.md) — Tier 2.1 (Fix iPadOS Touch Handling)

---

## Summary: Design Priorities

### Top 5 HMWs (Based on Persona Impact)

1. **HMW 1.1**: Make piano roll accessible to screen readers (blocks Riley entirely)
2. **HMW 1.2**: Support keyboard-only users for all interactions (blocks Riley, affects Sam and Aisha)
3. **HMW 2.1**: Help casual users discover patterns without theory knowledge (core value for Jordan)
4. **HMW 3.1**: Organize large libraries without rigid hierarchies (core value for Aisha)
5. **HMW 1.3**: Design for neurodivergent users (affects Sam, Jordan, Marcus's students)

### Cross-Cutting Themes

**Accessibility is Foundational**:
- HMW 1.1, 1.2, 1.3 address different disability contexts
- Solutions benefit all personas (keyboard shortcuts, explicit state, progressive disclosure)

**Progressive Disclosure**:
- HMW 2.2 (concentric clarity) supports Jordan (beginner) and Aisha (expert)
- Solutions enable pedagogical use (Marcus shows simple first, reveals complexity later)

**Trust Through Transparency**:
- HMW 4.1 (overridable detection), HMW 4.2 (reversible actions)
- Solutions reduce anxiety (Sam), respect expertise (Aisha), enable experimentation (Jordan)

---

## Related Documents

- [01-personas.md](01-personas.md) — User personas and pain points
- [02-empathy-maps.md](02-empathy-maps.md) — Emotional context for problems
- [04-journey-maps.md](04-journey-maps.md) — User journeys showing where problems occur
- [11-principles.md](11-principles.md) — Design principles that address these HMWs

---

## Revision History

- **2026-02-12**: Initial problem statements created (Phase 1 of Design Thinking foundation)
- Future: Refine based on usability testing and feature prioritization
