import { describe, it, expect } from "vitest";
import { detectBase, classify, barQuartersFrom, learnFromFiles } from "./comp-style.mjs";
import { STRUM_KEY_NAMES, ARPEGGIO_OFFSETS, DEFAULT_BASE } from "./strum-playable.mjs";
import { generate, toStrumNotes, toPhrase, chordSpec } from "./comp-generate.mjs";
import { validatePhrase, validateModel, samplePhrase } from "@enkerli/accompaniment";
import { gridFor, toStyleModel } from "./comp-model.mjs";

const at = (base, off, tick, vel = 100) => ({ note: base + off, tick, vel, channel: 1 });

describe("detectBase", () => {
  it("finds the C5 base most packs use", () => {
    expect(detectBase([72, 76, 79, 81, 83, 84])).toBe(72);
  });

  it("finds the C1 base Pop Rocks uses", () => {
    expect(detectBase([24, 28, 31, 33, 35, 36])).toBe(24);
  });

  it("does NOT slide up when the low keys are unused", () => {
    // The bug this replaced: searching every semitone made the best-covering
    // window start at the lowest note, so a loop that never plays Downstroke
    // had its whole map shifted and "Arpeggio 5" was read as "Downstroke".
    expect(detectBase([76, 79, 81, 83, 84])).toBe(72);
    expect(detectBase([83, 84])).toBe(72);
  });

  it("tolerates a stray note but rejects genuine noise", () => {
    // Thirteen files across the library carry one note outside the block.
    expect(detectBase([72, 74, 76, 79, 81, 83, 84, 86, 72, 72])).toBe(72);
    // A drum part is not this language at any base.
    expect(detectBase([36, 38, 42, 42, 36, 46, 38, 51, 44, 49])).toBe(null);
  });
});

describe("barQuartersFrom", () => {
  it("reads a stated meter, counting x/8 in quarters", () => {
    expect(barQuartersFrom("Mister Blisters 12-8 195-bpm"))
      .toEqual({ bar: 6, numerator: 12, denominator: 8, source: "filename 12/8" });
    expect(barQuartersFrom("Impressions 9-8 90-bpm"))
      .toEqual({ bar: 4.5, numerator: 9, denominator: 8, source: "filename 9/8" });
    expect(barQuartersFrom("Becky 3-4 132-bpm"))
      .toEqual({ bar: 3, numerator: 3, denominator: 4, source: "filename 3/4" });
  });

  it("keeps 12/8 and 6/4 apart though both are six quarters", () => {
    // Only the quarters were stored at first, which a phrase cannot use.
    const a = barQuartersFrom("X 12-8 100-bpm"), b = barQuartersFrom("X 6-4 100-bpm");
    expect(a.bar).toBe(b.bar);
    expect([a.numerator, a.denominator]).not.toEqual([b.numerator, b.denominator]);
  });

  it("says so when it is assuming", () => {
    expect(barQuartersFrom("Andalusia 170-BPM"))
      .toEqual({ bar: 4, numerator: 4, denominator: 4, source: "assumed 4/4" });
  });
});

describe("classify", () => {
  const B = DEFAULT_BASE;
  it("names an action key", () => {
    expect(classify([at(B, 0, 0)], B).kind).toBe("Downstroke");
    expect(classify([at(B, 6, 0)], B).kind).toBe("Muffled down");
  });

  it("calls a lone voice a pluck, numbered from the bass", () => {
    expect(classify([at(B, ARPEGGIO_OFFSETS[0], 0)], B).kind).toBe("pluck1");
    expect(classify([at(B, ARPEGGIO_OFFSETS[5], 0)], B).kind).toBe("pluck6");
  });

  it("reads a downstroke sweep as a strum with a run and a direction", () => {
    // Slots 3,4,5 swept low to high — the "strings 3-2-1" Alex heard.
    const g = [at(B, 9, 0), at(B, 11, 2), at(B, 12, 4)];
    const c = classify(g, B);
    expect(c.kind).toBe("strum");
    expect(c.run).toEqual([3, 5]);
    expect(c.dir).toBe("down");
    expect(c.spread).toBe(4);
    expect(c.gapped).toBe(false);
  });

  it("reads the reverse sweep as an upstroke", () => {
    const c = classify([at(B, 12, 0), at(B, 11, 2), at(B, 9, 4)], B);
    expect(c.dir).toBe("up");
    expect(c.run).toEqual([3, 5]);
  });

  it("flags a skipped voice rather than pretending the run is solid", () => {
    const c = classify([at(B, 9, 0), at(B, 12, 3)], B);   // slots 3 and 5, no 4
    expect(c.gapped).toBe(true);
  });

  it("reads the same gestures at a transposed base", () => {
    const lo = classify([at(24, 9, 0), at(24, 11, 2), at(24, 12, 4)], 24);
    const hi = classify([at(72, 9, 0), at(72, 11, 2), at(72, 12, 4)], 72);
    expect(lo).toEqual(hi);
  });
});

describe("generate", () => {
  const style = {
    id: "t", kind: "comp-style", version: 1,
    grid: { perBeat: 2, barQuarters: 6, slotsPerBar: 12 },
    slots: [
      { slot: 0, p: 1, kinds: { pluck1: 1 }, velocity: { mean: 100, sd: 0 }, push: 0, pushSd: 0, strum: null },
      { slot: 3, p: 1, kinds: { strum: 1 }, velocity: { mean: 90, sd: 0 }, push: 0, pushSd: 0,
        strum: { runs: { "3-5": 1 }, direction: { down: 1 }, spreadQuarters: { mean: 0.04, sd: 0 } } },
      { slot: 6, p: 0, kinds: { Downstroke: 1 }, velocity: { mean: 90, sd: 0 }, push: 0, pushSd: 0, strum: null },
    ],
  };

  it("is reproducible for a seed, and p=0 never fires", () => {
    const a = generate(style, { bars: 2, seed: 5 });
    const b = generate(style, { bars: 2, seed: 5 });
    expect(a.events).toEqual(b.events);
    expect(a.events.some((e) => e.slot === 6)).toBe(false);
    expect(a.events.filter((e) => e.bar === 0).map((e) => e.slot)).toEqual([0, 3]);
  });

  it("keeps a strum as a gesture, not as six onsets", () => {
    const e = generate(style, { bars: 1, seed: 1 }).events.find((x) => x.kind === "strum");
    expect(e.run).toEqual([3, 5]);
    expect(e.dir).toBe("down");
    // Expanding it is the renderer's job, and only there.
    const notes = toStrumNotes(generate(style, { bars: 1, seed: 1 }), { division: 96 });
    const strum = notes.filter((n) => n.pitch >= DEFAULT_BASE + 9);
    expect(strum.map((n) => n.pitch)).toEqual([81, 83, 84]);
    expect(strum[0].startTick).toBeLessThan(strum[2].startTick);   // swept, not stacked
  });

  it("renders at a transposed base without relearning", () => {
    const take = generate(style, { bars: 1, seed: 1 });
    const hi = toStrumNotes(take, { base: 72, division: 96 });
    const lo = toStrumNotes(take, { base: 24, division: 96 });
    expect(lo.map((n) => n.pitch + 48)).toEqual(hi.map((n) => n.pitch));
  });

  it("refuses a style with no bar length", () => {
    expect(() => generate({ id: "x", grid: {}, slots: [] })).toThrow(/no bar length/);
  });
});

describe("toPhrase — the GloriArp bridge", () => {
  const style = {
    id: "t", kind: "comp-style", version: 1,
    grid: { perBeat: 2, barQuarters: 6, slotsPerBar: 12, meter: { numerator: 12, denominator: 8 } },
    slots: [
      { slot: 0, p: 1, kinds: { pluck1: 1 }, velocity: { mean: 100, sd: 0 }, push: 0, pushSd: 0, strum: null },
      { slot: 3, p: 1, kinds: { strum: 1 }, velocity: { mean: 90, sd: 0 }, push: 0, pushSd: 0,
        strum: { runs: { "3-5": 1 }, direction: { down: 1 }, spreadQuarters: { mean: 0.04, sd: 0 } } },
      { slot: 6, p: 1, kinds: { "Palm mute": 1 }, velocity: { mean: 80, sd: 0 }, push: 0, pushSd: 0, strum: null },
    ],
  };
  const take = () => generate(style, { bars: 2, seed: 4 });

  it("passes GloriArp's own validator, with and without a chord", () => {
    // The import error that started this: a style is a distribution and
    // GloriArp takes phrases, so it must be SAMPLED first.
    expect(validatePhrase(toPhrase(take(), { chord: chordSpec("Am7") })).ok).toBe(true);
    expect(validatePhrase(toPhrase(take(), { chord: null })).ok).toBe(true);
  });

  it("carries the real time signature, not just the bar length", () => {
    // 12/8 and 6/4 are both six quarters; a phrase has to say which.
    expect(toPhrase(take(), {}).meter).toEqual({ numerator: 12, denominator: 8 });
  });

  it("stacks the default voicing ASCENDING even when the pitch classes wrap", () => {
    // Am7 is [9,0,4,7]: naive octave arithmetic puts voice 1 (C3) below the
    // A3 bass. Every voice must be higher than the one under it.
    const p = toPhrase(take(), { chord: chordSpec("Am7") });
    const byVoice = new Map();
    for (const e of p.events) if (!byVoice.has(e.voice)) byVoice.set(e.voice, e.note);
    const notes = [...byVoice].sort((a, b) => a[0] - b[0]).map(([, n]) => n);
    expect(notes).toEqual([57, 60, 64, 67, 69, 72]);          // A3 C4 E4 G4 A4 C5
    expect(notes.every((n, i) => !i || n > notes[i - 1])).toBe(true);
  });

  it("omits note but keeps voice and degree when there is no chord", () => {
    const p = toPhrase(take(), { chord: null });
    expect(p.events.every((e) => e.note === undefined)).toBe(true);
    expect(p.events.every((e) => Number.isInteger(e.chordRelation.degree))).toBe(true);
    expect(p.harmonicFrames).toBeUndefined();
  });

  it("marks the default voicing as inferred, not asserted", () => {
    // Strum's real voicing is not in the MIDI — the probe showed C major as
    // C3 C3 G3 C4 E4 G4, which no stack produces. Say so rather than imply it.
    const guessed = toPhrase(take(), { chord: chordSpec("C") });
    expect(guessed.events[0].chordRelation.confidence).toBe(0.5);
    const told = toPhrase(take(), { chord: chordSpec("C"), voicing: [48, 55, 60, 64, 67, 72] });
    expect(told.events[0].chordRelation.confidence).toBe(0.9);
  });

  it("expands a damped action to the whole hand, short", () => {
    const p = toPhrase(take(), { chord: chordSpec("C") });
    const slotTicks = 96 / 2;
    const muted = p.events.filter((e) => Math.abs(e.onset - 6 * slotTicks) < slotTicks / 2);
    expect(muted).toHaveLength(6);                              // six voices
    expect(muted.every((e) => e.duration < slotTicks * 0.5)).toBe(true);
  });
});

describe("comp-model — the GloriArp style-model bridge", () => {
  const styleWith = (slotsPerBar, meter, perBeat) => ({
    id: "t", kind: "comp-style", version: 1,
    grid: { perBeat, barQuarters: 4, slotsPerBar, meter },
    slots: [
      { slot: 0, p: 1, kinds: { pluck1: 1 }, velocity: { mean: 100, sd: 2 }, push: 0, pushSd: 0, strum: null },
      { slot: 2, p: 0.8, kinds: { strum: 1 }, velocity: { mean: 90, sd: 3 }, push: 0, pushSd: 0.02,
        strum: { runs: { "2-5": 1 }, direction: { down: 1 }, spreadQuarters: { mean: 0.04, sd: 0.01 } } },
    ],
  });

  it("computes grid as slots per DENOMINATOR unit, not per quarter", () => {
    // The trap: a model's beat is one denominator unit, so a 12-slot 12/8 bar
    // is grid 1 (per eighth) while a 12-slot 3/4 bar is grid 4 (sixteenths).
    // Getting it wrong does not throw — it silently misplaces every onset.
    expect(gridFor(styleWith(12, { numerator: 12, denominator: 8 }, 2))).toBe(1);
    expect(gridFor(styleWith(12, { numerator: 3, denominator: 4 }, 4))).toBe(4);
    expect(gridFor(styleWith(16, { numerator: 4, denominator: 4 }, 4))).toBe(4);
    expect(gridFor(styleWith(18, { numerator: 9, denominator: 8 }, 4))).toBe(2);
  });

  it("refuses a bar whose slots do not divide the beats evenly", () => {
    expect(() => gridFor(styleWith(10, { numerator: 4, denominator: 4 }, 4))).toThrow(/whole slots per beat/);
  });

  it("produces a model GloriArp validates and can sample", () => {
    const { model } = toStyleModel(styleWith(16, { numerator: 4, denominator: 4 }, 4),
      { chord: chordSpec("Am7"), takes: 8, bars: 2 });
    expect(validateModel(model).ok).toBe(true);
    expect(model.role).toBe("comping");
    expect(model.ticksPerBeat).toBe(480);       // 120 a slot × grid 4, as Funkastic's files use
    expect(model.takes).toBe(8);
    const p = samplePhrase(model, { seed: 1, pass: 0 });
    expect(validatePhrase(p).ok).toBe(true);
    expect(p.events.length).toBeGreaterThan(0);
  });

  it("lands 12/8 onsets on real slots rather than half of them", () => {
    // With ticksPerBeat/perBeat instead of explicit slot ticks, every onset in
    // a 12/8 model came out at half its slot index.
    const { model, ticksPerBeat } = toStyleModel(styleWith(12, { numerator: 12, denominator: 8 }, 2),
      { chord: chordSpec("C"), takes: 4, bars: 1 });
    expect(ticksPerBeat).toBe(120);
    expect(model.slots.length).toBe(1 * 12 * 1);           // bars × numerator × grid
    // Slot 2 fires in the style, so slot 2 must carry counts — not slot 1.
    expect(model.slots[2].count).toBeGreaterThan(0);
    expect(model.slots[0].count).toBeGreaterThan(0);
  });

  it("refuses to invent a frame chord", () => {
    expect(() => toStyleModel(styleWith(16, { numerator: 4, denominator: 4 }, 4), { takes: 2 }))
      .toThrow(/frame chord is required/);
  });

  it("records that the frame was chosen, not observed", () => {
    // Funkastic's models mean "the clips really were played over C-9". A
    // comping style has no harmony at all, so the frame is our pick.
    const { model } = toStyleModel(styleWith(16, { numerator: 4, denominator: 4 }, 4),
      { chord: chordSpec("Cm7"), takes: 4 });
    expect(model.source.note).toMatch(/CHOSEN reference, not one the source stated/);
  });
});

describe("the key map stays consistent between the two tools", () => {
  it("has six arpeggio offsets, ascending, inside thirteen keys", () => {
    expect(ARPEGGIO_OFFSETS).toEqual([4, 5, 7, 9, 11, 12]);
    expect(STRUM_KEY_NAMES).toHaveLength(13);
    expect([...ARPEGGIO_OFFSETS].sort((a, b) => a - b)).toEqual(ARPEGGIO_OFFSETS);
  });
});
