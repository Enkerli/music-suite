import { describe, it, expect } from "vitest";
import { detectBase, classify, barQuartersFrom, learnFromFiles } from "./comp-style.mjs";
import { STRUM_KEY_NAMES, ARPEGGIO_OFFSETS, DEFAULT_BASE } from "./strum-playable.mjs";
import { generate, toStrumNotes } from "./comp-generate.mjs";

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
    expect(barQuartersFrom("Mister Blisters 12-8 195-bpm")).toEqual({ bar: 6, source: "filename 12/8" });
    expect(barQuartersFrom("Impressions 9-8 90-bpm")).toEqual({ bar: 4.5, source: "filename 9/8" });
    expect(barQuartersFrom("Avrilson 6-8 82-bpm")).toEqual({ bar: 3, source: "filename 6/8" });
    expect(barQuartersFrom("Becky 3-4 132-bpm")).toEqual({ bar: 3, source: "filename 3/4" });
  });

  it("says so when it is assuming", () => {
    expect(barQuartersFrom("Andalusia 170-BPM")).toEqual({ bar: 4, source: "assumed 4/4" });
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

describe("the key map stays consistent between the two tools", () => {
  it("has six arpeggio offsets, ascending, inside thirteen keys", () => {
    expect(ARPEGGIO_OFFSETS).toEqual([4, 5, 7, 9, 11, 12]);
    expect(STRUM_KEY_NAMES).toHaveLength(13);
    expect([...ARPEGGIO_OFFSETS].sort((a, b) => a - b)).toEqual(ARPEGGIO_OFFSETS);
  });
});
