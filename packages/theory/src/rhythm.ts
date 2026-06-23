/**
 * Rhythm algorithms — ported from Serpe (rhythm_pattern_explorer WebApp):
 * pattern-generators.js (EuclideanGenerator) and pattern-analysis.js
 * (SyncopationAnalyzer's Barlow indispensability, BarlowTransformer).
 *
 * Patterns are boolean arrays: index = step, true = onset.
 */

// ─── Euclidean rhythms (Björklund) ──────────────────────────────────────

/**
 * Generate a Euclidean rhythm via Björklund's algorithm, normalized to
 * start on the first onset, then rotated right by `offset` (matching
 * Serpe's `@` rotation operator).
 *
 * E(3,8) = tresillo [x..x..x.], E(5,8) = cinquillo [x.xx.xx.].
 */
export function euclideanRhythm(beats: number, steps: number, offset = 0): boolean[] {
  if (beats > steps) beats = steps;
  if (beats <= 0) return new Array<boolean>(steps).fill(false);

  let pattern: boolean[] = [];
  const counts: number[] = [];
  const remainders: number[] = [];

  let divisor = steps - beats;
  remainders[0] = beats;
  let level = 0;

  do {
    counts[level] = Math.floor(divisor / remainders[level]!);
    remainders[level + 1] = divisor % remainders[level]!;
    divisor = remainders[level]!;
    level++;
  } while (remainders[level]! > 1);

  counts[level] = divisor;

  function build(l: number): void {
    if (l === -1) {
      pattern.push(false);
    } else if (l === -2) {
      pattern.push(true);
    } else {
      for (let i = 0; i < counts[l]!; i++) {
        build(l - 1);
      }
      if (remainders[l] !== 0) {
        build(l - 2);
      }
    }
  }

  build(level);

  while (pattern.length < steps) {
    pattern.push(false);
  }

  const firstBeatIndex = pattern.findIndex((beat) => beat);
  if (firstBeatIndex > 0) {
    pattern = pattern.slice(firstBeatIndex).concat(pattern.slice(0, firstBeatIndex));
  }

  if (offset !== 0) {
    offset = ((offset % steps) + steps) % steps;
    const offsetPattern = new Array<boolean>(steps);
    for (let i = 0; i < steps; i++) {
      offsetPattern[i] = pattern[(i - offset + steps) % steps]!;
    }
    pattern = offsetPattern;
  }

  return pattern;
}

/** Euclidean complement: E(steps−beats, steps) — fills the remaining positions. */
export function euclideanComplement(beats: number, steps: number, offset = 0): boolean[] {
  return euclideanRhythm(steps - beats, steps, offset);
}

// ─── Barlow indispensability ────────────────────────────────────────────

function greatestCommonDivisor(a: number, b: number): number {
  while (b !== 0) {
    const temp = b;
    b = a % b;
    a = temp;
  }
  return a;
}

function getPrimeFactors(n: number): number[] {
  const factors: number[] = [];
  let divisor = 2;
  while (n > 1) {
    while (n % divisor === 0) {
      factors.push(divisor);
      n /= divisor;
    }
    divisor++;
  }
  return factors;
}

/** Stratified meter decomposition: sorted prime factorization hierarchy. */
function getStratifiedMeter(length: number): number[] {
  return getPrimeFactors(length).sort((a, b) => a - b);
}

/**
 * Indispensability of one position in a meter of `length` steps
 * (Serpe's enhanced Barlow method: downbeat = 1, pickup = 0.75,
 * stratified meter decomposition with prime-factor fallback).
 */
export function positionIndispensability(position: number, length: number): number {
  if (position === 0) return 1;
  if (position === length - 1) return 0.75; // anacrustic pickup

  const stratification = getStratifiedMeter(length);
  let totalIndispensability = 0;

  for (let level = 0; level < stratification.length; level++) {
    const primeAtLevel = stratification[level]!;
    const levelSize = length / Math.pow(primeAtLevel, level + 1);

    if (levelSize > 0 && position % levelSize === 0) {
      totalIndispensability += 1 / Math.pow(primeAtLevel, level + 1);
    }
  }

  if (totalIndispensability === 0) {
    const gcd = greatestCommonDivisor(position, length);
    const level = length / gcd;
    const primeFactors = getPrimeFactors(level);
    totalIndispensability = 1;
    for (const prime of primeFactors) {
      totalIndispensability *= 1 / prime;
    }
  }

  return Math.min(totalIndispensability, 1);
}

/** Barlow indispensability table for every position of a meter. */
export function barlowIndispensabilityTable(length: number): number[] {
  const table = new Array<number>(length);
  for (let i = 0; i < length; i++) {
    table[i] = positionIndispensability(i, length);
  }
  return table;
}

/**
 * Barlow-based syncopation measure for a set of onset positions:
 * mean of (1 − normalized indispensability) over the onsets. 0 = fully
 * on the grid's strong points, towards 1 = maximally syncopated.
 */
export function barlowSyncopation(onsetPositions: number[], stepCount: number): number {
  const table = barlowIndispensabilityTable(stepCount);
  const max = Math.max(...table);
  let total = 0;
  for (const position of onsetPositions) {
    total += 1 - table[position]! / max;
  }
  return onsetPositions.length > 0 ? total / onsetPositions.length : 0;
}

// ─── Barlow transformer (dilution / concentration) ──────────────────────

export interface BarlowTransformOptions {
  /** Reverse indispensability logic (anti-metrical). Default false. */
  wolrabMode?: boolean;
  /** Keep the position-0 onset during dilution. Default true. */
  preserveDownbeat?: boolean;
  /** Minimum indispensability threshold for removal. Default 0. */
  minimumIndispensability?: number;
  /** Deprioritize weak beats during concentration. Default false. */
  avoidWeakBeats?: boolean;
}

export interface PositionScore {
  position: number;
  indispensability: number;
}

export interface BarlowTransformResult {
  pattern: boolean[];
  originalPattern: boolean[];
  transformation: "none" | "dilution" | "concentration" | "wolrab-dilution" | "wolrab-concentration";
  targetOnsets: number;
  currentOnsets: number;
  removedPositions?: PositionScore[];
  addedPositions?: PositionScore[];
  description: string;
}

/** Indispensability ranking of all positions, highest first. */
export function barlowRanking(table: number[]): Array<PositionScore & { rank: number }> {
  return table
    .map((value, position) => ({ position, indispensability: value }))
    .sort((a, b) => b.indispensability - a.indispensability)
    .map((item, rank) => ({ ...item, rank: rank + 1 }));
}

function isWeakBeat(position: number, stepCount: number): boolean {
  const quarter = stepCount / 4;
  const eighth = stepCount / 8;
  return !(position % quarter === 0 || position % eighth === 0);
}

/**
 * Transform a pattern to a target onset count using Barlow indispensability:
 * dilution removes the least indispensable onsets, concentration adds the
 * most indispensable empty positions. Wolrab mode reverses both.
 */
export function barlowTransform(
  pattern: boolean[],
  targetOnsets: number,
  options: BarlowTransformOptions = {},
): BarlowTransformResult {
  const stepCount = pattern.length;
  const currentOnsets = pattern.filter((step) => step).length;
  const { wolrabMode = false } = options;

  if (targetOnsets === currentOnsets) {
    return {
      pattern: [...pattern],
      originalPattern: [...pattern],
      transformation: "none",
      targetOnsets,
      currentOnsets,
      description: "No transformation needed",
    };
  }

  const table = barlowIndispensabilityTable(stepCount);
  return targetOnsets < currentOnsets
    ? dilute(pattern, targetOnsets, table, options)
    : concentrate(pattern, targetOnsets, table, options);
}

function dilute(
  pattern: boolean[],
  targetOnsets: number,
  table: number[],
  options: BarlowTransformOptions,
): BarlowTransformResult {
  const { preserveDownbeat = true, minimumIndispensability = 0.0, wolrabMode = false } = options;
  const currentOnsets = pattern.filter((step) => step).length;
  const onsetsToRemove = currentOnsets - targetOnsets;

  const onsetPositions = pattern
    .map((on, i) => ({ position: i, indispensability: table[i]!, isDownbeat: i === 0, on }))
    .filter((p) => p.on);

  onsetPositions.sort((a, b) => {
    if (preserveDownbeat && !wolrabMode) {
      if (a.isDownbeat && !b.isDownbeat) return 1;
      if (!a.isDownbeat && b.isDownbeat) return -1;
    }
    return wolrabMode
      ? b.indispensability - a.indispensability
      : a.indispensability - b.indispensability;
  });

  const newPattern = [...pattern];
  const removedPositions: PositionScore[] = [];

  for (let i = 0; i < Math.min(onsetsToRemove, onsetPositions.length); i++) {
    const candidate = onsetPositions[i]!;
    if (
      wolrabMode ||
      candidate.indispensability >= minimumIndispensability ||
      !preserveDownbeat ||
      !candidate.isDownbeat
    ) {
      newPattern[candidate.position] = false;
      removedPositions.push({ position: candidate.position, indispensability: candidate.indispensability });
    }
  }

  const finalOnsets = newPattern.filter((step) => step).length;
  const name = wolrabMode ? "wolrab-dilution" : "dilution";
  const mode = wolrabMode ? "Wolrab-diluted" : "Diluted";
  const method = wolrabMode ? "removing most indispensable onsets" : "removing least indispensable onsets";

  return {
    pattern: newPattern,
    originalPattern: [...pattern],
    transformation: name,
    targetOnsets,
    currentOnsets: finalOnsets,
    removedPositions,
    description: `${mode} from ${currentOnsets} to ${finalOnsets} onsets by ${method}`,
  };
}

function concentrate(
  pattern: boolean[],
  targetOnsets: number,
  table: number[],
  options: BarlowTransformOptions,
): BarlowTransformResult {
  const { avoidWeakBeats = false, minimumIndispensability = 0.1, wolrabMode = false } = options;
  const stepCount = pattern.length;
  const currentOnsets = pattern.filter((step) => step).length;
  const onsetsToAdd = targetOnsets - currentOnsets;

  const emptyPositions = pattern
    .map((on, i) => ({ position: i, indispensability: table[i]!, isWeakBeat: isWeakBeat(i, stepCount), on }))
    .filter((p) => !p.on);

  emptyPositions.sort((a, b) => {
    if (avoidWeakBeats) {
      if (a.isWeakBeat && !b.isWeakBeat) return 1;
      if (!a.isWeakBeat && b.isWeakBeat) return -1;
    }
    return wolrabMode
      ? a.indispensability - b.indispensability
      : b.indispensability - a.indispensability;
  });

  const newPattern = [...pattern];
  const addedPositions: PositionScore[] = [];

  let addedCount = 0;
  for (let i = 0; i < emptyPositions.length && addedCount < onsetsToAdd; i++) {
    const candidate = emptyPositions[i]!;
    if (candidate.indispensability >= minimumIndispensability) {
      newPattern[candidate.position] = true;
      addedPositions.push({ position: candidate.position, indispensability: candidate.indispensability });
      addedCount++;
    }
  }

  if (addedCount < onsetsToAdd) {
    for (let i = 0; i < emptyPositions.length && addedCount < onsetsToAdd; i++) {
      const candidate = emptyPositions[i]!;
      if (newPattern[candidate.position]) continue;
      newPattern[candidate.position] = true;
      addedPositions.push({ position: candidate.position, indispensability: candidate.indispensability });
      addedCount++;
    }
  }

  const finalOnsets = newPattern.filter((step) => step).length;
  const name = wolrabMode ? "wolrab-concentration" : "concentration";
  const mode = wolrabMode ? "Wolrab-concentrated" : "Concentrated";
  const method = wolrabMode ? "adding least indispensable positions" : "adding most indispensable positions";

  return {
    pattern: newPattern,
    originalPattern: [...pattern],
    transformation: name,
    targetOnsets,
    currentOnsets: finalOnsets,
    addedPositions,
    description: `${mode} from ${currentOnsets} to ${finalOnsets} onsets by ${method}`,
  };
}

// ─── Pattern codecs (binary / decimal / hex) ────────────────────────────
//
// Suite-wide convention (strict): everything reads left to right, low-order
// first. The FIRST step is bit 0, so a single onset on step k has value 2^k.
//   - decimal = Σ pattern[i]·2^i  (an ordinary integer)
//   - hex/octal group the steps left to right (steps 0-3 = the leftmost hex
//     digit) and emit those digit values left to right — i.e. the digit string
//     is little-endian, the reverse of the integer's ordinary numeral.
//   pattern      hex    octal  decimal
//   "1000"       1      1      1
//   "1011"       D      51     13
//   "10111010"   D5     531    93
//   "10010010"   94     111    73   (E(3,8) tresillo, onsets 0,3,6)
// So hex 0x94 and decimal 73 are the SAME pattern in different transcriptions
// (0x94 read low-digit-first = 9 + 4·16 = 73), not equal as raw numbers.
// Trailing high bits vanish in a bare numeral, so decimal/hex/octal forms carry
// an explicit step count (the ":N" suffix in Serpe's UPI notation).

/** Pattern → binary string, first step leftmost. */
export function patternToBinaryString(pattern: boolean[]): string {
  return pattern.map((s) => (s ? "1" : "0")).join("");
}

/** Binary string → pattern. Throws on characters other than 0/1. */
export function patternFromBinaryString(binary: string): boolean[] {
  if (!/^[01]*$/.test(binary)) throw new Error(`Invalid binary pattern: ${binary}`);
  return [...binary].map((c) => c === "1");
}

/** Pattern → decimal value (first step = LSB, so step k contributes 2^k). */
export function patternToDecimal(pattern: boolean[]): number {
  let value = 0;
  for (let i = 0; i < pattern.length; i++) if (pattern[i]) value += 2 ** i;
  return value;
}

/** Decimal + step count → pattern (first step = LSB; high bits = later steps). */
export function patternFromDecimal(value: number, steps: number): boolean[] {
  if (!Number.isInteger(value) || value < 0) throw new Error(`Invalid pattern value: ${value}`);
  if (value >= 2 ** steps) throw new Error(`Value ${value} does not fit in ${steps} steps`);
  const pattern = new Array<boolean>(steps).fill(false);
  for (let i = 0; i < steps; i++) pattern[i] = Math.floor(value / 2 ** i) % 2 === 1;
  return pattern;
}

// Hex/octal are written strictly left to right too: the FIRST step's nibble
// (steps 0-3) is the LEFTMOST hex digit, so the digit string is little-endian.
// tresillo 10010010 → nibbles 1001=9, 0010=4 → "94" (not the value's "49").
// The value is unchanged (0x94 read low-digit-first = 9 + 4·16 = 73 = decimal);
// we just reverse the ordinary numeral's digits.

/** Pattern → uppercase hex, first step's nibble leftmost (little-endian digits). */
export function patternToHex(pattern: boolean[]): string {
  return [...patternToDecimal(pattern).toString(16).toUpperCase()].reverse().join("");
}

/** Hex (with or without 0x) + step count → pattern. Digits are little-endian. */
export function patternFromHex(hex: string, steps: number): boolean[] {
  const cleaned = hex.replace(/^0x/i, "");
  if (!/^[0-9a-fA-F]+$/.test(cleaned)) throw new Error(`Invalid hex pattern: ${hex}`);
  return patternFromDecimal(parseInt([...cleaned].reverse().join(""), 16), steps);
}

/** Pattern → octal, first step's triplet leftmost (little-endian digits). */
export function patternToOctal(pattern: boolean[]): string {
  return [...patternToDecimal(pattern).toString(8)].reverse().join("");
}

/** Octal (with or without 0o) + step count → pattern. Digits are little-endian. */
export function patternFromOctal(octal: string, steps: number): boolean[] {
  const cleaned = octal.replace(/^0o/i, "");
  if (!/^[0-7]+$/.test(cleaned)) throw new Error(`Invalid octal pattern: ${octal}`);
  return patternFromDecimal(parseInt([...cleaned].reverse().join(""), 8), steps);
}
