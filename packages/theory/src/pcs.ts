/**
 * Pitch-class-set families and degree chords — ported from PickPCS
 * (Enkerli/PickPCS, src/App.jsx), the suite's concentric PCS picker.
 *
 * The k = 3–8 "scale families" are the maximally even (Euclidean) k-in-12
 * sets, each in PickPCS's chosen rotation:
 *   k=3 augmented · k=4 dim7 · k=5 major pentatonic · k=6 whole tone ·
 *   k=7 major scale · k=8 octatonic (half-whole)
 *
 * Bitmask convention matches the chord dictionary: MSB = pitch class 0
 * (pc 0 contributes 2^11), so C major scale = 2773 — see PCS_SCHEMA.md
 * in PickPCS.
 */

import { mod12 } from "./pitch.js";
import { pcsToDecimal, rootName } from "./chords.js";

/** Chromatic pc for each circle-of-fifths position (0 = C, 1 = G, …). */
export function fifthsIndexToChromatic(idx: number): number {
  const map = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5] as const;
  return map[mod12(idx)]!;
}

/** Circle-of-fifths position of a chromatic pc (inverse of the above). */
export function chromaticToFifthsIndex(pc: number): number {
  return mod12(pc * 7);
}

/** PickPCS bitmask: MSB = pc 0. Identical to the chord dictionary's pcsToDecimal. */
export function pcsToBitmask(pcs: number[]): number {
  return pcsToDecimal(pcs.map(mod12));
}

/**
 * Sensory-consonance weight per interval class (0–6), 0 = most dissonant,
 * 1 = most consonant. Rooted in the classic dyad ordering: the perfect
 * intervals (ic5) are most consonant, thirds/sixths (ic3/ic4) nearly so,
 * the tritone (ic6) and whole tone (ic2) tenser, and the semitone/major-
 * seventh (ic1) the most dissonant.
 */
const IC_CONSONANCE = [1, 0.0, 0.25, 0.8, 0.9, 1.0, 0.35] as const;

/**
 * A pitch-class set's consonance in [0, 1]: the mean consonance weight over
 * every distinct pair's interval class. A single pitch class (or fewer) is
 * trivially consonant (1). Octave-equivalent and order-independent — it
 * scores the harmonic colour of a chord, not a particular voicing.
 *
 *   consonance([0, 4, 7]) ≈ 0.9   (major triad — bright)
 *   consonance([0, 1, 2]) ≈ 0.08  (chromatic cluster — dark)
 */
export function consonance(pcs: number[]): number {
  const uniq = [...new Set(pcs.map(mod12))];
  if (uniq.length < 2) return 1;
  let sum = 0;
  let pairs = 0;
  for (let i = 0; i < uniq.length; i++) {
    for (let j = i + 1; j < uniq.length; j++) {
      const d = mod12(uniq[i]! - uniq[j]!);
      const ic = d > 6 ? 12 - d : d; // interval class 0–6
      sum += IC_CONSONANCE[ic]!;
      pairs++;
    }
  }
  return sum / pairs;
}

/** Interval patterns for the k = 3–8 Euclidean scale families (PickPCS rotations). */
export const SCALE_FAMILY_INTERVALS: Readonly<Record<number, readonly number[]>> = {
  3: [0, 4, 8],
  4: [0, 3, 6, 9],
  5: [0, 2, 4, 7, 9],
  6: [0, 2, 4, 6, 8, 10],
  7: [0, 2, 4, 5, 7, 9, 11],
  8: [0, 2, 3, 5, 6, 8, 9, 11],
};

/**
 * The k-note Euclidean scale family rooted at `rootPc`, in scale order
 * starting from the root (not sorted — degree i is scale step i).
 * Returns [] for k outside 3–8.
 */
export function scaleFamily(k: number, rootPc: number): number[] {
  const intervals = SCALE_FAMILY_INTERVALS[k];
  if (!intervals) return [];
  return intervals.map((x) => mod12(rootPc + x));
}

// ─── Degree chords ──────────────────────────────────────────────────────

/** PickPCS's display qualities for stacked degree chords. */
export type DegreeQuality =
  | "maj" | "min" | "dim" | "aug" | "sus4"
  | "maj7" | "7" | "min7" | "halfDim7" | "dim7" | "minMaj7"
  | "set";

const DEGREE_TRIADS: Readonly<Record<string, readonly number[]>> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  sus4: [0, 5, 7],
};

const DEGREE_SEVENTHS: Readonly<Record<string, readonly number[]>> = {
  maj7: [0, 4, 7, 11],
  "7": [0, 4, 7, 10],
  min7: [0, 3, 7, 10],
  halfDim7: [0, 3, 6, 10],
  dim7: [0, 3, 6, 9],
  minMaj7: [0, 3, 7, 11],
};

export interface DegreeChordInfo {
  quality: DegreeQuality | null;
  root: number | null;
  name: string;
}

/**
 * PickPCS's lightweight degree-chord classifier (triads, sus4, common
 * sevenths). Distinct from the full 146-quality detector in chordDetect.ts —
 * this one labels diatonic stacks for ring display and Roman numerals.
 *
 * ⚠️ The `name` field uses chromatic PC display (rootName) — correct for
 * PickPCS's context-free ring, but NOT proper spelling. Scale-degree and
 * functional-analysis work must spell from a named root via spelling.ts
 * (see CONVENTIONS.md).
 */
export function classifyDegreeChord(pcsInput: number[]): DegreeChordInfo {
  const pcs = [...pcsInput].sort((a, b) => a - b);
  if (pcs.length < 3) return { quality: null, root: null, name: "" };

  for (const root of pcs) {
    const norm = pcs.map((v) => mod12(v - root)).sort((a, b) => a - b);
    for (const [quality, pattern] of Object.entries(DEGREE_SEVENTHS)) {
      if (norm.length === pattern.length && norm.every((v, i) => v === pattern[i])) {
        return { quality: quality as DegreeQuality, root, name: `${rootName(root)}${quality}` };
      }
    }
    for (const [quality, pattern] of Object.entries(DEGREE_TRIADS)) {
      if (norm.length === pattern.length && norm.every((v, i) => v === pattern[i])) {
        return { quality: quality as DegreeQuality, root, name: `${rootName(root)}${quality}` };
      }
    }
  }

  return { quality: "set", root: null, name: pcs.map((pc) => rootName(pc)).join("-") };
}

/** Roman numeral for a scale degree with a given quality (PickPCS display rules). */
export function romanNumeral(degree: number, quality: DegreeQuality | null): string {
  const romans = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
  let base = romans[degree] || String(degree + 1);
  if (quality === "halfDim7") return base.toLowerCase() + "ø7";
  if (quality !== null && ["min", "min7", "minMaj7"].includes(quality)) base = base.toLowerCase();
  if (quality !== null && ["dim", "dim7"].includes(quality)) base += "°";
  if (quality === "maj7") base += "∆";
  else if (quality === "7") base += "7";
  else if (quality === "min7") base += "-7";
  else if (quality === "dim7") base += "7";
  else if (quality === "sus4") base += "sus";
  return base;
}

export type DegreeChordType = "triads" | "sus" | "sevenths";

export interface DegreeChord {
  degree: number;
  rootPc: number;
  pcs: number[];
  info: DegreeChordInfo;
  bitmask: number;
  numeral: string;
}

/**
 * Stack chords on every degree of a scale: thirds ("triads"), a sus-flavored
 * stack ("sus": steps 0,3,4), or sevenths (steps 0,2,4,6).
 */
export function degreeChords(scalePcs: number[], type: DegreeChordType = "triads"): DegreeChord[] {
  if (scalePcs.length === 0) return [];

  let offsets = [0, 2, 4];
  if (type === "sus") offsets = [0, 3, 4];
  if (type === "sevenths") offsets = [0, 2, 4, 6];

  return scalePcs.map((rootPc, i) => {
    const pcs = offsets
      .map((off) => scalePcs[(i + off) % scalePcs.length]!)
      .sort((a, b) => a - b);
    const info = classifyDegreeChord(pcs);
    return {
      degree: i,
      rootPc,
      pcs,
      info,
      bitmask: pcsToBitmask(pcs),
      numeral: romanNumeral(i, type === "sus" ? "sus4" : info.quality),
    };
  });
}
