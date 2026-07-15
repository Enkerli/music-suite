# Suite personas

Design targets for every app in the suite. Each feature should name which
personas it serves; accessibility review checks against all of them.

*This is the **single authority** for personas (reconciled 2026-07-15). It
merges the suite's original five role-based targets with MIDIcurator's five
named personas (`apps/MIDIcurator/docs/design/01-personas.md`), which stay as
the **worked example** — richer demographics, quotes, and success metrics for
the personas they inform. Two personas were **added** in the merge: the
by-ear newcomer and the systematic maker, both real design targets the
role-based set had no seat for. See the reconciliation note at the end.*

---

## 1. Wind-controller performer
Plays Vane from a Sylphyo/EWI/breath controller, often standing, on stage or
in rehearsal. Eyes mostly off-screen, one hand free at best.
**Needs:** large targets, high contrast, density toggle ("Performance" mode),
state legible at a glance, zero modal dialogs during play, hands-free control
(the control-plane bindings serve this directly).

## 2. Grid-instrument learner
Explores an Exquis or Launchpad-style grid; uses exquisite-fingerings to
build comfortable fingerings. Thinks spatially.
**Needs:** faithful grid geometry, left/right-hand parity, fingering overlays,
note-name/PC/MIDI label modes, save/recall of patterns.

## 3. Theory explorer / educator
Uses PickPCS, the Chord Dictionary, and Progression Studio to understand and
teach set theory and harmony. Cares about correctness and nomenclature; often
demonstrating to a class or a bandmate.
**Needs:** multiple synchronized representations (PCS ↔ names ↔ Roman
numerals), precise labels, screen-reader-meaningful structure, citations for
algorithms, a clean "show one idea" mode for teaching.
★ *Grounded in MIDIcurator's **Marcus Johnson** (music educator).*

## 4. Producer curating material
Lives in MIDIcurator and Serpe inside a DAW workflow. Values speed, batch
operations, and never losing work; may have deep theory knowledge and want
the tool to respect it, not condescend.
**Needs:** keyboard shortcuts, drag-and-drop, fast search/tagging, reliable
MIDI export, undo, a library that scales past a few hundred items.
★ *Grounded in MIDIcurator's **Dr. Aisha Okonkwo** (theory-savvy curator).*

## 5. Accessibility-first performer
Limited fine motor control, switch access, low vision, or blindness; performs
and works with whatever input works, including a screen reader. The suite's
collapsible-density layout grammar exists chiefly for this persona — and
benefits everyone. A saved keyboard/switch **control-map** is their instrument
layout, a first-class thing they keep and recall.
**Needs:** full keyboard operability, generous targets, no color-only
encoding, configurable density, reduced motion honored everywhere, and — for
the non-visual facet — meaningful structure, labels, and live-region feedback
that a screen reader can actually voice.
★ *Grounded in MIDIcurator's **Riley Chen** (blind learner, JAWS/NVDA).*

## 6. Curious newcomer
Self-taught, learns by ear, no formal theory vocabulary; discovers patterns
they like without being able to say why. Wants to explore and understand
*a little more* without being buried in terminology or made to feel behind.
**Needs:** an approachable first screen, sound-first exploration (hear before
you read), plain-language explanations offered but never forced, gentle
on-ramps from "that sounds cool" to "here's what it is."
> "I want to find cool patterns without having to know what a seventh chord is."
★ *Grounded in MIDIcurator's **Jordan Martinez** (GarageBand explorer). Added
in the merge — the role-based set assumed expertise this persona doesn't have.*

## 7. Systematic maker
Thinks in systems and patterns (often neurodivergent); comfortable at a
command line; drawn to tools with **explicit, predictable** controls rather
than ambiguous artistic metaphors. Frustrated by hidden state, vague errors,
and irreversible actions. The suite's headless CLI, self-describing manifests,
and validate-before-you-act tooling serve this persona almost by construction.
**Needs:** visible state ("what mode am I in?"), predictable and reversible
actions, precise taxonomy over vague tags, specific error messages (what's
wrong *and* how to fix it), and a scriptable/inspectable path for everything
the GUI does.
> "I need to know what will happen when I click something. Surprises are stressful."
★ *Grounded in MIDIcurator's **Sam Kowalski** (autistic, systematic). Added in
the merge — a distinct cognitive-style design driver, not an accessibility
subtype of #5.*

---

## Dimensions that cut across every persona

Some traits are not personas but **axes** to check every persona against:

- **Assistive technology** — screen reader, switch access, keyboard-only, low
  vision. Most visible in #5, but any persona may bring it.
- **Cognitive style** — needing explicit state and predictability (most
  visible in #7) helps everyone; it is a lens, applied broadly.
- **Expertise** — from #6 (no vocabulary) to #4 (deep knowledge). The same
  tool should not condescend to one nor overwhelm the other; progressive
  disclosure is how both are served.

## Reconciliation note (2026-07-15)

How the two prior sets map onto these seven:

| This set | Suite (prior) | MIDIcurator (named) |
|---|---|---|
| 1 Wind-controller performer | ✓ | — |
| 2 Grid-instrument learner | ✓ | — |
| 3 Theory explorer / educator | ✓ | Marcus |
| 4 Producer curating material | ✓ | Aisha |
| 5 Accessibility-first performer | ✓ | Riley (non-visual facet folded in) |
| 6 Curious newcomer | — (**added**) | Jordan |
| 7 Systematic maker | — (**added**) | Sam |

The decision made here: **keep the role-based backbone** (it covers the
instrument/performance world MIDIcurator's set never did), **enrich** roles 3–5
with the named personas' detail, and **add** 6 and 7 rather than fold them in
(each is a genuinely distinct design target). MIDIcurator's document stays the
worked example for the personas it details; it should point here as the
canonical set. *Open call for the maintainer: whether #7 (Systematic maker)
stays a full persona or collapses into the cross-cutting "cognitive style"
dimension — kept as a persona here because the suite's headless/explicit design
serves it so directly.*
