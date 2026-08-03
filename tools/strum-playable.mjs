#!/usr/bin/env node
/**
 * A Strum GS-2 loop → a MIDI file that actually plays.
 *
 *   node tools/strum-playable.mjs <loop.mid> --chord Cm7 [-o out.mid]
 *   node tools/strum-playable.mjs <loop.mid> --chord F --mode guitar --bars 2
 *
 * WHY THIS EXISTS. A loop dragged out of Strum with `MIDI Drag` contains only
 * Strumming Keys — the thirteen notes 72..84 that say *how* to play, never
 * *what*. Drop that file on the plugin and nothing sounds, in any play mode,
 * because no chord is held. Alex hit exactly this: "the MIDI file doesn't even
 * play the plugin properly in any of the 3 modes."
 *
 * This holds a chord underneath the loop for its whole length, so the file
 * becomes a self-contained performance. That makes the loop language TESTABLE:
 * render this through Strum, and if what comes out matches what the notation
 * predicts, the decoding in docs/CORPUS_GUITAR_COMPING.md is confirmed by ear
 * rather than by statistics alone.
 *
 * THE OUTPUT IS DERIVED FROM THE CORPUS. Write it outside the repo — the loops
 * are licensed library content and never ship (INTENT D7). This tool ships; its
 * output does not.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { basename } from "node:path";
import { parseSMF } from "./midi-timing.mjs";
import { createSMF } from "@enkerli/midi";

/**
 * The Strumming Keys, from the GS-2 manual, as OFFSETS from the base key.
 *
 * Six of them address voicing slots; the other seven are whole-hand actions,
 * which is why those only ever appear alone — a downstroke is one event that
 * strums the entire chord.
 *
 * Offsets rather than absolute notes because the base moves between packs:
 * most sit at C5 (72), but Pop Rocks is the identical thirteen keys based at
 * C1. A pack can even mix the two. Hard-coding 72 would have silently thrown
 * away every transposed loop as "not this language".
 */
export const STRUM_KEY_NAMES = [
  "Downstroke", "Palm mute", "Upstroke", "Alternate bass",
  "Arpeggio 6 (bass)", "Arpeggio 5", "Muffled down",
  "Arpeggio 4", "Muffled up", "Arpeggio 3", "Mute",
  "Arpeggio 2", "Arpeggio 1",
];

/** The default base — C5, what Strum writes unless a pack says otherwise. */
export const DEFAULT_BASE = 72;

/**
 * Offsets of the six voicing slots, ASCENDING — index 0 is the bass.
 *
 * Ascending offset is ascending pitch, so this reads slot 6, 5, 4, 3, 2, 1:
 * Strum numbers the slots downward from the top string, the array counts up
 * from the bottom, and the confusion is worth naming once here rather than
 * rediscovering it at every call site. Slot 6 is the bass of the VOICING, which
 * Movable-Root may put on string 5 — slots, not frets.
 */
export const ARPEGGIO_OFFSETS = STRUM_KEY_NAMES
  .map((n, i) => (n.startsWith("Arpeggio") ? i : -1))
  .filter((i) => i >= 0);           // [4, 5, 7, 9, 11, 12]

/** Absolute-note view at the default base, kept for callers that want it. */
export const STRUMMING_KEYS = Object.fromEntries(
  STRUM_KEY_NAMES.map((name, i) => [DEFAULT_BASE + i, name]));

/** The six slot notes at the default base, low to high. */
export const ARPEGGIO_SLOTS = [76, 77, 79, 81, 83, 84];

const WHITE = new Set([0, 2, 4, 5, 7, 9, 11]);
const isWhite = (p) => WHITE.has(((p % 12) + 12) % 12);
const firstLeft = (root, white) => {
  for (let p = root - 1; p > root - 13; p--) if (isWhite(p) === white) return p;
  throw new Error(`no ${white ? "white" : "black"} key left of ${root}`);
};

/**
 * Chord Keys, per the GS-2 panel: "Root alone, or with the 1st white and/or
 * black keys on its left."
 *
 *   root only            major
 *   + 1st BLACK on left  minor
 *   + 1st WHITE on left  seventh
 *   + both               minor seventh
 *
 * So a chord is at most three keys, and the quality is spelled positionally
 * rather than by interval — the same trick as a keyswitch, on the keys the
 * chord already occupies.
 */
export function chordKeys(root, quality) {
  const keys = [root];
  if (quality === "m" || quality === "m7") keys.push(firstLeft(root, false));
  if (quality === "7" || quality === "m7") keys.push(firstLeft(root, true));
  return keys.sort((a, b) => a - b);
}

const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "Cm7" / "F" / "Bb7" / "60m" → { root, quality }. Octave 4 puts C at 60. */
export function parseChord(spec, octave = 4) {
  const m = /^([A-G])([#b]?)(m?7?|m)$/.exec(spec.trim());
  if (!m) {
    const n = /^(\d+)(m?7?)$/.exec(spec.trim());
    if (n) return { root: +n[1], quality: n[2] || "" };
    throw new Error(`unreadable chord: ${spec} (try C, Cm, C7, Cm7, Bb7)`);
  }
  const root = PC[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) + 12 * (octave + 1);
  return { root, quality: m[3] };
}

/** Pair note-ons with their offs, so held notes keep their real length. */
function withDurations(smf) {
  const offs = [...smf.offs].sort((a, b) => a.tick - b.tick);
  const used = new Set();
  return smf.notes.map((n) => {
    const i = offs.findIndex((o, j) => !used.has(j) && o.note === n.note
      && o.channel === n.channel && o.tick > n.tick);
    if (i >= 0) used.add(i);
    const end = i >= 0 ? offs[i].tick : n.tick + Math.round(smf.division / 8);
    return { pitch: n.note, startTick: n.tick, durationTicks: Math.max(1, end - n.tick), velocity: n.vel };
  });
}

export function makePlayable(loopBytes, { chord = "C", octave = 4, bpm = null, fallbackBpm = null, pad = 0 } = {}) {
  /* readFileSync gives a Buffer, createSMF gives a Uint8Array, and parseSMF
     needs the former's toString(). Accept either. */
  const smf = parseSMF(Buffer.isBuffer(loopBytes) ? loopBytes : Buffer.from(loopBytes));
  const loop = withDurations(smf);
  if (!loop.length) throw new Error("loop has no notes");

  const unknown = [...new Set(loop.map((n) => n.pitch))].filter((p) => !STRUMMING_KEYS[p]);
  const end = Math.max(...loop.map((n) => n.startTick + n.durationTicks));

  const { root, quality } = parseChord(chord, octave);
  const keys = chordKeys(root, quality);
  if (keys.some((k) => STRUMMING_KEYS[k]))
    throw new Error(`chord ${chord} lands on the Strumming Keys (72-84) — pick a lower octave`);

  /* The chord goes down FIRST and comes up LAST. Strum reads the held chord at
     the moment a strumming key fires, so any gap at the edges silences the
     first or last gesture — the exact failure this tool exists to remove. */
  const held = keys.map((pitch) => ({
    pitch, startTick: 0, durationTicks: end + pad, velocity: 80,
  }));

  /* An explicit --bpm wins; then whatever the file states; then the caller's
     fallback (the filename); then 120, which for this corpus is always wrong. */
  const tempo = bpm
    ?? (smf.tempos[0] ? Math.round(6e7 / smf.tempos[0].usPerQuarter) : null)
    ?? fallbackBpm ?? 120;
  return {
    bytes: createSMF([...held, ...loop], {
      bpm: tempo, ticksPerBeat: smf.division,
      trackName: `${chord} · Strum loop`,
    }),
    chord, keys, quality: quality || "maj", tempo, unknown,
    events: loop.length, endTick: end, division: smf.division,
  };
}

/**
 * A probe: every Strumming Key in turn, one per beat, over a held chord.
 *
 * This is the experiment that settles the decoding by ear instead of by
 * statistics. Play it and each beat is one labelled key, in order — so the six
 * Arpeggio slots should walk the strings low to high, and the seven action keys
 * should each strum or mute the whole chord. If beat 5 is not the bass string
 * and beat 13 is not the top one, the map in docs/CORPUS_GUITAR_COMPING.md is
 * wrong and this says so immediately.
 *
 * Synthetic — no corpus content — so unlike the loops it is safe anywhere.
 */
export function makeProbe({ chord = "C", octave = 4, bpm = 90, division = 96, beats = 1 } = {}) {
  const { root, quality } = parseChord(chord, octave);
  const keys = chordKeys(root, quality);
  const step = division * beats;
  const order = Object.keys(STRUMMING_KEYS).map(Number).sort((a, b) => a - b);

  const notes = order.map((pitch, i) => ({
    pitch, startTick: (i + 1) * step, durationTicks: Math.round(step / 2), velocity: 100,
  }));
  const end = (order.length + 2) * step;
  const held = keys.map((pitch) => ({ pitch, startTick: 0, durationTicks: end, velocity: 80 }));

  return {
    bytes: createSMF([...held, ...notes], {
      bpm, ticksPerBeat: division, trackName: `Strum key probe · ${chord}`,
      /* Markers, so the DAW names each beat and you can see what you heard. */
      markers: order.map((p, i) => ({ tick: (i + 1) * step, text: `${p} ${STRUMMING_KEYS[p]}` })),
    }),
    keys, order, chord,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("-"));
  const opt = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };

  if (args.includes("--probe")) {
    const p = makeProbe({ chord: opt("--chord", "C"), octave: +opt("--octave", 4), bpm: +opt("--bpm", 90) });
    const dest = opt("-o", `strum-key-probe [${p.chord}].mid`);
    writeFileSync(dest, p.bytes);
    console.log(`probe over ${p.chord} (keys ${p.keys.join(", ")}), one key per beat:`);
    p.order.forEach((n, i) => console.log(`  beat ${String(i + 1).padStart(2)}  ${n}  ${STRUMMING_KEYS[n]}`));
    console.log(`  → ${dest}\n\nPlay in Strum GS-2, Play Mode = Guitar.`);
    process.exit(0);
  }

  const usage = () => {
    console.error("usage: strum-playable.mjs <loop.mid> --chord Cm7 [--octave 4] [-o out.mid]");
    console.error("       strum-playable.mjs --probe --chord C [-o probe.mid]");
  };
  if (!file) { usage(); process.exit(2); }

  /* A missing input used to surface as a raw ENOENT stack trace, which buries
     the one thing worth saying. The placeholder case is called out by name
     because documentation examples get pasted verbatim — and did. */
  if (/<[^>]*>/.test(file)) {                  // "<loop>.mid" — angle brackets anywhere
    console.error(`"${file}" is a placeholder, not a filename — substitute a real loop.\n`);
    usage();
    process.exit(2);
  }
  if (!existsSync(file)) {
    console.error(`no such file: ${file}\n`);
    usage();
    process.exit(2);
  }

  const out = opt("-o", file.replace(/\.mid$/i, "") + ` [${opt("--chord", "C")}].mid`);
  /* These loops carry no tempo meta, so a bare read plays them at 120 — wrong
     enough to make an A/B against the plugin meaningless. The tempo IS stated,
     in the filename ("… 12-8 195-bpm C.mid"), and using stated metadata beats
     guessing. --bpm still wins. */
  const named = /(\d+)[-\s]?bpm/i.exec(basename(file))?.[1];
  const r = makePlayable(readFileSync(file), {
    chord: opt("--chord", "C"), octave: +opt("--octave", 4),
    bpm: args.includes("--bpm") ? +opt("--bpm") : null,
    fallbackBpm: named ? +named : null,
  });
  writeFileSync(out, r.bytes);
  console.log(`${basename(file)} + ${r.chord} (${r.quality})`);
  console.log(`  chord keys held: ${r.keys.join(", ")}  for ${r.endTick} ticks`);
  console.log(`  ${r.events} strumming events at ${r.division} tpq, ${r.tempo} bpm`);
  if (r.unknown.length) console.log(`  NOT strumming keys, passed through: ${r.unknown.join(", ")}`);
  console.log(`  → ${out}`);
  console.log(`\nPlay this in Strum GS-2 with Play Mode = Guitar.`);
}
