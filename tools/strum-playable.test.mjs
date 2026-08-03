import { describe, it, expect } from "vitest";
import {
  chordKeys, parseChord, makePlayable, makeProbe,
  STRUMMING_KEYS, ARPEGGIO_SLOTS,
} from "./strum-playable.mjs";
import { parseSMF } from "./midi-timing.mjs";
import { createSMF } from "@enkerli/midi";

/* A stand-in for a dragged Strum loop: no tempo meta (the real ones have none),
   a bass slot alone, then a 3-2-1 strum, then a downstroke. */
const loop = () => createSMF([
  { pitch: 76, startTick: 0, durationTicks: 24, velocity: 100 },
  { pitch: 81, startTick: 96, durationTicks: 24, velocity: 90 },
  { pitch: 83, startTick: 98, durationTicks: 24, velocity: 88 },
  { pitch: 84, startTick: 100, durationTicks: 24, velocity: 86 },
  { pitch: 72, startTick: 192, durationTicks: 24, velocity: 110 },
], { ticksPerBeat: 96, bpm: 120 });

describe("Chord Keys, per the GS-2 panel", () => {
  // "Root alone, or with the 1st white and/or black keys on its left."
  it("spells the four qualities off middle C", () => {
    expect(chordKeys(60, "")).toEqual([60]);          // C
    expect(chordKeys(60, "m")).toEqual([58, 60]);     // + A#, the black key left
    expect(chordKeys(60, "7")).toEqual([59, 60]);     // + B,  the white key left
    expect(chordKeys(60, "m7")).toEqual([58, 59, 60]);
  });

  it("finds the neighbours when the root is not C", () => {
    // F(65): E(64) is the white key left, D#(63) the black one.
    expect(chordKeys(65, "m7")).toEqual([63, 64, 65]);
    // G(67): F(65) white, F#(66) black — the black one is ADJACENT here, which
    // is why this is a search rather than root-1 / root-2.
    expect(chordKeys(67, "m7")).toEqual([65, 66, 67]);
  });

  it("reads chord names", () => {
    expect(parseChord("C")).toEqual({ root: 60, quality: "" });
    expect(parseChord("Fm7")).toEqual({ root: 65, quality: "m7" });
    expect(parseChord("Bb7")).toEqual({ root: 70, quality: "7" });
    expect(() => parseChord("Xdim")).toThrow(/unreadable/);
  });
});

describe("makePlayable", () => {
  it("passes every strumming event through untouched", () => {
    const src = parseSMF(Buffer.from(loop()));
    const out = parseSMF(Buffer.from(makePlayable(loop(), { chord: "F" }).bytes));
    const strum = out.notes.filter((n) => n.note >= 72);
    expect(strum.map((n) => [n.tick, n.note, n.vel]))
      .toEqual(src.notes.map((n) => [n.tick, n.note, n.vel]));
  });

  it("holds the chord from before the first gesture to after the last", () => {
    const out = parseSMF(Buffer.from(makePlayable(loop(), { chord: "Fm7" }).bytes));
    const chord = out.notes.filter((n) => n.note < 72);
    expect(chord.map((n) => n.note).sort((a, b) => a - b)).toEqual([63, 64, 65]);
    expect(Math.min(...chord.map((n) => n.tick))).toBe(0);
    // A chord that lifts early silences the last gesture — the bug this guards.
    const release = Math.max(...out.offs.filter((o) => o.note < 72).map((o) => o.tick));
    expect(release).toBeGreaterThanOrEqual(Math.max(...out.notes.map((n) => n.tick)));
  });

  it("keeps the source division, so tick assertions still mean something", () => {
    const out = parseSMF(Buffer.from(makePlayable(loop(), { chord: "C" }).bytes));
    expect(out.division).toBe(96);
  });

  it("prefers a stated tempo over the fallback, and the fallback over 120", () => {
    // loop() carries 120 explicitly, so the fallback must lose.
    expect(makePlayable(loop(), { chord: "C", fallbackBpm: 195 }).tempo).toBe(120);
    // An explicit bpm beats both.
    expect(makePlayable(loop(), { chord: "C", bpm: 88, fallbackBpm: 195 }).tempo).toBe(88);
  });

  it("refuses a chord that would collide with the Strumming Keys", () => {
    // Octave 6 puts C at 84 = Arpeggio 1; silently strumming a "chord" made of
    // strum commands would look like it worked and sound like nonsense.
    expect(() => makePlayable(loop(), { chord: "C", octave: 6 })).toThrow(/Strumming Keys/);
  });
});

describe("the key map itself", () => {
  it("has exactly the thirteen keys 72..84", () => {
    const keys = Object.keys(STRUMMING_KEYS).map(Number).sort((a, b) => a - b);
    expect(keys).toEqual([72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84]);
  });

  it("names every arpeggio slot, in descending string order", () => {
    // Slot 6 is the bass; slot 1 the top string. The corpus evidence for this
    // ordering is in docs/CORPUS_GUITAR_COMPING.md.
    expect(ARPEGGIO_SLOTS.map((n) => STRUMMING_KEYS[n])).toEqual([
      "Arpeggio 6 (bass)", "Arpeggio 5", "Arpeggio 4",
      "Arpeggio 3", "Arpeggio 2", "Arpeggio 1",
    ]);
  });

  it("keeps the arpeggio slots disjoint from the action keys", () => {
    const actions = Object.keys(STRUMMING_KEYS).map(Number)
      .filter((n) => !ARPEGGIO_SLOTS.includes(n));
    expect(actions).toEqual([72, 73, 74, 75, 78, 80, 82]);
    expect(actions.every((n) => !ARPEGGIO_SLOTS.includes(n))).toBe(true);
  });
});

describe("makeProbe", () => {
  it("fires all thirteen keys, one per beat, under a held chord", () => {
    const out = parseSMF(Buffer.from(makeProbe({ chord: "C", division: 96 }).bytes));
    const probe = out.notes.filter((n) => n.note >= 72).sort((a, b) => a.tick - b.tick);
    expect(probe.map((n) => n.note)).toEqual(
      Object.keys(STRUMMING_KEYS).map(Number).sort((a, b) => a - b));
    // One per beat, in order, none simultaneous — otherwise you cannot tell
    // which key made which sound, which is the entire point.
    expect(new Set(probe.map((n) => n.tick)).size).toBe(13);
    expect(probe.map((n) => n.tick)).toEqual(probe.map((_, i) => (i + 1) * 96));
    expect(out.notes.some((n) => n.note === 60 && n.tick === 0)).toBe(true);
  });
});
