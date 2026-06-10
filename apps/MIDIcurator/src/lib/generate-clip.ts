/**
 * In-browser progression clip generator.
 *
 * Builds a Note[] array directly from a Progression + VoicingShape,
 * avoiding the MIDI encode→decode round-trip.
 */

import type { Note } from '../types/clip';
import type { Progression, ProgressionChord, VoicingShape } from './progressions';

const PPQ = 480;
const BAR = PPQ * 4; // 4/4 time

// ── Helper ─────────────────────────────────────────────────────────

/** Build a full bar of eighth notes from a pitch pattern (padded/truncated to 8). */
function eighthNoteBar(
  pattern: number[],
  barIndex: number,
  velocity: number,
): Note[] {
  const startTick = barIndex * BAR;
  const eighth = PPQ / 2;
  const dur = eighth - 20;
  const p = pattern.slice(0, 8);
  while (p.length < 8) p.push(p[p.length - 1]!); // pad if short
  return p.map((pitch, i) => ({
    midi: pitch,
    ticks: startTick + i * eighth,
    durationTicks: dur,
    velocity,
  }));
}

/** Get sorted pitches (ascending) for a chord, with octave-up root appended. */
function chordPitches(chord: ProgressionChord): number[] {
  return chord.intervals.map(i => chord.root + i);
}

// ── Voicing functions ──────────────────────────────────────────────

/** All notes of the chord sounding together for a full bar. */
function voiceBlock(chord: ProgressionChord, barIndex: number): Note[] {
  const startTick = barIndex * BAR;
  const dur = BAR - PPQ / 4; // slightly shorter for separation
  return chord.intervals.map(interval => ({
    midi: chord.root + interval,
    ticks: startTick,
    durationTicks: dur,
    velocity: 90,
  }));
}

/** Ascending then descending eighth notes per bar. */
function voiceArpUpDown(chord: ProgressionChord, barIndex: number): Note[] {
  const pitches = chordPitches(chord);
  let pattern: number[];
  if (pitches.length === 3) {
    pattern = [...pitches, pitches[0]! + 12, pitches[0]! + 12, ...pitches.slice().reverse()];
  } else {
    pattern = [...pitches, ...pitches.slice().reverse()];
  }
  return eighthNoteBar(pattern, barIndex, 80);
}

/** Descending then ascending eighth notes per bar. */
function voiceArpDownUp(chord: ProgressionChord, barIndex: number): Note[] {
  const pitches = chordPitches(chord);
  let pattern: number[];
  if (pitches.length === 3) {
    const desc = [pitches[0]! + 12, ...pitches.slice().reverse()];
    pattern = [...desc, ...pitches];
  } else {
    const desc = pitches.slice().reverse();
    pattern = [...desc, ...pitches];
  }
  return eighthNoteBar(pattern, barIndex, 80);
}

/**
 * Converge: outer voices move inward.
 * 4-note: bottom, top, 2nd, 3rd, bottom, top, 2nd, 3rd
 * 3-note: bottom, top, mid, top, bottom, top, mid, top
 */
function voiceArpConverge(chord: ProgressionChord, barIndex: number): Note[] {
  const pitches = chordPitches(chord);
  let pattern: number[];
  if (pitches.length === 3) {
    pattern = [pitches[0]!, pitches[2]!, pitches[1]!, pitches[2]!,
               pitches[0]!, pitches[2]!, pitches[1]!, pitches[2]!];
  } else {
    pattern = [pitches[0]!, pitches[3]!, pitches[1]!, pitches[2]!,
               pitches[0]!, pitches[3]!, pitches[1]!, pitches[2]!];
  }
  return eighthNoteBar(pattern, barIndex, 76);
}

/**
 * Diverge: inner voices move outward.
 * 4-note: 2nd, 3rd, bottom, top, 2nd, 3rd, bottom, top
 * 3-note: mid, bottom, top, bottom, mid, bottom, top, bottom
 */
function voiceArpDiverge(chord: ProgressionChord, barIndex: number): Note[] {
  const pitches = chordPitches(chord);
  let pattern: number[];
  if (pitches.length === 3) {
    pattern = [pitches[1]!, pitches[0]!, pitches[2]!, pitches[0]!,
               pitches[1]!, pitches[0]!, pitches[2]!, pitches[0]!];
  } else {
    pattern = [pitches[1]!, pitches[2]!, pitches[0]!, pitches[3]!,
               pitches[1]!, pitches[2]!, pitches[0]!, pitches[3]!];
  }
  return eighthNoteBar(pattern, barIndex, 76);
}

/** Expanding outward from root (R, top, middle, octave). */
function voiceBloom(chord: ProgressionChord, barIndex: number): Note[] {
  const pitches = chordPitches(chord);
  let pattern: number[];
  if (pitches.length === 3) {
    pattern = [pitches[0]!, pitches[2]!, pitches[1]!, pitches[0]! + 12,
               pitches[0]!, pitches[2]!, pitches[1]!, pitches[0]! + 12];
  } else {
    pattern = [pitches[0]!, pitches[3]!, pitches[1]!, pitches[2]!,
               pitches[0]!, pitches[3]!, pitches[1]!, pitches[2]!];
  }
  return eighthNoteBar(pattern, barIndex, 75);
}

/** Deterministic pseudo-random pattern. */
function voicePseudoRandom(chord: ProgressionChord, barIndex: number): Note[] {
  const pitches = chordPitches(chord);
  const pool = [...pitches, pitches[0]! + 12];
  const seed = (barIndex + 1) * 7 + chord.root;
  const pattern: number[] = [];
  for (let i = 0; i < 8; i++) {
    const idx = (seed * (i + 3) + i * 13) % pool.length;
    pattern.push(pool[idx]!);
  }
  return eighthNoteBar(pattern, barIndex, 78);
}

/** Alberti bass pattern (root-5th-3rd-5th). */
function voiceBroken(chord: ProgressionChord, barIndex: number): Note[] {
  const pitches = chordPitches(chord);
  let unit: number[];
  if (pitches.length === 3) {
    unit = [pitches[0]!, pitches[2]!, pitches[1]!, pitches[2]!];
  } else {
    unit = [pitches[0]!, pitches[2]!, pitches[1]!, pitches[3]!];
  }
  return eighthNoteBar([...unit, ...unit], barIndex, 72);
}

/**
 * Strum up: all chord tones played rapidly ascending (like a guitar upstroke).
 * Short stagger (30 ticks between notes), then held for the bar.
 */
function voiceStrumUp(chord: ProgressionChord, barIndex: number): Note[] {
  const startTick = barIndex * BAR;
  const stagger = 30;
  const pitches = chordPitches(chord);
  const holdEnd = startTick + BAR - PPQ / 4;

  return pitches.map((pitch, i) => ({
    midi: pitch,
    ticks: startTick + i * stagger,
    durationTicks: holdEnd - (startTick + i * stagger),
    velocity: 70 + Math.round(i * (20 / Math.max(pitches.length - 1, 1))),
  }));
}

/**
 * Strum down: all chord tones played rapidly descending (like a guitar downstroke).
 * Short stagger from top to bottom, then held for the bar.
 */
function voiceStrumDown(chord: ProgressionChord, barIndex: number): Note[] {
  const startTick = barIndex * BAR;
  const stagger = 30;
  const pitches = chordPitches(chord).slice().reverse(); // top to bottom
  const holdEnd = startTick + BAR - PPQ / 4;

  return pitches.map((pitch, i) => ({
    midi: pitch,
    ticks: startTick + i * stagger,
    durationTicks: holdEnd - (startTick + i * stagger),
    velocity: 90 - Math.round(i * (20 / Math.max(pitches.length - 1, 1))),
  }));
}

const VOICING_FNS: Record<VoicingShape, (chord: ProgressionChord, barIndex: number) => Note[]> = {
  'block': voiceBlock,
  'arp-up-down': voiceArpUpDown,
  'arp-down-up': voiceArpDownUp,
  'arp-converge': voiceArpConverge,
  'arp-diverge': voiceArpDiverge,
  'arp-bloom': voiceBloom,
  'arp-random': voicePseudoRandom,
  'broken': voiceBroken,
  'strum-up': voiceStrumUp,
  'strum-down': voiceStrumDown,
};

// ── Public API ─────────────────────────────────────────────────────

export interface GeneratedClipData {
  notes: Note[];
  leadsheetText: string;
  filename: string;
  ppq: number;
}

/**
 * Generate Note[] for a progression in a given voicing.
 * Returns data ready to be fed through extractGesture + extractHarmonic.
 */
export function generateProgressionClip(
  progression: Progression,
  voicing: VoicingShape,
  bpm: number,
): GeneratedClipData {
  const voiceFn = VOICING_FNS[voicing];
  const notes: Note[] = [];

  for (let barIdx = 0; barIdx < progression.chords.length; barIdx++) {
    const chord = progression.chords[barIdx]!;
    notes.push(...voiceFn(chord, barIdx));
  }

  // Build leadsheet with one chord per bar, matching the note layout.
  // The progression.leadsheet may group multiple chords per bar (e.g. Coltrane
  // Changes: "Cmaj7 Ab7 | Dbmaj7 A7 | ..."), but the generator always places
  // one chord per bar, so the leadsheet must match that structure.
  const generatedLeadsheet = progression.chords.map(c => c.label).join(' | ');

  const safeName = progression.name.replace(/[^a-zA-Z0-9]+/g, '-');
  const safeVoicing = voicing.replace(/[^a-zA-Z0-9]+/g, '-');
  const filename = `${safeName}_${safeVoicing}_${bpm}bpm.mid`;

  return {
    notes,
    leadsheetText: generatedLeadsheet,
    filename,
    ppq: PPQ,
  };
}
