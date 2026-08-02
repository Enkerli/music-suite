#!/usr/bin/env node
/**
 * Drum MIDI → grid, meter and per-drum pattern. (Priorities Tier 2, D2.)
 *
 *   node tools/drum-grid.mjs <file.mid|dir> [--bpm N] [--json]
 *
 * WHAT IT IS FOR. Somebody else's drum loop is a list of ticks. To say anything
 * about it in this suite's terms — to write it as UPI, to learn a style from
 * it — you first have to know what grid it is ON, and that is a guess the file
 * does not contain.
 *
 * THE HARD PART, stated in the plan before any data existed: not misreading
 * TRIPLETS as SWUNG SIXTEENTHS. Both put onsets between the beats; a swung
 * sixteenth sits near 0.5–0.6 of a beat, a triplet near 0.67. Snap to the wrong
 * grid and every later step inherits the error, silently.
 *
 * So this does not snap. It SCORES candidate grids by how far the onsets
 * actually sit from each one, picks by fit, and REPORTS the fit — a number the
 * caller can disbelieve. Explainability is the requirement here more than
 * anywhere (INTENT B5): a confident wrong answer about the grid is worse than
 * no answer.
 *
 * It also measures SWING separately, because a grid of thirds does not mean the
 * material is mechanically tripletised — the EZdrummer jazz waltzes that this
 * was written against sit at ~0.68 of a beat where an exact triplet is 0.667,
 * and that difference is the feel.
 *
 * Corpus discipline: this reads files and prints statistics. The files stay
 * where they are (INTENT D7 — the corpus is never published, only what is
 * derived from it).
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import { parseSMF } from "./midi-timing.mjs";

/**
 * Candidate grids, as divisions of ONE BEAT.
 *
 * 2 and 4 are the straight family, 3 and 6 the triplet family. Including both
 * at two depths is the whole point: 4 and 3 are the pair that gets confused,
 * and scoring them against each other is what decides it rather than an
 * assumption about the genre.
 */
const DIVISIONS = [1, 2, 3, 4, 6, 8, 12];

/** Beats per bar to try. 3 for waltzes; the usual suspects otherwise. */
const METERS = [2, 3, 4, 5, 6, 7];

/**
 * How well do these onsets fit a grid of `div` slots per beat?
 *
 * Returns the mean absolute distance from the nearest slot, as a FRACTION OF A
 * SLOT — so 0 is exact and 0.5 is maximally wrong, comparably across grids of
 * different fineness. Without that normalisation a fine grid always "wins",
 * since everything is close to something.
 */
function gridFit(beatPositions, div) {
  if (!beatPositions.length) return { div, err: 1, worst: 1 };
  let sum = 0, worst = 0;
  for (const b of beatPositions) {
    const slot = b * div;
    const d = Math.abs(slot - Math.round(slot));   // in slots
    sum += d;
    if (d > worst) worst = d;
  }
  return { div, err: sum / beatPositions.length, worst };
}

/**
 * Swing, measured as where the OFF-slots actually land.
 *
 * For a grid of `div`, take the onsets nearest each non-integer slot and report
 * their mean position within the beat. An exact triplet upbeat is 0.667; jazz
 * ride patterns run late of that. Reported rather than corrected — it is the
 * feel, not an error.
 */
function swingOf(beatPositions, div) {
  const offs = [];
  for (const b of beatPositions) {
    const frac = b - Math.floor(b);
    const slot = Math.round(frac * div);
    if (slot === 0 || slot === div) continue;         // on the beat
    offs.push({ nominal: slot / div, actual: frac });
  }
  if (!offs.length) return null;
  const byNominal = new Map();
  for (const o of offs) {
    const k = o.nominal.toFixed(3);
    (byNominal.get(k) ?? byNominal.set(k, []).get(k)).push(o.actual);
  }
  return [...byNominal.entries()]
    .map(([nominal, xs]) => ({
      nominal: +nominal,
      actual: +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(4),
      n: xs.length,
    }))
    .sort((a, b) => a.nominal - b.nominal);
}

/** Every .mid under a path. */
function midiFiles(p) {
  if (statSync(p).isFile()) return [p];
  const out = [];
  (function walk(d) {
    for (const e of readdirSync(d)) {
      const f = join(d, e);
      statSync(f).isDirectory() ? walk(f) : /\.mid$/i.test(e) && out.push(f);
    }
  })(p);
  return out.sort();
}

export function analyseFile(file) {
  const smf = parseSMF(readFileSync(file));
  const div = smf.division;
  const beats = smf.notes.map((n) => n.tick / div);
  const fits = DIVISIONS.map((d) => gridFit(beats, d)).sort((a, b) => a.err - b.err);

  // Pick the COARSEST grid that fits about as well as the best one. A finer
  // grid can never fit worse, so "lowest error" alone always over-subdivides —
  // it would call a straight backbeat a 12-tuplet because nothing contradicts
  // that. Within 25% of the best error is treated as "no better, and simpler".
  const best = fits[0];
  const chosen = DIVISIONS
    .map((d) => fits.find((f) => f.div === d))
    .find((f) => f.err <= best.err * 1.25 + 0.005) ?? best;

  // Meter: what does the TIMEKEEPER voice say?
  //
  // Three heuristics were tried and rejected, which is worth recording because
  // all three looked reasonable and two produced confident wrong answers:
  //
  //   "most onsets on beat 1" — rewards small meters for free (every second
  //   beat is a downbeat in 2, every third in 3). Called a waltz 2/4.
  //
  //   "downbeat is louder" — a real signal but weak: 3/4 on only 30 of 104
  //   known waltzes, and confident 7s and 5s on the rest.
  //
  //   "periodicity sharpness" (entropy of the folded histogram) — fails on
  //   DENSE material. A ride hitting most triplets fills the histogram at any
  //   bar length, so every meter scores alike and the tie-break decides. 94 of
  //   104 came back as 2.
  //
  // What works is a measurement rather than a score. A kit has a voice that
  // marks the bar — the hi-hat pedal in these waltzes, hitting once per bar and
  // nothing else. So: for each drum, find its typical spacing; if a drum plays
  // EVENLY at some interval, that interval is a bar candidate, and the sparsest
  // such voice is the most likely bar marker. Sparse voices are informative
  // here precisely because dense ones are not.
  const span = Math.max(...beats, 0);
  const byNoteForMeter = new Map();
  for (const n of smf.notes) (byNoteForMeter.get(n.note) ?? byNoteForMeter.set(n.note, []).get(n.note)).push(n.tick / div);
  const votes = [];
  for (const [note, bs] of byNoteForMeter) {
    if (bs.length < 3) continue;
    const sorted = [...bs].sort((a, b) => a - b);
    const iois = sorted.slice(1).map((b, i) => b - sorted[i]);
    const med = [...iois].sort((a, b) => a - b)[iois.length >> 1];
    // Regular? Most gaps within 10% of the median.
    const regular = iois.filter((x) => Math.abs(x - med) <= Math.max(0.15, med * 0.1)).length / iois.length;
    if (regular < 0.8) continue;
    const m = METERS.find((c) => Math.abs(med - c) < 0.12);
    if (m) votes.push({ note, meter: m, regular: +regular.toFixed(2), hits: bs.length });
  }
  // The sparsest regular voice wins: a drum playing once a bar is naming the
  // bar, one playing four times a bar might be naming the beat.
  votes.sort((a, b) => a.hits - b.hits);
  const meter = votes.length
    ? { meter: votes[0].meter, from: votes[0].note, regular: votes[0].regular, bars: Math.round(span / votes[0].meter) }
    : null;
  const ranked = votes.map((v) => ({ meter: v.meter, from: v.note, regular: v.regular }));

  const byNote = new Map();
  for (const n of smf.notes) (byNote.get(n.note) ?? byNote.set(n.note, []).get(n.note)).push(n);

  return {
    file: basename(file),
    ticksPerBeat: div,
    notes: smf.notes.length,
    beats: +span.toFixed(2),
    grid: { perBeat: chosen.div, meanErrSlots: +chosen.err.toFixed(4), worstErrSlots: +chosen.worst.toFixed(4) },
    alternatives: fits.slice(0, 4).map((f) => ({ perBeat: f.div, err: +f.err.toFixed(4) })),
    // null when no voice plays regularly enough to name a bar — better than a
    // guess, and the caller usually knows the meter anyway.
    meter: meter ? { beatsPerBar: meter.meter, fromNote: meter.from, regularity: meter.regular, bars: meter.bars } : null,
    meterAlternatives: ranked.slice(0, 3),
    swing: swingOf(beats, chosen.div),
    drums: [...byNote.entries()].sort((a, b) => b[1].length - a[1].length).map(([note, ns]) => ({
      note, hits: ns.length,
      velMin: Math.min(...ns.map((n) => n.vel)),
      velMed: ns.map((n) => n.vel).sort((a, b) => a - b)[ns.length >> 1],
      velMax: Math.max(...ns.map((n) => n.vel)),
    })),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const target = args.find((a) => !a.startsWith("--"));
  if (!target) { console.error("usage: drum-grid.mjs <file.mid|dir> [--json]"); process.exit(2); }
  const files = midiFiles(target);
  const all = files.map(analyseFile);

  if (args.includes("--json")) { console.log(JSON.stringify(all, null, 1)); process.exit(0); }

  if (all.length === 1) {
    const a = all[0];
    console.log(`${a.file}`);
    console.log(`  ${a.notes} notes · ${a.beats} beats · ${a.ticksPerBeat} ticks/beat`);
    console.log(`  grid    ${a.grid.perBeat} per beat  (mean ${a.grid.meanErrSlots} slots off, worst ${a.grid.worstErrSlots})`);
    console.log(`  others  ${a.alternatives.map((x) => `${x.perBeat}:${x.err}`).join("  ")}`);
    console.log(a.meter
      ? `  meter   ${a.meter.beatsPerBar}/4 · ${a.meter.bars} bars · from note ${a.meter.fromNote} (${(a.meter.regularity * 100).toFixed(0)}% regular)`
      : `  meter   undetermined — no voice plays regularly enough to name a bar`);
    if (a.swing) for (const s of a.swing)
      console.log(`  swing   slot ${s.nominal.toFixed(3)} played at ${s.actual.toFixed(3)} (${s.n} hits, ${s.actual > s.nominal ? "+" : ""}${((s.actual - s.nominal) * 100).toFixed(1)}% of a beat)`);
    console.log(`  drums   ${a.drums.map((d) => `${d.note}×${d.hits}`).join("  ")}`);
    process.exit(0);
  }

  // Corpus summary: what the FOLDER agrees on, which is the useful question
  // when the files are variations of one groove.
  const tally = (xs) => [...xs.reduce((m, x) => m.set(x, (m.get(x) || 0) + 1), new Map())]
    .sort((a, b) => b[1] - a[1]);
  console.log(`${all.length} files`);
  console.log(`  grid    ${tally(all.map((a) => a.grid.perBeat)).map(([g, c]) => `${g}/beat ×${c}`).join("  ")}`);
  console.log(`  meter   ${tally(all.map((a) => a.meter?.beatsPerBar ?? "undetermined")).map(([m, c]) => `${m} ×${c}`).join("  ")}`);
  const errs = all.map((a) => a.grid.meanErrSlots).sort((x, y) => x - y);
  console.log(`  fit     median ${errs[errs.length >> 1]} slots off, worst file ${errs[errs.length - 1]}`);
  const sw = all.flatMap((a) => a.swing ?? []).filter((s) => s.nominal > 0.3 && s.nominal < 0.8);
  if (sw.length) {
    const w = sw.reduce((acc, s) => ({ n: acc.n + s.n, sum: acc.sum + s.actual * s.n }), { n: 0, sum: 0 });
    console.log(`  swing   upbeats average ${(w.sum / w.n).toFixed(4)} of a beat over ${w.n} hits`);
  }
  const drums = new Map();
  for (const a of all) for (const d of a.drums) drums.set(d.note, (drums.get(d.note) || 0) + d.hits);
  console.log(`  drums   ${[...drums.entries()].sort((a, b) => b[1] - a[1]).map(([n, c]) => `${n}×${c}`).join("  ")}`);
}
