import { describe, it, expect } from 'vitest';
import { transformGesture } from '../transform';
import type { Gesture, Harmonic } from '../../types/clip';

function makeFixture(noteCount: number): { gesture: Gesture; harmonic: Harmonic } {
  const ticksPerBeat = 480;
  const ticksPerBar = ticksPerBeat * 4;
  const spacing = ticksPerBeat; // Quarter notes

  return {
    gesture: {
      onsets: Array.from({ length: noteCount }, (_, i) => i * spacing),
      durations: Array.from({ length: noteCount }, () => spacing / 2),
      velocities: Array.from({ length: noteCount }, (_, i) => 60 + i * 5),
      density: noteCount / 4, // notes per beat over 1 bar
      syncopation_score: 0,
      avg_velocity: 60 + (noteCount - 1) * 2.5,
      velocity_variance: 0,
      avg_duration: spacing / 2,
      num_bars: Math.ceil((noteCount * spacing) / ticksPerBar),
      ticks_per_bar: ticksPerBar,
      ticks_per_beat: ticksPerBeat,
    },
    harmonic: {
      pitches: Array.from({ length: noteCount }, (_, i) => 60 + (i % 4)),
      pitchClasses: Array.from({ length: noteCount }, (_, i) => (i % 4)),
    },
  };
}

describe('transformGesture', () => {
  it('returns unchanged data with default params', () => {
    const { gesture, harmonic } = makeFixture(8);
    const result = transformGesture(gesture, harmonic);
    expect(result.gesture.onsets).toEqual(gesture.onsets);
    expect(result.harmonic.pitches).toEqual(harmonic.pitches);
  });

  it('reduces note count with density < 1', () => {
    const { gesture, harmonic } = makeFixture(8);
    const result = transformGesture(gesture, harmonic, { densityMultiplier: 0.5 });
    expect(result.gesture.onsets.length).toBe(4);
    expect(result.harmonic.pitches.length).toBe(4);
  });

  it('increases note count with density > 1', () => {
    const { gesture, harmonic } = makeFixture(8);
    const result = transformGesture(gesture, harmonic, { densityMultiplier: 1.5 });
    expect(result.gesture.onsets.length).toBe(12);
    expect(result.harmonic.pitches.length).toBe(12);
  });

  it('keeps gesture and harmonic arrays in sync', () => {
    const { gesture, harmonic } = makeFixture(8);
    const result = transformGesture(gesture, harmonic, { densityMultiplier: 0.75 });
    expect(result.gesture.onsets.length).toBe(result.harmonic.pitches.length);
    expect(result.gesture.durations.length).toBe(result.harmonic.pitches.length);
    expect(result.gesture.velocities.length).toBe(result.harmonic.pitches.length);
  });

  it('preserves ticks_per_beat through transform', () => {
    const { gesture, harmonic } = makeFixture(8);
    const result = transformGesture(gesture, harmonic, { densityMultiplier: 1.25 });
    expect(result.gesture.ticks_per_beat).toBe(480);
  });

  it('quantizes onsets toward grid', () => {
    const gesture: Gesture = {
      onsets: [10, 250, 490, 730],    // slightly off-grid quarter notes
      durations: [200, 200, 200, 200],
      velocities: [80, 80, 80, 80],
      density: 1,
      syncopation_score: 0,
      avg_velocity: 80,
      velocity_variance: 0,
      avg_duration: 200,
      num_bars: 1,
      ticks_per_bar: 1920,
      ticks_per_beat: 480,
    };
    const harmonic: Harmonic = {
      pitches: [60, 64, 67, 72],
      pitchClasses: [0, 4, 7, 0],
    };

    const result = transformGesture(gesture, harmonic, { quantizeStrength: 1.0 });
    // Full quantize to 16th grid (1920/16 = 120)
    for (const onset of result.gesture.onsets) {
      expect(onset % 120).toBe(0);
    }
  });
});
