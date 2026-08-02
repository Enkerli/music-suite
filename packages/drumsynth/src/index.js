/**
 * @enkerli/drumsynth — a small synthesised kit, and a renderer for it.
 *
 * Six-ish sounds on eight pitch classes (kit.js), synthesised rather than
 * sampled (voices.js), plus `renderHits` to put them on a timeline.
 *
 * SCOPE, deliberately: this renders a list of hits. It does not parse UPI, does
 * not know about lanes or locks or accents, and does not read MIDI. Callers
 * that have a pattern turn it into hits and hand them over — the CLI does this
 * from `parsePolyUPI`, and it uses the SAME lane-lock and mask rules as
 * `upi --midi`, because they come from the same place.
 *
 * The alternative — teaching this package the notation — would have made a
 * second renderer with its own opinions about cycle lock and accent precession,
 * and the last two days have been spent removing exactly that kind of pair.
 */

export { KIT, BY_NOTE, BY_PC, KIT_PCS, resolveDrum, drumForLabel } from "./kit.js";
export { VOICES } from "./voices.js";

import { VOICES } from "./voices.js";
import { resolveDrum } from "./kit.js";

/**
 * @typedef {object} Hit
 * @property {string|number} drum  kit name, GM note, or pitch class
 * @property {number} timeSec      when it strikes
 * @property {number} [velocity]   0..1, default 1
 * @property {object} [params]     per-hit voice overrides (a longer decay for
 *                                 an open hat, a tuned tom…)
 */

/**
 * Render hits into a mono Float32Array.
 *
 * Hits ADD, and nothing is normalised here: two sounds at once should be
 * louder, and a caller that wants headroom applies it once over the whole set —
 * per-file normalisation destroys exactly the comparison these renders exist
 * for (see examples/articulation).
 *
 * @param {Hit[]} hits
 * @param {{sampleRate?:number, tailSec?:number, seed?:number}} [opts]
 */
export function renderHits(hits, opts = {}) {
  const { sampleRate = 48000, tailSec = 1.5, seed = 1 } = opts;
  if (!hits.length) return new Float32Array(0);
  const end = Math.max(...hits.map((h) => h.timeSec)) + tailSec;
  const buf = new Float32Array(Math.ceil(end * sampleRate));

  hits.forEach((h, k) => {
    const name = resolveDrum(h.drum);
    if (!name) return;                       // unclaimed pitch class — silent, see resolveDrum
    const voice = VOICES[name];
    if (!voice) return;
    voice({
      buf,
      at: Math.round(h.timeSec * sampleRate),
      sr: sampleRate,
      velocity: Math.max(0, Math.min(1, h.velocity ?? 1)),
      // Vary the noise per hit so repeated hats do not phase-lock into a tone,
      // but derive it from the INDEX so a render is reproducible.
      seed: seed + k * 2654435761,
    }, h.params ?? {});
  });
  return buf;
}

/** 16-bit mono WAV bytes. Same writer the articulation examples use. */
export function wavMono16(samples, sampleRate = 48000) {
  const n = samples.length;
  const out = new Uint8Array(44 + n * 2);
  const dv = new DataView(out.buffer);
  const ascii = (off, s) => { for (let i = 0; i < s.length; i++) out[off + i] = s.charCodeAt(i); };
  ascii(0, "RIFF"); dv.setUint32(4, 36 + n * 2, true);
  ascii(8, "WAVEfmt "); dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, sampleRate, true); dv.setUint32(28, sampleRate * 2, true);
  dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  ascii(36, "data"); dv.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    dv.setInt16(44 + i * 2, Math.round(v * 32767), true);
  }
  return out;
}
