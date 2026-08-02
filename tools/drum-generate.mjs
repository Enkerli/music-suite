#!/usr/bin/env node
/**
 * A style → a pattern. (Priorities Tier 2, the end of D3.)
 *
 *   node tools/drum-generate.mjs style.json [--bars N] [--seed N] [--pass N] [--json]
 *
 * SEED AND PASS, the same convention GloriArp uses ("every --pass is a fresh
 * take"). A seed names the take; a pass is the next time round the loop, so the
 * same style at the same seed gives a repeatable sequence of DIFFERENT bars
 * rather than the same bar forever. `rng(seed, pass)` already had that
 * signature — the second argument exists for exactly this — and it is the same
 * mulberry32 the C++ engine now runs, so a seed means one thing suite-wide.
 *
 * CAN UPI HOLD THIS? That was the open question, and the answer is: it holds a
 * generated INSTANCE well and cannot hold the STYLE at all — which turns out to
 * be the right division rather than a limitation.
 *
 * A style is a distribution: each slot has a probability, a velocity mean and
 * spread, and a microtiming push. UPI is deterministic notation — there is no
 * spelling for "this slot fires 55% of the time". So the style stays JSON, the
 * same way GloriArp's model.json does, and sampling it produces UPI:
 *
 *   ride=100100101 / snare={00010}001011010 / kick=100010010
 *
 * WHAT SURVIVES the trip:
 *   · which drum plays where            — lanes and their labels
 *   · the grid, including 9-slot bars   — lane length; 3/4 in triplets is just 9
 *   · comps against ghosts              — {accents}, since two velocity levels
 *                                         is what that distinction actually is
 *   · a lane that sits behind the beat  — @±Nms, per lane
 *
 * WHAT DOES NOT:
 *   · per-SLOT microtiming. The style knows the snare drags 0.057 slots on the
 *     "a" of 2 while its other hits are early; UPI has PD(depth) for a whole
 *     lane and @offset for a whole lane, and neither can say "this hit, late".
 *     The generator averages the pushes into one per-lane offset and reports
 *     what it discarded, rather than quietly dropping it.
 *   · velocity beyond two levels. A style holds a mean and a spread per slot;
 *     an accent mask holds loud-or-not. For this corpus that is close to
 *     lossless — comps cluster near 87 and ghosts near 60 — but it is a real
 *     ceiling on material with more gradation.
 *
 * So: UPI for the pattern, JSON for the style, and `--json` here emits full
 * events (velocity and push per hit) for anyone who wants the lossless version
 * to feed a MIDI writer instead.
 */

import { readFileSync } from "node:fs";
import { rng } from "@enkerli/upi";

/**
 * Deterministic sampling. A seed names a take; a pass is the next loop round.
 *
 * Same convention as `msuite accompany --seed/--pass`, and the same PRNG the
 * plugin grows `*N` with since 2026-08-02 — so "seed 7" is one thing across the
 * CLI, the webapp and the engine.
 */
function sampler(seed, pass) { return rng(seed >>> 0, pass >>> 0); }

/**
 * Sample `bars` bars from a style.
 *
 * Returns full events — slot, drum, velocity, push — losing nothing. The UPI
 * rendering below is a projection of this, not the other way round.
 */
export function generate(style, { bars = 4, seed = 1, pass = 0 } = {}) {
  const rand = sampler(seed, pass);
  const slotsPerBar = style.grid.slotsPerBar;
  if (!slotsPerBar) throw new Error(`style "${style.id}" has no bar length — meter was undetermined`);

  const events = [];
  for (let bar = 0; bar < bars; bar++) {
    for (const v of style.voices) {
      for (const s of v.slots) {
        if (s.p == null || rand() >= s.p) continue;
        // Velocity from the slot's own distribution, not a global default: the
        // gap between a comped snare and a ghosted one IS the groove.
        const vel = s.velocity
          ? Math.max(1, Math.min(127, Math.round(s.velocity.mean + (rand() * 2 - 1) * s.velocity.sd)))
          : 100;
        events.push({ bar, slot: s.slot, drum: v.drum, note: v.note, velocity: vel, push: s.push ?? 0 });
      }
    }
  }
  return { style: style.id, bars, seed, pass, slotsPerBar, perBeat: style.grid.perBeat, events };
}

/**
 * A generated take → poly UPI.
 *
 * One lane per drum, one bar of slots per lane (bar 1 is the pattern; more bars
 * are variations of the same distribution and would need scenes to spell, which
 * is a different feature). Accents mark the loud half of each lane's own
 * velocity range — "loud for a ghost-heavy snare" is not the same threshold as
 * "loud for a ride".
 */
export function toUPI(take, { bar = 0 } = {}) {
  const n = take.slotsPerBar;
  const lanes = [], lost = [];
  const byDrum = new Map();
  for (const e of take.events) {
    if (e.bar !== bar) continue;
    (byDrum.get(e.drum) ?? byDrum.set(e.drum, []).get(e.drum)).push(e);
  }
  for (const [drum, es] of byDrum) {
    const steps = new Array(n).fill(0);
    const accents = new Array(n).fill(0);
    const vels = es.map((e) => e.velocity);
    // Midpoint of THIS lane's range: a ride at 96-105 and a snare at 60-90 do
    // not share a loudness threshold.
    const mid = (Math.min(...vels) + Math.max(...vels)) / 2;
    for (const e of es) { steps[e.slot] = 1; if (e.velocity > mid) accents[e.slot] = 1; }

    // Per-slot push averaged into ONE lane offset — the lossy step, reported.
    const pushes = es.map((e) => e.push);
    const meanPush = pushes.reduce((a, b) => a + b, 0) / (pushes.length || 1);
    const spread = Math.max(...pushes) - Math.min(...pushes);
    if (spread > 0.02) lost.push({ drum, pushSpreadSlots: +spread.toFixed(3) });

    // The accent mask is indexed over ONSETS (D8 and the 08-02 pass), so it
    // lists only the hits, not the rests.
    const accMask = steps.map((v, i) => (v ? accents[i] : null)).filter((v) => v !== null);
    const hasAcc = accMask.some(Boolean);
    // A slot is a beat/perBeat, so a push of `p` slots is p/perBeat beats.
    const offBeats = meanPush / take.perBeat;
    const offMs = Math.round(offBeats * (60_000 / 120));   // reported at 120bpm
    lanes.push(`${drum}=${hasAcc ? `{${accMask.join("")}}` : ""}${steps.join("")}`
      + (Math.abs(offMs) >= 2 ? `@${offMs > 0 ? "+" : ""}${offMs}ms` : ""));
  }
  return { upi: lanes.join(" / "), lost };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("-"));
  if (!file) { console.error("usage: drum-generate.mjs style.json [--bars N] [--seed N] [--json]"); process.exit(2); }
  const num = (f, d) => { const i = args.indexOf(f); return i >= 0 ? Number(args[i + 1]) : d; };
  const style = JSON.parse(readFileSync(file, "utf8"));
  const take = generate(style, { bars: num("--bars", 4), seed: num("--seed", 1), pass: num("--pass", 0) });

  if (args.includes("--json")) { console.log(JSON.stringify(take, null, 1)); process.exit(0); }

  const { upi, lost } = toUPI(take);
  console.log(upi);
  if (!args.includes("--quiet")) {
    console.error(`\n# ${style.id} · seed ${take.seed} pass ${take.pass} · ${take.slotsPerBar} slots/bar `
      + `(${style.grid.beatsPerBar}/4 at ${style.grid.perBeat} per beat)`);
    if (lost.length) console.error(`# per-slot microtiming flattened to one offset per lane: `
      + lost.map((l) => `${l.drum} spread ${l.pushSpreadSlots} slots`).join(", "));
    console.error(`# --json for the lossless events (velocity and push per hit)`);
  }
}
