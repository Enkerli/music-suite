/**
 * BridgeDB round-trip through a mocked juce bridge: the persisted file must
 * be an @enkerli/library envelope index, legacy { clips, tags } files must
 * still load (and upgrade on next persist), and nothing is ever lost —
 * unknown entries carry through, bare clips stay visible.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface Sent { id: string; payload?: { json?: string } }
const sent: Sent[] = [];
const listeners = new Map<string, Set<(d: unknown) => void>>();

vi.mock('../juce-bridge', () => ({
  bridge: {
    on(id: string, cb: (d: unknown) => void) {
      if (!listeners.has(id)) listeners.set(id, new Set());
      listeners.get(id)!.add(cb);
      return () => listeners.get(id)!.delete(cb);
    },
    send(id: string, payload?: { json?: string }) {
      sent.push({ id, payload });
      if (id === 'enkerliLoadLibrary') {
        // C++ replies with the current library file (set by each test).
        for (const cb of listeners.get('library') ?? [])
          cb({ json: fileOnDisk });
      }
    },
  },
}));

let fileOnDisk = '';

import { BridgeDB } from '../bridge-db';
import type { Clip } from '../../types/clip';

function clip(over: Partial<Clip> = {}): Clip {
  return {
    id: '66666666-aaaa-bbbb-cccc-000000000006',
    filename: 'groove_120bpm.mid',
    imported_at: 1751630400000,
    bpm: 120,
    gesture: {
      onsets: [0, 480], durations: [240, 240], velocities: [90, 80],
      density: 0.5, syncopation_score: 0, avg_velocity: 85,
      velocity_variance: 5, avg_duration: 240, num_bars: 1,
      ticks_per_bar: 1920, ticks_per_beat: 480,
    },
    harmonic: { pitches: [60, 64, 67], pitchClasses: [0, 4, 7] },
    rating: 4,
    notes: '',
    ...over,
  };
}

/** Drain the 300 ms persist debounce and return the last stored index. */
async function lastStored(): Promise<unknown> {
  await vi.advanceTimersByTimeAsync(400);
  const store = [...sent].reverse().find((s) => s.id === 'enkerliStoreLibrary');
  expect(store, 'expected a store call').toBeDefined();
  return JSON.parse(store!.payload!.json!);
}

beforeEach(() => {
  vi.useFakeTimers();
  sent.length = 0;
  listeners.clear();
  fileOnDisk = '';
});

describe('BridgeDB envelope index', () => {
  it('persists an envelope index (kind clip, facets, tags, verbatim payload)', async () => {
    const db = new BridgeDB();
    const init = db.init();
    await vi.advanceTimersByTimeAsync(1); // deliver the (empty) library reply
    await init;

    await db.addClip(clip());
    await db.addTag(clip().id, 'jazz');
    const raw = (await lastStored()) as Array<Record<string, unknown>>;

    expect(raw).toHaveLength(1);
    expect(raw[0]!.envelope).toBe('enkerli-library-item');
    expect(raw[0]!.kind).toBe('clip');
    expect(raw[0]!.app).toBe('midicurator');
    expect(raw[0]!.facets).toEqual({ bpm: 120, rating: 4 });
    expect(raw[0]!.tags).toEqual(['jazz']);
    expect((raw[0]!.payload as Clip)).toEqual(clip()); // the Clip, verbatim
  });

  it('round-trips: a second BridgeDB loads what the first persisted', async () => {
    const a = new BridgeDB();
    const initA = a.init();
    await vi.advanceTimersByTimeAsync(1);
    await initA;
    await a.addClip(clip());
    await a.addTag(clip().id, 'keeper');
    fileOnDisk = JSON.stringify(await lastStored());

    const b = new BridgeDB();
    const initB = b.init();
    await vi.advanceTimersByTimeAsync(1);
    await initB;
    expect(await b.getAllClips()).toEqual([clip()]);
    expect(await b.getClipTags(clip().id)).toEqual(['keeper']);
  });

  it('ingests a legacy { clips, tags } file and upgrades it on next persist', async () => {
    fileOnDisk = JSON.stringify({
      clips: [clip()],
      tags: [{ clipId: clip().id, tag: 'old-tag', added_at: 123 }],
    });
    const db = new BridgeDB();
    const init = db.init();
    await vi.advanceTimersByTimeAsync(1);
    await init;

    expect(await db.getAllClips()).toEqual([clip()]);        // legacy loads
    expect(await db.getClipTags(clip().id)).toEqual(['old-tag']);

    await db.addClip(clip({ id: '77777777-aaaa-bbbb-cccc-000000000007' }));
    const raw = (await lastStored()) as Array<Record<string, unknown>>;
    expect(raw).toHaveLength(2);
    for (const entry of raw) expect(entry.envelope).toBe('enkerli-library-item');
    const upgraded = raw.find((e) => (e.payload as Clip).id === clip().id)!;
    expect(upgraded.tags).toEqual(['old-tag']);              // tags survive upgrade
  });

  it('never loses data: unknown entries carry through, bare clips stay visible', async () => {
    const futureItem = { envelope: 'enkerli-library-item', kind: 'hologram', mystery: true };
    const bare = clip({ id: '88888888-aaaa-bbbb-cccc-000000000008', filename: 'bare.mid' });
    fileOnDisk = JSON.stringify([futureItem, bare]);

    const db = new BridgeDB();
    const init = db.init();
    await vi.advanceTimersByTimeAsync(1);
    await init;

    // The bare clip is a clip (visible), the unknown item is not (carried).
    expect((await db.getAllClips()).map((c) => c.filename)).toEqual(['bare.mid']);

    await db.addTag(bare.id, 't');
    const raw = (await lastStored()) as Array<Record<string, unknown>>;
    expect(raw.find((e) => (e as { kind?: string }).kind === 'hologram'))
      .toEqual(futureItem);                                  // carried verbatim
    const bareOut = raw.find((e) => e.envelope === 'enkerli-library-item' &&
      (e.payload as Clip | undefined)?.id === bare.id);
    expect(bareOut).toBeDefined();                           // bare clip upgraded
  });

  it('treats a corrupt file as empty state without throwing', async () => {
    fileOnDisk = '{not json';
    const db = new BridgeDB();
    const init = db.init();
    await vi.advanceTimersByTimeAsync(1);
    await init;
    expect(await db.getAllClips()).toEqual([]);
  });
});
