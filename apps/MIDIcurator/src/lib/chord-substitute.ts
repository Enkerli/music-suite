/**
 * Chord Substitution — transforms note pitches to match a new chord.
 *
 * Two strategies are provided:
 *
 * 1. `substituteSegmentPitches` / `mapToClosestChordTone` — nearest-chord-tone
 *    snap.  Fast, works for manual in-bar substitutions.
 *
 * 2. `realizeForChord` / `realizeForChordTransform` — degree-preserving
 *    realization.  Maps each note's root-relative interval to the nearest
 *    available interval in the target chord, then places the result in the
 *    octave closest to the original pitch.  Roots stay roots, fifths stay
 *    fifths — the function of each note is preserved.
 */

import type { Gesture, Harmonic, BarChordInfo, DetectedChord } from '../types/clip';
import type { TransformResult } from '../types/transform';
import { toDetectedChord } from './gesture';
import { detectOverallChord, detectChordsPerBar } from './chord-detect';
import { getAllQualities } from './chord-dictionary';

/**
 * Get the pitch classes that make up a chord.
 * E.g., G- (G minor) returns [7, 10, 2] (G, Bb, D)
 *
 * @param chord The chord to extract pitch classes from
 * @returns Array of pitch classes (0-11)
 */
export function getChordPitchClasses(chord: DetectedChord): number[] {
  // Find the quality in the dictionary to get its PCS
  const quality = getAllQualities().find(q => q.key === chord.qualityKey);
  if (!quality) {
    // Fallback: just return the root
    return [chord.root];
  }

  // quality.pcs is rooted at 0 (e.g., [0,3,7] for minor)
  // Add chord.root to get actual pitch classes
  return quality.pcs.map(pc => (pc + chord.root) % 12);
}

/**
 * Find the closest pitch in targetPcs to the given pitch,
 * staying within the same octave or ±1 octave.
 *
 * @param pitch The original MIDI pitch (0-127)
 * @param targetPcs Array of target pitch classes (0-11)
 * @returns The closest MIDI pitch that is a chord tone
 */
export function mapToClosestChordTone(
  pitch: number,
  targetPcs: number[]
): number {
  if (targetPcs.length === 0) return pitch;

  const octave = Math.floor(pitch / 12);

  // Generate candidate pitches in nearby octaves
  const candidates: number[] = [];
  for (let oct = octave - 1; oct <= octave + 1; oct++) {
    if (oct < 0) continue;
    for (const pc of targetPcs) {
      const candidate = oct * 12 + pc;
      if (candidate >= 0 && candidate <= 127) {
        candidates.push(candidate);
      }
    }
  }

  if (candidates.length === 0) return pitch;

  // Find closest
  let closest = candidates[0]!;
  let minDist = Math.abs(pitch - closest);
  for (const c of candidates) {
    const dist = Math.abs(pitch - c);
    if (dist < minDist) {
      minDist = dist;
      closest = c;
    }
  }

  return closest;
}

/**
 * Substitute pitches in a time range to match a new chord.
 * Only affects notes whose onset falls within [segStartTick, segEndTick).
 *
 * @param pitches Array of MIDI pitches (parallel with onsets)
 * @param onsets Array of onset times in ticks
 * @param segStartTick Start of the segment (absolute tick)
 * @param segEndTick End of the segment (absolute tick)
 * @param newChord The target chord to map notes to
 * @returns New pitches array with substitutions applied
 */
export function substituteSegmentPitches(
  pitches: number[],
  onsets: number[],
  segStartTick: number,
  segEndTick: number,
  newChord: DetectedChord
): number[] {
  const targetPcs = getChordPitchClasses(newChord);

  return pitches.map((pitch, i) => {
    const onset = onsets[i]!;
    // Only transform notes that start in this segment
    if (onset >= segStartTick && onset < segEndTick) {
      return mapToClosestChordTone(pitch, targetPcs);
    }
    return pitch; // Keep unchanged
  });
}

/**
 * Substitute all pitches in a clip to match a new chord.
 * Useful for whole-clip transposition/reharmonization.
 *
 * @param pitches Array of MIDI pitches
 * @param newChord The target chord to map notes to
 * @returns New pitches array with all notes mapped to chord tones
 */
export function substituteAllPitches(
  pitches: number[],
  newChord: DetectedChord
): number[] {
  const targetPcs = getChordPitchClasses(newChord);
  return pitches.map(pitch => mapToClosestChordTone(pitch, targetPcs));
}

// ---------------------------------------------------------------------------
// Degree-preserving chord realization
// ---------------------------------------------------------------------------

/**
 * Find the interval in `intervals` (root-relative, 0–11) nearest to `degree`
 * by circular (mod-12) distance.
 */
function nearestInterval(degree: number, intervals: number[]): number {
  let best = intervals[0]!;
  let bestDist = Infinity;
  for (const iv of intervals) {
    const d = Math.min(Math.abs(iv - degree), 12 - Math.abs(iv - degree));
    if (d < bestDist) { bestDist = d; best = iv; }
  }
  return best;
}

/**
 * Remap pitches from a source chord to a target chord using degree mapping.
 *
 * For each pitch:
 *   1. Compute the note's interval relative to `sourceRootPc` (0–11).
 *   2. Find the nearest interval in `targetIntervals` by circular distance.
 *   3. Place the resulting pitch class in the octave closest to the original.
 *
 * This preserves note function: roots stay roots, fifths stay fifths.
 * For chord-quality changes (e.g. C7 → Cm7), only the affected intervals
 * (the 3rd here) change; everything else is identical.
 *
 * @param pitches          MIDI pitches to transform
 * @param sourceRootPc     Root pitch class of the source chord (0–11)
 * @param targetRootPc     Root pitch class of the target chord (0–11)
 * @param targetIntervals  Root-relative intervals of the target chord, e.g. [0,4,7,10]
 */
export function realizeForChord(
  pitches: number[],
  sourceRootPc: number,
  targetRootPc: number,
  targetIntervals: number[],
): number[] {
  if (pitches.length === 0 || targetIntervals.length === 0) return pitches.slice();

  return pitches.map(pitch => {
    const degree = ((pitch - sourceRootPc) % 12 + 12) % 12;
    const targetInterval = nearestInterval(degree, targetIntervals);
    const targetPc = (targetRootPc + targetInterval) % 12;

    // Place targetPc in the octave closest to the original pitch
    const octave = Math.floor(pitch / 12);
    const candidates = [
      (octave - 1) * 12 + targetPc,
      octave * 12 + targetPc,
      (octave + 1) * 12 + targetPc,
    ].filter(c => c >= 0 && c <= 127);

    return candidates.reduce(
      (best, c) => Math.abs(c - pitch) < Math.abs(best - pitch) ? c : best,
      candidates[0] ?? pitch,
    );
  });
}

/**
 * Realize a full clip's gesture over a target chord.
 *
 * Timing and velocity are preserved intact — only pitches are remapped.
 * Chord detection is re-run on the new pitches to update `harmonic`.
 *
 * @param gesture          Source gesture
 * @param harmonic         Source harmonic (provides pitches + per-bar segments)
 * @param sourceRootPc     Root PC of the source chord
 * @param targetRootPc     Root PC of the target chord
 * @param targetIntervals  Root-relative intervals of the target chord
 */
export function realizeForChordTransform(
  gesture: Gesture,
  harmonic: Harmonic,
  sourceRootPc: number,
  targetRootPc: number,
  targetIntervals: number[],
): TransformResult {
  const newPitches = realizeForChord(
    harmonic.pitches, sourceRootPc, targetRootPc, targetIntervals,
  );

  const { onsets, durations, num_bars, ticks_per_bar: tpBar } = gesture;

  const overallMatch = detectOverallChord(newPitches);
  const detectedChord = toDetectedChord(overallMatch);

  const barMatches = detectChordsPerBar(newPitches, onsets, tpBar, num_bars, durations);
  const barChords: BarChordInfo[] = barMatches.map((bm, idx) => ({
    bar:          bm.bar,
    chord:        toDetectedChord(bm.chord),
    pitchClasses: bm.pitchClasses,
    segments:     harmonic.barChords?.[idx]?.segments,
  }));

  // Gesture timing + velocity stats are unchanged — only the harmonic changes.
  return {
    gesture,
    harmonic: {
      pitches:      newPitches,
      pitchClasses: newPitches.map(p => p % 12),
      detectedChord,
      barChords,
    },
  };
}
