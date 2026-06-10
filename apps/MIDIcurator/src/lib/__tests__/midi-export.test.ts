import { describe, it, expect } from 'vitest';
import { encodeVariableLength, createMIDI } from '../midi-export';
import type { Gesture, Harmonic } from '../../types/clip';

describe('encodeVariableLength', () => {
  it('encodes 0', () => {
    expect(encodeVariableLength(0)).toEqual([0x00]);
  });

  it('encodes single-byte values (< 128)', () => {
    expect(encodeVariableLength(127)).toEqual([0x7F]);
    expect(encodeVariableLength(60)).toEqual([60]);
  });

  it('encodes two-byte values', () => {
    // 128 = 0x80 → variable length: [0x81, 0x00]
    expect(encodeVariableLength(128)).toEqual([0x81, 0x00]);
    // 480 = 0x01E0 → variable length: [0x83, 0x60]
    expect(encodeVariableLength(480)).toEqual([0x83, 0x60]);
  });
});

describe('createMIDI', () => {
  it('produces valid MIDI file with MThd header', () => {
    const gesture: Gesture = {
      onsets: [0, 480],
      durations: [240, 240],
      velocities: [80, 90],
      density: 0.5,
      syncopation_score: 0,
      avg_velocity: 85,
      velocity_variance: 25,
      avg_duration: 240,
      num_bars: 1,
      ticks_per_bar: 1920,
      ticks_per_beat: 480,
    };
    const harmonic: Harmonic = {
      pitches: [60, 64],
      pitchClasses: [0, 4],
    };

    const midi = createMIDI(gesture, harmonic, 120);
    // MThd signature
    expect(String.fromCharCode(midi[0]!, midi[1]!, midi[2]!, midi[3]!)).toBe('MThd');
    // MTrk follows header (offset 14)
    expect(String.fromCharCode(midi[14]!, midi[15]!, midi[16]!, midi[17]!)).toBe('MTrk');
  });

  it('preserves ticks per beat in header', () => {
    const gesture: Gesture = {
      onsets: [0],
      durations: [100],
      velocities: [80],
      density: 1,
      syncopation_score: 0,
      avg_velocity: 80,
      velocity_variance: 0,
      avg_duration: 100,
      num_bars: 1,
      ticks_per_bar: 384,
      ticks_per_beat: 96,
    };
    const harmonic: Harmonic = { pitches: [60], pitchClasses: [0] };
    const midi = createMIDI(gesture, harmonic, 120);

    // Ticks per beat at bytes 12-13
    const tpb = (midi[12]! << 8) | midi[13]!;
    expect(tpb).toBe(96);
  });
});
