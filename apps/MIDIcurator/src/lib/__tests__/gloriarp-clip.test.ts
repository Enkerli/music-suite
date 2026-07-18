import { describe, it, expect } from 'vitest';
import { generateGrooveClip, GROOVE_STYLE_NAMES } from '../gloriarp-clip';
import adaptedVector from '../../../../../packages/accompaniment/vectors/adapted-dm7-g7-cmaj7-a7-seed42.json';

const CANON = { progression: 'Dm7 | G7 | Cmaj7 | A7', style: 'walking-bass' as const, seed: 42, bpm: 120 };

describe('generateGrooveClip', () => {
  it('matches the committed acceptance vector note for note', () => {
    // The engine's byte-level vector (walking-bass, Dm7|G7|Cmaj7|A7, seed 42)
    // is the review surface: the clip conversion must carry it unchanged.
    const { notes, ppq } = generateGrooveClip(CANON);
    const expected = (adaptedVector.phrase.events as Array<{
      onset: number; duration: number; velocity: number; note: number;
    }>).map((e) => ({
      midi: e.note, ticks: e.onset, durationTicks: e.duration, velocity: e.velocity,
    }));
    expect(ppq).toBe(adaptedVector.phrase.ticksPerBeat);
    expect(notes).toEqual(expected);
  });

  it('is deterministic for identical requests', () => {
    expect(generateGrooveClip(CANON)).toEqual(generateGrooveClip(CANON));
  });

  it('changes with the seed where the RNG is consulted (rests)', () => {
    // The plain adapter can coincide across neighbouring seeds; the rest
    // stage draws per event, so heavy rests must diverge between seeds.
    const a = generateGrooveClip({ ...CANON, style: 'funk-ghost', rests: 0.8 });
    const b = generateGrooveClip({ ...CANON, style: 'funk-ghost', rests: 0.8, seed: 43 });
    expect(a.notes).not.toEqual(b.notes);
  });

  it('performs the pitch material on a UPI rhythm when given one', () => {
    const plain = generateGrooveClip(CANON);
    const tresillo = generateGrooveClip({ ...CANON, rhythm: 'E(3,8)' });
    expect(tresillo.notes).not.toEqual(plain.notes);
    expect(tresillo.notes.length).toBeGreaterThan(0);
  });

  it('every style generates a playable clip', () => {
    for (const style of GROOVE_STYLE_NAMES) {
      const { notes, ppq, filename } = generateGrooveClip({ ...CANON, style });
      expect(notes.length, style).toBeGreaterThan(0);
      expect(ppq, style).toBe(480);
      expect(filename).toBe(`gloriarp-${style}-s42.mid`);
      for (const n of notes) {
        expect(n.midi).toBeGreaterThanOrEqual(0);
        expect(n.midi).toBeLessThanOrEqual(127);
        expect(n.durationTicks).toBeGreaterThan(0);
      }
    }
  });

  it('surfaces engine errors as thrown messages', () => {
    expect(() => generateGrooveClip({ ...CANON, progression: '???' }))
      .toThrow(/no chords parsed/);
    expect(() => generateGrooveClip({ ...CANON, rhythm: '(((' }))
      .toThrow(/did not parse as UPI/);
  });
});
