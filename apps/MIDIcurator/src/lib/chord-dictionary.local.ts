/**
 * Chord Dictionary — ported from MIDIsplainer Chord-Dictionary branch.
 *
 * Each entry describes a chord quality with its pitch-class set (PCS) rooted at C,
 * a 12-bit binary fingerprint, a decimal form of that fingerprint, and display info.
 *
 * Detection strategy:
 *   1. Collect the unique pitch classes present in a note group.
 *   2. For each of the 12 possible roots (rotations), compute the binary fingerprint.
 *   3. Look up the fingerprint's decimal value in the dictionary.
 *   4. Return the best match (fewest notes = simplest quality; or exact match).
 */

export interface ChordQuality {
  /** Key in the original dictionary (e.g. "maj7", "min", "7b9") */
  key: string;
  /** Full descriptive name */
  fullName: string;
  /** Compact display symbol (e.g. "∆", "-7", "ø") */
  displayName: string;
  /** Pitch class set rooted at C (0-based semitones) */
  pcs: number[];
  /** 12-bit binary string, MSB = pitch class 0 */
  binary: string;
  /** Decimal value of the binary fingerprint */
  decimal: number;
  /** Interval names (e.g. ["R", "3", "5", "♭7"]) */
  intervals: string[];
  /** Alternative names */
  aliases: string[];
}

export interface ChordMatch {
  /** Root pitch class (0 = C, 1 = C#, ..., 11 = B) */
  root: number;
  /** Root note name (e.g. "C", "F#") */
  rootName: string;
  /** Matched chord quality */
  quality: ChordQuality;
  /** Full chord symbol (e.g. "Cmaj7", "F#-7", "D-(add4)") */
  symbol: string;
  /** All observed pitch classes (absolute, 0-11) — never discarded */
  observedPcs: number[];
  /** Template pitch classes from the matched quality (absolute, 0-11) */
  templatePcs: number[];
  /** Observed PCs not in the template (absolute, 0-11) */
  extras: number[];
  /** Template PCs not observed */
  missing: number[];
  /** Bass pitch class for slash chords (undefined = root position) */
  bassPc?: number;
  /** Bass note name for slash chords (e.g. "F" in "Dm/F") */
  bassName?: string;
}

// ─── Note name utilities ───────────────────────────────────────────────

const NOTE_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const NOTE_NAMES_SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const NOTE_NAMES_FLAT = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];

/** Get a display-friendly root name for a pitch class. */
export function rootName(pc: number): string {
  return NOTE_NAMES[pc % 12];
}

/** All sharp spellings */
export function rootNameSharp(pc: number): string {
  return NOTE_NAMES_SHARP[pc % 12];
}

/** All flat spellings */
export function rootNameFlat(pc: number): string {
  return NOTE_NAMES_FLAT[pc % 12];
}

// Sharp keys: G(1♯), D(2♯), A(3♯), E(4♯), B(5♯), F♯(6♯)
const SHARP_KEYS: ReadonlySet<number> = new Set([7, 2, 9, 4, 11, 6]);
// Flat keys: F(1♭), B♭(2♭), E♭(3♭), A♭(4♭), D♭(5♭)
const FLAT_KEYS: ReadonlySet<number> = new Set([5, 10, 3, 8, 1]);

/**
 * Spell a pitch class name correctly for a given key context.
 * When keyPc is provided, uses the key signature's spelling rules:
 *   - Sharp keys → sharp chromatic names (+ diatonic E♯, B♯ where needed)
 *   - Flat keys  → flat chromatic names  (+ diatonic C♭, F♭ where needed)
 *   - C          → mixed default
 * When keyPc is omitted, falls back to the existing mixed NOTE_NAMES spelling.
 */
export function spellRoot(pc: number, keyPc?: number): string {
  if (keyPc === undefined) return rootName(pc);
  const k = ((keyPc % 12) + 12) % 12;
  const p = ((pc % 12) + 12) % 12;

  // Diatonic overrides for extreme keys (beyond rootNameSharp/rootNameFlat)
  if (k === 6 && p === 0) return 'B♯';  // F♯ major: scale degree 4♯ enharmonic
  if (k === 6 && p === 5) return 'E♯';  // F♯ major: leading tone
  if (k === 11 && p === 5) return 'E♯'; // B major: leading tone
  if (k === 8 && p === 4) return 'F♭';  // A♭ major: subdominant
  if (k === 1 && p === 11) return 'C♭'; // D♭ major: leading tone

  if (SHARP_KEYS.has(k)) return rootNameSharp(p);
  if (FLAT_KEYS.has(k)) return rootNameFlat(p);
  return rootName(p); // C major — mixed default
}

/**
 * Spell a pitch class consistently with a chord root's accidental direction.
 * Unlike `spellRoot(pc, keyPc)` which classifies by key signature,
 * this derives the direction from the root name itself:
 *   - Root contains ♯ or # → sharp spelling (+ diatonic E♯/B♯ for extreme roots)
 *   - Root contains ♭ or b (not at start) → flat spelling (+ diatonic C♭/F♭)
 *   - Natural root → use `spellRoot(pc, rootPc)` for key-aware context
 *
 * This avoids the mixed-default contradiction where rootName(1) = "C♯"
 * but key-signature classification of PC 1 = D♭ major (flat key).
 */
export function spellInChordContext(pc: number, rootPc: number, rootNameStr?: string): string {
  const rn = rootNameStr ?? rootName(rootPc);
  const p = ((pc % 12) + 12) % 12;
  const r = ((rootPc % 12) + 12) % 12;

  if (rn.includes('♯') || rn.includes('#')) {
    // Apply diatonic overrides for sharp-rooted chords:
    // A third from B♯(0) is D♯♯ — too exotic, skip.
    // But a third from C♯(1) is E♯, a third from F♯(6) is A♯,
    // and the seventh of C♯ is B♯. Use the root PC for overrides.
    if (r === 1 && p === 5) return 'E♯';   // C♯: major 3rd = E♯
    if (r === 1 && p === 0) return 'B♯';   // C♯: major 7th = B♯
    if (r === 6 && p === 0) return 'B♯';   // F♯: perfect 4th / enharmonic
    if (r === 6 && p === 5) return 'E♯';   // F♯: major 7th = E♯
    return rootNameSharp(p);
  }
  if (rn.includes('♭') || (rn.length > 1 && rn.includes('b'))) {
    // Diatonic overrides for flat-rooted chords:
    if (r === 8 && p === 4) return 'F♭';   // A♭: major 6th context
    if (r === 1 && p === 11) return 'C♭';  // D♭: major 7th = C (but as root D♭, 7th is C)
    if (r === 6 && p === 4) return 'F♭';   // G♭: major 7th = F♭
    if (r === 6 && p === 11) return 'C♭';  // G♭: perfect 4th = C♭
    return rootNameFlat(p);
  }
  // Natural root — delegate to key-aware spelling
  return spellRoot(p, rootPc);
}

/**
 * Build a map from absolute pitch class → correctly spelled note name for all
 * chord tones in a given chord, using the quality's own interval labels to
 * determine flat/sharp direction rather than the root's key signature.
 *
 * This correctly spells e.g. A♭ (not G♯) as the ♭5 of Dm7♭5, even though
 * D is a "sharp key" in key-signature terms.
 *
 * Notes not in the template (NCTs) are not included; callers should fall back
 * to `spellInChordContext` for those.
 */
export function buildChordToneSpellingMap(
  rootPc: number,
  quality: ChordQuality,
): Map<number, string> {
  const map = new Map<number, string>();
  const r = ((rootPc % 12) + 12) % 12;
  for (let i = 0; i < quality.pcs.length; i++) {
    const relPc = quality.pcs[i]!;
    const absPc = (r + relPc) % 12;
    const interval = quality.intervals[i] ?? '';
    let name: string;
    if (interval.includes('♭') || interval.includes('b')) {
      // Flat interval → always spell flat
      name = rootNameFlat(absPc);
    } else if (interval.includes('♯') || interval.includes('#')) {
      // Sharp interval → always spell sharp
      name = rootNameSharp(absPc);
    } else {
      // Unaltered interval — use root-context spelling
      name = spellInChordContext(absPc, r);
    }
    map.set(absPc, name);
  }
  return map;
}

// ─── Fingerprint utilities ─────────────────────────────────────────────

/**
 * Convert a set of pitch classes (0-11) into a 12-bit binary string.
 * Bit 11 (MSB) = pitch class 0, bit 0 (LSB) = pitch class 11.
 * This matches the MIDIsplainer convention.
 */
export function pcsToBinary(pcs: number[]): string {
  const bits = Array(12).fill('0');
  for (const pc of pcs) {
    bits[pc % 12] = '1';
  }
  return bits.join('');
}

/**
 * Convert a 12-bit binary string to its decimal value.
 */
export function binaryToDecimal(binary: string): number {
  return parseInt(binary, 2);
}

/**
 * Compute the decimal fingerprint for a set of pitch classes.
 */
export function pcsToDecimal(pcs: number[]): number {
  return binaryToDecimal(pcsToBinary(pcs));
}

/**
 * Rotate a set of pitch classes so that `root` becomes 0.
 * Returns sorted unique pitch classes relative to the new root.
 */
export function rotatePcs(pcs: number[], root: number): number[] {
  const rotated = pcs.map(pc => ((pc - root) % 12 + 12) % 12);
  return [...new Set(rotated)].sort((a, b) => a - b);
}

// ─── Dictionary data ───────────────────────────────────────────────────

/**
 * All 104 chord qualities from MIDIsplainer chord_dictionary.json.
 * Each entry's `pcs` is rooted at C (root = 0).
 */
const CHORD_QUALITIES: ChordQuality[] = [
  { key: "4", fullName: "quartal", displayName: "q", pcs: [0,5,10,3], binary: "100101000010", decimal: 2370, intervals: ["R","4","♭7","♭3"], aliases: ["4","quartal"] },
  { key: "5", fullName: "fifth", displayName: "5", pcs: [0,7], binary: "100000010000", decimal: 2064, intervals: ["R","5"], aliases: ["5"] },
  { key: "6", fullName: "major sixth", displayName: "6", pcs: [0,4,7,9], binary: "100010010100", decimal: 2196, intervals: ["R","3","5","6"], aliases: ["6","add6","add13","M6"] },
  { key: "7", fullName: "dominant seventh", displayName: "7", pcs: [0,4,7,10], binary: "100010010010", decimal: 2194, intervals: ["R","3","5","♭7"], aliases: ["7","dom"] },
  { key: "9", fullName: "dominant ninth", displayName: "9", pcs: [0,4,7,10,2], binary: "101010010010", decimal: 2706, intervals: ["R","3","5","♭7","9"], aliases: ["9"] },
  { key: "11", fullName: "dominant eleventh", displayName: "11", pcs: [0,4,7,10,2,5], binary: "101011010010", decimal: 2770, intervals: ["R","3","5","♭7","9","11"], aliases: ["11","dom11"] },
  { key: "13", fullName: "dominant thirteenth", displayName: "13", pcs: [0,4,7,10,2,5,9], binary: "101011010110", decimal: 2774, intervals: ["R","3","5","♭7","9","11","13"], aliases: ["13"] },
  { key: "maj", fullName: "major triad", displayName: "", pcs: [0,4,7], binary: "100010010000", decimal: 2192, intervals: ["R","3","5"], aliases: ["maj","M","major"] },
  { key: "min", fullName: "minor triad", displayName: "-", pcs: [0,3,7], binary: "100100010000", decimal: 2320, intervals: ["R","♭3","5"], aliases: ["min","m","minor","-"] },
  { key: "dim", fullName: "diminished triad", displayName: "°", pcs: [0,3,6], binary: "100100100000", decimal: 2336, intervals: ["R","♭3","♭5"], aliases: ["dim","°"] },
  { key: "aug", fullName: "augmented triad", displayName: "+", pcs: [0,4,8], binary: "100010001000", decimal: 2184, intervals: ["R","3","♯5"], aliases: ["aug","+"] },
  { key: "maj7", fullName: "major seventh", displayName: "∆", pcs: [0,4,7,11], binary: "100010010001", decimal: 2193, intervals: ["R","3","5","7"], aliases: ["maj7","M7","∆","∆7"] },
  { key: "min7", fullName: "minor seventh", displayName: "-7", pcs: [0,3,7,10], binary: "100100010010", decimal: 2322, intervals: ["R","♭3","5","♭7"], aliases: ["min7","m7","-7"] },
  { key: "dim7", fullName: "diminished seventh", displayName: "°7", pcs: [0,3,6,9], binary: "100100100100", decimal: 2340, intervals: ["R","♭3","♭5","𝄫7"], aliases: ["dim7","°7"] },
  { key: "m7b5", fullName: "half-diminished seventh", displayName: "ø", pcs: [0,3,6,10], binary: "100100100010", decimal: 2338, intervals: ["R","♭3","♭5","♭7"], aliases: ["m7b5","ø","ø7"] },
  { key: "minMaj7", fullName: "minor-major seventh", displayName: "m∆", pcs: [0,3,7,11], binary: "100100010001", decimal: 2321, intervals: ["R","♭3","5","7"], aliases: ["minMaj7","mM7","m∆"] },
  { key: "augMaj7", fullName: "augmented major seventh", displayName: "+∆", pcs: [0,4,8,11], binary: "100010001001", decimal: 2185, intervals: ["R","3","♯5","7"], aliases: ["augMaj7","+M7","+∆"] },
  { key: "m6", fullName: "minor sixth", displayName: "-6", pcs: [0,3,7,9], binary: "100100010100", decimal: 2324, intervals: ["R","♭3","5","6"], aliases: ["m6","-6"] },
  { key: "maj9", fullName: "major ninth", displayName: "∆9", pcs: [0,4,7,11,2], binary: "101010010001", decimal: 2705, intervals: ["R","3","5","7","9"], aliases: ["maj9","M9","∆9"] },
  { key: "min9", fullName: "minor ninth", displayName: "-9", pcs: [0,3,7,10,2], binary: "101100010010", decimal: 2834, intervals: ["R","♭3","5","♭7","9"], aliases: ["min9","m9","-9"] },
  { key: "m9add13", fullName: "minor ninth added thirteenth", displayName: "-9add13", pcs: [0,3,7,10,2,9], binary: "101100010110", decimal: 2838, intervals: ["R","♭3","5","♭7","9","13"], aliases: ["m9add13","m13no11","-9add13"] },
  { key: "maj11", fullName: "major eleventh", displayName: "∆11", pcs: [0,4,7,11,2,5], binary: "101011010001", decimal: 2769, intervals: ["R","3","5","7","9","11"], aliases: ["maj11","M11","∆11"] },
  { key: "min11", fullName: "minor eleventh", displayName: "-11", pcs: [0,3,7,10,2,5], binary: "101101010010", decimal: 2898, intervals: ["R","♭3","5","♭7","9","11"], aliases: ["min11","m11","-11"] },
  { key: "maj13", fullName: "major thirteenth", displayName: "∆13", pcs: [0,4,7,11,2,5,9], binary: "101011010101", decimal: 2773, intervals: ["R","3","5","7","9","11","13"], aliases: ["maj13","M13","∆13"] },
  { key: "min13", fullName: "minor thirteenth", displayName: "-13", pcs: [0,3,7,10,2,5,9], binary: "101101010110", decimal: 2902, intervals: ["R","♭3","5","♭7","9","11","13"], aliases: ["min13","m13","-13"] },
  { key: "sus2", fullName: "suspended second", displayName: "sus2", pcs: [0,2,7], binary: "101000010000", decimal: 2576, intervals: ["R","2","5"], aliases: ["sus2"] },
  { key: "7sus2", fullName: "dominant seventh suspended second", displayName: "7sus2", pcs: [0,2,7,10], binary: "101000010010", decimal: 2578, intervals: ["R","2","5","♭7"], aliases: ["7sus2"] },
  { key: "M7sus2", fullName: "major seventh suspended second", displayName: "M7sus2", pcs: [0,2,7,11], binary: "101000010001", decimal: 2577, intervals: ["R","2","5","7"], aliases: ["M7sus2"] },
  { key: "13sus2", fullName: "dominant thirteenth suspended second", displayName: "13sus2", pcs: [0,2,7,10,9], binary: "101000010110", decimal: 2582, intervals: ["R","2","5","♭7","13"], aliases: ["13sus2"] },
  { key: "M13sus2", fullName: "major thirteenth suspended second", displayName: "M13sus2", pcs: [0,2,7,11,9], binary: "101000010101", decimal: 2581, intervals: ["R","2","5","7","13"], aliases: ["M13sus2"] },
  { key: "7#11sus2", fullName: "lydian dominant suspended second", displayName: "7#11sus2", pcs: [0,2,7,10,6], binary: "101000110010", decimal: 2610, intervals: ["R","2","5","♭7","♯11"], aliases: ["7#11sus2"] },
  { key: "M7#11sus2", fullName: "lydian major seventh suspended second", displayName: "M7#11sus2", pcs: [0,2,7,11,6], binary: "101000110001", decimal: 2609, intervals: ["R","2","5","7","♯11"], aliases: ["M7#11sus2"] },
  { key: "13#11sus2", fullName: "lydian dominant thirteenth suspended second", displayName: "13#11sus2", pcs: [0,2,6,7,9,10], binary: "101000110110", decimal: 2614, intervals: ["R","2","♯11","5","13","♭7"], aliases: ["13#11sus2"] },
  { key: "M13#11sus2", fullName: "lydian major thirteenth suspended second", displayName: "M13#11sus2", pcs: [0,2,6,7,9,11], binary: "101000110101", decimal: 2613, intervals: ["R","2","♯11","5","13","7"], aliases: ["M13#11sus2"] },
  { key: "sus4", fullName: "suspended fourth", displayName: "sus4", pcs: [0,5,7], binary: "100001010000", decimal: 2128, intervals: ["R","4","5"], aliases: ["sus4"] },
  { key: "7sus4", fullName: "dominant seventh suspended fourth", displayName: "7sus4", pcs: [0,5,7,10], binary: "100001010010", decimal: 2130, intervals: ["R","4","5","♭7"], aliases: ["7sus4"] },
  { key: "9sus4", fullName: "dominant ninth suspended fourth", displayName: "9sus4", pcs: [0,5,7,10,2], binary: "101001010010", decimal: 2642, intervals: ["R","4","5","♭7","9"], aliases: ["9sus4"] },
  { key: "7b5", fullName: "dominant seventh diminished", displayName: "7b5", pcs: [0,4,6,10], binary: "100010100010", decimal: 2210, intervals: ["R","3","♭5","♭7"], aliases: ["7b5"] },
  { key: "aug7", fullName: "augmented dominant seventh", displayName: "+7", pcs: [0,4,8,10], binary: "100010001010", decimal: 2186, intervals: ["R","3","♯5","♭7"], aliases: ["aug7","+7","7#5"] },
  { key: "7b9", fullName: "dominant seventh flat ninth", displayName: "7b9", pcs: [0,4,7,10,1], binary: "110010010010", decimal: 3218, intervals: ["R","3","5","♭7","♭9"], aliases: ["7b9"] },
  { key: "7#9", fullName: "dominant seventh sharp ninth", displayName: "7#9", pcs: [0,4,7,10,3], binary: "100110010010", decimal: 2450, intervals: ["R","3","5","♭7","♯9"], aliases: ["7#9"] },
  { key: "7#11", fullName: "lydian dominant seventh", displayName: "7#11", pcs: [0,4,7,10,6], binary: "100010110010", decimal: 2226, intervals: ["R","3","5","♭7","♯11"], aliases: ["7#11"] },
  { key: "7b13", fullName: "dominant seventh flat thirteen", displayName: "7b13", pcs: [0,4,7,10,8], binary: "100010011010", decimal: 2202, intervals: ["R","3","5","♭7","♭13"], aliases: ["7b13"] },
  { key: "9b13", fullName: "dominant ninth flat thirteenth", displayName: "9b13", pcs: [0,4,7,10,2,8], binary: "101010011010", decimal: 2714, intervals: ["R","3","5","♭7","9","♭13"], aliases: ["9b13","dom9b13"] },
  { key: "6add9", fullName: "sixth added ninth", displayName: "69", pcs: [0,4,7,9,2], binary: "101010010100", decimal: 2708, intervals: ["R","3","5","6","9"], aliases: ["6add9","69"] },
  { key: "M6#11", fullName: "sixth sharp eleventh", displayName: "M6#11", pcs: [0,4,7,9,6], binary: "100010110100", decimal: 2228, intervals: ["R","3","5","6","♯11"], aliases: ["M6#11"] },
  { key: "69#11", fullName: "major sixth ninth sharp eleventh", displayName: "69#11", pcs: [0,4,7,9,2,6], binary: "101010110100", decimal: 2740, intervals: ["R","3","5","6","9","♯11"], aliases: ["69#11"] },
  { key: "maj7add13", fullName: "major seventh added thirteenth", displayName: "∆add13", pcs: [0,4,7,11,9], binary: "100010010101", decimal: 2197, intervals: ["R","3","5","7","13"], aliases: ["maj7add13","M7add13","∆add13","∆13no9"] },
  { key: "maj7b13", fullName: "major seventh flat thirteenth", displayName: "∆b13", pcs: [0,4,7,8,11], binary: "100010011001", decimal: 2201, intervals: ["R","3","5","♭13","7"], aliases: ["maj7b13","M7b13","∆b13"] },
  { key: "maj#4", fullName: "major seventh sharp eleventh", displayName: "∆#4", pcs: [0,4,7,11,6], binary: "100010110001", decimal: 2225, intervals: ["R","3","5","7","♯11"], aliases: ["maj#4","∆#11"] },
  { key: "maj7#11add13", fullName: "major seventh sharp eleventh added thirteenth", displayName: "∆#11add13", pcs: [0,4,6,7,9,11], binary: "100010110101", decimal: 2229, intervals: ["R","3","♯11","5","13","7"], aliases: ["maj7#11add13","∆#11add13","M7#11add13"] },
  { key: "maj9add13", fullName: "major ninth added thirteenth", displayName: "∆9add13", pcs: [0,2,4,7,9,11], binary: "101010010101", decimal: 2709, intervals: ["R","9","3","5","13","7"], aliases: ["maj9add13","maj13","∆13","M13"] },
  { key: "9add13", fullName: "dominant ninth added thirteenth", displayName: "9add13", pcs: [0,2,4,7,9,10], binary: "101010010110", decimal: 2710, intervals: ["R","9","3","5","13","♭7"], aliases: ["9add13","13no11","dom13no11"] },
  { key: "maj9#11", fullName: "major sharp eleventh (lydian)", displayName: "∆9#11", pcs: [0,4,7,11,2,6], binary: "101010110001", decimal: 2737, intervals: ["R","3","5","7","9","♯11"], aliases: ["maj9#11","∆9#11"] },
  { key: "maj7#9#11", fullName: "major sharp ninth sharp eleventh", displayName: "∆#9#11", pcs: [0,4,7,11,3,6], binary: "100110110001", decimal: 2481, intervals: ["R","3","5","7","♯9","♯11"], aliases: ["maj7#9#11"] },
  { key: "M13#11", fullName: "major thirteenth sharp eleventh", displayName: "∆13#11", pcs: [0,4,7,11,2,6,9], binary: "101010110101", decimal: 2741, intervals: ["R","3","5","7","9","♯11","13"], aliases: ["M13#11"] },
  { key: "M7b9", fullName: "major seventh flat ninth", displayName: "∆b9", pcs: [0,4,7,11,1], binary: "110010010001", decimal: 3217, intervals: ["R","3","5","7","♭9"], aliases: ["M7b9"] },
  { key: "Madd9", fullName: "major added ninth", displayName: "add9", pcs: [0,4,7,2], binary: "101010010000", decimal: 2704, intervals: ["R","3","5","9"], aliases: ["Madd9","add9"] },
  { key: "add11", fullName: "major added eleventh", displayName: "add11", pcs: [0,4,5,7], binary: "100011010000", decimal: 2256, intervals: ["R","3","4","5"], aliases: ["add11","Madd11","add4"] },
  { key: "6add11", fullName: "sixth added eleventh", displayName: "6add11", pcs: [0,4,5,7,9], binary: "100011010100", decimal: 2260, intervals: ["R","3","4","5","6"], aliases: ["6add11","6(11)","6_11"] },
  { key: "6_9_11", fullName: "sixth ninth eleventh", displayName: "6/9add11", pcs: [0,2,4,5,7,9], binary: "101011010100", decimal: 2772, intervals: ["R","9","3","4","5","6"], aliases: ["6_9_11","69add11","6(9,11)"] },
  { key: "6sus2", fullName: "sixth suspended second", displayName: "6sus2", pcs: [0,2,7,9], binary: "101000010100", decimal: 2580, intervals: ["R","2","5","6"], aliases: ["6sus2"] },
  { key: "6b5", fullName: "sixth flat fifth", displayName: "6b5", pcs: [0,4,6,9], binary: "100010100100", decimal: 2212, intervals: ["R","3","♭5","6"], aliases: ["6b5","M6b5"] },
  { key: "Maddb9", fullName: "major added flat ninth", displayName: "addb9", pcs: [0,4,7,1], binary: "110010010000", decimal: 3216, intervals: ["R","3","5","♭9"], aliases: ["Maddb9"] },
  { key: "Mb5", fullName: "major diminished", displayName: "b5", pcs: [0,4,6], binary: "100010100000", decimal: 2208, intervals: ["R","3","♭5"], aliases: ["Mb5"] },
  { key: "M7b5", fullName: "major seventh diminished", displayName: "∆b5", pcs: [0,4,6,11], binary: "100010100001", decimal: 2209, intervals: ["R","3","♭5","7"], aliases: ["M7b5"] },
  { key: "M9b5", fullName: "major ninth diminished", displayName: "∆9b5", pcs: [0,4,6,11,2], binary: "101010100001", decimal: 2721, intervals: ["R","3","♭5","7","9"], aliases: ["M9b5"] },
  { key: "mb6", fullName: "minor flat sixth", displayName: "-b6", pcs: [0,3,7,8], binary: "100100011000", decimal: 2328, intervals: ["R","♭3","5","♭6"], aliases: ["mb6"] },
  { key: "m69", fullName: "minor sixth ninth", displayName: "-69", pcs: [0,3,7,9,2], binary: "101100010100", decimal: 2836, intervals: ["R","♭3","5","6","9"], aliases: ["m69"] },
  { key: "m7b9", fullName: "minor seventh flat 9th", displayName: "-7b9", pcs: [0,3,7,10,1], binary: "110100010010", decimal: 3346, intervals: ["R","♭3","5","♭7","♭9"], aliases: ["m7b9"] },
  { key: "mM9", fullName: "minor/major ninth", displayName: "mM9", pcs: [0,3,7,11,2], binary: "101100010001", decimal: 2833, intervals: ["R","♭3","5","7","9"], aliases: ["mM9"] },
  { key: "m7add11", fullName: "minor seventh added eleventh", displayName: "-7add11", pcs: [0,3,7,10,5], binary: "100101010010", decimal: 2386, intervals: ["R","♭3","5","♭7","11"], aliases: ["m7add11"] },
  { key: "madd4", fullName: "minor added fourth", displayName: "-add4", pcs: [0,3,7,5], binary: "100101010000", decimal: 2384, intervals: ["R","♭3","5","4"], aliases: ["madd4"] },
  { key: "m9add11", fullName: "minor ninth added eleventh (no seventh)", displayName: "-9add11", pcs: [0,2,3,5,7], binary: "101101010000", decimal: 2896, intervals: ["R","♭3","5","9","11"], aliases: ["m9add11","madd9add11"] },
  { key: "mMaj7b6", fullName: "minor/Major seventh flat sixth", displayName: "m∆b6", pcs: [0,3,7,11,8], binary: "100100011001", decimal: 2329, intervals: ["R","♭3","5","7","♭6"], aliases: ["mMaj7b6"] },
  { key: "mMaj9b6", fullName: "minor/Major ninth flat sixth", displayName: "m∆9b6", pcs: [0,3,7,11,2,8], binary: "101100011001", decimal: 2841, intervals: ["R","♭3","5","7","9","♭6"], aliases: ["mMaj9b6"] },
  { key: "madd9", fullName: "minor added ninth", displayName: "-add9", pcs: [0,3,7,2], binary: "101100010000", decimal: 2832, intervals: ["R","♭3","5","9"], aliases: ["madd9"] },
  { key: "m7#5", fullName: "minor seventh sharp fifth", displayName: "-7+", pcs: [0,3,8,10], binary: "100100001010", decimal: 2314, intervals: ["R","♭3","♯5","♭7"], aliases: ["m7#5"] },
  { key: "m9#5", fullName: "minor ninth sharp fifth", displayName: "-9+", pcs: [0,3,8,10,2], binary: "101100001010", decimal: 2826, intervals: ["R","♭3","♯5","♭7","9"], aliases: ["m9#5"] },
  { key: "m11A", fullName: "augmented minor eleventh", displayName: "-11+", pcs: [0,3,8,10,2,5], binary: "101101001010", decimal: 2890, intervals: ["R","♭3","♯5","♭7","9","11"], aliases: ["m11A"] },
  { key: "mb6b9", fullName: "minor flat sixth flat ninth", displayName: "-b6b9", pcs: [0,3,7,8,1], binary: "110100011000", decimal: 3352, intervals: ["R","♭3","5","♭6","♭9"], aliases: ["mb6b9"] },
  { key: "m9b5", fullName: "minor ninth flat fifth", displayName: "ø9", pcs: [0,3,6,10,2], binary: "101100100010", decimal: 2850, intervals: ["R","♭3","♭5","♭7","9"], aliases: ["m9b5","ø9"] },
  { key: "o7M7", fullName: "diminished seventh Major seventh", displayName: "°7M7", pcs: [0,3,6,9,11], binary: "100100100101", decimal: 2341, intervals: ["R","♭3","♭5","𝄫7","7"], aliases: ["o7M7"] },
  { key: "oM7", fullName: "diminished/Major seventh", displayName: "°M7", pcs: [0,3,6,11], binary: "100100100001", decimal: 2337, intervals: ["R","♭3","♭5","7"], aliases: ["oM7"] },
  { key: "alt7", fullName: "altered", displayName: "alt7", pcs: [0,4,10,1], binary: "110010000010", decimal: 3202, intervals: ["R","3","♭7","♭9"], aliases: ["alt7"] },
  { key: "7#11b13", fullName: "dominant flat sixth flat fifth", displayName: "7#11b13", pcs: [0,4,7,10,6,8], binary: "100010111010", decimal: 2234, intervals: ["R","3","5","♭7","♯11","♭13"], aliases: ["7#11b13"] },
  { key: "7add6", fullName: "dominant added thirteenth", displayName: "7add6", pcs: [0,4,7,9,10], binary: "100010010110", decimal: 2198, intervals: ["R","3","5","6","♭7"], aliases: ["7add6"] },
  { key: "7#9#11", fullName: "dominant sharp ninth sharp eleventh", displayName: "7#9#11", pcs: [0,4,7,10,3,6], binary: "100110110010", decimal: 2482, intervals: ["R","3","5","♭7","♯9","♯11"], aliases: ["7#9#11"] },
  { key: "13#9#11", fullName: "dominant thirteenth sharp ninth sharp eleventh", displayName: "13#9#11", pcs: [0,4,7,10,3,6,9], binary: "100110110110", decimal: 2486, intervals: ["R","3","5","♭7","♯9","♯11","13"], aliases: ["13#9#11"] },
  { key: "7#9#11b13", fullName: "dominanth flat thirteenth sharp ninth sharp eleventh", displayName: "7#9#11b13", pcs: [0,4,7,10,3,6,8], binary: "100110111010", decimal: 2490, intervals: ["R","3","5","♭7","♯9","♯11","♭13"], aliases: ["7#9#11b13"] },
  { key: "13#9", fullName: "dominant thirteenth sharp ninth", displayName: "13#9", pcs: [0,4,7,10,3,5,9], binary: "100111010110", decimal: 2518, intervals: ["R","3","5","♭7","♯9","11","13"], aliases: ["13#9"] },
  { key: "7#9b13", fullName: "dominant sharp ninth flat thirteenth", displayName: "7#9b13", pcs: [0,4,7,10,3,8], binary: "100110011010", decimal: 2458, intervals: ["R","3","5","♭7","♯9","♭13"], aliases: ["7#9b13"] },
  { key: "9#11", fullName: "dominant ninth sharp eleventh", displayName: "9#11", pcs: [0,4,7,10,2,6], binary: "101010110010", decimal: 2738, intervals: ["R","3","5","♭7","9","♯11"], aliases: ["9#11"] },
  { key: "13#11", fullName: "dominant thirteenth sharp eleventh", displayName: "13#11", pcs: [0,4,7,10,2,6,9], binary: "101010110110", decimal: 2742, intervals: ["R","3","5","♭7","9","♯11","13"], aliases: ["13#11"] },
  { key: "9#11b13", fullName: "dominant ninth sharp eleventh flat thirteenth", displayName: "9#11b13", pcs: [0,4,7,10,2,6,8], binary: "101010111010", decimal: 2746, intervals: ["R","3","5","♭7","9","♯11","♭13"], aliases: ["9#11b13"] },
  { key: "7b9#11", fullName: "dominant flat ninth sharp eleventh", displayName: "7b9#11", pcs: [0,4,7,10,1,6], binary: "110010110010", decimal: 3250, intervals: ["R","3","5","♭7","♭9","♯11"], aliases: ["7b9#11"] },
  { key: "13b9#11", fullName: "dominant thirteenth flat ninth sharp eleventh", displayName: "13b9#11", pcs: [0,4,7,10,1,6,9], binary: "110010110110", decimal: 3254, intervals: ["R","3","5","♭7","♭9","♯11","13"], aliases: ["13b9#11"] },
  { key: "7b9b13#11", fullName: "dominant flat thirteenth flat ninth sharp eleventh", displayName: "7b9b13#11", pcs: [0,4,7,10,1,6,8], binary: "110010111010", decimal: 3258, intervals: ["R","3","5","♭7","♭9","♯11","♭13"], aliases: ["7b9b13#11"] },
  { key: "13b9", fullName: "dominant thirteenth flat ninth", displayName: "13b9", pcs: [0,4,7,10,1,5,9], binary: "110011010110", decimal: 3286, intervals: ["R","3","5","♭7","♭9","11","13"], aliases: ["13b9"] },
  { key: "7b9b13", fullName: "dominant flat thirteenth flat ninth", displayName: "7b9b13", pcs: [0,4,7,10,1,8], binary: "110010011010", decimal: 3226, intervals: ["R","3","5","♭7","♭9","♭13"], aliases: ["7b9b13"] },
  { key: "7b9#9", fullName: "dominant flat ninth sharp ninth", displayName: "7b9#9", pcs: [0,3,4,7,10,1], binary: "110110010010", decimal: 3474, intervals: ["R","♭3","3","5","♭7","♭9"], aliases: ["7b9#9"] },
  { key: "7#5#9", fullName: "altered dominant", displayName: "7#5#9", pcs: [0,4,8,10,3], binary: "100110001010", decimal: 2442, intervals: ["R","3","♯5","♭7","♯9"], aliases: ["7#5#9"] },
  { key: "9#5", fullName: "dominant ninth augmented", displayName: "9#5", pcs: [0,4,8,10,2], binary: "101010001010", decimal: 2698, intervals: ["R","3","♯5","♭7","9"], aliases: ["9#5"] },
  { key: "9#5#11", fullName: "dominant ninth augmented sharp eleventh", displayName: "9#5#11", pcs: [0,4,8,10,2,6], binary: "101010101010", decimal: 2730, intervals: ["R","3","♯5","♭7","9","♯11"], aliases: ["9#5#11"] },
  { key: "7#5b9", fullName: "dominant augmented flat ninth", displayName: "7#5b9", pcs: [0,4,8,10,1], binary: "110010001010", decimal: 3210, intervals: ["R","3","♯5","♭7","♭9"], aliases: ["7#5b9"] },
  { key: "7#5b9#11", fullName: "dominant augmented flat ninth sharp eleventh", displayName: "7#5b9#11", pcs: [0,4,8,10,1,6], binary: "110010101010", decimal: 3242, intervals: ["R","3","♯5","♭7","♭9","♯11"], aliases: ["7#5b9#11"] },
  { key: "13b5", fullName: "dominant thirteenth diminished", displayName: "13b5", pcs: [0,4,6,10,2,5,9], binary: "101011100110", decimal: 2790, intervals: ["R","3","♭5","♭7","9","11","13"], aliases: ["13b5"] },
  { key: "9b5", fullName: "dominant ninth diminished", displayName: "9b5", pcs: [0,4,6,10,2], binary: "101010100010", decimal: 2722, intervals: ["R","3","♭5","♭7","9"], aliases: ["9b5"] },
  { key: "7no5", fullName: "dominant seventh no fifth", displayName: "7no5", pcs: [0,4,10], binary: "100010000010", decimal: 2178, intervals: ["R","3","♭7"], aliases: ["7no5"] },
  { key: "9no5", fullName: "dominant ninth no fifth", displayName: "9no5", pcs: [0,4,10,2], binary: "101010000010", decimal: 2690, intervals: ["R","3","♭7","9"], aliases: ["9no5"] },
  { key: "13no5", fullName: "dominant thirteenth no fifth", displayName: "13no5", pcs: [0,4,10,2,5,9], binary: "101011000110", decimal: 2758, intervals: ["R","3","♭7","9","11","13"], aliases: ["13no5"] },
  { key: "sus24", fullName: "suspended second fourth", displayName: "sus24", pcs: [0,2,5,7], binary: "101001010000", decimal: 2640, intervals: ["R","2","4","5"], aliases: ["sus24"] },
  { key: "b9sus", fullName: "suspended fourth flat ninth", displayName: "b9sus", pcs: [0,5,7,10,1], binary: "110001010010", decimal: 3154, intervals: ["R","4","5","♭7","♭9"], aliases: ["b9sus"] },
  { key: "13sus4", fullName: "dominant thirteenth suspended fourth", displayName: "13sus4", pcs: [0,5,7,10,2,9], binary: "101001010110", decimal: 2646, intervals: ["R","4","5","♭7","9","13"], aliases: ["13sus4"] },
  { key: "7sus4b9b13", fullName: "dominant seventh suspended fourth flat ninth flat thirteenth", displayName: "7sus4b9b13", pcs: [0,5,7,10,1,8], binary: "110001011010", decimal: 3162, intervals: ["R","4","5","♭7","♭9","♭13"], aliases: ["7sus4b9b13"] },
  { key: "M7sus4", fullName: "major seventh suspended fourth", displayName: "M7sus4", pcs: [0,5,7,11], binary: "100001010001", decimal: 2129, intervals: ["R","4","5","7"], aliases: ["M7sus4"] },
  { key: "M9sus4", fullName: "major ninth suspended fourth", displayName: "M9sus4", pcs: [0,5,7,11,2], binary: "101001010001", decimal: 2641, intervals: ["R","4","5","7","9"], aliases: ["M9sus4"] },
  { key: "M7#5sus4", fullName: "major seventh augmented suspended fourth", displayName: "M7#5sus4", pcs: [0,5,11,8], binary: "100001001001", decimal: 2121, intervals: ["R","4","♯5","7"], aliases: ["M7#5sus4"] },
  { key: "M9#5sus4", fullName: "major ninth augmented suspended fourth", displayName: "M9#5sus4", pcs: [0,5,8,11,2], binary: "101001001001", decimal: 2633, intervals: ["R","4","♯5","7","9"], aliases: ["M9#5sus4"] },
  { key: "7b13sus", fullName: "dominant flat 13th sus", displayName: "7b13sus", pcs: [0,5,7,8], binary: "100001011000", decimal: 2136, intervals: ["R","4","5","♭6"], aliases: ["7b13sus"] },
  { key: "7#5sus4", fullName: "dominant seventh sharp fifth suspended fourth", displayName: "7#5sus4", pcs: [0,5,8,10], binary: "100001001010", decimal: 2122, intervals: ["R","4","♯5","♭7"], aliases: ["7#5sus4"] },
  { key: "m#5", fullName: "minor augmented", displayName: "m#5", pcs: [0,3,8], binary: "100100001000", decimal: 2312, intervals: ["R","♭3","♯5"], aliases: ["m#5"] },
  { key: "maj9#5", fullName: "augmented ninth", displayName: "maj9#5", pcs: [0,4,8,11,2], binary: "101010001001", decimal: 2697, intervals: ["R","3","♯5","7","9"], aliases: ["maj9#5"] },
  { key: "M#5add9", fullName: "augmented added ninth", displayName: "M#5add9", pcs: [0,4,8,2], binary: "101010001000", decimal: 2696, intervals: ["R","3","♯5","9"], aliases: ["M#5add9"] },
  { key: "+add#9", fullName: "augmented added sharp ninth", displayName: "+add#9", pcs: [0,4,8,3], binary: "100110001000", decimal: 2440, intervals: ["R","3","♯5","♯9"], aliases: ["+add#9"] },
  // ── Qualities identified from Apple Loop Sequ analysis ────────────────────
  { key: "mb9",       fullName: "minor added flat ninth",               displayName: "m(♭9)",   pcs: [0,3,7,1],       binary: "110100010000", decimal: 3344, intervals: ["R","♭3","5","♭9"],              aliases: ["mb9","madd♭9","m(♭9)"] },
  { key: "7Maj7add9", fullName: "dominant with major seventh add nine", displayName: "7(∆7,9)", pcs: [0,4,7,10,11,2], binary: "101010010011", decimal: 2707, intervals: ["R","3","5","♭7","∆7","9"],       aliases: ["7Maj7add9","7(maj7,9)","7(∆7,9)"] },
  { key: "7b9add11",  fullName: "dominant flat ninth added eleventh",   displayName: "7(♭9,11)", pcs: [0,4,7,10,1,5], binary: "110011010010", decimal: 3282, intervals: ["R","3","5","♭7","♭9","11"],    aliases: ["7b9add11","7(♭9,11)"] },
  { key: "6sus4",     fullName: "sixth suspended fourth",              displayName: "6sus4",    pcs: [0,5,7,9],       binary: "100001010100", decimal: 2132, intervals: ["R","4","5","6"],                aliases: ["6sus4"] },
  { key: "dimadd9",   fullName: "diminished added ninth",              displayName: "°add9",    pcs: [0,3,6,2],       binary: "101100100000", decimal: 2848, intervals: ["R","♭3","♭5","9"],             aliases: ["dimadd9","dim(9)","°add9"] },
  { key: "dim7add9",  fullName: "diminished seventh added ninth",      displayName: "°7(9)",    pcs: [0,3,6,9,2],     binary: "101100100100", decimal: 2852, intervals: ["R","♭3","♭5","𝄫7","9"],       aliases: ["dim7add9","dim7(9)","°7(9)"] },
  { key: "m7add13",   fullName: "minor seventh added thirteenth",      displayName: "-7(13)",   pcs: [0,3,7,10,9],    binary: "100100010110", decimal: 2326, intervals: ["R","♭3","5","♭7","13"],         aliases: ["m7add13","m7(13)","-7(13)"] },
  // ── Qualities identified from Apple Loop Sequ analysis (batch 2) ─────────
  { key: "add#11",       fullName: "major added sharp eleventh",                              displayName: "(♯11)",       pcs: [0,4,6,7],       binary: "100010110000", decimal: 2224, intervals: ["R","3","♯11","5"],               aliases: ["add#11","(♯11)"] },
  { key: "7no3",         fullName: "dominant seventh no third",                               displayName: "5(♭7)",       pcs: [0,7,10],        binary: "100000010010", decimal: 2066, intervals: ["R","5","♭7"],                     aliases: ["7no3","5(7)","5(♭7)"] },
  { key: "mAdd9b13",     fullName: "minor added ninth flat thirteenth",                       displayName: "m(9,♭13)",    pcs: [0,2,3,7,8],     binary: "101100011000", decimal: 2840, intervals: ["R","9","♭3","5","♭13"],            aliases: ["mAdd9b13","m(9,♭13)"] },
  { key: "sus4_6_9",     fullName: "suspended fourth with sixth and ninth",                   displayName: "(6,9)sus4",   pcs: [0,2,5,7,9],     binary: "101001010100", decimal: 2644, intervals: ["R","9","4","5","6"],               aliases: ["sus4_6_9","6_9sus4","(6,9)sus4"] },
  { key: "m7b13",        fullName: "minor seventh flat thirteenth",                           displayName: "-7(♭13)",     pcs: [0,3,7,8,10],    binary: "100100011010", decimal: 2330, intervals: ["R","♭3","5","♭13","♭7"],           aliases: ["m7b13","-7(♭13)","m7♭13"] },
  { key: "7sus4b13",     fullName: "dominant seventh suspended fourth flat thirteenth",       displayName: "7(♭13)sus4",  pcs: [0,5,7,8,10],    binary: "100001011010", decimal: 2138, intervals: ["R","4","5","♭13","♭7"],            aliases: ["7sus4b13","7(♭13)sus4"] },
  { key: "m6_9_11_b13",  fullName: "minor sixth added ninth eleventh flat thirteenth",        displayName: "-6(9,11,♭13)", pcs: [0,2,3,5,7,8,9], binary: "101101011100", decimal: 2908, intervals: ["R","9","♭3","11","5","♭13","6"],  aliases: ["m6_9_11_b13","-6(9,11,♭13)"] },
  { key: "7b9no3",       fullName: "dominant seventh flat ninth no third",                    displayName: "5(7,♭9)",     pcs: [0,1,7,10],      binary: "110000010010", decimal: 3090, intervals: ["R","♭9","5","♭7"],                aliases: ["7b9no3","5(7,♭9)"] },
  { key: "5b9",          fullName: "power chord with flat ninth",                             displayName: "5(♭9)",       pcs: [0,1,7],         binary: "110000010000", decimal: 3088, intervals: ["R","♭9","5"],                    aliases: ["5b9","5(♭9)"] },
  { key: "M7add11",      fullName: "major seventh added eleventh",                            displayName: "∆add11",      pcs: [0,4,5,7,11],    binary: "100011010001", decimal: 2257, intervals: ["R","3","4","5","∆7"],             aliases: ["M7add11","∆add11","maj7add11"] },
  { key: "7sus4add13",   fullName: "dominant seventh suspended fourth added thirteenth",      displayName: "7(13)sus4",   pcs: [0,5,7,9,10],    binary: "100001010110", decimal: 2134, intervals: ["R","4","5","13","♭7"],            aliases: ["7sus4add13","7(13)sus4","13sus4"] },
  { key: "maj#9#11",     fullName: "major sharp ninth sharp eleventh",                        displayName: "(♯9,♯11)",    pcs: [0,3,4,6,7],     binary: "100110110000", decimal: 2480, intervals: ["R","♯9","3","♯11","5"],           aliases: ["maj#9#11","(♯9,♯11)"] },
  { key: "m6#11",        fullName: "minor sixth sharp eleventh",                              displayName: "-6(♯11)",     pcs: [0,3,6,7,9],     binary: "100100110100", decimal: 2356, intervals: ["R","♭3","♯11","5","6"],           aliases: ["m6#11","-6(♯11)"] },
  { key: "augMaj7add13", fullName: "augmented major seventh added thirteenth",                displayName: "+∆(13)",      pcs: [0,4,8,9,11],    binary: "100010001101", decimal: 2189, intervals: ["R","3","♯5","13","∆7"],           aliases: ["augMaj7add13","+∆(13)","+M7(13)"] },
  // ── Qualities identified from Apple Loop Sequ analysis (batch 3) ─────────
  { key: "maj13sus4",   fullName: "major thirteenth suspended fourth",                        displayName: "∆13sus4",     pcs: [0,2,5,7,9,11],  binary: "101001010101", decimal: 2645, intervals: ["R","9","4","5","13","∆7"],          aliases: ["maj13sus4","∆13sus4","Maj7(9,13)sus4"] },
  { key: "maj7b9b13",   fullName: "major seventh flat ninth flat thirteenth",                 displayName: "∆(♭9,♭13)",   pcs: [0,1,4,7,8,11],  binary: "110010011001", decimal: 3225, intervals: ["R","♭9","3","5","♭13","∆7"],         aliases: ["maj7b9b13","∆(♭9,♭13)","Maj7♭9♭13"] },
  { key: "maj7b5add13", fullName: "major seventh flat fifth added thirteenth",                displayName: "∆b5(13)",     pcs: [0,4,6,9,11],    binary: "100010100101", decimal: 2213, intervals: ["R","3","♭5","13","∆7"],             aliases: ["maj7b5add13","∆b5(13)"] },
  { key: "7add11",      fullName: "dominant seventh added eleventh",                          displayName: "7(11)",       pcs: [0,4,5,7,10],    binary: "100011010010", decimal: 2258, intervals: ["R","3","4","5","♭7"],               aliases: ["7add11","7(11)","dom7add11"] },
  { key: "m9b13",       fullName: "minor ninth flat thirteenth",                              displayName: "-7(9,♭13)",   pcs: [0,2,3,7,8,10],  binary: "101100011010", decimal: 2842, intervals: ["R","9","♭3","5","♭13","♭7"],         aliases: ["m9b13","m7(9,♭13)","-7(9,♭13)"] },
  // ── Qualities identified from ChordFixes analysis (batch 4) ──────────────
  { key: "7b9b13no3",   fullName: "dominant flat ninth flat thirteenth no third",              displayName: "5(7,♭9,♭13)", pcs: [0,1,7,8,10],    binary: "110000011010", decimal: 3098, intervals: ["R","♭9","5","♭13","♭7"],              aliases: ["7b9b13no3","5(7,♭9,♭13)"] },
  { key: "dimb9",       fullName: "diminished flat ninth",                                     displayName: "°(♭9)",       pcs: [0,1,3,6],       binary: "110100100000", decimal: 3360, intervals: ["R","♭9","♭3","♭5"],                   aliases: ["dimb9","dim♭9","°(♭9)"] },
  { key: "5_7_13",      fullName: "power chord dominant seventh thirteenth",                   displayName: "5(7,13)",     pcs: [0,7,9,10],      binary: "100000010110", decimal: 2070, intervals: ["R","5","13","♭7"],                    aliases: ["5_7_13","5(7,13)"] },
  { key: "Madd9add11",  fullName: "major added ninth added eleventh",                          displayName: "add9(11)",    pcs: [0,2,4,5,7],     binary: "101011010000", decimal: 2768, intervals: ["R","9","3","11","5"],                  aliases: ["Madd9add11","add9(11)","add9add11"] },
  // ── Qualities identified from Apple Loop Sequ analysis (batch 5) ─────────
  { key: "5add6",       fullName: "power chord added sixth",                                   displayName: "5(6)",        pcs: [0,7,9],         binary: "100000010100", decimal: 2068, intervals: ["R","5","6"],                           aliases: ["5add6","5(6)"] },
  { key: "5b13",        fullName: "power chord flat thirteenth",                               displayName: "5(♭13)",      pcs: [0,7,8],         binary: "100000011000", decimal: 2072, intervals: ["R","5","♭13"],                        aliases: ["5b13","5(♭13)"] },
  { key: "5_7_b13",     fullName: "power chord dominant seventh flat thirteenth",               displayName: "5(7,♭13)",    pcs: [0,7,8,10],      binary: "100000011010", decimal: 2074, intervals: ["R","5","♭13","♭7"],                  aliases: ["5_7_b13","5(7,♭13)"] },
  { key: "5Maj7",       fullName: "power chord major seventh",                                 displayName: "5∆",          pcs: [0,7,11],        binary: "100000010001", decimal: 2065, intervals: ["R","5","∆7"],                         aliases: ["5Maj7","5∆","5maj7"] },
  { key: "5_7_#11",     fullName: "power chord dominant seventh sharp eleventh",               displayName: "5(7,♯11)",    pcs: [0,6,7,10],      binary: "100000110010", decimal: 2098, intervals: ["R","♯11","5","♭7"],                  aliases: ["5_7_#11","5(7,♯11)"] },
  { key: "5Maj7#11",    fullName: "power chord major seventh sharp eleventh",                  displayName: "5∆(♯11)",     pcs: [0,6,7,11],      binary: "100000110001", decimal: 2097, intervals: ["R","♯11","5","∆7"],                  aliases: ["5Maj7#11","5∆(♯11)"] },
  { key: "aug#11",      fullName: "augmented sharp eleventh",                                  displayName: "+(♯11)",      pcs: [0,4,6,8],       binary: "100010101000", decimal: 2216, intervals: ["R","3","♯11","♯5"],                  aliases: ["aug#11","+(♯11)","augAdd#11"] },
  { key: "sus2b13",     fullName: "suspended second flat thirteenth",                          displayName: "(♭13)sus2",   pcs: [0,2,7,8],       binary: "101000011000", decimal: 2584, intervals: ["R","9","5","♭13"],                   aliases: ["sus2b13","(♭13)sus2"] },
  { key: "mAdd9#11",    fullName: "minor added ninth sharp eleventh",                          displayName: "m(9,♯11)",    pcs: [0,2,3,6,7],     binary: "101100110000", decimal: 2864, intervals: ["R","9","♭3","♯11","5"],              aliases: ["mAdd9#11","m(9,♯11)"] },
  { key: "5b9b13",      fullName: "power chord flat ninth flat thirteenth",                    displayName: "5(♭9,♭13)",   pcs: [0,1,7,8],       binary: "110000011000", decimal: 3096, intervals: ["R","♭9","5","♭13"],                  aliases: ["5b9b13","5(♭9,♭13)"] },
  // ── Qualities identified from Apple Loop Sequ analysis (batch 6) ─────────
  { key: "7b9#5no3",    fullName: "dominant seventh flat ninth sharp fifth no third",          displayName: "(7,♭9,♯5)",   pcs: [0,1,8,10],      binary: "110000001010", decimal: 3082, intervals: ["R","♭9","♯5","♭7"],                  aliases: ["7b9#5no3","5(7,♭9,♯5)"] },
  { key: "6#9",         fullName: "major sixth sharp ninth",                                   displayName: "6(♯9)",       pcs: [0,3,4,7,9],     binary: "100110010100", decimal: 2452, intervals: ["R","♯9","3","5","6"],                  aliases: ["6#9","6(♯9)"] },
];

// ─── Lookup index ──────────────────────────────────────────────────────

/**
 * Map from decimal fingerprint → chord quality.
 * Built once at module load time.
 */
const DECIMAL_INDEX: Map<number, ChordQuality> = new Map();

for (const q of CHORD_QUALITIES) {
  DECIMAL_INDEX.set(q.decimal, q);
}

/**
 * Look up a chord quality by its decimal fingerprint.
 */
export function lookupByDecimal(decimal: number): ChordQuality | undefined {
  return DECIMAL_INDEX.get(decimal);
}

/**
 * Get all chord qualities.
 */
export function getAllQualities(): readonly ChordQuality[] {
  return CHORD_QUALITIES;
}

/** Lazy key→quality index */
let KEY_INDEX: Map<string, ChordQuality> | null = null;
function getKeyIndex(): Map<string, ChordQuality> {
  if (!KEY_INDEX) {
    KEY_INDEX = new Map(CHORD_QUALITIES.map(q => [q.key, q]));
  }
  return KEY_INDEX;
}

/**
 * Look up a chord quality by its dictionary key (e.g. "maj7", "min", "7b9").
 */
export function findQualityByKey(key: string): ChordQuality | undefined {
  return getKeyIndex().get(key);
}

/**
 * Get the number of chord qualities in the dictionary.
 */
export function dictionarySize(): number {
  return CHORD_QUALITIES.length;
}

/**
 * Look up a chord quality by its interval pattern.
 * Intervals should be semitones from root (e.g., [0,4,7,11] for maj7).
 * Returns the first matching quality, or undefined if no exact match.
 */
export function findQualityByIntervals(intervals: number[]): ChordQuality | undefined {
  // Normalize intervals to sorted set
  const sorted = [...new Set(intervals)].sort((a, b) => a - b);

  // Search for exact match in dictionary
  for (const quality of CHORD_QUALITIES) {
    // Sort quality.pcs for comparison (dictionary stores in interval order, not sorted)
    const qualitySorted = [...quality.pcs].sort((a, b) => a - b);

    if (qualitySorted.length === sorted.length &&
        qualitySorted.every((pc, i) => pc === sorted[i])) {
      return quality;
    }
  }

  return undefined;
}
