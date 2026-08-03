#!/usr/bin/env node
/**
 * Strum loops → GloriArp style models, in bulk.
 *
 *   node tools/comp-learn.mjs <loop-dir> --by-groove --prefix funk-comp -o models/
 *   node tools/comp-learn.mjs <loop-dir> --frame Cm7 -o model.json
 *
 * The learning itself lives in `@enkerli/cli` (src/comping.ts) and is reached
 * from the shell as:
 *
 *   msuite style comp <loops-or-dir…> --chord Cm7 --id name -o model.json
 *
 * which is the one to use for a single style. This stays for the BULK path the
 * CLI does not cover: grouping a flat pack into grooves (the seven loops A..G
 * that are takes on one feel), generic ids with collision numbering, and a
 * summary line per groove.
 *
 * Deliberately NOT a second implementation — it was one for a day. Two copies
 * of a rule drift, and the suite has the scars (INTENT L5). Verified identical:
 * the CLI and this produce byte-equal models for the same loops.
 *
 * What the models contain, and which parts were observed rather than chosen, is
 * in docs/COMPING_STYLES.md.
 */

import { readdirSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join, basename, resolve } from "node:path";
import { learnCompModel } from "@enkerli/cli";
import { validateModel } from "@enkerli/accompaniment";

const midiIn = (d) => readdirSync(d).map((e) => join(d, e))
  .filter((p) => statSync(p).isFile() && /\.mid$/i.test(p)).sort();

const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith("-"));
const opt = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
if (!target) {
  console.error("usage: comp-learn.mjs <loop-dir> [--by-groove] [--prefix name] [--frame Cm7] [-o out]");
  console.error("  for a single style, prefer:  msuite style comp <loops> --chord Cm7 -o model.json");
  process.exit(2);
}
const chord = opt("--frame", "Cm7");
const out = opt("-o", null), prefix = opt("--prefix", null);

/* One job per GROOVE. The packs are flat — "Andalusia 170-BPM A.mid" …
   "… G.mid" are seven takes on one feel — so group by the name with the loop
   letter stripped. */
const jobs = [];
if (args.includes("--by-groove")) {
  const groups = new Map();
  for (const f of midiIn(target)) {
    const g = basename(f).replace(/\s+[A-G](\s*\d+)?\.mid$/i, "");
    (groups.get(g) ?? groups.set(g, []).get(g)).push(f);
  }
  for (const [label, files] of [...groups].sort()) jobs.push({ label, files });
} else jobs.push({ label: basename(target), files: midiIn(target) });

/* Generic ids: what the music IS, not whose preset it was. Meter is in the id
   because a pack holds many grooves at one tempo, and tempo alone would
   collapse a dozen of them onto one filename and quietly overwrite eleven. */
const seen = new Map();
const idFor = (label) => {
  if (!prefix) return label;
  const tempo = /(\d+)[-\s]?bpm/i.exec(label)?.[1];
  const m = /(\d{1,2})[-\/](\d)\b/.exec(label);
  const id = [prefix, m ? `${m[1]}-${m[2]}` : null, tempo].filter(Boolean).join("-");
  const n = (seen.get(id) || 0) + 1;
  seen.set(id, n);
  if (n > 1) console.error(`  note: "${id}" taken, writing "${id}-${n}"`);
  return n === 1 ? id : `${id}-${n}`;
};

const many = jobs.length > 1;
let made = 0, failed = 0;
for (const { label, files } of jobs) {
  let r;
  try { r = learnCompModel({ files, chord, id: idFor(label), label }); }
  catch (e) { console.error(`skip ${label}: ${e.message}`); failed++; continue; }

  const v = validateModel(r.model);
  if (!v.ok) {
    console.error(`${r.model.id}: INVALID model — a bug here, not in GloriArp:`);
    v.errors.forEach((e) => console.error(`  ${e}`));
    failed++; continue;
  }

  const live = r.model.slots.filter((s) => s.count > 0).length;
  const withDeg = r.model.slots.filter((s) => s.degrees && Object.keys(s.degrees).length).length;
  if (out) {
    const dest = many ? (mkdirSync(out, { recursive: true }), join(out, `${r.model.id}.json`)) : out;
    writeFileSync(dest, r.modelJson);
    made++;
    console.log(`${r.model.id.padEnd(26)} ${r.model.meter.numerator}/${r.model.meter.denominator} · `
      + `grid ${r.grid} · ${r.model.ticksPerBeat} tpb · ${r.loops} loops · `
      + `${live}/${r.model.slots.length} live · ${withDeg} slots with degrees`);
  } else console.log(r.modelJson);
}
if (many) {
  console.log(`\n${made} models written${failed ? `, ${failed} skipped` : ""}${out ? ` → ${resolve(out)}` : ""}`);
  /* Every job failing is a broken tool, not an empty corpus, and the per-job
     "skip" line makes the two look identical — a dozen plausible skips once hid
     a single ReferenceError. */
  if (made === 0 && failed > 0) {
    console.error(`\nnothing was learned from ${failed} candidate(s) — that is a tool failure, `
      + `not an empty corpus. First reason above.`);
    process.exit(1);
  }
}
