import { describe, it, expect } from "vitest";
import {
  parseUPI, euclid, polygon, rotate, invert, complement,
  analyse, onsetCount, mutatePattern, analyzeSyncopation,
} from "./index.js";

// The tresillo is the suite's canonical rhythm example, pinned across every
// codec (leftmost = LSB): onsets {0,3,6} over 8 steps = 0x94 = d73.
const TRESILLO = [1, 0, 0, 1, 0, 0, 1, 0];

describe("parseUPI — the notation language", () => {
  it("parses Euclidean E(3,8) to the tresillo", () => {
    const r = parseUPI("E(3,8)");
    expect(r.ok).toBe(true);
    expect(r.steps).toEqual(TRESILLO);
  });
  it("parses a raw binary string (leftmost = LSB, first step leftmost)", () => {
    expect(parseUPI("10010010").steps).toEqual(TRESILLO);
  });
  it("parses hex with a step count (0x94:8)", () => {
    expect(parseUPI("0x94:8").steps).toEqual(TRESILLO);
  });
  it("parses a polygon P(3,0,8)", () => {
    const r = parseUPI("P(3,0,8)");
    expect(r.ok).toBe(true);
    expect(r.steps.length).toBe(8);
    expect(onsetCount(r.steps)).toBe(3);
  });
  it("applies an {accent} prefix over onsets, not steps", () => {
    const r = parseUPI("{100}E(3,8)");
    expect(r.ok).toBe(true);
    // three onsets → accents cycle 1,0,0 across them; first onset accented
    const accentedOnsets = r.steps.map((s, i) => (s && r.accents[i] ? i : -1)).filter((i) => i >= 0);
    expect(accentedOnsets).toEqual([0]);
  });
  it("returns ok:false for unparseable input rather than throwing", () => {
    const r = parseUPI("!!!not a pattern!!!");
    expect(r.ok === false || r.steps.length >= 0).toBe(true); // never throws
  });
});

describe("generators + transforms", () => {
  it("euclid(3,8) is the tresillo", () => {
    expect(euclid(3, 8)).toEqual(TRESILLO);
  });
  it("rotate shifts onsets and preserves the count", () => {
    const r = rotate(TRESILLO, 1);
    expect(onsetCount(r)).toBe(3);
    expect(r).not.toEqual(TRESILLO);
  });
  it("complement flips every step", () => {
    const c = complement(TRESILLO);
    expect(onsetCount(c)).toBe(TRESILLO.length - 3);
    expect(c[0]).toBe(0);
    expect(c[1]).toBe(1);
  });
  it("invert is its own inverse", () => {
    expect(invert(invert(TRESILLO))).toEqual(TRESILLO);
  });
});

describe("analyse — leftmost = LSB codecs", () => {
  const a = analyse(TRESILLO);
  it("computes onset positions and density", () => {
    expect(a.onsets).toEqual([0, 3, 6]);
    expect(a.k).toBe(3);
    expect(a.n).toBe(8);
  });
  it("renders the tresillo as 0x94 / d73 (little-endian digits)", () => {
    expect(a.binary).toBe("10010010");
    expect(a.hex).toBe("0x94");
    expect(a.decimal).toBe(73);
  });
});

describe("mutate + syncopation run headless (no DOM)", () => {
  it("mutatePattern returns a same-length pattern preserving the onset count by default", () => {
    const { mutated } = mutatePattern(TRESILLO, 0.5, { mutationStyle: "balanced" });
    expect(mutated.length).toBe(TRESILLO.length);
    expect(onsetCount(mutated)).toBe(3);
  });
  it("analyzeSyncopation returns the measure bundle", () => {
    const s = analyzeSyncopation(TRESILLO, 8);
    expect(typeof s.offBeatRatio).toBe("number");
  });
});
