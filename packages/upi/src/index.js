/**
 * @enkerli/upi — Serpe's UPI (Universal Pattern Input) rhythm engine, promoted
 * from apps/serpe/engine to a package (plan §6 E3 / docs/HEADLESS.md).
 *
 * Framework-agnostic, no DOM. A pattern is a 0/1 step array; all numeric
 * notation is LEFTMOST = LSB (first step = bit 0), per CONVENTIONS.md — the
 * same convention as @enkerli/theory's rhythm codecs. The DOM SVG visualisers
 * stay app-side (apps/serpe/engine/render.js); everything importable in node
 * lives here.
 *
 * Scene state stays engine-side (the C++ plugin). PROGRESSIVE notation used to
 * as well — it is stateful, so the pure parser has nothing single to return —
 * but progressive.js closes that gap by making the state derivable from the
 * trigger index rather than stored, so `progressiveAt(desc, n)` is pure for
 * the deterministic forms. See docs/FEATURE_PARITY (Serpe repo).
 */
export {
  // Progressive notation (stateful forms: pat>N, pat%N, pat+N, pat*N)
  parseProgressive, progressiveAt, ProgressiveRun,
} from "./progressive.js";

export {
  // UPI notation + generators + transforms
  primeFactors, euclid, polygon, randomPattern, rotate, invert, complement,
  quantizeSteps, parseUPI, indispensabilityWeights, barlowTransform, onsetCount,
} from "./upi.js";

export {
  // canonical rhythm algorithms (ported from @enkerli/theory, conformance-locked)
  euclideanRhythm, euclideanComplement, funkyEuclidean, bellCurveRandomSteps,
  positionIndispensability, barlowIndispensabilityTable,
} from "./rhythm.js";

export {
  // analysis over a step array
  onsetIndices, resultant, centerOfGravity, perfectBalance,
  intervals, evenness, analyse,
} from "./analysis.js";

export { analyzeSyncopation } from "./syncopation.js";

export {
  // recognition + decomposition: what IS this pattern, in generator terms?
  detectEuclidean, detectBarlow, decompose, identify,
} from "./decompose.js";

export {
  // durational (long/short) reading of the inter-onset intervals
  longShort, durations, dynamicDurations,
  // the span an onset owns — what duration arcs draw and what --gate writes
  interOnsetSteps,
} from "./longshort.js";
// The suite's one seeded PRNG (mulberry32) — shared so callers that need a
// reproducible stream do not inline a fourth copy. See rng.js on why.
export { rng, seedFromSteps, morpher } from "./rng.js";

export {
  // named-pattern import: "Fume-Fume: [0,2,4,7,9]/12", one line or a block
  parseNamedPattern, parseNamedPatterns, describeNamedPattern,
} from "./named.js";

export { parseLongShortSuffix, parseMicrotimingSuffix, additiveToSteps } from "./upi.js";

export {
  // microtiming (Keil participatory discrepancies): push/pull around the beat
  microtiming, timingScales, microtimingMs, MAX_SHIFT, WALK_SCALE,
} from "./microtiming.js";
export { mutatePattern } from "./mutate.js";

export {
  // poly lanes (docs/SERPE_POLY.md): / separates, name= labels, @ offsets
  parsePolyUPI, formatPolyUPI, splitLanes, offsetTicks, polyLaneAt,
} from "./poly.js";
