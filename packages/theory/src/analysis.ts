/**
 * Degree assertion — which scale degree a chord root denotes in a key.
 *
 * This is the module the corpus transition-table regeneration depends on
 * (see SUITE_AUDIT_AND_PLAN.md F3/F9): the old pipeline guessed degrees
 * from pitch classes and drifted on enharmonics. Here the rules are
 * explicit and structural (CONVENTIONS.md):
 *
 *   - The LETTER distance between chord root and tonic fixes the degree:
 *     any B-rooted chord in some E key is a fifth (V), whatever the
 *     accidentals.
 *   - The pitch-class difference against the diatonic degree fixes the
 *     alteration prefix: in E♭ major, G♭ is ♭III, G♯ is ♯III.
 *   - Enharmonic respelling is OPT-IN and reported, never silent: with
 *     `respell`, a root whose written spelling yields an exotic degree is
 *     re-spelled (same pitch class) to minimize the alteration, and the
 *     result says so. Corpus inconsistencies become visible, not baked in.
 *
 * Minor keys use the natural-minor diatonic frame (♭III, ♭VI, ♭VII are
 * degrees III, VI, VII with alteration 0); the harmonic/melodic sevenths
 * surface as ♯VII etc. — a documented convention, matching the legacy
 * transition tables' "major"/"minor" split.
 */

import { mod12 } from "./pitch.js";
import {
  formatSpelled,
  parseSpelled,
  spelledToPc,
  transposeSpelled,
  type SpelledNote,
} from "./spelling.js";

export type Mode = "major" | "minor";

export interface KeyContext {
  /** Spelled tonic, e.g. "E♭", "F♯", "C". */
  tonic: string;
  mode: Mode;
}

export interface RomanDegree {
  /** 1–7. */
  degree: number;
  /** Semitone alteration vs the diatonic degree: −1 = ♭, +1 = ♯ … */
  alteration: number;
  /** e.g. "V", "♭III", "♯IV", "𝄫VII". */
  numeral: string;
  /** The root spelling the assertion used (≠ input when respelled). */
  rootUsed: string;
  /** True when `respell` changed the written spelling. */
  respelled: boolean;
}

export interface AssertDegreeOptions {
  /**
   * Re-spell the chord root enharmonically (same pitch class) when that
   * yields a smaller alteration. Off by default: the written spelling is
   * the writer's claim about function, and overriding it should be a
   * deliberate, visible act.
   */
  respell?: boolean;
  /**
   * When two respellings tie on |degree alteration| AND |spelling
   * alteration| (the tritone cases), which side wins. Jazz convention is
   * quality-dependent: dominant-family chords read as flat degrees
   * (D♭7 = ♭II7, the tritone sub) while diminished-family chords read as
   * sharp degrees (C♯dim7 = ♯I°7, the passing diminished). Default "flat".
   */
  tieBreak?: "flat" | "sharp";
}

const ROMANS = ["I", "II", "III", "IV", "V", "VI", "VII"] as const;
const MAJOR_DEGREE_PCS = [0, 2, 4, 5, 7, 9, 11] as const;
const MINOR_DEGREE_PCS = [0, 2, 3, 5, 7, 8, 10] as const;
const LETTER_NATURAL_PCS = [0, 2, 4, 5, 7, 9, 11] as const; // C D E F G A B

function alterationPrefix(alt: number): string {
  if (alt === 0) return "";
  let s = "";
  let a = alt;
  while (a >= 2) { s += "𝄪"; a -= 2; }
  while (a <= -2) { s += "𝄫"; a += 2; }
  if (a === 1) s = "♯" + s;
  if (a === -1) s = "♭" + s;
  return s;
}

function degreeFor(root: SpelledNote, tonic: SpelledNote, mode: Mode): { degree: number; alteration: number } {
  const degreeIndex = (((root.letterIndex - tonic.letterIndex) % 7) + 7) % 7;
  const frame = mode === "major" ? MAJOR_DEGREE_PCS : MINOR_DEGREE_PCS;
  const diatonicPc = mod12(spelledToPc(tonic) + frame[degreeIndex]!);
  let alteration = spelledToPc(root) - diatonicPc;
  if (alteration > 6) alteration -= 12;
  if (alteration < -6) alteration += 12;
  return { degree: degreeIndex + 1, alteration };
}

/** All spellings of a pitch class with |letter alteration| ≤ 2. */
function spellingsOfPc(pc: number): SpelledNote[] {
  const out: SpelledNote[] = [];
  for (let letterIndex = 0; letterIndex < 7; letterIndex++) {
    let alteration = mod12(pc) - LETTER_NATURAL_PCS[letterIndex]!;
    if (alteration > 6) alteration -= 12;
    if (alteration < -6) alteration += 12;
    if (Math.abs(alteration) <= 2) out.push({ letterIndex, alteration });
  }
  return out;
}

/**
 * Assert the scale degree of a chord root (a spelled note name) within a
 * key. Throws on unparseable input — callers in data pipelines should
 * pre-validate via parseChordSymbol / parseSpelled and audit failures.
 */
export function assertDegree(
  chordRootName: string,
  key: KeyContext,
  options: AssertDegreeOptions = {},
): RomanDegree {
  const tonic = parseSpelled(key.tonic);
  if (!tonic) throw new Error(`Unparseable tonic: ${key.tonic}`);
  const written = parseSpelled(chordRootName);
  if (!written) throw new Error(`Unparseable chord root: ${chordRootName}`);

  let chosen = written;
  let best = degreeFor(written, tonic, key.mode);
  let respelled = false;

  if (options.respell) {
    const tieBreak = options.tieBreak ?? "flat";
    for (const candidate of spellingsOfPc(spelledToPc(written))) {
      const result = degreeFor(candidate, tonic, key.mode);
      // Preference order:
      //   1. smaller |degree alteration| (the point of respelling);
      //   2. simpler spelling — never trade A for B𝄫 to flip ♯IV into ♭V;
      //   3. flat vs sharp degree per tieBreak (the genuine tritone ties).
      const cmp =
        Math.abs(result.alteration) - Math.abs(best.alteration) ||
        Math.abs(candidate.alteration) - Math.abs(chosen.alteration) ||
        (tieBreak === "flat"
          ? result.alteration - best.alteration
          : best.alteration - result.alteration);
      if (cmp < 0) {
        chosen = candidate;
        best = result;
      }
    }
    respelled =
      chosen.letterIndex !== written.letterIndex || chosen.alteration !== written.alteration;
  }

  return {
    degree: best.degree,
    alteration: best.alteration,
    numeral: alterationPrefix(best.alteration) + ROMANS[best.degree - 1]!,
    rootUsed: formatSpelled(chosen),
    respelled,
  };
}

/**
 * Transition-table label: numeral + quality suffix, e.g. "V7", "IIm7",
 * "♭IIIdim7". The suffix is whatever canonical form the caller settles on
 * (dictionary key, normalized shorthand, or the raw corpus suffix).
 */
export function formatDegreeLabel(degree: RomanDegree, suffix: string): string {
  return degree.numeral + suffix;
}

/**
 * Inverse of assertDegree: resolve a Roman numeral (with optional ♭/♯/𝄪/𝄫
 * or ASCII b/# prefixes) to a properly spelled chord root in a key.
 * resolveDegree("♭III", {tonic:"C", mode:"major"}) → "E♭".
 */
export function resolveDegree(numeral: string, key: KeyContext): string {
  const tonic = parseSpelled(key.tonic);
  if (!tonic) throw new Error(`Unparseable tonic: ${key.tonic}`);
  const m = /^([♭♯b#𝄪𝄫]*)(VII|VI|V|IV|III|II|I)$/.exec(numeral.trim());
  if (!m) throw new Error(`Unparseable numeral: ${numeral}`);
  let alteration = 0;
  for (const ch of m[1]!) {
    if (ch === "♯" || ch === "#") alteration += 1;
    else if (ch === "♭" || ch === "b") alteration -= 1;
    else if (ch === "𝄪") alteration += 2;
    else if (ch === "𝄫") alteration -= 2;
  }
  const degree = ROMANS.indexOf(m[2]! as (typeof ROMANS)[number]) + 1;
  const frame = key.mode === "major" ? MAJOR_DEGREE_PCS : MINOR_DEGREE_PCS;
  const semitones = frame[degree - 1]! + alteration;
  return formatSpelled(transposeSpelled(tonic, degree - 1, semitones));
}
