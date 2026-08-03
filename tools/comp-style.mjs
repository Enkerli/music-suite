#!/usr/bin/env node
/**
 * A folder of Strum loops → a COMPING STYLE.
 *
 *   node tools/comp-style.mjs <dir> [-o style.json]
 *   node tools/comp-style.mjs <dir-of-dirs> --each -o styles/ [--prefix ternary-comp]
 *
 * The sibling of tools/drum-style.mjs, and a one-way door for the same reason:
 * Alex, on the licensed loop libraries, "we should use these for testing and
 * learning. They shouldn't appear in any repo." What comes out is per-slot
 * statistics — how often a strum starts here, across which voices, in which
 * direction, how hard. What does not come out is any bar of any file.
 *
 * WHAT MAKES THIS DIFFERENT FROM A DRUM STYLE. A drum style's lanes are drums.
 * These lanes are VOICING SLOTS: the loop says "the third voice from the
 * bottom", and the chord decides what pitch that is. So a comping style carries
 * no harmony at all, which is exactly why one loop serves E7 and Ebmaj7sus2 —
 * and why GloriArp can supply the chord at play time.
 *
 * Gestures, not notes. A strum is a run of adjacent slots swept in ~3 ticks
 * with a direction; stored as six independent onsets it survives, but stored as
 * a gesture it can be re-spread over a different voicing. That is what makes
 * cross-style work possible, so the gesture is the unit here.
 *
 * The decoding this rests on is in docs/CORPUS_GUITAR_COMPING.md, confirmed
 * against the plugin's own audio.
 */

import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join, basename, resolve } from "node:path";
import { parseSMF } from "./midi-timing.mjs";
import { STRUM_KEY_NAMES, ARPEGGIO_OFFSETS, DEFAULT_BASE } from "./strum-playable.mjs";

/**
 * Which note is this pack's "Downstroke"?
 *
 * The thirteen keys are a contiguous block, but the block MOVES: most packs sit
 * at C5 (72), Pop Rocks is the same thirteen keys at C1, and a pack can mix
 * both. Assuming 72 silently discarded every transposed loop as "not this
 * language" — 84 Pop Rocks files, 28 in Factory, 7 in Funk Essence.
 *
 * So find the 13-semitone window holding the most notes. Ties go to a window
 * starting on a C, because that is where Strum puts it, and then to the lower
 * one. Returns null when nothing covers enough to be this language at all.
 */
export function detectBase(notes, minCoverage = 0.9) {
  if (!notes.length) return null;
  /* The base is always a C. Searching every semitone looked more general and
     was simply wrong: a loop that never plays Downstroke has no note at the
     base, so the best-covering window slides up and the whole map shifts —
     "Arpeggio 5" gets read as "Downstroke". Constraining to multiples of 12
     removes the ambiguity, because the thirteen keys span C to C and only one
     C-aligned window can hold them. */
  const lo = Math.min(...notes), hi = Math.max(...notes);
  let best = null;
  for (let b = Math.floor(lo / 12) * 12; b <= hi; b += 12) {
    const inside = notes.filter((n) => n >= b && n <= b + 12).length;
    if (!best || inside > best.inside) best = { base: b, inside };
  }
  if (!best || best.inside / notes.length < minCoverage) return null;
  return best.base;
}

/** Slot index 0..5, low to high, or -1 for an action key. */
const slotOfOffset = (off) => ARPEGGIO_OFFSETS.indexOf(off);
const nameOfOffset = (off) => STRUM_KEY_NAMES[off];

const midiIn = (d) => readdirSync(d).map((e) => join(d, e))
  .filter((p) => statSync(p).isFile() && /\.mid$/i.test(p)).sort();

function stats(xs) {
  if (!xs.length) return null;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
  return { mean: +mean.toFixed(3), sd: +sd.toFixed(3), n: xs.length };
}

/**
 * Bar length in quarters.
 *
 * Taken from the filename when it states a meter ("… 12-8 195-bpm C.mid"),
 * because a guitar part has no timekeeper voice for a heuristic to find and
 * stated metadata beats guessing. x/8 meters are counted in quarters:
 * 12/8 is six, 9/8 is four and a half, 6/8 is three.
 *
 * Everything else is assumed 4/4 and SAYS SO in the style, so a wrong
 * assumption is visible rather than baked in.
 */
export function barQuartersFrom(name) {
  const m = /(\d{1,2})[-\/](\d)\b/.exec(name);
  if (m) {
    const [num, den] = [Number(m[1]), Number(m[2])];
    if (num > 0 && [2, 4, 8, 16].includes(den))
      return { bar: (num / den) * 4, numerator: num, denominator: den, source: `filename ${num}/${den}` };
  }
  return { bar: 4, numerator: 4, denominator: 4, source: "assumed 4/4" };
}

/**
 * Notes → gestures: anything inside a 16th of a quarter is one hand movement.
 *
 * Notes outside the thirteen-key block are dropped, not fatal. Thirteen files
 * across the library carry a stray one or two — a note 86 above Arpeggio 1, a
 * lone 62 — and throwing away an otherwise good loop for that loses far more
 * than it protects. The count is reported so the loss stays visible.
 */
export function gesturesOf(smf, base = DEFAULT_BASE) {
  const keep = smf.notes.filter((n) => n.note >= base && n.note <= base + 12);
  const ns = [...keep].sort((a, b) => a.tick - b.tick);
  const out = [];
  let g = [];
  for (const n of ns) {
    if (g.length && n.tick - g[0].tick > smf.division / 16) { out.push(g); g = []; }
    g.push(n);
  }
  if (g.length) out.push(g);
  return out;
}

/**
 * What kind of hand movement was that?
 *
 * - one action key            → that action, by name
 * - one arpeggio slot         → a pluck on that slot
 * - several arpeggio slots    → a strum: which run, which way, how wide
 *
 * "Mixed" exists because a handful of gestures in the corpus combine an action
 * with slots. It is counted and excluded from the strum statistics rather than
 * being forced into a category it does not fit.
 */
export function classify(g, base = DEFAULT_BASE) {
  const offs = [...new Set(g.map((n) => n.note - base))];
  const slots = offs.map(slotOfOffset).filter((i) => i >= 0);
  const vel = stats(g.map((n) => n.vel));

  if (slots.length === offs.length) {
    if (slots.length === 1) return { kind: `pluck${slots[0] + 1}`, slots, vel };
    const seq = g.map((n) => slotOfOffset(n.note - base));
    const asc = seq.every((v, i) => !i || v > seq[i - 1]);
    const desc = seq.every((v, i) => !i || v < seq[i - 1]);
    const spread = g[g.length - 1].tick - g[0].tick;
    const lo = Math.min(...slots), hi = Math.max(...slots);
    return {
      kind: "strum", slots, vel, spread,
      run: [lo, hi],
      gapped: hi - lo + 1 !== slots.length,          // a skipped voice, which real ones do
      dir: spread === 0 ? "flat" : asc ? "down" : desc ? "up" : "mixed",
    };
  }
  if (offs.length === 1 && offs[0] >= 0 && offs[0] < STRUM_KEY_NAMES.length)
    return { kind: nameOfOffset(offs[0]), slots: [], vel };
  return { kind: "mixed", slots, vel };
}

/** A folder of loops → a style. The packs are flat, so see learnFromFiles. */
export function learnCompStyle(dir, opts = {}) {
  return learnFromFiles(midiIn(dir), { id: basename(dir), label: basename(dir), ...opts });
}

/**
 * Learn from an explicit list of loops.
 *
 * The unit is a GROOVE — the seven loops A..G that are variations on one feel —
 * and the packs store those as sibling files rather than folders, so the caller
 * groups and passes the list. A folder of variations on one groove is rarely
 * ambiguous where a single file often is; that is the whole reason to pool them.
 */
export function learnFromFiles(files, opts = {}) {
  if (!files.length) throw new Error("no files given");

  /* Only files written entirely in the Strum loop language. Several packs mix
     in material from other instruments (Pop Rocks is all of it), and averaging
     those together would produce a style of nothing. */
  const usable = [], skipped = [];
  for (const f of files) {
    const smf = parseSMF(readFileSync(f));
    const base = smf.notes.length ? detectBase(smf.notes.map((n) => n.note)) : null;
    if (base == null) { skipped.push(f); continue; }
    usable.push({ f, smf, base });
  }
  if (!usable.length) throw new Error(`no Strum-language files (${skipped.length} skipped)`);
  const bases = [...new Set(usable.map((u) => u.base))].sort((a, b) => a - b);

  const meter = barQuartersFrom(opts.label ?? basename(usable[0].f));

  /* Grid, from gesture starts rather than notes — a strum's internal spread is
     hand movement, not rhythm, and scoring it as timing error picks the wrong
     division. Same reasoning as collapsing strums before grid-fitting. */
  const fitAll = (div) => {
    let sum = 0, n = 0;
    for (const { smf, base } of usable)
      for (const g of gesturesOf(smf, base)) {
        const b = (g[0].tick / smf.division) * div;
        sum += Math.abs(b - Math.round(b)); n++;
      }
    return { div, err: n ? sum / n : Infinity };
  };
  const fits = [1, 2, 3, 4, 6].map(fitAll).sort((a, b) => a.err - b.err);
  const perBeat = fits[0].div;
  const slotsPerBar = Math.round(meter.bar * perBeat);

  const slots = new Map();          // slot → tallies
  let bars = 0, gestures = 0, mixed = 0;
  for (const { smf, base } of usable) {
    const gs = gesturesOf(smf, base);
    if (!gs.length) continue;
    const span = gs[gs.length - 1][0].tick / smf.division;
    bars += Math.max(1, Math.round(span / meter.bar));
    for (const g of gs) {
      /* Per FILE, not per pack — the transposition can vary inside one pack,
         and normalising by the wrong base turns a downstroke into a slot. */
      const c = classify(g, base);
      gestures++;
      if (c.kind === "mixed") { mixed++; continue; }
      const beat = g[0].tick / smf.division;
      const exact = beat * perBeat;
      const slot = ((Math.round(exact) % slotsPerBar) + slotsPerBar) % slotsPerBar;
      const s = slots.get(slot) ?? slots.set(slot, {
        n: 0, kinds: new Map(), vel: [], push: [], runs: new Map(), dir: new Map(), spread: [],
      }).get(slot);
      s.n++;
      s.kinds.set(c.kind, (s.kinds.get(c.kind) || 0) + 1);
      if (c.vel) s.vel.push(c.vel.mean);
      s.push.push(exact - Math.round(exact));
      if (c.kind === "strum") {
        const key = `${c.run[0]}-${c.run[1]}`;
        s.runs.set(key, (s.runs.get(key) || 0) + 1);
        s.dir.set(c.dir, (s.dir.get(c.dir) || 0) + 1);
        s.spread.push(c.spread / smf.division);      // in quarters, tempo-free
      }
    }
  }

  const dist = (m, total) => Object.fromEntries([...m.entries()]
    .sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, +(v / total).toFixed(3)]));

  return {
    id: opts.id ?? "comp-style",
    kind: "comp-style",
    version: 1,
    /* Provenance, not content: enough to know what this came from, nothing that
       reproduces it. */
    learnedFrom: {
      files: usable.length,
      skipped: skipped.length,
      /* Which transposition(s) the source used. A fact about the reading, not
         content — the style itself is base-free, since slots have no pitch. */
      sourceBases: bases,
      note: opts.note ?? "local corpus, not distributed",
    },
    grid: {
      perBeat,
      barQuarters: meter.bar,
      slotsPerBar,
      /* Kept as numerator/denominator too, not only as quarters: a phrase for
         GloriArp needs the actual time signature, and 12/8 and 6/4 are both
         six quarters. */
      meter: { numerator: meter.numerator, denominator: meter.denominator },
      meterSource: meter.source,
      fit: +fits[0].err.toFixed(4),
      alternatives: fits.slice(1, 3).map((f) => ({ perBeat: f.div, fit: +f.err.toFixed(4) })),
    },
    bars,
    gestures,
    mixedGestures: mixed,
    /* Voices are SLOTS, low to high — no pitch, no drum, no kit. */
    voices: ARPEGGIO_OFFSETS.length,
    slots: [...slots.entries()].sort((a, b) => a[0] - b[0]).map(([slot, s]) => ({
      slot,
      /* Probability a gesture starts here in any given bar. */
      p: bars ? +Math.min(1, s.n / bars).toFixed(3) : null,
      kinds: dist(s.kinds, s.n),
      velocity: stats(s.vel),
      /* Mean displacement from the grid, in slots. Negative is early. This is
         the comping feel and it is the primary content, not a nuance. */
      push: stats(s.push) ? +stats(s.push).mean.toFixed(4) : null,
      pushSd: stats(s.push) ? +stats(s.push).sd.toFixed(4) : null,
      strum: s.runs.size ? {
        runs: dist(s.runs, [...s.runs.values()].reduce((a, b) => a + b, 0)),
        direction: dist(s.dir, [...s.dir.values()].reduce((a, b) => a + b, 0)),
        spreadQuarters: stats(s.spread),
      } : null,
    })),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const target = args.find((a) => !a.startsWith("-"));
  const opt = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
  if (!target) {
    console.error("usage: comp-style.mjs <dir> [--each] [--prefix name] [--note text] [-o out]");
    process.exit(2);
  }
  const out = opt("-o", null), prefix = opt("--prefix", null), note = opt("--note", null);

  /* Generic ids, so a shared style is named for what the music IS rather than
     for the product whose presets it was learned from. Same rule as the drum
     styles: the tempo and the meter are facts about the material, the groove
     name is somebody's branding.
     Meter is in the id because a pack holds many grooves at one tempo — with
     tempo alone, "Factory" would collapse a dozen 120-bpm styles onto one
     filename and quietly overwrite eleven of them. */
  const idFor = (label) => {
    if (!prefix) return label;
    const tempo = /(\d+)[-\s]?bpm/i.exec(label)?.[1];
    const m = /(\d{1,2})[-\/](\d)\b/.exec(label);
    const parts = [prefix, m ? `${m[1]}-${m[2]}` : null, tempo];
    return parts.filter(Boolean).join("-")
      || `${prefix}-${label.toLowerCase().replace(/\W+/g, "-")}`;
  };
  /* Collisions are still possible (two 12-8 grooves at 195). Number them and
     SAY SO — a silently overwritten style looks exactly like a style that was
     never written. */
  const uniq = (() => {
    const seen = new Map();
    return (id) => {
      const n = (seen.get(id) || 0) + 1;
      seen.set(id, n);
      if (n > 1) console.error(`  note: "${id}" taken, writing "${id}-${n}"`);
      return n === 1 ? id : `${id}-${n}`;
    };
  })();

  /* One style per GROOVE. The packs are flat — "Andalusia 170-BPM A.mid" …
     "… G.mid" are seven takes on one feel — so group by the name with the loop
     letter stripped, which is the same unit a folder was for the drum styles. */
  const jobs = [];
  if (args.includes("--by-groove")) {
    const groups = new Map();
    for (const f of midiIn(target)) {
      const g = basename(f).replace(/\s+[A-G](\s*\d+)?\.mid$/i, "");
      (groups.get(g) ?? groups.set(g, []).get(g)).push(f);
    }
    for (const [label, files] of [...groups].sort()) jobs.push({ label, files });
  } else if (args.includes("--each")) {
    for (const p of readdirSync(target).map((e) => join(target, e)).filter((p) => statSync(p).isDirectory()).sort())
      jobs.push({ label: basename(p), files: midiIn(p) });
  } else {
    jobs.push({ label: basename(target), files: midiIn(target) });
  }

  const many = jobs.length > 1;
  let made = 0, failed = 0;
  for (const { label, files } of jobs) {
    let st;
    try { st = learnFromFiles(files, { id: uniq(idFor(label)), label, ...(note ? { note } : {}) }); }
    catch (e) { console.error(`skip ${label}: ${e.message}`); failed++; continue; }
    const json = JSON.stringify(st, null, 1) + "\n";
    if (out) {
      const dest = many
        ? (mkdirSync(out, { recursive: true }), join(out, `${st.id.replace(/\s+/g, "-").toLowerCase()}.json`))
        : out;
      writeFileSync(dest, json);
      made++;
      console.log(`${st.id.padEnd(26)} ${st.grid.perBeat}/beat · ${String(st.grid.slotsPerBar).padStart(2)} slots/bar `
        + `(${st.grid.meterSource}) · ${String(st.bars).padStart(3)} bars · ${String(st.gestures).padStart(4)} gestures · `
        + `${st.slots.length} live slots`);
    } else console.log(json);
  }
  if (many) console.log(`\n${made} styles written${failed ? `, ${failed} skipped` : ""}${out ? ` → ${resolve(out)}` : ""}`);
  /* Every job failing is a broken tool, not a corpus with nothing in it, and
     the per-job "skip" line makes the two look identical — a dozen plausible
     skips once hid a single ReferenceError. Fail loudly instead. */
  if (made === 0 && failed > 0) {
    console.error(`\nnothing was learned from ${failed} candidate${failed > 1 ? "s" : ""} — `
      + `that is a tool failure, not an empty corpus. First reason above.`);
    process.exit(1);
  }
}
