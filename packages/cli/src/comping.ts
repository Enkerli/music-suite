/**
 * Strum-style comping loops → a GloriArp style model.
 *
 * The library half of `msuite style comp`, and the sibling of `learnStyle` in
 * index.ts: same destination, different source material. `learnStyle` reads
 * clips whose notes ARE pitches; this reads loops whose notes are voicing
 * SLOTS, which is a different thing wearing the same file extension.
 *
 * Those loops come out of AAS Strum GS-2's `MIDI Drag`. They contain no pitch
 * at all — thirteen keys in a one-octave block, six of them addressing lines of
 * whatever chord the plugin is told to play. The full decoding, and the probe
 * that confirmed it by ear, are in docs/CORPUS_GUITAR_COMPING.md; the
 * toolchain around it is in docs/COMPING_STYLES.md.
 *
 * WHAT IS OBSERVED: onset, velocity, duration, microtiming, and which voicing
 * position sounded. WHAT IS NOT: pitch. The frame chord is therefore a chosen
 * reference — it fixes which pitches land in `notes` so GloriArp can play the
 * model today — while `degrees` keeps the functional content so
 * `realizeDegrees` can move it onto a chord the corpus never contained.
 */

import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { readSmfNotes } from "@enkerli/midi";
import { parseLeadsheet, realizeLeadsheet } from "@enkerli/theory";
import {
  learnStyleModel, type StyleModel, type AccompanimentPhrase, type FrameChord, type Meter,
} from "@enkerli/accompaniment";

/** The thirteen Strumming Keys, as offsets from the block's base. */
export const STRUM_KEY_NAMES = [
  "Downstroke", "Palm mute", "Upstroke", "Alternate bass",
  "Arpeggio 6 (bass)", "Arpeggio 5", "Muffled down",
  "Arpeggio 4", "Muffled up", "Arpeggio 3", "Mute",
  "Arpeggio 2", "Arpeggio 1",
] as const;

/** Offsets of the six voicing slots, ascending — index 0 is the bass.
 *  Strum numbers slots downward from the top string; this counts up from the
 *  bottom, which is worth naming once rather than rediscovering per call site. */
export const ARPEGGIO_OFFSETS = [4, 5, 7, 9, 11, 12];

/** 120 ticks a slot, so a 4/4 sixteenth grid gives the 480 tpb GloriArp uses. */
export const SLOT_TICKS = 120;

/**
 * Which note is this loop's "Downstroke"?
 *
 * The block MOVES between packs — most sit at C5 (72), some at C1 (24), and a
 * pack can mix both. It always starts on a C, so the search is over multiples
 * of 12; searching every semitone looks more general and is wrong, because a
 * loop that never plays Downstroke has no note at its base and the best-
 * covering window slides up, reading "Arpeggio 5" as "Downstroke".
 *
 * Returns null when nothing covers enough for this to be the loop language.
 */
export function detectBase(notes: number[], minCoverage = 0.9): number | null {
  if (!notes.length) return null;
  const lo = Math.min(...notes), hi = Math.max(...notes);
  let best: { base: number; inside: number } | null = null;
  for (let b = Math.floor(lo / 12) * 12; b <= hi; b += 12) {
    const inside = notes.filter((n) => n >= b && n <= b + 12).length;
    if (!best || inside > best.inside) best = { base: b, inside };
  }
  if (!best || best.inside / notes.length < minCoverage) return null;
  return best.base;
}

/**
 * Bar length in quarters, plus the signature itself.
 *
 * From the filename when it states one ("… 12-8 195-bpm C.mid"): a guitar part
 * has no timekeeper voice for a heuristic to find, and stated metadata beats
 * guessing. x/8 meters are counted in quarters — 12/8 is six. Anything else is
 * assumed 4/4 and SAYS so, so a wrong assumption stays visible.
 */
export function meterFromName(name: string): { bar: number; meter: Meter; source: string } {
  const m = /(\d{1,2})[-/](\d)\b/.exec(name);
  if (m) {
    const num = Number(m[1]), den = Number(m[2]);
    if (num > 0 && [2, 4, 8, 16].includes(den))
      return { bar: (num / den) * 4, meter: { numerator: num, denominator: den }, source: `filename ${num}/${den}` };
  }
  return { bar: 4, meter: { numerator: 4, denominator: 4 }, source: "assumed 4/4" };
}

/** A close-position voicing, built by climbing so it ascends for any chord —
 *  `12*(oct+1)+pcs[v % n]` breaks whenever the pitch classes wrap (Am7 is
 *  [9,0,4,7], so voice 1 would land below the bass). */
export function voicingStack(pcs: number[], nVoices: number, bassNote: number): number[] {
  const out: number[] = [];
  let prev = bassNote - 1;
  for (let v = 0; v < nVoices; v++) {
    const pc = pcs[v % pcs.length]!;
    let n = prev + ((((pc - prev) % 12) + 12) % 12);
    if (n <= prev) n += 12;
    out.push(n); prev = n;
  }
  return out;
}

interface Ev { tick: number; note: number; vel: number; dur: number }

/** Notes inside the key block, grouped: anything within a 16th of a quarter is
 *  one hand movement. */
function gestures(notes: Ev[], base: number, tpq: number): Ev[][] {
  const keep = notes.filter((n) => n.note >= base && n.note <= base + 12)
    .sort((a, b) => a.tick - b.tick);
  const out: Ev[][] = [];
  let g: Ev[] = [];
  for (const n of keep) {
    if (g.length && n.tick - g[0]!.tick > tpq / 16) { out.push(g); g = []; }
    g.push(n);
  }
  if (g.length) out.push(g);
  return out;
}

/**
 * Which voices does a gesture sound?
 *
 * The seven whole-hand keys strike the whole chord; the six arpeggio keys
 * strike one line. Damping needs no special case — it is already in the
 * measured duration, which is the finding that made a lookup table unnecessary.
 */
export function voicesOfGesture(g: Ev[], base: number): number[] {
  const offs = [...new Set(g.map((n) => n.note - base))];
  const slots = offs.map((o) => ARPEGGIO_OFFSETS.indexOf(o)).filter((i) => i >= 0);
  if (slots.length === offs.length && slots.length) {
    const lo = Math.min(...slots), hi = Math.max(...slots);
    return slots.length === 1 ? [lo] : Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  }
  if (offs.length === 1 && STRUM_KEY_NAMES[offs[0]!] === "Alternate bass") return [0];
  if (offs.length === 1 && offs[0]! >= 0 && offs[0]! < STRUM_KEY_NAMES.length)
    return Array.from({ length: ARPEGGIO_OFFSETS.length }, (_, i) => i);
  return [];
}

export interface LearnCompOptions {
  files: string[];
  /** Reference chord symbol, resolved through the same leadsheet path
   *  `learnStyle` uses. A CHOSEN reference here, not one the loops stated. */
  chord: string;
  id: string;
  /** Overrides the meter guessed from the filenames. */
  label?: string;
  bassNote?: number;
  tonic?: string;
  mode?: "major" | "minor";
}

export interface LearnCompResult {
  model: StyleModel;
  modelJson: string;
  loops: number;
  skipped: number;
  perBeat: number;
  grid: number;
  meterSource: string;
}

export function learnCompModel(opts: LearnCompOptions): LearnCompResult {
  if (!opts.files.length) throw new Error("style comp: at least one .mid file required");
  /* Resolved through the canonical leadsheet path, exactly as learnStyle does,
     so `--chord` means the same thing for both verbs. */
  const c = realizeLeadsheet(parseLeadsheet(opts.chord, {
    tonic: opts.tonic ?? "C", mode: opts.mode ?? "major",
  }))[0]?.[0];
  if (!c) throw new Error(`style comp: could not parse chord "${opts.chord}"`);
  const frame: FrameChord = { symbol: c.symbol, rootPc: c.rootPc, pcs: c.pcs };
  const pcs = frame.pcs;
  if (!pcs.length) throw new Error("style comp: the frame chord has no pitch classes");

  const info = meterFromName(opts.label ?? basename(opts.files[0]!));
  const nVoices = ARPEGGIO_OFFSETS.length;

  const loops: { file: string; tpq: number; base: number; notes: Ev[] }[] = [];
  let skipped = 0;
  for (const file of opts.files) {
    const { ticksPerBeat, notes } = readSmfNotes(readFileSync(file));
    if (!notes.length) { skipped++; continue; }
    const base = detectBase(notes.map((n) => n.pitch));
    if (base == null) { skipped++; continue; }
    loops.push({
      file, tpq: ticksPerBeat, base,
      notes: notes.map((n) => ({
        tick: n.startTick, note: n.pitch, vel: n.velocity ?? 96, dur: n.durationTicks,
      })),
    });
  }
  if (!loops.length) throw new Error(`style comp: no Strum-language loops (${skipped} skipped)`);

  /* Grid from gesture STARTS, not notes: a strum's internal spread is hand
     movement, and scoring it as timing error picks a finer division than the
     music has. */
  const fit = (div: number) => {
    let sum = 0, n = 0;
    for (const l of loops)
      for (const g of gestures(l.notes, l.base, l.tpq)) {
        const b = (g[0]!.tick / l.tpq) * div;
        sum += Math.abs(b - Math.round(b)); n++;
      }
    return { div, err: n ? sum / n : Infinity };
  };
  const perBeat = [1, 2, 3, 4, 6].map(fit).sort((a, b) => a.err - b.err)[0]!.div;

  /* A model's beat is one DENOMINATOR unit, so grid is slots per that, not per
     quarter: a 12-slot 12/8 bar is grid 1. Getting this wrong does not throw,
     it silently puts every onset on the wrong slot. */
  const slotsPerBar = Math.round(info.bar * perBeat);
  const grid = slotsPerBar / info.meter.numerator;
  if (!Number.isInteger(grid) || grid < 1)
    throw new Error(`style comp: ${slotsPerBar} slots do not divide ${info.meter.numerator} beats evenly`);
  const ticksPerBeat = SLOT_TICKS * grid;
  const barTicks = info.meter.numerator * ticksPerBeat;
  const stack = voicingStack(pcs, nVoices, opts.bassNote ?? 12 * 4 + pcs[0]!);

  const phrases: AccompanimentPhrase[] = loops.map((l, i) => {
    const toModel = (t: number) => (t / l.tpq) * perBeat * SLOT_TICKS;
    const events = [];
    let last = 0;
    for (const g of gestures(l.notes, l.base, l.tpq)) {
      const voices = voicesOfGesture(g, l.base);
      for (let k = 0; k < voices.length; k++) {
        const v = voices[k]!;
        const src = g[Math.min(k, g.length - 1)]!;
        const onset = toModel(src.tick);
        const duration = Math.max(1, Math.round(toModel(src.tick + src.dur) - onset));
        last = Math.max(last, onset + duration);
        const note = Math.max(0, Math.min(127, stack[v] ?? stack[stack.length - 1]!));
        events.push({
          onset: Math.max(0, Math.round(onset)),
          duration,
          velocity: Math.max(1, Math.min(127, src.vel)),
          voice: v,
          note,
          pitchClass: ((note % 12) + 12) % 12,
          chordRelation: {
            degree: (v % pcs.length) + 1, alteration: 0, octave: Math.floor(note / 12),
            category: "chord-tone" as const,
            /* 0.5: the stack is a default, not Strum's own voicing — the probe
               showed C major as C3 C3 G3 C4 E4 G4, which no stack produces. */
            confidence: 0.5,
          },
        });
      }
    }
    events.sort((a, b) => a.onset - b.onset || a.voice - b.voice);
    const bars = Math.max(1, Math.round(last / barTicks));
    return {
      v: 1, id: `${opts.id}-${i}`, role: "comping" as const,
      lengthTicks: bars * barTicks, ticksPerBeat, meter: info.meter, events,
      harmonicFrames: [{ start: 0, end: bars * barTicks, chord: frame }],
    };
  });

  const model = learnStyleModel(phrases, {
    id: opts.id, role: "comping", grid,
    source: {
      note: `learned from ${loops.length} local loops; statistics only, not the loops. `
        + `OBSERVED: onset, velocity, duration (the loops' own note-offs, where the `
        + `palm-mute/open distinction lives), microtiming, and which voicing position sounded. `
        + `NOT observed: pitch — these loops address voicing slots. Frame ${frame.symbol} is a `
        + `CHOSEN reference, \`notes\` are that frame realized as a default stack, and degrees `
        + `follow the voice index, so this corpus cannot contain a non-chord tone. `
        + `Use realizeDegrees to move it to another chord.`,
    },
  });

  return {
    model, modelJson: JSON.stringify(model, null, 2) + "\n",
    loops: loops.length, skipped, perBeat, grid, meterSource: info.source,
  };
}
