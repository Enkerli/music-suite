import { describe, it, expect } from "vitest";
import { detectEuclidean, detectBarlow, decompose, identify } from "./decompose.js";
import { longShort, durations, dynamicDurations } from "./longshort.js";
import { parseNamedPattern, parseNamedPatterns, describeNamedPattern } from "./named.js";

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

describe("named patterns — import by name", () => {
  it("parses an onset list with an explicit step count", () => {
    const r = parseNamedPattern("Fume-Fume: [0,2,4,7,9]/12");
    expect(r.name).toBe("Fume-Fume");
    expect(r.stepCount).toBe(12);
    expect(r.steps.map((s, i) => (s ? i : -1)).filter((i) => i >= 0)).toEqual([0, 2, 4, 7, 9]);
  });

  it("parses hex in UPI's own convention — 0x5BA:12 IS the bembé bell", () => {
    const r = parseNamedPattern("Bembé: 0x5BA:12");
    expect(r.stepCount).toBe(12);
    expect(r.steps.map((s, i) => (s ? i : -1)).filter((i) => i >= 0)).toEqual([0, 2, 4, 5, 7, 9, 11]);
  });

  it("accepts binary and UPI expressions too", () => {
    expect(parseNamedPattern("Tresillo: 10010010").stepCount).toBe(8);
    const gahu = parseNamedPattern("Gahu: E(7,12)");
    expect(gahu.stepCount).toBe(12);
  });

  it("tolerates quoted, JSON-ish lines", () => {
    const r = parseNamedPattern('"Fume-Fume": [0,2,4,7,9]/12,');
    expect(r.name).toBe("Fume-Fume");
  });

  it("rejects onsets that fall outside the step count, naming the pattern", () => {
    expect(() => parseNamedPattern("Bad: [0,5,99]/8")).toThrow(/99.*outside 8 steps/);
  });

  it("a block collects errors per line instead of discarding the good ones", () => {
    const { patterns, errors } = parseNamedPatterns(`
      # a comment
      Fume-Fume: [0,2,4,7,9]/12
      Broken: [0,99]/8
      Tresillo: 10010010
    `);
    expect(patterns.map((p) => p.name)).toEqual(["Fume-Fume", "Tresillo"]);
    expect(errors).toHaveLength(1);
    expect(errors[0].line).toBeGreaterThan(0);
  });

  it("describeNamedPattern carries the analysis the library filters on", () => {
    const d = describeNamedPattern(parseNamedPattern("Tresillo: 10010010"));
    expect(d.euclidean).toBe("E(3,8)");
    expect(d.foot).toBe("antibacchic");
    expect(d.onsetCount).toBe(3);
    expect(d.binary).toBe("10010010");
  });
});

describe("dynamicDurations — push/pull on the long/short contrast", () => {
  const T = P("10010010");

  it("depth 0 is exactly the static reading", () => {
    expect(dynamicDurations(T, { depth: 0 })).toEqual(durations(T));
  });

  it("is deterministic: same seed and pass, same output", () => {
    const a = dynamicDurations(T, { depth: 0.5, seed: 7, pass: 1 });
    const b = dynamicDurations(T, { depth: 0.5, seed: 7, pass: 1 });
    expect(a).toEqual(b);
  });

  it("a different pass breathes differently (the loop is not frozen)", () => {
    const p0 = dynamicDurations(T, { depth: 0.5, seed: 7, pass: 0 });
    const p1 = dynamicDurations(T, { depth: 0.5, seed: 7, pass: 1 });
    expect(p0).not.toEqual(p1);
  });

  it("an explicit ratio RANGE is a promise — the walk never leaves it", () => {
    for (let seed = 1; seed < 60; seed++) {
      for (const d of dynamicDurations(T, { ratio: [1.4, 1.8], depth: 1, seed })) {
        if (d > 1.05) { // a 'long'; shorts stay at unit
          expect(d).toBeGreaterThanOrEqual(1.4 - 1e-9);
          expect(d).toBeLessThanOrEqual(1.8 + 1e-9);
        }
      }
    }
  });

  it("shorts stay at the unit — the contrast moves, not the whole grid", () => {
    const d = dynamicDurations(T, { depth: 1, seed: 5 });
    expect(d[2]).toBe(1); // the tresillo's short
  });

  it("is empty when there is nothing to measure", () => {
    expect(dynamicDurations(P("00000000"), { depth: 1 })).toEqual([]);
  });
});
