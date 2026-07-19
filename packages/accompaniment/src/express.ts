/**
 * Expression & variation — the post-articulation stage (docs/GLORIARP_NEXT.md
 * §1–§2). Four coupled behaviors, all seeded, all optional, all reported:
 *
 *  - variety: note-choice variation on metrically weak events — octave
 *    displacement, chord-tone reselection, and PASSING TONES (the schema's
 *    passing-tone category, generated at last). Bar downbeats are anchors:
 *    never varied.
 *  - pass/morph: the stage takes a loop-pass index; `morph` is the fraction
 *    of decisions re-rolled per pass. Three aligned RNG streams (stable,
 *    per-pass, gate) drawn unconditionally per decision, so (seed, pass,
 *    morph) → byte-identical output, and morph 0 → every pass identical.
 *  - pocket: the Keil correction (GLORIARP_NEXT §2). Not i.i.d. jitter and
 *    not a fixed grid offset: a CORRELATED walk (push accumulates, then
 *    resolves), anchored hard at strong beats, coupled to accents — dug-in
 *    notes lean late and heavy, light notes ride ahead. The walk drives
 *    both timing (ticks, via bpm) and micro-dynamics (velocity), because a
 *    push and a lean are one gesture.
 *  - mixed gate: per-note articulation from context — legato into stepwise
 *    motion (a passing tone slurs into its resolution), detached on
 *    repeated notes, ghosty on the cracks, tenuto otherwise. No RNG.
 */

import { mulberry32 } from "@enkerli/proggen";
import { metricWeight } from "./articulate.js";
import type { AccompanimentPhrase, HarmonicFrame, PhraseEvent } from "./phrase.js";

export interface ExpressOptions {
  seed: number;
  /** Loop pass index, 0-based. Players hand each repeat its pass number. */
  pass?: number;
  /** 0..1 — fraction of variety/pocket decisions re-rolled per pass. */
  morph?: number;
  /** 0..1 — note-choice variety (octave / reselect / passing tones). */
  variety?: number;
  /** 0..1 — pocket depth (max ~±18ms of correlated push/pull at 1). */
  pocket?: number;
  /** Per-note contextual articulation (legato/detached/ghost by motion). */
  mixedGate?: boolean;
  /** Needed to convert the pocket's milliseconds into ticks. */
  bpm: number;
}

export interface ExpressChange {
  index: number;
  onset: number;
  kind: "octave" | "reselect" | "passing" | "pocket" | "gate";
  detail: string;
}

export interface ExpressResult {
  phrase: AccompanimentPhrase;
  changes: ExpressChange[];
}

const mod12 = (n: number) => ((n % 12) + 12) % 12;
const clamp127 = (v: number) => Math.max(1, Math.min(127, Math.round(v)));

/** Per-pass seed: a distinct, deterministic stream per (seed, pass). */
function passSeed(seed: number, pass: number): number {
  return (((seed >>> 0) * 2654435761) ^ ((pass + 1) * 40503)) >>> 0;
}

function frameAt(frames: HarmonicFrame[] | undefined, onset: number): HarmonicFrame | undefined {
  if (!frames?.length) return undefined;
  for (const f of frames) if (onset >= f.start && onset < f.end) return f;
  return frames[frames.length - 1];
}

export function expressPhrase(phrase: AccompanimentPhrase, opts: ExpressOptions): ExpressResult {
  const variety = opts.variety ?? 0;
  const pocket = opts.pocket ?? 0;
  const morph = opts.morph ?? 0;
  const pass = opts.pass ?? 0;
  const tpb = phrase.ticksPerBeat;
  const bpb = phrase.meter.numerator;
  const changes: ExpressChange[] = [];

  // Three aligned streams (articulate's discipline: draw unconditionally so
  // option changes never shift the stream). `gateRng` decides WHICH stream a
  // decision reads; it is keyed by seed only, so the SET of morphing
  // decisions is stable across passes — the take breathes in the same
  // places, rather than scrambling wholesale.
  const stableRng = mulberry32(opts.seed ^ 0x9e3779b9);
  const perPassRng = mulberry32(passSeed(opts.seed, pass));
  const gateRng = mulberry32(opts.seed ^ 0x51ab_cd0f);
  const draw = (): number => {
    const s = stableRng();
    const p = perPassRng();
    const g = gateRng();
    return g < morph ? p : s;
  };

  const events: PhraseEvent[] = phrase.events.map((e) => ({ ...e }));
  const pitched = events.filter((e) => e.note !== undefined);
  const lo = pitched.length ? Math.min(...pitched.map((e) => e.note!)) : 36;
  const hi = pitched.length ? Math.max(...pitched.map((e) => e.note!)) : 60;

  // ── Variety: octave / reselection / passing tones (weak beats only) ────────
  for (let i = 0; i < events.length; i++) {
    const e = events[i]!;
    const w = metricWeight(e.onset, tpb, bpb);
    const prev = i > 0 ? events[i - 1] : undefined;
    const next = i < events.length - 1 ? events[i + 1] : undefined;
    // Fixed draw budget per event: three draws, always.
    const dOct = draw(), dSel = draw(), dPass = draw();
    if (!variety || e.note === undefined || w >= 1) continue; // downbeats are anchors

    // Passing tone first (the most idiomatic): on a weak beat (2 and 4 — where
    // walking basslines put them) or the cracks, between two pitches ≥3
    // semitones apart, step chromatically toward the NEXT pitch.
    if (dPass < variety * 0.4 && w <= 0.5 && prev?.note !== undefined && next?.note !== undefined
        && Math.abs(next.note - prev.note) >= 3 && Math.abs(next.note - prev.note) <= 12) {
      const dir = next.note > prev.note ? 1 : -1;
      const pitch = next.note - dir; // one semitone before the arrival
      if (pitch !== e.note && pitch >= lo - 2 && pitch <= hi + 2) {
        changes.push({ index: i, onset: e.onset, kind: "passing", detail: `${e.note}→${pitch} toward ${next.note}` });
        e.note = pitch;
        e.pitchClass = mod12(pitch);
        e.chordRelation = { degree: 0, alteration: 0, octave: Math.floor(pitch / 12), category: "passing-tone" };
        continue;
      }
    }
    // Octave displacement: register jump on a weak beat, inside the phrase's
    // own register (never widens the material's range by more than the jump).
    if (dOct < variety * 0.25) {
      const up = e.note + 12 <= hi;
      const down = e.note - 12 >= lo;
      if (up || down) {
        const pitch = e.note + (up && down ? (dSel < 0.5 ? 12 : -12) : up ? 12 : -12);
        changes.push({ index: i, onset: e.onset, kind: "octave", detail: `${e.note}→${pitch}` });
        e.note = pitch;
        if (e.chordRelation) e.chordRelation = { ...e.chordRelation, octave: Math.floor(pitch / 12) };
        continue;
      }
    }
    // Chord-tone reselection: another tone of the SAME chord, nearest to the
    // original — variety that can't leave the harmony.
    const frame = frameAt(phrase.harmonicFrames, e.onset);
    if (dSel < variety * 0.3 && frame && e.chordRelation?.category === "chord-tone") {
      const cands = frame.chord.pcs
        .filter((pc) => mod12(pc) !== mod12(e.note!))
        .map((pc) => {
          const d = ((pc - mod12(e.note!)) % 12 + 18) % 12 - 6;
          return e.note! + d;
        })
        .filter((p) => p >= lo - 2 && p <= hi + 2);
      if (cands.length) {
        const pitch = cands.reduce((b, c) => (Math.abs(c - e.note!) < Math.abs(b - e.note!) ? c : b));
        changes.push({ index: i, onset: e.onset, kind: "reselect", detail: `${e.note}→${pitch} within ${frame.chord.symbol}` });
        e.note = pitch;
        e.pitchClass = mod12(pitch);
      }
    }
  }

  // ── Pocket: correlated push/pull, anchored at strong beats ────────────────
  if (pocket > 0 && events.length) {
    const ticksPerMs = (opts.bpm * tpb) / 60000;
    let driftMs = 0;
    for (let i = 0; i < events.length; i++) {
      const e = events[i]!;
      const w = metricWeight(e.onset, tpb, bpb);
      const anchor = w >= 1 ? 0.7 : w >= 0.5 ? 0.4 : 0.15; // strong beats pull the walk home
      const step = (draw() * 2 - 1) * 7 * pocket;            // correlated: added to carried drift
      driftMs = driftMs * (1 - anchor) + step;
      const lean = ((e.velocity - 84) / 43) * 5 * pocket;    // dug-in notes lean late
      const deltaMs = Math.max(-18, Math.min(18, driftMs + lean));
      const deltaTicks = Math.round(deltaMs * ticksPerMs);
      if (deltaTicks !== 0) {
        const minOnset = i > 0 ? events[i - 1]!.onset + 1 : 0;
        const newOnset = Math.max(minOnset, e.onset + deltaTicks);
        if (newOnset !== e.onset) {
          changes.push({ index: i, onset: e.onset, kind: "pocket",
            detail: `${deltaMs > 0 ? "+" : ""}${deltaMs.toFixed(1)}ms (drift ${driftMs.toFixed(1)})` });
          e.onset = newOnset;
        }
      }
      // The lean is also a weight shift: pushing rides lighter, digging heavier.
      e.velocity = clamp127(e.velocity - deltaMs / 3);
    }
    events.sort((a, b) => a.onset - b.onset); // clamped, but keep the invariant explicit
  }

  // ── Mixed gate: articulation from melodic context (no RNG) ────────────────
  if (opts.mixedGate) {
    for (let i = 0; i < events.length; i++) {
      const e = events[i]!;
      const next = i < events.length - 1 ? events[i + 1] : undefined;
      const w = metricWeight(e.onset, tpb, bpb);
      let detail: string;
      if (next?.note !== undefined && e.note !== undefined && next.note !== e.note
          && Math.abs(next.note - e.note) <= 2) {
        e.duration = Math.max(1, next.onset - e.onset); // slur stepwise motion into its arrival
        detail = "legato (stepwise into next)";
      } else if (next?.note !== undefined && next.note === e.note) {
        e.duration = Math.max(1, Math.round(e.duration * 0.45)); // repeated notes separate
        detail = "detached (repeated note)";
      } else if (w <= 0.15) {
        e.duration = Math.max(1, Math.round(e.duration * 0.5)); // the cracks stay ghosty
        detail = "ghost (weak position)";
      } else {
        e.duration = Math.max(1, Math.round(e.duration * 0.85)); // tenuto default
        detail = "tenuto";
      }
      changes.push({ index: i, onset: e.onset, kind: "gate", detail });
    }
  }

  return {
    phrase: {
      ...phrase,
      events,
      annotations: {
        ...phrase.annotations,
        expression: JSON.stringify({
          seed: opts.seed, pass,
          ...(morph && { morph }), ...(variety && { variety }),
          ...(pocket && { pocket }), ...(opts.mixedGate && { mixedGate: true }),
        }),
      },
    },
    changes,
  };
}
