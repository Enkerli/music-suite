import type { Note, Gesture, Harmonic, DetectedChord, BarChordInfo, Clip } from '../types/clip';
import { detectOverallChord, detectChordsPerBar, type ChordMatch } from './chord-detect';

export function computeSyncopation(
  onsets: number[],
  ticksPerBeat: number,
  ticksPerBar: number,
): number {
  let score = 0;

  for (const onset of onsets) {
    const posInBar = onset % ticksPerBar;
    const posInBeat = posInBar % ticksPerBeat;

    if (posInBeat === 0) {
      const beatNum = Math.floor(posInBar / ticksPerBeat);
      score += beatNum === 0 ? 0 : 0.3;
    } else {
      score += posInBeat / ticksPerBeat;
    }
  }

  return onsets.length > 0 ? score / onsets.length : 0;
}

/**
 * @param timeSignature Optional [numerator, denominator] (defaults to [4, 4]).
 */
export function extractGesture(
  notes: Note[],
  ticksPerBeat: number,
  timeSignature?: [number, number],
): Gesture {
  const onsets = notes.map(n => n.ticks);
  const durations = notes.map(n => n.durationTicks);
  const velocities = notes.map(n => n.velocity);

  const [tsNum, tsDenom] = timeSignature ?? [4, 4];
  // ticksPerBeat = one quarter note. Scale to actual time signature:
  // e.g. 3/4 → 3 quarter-note beats → ticksPerBar = 3 * ticksPerBeat
  // e.g. 6/8 → 6 eighth-note beats → ticksPerBar = 6 * (ticksPerBeat / 2)
  const ticksPerBar = tsNum * ticksPerBeat * (4 / tsDenom);
  const beatsPerBar = tsNum * (4 / tsDenom); // in quarter-note units
  const lastTick = Math.max(...notes.map(n => n.ticks + n.durationTicks));
  const numBars = Math.ceil(lastTick / ticksPerBar);

  const totalBeats = numBars * beatsPerBar;
  const density = notes.length / totalBeats;

  const avgVelocity = velocities.reduce((a, b) => a + b, 0) / velocities.length;
  const velocityVariance =
    velocities.reduce((sum, v) => sum + (v - avgVelocity) ** 2, 0) / velocities.length;
  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;

  const syncopationScore = computeSyncopation(onsets, ticksPerBeat, ticksPerBar);

  return {
    onsets,
    durations,
    velocities,
    density,
    syncopation_score: syncopationScore,
    avg_velocity: avgVelocity,
    velocity_variance: velocityVariance,
    avg_duration: avgDuration,
    num_bars: numBars,
    ticks_per_bar: ticksPerBar,
    ticks_per_beat: ticksPerBeat,
  };
}

/**
 * Convert a ChordMatch from the detection engine into a serializable DetectedChord.
 */
export function toDetectedChord(match: ChordMatch | null): DetectedChord | null {
  if (!match) return null;
  return {
    root: match.root,
    rootName: match.rootName,
    qualityKey: match.quality.key,
    symbol: match.symbol,
    qualityName: match.quality.fullName,
    observedPcs: match.observedPcs,
    templatePcs: match.templatePcs,
    extras: match.extras,
    missing: match.missing,
    bassPc: match.bassPc,
    bassName: match.bassName,
  };
}

/**
 * Extract the harmonic layer from a set of notes, including chord detection.
 *
 * @param notes       The note array
 * @param gesture     Optional gesture (needed for bar-level segmentation)
 */
export function extractHarmonic(notes: Note[], gesture?: Gesture): Harmonic {
  const pitches = notes.map(n => n.midi);
  const pitchClasses = pitches.map(p => p % 12);

  // Overall chord detection
  const overallMatch = detectOverallChord(pitches);
  const detectedChord = toDetectedChord(overallMatch);

  // Per-bar chord detection (if gesture info available)
  let barChords: BarChordInfo[] | undefined;
  if (gesture && gesture.num_bars > 0) {
    const barMatches = detectChordsPerBar(
      pitches,
      gesture.onsets,
      gesture.ticks_per_bar,
      gesture.num_bars,
      gesture.durations,
    );
    barChords = barMatches.map(bm => ({
      bar: bm.bar,
      chord: toDetectedChord(bm.chord),
      pitchClasses: bm.pitchClasses,
    }));
  }

  return { pitches, pitchClasses, detectedChord, barChords };
}

/**
 * Return effective per-bar chords for a clip.
 *
 * When a leadsheet is present (e.g. from Apple Loop Sequ data), the leadsheet
 * is authoritative for chord identity — especially important for melodic/
 * monophonic loops where MIDI note detection produces phantom union-chords.
 * The MIDI-detected pitchClasses are preserved (for piano-roll highlighting);
 * only the chord symbol is overridden from the leadsheet.
 *
 * Falls back to harmonic.barChords as-is when no leadsheet is available,
 * which is the correct behaviour for regular chord/pad loops.
 */
export function getEffectiveBarChords(clip: Clip): BarChordInfo[] | undefined {
  const raw = clip.harmonic.barChords;
  if (!raw || !clip.leadsheet || clip.leadsheet.bars.length === 0) return raw;

  const leadsheetBarMap = new Map(clip.leadsheet.bars.map(lb => [lb.bar, lb]));

  // Chord resonance: once a chord is established it carries forward until the
  // next explicit chord or an explicit NC marker.
  let prevLeadsheetChord: DetectedChord | null = null;

  return raw.map(bc => {
    const lb = leadsheetBarMap.get(bc.bar);

    // No leadsheet entry, or auto-filled repeat bar → carry previous chord forward.
    if (!lb || lb.isRepeat || lb.chords.length === 0) {
      return prevLeadsheetChord !== null
        ? { ...bc, chord: prevLeadsheetChord }
        : bc; // no chord seen yet — leave MIDI detection untouched
    }

    const firstChord = lb.chords[0]!;

    // Explicit NC: honour it (null chord), reset resonance.
    if (!firstChord.chord) {
      prevLeadsheetChord = null;
      return { ...bc, chord: null };
    }

    // Real chord: update resonance state and override.
    prevLeadsheetChord = firstChord.chord;
    return { ...bc, chord: firstChord.chord };
  });
}
