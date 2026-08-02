// Play a MIDI file through Vane's actual engine.
//
// Shared by verify.mjs (which measures the result) and render-audio.mjs (which
// writes it to disk), so the .wav files in this folder are produced by exactly
// the same path as the numbers in the README. Two copies of this would drift,
// and then the audio would stop being evidence for the measurement.
//
// The engine is the committed apps/vane/synth/vane-dsp.wasm — the same build the
// webapp runs.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { parseSMF } from "../../tools/midi-timing.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const wasmBytes = readFileSync(resolve(here, "../../apps/vane/synth/vane-dsp.wasm"));

export const SR = 48000;
const BLOCK = 128;

/**
 * A fresh instance set up for the sequencer case these examples are about:
 * waveguide on, synthetic breath on Auto, mono, and no modulation routes at all
 * so nothing but the notes is shaping the sound.
 */
async function engine() {
  const { instance } = await WebAssembly.instantiate(wasmBytes, {
    wasi_snapshot_preview1: new Proxy({}, { get: () => () => 0 }),
  });
  // WASI-reactor convention — without _initialize the static tables are empty
  // and every note plays at ~8 Hz. The worklet does the same.
  if (instance.exports._initialize) instance.exports._initialize();
  const e = instance.exports;
  e.vane_init(SR);
  e.vane_set_param(8, 0.8);       // output
  e.vane_set_mono(1);             // mono: the bore and the breath hand off
  for (let s = 0; s < 24; s++) e.vane_set_slot(s, 0, 0, 0, 0, 0);   // no mod routes
  e.vane_set_param(30, 1);        // waveguide on
  e.vane_set_param(55, 1);        // synthetic breath: Auto
  return e;
}

/**
 * Play `file` at its real tempo. Returns the rendered samples, a per-block RMS
 * envelope, and the event list.
 *
 * @param tailSec how long to keep rendering after the last event, so the
 *                release is not cut off.
 */
export async function play(file, { tailSec = 0.6 } = {}) {
  const smf = parseSMF(readFileSync(file));
  const bpm = smf.tempos.length ? 60_000_000 / smf.tempos[0].usPerQuarter : 120;
  const tickSec = 60 / bpm / smf.division;
  const ev = [
    ...smf.notes.map((n) => ({ at: n.tick * tickSec, on: true, note: n.note, vel: n.vel })),
    ...smf.offs.map((o) => ({ at: o.tick * tickSec, on: false, note: o.note })),
  ].sort((a, b) => a.at - b.at || (a.on ? 1 : -1));   // offs first at equal time

  const e = await engine();
  const end = ev[ev.length - 1].at + tailSec;
  const samples = new Float32Array(Math.ceil(end * SR / BLOCK) * BLOCK);
  const env = [];
  let k = 0, w = 0;
  for (let s = 0; s < end * SR; s += BLOCK) {
    const t = s / SR;
    while (k < ev.length && ev[k].at <= t) {
      const x = ev[k++];
      if (x.on) e.vane_note_on(x.note, x.vel, 2); else e.vane_note_off(x.note, 2);
    }
    e.vane_render(BLOCK);
    const b = new Float32Array(e.memory.buffer, e.vane_buffer(), BLOCK);
    samples.set(b, w); w += BLOCK;
    let sq = 0; for (const v of b) sq += v * v;
    env.push({ t, rms: Math.sqrt(sq / BLOCK) });
  }
  return { samples: samples.subarray(0, w), env, ev, tickSec, bpm };
}
