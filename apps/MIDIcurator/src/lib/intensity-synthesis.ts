/**
 * VP Virtual Pianist — intensity synthesis.
 *
 * Bidirectional: synthesize lower-intensity variants (note removal + velocity
 * rescaling) or higher-intensity variants (note addition + velocity rescaling)
 * from any source intensity level.
 */

import type { Gesture, Harmonic, DetectedChord, BarChordInfo } from '../types/clip';
import type { TransformResult } from '../types/transform';
import { computeSyncopation } from './gesture';
import { detectOverallChord, detectChordsPerBar, type ChordMatch } from './chord-detect';

// ---------------------------------------------------------------------------
// General intensity presets (work for any clip, not just VP)
// ---------------------------------------------------------------------------

/**
 * A ratio-based intensity preset.
 * `noteRatio` < 1 → fewer notes (reduce); > 1 → more notes (amplify).
 * `velRatio`  is derived from the VP dataset: velocity changes gently
 * while note count changes more dramatically.
 */
export interface IntensityPreset {
  /** Short display label, e.g. "×½" */
  label: string;
  noteRatio: number;
  velRatio: number;
}

// VP-derived slope: vel_ratio ≈ 1 − (1 − note_ratio) × VP_VEL_SLOPE
const VP_VEL_SLOPE = 0.15;
const velFor = (r: number) => 1 - (1 - r) * VP_VEL_SLOPE;

export const INTENSITY_PRESETS: readonly IntensityPreset[] = [
  { label: '×¼',  noteRatio: 0.25, velRatio: velFor(0.25) },
  { label: '×½',  noteRatio: 0.50, velRatio: velFor(0.50) },
  { label: '×¾',  noteRatio: 0.75, velRatio: velFor(0.75) },
  { label: '×1½', noteRatio: 1.50, velRatio: velFor(1.50) },
];

// ---------------------------------------------------------------------------
// Public stats helper (used by the comparison table in VpIntensityControls)
// ---------------------------------------------------------------------------

export interface IntensityStats {
  noteCount: number;
  velMean: number;
  /** Unique-onset slots per bar, quantised to 8th-note grid */
  onsetDensity: number;
  pitchRange: number;
}

export function computeIntensityStats(gesture: Gesture, harmonic: Harmonic): IntensityStats {
  const { onsets, velocities, num_bars, ticks_per_beat } = gesture;
  const { pitches } = harmonic;

  const eighth = ticks_per_beat / 2;
  const uniqueOnsets = new Set(onsets.map(o => Math.round(o / eighth)));
  const onsetDensity = num_bars > 0 ? uniqueOnsets.size / num_bars : 0;

  const velMean = velocities.length
    ? velocities.reduce((a, b) => a + b, 0) / velocities.length
    : 0;

  const pitchRange =
    pitches.length ? Math.max(...pitches) - Math.min(...pitches) : 0;

  return {
    noteCount: onsets.length,
    velMean: Math.round(velMean * 10) / 10,
    onsetDensity: Math.round(onsetDensity * 100) / 100,
    pitchRange,
  };
}

// ---------------------------------------------------------------------------
// Fallback ratios (from vp-intensity-analysis aggregate)
// Used when the sibling at target intensity is not in the DB.
// note_ratio / vel_ratio are relative to intensity-10 baseline.
// ---------------------------------------------------------------------------

const FALLBACK_RATIOS: Record<string, { noteRatio: number; velRatio: number }> = {
  '1':  { noteRatio: 0.28, velRatio: 0.87 },
  '3':  { noteRatio: 0.37, velRatio: 0.90 },
  '5':  { noteRatio: 0.46, velRatio: 0.93 },
  '6':  { noteRatio: 0.53, velRatio: 0.99 },  // 5→6 is mostly velocity
  '8':  { noteRatio: 0.66, velRatio: 0.95 },
  '10': { noteRatio: 1.00, velRatio: 1.00 },
};

export function fallbackTargets(
  sourceNoteCount: number,
  sourceVelMean: number,
  sourceIntensity: string,
  targetIntensity: string,
): { targetNoteCount: number; targetVelMean: number } {
  // All ratios are relative to the intensity-10 baseline, so we compute the
  // source→target ratio as target_ratio / source_ratio.
  // Strip '-synth' suffix so synthesized clips resolve to the same bucket.
  const srcKey = sourceIntensity.replace(/-synth$/, '');
  const tgtKey = targetIntensity.replace(/-synth$/, '');
  const srcR = FALLBACK_RATIOS[srcKey] ?? { noteRatio: 1.0, velRatio: 1.0 };
  const tgtR = FALLBACK_RATIOS[tgtKey] ?? { noteRatio: 0.5, velRatio: 0.9 };
  return {
    targetNoteCount: Math.max(1, Math.round(sourceNoteCount * (tgtR.noteRatio / srcR.noteRatio))),
    targetVelMean:   Math.round(sourceVelMean   * (tgtR.velRatio  / srcR.velRatio)),
  };
}

// ---------------------------------------------------------------------------
// Per-note scoring (shared by both synthesis directions)
// ---------------------------------------------------------------------------

/**
 * How metrically weak is this onset? (0 = strong downbeat, 1 = weakest subdivision)
 */
function noteMetricWeakness(onset: number, tpb: number, tpBar: number): number {
  const posInBar = ((onset % tpBar) + tpBar) % tpBar;
  const posInBeat = posInBar % tpb;

  if (posInBeat === 0) {
    const beatNum = Math.floor(posInBar / tpb);
    return beatNum === 0 ? 0 : 0.25;        // downbeat=0, other beats=0.25
  }
  // Off-beat: linear ramp 0.25→1.0 within the beat
  return 0.25 + 0.75 * (posInBeat / tpb);
}

/**
 * How extreme is this pitch relative to the observed range? (0 = centre, 1 = edge)
 */
function pitchExtremenessScore(pitch: number, pitchMin: number, pitchMax: number): number {
  if (pitchMax === pitchMin) return 0;
  const centre = (pitchMin + pitchMax) / 2;
  return Math.min(1, Math.abs(pitch - centre) / ((pitchMax - pitchMin) / 2));
}

/**
 * Combined removability score. Higher score → remove first (or add last when going up).
 *
 * Going down: sort descending, remove first.
 * Going up:   sort ascending, add first — so the most "structural" candidates
 *             (lowest removal score) are inserted before the weak fills.
 */
function removalScore(
  onset: number,
  velocity: number,
  pitch: number,
  pitchMin: number,
  pitchMax: number,
  tpb: number,
  tpBar: number,
  onsetSurplus: boolean,   // true when this onset already has 3+ simultaneous notes
): number {
  const mw  = noteMetricWeakness(onset, tpb, tpBar);
  const vi  = 1 - velocity / 127;
  const pe  = pitchExtremenessScore(pitch, pitchMin, pitchMax);
  const po  = onsetSurplus ? 0.3 : 0;

  return 0.40 * mw + 0.40 * vi + 0.15 * pe + 0.05 * po;
}

// ---------------------------------------------------------------------------
// Shared tail: rebuild gesture + harmonic from final parallel arrays
// ---------------------------------------------------------------------------

function matchToDetectedChord(match: ChordMatch | null): DetectedChord | null {
  if (!match) return null;
  return {
    root:          match.root,
    rootName:      match.rootName,
    qualityKey:    match.quality.key,
    symbol:        match.symbol,
    qualityName:   match.quality.fullName,
    observedPcs:   match.observedPcs,
    templatePcs:   match.templatePcs,
    extras:        match.extras,
    missing:       match.missing,
  };
}

function rebuildFromArrays(
  onsets: number[],
  durations: number[],
  velocities: number[],
  newPitches: number[],
  sourceGesture: Gesture,
  sourceHarmonic: Harmonic,
): TransformResult {
  const { num_bars, ticks_per_bar: tpBar, ticks_per_beat: tpb } = sourceGesture;

  const totalBeats   = num_bars * 4;
  const density      = onsets.length / totalBeats;
  const avgVelocity  = velocities.reduce((a, b) => a + b, 0) / velocities.length;
  const velocityVariance =
    velocities.reduce((sum, v) => sum + (v - avgVelocity) ** 2, 0) / velocities.length;
  const avgDuration  = durations.reduce((a, b) => a + b, 0) / durations.length;

  const newGesture: Gesture = {
    onsets,
    durations,
    velocities,
    density,
    syncopation_score: computeSyncopation(onsets, tpb, tpBar),
    avg_velocity:      avgVelocity,
    velocity_variance: velocityVariance,
    avg_duration:      avgDuration,
    num_bars,
    ticks_per_bar:   tpBar,
    ticks_per_beat:  tpb,
  };

  const overallMatch  = detectOverallChord(newPitches);
  const detectedChord = matchToDetectedChord(overallMatch);

  const barMatches = detectChordsPerBar(newPitches, onsets, tpBar, num_bars, durations);
  const barChords: BarChordInfo[] = barMatches.map((bm, idx) => ({
    bar:          bm.bar,
    chord:        matchToDetectedChord(bm.chord),
    pitchClasses: bm.pitchClasses,
    segments:     sourceHarmonic.barChords?.[idx]?.segments,
  }));

  return {
    gesture: newGesture,
    harmonic: {
      pitches:       newPitches,
      pitchClasses:  newPitches.map(p => p % 12),
      detectedChord,
      barChords,
    },
  };
}

// ---------------------------------------------------------------------------
// Downward synthesis: remove notes + rescale velocity
// ---------------------------------------------------------------------------

/**
 * Produce a lower-intensity version of `gesture`+`harmonic` by removing notes
 * and rescaling velocities.
 *
 * @param targetNoteCount  Desired number of notes in the output.
 * @param targetVelMean    Desired mean velocity; 0 = no rescaling.
 */
export function synthesizeIntensityDown(
  gesture: Gesture,
  harmonic: Harmonic,
  targetNoteCount: number,
  targetVelMean: number,
): TransformResult {
  const { ticks_per_beat: tpb, ticks_per_bar: tpBar } = gesture;
  const n = gesture.onsets.length;
  const pitches = harmonic.pitches;

  // Build per-onset count map for polyphony excess detection
  const ONSET_TOL = 30;
  const onsetBucket = (onset: number) => Math.round(onset / ONSET_TOL) * ONSET_TOL;
  const onsetCount = new Map<number, number>();
  for (const o of gesture.onsets) {
    const b = onsetBucket(o);
    onsetCount.set(b, (onsetCount.get(b) ?? 0) + 1);
  }

  const pitchMin = pitches.length ? Math.min(...pitches) : 0;
  const pitchMax = pitches.length ? Math.max(...pitches) : 0;

  // Score every note
  type IndexedNote = { i: number; score: number };
  const scored: IndexedNote[] = [];
  for (let i = 0; i < n; i++) {
    const onset    = gesture.onsets[i]!;
    const velocity = gesture.velocities[i]!;
    const pitch    = pitches[i]!;
    const surplus  = (onsetCount.get(onsetBucket(onset)) ?? 0) >= 3;
    scored.push({
      i,
      score: removalScore(onset, velocity, pitch, pitchMin, pitchMax, tpb, tpBar, surplus),
    });
  }

  // Sort descending; keep the last keepCount (lowest scores = most structural)
  scored.sort((a, b) => b.score - a.score);

  const keepCount = Math.min(n, Math.max(1, targetNoteCount));
  const keepSet   = new Set(scored.slice(scored.length - keepCount).map(x => x.i));

  let onsets:     number[] = [];
  let durations:  number[] = [];
  let velocities: number[] = [];
  let newPitches: number[] = [];

  for (let i = 0; i < n; i++) {
    if (keepSet.has(i)) {
      onsets.push(gesture.onsets[i]!);
      durations.push(gesture.durations[i]!);
      velocities.push(gesture.velocities[i]!);
      newPitches.push(pitches[i]!);
    }
  }

  // Velocity rescaling (proportional around mean)
  if (targetVelMean > 0 && velocities.length > 0) {
    const currentMean = velocities.reduce((a, b) => a + b, 0) / velocities.length;
    if (currentMean > 0) {
      const scale = targetVelMean / currentMean;
      velocities = velocities.map(v => Math.max(1, Math.min(127, Math.round(v * scale))));
    }
  }

  return rebuildFromArrays(onsets, durations, velocities, newPitches, gesture, harmonic);
}

// ---------------------------------------------------------------------------
// Upward synthesis: add notes + rescale velocity
// ---------------------------------------------------------------------------

/**
 * Produce a higher-intensity version of `gesture`+`harmonic` by adding notes
 * and rescaling velocities.
 *
 * Strategy: generate candidate notes at two levels —
 *   1. Grid fills: 16th-note positions not already occupied (new rhythm positions).
 *   2. Polyphony doublings: octave copies at existing onsets (thickens texture).
 *   3. Interval doublings: 5th copies at existing onsets (fallback if still short).
 *
 * Candidates are scored with the same `removalScore` function as the downward
 * path, but sorted ascending — we insert the "most structural" (lowest removal
 * score) candidates first, leaving the weakest fills for the largest jumps.
 *
 * @param targetNoteCount  Desired number of notes in the output.
 * @param targetVelMean    Desired mean velocity; 0 = no rescaling.
 */
export function synthesizeIntensityUp(
  gesture: Gesture,
  harmonic: Harmonic,
  targetNoteCount: number,
  targetVelMean: number,
): TransformResult {
  const { ticks_per_beat: tpb, ticks_per_bar: tpBar, num_bars } = gesture;
  const n = gesture.onsets.length;
  const pitches = harmonic.pitches;

  const pitchMin = pitches.length ? Math.min(...pitches) : 60;
  const pitchMax = pitches.length ? Math.max(...pitches) : 72;
  const centre   = (pitchMin + pitchMax) / 2;

  const meanVel = gesture.velocities.length
    ? gesture.velocities.reduce((a, b) => a + b, 0) / gesture.velocities.length
    : 80;
  const meanDur = gesture.durations.length
    ? gesture.durations.reduce((a, b) => a + b, 0) / gesture.durations.length
    : tpb / 2;

  const toAdd = Math.max(0, targetNoteCount - n);

  // If already at or above target, velocity-only path
  if (toAdd === 0) {
    let velocities = [...gesture.velocities];
    if (targetVelMean > 0 && velocities.length > 0) {
      const currentMean = velocities.reduce((a, b) => a + b, 0) / velocities.length;
      if (currentMean > 0) {
        const scale = targetVelMean / currentMean;
        velocities = velocities.map(v => Math.max(1, Math.min(127, Math.round(v * scale))));
      }
    }
    return rebuildFromArrays(
      [...gesture.onsets], [...gesture.durations], velocities, [...pitches],
      gesture, harmonic,
    );
  }

  // Build per-onset count map
  const ONSET_TOL = 30;
  const onsetBucket = (o: number) => Math.round(o / ONSET_TOL) * ONSET_TOL;
  const onsetCount = new Map<number, number>();
  for (const o of gesture.onsets) {
    const b = onsetBucket(o);
    onsetCount.set(b, (onsetCount.get(b) ?? 0) + 1);
  }

  type Candidate = {
    onset: number; pitch: number; duration: number; velocity: number; score: number;
  };
  const candidates: Candidate[] = [];

  // --- 1. Grid fill candidates: 16th-note positions not already occupied ---
  const gridStep = Math.max(1, Math.round(tpb / 4));
  for (let tick = 0; tick < num_bars * tpBar; tick += gridStep) {
    if (onsetCount.has(onsetBucket(tick))) continue;

    // Pitch: nearest existing note by time
    let nearestPitch = pitches[0] ?? 60;
    let minDist = Infinity;
    for (let i = 0; i < n; i++) {
      const d = Math.abs(gesture.onsets[i]! - tick);
      if (d < minDist) { minDist = d; nearestPitch = pitches[i]!; }
    }

    const vel = Math.max(1, Math.round(meanVel * 0.82));
    const dur = Math.max(1, Math.round(meanDur * 0.8));
    candidates.push({
      onset: tick, pitch: nearestPitch, duration: dur, velocity: vel,
      score: removalScore(tick, vel, nearestPitch, pitchMin, pitchMax, tpb, tpBar, false),
    });
  }

  // --- 2. Polyphony doublings: octave copies at existing onsets ---
  for (let i = 0; i < n; i++) {
    const onset    = gesture.onsets[i]!;
    const pitch    = pitches[i]!;
    const velocity = gesture.velocities[i]!;
    const duration = gesture.durations[i]!;
    const bkt      = onsetBucket(onset);
    const existing = onsetCount.get(bkt) ?? 1;
    if (existing >= 4) continue;

    // If above centre, add octave below; if below, add octave above
    const double = pitch > centre ? pitch - 12 : pitch + 12;
    if (double < 21 || double > 108) continue;

    const vel = Math.max(1, Math.round(velocity * 0.88));
    candidates.push({
      onset, pitch: double, duration, velocity: vel,
      score: removalScore(onset, vel, double, pitchMin, pitchMax, tpb, tpBar, existing >= 3),
    });
  }

  // --- 3. Interval doublings: 5th copies, only if still short ---
  if (candidates.length < toAdd) {
    for (let i = 0; i < n; i++) {
      const onset    = gesture.onsets[i]!;
      const pitch    = pitches[i]!;
      const velocity = gesture.velocities[i]!;
      const duration = gesture.durations[i]!;
      const bkt      = onsetBucket(onset);
      const existing = onsetCount.get(bkt) ?? 1;
      if (existing >= 5) continue;

      const fifth = pitch + 12 > pitchMax ? pitch - 7 : pitch + 7;
      if (fifth < 21 || fifth > 108) continue;

      const vel = Math.max(1, Math.round(velocity * 0.85));
      candidates.push({
        onset, pitch: fifth, duration, velocity: vel,
        score: removalScore(onset, vel, fifth, pitchMin, pitchMax, tpb, tpBar, existing >= 3),
      });
    }
  }

  // Sort ascending: add most "structural" (lowest removal score) candidates first
  candidates.sort((a, b) => a.score - b.score);
  const toInsert = candidates.slice(0, toAdd);

  // Merge with existing notes, sort by onset then pitch
  const merged = [
    ...gesture.onsets.map((onset, i) => ({
      onset, duration: gesture.durations[i]!, velocity: gesture.velocities[i]!, pitch: pitches[i]!,
    })),
    ...toInsert,
  ].sort((a, b) => a.onset - b.onset || a.pitch - b.pitch);

  let onsets     = merged.map(x => x.onset);
  let durations  = merged.map(x => x.duration);
  let velocities = merged.map(x => x.velocity);
  let newPitches = merged.map(x => x.pitch);

  // Velocity rescaling
  if (targetVelMean > 0 && velocities.length > 0) {
    const currentMean = velocities.reduce((a, b) => a + b, 0) / velocities.length;
    if (currentMean > 0) {
      const scale = targetVelMean / currentMean;
      velocities = velocities.map(v => Math.max(1, Math.min(127, Math.round(v * scale))));
    }
  }

  return rebuildFromArrays(onsets, durations, velocities, newPitches, gesture, harmonic);
}
