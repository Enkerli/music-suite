#!/usr/bin/env node
/**
 * Is a comping style ABSTRACT, and is what it generates DISTINCT?
 *
 *   node tools/comp-style-audit.mjs style.json --source <dir-of-loops>
 *   node tools/comp-style-audit.mjs styles/ --source <packs>/ --each
 *
 * The gate before a learned style may be shared. Alex set the condition:
 * "check that what they generate is distinct and abstract. If not, we'll keep
 * them local until we can come up with something closer to the drumming
 * method." This measures both rather than asserting them.
 *
 * ABSTRACT — how much was thrown away. A style is safe to share when it cannot
 * give the corpus back: many source bars collapsed into few numbers, and a
 * combinatorial space of bars consistent with those numbers. Reported as the
 * collapse ratio and log2 of the space.
 *
 * DISTINCT — whether generation actually explores that space or just replays
 * the source. The honest test is not "does it look different" but "how often is
 * a generated bar EXACTLY a source bar", plus how far the typical generated bar
 * sits from its nearest source neighbour. A style that regurgitates is a
 * container with extra steps, however abstract its file format looks.
 *
 * Both numbers are computed over the same bar fingerprint — the gesture at each
 * slot — because that is what a listener would recognise as "the same bar".
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import { parseSMF } from "./midi-timing.mjs";
import { detectBase, classify, gesturesOf, learnFromFiles } from "./comp-style.mjs";
import { generate } from "./comp-generate.mjs";

/** A bar as a listener would recognise it: which gesture at which slot. */
function fingerprints(smf, base, slotsPerBar, perBeat) {
  const gs = gesturesOf(smf, base);
  const bars = new Map();
  for (const g of gs) {
    const exact = (g[0].tick / smf.division) * perBeat;
    const abs = Math.round(exact);
    const bar = Math.floor(abs / slotsPerBar);
    const slot = ((abs % slotsPerBar) + slotsPerBar) % slotsPerBar;
    const c = classify(g, base);
    const row = bars.get(bar) ?? bars.set(bar, new Array(slotsPerBar).fill("-")).get(bar);
    /* A strum records its run, since "strum 3-5" and "strum 0-5" are audibly
       different bars and collapsing them would flatter the distinctness score. */
    row[slot] = c.kind === "strum" ? `strum${c.run[0]}${c.run[1]}` : c.kind;
  }
  return [...bars.values()].map((r) => r.join("|"));
}

const hamming = (a, b) => {
  const x = a.split("|"), y = b.split("|");
  let d = 0;
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) d++;
  return d;
};

export function audit(style, sourceFiles, { takes = 200, bars = 4 } = {}) {
  const { slotsPerBar, perBeat } = style.grid;

  const source = new Set();
  for (const f of sourceFiles) {
    const smf = parseSMF(readFileSync(f));
    const base = smf.notes.length ? detectBase(smf.notes.map((n) => n.note)) : null;
    if (base == null) continue;
    for (const fp of fingerprints(smf, base, slotsPerBar, perBeat)) source.add(fp);
  }

  /* How many distinct bars are consistent with the style? Each slot
     contributes its own branching: the fire/don't-fire choice when p is not 0
     or 1, times the number of gestures it might pick. Logs, because the raw
     number overflows immediately — which is itself the point. */
  /* Count the numbers the style actually stores, by walking the JSON, rather
     than adding up a formula. A hand-rolled count of "how big is this thing"
     is the easiest number in the report to get quietly wrong, and it is the
     one the compression claim rests on. */
  const countNumbers = (v) => typeof v === "number" ? 1
    : v && typeof v === "object" ? Object.values(v).reduce((a, x) => a + countNumbers(x), 0)
    : 0;
  const numbers = countNumbers(style.slots);

  let log2Space = 0, probabilistic = 0;
  for (const s of style.slots) {
    const kinds = Object.keys(s.kinds ?? {}).length;
    let options = kinds;
    if (s.p > 0 && s.p < 1) { options += 1; probabilistic++; }
    if (s.strum) options += Object.keys(s.strum.runs).length - 1;
    if (options > 1) log2Space += Math.log2(options);
  }

  const gen = new Set();
  let exact = 0, total = 0, nearSum = 0;
  for (let seed = 1; seed <= takes; seed++) {
    const take = generate(style, { bars, seed, pass: 0 });
    const rows = new Map();
    for (const e of take.events) {
      const row = rows.get(e.bar) ?? rows.set(e.bar, new Array(slotsPerBar).fill("-")).get(e.bar);
      row[e.slot] = e.kind === "strum" ? `strum${e.run[0]}${e.run[1]}` : e.kind;
    }
    for (const r of rows.values()) {
      const fp = r.join("|");
      gen.add(fp); total++;
      if (source.has(fp)) exact++;
      let best = slotsPerBar;
      for (const s of source) { const d = hamming(fp, s); if (d < best) best = d; }
      nearSum += best;
    }
  }

  return {
    id: style.id,
    sourceBars: source.size,
    styleNumbers: numbers,
    collapse: source.size ? +(source.size / Math.max(1, numbers)).toFixed(2) : 0,
    probabilisticSlots: probabilistic,
    log2Space: +log2Space.toFixed(1),
    generatedBars: total,
    distinctGenerated: gen.size,
    exactSourceMatches: exact,
    exactRate: +(exact / Math.max(1, total)).toFixed(4),
    meanDistanceToNearestSource: +(nearSum / Math.max(1, total)).toFixed(2),
    slotsPerBar,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const src = args.find((a) => !a.startsWith("-"));
  const opt = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
  if (!src) {
    console.error("usage: comp-style-audit.mjs <loop-dir> [--takes 200] [--bars 4]");
    console.error("  Groups the directory by groove, learns each style, and audits it");
    console.error("  against the very loops it was learned from.");
    process.exit(2);
  }
  const takes = Number(opt("--takes", 200)), bars = Number(opt("--bars", 4));

  /* Learn and audit in one pass, per groove.
     An earlier version took a directory of finished styles and tried to pair
     each with its loops by digging a tempo out of the filename. That matching
     was wrong — the regex pulled "8" out of "ternary-comp-12-8-195" — so every
     style was scored against nearly the whole pack, which inflates the source
     set and makes an exact match look rarer than it is. Learning here removes
     the pairing step rather than making it cleverer. */
  const groups = new Map();
  for (const f of readdirSync(src).filter((f) => /\.mid$/i.test(f)).sort()) {
    const g = f.replace(/\s+[A-G](\s*\d+)?\.mid$/i, "");
    (groups.get(g) ?? groups.set(g, []).get(g)).push(join(src, f));
  }

  console.log(`${"groove".padEnd(30)} ${"srcBars".padStart(7)} ${"numbers".padStart(7)} `
    + `${"log2space".padStart(9)} ${"genBars".padStart(7)} ${"distinct".padStart(8)} `
    + `${"exact".padStart(5)} ${"rate".padStart(7)} ${"dist".padStart(5)}`);
  const rows = [];
  for (const [label, files] of [...groups].sort()) {
    let style;
    try { style = learnFromFiles(files, { id: label, label }); }
    catch (e) { console.error(`skip ${label}: ${e.message}`); continue; }
    const r = audit(style, files, { takes, bars });
    rows.push(r);
    console.log(`${label.slice(0, 30).padEnd(30)} ${String(r.sourceBars).padStart(7)} ${String(r.styleNumbers).padStart(7)} `
      + `${String(r.log2Space).padStart(9)} ${String(r.generatedBars).padStart(7)} ${String(r.distinctGenerated).padStart(8)} `
      + `${String(r.exactSourceMatches).padStart(5)} ${String(r.exactRate).padStart(7)} ${String(r.meanDistanceToNearestSource).padStart(5)}`);
  }
  if (rows.length) {
    const m = (k) => +(rows.reduce((a, r) => a + r[k], 0) / rows.length).toFixed(4);
    const worst = rows.reduce((a, b) => (b.exactRate > a.exactRate ? b : a));
    console.log(`\n${rows.length} grooves · mean exact-match rate ${m("exactRate")} · `
      + `mean distance to nearest source bar ${m("meanDistanceToNearestSource")} of ${rows[0].slotsPerBar} slots`);
    console.log(`worst case: ${worst.id} at ${worst.exactRate} `
      + `(${worst.exactSourceMatches}/${worst.generatedBars} generated bars were verbatim source bars)`);
  }
}
