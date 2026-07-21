/**
 * Extraction: a plain note list (what MIDIcurator's parser or any SMF reader
 * yields) + the harmony it was played against → an AccompanimentPhrase with
 * inferred chord-relative relations (GLORIARP_BRIEF §5.4, phase 2).
 *
 * Inference is deliberately modest and honest: chord tones and chromatic
 * approaches get categories with confidence; everything else stays
 * "unclassified" (confidence 0) rather than being forced into a bucket.
 * "Next" is CYCLIC — a bar-end approach targets the loop's first event, which
 * is exactly the chord-change behavior the bass adapter needs when tiling.
 *
 * POLYPHONY (EP comping etc.): notes that start within `simultaneityTicks`
 * of each other are one HIT (a chord stab); within a hit, notes are numbered
 * bottom-to-top as VOICES (0 = lowest). Voice numbering is POSITIONAL, not
 * tracked note-by-note across hits — a good-enough heuristic for a steady
 * voicing, honest about its limit (a voicing that adds/drops a note can
 * relabel which physical line is "voice 1"), same spirit as the rest of this
 * module. "Next" for chromatic-approach detection then follows each voice's
 * OWN temporal chain (cyclic within that voice), not raw array adjacency —
 * two simultaneous chord tones are harmony, never an "approach" to each
 * other. A phrase with no polyphony (every hit is one note) takes the exact
 * legacy path — single global chain, no `voice` field — so mono output is
 * byte-identical to before this existed.
 *
 * PROGRESSIONS (docs/GLORIARP_NEXT.md §3g): `frames` generalizes the
 * original single `frame` — each note relates to whichever HarmonicFrame
 * covers its onset instead of one chord for the whole phrase. Nothing about
 * `relate()` itself changes: chord-tone degree was always computed against
 * "the chord passed in", and the chromatic-approach check was always just
 * "one pc-semitone from the next note in this voice's chain" — neither
 * cared whether that chord/next-note happened to be the SAME chord as the
 * current note's. So a note a semitone below the first note of the
 * FOLLOWING chord's span already reads as a chromatic-approach resolving
 * INTO that chord — real voice leading — purely as a side effect of giving
 * each note its own frame; no new inference category was needed. `frame`
 * (singular) keeps working exactly as before — it's just the frames.length
 * === 1 case now, byte-identical output, so every existing caller is
 * unaffected.
 */

import type {
  AccompanimentPhrase, AccompanimentRole, ChordRelation, FrameChord, HarmonicFrame, Meter,
  PhraseEvent, ProvenanceRef,
} from "./phrase.js";
import { PHRASE_SCHEMA_V } from "./phrase.js";

/** The input note shape — @enkerli/midi's MidiNote satisfies it. */
export interface InputNote {
  pitch: number;
  startTick: number;
  durationTicks: number;
  velocity?: number;
  /** Explicit voice id (bypasses onset-clustering — used when the caller
   *  already knows voice identity, e.g. StyleModel sampling). */
  voice?: number;
}

export interface ExtractOptions {
  id: string;
  role: AccompanimentRole;
  meter: Meter;
  ticksPerBeat: number;
  lengthTicks: number;
  /** The single chord the source phrase was played against (slice 1: one
   *  frame). Exactly one of `frame`/`frames` is required — pass `frames`
   *  for a phrase played against a real progression. */
  frame?: FrameChord;
  /** A harmonic timeline (ticks, contiguous, covering [0, lengthTicks)) the
   *  source was played against — a real chord progression, not one vamped
   *  chord. Each note relates to whichever frame covers its onset. */
  frames?: HarmonicFrame[];
  source?: ProvenanceRef;
  /** Notes starting within this many ticks of each other are one "hit" for
   *  voice detection. Default: ticksPerBeat/32 (a 128th note). */
  simultaneityTicks?: number;
}

/** Resolve `frame`/`frames` into one normalized timeline. */
function resolveFrames(opts: ExtractOptions): HarmonicFrame[] {
  if (opts.frames) {
    if (!opts.frames.length) throw new Error("extractPhrase: frames must be non-empty");
    return opts.frames;
  }
  if (opts.frame) return [{ start: 0, end: opts.lengthTicks, chord: opts.frame }];
  throw new Error("extractPhrase: exactly one of `frame`/`frames` is required");
}

/** Frame covering an onset (frames are contiguous, ordered by start). Onsets
 *  past the end of the last frame (a trailing chromatic approach one tick
 *  over) fall back to that last frame — same defensive edge as bass.ts's
 *  own frameAt. */
function frameAt(frames: HarmonicFrame[], onset: number): HarmonicFrame {
  for (const f of frames) if (onset >= f.start && onset < f.end) return f;
  return frames[frames.length - 1]!;
}

const mod12 = (n: number) => ((n % 12) + 12) % 12;

/** Shortest pitch-class distance (0..6). */
const pcDistance = (a: number, b: number) => {
  const d = mod12(a - b);
  return Math.min(d, 12 - d);
};

/** 1-based degree of a pc in the chord (position in pcs), or 0. */
export function chordDegreeOf(pc: number, chord: FrameChord): number {
  const i = chord.pcs.findIndex((p) => mod12(p) === mod12(pc));
  return i === -1 ? 0 : i + 1;
}

function relate(note: number, next: number | undefined, chord: FrameChord, targetIndex: number): ChordRelation {
  const pc = mod12(note);
  const octave = Math.floor(note / 12);
  const degree = chordDegreeOf(pc, chord);
  if (degree > 0) {
    return { degree, alteration: 0, octave, category: "chord-tone", confidence: 1 };
  }
  if (next !== undefined && pcDistance(pc, mod12(next)) === 1) {
    // One pc-semitone from the (cyclic) next event: read it as an approach.
    // alteration is the signed offset FROM the target's pc (+1 above, -1 below).
    const above = mod12(pc - mod12(next)) === 1;
    return { degree: 0, alteration: above ? 1 : -1, octave, category: "chromatic-approach", confidence: 0.75, target: targetIndex };
  }
  return { degree: 0, alteration: 0, octave, category: "unclassified", confidence: 0 };
}

/** Assign a voice index to each (already time/pitch-sorted) note. Returns
 *  null if the input is monophonic (every hit is a single note) — the
 *  signal to take the legacy no-voice path untouched. */
function detectVoices(sorted: InputNote[], simultaneityTicks: number): number[] | null {
  // Explicit voice ids win outright (StyleModel sampling passes them).
  if (sorted.some((n) => n.voice !== undefined)) return sorted.map((n) => n.voice ?? 0);

  const hits: number[][] = []; // groups of indices into `sorted`
  let hitStart = -Infinity;
  let current: number[] = [];
  sorted.forEach((n, i) => {
    if (i === 0 || n.startTick - hitStart > simultaneityTicks) {
      if (current.length) hits.push(current);
      current = [i];
      hitStart = n.startTick;
    } else {
      current.push(i);
    }
  });
  if (current.length) hits.push(current);

  if (hits.every((h) => h.length === 1)) return null; // purely monophonic

  const voices = new Array<number>(sorted.length).fill(0);
  for (const hit of hits) {
    const byPitch = [...hit].sort((a, b) => sorted[a]!.pitch - sorted[b]!.pitch);
    byPitch.forEach((idx, v) => { voices[idx] = v; });
  }
  return voices;
}

/** Notes + a harmonic timeline (one frame, or a real progression) → a
 *  validated-shape AccompanimentPhrase. */
export function extractPhrase(notes: InputNote[], opts: ExtractOptions): AccompanimentPhrase {
  const frames = resolveFrames(opts);
  const sorted = [...notes].sort((a, b) => a.startTick - b.startTick || a.pitch - b.pitch);
  const tolerance = opts.simultaneityTicks ?? Math.max(1, Math.round(opts.ticksPerBeat / 32));
  const voices = detectVoices(sorted, tolerance);

  // Per-voice (or, when `voices` is null, one global) temporal chains:
  // chain[v] lists indices into `sorted`, in time order, for cyclic "next".
  const chains = new Map<number, number[]>();
  sorted.forEach((_, i) => {
    const v = voices ? voices[i]! : 0;
    if (!chains.has(v)) chains.set(v, []);
    chains.get(v)!.push(i);
  });
  // next-in-chain lookup: index i → the following index in ITS chain (cyclic).
  const nextOf = new Map<number, number>();
  for (const chain of chains.values()) {
    chain.forEach((idx, pos) => nextOf.set(idx, chain[(pos + 1) % chain.length]!));
  }

  const events: PhraseEvent[] = sorted.map((n, i) => {
    const nextIndex = nextOf.get(i)!;
    const next = sorted.length > 1 ? sorted[nextIndex]!.pitch : undefined;
    return {
      onset: n.startTick,
      duration: n.durationTicks,
      velocity: n.velocity ?? 96,
      note: n.pitch,
      pitchClass: mod12(n.pitch),
      chordRelation: relate(n.pitch, next, frameAt(frames, n.startTick).chord, nextIndex),
      sourceEventId: `e${i}`,
      ...(voices && { voice: voices[i] }),
    };
  });
  return {
    v: PHRASE_SCHEMA_V,
    id: opts.id,
    role: opts.role,
    lengthTicks: opts.lengthTicks,
    ticksPerBeat: opts.ticksPerBeat,
    meter: opts.meter,
    ...(opts.source !== undefined && { source: opts.source }),
    events,
    harmonicFrames: frames,
  };
}
