/**
 * StyleModel — from curated capture to STATISTICS (docs/GLORIARP_NEXT.md,
 * the brief's phase 4): a corpus of phrases played against one chord becomes
 * per-grid-slot distributions, and sampling the model produces a fresh
 * source phrase per (seed, pass) — the variability of PERFORMANCE, learned,
 * not synthesized from rules.
 *
 * What a slot learns (16ths by default): onset probability (with coverage —
 * a 1-bar take doesn't vote on bar 2), velocity mean/sd, duration mean,
 * MICRO-TIMING deviation mean/sd (the corpus's own pocket — where the
 * player leaned, learned per position), and the note-choice vocabulary
 * (absolute notes against the shared frame; the sampled phrase then goes
 * through the SAME honest relation inference extraction uses, so the bass
 * adapter can reharmonize it anywhere).
 *
 * Everything is accumulable (counts and sums, no averages stored) — adding
 * one more take is O(events), which is the co-learning horizon: play
 * continuously, feed takes in, the model keeps absorbing. Serialization is
 * versioned JSON: statistics only, NEVER the source clips (the brief's
 * no-corpus-publication rule holds by construction).
 *
 * POLYPHONY (EP comping etc.): a slot's AGGREGATE stats (top-level fields)
 * pool every simultaneous note, same as always — a coarse but harmless
 * summary. When the corpus actually plays chords, each slot ALSO keeps
 * per-VOICE stats (`voices`, extract.ts's voice ids), so sampling can draw
 * a whole chord — each voice its own onset/note/velocity/timing, sharing
 * the slot's `covered` denominator (a voice absent from half the takes
 * naturally gets half the onset probability). A monophonic corpus never
 * populates `voices` at all, so its models are byte-identical to before
 * comping existed.
 */

import { mulberry32 } from "@enkerli/proggen";
import type { AccompanimentPhrase, AccompanimentRole, FrameChord, Meter, ProvenanceRef } from "./phrase.js";
import { extractPhrase, type InputNote } from "./extract.js";

export const MODEL_SCHEMA_V = 1;

/** One (slot, voice) line's distribution — the same shape a slot itself
 *  keeps in aggregate, minus `covered` (voices share the parent slot's). */
export interface VoiceStats {
  count: number;
  velSum: number;
  velSqSum: number;
  durSum: number;
  devSum: number;
  devSqSum: number;
  notes: Record<string, number>;
}

export interface SlotStats {
  /** Takes whose length covered this slot (the onset-probability denominator). */
  covered: number;
  /** Onsets seen at this slot. */
  count: number;
  velSum: number;
  velSqSum: number;
  durSum: number;
  /** Micro-timing deviation from the grid line, in ticks (signed). */
  devSum: number;
  devSqSum: number;
  /** Absolute MIDI note → count (the note-choice vocabulary at this slot). */
  notes: Record<string, number>;
  /** Per-voice stats — present only once the corpus shows polyphony. */
  voices?: Record<string, VoiceStats>;
}

export interface StyleModel {
  v: number;
  id: string;
  role: AccompanimentRole;
  ticksPerBeat: number;
  meter: Meter;
  /** Model length in bars (the longest take; shorter takes cover fewer slots). */
  bars: number;
  /** Grid slots per beat (4 = sixteenths). */
  grid: number;
  /** The chord the whole corpus was played against. */
  frame: FrameChord;
  /** Takes accumulated so far. */
  takes: number;
  slots: SlotStats[];
  source?: ProvenanceRef;
}

const emptyVoiceStats = (): VoiceStats => ({
  count: 0, velSum: 0, velSqSum: 0, durSum: 0, devSum: 0, devSqSum: 0, notes: {},
});
const emptySlot = (): SlotStats => ({
  covered: 0, count: 0, velSum: 0, velSqSum: 0, durSum: 0, devSum: 0, devSqSum: 0, notes: {},
});

export interface LearnOptions {
  id: string;
  role?: AccompanimentRole;
  grid?: number;
  source?: ProvenanceRef;
}

/** Start an empty model around a frame chord (accumulate with addTake). */
export function createStyleModel(frame: FrameChord, meta: {
  id: string; role?: AccompanimentRole; ticksPerBeat: number; meter: Meter; bars: number;
  grid?: number; source?: ProvenanceRef;
}): StyleModel {
  const grid = meta.grid ?? 4;
  const slotCount = meta.bars * meta.meter.numerator * grid;
  return {
    v: MODEL_SCHEMA_V, id: meta.id, role: meta.role ?? "bass",
    ticksPerBeat: meta.ticksPerBeat, meter: meta.meter, bars: meta.bars, grid,
    frame, takes: 0, slots: Array.from({ length: slotCount }, emptySlot),
    ...(meta.source && { source: meta.source }),
  };
}

/**
 * Fold one take (a phrase against the model's frame) into the statistics.
 * A take longer than the model extends it (new empty slots inherit nothing);
 * a shorter take only votes on the slots it covers. O(events) — incremental
 * by design (the co-learning path).
 */
export function addTake(model: StyleModel, phrase: AccompanimentPhrase): StyleModel {
  const slotTicks = model.ticksPerBeat / model.grid;
  const takeSlots = Math.max(1, Math.round(phrase.lengthTicks / slotTicks));
  while (model.slots.length < takeSlots) {
    model.slots.push(emptySlot());
  }
  model.bars = Math.max(model.bars, Math.ceil(takeSlots / (model.meter.numerator * model.grid)));
  for (let i = 0; i < Math.min(takeSlots, model.slots.length); i++) model.slots[i]!.covered++;

  for (const e of phrase.events) {
    if (e.note === undefined) continue;
    const slot = Math.round(e.onset / slotTicks);
    if (slot < 0 || slot >= model.slots.length) continue;
    const s = model.slots[slot]!;
    const dev = e.onset - slot * slotTicks;
    s.count++;
    s.velSum += e.velocity;
    s.velSqSum += e.velocity * e.velocity;
    s.durSum += e.duration;
    s.devSum += dev;
    s.devSqSum += dev * dev;
    s.notes[String(e.note)] = (s.notes[String(e.note)] ?? 0) + 1;

    if (e.voice !== undefined) {
      s.voices ??= {};
      const key = String(e.voice);
      const v = (s.voices[key] ??= emptyVoiceStats());
      v.count++;
      v.velSum += e.velocity;
      v.velSqSum += e.velocity * e.velocity;
      v.durSum += e.duration;
      v.devSum += dev;
      v.devSqSum += dev * dev;
      v.notes[String(e.note)] = (v.notes[String(e.note)] ?? 0) + 1;
    }
  }
  model.takes++;
  return model;
}

/** Learn a model from a corpus of phrases sharing one harmonic frame. */
export function learnStyleModel(phrases: AccompanimentPhrase[], opts: LearnOptions): StyleModel {
  if (!phrases.length) throw new Error("learnStyleModel: at least one phrase required");
  const first = phrases[0]!;
  const frame = first.harmonicFrames?.[0]?.chord;
  if (!frame) throw new Error("learnStyleModel: phrases need a harmonic frame (the chord they were played against)");
  const model = createStyleModel(frame, {
    id: opts.id,
    role: opts.role ?? first.role,
    ticksPerBeat: first.ticksPerBeat,
    meter: first.meter,
    bars: Math.max(1, Math.round(first.lengthTicks / (first.meter.numerator * first.ticksPerBeat))),
    ...(opts.grid !== undefined && { grid: opts.grid }),
    ...(opts.source && { source: opts.source }),
  });
  for (const p of phrases) {
    if (p.ticksPerBeat !== model.ticksPerBeat)
      throw new Error(`learnStyleModel: mixed ticksPerBeat (${p.ticksPerBeat} vs ${model.ticksPerBeat}) — normalize first`);
    addTake(model, p);
  }
  return model;
}

// ── Sampling ─────────────────────────────────────────────────────────────────

export interface SampleOptions {
  seed: number;
  /** Loop pass — every pass is a fresh, deterministic take. */
  pass?: number;
  /** Onset-probability scale (1 = as learned; <1 sparser, >1 denser). */
  density?: number;
  /** 0..1 — how much of the learned velocity/timing SPREAD to reproduce
   *  (0 = play the averages; 1 = the corpus's full variability). */
  humanize?: number;
}

/** Deterministic standard normal from two uniform draws (Box–Muller). */
function gaussian(rng: () => number): number {
  const u = Math.max(rng(), 1e-12);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const sd = (sum: number, sqSum: number, n: number): number => {
  if (n < 2) return 0;
  const mean = sum / n;
  return Math.sqrt(Math.max(0, sqSum / n - mean * mean));
};

/**
 * Sample one take from the model: a full AccompanimentPhrase whose events
 * carry honest chord-relations (via the same inference extraction uses), so
 * it drops straight into groove() as a source phrase. Same (model, seed,
 * pass) → byte-identical take; different passes → the learned variability.
 */
export function samplePhrase(model: StyleModel, opts: SampleOptions): AccompanimentPhrase {
  const pass = opts.pass ?? 0;
  const density = opts.density ?? 1;
  const humanize = opts.humanize ?? 1;
  const rng = mulberry32((((opts.seed >>> 0) * 2654435761) ^ ((pass + 1) * 40503)) >>> 0);
  const slotTicks = model.ticksPerBeat / model.grid;
  const notes: InputNote[] = [];

  // One (slot, stats) → an InputNote, or null if this draw doesn't fire.
  // `covered` is always the PARENT SLOT's — voices share it as their onset-
  // probability denominator (a voice present in half the takes naturally
  // draws at half the rate, no separate bookkeeping needed).
  const draw = (stats: VoiceStats | SlotStats, covered: number, slotIndex: number, voice?: number): InputNote | null => {
    const dOn = rng();
    const dNote = rng();
    const gVel = gaussian(rng);
    const gDev = gaussian(rng);
    if (!covered || !stats.count) return null;
    const p = Math.min(1, (stats.count / covered) * density);
    if (dOn >= p) return null;

    const entries = Object.entries(stats.notes);
    const total = entries.reduce((a, [, c]) => a + c, 0);
    let pick = dNote * total;
    let note = Number(entries[0]![0]);
    for (const [n, c] of entries) { pick -= c; if (pick <= 0) { note = Number(n); break; } }

    const velMean = stats.velSum / stats.count;
    const velocity = Math.max(1, Math.min(127, Math.round(velMean + gVel * sd(stats.velSum, stats.velSqSum, stats.count) * humanize)));
    const devMean = stats.devSum / stats.count;
    const dev = Math.round(devMean + gDev * sd(stats.devSum, stats.devSqSum, stats.count) * humanize);
    const onset = Math.max(0, slotIndex * slotTicks + Math.max(-slotTicks / 2, Math.min(slotTicks / 2, dev)));
    const duration = Math.max(10, Math.round(stats.durSum / stats.count));
    return { pitch: note, startTick: Math.round(onset), durationTicks: duration, velocity, ...(voice !== undefined && { voice }) };
  };

  for (let i = 0; i < model.slots.length; i++) {
    const s = model.slots[i]!;
    // Fixed draw budget per slot (the aligned-streams discipline) — always
    // consumed, even when a polyphonic slot's actual note comes from its
    // per-voice draws below: a model's draw sequence never depends on
    // whether ITS OWN corpus happened to be polyphonic.
    const aggregate = draw(s, s.covered, i);
    if (!s.voices) {
      if (aggregate) notes.push(aggregate);
      continue;
    }
    // Polyphonic slot: sample EACH voice independently, in a fixed
    // (ascending numeric) key order — object key order is not a
    // reproducibility guarantee, an explicit sort is.
    const voiceKeys = Object.keys(s.voices).map(Number).sort((a, b) => a - b);
    for (const vk of voiceKeys) {
      const one = draw(s.voices[String(vk)]!, s.covered, i, vk);
      if (one) notes.push(one);
    }
  }

  // A silent take is not a take: fall back to the single most-played slot.
  if (!notes.length) {
    let best = -1, bestP = 0;
    model.slots.forEach((s, i) => { if (s.covered && s.count / s.covered > bestP) { bestP = s.count / s.covered; best = i; } });
    if (best >= 0) {
      const s = model.slots[best]!;
      const top = Object.entries(s.notes).sort((a, b) => b[1] - a[1])[0]!;
      notes.push({ pitch: Number(top[0]), startTick: Math.round(best * slotTicks),
        durationTicks: Math.max(10, Math.round(s.durSum / s.count)), velocity: Math.round(s.velSum / s.count) });
    }
  }
  notes.sort((a, b) => a.startTick - b.startTick);
  // Anti-collision guard, PER VOICE: a voice is monophonic by definition, so
  // two of ITS onsets can't share a tick — but different voices sounding
  // together is exactly a chord, and must be left alone. A voiceless
  // (monophonic) take has everything in one implicit group, the exact
  // behavior this had before polyphonic sampling existed.
  const byVoice = new Map<number, InputNote[]>();
  for (const n of notes) {
    const key = n.voice ?? 0;
    if (!byVoice.has(key)) byVoice.set(key, []);
    byVoice.get(key)!.push(n);
  }
  for (const group of byVoice.values()) {
    group.sort((a, b) => a.startTick - b.startTick);
    for (let i = 1; i < group.length; i++)
      if (group[i]!.startTick <= group[i - 1]!.startTick) group[i]!.startTick = group[i - 1]!.startTick + 1;
  }

  return extractPhrase(notes, {
    id: `${model.id}-take-s${opts.seed}p${pass}`,
    role: model.role,
    meter: model.meter,
    ticksPerBeat: model.ticksPerBeat,
    lengthTicks: model.slots.length * slotTicks,
    frame: model.frame,
    source: { note: `sampled from style model ${model.id} (${model.takes} takes) seed ${opts.seed} pass ${pass}` },
  });
}

// ── (De)serialization — the shareable artifact is STATISTICS, never clips ────

export function serializeModel(model: StyleModel): string {
  return JSON.stringify(model, null, 2) + "\n";
}

export function validateModel(x: unknown): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const m = x as Partial<StyleModel> | null;
  if (typeof m !== "object" || m === null) return { ok: false, errors: ["not an object"] };
  if (m.v !== MODEL_SCHEMA_V) errors.push(`v must be ${MODEL_SCHEMA_V}`);
  if (typeof m.id !== "string" || !m.id) errors.push("id must be a non-empty string");
  if (!Number.isInteger(m.ticksPerBeat) || (m.ticksPerBeat as number) <= 0) errors.push("ticksPerBeat must be a positive integer");
  if (!Number.isInteger(m.grid) || (m.grid as number) <= 0) errors.push("grid must be a positive integer");
  if (!m.frame || typeof (m.frame as FrameChord).rootPc !== "number" || !Array.isArray((m.frame as FrameChord).pcs))
    errors.push("frame must carry rootPc and pcs");
  if (!Array.isArray(m.slots) || !m.slots.length) errors.push("slots must be a non-empty array");
  else for (let i = 0; i < m.slots.length; i++) {
    const s = m.slots[i] as Partial<SlotStats>;
    if (typeof s?.covered !== "number" || typeof s?.count !== "number" || typeof s?.notes !== "object")
      { errors.push(`slots[${i}] malformed`); break; }
  }
  return { ok: errors.length === 0, errors };
}

export function parseModel(json: string): StyleModel {
  let x: unknown;
  try { x = JSON.parse(json); } catch (e) { throw new Error(`style model: not JSON (${(e as Error).message})`); }
  const v = validateModel(x);
  if (!v.ok) throw new Error(`style model invalid: ${v.errors.join("; ")}`);
  return x as StyleModel;
}

/** Cheap shape check: is this JSON a StyleModel (vs an AccompanimentPhrase)? */
export function looksLikeModel(x: unknown): boolean {
  return typeof x === "object" && x !== null && Array.isArray((x as StyleModel).slots)
    && (x as StyleModel).frame !== undefined && (x as { events?: unknown }).events === undefined;
}
