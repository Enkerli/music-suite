#!/usr/bin/env node
// Render each example .mid to a .wav through Vane's engine.
//
//   node examples/articulation/render-audio.mjs
//
// So the difference can be HEARD without installing the plugin, loading a DAW
// or having a breath controller. Same engine and same settings as verify.mjs
// (shared engine.mjs), so the audio is the measurement, not an illustration of
// it.
//
// Mono, 16-bit, 48 kHz. Mono is not a compromise here: with unison off a Vane
// voice is a centre image (L == R exactly — one of the wasm regression checks),
// so a stereo file would be the same data twice.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { play, SR } from "./engine.mjs";

const here = dirname(fileURLToPath(import.meta.url));

const FILES = [
  "rhythm-detached.mid", "rhythm-legato.mid",
  "line-detached.mid", "line-legato.mid", "line-overlap.mid", "line-mixed.mid",
];

function wavMono16(samples, sampleRate) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16);            // PCM chunk size
  buf.writeUInt16LE(1, 20);             // PCM
  buf.writeUInt16LE(1, 22);             // channels
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);// byte rate
  buf.writeUInt16LE(2, 32);             // block align
  buf.writeUInt16LE(16, 34);            // bits
  buf.write("data", 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  return buf;
}

// Render everything first, then scale them ALL by one factor.
//
// Per-file normalisation would be wrong here and quietly so: these files exist
// to be compared, and a detached take is genuinely quieter than a slurred one
// over the same material — that IS the result. Normalising each to full scale
// would erase it and make the two sound equally loud.
const rendered = [];
for (const f of FILES) rendered.push({ f, ...(await play(join(here, f), { tailSec: 0.8 })) });

let peak = 0;
for (const r of rendered) for (const v of r.samples) peak = Math.max(peak, Math.abs(v));
// The waveguide runs hot (peaks above 1.0 are normal for it), so headroom is
// applied rather than assumed. -1 dBFS on the loudest file in the set.
const gain = peak > 0 ? 0.891 / peak : 1;

console.log(`set peak ${peak.toFixed(3)} → one shared gain ${gain.toFixed(3)} (-1 dBFS), so the files stay comparable\n`);
for (const r of rendered) {
  const out = r.f.replace(/\.mid$/, ".wav");
  const scaled = Float32Array.from(r.samples, (v) => v * gain);
  writeFileSync(join(here, out), wavMono16(scaled, SR));
  // Math.max(...samples) blows the stack at half a million samples — loop.
  let sq = 0, pk = 0;
  for (const v of scaled) { sq += v * v; const a = Math.abs(v); if (a > pk) pk = a; }
  const rms = Math.sqrt(sq / scaled.length);
  console.log(`  ${out.padEnd(22)} ${(scaled.length / SR).toFixed(1)}s`
    + `  peak ${pk.toFixed(3)}  rms ${rms.toFixed(3)}`);
}
