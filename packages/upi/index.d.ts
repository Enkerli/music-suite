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
  /** `LS(…)` durational suffix, when present — note LENGTH. */
  longShort: { min: number; max: number; depth: number } | null;
  /** `PD(…)` microtiming suffix, when present — note PLACEMENT. */
  microtiming: { depth: number; seed: number } | null;
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

// ── Recognition + decomposition (src/decompose.js) ──────────────────────────
export interface EuclideanMatch {
  beats: number; steps: number; offset: number;
  /** E(k,n) or E(k,n,offset) when rotated. */
  formula: string;
}
export interface BarlowMatch {
  beats: number; steps: number;
  /** true when the anti-metric (Wolrab) ranking produced the match. */
  wolrab: boolean;
  /** B(k,n) or W(k,n). */
  formula: string;
}
export interface Reading {
  terms: string[];
  /** The terms joined with " + ". */
  formula: string;
  /** Always true — a reading is only returned if it reproduces the input. */
  exact: boolean;
}
export function detectEuclidean(steps: boolean[]): EuclideanMatch | null;
export function detectBarlow(steps: boolean[]): BarlowMatch | null;
export function decompose(steps: boolean[], opts?: { maxTerms?: number; maxResults?: number }): Reading[];
export function identify(steps: boolean[]): {
  onsets: number[]; stepCount: number;
  euclidean: EuclideanMatch | null; barlow: BarlowMatch | null;
  readings: Reading[]; best: Reading | null;
};

// ── Long/short durational analysis (src/longshort.js) ───────────────────────
export interface LongShortResult {
  intervals: number[];
  counts: Record<number, number>;
  short: number | null; long: number | null;
  /** long / short — a float, not rounded. */
  ratio: number | null;
  spread: number;
  types: string[];
  /** e.g. "LLS". */
  pattern: string;
  /** e.g. "--." — analysis OUTPUT, not UPI's Morse input notation. */
  morse: string;
  /** Named prosodic foot, "isochronous", "mixed" or "complex". */
  foot: string;
  isochronous: boolean;
  description: string;
}
export function longShort(steps: boolean[], opts?: { tolerance?: number }): LongShortResult;
export function durations(steps: boolean[], opts?: { unit?: number; ratio?: number }): number[];
/**
 * Steps from onset `i` to the next onset, wrapping; the whole cycle when it is
 * the only onset. The span an onset OWNS — what Serpe's duration arcs draw and
 * what `msuite upi --midi --gate` writes into note lengths.
 */
export function interOnsetSteps(steps: ArrayLike<unknown>, i: number): number;

// ── Named-pattern import (src/named.js) ─────────────────────────────────────
export interface NamedPattern {
  name: string;
  steps: boolean[];
  stepCount: number;
  /** The spec as typed: "[0,2,4,7,9]/12", "0x5BA:12", "E(7,12)". */
  source: string;
}
export interface NamedPatternDescription {
  name: string; binary: string; stepCount: number;
  onsets: number[]; onsetCount: number; source: string;
  euclidean: string | null; barlow: string | null; reading: string | null;
  longShort: string; foot: string; intervals: number[]; ratio: number | null;
}
export function parseNamedPattern(line: string, opts?: { defaultSteps?: number }): NamedPattern;
export function parseNamedPatterns(text: string, opts?: { defaultSteps?: number }): {
  patterns: NamedPattern[];
  errors: Array<{ line: number; text: string; error: string }>;
};
export function describeNamedPattern(entry: NamedPattern): NamedPatternDescription;

/** Long/short durations that breathe — the pocket walk applied to duration. */
export function dynamicDurations(steps: boolean[], opts?: {
  unit?: number;
  /** A point, or a [min,max] range the walk stays within. */
  ratio?: number | [number, number];
  depth?: number; seed?: number; pass?: number;
}): number[];

/** The `LS(…)` durational suffix, split off a UPI string. */
export interface LongShortSpec { min: number; max: number; depth: number }
export function parseLongShortSuffix(text: string): { rest: string; longShort: LongShortSpec | null };

// ── Microtiming (src/microtiming.js) — Keil participatory discrepancies ─────
export interface MicrotimingSpec { depth: number; seed: number }
/** Per-STEP displacement, fractions of a step; + late, − early. */
export function microtiming(steps: boolean[], opts?: {
  depth?: number; seed?: number; pass?: number; maxShift?: number;
}): number[];
/** Displacements → per-step length multipliers. Sums to the nominal bar. */
export function timingScales(shift: number[]): number[];
export function microtimingMs(steps: boolean[], stepMs: number, opts?: {
  depth?: number; seed?: number; pass?: number; maxShift?: number;
}): number[];
export function parseMicrotimingSuffix(text: string): { rest: string; microtiming: MicrotimingSpec | null };
export function additiveToSteps(groups: number[]): number[];

// ── Progressive notation (stateful forms) ────────────────────────────────────
/** `pat>N` transform · `pat%N`/`pat+N` offset · `pat*N` lengthening. */
export interface ProgressiveDesc {
  kind: "transform" | "offset" | "lengthen";
  base: string;
  source: string;
  /** transform only: b|w|e|d, defaulting to Barlow. */
  type?: "b" | "w" | "e" | "d";
  /** transform only: the onset count the progression walks toward. */
  target?: number;
  /** offset / lengthen only. */
  step?: number;
}
export interface ProgressiveStep { steps: number[]; index: number; label: string; error?: string }
export interface ProgressiveOpts {
  parseBase: (s: string) => { steps: number[] } | null;
  /** Lengthening RNG; defaults to Math.random (lengthening is random by design). */
  random?: () => number;
}
/** Null when the string isn't progressive, so callers fall through to parseUPI. */
export function parseProgressive(input: string): ProgressiveDesc | null;
/** The pattern at trigger `n` (1-based; n=1 is the untransformed base). */
export function progressiveAt(desc: ProgressiveDesc, n: number, opts: ProgressiveOpts): ProgressiveStep;
export class ProgressiveRun {
  constructor(input: string, opts: ProgressiveOpts);
  index: number;
  next(): ProgressiveStep;
  reset(): void;
}
