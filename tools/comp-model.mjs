#!/usr/bin/env node
/**
 * A comping style → a GloriArp STYLE MODEL.
 *
 *   node tools/comp-model.mjs style.json --chord Cm7 [--takes 24] [-o model.json]
 *   node tools/comp-model.mjs styles/ --each --chord Cm7 -o models/
 *
 * This is the one that plugs into the playflow you already have. Funkastic
 * produced files GloriArp imports as style-models, and GloriArp generates
 * chord-aware phrases from those itself — the same shape as Drum Style
 * generating patterns straight from its style files. A phrase is one bar of one
 * take; a MODEL is the thing you keep.
 *
 * So the chain is:
 *
 *   loops → comp-style (gestures, no harmony) → [pick a chord] → takes as
 *   phrases → learnStyleModel → StyleModel → GloriArp's own samplePhrase
 *
 * and only the bracketed step is new. Everything after it is GloriArp's.
 *
 * THE FRAME IS A CHOICE, NOT AN OBSERVATION — the important caveat. Funkastic's
 * models say "learned from 8 local clips against C-9" because the clips really
 * were played over C-9. A comping style has no chord anywhere in it; its slots
 * are voicing positions. So the frame here is one we PICK in order to realize
 * the slots as pitches, and the model records that in `source`. GloriArp can
 * then adapt away from it, which is exactly what it is for — but nobody should
 * read the frame as something the corpus told us.
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, statSync } from "node:fs";
import { join, basename, resolve } from "node:path";
import { learnStyleModel, validateModel, serializeModel } from "@enkerli/accompaniment";
import { generate, toPhrase, chordSpec } from "./comp-generate.mjs";

/** GloriArp's tick convention: 120 ticks a slot, so grid 4 gives 480/beat. */
export const SLOT_TICKS = 120;

/**
 * How a comp style's bar maps onto a StyleModel's grid.
 *
 * A model's "beat" is one denominator unit — in 12/8 that is an eighth, not a
 * quarter — and `slotCount = bars * numerator * grid`. So the grid is slots per
 * denominator unit, which for a 12-slot 12/8 bar is 1, and for a 12-slot 3/4
 * bar is 4 (sixteenths). Getting this wrong does not throw; it silently puts
 * every onset on the wrong slot.
 */
export function gridFor(style) {
  const { slotsPerBar, meter } = style.grid;
  const num = meter?.numerator;
  if (!slotsPerBar || !num) throw new Error(`style "${style.id}" has no bar length or meter`);
  const grid = slotsPerBar / num;
  if (!Number.isInteger(grid) || grid < 1)
    throw new Error(`style "${style.id}": ${slotsPerBar} slots do not divide ${num} beats evenly `
      + `(grid would be ${grid}) — a StyleModel needs whole slots per beat`);
  return grid;
}

/**
 * Sample `takes` takes and fold them into a model.
 *
 * Many takes rather than one because a model is a distribution over takes, and
 * a single take would hand GloriArp a model that can only reproduce that take.
 * Each take is a different seed, which is how the comp style's own variability
 * reaches the model.
 */
export function toStyleModel(style, { chord, takes = 24, bars = 2, id = null, voicing = null } = {}) {
  if (!chord) throw new Error("a frame chord is required — a comping style has no harmony of its own");
  const grid = gridFor(style);
  const ticksPerBeat = SLOT_TICKS * grid;

  const phrases = [];
  for (let seed = 1; seed <= takes; seed++) {
    const take = generate(style, { bars, seed, pass: 0 });
    phrases.push(toPhrase(take, { chord, ticksPerBeat, slotTicks: SLOT_TICKS, voicing, id: `${style.id}-s${seed}` }));
  }

  const model = learnStyleModel(phrases, {
    id: id ?? style.id,
    role: "comping",
    grid,
    source: {
      note: `sampled from the comping style "${style.id}" (learned from a local corpus, not the corpus) `
        + `and realized over ${chord.symbol}; the frame is a CHOSEN reference, not one the source stated`,
    },
  });
  return { model, grid, ticksPerBeat, phrases: phrases.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const target = args.find((a) => !a.startsWith("-"));
  const opt = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
  const num = (f, d) => { const i = args.indexOf(f); return i >= 0 ? Number(args[i + 1]) : d; };
  if (!target) {
    console.error("usage: comp-model.mjs <style.json|dir> --chord Cm7 [--each] [--takes 24] [--bars 2] [-o out]");
    process.exit(2);
  }
  const chordName = opt("--chord", "Cm7");
  const chord = chordSpec(chordName);
  const out = opt("-o", null);
  const takes = num("--takes", 24), bars = num("--bars", 2);

  const files = args.includes("--each") || statSync(target).isDirectory()
    ? readdirSync(target).filter((f) => f.endsWith(".json")).sort().map((f) => join(target, f))
    : [target];
  const many = files.length > 1;

  let made = 0, failed = 0;
  for (const f of files) {
    let style;
    try { style = JSON.parse(readFileSync(f, "utf8")); } catch (e) { console.error(`skip ${basename(f)}: ${e.message}`); failed++; continue; }
    if (style.kind !== "comp-style") { continue; }
    let r;
    try { r = toStyleModel(style, { chord, takes, bars }); }
    catch (e) { console.error(`skip ${style.id}: ${e.message}`); failed++; continue; }

    /* Validated with GloriArp's own validator, not by eye — an import failure
       is the entire reason this tool exists. */
    const v = validateModel(r.model);
    if (!v.ok) {
      console.error(`${style.id}: produced an INVALID model — a bug here, not in GloriArp:`);
      v.errors.forEach((e) => console.error(`  ${e}`));
      failed++; continue;
    }

    const live = r.model.slots.filter((s) => s.count > 0).length;
    const text = serializeModel(r.model);
    if (out) {
      const dest = many ? (mkdirSync(out, { recursive: true }), join(out, `${r.model.id}.json`)) : out;
      writeFileSync(dest, text);
      made++;
      console.log(`${r.model.id.padEnd(26)} ${r.model.meter.numerator}/${r.model.meter.denominator} · `
        + `grid ${r.grid} · ${r.model.ticksPerBeat} tpb · ${r.model.takes} takes · `
        + `${live}/${r.model.slots.length} live slots · frame ${chordName}`);
    } else console.log(text);
  }
  if (many) {
    console.log(`\n${made} models written${failed ? `, ${failed} skipped` : ""}${out ? ` → ${resolve(out)}` : ""}`);
    if (made === 0 && failed > 0) process.exit(1);
  }
}
