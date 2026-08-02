#!/usr/bin/env node
// Play each example through Vane's actual engine and measure whether the reed
// re-articulates.
//
//   node examples/articulation/verify.mjs
//
// The tick measurements in the README come from tools/midi-timing.mjs, which
// reads the FILES. This reads the SOUND: it drives the committed
// apps/vane/synth/vane-dsp.wasm — the same engine the webapp runs — with
// waveguide on, synthetic breath on Auto, and no breath controller at all,
// which is exactly the sequencer case these files exist for.
//
// A detached file must show a deep valley at every note boundary; a legato one
// must not. That contrast is the whole claim, and it is not visible in a tick
// dump: a file can have perfect note lengths and still re-attack if the engine
// hands off badly.

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { play, SR } from "./engine.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const BLOCK = 128;

/**
 * At each note boundary: how far did the level fall between the previous note
 * settling and the new note arriving, as a fraction of what was being held?
 *
 * A transition where nothing at all was sounding beforehand is reported as
 * `silent` rather than skipped. That is not missing data — it is the strongest
 * possible detachment, and an earlier version of this script dropped those
 * transitions and then declared the fully-staccato file untestable.
 */
function valleys({ env, ev }) {
  const ons = ev.filter((x) => x.on).map((x) => x.at);
  const at = (t) => env[Math.min(env.length - 1, Math.max(0, Math.round(t * SR / BLOCK)))]?.rms ?? 0;
  const out = [];
  for (let i = 1; i < ons.length; i++) {
    const held = at(ons[i] - 0.02);
    if (held <= 1e-3) { out.push(0); continue; }        // silent beforehand
    let low = Infinity;
    // 90 ms: a slur re-entrains the bore at the new delay length, which takes
    // real time and is louder the wider the interval. Too short a window reads
    // that physical settling as a re-attack.
    for (let t = ons[i] - 0.02; t < ons[i] + 0.09; t += 0.005) low = Math.min(low, at(t));
    out.push(low / held);
  }
  return out;
}

const GROUPS = [
  { name: "rhythmic (one pitch — isolates the envelope)",
    detached: "rhythm-detached.mid",
    slurred: ["rhythm-legato.mid"] },
  { name: "melodic (several pitches — melisma)",
    detached: "line-detached.mid",
    slurred: ["line-legato.mid", "line-overlap.mid"],
    other: ["line-mixed.mid"] },
];

const stat = async (f) => {
  const v = valleys(await play(join(here, f)));
  return { file: f, worst: Math.min(...v), mean: v.reduce((a, b) => a + b, 0) / v.length };
};
const pct = (x) => `${(x * 100).toFixed(0)}%`;

console.log("through vane-dsp.wasm — waveguide on, synthetic breath Auto, NO breath controller");
console.log("(level retained at each note boundary, as a fraction of the level being held)\n");

let bad = 0;
for (const g of GROUPS) {
  console.log(`  ${g.name}`);
  const d = await stat(g.detached);
  console.log(`    ${d.file.padEnd(22)} worst ${pct(d.worst).padStart(4)}  mean ${pct(d.mean).padStart(4)}   detached`);
  for (const f of g.slurred) {
    const r = await stat(f);
    // The CONTRAST is the claim, not an absolute number. A slur re-entrains the
    // bore and legitimately loses some level — how much depends on the interval
    // — so what has to hold is that it keeps several times more than a
    // re-articulation of the same material does. An absolute floor here failed
    // a file that retained 82% on average purely because one wide leap dipped
    // to 48%.
    const ratio = r.mean / Math.max(d.mean, 0.01);
    const ok = ratio >= 3;
    if (!ok) bad++;
    console.log(`    ${r.file.padEnd(22)} worst ${pct(r.worst).padStart(4)}  mean ${pct(r.mean).padStart(4)}`
      + `   ${ratio.toFixed(1)}x the detached file   ${ok ? "ok" : "UNEXPECTED"}`);
  }
  for (const f of g.other ?? []) {
    const r = await stat(f);
    console.log(`    ${r.file.padEnd(22)} worst ${pct(r.worst).padStart(4)}  mean ${pct(r.mean).padStart(4)}   mixed, not asserted`);
  }
  console.log();
}
console.log(bad ? `${bad} file(s) did not behave as named` : "every slurred file holds its breath where the detached one does not");
process.exit(bad ? 1 : 0);
