/**
 * Long/short (durational) analysis of a rhythm's inter-onset intervals.
 *
 * Restores the original Rhythm Pattern Explorer's `LongShortAnalyzer`, which
 * classified IOIs into short/long, produced an "LSSL" string, a Morse-like
 * dot/dash rendering, and named the resulting prosodic foot. That layer was
 * lost in the move to this package — and note the confusion it left behind:
 * UPI's surviving `.`/`-` is *input notation* (write a pattern as Morse),
 * whereas these dots and dashes are *analysis output* (a reading of durations).
 * Opposite directions; same glyphs. See docs/SERPE_RECOVERY.md.
 *
 * Beyond the original: `ratio` and `spread` are floats, and `classify` accepts
 * a tolerance, so a pattern whose "long" is 2.9× rather than exactly 3× still
 * reads as long-short. That is the groundwork for expressive/adaptive L/S
 * (Keil's participatory discrepancies): real playing never lands on integers,
 * so the analysis must not require them.
 */
import { intervals, onsetIndices } from "./analysis.js";

/** Classic two-value feet, named. Keys are the L/S string, cyclically. */
const FEET = {
  LS: "trochaic",       // — ⏑
  SL: "iambic",         // ⏑ —
  LSS: "dactylic",      // — ⏑ ⏑
  SSL: "anapestic",     // ⏑ ⏑ —
  SLS: "amphibrachic",  // ⏑ — ⏑
  LLS: "antibacchic",   // — — ⏑   (the tresillo's 3+3+2 reading)
  SLL: "bacchic",       // ⏑ — —
  LSL: "cretic",        // — ⏑ —   (amphimacer)
  LL: "spondaic",
  SS: "pyrrhic",
};

/** Rotate `s` to its lexicographically smallest rotation (cycles are equal). */
function canonicalRotation(s) {
  let best = s;
  for (let i = 1; i < s.length; i++) {
    const r = s.slice(i) + s.slice(0, i);
    if (r < best) best = r;
  }
  return best;
}

function footName(ls) {
  if (!ls) return "none";
  if (/^E+$/.test(ls)) return "isochronous";
  if (/^L+$/.test(ls)) return "isochronous";
  if (/^S+$/.test(ls)) return "isochronous";
  const canon = canonicalRotation(ls);
  for (const [shape, name] of Object.entries(FEET)) {
    if (canonicalRotation(shape) === canon) return name;
  }
  return ls.length <= 8 ? "mixed" : "complex";
}

/**
 * Analyse the durational profile of a pattern.
 *
 * @param {boolean[]} steps
 * @param {{tolerance?:number}} [opts] tolerance is a FRACTION of the interval
 *   span (default 0) — how far from an exact value still counts as that value.
 *   Raise it to let expressively-timed or non-integer material classify.
 * @returns {{
 *   intervals:number[], counts:Record<number,number>,
 *   short:number|null, long:number|null, ratio:number|null, spread:number,
 *   types:string[], pattern:string, morse:string, foot:string,
 *   isochronous:boolean, description:string
 * }}
 */
export function longShort(steps, opts = {}) {
  const { tolerance = 0 } = opts;
  const on = onsetIndices(steps);
  const empty = {
    intervals: [], counts: {}, short: null, long: null, ratio: null, spread: 0,
    types: [], pattern: "", morse: "", foot: "none", isochronous: false,
    description: on.length === 0 ? "No onsets" : "Single onset",
  };
  if (on.length < 2) return empty;

  const iv = intervals(steps);
  const counts = {};
  for (const v of iv) counts[v] = (counts[v] || 0) + 1;

  const uniq = [...new Set(iv)].sort((a, b) => a - b);
  const short = uniq[0];
  const long = uniq[uniq.length - 1];
  const spread = long - short;
  const ratio = short > 0 ? long / short : null;

  // With one distinct value the rhythm is isochronous; otherwise classify each
  // interval by which pole it sits nearer, within `tolerance` of the span.
  const slack = spread * tolerance;
  const types = uniq.length === 1
    ? iv.map(() => "equal")
    : iv.map((v) => (v - short <= slack ? "short"
                   : long - v <= slack ? "long"
                   : v - short <= long - v ? "short" : "long"));

  const pattern = types.map((t) => (t === "short" ? "S" : t === "long" ? "L" : "E")).join("");
  const morse = types.map((t) => (t === "short" ? "." : t === "long" ? "-" : "=")).join("");
  const isochronous = uniq.length === 1;
  const foot = footName(pattern);

  const description = isochronous
    ? `Isochronous — ${iv.length} intervals of ${short}`
    : `${foot} — short ${short}, long ${long}` +
      (ratio ? ` (${Number.isInteger(ratio) ? ratio : ratio.toFixed(2)}:1)` : "");

  return { intervals: iv, counts, short, long, ratio, spread, types, pattern, morse, foot, isochronous, description };
}

/**
 * Render a pattern as durations you could actually perform, given a unit.
 * `short` maps to `unit`, `long` to `unit * ratio` — the "short is 1, long is
 * 3" reading, but with the ratio taken from the music rather than assumed, and
 * float-friendly.
 *
 * @param {boolean[]} steps
 * @param {{unit?:number, ratio?:number}} [opts] `ratio` overrides the measured
 *   one (e.g. force a swung 1.5 or a hard 3).
 * @returns {number[]} one duration per inter-onset interval
 */
export function durations(steps, opts = {}) {
  const ls = longShort(steps);
  if (!ls.intervals.length) return [];
  const { unit = 1, ratio = ls.ratio ?? 1 } = opts;
  return ls.types.map((t) => (t === "long" ? unit * ratio : unit));
}

/**
 * Dynamic long/short — the ratio breathes instead of holding still.
 *
 * Same model as GloriArp's pocket (`@enkerli/accompaniment`'s `express.ts`,
 * GLORIARP_NEXT §2), deliberately reused rather than reinvented: Keil's
 * participatory discrepancies are NOT i.i.d. jitter and NOT a fixed offset,
 * but a CORRELATED walk that accumulates and then resolves, pulled home
 * hardest at the strongest positions. There it displaces onsets in
 * milliseconds; here it stretches the long/short contrast itself — the same
 * gesture applied to duration rather than placement.
 *
 * Deterministic: (seed, pass, depth) → identical output, and depth 0 returns
 * exactly the static `durations()`. So a groove can be reproduced, diffed, or
 * held rock-steady, which is the discipline the rest of the suite's
 * expressive layers already follow.
 *
 * @param {boolean[]} steps
 * @param {{
 *   unit?:number, ratio?:number|[number,number], depth?:number,
 *   seed?:number, pass?:number
 * }} [opts]
 *   - `ratio` a point (1.5) or a RANGE ([1.4, 1.8]) the walk moves within;
 *     a range makes the breathing explicit rather than a ± around a point.
 *   - `depth` 0..1 — how far the walk may pull the ratio (0 = static).
 * @returns {number[]} one duration per inter-onset interval
 */
export function dynamicDurations(steps, opts = {}) {
  const ls = longShort(steps);
  if (!ls.intervals.length) return [];
  const { unit = 1, depth = 0, seed = 1, pass = 0 } = opts;

  const spec = opts.ratio ?? ls.ratio ?? 1;
  const [lo, hi] = Array.isArray(spec) ? [spec[0], spec[1]] : [spec, spec];
  const mid = (lo + hi) / 2;
  const span = (hi - lo) / 2;

  if (depth <= 0 && span === 0) {
    return ls.types.map((t) => (t === "long" ? unit * mid : unit));
  }

  // mulberry32, inlined — @enkerli/upi stays dependency-free by design.
  let s = (seed * 0x9e3779b1 + pass * 0x85ebca6b) >>> 0;
  const rnd = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const n = steps.length;
  const on = onsetIndices(steps);
  let drift = 0;
  return ls.types.map((t, i) => {
    // Metric weight of the interval's own starting position: the downbeat is
    // the strongest anchor, then the half, then the beat divisions.
    const pos = on[i] ?? 0;
    const w = pos === 0 ? 1 : pos % (n / 2) === 0 ? 0.7 : pos % (n / 4) === 0 ? 0.5 : 0.2;
    const anchor = w >= 1 ? 0.7 : w >= 0.5 ? 0.4 : 0.15; // strong positions pull it home
    drift = drift * (1 - anchor) + (rnd() * 2 - 1) * depth;
    // An explicit range is a promise: the walk moves WITHIN [lo,hi], never
    // outside it. A bare point has no such bound, so the depth sets the reach.
    const bounded = span > 0;
    const reach = bounded ? span : Math.abs(mid - 1) * depth * 0.5;
    const raw = mid + Math.max(-1, Math.min(1, drift)) * reach;
    const r = Math.max(1, bounded ? Math.max(lo, Math.min(hi, raw)) : raw);
    return t === "long" ? unit * r : unit;
  });
}

/**
 * Steps from onset `i` to the NEXT onset, wrapping around the cycle; the whole
 * cycle when it is the only onset.
 *
 * This is the durational span an onset OWNS, and it is the one number that
 * decides articulation: a note that sounds for less than this is detached, one
 * that sounds for more overlaps into the next and is legato. Serpe's duration
 * arcs draw exactly this span, and `msuite upi --midi --gate` writes exactly
 * this span into note lengths — the picture and the file agree because they ask
 * the same function, not because two copies of the rule happen to match. (They
 * did not: this lived privately inside the arc renderer until 2026-08-02, and
 * the first version of --gate measured against the grid step instead, which
 * made `--gate legato` leave a gap on any pattern whose onsets are not adjacent.)
 */
export function interOnsetSteps(steps, i) {
  const n = steps.length;
  for (let d = 1; d <= n; d++) if (steps[(i + d) % n]) return d;
  return n;
}
