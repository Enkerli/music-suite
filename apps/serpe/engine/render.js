/**
 * Serpe — visualisers. Three framework-agnostic SVG views over a pattern:
 *   createCircleView(el, opts)     → ring + onset polygon + playhead + CoG
 *   createStepView(el, opts)       → linear step lane, beat grouping, playhead
 *   createPolyCircleView(el, opts) → nested rings, one per poly lane (KT item 9)
 * All expose .update({ ... }) and theme via tokens.
 */
import { centerOfGravity } from "@enkerli/upi";

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

export function createCircleView(host, opts = {}) {
  const state = { steps: [], accents: [], playhead: -1, showCog: true, showLabels: false, lane: "ink", ...opts };
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
    const cx = 160, cy = 160, R = 118;
    const kids = [];
    const accent = laneColor(state.lane);

    // guide ring
    kids.push(el("circle", { cx, cy, r: R, fill: "none", stroke: "var(--es-border)", "stroke-width": 1.5 }));

    // spokes (subtle) + downbeat tick
    for (let i = 0; i < n; i++) {
      const [x, y] = pol(cx, cy, R, ang(i, n));
      const [xi] = pol(cx, cy, R - 6, ang(i, n));
      const isDown = i === 0;
      kids.push(el("line", {
        x1: cx, y1: cy, x2: x, y2: y,
        stroke: "var(--es-border-soft)", "stroke-width": isDown ? 1.5 : 0.75,
      }));
    }

    // onset polygon
    const onsets = [];
    for (let i = 0; i < n; i++) if (steps[i]) onsets.push(i);
    if (onsets.length >= 2) {
      const pts = onsets.map((i) => pol(cx, cy, R, ang(i, n)).map((v) => v.toFixed(1)).join(",")).join(" ");
      kids.push(el("polygon", {
        points: pts, fill: `color-mix(in oklab, ${accent} 14%, transparent)`,
        stroke: accent, "stroke-width": 2.5, "stroke-linejoin": "round",
      }));
    }

    // center of gravity vector
    if (state.showCog && onsets.length >= 1) {
      const cog = centerOfGravity(steps);
      const a = ang(cog.angleSteps, n);
      const [gx, gy] = pol(cx, cy, R * cog.magnitude, a);
      if (cog.magnitude > 0.012) {
        kids.push(el("line", { x1: cx, y1: cy, x2: gx, y2: gy, stroke: "var(--es-fg-muted)", "stroke-width": 1.5, "stroke-dasharray": "3 3" }));
        kids.push(el("circle", { cx: gx, cy: gy, r: 4, fill: "var(--es-fg-muted)" }));
      } else {
        // perfectly balanced — mark the center
        kids.push(el("circle", { cx, cy, r: 6, fill: "none", stroke: "var(--es-dim-expr)", "stroke-width": 2 }));
      }
    }

    // playhead wedge
    if (playhead >= 0 && playhead < n) {
      const a0 = ang(playhead - 0.5, n), a1 = ang(playhead + 0.5, n);
      const [x0, y0] = pol(cx, cy, R + 8, a0);
      const [x1, y1] = pol(cx, cy, R + 8, a1);
      const wedge = el("path", {
        d: `M ${cx} ${cy} L ${x0.toFixed(1)} ${y0.toFixed(1)} A ${R + 8} ${R + 8} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)} Z`,
        fill: `color-mix(in oklab, ${accent} 12%, transparent)`,
      });
      kids.push(wedge);
    }

    // step nodes — accented onsets in the suite amber, plain onsets in the accent
    const accentAmber = "var(--es-dim-pressure)";
    // thin labels on large cycles so they don't overlap / shrink illegibly
    const labelEvery = n <= 16 ? 1 : n <= 32 ? 2 : Math.ceil(n / 16);
    for (let i = 0; i < n; i++) {
      const [x, y] = pol(cx, cy, R, ang(i, n));
      const on = !!steps[i];
      const acc = !!accents[i];
      const here = i === playhead;
      const r = on ? (acc ? 12 : 9.5) : 5.5;
      const onColor = acc ? accentAmber : accent;
      if (acc && on) {
        kids.push(el("circle", { cx: x, cy: y, r: r + 3.5, fill: "none", stroke: onColor, "stroke-width": 1.5 }));
      }
      kids.push(el("circle", {
        cx: x, cy: y, r,
        fill: on ? onColor : "var(--es-bg-raised)",
        stroke: here ? "var(--es-fg)" : on ? "var(--es-fg)" : "var(--es-border-strong)",
        "stroke-width": here ? 3 : on ? 1.5 : 1.25,
      }));
      if (state.showLabels && (on || i % labelEvery === 0)) {
        const [lx, ly] = pol(cx, cy, R + 22, ang(i, n));
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
 * highlighted dots visibly line up each cycle; under step lock each ring's
 * `lanePh[i]` still highlights correctly (it's driven the same way either
 * mode), it just won't stay in that lockstep column between the lcm
 * realignment points. Both are legitimate readings of the SAME division of
 * 360° — this view doesn't need to special-case either one.
 *
 * Rings nest OUTER→INNER in lane declaration order (lane 0 outermost —
 * the drum-notation instinct: kick outer, hat inner). Deliberately
 * restrained: guide ring + downbeat tick + step dots per lane, no onset
 * polygon or center-of-gravity (legible for one ring, noisy across three
 * or four). Labels/mute/routing stay in the existing per-lane rows —
 * this view is the shape, not the controls.
 */
export function createPolyCircleView(host, opts = {}) {
  const state = { lanes: [], lanePh: [], muted: [], ...opts };
  const svg = el("svg", { viewBox: "0 0 340 340", role: "img" });
  svg.setAttribute("aria-label", "Poly lane rings");
  svg.style.width = "100%";
  svg.style.height = "auto";
  svg.style.display = "block";
  const visuals = el("g");
  svg.append(visuals);
  host.replaceChildren(svg);

  function render() {
    const { lanes, lanePh, muted } = state;
    const cx = 170, cy = 170;
    const R_OUTER = 150, R_INNER = 46;
    const ringGap = lanes.length > 1 ? (R_OUTER - R_INNER) / (lanes.length - 1) : 0;
    const kids = [];
    lanes.forEach((lane, li) => {
      const R = lanes.length > 1 ? R_OUTER - li * ringGap : R_OUTER;
      const n = lane.steps.length || 1;
      const color = laneColor(POLY_RING_COLORS[li % POLY_RING_COLORS.length]);
      const ring = [];
      // guide ring
      ring.push(el("circle", { cx, cy, r: R, fill: "none", stroke: color, "stroke-width": 1.25, "stroke-opacity": 0.3 }));
      // downbeat tick — anchors step 0 across all rings at 12 o'clock
      const a0 = ang(0, n);
      const [tx0, ty0] = pol(cx, cy, R - 6, a0);
      const [tx1, ty1] = pol(cx, cy, R + 6, a0);
      ring.push(el("line", { x1: tx0.toFixed(1), y1: ty0.toFixed(1), x2: tx1.toFixed(1), y2: ty1.toFixed(1), stroke: color, "stroke-width": 1.5 }));
      // step dots
      const accentAmber = "var(--es-dim-pressure)";
      for (let i = 0; i < n; i++) {
        const [x, y] = pol(cx, cy, R, ang(i, n));
        const on = !!lane.steps[i];
        const acc = !!lane.accents[i];
        const here = i === lanePh[li];
        const r = on ? (acc ? 8.5 : 6.5) : 3.5;
        const onColor = acc ? accentAmber : color;
        if (acc && on) {
          ring.push(el("circle", { cx: x, cy: y, r: r + 2.5, fill: "none", stroke: onColor, "stroke-width": 1.25 }));
        }
        ring.push(el("circle", {
          cx: x, cy: y, r,
          fill: on ? onColor : "var(--es-bg-raised)",
          stroke: here ? "var(--es-fg)" : on ? "var(--es-fg)" : "var(--es-border-strong)",
          "stroke-width": here ? 2.75 : on ? 1.25 : 1,
        }));
      }
      const g = el("g", { opacity: muted[li] ? 0.35 : 1 });
      g.append(...ring);
      kids.push(g);
    });
    visuals.replaceChildren(...kids);
  }
  render();
  return { update(next) { Object.assign(state, next); render(); }, el: svg };
}
