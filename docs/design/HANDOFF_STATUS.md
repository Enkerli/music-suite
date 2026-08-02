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

| §3.1 Duration arcs | **Approved by Alex and shipped.** Arcs replace the fixed wedge in the poly rings, each stopping `0.4` of a step short of the next onset, with a filled onset node proud of the arc head. `onsetArcPath` takes a `gate` fraction (1 today) — Alex's note that this "will build on for gate duration" is the reason it is a parameter and not a constant. |
| §3.2 Trigger readout | Plumbing shipped: `polyState` now carries each lane's trigger ordinal, read from `sceneVisits` (which progressive offset is already derived from, so number and sound cannot disagree). The chip renders per lane in the plugin. **Standalone shows nothing** — correctly, rather than inventing a number; the webapp has no per-lane trigger count of its own yet. |

## Resolved — the arc conflict

**The handoff asks to replace the ring's onset wedges with duration arcs.**
`@enkerli/ui/rhythm-views` (then `engine/render.js`) carries the opposite instruction, dated 2026-07-21:

> *An earlier pass tried "onset-to-next-onset" arcs; screenshots showed that
> model always fills the WHOLE circle for any pattern with 1+ onset (a cyclic
> partition, so there is never actually a gap to read) — the fixed-slice model
> is what Alex specified from an earlier version of this exact visualization.*

The new handoff **does** answer that objection — trim each arc `0.4 * TAU / n`
short of the next onset, and draw a discrete onset node proud of the arc; it
names this "the fix for the continuous-ring regression". So it is not the naive
version that failed.

**Alex reversed it, 2026-08-01:** *"Duration arcs are an improvement, now that
their issues have been solved."* Shipped. The all-onset case — where arcs tile
the cycle and the first attempt closed into a ring — is now a test.

One thing kept **against** the handoff: it proposes `--es-dim-pressure` as
lane 1's hue, but that is the accent token, and `POLY_RING_COLORS` already
excludes its alias `rose` for exactly that reason. A lane whose base colour is
the accent colour cannot show its own accents.

## Also waiting, and why

- **The trigger chip in standalone.** The engine feeds it in the plugin; the
  webapp would need its own per-lane trigger count. Deliberately not faked.
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
