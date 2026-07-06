// The suite-protocol glue: encoded scale frames (as PickPCS sends them) must
// reach onScale with the body intact; foreign SysEx and other-app targets
// must not. Pure — no browser, no Web MIDI. Plus the regression guard for
// 2026-07-06: a SysEx permission denial must NEVER take plain note I/O down.
import { describe, expect, it, vi } from 'vitest';
import { makeMessage, encodeMessage } from '@enkerli/protocol';

const connectCalls = [];
let denySysex = false;
let denyAll = false;

vi.mock('@enkerli/webmidi', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    connect: vi.fn(async ({ sysex } = {}) => {
      connectCalls.push({ sysex: !!sysex });
      if (denyAll || (denySysex && sysex))
        throw new Error('Permission to use Web MIDI API was not granted.');
      return {
        inputs: [], outputs: [],
        onPortsChanged: () => {}, onNoteIn: () => {}, onSysEx: vi.fn(),
        onClock: () => {}, onTransport: () => {},
        selectInput: () => {}, selectOutput: () => {},
        sendNoteOn: () => {}, sendNoteOff: () => {}, allNotesOff: () => {},
      };
    }),
  };
});

import { makeScaleIngest, startWebMidi } from './webmidi-bridge.js';

describe('startWebMidi SysEx fallback (the 2026-07-06 regression)', () => {
  it('a SysEx denial falls back to plain MIDI — note I/O survives', async () => {
    connectCalls.length = 0; denySysex = true; denyAll = false;
    globalThis.navigator ??= {};
    globalThis.navigator.requestMIDIAccess ??= () => {};
    const res = await startWebMidi({ onNote: () => {}, onScale: () => {} });
    expect(connectCalls).toEqual([{ sysex: true }, { sysex: false }]);
    expect(res.ok).toBe(true);       // MIDI works
    expect(res.sysex).toBe(false);   // …just without the scale-receive feature
  });

  it('with SysEx granted, one connect and the scale listener is wired', async () => {
    connectCalls.length = 0; denySysex = false; denyAll = false;
    const res = await startWebMidi({ onNote: () => {}, onScale: () => {} });
    expect(connectCalls).toEqual([{ sysex: true }]);
    expect(res).toMatchObject({ ok: true, sysex: true });
  });

  it('no scale listener → plain request only (no extra permission)', async () => {
    connectCalls.length = 0; denySysex = true;
    const res = await startWebMidi({ onNote: () => {} });
    expect(connectCalls).toEqual([{ sysex: false }]);
    expect(res.ok).toBe(true);
  });

  it('a full denial still reports the error cleanly', async () => {
    connectCalls.length = 0; denyAll = true;
    const res = await startWebMidi({ onNote: () => {}, onScale: () => {} });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/not granted/);
    denyAll = false;
  });
});

describe('makeScaleIngest', () => {
  it('delivers a broadcast scale push (chunks included)', () => {
    const onScale = vi.fn();
    const ingest = makeScaleIngest(onScale);
    const msg = makeMessage('pickpcs', 'scale',
      { mask: 0x0ab5, root: 0, name: 'C major' }, { to: '*' });
    for (const f of encodeMessage(msg, { chunkBytes: 60 })) ingest(f);
    expect(onScale).toHaveBeenCalledTimes(1);
    expect(onScale).toHaveBeenCalledWith(
      { mask: 0x0ab5, root: 0, name: 'C major' }, 'pickpcs');
  });

  it('delivers a scale addressed to pitchfold, ignores other targets', () => {
    const onScale = vi.fn();
    const ingest = makeScaleIngest(onScale);
    for (const f of encodeMessage(makeMessage('pickpcs', 'scale', { mask: 1 }, { to: 'pitchfold' })))
      ingest(f);
    for (const f of encodeMessage(makeMessage('pickpcs', 'scale', { mask: 2 }, { to: 'vane' })))
      ingest(f);
    expect(onScale).toHaveBeenCalledTimes(1);
    expect(onScale.mock.calls[0][0].mask).toBe(1);
  });

  it('ignores non-scale suite messages and foreign SysEx', () => {
    const onScale = vi.fn();
    const ingest = makeScaleIngest(onScale);
    for (const f of encodeMessage(makeMessage('serpe', 'pattern', { steps: 8, mask: 73 })))
      ingest(f);
    ingest(Uint8Array.from([0xf0, 0x43, 0x10, 0xf7])); // not ours
    expect(onScale).not.toHaveBeenCalled();
  });
});
