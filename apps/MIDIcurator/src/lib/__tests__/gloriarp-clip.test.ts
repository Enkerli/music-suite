import { describe, it, expect } from 'vitest';
import {
  generateGrooveClip, GROOVE_STYLE_NAMES,
  learnStyleFromClip, listUserStyles, allStyleNames,
} from '../gloriarp-clip';
import type { Clip } from '../../types/clip';
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

  it('expression knobs reach the engine: takes (pass+morph) differ, base take matches', () => {
    const base = generateGrooveClip(CANON);
    const take0 = generateGrooveClip({ ...CANON, variety: 0.7, pocket: 0.6, morph: 1 });
    const take2 = generateGrooveClip({ ...CANON, variety: 0.7, pocket: 0.6, morph: 1, pass: 2 });
    expect(take0.notes).not.toEqual(base.notes);
    expect(take2.notes).not.toEqual(take0.notes);
    expect(take2.filename).toBe('gloriarp-walking-bass-s42-p2.mid');
  });
});

describe('learned styles (curated capture, docs/GLORIARP_NEXT.md slice C)', () => {
  /** In-memory stand-in for localStorage. */
  const kv = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } };
  };

  /** A minimal one-bar Dm7 bass clip (D2 F2 A2 C3, quarters). */
  const dm7Clip = (): Clip => ({
    id: 'c1', filename: 'my-groove.mid', imported_at: 0, bpm: 120, rating: null, notes: '',
    gesture: {
      onsets: [0, 480, 960, 1440], durations: [400, 400, 400, 400], velocities: [96, 88, 90, 84],
      density: 1, syncopation_score: 0, avg_velocity: 90, velocity_variance: 0, avg_duration: 400,
      num_bars: 1, ticks_per_bar: 1920, ticks_per_beat: 480,
    },
    harmonic: {
      pitches: [38, 41, 45, 48], pitchClasses: [2, 5, 9, 0],
      detectedChord: {
        root: 2, rootName: 'D', qualityKey: 'min7', symbol: 'Dm7', qualityName: 'minor seventh',
        templatePcs: [0, 2, 5, 9],
      },
    },
  });

  it('learns a clip as a style, lists it, and generates from it', () => {
    const s = kv();
    const phrase = learnStyleFromClip(dm7Clip(), 'my-funk', s);
    expect(phrase.role).toBe('bass');           // register heuristic: avg pitch < E3
    expect(phrase.events).toHaveLength(4);
    expect(phrase.events[0]!.chordRelation?.category).toBe('chord-tone');
    expect(listUserStyles(s).map((e) => e.name)).toEqual(['my-funk']);
    expect(allStyleNames(s)).toContain('my-funk');

    const clip = generateGrooveClip({ ...CANON, style: 'my-funk' }, s);
    expect(clip.notes.length).toBeGreaterThan(0);
    // Deterministic like any bundled style.
    expect(generateGrooveClip({ ...CANON, style: 'my-funk' }, s)).toEqual(clip);
  });

  it('same-name learning replaces, storage corruption is dropped not thrown', () => {
    const s = kv();
    learnStyleFromClip(dm7Clip(), 'take', s);
    learnStyleFromClip(dm7Clip(), 'take', s);
    expect(listUserStyles(s)).toHaveLength(1);
    s.setItem('midicurator.gloriarp-styles', '[{"name":"broken","phrase":{"nope":1}}, not even json');
    expect(listUserStyles(s)).toEqual([]);
  });

  it('refuses honestly: no chord → a message naming the fix', () => {
    const clip = dm7Clip();
    clip.harmonic.detectedChord = null;
    expect(() => learnStyleFromClip(clip, 'x', kv())).toThrow(/needs a chord/);
  });

  it('learns from a LEADSHEET chord (root + qualityKey only — the "C7 carries no pitch classes" bug)', () => {
    const s = kv();
    const clip = dm7Clip();
    // The exact shape parseChordSymbol produces for a typed leadsheet entry:
    // no templatePcs, no observedPcs — just root + qualityKey + names.
    clip.harmonic.detectedChord = null;
    clip.leadsheet = {
      inputText: 'C7',
      bars: [{ bar: 0, isRepeat: false, chords: [{
        chord: { root: 0, rootName: 'C', qualityKey: '7', symbol: 'C7', qualityName: 'dominant seventh' },
        inputText: 'C7', position: 0, totalInBar: 1,
      }] }],
    };
    const phrase = learnStyleFromClip(clip, 'from-leadsheet', s);
    expect(phrase.harmonicFrames![0]!.chord.symbol).toBe('C7');
    expect(phrase.harmonicFrames![0]!.chord.pcs.sort((a, b) => a - b)).toEqual([0, 4, 7, 10]); // C E G B♭ from the dictionary
    expect(generateGrooveClip({ ...CANON, style: 'from-leadsheet' }, s).notes.length).toBeGreaterThan(0);
  });

  it('unknown style names fail with the available list', () => {
    expect(() => generateGrooveClip({ ...CANON, style: 'nope' }, kv())).toThrow(/unknown style "nope"/);
  });
});
