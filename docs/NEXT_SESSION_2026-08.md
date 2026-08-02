# Next session — plan

*Written 2026-08-01 as this session closed, from ten items Alex named. Lives
here rather than in a scratch plan file so it survives the session that made
it. Companion to [SERPE_NEXT](SERPE_NEXT.md) (which covers the repair arc, now
closed) and [DESIGN_BRIEF](DESIGN_BRIEF.md) §3 (the open design calls).*

## Context

The 2026-07-27 → 08-01 stretch closed a long arc: progressive state is owned
(no process-wide statics left), poly lanes accent and persist, the webapp
advances poly and mono progression, duration arcs shipped, and the sounding
pattern is one named, enforced source. Everything below is *new* work rather
than repair, with one exception (F5).

Alex named ten items. They fall into four tracks with one hard dependency: the
**timing chain gates F5 and informs drum→pattern quantization**, so it leads.
Vane is sketched only — different repo, different context load.

Ground truth this plan is built on:

- `msuite upi --midi` is poly-aware as of `ab40342` and renders **step lock**;
  the plugin's `Poly Lock` **defaults to Cycle**. A capture and the baseline
  will not match until this is reconciled. **This is the first blocker.**
- `serpe_dataflow_probe` writes real-timed `.mid` (Serpe `26a6680`).
- `.dawproject` is zipped XML — clips parsed out of Alex's in a few lines this
  session, so a Bitwig capture→assert loop is cheap.
- `parseNamedPatterns` already exists (`packages/upi/src/named.js`); the shipped
  vocabulary is only `tresillo`/`cinquillo`/polygons in `upi.js` `SHORTHAND`.
- `onsetArcPath` + `interOnsetSteps` exist in `apps/serpe/engine/render.js`.

---

## Track A — Timing analysis from MIDI *(lead)*

**Why first:** it is the only item other work depends on, and it converts F5
from "unreproduced" to "measurable".

### A1. Reconcile the lock modes *(blocker, do before anything else)*
`packages/cli/src/cli.ts` `--midi` renders step lock. Either add render-side
cycle lock behind `--lock cycle|step` (defaulting to `cycle` to match the
plugin), or change the plugin default. **Recommend the flag** — a default flip
is a behaviour change needing sign-off, and the handoff already proposes one
separately.

### A2. A `.mid` analyser
New `tools/midi-timing.mjs`. Reads an SMF, reports per-note tick positions,
inter-onset deltas, and a verdict against an expected pattern. The SMF parser
written ad hoc this session (in scratch) is the starting point — ~40 lines,
handles running status and tempo meta.

Assert on **ticks**, not ms: tempo-independent and exactly what a DAW capture
carries.

### A3. Baseline corpus
Render a fixed set through `msuite upi --midi` and commit the expected tick
tables as vectors — same discipline as `serpe_conformance`. Cover: plain mono,
`PD(…)` microtiming, poly step-lock drift (`E(3,8)/E(3,7)` → lane 2 starts its
second cycle at 840 while lane 1 starts at 960), per-lane `@` offsets, accents.

### A4. F5 — the S1 runaway *(attempted 2026-08-02 — narrowed, still open)*
Found and fixed five process-wide statics in `processBlock` along the way
(Serpe `1eb66a5`) and confirmed Alex's project runs two Serpe instances — but
**two reproduction attempts failed**, so the static is not shown to be the
cause. See SERPE_DAW_FINDINGS F5 for where to look next.

Only after A2. The capture showed inter-onset gaps of **0.0195 / 0.039 beats**
= 9.75/19.5 ms at 120 BPM ≈ 468/936 samples — buffer multiples, not
subdivisions. Suspects, in order: the tick edge is level-triggered against
`lastTickState`, so a host writing that parameter every block makes every block
an edge; and MIDI feeding back into the same track.

### A5. `.dawproject` test protocol
Document the loop: render baseline → capture in Bitwig → unzip → parse
`project.xml` clips → diff against baseline ticks. Bitwig-first is right: it is
where timing was worst a year ago, so passing there is the stronger signal.

---

## Track B — Visual, while the design pass is fresh

### B1. Mono ring duration arcs
`createCircleView` still uses `stepWedgePath` (`render.js:181`). Port
`onsetArcPath`/`interOnsetSteps` across — they are already written and tested.

**Keep:** the CoG vector (`render.js:188`, single-ring analytic, mono-only) and
the playhead wedge (`:204`). **Do not** adopt the handoff's lane hues —
`--es-dim-pressure` is the accent token, and `POLY_RING_COLORS` already excludes
its alias for that reason.

### B2. Workspace visualization modules
`apps/workspace/modules.js:96` uses `parseUPI` — mono only, so no poly, scenes
or progressive. Fixing it *is* the design question of what a lane-aware module
looks like.

Mostly hosting, not building: `packages/ui/components/` has `pcs-ring.js`,
`piano-roll.js`, `pitch-grid.js`. Wanted: steps **and** circle for UPI, PCS
circles, piano-roll for clips and progressions — noting that a progression
(harmonic blocks) and a clip (notes over time) are different problems sharing a
name.

Apply the layering rule: **user input → `parsePolyUPI`; only library internals →
`parseUPI`.**

### B3. Polygon mode, as a didactic layer
Deliberately removed once (the Lascabettes differentiator). Bringing it back
**superimposed** on arcs, for tutorials, is additive rather than a revert —
interlocked polygons across lanes show why 3-against-4 interlocks. Gate it as an
explicit teaching view so it cannot be mistaken for the identity view.

---

## Track C — Drums: corpus in, patterns out

### C1. Drum MIDI → pattern, meter-aware
Nothing exists; this is new. The hard part is **not misreading triplets as
swung sixteenths**. Approach: score candidate grids (16ths, 8th triplets, 16th
triplets) against onset residuals and pick by fit, rather than snapping to a
fixed grid. Report the chosen grid and confidence — explainability (INTENT B5)
applies here more than anywhere.

Output is UPI, so `packages/upi` round-trips it and Serpe plays it.

### C2. Learn from a drum corpus — GloriArp for grooves
`packages/accompaniment/src/` (17 files: `model.ts`, `features.ts`,
`extract.ts`, `rhythm.ts`, `pipeline.ts`) and `packages/corpus-tools/src/`
(`transitions.ts`, `improvisor.ts`) are the machinery.

**The structural difference Alex named: a MIDI note is a LANE.** That maps
directly onto poly — a learned groove is a poly pattern with per-lane note
numbers, which the engine already plays. Depends on C1 for its input.

**Corpus stays local and unpublished (D7); only derived statistics ship.**

### C3. GloriArp learning improvements
Quantize, then add variability back deliberately. Plus a **nested analysis**,
the analogue of ProgGenie's depth — grooves have hierarchy (bar, beat,
subdivision) the flat transition table cannot express.

---

## Track D — Bell patterns / timelines

Smallest item, real value. `parseNamedPatterns` already accepts
`Name: spec` with onset lists and any UPI. Author a **curated, named catalogue**
of claves, bell patterns and agogo timelines and ship it as data.

Naming matters and is contested territory — prefer specific attributions over
generic labels, and state provenance per entry. Copy tone applies: plain, no
overclaiming.

Also worth resolving: the relationship between this catalogue and `SHORTHAND` in
`upi.js`, so there is one vocabulary rather than two.

---

## Track E — Vane *(sketch only, separate session)*

- **Non-expressive controllers.** Vane likely already accepts plain note input;
  the gap is prominence. A named default patch that sounds good from a sequencer
  with no breath/MPE would make Vane usable from Serpe and the CLI directly.
- **Patch generation + breath-curve testing.** `Vane/tools/` already has
  `PresetGen`, `RenderProbe`, `SelfTest`, `PresetExport` — the PhysMod-lab
  machinery exists; this is a targeted campaign, not new tooling. Waveguide
  nonlinearity is the reason: **bore damping is dangerous — it can cut the sound
  such that a long rest is needed before it resumes**, which is exactly the kind
  of thing a sweep finds and an ear does not.

---

## Sequencing

| | |
|---|---|
| ~~1~~ | ~~**A1** lock-mode reconcile~~ — done, `81bcf92` |
| ~~2~~ | ~~**A2 + A3** analyser and baseline vectors~~ — done, `44f6e62` / `35700f7` |
| 3 | **A4** F5 — attempted, narrowed, still open |
| 4 | **B1** mono arcs (cheap, self-contained; good filler between A stages) |
| 5 | **D** bell catalogue (content, no machinery) |
| 6 | **C1** drum→pattern quantization |
| 7 | **B2** Workspace viz — wants the design call on lane views |
| 8 | **C2 / C3 / B3** larger, and each depends on the above |

E whenever a Vane session happens.

---

## Verification

- **Every stage:** `npx vitest run` in `music-suite` (1682 now), and in the
  Serpe repo `serpe_conformance`, `serpe_poly_conformance`,
  `serpe_microtiming_conformance`, `serpe_poly_precedence`,
  `serpe_dataflow_probe`, plus `cmake --build build --target Serpe_Standalone`
  (test targets do not link the editor).
- **Track A specifically:** assert tick positions, not "it sounds right". The
  baseline is only trustworthy if a deliberately wrong pattern fails it — verify
  each new assertion by breaking it once, as with `serpe-poly-shared-key` and
  the state roundtrip.
- **Anything in the webapp:** load it. Three bugs this week compiled, passed
  every test, and were broken in the browser — including one that only appeared
  on reload, from a value left in localStorage.
- **Respect:** INTENT D1 (leftmost = LSB), D3 (engine authoritative), D6
  (trigger 1 is the base), D8 (accents are per-lane), D7 (corpus never
  published), and the `soundingPattern` invariant — it now throws in dev.
