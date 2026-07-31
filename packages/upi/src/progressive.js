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
 * Trigger 1 is what the plugin shows on the FIRST trigger, for every form —
 * which for `%N` and `*N` means one step of transformation has already been
 * applied. The engine is authoritative (Alex, 2026-07-28).
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
 * WHAT n=1 GIVES YOU DEPENDS ON THE OPERATOR, and they do not agree. This
 * comment used to claim "n=1 is the base, untransformed" for all three, which
 * was true of exactly one of the branches below it:
 *
 *   %N  offset       n=1 is ALREADY rotated by N. The base is never heard.
 *   *N  lengthen     n=1 is ALREADY base+N steps. The base is never heard.
 *   >N  transform    n=1 IS the bare base. The base is heard.
 *
 * That split is inherited from the engine, which is authoritative (INTENT D3):
 * PluginProcessor.cpp sets `progressiveOffset = newStep` on setup — literally
 * commented "Start with first offset" — while the transform path counts from
 * the base. See INTENT D6; whether the split is *right* is an open question,
 * not a settled one, and changing it here alone would just re-open the
 * divergence that 2026-07-30 closed.
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
    // The engine sets currentOffset = step on setup and adds step per trigger,
    // so trigger n is rotated by step*n and trigger 1 is ALREADY offset by one
    // step. See the sign/phase note at the top.
    return { steps: rotate(base, desc.step * idx), index: idx, label: desc.source };
  }

  if (desc.kind === "lengthen") {
    // Same phase rule: the engine initialises lengthening to `step`, so the
    // first trigger is already base + step steps long, not the bare base.
    let out = base.slice();
    for (let i = 0; i < idx; i++) out = out.concat(bellCurveRandomSteps(desc.step, random));
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
