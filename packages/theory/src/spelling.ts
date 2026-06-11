/**
 * Spelled pitches — proper note names in chords and scales.
 *
 * Suite convention (see CONVENTIONS.md): in a chord or scale context, notes
 * are called by their proper names, derived structurally — the interval's
 * DEGREE determines the letter (a third from G♯ is some kind of B; never C),
 * and the interval's SIZE in semitones determines the alteration. From G♯,
 * the major third is B♯; C would be a diminished fourth.
 *
 * This is the opposite of pitch-class display: a bare pitch class has no
 * proper spelling without context (no way to tell G from F𝄪). Use
 * pitch.ts / chords.ts chromatic names only for context-free PCS display.
 */

import { mod12 } from "./pitch.js";

/** Letters in scale order starting at C, with their natural pitch classes. */
const LETTERS = ["C", "D", "E", "F", "G", "A", "B"] as const;
const LETTER_PCS = [0, 2, 4, 5, 7, 9, 11] as const;

export interface SpelledNote {
  /** 0 = C, 1 = D, … 6 = B */
  letterIndex: number;
  /** Semitone alteration: −2 = 𝄫, −1 = ♭, 0 = natural, +1 = ♯, +2 = 𝄪 */
  alteration: number;
}

/** Pitch class of a spelled note. */
export function spelledToPc(note: SpelledNote): number {
  return mod12(LETTER_PCS[note.letterIndex]! + note.alteration);
}

/**
 * Parse a note name into a spelled note. Accepts ASCII (#, b, x) and
 * Unicode (♯, ♭, 𝄪, 𝄫) accidentals, in any combination.
 * Returns undefined for unparseable input.
 */
export function parseSpelled(name: string): SpelledNote | undefined {
  const m = /^([A-Ga-g])(.*)$/.exec(name.trim());
  if (!m) return undefined;
  const letterIndex = LETTERS.indexOf(m[1]!.toUpperCase() as (typeof LETTERS)[number]);
  if (letterIndex < 0) return undefined;
  let alteration = 0;
  for (const ch of m[2]!) {
    if (ch === "#" || ch === "♯") alteration += 1;
    else if (ch === "b" || ch === "♭") alteration -= 1;
    else if (ch === "x" || ch === "𝄪") alteration += 2;
    else if (ch === "𝄫") alteration -= 2;
    else return undefined;
  }
  return { letterIndex, alteration };
}

/** Render a spelled note with Unicode accidentals (♯ ♭ 𝄪 𝄫, stacked beyond ±2). */
export function formatSpelled(note: SpelledNote): string {
  const letter = LETTERS[note.letterIndex]!;
  let alt = note.alteration;
  let acc = "";
  while (alt >= 2) { acc += "𝄪"; alt -= 2; }
  while (alt <= -2) { acc += "𝄫"; alt += 2; }
  if (alt === 1) acc = "♯" + acc;
  if (alt === -1) acc = "♭" + acc;
  return letter + acc;
}

/**
 * Transpose a spelled note by a structural interval: `letterSteps` letters up
 * (a third = 2, a fifth = 4, …) spanning `semitones` semitones. The letter is
 * fixed by the degree; the alteration absorbs the difference.
 *
 * transposeSpelled(G♯, 2, 4) = B♯ (major third) — never C.
 */
export function transposeSpelled(root: SpelledNote, letterSteps: number, semitones: number): SpelledNote {
  const letterIndex = (((root.letterIndex + letterSteps) % 7) + 7) % 7;
  const targetPc = mod12(spelledToPc(root) + semitones);
  const naturalPc = LETTER_PCS[letterIndex]!;
  // Smallest signed alteration that reaches targetPc from the natural letter.
  let alteration = targetPc - naturalPc;
  if (alteration > 6) alteration -= 12;
  if (alteration < -6) alteration += 12;
  return { letterIndex, alteration };
}

/**
 * Degree number (1-based) named by an interval label such as
 * "R", "3", "♭7", "𝄫7", "♯11", "b13", "∆7". Compound degrees keep their
 * number (9, 11, 13) — the letter is the same as 2, 4, 6.
 * Returns undefined when no degree digit is present.
 */
export function degreeFromIntervalLabel(label: string): number | undefined {
  if (/^R$/i.test(label.trim())) return 1;
  const m = /(\d+)/.exec(label);
  if (!m) return undefined;
  const n = parseInt(m[1]!, 10);
  return n >= 1 ? n : undefined;
}

/**
 * Properly spell the tones of a chord: the root name fixes the letters via
 * each interval's degree; each tone's semitone offset fixes its alteration.
 *
 * `intervals` and `semitones` are parallel (a ChordQuality's `intervals`
 * and `pcs` arrays). Returns names parallel to the inputs, or undefined if
 * the root name is unparseable; tones whose label has no degree fall back
 * to chromatic-from-root spelling via minimal alteration on the root letter
 * — callers should avoid that by providing labeled intervals.
 */
export function spellChordTones(
  rootName: string,
  intervals: readonly string[],
  semitones: readonly number[],
): string[] | undefined {
  const root = parseSpelled(rootName);
  if (!root) return undefined;
  const names: string[] = [];
  for (let i = 0; i < semitones.length; i++) {
    const degree = degreeFromIntervalLabel(intervals[i] ?? "");
    const steps = degree !== undefined ? (degree - 1) % 7 : 0;
    names.push(formatSpelled(transposeSpelled(root, steps, semitones[i]!)));
  }
  return names;
}

/**
 * Properly spell a heptatonic scale: seven consecutive letters, one each,
 * alterations derived from the interval structure.
 *
 * `intervals` are semitone offsets from the root, ascending, starting at 0
 * (e.g. major = [0,2,4,5,7,9,11]). Only defined for exactly 7 notes —
 * non-heptatonic collections have no single proper spelling (returns
 * undefined; display those as pitch classes instead).
 */
export function spellScale(rootName: string, intervals: readonly number[]): string[] | undefined {
  if (intervals.length !== 7 || intervals[0] !== 0) return undefined;
  const root = parseSpelled(rootName);
  if (!root) return undefined;
  return intervals.map((semis, i) => formatSpelled(transposeSpelled(root, i, semis)));
}
