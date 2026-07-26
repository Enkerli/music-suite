/**
 * Microtiming — participatory discrepancies (Keil): where an attack lands
 * relative to the beat, not how long it lasts.
 *
 * This is the push/pull people mean when they say a drummer plays "behind" or
 * "on top of" the beat. It is deliberately NOT:
 *
 *  - **note length / gate** (that's `durations()` / `dynamicDurations()` in
 *    `longshort.js` — how long a note SOUNDS, a different musical parameter);
 *  - **swing** (a fixed, alternating long-short subdivision — same every bar);
 *  - **jitter** (independent random error, which just sounds sloppy).
 *
 * The model, and why each part matters:
 *
 *  1. **A displacement per ONSET, not per step.** `shift[i]` says how far
 *     onset `i` sits from its nominal position, in fractions of a step.
 *     Positive = late (behind the beat), negative = early (on top of it).
 *  2. **Correlated, not independent.** The walk accumulates and resolves, so
 *     a phrase leans and then settles — the shape Keil describes. Independent
 *     per-note randomness is the thing that sounds like a bad quantiser.
 *  3. **Anchored by metric weight.** The downbeat is pinned hard, the
 *     half-bar less so, offbeats float most. This is what keeps the groove
 *     legible while the inner notes move.
 *  4. **Bar length is PRESERVED, exactly.** Every cycle starts at zero and the
 *     interval deltas sum to zero by construction, so the pattern never drifts
 *     out of time with anything else. That is the difference between "playing
 *     with the beat" and "slowly running away from it" — and it is why this
 *     returns displacements that are then differenced into intervals, rather
 *     than perturbing each interval directly.
 *
 * Deterministic: `(seed, pass)` reproduces exactly; `depth: 0` returns all
 * zeros, i.e. dead-straight timing.
 */
import { onsetIndices } from "./analysis.js";

/** mulberry32, inlined — this package stays dependency-free by design. */
function rng(seed, pass) {
  let s = (Math.imul(seed | 0, 0x9e3779b1) + Math.imul(pass | 0, 0x85ebca6b)) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** How strongly a position resists being moved. 1 = downbeat, pinned hardest. */
function anchorAt(pos, n) {
  if (pos === 0) return 0.85;
  if (n % 2 === 0 && pos === n / 2) return 0.55;
  if (n % 4 === 0 && pos % (n / 4) === 0) return 0.4;
  return 0.15;
}

/**
 * Per-STEP timing displacement for one cycle of a pattern.
 *
 * @param {boolean[]|number[]} steps
 * @param {{depth?:number, seed?:number, pass?:number, maxShift?:number}} [opts]
 *   `depth` 0..1 — how much push/pull. `maxShift` caps a single displacement
 *   in fractions of a step (default 0.35; beyond ~0.5 an onset would cross its
 *   neighbour and the rhythm reads as a different pattern, not as feel).
 * @returns {number[]} one value per STEP index; + = late, − = early, in
 *   fractions of a step. Steps without an onset are 0 (nothing to displace).
 */
export function microtiming(steps, opts = {}) {
  const n = steps.length;
  const { depth = 0, seed = 1, pass = 0, maxShift = 0.35 } = opts;
  const shift = new Array(n).fill(0);
  if (!n || depth <= 0) return shift;

  const on = onsetIndices(steps);
  if (on.length < 2) return shift;

  const rnd = rng(seed, pass);
  let drift = 0;
  for (const pos of on) {
    const anchor = anchorAt(pos, n);
    // Mean-reverting walk: pulled home hardest where the metre is strongest.
    drift = drift * (1 - anchor) + (rnd() * 2 - 1) * depth * 0.5;
    const d = Math.max(-maxShift, Math.min(maxShift, drift));
    shift[pos] = pos === 0 ? 0 : d;   // the downbeat is the reference, never moved
  }
  return shift;
}

/**
 * Turn displacements into the per-step INTERVALS a scheduler actually needs.
 *
 * interval[i] = nominal + (shift[i+1] − shift[i]), wrapping at the cycle
 * boundary — so lengthening one gap necessarily shortens another and the bar
 * comes out exactly the same length. Returned as multipliers on the nominal
 * step, ready for `stepMs * scale[i]`.
 *
 * @param {number[]} shift per-step displacement from `microtiming`
 * @returns {number[]} one multiplier per step (1 = unchanged)
 */
export function timingScales(shift) {
  const n = shift.length;
  const out = new Array(n).fill(1);
  if (!n) return out;
  for (let i = 0; i < n; i++) {
    const next = shift[(i + 1) % n];
    // Guard: never let a step collapse to zero or negative duration.
    out[i] = Math.max(0.25, 1 + (next - shift[i]));
  }
  return out;
}

/**
 * Convenience: displacements in MILLISECONDS, for reporting and for engines
 * that think in absolute time.
 */
export function microtimingMs(steps, stepMs, opts = {}) {
  return microtiming(steps, opts).map((s) => s * stepMs);
}
