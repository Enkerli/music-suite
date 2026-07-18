/**
 * Rhythm replacement — the interop dividend (docs/PRIORITIES.md §2.1):
 * keep a source phrase's PITCH MATERIAL (chord-relative annotations, contour,
 * dynamics) but perform it on a different onset grid — a Euclidean tresillo,
 * a polygon composite, any rhythm the suite can express. The engine takes the
 * pattern as plain data ({steps, accents}, leftmost = LSB like every mask in
 * the suite); the CLI parses UPI notation into it, so this package stays free
 * of the notation dependency.
 *
 * Mapping rules (all deterministic, no RNG here):
 *   · the pattern spans the phrase's full length: ticksPerStep =
 *     lengthTicks / steps.length (E(3,8) over a 4/4 bar = half-beat grid;
 *     a 15-step polygon composite lands as a 15-grid over the same bar);
 *   · onset k takes its pitch material from source pitched-event k (cycling
 *     when the pattern has more onsets than the source has events) — contour
 *     and harmonic function ride along, rhythm is replaced wholesale;
 *   · durations are legato-to-next-onset (the tied tresillo-bass feel);
 *     the articulation pack (PRIORITIES §2.3) will add gate policies;
 *   · an accent layer boosts velocity on accented steps (+18, clamped);
 *   · a chromatic approach's cyclic `target` re-points to the NEXT onset —
 *     "resolves to whatever comes next" is the approach's musical meaning,
 *     independent of which grid it lives on.
 */

import type { AccompanimentPhrase, ChordRelation, PhraseEvent } from "./phrase.js";

export interface RhythmSpec {
  /** Onset mask, leftmost = LSB (step i = slot i). At least one onset. */
  steps: number[];
  /** Optional accent layer, aligned to steps. */
  accents?: number[];
  /** For provenance / ids, e.g. "E(3,8)". */
  label?: string;
}

const clamp127 = (v: number) => Math.max(1, Math.min(127, Math.round(v)));

/** Perform `source`'s pitch material on the `rhythm` grid → a new phrase. */
export function applyRhythm(source: AccompanimentPhrase, rhythm: RhythmSpec): AccompanimentPhrase {
  const onsetsSteps = rhythm.steps.flatMap((on, i) => (on ? [i] : []));
  if (!onsetsSteps.length) throw new Error("applyRhythm: the rhythm has no onsets");
  const material = source.events.filter((e) => e.note !== undefined);
  if (!material.length) throw new Error("applyRhythm: the source phrase has no pitched events");

  const ticksPerStep = source.lengthTicks / rhythm.steps.length;
  const onsets = onsetsSteps.map((s) => Math.round(s * ticksPerStep));

  const events: PhraseEvent[] = onsets.map((onset, k) => {
    const src = material[k % material.length]!;
    const nextOnset = k + 1 < onsets.length ? onsets[k + 1]! : source.lengthTicks;
    const accented = rhythm.accents?.[onsetsSteps[k]!] ? 18 : 0;
    let chordRelation: ChordRelation | undefined;
    if (src.chordRelation) {
      chordRelation = { ...src.chordRelation };
      if (chordRelation.category === "chromatic-approach") {
        chordRelation.target = (k + 1) % onsets.length; // resolve to the next onset, cyclically
      } else {
        delete chordRelation.target;
      }
    }
    return {
      onset,
      duration: Math.max(1, nextOnset - onset),
      velocity: clamp127(src.velocity + accented),
      note: src.note!,
      ...(src.pitchClass !== undefined && { pitchClass: src.pitchClass }),
      ...(chordRelation !== undefined && { chordRelation }),
      ...(src.sourceEventId !== undefined && { sourceEventId: src.sourceEventId }),
    };
  });

  return {
    ...source,
    id: `${source.id}+${rhythm.label ?? `r${onsetsSteps.length}of${rhythm.steps.length}`}`,
    events,
    annotations: { ...source.annotations, rhythm: rhythm.label ?? rhythm.steps.join("") },
  };
}
