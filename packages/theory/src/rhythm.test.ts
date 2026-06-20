import { describe, expect, it } from "vitest";
import vectors from "../vectors/rhythm.json";
import {
  barlowIndispensabilityTable,
  barlowRanking,
  barlowSyncopation,
  barlowTransform,
  euclideanComplement,
  euclideanRhythm,
  patternFromBinaryString,
  patternFromDecimal,
  patternFromHex,
  patternFromOctal,
  patternToBinaryString,
  patternToDecimal,
  patternToHex,
  patternToOctal,
  type BarlowTransformOptions,
} from "./rhythm.js";

const enc = (p: boolean[]) => p.map((x) => (x ? "1" : "0")).join("");
const dec = (s: string) => [...s].map((c) => c === "1");

describe("Euclidean rhythms (vectors)", () => {
  for (const c of vectors.euclidean) {
    it(c.name, () => {
      expect(enc(euclideanRhythm(c.beats, c.steps, c.offset))).toBe(c.pattern);
    });
  }

  for (const c of vectors.complement) {
    it(c.name, () => {
      expect(enc(euclideanComplement(c.beats, c.steps, c.offset))).toBe(c.pattern);
    });
  }

  it("onset count always equals min(beats, steps)", () => {
    for (let steps = 1; steps <= 16; steps++) {
      for (let beats = 0; beats <= steps; beats++) {
        const onsets = euclideanRhythm(beats, steps).filter(Boolean).length;
        expect(onsets).toBe(beats);
      }
    }
  });
});

describe("Barlow indispensability (vectors)", () => {
  for (const c of vectors.barlowTables) {
    it(`table for ${c.length} steps`, () => {
      expect(barlowIndispensabilityTable(c.length)).toEqual(c.table);
    });
  }

  for (const c of vectors.syncopation) {
    it(`syncopation: ${c.name}`, () => {
      expect(barlowSyncopation(c.onsets, c.steps)).toBeCloseTo(c.value, 10);
    });
  }

  it("ranking puts the downbeat first", () => {
    const ranking = barlowRanking(barlowIndispensabilityTable(16));
    expect(ranking[0]).toMatchObject({ position: 0, rank: 1 });
  });
});

describe("Barlow transformer (vectors)", () => {
  for (const c of vectors.transforms) {
    it(c.name, () => {
      const result = barlowTransform(dec(c.pattern), c.target, c.options as BarlowTransformOptions);
      expect(enc(result.pattern)).toBe(c.result);
      expect(result.transformation).toBe(c.transformation);
    });
  }

  it("dilution preserves the downbeat by default", () => {
    const result = barlowTransform(dec("10110110"), 2);
    expect(result.pattern[0]).toBe(true);
  });

  it("round-trip dilute then concentrate keeps onset counts consistent", () => {
    const original = dec("10110110");
    const diluted = barlowTransform(original, 3);
    const restored = barlowTransform(diluted.pattern, 5);
    expect(restored.pattern.filter(Boolean).length).toBe(5);
  });
});

// One round-trip check shared by the named cases and the seeded batch — the
// reference must reproduce every committed encoding (binary/decimal/hex/octal/
// onsets) in both directions. The same vectors are read by the Serpe webapp and
// plugin conformance suites, so this is the cross-language contract.
const checkCodec = (c: {
  pattern: string;
  decimal: number;
  hex: string;
  octal?: string;
  onsets?: number[];
}) => {
  const pattern = dec(c.pattern);
  expect(patternToDecimal(pattern)).toBe(c.decimal);
  expect(patternToHex(pattern)).toBe(c.hex);
  if (c.octal !== undefined) expect(patternToOctal(pattern)).toBe(c.octal);
  if (c.onsets !== undefined)
    expect(pattern.flatMap((on, i) => (on ? [i] : []))).toEqual(c.onsets);
  expect(patternFromDecimal(c.decimal, c.pattern.length)).toEqual(pattern);
  expect(patternFromHex(c.hex, c.pattern.length)).toEqual(pattern);
  expect(patternFromHex("0x" + c.hex, c.pattern.length)).toEqual(pattern);
  if (c.octal !== undefined) {
    expect(patternFromOctal(c.octal, c.pattern.length)).toEqual(pattern);
    expect(patternFromOctal("0o" + c.octal, c.pattern.length)).toEqual(pattern);
  }
  expect(patternToBinaryString(pattern)).toBe(c.pattern);
  expect(patternFromBinaryString(c.pattern)).toEqual(pattern);
};

describe("pattern codecs (MSB-first, vectors)", () => {
  for (const c of vectors.codecs) it(c.name, () => checkCodec(c));

  it(`reproduces all ${vectors.codecBatch.length} seeded batch vectors`, () => {
    for (const c of vectors.codecBatch) checkCodec(c);
  });

  it("rejects malformed octal", () => {
    expect(() => patternFromOctal("0o89", 8)).toThrow();
  });

  it("rejects values that do not fit the step count", () => {
    expect(() => patternFromDecimal(16, 4)).toThrow();
  });

  it("rejects malformed input", () => {
    expect(() => patternFromBinaryString("10x1")).toThrow();
    expect(() => patternFromHex("0xZZ", 8)).toThrow();
    expect(() => patternFromDecimal(-1, 4)).toThrow();
  });
});
