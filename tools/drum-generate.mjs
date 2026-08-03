#!/usr/bin/env node
/**
 * A style → a pattern, from the shell.
 *
 *   node tools/drum-generate.mjs style.json [--bars N] [--seed N] [--pass N]
 *                                           [--morph 0..1] [--json]
 *
 * The logic lives in `@enkerli/drumsynth` (src/style.js) so the CLI can call it
 * — `msuite drums gen` is the same thing and the one to reach for. This stays
 * because it has `--json`, the lossless events with velocity and push per hit,
 * which the CLI does not expose and which is what you want if you are feeding a
 * MIDI writer rather than reading UPI.
 *
 * Deliberately NOT a second implementation. It was one for a day, and two
 * copies of a rule drift (INTENT L5, five incidents).
 */
import { readFileSync } from "node:fs";
import { generate, toUPI } from "@enkerli/drumsynth";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("-"));
if (!file) { console.error("usage: drum-generate.mjs style.json [--seed N] [--pass N] [--morph 0..1] [--json]"); process.exit(2); }
const num = (f, d) => { const i = args.indexOf(f); return i >= 0 ? Number(args[i + 1]) : d; };
const style = JSON.parse(readFileSync(file, "utf8"));
const take = generate(style, {
  bars: num("--bars", 4), seed: num("--seed", 1), pass: num("--pass", 0), morph: num("--morph", 0),
  ...(args.includes("--morph-hits") && { morphHits: num("--morph-hits", 0) }),
  ...(args.includes("--morph-dynamics") && { morphDynamics: num("--morph-dynamics", 0) }),
});

if (args.includes("--json")) { console.log(JSON.stringify(take, null, 1)); process.exit(0); }
const { upi, lost } = toUPI(take);
console.log(upi);
if (!args.includes("--quiet")) {
  console.error(`\n# ${style.id} · seed ${take.seed} pass ${take.pass}`
    + (take.morph.hits || take.morph.dynamics ? ` · morph hits ${take.morph.hits} dynamics ${take.morph.dynamics}` : "")
    + ` · ${take.slotsPerBar} slots/bar`);
  if (lost.length) console.error(`# per-slot microtiming flattened per lane: `
    + lost.map((l) => `${l.drum} ${l.pushSpreadSlots}`).join(", "));
}
