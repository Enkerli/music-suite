#!/usr/bin/env node
/**
 * Strum loops → a GloriArp style model, in one step, in chord DEGREES.
 *
 *   node tools/comp-learn.mjs <loop-dir> --by-groove --prefix funk-comp -o models/
 *   node tools/comp-learn.mjs <loop-dir> --frame Cm7 -o model.json
 *
 * This replaces the three-hop chain (comp-style → phrases → model). The middle
 * format was useful for understanding the loops and stays useful for gesture
 * work — cross-style, re-spreading a strum — but nothing about learning a model
 * needs it, and a shorter chain has fewer places to put a slot in the wrong
 * column.
 *
 * WHAT IS EXTRACTED, and why these and not the others:
 *
 *   VELOCITY — measured. It is most of what separates a comp from a ghost.
 *   DURATION — measured, from the loop's own note-offs. This is the whole
 *     articulation story: across the library the damped keys sit at 0.12–0.15
 *     quarters and the open ones at 0.18–0.20, so "palm mute" IS "short". A
 *     plucked instrument that ignores this rings through everything; a clav
 *     needs it as much as a guitar does.
 *   MICROTIMING — measured, per slot, signed.
 *   VOICE and DEGREE — which line of the chord, functionally.
 *
 *   STROKE DIRECTION is dropped. Downstroke and upstroke have the same median
 *     duration (0.198) and near-identical velocity (93.5 vs 91.4) across 9145
 *     events, so keeping them apart would be bookkeeping without a difference.
 *     The gesture layer in comp-style.mjs still has it if it ever matters.
 *
 * A HONEST NOTE ON DEGREES. These loops contain no pitch at all — a slot is a
 * voicing position — so a degree here is a deterministic function of the voice
 * index, and carries no information the voice index did not already have. What
 * it buys is that the model becomes chord-AGNOSTIC: `realizeDegrees` can put it
 * on a chord the corpus never saw, voice-led, instead of replaying pitches.
 * On corpora that DO have pitch (Funkastic, Apple Loops) the same field carries
 * real information, including non-chord tones. This corpus cannot produce an
 * NCT, and the model says so rather than leaving an empty category looking
 * like a finding.
 */

import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join, basename, resolve } from "node:path";
import { learnStyleModel, validateModel, serializeModel } from "@enkerli/accompaniment";
import { parseSMF } from "./midi-timing.mjs";
import { detectBase, barQuartersFrom, gesturesOf, classify } from "./comp-style.mjs";
import { ARPEGGIO_OFFSETS } from "./strum-playable.mjs";
import { chordSpec } from "./comp-generate.mjs";

export const SLOT_TICKS = 120;
const N_VOICES = ARPEGGIO_OFFSETS.length;

/** Pair note-ons with offs so a gesture knows how long it actually rang. */
function withDurations(smf, base) {
  const offs = [...smf.offs].sort((a, b) => a.tick - b.tick);
  const used = new Set();
  const dur = new Map();
  for (const n of smf.notes) {
    if (n.note < base || n.note > base + 12) continue;
    const i = offs.findIndex((o, j) => !used.has(j) && o.note === n.note && o.tick > n.tick);
    if (i >= 0) used.add(i);
    dur.set(n, i >= 0 ? offs[i].tick - n.tick : Math.round(smf.division / 8));
  }
  return dur;
}

/**
 * Which voices does this gesture sound, and how long?
 *
 * The seven whole-hand keys strike the entire chord; the six arpeggio keys
 * strike one line. Damping needs no special case because it already shows up
 * in the measured duration.
 */
export function voicesOf(cls) {
  if (cls.kind === "strum") {
    const [lo, hi] = cls.run;
    return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  }
  const m = /^pluck(\d)$/.exec(cls.kind);
  if (m) return [Number(m[1]) - 1];
  if (cls.kind === "Alternate bass") return [0];
  if (cls.kind === "mixed") return [];
  return Array.from({ length: N_VOICES }, (_, i) => i);   // the whole hand
}

/** One loop → one phrase, in model ticks, with chord relations per event. */
function loopToPhrase(smf, base, { pcs, chord, perBeat, meter, ticksPerBeat, id }) {
  const durs = withDurations(smf, base);
  const toModel = (srcTick) => (srcTick / smf.division) * perBeat * SLOT_TICKS;
  const events = [];
  let lastTick = 0;

  for (const g of gesturesOf(smf, base)) {
    const cls = classify(g, base);
    const voices = voicesOf(cls);
    if (!voices.length) continue;
    /* Velocity and duration come from the gesture's own notes. For a whole-hand
       key that is one note governing the whole chord; for a strum each struck
       line has its own, so use the note nearest that line and fall back to the
       gesture's first. */
    for (let k = 0; k < voices.length; k++) {
      const v = voices[k];
      const src = g[Math.min(k, g.length - 1)];
      const onset = toModel(src.tick);
      const duration = Math.max(1, Math.round(toModel(src.tick + (durs.get(src) ?? 0)) - onset));
      lastTick = Math.max(lastTick, onset + duration);
      const degree = pcs.length ? (v % pcs.length) + 1 : v + 1;
      events.push({
        onset: Math.max(0, Math.round(onset)),
        duration,
        velocity: Math.max(1, Math.min(127, src.vel)),
        voice: v,
        /* No `note`: the loop has no pitch, and inventing one here would put a
           fiction into `notes` that reads exactly like an observation. The
           model carries function; realizeDegrees supplies pitch. */
        chordRelation: {
          degree, alteration: 0, octave: 3 + Math.floor(v / Math.max(1, pcs.length)),
          category: "chord-tone", confidence: 0.5,
        },
      });
    }
  }
  events.sort((a, b) => a.onset - b.onset || (a.voice ?? 0) - (b.voice ?? 0));

  const barTicks = meter.numerator * ticksPerBeat;
  const bars = Math.max(1, Math.round(lastTick / barTicks));
  return {
    v: 1, id, role: "comping",
    lengthTicks: bars * barTicks,
    ticksPerBeat, meter, events,
    harmonicFrames: [{ start: 0, end: bars * barTicks, chord }],
  };
}

export function learnCompModel(files, { chord, id, label = null, note = null } = {}) {
  if (!chord) throw new Error("a frame chord is required — these loops carry no harmony of their own");
  const meterInfo = barQuartersFrom(label ?? basename(files[0] ?? ""));
  const meter = { numerator: meterInfo.numerator, denominator: meterInfo.denominator };

  const usable = [];
  for (const f of files) {
    const smf = parseSMF(readFileSync(f));
    const base = smf.notes.length ? detectBase(smf.notes.map((n) => n.note)) : null;
    if (base != null) usable.push({ f, smf, base });
  }
  if (!usable.length) throw new Error("no Strum-language loops here");

  /* The grid, from gesture starts. Same reasoning as comp-style: a strum's
     internal spread is hand movement, and scoring it as timing error picks a
     finer division than the music has. */
  const fit = (div) => {
    let sum = 0, n = 0;
    for (const { smf, base } of usable)
      for (const g of gesturesOf(smf, base)) {
        const b = (g[0].tick / smf.division) * div;
        sum += Math.abs(b - Math.round(b)); n++;
      }
    return { div, err: n ? sum / n : Infinity };
  };
  const perBeat = [1, 2, 3, 4, 6].map(fit).sort((a, b) => a.err - b.err)[0].div;

  /* A model's beat is one DENOMINATOR unit, so the grid is slots per that, not
     per quarter — 12/8 with an eighth grid is grid 1. Getting this wrong puts
     every onset on the wrong slot without erroring. */
  const slotsPerBar = Math.round(meterInfo.bar * perBeat);
  const grid = slotsPerBar / meter.numerator;
  if (!Number.isInteger(grid) || grid < 1)
    throw new Error(`${slotsPerBar} slots do not divide ${meter.numerator} beats evenly (grid ${grid})`);
  const ticksPerBeat = SLOT_TICKS * grid;

  const phrases = usable.map(({ f, smf, base }, i) =>
    loopToPhrase(smf, base, { pcs: chord.pcs, chord, perBeat, meter, ticksPerBeat, id: `${id}-${i}` }));

  const model = learnStyleModel(phrases, {
    id, role: "comping", grid,
    source: {
      note: note ?? `learned from ${usable.length} local loops; statistics only, not the loops. `
        + `Slots are voicing positions, so degrees follow the voice index and this corpus `
        + `contains no non-chord tones. Frame ${chord.symbol} is a CHOSEN reference, not one the source stated.`,
    },
  });
  return { model, perBeat, grid, ticksPerBeat, loops: usable.length, slotsPerBar };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const target = args.find((a) => !a.startsWith("-"));
  const opt = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
  if (!target) {
    console.error("usage: comp-learn.mjs <loop-dir> [--by-groove] [--prefix name] [--frame Cm7] [-o out]");
    process.exit(2);
  }
  const chord = chordSpec(opt("--frame", "Cm7"));
  const out = opt("-o", null), prefix = opt("--prefix", null);

  const midiIn = (d) => readdirSync(d).map((e) => join(d, e))
    .filter((p) => statSync(p).isFile() && /\.mid$/i.test(p)).sort();

  const jobs = [];
  if (args.includes("--by-groove")) {
    const groups = new Map();
    for (const f of midiIn(target)) {
      const g = basename(f).replace(/\s+[A-G](\s*\d+)?\.mid$/i, "");
      (groups.get(g) ?? groups.set(g, []).get(g)).push(f);
    }
    for (const [label, files] of [...groups].sort()) jobs.push({ label, files });
  } else jobs.push({ label: basename(target), files: midiIn(target) });

  const seen = new Map();
  const idFor = (label) => {
    if (!prefix) return label;
    const tempo = /(\d+)[-\s]?bpm/i.exec(label)?.[1];
    const m = /(\d{1,2})[-\/](\d)\b/.exec(label);
    let id = [prefix, m ? `${m[1]}-${m[2]}` : null, tempo].filter(Boolean).join("-");
    const n = (seen.get(id) || 0) + 1; seen.set(id, n);
    return n === 1 ? id : `${id}-${n}`;
  };

  const many = jobs.length > 1;
  let made = 0, failed = 0;
  for (const { label, files } of jobs) {
    let r;
    try { r = learnCompModel(files, { chord, id: idFor(label), label }); }
    catch (e) { console.error(`skip ${label}: ${e.message}`); failed++; continue; }

    const v = validateModel(r.model);
    if (!v.ok) { console.error(`${r.model.id}: INVALID model — a bug here, not in GloriArp:`);
      v.errors.forEach((e) => console.error(`  ${e}`)); failed++; continue; }

    const live = r.model.slots.filter((s) => s.count > 0).length;
    const withDeg = r.model.slots.filter((s) => s.degrees && Object.keys(s.degrees).length).length;
    const text = serializeModel(r.model);
    if (out) {
      const dest = many ? (mkdirSync(out, { recursive: true }), join(out, `${r.model.id}.json`)) : out;
      writeFileSync(dest, text);
      made++;
      console.log(`${r.model.id.padEnd(26)} ${r.model.meter.numerator}/${r.model.meter.denominator} · `
        + `grid ${r.grid} · ${r.model.ticksPerBeat} tpb · ${r.loops} loops · `
        + `${live}/${r.model.slots.length} live · ${withDeg} slots with degrees`);
    } else console.log(text);
  }
  if (many) {
    console.log(`\n${made} models written${failed ? `, ${failed} skipped` : ""}${out ? ` → ${resolve(out)}` : ""}`);
    if (made === 0 && failed > 0) process.exit(1);
  }
}
