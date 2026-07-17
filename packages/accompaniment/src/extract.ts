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
 */

import type {
  AccompanimentPhrase, AccompanimentRole, ChordRelation, FrameChord, Meter,
  PhraseEvent, ProvenanceRef,
} from "./phrase.js";
import { PHRASE_SCHEMA_V } from "./phrase.js";

/** The input note shape — @enkerli/midi's MidiNote satisfies it. */
export interface InputNote {
  pitch: number;
  startTick: number;
  durationTicks: number;
  velocity?: number;
}

export interface ExtractOptions {
  id: string;
  role: AccompanimentRole;
  meter: Meter;
  ticksPerBeat: number;
  lengthTicks: number;
  /** The single chord the source phrase was played against (slice 1: one frame). */
  frame: FrameChord;
  source?: ProvenanceRef;
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

/** Notes + one harmonic frame → a validated-shape AccompanimentPhrase. */
export function extractPhrase(notes: InputNote[], opts: ExtractOptions): AccompanimentPhrase {
  const sorted = [...notes].sort((a, b) => a.startTick - b.startTick || a.pitch - b.pitch);
  const events: PhraseEvent[] = sorted.map((n, i) => {
    const nextIndex = (i + 1) % sorted.length;
    const next = sorted.length > 1 ? sorted[nextIndex]!.pitch : undefined;
    return {
      onset: n.startTick,
      duration: n.durationTicks,
      velocity: n.velocity ?? 96,
      note: n.pitch,
      pitchClass: mod12(n.pitch),
      chordRelation: relate(n.pitch, next, opts.frame, nextIndex),
      sourceEventId: `e${i}`,
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
    harmonicFrames: [{ start: 0, end: opts.lengthTicks, chord: opts.frame }],
  };
}
