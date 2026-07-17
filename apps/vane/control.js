/**
 * Vane's control-plane adoption (docs/CONTROL_PLANE.md §4–6) — the SECOND app
 * wired in, proving the `control.js` pattern generalizes from Serpe's React app
 * to Vane's vanilla-JS + audio-worklet host. Same idea, different seam.
 *
 * Receive-only for now: a control-plane `param` message addressed to vane
 * (from the workspace bus or another same-origin tab) resolves each manifest id
 * to Vane's wasm param id (from the manifest's `wasmId` fields) and posts it to
 * the audio worklet — so the workspace's Vane control surface drives the real
 * voice. Lives entirely in `synth-main.js` (the STANDALONE host, never loaded
 * under the JUCE plugin), so it cannot affect the plugin UI.
 *
 * `applyVaneParam(post, idToWasm, msg)` is pure over the worklet `post` fn, so
 * it unit-tests without audio or a DOM.
 */
import { validateMessage } from "@enkerli/protocol";
import manifest from "./manifest.json";

/** manifest id → Vane wasm param id, from the manifest's engine-binding fields. */
export function vaneIdToWasm(m = manifest) {
  const map = {};
  for (const p of m.params) if (typeof p.wasmId === "number") map[p.id] = p.wasmId;
  return map;
}

/**
 * Apply a control-plane `param` message to the Vane voice via the worklet
 * `post` function. Native values pass straight through (the wasm expects real
 * units — Hz, ms, 0..1 — exactly what the manifest declares and the workspace
 * sends). Ignores non-param / other-app / unknown ids; returns whether it acted.
 */
export function applyVaneParam(post, idToWasm, msg) {
  if (!msg || (msg.to !== "vane" && msg.to !== "*") || msg.type !== "param") return false;
  const b = msg.body || {};
  const one = (id, value) => {
    const wasmId = idToWasm[id];
    if (wasmId == null || typeof value !== "number") return false;
    post({ type: "param", id: wasmId, value });
    return true;
  };
  if (Array.isArray(b.params)) return b.params.reduce((any, p) => one(p.id, p.value) || any, false);
  if (typeof b.id === "string") return one(b.id, b.value);
  return false;
}

/**
 * Play a `note` message on the voice: post noteOn/noteOff to the worklet (the
 * same path WebMIDI uses). Notes spread across channels MPE-style so a chord is
 * polyphonic. `gate:"off"` releases; a `durationMs` makes it self-releasing.
 * This is what lets a progression / gesture / clip source actually SOUND Vane.
 *
 * CRITICAL for audibility: Vane is a wind-model voice — the amp envelope is
 * driven by breath (CC2) / pressure, NOT by noteOn (a noteOn with no breath is
 * silence by design; `renderVane` headless does exactly this cc2-then-note-on
 * dance). A bus note has no breath stream, so velocity stands in for it:
 * CC2 = velocity/127 is posted before the noteOns, exactly like a wind player
 * tonguing at that dynamic. A live `expr`/cc2 stream (real controller) simply
 * overwrites it afterwards.
 */
export function applyVaneNote(post, msg, schedule = (fn, ms) => setTimeout(fn, ms)) {
  if (!msg || (msg.to !== "vane" && msg.to !== "*") || msg.type !== "note") return false;
  const b = msg.body || {};
  const notes = Array.isArray(b.notes) ? b.notes : [];
  if (!notes.length) return false;
  const vel = Number.isFinite(b.velocity) ? b.velocity : 100;
  const ch = (i) => 2 + (i % 14); // MPE-style: a channel per voice
  const off = () => notes.forEach((n, i) => post({ type: "noteOff", note: n, channel: ch(i) }));
  if (b.gate === "off") { off(); return true; }
  post({ type: "cc", cc: 2, value: vel / 127 }); // breath — the envelope's fuel
  notes.forEach((n, i) => post({ type: "noteOn", note: n, vel, channel: ch(i) }));
  if (Number.isFinite(b.durationMs) && b.durationMs > 0) schedule(off, b.durationMs);
  return true;
}

/**
 * Listen on the shared `enkerli-workspace` bus and drive the voice from
 * incoming param messages. `post` is Vane's worklet poster (a no-op until audio
 * starts, so early messages are safely dropped). Returns a disconnect function.
 */
export function connectVane({ post, channelName = "enkerli-workspace" }) {
  if (typeof BroadcastChannel === "undefined") return () => {};
  const idToWasm = vaneIdToWasm();
  const channel = new BroadcastChannel(channelName);
  channel.onmessage = (e) => {
    if (!validateMessage(e.data).ok) return;
    applyVaneParam(post, idToWasm, e.data) || applyVaneNote(post, e.data);
  };
  return () => channel.close();
}
