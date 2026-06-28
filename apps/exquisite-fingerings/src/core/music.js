import { pcsToDecimal, spellChordTones, spellScale } from "@enkerli/theory";

/**
 * Music Theory Core Module
 * Handles pitch classes, note names, intervals, scales, and chords
 */

// Note name to pitch class mapping
export const NOTE_TO_PC = {
  C: 0, 'C#': 1, Db: 1,
  D: 2, 'D#': 3, Eb: 3,
  E: 4,
  F: 5, 'F#': 6, Gb: 6,
  G: 7, 'G#': 8, Ab: 8,
  A: 9, 'A#': 10, Bb: 10,
  B: 11
};

// Pitch class to note name (using sharps)
export const PC_TO_NOTE_SHARP = [
  'C', 'C#', 'D', 'D#', 'E', 'F',
  'F#', 'G', 'G#', 'A', 'A#', 'B'
];

// Pitch class to note name (using flats)
export const PC_TO_NOTE_FLAT = [
  'C', 'Db', 'D', 'Eb', 'E', 'F',
  'Gb', 'G', 'Ab', 'A', 'Bb', 'B'
];

/**
 * Pitch Class Set definitions
 * Each set is an array of intervals from the root
 */
export const PITCH_CLASS_SETS = {
  // Scales
  maj: { name: 'Major scale', intervals: [0, 2, 4, 5, 7, 9, 11], type: 'scale' },
  natmin: { name: 'Natural minor', intervals: [0, 2, 3, 5, 7, 8, 10], type: 'scale' },
  harmin: { name: 'Harmonic minor', intervals: [0, 2, 3, 5, 7, 8, 11], type: 'scale' },
  melmin: { name: 'Melodic minor', intervals: [0, 2, 3, 5, 7, 9, 11], type: 'scale' },
  dorian: { name: 'Dorian', intervals: [0, 2, 3, 5, 7, 9, 10], type: 'scale' },
  phrygian: { name: 'Phrygian', intervals: [0, 1, 3, 5, 7, 8, 10], type: 'scale' },
  lydian: { name: 'Lydian', intervals: [0, 2, 4, 6, 7, 9, 11], type: 'scale' },
  mixolydian: { name: 'Mixolydian', intervals: [0, 2, 4, 5, 7, 9, 10], type: 'scale' },
  locrian: { name: 'Locrian', intervals: [0, 1, 3, 5, 6, 8, 10], type: 'scale' },

  // Pentatonics
  majpent: { name: 'Major pentatonic', intervals: [0, 2, 4, 7, 9], type: 'scale' },
  minpent: { name: 'Minor pentatonic', intervals: [0, 3, 5, 7, 10], type: 'scale' },

  // Triads
  majtriad: { name: 'Major triad', intervals: [0, 4, 7], type: 'chord' },
  mintriad: { name: 'Minor triad', intervals: [0, 3, 7], type: 'chord' },
  augtriad: { name: 'Augmented triad', intervals: [0, 4, 8], type: 'chord' },
  dimtriad: { name: 'Diminished triad', intervals: [0, 3, 6], type: 'chord' },

  // 7th chords
  maj7: { name: 'Major 7th', intervals: [0, 4, 7, 11], type: 'chord' },
  min7: { name: 'Minor 7th', intervals: [0, 3, 7, 10], type: 'chord' },
  dom7: { name: 'Dominant 7th', intervals: [0, 4, 7, 10], type: 'chord' },
  dim7: { name: 'Diminished 7th', intervals: [0, 3, 6, 9], type: 'chord' },
  hdim7: { name: 'Half-diminished 7th', intervals: [0, 3, 6, 10], type: 'chord' },

  // Extended chords
  maj9: { name: 'Major 9th', intervals: [0, 4, 7, 11, 14], type: 'chord' },
  min9: { name: 'Minor 9th', intervals: [0, 3, 7, 10, 14], type: 'chord' },
  dom9: { name: 'Dominant 9th', intervals: [0, 4, 7, 10, 14], type: 'chord' },

  // Other
  chromatic: { name: 'Chromatic', intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], type: 'scale' },
  wholeTone: { name: 'Whole tone', intervals: [0, 2, 4, 6, 8, 10], type: 'scale' }
};

/**
 * Get pitch classes for a given key and set type
 * @param {string} key - Root note (e.g., 'C', 'F#', 'Bb')
 * @param {string} setType - Type from PITCH_CLASS_SETS keys
 * @returns {Set<number>} Set of pitch classes (0-11)
 */
/**
 * Degree labels for chordal/pentatonic sets — used for proper structural
 * spelling (the degree fixes the letter; see music-suite CONVENTIONS.md).
 * Heptatonic scales need none (seven consecutive letters).
 */
const SET_DEGREES = {
  majpent: ['R', '2', '3', '5', '6'],
  minpent: ['R', 'b3', '4', '5', 'b7'],
  majtriad: ['R', '3', '5'],
  mintriad: ['R', 'b3', '5'],
  augtriad: ['R', '3', '#5'],
  dimtriad: ['R', 'b3', 'b5'],
  maj7: ['R', '3', '5', '7'],
  min7: ['R', 'b3', '5', 'b7'],
  dom7: ['R', '3', '5', 'b7'],
  dim7: ['R', 'b3', 'b5', 'bb7'],
  hdim7: ['R', 'b3', 'b5', 'b7'],
  maj9: ['R', '3', '5', '7', '9'],
  min9: ['R', 'b3', '5', 'b7', '9'],
  dom9: ['R', '3', '5', 'b7', '9'],
};

/**
 * Properly spelled note names for a key + set, as Map<pitchClass, name>.
 * Heptatonic scales spell via seven consecutive letters; chords and
 * pentatonics via degree labels. Returns null when no proper spelling
 * exists (chromatic, whole tone, custom PCS) — display falls back to
 * chromatic names, which is correct for context-free pitch classes.
 */
export function getSpelledNoteNames(key, setType) {
  const data = PITCH_CLASS_SETS[setType];
  if (!data) return null;
  const rootPc = NOTE_TO_PC[key];
  if (rootPc === undefined) return null;

  let names = null;
  if (data.type === 'scale' && data.intervals.length === 7) {
    names = spellScale(key, data.intervals);
  } else {
    const degrees = SET_DEGREES[setType];
    if (degrees) names = spellChordTones(key, degrees, data.intervals);
  }
  if (!names) return null;

  const map = new Map();
  data.intervals.forEach((interval, i) => {
    map.set((rootPc + interval) % 12, names[i]);
  });
  return map;
}

export function getPitchClasses(key, setType) {
  const root = NOTE_TO_PC[key];
  if (root === undefined) {
    throw new Error(`Invalid key: ${key}`);
  }

  const pcsData = PITCH_CLASS_SETS[setType];
  if (!pcsData) {
    throw new Error(`Invalid set type: ${setType}`);
  }

  const pcs = new Set();
  for (const interval of pcsData.intervals) {
    pcs.add((root + interval) % 12);
  }
  return pcs;
}

/**
 * Parse custom pitch class string (e.g., "0,3,7,10")
 * @param {string} pcString - Comma-separated pitch classes
 * @returns {Set<number>} Set of pitch classes (0-11)
 */
export function parseCustomPitchClasses(pcString) {
  const pcs = new Set();
  if (!pcString || !pcString.trim()) return pcs;

  pcString.split(',').forEach(s => {
    const n = Number(s.trim());
    if (!Number.isNaN(n)) {
      pcs.add(((n % 12) + 12) % 12);
    }
  });
  return pcs;
}

/**
 * Convert MIDI note number to note name
 * @param {number} midiNote - MIDI note number (0-127)
 * @param {boolean} useFlats - Use flats instead of sharps
 * @returns {string} Note name with octave (e.g., 'C4', 'F#5')
 */
export function midiToNoteName(midiNote, useFlats = false) {
  const pc = ((midiNote % 12) + 12) % 12;
  const octave = Math.floor(midiNote / 12) - 1;
  const noteName = useFlats ? PC_TO_NOTE_FLAT[pc] : PC_TO_NOTE_SHARP[pc];
  return `${noteName}${octave}`;
}

/**
 * Get pitch class from MIDI note
 * @param {number} midiNote - MIDI note number
 * @returns {number} Pitch class (0-11)
 */
export function midiToPitchClass(midiNote) {
  return ((midiNote % 12) + 12) % 12;
}

/**
 * Convert pitch class set to binary representation
 * Binary representation (strict leftmost-LSB, suite-wide convention — see
 * music-suite CONVENTIONS.md): pitch class i contributes 2^i, so pitch class 0
 * (C) is bit 0 (2^0), the LEAST significant bit.
 * Example: C major triad (C, E, G) = 2^0 + 2^4 + 2^7 = 145
 *
 * @param {Set<number>|Array<number>} pcs - Pitch class set
 * @returns {number} Binary representation (0-4095)
 */
export function pcsToBinary(pcs) {
  // Single source of truth: @enkerli/theory's leftmost-LSB mask (pc i = 2^i).
  return pcsToDecimal(Array.isArray(pcs) ? pcs : Array.from(pcs));
}

/**
 * Convert binary representation to pitch class set
 * @param {number} binary - Binary representation (0-4095)
 * @returns {Set<number>} Pitch class set
 */
export function binaryToPcs(binary) {
  const pcs = new Set();
  // leftmost-LSB: pc i is bit i (2^i) — the inverse of pcsToBinary / theory.
  for (let pc = 0; pc < 12; pc++) {
    if (binary & (1 << pc)) {
      pcs.add(pc);
    }
  }
  return pcs;
}

/**
 * Format binary PCS for display
 * @param {number} binary - Binary representation
 * @returns {object} Object with different representations
 */
export function formatBinaryPcs(binary) {
  return {
    binary: binary.toString(2).padStart(12, '0'),
    decimal: binary,
    octal: binary.toString(8),
    hex: '0x' + binary.toString(16).toUpperCase()
  };
}

/**
 * Get interval between two pitch classes
 * @param {number} pc1 - First pitch class (0-11)
 * @param {number} pc2 - Second pitch class (0-11)
 * @returns {number} Interval in semitones (0-11)
 */
export function getInterval(pc1, pc2) {
  return ((pc2 - pc1 + 12) % 12);
}

/**
 * Transpose pitch class set
 * @param {Set<number>} pcs - Pitch class set
 * @param {number} semitones - Semitones to transpose
 * @returns {Set<number>} Transposed pitch class set
 */
export function transposePcs(pcs, semitones) {
  const transposed = new Set();
  for (const pc of pcs) {
    transposed.add(((pc + semitones + 12) % 12));
  }
  return transposed;
}
