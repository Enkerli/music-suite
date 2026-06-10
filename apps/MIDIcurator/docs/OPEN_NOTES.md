# MIDIcurator — Open Research & Implementation Notes

This document collects **design notes, research directions, and known issues**
that are not yet fully specified enough to appear as requirements in the main
architecture documents.

Its role is to:
- preserve intent,
- guide future investigation,
- and prevent premature closure of complex questions.

---

## 1. Concordance analysis of melodic patterns

Planned analytical layer for **melodic concordance**, parallel to chord analysis.

Dimensions under consideration:
- **Intervallic**: ordered and unordered intervals, interval vectors
- **Functional**: scale-degree motion, tendency tones, approach patterns
- **Pitch-class**: PC sets, distributions, and recurrence

Goals:
- compare melodic patterns independently of harmony,
- support similarity search for riffs, basslines, and arpeggios,
- enable reuse across harmonic contexts.

Open questions:
- best windowing strategy (per segment vs sliding window),
- how to weight directionality vs interval class.

---

## 2. Functional-harmony-based chord concordance

Current chord concordance is largely symbolic (dictionary-based).

Planned extension:
- reinterpret chord progressions in **functional harmony terms**
  (e.g. T / PD / D, Roman numeral abstractions),
- allow concordance across keys and modes.

This would enable:
- similarity between progressions in different keys,
- functional filtering (e.g. “dominant-heavy patterns”).

---

## 3. Slash chords and bass awareness

Enhancements to chord handling:

- Support **slash chord notation** (e.g. `Dm/F`, `G7/B`)
- Explicit separation of:
  - chord structure,
  - bass function,
  - voicing realization

Implications:
- chord dictionary must encode bass-relative intervals,
- export/import (including metadata) must preserve slash notation,
- basslines can be analyzed independently yet linked harmonically.

---

## 4. Automation spectrum: heuristics → ML (bounded)

Clarify the spectrum of automation used in MIDIcurator:

1. Rule-based heuristics (current core)
2. Probabilistic methods (e.g. Markov chains)
3. Lightweight statistical models
4. Traditional ML (explicit features, supervised or semi-supervised)

Explicit boundary:
- **stop before unsupervised “black-box” AI**
- maintain interpretability and musical inspectability

Use cases:
- generating plausible variants,
- suggesting next patterns,
- estimating stylistic likelihood.

---

## 5. Pattern families & instrumental roles

Deepen pattern analysis by **instrumental function**:

- chord comping (piano, rhythm guitar, clavinet),
- basslines,
- pads,
- drum patterns.

Each family emphasizes different dimensions:
- comping: rhythm + voicing density
- bass: register + function
- pads: harmonic spread + sustain
- drums: metric and accent structure

Goal:
- avoid one-size-fits-all analysis,
- tailor concordance and similarity per role.

---

## 6. Concentric clarity & double-diamond processes

Design principle for both UX and analysis:

- **concentric circles of clarity**:
  - coarse understanding first,
  - finer detail revealed progressively.

- **divergent–convergent workflows** (double diamond):
  - explore many variants,
  - then narrow meaningfully.

This principle should inform:
- density/intensification controls,
- similarity browsing,
- onboarding flows.

---

## 7. Interaction & usability notes

### 7.1 Timeline zoom
Obvious but missing affordance:
- zooming the piano roll timeline
- essential for segmentation precision and dense patterns

### 7.2 iPadOS selection issues
Observed issue:
- selecting a region for segmentation does not work reliably on iPadOS

Likely causes:
- touch vs mouse event handling,
- missing pointer capture or gesture differentiation.

Requires targeted testing on iPadOS.

---

## 8. Known alignment bug

Example:
- `Jazz Minor Full Prog Clip 2:2 2023-12-25 17:40:25.mid`

Observed behavior:
- chord bar does not align correctly with piano roll

Likely areas to investigate:
- PPQ vs bar grid calculation,
- time signature parsing,
- rounding or off-by-one errors in scope boundaries.

This should be treated as a **correctness bug**, not a cosmetic issue.

---

## 9. Status

All items in this document are:
- intentionally unresolved,
- tracked as **research or design debt**,
- and expected to evolve into formal specs or roadmap items.

---

## Design reminder

> Preserve meaning before optimizing mechanism.
