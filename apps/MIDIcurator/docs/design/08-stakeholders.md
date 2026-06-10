# Stakeholder Mapping: Users, Beneficiaries, and Contributors

**Last updated:** 2026-02-12

## Overview

This document maps MIDIcurator's stakeholder ecosystem across three tiers: primary users (direct interaction), secondary stakeholders (indirect benefit), and tertiary stakeholders (ecosystem support). For each group, we identify needs, engagement levels, potential contributions, and communication strategies.

**Stakeholder Model**: Concentric circles radiating outward from core users to broader community.

```
┌────────────────────────────────────────────────────────────┐
│                  TERTIARY STAKEHOLDERS                     │
│  ┌──────────────────────────────────────────────────────┐ │
│  │           SECONDARY STAKEHOLDERS                     │ │
│  │  ┌────────────────────────────────────────────────┐ │ │
│  │  │       PRIMARY USERS (Direct Interaction)       │ │ │
│  │  │                                                │ │ │
│  │  │  • Casual Makers (Jordan)                     │ │ │
│  │  │  • Music Educators (Marcus)                   │ │ │
│  │  │  • Expert Curators (Aisha)                    │ │ │
│  │  │  • Accessibility Users (Riley)                │ │ │
│  │  │  • Neurodiverse Musicians (Sam)               │ │ │
│  │  └────────────────────────────────────────────────┘ │ │
│  │                                                      │ │
│  │  • Music Students (beneficiaries)                   │ │
│  │  • Sample Pack Creators (metadata consumers)        │ │
│  │  • DAW Developers (ecosystem partners)              │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  • Accessibility Advocates (amplifiers)                   │
│  • Music Technology Researchers (validators)              │
│  • Platform Hosts (infrastructure)                        │
│  • Open-Source Contributors (builders)                    │
└────────────────────────────────────────────────────────────┘
```

---

## 1. Primary Stakeholders: Direct Users

Primary stakeholders interact directly with MIDIcurator. These are the personas from [01-personas.md](01-personas.md).

---

### 1.1 Casual Music Makers

**Representative Persona**: Jordan Martinez (GarageBand Explorer)

**Profile**:
- Age: 18-30
- Background: Self-taught producers, beat-makers, content creators
- Tech proficiency: High (daily DAW users, YouTube tutorial learners)
- Musical background: No formal training, learn by ear
- Tools: GarageBand, FL Studio, Ableton Live Intro, sample packs

**Needs from MIDIcurator**:
1. **Organize sample libraries** — 200+ MIDI files from Splice, Loopcloud, free packs
2. **Discover patterns without theory knowledge** — "Find groovy progressions" not "Find ii-V-I"
3. **Learn incidentally** — Gain music theory insights through exploration
4. **Fast workflow** — Drag-and-drop, instant playback (Space bar), minimal friction
5. **Tag by feeling** — "dreamy", "dark", "tense" alongside detected chords

**Engagement Level**: Moderate
- Use MIDIcurator weekly when starting new projects
- Import new sample packs as acquired (monthly)
- Explore preloaded sample progressions for inspiration

**Potential Contributions**:
- **User-generated tags** — Share tagging strategies (e.g., "chill-vibes taxonomy")
- **Sample progression curation** — Submit favorite progressions to community library
- **Social media advocacy** — Share on Reddit (r/edmproduction, r/WeAreTheMusicMakers), Discord, YouTube tutorials
- **Feature requests** — Suggest workflow improvements based on real production needs

**Communication Channels**:
- **In-app onboarding** — First-run tutorial, sample progressions preloaded
- **YouTube tutorials** — "How to Organize Your MIDI Library in 5 Minutes"
- **Reddit communities** — r/edmproduction, r/ableton, r/FL_Studio
- **Discord servers** — Producer communities (e.g., "Beat Making Lounge")

**Success Metrics**:
- 50% of users organize 50+ MIDI files in first month
- 30% return weekly to explore library
- 20% share tool with online communities

---

### 1.2 Music Educators

**Representative Persona**: Marcus Johnson (High School Music Teacher)

**Profile**:
- Age: 30-55
- Background: Conservatory-trained, teaching certification, 5-20 years classroom experience
- Tech proficiency: Medium-high (GarageBand, Soundtrap, Noteflight in classroom)
- Musical background: Formal training (jazz, classical, contemporary)
- Tools: DAWs for demos, notation software for handouts, projector for classroom

**Needs from MIDIcurator**:
1. **Classroom-ready demos** — Load sample progressions instantly, project on screen
2. **Visual + auditory teaching** — Piano roll + chord bar + playback for diverse learners
3. **Shareable examples** — Export MIDI files with chord labels for student homework
4. **Accessibility for diverse students** — Screen reader support, keyboard navigation, high contrast
5. **No installation barriers** — Works on school computers (web-based, no IT approval)

**Engagement Level**: High
- Use MIDIcurator weekly in lesson plans
- Prepare teaching materials (export 10+ progressions per semester)
- Recommend to students and colleagues

**Potential Contributions**:
- **Pedagogical progressions** — Curate teaching examples (theory demonstrations, genre studies)
- **Classroom workflows** — Document best practices ("How to Use MIDIcurator in Music Class")
- **Student feedback** — Observe student usage, report accessibility barriers
- **Professional development workshops** — Present MIDIcurator at teacher conferences (NAfME, state music educators)

**Communication Channels**:
- **Music educator communities** — NAfME (National Association for Music Education), state MEA forums
- **Email newsletters** — Music technology newsletters, teacher resource lists
- **Conference presentations** — TMEA (Texas Music Educators Association), CMEA (California)
- **LMS integration guides** — Documentation for Google Classroom, Canvas, Schoology

**Success Metrics**:
- 50+ educators adopt MIDIcurator in classrooms within 6 months
- 500+ students use tool for homework assignments
- 10+ teachers present at state/national conferences

---

### 1.3 Expert Curators and Session Musicians

**Representative Persona**: Dr. Aisha Okonkwo (Theory-Savvy Curator)

**Profile**:
- Age: 35-60
- Background: Berklee/conservatory graduates, professional musicians, session players
- Tech proficiency: Very high (Ableton Live power users, Max/MSP, command-line tools)
- Musical background: 15-30 years experience, deep theory knowledge
- Tools: Professional DAWs, modular synths, MIDI controllers

**Needs from MIDIcurator**:
1. **Organize vast libraries** — 2,000+ MIDI files accumulated over decades
2. **Advanced filtering** — Search by chord quality, slash chords, voicing types
3. **User override control** — Correct auto-detection errors, persist overrides
4. **Keyboard-first workflow** — Productivity shortcuts, no mouse dependency
5. **Metadata round-trip** — Export MIDI with embedded chord labels, preserve provenance

**Engagement Level**: Very High
- Use MIDIcurator daily for library maintenance
- Import new session sketches weekly
- Generate variants for teaching or performance prep

**Potential Contributions**:
- **Advanced feature requests** — Suggest voicing analysis, harmonic function labeling
- **Bug reports** — Detailed technical reports (e.g., "Enharmonic spelling fails in D♭ major")
- **Community expertise** — Answer questions in forums, write advanced tutorials
- **Sample progression curation** — Contribute expert-curated progressions (bebop, gospel, modal)

**Communication Channels**:
- **GitHub issues** — Technical discussions, feature requests, bug reports
- **Professional forums** — VI-Control, Gearspace (formerly Gearslutz), production communities
- **Conference presentations** — AES (Audio Engineering Society), NAMM, Loop (Ableton conference)
- **Direct email** — Expert feedback, beta testing invitations

**Success Metrics**:
- 10+ expert users become active contributors (GitHub issues, feature suggestions)
- 5+ curated progression libraries shared with community
- 50% of expert users override 10%+ of auto-detected chords (trust + agency)

---

### 1.4 Accessibility-First Users

**Representative Persona**: Riley Chen (Blind Screen Reader User)

**Profile**:
- Age: 15-40
- Background: Musicians with disabilities (blind, low vision, motor impairments, Deaf/HoH)
- Tech proficiency: High (daily screen reader or assistive tech users)
- Musical background: Varies (formal lessons to self-taught)
- Assistive tech: JAWS, NVDA, VoiceOver, ZoomText, Dragon, switch controls

**Needs from MIDIcurator**:
1. **Full screen reader support** — ARIA labels, live regions, text alternatives for canvas
2. **Keyboard-only navigation** — All features accessible without mouse
3. **Plain language** — No visual-only instructions ("click the red button" → "press S for scissors")
4. **Predictable interactions** — No time pressure, explicit state, reversible actions
5. **High contrast themes** — Readable for low vision users

**Engagement Level**: Variable
- Some use MIDIcurator as primary MIDI analysis tool (daily)
- Others use occasionally for learning (weekly)
- High engagement if accessibility is good, zero engagement if inaccessible

**Potential Contributions**:
- **Accessibility testing** — User testing with screen readers (NVDA, JAWS, VoiceOver)
- **Bug reports** — Detailed descriptions of accessibility barriers
- **Advocacy** — Share tool in disability communities (NFB, ACB, Blind Musicians List)
- **Feature suggestions** — Audio cues, braille display support, voice control

**Communication Channels**:
- **Accessibility communities** — National Federation of the Blind (NFB), American Council of the Blind (ACB)
- **Email lists** — Blind Musicians List, VIP Gamers Audio (crossover audience)
- **Accessibility-focused forums** — AppleVis, AudioGames.net, NVDA community
- **Direct outreach** — Contact accessibility advocates for user testing

**Success Metrics**:
- Riley (or real users like Riley) completes onboarding independently in <5 minutes
- Zero WCAG 2.1 AA violations (Lighthouse score ≥95)
- 20+ blind musicians adopt MIDIcurator within 1 year
- Tool featured in accessibility showcase (e.g., NFB Jernigan Institute, Axess Lab)

---

### 1.5 Neurodiverse Musicians

**Representative Persona**: Sam Kowalski (Autistic Pattern-Seeker)

**Profile**:
- Age: 20-50
- Background: Autistic, ADHD, dyslexic, or other neurodivergent musicians
- Tech proficiency: High (programmers, systematic thinkers, power users)
- Musical background: Varies (self-taught to formally trained)
- Preferences: Explicit state, predictable interactions, keyboard shortcuts, low sensory load

**Needs from MIDIcurator**:
1. **Explicit state visibility** — No hidden modes, clear visual indicators
2. **Predictable interactions** — Same action always produces same result
3. **Systematic filtering** — Precise taxonomies ("all augmented chords"), not vague tags
4. **Low sensory load** — No flashing animations, sudden sounds, overwhelming visual noise
5. **Keyboard shortcuts** — Reduce cognitive load from mouse hunting

**Engagement Level**: High
- Use MIDIcurator as primary MIDI organization tool (weekly)
- Create precise taxonomies and tagging systems
- Engage deeply with systematic analysis features

**Potential Contributions**:
- **Detailed feature requests** — Systematic analysis features (e.g., "show chord frequency distribution")
- **Bug reports** — Edge cases, inconsistencies, predictability issues
- **Taxonomy sharing** — Share precise tagging systems with community
- **Advocacy** — Recommend tool to other neurodivergent musicians

**Communication Channels**:
- **GitHub issues** — Technical discussions, feature requests
- **Neurodiversity forums** — r/autism, r/ADHD, Wrong Planet forums
- **Developer communities** — Stack Overflow, Dev.to (crossover audience: neurodivergent devs + musicians)
- **Direct email** — Beta testing invitations, user research

**Success Metrics**:
- 30+ neurodivergent users report "predictable" and "transparent" experiences
- Zero "surprise" interactions reported in user testing
- 50% of users create custom taxonomies (systematic engagement)

---

## 2. Secondary Stakeholders: Indirect Beneficiaries

Secondary stakeholders benefit from MIDIcurator but may not use it directly.

---

### 2.1 Music Students (K-12, College, Adult Learners)

**Profile**:
- Age: 10-70
- Background: Students in music classes, private lessons, online courses
- Relationship to MIDIcurator: Receive curated MIDI files from educators (Marcus)
- Tools: GarageBand, MuseScore, notation software, DAWs

**Needs (Indirect)**:
1. **Teaching materials** — MIDI files with chord labels for homework
2. **Visual demonstrations** — See piano roll + chord bar during class demos
3. **Accessible learning** — Tools that work for students with disabilities
4. **Shareable examples** — Export teacher's examples to practice at home

**Engagement Level**: Low (use outputs, not tool)
- Students receive MIDI files from teachers
- Some students discover MIDIcurator independently (become primary users)

**Potential Contributions**:
- **Feedback via teachers** — Students report usability issues to Marcus, who relays to developers
- **Adoption as they mature** — Students become producers (Jordan), then primary users
- **Word-of-mouth** — Recommend to peers, online communities

**Communication Channels**:
- **Through educators** — Teachers distribute MIDIcurator materials
- **School LMS** — Google Classroom, Canvas announcements
- **Student communities** — School music clubs, online student forums

**Success Metrics**:
- 500+ students use MIDIcurator-generated materials in first year
- 10% of students become direct users (transition to primary stakeholders)

---

### 2.2 Sample Pack Creators and Distributors

**Profile**:
- Companies: Splice, Loopcloud, Producer Loops, LANDR Samples
- Background: Commercial sample library distributors
- Relationship to MIDIcurator: Users import their MIDI packs, analyze, tag

**Needs (Indirect)**:
1. **Metadata enhancement** — Users tag sample packs with harmonic metadata (improves discoverability)
2. **Quality feedback** — If users filter out certain packs, signals quality issues
3. **Community curation** — Users share "best of Splice" curated libraries

**Engagement Level**: Low (observational)
- Sample pack companies may notice users organizing their products
- Potential future partnership (embed MIDIcurator tags in pack metadata?)

**Potential Contributions**:
- **Metadata standards** — Collaborate on harmonic metadata schema for MIDI packs
- **API integration** — Provide APIs for automatic import (Splice, Loopcloud)
- **Curation partnerships** — Feature MIDIcurator-curated collections on platforms

**Communication Channels**:
- **Business development outreach** — Email Splice, Loopcloud partnerships teams
- **Industry conferences** — NAMM, AES, Loop (Ableton)
- **Developer forums** — Splice developer community, Loopcloud SDK docs

**Success Metrics**:
- 1+ sample pack company expresses interest in partnership (2-year goal)
- Community shares "best of Splice" curated libraries (user-generated value)

---

### 2.3 DAW Developers and Plugin Makers

**Profile**:
- Companies: Ableton (Live), Image-Line (FL Studio), Apple (Logic Pro, GarageBand), Cockos (REAPER)
- Background: Digital audio workstation developers
- Relationship to MIDIcurator: Complementary tools (users export MIDI from DAW → MIDIcurator → back to DAW)

**Needs (Indirect)**:
1. **Ecosystem value** — MIDIcurator enhances DAW workflows (organization layer)
2. **Metadata standards** — Round-trip MIDI with embedded chord labels (text events)
3. **Accessibility insights** — MIDIcurator demonstrates accessible music software design

**Engagement Level**: Very Low (observational)
- DAW developers may notice users mentioning MIDIcurator in forums
- Future potential: DAW plugins integrate MIDIcurator-style chord detection

**Potential Contributions**:
- **MIDI metadata standards** — Collaborate on embedded chord label schema
- **Accessibility best practices** — Share accessibility implementation patterns
- **API integration** — Provide APIs for direct DAW-to-MIDIcurator import/export

**Communication Channels**:
- **Developer forums** — Ableton forum, FL Studio forum, Logic Pro X forum
- **Conference presentations** — AES, NAMM, Loop (accessibility + metadata talks)
- **Open-source collaboration** — GitHub discussions, industry working groups

**Success Metrics**:
- 1+ DAW developer references MIDIcurator accessibility features as inspiration (5-year goal)
- Community workflows documented (e.g., "Ableton Live + MIDIcurator workflow")

---

## 3. Tertiary Stakeholders: Ecosystem Support

Tertiary stakeholders support MIDIcurator's mission indirectly through advocacy, infrastructure, or research.

---

### 3.1 Accessibility Advocates and Disability Rights Organizations

**Profile**:
- Organizations: National Federation of the Blind (NFB), American Council of the Blind (ACB), Knowbility, A11y Project
- Individuals: Accessibility consultants, WCAG experts, disability advocates
- Relationship to MIDIcurator: Amplifiers, validators, testers

**Needs (Indirect)**:
1. **Accessible music software examples** — Showcase MIDIcurator as model implementation
2. **WCAG compliance validation** — Test against WCAG 2.1 AA criteria
3. **Community benefit** — Provide accessible tool to blind musicians

**Engagement Level**: Low to Moderate
- Accessibility advocates test tool, provide feedback
- Organizations may feature MIDIcurator in showcases or newsletters

**Potential Contributions**:
- **Accessibility audits** — Expert testing (automated + manual)
- **Advocacy** — Feature in accessibility newsletters, blogs, conference talks
- **Consultation** — Advise on ARIA implementation, screen reader best practices
- **Awards/recognition** — Submit for accessibility awards (e.g., Knowbility's AccessU)

**Communication Channels**:
- **Email outreach** — Contact NFB Jernigan Institute, ACB media team
- **Accessibility conferences** — CSUN Assistive Technology Conference, AccessU
- **Social media** — Twitter hashtags (#a11y, #accessibility), LinkedIn
- **Accessibility newsletters** — WebAIM newsletter, Deque digest

**Success Metrics**:
- 1+ accessibility organization features MIDIcurator (within 2 years)
- Tool passes WCAG 2.1 AA audit by external expert
- Featured in accessibility showcase (e.g., A11y Project, AbilityNet)

---

### 3.2 Music Technology Researchers and Academics

**Profile**:
- Institutions: Music informatics labs (CCRMA, IRCAM, McGill DDMAL), HCI researchers
- Individuals: PhD students, postdocs, professors studying music technology + accessibility
- Relationship to MIDIcurator: Case study, citation, collaboration

**Needs (Indirect)**:
1. **Research artifacts** — Open-source accessible music software as case study
2. **WCAG compliance examples** — Study implementation patterns (ARIA, keyboard navigation)
3. **User studies** — Collaborate on accessibility research (blind musicians + music tech)

**Engagement Level**: Low
- Researchers may cite MIDIcurator in papers
- Potential collaboration on user studies

**Potential Contributions**:
- **Academic citations** — Papers on music technology accessibility, MIDI analysis
- **User studies** — Recruit participants, conduct formal usability testing
- **Algorithm improvements** — Suggest chord detection enhancements based on MIR research
- **Grants** — NSF, NEA, or accessibility-focused grants (e.g., "Accessible Music Technology for Education")

**Communication Channels**:
- **Academic conferences** — NIME (New Interfaces for Musical Expression), ISMIR (Music Information Retrieval), CHI (Human-Computer Interaction)
- **Email outreach** — Contact accessibility researchers, music informatics labs
- **ArXiv preprints** — Publish design documentation as research artifact
- **GitHub** — Researchers discover via open-source codebase

**Success Metrics**:
- 1+ academic paper cites MIDIcurator (3-year goal)
- 1+ collaboration with music technology lab (user study, grant proposal)

---

### 3.3 Platform Hosts and Infrastructure Providers

**Profile**:
- Companies: GitHub (code hosting), Netlify/Vercel (web hosting), Mozilla (IndexedDB spec)
- Background: Infrastructure enabling MIDIcurator's web-first, local-first design
- Relationship to MIDIcurator: Provide platforms for development and deployment

**Needs (Indirect)**:
1. **Showcase projects** — Feature MIDIcurator as example of accessible web app
2. **Open-source ecosystem** — Healthy open-source community on their platforms
3. **Standards compliance** — Demonstrate Web Audio API, IndexedDB use cases

**Engagement Level**: Very Low
- Platforms provide infrastructure, no direct engagement

**Potential Contributions**:
- **Featured projects** — GitHub Explore, Netlify showcase
- **Sponsorship** — GitHub Sponsors, Open Collective funding
- **Technical support** — Priority bug fixes for platform issues

**Communication Channels**:
- **GitHub Community** — Trending repos, GitHub social features
- **Netlify/Vercel showcases** — Submit to featured projects
- **Web standards forums** — W3C Web Audio WG, IndexedDB discussions

**Success Metrics**:
- GitHub repo reaches 1,000+ stars (visibility)
- Featured on GitHub Explore or Netlify showcase

---

### 3.4 Open-Source Contributors and Developer Community

**Profile**:
- Individuals: TypeScript developers, React developers, accessibility specialists
- Background: Volunteers contributing to open-source projects
- Relationship to MIDIcurator: Code contributors, maintainers, community builders

**Needs (Indirect)**:
1. **Meaningful projects** — Contribute to accessible music software with social impact
2. **Learning opportunities** — Learn Web Audio API, ARIA, music theory programming
3. **Portfolio value** — Showcase contributions in job applications

**Engagement Level**: Variable
- Some contributors highly engaged (regular PRs)
- Most casual (occasional issues, one-time PRs)

**Potential Contributions**:
- **Code contributions** — Features, bug fixes, accessibility improvements
- **Documentation** — Tutorials, API docs, user guides
- **Translations** — Internationalization (Spanish, French, Japanese, etc.)
- **Community support** — Answer issues, triage bugs, review PRs

**Communication Channels**:
- **GitHub Issues** — Bug reports, feature requests, discussions
- **GitHub Discussions** — Q&A, community chat
- **Discord/Slack** — Real-time chat for contributors (if community grows)
- **Twitter/Mastodon** — Social media outreach, dev community engagement

**Success Metrics**:
- 10+ external contributors submit PRs (first year)
- 50+ GitHub issues opened by community (signals engagement)
- 1,000+ GitHub stars (developer interest)

---

## 4. Stakeholder Engagement Strategies

### 4.1 Primary Users: Active Engagement

**Goal**: Convert users into advocates and contributors.

**Strategies**:
1. **In-app feedback prompts** — "Enjoying MIDIcurator? Share your favorite feature!" (after 10 uses)
2. **User spotlight series** — Interview Jordan, Aisha, Riley, Sam (real users) for blog posts
3. **Community library** — Enable users to share curated progressions
4. **Beta testing program** — Invite power users to test new features early

**Success Metrics**:
- 20% of active users contribute (tags, feedback, advocacy)
- 5+ user spotlight interviews published

---

### 4.2 Secondary Stakeholders: Passive Monitoring

**Goal**: Understand how indirect beneficiaries use outputs, identify partnership opportunities.

**Strategies**:
1. **Educator surveys** — Ask Marcus-like users: "How do students use MIDIcurator materials?"
2. **Sample pack analytics** — Monitor which packs are most tagged/curated (signals quality)
3. **Industry newsletters** — Subscribe to Splice, Loopcloud, Ableton newsletters (monitor ecosystem)

**Success Metrics**:
- 10+ educators respond to surveys (qualitative insights)
- 1+ partnership conversation initiated (within 2 years)

---

### 4.3 Tertiary Stakeholders: Strategic Outreach

**Goal**: Build credibility, amplify reach, secure long-term support.

**Strategies**:
1. **Accessibility showcase submissions** — Apply to NFB, ACB, A11y Project featured tools
2. **Academic conference papers** — Submit to NIME, ISMIR, CHI (accessibility track)
3. **GitHub community engagement** — Maintain high-quality README, CONTRIBUTING.md, CODE_OF_CONDUCT.md
4. **Open Collective / GitHub Sponsors** — Enable financial contributions from community

**Success Metrics**:
- 1+ accessibility organization features MIDIcurator (within 2 years)
- 1+ academic citation (within 3 years)
- GitHub repo reaches 1,000+ stars (within 1 year)

---

## 5. Stakeholder Communication Plan

### Phase 1: Launch (Months 1-3)

**Primary Users**:
- **Jordan (Casual Makers)**: Reddit posts (r/edmproduction, r/WeAreTheMusicMakers), YouTube tutorials
- **Marcus (Educators)**: Email outreach to music teacher forums, NAfME newsletter submission
- **Riley (Accessibility Users)**: Contact NFB, ACB, AppleVis for accessibility testing

**Secondary Stakeholders**:
- **Students**: Reach via Marcus (distribute sample progressions in classrooms)

**Tertiary Stakeholders**:
- **Open-Source Community**: Publish on GitHub, submit to GitHub Explore, Hacker News

---

### Phase 2: Growth (Months 4-12)

**Primary Users**:
- **Aisha (Expert Curators)**: Conference presentations (AES, NAMM), professional forum posts
- **Sam (Neurodiverse)**: Outreach to r/autism, r/ADHD, neurodiversity communities

**Secondary Stakeholders**:
- **Sample Pack Creators**: Email Splice, Loopcloud partnerships teams
- **DAW Developers**: Submit feature requests to Ableton, FL Studio (integrate MIDIcurator-style detection)

**Tertiary Stakeholders**:
- **Accessibility Advocates**: Submit to CSUN conference, AccessU showcase
- **Researchers**: Email music informatics labs (CCRMA, DDMAL)

---

### Phase 3: Sustainability (Year 2+)

**Primary Users**:
- **Community library launch**: Enable users to share curated progressions
- **User spotlight series**: Blog posts interviewing real users

**Secondary Stakeholders**:
- **Partnership negotiations**: Formal conversations with Splice, Ableton
- **Educator certification program**: Offer "MIDIcurator Certified Educator" badge

**Tertiary Stakeholders**:
- **Grant applications**: NSF SBIR, NEA Arts Grants (accessible music technology)
- **Academic collaborations**: Co-author papers with accessibility researchers

---

## 6. Stakeholder Needs Summary Table

| Stakeholder Group | Primary Need | Engagement Level | Contribution Potential | Communication Channel |
|-------------------|-------------|------------------|----------------------|---------------------|
| **Casual Makers (Jordan)** | Organize sample libraries | Moderate | Social advocacy, tags | Reddit, YouTube, Discord |
| **Educators (Marcus)** | Classroom demos, shareable materials | High | Pedagogical workflows | NAfME, conferences, LMS |
| **Expert Curators (Aisha)** | Advanced filtering, overrides | Very High | Bug reports, features | GitHub, forums, email |
| **Accessibility Users (Riley)** | Screen reader support | Variable | Testing, advocacy | NFB, ACB, AppleVis |
| **Neurodiverse (Sam)** | Explicit state, predictability | High | Taxonomies, bug reports | Reddit, GitHub, forums |
| **Music Students** | Teacher-curated materials | Low | Feedback via teachers | LMS, school communities |
| **Sample Pack Creators** | Metadata enhancement | Low | API integration | Business outreach, NAMM |
| **DAW Developers** | Ecosystem value | Very Low | Standards collaboration | Conferences, forums |
| **Accessibility Advocates** | Showcase examples | Low-Moderate | Audits, advocacy | NFB, ACB, A11y Project |
| **Researchers** | Case studies | Low | Citations, user studies | NIME, ISMIR, CHI |
| **Platform Hosts** | Showcase projects | Very Low | Sponsorship, features | GitHub, Netlify |
| **Open-Source Contributors** | Meaningful projects | Variable | Code, docs, translations | GitHub Issues, Discussions |

---

## 7. Risk Assessment: Stakeholder Conflicts

### Conflict 1: Expert Users vs. Beginners (Feature Complexity)

**Scenario**: Aisha (expert) wants advanced features (voicing analysis, harmonic function). Jordan (beginner) overwhelmed by complexity.

**Resolution**: Design Principle 6 (Progressive Disclosure) — Simple by default, complexity discoverable.

**Engagement Strategy**: Survey both groups, A/B test UI, document "beginner mode" vs. "expert mode" preferences.

---

### Conflict 2: Free Users vs. Sustainability

**Scenario**: MIDIcurator is free and open-source. No revenue model. How to sustain development?

**Resolution**: GitHub Sponsors, Open Collective donations, potential grants (NSF, NEA).

**Engagement Strategy**: Communicate sustainability needs transparently. Offer "Sponsor" badge, acknowledge contributors.

---

### Conflict 3: Accessibility Users vs. Development Resources

**Scenario**: Accessibility features (ARIA, screen reader testing) require significant time. Competing with feature development.

**Resolution**: Design Principle 4 (Accessibility is Foundational) — Accessibility always takes precedence.

**Engagement Strategy**: Prioritize Tier 1 accessibility (critical blockers) before new features. Communicate timeline to Riley-like users.

---

## 8. Related Documents

**Personas**:
- [01-personas.md](01-personas.md) — Primary stakeholder profiles (Jordan, Marcus, Aisha, Riley, Sam)

**Design Principles**:
- [11-principles.md](11-principles.md) — Principle 4 (Accessibility), Principle 6 (Progressive Disclosure)

**Competitive Analysis**:
- [07-competitive-analysis.md](07-competitive-analysis.md) — Market positioning, competitor engagement

**Systems Map**:
- [06-systems-map.md](06-systems-map.md) — Ecosystem context, adjacent tools

**User Journeys**:
- [04-journey-maps.md](04-journey-maps.md) — Primary user workflows

---

## Revision History

- **2026-02-12**: Initial stakeholder mapping (Phase 3 of Design Thinking foundation)
- Future: Update based on community growth, partnership developments, user feedback

---

**Every stakeholder matters. Primary users drive adoption. Secondary stakeholders amplify value. Tertiary stakeholders sustain the mission.**
