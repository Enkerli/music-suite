# Design handoff — what landed, what is waiting on a call

*Serpe Poly Views & Explainability, received 2026-08-01. Source:
[HANDOFF_SERPE_POLY_2026-08](HANDOFF_SERPE_POLY_2026-08.md), answering
[DESIGN_BRIEF](../DESIGN_BRIEF.md) §3–4.*

Implemented as design only — **no behaviour changed**, per Alex: the design
agent has limited ability to verify code, so this pass moves labels, marks and
text, not logic.

## Landed

| Item | What |
|---|---|
| §3.3 Lane alignment | The control was "Timing lock" with options **Cycle** / **Step** — neither word said polyrhythm or polymeter, which is how a DAW session concluded polymeter was unimplemented. Now **Polyrhythm** *(one shared cycle)* / **Polymeter** *(shared step · drifts)*, two-line segments. Values `cycle`/`step` unchanged, so state, localStorage and the host parameter are untouched. |
| §4 Non-visual route | The rings' `aria-label` said "Poly lane rings" — that a picture exists. It now says the pattern: *"2 lanes. Lane 1: 3 of 8 steps, on 1, 4, 7; accented on 1, 7. Lane 2: 3 of 7 steps, on 1, 3, 5."* Onset **positions**, not counts, because "3 of 8" is true of many rhythms and which ones is the point. Five tests, including one asserting the SVG carries exactly what `describeLanes` returns. |

## Waiting on Alex — a direct conflict, not an oversight

**The handoff asks to replace the ring's onset wedges with duration arcs.**
`engine/render.js` carries the opposite instruction, dated 2026-07-21:

> *An earlier pass tried "onset-to-next-onset" arcs; screenshots showed that
> model always fills the WHOLE circle for any pattern with 1+ onset (a cyclic
> partition, so there is never actually a gap to read) — the fixed-slice model
> is what Alex specified from an earlier version of this exact visualization.*

The new handoff **does** answer that objection — trim each arc `0.4 * TAU / n`
short of the next onset, and draw a discrete onset node proud of the arc; it
names this "the fix for the continuous-ring regression". So it is not the naive
version that failed.

But it reverses a call Alex made on screenshot evidence a fortnight ago, and
that is his to reverse, not mine. **Not implemented.** The geometry is fully
specified in the handoff if the answer is yes.

## Also waiting, and why

- **§3.2 trigger readout chip.** Highest value in the brief. Needs a live
  per-lane trigger index from engine state ("fed from engine state, never
  recomputed"), and the bridge does not send one — so it is a small plumbing
  change, i.e. behaviour, which this pass excluded.
- **Rings as the single primary view, rows demoted.** A default change; wants
  the arc question settled first, since it is what makes rings carry the story.
- **Default flip to Polymeter for fresh patterns.** The handoff marks this
  "needs product sign-off". It is a UI default only, no engine change.
- **Workspace key-listener scoping.** Real behaviour, and a11y-blocking. Filed
  in [DESIGN_BRIEF](../DESIGN_BRIEF.md) §4 rather than done here.
- **§3.5 accent two-channel.** Partly there already: the rings encode an accent
  as hue **and** a wedge that pokes further out. The handoff adds a transpose
  spoke tagged `+5`; worth doing with the arc work, since both touch the same
  renderer.

## Already landed from the earlier round (2026-07-20 answers)

`.mtilt-wordmark` and `.es-knob` are in `packages/ui/tokens/components.css`.
`.es-hold-pad` is deliberately absent — that answer said "if a second
performance module ever needs it", and none does yet.
