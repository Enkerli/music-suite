/**
 * webmidi-out.js — ProgGenie's standalone MIDI *output* path, so the webapp
 * can drive an external synth (or another suite app over an IAC bus) instead
 * of only the internal Web Audio preview. The plugin build has no use for it
 * (a host owns MIDI there); this is standalone/browser chrome.
 *
 * A thin wrapper over @enkerli/webmidi (the suite's shared layer), output
 * only: pick a port, send note-on/off. Plain MIDI — `sysex: false`. SysEx is
 * a separate, scarier browser permission and it is NOT needed to send notes;
 * requesting it here would risk taking note output down with it (the
 * 2026-07-06 PitchFold regression). Every call no-ops until a port is chosen,
 * so importing and calling this is safe in any runtime, incl. Safari.
 */
import { connect } from '@enkerli/webmidi';

let midi = null;          // SuiteMidi handle once connected
let outId = null;         // selected output port id (null = internal Web Audio)
const listeners = new Set();

export function midiSupported() {
  return typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator;
}

/** Enable Web MIDI (output). Returns { ok, outputs } or { ok:false, error }. */
export async function startMidiOut() {
  if (midi) return { ok: true, outputs: outputs() };
  if (!midiSupported()) return { ok: false, error: 'Web MIDI not supported in this browser' };
  try {
    midi = await connect({ sysex: false });
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
  midi.onPortsChanged(() => notify());
  return { ok: true, outputs: outputs() };
}

export function outputs() {
  return midi ? midi.outputs : [];
}

/** Select an output by id (or null for the internal Web Audio preview). */
export function selectOutput(id) {
  outId = id || null;
  if (midi) midi.selectOutput(outId);
  notify();
}

export function selectedOutputId() {
  return outId;
}

/** True when a real MIDI port is chosen (playback should route to MIDI). */
export function midiActive() {
  return !!outId && outputs().some((p) => p.id === outId);
}

export function sendNoteOn(note, velocity = 100, channel = 1) {
  if (midiActive()) midi.sendNoteOn(note, { velocity, channel });
}
export function sendNoteOff(note, channel = 1) {
  if (midiActive()) midi.sendNoteOff(note, { channel });
}
export function allNotesOff(channel = 1) {
  if (midi) midi.allNotesOff({ channel });
}

/** Subscribe to device hot-plug / selection changes. Returns an unsubscribe. */
export function onDevices(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function notify() {
  for (const cb of listeners) cb(outputs());
}
