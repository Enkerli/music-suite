/**
 * Chord Dictionary Module
 * Defines chord qualities and their pitch class intervals
 */

/**
 * Chord quality definitions
 * Each quality maps to semitone intervals from the root
 */
export const CHORD_QUALITIES = {
  // Triads
  'major': [0, 4, 7],
  'minor': [0, 3, 7],
  'dim': [0, 3, 6],
  'aug': [0, 4, 8],
  'sus2': [0, 2, 7],
  'sus4': [0, 5, 7],

  // 7th Chords
  'maj7': [0, 4, 7, 11],
  'min7': [0, 3, 7, 10],
  'dom7': [0, 4, 7, 10],
  'dim7': [0, 3, 6, 9],
  'hdim7': [0, 3, 6, 10],  // Half-diminished 7th
  'minmaj7': [0, 3, 7, 11], // Minor-major 7th
  'aug7': [0, 4, 8, 10],    // Augmented 7th

  // Extended Chords
  'maj9': [0, 4, 7, 11, 14],     // 14 = 2 + 12
  'min9': [0, 3, 7, 10, 14],
  'dom9': [0, 4, 7, 10, 14],
  '6': [0, 4, 7, 9],             // Major 6th
  'min6': [0, 3, 7, 9]           // Minor 6th
};

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
