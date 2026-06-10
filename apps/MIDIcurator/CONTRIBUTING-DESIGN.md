# Contributing to MIDIcurator Design

**Last updated:** 2026-02-12

Welcome! This guide helps designers, accessibility experts, UX researchers, and design-minded developers contribute to MIDIcurator's user experience and interface design.

---

## Design Philosophy

MIDIcurator follows a **user-centered, accessibility-first design philosophy** grounded in the **#MTILT mission** (Music Tech: Inclusive Learning & Teaching). Before proposing changes, please read:

- **[docs/design/11-principles.md](docs/design/11-principles.md)** — 8 core design principles
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — System identity and architectural invariants

### Core Principles (Quick Reference)

1. **Curation Over Production** — We prepare and explain music, we don't replace DAWs
2. **Analysis is Assistive, Not Authoritative** — Users can always override our interpretations
3. **Patterns are First-Class** — Optimize for 8-32 bar loops, not full songs
4. **Accessibility is Foundational** — Design for keyboard-first, screen-reader-first, then enhance
5. **Preserve Meaning Before Optimizing Mechanism** — Musical correctness > algorithmic simplicity
6. **Progressive Disclosure** — Coarse understanding first, finer detail on demand
7. **Explicit Over Implicit** — No hidden modes, visible state at all times
8. **Reversible Actions Build Trust** — Users should feel safe to experiment

---

## How to Propose Design Changes

All design changes should follow this process:

### 1. Identify Affected Personas

Reference our **[5 user personas](docs/design/01-personas.md)**:
- **Jordan** (GarageBand Explorer) — Casual creator, minimal theory, ADHD traits
- **Aisha** (Theory-Savvy Curator) — Expert with 2,000+ file library, mild hearing loss
- **Riley** (Accessibility-First Learner) — Blind JAWS user, computer science student
- **Sam** (Neurodiverse Pattern-Seeker) — Autistic, thinks in systems, needs explicit state
- **Marcus** (Music Educator) — High school teacher, diverse classroom learners

**Ask yourself:** Which personas benefit from this change? Which might be harmed?

### 2. Link to Problem Statements

Review **[problem statements](docs/design/03-problem-statements.md)** (HMW questions). Does your proposal address an existing problem, or introduce a new one?

**Good proposal**: "This change addresses **HMW 1.1** (screen reader accessibility) by adding ARIA labels to piano roll, benefiting **Riley** and all screen reader users."

**Needs refinement**: "This adds a cool new feature!" (Doesn't link to user needs)

### 3. Check Journey Maps

Review **[journey maps](docs/design/04-journey-maps.md)** to understand where your change fits in the user's workflow:
- Does it reduce friction at a known pain point?
- Does it introduce new steps or complexity?
- Does it improve accessibility barriers identified in the audit?

### 4. Align with Design Principles

Ensure your proposal aligns with our **[8 design principles](docs/design/11-principles.md)**. Common conflicts:

- **Curation vs. Production**: Does your change add DAW-like features (recording, mixing)? → Out of scope
- **Assistive vs. Authoritative**: Does your change prevent users from overriding results? → Violates Principle 2
- **Explicit vs. Implicit**: Does your change rely on hidden state or modes? → Violates Principle 7

**Decision-making questions** (from principles.md):
1. Does this help users **understand or organize** music (curation), or **make** music (production)?
2. Can users override or reinterpret this feature's results?
3. Is this optimized for patterns (8-32 bars) or full song timelines?
4. Is this accessible via keyboard alone, with screen readers?

### 5. Submit Your Proposal

**GitHub Issues** (preferred for discussion):
1. Create a new issue with label `design`
2. Title format: `[Design] Brief description (affects: Persona names)`
   - Example: `[Design] Add keyboard shortcuts for scissors mode (affects: Riley, Sam)`
3. Include:
   - **Problem**: Which HMW question does this address? Which persona is affected?
   - **Proposed Solution**: Mockups, wireframes, or detailed description
   - **Journey Impact**: Which stage(s) of which journey map(s) does this improve?
   - **Accessibility**: How does this work for keyboard-only, screen reader, low vision, neurodivergent users?
   - **Alternatives Considered**: What other solutions did you explore?
   - **Trade-offs**: What are the downsides or conflicts with other principles?

**Pull Requests** (for documentation updates):
- PRs that update design docs (personas, journey maps, etc.) should reference the issue they address
- PRs that modify UI code should include:
  - Before/after screenshots
  - Accessibility testing results (keyboard nav, NVDA/VoiceOver, color contrast)
  - Link to design issue with proposal

---

## Accessibility Requirements

**All design contributions must meet WCAG 2.1 Level AA.** This is non-negotiable.

### Mandatory Checks Before Submitting

1. **Keyboard Navigation**
   - Can all interactive elements be reached via Tab/Shift+Tab?
   - Are keyboard shortcuts documented?
   - Is there a visible focus indicator (`:focus-visible` with 3:1 contrast)?

2. **Screen Reader Compatibility**
   - Do all buttons have `aria-label` or visible text?
   - Do custom widgets have appropriate ARIA roles (`role="button"`, `role="listitem"`)?
   - Are dynamic content changes announced via `aria-live` regions?

3. **Color Contrast**
   - Text: ≥4.5:1 for normal text, ≥3:1 for large text (≥18pt)
   - UI components: ≥3:1 for borders, icons, focus indicators
   - Run automated audit: [axe DevTools](https://www.deque.com/axe/devtools/) or Lighthouse

4. **Color Independence**
   - Never use color alone to convey meaning (e.g., red border for error)
   - Always pair with text, icons, or patterns

5. **Touch Targets**
   - Minimum 28×28px for mouse (AA), 44×44px ideal (AAA)
   - Test on iPad/Android tablet if adding touch interactions

### Accessibility Resources

- **[docs/design/09-accessibility-audit.md](docs/design/09-accessibility-audit.md)** — Current WCAG violations and barriers
- **[docs/design/10-accessibility-plan.md](docs/design/10-accessibility-plan.md)** — Remediation roadmap (Tiers 1-3)
- **[WebAIM WCAG Checklist](https://webaim.org/standards/wcag/checklist)** — Quick reference
- **Testing tools**: axe DevTools, Lighthouse, WAVE, NVDA (Windows), VoiceOver (Mac)

---

## Usability Testing Process

If you're conducting user testing (highly encouraged!), follow our **[testing plan](docs/design/15-testing-plan.md)**:

### Recruiting Participants

Target our **5 personas**:
- 2-3 casual users (Jordan types) — minimal music theory background
- 2-3 advanced curators (Aisha types) — large MIDI libraries, professional use
- 2-3 accessibility users — **1 screen reader user (Riley type)**, 1 keyboard-only, 1 low vision
- 1-2 music educators (Marcus types) — classroom/workshop context

**Compensation**: $50-100 for 1-hour session (accessibility users: $100+ for additional setup time)

### Test Scenarios

Use scenarios from **[journey maps](docs/design/04-journey-maps.md)**:
1. Import first MIDI file and hear it play (success: <2 minutes)
2. Identify chord at playhead (success: finds chord symbol in stats grid)
3. Generate 3 variants of a pattern (success: understands variant relationship)
4. Tag and filter clips by tag (success: organizes >5 clips)
5. Use scissors tool to segment a pattern (success: places boundary, sees chord update)

### Method

- **Remote moderated testing** (Zoom screen share)
- **Think-aloud protocol** — Ask participants to verbalize their thoughts
- **Task completion time** + success rate (did they complete the task?)
- **Post-test survey**: System Usability Scale (SUS) + qualitative feedback

### Success Metrics

- 80%+ task completion rate for core workflows
- SUS score >70 (above average usability)
- Zero critical accessibility barriers (WCAG A violations)
- Positive sentiment in qualitative feedback

### Reporting Results

Document findings in `docs/design/testing-results/YYYY-MM-DD-session-name.md`:
- Participant profile (which persona do they match?)
- Task success/failure rates
- Time on task
- Quotes (pain points, delights)
- Recommendations (link to HMW questions, journey map stages)

---

## Design Tool Setup (Optional)

MIDIcurator does not require visual design tools for contributions, but if you want to create mockups or prototypes:

### Recommended Tools

**Figma** (free for individual use):
- Use existing **[Design System foundations](docs/design/13-design-tokens.md)** (color tokens, spacing scale, typography)
- **Component library**: Not yet created, but contributors can create one based on **[component audit](docs/design/14-component-audit.md)**
- Export format: PNG or SVG for mockups, Figma link for interactive prototypes

**Penpot** (open-source alternative):
- Self-hosted or use penpot.app
- Export format: SVG or PNG

**Design Tokens** (from App.css):
```
Colors (Dark Theme):
  --mc-bg: #1a1a1a
  --mc-text: #e0e0e0
  --mc-accent: #4a7a9a

Typography:
  Headings: 18px (main), 16px (section), 14px (subsection)
  Body: 14px (default), 12px (labels), 16px (values)
  Font: system-ui, -apple-system, sans-serif

Spacing Scale (informal, to be formalized):
  4px, 8px, 12px, 16px, 20px, 24px, 30px
```

See **[13-design-tokens.md](docs/design/13-design-tokens.md)** for full token reference.

---

## Submitting Design Feedback

### For Bugs or Issues

**GitHub Issues** with label `design` or `accessibility`:
- **Title**: Clear, specific (e.g., "Focus indicator missing on clip cards")
- **Steps to reproduce**: How to trigger the issue
- **Expected behavior**: What should happen (reference design principles or personas)
- **Actual behavior**: What currently happens
- **Personas affected**: Who is blocked or frustrated by this?
- **WCAG criteria**: If accessibility issue, cite WCAG 2.1 criterion (e.g., "2.4.7 Focus Visible")

### For Feature Requests

**GitHub Discussions** (for open-ended ideas) or **GitHub Issues** (for concrete proposals):
- Link to affected **persona(s)** and **journey map(s)**
- Explain the **problem** (HMW question format preferred)
- Propose **solution** with mockups or detailed description
- Address **accessibility** (keyboard, screen reader, color contrast)
- Acknowledge **trade-offs** (conflicts with other principles or technical constraints)

### For Documentation Improvements

**Pull Requests** to `docs/design/*.md`:
- Fix typos, improve clarity, add examples
- Update personas based on user research
- Refine journey maps with new insights
- Add new HMW questions from community feedback

**Review process**: Maintainers will review for consistency with design philosophy and #MTILT mission.

---

## Design Decision Framework

When evaluating competing design proposals, we use this framework:

### Priority 1: Accessibility (Non-Negotiable)

Does this meet WCAG 2.1 AA? If no, it's rejected or requires redesign.

**Rationale**: Principle 4 ("Accessibility is Foundational") is non-negotiable. MIDIcurator aims to be a **leader in accessible music software**.

### Priority 2: Persona Alignment

Which personas benefit? Which are harmed?

**Preference order** (in case of conflicts):
1. **Riley** (accessibility users) — Protected class, underserved by music tech
2. **Jordan** (casual learners) — Largest potential user base, aligns with #MTILT learning mission
3. **Marcus** (educators) — Multiplier effect (one teacher = many students)
4. **Sam** (neurodivergent) — Often overlooked, benefits from explicit/predictable design
5. **Aisha** (advanced curators) — Power users, but fewer in number

**Example conflict**: Advanced feature (benefits Aisha) vs. simple UI (benefits Jordan)
**Resolution**: Progressive disclosure (simple by default, advanced features in "Advanced" section or keyboard shortcut)

### Priority 3: Design Principle Alignment

Rank proposals by how many principles they support vs. violate.

**Example**: Proposal A supports Principles 1, 4, 6 but violates Principle 2 (users can't override)
**Example**: Proposal B supports Principles 1, 2, 4, 6 and violates none
**Decision**: Proposal B wins

### Priority 4: Technical Feasibility

Given equal design merit, prefer solutions that:
- Reuse existing patterns (from **[interaction patterns](docs/design/12-interaction-patterns.md)**)
- Leverage existing components (from **[component audit](docs/design/14-component-audit.md)**)
- Avoid third-party dependencies (maintain local-first, privacy-first architecture)

### Priority 5: #MTILT Mission Alignment

Does this support **Inclusive Learning & Teaching**?
- **Inclusive**: Broadens access (disabilities, neurodiversity, low-resource contexts)
- **Learning**: Enables discovery, scaffolds complexity, reveals insight
- **Teaching**: Supports educators, classroom use, pedagogical workflows
- **Music Tech**: Advances open-source music software, reusable patterns

---

## Examples: Good vs. Needs Refinement

### ✅ Good Design Proposal

**Title**: `[Design] Add keyboard shortcuts for scissors boundary placement (affects: Riley, Sam)`

**Problem**: Riley (screen reader user) and Sam (keyboard-only user) cannot place scissors boundaries. Current implementation requires mouse click (documented in **09-accessibility-audit.md** § 2.1).

**Proposed Solution**:
- When scissors mode active, use arrow keys (←→) to move cursor along grid
- Press Enter or Space to place boundary at cursor position
- Press Delete or Backspace to remove boundary at cursor
- Visual cursor feedback (vertical line at current position)
- Announced via `aria-label`: "Scissors cursor at bar 3 beat 2. Press Enter to place boundary."

**Journey Impact**: Improves **Journey 2** (Sam's Scissors Workflow) stage 3-4 (placing boundaries). Reduces frustration (😕→😊).

**Accessibility**: Fully keyboard-accessible. Screen reader announces cursor position. Visual feedback for sighted users. Meets WCAG 2.1.1 Keyboard (Level A).

**Alternatives Considered**:
- Prompt dialog for manual tick input → Too slow, breaks flow
- Shift+Click only → Doesn't help keyboard-only users

**Trade-offs**: Adds complexity to keyboard handling, but benefits outweigh costs (critical accessibility fix).

**Implementation**: See **10-accessibility-plan.md** Tier 1.5 for code examples.

---

### ⚠️ Needs Refinement

**Title**: `[Feature Request] Add AI chord generation`

**Issues**:
1. **No persona link**: Which persona needs this? Why?
2. **Violates Principle 1**: Chord generation is production (creating music), not curation (understanding existing music)
3. **No accessibility analysis**: How would screen reader users interact with AI suggestions?
4. **Scope creep**: MIDIcurator is for analyzing patterns, not generating them (see ARCHITECTURE.md § Identity)

**How to refine**:
- Reframe as chord **substitution** (adapting existing patterns) → Aligns with curation
- Link to Aisha persona (wants to explore reharmonization options)
- Address accessibility (keyboard nav through suggestions, screen reader announces options)
- Keep generation out of scope, focus on **transforming existing patterns**

---

## Community & Communication

### Design Discussions

- **GitHub Discussions** — Design category for open-ended ideas
- **Discord** (if established) — #design channel for real-time collaboration
- **Design critique sessions** — Monthly video calls (recordings posted for async review)

### Design Contributors

We welcome contributions from:
- **UX/UI designers** — Mockups, prototypes, interaction design
- **Accessibility experts** — WCAG audits, assistive tech testing, remediation guidance
- **User researchers** — Personas, journey maps, usability testing
- **Music educators** — Pedagogical insights, classroom testing
- **Musicians with disabilities** — First-hand accessibility feedback, feature requests

**Recognition**: All contributors credited in README and release notes.

---

## Learning Resources

### Accessibility

- **[WebAIM](https://webaim.org/)** — WCAG tutorials, contrast checker, screen reader guides
- **[A11y Project](https://www.a11yproject.com/)** — Accessibility checklist, myth-busting
- **[Inclusive Components](https://inclusive-components.design/)** — Accessible UI patterns

### Design Thinking

- **[IDEO Design Kit](https://www.designkit.org/)** — Methods, case studies, worksheets
- **[Nielsen Norman Group](https://www.nngroup.com/)** — UX research, usability heuristics
- **[18F Method Cards](https://methods.18f.gov/)** — Government digital service design methods

### Music Technology

- **[Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)** — Browser audio capabilities
- **[MIDI Specification](https://www.midi.org/specifications)** — MIDI protocol details
- **[Music21](http://web.mit.edu/music21/)** — Music theory in Python (inspiration)

---

## Questions?

- **Design questions**: Open a GitHub Discussion in the Design category
- **Accessibility questions**: Tag issue with `accessibility`, mention @[maintainer]
- **Urgent accessibility barriers**: Email [accessibility contact] for priority review

---

## Thank You!

MIDIcurator is a **community-driven project** aligned with the **#MTILT mission**. Your design contributions help make music technology **accessible, inclusive, and learner-centered**.

Every design decision we make today shapes the experiences of musicians, learners, and educators for years to come. Thank you for taking the time to contribute thoughtfully and inclusively.

---

**Related Documents**:
- [docs/design/README.md](docs/design/README.md) — Design documentation index
- [docs/design/01-personas.md](docs/design/01-personas.md) — 5 user personas
- [docs/design/11-principles.md](docs/design/11-principles.md) — 8 design principles
- [docs/design/09-accessibility-audit.md](docs/design/09-accessibility-audit.md) — WCAG audit findings
- [CONTRIBUTING.md](CONTRIBUTING.md) — General contribution guide (code, documentation)
