#!/usr/bin/env node
/**
 * A folder of drum MIDI → a STYLE. (Priorities Tier 2, D3.)
 *
 *   node tools/drum-style.mjs <dir> [-o style.json]
 *   node tools/drum-style.mjs <dir-of-dirs> --each -o styles/ [--prefix name] [--note text]
 *
 * WHY A STYLE AND NOT PATTERNS. Alex, on handing over a licensed EZdrummer
 * library: "we should use these for testing and learning. They shouldn't appear
 * in any repo… I'd rather make them into styles, similar to the way GloriArp
 * works."
 *
 * So this is deliberately a ONE-WAY DOOR. It reads a folder and emits per-slot
 * probabilities and velocity distributions — how often a kick lands on the
 * second triplet of beat 2, and how hard. What it does NOT emit is any
 * particular bar of any particular file. You cannot reconstruct the source from
 * the output, which is the same discipline the jazz corpus has always had
 * (INTENT D7: the corpus is never published, only what is derived from it) and
 * the same shape `learnStyleModel` uses for GloriArp.
 *
 * A style is therefore safe to commit, ship and share. The MIDI it came from
 * stays where it is.
 *
 * Grid and meter come from drum-grid.mjs, so a style inherits its honesty: if
 * the meter could not be determined, the style says so rather than assuming 4.
 */

import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join, basename, resolve } from "node:path";
import { parseSMF } from "./midi-timing.mjs";
import { analyseFile } from "./drum-grid.mjs";
import { resolveDrum, KIT } from "@enkerli/drumsynth";

const midiIn = (d) => readdirSync(d).map((e) => join(d, e))
  .filter((p) => statSync(p).isFile() && /\.mid$/i.test(p)).sort();

/** Mean and standard deviation, rounded — a distribution, not a list of values. */
function stats(xs) {
  if (!xs.length) return null;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
  return { mean: +mean.toFixed(3), sd: +sd.toFixed(3), n: xs.length };
}

/**
 * Learn one style from one folder.
 *
 * The unit is a SLOT: a position in the bar at the detected grid. For each slot
 * and each drum we keep how often it fires, how hard, and how far off the grid
 * it sits — that last one being the feel, which a probability alone throws away.
 */
export function learnStyle(dir, opts = {}) {
  const files = midiIn(dir);
  if (!files.length) throw new Error(`no .mid files in ${dir}`);

  const per = files.map((f) => ({ f, a: analyseFile(f) }));
  // The folder votes. A single file can be ambiguous; a folder of variations on
  // one groove rarely is.
  const mode = (xs) => [...xs.filter((x) => x != null)
    .reduce((m, x) => m.set(x, (m.get(x) || 0) + 1), new Map())]
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const perBeat = mode(per.map((p) => p.a.grid.perBeat));
  const beatsPerBar = mode(per.map((p) => p.a.meter?.beatsPerBar));
  const meterVotes = per.filter((p) => p.a.meter).length;

  if (!perBeat) throw new Error(`could not determine a grid for ${dir}`);
  const slotsPerBar = beatsPerBar ? beatsPerBar * perBeat : null;

  // drum → slot → { hits, velocities, offsets }
  const drums = new Map();
  let bars = 0;
  for (const { f, a } of per) {
    const smf = parseSMF(readFileSync(f));
    const div = smf.division;
    if (beatsPerBar) bars += Math.max(1, Math.round(a.beats / beatsPerBar));
    for (const n of smf.notes) {
      const name = resolveDrum(n.note);
      if (!name) continue;
      const beat = n.tick / div;
      const slotF = beat * perBeat;
      const slot = slotsPerBar ? Math.round(slotF) % slotsPerBar : Math.round(slotF);
      const off = slotF - Math.round(slotF);       // in slots; the feel
      const d = drums.get(name) ?? drums.set(name, new Map()).get(name);
      const s = d.get(slot) ?? d.set(slot, { vel: [], off: [] }).get(slot);
      s.vel.push(n.vel);
      s.off.push(off);
    }
  }

  const out = {
    id: opts.id ?? basename(dir),
    kind: "drum-style",
    version: 1,
    /* Provenance, NOT content. Enough to know what this was learned from and to
       re-run it; nothing that reproduces the source. */
    learnedFrom: { files: files.length, note: opts.note ?? "local corpus, not distributed" },
    grid: { perBeat, beatsPerBar, slotsPerBar,
      meterConfidence: +(meterVotes / files.length).toFixed(2) },
    bars,
    /* Where the off-grid material sits, per grid slot — the swing, kept as a
       measurement rather than folded into the probabilities. */
    swing: (() => {
      const all = per.flatMap((p) => p.a.swing ?? []);
      const by = new Map();
      for (const s of all) (by.get(s.nominal) ?? by.set(s.nominal, []).get(s.nominal)).push([s.actual, s.n]);
      return [...by.entries()].sort((a, b) => a[0] - b[0]).map(([nominal, xs]) => {
        const n = xs.reduce((a, [, c]) => a + c, 0);
        return { nominal, played: +(xs.reduce((a, [v, c]) => a + v * c, 0) / n).toFixed(4), n };
      });
    })(),
    voices: [...drums.entries()]
      .sort((a, b) => [...b[1].values()].reduce((s, x) => s + x.vel.length, 0)
                    - [...a[1].values()].reduce((s, x) => s + x.vel.length, 0))
      .map(([name, slots]) => {
        const total = [...slots.values()].reduce((s, x) => s + x.vel.length, 0);
        return {
          drum: name,
          note: KIT[name]?.note ?? null,
          hits: total,
          slots: [...slots.entries()].sort((a, b) => a[0] - b[0]).map(([slot, s]) => ({
            slot,
            /* The probability this drum fires here in any given bar. THIS is
               what a generator samples; it is a statistic over the whole
               folder, not a step from any one file. */
            p: bars ? +Math.min(1, s.vel.length / bars).toFixed(3) : null,
            velocity: stats(s.vel),
            /* Mean displacement from the grid, in slots. Negative is early. */
            push: stats(s.off) ? +stats(s.off).mean.toFixed(4) : null,
          })),
        };
      }),
  };
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const target = args.find((a) => !a.startsWith("-"));
  const oi = args.indexOf("-o");
  const out = oi >= 0 ? args[oi + 1] : null;
  if (!target) { console.error("usage: drum-style.mjs <dir> [--each] [-o out]"); process.exit(2); }

  // A generic id, so a shared style is named for what it IS rather than for
  // the product whose presets it was learned from. `--prefix jazz-waltz` over a
  // folder called "Waltzing 90" gives `jazz-waltz-90`: the tempo is a fact
  // about the material, the folder name is somebody's branding.
  const pi = args.indexOf("--prefix");
  const prefix = pi >= 0 ? args[pi + 1] : null;
  const ni = args.indexOf("--note");
  const note = ni >= 0 ? args[ni + 1] : null;
  const idFor = (d) => {
    if (!prefix) return basename(d);
    const tempo = basename(d).match(/(\d+)\s*$/)?.[1];
    return tempo ? `${prefix}-${tempo}` : `${prefix}-${basename(d).toLowerCase().replace(/\W+/g, "-")}`;
  };

  const dirs = args.includes("--each")
    ? readdirSync(target).map((e) => join(target, e)).filter((p) => statSync(p).isDirectory())
    : [target];

  for (const d of dirs.sort()) {
    let style;
    try { style = learnStyle(d, { id: idFor(d), ...(note ? { note } : {}) }); }
    catch (e) { console.error(`skip ${basename(d)}: ${e.message}`); continue; }
    const json = JSON.stringify(style, null, 1) + "\n";
    if (out) {
      const dest = args.includes("--each")
        ? (mkdirSync(out, { recursive: true }), join(out, `${style.id.replace(/\s+/g, "-").toLowerCase()}.json`))
        : out;
      writeFileSync(dest, json);
      console.log(`${style.id.padEnd(18)} → ${resolve(dest)}  `
        + `${style.grid.perBeat}/beat · ${style.grid.beatsPerBar ?? "?"}/4 `
        + `(${(style.grid.meterConfidence * 100).toFixed(0)}% sure) · ${style.bars} bars · `
        + style.voices.map((v) => `${v.drum} ${v.hits}`).join(", "));
    } else console.log(json);
  }
}
