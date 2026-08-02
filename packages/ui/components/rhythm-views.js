/**
 * Serpe — visualisers. Three framework-agnostic SVG views over a pattern:
 *   createCircleView(el, opts)     → donut ring + onset slices + playhead + CoG
 *   createStepView(el, opts)       → linear step lane, beat grouping, playhead
 *   createPolyCircleView(el, opts) → nested donut rings, one per poly lane (KT item 9)
 * Onsets draw as delimited donut SLICES, not dots/polygons —
 * DESIGN_AGENT_ANSWERS.md §1, the differentiator from Lascabettes's
 * Rhythmic Circle: each step owns a fixed 360/n wedge, not an arc
 * stretched to the next onset (an earlier pass tried that; it always
 * fills the whole circle — see the doc's "Implementation notes").
 * All expose .update({ ... }) and theme via tokens.
 */
import { centerOfGravity, interOnsetSteps } from "@enkerli/upi";

const NS = "http://www.w3.org/2000/svg";
const TAU = Math.PI * 2;
const el = (n, a = {}) => {
  const e = document.createElementNS(NS, n);
  for (const k in a) e.setAttribute(k, a[k]);
  return e;
};
// step 0 at top (12 o'clock), clockwise
const ang = (i, n) => (TAU * i) / n - Math.PI / 2;
const pol = (cx, cy, r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];

// ── Donut-slice steps (docs/DESIGN_AGENT_ANSWERS.md §1, corrected
// 2026-07-21 after a real screenshot review) ─────────────────────────────
// The differentiator from Lascabettes's Rhythmic Circle: onsets are drawn
// as ring SLICES, not dots + a polygon — each step owns a fixed 360/n
// wedge of the ring (delimited from its neighbors by a small gap), not an
// arc stretched from one onset to the next. An earlier pass tried
// "onset-to-next-onset" arcs; screenshots showed that model always fills
// the WHOLE circle for any pattern with 1+ onset (a cyclic partition, so
// there is never actually a gap to read) — the fixed-slice model is what
// Alex specified from an earlier version of this exact visualization:
// donut slices around a relatively small center hole (kept small
// specifically to avoid moiré where many radial lines would otherwise
// converge). Shared by createCircleView (mono) and createPolyCircleView
// (poly, one donut band per ring, nested).

/** One step's donut-slice wedge between rInner and rOuter, delimited from
 *  its neighbors by a small angular gap (gapFrac of the step's own
 *  angular width, split evenly at both edges). */
function stepWedgePath(cx, cy, rInner, rOuter, i, n, gapFrac = 0.12) {
  const half = Math.PI / n; // half of this step's 360/n slice, in radians
  const gap = half * gapFrac;
  const a0 = ang(i, n) - half + gap;
  const a1 = ang(i, n) + half - gap;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [ox0, oy0] = pol(cx, cy, rOuter, a0);
  const [ox1, oy1] = pol(cx, cy, rOuter, a1);
  const [ix1, iy1] = pol(cx, cy, rInner, a1);
  const [ix0, iy0] = pol(cx, cy, rInner, a0);
  return [
    `M ${ox0.toFixed(2)} ${oy0.toFixed(2)}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${ox1.toFixed(2)} ${oy1.toFixed(2)}`,
    `L ${ix1.toFixed(2)} ${iy1.toFixed(2)}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${ix0.toFixed(2)} ${iy0.toFixed(2)}`,
    "Z",
  ].join(" ");
}

// laneColor() accepts any of the suite's 4 tokens (a caller may still ask for
// 'rose' explicitly, e.g. a mono ring deliberately colored to match another
// view). POLY_RING_COLORS below is the AUTOMATIC per-lane rotation used by
// createPolyCircleView, and deliberately excludes 'rose': it resolves to the
// exact same token as accentAmber (--es-dim-pressure, "this onset is
// accented" everywhere else in the app — mono ring, poly rows). Rotating
// through it as a lane's own base color made that lane's accented onsets
// indistinguishable from its unaccented ones — real lost contrast, not a
// cosmetic nit. 3 colors is enough to keep adjacent rings visually distinct;
// a 5th+ lane repeats the cycle, same as before.
const POLY_RING_COLORS = ["ink", "moss", "plum"];
const laneColor = (lane) => ({
  ink: "var(--es-accent)", rose: "var(--es-dim-pressure)",
  moss: "var(--es-dim-expr)", plum: "var(--es-dim-slide)",
}[lane] || "var(--es-accent)");


// ── Duration arcs (design handoff 2026-08-01, docs/design/) ──────────────
// Supersedes the fixed wedge for the POLY rings. Arcs were tried once before
// and reverted (see the note above): onset-to-next-onset spans tile the cycle
// exactly, so they always closed into a continuous ring with no gap to read.
// The handoff solves that with two changes together — neither is optional:
//   1. every arc stops `trimSteps` of a step short of the next onset, so
//      consecutive arcs cannot touch;
//   2. a filled onset NODE sits proud of the arc at its head, so an attack is
//      a discrete mark even where arcs are long.
//
// `gate` is the hook Alex asked for: the fraction of the inter-onset interval
// the note actually sounds. It is 1 today (arcs run to the next onset, less
// the visual trim), and a real per-lane gate parameter can drive it later
// without touching the geometry.
function onsetArcPath(cx, cy, r, i, ioiSteps, n, { gate = 1, trimSteps = 0.4 } = {}) {
  // Span in STEPS, then trimmed. Floored so a very short gate still draws a
  // visible stub rather than collapsing to nothing.
  const span = Math.max(0.12, ioiSteps * gate - trimSteps);
  const a0 = ang(i, n);
  const a1 = ang(i + span, n);           // ang is linear in i, so this is the trim
  const [x0, y0] = pol(cx, cy, r, a0);
  const [x1, y1] = pol(cx, cy, r, a1);
  const large = span / n > 0.5 ? 1 : 0;  // sweep > 180°
  return `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
}



/**
 * The onset polygon — a DIDACTIC OVERLAY, off by default.
 *
 * Joining a lane's onsets into a closed figure is the Lascabettes Rhythmic
 * Circle idiom, and it was deliberately dropped as this suite's primary
 * language: duration arcs say how long an onset SOUNDS, which a polygon cannot,
 * and stacked polygons across lanes were judged noise. None of that changes.
 *
 * What it is good at is the one thing arcs are not: showing WHY two cycles
 * interlock. E(3,12) against E(4,12) is a triangle and a square sharing a
 * circle, and no amount of arc-reading makes that as immediate. So it comes
 * back as a teaching layer ON TOP of the arcs — opt-in, never the identity
 * view (INTENT B3, theory through practice; DESIGN_BRIEF §3.1).
 *
 * Shape is its own channel, so this does not rely on colour to be read.
 */
export function onsetPolygonPoints(cx, cy, r, steps, n) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    if (!steps[i]) continue;
    const [x, y] = pol(cx, cy, r, ang(i, n));
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return pts;
}

/** The overlay element, or null when there is nothing meaningful to draw.
 *  Two onsets give a line and one gives a dot — both are honest, so only an
 *  empty lane is skipped. */
function onsetPolygon(cx, cy, r, steps, n, stroke) {
  const pts = onsetPolygonPoints(cx, cy, r, steps, n);
  if (!pts.length) return null;
  return el(pts.length > 2 ? "polygon" : "polyline", {
    points: pts.join(" "),
    fill: "none",
    stroke,
    "stroke-width": 1.5,
    "stroke-dasharray": "4 3",
    "stroke-linejoin": "round",
    opacity: 0.85,
  });
}

export function createCircleView(host, opts = {}) {
  const state = { steps: [], accents: [], playhead: -1, showCog: true, showLabels: false, showPolygon: false, lane: "ink", ...opts };
  const svg = el("svg", { viewBox: "0 0 320 320", role: "img" });
  svg.setAttribute("aria-label", "Rhythm circle");
  svg.style.width = "100%";
  svg.style.height = "auto";
  svg.style.display = "block";
  // Two layers: the visuals are redrawn each update; the click hit-targets are
  // a persistent layer rebuilt only when the step count changes, so tapping a
  // node keeps working during playback (no destroy-on-every-frame).
  const visuals = el("g");
  const hits = el("g");
  svg.append(visuals, hits);
  host.replaceChildren(svg);
  let hitN = -1;

  function buildHits(n) {
    const cx = 160, cy = 160, R = 118;
    const els = [];
    for (let i = 0; i < n; i++) {
      const [x, y] = pol(cx, cy, R, ang(i, n));
      const hit = el("circle", { cx: x, cy: y, r: 16, fill: "transparent", style: "cursor:pointer" });
      hit.addEventListener("click", ((idx) => () => { if (state.onToggle) state.onToggle(idx, state.steps[idx]); })(i));
      els.push(hit);
    }
    hits.replaceChildren(...els);
    hitN = n;
  }

  function render() {
    if (state.onToggle && (state.steps.length || 1) !== hitN) buildHits(state.steps.length || 1);
    const { steps, accents, playhead } = state;
    const n = steps.length || 1;
    const cx = 160, cy = 160, R_OUTER = 118, R_INNER = 34;
    const kids = [];
    const accent = laneColor(state.lane);
    const accentAmber = "var(--es-dim-pressure)";

    // guide band — outer + inner boundary, faint, so an all-rest pattern
    // still shows the donut's own track (DESIGN_AGENT_ANSWERS.md §1).
    kids.push(el("circle", { cx, cy, r: R_OUTER, fill: "none", stroke: "var(--es-border)", "stroke-width": 1 }));
    kids.push(el("circle", { cx, cy, r: R_INNER, fill: "none", stroke: "var(--es-border)", "stroke-width": 1 }));

    // step position stubs, confined to the hole (not the old full-length
    // center-to-edge spokes) — a small hole with SHORT stubs is the whole
    // point of keeping it small: far fewer/shorter lines converging near
    // the center, so a 16+ step pattern doesn't moiré into a starburst.
    for (let i = 0; i < n; i++) {
      const a = ang(i, n);
      const [x, y] = pol(cx, cy, R_INNER, a);
      const isDown = i === 0;
      kids.push(el("line", {
        x1: cx, y1: cy, x2: x, y2: y,
        stroke: "var(--es-border-soft)", "stroke-width": isDown ? 1.5 : 0.75,
      }));
    }

    // Onsets: a DURATION ARC from each onset to the next, with a filled node
    // at its head — the same language as the poly rings, so the two views are
    // one family rather than two idioms (design handoff 2026-08-01, Alex:
    // "duration arcs are an improvement, now that their issues have been
    // solved"). The arc says how long the onset sounds; the node says an
    // attack happened here, which a long arc alone cannot.
    //
    // Replaces the fixed 360/n wedge. Arcs were reverted once because
    // onset-to-next-onset spans tile the cycle exactly and closed into a
    // continuous ring; onsetArcPath's trim plus the node are what fixed that,
    // and the all-onset case is pinned in the tests.
    const onsets = [];
    const nodes = [];
    for (let i = 0; i < n; i++) {
      if (!steps[i]) continue;
      onsets.push(i);
      const acc = !!accents[i];
      kids.push(el("path", {
        d: onsetArcPath(cx, cy, R_OUTER, i, interOnsetSteps(steps, i), n),
        fill: "none",
        stroke: acc ? accentAmber : accent,
        "stroke-width": acc ? 15 : 11,
        "stroke-linecap": "round",
      }));
      const [nx, ny] = pol(cx, cy, R_OUTER, ang(i, n));
      nodes.push(el("circle", {
        cx: nx.toFixed(1), cy: ny.toFixed(1), r: acc ? 9 : 7.5,
        fill: acc ? accentAmber : accent,
        stroke: "var(--es-bg-raised)", "stroke-width": 2.5,
      }));
      nodes.push(el("circle", { cx: nx.toFixed(1), cy: ny.toFixed(1), r: 2, fill: "var(--es-bg-raised)" }));
    }
    // Teaching overlay, between the arcs and the nodes: visible over the arc
    // body, never over an attack.
    if (state.showPolygon) {
      const poly = onsetPolygon(cx, cy, R_OUTER, steps, n, "var(--es-fg-muted)");
      if (poly) kids.push(poly);
    }
    // Nodes after every arc, or a long arc paints over the attack it belongs to.
    kids.push(...nodes);

    // center of gravity vector
    if (state.showCog && onsets.length >= 1) {
      const cog = centerOfGravity(steps);
      const a = ang(cog.angleSteps, n);
      const [gx, gy] = pol(cx, cy, R_OUTER * cog.magnitude, a);
      if (cog.magnitude > 0.012) {
        kids.push(el("line", { x1: cx, y1: cy, x2: gx, y2: gy, stroke: "var(--es-fg-muted)", "stroke-width": 1.5, "stroke-dasharray": "3 3" }));
        kids.push(el("circle", { cx: gx, cy: gy, r: 4, fill: "var(--es-fg-muted)" }));
      } else {
        // perfectly balanced — mark the center
        kids.push(el("circle", { cx, cy, r: 6, fill: "none", stroke: "var(--es-dim-expr)", "stroke-width": 2 }));
      }
    }

    // playhead — a wedge highlight over the current step's own slice,
    // spanning the whole donut band plus a little overshoot either side.
    if (playhead >= 0 && playhead < n) {
      kids.push(el("path", {
        d: stepWedgePath(cx, cy, R_INNER - 6, R_OUTER + 10, playhead, n, 0),
        fill: `color-mix(in oklab, ${accent} 16%, transparent)`,
      }));
    }

    // step number labels only — thin on large cycles so they don't
    // overlap / shrink illegibly.
    const labelEvery = n <= 16 ? 1 : n <= 32 ? 2 : Math.ceil(n / 16);
    for (let i = 0; i < n; i++) {
      const on = !!steps[i];
      if (state.showLabels && (on || i % labelEvery === 0)) {
        const [lx, ly] = pol(cx, cy, R_OUTER + 22, ang(i, n));
        const t = el("text", {
          x: lx, y: ly, "text-anchor": "middle", "dominant-baseline": "central",
          "font-size": 11, "font-family": "var(--es-font-mono)",
          fill: on ? "var(--es-fg)" : "var(--es-fg-muted)",
        });
        t.textContent = i;
        kids.push(t);
      }
    }
    visuals.replaceChildren(...kids);
  }
  render();
  return { update(next) { Object.assign(state, next); render(); }, el: svg };
}

export function createStepView(host, opts = {}) {
  const state = { steps: [], accents: [], playhead: -1, group: 4, lane: "ink", ...opts };
  const wrap = document.createElement("div");
  wrap.className = "serpe-steplane";
  host.replaceChildren(wrap);

  // Cells persist across updates; only structural changes (step count / column
  // layout) rebuild them. Crucially this means the click listeners survive the
  // ~per-step playhead updates, so steps stay clickable during playback.
  let cells = [];
  let builtN = -1, builtCols = -1, builtNums = -1;

  function build(n, cols, showNums) {
    cells = [];
    for (let i = 0; i < n; i++) {
      const c = document.createElement("div");
      c.className = "serpe-step";
      c.addEventListener("click", () => { if (state.onToggle) state.onToggle(i, state.steps[i]); });
      if (i % showNums === 0) {
        const lab = document.createElement("span");
        lab.className = "serpe-step-n";
        lab.textContent = i;
        c.appendChild(lab);
      }
      cells.push(c);
    }
    wrap.style.setProperty("--cols", cols);
    wrap.replaceChildren(...cells);
    builtN = n; builtCols = cols; builtNums = showNums;
  }

  function render() {
    const { steps, accents, playhead, group } = state;
    const n = steps.length;
    // Wrap into BALANCED rows — at most 16 per row, split as evenly as possible
    // (18 → 9+9 not 16+2; 19 → 10+9; 16 → one row) so the lane reads
    // consistently for any step count instead of "16 + leftover".
    const rows = Math.max(1, Math.ceil(n / 16));
    const cols = Math.ceil(n / rows);
    const showNums = n <= 16 ? 1 : n <= 32 ? 2 : Math.ceil(n / 16);
    if (n !== builtN || cols !== builtCols || showNums !== builtNums) build(n, cols, showNums);
    for (let i = 0; i < n; i++) {
      const c = cells[i];
      c.classList.toggle("on", !!steps[i]);
      c.classList.toggle("acc", !!accents[i]);
      c.classList.toggle("here", i === playhead);
      c.classList.toggle("beat", !!(group && i % group === 0));
    }
  }
  render();
  return { update(next) { Object.assign(state, next); render(); }, el: wrap };
}

/**
 * Nested rings, one per poly lane (docs/KNOWLEDGE_TRANSFER.md item 9;
 * SERPE_POLY.md §3b for the lock semantics). Each ring is always a full
 * 360° divided by that lane's OWN step count — a 15-step ring's cells sit
 * visibly wider than a 16-step ring's — same "one cycle, stretched" idea as
 * the linear poly-lanes rows, just polar. This geometry doesn't depend on
 * the playback lock at all: `lane.steps`/`lane.accents` are properties of
 * the PARSED pattern, not of how it's scheduled, so the shape is equally
 * valid under cycle lock (POLYRHYTHM) or step lock (POLYMETER) — v2, KT
 * item 9. What the lock mode actually changes is only the ANIMATED
 * playhead: under cycle lock every ring's downbeat tick returns to 12
 * o'clock in wall-clock sync (the "lines across lanes" read), so the
 * playhead markers visibly line up each cycle; under step lock each ring's
 * `lanePh[i]` still marks correctly (it's driven the same way either
 * mode), it just won't stay in that lockstep column between the lcm
 * realignment points. Both are legitimate readings of the SAME division of
 * 360° — this view doesn't need to special-case either one.
 *
 * Rings nest OUTER→INNER in lane declaration order (lane 0 outermost —
 * the drum-notation instinct: kick outer, hat inner). Onsets are drawn as
 * duration arcs (DESIGN_AGENT_ANSWERS.md §1, generalized from the mono
 * ring's own onset-arc treatment — same primitive, one ring each), not
 * dots or a polygon: still restrained, still no center-of-gravity
 * (legible for one ring, noisy across three or four). Labels/mute/routing
 * stay in the existing per-lane rows — this view is the shape, not the
 * controls.
 */
export function createPolyCircleView(host, opts = {}) {
  const state = { lanes: [], lanePh: [], muted: [], showPolygon: false, ...opts };
  // 320 viewBox, same coordinate system as the mono ring (createCircleView)
  // — one unified family, DESIGN_AGENT_ANSWERS.md §1's "Ring geometry":
  // outermost R = 118 (as the mono ring), stepping inward by a FIXED
  // ringWidth+ringGap per lane rather than stretching to a fixed inner
  // bound — caps the readable lane count at ~5, which is fine; beyond
  // that the caller already has the linear createStepView to fall back to.
  const svg = el("svg", { viewBox: "0 0 320 320", role: "img" });
  // Placeholder until the first render; describeLanes() replaces it with a
  // sentence. "Poly lane rings" told a screen-reader user only that a picture
  // exists — DESIGN_BRIEF §4 asks for the non-visual route to be designed
  // ALONGSIDE the visual one, and this is the cheapest half of it.
  svg.setAttribute("aria-label", "Poly lane rings");
  svg.style.width = "100%";
  svg.style.height = "auto";
  svg.style.display = "block";
  const visuals = el("g");
  svg.append(visuals);
  host.replaceChildren(svg);

  // Shared radial budget across ALL lanes, not a fixed per-lane width: the
  // whole nested stack keeps ONE small hole at the center (R_INNER_FLOOR),
  // same reasoning as the mono ring's own hole — short, sparse lines near
  // the center instead of many rings' worth converging into a moiré knot.
  // Handoff geometry: outermost ring at 128, each inner lane 34 further in.
  // Rings are STROKED arcs now, not filled bands, so a lane is one radius
  // rather than an inner/outer pair. RING_STEP is clamped when there are more
  // lanes than fit, keeping the innermost off the centre.
  const R_OUTER = 128, RING_STEP = 34, R_INNER_FLOOR = 26;
  const ARC_W = 11, ARC_W_ACCENT = ARC_W + 4;
  const NODE_R = 7.5, NODE_R_ACCENT = 9;
  const accentAmber = "var(--es-dim-pressure)";

  function render() {
    const { lanes, lanePh, muted } = state;
    const cx = 160, cy = 160;
    const step = lanes.length > 1
      ? Math.min(RING_STEP, (R_OUTER - R_INNER_FLOOR) / (lanes.length - 1))
      : RING_STEP;
    const kids = [];
    lanes.forEach((lane, li) => {
      const r = R_OUTER - li * step;
      const n = lane.steps.length || 1;
      const color = laneColor(POLY_RING_COLORS[li % POLY_RING_COLORS.length]);
      const ring = [];

      // Guide track — the ring exists even when the lane is empty.
      ring.push(el("circle", { cx, cy, r, fill: "none", stroke: "var(--es-border)", "stroke-width": 1 }));

      // Step ticks, with step 0 pinned at 12 o'clock and drawn heavier: it is
      // what lets the eye read one lane against another.
      for (let i = 0; i < n; i++) {
        const a = ang(i, n);
        const out = i === 0 ? 7 : 4;
        const [x0, y0] = pol(cx, cy, r - out, a);
        const [x1, y1] = pol(cx, cy, r + out, a);
        ring.push(el("line", {
          x1: x0.toFixed(1), y1: y0.toFixed(1), x2: x1.toFixed(1), y2: y1.toFixed(1),
          stroke: i === 0 ? "var(--es-fg-muted)" : "var(--es-border-soft)",
          "stroke-width": i === 0 ? 2 : 1,
        }));
      }

      // Duration arcs, then the onset nodes ON TOP of them — the node has to
      // win where a long arc from the previous onset runs underneath it.
      const nodes = [];
      for (let i = 0; i < n; i++) {
        if (!lane.steps[i]) continue;
        const acc = !!(lane.accents && lane.accents[i]);
        ring.push(el("path", {
          d: onsetArcPath(cx, cy, r, i, interOnsetSteps(lane.steps, i), n),
          fill: "none",
          stroke: acc ? accentAmber : color,
          "stroke-width": acc ? ARC_W_ACCENT : ARC_W,
          "stroke-linecap": "round",
        }));
        const [nx, ny] = pol(cx, cy, r, ang(i, n));
        nodes.push(el("circle", {
          cx: nx.toFixed(1), cy: ny.toFixed(1), r: acc ? NODE_R_ACCENT : NODE_R,
          fill: acc ? accentAmber : color,
          stroke: "var(--es-bg-raised)", "stroke-width": 2.5,
        }));
        nodes.push(el("circle", {
          cx: nx.toFixed(1), cy: ny.toFixed(1), r: 2, fill: "var(--es-bg-raised)",
        }));
      }
      // Per lane, in the lane's own hue — the whole point across lanes is
      // seeing a triangle and a square share one circle.
      //
      // `showPolygon` is a boolean OR an array indexed by lane: with three
      // lanes up you usually want the figure on one or two of them, not all —
      // three overlaid dashed polygons are the noise this idiom was dropped
      // for in the first place (Alex, 2026-08-02: "the toggle can be per-lane").
      const wantPoly = Array.isArray(state.showPolygon) ? !!state.showPolygon[li] : !!state.showPolygon;
      if (wantPoly) {
        const poly = onsetPolygon(cx, cy, r, lane.steps, n, color);
        if (poly) ring.push(poly);
      }
      ring.push(...nodes);

      // Playhead — this lane's own step, on or off (a rest is still where the
      // clock is). Per-lane rather than one shared sweep: under Polymeter the
      // lanes genuinely are at different phases, which is the thing to show.
      if (lanePh[li] >= 0 && lanePh[li] < n) {
        const a = ang(lanePh[li], n);
        const [px0, py0] = pol(cx, cy, r - 11, a);
        const [px1, py1] = pol(cx, cy, r + 11, a);
        ring.push(el("line", {
          x1: px0.toFixed(1), y1: py0.toFixed(1), x2: px1.toFixed(1), y2: py1.toFixed(1),
          stroke: "var(--es-fg)", "stroke-width": 1.5,
        }));
      }
      const g = el("g", { opacity: muted[li] ? 0.35 : 1 });
      g.append(...ring);
      kids.push(g);
    });
    visuals.replaceChildren(...kids);
    svg.setAttribute("aria-label", describeLanes(lanes, muted));
  }
  render();
  return { update(next) { Object.assign(state, next); render(); }, el: svg };
}


/**
 * The rings, in words. Read by a screen reader in place of the SVG, carrying
 * the same facts the picture does: how many lanes, how long each is, where its
 * onsets fall, and which are accented.
 *
 * Onset POSITIONS, not just counts: "3 onsets in 8 steps" is true of a great
 * many different rhythms, and which ones is the whole point of the view.
 * Steps are spoken from 1; the code is 0-based everywhere else, and INTENT D1
 * is a rule about bit order, not about how you say a step number out loud.
 */
export function describeLanes(lanes = [], muted = []) {
  if (!lanes.length) return "Poly lane rings: no lanes";
  const parts = lanes.map((lane, i) => {
    const n = lane.steps.length;
    const at = [], acc = [], long = [];
    for (let s = 0; s < n; s++) {
      if (!lane.steps[s]) continue;
      at.push(s + 1);
      if (lane.accents && lane.accents[s]) acc.push(s + 1);
      if (lane.longs && lane.longs[s]) long.push(s + 1);
    }
    const label = lane.label && !/^lane\d+$/i.test(lane.label) ? ` (${lane.label})` : "";
    let t = `Lane ${i + 1}${label}: ${at.length} of ${n} steps, on ${at.join(", ") || "none"}`;
    if (acc.length) t += `; accented on ${acc.join(", ")}`;
    // What the ARCS say, which is the whole reason they are the identity view:
    // an arc's LENGTH is how long that onset sounds. A description that lists
    // only onsets tells a screen-reader user the rhythm and withholds the
    // articulation — and with LS(r){mask} in the notation, that is now the
    // difference between an open hat and a closed one.
    if (long.length) t += `; sustained on ${long.join(", ")}`;
    if (muted[i]) t += "; muted";
    return t;
  });
  return `${lanes.length} lane${lanes.length === 1 ? "" : "s"}. ${parts.join(". ")}.`;
}
