#!/usr/bin/env node
/**
 * A comping style → a playable take.
 *
 *   node tools/comp-generate.mjs style.json [--bars 4] [--seed 1] [--pass 0]
 *                                           [--morph 0..1] [--chord Cm7]
 *                                           [--json] [-o out.mid]
 *
 * The counterpart to tools/drum-generate.mjs, and the proof that a comping
 * style is abstract rather than a container: the style holds distributions, and
 * this samples them into a bar that was never in the corpus.
 *
 * Output is the Strum loop language itself — the same thirteen keys the source
 * used — so a generated take can be dropped straight back into the plugin
 * beside a real loop and compared. With `--chord` it writes the chord underneath
 * too (tools/strum-playable.mjs), so the file plays on its own.
 *
 * SEED, PASS, MORPH — the GloriArp convention, from the shared @enkerli/upi
 * `morpher`, so a seed means the same thing here as in `msuite drums gen` and
 * `msuite accompany`. `--seed` names the take, `--pass` is the next time round
 * the loop, and `--morph` is the fraction of decisions that get a new answer
 * between passes.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { morpher } from "@enkerli/upi";
import { createSMF } from "@enkerli/midi";
import { STRUM_KEY_NAMES, ARPEGGIO_OFFSETS, DEFAULT_BASE } from "./strum-playable.mjs";

const offsetOfName = (name) => STRUM_KEY_NAMES.indexOf(name);

/** Weighted choice over a {key: probability} map, using one draw. */
function pick(dist, r) {
  const entries = Object.entries(dist ?? {});
  if (!entries.length) return null;
  const total = entries.reduce((a, [, p]) => a + p, 0);
  let x = r * total;
  for (const [k, p] of entries) { x -= p; if (x <= 0) return k; }
  return entries[entries.length - 1][0];
}

/** Box–Muller-ish: a value from a mean/sd, from one uniform draw. Cheap and
 *  bounded, which matters more here than being exactly Gaussian. */
const around = (mean, sd, r) => mean + (r * 2 - 1) * (sd ?? 0);

/**
 * Sample `bars` bars from a comping style.
 *
 * Every event carries what it needs to be rendered losslessly: the slot it sits
 * on, the gesture, the voices it touches, velocity, and its displacement from
 * the grid. A strum keeps its RUN and DIRECTION rather than being flattened to
 * six onsets — that is what lets it be re-spread over a different voicing later.
 */
export function generate(style, { bars = 4, seed = 1, pass = 0, morph = 0, morphHits, morphDynamics } = {}) {
  const n = style.grid?.slotsPerBar;
  if (!n) throw new Error(`style "${style.id}" has no bar length`);
  const mHits = morphHits ?? morph;
  const mDyn = morphDynamics ?? morph;
  const fire = morpher(seed, pass, mHits);
  const shape = morpher(seed ^ 0x51ed270b, pass, mHits);
  const dyn = morpher(seed ^ 0x2545f491, pass, mDyn);

  const events = [];
  for (let bar = 0; bar < bars; bar++) {
    for (const s of style.slots) {
      /* Draw from every stream on every slot, whether or not the slot fires.
         Drawing only when needed would make a bar depend on how many earlier
         slots happened to fire, and the take would stop being reproducible —
         the same reasoning as morpher's own comment. */
      const roll = fire(), kindR = shape(), runR = shape(), dirR = shape();
      const velR = dyn(), pushR = dyn(), spreadR = dyn();
      if (s.p == null || roll >= s.p) continue;

      const kind = pick(s.kinds, kindR);
      if (!kind || kind === "mixed") continue;
      const velocity = Math.max(1, Math.min(127,
        Math.round(around(s.velocity?.mean ?? 90, s.velocity?.sd ?? 0, velR))));
      const push = around(s.push ?? 0, s.pushSd ?? 0, pushR);

      if (kind === "strum" && s.strum) {
        const [lo, hi] = (pick(s.strum.runs, runR) ?? "0-5").split("-").map(Number);
        const dir = pick(s.strum.direction, dirR) ?? "down";
        const spread = Math.max(0, around(s.strum.spreadQuarters?.mean ?? 0.03,
          s.strum.spreadQuarters?.sd ?? 0, spreadR));
        events.push({ bar, slot: s.slot, kind, run: [lo, hi], dir, spread, velocity, push });
      } else if (/^pluck(\d)$/.test(kind)) {
        events.push({ bar, slot: s.slot, kind, voice: Number(kind[5]) - 1, velocity, push });
      } else {
        events.push({ bar, slot: s.slot, kind, action: kind, velocity, push });
      }
    }
  }
  return {
    style: style.id, bars, seed, pass, morph: { hits: mHits, dynamics: mDyn },
    slotsPerBar: n, perBeat: style.grid.perBeat, barQuarters: style.grid.barQuarters, events,
  };
}

/**
 * A take → notes in the Strum loop language.
 *
 * The strum is expanded HERE and only here: a run of voices swept over its
 * spread, in its direction. Keeping that as a gesture in the take and expanding
 * at render time is the whole point — the same take can be spread differently,
 * or over a voicing with different slots, without relearning anything.
 */
export function toStrumNotes(take, { base = DEFAULT_BASE, division = 96 } = {}) {
  const notes = [];
  const slotTicks = division / take.perBeat;
  for (const e of take.events) {
    const at = (e.bar * take.slotsPerBar + e.slot + e.push) * slotTicks;
    const emit = (off, tick, vel) => notes.push({
      pitch: base + off, startTick: Math.max(0, Math.round(tick)),
      durationTicks: Math.max(1, Math.round(slotTicks * 0.9)), velocity: vel,
    });
    if (e.kind === "strum") {
      const [lo, hi] = e.run;
      const voices = [];
      for (let v = lo; v <= hi; v++) voices.push(v);
      if (e.dir === "up") voices.reverse();
      const spreadTicks = e.dir === "flat" ? 0 : e.spread * division;
      const step = voices.length > 1 ? spreadTicks / (voices.length - 1) : 0;
      voices.forEach((v, i) => emit(ARPEGGIO_OFFSETS[v], at + i * step,
        /* The trailing strings of a sweep are quieter — the pick has slowed.
           Small, but it is the difference between a strum and a chord stab. */
        Math.max(1, Math.round(e.velocity * (1 - 0.06 * i)))));
    } else if (e.kind.startsWith("pluck")) {
      emit(ARPEGGIO_OFFSETS[e.voice], at, e.velocity);
    } else {
      const off = offsetOfName(e.action);
      if (off >= 0) emit(off, at, e.velocity);
    }
  }
  return notes.sort((a, b) => a.startTick - b.startTick || a.pitch - b.pitch);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("-"));
  const opt = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
  const num = (f, d) => { const i = args.indexOf(f); return i >= 0 ? Number(args[i + 1]) : d; };
  if (!file) {
    console.error("usage: comp-generate.mjs style.json [--bars 4] [--seed 1] [--pass 0] [--morph 0..1] [--chord Cm7] [-o out.mid]");
    process.exit(2);
  }
  const style = JSON.parse(readFileSync(file, "utf8"));
  const take = generate(style, {
    bars: num("--bars", 2), seed: num("--seed", 1), pass: num("--pass", 0), morph: num("--morph", 0),
  });
  if (args.includes("--json")) { console.log(JSON.stringify(take, null, 1)); process.exit(0); }

  const division = 96;
  const notes = toStrumNotes(take, { division });
  const bpm = num("--bpm", Number(/(\d+)$/.exec(style.id)?.[1]) || 120);
  const out = opt("-o", null);

  const counts = take.events.reduce((m, e) => m.set(e.kind, (m.get(e.kind) || 0) + 1), new Map());
  console.log(`${style.id} · seed ${take.seed} pass ${take.pass}`
    + (take.morph.hits ? ` · morph ${take.morph.hits}` : "")
    + ` · ${take.bars} bars of ${take.slotsPerBar} slots · ${take.events.length} gestures, ${notes.length} notes`);
  console.log("  " + [...counts].sort((a, b) => b[1] - a[1]).map(([k, c]) => `${k} ${c}`).join(", "));

  if (out) {
    let bytes = createSMF(notes, { bpm, ticksPerBeat: division, trackName: `${style.id} · seed ${take.seed}` });
    const chord = opt("--chord", null);
    if (chord) {
      /* Reuse makePlayable rather than re-implementing the chord hold — one
         rule, one place. It re-reads what we just wrote, which is also a free
         round-trip check on the writer. */
      const { makePlayable } = await import("./strum-playable.mjs");
      bytes = makePlayable(bytes, { chord, bpm }).bytes;
    }
    writeFileSync(out, bytes);
    console.log(`  → ${out}${chord ? `  (with ${chord} held)` : "  (Strumming Keys only — needs a chord)"}`);
  }
}
