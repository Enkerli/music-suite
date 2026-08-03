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

/** The tonguing param (wasm id from the manifest, like every other binding). */
const TRANSIENT_GAIN = vaneIdToWasm()["transient-gain"] ?? 44;
/** Portamento time (GloriArp's `slide` — Vane glides automatically on any
 *  connected note-change; this is the ONLY thing missing to make it audible
 *  instead of instant). */
const GLIDE_TIME = vaneIdToWasm()["glide-time"] ?? 10;

/* The three timbre params an articulation may colour. Bore damping is
   deliberately NOT among them: it can cut the sound so far that the model
   needs a long rest before it speaks again (Vane's PhysMod notes), which is
   exactly the kind of thing an automatic modulation must never reach for. */
const BELL_BRIGHT = vaneIdToWasm()["wg-bell-bright"] ?? 28;
const GROWL = vaneIdToWasm()["wg-growl"] ?? 31;
const BREATH_NOISE = vaneIdToWasm()["wg-breath-noise"] ?? 30;
const EMBOUCHURE = vaneIdToWasm()["wg-embouchure"] ?? 22;

/** The manifest's own defaults — the neutral each offset is measured from. */
const TIMBRE_BASE = { bright: 0.7, growl: 0, air: 0.05, embouchure: 0.5 };

/**
 * Articulation → timbre, for a wind model.
 *
 * `attack` already decides how hard a note is TONGUED, but a real player does
 * not only tongue harder on a sforzando — the tone opens and edges. These are
 * offsets from the manifest defaults, scaled by the note's `timbre` depth, so
 * depth 0 posts nothing at all and Vane sounds exactly as it did before.
 *
 * Small on purpose. The point is that an accent reads as an accent and a ghost
 * recedes, not that the synth lurches between presets — and every value stays
 * inside the model's safe range.
 */
export const ARTICULATION_TIMBRE = {
  sforzando: { bright: +0.20, growl: +0.45, air: -0.02 },
  marcato: { bright: +0.12, growl: +0.25, air: -0.01 },
  staccato: { bright: +0.06, growl: +0.10, air: 0 },
  tenuto: { bright: 0, growl: 0, air: 0 },
  "legato-start": { bright: -0.04, growl: 0, air: +0.03 },
  "legato-inside": { bright: -0.08, growl: 0, air: +0.05 },
  "legato-end": { bright: -0.08, growl: 0, air: +0.05 },
  ghost: { bright: -0.25, growl: 0, air: +0.12 },
};

const clamp01 = (x) => Math.max(0, Math.min(1, x));

/**
 * Post the timbre for one note's articulation, in its register.
 *
 * `register` is -1..+1 around middle C (two octaves per unit): the same
 * sforzando is not the same SOUND at the top of the horn as at the bottom.
 * Going up, the embouchure firms and the bell brightens; going down, both
 * relax. The articulation offsets sit on top of that slope, and everything is
 * still scaled by the one `depth`, so 0 posts nothing.
 *
 * Posted on EVERY inflected note while depth > 0, never only when it changes:
 * these are persistent synth params, so a sforzando's growl would otherwise
 * stay on the next twenty notes. Exactly the leak glide-time already documents.
 */
export function applyArticulationTimbre(post, articulation, depth, register = 0) {
  const d = Number.isFinite(depth) ? clamp01(depth) : 0;
  if (!d) return false;
  const t = ARTICULATION_TIMBRE[articulation];
  if (!t) return false;
  const reg = Number.isFinite(register) ? Math.max(-1, Math.min(1, register)) : 0;
  post({ type: "param", id: BELL_BRIGHT, value: clamp01(TIMBRE_BASE.bright + (t.bright + reg * 0.08) * d) });
  post({ type: "param", id: GROWL, value: clamp01(TIMBRE_BASE.growl + t.growl * d) });
  post({ type: "param", id: BREATH_NOISE, value: clamp01(TIMBRE_BASE.air + t.air * d) });
  post({ type: "param", id: EMBOUCHURE, value: clamp01(TIMBRE_BASE.embouchure + reg * 0.12 * d) });
  return true;
}

/** MIDI notes → the -1..+1 register term (middle C centered, ±2 octaves). */
export function registerOf(notes) {
  if (!Array.isArray(notes) || !notes.length) return 0;
  const mean = notes.reduce((a, n) => a + n, 0) / notes.length;
  return Math.max(-1, Math.min(1, (mean - 60) / 24));
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
  const hasDuration = Number.isFinite(b.durationMs) && b.durationMs > 0;
  const env = Array.isArray(b.env) && b.env.length && hasDuration ? b.env : null;
  // Per-note articulation (GloriArp's inflect stage): `attack` retongues (or
  // doesn't — 0 inside a slur) via transient-gain, and the breath ENVELOPE
  // plays out over the note's life — a sforzando bites and swells, a staccato
  // puffs, a marcato releases clean. Vane's amp envelope IS breath, so this
  // is per-note dynamics for real, not just a louder noteOn.
  if (Number.isFinite(b.attack)) post({ type: "param", id: TRANSIENT_GAIN, value: b.attack });
  // Timbre: the articulation colours the TONE, not just the tongue — and in
  // its register, since a high sforzando is a different sound from a low one.
  // Off unless the sender asks for a depth, so nothing changes for existing
  // callers.
  applyArticulationTimbre(post, b.articulation, b.timbre, registerOf(notes));
  // Slides: Vane glides automatically on any connected note-change (breath
  // still flowing) — glide-time is the ONLY thing that decides whether that
  // transition is instant or an audible portamento. Posted EXPLICITLY on
  // every inflected note (never just when promoted): glide-time is a
  // persistent synth param, so a stale nonzero value from a PREVIOUS slide
  // would otherwise leak into a later, unrelated connected transition.
  if (Number.isFinite(b.glideMs)) post({ type: "param", id: GLIDE_TIME, value: b.glideMs });
  if (env) {
    for (const p of env) {
      const value = Math.max(0, Math.min(1, p.value));
      if (p.at <= 0) post({ type: "cc", cc: 2, value });
      else schedule(() => post({ type: "cc", cc: 2, value }), p.at * b.durationMs);
    }
  } else {
    post({ type: "cc", cc: 2, value: vel / 127 }); // breath — the envelope's fuel
  }
  notes.forEach((n, i) => post({ type: "noteOn", note: n, vel, channel: ch(i) }));
  if (hasDuration) schedule(off, b.durationMs);
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
