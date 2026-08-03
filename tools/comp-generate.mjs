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
    slotsPerBar: n, perBeat: style.grid.perBeat, barQuarters: style.grid.barQuarters,
    /* Carried through so toPhrase can state a real time signature — 12/8 and
       6/4 are both six quarters and a phrase has to say which. */
    meter: style.grid.meter ?? null,
    events,
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

/**
 * A take → a GloriArp `AccompanimentPhrase`.
 *
 * WHY THIS IS NOT JUST A RENAME. A comp style is a DISTRIBUTION and GloriArp
 * imports PHRASES, which are concrete events — the same split the drum work
 * hit ("a style does not play; you sample it"). Handing a style file straight
 * to GloriArp fails validation because it is the wrong kind of object, not
 * because a field is missing. So: sample first, then convert.
 *
 * The chord is the other half. A slot has no pitch — that is the whole point of
 * the loop language — so pitches only exist once a chord is supplied. Without
 * one this still emits a valid phrase, with `voice` and a chord-relative
 * `degree` per event and no `note`, which the schema explicitly allows.
 *
 * WHAT IS INFERRED, and marked as such with `confidence`:
 *   · the VOICING. Strum's real one is not in the MIDI — the probe showed C
 *     major coming out as C3 C3 G3 C4 E4 G4, with slots 6 and 5 on the same
 *     string. The default here is an honest stack of chord tones, not that
 *     shape, so degrees carry confidence 0.5 rather than pretending.
 *   · ARTICULATION. A phrase event has no field for "palm mute", so the mutes
 *     become short quiet full strums and the distinction is recorded in
 *     `annotations` rather than silently dropped. This is the lossy step, and
 *     it is the exact analogue of per-slot microtiming in the drum styles.
 */
export function toPhrase(take, { chord = null, ticksPerBeat = 96, voicing = null, id = null } = {}) {
  const slotTicks = ticksPerBeat / take.perBeat;
  const nVoices = ARPEGGIO_OFFSETS.length;

  /* A default voicing: chord tones stacked upward, doubling from the bottom.
     Not Strum's shape — see above — but a defensible close position. */
  const pcs = chord?.pcs ?? null;
  /* Built by climbing, not by arithmetic on octaves. Placing voice v at
     `12*(oct+1)+pcs[v % n]` reads fine and is wrong whenever the pitch classes
     wrap: Am7 is [9,0,4,7], so voice 1 would land on C3 BELOW the A3 bass. Each
     voice is instead the next note above the previous one with the wanted
     pitch class, which ascends by construction for any chord. */
  const stack = (() => {
    if (voicing || !pcs?.length) return null;
    const out = [];
    let prev = 12 * ((chord.bassOctave ?? 3) + 1) + pcs[0] - 1;
    for (let v = 0; v < nVoices; v++) {
      const pc = pcs[v % pcs.length];
      let n = prev + ((pc - prev) % 12 + 12) % 12;
      if (n <= prev) n += 12;
      out.push(n); prev = n;
    }
    return out;
  })();
  const voiceNote = (v) => (voicing ? voicing[v] ?? null : stack ? stack[v] ?? null : null);
  const degreeOf = (v) => (pcs?.length ? (v % pcs.length) + 1 : v + 1);

  const events = [];
  const push = (v, tick, vel, durTicks) => {
    const note = voiceNote(v);
    const e = {
      onset: Math.max(0, Math.round(tick)),
      duration: Math.max(1, Math.round(durTicks)),
      velocity: Math.max(1, Math.min(127, Math.round(vel))),
      voice: v,
      chordRelation: {
        degree: degreeOf(v), alteration: 0,
        octave: note != null ? Math.floor(note / 12) : (chord?.bassOctave ?? 3) + 1,
        category: "chord-tone",
        confidence: voicing ? 0.9 : 0.5,     // a supplied voicing is trusted; the default stack is a guess
      },
    };
    if (note != null && note >= 0 && note <= 127) { e.note = note; e.pitchClass = ((note % 12) + 12) % 12; }
    events.push(e);
  };

  const sweep = (lo, hi, dir, spreadQ, at, vel, dur) => {
    const vs = [];
    for (let v = lo; v <= hi; v++) vs.push(v);
    if (dir === "up") vs.reverse();
    const spreadTicks = dir === "flat" ? 0 : spreadQ * ticksPerBeat;
    const step = vs.length > 1 ? spreadTicks / (vs.length - 1) : 0;
    vs.forEach((v, i) => push(v, at + i * step, vel * (1 - 0.06 * i), dur));
  };

  const DAMPED = { "Palm mute": 0.75, "Mute": 0.6, "Muffled down": 0.85, "Muffled up": 0.85 };
  for (const e of take.events) {
    const at = (e.bar * take.slotsPerBar + e.slot + e.push) * slotTicks;
    const full = slotTicks * 0.9;
    if (e.kind === "strum") {
      sweep(e.run[0], e.run[1], e.dir, e.spread, at, e.velocity, full);
    } else if (e.kind.startsWith("pluck")) {
      push(e.voice, at, e.velocity, full);
    } else if (e.action === "Downstroke" || e.action === "Upstroke") {
      sweep(0, nVoices - 1, e.action === "Downstroke" ? "down" : "up", 0.03, at, e.velocity, full);
    } else if (DAMPED[e.action] != null) {
      /* Damped: the whole hand, short and quieter. The articulation itself is
         not representable — see annotations. */
      sweep(0, nVoices - 1, e.action === "Muffled up" ? "up" : "down", 0.02, at,
        e.velocity * DAMPED[e.action], slotTicks * 0.25);
    } else if (e.action === "Alternate bass") {
      push(0, at, e.velocity, full);
    }
  }
  events.sort((a, b) => a.onset - b.onset || (a.note ?? 0) - (b.note ?? 0));

  const lengthTicks = Math.round(take.bars * take.slotsPerBar * slotTicks);
  const phrase = {
    v: 1,
    id: id ?? `${take.style}-s${take.seed}p${take.pass}`,
    role: "comping",
    lengthTicks,
    ticksPerBeat,
    meter: take.meter ?? { numerator: 4, denominator: 4 },
    source: { note: "sampled from a comping style learned from a local corpus; not the corpus" },
    events,
    annotations: {
      style: take.style,
      seed: String(take.seed), pass: String(take.pass),
      voicing: voicing ? "supplied" : pcs ? "default stack of chord tones (inferred)" : "none — events carry voice and degree only",
      /* Named rather than dropped: the same discipline as the drum generator
         reporting the microtiming it flattened. */
      lossy: "articulation (palm mute / mute / muffled) has no field in a phrase; damped gestures became short quiet full strums",
    },
  };
  if (chord && pcs?.length) {
    phrase.harmonicFrames = [{
      start: 0, end: lengthTicks,
      chord: { symbol: chord.symbol, rootPc: chord.rootPc, pcs },
    }];
  }
  return phrase;
}

/** "Cm7" → the pcs a phrase frame needs. Small on purpose: this is a bridge to
 *  GloriArp, not a theory engine — @enkerli/theory owns that. */
export function chordSpec(name) {
  const m = /^([A-G])([#b]?)(maj7|m7|m|7|dim|aug|sus4|sus2)?$/.exec(name.trim());
  if (!m) throw new Error(`unreadable chord: ${name} (try C, Am, F7, Cmaj7, Gm7)`);
  const rootPc = ({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]]
    + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) + 12) % 12;
  const iv = { undefined: [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10],
    maj7: [0, 4, 7, 11], dim: [0, 3, 6], aug: [0, 4, 8], sus4: [0, 5, 7], sus2: [0, 2, 7] }[m[3]];
  return { symbol: name, rootPc, pcs: iv.map((i) => (rootPc + i) % 12), bassOctave: 3 };
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

  /* A phrase for GloriArp. Validated here with GloriArp's own validator rather
     than "looks right to me" — an import error is the whole reason this exists. */
  if (args.includes("--phrase")) {
    const chordName = opt("--chord", null);
    const phrase = toPhrase(take, {
      chord: chordName ? chordSpec(chordName) : null,
      ticksPerBeat: num("--tpq", 96),
    });
    const { validatePhrase } = await import("@enkerli/accompaniment");
    const v = validatePhrase(phrase);
    if (!v.ok) {
      console.error(`the phrase this produced is INVALID — that is a bug here, not in GloriArp:`);
      v.errors.forEach((e) => console.error(`  ${e}`));
      process.exit(1);
    }
    const dest = opt("--phrase", null) && !opt("--phrase", "").startsWith("-") ? opt("--phrase") : opt("-o", null);
    const text = JSON.stringify(phrase, null, 2) + "\n";
    if (dest) { writeFileSync(dest, text); console.log(`${phrase.id} · ${phrase.events.length} events · `
      + `${phrase.meter.numerator}/${phrase.meter.denominator} · ${phrase.lengthTicks} ticks`
      + `${chordName ? ` · ${chordName}` : " · no chord, voice+degree only"} → ${dest}`); }
    else console.log(text);
    process.exit(0);
  }

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
