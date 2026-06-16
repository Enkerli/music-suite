/**
 * Chord-scale relationships and avoid notes.
 *
 * Given a chord (its root and the pitch classes it spans), pick the scale a
 * soloist or comper draws on, and partition that scale into:
 *   - chord tones — the stable notes (the chord itself),
 *   - tensions    — colour notes that sit well as extensions,
 *   - avoid notes — scale tones a *minor second above a chord tone*, which
 *     form a ♭9 against it and so sound unstable as a held/landing note.
 *
 * The avoid-note test is the classical one (a tone a half-step above a chord
 * tone), computed structurally — so it always agrees with the chosen scale
 * and never needs a per-chord table. The scale is chosen by a structural
 * classifier over the chord's intervals (third / seventh / fifth + the usual
 * alterations), which is robust to the ~40 spelled qualities in `chords.ts`
 * collapsing onto a handful of scale families.
 *
 * Theory-led and framework-free: feeds ProgGenie tooltips now, and PitchFold
 * / exquisite-fingerings later. Vectors pinned in `chordScale.test.ts`.
 */

/** Scale interval sets (semitones from the scale root). */
const SCALES = {
  ionian: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
  melodicMinor: [0, 2, 3, 5, 7, 9, 11],
  lydianDominant: [0, 2, 4, 6, 7, 9, 10],
  mixolydianFlat13: [0, 2, 4, 5, 7, 8, 10], // "Hindu" / aeolian dominant
  altered: [0, 1, 3, 4, 6, 8, 10], // super-Locrian (7th mode of melodic minor)
  wholeTone: [0, 2, 4, 6, 8, 10],
  lydianAugmented: [0, 2, 4, 6, 8, 9, 11],
  diminishedWholeHalf: [0, 2, 3, 5, 6, 8, 9, 11], // over dim7
  diminishedHalfWhole: [0, 1, 3, 4, 6, 7, 9, 10], // over dominant ♭9
} as const;

export type ScaleName = keyof typeof SCALES;

/** Human label for a scale name ("lydianDominant" → "Lydian dominant"). */
export function scaleDisplayName(name: ScaleName): string {
  const words: Record<ScaleName, string> = {
    ionian: "Ionian", dorian: "Dorian", phrygian: "Phrygian", lydian: "Lydian",
    mixolydian: "Mixolydian", aeolian: "Aeolian", locrian: "Locrian",
    melodicMinor: "Melodic minor", lydianDominant: "Lydian dominant",
    mixolydianFlat13: "Mixolydian ♭13", altered: "Altered", wholeTone: "Whole tone",
    lydianAugmented: "Lydian augmented", diminishedWholeHalf: "Diminished (whole-half)",
    diminishedHalfWhole: "Diminished (half-whole)",
  };
  return words[name];
}

export interface ChordScale {
  /** The chosen scale's machine name. */
  scale: ScaleName;
  /** Its human label. */
  scaleName: string;
  /** Absolute pitch classes of the scale (rooted at the chord root). */
  scalePcs: number[];
  /** Absolute pcs that are chord tones (stable). */
  chordTones: number[];
  /** Scale pcs that colour without clashing (good extensions). */
  tensions: number[];
  /** Scale pcs a minor 2nd above a chord tone (a ♭9 clash — handle with care). */
  avoid: number[];
  /** Alternative scales a player might also use (machine names). */
  alts: ScaleName[];
}

/** Reduce a chord's absolute pcs to unique intervals (0–11) above the root. */
function intervalsFromRoot(pcs: number[], rootPc: number): number[] {
  const r = ((rootPc % 12) + 12) % 12;
  return [...new Set(pcs.map((p) => ((((p % 12) + 12) % 12) - r + 12) % 12))].sort((a, b) => a - b);
}

/**
 * Choose the chord-scale (and any alternates) for a set of intervals above the
 * root. Priority runs from the most specific quality (diminished, altered
 * dominant) to the most generic (plain major / minor).
 */
function pickScale(intervals: number[]): { scale: ScaleName; alts: ScaleName[] } {
  const has = (i: number) => intervals.includes(i);
  const third = has(4) ? "maj" : has(3) ? "min" : has(2) || has(5) ? "sus" : "none";
  const perfectFifth = has(7);
  const augFifth = has(8) && !has(7);
  const dimFifth = has(6) && !has(7);
  const maj7 = has(11);
  const flat7 = has(10);
  const dimSeventh = has(9) && !has(10) && !has(11);
  const flat9 = has(1);
  const sharp9 = has(3) && third === "maj"; // ♯9 only reads as such over a major 3rd
  const sharp11 = has(6) && perfectFifth; // ♯11 distinct from a ♭5
  const flat13 = has(8) && perfectFifth; // ♭13 distinct from a ♯5

  // Diminished seventh — symmetric whole-half.
  if (third === "min" && dimFifth && dimSeventh) return { scale: "diminishedWholeHalf", alts: [] };
  // Half-diminished — Locrian (modern players often prefer Locrian ♮2 / aeolian).
  if (third === "min" && dimFifth && flat7) return { scale: "locrian", alts: ["dorian"] };
  // Minor-major seventh — melodic minor.
  if (third === "min" && maj7) return { scale: "melodicMinor", alts: [] };
  // Minor seventh / minor — Dorian default; Aeolian when a ♭13/♭6 colours it.
  if (third === "min") {
    if (has(8) && !has(9)) return { scale: "aeolian", alts: ["phrygian", "dorian"] };
    return { scale: "dorian", alts: ["aeolian"] };
  }

  // Dominant family (major 3rd + ♭7), and dominant sus.
  if ((third === "maj" || third === "sus") && flat7) {
    if ((flat9 || sharp9) && (augFifth || dimFifth || flat13)) return { scale: "altered", alts: ["diminishedHalfWhole"] };
    if (flat9 || sharp9) return { scale: "diminishedHalfWhole", alts: ["altered"] };
    if (sharp11) return { scale: "lydianDominant", alts: ["mixolydian"] };
    if (augFifth) return { scale: "wholeTone", alts: ["altered"] };
    if (flat13) return { scale: "mixolydianFlat13", alts: ["mixolydian"] };
    return { scale: "mixolydian", alts: [] };
  }

  // Major family (major 3rd, major 7th or a bare triad/6).
  if (third === "maj") {
    if (augFifth && maj7) return { scale: "lydianAugmented", alts: ["lydian"] };
    if (augFifth) return { scale: "wholeTone", alts: [] };
    if (sharp11) return { scale: "lydian", alts: ["ionian"] };
    return { scale: "ionian", alts: ["lydian"] };
  }

  // Sus / quartal without a 7th, and anything unclassified — lean major.
  return { scale: "ionian", alts: ["mixolydian"] };
}

/**
 * The chord-scale for a chord given its root pitch class and the pcs it spans.
 * Returns null only for an empty pc set.
 */
export function chordScaleFor(rootPc: number, pcs: number[]): ChordScale | null {
  if (!pcs || pcs.length === 0) return null;
  const r = ((rootPc % 12) + 12) % 12;
  const intervals = intervalsFromRoot(pcs, r);
  const { scale, alts } = pickScale(intervals);
  const scalePcs = SCALES[scale].map((i) => (r + i) % 12);
  const chordSet = new Set(pcs.map((p) => ((p % 12) + 12) % 12));
  const chordTones = scalePcs.filter((pc) => chordSet.has(pc));
  // Avoid: a scale tone (not itself a chord tone) one semitone above a chord tone.
  const avoid = scalePcs.filter((pc) => !chordSet.has(pc) && chordSet.has((pc - 1 + 12) % 12));
  const avoidSet = new Set(avoid);
  const tensions = scalePcs.filter((pc) => !chordSet.has(pc) && !avoidSet.has(pc));
  return { scale, scaleName: scaleDisplayName(scale), scalePcs, chordTones, tensions, avoid, alts };
}
