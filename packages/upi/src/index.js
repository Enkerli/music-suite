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
 * Progressive/scene state is stateful and stays engine-side (the C++ plugin);
 * this package is the pure notation + generators + transforms + analysis.
 */
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
export { mutatePattern } from "./mutate.js";
