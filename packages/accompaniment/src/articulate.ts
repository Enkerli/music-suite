/**
 * Articulation, dynamics, silence, anticipation — the pack that makes a
 * generated phrase BREATHE (docs/PRIORITIES.md §2.3–2.4, GLORIARP_BRIEF §14:
 * expression as explicit data, never hidden randomness).
 *
 * A pure, seeded post-transform over an already-adapted phrase (pitches
 * resolved, frames attached), so anticipation genuinely sounds the COMING
 * chord early — the pitch was resolved for the downbeat it belongs to, and
 * only its onset moves. Every edit is reported as an ArticulationChange, so
 * `--explain` can say exactly what was done and why; same seed → identical
 * output, and the RNG is consumed in one documented order (rest draws in
 * onset order, then anticipation draws in onset order).
 *
 * Metric weight is the shared musical yardstick: bar downbeat 1.0, the
 * mid-bar beat 0.75, other beats 0.5, half-beat offbeats 0.3, the cracks
 * 0.15. Dynamics push velocity TOWARD that contour; rests remove events with
 * probability proportional to their weakness (a bar downbeat is never
 * dropped); anticipation steals half a beat from the previous bar.
 */

import { mulberry32 } from "@enkerli/proggen";
import type { AccompanimentPhrase, PhraseEvent } from "./phrase.js";

export const GATES = { staccato: 0.4, tenuto: 0.85, legato: 1.0 } as const;

export interface ArticulateOptions {
  seed: number;
  /** Duration scale: a named feel or a 0..1+ factor (>1 = overlap). */
  gate?: number | keyof typeof GATES;
  /** 0..1 — how strongly velocity follows the metric contour. 0 = off. */
  dynamics?: number;
  /** 0..1 — probability scale for dropping metrically WEAK events.
   *  Bar downbeats are never dropped. 0 = off. */
  rests?: number;
  /** 0..1 — probability a bar-downbeat event is pushed EARLY (sounding the
   *  coming chord before the barline). 0 = off. */
  anticipation?: number;
  /** How early an anticipated event sounds. Default half a beat. */
  pushTicks?: number;
}

export interface ArticulationChange {
  /** Index into the INPUT phrase's events. */
  index: number;
  onset: number;
  kind: "rest" | "anticipation";
  detail: string;
}

export interface ArticulateResult {
  phrase: AccompanimentPhrase;
  changes: ArticulationChange[];
}

/** Metric weight of a position in the bar (see module docstring). */
export function metricWeight(onset: number, ticksPerBeat: number, beatsPerBar: number): number {
  const pos = ((onset % (ticksPerBeat * beatsPerBar)) + ticksPerBeat * beatsPerBar) % (ticksPerBeat * beatsPerBar);
  const beat = pos / ticksPerBeat;
  if (beat === 0) return 1.0;
  if (Number.isInteger(beat)) {
    return beatsPerBar % 2 === 0 && beat === beatsPerBar / 2 ? 0.75 : 0.5;
  }
  return beat % 0.5 === 0 ? 0.3 : 0.15;
}

const clamp127 = (v: number) => Math.max(1, Math.min(127, Math.round(v)));

export function articulate(phrase: AccompanimentPhrase, opts: ArticulateOptions): ArticulateResult {
  const rng = mulberry32(opts.seed);
  const tpb = phrase.ticksPerBeat;
  const bpb = phrase.meter.numerator;
  const barTicks = tpb * bpb;
  const gate = typeof opts.gate === "string" ? GATES[opts.gate] : opts.gate;
  const changes: ArticulationChange[] = [];

  // Pass 1 — rests: one draw per event in onset order (fixed RNG budget).
  // Drop probability = rests × (1 − weight); a weight-1.0 downbeat never drops.
  const kept: boolean[] = phrase.events.map((e, i) => {
    const draw = rng(); // drawn unconditionally: the stream stays aligned across option changes
    if (!opts.rests) return true;
    const w = metricWeight(e.onset, tpb, bpb);
    if (w >= 1) return true;
    if (draw < opts.rests * (1 - w)) {
      changes.push({ index: i, onset: e.onset, kind: "rest", detail: `dropped (weight ${w})` });
      return false;
    }
    return true;
  });

  // Pass 2 — anticipation: one draw per surviving mid-piece bar downbeat.
  // A pushed note REPLACES anything already sounding in the stolen window
  // (a bassist's push swallows the pickup — a mono line stays mono), and only
  // the event immediately before a pushed one gets trimmed: authored overlaps
  // elsewhere in the material are respected, not "repaired".
  const events: PhraseEvent[] = [];
  const moved = new Set<PhraseEvent>();
  const srcEvents = phrase.events;
  for (let i = 0; i < srcEvents.length; i++) {
    if (!kept[i]) continue;
    const e: PhraseEvent = { ...srcEvents[i]! };
    const isBarDownbeat = e.onset % barTicks === 0 && e.onset > 0;
    if (isBarDownbeat) {
      const draw = rng(); // drawn for every downbeat: the stream stays aligned
      if (opts.anticipation && draw < opts.anticipation) {
        const push = opts.pushTicks ?? Math.round(tpb / 2);
        const newOnset = e.onset - push;
        let replaced = 0;
        while (events.length && events[events.length - 1]!.onset >= newOnset) { events.pop(); replaced++; }
        e.onset = newOnset;
        e.duration += push; // still releases where it did — it STARTS early
        moved.add(e);
        changes.push({
          index: i, onset: srcEvents[i]!.onset, kind: "anticipation",
          detail: `pushed ${push} ticks early${replaced ? `, replacing ${replaced} event(s)` : ""}`,
        });
      }
    }
    events.push(e);
  }
  for (let i = 1; i < events.length; i++) {
    if (!moved.has(events[i]!)) continue;
    const prev = events[i - 1]!;
    if (prev.onset + prev.duration > events[i]!.onset) {
      prev.duration = Math.max(1, events[i]!.onset - prev.onset);
    }
  }

  // Pass 3 — gate & dynamics: pure per-event shaping, no RNG.
  for (const e of events) {
    if (gate !== undefined) e.duration = Math.max(1, Math.round(e.duration * gate));
    if (opts.dynamics) {
      const w = metricWeight(e.onset, tpb, bpb);
      e.velocity = clamp127(e.velocity + opts.dynamics * (w - 0.5) * 30);
    }
  }

  return {
    phrase: {
      ...phrase,
      events,
      annotations: {
        ...phrase.annotations,
        articulation: JSON.stringify({
          ...(gate !== undefined && { gate }),
          ...(opts.dynamics && { dynamics: opts.dynamics }),
          ...(opts.rests && { rests: opts.rests }),
          ...(opts.anticipation && { anticipation: opts.anticipation }),
          seed: opts.seed,
        }),
      },
    },
    changes,
  };
}
