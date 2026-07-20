/**
 * Poly lane clock math (docs/SERPE_POLY.md §3b — playback semantics decided
 * 2026-07-18). Pulled out of main.jsx's per-lane setTimeout scheduler
 * (`laneTickRef`) so the two lock modes' actual arithmetic is unit-testable
 * on its own — previously only provable by ear/eye against a running app.
 *
 *   Cycle lock (default) = POLYRHYTHM: every lane spans the SAME total
 *   cycle duration (the first lane's natural length at the base step
 *   rate) — so a 15-step lane's steps run faster than a 16-step lane's,
 *   but both lanes' cycles start and end together. 15 against 16 (or any
 *   pair) is a steady cross-rhythm, not a drift.
 *
 *   Step lock (toggle) = POLYMETER: every lane's STEP is the same
 *   duration — so lanes of different lengths take different total times
 *   to complete a cycle, drift out of phase, and only line back up at
 *   the lcm of their lengths. Two lanes whose lengths share a small lcm
 *   (multiples of 8, say — 16 realigns after just 16 steps) barely LOOK
 *   different from cycle lock; the drift only reads clearly with lengths
 *   that don't divide into each other (7 vs 11 → lcm 77; 15 vs 16 → lcm
 *   240) — that's the case the tests below exist to prove.
 */

/** One step's duration (ms) at the mono grid's base rate — poly ignores swing. */
export function baseStepMs(tempo, group = 4) {
  return ((60 / tempo) / (group || 4)) * 1000;
}

/**
 * This lane's step duration (ms) under the current lock.
 * @param {{ lane: { steps: unknown[] }, refSteps?: number,
 *            polyLock: 'cycle'|'step', tempo: number, group?: number }} args
 *   `refSteps` = the reference lane's step count (cycle lock only —
 *   SERPE_POLY.md: "the first lane defines the cycle length").
 */
export function laneStepMs({ lane, refSteps, polyLock, tempo, group = 4 }) {
  const base = baseStepMs(tempo, group);
  if (polyLock === "step") return base; // polymeter: every lane's step is this long
  const refLen = refSteps || 1;
  return base * (refLen / (lane.steps.length || 1)); // polyrhythm: same total cycle
}

/** Per-lane Keil micro-timing offset (ms), tempo-syncing note-value fractions. */
export function laneOffsetMs(lane, tempo) {
  if (!lane.offset) return 0;
  if (lane.offset.kind === "ms") return lane.offset.ms;
  return (lane.offset.num / lane.offset.den) * 4 * (60000 / tempo); // fraction of a whole note
}
