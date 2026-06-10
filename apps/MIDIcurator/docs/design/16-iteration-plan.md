# Design Iteration Plan

**Last updated:** 2026-02-12

## Overview

This document outlines planned design iteration cycles for MIDIcurator. Each cycle focuses on specific goals, with clear entry/exit criteria to guide development priorities.

**Iteration Philosophy**: Test-fix-retest cycles every 4 weeks, prioritizing accessibility (Cycle 1), onboarding (Cycle 2), and advanced features (Cycle 3).

---

## Cycle 1: Accessibility Remediations

**Duration**: 4 weeks
**Priority**: **Critical** (WCAG A compliance, blocks Riley persona)

### Goals

1. Achieve WCAG 2.1 Level AA compliance
2. Enable Riley (blind, screen reader user) to complete core workflows independently
3. Enable Sam (keyboard-only user) to use scissors tool without mouse
4. Zero Tier 1 accessibility violations remaining

### Entry Criteria

- [ ] 09-accessibility-audit.md completed (audit identifies Tier 1 issues)
- [ ] 10-accessibility-plan.md completed (remediation roadmap defined)
- [ ] Development team ready to implement fixes

### Activities

**Week 1: ARIA Labels and Focus Indicators**
- Add `aria-label` to all buttons, inputs, canvas elements
- Add `role`, `aria-pressed`, `aria-selected` where needed
- Implement visible focus indicators (`:focus-visible` CSS)
- Test with NVDA and VoiceOver

**Week 2: Piano Roll Text Alternative**
- Add `aria-label` to canvas ("Piano roll: 42 notes spanning C3-G5, 8 bars")
- Add hidden note list (aria-describedby) with first 50 notes
- Test with Riley persona (recruit 1-2 blind users)

**Week 3: Keyboard Alternatives**
- Implement keyboard range selection (Shift+Arrow keys)
- Implement keyboard scissors placement (Arrow keys + Enter in scissors mode)
- Add live regions for state changes (playback, mode toggles, clip selection)
- Test with Sam persona (recruit 1-2 keyboard-only users)

**Week 4: Validation Testing**
- Run Lighthouse accessibility audit (target: score ≥95)
- Manual testing with screen readers (NVDA, JAWS, VoiceOver)
- Document remaining issues (if any) for Tier 2

### Deliverables

- [ ] All Tier 1 ARIA labels implemented
- [ ] Focus indicators visible on all interactive elements
- [ ] Piano roll accessible via aria-describedby
- [ ] Keyboard alternatives for scissors mode and range selection
- [ ] Lighthouse accessibility score ≥95
- [ ] Test report (5-10 pages) documenting Riley and Sam workflows

### Exit Criteria

- ✅ Riley completes "First Pattern Playback" scenario independently (no sighted help)
- ✅ Sam completes "Segmentation" scenario without mouse
- ✅ Zero WCAG A violations (Lighthouse audit)
- ✅ SUS score >70 from accessibility-focused participants

### Risks and Mitigations

**Risk**: Keyboard scissors placement is complex (cursor navigation, snapping)
**Mitigation**: Prototype with arrow key navigation first, iterate based on feedback

**Risk**: Piano roll text alternative is verbose (50+ notes)
**Mitigation**: Truncate to first 50 notes, add "showing X of Y" disclaimer

---

## Cycle 2: Onboarding Improvements

**Duration**: 4 weeks
**Priority**: **Important** (improves Jordan's learning experience)

### Goals

1. Reduce time to first playback from 5 minutes to <3 minutes
2. Validate Jordan's learning moments ("I finally understand ii-V-I!")
3. Improve discoverability of sample progressions and keyboard shortcuts
4. Measure incidental learning (can users explain ii-V-I after exploration?)

### Entry Criteria

- [ ] Cycle 1 complete (accessibility fixes deployed)
- [ ] Usability test with Jordan persona scheduled (3-4 participants)

### Activities

**Week 1: Baseline Testing**
- Recruit 3-4 Jordan-like participants (self-taught, GarageBand users)
- Run Scenario 1 (First Pattern Playback) and Scenario 2 (Chord Discovery)
- Measure: time to playback, learning moments, frustration points

**Week 2: Onboarding Enhancements**
- Add "Get Started" button on welcome screen (loads sample progressions immediately)
- Add tooltips to key features (hover or focus reveals: "This is the chord bar — it shows detected chords per bar")
- Add progress indicator for batch imports ("Analyzing: 12 of 50 files")
- Add pattern name detection ("This is a ii-V-I progression — common in jazz")

**Week 3: Retest with Jordan**
- Test enhanced version with same or new Jordan participants
- Measure improvements: time to playback, learning outcomes
- Interview: "Did you learn anything new? Would you recommend this tool?"

**Week 4: Analysis and Documentation**
- Calculate improvement metrics (time reduction, learning rate)
- Update 01-personas.md if assumptions invalidated
- Update 04-journey-maps.md with refined emotion curves

### Deliverables

- [ ] "Get Started" button implemented
- [ ] Tooltips added to chord bar, piano roll, scissors tool
- [ ] Progress indicator for batch imports
- [ ] Pattern name detection (future: ML-based, start with rule-based ii-V-I, I-IV-V)
- [ ] Test report comparing baseline vs. enhanced onboarding

### Exit Criteria

- ✅ Time to first playback reduced to <3 minutes (80%+ participants)
- ✅ 80%+ participants report learning moment
- ✅ Jordan persona validated (or updated based on findings)

---

## Cycle 3: Advanced Feature Discoverability

**Duration**: 4 weeks
**Priority**: **Enhancement** (improves Aisha and Marcus workflows)

### Goals

1. Improve keyboard shortcut discoverability (power users love shortcuts)
2. Validate Aisha's library organization workflow (500 files in <10 minutes)
3. Validate Marcus's classroom demo workflow (setup in <2 minutes)
4. Refine progressive disclosure (simple by default, complexity discoverable)

### Entry Criteria

- [ ] Cycles 1 and 2 complete
- [ ] Usability test with Aisha and Marcus personas scheduled

### Activities

**Week 1: Baseline Testing**
- Recruit 1-2 Aisha participants (expert users, large libraries)
- Recruit 1-2 Marcus participants (educators, classroom use)
- Run Scenario 3 (Segmentation), Scenario 4 (Library Organization), Scenario 5 (Classroom Demo)

**Week 2: Progressive Disclosure Enhancements**
- Add keyboard shortcut reminder (persistent or dismissable tooltip)
- Add "Advanced" section in UI (collapsible, shows leadsheet input, transpose control)
- Refine scissors mode instructions (live region: "Use arrow keys to navigate...")
- Add chord detail view (click chord symbol → tooltip shows "D Dorian minor seventh")

**Week 3: Retest with Aisha and Marcus**
- Measure: time to segment 16-bar pattern, time to organize 500 files, classroom setup time
- Interview: "Does this tool respect your expertise? Would you use this weekly?"

**Week 4: Analysis and Patterns Library**
- Document successful patterns (keyboard shortcuts, progressive disclosure)
- Update 12-interaction-patterns.md with new examples
- Create Storybook documentation (future: interactive component library)

### Deliverables

- [ ] Keyboard shortcut reminder implemented
- [ ] Chord detail tooltips added
- [ ] Advanced features section (collapsible, progressive disclosure)
- [ ] Test report validating Aisha and Marcus workflows

### Exit Criteria

- ✅ Aisha completes 500-file organization in <10 minutes
- ✅ Marcus completes classroom setup in <2 minutes
- ✅ 100% of advanced features discoverable without documentation

---

## Post-Cycle 3: Continuous Improvement

### Ongoing Activities

**Monthly**:
- Monitor GitHub issues for usability complaints
- Track SUS scores (survey link in app footer)
- Analyze session recordings (with user consent)

**Quarterly**:
- Run mini usability test (2-3 participants, 1 scenario)
- Review and update personas (as user base grows)
- Refine interaction patterns library

**Annually**:
- Full accessibility audit (external consultant)
- Large-scale usability study (10-15 participants)
- Design system refresh (tokens, components, patterns)

---

## Iteration Metrics Dashboard

Track progress across cycles:

| Metric | Baseline | Cycle 1 Target | Cycle 2 Target | Cycle 3 Target |
|--------|----------|----------------|----------------|----------------|
| **Lighthouse Accessibility Score** | 62 | ≥95 | ≥95 | ≥95 |
| **WCAG A Violations** | 12 | 0 | 0 | 0 |
| **Time to First Playback (Jordan)** | 5:30 min | 5:00 min | <3:00 min | <2:00 min |
| **Riley Task Completion** | 40% | 80% | 85% | 90% |
| **Sam Scissors Workflow** | 0% (mouse only) | 100% | 100% | 100% |
| **Aisha Library Organization** | 15 min | 12 min | 10 min | <10 min |
| **SUS Score (Overall)** | Not measured | >70 | >75 | >80 |

---

## Related Documents

- [09-accessibility-audit.md](09-accessibility-audit.md) — Cycle 1 input
- [10-accessibility-plan.md](10-accessibility-plan.md) — Cycle 1 roadmap
- [15-testing-plan.md](15-testing-plan.md) — Testing protocols for all cycles
- [01-personas.md](01-personas.md) — Personas to validate
- [04-journey-maps.md](04-journey-maps.md) — Workflows to test

---

## Revision History

- **2026-02-12**: Initial iteration plan (Phase 6 of Design Thinking foundation)
- Future: Update after each cycle completes, document findings
