/**
 * Substitution rules — probabilistic reharmonization over a degree-label
 * stream (the corpus vocabulary: "IIm7", "V7", "Imaj7", "♭II7", …).
 *
 * Three classic moves, each applied with its own probability:
 *   - tritone (♭II7 ↔ V7): a dominant resolving down a fifth is replaced by
 *     the dominant a tritone away (they share guide tones), so V7→I becomes
 *     ♭II7→I.
 *   - backdoor (♭VII7): a dominant resolving down a fifth to a *major* target
 *     is replaced by the backdoor dominant a whole step below that target
 *     (V7→Imaj7 becomes ♭VII7→Imaj7).
 *   - passingDim: a diminished-7th passing chord is *inserted* between two
 *     chords a whole tone apart (Imaj7 → ♯I°7 → IIm7).
 *
 * Everything is computed in tonic-relative semitone space using the mode's
 * degree frame, so the rewritten numerals round-trip through `resolveDegree`
 * correctly in both major and minor (e.g. the backdoor dominant prints as
 * "♭VII7" in major but "VII7" in minor — both semitone 10). Deterministic for
 * a given (labels, seed, options). Vectors pinned in `substitutions.test.ts`.
 */

const ROMANS = ["I", "II", "III", "IV", "V", "VI", "VII"] as const;
const MAJOR_DEGREE_PCS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_DEGREE_PCS = [0, 2, 3, 5, 7, 8, 10];
const NUMERAL_RE = /^([♭♯b#𝄪𝄫]*)(VII|VI|V|IV|III|II|I)(.*)$/;

type Mode = "major" | "minor";

export interface SubstitutionOptions {
  /** P(apply) per eligible dominant for each rule, 0..1. */
  tritone?: number;
  backdoor?: number;
  passingDim?: number;
  mode?: Mode;
  /** Seed for the built-in PRNG (ignored when `rng` is given). */
  seed?: number;
  /** Override the RNG (else a seeded mulberry32). */
  rng?: () => number;
  /** Allow passing-dim *insertions* (which change the chord count). Default true. */
  allowInsertions?: boolean;
}

export interface SubstitutionEdit {
  index: number;
  rule: "tritone" | "backdoor" | "passingDim";
  from: string;
  to: string;
}

export interface SubstitutionResult {
  labels: string[];
  edits: SubstitutionEdit[];
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function accidentalSum(prefix: string): number {
  let n = 0;
  for (const ch of prefix) n += ch === "♭" || ch === "b" ? -1 : ch === "♯" || ch === "#" ? 1 : ch === "𝄫" ? -2 : ch === "𝄪" ? 2 : 0;
  return n;
}

function frameFor(mode: Mode): number[] {
  return mode === "minor" ? MINOR_DEGREE_PCS : MAJOR_DEGREE_PCS;
}

interface ParsedLabel { numeral: string; suffix: string; semitone: number; }

/** Parse a degree label into its numeral, quality suffix, and tonic-relative semitone. */
export function parseDegreeLabel(label: string, mode: Mode = "major"): ParsedLabel | null {
  const m = NUMERAL_RE.exec(label);
  if (!m) return null;
  const frame = frameFor(mode);
  const degree = ROMANS.indexOf(m[2] as (typeof ROMANS)[number]);
  if (degree < 0) return null;
  const semitone = (((frame[degree]! + accidentalSum(m[1]!)) % 12) + 12) % 12;
  return { numeral: m[1]! + m[2]!, suffix: m[3]!, semitone };
}

/** Spell a tonic-relative semitone as a numeral in the mode, with the fewest
 *  accidentals — preferring flats (or sharps for `prefer === "sharp"`). */
export function semitoneToNumeral(semitone: number, mode: Mode = "major", prefer: "flat" | "sharp" = "flat"): string {
  const frame = frameFor(mode);
  const target = (((semitone % 12) + 12) % 12);
  const order = prefer === "sharp" ? [0, 1, -1, 2, -2] : [0, -1, 1, -2, 2];
  for (const acc of order) {
    for (let d = 0; d < 7; d++) {
      if ((((frame[d]! + acc) % 12) + 12) % 12 === target) {
        const mark = acc === -1 ? "♭" : acc === 1 ? "♯" : acc === -2 ? "𝄫" : acc === 2 ? "𝄪" : "";
        return mark + ROMANS[d];
      }
    }
  }
  return "I"; // unreachable (the frame covers all 12 with ±2)
}

/** A dominant quality (major 3rd + ♭7): suffix leads with 7/9/11/13. */
function isDominant(suffix: string): boolean {
  return /^(7|9|11|13)/.test(suffix);
}

/** A major tonic target (the backdoor resolves to one): triad, maj7-family, 6/69. */
function isMajorTarget(suffix: string): boolean {
  return suffix === "" || /^(maj|M[0-9]|6|69|△|∆|\^)/.test(suffix);
}

/**
 * Apply the substitution rules to a degree-label stream. Count-preserving
 * rules (tritone, backdoor) run first in a left-to-right pass; passing-dim
 * insertions run second (skipped when `allowInsertions` is false).
 */
export function applySubstitutions(labels: string[], opts: SubstitutionOptions = {}): SubstitutionResult {
  const mode = opts.mode ?? "major";
  const pTri = opts.tritone ?? 0;
  const pBack = opts.backdoor ?? 0;
  const pDim = opts.passingDim ?? 0;
  const allowInsertions = opts.allowInsertions !== false;
  const rng = opts.rng ?? mulberry32(opts.seed ?? 1);
  const edits: SubstitutionEdit[] = [];

  // Pass 1 — tritone / backdoor (replace a down-a-fifth dominant in place).
  const out = labels.slice();
  for (let i = 0; i < out.length - 1; i++) {
    const cur = parseDegreeLabel(out[i]!, mode);
    const next = parseDegreeLabel(out[i + 1]!, mode);
    if (!cur || !next || !isDominant(cur.suffix)) continue;
    if (((cur.semitone - next.semitone + 12) % 12) !== 7) continue; // not a down-a-fifth resolution

    if (rng() < pTri) {
      const to = semitoneToNumeral((cur.semitone + 6) % 12, mode, "flat") + cur.suffix;
      edits.push({ index: i, rule: "tritone", from: out[i]!, to });
      out[i] = to;
      continue; // one reharm per chord
    }
    if (isMajorTarget(next.suffix) && rng() < pBack) {
      const to = semitoneToNumeral((next.semitone - 2 + 12) % 12, mode, "flat") + cur.suffix;
      edits.push({ index: i, rule: "backdoor", from: out[i]!, to });
      out[i] = to;
    }
  }

  // Pass 2 — passing diminished (insert between whole-tone-apart neighbours).
  if (!allowInsertions || pDim <= 0) return { labels: out, edits };
  const woven: string[] = [];
  for (let i = 0; i < out.length; i++) {
    woven.push(out[i]!);
    const a = parseDegreeLabel(out[i]!, mode);
    const b = i + 1 < out.length ? parseDegreeLabel(out[i + 1]!, mode) : null;
    if (!a || !b) continue;
    const up = (b.semitone - a.semitone + 12) % 12;
    if (up !== 2 && up !== 10) continue; // only whole-tone steps get a passing chord
    if (rng() >= pDim) continue;
    // Ascending: a chromatic step above the lower; descending: a step below the upper.
    const passSemi = up === 2 ? (a.semitone + 1) % 12 : (a.semitone - 1 + 12) % 12;
    const to = semitoneToNumeral(passSemi, mode, up === 2 ? "sharp" : "flat") + "°7";
    edits.push({ index: woven.length, rule: "passingDim", from: `${out[i]} → ${out[i + 1]}`, to });
    woven.push(to);
  }
  return { labels: woven, edits };
}
