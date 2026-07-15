# Master plan

*Started 2026-07-14. The **public** counterpart to the private
`SUITE_AUDIT_AND_PLAN.md` (see [HANDOFF.md](../HANDOFF.md) §5) — that file
stays the planning document of record for the corpus-bound work; this one
carries the parts that belong with the open-source suite: the roadmap
spine, and the product layer (personas → use cases → user testing →
training) that the suite did not have written down yet.*

*This is a living document. It makes commitments about **sequence and
principle**, not dates. Where a claim can drift from the code, it names the
file that is authoritative instead.*

---

## 0. The two things that govern everything

1. **Integration before features.** The moratorium in
   [HANDOFF.md](../HANDOFF.md) §1 still holds: no new features until
   integration is robust. The §1 roadmap below is sorted by that rule —
   the "extend what integrates" work comes before the "new capability"
   work, and each item is tagged accordingly.
2. **The conventions are deliberate** ([CONVENTIONS.md](../CONVENTIONS.md)):
   leftmost = LSB, structural note spelling, derived-statistics-only
   corpus data. Every item below inherits them; none of them are open to
   re-litigation as a side effect of a feature.

---

## 1. Roadmap spine

### 1.1 The unifying insight — the control & interop plane

Four separate-looking wishes are facets of **one** system:

- run every tool headless, driven over MIDI;
- pipe one tool's output into another;
- keyboard and MIDI shortcuts that send messages to a tool ("change the
  pattern");
- expose parameters so they can be modulated and automated.

They all reduce to two primitives — **every tool publishes a named
parameter/command surface**, and **messages flow between tools** — and the
substrate already exists: [`@enkerli/protocol`](../packages/protocol) is a
versioned SysEx-JSON envelope with `from`/`to` routing and `scale` /
`chord` / `progression` / `pattern` message types. What is missing is
small and mechanical relative to the payoff:

- **`param` and `command` message types** in the protocol envelope (with
  vectors, like every other cross-language contract here);
- **a parameter manifest per tool** — a small declared table of
  `{ id, label, range, unit, default }` — so a parameter is addressable
  the same way from a knob, a MIDI CC, a keystroke, or another tool;
- **a binding layer** — key / MIDI-CC → command or param — per app,
  reading the manifest.

Because this is *extension of a shipped foundation* and the whole point is
integration, it sits **inside** the moratorium, not against it. It is the
highest-leverage thread in the suite: done once, it delivers headless-MIDI,
piping, shortcuts, and modulation together.

> Design detail lives in its own spec, started 2026-07-14:
> [CONTROL_PLANE.md](CONTROL_PLANE.md). Its core move — *one message model,
> several transports, two new verbs* (`param`/`command`) — is what makes the
> workspace and the Shortcuts hooks into adapters rather than features.

### 1.2 Roadmap items, sorted by the moratorium

**Tier A — extend what integrates (moratorium-approved):**

| Item | Existing prep | Named gap |
|---|---|---|
| Control/interop plane (§1.1) | `@enkerli/protocol`, `@enkerli/cli`, [HEADLESS.md](HEADLESS.md) | `param`/`command` types; per-tool parameter manifest; binding layer |
| Every tool headless | [HEADLESS.md](HEADLESS.md) inventory | promote `apps/serpe/engine` → `@enkerli/upi`; promote ProgGenie generation → package; **DrawnQurve has no headless path** (its `GestureEngine` test target was never built); CLI entries for PitchFold / MIDIcurator |
| Parameter exposure for modulation | protocol envelope | the parameter-manifest schema (shared with §1.1) |
| Keyboard + MIDI shortcuts | protocol routing | command vocabulary + binding layer (shared with §1.1) |
| Preset / pattern curation (your work) | `createLibraryBrowser` shipped ([UX_AUDIT.md](UX_AUDIT.md) §4 Q2), `@enkerli/library` model | content authoring — coding-light, see §2.4 |

**Tier B — new capability (the "wait" pile; scheduled, not started):**

| Item | Why it waits | Note |
|---|---|---|
| **Polyrhythmic Serpe** — concentric circles + stacked step lanes | genuine new feature; **long-held goal, not pressing** (2026-07-14) | mirrors the just-shipped DrawnQurve polyphonic pattern (commit `5aae20a`); the cheapest new feature to reach because the interaction grammar is proven — so it stays on the shelf, ready, rather than urgent |
| **Single-page movable-module workspace** | large; and it *depends on* §1.1 | modules are only worth co-locating once they share a message bus — so this is **downstream** of the control plane, not parallel to it |
| **Apple Shortcuts / widgets** | platform-specific whim; lowest leverage | naturally becomes cheap *after* §1.1 — a Shortcut is just another sender of a `command`/`param` message |

The ordering claim worth internalizing: **§1.1 makes B2 and B3 small.**
The workspace and the Shortcuts hooks are both "just another client of the
control plane." Building the plane first turns two large/awkward features
into thin adapters.

### 1.3 Polyrhythmic Serpe — the shape (Tier B, sketch)

Parallel to DrawnQurve's polyphony (per-lane qurves, chips + `+` button,
overlaid canvas, one playhead per sounding curve):

- **Concentric circles** = multiple rhythm cycles sharing a center,
  each its own period (the polyrhythm) — the circular analogue of
  DrawnQurve's stacked curves.
- **Stacked step lanes** = the linear view of the same thing: one lane per
  cycle, independently editable, playing simultaneously.
- The **selected cycle** renders at full strength; companions mid-weight;
  a per-cycle playhead. The single-cycle field stays a **mirror** of the
  selected cycle so existing consumers work unchanged — exactly the
  DrawnQurve tactic.
- Engine question to settle first: does `apps/serpe/engine` model one mask
  or many? (This intersects the `@enkerli/upi` promotion — decide the data
  shape once, for both.)

Full spec when we pick it up: `docs/SERPE_POLYRHYTHM.md`.

---

## 2. Product layer

*More product research exists than the roadmaps acknowledged — but it is
**per-tool and unreconciled**, which is exactly the gap "bringing things
together" names. Inventory first, then the skeleton for what's missing
(use cases, a suite-wide test protocol, training).*

### 2.0 What already exists (inventory, 2026-07-14)

- **Suite personas** — [personas.md](personas.md): five design targets
  (wind-controller performer · grid-instrument learner · theory
  explorer/educator · producer curating material · accessibility-first
  performer), used as lenses by [A11Y_TEST_PLAN.md](A11Y_TEST_PLAN.md).
- **MIDIcurator design-research set** —
  `apps/MIDIcurator/docs/design/` (dated 2026-02-12): a full Design-Thinking
  arc — **its own five personas** (Jordan · Aisha · Riley · Sam · Marcus),
  empathy maps, journey maps, scenarios, competitive/stakeholder analysis,
  accessibility audit+plan, and **[15-testing-plan.md](../apps/MIDIcurator/docs/design/15-testing-plan.md)**
  (recruitment matrix, SUS targets, task list). This is the one real,
  written usability-testing protocol in the suite today — tool-scoped, not
  suite-scoped.
- **DrawnQurve user-testing notes** — believed to exist **local-only**
  (pre-April 2026); **not in this repo or its git history.** Action:
  recover and push, then fold into the suite protocol. Until then it is
  at-risk like any unbacked local artifact.

### 2.1 The reconciliation job (the actual §2 work)

There are now **two persona sets** — the suite's five and MIDIcurator's
five — that overlap but were authored independently:

| Suite persona | MIDIcurator analogue |
|---|---|
| accessibility-first performer | Riley (blind, screen-reader) + Sam (neurodiverse, systematic) — **MIDIcurator splits this into two** |
| producer curating material | Aisha (theory-savvy curator) |
| theory explorer/educator | Marcus (educator) |
| grid-instrument learner | — (no analogue) |
| wind-controller performer | — (no analogue) |
| — | Jordan (GarageBand explorer / casual-by-ear) — **no suite analogue** |

The decision to make (not made here): is the suite persona set canonical
with MIDIcurator's as a tool-specific refinement, or do the two merge into a
richer shared set (e.g. splitting accessibility-first into low-vision and
neurodiverse, adding the casual-by-ear explorer)? **Recommendation:** merge
upward into `personas.md` as the single authority (LIS: one controlled
vocabulary), keeping MIDIcurator's richer detail as the worked example.
Every use case below then names the merged persona(s) it serves.

### 2.2 Use cases — *to write*

The missing bridge between personas and features. Shape per use case:

> **Title** · persona(s) · trigger · tools involved · the flow · what
> "success" looks like · which roadmap items it exercises.

Seed set (one strong use case per persona, to be fleshed out):

| # | Persona | Sketch |
|---|---|---|
| U1 | Wind-controller performer | Recall a Vane preset hands-free and switch density to Performance mode from a foot controller — exercises §1.1 command bindings |
| U2 | Grid-instrument learner | Build a fingering in exquisite-fingerings, push its PCS to PickPCS/PitchFold — exercises `scale` messaging (the shipped pair) |
| U3 | Theory explorer/educator | Follow one chord across Chord Dictionary → PickPCS → Progression Studio with synchronized representations |
| U4 | Producer curating material | Batch-tag clips in MIDIcurator, export a Serpe pattern into the DAW, never lose work — exercises library + export idioms |
| U5 | Accessibility-first performer | Drive a full session with keyboard + switch only — the §1.1 binding layer is the enabling feature, not an add-on |

The **cross-tool** use cases (U2, U3, U4) are the ones that justify the
control plane; capturing them well is how we keep §1.1 honest about what it
must support.

### 2.3 User-testing protocol — *generalize MIDIcurator's*

Don't write this from scratch: **MIDIcurator's
[15-testing-plan.md](../apps/MIDIcurator/docs/design/15-testing-plan.md)
already is one** — objectives, a recruitment matrix, SUS>70 and
task-completion targets, quant+qual criteria. The job is to **lift it to
the suite level**: same structure, personas swapped for the merged §2.1 set,
tasks swapped for the §2.2 cross-tool use cases (a MIDIcurator-only plan
can't exercise U2/U3/U4 — that lift *is* the "bringing things together"
work). Skeleton once lifted:

- **Method** — moderated task-based sessions; think-aloud; small-n
  (5 is enough to surface the majority of issues) — as MIDIcurator's plan
  already specifies.
- **Recruitment** — one participant matched to each persona where possible;
  the accessibility-first persona recruited with real assistive tech, not
  simulated.
- **Tasks** — drawn directly from §2.2 use cases (a use case *is* a test
  script).
- **Instrumentation** — what to capture (completion, time, error, quotes),
  and the ethics/consent note (Public-Domain project, but sessions are
  still people's data — no recording without consent, no PII retained).
- **Reporting** — reuse the [A11Y_TEST_PLAN.md](A11Y_TEST_PLAN.md)
  reporting format so accessibility and usability findings live in one
  ledger.
- **Cadence** — when in the roadmap testing happens (proposal: after §1.1
  ships the binding layer, because U1/U5 can't be tested before it exists).

### 2.4 Training & documentation plan — *to write*

Two audiences, deliberately separated:

- **User-facing** — per-tool quickstarts and the cross-tool use-case
  walkthroughs; single-sourced through the existing site pipeline
  ([site.md](site.md) → `build-site.mjs`), copy staying plain and humble
  per the HANDOFF principle. The existing `docs/content/*` (user-guide,
  the-story, architecture) is the seam to extend.
- **Contributor/agent-facing** — the HANDOFF + CONVENTIONS + per-package
  docs already serve this well; the gap is a single index that says "start
  here for X."
- **Reference substrate** (both audiences) — two catalogues started
  2026-07-15, to grow as the docs pass proceeds:
  - [GLOSSARY.md](GLOSSARY.md) — the suite's recurring terms (apps,
    conventions, content model, control plane) in plain definitions.
  - [NOTATION_SYSTEMS.md](NOTATION_SYSTEMS.md) — every way the suite writes
    down a musical object (rhythm · PCS · chord · scale · fingering ·
    voicing), each with its canonical form and authority. The editorial
    goal is a "Rosetta" example per object — one value in all its forms.

The **your-work-heavy** items you named — presets, pattern curation — live
here: they are content authored on top of shipped mechanism
(`createLibraryBrowser`, the library model), and they double as training
material (a curated preset set *is* a lesson).

---

## 3. What this plan is deliberately not deciding yet

- The three-vs-one design-system question — owned by the Design pass
  ([UX_AUDIT.md](UX_AUDIT.md) §4), not this document.
- JUCE independence — owned by [JUCE_INDEPENDENCE.md](JUCE_INDEPENDENCE.md).
- Anything gated on the Apple Developer account (live App-Group inbox) —
  tracked in the private plan doc §6, not re-opened here.

---

## 4. Immediate next actions (proposal)

1. ✅ **Control plane, steps 1–3** ([CONTROL_PLANE.md](CONTROL_PLANE.md) §6)
   — **shipped 2026-07-15**: `manifest` + `param`/`command` types in
   `@enkerli/protocol` (schema, validation, committed vectors) and the
   stdio-NDJSON transport in `@enkerli/cli` (`send`/`recv`/`describe`).
   `enkerli send --to serpe --param density=0.7 | enkerli recv` carries the
   message model over a Unix pipe — headless piping, demonstrated, pure
   package work inside the moratorium. **Next code:** item 4 (pilot manifest).
2. **Merge the persona sets** (§2.1) into `personas.md` as the one
   authority, then **draft the U1–U5 use cases in full** (§2.2) — they
   double as the control-plane requirements check *and* the §2.3 test
   scripts, so they pay for themselves twice.
3. **Recover the local DrawnQurve testing notes** (§2.0) and push them —
   an at-risk artifact until it is in the repo.
4. ✅ **Pilot manifest — Vane** *(shipped 2026-07-15)*:
   `apps/vane/manifest.json` (36 continuous params) +
   `enkerli describe vane`; the pilot surfaced and fixed the `scale`
   (linear/log) gap in the manifest schema.
5. ✅ **Message → sound** *(shipped 2026-07-15)*: `enkerli render --stream`
   applies a control-plane `param` NDJSON stream to Vane's real DSP, so
   `enkerli send --to vane --param morph=1.0 | enkerli render 69 -o out.wav
   --stream` makes audio from a message, headless. The whole plane now runs
   end to end: intent → message → transport → tool → sound.
   **Next choices:** the Serpe / `@enkerli/upi` manifest+promotion (settles
   the polyrhythm data shape too); the shared **binding layer** (key/MIDI-CC
   → param/command, §1.1); or the *time-varying* automation form of
   `--stream` ([CONTROL_PLANE.md](CONTROL_PLANE.md) §7 #6). The
   polyrhythmic-Serpe spec stays shelved (§1.2) until you want it.

*Sequence rationale: 1 and 2 are mutually reinforcing and both sit inside
the moratorium; the spec de-risked the design so the next move is code, not
more planning. Item 4 is the first real fork between "more integration" and
"the fun new feature" — a deliberate choice, not a drift.*
