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
