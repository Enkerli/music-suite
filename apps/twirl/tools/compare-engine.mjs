#!/usr/bin/env node
// Does the plugin sound like the page? Renders the same notes through the
// page's own voices (test/render-voices.mjs, Web Audio offline) and through
// twirl-dpf's engine (its tests/render_notes.cpp, built here), both dry, and
// compares each: loudness (RMS, dB), brightness (the spectral centroid over
// the first 85 ms) and length (how long it stays within 30 dB of its peak). Every pack,
// every voice: pluck, bell and blip at middle C, the three drums, the shaker.
// Keeps the web version and the plugin alike as voices change (ROADMAP 13b).
//
//   node apps/twirl/tools/compare-engine.mjs [--dpf ../twirl-dpf] [--json]
//
// Exit 1 if a note is off by more than 2 dB (3 for the noisy ones: snare, hat,
// shaker, whose random noise differs a little each render), 20 % brighter or
// darker, or 25 % longer or shorter (50 ms at least): a difference worth
// hearing, not proof of one.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const here = new URL(".", import.meta.url).pathname;
const opt = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const dpf = opt("dpf", process.env.TWIRL_DPF || join(here, "../../../../twirl-dpf"));
if (!existsSync(join(dpf, "tests/render_notes.cpp"))) { console.error(`No twirl-dpf at ${dpf} (--dpf <path>, or TWIRL_DPF)`); process.exit(2); }

const PACKS = ["paper", "mallets", "felt", "steel", "kalimba", "chip", "chimes"], VOICES = ["pluck", "bell", "blip", "drum", "shake"];
const NOTES = [
  { voice: "pluck", note: 60, midi: 60, yN: 0.5 }, { voice: "bell", note: 72, midi: 60, yN: 0.5 }, { voice: "blip", note: 72, midi: 60, yN: 0.5 },
  { voice: "drum", note: 36, midi: 60, yN: 0.8, kind: "kick" }, { voice: "drum", note: 38, midi: 60, yN: 0.45, kind: "snare" },
  { voice: "drum", note: 42, midi: 60, yN: 0.1, kind: "hat" }, { voice: "shake", note: 70, midi: 60, yN: 0.5 },
];
const VEL = 0.8, SR = 48000;
const list = PACKS.flatMap((pack) => NOTES.map((n) => ({ pack, vel: VEL, ...n })));

const out = mkdtempSync(join(tmpdir(), "twirl-compare-"));
execFileSync("node", [join(here, "../test/render-voices.mjs"), out, JSON.stringify(list.map(({ kind, ...j }) => j))], { stdio: "ignore" });
execFileSync("make", ["-C", dpf, "build/render_notes"], { stdio: "ignore" });
const lines = list.map((j, i) => `e${i} ${PACKS.indexOf(j.pack)} ${VOICES.indexOf(j.voice)} ${j.midi} ${j.vel} ${j.yN} 2`).join("\n") + "\n";
execFileSync(join(dpf, "build/render_notes"), [out], { input: lines });

const read = (f) => { const b = readFileSync(f); return new Float32Array(b.buffer, b.byteOffset, b.length / 4); };
function measure(x) {
  const frame = 480, env = [];                                   // 10 ms frames
  for (let i = 0; i + frame <= x.length; i += frame) { let s = 0; for (let k = 0; k < frame; k++) s += x[i + k] ** 2; env.push(Math.sqrt(s / frame)); }
  let s = 0; for (const v of x) s += v * v;
  const rms = 10 * Math.log10(s / x.length + 1e-20);
  // length: from the first 10 ms within 30 dB of the peak to the last (an arpeggio's loudest note can be any of them)
  const floor = Math.max(...env) * Math.pow(10, -30 / 20);
  const start = env.findIndex((v) => v > floor), end = env.length - [...env].reverse().findIndex((v) => v > floor);
  // brightness: the spectral centroid of the first 4096 samples from the onset (about 85 ms)
  const on = Math.max(0, x.findIndex((v) => Math.abs(v) > 1e-4));
  const N = 4096, re = new Float64Array(N), im = new Float64Array(N);
  for (let i = 0; i < N; i++) re[i] = (x[on + i] || 0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
  fft(re, im);
  let num = 0, den = 0;
  for (let k = 1; k < N / 2; k++) { const m = Math.hypot(re[k], im[k]); num += m * (k * SR) / N; den += m; }
  return { rms, centroid: den ? num / den : 0, length: (end - start) * 0.01 };
}
function fft(re, im) {                                           // in place, radix 2
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) {
    const a = (-2 * Math.PI) / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k], vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
        [cr, ci] = [cr * wr - ci * wi, cr * wi + ci * wr];
      }
    }
  }
}

const rows = list.map((j, i) => {
  const page = measure(read(join(out, `${j.pack}-${j.voice}-${j.note}-${j.vel}.f32`))), engine = measure(read(join(out, `e${i}.f32`)));
  const dB = engine.rms - page.rms, bright = engine.centroid / page.centroid - 1, len = engine.length - page.length;
  const noisy = ["snare", "hat"].includes(j.kind) || j.voice === "shake";   // random noise: a dB or two from one render to the next
  const off = [Math.abs(dB) > (noisy ? 3 : 2) && "level", Math.abs(bright) > 0.2 && "brightness", Math.abs(len) > Math.max(0.05, 0.25 * page.length) && "length"].filter(Boolean);
  return { what: `${j.pack} ${j.kind || j.voice}`, dB: +dB.toFixed(1), bright: Math.round(bright * 100), pageLen: +page.length.toFixed(2), engineLen: +engine.length.toFixed(2), off };
});
if (process.argv.includes("--json")) console.log(JSON.stringify(rows, null, 1));
else {
  console.log("note".padEnd(18), "level dB".padStart(9), "bright %".padStart(9), "length s (page → engine)");
  for (const r of rows) console.log(r.what.padEnd(18), String(r.dB).padStart(9), String(r.bright).padStart(9), `   ${r.pageLen} → ${r.engineLen}`, r.off.length ? `  ✗ ${r.off.join(", ")}` : "");
  const bad = rows.filter((r) => r.off.length).length;
  console.log(bad ? `\n${bad} of ${rows.length} notes differ` : `\nAll ${rows.length} notes alike`);
}
process.exit(rows.some((r) => r.off.length) ? 1 : 0);
