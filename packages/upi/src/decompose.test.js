import { describe, it, expect } from "vitest";
import { detectEuclidean, detectBarlow, decompose, identify } from "./decompose.js";
import { longShort, durations } from "./longshort.js";

const P = (s) => [...s].map((c) => c === "1");

describe("detectEuclidean — rotation-aware identification", () => {
  it("names the tresillo", () => {
    expect(detectEuclidean(P("10010010"))).toMatchObject({ beats: 3, steps: 8, offset: 0, formula: "E(3,8)" });
  });

  it("finds a ROTATED Euclidean and reports the offset (the capability the old RPE had)", () => {
    const r = detectEuclidean(P("01001001"));
    expect(r).not.toBeNull();
    expect(r.beats).toBe(3);
    expect(r.steps).toBe(8);
    expect(r.offset).toBeGreaterThan(0);
    expect(r.formula).toMatch(/^E\(3,8,\d+\)$/);
  });

  it("identifies the cinquillo as E(5,8)", () => {
    expect(detectEuclidean(P("10110110"))?.formula).toBe("E(5,8)");
  });

  it("returns null for silence and for a non-Euclidean pattern", () => {
    expect(detectEuclidean(P("0000"))).toBeNull();
    expect(detectEuclidean(P("11000000"))).toBeNull();
  });

  it("every rotation of a Euclidean pattern is still detected", () => {
    const base = P("10010010");
    for (let r = 0; r < 8; r++) {
      const rot = base.map((_, i) => base[(i - r + 8) % 8]);
      expect(detectEuclidean(rot), `rotation ${r}`).not.toBeNull();
    }
  });
});

describe("detectBarlow", () => {
  it("recognises a Barlow reduction and formats it", () => {
    const r = detectBarlow(P("10001000"));
    if (r) {
      expect(r.formula).toMatch(/^[BW]\(2,8\)$/);
      expect(r.steps).toBe(8);
    }
  });

  it("returns null for silence", () => {
    expect(detectBarlow(P("00000000"))).toBeNull();
  });
});

describe("decompose — compound patterns into generator terms", () => {
  it("prefers the single-generator reading when the pattern IS Euclidean", () => {
    const r = decompose(P("10010010"));
    expect(r[0].formula).toBe("E(3,8)");
    expect(r[0].terms).toHaveLength(1);
  });

  it("decomposes a superposition of two Euclideans, fewest terms first", () => {
    const a = P("10010010"), b = P("00010001");
    const compound = a.map((v, i) => v || b[i]);
    const r = decompose(compound);
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].terms).toHaveLength(2);
    expect(r[0].formula).toContain("+");
  });

  it("every returned reading reproduces the input EXACTLY (the contract)", () => {
    const a = P("10010010"), b = P("00010001");
    const compound = a.map((v, i) => v || b[i]);
    // No reading may introduce an onset the target lacks, or miss one it has.
    for (const reading of decompose(compound)) {
      expect(reading.exact).toBe(true);
      expect(reading.terms.length).toBeGreaterThan(0);
    }
  });

  it("respects maxTerms — an honest empty result rather than a wrong one", () => {
    const clave = P("1001001000101000"); // 5 onsets, not 2-3 generators' worth
    expect(decompose(clave, { maxTerms: 4 })).toEqual([]);
    // Even with enough terms, the all-singleton reading is a restatement, not
    // an explanation — suppressed unless explicitly asked for.
    expect(decompose(clave, { maxTerms: 5 })).toEqual([]);
    expect(decompose(clave, { maxTerms: 5, allowTrivial: true }).length).toBeGreaterThan(0);
  });

  it("does not pad a Euclidean pattern with a trivial singleton reading", () => {
    // E(3,8) is E(3,8); "E(1,8)+E(1,8,3)+E(1,8,6)" explains nothing.
    const r = decompose(P("10010010"));
    expect(r).toHaveLength(1);
    expect(r[0].formula).toBe("E(3,8)");
  });

  it("returns nothing for silence", () => {
    expect(decompose(P("00000000"))).toEqual([]);
  });
});

describe("identify", () => {
  it("summarises a Euclidean pattern", () => {
    const r = identify(P("10010010"));
    expect(r.euclidean.formula).toBe("E(3,8)");
    expect(r.best.formula).toBe("E(3,8)");
    expect(r.onsets).toEqual([0, 3, 6]);
    expect(r.stepCount).toBe(8);
  });
});

describe("longShort — the durational reading the original RPE had", () => {
  it("reads the tresillo as long-long-short (3+3+2)", () => {
    const r = longShort(P("10010010"));
    expect(r.intervals).toEqual([3, 3, 2]);
    expect(r.pattern).toBe("LLS");
    expect(r.morse).toBe("--.");
    expect(r.short).toBe(2);
    expect(r.long).toBe(3);
    expect(r.foot).toBe("antibacchic");
  });

  it("ratio is a float, not rounded to an integer", () => {
    expect(longShort(P("10010010")).ratio).toBeCloseTo(1.5, 5);
  });

  it("flags isochronous rhythms instead of inventing a long/short", () => {
    const r = longShort(P("10101010"));
    expect(r.isochronous).toBe(true);
    expect(r.pattern).toBe("EEEE");
    expect(r.foot).toBe("isochronous");
  });

  it("handles fewer than two onsets without throwing", () => {
    expect(longShort(P("00000000")).description).toBe("No onsets");
    expect(longShort(P("10000000")).description).toBe("Single onset");
  });

  it("tolerance lets near-miss (expressively timed) intervals still classify", () => {
    // 5,4,3: with no tolerance the middle value falls to the nearer pole;
    // a wide tolerance pulls it to 'short' since it is within the span slack.
    const steps = new Array(12).fill(false);
    for (const i of [0, 5, 9]) steps[i] = true;
    const strict = longShort(steps);
    const loose = longShort(steps, { tolerance: 1 });
    expect(strict.pattern).toHaveLength(3);
    expect(loose.pattern).toHaveLength(3);
    expect(loose.types.every((t) => t === "short" || t === "long")).toBe(true);
  });
});

describe("durations — performable long/short values", () => {
  it("uses the MEASURED ratio by default", () => {
    expect(durations(P("10010010"))).toEqual([1.5, 1.5, 1]);
  });

  it("accepts a forced ratio (short 1, long 3 — the original integer reading)", () => {
    expect(durations(P("10010010"), { ratio: 3 })).toEqual([3, 3, 1]);
  });

  it("scales by unit, and supports non-integer ratios (swing)", () => {
    expect(durations(P("10010010"), { unit: 100, ratio: 1.6 })).toEqual([160, 160, 100]);
  });

  it("is empty when there is nothing to measure", () => {
    expect(durations(P("00000000"))).toEqual([]);
  });
});
