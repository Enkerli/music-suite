// webmidi-bridge.js — the webapp's MIDI I/O, the standalone counterpart to
// juce-bridge.js.
//
// The workspace has had MIDI since the plugin shipped, but only THERE: the host
// supplied it, `main.js` routed bus notes to `sendNoteOut` and relayed `midiIn`
// as `enkerli-midi` page events. In a browser there was no MIDI at all. This is
// the missing half, and it is deliberately shaped so nothing downstream can
// tell the difference:
//
//   · sendNoteOut(body) takes the SAME body as juce-bridge's, so a caller
//     subscribes to the bus once and only the sink changes.
//   · MIDI in is dispatched as the SAME `enkerli-midi` events the plugin
//     relays, so the Bindings module's control-map path is untouched.
//
// Wraps @enkerli/webmidi (the suite's shared layer), like Serpe's and
// PitchFold's bridges. Every call no-ops until connect() succeeds, so importing
// this is safe in any runtime — including browsers with no Web MIDI at all,
// which is still most Safaris.
import { connect } from "@enkerli/webmidi";

let midi = null;             // SuiteMidi handle once connected
const pending = new Map();   // note → timeout id, for one-shot note-offs

export function midiSupported() {
  return typeof navigator !== "undefined" && "requestMIDIAccess" in navigator;
}

export function midiActive() { return midi != null; }

export function midiPorts() {
  return midi ? { inputs: midi.inputs, outputs: midi.outputs } : { inputs: [], outputs: [] };
}

/**
 * Enable Web MIDI and wire input handlers.
 *
 * Must be called from a user gesture: the browser shows a permission prompt,
 * and a page that asks on load gets denied by reflex.
 *
 * handlers: { onDevices(ports), onMidiIn(detail) } — `detail` is already in the
 * plugin's `enkerli-midi` shape ({kind:"note"|"cc", …}) so the caller can
 * dispatch it verbatim rather than translating twice.
 */
export async function startWebMidi(handlers = {}) {
  if (!midiSupported()) return { ok: false, error: "Web MIDI is not available in this browser" };
  if (midi) return { ok: true, ports: midiPorts() };
  try {
    midi = await connect({ sysex: false });
  } catch (e) {
    // A denied permission lands here too. Chrome already says so in as many
    // words ("Permission to use Web MIDI API was not granted"), so only add the
    // hint when the message does NOT mention it — otherwise the readout says
    // "permission" twice, which reads like two separate problems.
    const msg = String((e && e.message) || e);
    return { ok: false, error: /permission|denied|NotAllowed/i.test(msg) ? msg : `${msg} (permission may have been denied)` };
  }
  if (handlers.onDevices) midi.onPortsChanged(() => handlers.onDevices(midiPorts()));
  if (handlers.onMidiIn) {
    midi.onNoteIn((e) => handlers.onMidiIn({
      kind: "note", note: e.note | 0, channel: (e.channel | 0) || 1,
      // A note-on at velocity 0 IS a note-off; the bindings engine only acts on
      // velocity > 0, so pass it through honestly rather than normalising here.
      velocity: e.on ? (e.velocity | 0) : 0,
    }));
    midi.onControlChange((e) => handlers.onMidiIn({
      kind: "cc", cc: e.cc | 0, channel: (e.channel | 0) || 1, value: e.value | 0,
    }));
  }
  return { ok: true, ports: midiPorts() };
}

export function selectMidiInput(id) { if (midi) midi.selectInput(id || null); }
export function selectMidiOutput(id) { if (midi) midi.selectOutput(id || null); }

/**
 * A bus `note` message → real MIDI. Same body as juce-bridge's sendNoteOut.
 *
 * Three shapes, and they are not interchangeable (modules.js's Mono Merge is
 * the reference):
 *   gate:"off"          → note-offs only
 *   gate:"on"           → note-ons that KEEP RINGING; the sender owns the off
 *   neither, durationMs → a one-shot, off scheduled here
 *
 * A sustained note that never gets its off is a stuck note on real hardware,
 * so the timers are tracked and `sendAllOff` clears them.
 */
export function sendNoteOut(body) {
  if (!midi || !body || !Array.isArray(body.notes)) return;
  const velocity = body.velocity ?? 96;
  const channel = body.channel;
  const opts = channel !== undefined ? { channel } : {};

  if (body.gate === "off") {
    for (const n of body.notes) {
      clearPending(n);
      midi.sendNoteOff(n, opts);
    }
    return;
  }

  for (const n of body.notes) {
    clearPending(n);
    midi.sendNoteOn(n, { velocity, ...opts });
  }
  if (body.gate === "on") return;          // sustained: the sender sends the off

  const ms = body.durationMs ?? 250;
  for (const n of body.notes) {
    const t = setTimeout(() => {
      pending.delete(n);
      if (midi) midi.sendNoteOff(n, opts);
    }, ms);
    pending.set(n, t);
  }
}

function clearPending(note) {
  const t = pending.get(note);
  if (t !== undefined) { clearTimeout(t); pending.delete(note); }
}

/** Panic. Cancels scheduled offs first, or they fire into the silence later. */
export function sendAllOff(channel) {
  for (const t of pending.values()) clearTimeout(t);
  pending.clear();
  if (midi) midi.allNotesOff(channel !== undefined ? { channel } : {});
}

/** Test seam: swap the SuiteMidi handle without a browser. */
export function __setMidiForTests(handle) {
  for (const t of pending.values()) clearTimeout(t);
  pending.clear();
  midi = handle;
}
