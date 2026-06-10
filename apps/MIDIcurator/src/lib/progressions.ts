/**
 * Shared progression and voicing definitions.
 *
 * Used by the in-browser progression generator and the static sample
 * generator script (scripts/generate-samples.mjs).
 */

import { spellRoot } from './chord-dictionary';

// ── Types ──────────────────────────────────────────────────────────

export interface ProgressionChord {
  /** MIDI note number for root (e.g. 60 = C4) */
  root: number;
  /** Semitone intervals above root (e.g. [0, 4, 7] for major triad) */
  intervals: number[];
  /** Chord symbol label (e.g. "Dm7") */
  label: string;
}

export interface Progression {
  name: string;
  chords: ProgressionChord[];
  leadsheet: string;
}

export type VoicingShape =
  | 'block'
  | 'arp-up-down'
  | 'arp-down-up'
  | 'arp-converge'
  | 'arp-diverge'
  | 'arp-bloom'
  | 'arp-random'
  | 'broken'
  | 'strum-up'
  | 'strum-down';

// ── Constants ──────────────────────────────────────────────────────

export const KEY_NAMES = [
  'C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B',
] as const;

export const VOICING_LABELS: Record<VoicingShape, string> = {
  'block': 'Block',
  'arp-up-down': 'Arp Up-Down',
  'arp-down-up': 'Arp Down-Up',
  'arp-converge': 'Arp Converge',
  'arp-diverge': 'Arp Diverge',
  'arp-bloom': 'Arp Bloom',
  'arp-random': 'Arp Random',
  'broken': 'Broken',
  'strum-up': 'Strum Up',
  'strum-down': 'Strum Down',
};

export const VOICING_SHAPES: VoicingShape[] = [
  'block', 'arp-up-down', 'arp-down-up', 'arp-converge', 'arp-diverge',
  'arp-bloom', 'arp-random', 'broken', 'strum-up', 'strum-down',
];

// ── Progressions ───────────────────────────────────────────────────

export const PROGRESSIONS: Progression[] = [
  {
    name: 'Four Chords',
    // I V vi IV in C: C G Am F
    chords: [
      { root: 60, intervals: [0, 4, 7], label: 'C' },
      { root: 55, intervals: [0, 4, 7], label: 'G' },
      { root: 57, intervals: [0, 3, 7], label: 'Am' },
      { root: 53, intervals: [0, 4, 7], label: 'F' },
    ],
    leadsheet: 'C | G | Am | F',
  },
  {
    name: 'Jazz ii-V-I',
    // Dm7 G7 Cmaj7 Cmaj7
    chords: [
      { root: 62, intervals: [0, 3, 7, 10], label: 'Dm7' },
      { root: 55, intervals: [0, 4, 7, 10], label: 'G7' },
      { root: 60, intervals: [0, 4, 7, 11], label: 'Cmaj7' },
      { root: 60, intervals: [0, 4, 7, 11], label: 'Cmaj7' },
    ],
    leadsheet: 'Dm7 | G7 | Cmaj7 | %',
  },
  {
    name: '12-Bar Blues',
    chords: [
      { root: 60, intervals: [0, 4, 7, 10], label: 'C7' },
      { root: 60, intervals: [0, 4, 7, 10], label: 'C7' },
      { root: 60, intervals: [0, 4, 7, 10], label: 'C7' },
      { root: 60, intervals: [0, 4, 7, 10], label: 'C7' },
      { root: 65, intervals: [0, 4, 7, 10], label: 'F7' },
      { root: 65, intervals: [0, 4, 7, 10], label: 'F7' },
      { root: 60, intervals: [0, 4, 7, 10], label: 'C7' },
      { root: 60, intervals: [0, 4, 7, 10], label: 'C7' },
      { root: 67, intervals: [0, 4, 7, 10], label: 'G7' },
      { root: 65, intervals: [0, 4, 7, 10], label: 'F7' },
      { root: 60, intervals: [0, 4, 7, 10], label: 'C7' },
      { root: 67, intervals: [0, 4, 7, 10], label: 'G7' },
    ],
    leadsheet: 'C7 | % | % | % | F7 | % | C7 | % | G7 | F7 | C7 | G7',
  },
  {
    name: 'Minor ii-V-i',
    // Dm7b5 G7 Cm Cm
    chords: [
      { root: 62, intervals: [0, 3, 6, 10], label: 'Dm7b5' },
      { root: 55, intervals: [0, 4, 7, 10], label: 'G7' },
      { root: 60, intervals: [0, 3, 7], label: 'Cm' },
      { root: 60, intervals: [0, 3, 7], label: 'Cm' },
    ],
    leadsheet: 'Dm7b5 | G7 | Cm | %',
  },
  {
    name: 'Andalusian Cadence',
    // Am G F E
    chords: [
      { root: 57, intervals: [0, 3, 7], label: 'Am' },
      { root: 55, intervals: [0, 4, 7], label: 'G' },
      { root: 53, intervals: [0, 4, 7], label: 'F' },
      { root: 52, intervals: [0, 4, 7], label: 'E' },
    ],
    leadsheet: 'Am | G | F | E',
  },
  {
    name: 'Rhythm Changes A',
    // Bbmaj7 G7 Cm7 F7
    chords: [
      { root: 58, intervals: [0, 4, 7, 11], label: 'Bbmaj7' },
      { root: 55, intervals: [0, 4, 7, 10], label: 'G7' },
      { root: 60, intervals: [0, 3, 7, 10], label: 'Cm7' },
      { root: 53, intervals: [0, 4, 7, 10], label: 'F7' },
    ],
    leadsheet: 'Bbmaj7 | G7 | Cm7 | F7',
  },
  {
    name: '50s Doo-Wop',
    // I vi IV V: C Am F G
    chords: [
      { root: 60, intervals: [0, 4, 7], label: 'C' },
      { root: 57, intervals: [0, 3, 7], label: 'Am' },
      { root: 53, intervals: [0, 4, 7], label: 'F' },
      { root: 55, intervals: [0, 4, 7], label: 'G' },
    ],
    leadsheet: 'C | Am | F | G',
  },
  {
    name: 'Creep / Radiohead',
    // I III IV iv: G B C Cm
    chords: [
      { root: 55, intervals: [0, 4, 7], label: 'G' },
      { root: 59, intervals: [0, 4, 7], label: 'B' },
      { root: 60, intervals: [0, 4, 7], label: 'C' },
      { root: 60, intervals: [0, 3, 7], label: 'Cm' },
    ],
    leadsheet: 'G | B | C | Cm',
  },
  {
    name: 'Coltrane Changes',
    // Cmaj7 Ab7 Dbmaj7 A7 | Dmaj7 Bb7 Ebmaj7 B7 (Giant Steps first 4 bars, 2 chords per bar)
    chords: [
      { root: 60, intervals: [0, 4, 7, 11], label: 'Cmaj7' },
      { root: 56, intervals: [0, 4, 7, 10], label: 'Ab7' },
      { root: 61, intervals: [0, 4, 7, 11], label: 'Dbmaj7' },
      { root: 57, intervals: [0, 4, 7, 10], label: 'A7' },
      { root: 62, intervals: [0, 4, 7, 11], label: 'Dmaj7' },
      { root: 58, intervals: [0, 4, 7, 10], label: 'Bb7' },
      { root: 63, intervals: [0, 4, 7, 11], label: 'Ebmaj7' },
      { root: 59, intervals: [0, 4, 7, 10], label: 'B7' },
    ],
    leadsheet: 'Cmaj7 Ab7 | Dbmaj7 A7 | Dmaj7 Bb7 | Ebmaj7 B7',
  },
  {
    name: 'Canon / Pachelbel',
    // I V vi iii IV I IV V: C G Am Em F C F G
    chords: [
      { root: 60, intervals: [0, 4, 7], label: 'C' },
      { root: 55, intervals: [0, 4, 7], label: 'G' },
      { root: 57, intervals: [0, 3, 7], label: 'Am' },
      { root: 52, intervals: [0, 3, 7], label: 'Em' },
      { root: 53, intervals: [0, 4, 7], label: 'F' },
      { root: 60, intervals: [0, 4, 7], label: 'C' },
      { root: 53, intervals: [0, 4, 7], label: 'F' },
      { root: 55, intervals: [0, 4, 7], label: 'G' },
    ],
    leadsheet: 'C | G | Am | Em | F | C | F | G',
  },
];

// ── Transposition ──────────────────────────────────────────────────

/**
 * Parse a chord label into root pitch class + quality suffix.
 * E.g. "Dm7" → { rootPc: 2, quality: "m7" }, "Bbmaj7" → { rootPc: 10, quality: "maj7" }
 */
const LABEL_TO_PC: Record<string, number> = {
  'C': 0, 'C#': 1, 'C♯': 1, 'Db': 1, 'D♭': 1,
  'D': 2, 'D#': 3, 'D♯': 3, 'Eb': 3, 'E♭': 3,
  'E': 4, 'E#': 5, 'E♯': 5, 'Fb': 4, 'F♭': 4,
  'F': 5, 'F#': 6, 'F♯': 6, 'Gb': 6, 'G♭': 6,
  'G': 7, 'G#': 8, 'G♯': 8, 'Ab': 8, 'A♭': 8,
  'A': 9, 'A#': 10, 'A♯': 10, 'Bb': 10, 'B♭': 10,
  'B': 11, 'B#': 0, 'B♯': 0, 'Cb': 11, 'C♭': 11,
};

function parseLabelRoot(label: string): { rootPc: number; quality: string; bassPc?: number; bassSuffix?: string } {
  // Check for /Bass suffix
  let mainPart = label;
  let bassPc: number | undefined;
  let bassSuffix: string | undefined;
  const slashIdx = label.lastIndexOf('/');
  if (slashIdx > 0) {
    const afterSlash = label.slice(slashIdx + 1);
    // Try to parse the bass note (2-char then 1-char)
    for (const len of [2, 1]) {
      if (len > afterSlash.length) continue;
      const candidate = afterSlash.slice(0, len);
      if (LABEL_TO_PC[candidate] !== undefined && len === afterSlash.length) {
        bassPc = LABEL_TO_PC[candidate]!;
        bassSuffix = afterSlash;
        mainPart = label.slice(0, slashIdx);
        break;
      }
    }
  }

  // Try 2-char root first (e.g. "Bb", "F#", "E♯"), then 1-char
  for (const len of [2, 1]) {
    const candidate = mainPart.slice(0, len);
    if (LABEL_TO_PC[candidate] !== undefined) {
      return { rootPc: LABEL_TO_PC[candidate]!, quality: mainPart.slice(len), bassPc, bassSuffix };
    }
  }
  return { rootPc: 0, quality: mainPart, bassPc, bassSuffix };
}

/**
 * Transpose a progression by a number of semitones.
 * Shifts root MIDI notes and rewrites chord labels + leadsheet text.
 */
export function transposeProgression(prog: Progression, semitones: number): Progression {
  if (semitones === 0) return prog;

  const targetKeyPc = ((semitones % 12) + 12) % 12;

  const chords = prog.chords.map(chord => {
    const newRoot = chord.root + semitones;
    const { rootPc, quality, bassPc } = parseLabelRoot(chord.label);
    const newPc = ((rootPc + semitones) % 12 + 12) % 12;
    let newLabel = spellRoot(newPc, targetKeyPc) + quality;
    if (bassPc !== undefined) {
      const newBassPc = ((bassPc + semitones) % 12 + 12) % 12;
      newLabel += `/${spellRoot(newBassPc, targetKeyPc)}`;
    }
    return { ...chord, root: newRoot, label: newLabel };
  });

  // Rebuild leadsheet from the new labels
  // We need to match original bar structure (repeat markers, multi-chord bars)
  const bars = prog.leadsheet.split('|').map(b => b.trim());
  const newBars: string[] = [];
  let chordIdx = 0;

  for (const bar of bars) {
    if (bar === '%' || bar === '-') {
      newBars.push(bar);
      continue;
    }
    // Split bar into individual chord tokens
    const tokens = bar.split(/\s+/).filter(Boolean);
    const newTokens: string[] = [];
    for (const token of tokens) {
      if (token === 'NC' || token === 'nc') {
        newTokens.push(token);
        continue;
      }
      // Use the transposed chord label at the corresponding index
      if (chordIdx < chords.length) {
        newTokens.push(chords[chordIdx]!.label);
        chordIdx++;
      }
    }
    newBars.push(newTokens.join(' '));
  }

  return {
    ...prog,
    chords,
    leadsheet: newBars.join(' | '),
  };
}
