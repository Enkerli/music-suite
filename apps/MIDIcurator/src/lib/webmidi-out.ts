/**
 * webmidi-out.ts — MIDIcurator's standalone MIDI *output* path, so the webapp
 * can audition clips through an external synth (or another suite app over an
 * IAC bus) instead of only the internal Web Audio preview. The plugin build
 * arms clips in the host and has no use for this; it is standalone/browser
 * chrome (gated on !IS_PLUGIN_BUILD).
 *
 * A thin, output-only wrapper over @enkerli/webmidi. Plain MIDI —
 * `sysex: false`. SysEx is a separate, scarier browser permission not needed
 * to send notes; requesting it would risk taking note output down with it
 * (the 2026-07-06 PitchFold regression). Every call no-ops until a port is
 * chosen, so importing this is safe in any runtime (incl. Safari).
 */
import { connect, type SuiteMidi, type MidiPortLike } from '@enkerli/webmidi';

let midi: SuiteMidi | null = null;
let outId: string | null = null;
const listeners = new Set<(ports: MidiPortLike[]) => void>();

/** The sink shape PlaybackEngine consumes (keeps the engine decoupled). */
export interface MidiSink {
  active(): boolean;
  noteOn(note: number, velocity: number, channel?: number): void;
  noteOff(note: number, channel?: number): void;
  allNotesOff(channel?: number): void;
}

export function midiSupported(): boolean {
  return typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator;
}

export async function startMidiOut(): Promise<{ ok: true; outputs: MidiPortLike[] } | { ok: false; error: string }> {
  if (midi) return { ok: true, outputs: outputs() };
  if (!midiSupported()) return { ok: false, error: 'Web MIDI not supported in this browser' };
  try {
    midi = await connect({ sysex: false });
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message ?? e) };
  }
  midi.onPortsChanged(() => notify());
  return { ok: true, outputs: outputs() };
}

export function outputs(): MidiPortLike[] {
  return midi ? midi.outputs : [];
}

/** Select an output by id (or null for the internal Web Audio preview). */
export function selectOutput(id: string | null): void {
  outId = id || null;
  if (midi) midi.selectOutput(outId);
  notify();
}

export function selectedOutputId(): string | null {
  return outId;
}

/** True when a real MIDI port is chosen (playback should route to MIDI). */
export function midiActive(): boolean {
  return !!outId && outputs().some((p) => p.id === outId);
}

export function sendNoteOn(note: number, velocity = 100, channel = 1): void {
  if (midiActive()) midi!.sendNoteOn(note, { velocity, channel });
}
export function sendNoteOff(note: number, channel = 1): void {
  if (midiActive()) midi!.sendNoteOff(note, { channel });
}
export function allNotesOff(channel = 1): void {
  if (midi) midi.allNotesOff({ channel });
}

/** The engine-facing sink, backed by the module singleton. */
export const midiSink: MidiSink = {
  active: midiActive,
  noteOn: sendNoteOn,
  noteOff: sendNoteOff,
  allNotesOff,
};

export function onDevices(cb: (ports: MidiPortLike[]) => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
function notify(): void {
  for (const cb of listeners) cb(outputs());
}
