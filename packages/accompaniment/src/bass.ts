/**
 * The deterministic bass adapter — GloriArp slice 1 (GLORIARP_BRIEF §17):
 * ONE curated monophonic bass phrase, tiled across a harmonic timeline and
 * reharmonized per frame through its chord-relative annotations. Stage-0
 * "learning" — pure transforms, no model — but it establishes every contract
 * the later stages must honor: deterministic by seed (proggen's mulberry32),
 * range-clamped, chromatic approaches resolve to declared targets, and every
 * choice lands in the trace.
 *
 * Two passes: structural events (chord tones / unclassified) resolve first
 * against their own frame; approaches then resolve ±1 semitone against the
 * pitch their (cyclic) target actually got — so an approach at a bar's end
 * leads INTO the next chord, the essential walking-bass move.
 */

import { mulberry32 } from "@enkerli/proggen";
import type { AccompanimentPhrase, HarmonicFrame, PhraseEvent } from "./phrase.js";
import { PHRASE_SCHEMA_V } from "./phrase.js";
import { chordDegreeOf } from "./extract.js";
import { buildTrace, type Trace, type TraceEvent, type TraceLevel } from "./trace.js";

export const ENGINE = "@enkerli/accompaniment";
export const ENGINE_VERSION = "0.1.0";

export interface PitchRange {
  /** MIDI note numbers, inclusive. */
  low: number;
  high: number;
}

export interface BassAdaptOptions {
  /** Contiguous target harmonic timeline (ticks); its end sets the output length. */
  frames: HarmonicFrame[];
  seed: number;
  range: PitchRange;
  /** 0..1 — probability a source chromatic approach SURVIVES (else it snaps
   *  to a chord tone). Default 0.25. */
  chromaticism?: number;
  /** 0..1 — probability each non-downbeat onset is kept. Default 1 (the
   *  slice-1 acceptance setting: rhythm preserved exactly). */
  rhythmPreservation?: number;
  traceLevel?: TraceLevel;
}

export interface BassAdaptResult {
  phrase: AccompanimentPhrase;
  trace: Trace;
}

const mod12 = (n: number) => ((n % 12) + 12) % 12;

/** Signed shortest pc path a→b in semitones (−5..6). */
function pcDelta(a: number, b: number): number {
  const up = mod12(b - a);
  return up <= 6 ? up : up - 12;
}

/** Nearest pitch with pitch-class `pc` to `around`. */
function nearestWithPc(pc: number, around: number): number {
  const base = around + pcDelta(mod12(around), pc);
  // base is within ±6; candidates an octave either side can't be nearer.
  return base;
}

/** Shift into [low, high] by octaves; report if impossible without leaving pc. */
function clampToRange(pitch: number, range: PitchRange, repairs: string[]): number {
  let p = pitch;
  while (p < range.low) p += 12;
  while (p > range.high) p -= 12;
  if (p < range.low) {
    // Range narrower than an octave and this pc misses it: pin to the edge.
    p = p + 12 > range.high ? range.low : p + 12;
    repairs.push(`range-pin:${pitch}→${p}`);
  } else if (p !== pitch) {
    repairs.push(`range-octave:${pitch}→${p}`);
  }
  return p;
}

/** Frame covering an onset (frames are contiguous and ordered). */
function frameAt(frames: HarmonicFrame[], onset: number): HarmonicFrame {
  for (const f of frames) if (onset >= f.start && onset < f.end) return f;
  return frames[frames.length - 1]!;
}

interface Tiled {
  ev: PhraseEvent;
  onset: number;
  /** Index in the tiled sequence its approach targets (cyclic source target,
   *  projected onto the NEXT occurrence in tiling order). */
  targetIndex?: number;
}

/** Tile the source phrase end-to-end across the timeline's total length. */
function tile(source: AccompanimentPhrase, totalTicks: number): Tiled[] {
  const out: Tiled[] = [];
  const perRep = source.events.length;
  const reps = Math.ceil(totalTicks / source.lengthTicks);
  for (let r = 0; r < reps; r++) {
    source.events.forEach((ev, i) => {
      const onset = r * source.lengthTicks + ev.onset;
      if (onset >= totalTicks) return;
      const t: Tiled = { ev, onset };
      const target = ev.chordRelation?.target;
      if (target !== undefined) {
        // Cyclic source target → the next occurrence at or after this event.
        t.targetIndex = target > i ? r * perRep + target : (r + 1) * perRep + target;
      }
      out.push(t);
    });
  }
  return out;
}

/**
 * Adapt a monophonic bass phrase across a progression's frames.
 * Deterministic: same (source, options) → byte-identical result; only the
 * seed's optional choices (approach survival, rhythm thinning) vary with it.
 */
export function adaptBassPhrase(source: AccompanimentPhrase, opts: BassAdaptOptions): BassAdaptResult {
  if (!opts.frames.length) throw new Error("adaptBassPhrase: at least one harmonic frame is required");
  const chromaticism = opts.chromaticism ?? 0.25;
  const rhythmPreservation = opts.rhythmPreservation ?? 1;
  const level: TraceLevel = opts.traceLevel ?? "summary";
  const rng = mulberry32(opts.seed);
  const totalTicks = opts.frames[opts.frames.length - 1]!.end;
  const srcRootPc = source.harmonicFrames?.[0]?.chord.rootPc ?? 0;

  const tiled = tile(source, totalTicks);

  // Pass 0 — rhythm thinning (downbeats always survive). One rng draw per
  // candidate event, in onset order, so the stream is reproducible.
  const barTicks = source.meter.numerator * source.ticksPerBeat;
  const kept: (Tiled | null)[] = tiled.map((t) => {
    const onDownbeat = t.onset % barTicks === 0;
    if (rhythmPreservation >= 1 || onDownbeat) return t;
    return rng() < rhythmPreservation ? t : null;
  });

  // Pass 1 — structural pitches; approaches deferred (need their target's pitch).
  const chosen: (number | null)[] = new Array(tiled.length).fill(null);
  const traceEvents: TraceEvent[] = [];
  const isApproach = (t: Tiled) => t.ev.chordRelation?.category === "chromatic-approach";
  let prevOut: number | null = null;

  const resolveStructural = (t: Tiled, i: number) => {
    const frame = frameAt(opts.frames, t.onset);
    const repairs: string[] = [];
    const srcNote = t.ev.note ?? 48;
    const rel = t.ev.chordRelation;
    const rootShift = pcDelta(srcRootPc, frame.chord.rootPc);
    const ideal = srcNote + rootShift; // contour-preserving transposition ideal
    let pitch: number;
    let reason: string;
    if (rel && rel.category === "chord-tone" && rel.degree >= 1) {
      const pc = frame.chord.pcs[(rel.degree - 1) % frame.chord.pcs.length]!;
      pitch = nearestWithPc(mod12(pc), ideal);
      reason = `chord-tone degree ${rel.degree} of ${frame.chord.symbol}`;
    } else {
      // Unclassified (or degenerate): nearest chord tone to the ideal.
      const cands = frame.chord.pcs.map((pc) => nearestWithPc(mod12(pc), ideal));
      pitch = cands.reduce((best, c) => (Math.abs(c - ideal) < Math.abs(best - ideal) ? c : best));
      reason = `nearest chord tone of ${frame.chord.symbol} (source ${rel?.category ?? "unrelated"})`;
    }
    pitch = clampToRange(pitch, opts.range, repairs);
    if (prevOut !== null && Math.abs(pitch - prevOut) > 12) {
      const pulled = clampToRange(nearestWithPc(mod12(pitch), prevOut), opts.range, []);
      if (Math.abs(pulled - prevOut) < Math.abs(pitch - prevOut)) {
        repairs.push(`leap-guard:${pitch}→${pulled}`);
        pitch = pulled;
      }
    }
    chosen[i] = pitch;
    prevOut = pitch;
    return { frame, ideal, pitch, reason, repairs, srcNote };
  };

  let approachesKept = 0;
  let approachesSnapped = 0;
  let dropped = 0;
  let chordTones = 0;
  let repairCount = 0;

  // First pass in onset order: resolve structurals, draw approach survival.
  const approachSurvives: boolean[] = new Array(tiled.length).fill(false);
  tiled.forEach((t, i) => {
    if (kept[i] === null) { dropped++; return; }
    if (isApproach(t)) {
      approachSurvives[i] = rng() < chromaticism;
      return; // pitch deferred to pass 2
    }
    const r = resolveStructural(t, i);
    if (t.ev.chordRelation?.category === "chord-tone") chordTones++;
    repairCount += r.repairs.length;
    traceEvents.push({
      index: i, onset: t.onset, bar: Math.floor(t.onset / barTicks),
      ...(t.ev.sourceEventId !== undefined && { sourceEventId: t.ev.sourceEventId }),
      category: t.ev.chordRelation?.category ?? "unrelated",
      sourceNote: r.srcNote, ideal: r.ideal, chosen: r.pitch, reason: r.reason,
      ...(r.repairs.length && { repairs: r.repairs }),
    });
  });

  // Pass 2 — approaches resolve against their target's chosen pitch.
  tiled.forEach((t, i) => {
    if (kept[i] === null || !isApproach(t)) return;
    const frame = frameAt(opts.frames, t.onset);
    const repairs: string[] = [];
    const srcNote = t.ev.note ?? 48;
    const ti = t.targetIndex;
    const targetPitch = ti !== undefined && ti < chosen.length ? chosen[ti] : null;
    let pitch: number;
    let reason: string;
    if (approachSurvives[i] && targetPitch !== null && targetPitch !== undefined) {
      const dir = t.ev.chordRelation!.alteration >= 0 ? 1 : -1;
      pitch = targetPitch + dir;
      if (pitch < opts.range.low || pitch > opts.range.high) {
        // Octave-shifting an approach would break adjacency to its target —
        // approach from the other side instead, if that side is in range.
        const flipped = targetPitch - dir;
        if (flipped >= opts.range.low && flipped <= opts.range.high) {
          repairs.push(`approach-flip:${pitch}→${flipped}`);
          pitch = flipped;
        }
      }
      reason = `chromatic approach to ${targetPitch} (${dir > 0 ? "above" : "below"})`;
      approachesKept++;
    } else {
      const ideal = srcNote + pcDelta(srcRootPc, frame.chord.rootPc);
      const cands = frame.chord.pcs.map((pc) => nearestWithPc(mod12(pc), ideal));
      pitch = cands.reduce((best, c) => (Math.abs(c - ideal) < Math.abs(best - ideal) ? c : best));
      reason = targetPitch === null || targetPitch === undefined
        ? "approach without a resolved target — snapped to chord tone"
        : `approach snapped to chord tone (chromaticism budget)`;
      approachesSnapped++;
    }
    pitch = clampToRange(pitch, opts.range, repairs);
    repairCount += repairs.length;
    chosen[i] = pitch;
    traceEvents.push({
      index: i, onset: t.onset, bar: Math.floor(t.onset / barTicks),
      ...(t.ev.sourceEventId !== undefined && { sourceEventId: t.ev.sourceEventId }),
      category: "chromatic-approach",
      sourceNote: srcNote, chosen: pitch, reason,
      ...(repairs.length && { repairs }),
    });
  });

  traceEvents.sort((a, b) => a.onset - b.onset);

  // Assemble the output phrase.
  const events: PhraseEvent[] = [];
  tiled.forEach((t, i) => {
    const pitch = chosen[i];
    if (kept[i] === null || pitch === null || pitch === undefined) return;
    const frame = frameAt(opts.frames, t.onset);
    const duration = Math.min(t.ev.duration, totalTicks - t.onset);
    const degree = chordDegreeOf(mod12(pitch), frame.chord);
    events.push({
      onset: t.onset,
      duration,
      velocity: t.ev.velocity,
      note: pitch,
      pitchClass: mod12(pitch),
      chordRelation: {
        degree,
        alteration: 0,
        octave: Math.floor(pitch / 12),
        category: degree > 0 ? "chord-tone" : "chromatic-approach",
      },
      ...(t.ev.sourceEventId !== undefined && { sourceEventId: t.ev.sourceEventId }),
    });
  });

  const phrase: AccompanimentPhrase = {
    v: PHRASE_SCHEMA_V,
    id: `${source.id}-adapted-s${opts.seed}`,
    role: "bass",
    lengthTicks: totalTicks,
    ticksPerBeat: source.ticksPerBeat,
    meter: source.meter,
    source: { note: `adapted from ${source.id} by ${ENGINE}@${ENGINE_VERSION} seed ${opts.seed}` },
    events,
    harmonicFrames: opts.frames,
  };

  const trace = buildTrace(level, {
    engine: ENGINE,
    engineVersion: ENGINE_VERSION,
    seed: opts.seed,
    sourcePhraseId: source.id,
    frames: opts.frames.map((f) => f.chord.symbol),
    options: { chromaticism, rhythmPreservation, range: opts.range },
  }, {
    sourceEvents: tiled.length,
    outputEvents: events.length,
    dropped,
    chordTones,
    approachesKept,
    approachesSnapped,
    repairs: repairCount,
  }, traceEvents);

  return { phrase, trace };
}
