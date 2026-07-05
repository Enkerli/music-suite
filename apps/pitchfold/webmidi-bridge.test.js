// The suite-protocol glue: encoded scale frames (as PickPCS sends them) must
// reach onScale with the body intact; foreign SysEx and other-app targets
// must not. Pure — no browser, no Web MIDI.
import { describe, expect, it, vi } from 'vitest';
import { makeMessage, encodeMessage } from '@enkerli/protocol';
import { makeScaleIngest } from './webmidi-bridge.js';

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
