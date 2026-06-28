// webmidi-bridge.js — the webapp-side MIDI I/O, the standalone counterpart to
// juce-bridge.js. Wraps @enkerli/webmidi (the suite's shared layer) so Serpe's
// standalone build can route real MIDI when there's no plugin host to do it.
// Every call no-ops gracefully until connect() succeeds, so importing this is
// safe in any runtime (including browsers with no Web MIDI, e.g. Safari).
import { connect, ClockCounter } from '@enkerli/webmidi';

let midi = null; // SuiteMidi handle once connected

export function midiSupported() {
  return typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator;
}

const ports = () => (midi
  ? { inputs: midi.inputs, outputs: midi.outputs }
  : { inputs: [], outputs: [] });

/**
 * Enable Web MIDI and wire input handlers (parity with the plugin's MIDI path).
 * handlers: { onDevices(ports), onNoteIn({note,velocity,channel}), onClock() }.
 * Returns { ok, ports } or { ok:false, error }.
 */
export async function startWebMidi(handlers = {}) {
  if (!midiSupported()) return { ok: false, error: 'Web MIDI not supported in this browser' };
  try {
    midi = await connect({ sysex: false });
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
  midi.onPortsChanged(() => handlers.onDevices && handlers.onDevices(ports()));
  if (handlers.onNoteIn) midi.onNoteIn(e => { if (e.on) handlers.onNoteIn(e); });
  if (handlers.onClock) {
    const clock = new ClockCounter(() => handlers.onClock(), 24); // 24 PPQN → beat
    midi.onClock(() => clock.pulse());
    midi.onTransport(t => { if (t === 'stop') clock.reset(); });
  }
  return { ok: true, ports: ports() };
}

export function selectMidiInput(id) { if (midi) midi.selectInput(id || null); }
export function selectMidiOutput(id) { if (midi) midi.selectOutput(id || null); }
export function sendMidiNoteOn(note, velocity, channel) {
  if (midi) midi.sendNoteOn(note, { velocity, channel });
}
export function sendMidiNoteOff(note, channel) {
  if (midi) midi.sendNoteOff(note, { channel });
}
export function allMidiNotesOff(channel) { if (midi) midi.allNotesOff({ channel }); }
