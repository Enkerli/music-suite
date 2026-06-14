/**
 * Chord input — track held MIDI notes from the bridge's midiNotes stream
 * and report the detected chord (ChordID). The processor collects host
 * MIDI in on the audio thread; this maintains the held-note set and runs
 * theory's detector on it.
 *
 * Robustness: a note-off dropped under buffer overflow would leave a note
 * stuck. We guard two ways — `reset()` (a panic), and an idle timeout that
 * clears the held set after a quiet gap so the next chord starts clean.
 */

import { detectChord } from "@enkerli/theory";

export function createChordInput(bridge, { onUpdate, idleMs = 1500 } = {}) {
  const held = new Map(); // note → velocity
  let idleTimer = null;

  const armIdle = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { held.clear(); }, idleMs);
  };

  const off = bridge.onMidiNotes((events) => {
    for (const e of events) {
      if (e.on && e.velocity > 0) held.set(e.note, e.velocity);
      else held.delete(e.note);
    }
    if (held.size > 0) armIdle(); else clearTimeout(idleTimer);
    const notes = [...held.keys()].sort((a, b) => a - b);
    const chord = notes.length >= 2 ? detectChord(notes) : null;
    onUpdate({ notes, chord });
  });

  return {
    stop() { clearTimeout(idleTimer); off(); },
    reset() { clearTimeout(idleTimer); held.clear(); onUpdate({ notes: [], chord: null }); },
  };
}
