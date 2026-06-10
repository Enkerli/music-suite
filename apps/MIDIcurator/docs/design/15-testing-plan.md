# Usability Testing Plan

**Last updated:** 2026-02-12

## Overview

This document outlines the usability testing protocol for MIDIcurator, aligned with personas, journey maps, and accessibility requirements. Testing validates design decisions, identifies barriers, and measures success metrics.

**Testing Philosophy**: Test with real users representing all five personas, prioritizing accessibility-first learners (Riley, Sam) to ensure inclusive design.

---

## Test Objectives

### Primary Objectives

1. **Validate Personas**: Confirm Riley, Sam, Jordan, Aisha, and Marcus represent real user needs
2. **Identify Barriers**: Discover accessibility issues beyond WCAG audit
3. **Measure Onboarding**: Time to first successful pattern playback
4. **Assess Discoverability**: Can users find features without documentation?
5. **Evaluate Learnability**: Does tool teach music theory incidentally (Jordan's goal)?

### Success Criteria

**Quantitative**:
- Task completion rate: 80%+ for core workflows
- Time to first playback: <5 minutes (no prior experience)
- SUS (System Usability Scale) score: >70 (good usability)
- Zero WCAG A violations (Lighthouse audit)

**Qualitative**:
- Users describe tool as "respectful of my expertise" (Aisha)
- Users describe tool as "first music software that works with my screen reader" (Riley)
- Users report learning moments ("I finally understand ii-V-I progressions!" — Jordan)

---

## Test Participants

### Recruitment Matrix

| Persona | Target Count | Recruitment Source | Must-Have Traits |
|---------|--------------|-------------------|------------------|
| **Riley** (Accessibility-First) | 2-3 | Blind musicians forum, NFB mailing list | JAWS/NVDA user, keyboard-only, MIDI interest |
| **Sam** (Neurodiverse) | 2-3 | Autism music groups, Reddit r/autism | Autistic, systematic thinker, keyboard-first preference |
| **Jordan** (Explorer) | 3-4 | Music producer forums, r/WeAreTheMusicMakers | Self-taught, GarageBand user, no theory training |
| **Aisha** (Curator) | 1-2 | Music educators mailing list, Berklee alumni | 500+ MIDI files, keyboard-first workflow, expert knowledge |
| **Marcus** (Educator) | 1-2 | High school music teachers, community workshop leaders | Teaches 14-18 year olds, uses tech in classroom |

**Total**: 10-15 participants

**Compensation**: $50 gift card per 60-minute session (or equivalent)

---

## Test Scenarios

### Scenario 1: First Pattern Playback (All Personas)

**Goal**: User imports or loads a MIDI pattern and hears it play within 5 minutes.

**Steps**:
1. Open MIDIcurator (no instructions provided)
2. Load sample progressions OR import own file
3. Select a clip
4. Play it (Space bar or button)

**Success Metrics**:
- Time to first playback: <5 minutes
- Requires help: No (self-guided)
- Frustration moments: 0-1 ("I wish there was a 'Get Started' button")

**Persona-Specific Observations**:
- **Riley**: Can complete with screen reader? No mouse required?
- **Sam**: Clear state indicators? No hidden modes?
- **Jordan**: Feels intuitive? No jargon overload?

---

### Scenario 2: Chord Discovery (Jordan, Marcus)

**Goal**: User discovers what a "ii-V-I" progression is through pattern recognition.

**Steps**:
1. Load sample progressions (30 files)
2. Filter by "minor" or browse clips
3. Play 3 different clips with ii-V-I progressions
4. Notice commonality (minor seventh → dominant seventh → major seventh)

**Success Metrics**:
- Recognizes pattern: 80%+ participants
- Can articulate pattern: "They all go minor → tension → home"
- Learning moment: "Oh, that's what a ii-V-I is!"

**Questions to Ask**:
- "What do these three patterns have in common?"
- "How would you describe this progression to a friend?"
- "Did you learn anything new about music harmony?"

---

### Scenario 3: Segmentation (Sam, Aisha)

**Goal**: User segments a 16-bar pattern into 4-bar phrases using scissors tool.

**Steps**:
1. Import or select a 16-bar MIDI file
2. Activate scissors mode (S key or button)
3. Place boundaries at bar 4, 8, 12
4. Review segmented chord progression

**Success Metrics**:
- Completes segmentation: 80%+ (keyboard users)
- Understands scissors mode: "I know when it's active"
- Time to complete: <2 minutes

**Persona-Specific Observations**:
- **Sam**: Explicit state visible? Predictable behavior?
- **Riley**: Keyboard alternative works? Live region announces state?
- **Aisha**: Efficient workflow? No mouse required?

---

### Scenario 4: Library Organization (Aisha, Jordan)

**Goal**: User imports 50 files, applies custom tags, filters by harmonic criteria.

**Steps**:
1. Drag 50 MIDI files onto dropzone
2. Wait for chord detection (observe progress feedback)
3. Filter by "dim" (diminished chords)
4. Apply custom tag "transcribe-later" to 3 results
5. Filter by custom tag

**Success Metrics**:
- Batch import completes: 100%
- Custom tagging works: 100%
- Time to organize 50 files: <10 minutes

**Persona-Specific Observations**:
- **Aisha**: Respects expert knowledge? Override works? Metadata persists?
- **Jordan**: Filters discoverable? Tags make sense?

---

### Scenario 5: Classroom Demo (Marcus)

**Goal**: Educator demonstrates ii-V-I progression to students, generates simpler variant.

**Steps**:
1. Load "II-V-I in C" from sample progressions
2. Play pattern (Space bar)
3. Adjust density slider to 0.5
4. Generate 1 variant (V key)
5. Play variant, compare to original
6. Export for student homework (D key)

**Success Metrics**:
- Setup time: <2 minutes
- Keyboard shortcuts work: 100%
- Export includes metadata: Yes (chord labels preserved)

**Persona-Specific Observations**:
- **Marcus**: Visible on projector? UI readable from 10 feet? Workflow efficient?

---

## Test Method

### Remote Moderated Sessions

**Platform**: Zoom (screen sharing + audio)

**Duration**: 60 minutes per participant

**Structure**:
1. **Intro** (5 min): Explain study, get consent, ask background questions
2. **Task 1-3** (30 min): Observe participant attempting scenarios (think-aloud protocol)
3. **Task 4-5** (15 min): Advanced scenarios (if time permits)
4. **Debrief** (10 min): SUS questionnaire, open feedback, follow-up questions

### Think-Aloud Protocol

**Instructions to Participants**:
> "As you use the tool, please say out loud what you're thinking, what you're trying to do, and any confusion you experience. There are no wrong answers — we want to understand your thought process."

**Moderator Role**:
- Observe silently (don't guide unless stuck for >2 minutes)
- Take notes on: frustration moments, success moments, unexpected behaviors
- Ask follow-up: "Why did you click that?" "What were you expecting to happen?"

### Screen Reader Sessions (Riley Persona)

**Special Considerations**:
- Request screen reader audio capture (NVDA speech output)
- Allow extra time (90 minutes instead of 60)
- Focus on keyboard navigation and announcements
- Ask: "What did your screen reader say? Was that helpful?"

---

## Data Collection

### Quantitative Metrics

**Task Performance**:
- Task completion rate (success/fail)
- Time on task (minutes:seconds)
- Number of errors (clicks on wrong element, backtracks)
- Help requests (participant asks "How do I...?")

**System Usability Scale (SUS)**:
- 10-question standardized questionnaire
- Scored 0-100 (>70 = good, >80 = excellent)

**Accessibility Metrics**:
- Lighthouse accessibility score (0-100)
- WCAG violations count (A, AA, AAA)
- Keyboard-only task completion rate

### Qualitative Data

**Observations**:
- Frustration moments (verbal cues: "I don't understand", sighs, confusion)
- Success moments (verbal cues: "Oh!", "That's cool", confidence)
- Unexpected behaviors (participant uses feature in novel way)

**Interview Questions**:
- "What did you like most about the tool?"
- "What frustrated you the most?"
- "Did you learn anything new about music harmony?"
- "Would you recommend this to a friend?" (Net Promoter Score)

**Persona-Specific Questions**:
- **Riley**: "How does this compare to other music software you've tried?"
- **Sam**: "Did you always know what mode you were in? Any surprises?"
- **Jordan**: "Do you feel more confident talking about chord progressions now?"
- **Aisha**: "Does this tool respect your expertise? Can you override detections?"
- **Marcus**: "Would you use this in your classroom? Why or why not?"

---

## Analysis Plan

### Thematic Analysis

**Process**:
1. Transcribe session recordings (audio + screen capture)
2. Code observations (tag: frustration, success, unexpected, accessibility-barrier)
3. Group codes into themes ("Hidden modes cause anxiety", "Chord bar is intuitive")
4. Map themes to personas and journey maps

**Outputs**:
- Prioritized issue list (blockers, usability improvements, enhancements)
- Updated personas (validate assumptions, refine pain points)
- Journey map updates (identify new stages, refine emotions)

### Quantitative Analysis

**Task Success Rates**:
- Calculate % completion per scenario
- Identify scenarios with <80% success (redesign needed)

**Time on Task**:
- Calculate mean and median time per scenario
- Outliers indicate confusion or exceptional efficiency

**SUS Score**:
- Calculate overall SUS score (aggregate 10-15 participants)
- Segment by persona (Riley vs. Jordan may have different scores)

---

## Reporting

### Deliverables

**1. Executive Summary** (2 pages)
- Key findings (top 5 issues, top 3 successes)
- Recommendations (prioritized by impact and effort)
- Success metrics (SUS score, task completion, WCAG violations)

**2. Detailed Report** (15-20 pages)
- Methodology
- Participant demographics
- Scenario-by-scenario results
- Persona validation
- Issue prioritization matrix

**3. Video Highlights** (5-10 minutes)
- Clips of success moments (Jordan's "aha!" moment)
- Clips of frustration (Riley can't access piano roll)
- Clips of unexpected behaviors

**4. Updated Design Artifacts**
- Revised personas (01-personas.md updates)
- Revised journey maps (04-journey-maps.md updates)
- New accessibility issues (09-accessibility-audit.md additions)

---

## Iteration Cycles

### Cycle 1: Test-Fix-Retest (Accessibility Focus)

**Timeline**: 4 weeks

**Steps**:
1. **Week 1**: Test with Riley and Sam (2 participants each)
2. **Week 2**: Implement Tier 1 accessibility fixes (focus indicators, ARIA labels, keyboard alternatives)
3. **Week 3**: Retest with Riley and Sam (same participants or new)
4. **Week 4**: Analyze improvements, update documentation

**Exit Criteria**: 80%+ task completion for Riley and Sam, zero WCAG A violations

### Cycle 2: Test-Fix-Retest (Onboarding Focus)

**Timeline**: 4 weeks

**Steps**:
1. **Week 1**: Test with Jordan (3-4 participants)
2. **Week 2**: Implement onboarding improvements (sample progressions, tooltips, inline help)
3. **Week 3**: Retest with Jordan (new participants)
4. **Week 4**: Measure learning outcomes, update journey maps

**Exit Criteria**: Time to first playback <5 minutes, 80%+ report learning moment

### Cycle 3: Test-Fix-Retest (Advanced Features)

**Timeline**: 4 weeks

**Steps**:
1. **Week 1**: Test with Aisha and Marcus (2-3 participants each)
2. **Week 2**: Implement discoverability improvements (keyboard shortcuts reminder, progressive disclosure)
3. **Week 3**: Retest with Aisha and Marcus
4. **Week 4**: Validate power user workflows, update patterns library

**Exit Criteria**: Aisha completes library organization in <10 minutes, Marcus completes classroom demo in <5 minutes

---

## Related Documents

- [01-personas.md](01-personas.md) — User profiles for recruitment
- [04-journey-maps.md](04-journey-maps.md) — Workflows to test
- [09-accessibility-audit.md](09-accessibility-audit.md) — Known issues to validate
- [10-accessibility-plan.md](10-accessibility-plan.md) — Remediations to test
- [16-iteration-plan.md](16-iteration-plan.md) — Test-fix-retest cycles

---

## Revision History

- **2026-02-12**: Initial testing plan (Phase 6 of Design Thinking foundation)
- Future: Update after each testing cycle, document findings
