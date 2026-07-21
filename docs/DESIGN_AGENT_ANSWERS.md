# Design answers — 2026-07-20

*Replies to `docs/DESIGN_AGENT_QUESTIONS.md`. Each answer is a
buildable spec, not a mood. Token names are from `tokens.css` /
`components.css` — use them verbatim, never guess a `var(--*)`.
Everything here is reversible; where a call is a judgement, it says so.*

---

## 1 + 2 — Serpe rings: keep the bones, own them with **arcs**

**Decision: keep the concentric-ring model and the geometry already
shipped. Differentiate from Lascabettes's Rhythmic Circle by drawing
onsets as *duration arcs*, not dots + an onset polygon.**

This is the original Rhythm Pattern Explorer / Serpe language and it is
the right differentiator: Lascabettes marks onsets as points and joins
them into a polygon. We mark onsets as **arc segments swept along the
ring**, so a rest is a *gap* and the ring silhouette itself encodes the
rhythm. Different reading, same honest geometry — no coincidence to
apologise for.

### What an arc is

For a ring of radius `r` with `n` steps, an onset at step `i` is drawn as
a stroked arc **from step `i` to the next onset step `j`** (its
inter-onset interval — the sounding duration). Rests leave the track bare.

- Reuse the existing helpers in `render.js`: `ang(i,n)` (step 0 at 12
  o'clock, clockwise) and `pol(cx,cy,r,a)`.
- Path per onset arc:

  ```js
  const a0 = ang(i, n), a1 = ang(j, n);           // j = next onset (may wrap)
  const [x0, y0] = pol(cx, cy, r, a0);
  const [x1, y1] = pol(cx, cy, r, a1);
  const sweep = ((j - i + n) % n) / n;              // fraction of the ring
  const large = sweep > 0.5 ? 1 : 0;
  // clockwise, so sweep-flag = 1
  arc.setAttribute("d",
    `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`);
  ```
- `stroke: <lane hue>`, `stroke-width` ≈ ring thickness (see below),
  `stroke-linecap: round`, `fill: none`. The rounded cap at the onset
  edge is the "attack"; the trailing cap is the release.
- **Accent** = a short radial **tick** straddling the arc's leading edge
  (a spoke `r-6 → r+6` at `ang(i,n)`, `stroke-width` 2.5), *plus* a
  heavier arc stroke. Two channels, never colour alone (accessibility
  ground rule in `tokens.css`).
- A single onset spanning the whole cycle draws as a near-complete ring
  with one gap at its own step — correct and legible.

### Ring layout (Q2 calls — all **kept**)

- **Outer → inner in lane order.** Keep. Lane 0 outermost.
- **Downbeat anchored at 12 o'clock across all rings.** Keep, hard —
  this is what lets the eye read polyrhythm across lanes. `ang()` already
  does it.
- **No per-ring onset polygon.** Keep. Polygons are the Lascabettes
  idiom and stacked polygons across rings would be noise. The duration
  arc replaces it.
- **Guide track:** each ring keeps a faint full-circle guide
  (`stroke: var(--es-border)`, width 1) under its arcs so empty lanes and
  rests stay visible.
- **Ring geometry:** outermost `R = 118` (as today). Step inward by a
  fixed `ringGap` per lane: `r_k = 118 - k * (ringWidth + ringGap)`,
  `ringWidth ≈ 10`, `ringGap ≈ 8`. Arc `stroke-width = ringWidth`. Caps
  the readable lane count at ~5 in the 320 viewBox — that is fine; beyond
  that, fall back to the linear `createStepView` (already exists).

### Lane colour

Per-lane hue, **not** a uniform stroke (another Lascabettes departure).
Pull from the pitch-class ramp `--es-pc-0 … --es-pc-11` (already
theme-tuned for ≥3:1) indexed by lane, or keep the current named-lane map
(`ink → --es-accent`, `rose → --es-dim-pressure`, `moss → --es-dim-expr`,
`plum → --es-dim-slide`) for ≤4 lanes. Pair every lane with its text
label in the legend — colour never identifies alone.

### Playhead

One **shared radial sweep line** from centre crossing *all* rings at the
current step angle (not a per-ring wedge). Keeps the "one clock, many
tracks" reading. `stroke: var(--es-fg)`, width 1.5,
`opacity` easing on `--es-motion-fast`.

### Center-of-gravity

CoG is a single-ring analytic; in the multi-ring view show it only for
the *focused* lane (on hover/selection), reusing the existing dashed
vector + dot. Don't stack CoG vectors across rings.

---

## 3 — MIDIcurator morph controls: **knobs, but they are sliders underneath**

**Decision: knob-style widgets, because 4–5 simultaneous mutation dials
want the compact "mixing board" read. But the skeuomorphism is *visual
only* — the interaction contract is exactly our slider/stepper contract,
so pointer use stays as convenient as a slider.**

You are right that circular-drag knobs are hostile to a mouse. We do not
ship circular drag. A Curator knob is **"a slider that looks like a
knob"**:

### Interaction contract (identical to a range slider)

- **Vertical drag** to change (up = increase). Never angular/circular
  drag. Drag distance → value is linear; `~200px` of travel spans the
  full range.
- **Shift-drag** = fine mode (¼ step or finer).
- **Wheel** over the knob nudges by one step (only when focused or
  hovered-with-intent; guard against scroll hijack).
- **Keyboard** (focused): `↑/↓` and `←/→` = ±step, `PageUp/Down` =
  ±large step, `Home/End` = min/max. Same as a slider.
- **Double-click** (or long-press on touch) = reset to default.
- **Click-to-type:** the value readout is an editable field — click,
  type a number, Enter.
- **Touch:** ≥ `var(--es-touch-target)` (44px) hit area on
  `(pointer: coarse)`, per tokens.

### ARIA / semantics

`role="slider"`, `aria-valuemin/-max/-now`, `aria-valuetext` (e.g.
"pocket +12%"), `aria-label` per dial. A screen reader cannot tell it
from our sliders — that is the point.

### Visual

- Circular body, `var(--es-bg-sunken)` well, `var(--es-border-strong)`
  ring (identifies the control, ≥3:1).
- **Indicator arc**, not just a pointer notch: sweep an arc around the
  knob from min to current in the dial's accent — reuses the Serpe arc
  language, so knob + ring visualiser feel like one family.
- **Always-visible numeric readout** below the knob
  (`.es-num`, tabular-nums). No mystery dials.
- Assign each mutation dial one dimension hue from the Vane vocabulary
  (`--es-dim-*`) so notes / pocket / rests / accents are colour-coded and
  labelled.
- Respect `prefers-reduced-motion` (no inertial spin).

### The slide control stays a toggle

The slide mutation is binary — keep it a toggle/switch, set slightly
apart from the knob row so it doesn't read as a fifth dial.

**Net:** compact instrument look, zero loss of pointer/keyboard
convenience. Build it once as a shared `.es-knob` primitive in
`components.css` and MIDIcurator, Serpe (tempo/swing), and any future
dial reuse it.

---

## 4 — PitchFold Mono Merge / Swing in Workspace: **inherit chrome, one expressive affordance**

**Decision: it lives in Workspace's plain module chrome (the `.es-section`
/ `.es-panel` shell), and earns exactly *one* bespoke element — the
hold-to-mono gesture pad. Everything else is standard Workspace.**

A performance-feel router shouldn't fracture Workspace's utilitarian
consistency with a custom skin. But "hold to mono" is a *momentary
gesture*, not a setting, and it must not look like the static toggles
around it. So:

### The Mono Merge pad (the one expressive element)

- A **momentary hold pad**: large rounded-rect / pill, min 56px tall,
  full module width, `var(--es-touch-target)` honoured.
- Rest state: outline pad, `var(--es-border-strong)`, label
  `HOLD → MONO`.
- **Held state:** fills with `var(--es-dim-slide)` (the routing/gesture
  hue — Mono Merge is a note-router, and `slide` is our
  gesture/routing dimension), `--es-accent-fg` label, plus an **inset
  ring that closes** as a hold-progress indicator (a Serpe arc again,
  animated on `--es-motion-fast`). Releasing springs it back.
- Two channels for the active state (fill **and** ring), never colour
  alone.
- Pointer: press-and-hold; touch: press-and-hold; keyboard: Space/Enter
  held = engaged, `aria-pressed`, `role="button"` with a "momentary"
  hint in `aria-label`.

### Swing

Swing is a single continuous amount → a **stepper or the shared
`.es-knob`** from §3, sitting in normal module chrome. No bespoke
treatment. (If Mono Merge and Swing pair on one strip, the knob's
indicator arc visually rhymes with the pad's progress ring — coherent
without extra design.)

This gives the module a performance signal (the pad) while reading as a
first-class Workspace citizen. The pad treatment is defined once and can
graduate into `components.css` as `.es-hold-pad` if a second performance
module ever needs it.

---

## 5 — MTILT wordmark: **plain wordmark now, but commit the typeface**

**Decision: no identity pass yet — but don't default. Ship an interim
lockup with a deliberately chosen face so "interim" isn't "accidental".**

### The interim lockup

- **Face: Inter Tight** (`--es-font-sans`, already loaded suite-wide).
  It is our primary voice, condensed enough to make a tight acronym
  wordmark, and needs no new dependency.
- **All caps**, weight **700**, `letter-spacing: 0.04em`.
- Colour: `var(--es-fg)` on `var(--es-bg)`; the `--es-accent` is
  available for a single accent glyph if ever wanted, but the default is
  monochrome ink.
- **Optional nod to the name:** a subtle **oblique** (`transform:
  skewX(-6deg)` on the wordmark, or Inter Tight's italic) literally
  *tilts* MTILT. Ship upright by default; keep the oblique as a one-line
  variant to try when it first lands in chrome.

```css
.mtilt-wordmark {
  font-family: var(--es-font-sans);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--es-fg);
}
```

### Why defer the full pass

There's no wordmark, lockup, or placement yet beyond the naming
decision. A real identity pass needs the *contexts* — favicon, small app
header, splash, README badge, light/dark — and those don't exist to
design against. Lock the typeface now so every interim appearance is
consistent; do the pass when MTILT actually enters app chrome and we know
the sizes and surfaces it has to survive.

---

*Shared primitives this implies (build once, reuse):*
`.es-knob` (§3, also serves Serpe & Swing) · `.es-hold-pad` (§4, if a
second performance module appears) · the Serpe **duration-arc** renderer
(§1, replaces the onset-polygon path in `createCircleView` and generalises
to the multi-ring view).

---

## Implementation notes, 2026-07-21

**§1+2 shipped, in two passes — the first pass got the arc MODEL wrong,
caught by a real screenshot review, corrected same day.**

**Pass 1 (wrong):** implemented "an onset's arc spans from step `i` to
the NEXT onset step `j`" literally, per the pseudocode above. This is a
cyclic IOI (inter-onset-interval) partition — standard in rhythm-
necklace/Toussaint-style visualizations — but it has a real, non-obvious
property: the arcs for ANY pattern with 1+ onset always sum to the FULL
circle, no matter how sparse. Screenshots of `E(5,8)` and even the
"sparse-looking" `E(3,8)` tresillo both rendered as one continuous ring
with no visible gaps at all — "rests leave the track bare" was never
actually achievable under that model except for the zero-onset case.

**Pass 2 (correct, per Alex's own recollection of an earlier version of
this exact visualization):** each step owns a FIXED, delimited slice of
the ring — `360/n` degrees, not stretched to the next onset — drawn as a
genuine donut-slice wedge (outer arc, radial line in, inner arc back,
close), not a stroked line. Rests draw nothing; the small gap between
adjacent slices (`stepWedgePath`'s `gapFrac`) is the actual delimiter
Alex described ("like slices of a donut"). This also gave the ring a
real HOLE for the first time — both `createCircleView` (a single donut
band, R 34–118) and `createPolyCircleView` (nested donut bands sharing
one hole floor at R 30, so more lanes never shrink the center to nothing)
— "a relatively small hole, mostly meant to avoid moiré effects": the
old full-length center-to-edge spokes were replaced with short stubs
confined to the hole itself, since that's exactly where line convergence
would moiré with more steps.

Accent = fill color (accent-amber) **plus** the slice poking out past its
lane's own outer edge — two channels, same "never color alone" rule as
pass 1's tick-based approach, just expressed through the new wedge shape
instead of a separate line element.

19 render.test.js tests (rewritten again for the wedge/fill DOM shape —
paths carry `fill`, not `stroke`), a real dev-build Playwright pass
across sparse/dense/accented patterns and the 3-lane poly view, all
visibly showing distinct delimited slices this time.

**Deferred, not attempted:** the shared cross-ring playhead sweep line
(needs a continuous cycle-phase value the JUCE bridge doesn't send today
— `lanePh` is a discrete per-lane step index; a per-ring playhead marker
dot ships instead, functionally equivalent, visually simpler) and
CoG-on-focused-lane for the poly view (needs new hover/selection state
that doesn't exist yet). Neither blocks the slice work; both are real,
scoped follow-ups if wanted.

**§3 (knobs):** `packages/ui/components/knob.js` + `.es-knob*` in
`components.css` shipped as the shared primitive; MIDIcurator wiring
in progress. **§4–§5 (Mono Merge pad, MTILT wordmark):** not started.
