/**
 * Push the selected scale to the suite (@enkerli/protocol over MIDI SysEx) —
 * the canonical cross-app pair: PickPCS → PitchFold, over an IAC bus (or any
 * MIDI route both ends can see). Broadcast (`to: "*"`), so any suite app that
 * understands a scale push may act on it.
 *
 * Lazy: nothing MIDI happens until the first push (SysEx needs its own
 * browser permission). The output is remembered by NAME (port ids are not
 * stable across sessions).
 */
import { connect } from "@enkerli/webmidi";
import { makeMessage, encodeMessage } from "@enkerli/protocol";

const OUT_KEY = "pickpcs-midi-out-name";
let midi = null;

/**
 * @param {{ mask: number, root?: number, name?: string }} scale
 *   mask: 12-bit pitch-class mask, leftmost = LSB (the suite convention).
 * @returns {Promise<{ ok: boolean, detail: string }>}
 */
export async function pushScale(scale) {
  try {
    midi ??= await connect({ sysex: true });
  } catch (e) {
    return { ok: false, detail: `MIDI unavailable: ${String((e && e.message) || e)}` };
  }
  const outs = midi.outputs;
  if (!outs.length) return { ok: false, detail: "no MIDI outputs (enable an IAC bus)" };

  let saved = null;
  try { saved = globalThis.localStorage?.getItem(OUT_KEY) ?? null; } catch { /* fine */ }
  const port = outs.find((p) => p.name === saved) ?? outs[0];
  midi.selectOutput(port.id);
  try { globalThis.localStorage?.setItem(OUT_KEY, port.name); } catch { /* fine */ }

  const msg = makeMessage("pickpcs", "scale", scale, { to: "*" });
  for (const frame of encodeMessage(msg)) midi.sendSysEx(frame);
  return { ok: true, detail: `→ ${port.name}` };
}
