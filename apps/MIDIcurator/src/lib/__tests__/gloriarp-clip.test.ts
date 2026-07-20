import { describe, it, expect } from 'vitest';
import {
  generateGrooveClip, GROOVE_STYLE_NAMES,
  learnStyleFromClip, listUserStyles, allStyleNames,
  learnStyleModelFromClips, listUserModels,
  importStyleFromJson, exportStyleJson,
  styleKind, clipFamily, learnStyleModelFromFamily,
  DENSITY_PRESETS, generateDensityFamily,
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

  it('per-dimension morph reaches the engine (docs/KNOWLEDGE_TRANSFER.md item 5): morphRests wanders skip-step across passes', () => {
    const at = (pass: number) => generateGrooveClip({
      ...CANON, style: 'funk-ghost', rests: 0.6, morphRests: 1, pass,
    }).notes.map((n) => n.ticks);
    const p0 = at(0);
    let anyDiffer = false;
    for (let pass = 1; pass < 8; pass++) if (JSON.stringify(at(pass)) !== JSON.stringify(p0)) { anyDiffer = true; break; }
    expect(anyDiffer).toBe(true);
  });

  it('morphNotes/morphPocket reach the engine independently', () => {
    const at = (pass: number) => generateGrooveClip({
      ...CANON, variety: 0.7, pocket: 0.6, morphNotes: 1, morphPocket: 0, pass,
    }).notes;
    const p0 = at(0), p5 = at(5);
    expect(p0.map((n) => n.ticks)).toEqual(p5.map((n) => n.ticks)); // pocket held → onsets fixed
    expect(p0.map((n) => n.midi)).not.toEqual(p5.map((n) => n.midi)); // notes wander
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

describe('polyphonic MIDI (EP comping) and style models', () => {
  const kv = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } };
  };

  /** A three-note Dm7 comping clip: stacked hits at 0 and 960 (root/b3/5th),
   *  the kind of polyphonic MIDI an EP comps with. */
  const compingClip = (variant = 0): Clip => ({
    id: `comp-${variant}`, filename: `comp-${variant}.mid`, imported_at: 0, bpm: 120, rating: null, notes: '',
    gesture: {
      onsets: [0, 0, 0, 960, 960, 960],
      durations: [220, 220, 220, 200, 200, 200],
      velocities: [108, 100, 104, 92, 88, 94],
      density: 1, syncopation_score: 0, avg_velocity: 98, velocity_variance: 0, avg_duration: 210,
      num_bars: 1, ticks_per_bar: 1920, ticks_per_beat: 480,
    },
    harmonic: {
      pitches: [50, 53, 57, 50, 53, 58 + (variant % 2)], pitchClasses: [2, 5, 9, 2, 5, 10],
      detectedChord: {
        root: 2, rootName: 'D', qualityKey: 'min7', symbol: 'Dm7', qualityName: 'minor seventh',
        templatePcs: [0, 2, 5, 9],
      },
    },
  });

  it('learns a comping clip with role "comping" (polyphony wins over the register heuristic)', () => {
    const s = kv();
    const phrase = learnStyleFromClip(compingClip(), 'my-comp', s);
    expect(phrase.role).toBe('comping');
    expect(phrase.events.some((e) => e.voice !== undefined)).toBe(true);
    const hit1 = phrase.events.filter((e) => e.onset === 0);
    expect(hit1).toHaveLength(3);
    expect(new Set(hit1.map((e) => e.voice)).size).toBe(3); // 3 distinct voices
  });

  it('a learned comping style generates a clip whose hits still stack notes', () => {
    const s = kv();
    learnStyleFromClip(compingClip(), 'my-comp', s);
    const { notes } = generateGrooveClip({ ...CANON, style: 'my-comp' }, s);
    const byTick = new Map<number, number>();
    for (const n of notes) byTick.set(n.ticks, (byTick.get(n.ticks) ?? 0) + 1);
    expect(Math.max(...byTick.values())).toBeGreaterThanOrEqual(2);
  });

  it('learnStyleModelFromClips folds several comping clips into one model, listed and playable', () => {
    const s = kv();
    const model = learnStyleModelFromClips([compingClip(0), compingClip(1), compingClip(0)], 'comp-model', s);
    expect(model.takes).toBe(3);
    expect(model.slots.some((sl) => sl.voices)).toBe(true);
    expect(listUserModels(s).map((e) => e.name)).toEqual(['comp-model']);
    expect(allStyleNames(s)).toContain('comp-model');

    const { notes } = generateGrooveClip({ ...CANON, style: 'comp-model' }, s);
    expect(notes.length).toBeGreaterThan(0);
    // Every pass samples a fresh take (a model, not a frozen phrase) — with
    // only one point of real vocabulary variance in this tiny corpus (the
    // top voice's 58-vs-59), a SINGLE pair of passes can coincide by chance,
    // so check across several that at least one diverges from pass 0.
    const base = generateGrooveClip({ ...CANON, style: 'comp-model', pass: 0 }, s).notes;
    const others = [1, 2, 3, 4, 5].map((p) => generateGrooveClip({ ...CANON, style: 'comp-model', pass: p }, s).notes);
    expect(others.some((n) => JSON.stringify(n) !== JSON.stringify(base))).toBe(true);
  });

  it('refuses to fold clips in different chords into one model', () => {
    const s = kv();
    const other = compingClip(0);
    other.harmonic.detectedChord = { root: 7, rootName: 'G', qualityKey: '7', symbol: 'G7', qualityName: 'dominant seventh', templatePcs: [0, 4, 7, 10] };
    expect(() => learnStyleModelFromClips([compingClip(0), other], 'mixed', s))
      .toThrow(/is in G7, not Dm7/);
  });

  it('inflect reaches the engine: durations shape differently with it on', () => {
    const base = generateGrooveClip(CANON);
    const inflected = generateGrooveClip({ ...CANON, inflect: 1 });
    expect(inflected.notes.map((n) => n.durationTicks)).not.toEqual(base.notes.map((n) => n.durationTicks));
  });

  it('imports a phrase.json and a style-model.json, then generates from each', () => {
    const s = kv();
    const phraseJson = exportStyleJson('walking-bass', undefined).json; // a bundled phrase, re-exported
    expect(importStyleFromJson(phraseJson, 'reimported-phrase', s)).toBe('phrase');
    expect(allStyleNames(s)).toContain('reimported-phrase');
    expect(generateGrooveClip({ ...CANON, style: 'reimported-phrase' }, s).notes.length).toBeGreaterThan(0);

    const model = learnStyleModelFromClips([compingClip(0), compingClip(1)], 'src-model', s);
    const modelJson = JSON.stringify(model);
    expect(importStyleFromJson(modelJson, 'reimported-model', s)).toBe('model');
    expect(allStyleNames(s)).toContain('reimported-model');
    expect(generateGrooveClip({ ...CANON, style: 'reimported-model' }, s).notes.length).toBeGreaterThan(0);
  });

  it('import refuses garbage with a clear reason', () => {
    const s = kv();
    expect(() => importStyleFromJson('not even json', 'x', s)).toThrow(/not JSON/);
    expect(() => importStyleFromJson('{"nope":1}', 'x', s)).toThrow(/neither a valid phrase/);
  });

  it('export round-trips a learned style back to JSON', () => {
    const s = kv();
    learnStyleFromClip(compingClip(), 'roundtrip', s);
    const { kind, json } = exportStyleJson('roundtrip', s);
    expect(kind).toBe('phrase');
    expect(importStyleFromJson(json, 'roundtrip-2', s)).toBe('phrase');
  });
});

describe('variants as style sources (docs/KNOWLEDGE_TRANSFER.md item 4)', () => {
  const kv = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } };
  };

  /** A Dm7 clip, variant N: same shape as the "learned styles" dm7Clip, but
   *  parameterized so a family's takes differ a little (root + b3 always,
   *  the 5th sometimes present) — enough for a model to learn a real
   *  vocabulary, not a single frozen value. */
  const familyClip = (id: string, source?: string): Clip => ({
    id, filename: `${id}.mid`, imported_at: 0, bpm: 120, rating: null, notes: '',
    ...(source && { source, sourceFilename: `${source}.mid` }),
    gesture: {
      onsets: [0, 480, 960], durations: [400, 400, 400], velocities: [96, 88, 90],
      density: 1, syncopation_score: 0, avg_velocity: 90, velocity_variance: 0, avg_duration: 400,
      num_bars: 1, ticks_per_bar: 1920, ticks_per_beat: 480,
    },
    harmonic: {
      pitches: [38, 41, id.length % 2 ? 57 : 45], pitchClasses: [2, 5, id.length % 2 ? 9 : 9],
      detectedChord: {
        root: 2, rootName: 'D', qualityKey: 'min7', symbol: 'Dm7', qualityName: 'minor seventh',
        templatePcs: [0, 2, 5, 9],
      },
    },
  });

  describe('clipFamily', () => {
    it('a clip with no source is its own family of one', () => {
      const root = familyClip('root');
      expect(clipFamily(root, [root])).toEqual([root]);
    });

    it('collects root + direct children', () => {
      const root = familyClip('root');
      const c1 = familyClip('c1', 'root');
      const c2 = familyClip('c2', 'root');
      const unrelated = familyClip('other');
      const all = [root, c1, c2, unrelated];
      expect(clipFamily(c1, all).map((c) => c.id).sort()).toEqual(['c1', 'c2', 'root']);
      expect(clipFamily(root, all).map((c) => c.id).sort()).toEqual(['c1', 'c2', 'root']);
    });

    it('reaches transitively (a grandchild counts, from any member)', () => {
      const root = familyClip('root');
      const child = familyClip('child', 'root');
      const grandchild = familyClip('grandchild', 'child');
      const unrelated = familyClip('other');
      const all = [root, child, grandchild, unrelated];
      expect(clipFamily(grandchild, all).map((c) => c.id).sort()).toEqual(['child', 'grandchild', 'root']);
      expect(clipFamily(root, all).map((c) => c.id).sort()).toEqual(['child', 'grandchild', 'root']);
    });

    it('never includes an unrelated clip, even one with its own source chain', () => {
      const root = familyClip('root');
      const child = familyClip('child', 'root');
      const otherRoot = familyClip('other-root');
      const otherChild = familyClip('other-child', 'other-root');
      const family = clipFamily(child, [root, child, otherRoot, otherChild]);
      expect(family.map((c) => c.id).sort()).toEqual(['child', 'root']);
    });
  });

  describe('learnStyleModelFromFamily', () => {
    it('learns from the whole family, matching manual clipFamily + learnStyleModelFromClips', () => {
      const root = familyClip('root');
      const c1 = familyClip('c1', 'root');
      const c2 = familyClip('c2', 'root');
      const s1 = kv(), s2 = kv();
      const viaFamily = learnStyleModelFromFamily(c1, [root, c1, c2], 'fam', s1);
      const viaManual = learnStyleModelFromClips(clipFamily(c1, [root, c1, c2]), 'fam', s2);
      expect(viaFamily).toEqual(viaManual);
      expect(viaFamily.takes).toBe(3);
    });

    it('a lone clip (no siblings yet) still learns — a valid single-take model', () => {
      const root = familyClip('root');
      const model = learnStyleModelFromFamily(root, [root], 'solo', kv());
      expect(model.takes).toBe(1);
    });
  });

  describe('styleKind', () => {
    it('identifies bundled and learned phrases, and models; null for unknown', () => {
      const s = kv();
      learnStyleFromClip(familyClip('p'), 'my-phrase', s);
      learnStyleModelFromClips([familyClip('a'), familyClip('b')], 'my-model', s);
      expect(styleKind('walking-bass', s)).toBe('phrase');
      expect(styleKind('my-phrase', s)).toBe('phrase');
      expect(styleKind('my-model', s)).toBe('model');
      expect(styleKind('nope', s)).toBeNull();
    });
  });

  describe('generateDensityFamily', () => {
    it('refuses a plain-phrase style with a clear reason (nothing to resample)', () => {
      const s = kv();
      learnStyleFromClip(familyClip('p'), 'just-a-phrase', s);
      expect(() => generateDensityFamily({ ...CANON, style: 'just-a-phrase' }, DENSITY_PRESETS, s))
        .toThrow(/is a single phrase, not a style MODEL/);
    });

    it('generates one clip per preset, labeled and densities threaded through, unique filenames', () => {
      const s = kv();
      learnStyleModelFromClips(
        [familyClip('a'), familyClip('b'), familyClip('c'), familyClip('d')],
        'fam-model', s,
      );
      const family = generateDensityFamily({ ...CANON, style: 'fam-model' }, DENSITY_PRESETS, s);
      expect(family).toHaveLength(DENSITY_PRESETS.length);
      expect(family.map((f) => f.label)).toEqual(DENSITY_PRESETS.map((p) => p.label));
      expect(family.map((f) => f.density)).toEqual(DENSITY_PRESETS.map((p) => p.density));
      for (const f of family) expect(f.data.notes.length).toBeGreaterThan(0);
      const filenames = family.map((f) => f.data.filename);
      expect(new Set(filenames).size).toBe(filenames.length); // no collisions
    });

    it('a custom preset list is honored (not hardcoded to the default ladder)', () => {
      const s = kv();
      learnStyleModelFromClips([familyClip('a'), familyClip('b')], 'fam-model2', s);
      const custom = [{ label: 'sparse', density: 0.1 }, { label: 'dense', density: 2 }];
      const family = generateDensityFamily({ ...CANON, style: 'fam-model2' }, custom, s);
      expect(family.map((f) => f.label)).toEqual(['sparse', 'dense']);
    });
  });
});
