// The standalone MIDI-output bridge: it must request PLAIN MIDI (never SysEx —
// output needs no SysEx, and requesting it risks the 2026-07-06 regression),
// gate all sends on a selected port, and route to the chosen output.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const connectCalls = [];
const sent = [];
let selected = null;

vi.mock('@enkerli/webmidi', () => ({
  connect: vi.fn(async ({ sysex } = {}) => {
    connectCalls.push({ sysex: !!sysex });
    return {
      inputs: [],
      outputs: [{ id: 'o1', name: 'IAC Bus 1' }, { id: 'o2', name: 'Synth' }],
      onPortsChanged: () => {},
      selectOutput: (id) => { selected = id; },
      sendNoteOn: (n, o) => sent.push(['on', n, o, selected]),
      sendNoteOff: (n, o) => sent.push(['off', n, o, selected]),
      allNotesOff: (o) => sent.push(['panic', o, selected]),
    };
  }),
}));

import * as midiOut from './webmidi-out.js';

beforeEach(() => {
  sent.length = 0;
  // Web MIDI presence check: give the test env a navigator with the API.
  globalThis.navigator ??= {};
  if (!('requestMIDIAccess' in globalThis.navigator)) globalThis.navigator.requestMIDIAccess = () => {};
});

describe('webmidi-out (ProgGenie)', () => {
  it('requests PLAIN MIDI (sysex:false) and lists outputs', async () => {
    const r = await midiOut.startMidiOut();
    expect(r.ok).toBe(true);
    expect(connectCalls[0]).toEqual({ sysex: false });   // never SysEx for output
    expect(r.outputs.map((p) => p.name)).toEqual(['IAC Bus 1', 'Synth']);
  });

  it('is inactive until a real port is selected — sends no-op', () => {
    expect(midiOut.midiActive()).toBe(false);
    midiOut.sendNoteOn(60, 100, 1);
    expect(sent).toEqual([]);                              // internal Web Audio path
  });

  it('routes note-on/off to the selected output when active', () => {
    midiOut.selectOutput('o2');
    expect(midiOut.midiActive()).toBe(true);
    midiOut.sendNoteOn(60, 90, 1);
    midiOut.sendNoteOff(60, 1);
    expect(sent).toEqual([
      ['on', 60, { velocity: 90, channel: 1 }, 'o2'],
      ['off', 60, { channel: 1 }, 'o2'],
    ]);
  });

  it('selecting null (Internal) makes it inactive again', () => {
    midiOut.selectOutput(null);
    expect(midiOut.midiActive()).toBe(false);
    midiOut.sendNoteOn(72, 100, 1);
    expect(sent).toEqual([]);
  });
});
