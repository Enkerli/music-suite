// webmidi-bridge.js — the webapp-side MIDI I/O, the standalone counterpart to
// juce-bridge.js. Wraps @enkerli/webmidi (the suite's shared layer) so the
// standalone build can route real MIDI when there's no plugin host to do it.
// Every call no-ops gracefully until connect() succeeds, so importing this is
// safe in any runtime (including browsers with no Web MIDI, e.g. Safari).
import { connect, ClockCounter } from '@enkerli/webmidi';
import { Reassembler } from '@enkerli/protocol';

let midi = null; // SuiteMidi handle once connected

/**
 * Suite-protocol ingest: returns a SysEx-frame handler that reassembles
 * @enkerli/protocol messages and calls onScale(body, fromApp) for scale
 * pushes addressed to PitchFold (or broadcast). Pure — unit-tested without
 * a browser; startWebMidi wires it to the real port below.
 */
export function makeScaleIngest(onScale) {
  const reassembler = new Reassembler();
  return (bytes) => {
    const msg = reassembler.push(bytes);
    if (msg && msg.type === 'scale' && (msg.to === '*' || msg.to === 'pitchfold'))
      onScale(msg.body, msg.from);
  };
}

export function midiSupported() {
  return typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator;
}

const ports = () => (midi
  ? { inputs: midi.inputs, outputs: midi.outputs }
  : { inputs: [], outputs: [] });

/**
 * Enable Web MIDI and wire input handlers (parity with the plugin's MIDI path).
 * handlers: { onDevices(ports), onNoteIn({...on only}), onNote({...on&off}), onClock(),
 *             onScale(body, from) — suite-protocol scale pushes (needs SysEx) }.
 * Use onNote when you need note-offs too (e.g. a quantizer releasing its output).
 * Returns { ok, ports, sysex } or { ok:false, error }.
 *
 * SysEx is an UPGRADE, never a dependency: it's a separate, scarier browser
 * permission (Brave/Chrome prompt again or deny outright), and requesting it
 * as a precondition once took the whole quantizer's note I/O down with it —
 * a denied sysex prompt threw before any listener was bound (the 2026-07-06
 * regression). Now: try with SysEx only when a scale listener wants it, and
 * on ANY failure retry plain — notes always work; the app just runs without
 * the scale-receive feature (`sysex: false` in the result says so).
 */
export async function startWebMidi(handlers = {}) {
  if (!midiSupported()) return { ok: false, error: 'Web MIDI not supported in this browser' };
  let sysex = !!handlers.onScale;
  try {
    midi = await connect({ sysex });
  } catch (e) {
    if (!sysex) return { ok: false, error: String((e && e.message) || e) };
    sysex = false;
    try {
      midi = await connect({ sysex: false });   // plain MIDI must survive a SysEx denial
    } catch (e2) {
      return { ok: false, error: String((e2 && e2.message) || e2) };
    }
  }
  midi.onPortsChanged(() => handlers.onDevices && handlers.onDevices(ports()));
  if (handlers.onNoteIn) midi.onNoteIn(e => { if (e.on) handlers.onNoteIn(e); });
  if (handlers.onNote) midi.onNoteIn(e => handlers.onNote(e));
  if (handlers.onScale && sysex) midi.onSysEx(makeScaleIngest(handlers.onScale));
  if (handlers.onClock) {
    const clock = new ClockCounter(() => handlers.onClock(), 24); // 24 PPQN → beat
    midi.onClock(() => clock.pulse());
    midi.onTransport(t => { if (t === 'stop') clock.reset(); });
  }
  return { ok: true, ports: ports(), sysex };
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
