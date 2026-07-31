/**
 * Progressive notation — the stateful corner of UPI.
 *
 * `E(1,8)>8`, `E(3,8)%2`, `E(3,8)*3` do not denote *a* pattern. They denote a
 * different pattern on every trigger, which is why the pure parser in upi.js
 * rejects them (it has nothing single to return) and why the plugin has always
 * had to lean on the C++ engine's own state. That gap is the last ✗ in Serpe's
 * FEATURE_PARITY ledger.
 *
 * The fix here is to make the state derivable instead of stored: everything is
 * a function of the trigger index, so `progressiveAt(desc, n)` is pure for the
 * deterministic forms and hosts that prefer a cursor can use `ProgressiveRun`.
 *
 * PHASE, one rule for every form since 2026-07-30: **trigger 1 is the bare
 * base**. What you typed is what you hear first, and the transform starts on
 * trigger 2. `>N` always worked this way; `%N`, `+N` and `*N` did not until
 * Alex chose base-first ("I'd be more comfortable with bare base"). The engine
 * changed in the same commit — it is authoritative (INTENT D3), so the two must
 * never move apart. See docs/PROGRESSIVE_PHASE.md.
 *
 * Semantics are ported from the C++ engine, read at 2026-07-27:
 *   · transform  `base[BWED]>N`  UPIParser.cpp applyProgressiveTransformation
 *   · offset     `base%N`/`base+N`  PatternEngine::triggerProgressiveOffset
 *   · lengthen   `base*N`       ProgressiveManager (bell-curve appends)
 * The transform sequences are pinned against that engine's own output in
 * progressive.test.js — see the header there for how the vectors were taken.
 */
import { barlowTransform, euclideanRhythm, euclideanComplement, bellCurveRandomSteps } from "./rhythm.js";
// The package's own rotate, so progressive offset turns the same way as the
// UI's Rotate transform.
//
// DIRECTION AND PHASE — verified 2026-07-28, and both were wrong here before.
// This was flagged as unverifiable because progressive offset lives in
// PatternEngine (processor state) and a parser probe cannot reach it. A poly
// lane can, so `serpe_poly_precedence` settled it:
//
//   · sign:  rotate(p, +k) equals the C++ PatternUtils rotatePattern(p, -k).
//            The offset therefore goes in POSITIVE here.
//   · phase: the engine's `%N` shows offset N on the FIRST trigger, not the
//            un-rotated base. This module used to return the base first, so
//            every trigger was one step behind the plugin.
import { rotate } from "./upi.js";

const countOnsets = (steps) => steps.reduce((a, s) => a + (s ? 1 : 0), 0);

/**
 * Split a progressive expression into its parts, or return null when the
 * string isn't progressive (so callers can fall through to the pure parser).
 *
 *   E(1,8)>8      → { kind:"transform", base:"E(1,8)", type:"b", target:8 }
 *   E(1,8)W>8     → transformer letter sits BEFORE the '>', defaulting to
 *                   Barlow when absent — the C++ rule, not an invention here
 *   E(3,8)%2      → { kind:"offset",   base:"E(3,8)", step:2 }
 *   E(3,8)+3      → same as %; '+' is the legacy spelling, and is only an
 *                   offset when what follows is numeric (`pat+pat` is
 *                   combination, which belongs to the pure parser)
 *   E(3,8)*3      → { kind:"lengthen", base:"E(3,8)", step:3 }
 */
export function parseProgressive(input) {
  const src = String(input ?? "").trim();
  if (!src) return null;

  let m = src.match(/^(.*?)([bwed])?\s*>\s*(\d+)$/i);
  if (m && m[1].trim()) {
    return { kind: "transform", base: m[1].trim(), type: (m[2] || "b").toLowerCase(), target: +m[3], source: src };
  }
  m = src.match(/^(.*?)\s*%\s*(-?\d+)$/);
  if (m && m[1].trim()) return { kind: "offset", base: m[1].trim(), step: +m[2], source: src };
  // '+' only counts when the tail is purely numeric; otherwise it is combination.
  m = src.match(/^(.*?)\s*\+\s*(-?\d+)$/);
  if (m && m[1].trim()) return { kind: "offset", base: m[1].trim(), step: +m[2], source: src };
  m = src.match(/^(.*?)\s*\*\s*(\d+)$/);
  if (m && m[1].trim()) return { kind: "lengthen", base: m[1].trim(), step: +m[2], source: src };
  return null;
}

/** One transform step: move the onset count ONE toward the target. */
function transformStep(steps, type, target) {
  const cur = countOnsets(steps);
  if (cur === target) return steps.slice();
  const next = cur + (target > cur ? 1 : -1);
  switch (type) {
    case "w": return barlowTransform(steps, next, { wolrabMode: true });
    case "e": return euclideanRhythm(next, steps.length);
    case "d": return euclideanComplement(next, steps.length);
    case "b":
    default:  return barlowTransform(steps, next);
  }
}

/**
 * The pattern at trigger `n`, 1-based.
 *
 * **n=1 is the bare base, for every operator.** `%N` is unrotated, `*N` is
 * un-grown, `>N` is untransformed; the transform starts at n=2.
 *
 * Until 2026-07-30 this was true of `>N` only — `%N` and `*N` each applied one
 * step on setup, so the base was never heard. The three branches below differed
 * by a single character (`i = 0` vs `i = 1`, `step * idx` vs `step * (idx-1)`)
 * and nobody had chosen the difference; it was three code paths written at
 * different times. Alex settled it base-first. The docstring that used to sit
 * here asserted the base was always shown, which was false of two of the three
 * branches directly beneath it — hence the detail now.
 *
 * The engine changed in the same commit (INTENT D3: it is authoritative, and a
 * one-sided change here reopens the divergence closed on 2026-07-30).
 *
 * @param {object} desc      from parseProgressive
 * @param {number} n         trigger index, 1-based
 * @param {object} [opts]
 * @param {(s:string)=>{steps:number[]}} opts.parseBase  parser for the base
 *        string (inject upi.js's parse; kept out of here so this module stays
 *        free of a circular import)
 * @param {() => number} [opts.random]  RNG for `*N` lengthening. Lengthening
 *        is random by design and is NOT reproducible between runs — that
 *        matches the engine, and rhythm patterns are documented elsewhere
 *        anyway. Injectable purely so tests can pin it.
 * @returns {{steps:number[], index:number, label:string}}
 */
export function progressiveAt(desc, n, opts = {}) {
  const { parseBase, random = Math.random } = opts;
  if (typeof parseBase !== "function") throw new TypeError("progressiveAt needs opts.parseBase");
  const idx = Math.max(1, Math.floor(n));
  const parsed = parseBase(desc.base);
  const base = (parsed && parsed.steps) ? parsed.steps.slice() : null;
  if (!base) return { steps: [], index: idx, label: desc.source, error: "base pattern did not parse" };

  if (desc.kind === "offset") {
    // idx-1, so trigger 1 is the bare base and rotation starts on trigger 2.
    // The engine sets progressiveOffset = 0 on setup and adds step per trigger.
    // See the sign/phase note at the top.
    return { steps: rotate(base, desc.step * (idx - 1)), index: idx, label: desc.source };
  }

  if (desc.kind === "lengthen") {
    // Same phase rule, hence `i = 1`: trigger 1 is the bare base and the first
    // growth lands on trigger 2. The engine no longer applies an initial
    // lengthening on setup either.
    let out = base.slice();
    for (let i = 1; i < idx; i++) out = out.concat(bellCurveRandomSteps(desc.step, random));
    return { steps: out, index: idx, label: desc.source };
  }

  // transform: fold one ±1 step per trigger, and on REACHING the target the
  // engine loops back to the base and restarts (continuous cycling for live
  // use) — so the sequence is periodic, not a dead end.
  let cur = base.slice();
  for (let i = 1; i < idx; i++) {
    if (countOnsets(cur) === desc.target) { cur = base.slice(); continue; }
    cur = transformStep(cur, desc.type, desc.target);
  }
  return { steps: cur, index: idx, label: desc.source };
}

/** A cursor, for hosts that would rather advance than count. */
export class ProgressiveRun {
  constructor(input, opts = {}) {
    this.desc = parseProgressive(input);
    if (!this.desc) throw new Error(`not progressive notation: ${input}`);
    this.opts = opts;
    this.index = 0;
  }
  /** Advance one trigger and return that pattern (first call = the base). */
  next() { this.index += 1; return progressiveAt(this.desc, this.index, this.opts); }
  reset() { this.index = 0; }
}
