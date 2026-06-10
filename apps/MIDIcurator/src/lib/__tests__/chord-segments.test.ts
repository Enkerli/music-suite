import { describe, it, expect } from 'vitest';
import { spliceSegment, isTrivialSegments } from '../chord-segments';
import type { DetectedChord, ChordSegment } from '../../types/clip';

// Test fixtures
const Cmaj: DetectedChord = {
  root: 0,
  rootName: 'C',
  qualityKey: 'maj',
  symbol: 'C',
  qualityName: 'major triad',
};

const Dmin: DetectedChord = {
  root: 2,
  rootName: 'D',
  qualityKey: 'min',
  symbol: 'D-',
  qualityName: 'minor triad',
};

const G7: DetectedChord = {
  root: 7,
  rootName: 'G',
  qualityKey: '7',
  symbol: 'G7',
  qualityName: 'dominant seventh',
};

const TICKS_PER_BAR = 1920; // 4/4 time, 480 ticks per beat

describe('spliceSegment', () => {
  it('creates a single segment when overriding whole bar with no existing segments', () => {
    const result = spliceSegment(undefined, Cmaj, TICKS_PER_BAR, 0, TICKS_PER_BAR, Dmin);
    expect(result).toEqual([
      { startTick: 0, endTick: 1920, chord: Dmin },
    ]);
  });

  it('splits bar in half when overriding first half', () => {
    const result = spliceSegment(undefined, Cmaj, TICKS_PER_BAR, 0, 960, Dmin);
    expect(result).toEqual([
      { startTick: 0, endTick: 960, chord: Dmin },
      { startTick: 960, endTick: 1920, chord: Cmaj },
    ]);
  });

  it('splits bar in half when overriding second half', () => {
    const result = spliceSegment(undefined, Cmaj, TICKS_PER_BAR, 960, 1920, Dmin);
    expect(result).toEqual([
      { startTick: 0, endTick: 960, chord: Cmaj },
      { startTick: 960, endTick: 1920, chord: Dmin },
    ]);
  });

  it('creates three segments when overriding middle portion', () => {
    const result = spliceSegment(undefined, Cmaj, TICKS_PER_BAR, 480, 1440, Dmin);
    expect(result).toEqual([
      { startTick: 0, endTick: 480, chord: Cmaj },
      { startTick: 480, endTick: 1440, chord: Dmin },
      { startTick: 1440, endTick: 1920, chord: Cmaj },
    ]);
  });

  it('splits existing segments correctly', () => {
    // Start with two segments: [0-960) Cmaj, [960-1920) Dmin
    const existing: ChordSegment[] = [
      { startTick: 0, endTick: 960, chord: Cmaj },
      { startTick: 960, endTick: 1920, chord: Dmin },
    ];
    // Override [480-1440) with G7 — should cut across both existing segments
    const result = spliceSegment(existing, Cmaj, TICKS_PER_BAR, 480, 1440, G7);
    expect(result).toEqual([
      { startTick: 0, endTick: 480, chord: Cmaj },
      { startTick: 480, endTick: 1440, chord: G7 },
      { startTick: 1440, endTick: 1920, chord: Dmin },
    ]);
  });

  it('replaces entire existing segment', () => {
    const existing: ChordSegment[] = [
      { startTick: 0, endTick: 960, chord: Cmaj },
      { startTick: 960, endTick: 1920, chord: Dmin },
    ];
    // Override exactly the first segment
    const result = spliceSegment(existing, Cmaj, TICKS_PER_BAR, 0, 960, G7);
    expect(result).toEqual([
      { startTick: 0, endTick: 960, chord: G7 },
      { startTick: 960, endTick: 1920, chord: Dmin },
    ]);
  });

  it('handles override that spans entire bar when segments exist', () => {
    const existing: ChordSegment[] = [
      { startTick: 0, endTick: 640, chord: Cmaj },
      { startTick: 640, endTick: 1280, chord: Dmin },
      { startTick: 1280, endTick: 1920, chord: G7 },
    ];
    const result = spliceSegment(existing, Cmaj, TICKS_PER_BAR, 0, 1920, Dmin);
    expect(result).toEqual([
      { startTick: 0, endTick: 1920, chord: Dmin },
    ]);
  });

  it('handles null chords', () => {
    const result = spliceSegment(undefined, null, TICKS_PER_BAR, 0, 960, Dmin);
    expect(result).toEqual([
      { startTick: 0, endTick: 960, chord: Dmin },
      { startTick: 960, endTick: 1920, chord: null },
    ]);
  });

  it('does not create zero-width segments', () => {
    // Override at exact segment boundary
    const existing: ChordSegment[] = [
      { startTick: 0, endTick: 960, chord: Cmaj },
      { startTick: 960, endTick: 1920, chord: Dmin },
    ];
    const result = spliceSegment(existing, Cmaj, TICKS_PER_BAR, 960, 1920, G7);
    expect(result).toEqual([
      { startTick: 0, endTick: 960, chord: Cmaj },
      { startTick: 960, endTick: 1920, chord: G7 },
    ]);
    // No zero-width segments should exist
    expect(result.every(s => s.endTick > s.startTick)).toBe(true);
  });

  it('preserves unaffected segments', () => {
    const existing: ChordSegment[] = [
      { startTick: 0, endTick: 480, chord: Cmaj },
      { startTick: 480, endTick: 960, chord: Dmin },
      { startTick: 960, endTick: 1440, chord: G7 },
      { startTick: 1440, endTick: 1920, chord: Cmaj },
    ];
    // Override only the second segment
    const result = spliceSegment(existing, Cmaj, TICKS_PER_BAR, 480, 960, null);
    expect(result).toEqual([
      { startTick: 0, endTick: 480, chord: Cmaj },
      { startTick: 480, endTick: 960, chord: null },
      { startTick: 960, endTick: 1440, chord: G7 },
      { startTick: 1440, endTick: 1920, chord: Cmaj },
    ]);
  });
});

describe('isTrivialSegments', () => {
  it('returns true for undefined', () => {
    expect(isTrivialSegments(undefined, TICKS_PER_BAR)).toBe(true);
  });

  it('returns true for empty array', () => {
    expect(isTrivialSegments([], TICKS_PER_BAR)).toBe(true);
  });

  it('returns true for single full-bar segment', () => {
    const segments: ChordSegment[] = [
      { startTick: 0, endTick: 1920, chord: Cmaj },
    ];
    expect(isTrivialSegments(segments, TICKS_PER_BAR)).toBe(true);
  });

  it('returns false for multiple segments', () => {
    const segments: ChordSegment[] = [
      { startTick: 0, endTick: 960, chord: Cmaj },
      { startTick: 960, endTick: 1920, chord: Dmin },
    ];
    expect(isTrivialSegments(segments, TICKS_PER_BAR)).toBe(false);
  });

  it('returns false for single partial segment', () => {
    const segments: ChordSegment[] = [
      { startTick: 0, endTick: 960, chord: Cmaj },
    ];
    expect(isTrivialSegments(segments, TICKS_PER_BAR)).toBe(false);
  });
});
