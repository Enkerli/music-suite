/**
 * Chord Dictionary Module
 * Chord qualities for the fingering picker, sourced from @enkerli/theory (the
 * suite's single source of truth) so this app can't drift from the shared
 * chord definitions. The app keeps its own quality keys ('major', 'dom7', …);
 * this maps each to a theory dictionary key and pulls its pitch classes.
 */

import { findQualityByKey } from "@enkerli/theory";

/** Picker quality key → @enkerli/theory dictionary key. */
const THEORY_KEY = {
  major: "maj", minor: "min", dim: "dim", aug: "aug", sus2: "sus2", sus4: "sus4",
  maj7: "maj7", min7: "min7", dom7: "7", dim7: "dim7", hdim7: "m7b5",
  minmaj7: "minMaj7", aug7: "aug7", maj9: "maj9", min9: "min9", dom9: "9",
  "6": "6", min6: "m6",
};

/**
 * Chord quality → pitch-class intervals from the root, derived from
 * @enkerli/theory. (getChordPitchClasses takes these mod 12, so theory's
 * mod-12 pitch classes are equivalent to the old extended intervals.)
 */
export const CHORD_QUALITIES = Object.fromEntries(
  Object.entries(THEORY_KEY).map(([key, theoryKey]) => {
    const quality = findQualityByKey(theoryKey);
    if (!quality) throw new Error(`exquisite-fingerings: no @enkerli/theory quality "${theoryKey}" for "${key}"`);
    return [key, quality.pcs];
  }),
);

/**
 * Chord quality display names
 */
export const CHORD_NAMES = {
  'major': 'Major',
  'minor': 'Minor',
  'dim': 'Diminished',
  'aug': 'Augmented',
  'sus2': 'Sus2',
  'sus4': 'Sus4',
  'maj7': 'Major 7th',
  'min7': 'Minor 7th',
  'dom7': 'Dominant 7th',
  'dim7': 'Diminished 7th',
  'hdim7': 'Half-dim 7th',
  'minmaj7': 'Minor-Major 7th',
  'aug7': 'Augmented 7th',
  'maj9': 'Major 9th',
  'min9': 'Minor 9th',
  'dom9': 'Dominant 9th',
  '6': '6th',
  'min6': 'Minor 6th'
};

/**
 * Note names
 */
export const NOTE_NAMES = [
  'C', 'C#/Db', 'D', 'D#/Eb', 'E', 'F',
  'F#/Gb', 'G', 'G#/Ab', 'A', 'A#/Bb', 'B'
];

/**
 * Get pitch classes for a chord
 * @param {number} rootPC - Root pitch class (0-11)
 * @param {string} quality - Chord quality (e.g., 'dom7')
 * @returns {Array<number>} Array of pitch classes (mod 12)
 */
export function getChordPitchClasses(rootPC, quality) {
  const intervals = CHORD_QUALITIES[quality];
  if (!intervals) {
    throw new Error(`Unknown chord quality: ${quality}`);
  }

  return intervals.map(interval => (rootPC + interval) % 12);
}

/**
 * Get chord display name
 * @param {number} rootPC - Root pitch class (0-11)
 * @param {string} quality - Chord quality
 * @returns {string} Display name (e.g., "C Dominant 7th")
 */
export function getChordName(rootPC, quality) {
  const rootName = NOTE_NAMES[rootPC];
  const qualityName = CHORD_NAMES[quality] || quality;
  return `${rootName} ${qualityName}`;
}

/**
 * Analyze voicing type
 * @param {Array<number>} midiNotes - MIDI notes in the fingering (sorted)
 * @param {number} rootPC - Root pitch class
 * @returns {{type: string, description: string}}
 */
export function analyzeVoicing(midiNotes, rootPC) {
  if (midiNotes.length < 3) {
    return { type: 'incomplete', description: 'Incomplete voicing' };
  }

  // Sort notes
  const sorted = [...midiNotes].sort((a, b) => a - b);
  const lowestNote = sorted[0];
  const lowestPC = lowestNote % 12;

  // Check if root position (lowest note is root)
  const isRootPosition = lowestPC === rootPC;

  // Calculate spacing
  const intervals = [];
  for (let i = 1; i < sorted.length; i++) {
    intervals.push(sorted[i] - sorted[i - 1]);
  }

  // Check if close voicing (all intervals <= octave)
  const maxInterval = Math.max(...intervals);
  const isClose = maxInterval <= 12;

  // Determine voicing type
  let type, description;

  if (isRootPosition) {
    if (isClose) {
      type = 'root_close';
      description = 'Root Position (Close)';
    } else {
      type = 'root_open';
      description = 'Root Position (Open)';
    }
  } else {
    // Determine which inversion
    const bassInterval = (lowestPC - rootPC + 12) % 12;
    let inversion;

    if (bassInterval === 3 || bassInterval === 4) {
      inversion = 'first';
    } else if (bassInterval === 7) {
      inversion = 'second';
    } else if (bassInterval === 10 || bassInterval === 11) {
      inversion = 'third';
    } else {
      inversion = 'other';
    }

    type = `${inversion}_inversion`;
    description = `${inversion.charAt(0).toUpperCase() + inversion.slice(1)} Inversion`;

    if (!isClose) {
      description += ' (Open)';
    }
  }

  return {
    type,
    description,
    isRootPosition,
    isClose,
    lowestNote: lowestPC,
    span: sorted[sorted.length - 1] - sorted[0]
  };
}
