/**
 * Type declarations for @enkerli/upi (hand-authored — the engine is JS ESM).
 * Pragmatic types over the public surface; step arrays are number[] of 0/1.
 */

export type Steps = number[];

/** Result of parsing UPI notation. `ok:false` carries an optional error. */
export interface UpiResult {
  ok: boolean;
  steps: Steps;
  accents: number[];
  accentPattern: number[] | null;
  label: string;
  error?: string;
}

/** Rich analysis of a step array. Leftmost = LSB throughout. */
export interface Analysis {
  n: number;
  k: number;
  density: number;
  onsets: number[];
  intervals: number[];
  evenness: number;
  balanced: boolean;
  cog: { x: number; y: number; mag: number } | number;
  binary: string;
  hex: string;
  decimal: number;
}

export interface Syncopation {
  weightedNoteToBeats: number;
  offBeatRatio: number;
  expectancyViolation: number;
  rhythmicDisplacement: number;
  crossRhythmic: number;
  overall?: number;
  level?: string;
  description?: string;
  [k: string]: unknown;
}

// ── UPI notation + generators + transforms ──────────────────────────────────
export function parseUPI(input: string, ctx?: { n: number }): UpiResult;
export function primeFactors(n: number): number[];
export function euclid(k: number, n: number): Steps;
export function polygon(k: number, offset: number, n: number): Steps;
export function randomPattern(k: number, n: number): Steps;
export function rotate(steps: Steps, by: number): Steps;
export function invert(steps: Steps): Steps;
export function complement(steps: Steps): Steps;
export function quantizeSteps(steps: Steps, newStepCount: number, clockwise?: boolean): Steps;
export function indispensabilityWeights(n: number): number[];
export function barlowTransform(steps: Steps, targetK: number, anti?: boolean): Steps;
export function onsetCount(steps: Steps): number;

// ── canonical rhythm algorithms ─────────────────────────────────────────────
export function euclideanRhythm(beats: number, steps: number, offset?: number): number[];
export function euclideanComplement(beats: number, steps: number, offset?: number): number[];
export function funkyEuclidean(steps: number, params?: Record<string, unknown>): Steps;
export function bellCurveRandomSteps(numSteps: number): Steps;
export function positionIndispensability(position: number, length: number): number;
export function barlowIndispensabilityTable(length: number): number[];

// ── analysis ────────────────────────────────────────────────────────────────
export function onsetIndices(steps: Steps): number[];
export function resultant(steps: Steps): { x: number; y: number };
export function centerOfGravity(steps: Steps): { x: number; y: number; mag: number } | number;
export function perfectBalance(steps: Steps, tol?: number): boolean;
export function intervals(steps: Steps): number[];
export function evenness(steps: Steps): number;
export function analyse(steps: Steps): Analysis;
export function analyzeSyncopation(steps: Steps, stepCount: number): Syncopation;

// ── mutation ────────────────────────────────────────────────────────────────
export function mutatePattern(
  originalPattern: Steps, mutationAmount?: number, options?: Record<string, unknown>,
): { mutated: Steps; mutatedOnsets: number[]; [k: string]: unknown };

/** A per-lane micro-timing offset (docs/SERPE_POLY.md §2.3 — the Keil number). */
export type LaneOffset =
  | { kind: "ms"; ms: number }
  | { kind: "frac"; num: number; den: number };

export interface PolyLane {
  label: string;
  steps: Steps;
  accents: number[];
  accentPattern: number[] | null;
  offset: LaneOffset | null;
  /** The lane's own UPI text as given (offset stripped). */
  source: string;
  /** parseUPI's normalized label for the lane's expression. */
  parsedLabel: string;
}

export interface PolyResult {
  ok: boolean;
  lanes: PolyLane[];
  /** Display-alignment grid: lcm of lane lengths. */
  lcm: number;
  error?: string;
}

export function splitLanes(src: string): string[];
export function parsePolyUPI(input: string, ctx?: { n: number }): PolyResult;
export function formatPolyUPI(poly: PolyResult): string;
export function offsetTicks(offset: LaneOffset | null, ticksPerBeat: number, beatsPerWhole?: number): number;
