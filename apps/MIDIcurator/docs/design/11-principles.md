# Design Principles

**Last updated:** 2026-02-12

## Overview

This document expands the core principles from [ARCHITECTURE.md](../../ARCHITECTURE.md) into actionable design guidelines. These principles inform all design decisions and connect directly to persona needs and problem statements.

**Purpose**:
- Guide feature development and UI decisions
- Resolve design trade-offs consistently
- Maintain coherent vision across contributors
- Ensure alignment with #MTILT mission (Inclusive Learning & Teaching)

**How to Use**:
- When designing a feature, check: "Does this align with our principles?"
- When facing trade-offs, ask: "Which principle takes precedence here?"
- When reviewing contributions, verify: "Does this respect our constraints?"

---

## Principle 1: Curation Over Production

**Statement**: MIDIcurator prepares and explains music patterns. It does not replace DAWs or notation software.

### Rationale

Users need tools that help them understand and organize MIDI files, not create them from scratch. MIDIcurator fills the gap between sample libraries and DAWs — a curatorial layer for harmonic analysis and library management.

### Guidelines

**Do**:
- Provide tools to analyze, organize, and understand existing MIDI files
- Support tagging, filtering, and harmonic metadata
- Generate variants by transforming existing patterns (density, quantization)
- Export organized files back to DAWs with metadata intact

**Don't**:
- Add DAW features (recording, mixing, multi-track arrangement, effects)
- Implement notation editing (that's MuseScore's job)
- Support full song timelines (focus on 8-32 bar patterns)
- Add synthesis, sampling, or audio rendering

### Decision-Making Question

> "Does this feature help users **understand or organize** music, or does it help them **make** music?"

If the answer is "make music," it's out of scope.

### Examples

**In Scope**:
- Chord detection and labeling
- Tag-based library organization
- Variant generation (density, quantization)
- Harmonic analysis (pitch-class sets, slash chords)
- Export with metadata (round-trip to DAWs)

**Out of Scope**:
- Multi-track MIDI editing
- Audio recording or rendering
- Real-time MIDI input from controllers
- Mixing, panning, reverb, or effects
- Full arrangement view (intro, verse, chorus, outro)

### Affected Personas

- **Jordan** (GarageBand Explorer): Uses MIDIcurator to organize sample packs, then imports to GarageBand for production
- **Aisha** (Theory-Savvy Curator): Uses MIDIcurator as library manager, not replacement for Ableton Live
- **Marcus** (Music Educator): Uses MIDIcurator to demonstrate harmonic concepts, students create in their DAWs

---

## Principle 2: Analysis is Assistive, Not Authoritative

**Statement**: Chord detection and analysis are suggestions, not commands. Users can always override results.

### Rationale

Algorithms make mistakes. Expert users (like Aisha) have better harmonic knowledge than any auto-detection system. Ambiguous chords have multiple valid interpretations. Users must maintain agency and trust.

### Guidelines

**Do**:
- Show pitch-class sets for unrecognized chords (e.g., "Unknown (0,3,7)")
- Provide inline override mechanism (click to edit chord label)
- Persist user overrides across sessions and exports
- Display alternatives when ambiguous ("Could be Cm7 or Cm6")
- Position tool as assistant ("Here's what I detected, but you're the expert")

**Don't**:
- Hide ambiguous results or force a single interpretation
- Make overrides difficult or hidden in submenus
- Reset user corrections on reload
- Use language like "correct chord" (implies authority)

### Decision-Making Question

> "If the algorithm is wrong, can the user fix it? Will their fix persist?"

If the answer is "no" to either, the design needs revision.

### Examples

**Good**:
- Detected chord shows "Dm7" with pencil icon (click to edit)
- User types "Dm6" and presses Enter
- Override persists in IndexedDB and exports to MIDI as text event
- Re-importing file preserves user's "Dm6" label

**Bad**:
- Auto-detection shows "Dm7" with no edit affordance
- User must delete file and re-import to change label
- Override resets to "Dm7" on page reload

### Affected Personas

- **Aisha** (Theory-Savvy Curator): Trusts her ear more than algorithms, needs override control
- **Marcus** (Music Educator): Corrects detection errors for pedagogical accuracy
- **Sam** (Neurodiverse Pattern-Seeker): Wants predictable behavior (override always persists)

---

## Principle 3: Patterns are First-Class

**Statement**: Optimize for 8-32 bar loops and pattern relationships, not full songs or multi-track arrangements.

### Rationale

MIDIcurator targets producers, educators, and learners working with short musical ideas (chord progressions, bass lines, melodic motifs). Full song editing is out of scope (DAWs handle that).

### Guidelines

**Do**:
- Optimize UI for single-track patterns (piano roll, chord bar, stats grid)
- Support variant families (original + 5 density variants grouped together)
- Enable pattern comparison (open two clips side-by-side? future feature)
- Focus on harmonic analysis (chords, voicings, progressions)

**Don't**:
- Support multi-track MIDI files with drums + bass + chords + melody (show warning, extract first track)
- Add timeline features for full song structure (intro, verse, chorus, bridge)
- Implement automation lanes or tempo changes over time

### Decision-Making Question

> "If a feature requires thinking about 'song sections' or 'multi-track arrangement,' is it in scope?"

If yes, reconsider whether it fits MIDIcurator's mission.

### Examples

**In Scope**:
- Analyzing 8-bar ii-V-I progression
- Generating 5 variants of 16-bar chord pattern
- Comparing two bass lines harmonically
- Segmenting 32-bar pattern into 4-bar phrases

**Out of Scope**:
- Editing 200-bar full song with intro, verses, choruses
- Mixing drums track with bass track
- Syncing multiple MIDI files to shared timeline

### Affected Personas

- **Jordan** (GarageBand Explorer): Works with short loops from sample packs (8-16 bars)
- **Aisha** (Theory-Savvy Curator): Organizes sketches and session ideas (mostly <32 bars)
- **Marcus** (Music Educator): Demonstrates harmonic concepts with concise examples (8-16 bars)

---

## Principle 4: Accessibility is Foundational

**Statement**: Design for keyboard-first, screen-reader-first interaction. Accessibility is not an afterthought.

### Rationale

Accessibility benefits everyone. Designing for Riley (blind, keyboard-only) makes the tool better for Sam (keyboard shortcuts), Aisha (productivity), and Marcus (projector demos). WCAG 2.1 AA compliance is the baseline, not the goal.

### Guidelines

**Do**:
- Add ARIA labels to all interactive elements (buttons, inputs, canvas)
- Provide keyboard alternatives for all mouse interactions (range selection, scissors placement)
- Use ARIA live regions for dynamic content (playback state, chord detection)
- Show visible focus indicators (2px outline, WCAG AA contrast)
- Use semantic HTML (headings, landmarks, lists)
- Test with screen readers (NVDA, JAWS, VoiceOver)
- Document keyboard shortcuts visibly in UI

**Don't**:
- Rely on hover states or tooltips alone (keyboard inaccessible)
- Use color alone to convey meaning (add icons or text)
- Create mouse-only interactions without keyboard alternatives
- Hide controls in submenus without keyboard shortcuts
- Use vague ARIA labels ("button" instead of "Play (Space)")

### Decision-Making Question

> "Can Riley (blind, keyboard-only user) complete this task independently?"

If no, the design needs accessibility remediation.

### Examples

**Good**:
- Piano roll has aria-label: "Piano roll: 42 notes spanning C3 to G5, 8 bars"
- Scissors mode toggles with S key, shows active state (aria-pressed="true")
- Play button has aria-label: "Play (Space)" and visible focus indicator
- Live region announces: "Playing. Chord: Dm7."

**Bad**:
- Piano roll canvas has no ARIA label (silent to screen readers)
- Scissors mode requires mouse click to place boundaries (no keyboard alternative)
- Play button has no focus indicator (keyboard users can't see where they are)
- Playback state changes silently (no live region announcement)

### Affected Personas

- **Riley** (Accessibility-First Learner): Requires full screen reader and keyboard support
- **Sam** (Neurodiverse Pattern-Seeker): Benefits from explicit state, keyboard shortcuts
- **Aisha** (Theory-Savvy Curator): Prefers keyboard workflow for productivity
- **Marcus** (Music Educator): Needs keyboard shortcuts for live classroom demos

### Related Documents

- [09-accessibility-audit.md](09-accessibility-audit.md) — Comprehensive WCAG 2.1 audit
- [10-accessibility-plan.md](10-accessibility-plan.md) — Remediation roadmap (Tiers 1-3)

---

## Principle 5: Preserve Meaning Before Optimizing Mechanism

**Statement**: Semantic correctness matters. Spell B♯ in F♯ major (not C). Preserve user intent even if it's less "efficient."

### Rationale

Music is a language with semantic rules. Enharmonic spelling matters for readability (B♯ in F♯ major, C♭ in D♭ major). Chord names convey harmonic function (Dm7 vs. Dm6). Rounding or simplifying destroys meaning.

### Guidelines

**Do**:
- Use key-context-aware note spelling (`spellRoot(pc, keyPc)`)
- Preserve user overrides exactly as entered (even if algorithm disagrees)
- Export metadata with full fidelity (round-trip should be lossless)
- Show pitch-class sets for unrecognized chords (don't force-fit to nearest template)
- Handle edge cases explicitly (B♯, C♭, E♯, F♭ are valid notes)

**Don't**:
- Simplify enharmonics for "efficiency" (B♯ → C destroys key context)
- Round MIDI tick values excessively (preserve timing precision)
- Quantize user input unless explicitly requested
- Force chords to fit templates when they don't (show "Unknown" instead)

### Decision-Making Question

> "If we simplify this for algorithmic convenience, do we lose semantic meaning?"

If yes, preserve meaning even if it's computationally harder.

### Examples

**Good**:
- In F♯ major, spell root as B♯ (not C) for E♯ major chord
- Preserve user override "Dm6" even if algorithm detects "Dm7"
- Export MIDI with original tick precision (480 ppq, not rounded to 16th notes)
- Show "Unknown (0,4,7)" for augmented chord if not in dictionary

**Bad**:
- Always spell chromatic notes as sharps (ignores key context)
- Reset user overrides to auto-detected values on export
- Quantize all notes to nearest 16th (destroys swing, microtiming)
- Force-fit augmented chord to "major" (closest match)

### Affected Personas

- **Aisha** (Theory-Savvy Curator): Expert knowledge requires semantic correctness
- **Marcus** (Music Educator): Teaches correct notation and enharmonic spelling
- **Sam** (Neurodiverse Pattern-Seeker): Values precision and predictability

### Related Documents

- [HARMONY_ENGINE.md](../../HARMONY_ENGINE.md) — Enharmonic spelling logic
- [chord-dictionary.ts](../../src/lib/chord-dictionary.ts) — `spellRoot()` implementation

---

## Principle 6: Progressive Disclosure (Concentric Clarity)

**Statement**: Show coarse understanding first. Reveal finer detail on demand. Simple by default, complexity discoverable.

### Rationale

Jordan (beginner) needs simple chord names ("Dm7"). Aisha (expert) needs pitch-class sets ("2,5,9,0"). Sam (systematic) needs both. Progressive disclosure serves all personas without overwhelming anyone.

### Guidelines

**Do**:
- Default view shows chord symbols (e.g., "Dm7")
- Hover or keyboard navigation reveals details ("D Dorian minor seventh, notes: D F A C")
- Unrecognized chords show pitch-class sets with explanation ("Unknown (0,3,7) = C major")
- Advanced features discoverable but not intrusive (scissors mode, leadsheet input)
- Keyboard shortcuts visible in UI (shortcuts bar at bottom)

**Don't**:
- Show all detail at once (overwhelms beginners)
- Hide essential controls in submenus (forces expert hunting)
- Require multiple clicks to access basic info (friction)
- Use jargon in default view without definitions

### Decision-Making Question

> "Can Jordan (beginner) complete basic tasks without seeing advanced features? Can Aisha (expert) access advanced features without friction?"

Both must be true.

### Examples

**Good**:
- Chord bar shows "Dm7" by default
- Clicking chord cell opens inline editor with full name ("D Dorian minor seventh")
- Scissors tool hidden until S key pressed (discoverable via shortcuts bar)
- Piano roll zoom at 100% by default, controls visible but not intrusive

**Bad**:
- Chord bar shows "D Dorian minor seventh (2,5,9,0)" by default (overwhelming)
- Advanced features only in right-click context menus (hidden from keyboard users)
- Tooltips only on hover (inaccessible to keyboard users, screen readers)

### Affected Personas

- **Jordan** (GarageBand Explorer): Needs simple default view, learns complexity progressively
- **Sam** (Neurodiverse Pattern-Seeker): Benefits from explicit detail levels (predictable)
- **Marcus** (Music Educator): Shows simple view to beginners, reveals complexity when ready

### Related Documents

- [OPEN_NOTES.md](../../OPEN_NOTES.md) — Concentric clarity philosophy
- [02-empathy-maps.md](02-empathy-maps.md) — Jordan's fear of jargon

---

## Principle 7: Explicit Over Implicit (No Hidden Modes)

**Statement**: Make state visible. Announce changes. Never rely on user memory or hidden context.

### Rationale

Sam (autistic) experiences anxiety with hidden modes. Jordan (ADHD) forgets which mode they're in. Riley (blind) cannot see visual-only mode indicators. Explicit state benefits everyone.

### Guidelines

**Do**:
- Show mode state visibly (scissors button highlighted when active)
- Use aria-pressed for toggle buttons (screen reader announces "pressed" or "not pressed")
- Announce state changes via live regions ("Scissors tool active")
- Use visual indicators (cursor change, border highlight, color change)
- Provide keyboard shortcut to exit modes (Escape exits scissors mode)
- Document mode behavior in tooltips ("S: toggle scissors mode, Esc to exit")

**Don't**:
- Use modes without visible indicators (user must remember state)
- Rely on cursor changes alone (invisible to blind users)
- Change behavior based on hidden context (e.g., same click does different things)
- Use time-based modes (auto-exit after 10 seconds is unpredictable)

### Decision-Making Question

> "If Sam switches to a different app and returns 5 minutes later, can they immediately tell what mode MIDIcurator is in?"

If no, make state more explicit.

### Examples

**Good**:
- Scissors mode: Button shows active state, cursor changes, aria-pressed="true", live region announces
- Selection range: Highlighted in piano roll, coordinates visible ("Bar 1-3 selected")
- Playback: Progress bar moves, chord bar highlights current cell, live region announces "Playing"

**Bad**:
- Scissors mode active but no visual indicator (user must remember)
- Selection range invisible (user clicks, nothing happens, confused)
- Playback state changes without announcement (screen reader silent)

### Affected Personas

- **Sam** (Neurodiverse Pattern-Seeker): Requires explicit state to avoid anxiety
- **Riley** (Accessibility-First Learner): Needs ARIA announcements for state changes
- **Jordan** (GarageBand Explorer): Benefits from visual reminders (ADHD traits)

---

## Principle 8: Reversible Actions Build Trust

**Statement**: Users should feel safe to experiment. Undo is available. Destructive actions require confirmation.

### Rationale

Sam (autistic) fears non-reversible actions. Jordan (ADHD) clicks impulsively. Marcus (educator) needs students to explore without breaking things. Reversibility reduces anxiety and enables learning.

### Guidelines

**Do**:
- Make variants non-destructive (original preserved, variants can be deleted)
- Allow segmentation boundaries to be removed (click to delete, or Delete key)
- Provide "Revert to detected" for chord overrides
- Confirm destructive actions ("Delete all clips? This cannot be undone.")
- Document reversibility explicitly ("This action can be undone")

**Don't**:
- Delete files without confirmation
- Overwrite originals when generating variants
- Make actions irreversible without warning
- Hide undo mechanisms (make them discoverable)

### Decision-Making Question

> "If Jordan accidentally clicks this button, can they undo the result?"

If no, add confirmation or make action reversible.

### Examples

**Good**:
- Generate variants creates new files (original untouched)
- Segmentation boundaries have visible X button (click to remove)
- "Clear All Clips" shows confirmation dialog with Escape to cancel
- Chord override has "Revert" button to restore auto-detected value

**Bad**:
- Delete clip immediately with no confirmation (no undo)
- Generate variants overwrites original file (destructive)
- Segmentation boundaries cannot be removed (irreversible)

### Affected Personas

- **Sam** (Neurodiverse Pattern-Seeker): Needs predictable reversibility to reduce anxiety
- **Jordan** (GarageBand Explorer): Benefits from low-stakes experimentation
- **Marcus** (Music Educator): Students need safe environment to learn

### Related Documents

- [10-accessibility-plan.md](10-accessibility-plan.md) — Tier 2.5 (Confirmation Dialogs)
- [02-empathy-maps.md](02-empathy-maps.md) — Sam's anxiety around non-reversible actions

---

## Principle Trade-Offs and Conflicts

### When Principles Conflict

**Example Conflict**: Accessibility (Principle 4) vs. Visual Simplicity (Principle 6)

**Scenario**: Adding ARIA labels makes HTML more verbose. Does this conflict with progressive disclosure?

**Resolution**: Accessibility always wins. ARIA labels don't clutter visual UI (they're invisible to sighted users). Screen reader users deserve full detail.

**Rule**: When accessibility conflicts with another principle, accessibility takes precedence.

---

**Example Conflict**: Semantic Correctness (Principle 5) vs. User Simplicity (Principle 6)

**Scenario**: Showing "D Dorian minor seventh (2,5,9,0)" is semantically correct but overwhelming for Jordan.

**Resolution**: Use progressive disclosure. Default view shows "Dm7". Hover/click reveals full name and pitch-class set.

**Rule**: Serve simple and complex simultaneously through progressive disclosure.

---

### Principle Priority Order (When Trade-Offs Required)

1. **Accessibility is Foundational** (Principle 4) — Always highest priority
2. **Analysis is Assistive, Not Authoritative** (Principle 2) — Respect user agency
3. **Preserve Meaning** (Principle 5) — Semantic correctness over convenience
4. **Reversible Actions** (Principle 8) — Safety enables learning
5. **Explicit Over Implicit** (Principle 7) — Clarity over cleverness
6. **Progressive Disclosure** (Principle 6) — Balance simplicity and power
7. **Patterns are First-Class** (Principle 3) — Focus, not feature creep
8. **Curation Over Production** (Principle 1) — Scope discipline

---

## Application Examples

### Feature: Add Real-Time MIDI Input

**Question**: Should MIDIcurator support playing MIDI keyboards to record patterns?

**Analysis**:
- Principle 1 (Curation Over Production): This is production, not curation. Out of scope.
- Principle 3 (Patterns are First-Class): Recording implies creation, not analysis. Out of scope.

**Decision**: No. Focus on analyzing existing MIDI files, not creating new ones.

---

### Feature: Add Batch Chord Override

**Question**: Should users be able to override chords for all bars at once?

**Analysis**:
- Principle 2 (Analysis is Assistive): Users should control overrides. Yes.
- Principle 4 (Accessibility): Batch operation must be keyboard-accessible. Design needed.
- Principle 8 (Reversible Actions): Batch override should have "Revert All" option. Yes.

**Decision**: Yes, with keyboard shortcut (Ctrl+Shift+O?) and "Revert All" button.

---

### Feature: Add Auto-Save

**Question**: Should MIDIcurator auto-save changes to IndexedDB?

**Analysis**:
- Principle 7 (Explicit Over Implicit): Auto-save is implicit. Users may prefer manual save.
- Principle 8 (Reversible Actions): Auto-save makes undo harder (need local history).
- Principle 4 (Accessibility): Auto-save announcements may spam screen readers.

**Decision**: No auto-save. Keep explicit "Save" action with keyboard shortcut. Or: Implement auto-save with visible indicator ("Saved 2 seconds ago") and live region announcement (debounced).

---

## Success Metrics (Alignment with Principles)

### Quantitative

- **Accessibility** (Principle 4): Lighthouse score ≥95, zero WCAG AA violations
- **Reversibility** (Principle 8): 100% of destructive actions have confirmation dialogs
- **Keyboard Access** (Principle 4): 100% of features accessible via keyboard (no mouse required)

### Qualitative

- **Trust** (Principle 2): Users override 10%+ of auto-detected chords (trust their expertise)
- **Exploration** (Principle 8): Users generate 3+ variants per pattern (feel safe experimenting)
- **Clarity** (Principle 7): Users report understanding mode state 100% of time (usability testing)

### User Feedback

- Riley: "This is the first music tool that works with my screen reader."
- Sam: "I always know what mode I'm in. No surprises."
- Aisha: "I trust the tool to preserve my overrides. It respects my expertise."
- Jordan: "I feel confident messing around. I can't break anything."

---

## Related Documents

- [ARCHITECTURE.md](../../ARCHITECTURE.md) — Original principles (shorter version)
- [01-personas.md](01-personas.md) — Persona needs informing principles
- [03-problem-statements.md](03-problem-statements.md) — HMW questions addressed by principles
- [09-accessibility-audit.md](09-accessibility-audit.md) — Accessibility principle application

---

## Revision History

- **2026-02-12**: Expanded principles from ARCHITECTURE.md (Phase 5 of Design Thinking foundation)
- Future: Update based on design decisions and user feedback
