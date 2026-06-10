import type { Gesture, Harmonic, DetectedChord, BarChordInfo } from '../types/clip';
import type { TransformParams, TransformResult } from '../types/transform';
import { computeSyncopation } from './gesture';
import { detectOverallChord, detectChordsPerBar, type ChordMatch } from './chord-detect';

export function transformGesture(
  gesture: Gesture,
  harmonic: Harmonic,
  params: TransformParams = {},
): TransformResult {
  let onsets = [...gesture.onsets];
  let durations = [...gesture.durations];
  let velocities = [...gesture.velocities];
  let pitches = [...harmonic.pitches];

  // Density adjustment
  if (params.densityMultiplier && params.densityMultiplier !== 1.0) {
    const targetCount = Math.round(onsets.length * params.densityMultiplier);

    if (targetCount < onsets.length) {
      // Remove notes (keep highest velocity)
      const indices = onsets
        .map((_onset, i) => ({ i, vel: velocities[i]! }))
        .sort((a, b) => b.vel - a.vel)
        .slice(0, targetCount)
        .map(item => item.i)
        .sort((a, b) => a - b);

      onsets = indices.map(i => onsets[i]!);
      durations = indices.map(i => durations[i]!);
      velocities = indices.map(i => velocities[i]!);
      pitches = indices.map(i => pitches[i]!);
    } else if (targetCount > onsets.length) {
      // Add notes (interpolate)
      const toAdd = targetCount - onsets.length;
      for (let n = 0; n < toAdd; n++) {
        const i = Math.floor(Math.random() * (onsets.length - 1));
        const newOnset = Math.round((onsets[i]! + onsets[i + 1]!) / 2);
        const newDur = Math.round((durations[i]! + durations[i + 1]!) / 2);
        const newVel = Math.round((velocities[i]! + velocities[i + 1]!) / 2);
        const newPitch = pitches[i]!;

        onsets.push(newOnset);
        durations.push(newDur);
        velocities.push(newVel);
        pitches.push(newPitch);
      }

      // Re-sort
      const combined = onsets
        .map((onset, i) => ({
          onset,
          duration: durations[i]!,
          velocity: velocities[i]!,
          pitch: pitches[i]!,
        }))
        .sort((a, b) => a.onset - b.onset);

      onsets = combined.map(n => n.onset);
      durations = combined.map(n => n.duration);
      velocities = combined.map(n => n.velocity);
      pitches = combined.map(n => n.pitch);
    }
  }

  // Quantize
  if (params.quantizeStrength) {
    const ticksPerSixteenth = gesture.ticks_per_bar / 16;
    onsets = onsets.map(onset => {
      const quantized = Math.round(onset / ticksPerSixteenth) * ticksPerSixteenth;
      return Math.round(onset + (quantized - onset) * params.quantizeStrength!);
    });
  }

  // Velocity scaling
  if (params.velocityScale && params.velocityScale !== 1.0) {
    const avg = velocities.reduce((a, b) => a + b) / velocities.length;
    velocities = velocities.map(v => {
      const offset = v - avg;
      return Math.max(1, Math.min(127, avg + offset * params.velocityScale!));
    });
  }

  // Recompute features
  const totalBeats = gesture.num_bars * 4;
  const density = onsets.length / totalBeats;
  const avgVelocity = velocities.reduce((a, b) => a + b) / velocities.length;
  const velocityVariance =
    velocities.reduce((sum, v) => sum + (v - avgVelocity) ** 2, 0) / velocities.length;
  const avgDuration = durations.reduce((a, b) => a + b) / durations.length;

  const newGesture: Gesture = {
    onsets,
    durations,
    velocities,
    density,
    syncopation_score: computeSyncopation(onsets, gesture.ticks_per_bar / 4, gesture.ticks_per_bar),
    avg_velocity: avgVelocity,
    velocity_variance: velocityVariance,
    avg_duration: avgDuration,
    num_bars: gesture.num_bars,
    ticks_per_bar: gesture.ticks_per_bar,
    ticks_per_beat: gesture.ticks_per_beat,
  };

  // Chord detection on the transformed result
  const overallMatch = detectOverallChord(pitches);
  const detectedChord = matchToDetectedChord(overallMatch);

  const barMatches = detectChordsPerBar(
    pitches,
    onsets,
    newGesture.ticks_per_bar,
    newGesture.num_bars,
    durations,
  );
  const barChords: BarChordInfo[] = barMatches.map((bm, i) => {
    // Preserve segments from source if bar index matches (manual overrides)
    const sourceBarChord = harmonic.barChords?.[i];
    return {
      bar: bm.bar,
      chord: matchToDetectedChord(bm.chord),
      pitchClasses: bm.pitchClasses,
      segments: sourceBarChord?.segments,
    };
  });

  const newHarmonic: Harmonic = {
    pitches,
    pitchClasses: pitches.map(p => p % 12),
    detectedChord,
    barChords,
  };

  return { gesture: newGesture, harmonic: newHarmonic };
}

function matchToDetectedChord(match: ChordMatch | null): DetectedChord | null {
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
  };
}
