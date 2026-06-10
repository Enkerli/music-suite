/**
 * Pitch-class fundamentals.
 *
 * A pitch class (PC) is an integer 0–11 (C = 0). Spelling policy is explicit:
 * conversions to names take an `Accidentals` preference rather than assuming
 * flats or sharps, because enharmonic policy was a recurring source of drift
 * across the suite's earlier implementations.
 */

export type PitchClass = number;

export type Accidentals = "flat" | "sharp";

const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"] as const;
const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

const LETTER_PCS: Record<string, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
};

/** Normalize any integer (including negatives) to 0–11. */
export function mod12(n: number): PitchClass {
  return ((n % 12) + 12) % 12;
}

/**
 * Parse a note name (e.g. "C", "Eb", "F#", "Cb", "B##") to a pitch class.
 * Returns undefined for unparseable input.
 */
export function nameToPc(name: string): PitchClass | undefined {
  const m = /^([A-Ga-g])([#b]*)$/.exec(name.trim());
  if (!m) return undefined;
  const letter = m[1]!.toUpperCase();
  const base = LETTER_PCS[letter];
  if (base === undefined) return undefined;
  let pc = base;
  for (const acc of m[2]!) pc += acc === "#" ? 1 : -1;
  return mod12(pc);
}

/** Render a pitch class as a note name under the given spelling preference. */
export function pcToName(pc: PitchClass, accidentals: Accidentals = "flat"): string {
  const names = accidentals === "flat" ? FLAT_NAMES : SHARP_NAMES;
  return names[mod12(pc)]!;
}

/**
 * Interval class: the smaller of the two circular distances between two PCs.
 * Always in 0–6.
 */
export function intervalClass(a: PitchClass, b: PitchClass): number {
  const d = mod12(b - a);
  return Math.min(d, 12 - d);
}

/**
 * Directed interval from `a` to `b`, expressed as the smallest move:
 * a value in -5…6 (ties at the tritone resolve to +6).
 */
export function directedInterval(a: PitchClass, b: PitchClass): number {
  const d = mod12(b - a);
  return d > 6 ? d - 12 : d;
}

/** Sorted, deduplicated pitch-class set. */
export function pcSet(pcs: Iterable<number>): PitchClass[] {
  return [...new Set([...pcs].map(mod12))].sort((x, y) => x - y);
}
