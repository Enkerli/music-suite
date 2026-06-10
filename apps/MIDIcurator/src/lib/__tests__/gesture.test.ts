import { describe, it, expect } from 'vitest';
import { computeSyncopation, extractGesture, extractHarmonic } from '../gesture';
import type { Note } from '../../types/clip';

describe('computeSyncopation', () => {
  it('returns 0 for notes on the downbeat', () => {
    const onsets = [0, 480, 960, 1440]; // Every beat in 4/4 at 480 tpb
    expect(computeSyncopation(onsets, 480, 1920)).toBe(0.3 * 3 / 4);
    // Beat 0 = 0, beats 1-3 = 0.3 each → (0 + 0.3 + 0.3 + 0.3) / 4
  });

  it('returns 0 for empty onsets', () => {
    expect(computeSyncopation([], 480, 1920)).toBe(0);
  });

  it('scores off-beat notes higher', () => {
    const onBeat = [0, 480, 960, 1440];
    const offBeat = [240, 720, 1200, 1680]; // Every eighth note off-beat
    const onBeatScore = computeSyncopation(onBeat, 480, 1920);
    const offBeatScore = computeSyncopation(offBeat, 480, 1920);
    expect(offBeatScore).toBeGreaterThan(onBeatScore);
  });
});

describe('extractGesture', () => {
  const makeNotes = (count: number, spacing: number): Note[] =>
    Array.from({ length: count }, (_, i) => ({
      midi: 60 + i,
      ticks: i * spacing,
      durationTicks: spacing / 2,
      velocity: 80 + i,
    }));

  it('computes density as notes per beat', () => {
    // 4 notes across 1 bar of 4/4 at 96 tpb = 1 note per beat
    const notes = makeNotes(4, 96);
    const gesture = extractGesture(notes, 96);
    expect(gesture.density).toBe(1);
  });

  it('preserves ticks_per_beat from input', () => {
    const notes = makeNotes(4, 96);
    const gesture = extractGesture(notes, 96);
    expect(gesture.ticks_per_beat).toBe(96);
  });

  it('captures all onsets', () => {
    const notes = makeNotes(8, 120);
    const gesture = extractGesture(notes, 480);
    expect(gesture.onsets).toHaveLength(8);
    expect(gesture.onsets[0]).toBe(0);
    expect(gesture.onsets[7]).toBe(840);
  });
});

describe('extractHarmonic', () => {
  it('extracts MIDI pitches and pitch classes', () => {
    const notes: Note[] = [
      { midi: 60, ticks: 0, durationTicks: 100, velocity: 80 },
      { midi: 64, ticks: 100, durationTicks: 100, velocity: 80 },
      { midi: 67, ticks: 200, durationTicks: 100, velocity: 80 },
    ];
    const harmonic = extractHarmonic(notes);
    expect(harmonic.pitches).toEqual([60, 64, 67]);
    expect(harmonic.pitchClasses).toEqual([0, 4, 7]); // C major triad
  });

  it('detects overall chord when called without gesture', () => {
    const notes: Note[] = [
      { midi: 60, ticks: 0, durationTicks: 100, velocity: 80 },
      { midi: 64, ticks: 100, durationTicks: 100, velocity: 80 },
      { midi: 67, ticks: 200, durationTicks: 100, velocity: 80 },
    ];
    const harmonic = extractHarmonic(notes);
    expect(harmonic.detectedChord).toBeDefined();
    expect(harmonic.detectedChord!.root).toBe(0);
    expect(harmonic.detectedChord!.symbol).toBe('C');
    expect(harmonic.detectedChord!.qualityKey).toBe('maj');
  });

  it('detects per-bar chords when called with gesture', () => {
    // Bar 0: C major, Bar 1: D minor
    const notes: Note[] = [
      { midi: 60, ticks: 0, durationTicks: 100, velocity: 80 },
      { midi: 64, ticks: 120, durationTicks: 100, velocity: 80 },
      { midi: 67, ticks: 240, durationTicks: 100, velocity: 80 },
      { midi: 62, ticks: 480, durationTicks: 100, velocity: 80 },
      { midi: 65, ticks: 600, durationTicks: 100, velocity: 80 },
      { midi: 69, ticks: 720, durationTicks: 100, velocity: 80 },
    ];
    const gesture = extractGesture(notes, 120); // 120 tpb, 480 tpbar
    const harmonic = extractHarmonic(notes, gesture);
    expect(harmonic.barChords).toBeDefined();
    expect(harmonic.barChords!.length).toBe(gesture.num_bars);
    // Bar 0 should be C major
    expect(harmonic.barChords![0].chord).not.toBeNull();
    expect(harmonic.barChords![0].chord!.qualityKey).toBe('maj');
    expect(harmonic.barChords![0].chord!.root).toBe(0); // C
    // Bar 1 should be D minor
    expect(harmonic.barChords![1].chord).not.toBeNull();
    expect(harmonic.barChords![1].chord!.qualityKey).toBe('min');
    expect(harmonic.barChords![1].chord!.root).toBe(2); // D
  });

  it('detects chords in bars with only sustained notes', () => {
    // Chord starts in bar 0, sustains through bar 1 (no new onsets in bar 1)
    const notes: Note[] = [
      { midi: 60, ticks: 0, durationTicks: 960, velocity: 80 },   // C sustained 2 bars
      { midi: 64, ticks: 0, durationTicks: 960, velocity: 80 },   // E sustained 2 bars
      { midi: 67, ticks: 0, durationTicks: 960, velocity: 80 },   // G sustained 2 bars
    ];
    const gesture = extractGesture(notes, 120); // 120 tpb, 480 tpbar
    const harmonic = extractHarmonic(notes, gesture);

    expect(harmonic.barChords).toBeDefined();
    expect(harmonic.barChords!.length).toBe(2);

    // Bar 0: C major (onset)
    expect(harmonic.barChords![0].chord).not.toBeNull();
    expect(harmonic.barChords![0].chord!.root).toBe(0);
    expect(harmonic.barChords![0].chord!.qualityKey).toBe('maj');

    // Bar 1: C major (sustained — should still detect)
    expect(harmonic.barChords![1].chord).not.toBeNull();
    expect(harmonic.barChords![1].chord!.root).toBe(0);
    expect(harmonic.barChords![1].chord!.qualityKey).toBe('maj');
  });
});
