import { describe, it, expect } from "vitest";
import {
  createStyleModel, addTake, realizeDegrees, samplePhrase,
  validateModel, validatePhrase, degreeKey, parseDegreeKey,
  type AccompanimentPhrase, type FrameChord,
} from "./index.js";

const Cm7: FrameChord = { symbol: "Cm7", rootPc: 0, pcs: [0, 3, 7, 10] };
const F7: FrameChord = { symbol: "F7", rootPc: 5, pcs: [5, 9, 0, 3] };

/** A phrase with chord relations and NO absolute notes — what a corpus of
 *  voicing-slot loops produces, since those loops contain no pitch. */
const functionalPhrase = (id: string): AccompanimentPhrase => ({
  v: 1, id, role: "comping", lengthTicks: 4 * 480, ticksPerBeat: 480,
  meter: { numerator: 4, denominator: 4 },
  events: [0, 1, 2].map((v) => ({
    onset: v * 480, duration: 200, velocity: 90 + v, voice: v,
    chordRelation: { degree: v + 1, alteration: 0, octave: 3, category: "chord-tone" as const },
  })),
  harmonicFrames: [{ start: 0, end: 4 * 480, chord: Cm7 }],
});

describe("degree keys", () => {
  it("round-trips a chord tone and a non-chord tone", () => {
    const ct = { degree: 3, alteration: 0, octave: 4, category: "chord-tone" as const };
    expect(degreeKey(ct)).toBe("3:0:chord-tone");
    expect(parseDegreeKey("3:0:chord-tone")).toEqual({ degree: 3, alteration: 0, category: "chord-tone" });
    const nct = { degree: 0, alteration: -1, octave: 4, category: "chromatic-approach" as const };
    expect(degreeKey(nct)).toBe("0:-1:chromatic-approach");
    expect(parseDegreeKey(degreeKey(nct))).toEqual({ degree: 0, alteration: -1, category: "chromatic-approach" });
  });
});

describe("addTake and chord relations", () => {
  it("accumulates degrees from events that carry a relation", () => {
    const m = createStyleModel(Cm7, { id: "t", ticksPerBeat: 480, meter: { numerator: 4, denominator: 4 }, bars: 1, grid: 1 });
    addTake(m, functionalPhrase("a"));
    expect(m.slots[0]!.degrees).toEqual({ "1:0:chord-tone": 1 });
    expect(m.slots[2]!.degrees).toEqual({ "3:0:chord-tone": 1 });
    expect(m.slots[0]!.voices!["0"]!.degrees).toEqual({ "1:0:chord-tone": 1 });
  });

  it("counts note-less events instead of discarding them", () => {
    // These used to be skipped outright, so a corpus with no pitch — exactly
    // what voicing-slot loops are — produced a model of nothing.
    const m = createStyleModel(Cm7, { id: "t", ticksPerBeat: 480, meter: { numerator: 4, denominator: 4 }, bars: 1, grid: 1 });
    addTake(m, functionalPhrase("a"));
    expect(m.slots[0]!.count).toBe(1);
    expect(m.slots[0]!.velSum).toBe(90);
    expect(m.slots[0]!.durSum).toBe(200);
    expect(m.slots[0]!.notes).toEqual({});      // no pitch invented
    expect(validateModel(m).ok).toBe(true);
  });

  it("still records absolute notes when there are any", () => {
    const p = functionalPhrase("a");
    p.events[0]!.note = 60;
    const m = createStyleModel(Cm7, { id: "t", ticksPerBeat: 480, meter: { numerator: 4, denominator: 4 }, bars: 1, grid: 1 });
    addTake(m, p);
    expect(m.slots[0]!.notes).toEqual({ "60": 1 });
    expect(m.slots[0]!.degrees).toEqual({ "1:0:chord-tone": 1 });
  });
});

describe("realizeDegrees", () => {
  const learn = () => {
    const m = createStyleModel(Cm7, { id: "t", ticksPerBeat: 480, meter: { numerator: 4, denominator: 4 }, bars: 1, grid: 1 });
    for (const id of ["a", "b", "c"]) addTake(m, functionalPhrase(id));
    return m;
  };

  it("puts the same functions on a chord the corpus never saw", () => {
    const m = learn();
    const onCm7 = realizeDegrees(m, { chord: Cm7, seed: 1, bassNote: 48 });
    const onF7 = realizeDegrees(m, { chord: F7, seed: 1, bassNote: 48 });
    expect(validatePhrase(onCm7).ok).toBe(true);
    expect(validatePhrase(onF7).ok).toBe(true);
    // Same degrees, different pitch classes — the point of the whole exercise.
    const pcsOf = (p: AccompanimentPhrase) => p.events.map((e) => e.pitchClass);
    expect(pcsOf(onCm7).every((pc) => Cm7.pcs.includes(pc!))).toBe(true);
    expect(pcsOf(onF7).every((pc) => F7.pcs.includes(pc!))).toBe(true);
    expect(pcsOf(onCm7)).not.toEqual(pcsOf(onF7));
  });

  it("keeps the learned durations, which are the articulation", () => {
    // Damping is duration in this material; a realizer that normalises it
    // throws away the difference between a palm mute and a ringing chord.
    const p = realizeDegrees(learn(), { chord: F7, seed: 2 });
    expect(p.events.every((e) => e.duration === 200)).toBe(true);
  });

  it("is reproducible per seed and varies by pass", () => {
    /* Needs a model with something to vary. The uniform fixture above has
       probability 1 and one degree per slot, so every draw gives the same bar
       whatever the seed — a green test there would have proved nothing. */
    const m = createStyleModel(Cm7, { id: "v", ticksPerBeat: 480, meter: { numerator: 4, denominator: 4 }, bars: 1, grid: 1 });
    for (let take = 0; take < 6; take++) {
      const p = functionalPhrase(`t${take}`);
      p.events.forEach((e, i) => { e.chordRelation!.degree = ((i + take) % 4) + 1; });
      if (take % 2) p.events.pop();                 // some takes are sparser
      addTake(m, p);
    }
    expect(m.slots[2]!.count).toBeLessThan(m.slots[2]!.covered);
    expect(Object.keys(m.slots[0]!.degrees!).length).toBeGreaterThan(1);

    const sig = (p: AccompanimentPhrase) => p.events.map((e) => `${e.onset}:${e.note}`).join(",");
    expect(sig(realizeDegrees(m, { chord: Cm7, seed: 7 }))).toBe(sig(realizeDegrees(m, { chord: Cm7, seed: 7 })));
    expect(sig(realizeDegrees(m, { chord: Cm7, seed: 7 })))
      .not.toBe(sig(realizeDegrees(m, { chord: Cm7, seed: 7, pass: 1 })));
  });

  it("refuses a model with no degrees rather than returning silence", () => {
    const m = createStyleModel(Cm7, { id: "old", ticksPerBeat: 480, meter: { numerator: 4, denominator: 4 }, bars: 1, grid: 1 });
    addTake(m, {
      ...functionalPhrase("x"),
      events: [{ onset: 0, duration: 100, velocity: 90, note: 60 }],
    });
    expect(m.slots[0]!.degrees).toBeUndefined();
    expect(() => realizeDegrees(m, { chord: Cm7, seed: 1 })).toThrow(/no chord-relative degrees/);
  });

  it("leaves samplePhrase alone for pitch-bearing models", () => {
    const p = functionalPhrase("a");
    p.events.forEach((e, i) => { e.note = 48 + i * 4; });
    const m = createStyleModel(Cm7, { id: "t", ticksPerBeat: 480, meter: { numerator: 4, denominator: 4 }, bars: 1, grid: 1 });
    for (let i = 0; i < 3; i++) addTake(m, p);
    expect(validatePhrase(samplePhrase(m, { seed: 1 })).ok).toBe(true);
  });
});
