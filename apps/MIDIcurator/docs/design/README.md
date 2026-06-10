# MIDIcurator Design Documentation

**Last updated:** 2026-02-12

## Overview

This directory contains comprehensive design artifacts using Design Thinking methods to establish a user-centered foundation for MIDIcurator development. These documents guide feature design, accessibility implementation, and user testing.

**Status**: Phase 1-5 complete (Personas, Empathy Maps, Problem Statements, Journey Maps, Scenarios, Systems Mapping, Competitive Analysis, Stakeholder Mapping, Accessibility Audit/Plan, Design Principles). Testing protocols and interaction patterns will be added in future phases.

---

## Quick Navigation

### Phase 1: User Research & Empathy

**[01-personas.md](01-personas.md)** — Five detailed user personas
- The GarageBand Explorer (Jordan Martinez) — Casual creator discovering patterns by ear
- The Theory-Savvy Curator (Dr. Aisha Okonkwo) — Expert organizing vast MIDI libraries
- The Accessibility-First Learner (Riley Chen) — Blind user learning music tech with screen reader
- The Neurodiverse Pattern-Seeker (Sam Kowalski) — Autistic musician who thinks in systems
- The Music Educator (Marcus Johnson) — Teacher using MIDIcurator for classroom demonstrations

Each persona includes demographics, musical background, goals, pain points, accessibility needs, key quotes, and success metrics.

**[02-empathy-maps.md](02-empathy-maps.md)** — What users say, think, do, and feel
- Empathy maps for each persona in key scenarios
- First-time use, encountering errors, organizing libraries, classroom demos
- Emotional journeys from curiosity to confidence (or frustration)

**[03-problem-statements.md](03-problem-statements.md)** — "How Might We" questions
- 15+ HMW questions framed as opportunities, not constraints
- Organized by category: Accessibility, Learning, Organization, Trust, Performance
- Links to affected personas and current pain points
- Top 5 priorities based on user impact

---

### Phase 2: User Journeys & Context

**[04-journey-maps.md](04-journey-maps.md)** — Detailed user journeys for key scenarios
- **Priority journeys** focus on accessibility workflows (Riley, Sam)
- Maps stages, touchpoints, emotions, current support levels, barriers, improvements
- Success criteria for each journey stage
- Traces complete tasks from initial goal through completion
- Includes references to specific UI components and keyboard shortcuts

**[05-scenarios.md](05-scenarios.md)** — Narrative use cases showing MIDIcurator in action
- "Day in the life" stories demonstrating real workflows
- Step-by-step walkthroughs with specific UI elements cited
- Accessibility wins highlighted (Riley's screen reader success story)
- Learning moments and design principles demonstrated
- Code references showing implementation details

---

### Phase 3: Systems & Stakeholders

**[06-systems-map.md](06-systems-map.md)** — MIDIcurator's position in the music creation ecosystem
- **Inputs**: Sample libraries (Splice, Loopcloud), user creations, online MIDI databases
- **Processing**: Chord detection, library curation, variant generation, accessibility layer
- **Outputs**: To DAWs, notation software, learning tools, learners/collaborators
- **Adjacent tools**: DAWs, sample platforms, theory apps, chord generators, notation software
- **Complementary workflows**: 5 scenarios showing tool integration (Jordan's sample pack workflow, Aisha's session prep, Marcus's classroom demo, Riley's accessibility win, Sam's pattern research)
- **Ecosystem position**: The "curatorial layer" between acquisition and production

**[07-competitive-analysis.md](07-competitive-analysis.md)** — Benchmarking existing solutions
- **Direct competitors**: Captain Chords, Scaler 2, online MIDI analyzers, DAW clip browsers
- **Adjacent tools**: iReal Pro, music theory apps (Teoria, Tenuto), Hooktheory
- **Accessibility benchmarks**: Soundtrap, MuseScore, REAPER + OSARA
- For each tool: Strengths, weaknesses, MIDIcurator advantage
- **Key insights**: Curatorial gap exists, accessibility as competitive moat, subscription fatigue, web-first advantage, learning tools disconnected
- **Opportunity gaps**: Batch analysis + library organization, accessibility for blind musicians, free/open-source alternative, pattern curation vs. generation, pedagogical accessibility

**[08-stakeholders.md](08-stakeholders.md)** — Stakeholder mapping across three tiers
- **Primary users** (direct interaction): Casual makers (Jordan), educators (Marcus), expert curators (Aisha), accessibility users (Riley), neurodiverse musicians (Sam)
- **Secondary stakeholders** (indirect benefit): Music students, sample pack creators, DAW developers
- **Tertiary stakeholders** (ecosystem support): Accessibility advocates, music tech researchers, platform hosts, open-source contributors
- For each group: Needs, engagement level, potential contributions, communication channels
- **Engagement strategies**: Active (primary), passive monitoring (secondary), strategic outreach (tertiary)
- Communication plan (launch, growth, sustainability phases)

---

### Phase 4: Accessibility (Foundation)

**[09-accessibility-audit.md](09-accessibility-audit.md)** — **WCAG 2.1 AA compliance audit** (START HERE!)
- Systematic review using WCAG 2.1 criteria (Perceivable, Operable, Understandable, Robust)
- Identifies critical barriers: no ARIA labels, no focus indicators, canvas silent to screen readers
- Documents user impact for screen reader users, keyboard-only users, low vision users, motor impairment users, neurodivergent users
- Priority summary: Tier 1 (critical), Tier 2 (important), Tier 3 (enhanced)

**[10-accessibility-plan.md](10-accessibility-plan.md)** — Remediation roadmap with implementation guidance
- **Tier 1 (Critical)**: ARIA labels, focus indicators, piano roll text alternatives, live regions, keyboard alternatives
- **Tier 2 (Important)**: iPadOS touch handling, color contrast, skip links, semantic HTML, confirmation dialogs
- **Tier 3 (Enhanced)**: High-contrast theme, audio cues, reduced motion, screencast tutorial, undo history
- Includes code examples, effort estimates (20-28 hours Tier 1), testing criteria
- Implementation roadmap: Phase 1-4 with milestones

---

### Phase 5: Design Guidelines

**[11-principles.md](11-principles.md)** — Eight design principles expanded from ARCHITECTURE.md
1. **Curation Over Production** — Prepares music, doesn't replace DAWs
2. **Analysis is Assistive, Not Authoritative** — Users can override results
3. **Patterns are First-Class** — Optimize for 8-32 bar loops, not full songs
4. **Accessibility is Foundational** — Keyboard-first, screen-reader-first design
5. **Preserve Meaning Before Optimizing Mechanism** — Semantic correctness matters (e.g., spell B♯ in F♯ major)
6. **Progressive Disclosure (Concentric Clarity)** — Show coarse first, reveal detail on demand
7. **Explicit Over Implicit** — No hidden modes, make state visible
8. **Reversible Actions Build Trust** — Users feel safe to experiment

Each principle includes rationale, do/don't guidelines, decision-making questions, examples, affected personas, and related documents.

---

## How to Use These Docs

**If you're...**

### Implementing a New Feature
1. Check **[11-principles.md](11-principles.md)** — Does this align with design principles?
2. Review **[01-personas.md](01-personas.md)** — Which users benefit? Which are excluded?
3. Check **[03-problem-statements.md](03-problem-statements.md)** — Does this address a HMW question?
4. Verify **[09-accessibility-audit.md](09-accessibility-audit.md)** — Does this fix or create accessibility barriers?

### Fixing an Accessibility Bug
1. Start with **[09-accessibility-audit.md](09-accessibility-audit.md)** to understand context
2. Check **[10-accessibility-plan.md](10-accessibility-plan.md)** for implementation guidance
3. Verify fix helps **Riley** (Accessibility-First Learner persona)
4. Test with screen reader (NVDA, JAWS, or VoiceOver)

### Designing UI or Interaction Patterns
1. Read **[11-principles.md](11-principles.md)** — Especially Principles 4, 6, 7
2. Check **[02-empathy-maps.md](02-empathy-maps.md)** — What emotions should users feel?
3. Verify **keyboard-only** and **screen-reader** workflows work first
4. Progressive disclosure: Can **Jordan** (beginner) and **Aisha** (expert) both succeed?

### Onboarding a Design Contributor
1. Read this README (you're here!)
2. Read **[01-personas.md](01-personas.md)** — Understand who we're designing for
3. Read **[11-principles.md](11-principles.md)** — Understand design values
4. Review **[09-accessibility-audit.md](09-accessibility-audit.md)** — Understand current barriers
5. See **[../CONTRIBUTING-DESIGN.md](../../CONTRIBUTING-DESIGN.md)** (to be created)

### Explaining MIDIcurator to a User
- Share **[01-personas.md](01-personas.md)** — "Are you like Jordan or Aisha?"
- Share sample progressions and keyboard shortcuts (in-app)
- Future: Share **user-guide.md** (plain language, no jargon)

---

## Design Thinking Process

These docs follow a structured Design Thinking approach:

### 1. Empathize (Understand Users)
- **[01-personas.md](01-personas.md)** — User archetypes with goals, pain points, contexts
- **[02-empathy-maps.md](02-empathy-maps.md)** — Emotional journeys and unspoken thoughts
- Future: Journey maps, scenarios

### 2. Define (Frame the Problem)
- **[03-problem-statements.md](03-problem-statements.md)** — HMW questions
- **[09-accessibility-audit.md](09-accessibility-audit.md)** — Barrier analysis (analogous to pain point identification)
- Future: Stakeholder mapping, competitive analysis

### 3. Ideate (Generate Solutions)
- **[11-principles.md](11-principles.md)** — Constraints and values guiding solutions
- **[10-accessibility-plan.md](10-accessibility-plan.md)** — Specific remediation strategies
- Future: Interaction patterns library, design system

### 4. Prototype (Make Ideas Tangible)
- Current implementation (live demo at https://enkerli.github.io/MIDIcurator/)
- Future: Usability testing plan, user guide, iteration cycles

### 5. Test (Validate with Users)
- Future: User testing protocols, results, iteration plans
- Testing plan defines **how** to test, not results (deferred to future work)

---

## Alignment with #MTILT Mission

Every artifact connects to **#MTILT** (Music Tech: Inclusive Learning & Teaching):

### Inclusive
- **[09-accessibility-audit.md](09-accessibility-audit.md)** ensures **everyone** can use MIDIcurator
- Personas include disabled users (Riley), neurodivergent users (Sam, Jordan's ADHD traits)
- Design principles prioritize accessibility as foundational (Principle 4)
- Plain language in problem statements and principles (no unnecessary jargon)

### Learning
- **Progressive disclosure** (Principle 6) mirrors **zone of proximal development**
- Jordan persona represents "accidental learner" (gains theory insights through exploration)
- Empathy maps identify **learning moments** ("Aha!" when patterns recognized)
- Problem statements frame challenges as learning opportunities (HMW 2.1, 2.2)

### Teaching
- Marcus persona explicitly addresses classroom/workshop use cases
- Principles support pedagogical goals (scaffolding, non-judgmental feedback, shareable examples)
- Accessibility ensures diverse classroom learners can participate
- Future user guide will double as pedagogical resource

### Music Tech
- Design principles position MIDIcurator in ecosystem (Principle 1: Curation Over Production)
- Personas represent spectrum of music tech users (casual to expert, production to pedagogy)
- Technical constraints informed by music semantics (Principle 5: Preserve Meaning)
- Open-source, local-first architecture aligns with inclusive tech values

---

## Document Status & Roadmap

### Completed (2026-02-12)

**Phase 1: User Research & Empathy**
- ✅ **01-personas.md** — 5 detailed personas
- ✅ **02-empathy-maps.md** — Say/Think/Do/Feel for each persona
- ✅ **03-problem-statements.md** — 15+ HMW questions

**Phase 2: User Journeys & Context**
- ✅ **04-journey-maps.md** — User journeys for key scenarios (accessibility-prioritized)
- ✅ **05-scenarios.md** — Narrative use cases with code references

**Phase 3: Systems & Stakeholders**
- ✅ **06-systems-map.md** — Ecosystem positioning and complementary workflows
- ✅ **07-competitive-analysis.md** — Benchmarking Captain Chords, Scaler 2, MuseScore, etc.
- ✅ **08-stakeholders.md** — Primary/secondary/tertiary stakeholder mapping

**Phase 4: Accessibility Foundation**
- ✅ **09-accessibility-audit.md** — WCAG 2.1 AA systematic review
- ✅ **10-accessibility-plan.md** — Remediation roadmap (Tiers 1-3)

**Phase 5: Design Guidelines**
- ✅ **11-principles.md** — 8 expanded design principles

### Planned (Future Phases)
- **12-interaction-patterns.md** — Reusable UI patterns with accessibility notes
- **13-design-tokens.md** — Systematize App.css (color, spacing, typography)
- **14-component-audit.md** — UI component inventory (buttons, inputs, visualizations)
- **15-testing-plan.md** — Usability testing protocol (scenarios, participants, metrics)
- **16-iteration-plan.md** — Design iteration cycles based on testing
- **17-user-guide.md** — Public-facing documentation (plain language, screenshots)

### Why This Order?

**Accessibility First** (Phase 4 completed first):
- Accessibility barriers block core features for Riley and others
- Accessibility audit informs all other design decisions
- WCAG compliance is foundation, not afterthought

**Personas + Principles** (Phase 1 + 5):
- Personas ground all design decisions in real user needs
- Principles provide consistent decision-making framework
- Together, they enable feature prioritization and trade-off resolution

**Journey Maps + Patterns** (Next):
- Journey maps show how personas interact with MIDIcurator over time
- Interaction patterns codify reusable solutions to common problems
- Both build on persona needs and accessibility requirements

---

## Key Insights & Recommendations

### Cross-Cutting Themes

**1. Accessibility Benefits Everyone**
- Designing for Riley (blind, keyboard-only) makes tool better for all personas
- Keyboard shortcuts help Aisha (productivity), Sam (predictability), Marcus (live demos)
- Explicit state helps Sam (autism), Jordan (ADHD), and reduces cognitive load universally
- ARIA live regions announce state changes for Riley, but also provide clarity for everyone

**2. Progressive Disclosure Serves Beginners and Experts**
- Jordan needs simple chord names ("Dm7"), Aisha needs pitch-class sets ("2,5,9,0")
- Default view optimizes for 80% of use cases (simple)
- Hover/click reveals complexity (expert)
- Marcus shows simple to students, reveals detail when ready

**3. Trust Through Transparency and Reversibility**
- Aisha trusts tool because she can override results (Principle 2)
- Sam trusts tool because actions are reversible (Principle 8)
- Jordan feels safe experimenting because variants don't overwrite originals
- Marcus trusts tool for classroom because students can't "break" anything

**4. Neurodiversity as Design Advantage**
- Designing for Sam (explicit state, predictable interactions) makes tool clearer for everyone
- No hidden modes, no surprises, no implicit assumptions
- Benefits autistic users, ADHD users, anxious users, and anyone in high-stress contexts

### Design Priorities (Based on Persona Impact)

**Top 5 (from Problem Statements)**:
1. Make piano roll accessible to screen readers (HMW 1.1) — Blocks Riley entirely
2. Support keyboard-only users for all interactions (HMW 1.2) — Blocks Riley, affects Sam, Aisha
3. Help casual users discover patterns without theory knowledge (HMW 2.1) — Core value for Jordan
4. Organize large libraries without rigid hierarchies (HMW 3.1) — Core value for Aisha
5. Design for neurodivergent users (HMW 1.3) — Affects Sam, Jordan, Marcus's students

**Implementation Order (from Accessibility Plan)**:
1. **Tier 1 (Critical, 20-28 hours)**: ARIA labels, focus indicators, piano roll text alternatives, live regions, keyboard alternatives
2. **Tier 2 (Important, 16-22 hours)**: iPadOS touch, skip links, semantic HTML, color contrast, confirmation dialogs
3. **Tier 3 (Enhanced, 12-16 hours)**: High-contrast theme, audio cues, reduced motion, undo history

---

## Related Documents (Outside This Directory)

### Existing Architecture & Philosophy
- **[../../ARCHITECTURE.md](../../ARCHITECTURE.md)** — Core principles (shorter version)
- **[../../HARMONY_ENGINE.md](../../HARMONY_ENGINE.md)** — Chord detection technical spec
- **[../../SEGMENTATION.md](../../SEGMENTATION.md)** — Scissors tool interaction design
- **[../../METADATA_MIDI.md](../../METADATA_MIDI.md)** — Round-trip fidelity scheme
- **[../../OPEN_NOTES.md](../../OPEN_NOTES.md)** — Research directions, design debt

### Implementation
- **[../../src/components/](../../src/components/)** — UI components (MidiCurator.tsx, PianoRoll.tsx, etc.)
- **[../../src/lib/](../../src/lib/)** — Pure musical logic (chord-detect.ts, chord-dictionary.ts)
- **[../../src/App.css](../../src/App.css)** — Design tokens (colors, spacing, typography)

### Roadmap & Planning
- **[../../PLAN.md](../../PLAN.md)** — Prioritized feature tiers
- **[../../ROADMAP.md](../../ROADMAP.md)** — Full phase breakdown

---

## Quality Standards

These documents follow rigorous quality standards:

### Thoroughness
- Each persona includes demographics, goals, pain points, accessibility needs, quotes, success metrics
- Empathy maps capture emotional journeys across multiple scenarios
- Problem statements link to personas, current pain points, desired outcomes, constraints
- Accessibility audit covers all WCAG 2.1 criteria systematically
- Design principles include rationale, guidelines, examples, affected personas

### Carefulness
- Code references cite specific files and line numbers (e.g., "PianoRoll.tsx:100-180")
- Examples use real components (ClipCard, StatsGrid, KeyboardShortcutsBar)
- Real sample progressions cited ("II-V-I in C")
- Accessibility barriers verified by reading source code

### Traceability
- Personas → Problem Statements → Journey Maps → Principles → Features
- Example: Riley (persona) → HMW 1.1 (problem) → Principle 4 (accessibility) → Tier 1.3 (solution)
- Every design decision should be traceable to user need

### Plain Language
- Short sentences (15-20 words max)
- Avoid jargon or define terms inline ("slash chord (e.g., C/E — C major with E in bass)")
- Active voice ("The tool detects chords" not "Chords are detected")
- Concrete examples from real workflows

### Neurodiversity-Friendly
- No time pressure language ("quickly", "simply")
- Explicit state and predictable structure
- Multiple modalities (text, examples, code snippets)
- Visual hierarchy (headings, lists, bold) to chunk information

---

## Contributing

Design contributions are welcome! Guidelines:
- Read **[01-personas.md](01-personas.md)** and **[11-principles.md](11-principles.md)** first
- Ensure proposals address persona needs (link to affected personas)
- Verify accessibility (all contributions must meet WCAG 2.1 AA)
- Use HMW framework for problem statements
- Test with keyboard-only and screen reader (or explain how you will)

Future: See **CONTRIBUTING-DESIGN.md** (to be created) for detailed guidelines.

---

## Version History

- **2026-02-12**: Phase 1-5 design foundation complete
  - **Phase 1**: Personas (5), empathy maps, problem statements (15+ HMWs)
  - **Phase 2**: Journey maps (5 personas, accessibility-prioritized), scenarios (narrative use cases)
  - **Phase 3**: Systems map (ecosystem positioning), competitive analysis (Captain Chords, Scaler 2, MuseScore, etc.), stakeholder mapping (primary/secondary/tertiary)
  - **Phase 4**: Accessibility audit (WCAG 2.1 AA) and remediation plan (Tiers 1-3)
  - **Phase 5**: Design principles (8, expanded from ARCHITECTURE.md)
- Future: Interaction patterns, design tokens, component audit, testing protocols, user guide

---

## Questions or Feedback?

For questions about these design docs or to propose changes:
- Open GitHub issue with "Design:" prefix
- Reference specific persona or principle in your proposal
- Explain which HMW question you're addressing
- Describe accessibility impact (helps or harms which users?)

---

**Design is never finished. These documents are living artifacts that evolve with user feedback, testing insights, and implementation learnings.**
