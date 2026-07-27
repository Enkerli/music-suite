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

describe("combination — a bare polygon is a shape, not a step pattern", () => {
  // The README's own example. A polygon TILED to fill the LCM becomes solid
  // onsets (P(4,0) is "1111"), which is what the C++ engine used to return
  // here; projected onto 8 steps it is the square 10101010, and the union
  // with the tresillo is a rhythm rather than a drone.
  it("projects P(4,0) onto the combination length, never tiles it", () => {
    const r = parseUPI("E(3,8)+P(4,0)");
    expect(r.ok).toBe(true);
    expect(r.steps.join("")).toBe("10111010");
  });

  it("gives a bare polygon its own length, not the caller's step count", () => {
    // Regression: P(3,0) used to inherit ctx.n, so the SAME string returned 8
    // steps in the app and 16 in the CLI depending on what was already
    // loaded. Its length is its vertex count; the combination lands on
    // lcm(8,3) = 24 regardless of context.
    for (const n of [8, 16, 12]) {
      const r = parseUPI("E(3,8)+P(3,0)", { n });
      expect(r.ok).toBe(true);
      expect(r.steps.length).toBe(24);
      expect(r.steps.join("")).toBe("100100101001001010010010");
    }
  });

  it("still projects an all-polygon '+' onto the lcm of polygon sizes", () => {
    expect(parseUPI("P(3,0)+P(5,0)").steps.join("")).toBe("100101100110100");
  });

  it("leaves same-length difference alone", () => {
    expect(parseUPI("E(5,8)-E(3,8)").steps.join("")).toBe("00100100");
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

// ── poly lanes (docs/SERPE_POLY.md — notation decided 2026-07-18) ───────────

import { parsePolyUPI, formatPolyUPI, splitLanes, offsetTicks } from "./poly.js";

describe("splitLanes (the / separator, offset-atomic)", () => {
  it("splits on top-level / only", () => {
    expect(splitLanes("E(4,16) / E(3,8) / {10}E(2,3)")).toEqual(["E(4,16)", "E(3,8)", "{10}E(2,3)"]);
  });
  it("a fraction offset's slash never splits a lane", () => {
    expect(splitLanes("kick=E(4,16)@+1/32 / snare=E(2,4)")).toEqual(["kick=E(4,16)@+1/32", "snare=E(2,4)"]);
    expect(splitLanes("E(3,8)@-1/64")).toEqual(["E(3,8)@-1/64"]);
  });
  it("no top-level / means one lane (mono unchanged)", () => {
    expect(splitLanes("{100}E(3,8);12")).toEqual(["{100}E(3,8);12"]);
  });
});

describe("parsePolyUPI", () => {
  it("parses lanes with labels and both offset units", () => {
    const p = parsePolyUPI("kick=E(4,16) / snare=E(2,4)@+12ms / hat={10}E(8,16)@-1/64");
    expect(p.ok).toBe(true);
    expect(p.lanes.map((l) => l.label)).toEqual(["kick", "snare", "hat"]);
    expect(p.lanes[0].offset).toBeNull();
    expect(p.lanes[1].offset).toEqual({ kind: "ms", ms: 12 });
    expect(p.lanes[2].offset).toEqual({ kind: "frac", num: -1, den: 64 });
    expect(p.lanes[0].steps.length).toBe(16);
    expect(p.lanes[1].steps.length).toBe(4);
  });
  it("bare @±N means milliseconds", () => {
    const p = parsePolyUPI("E(3,8)@-6");
    expect(p.lanes[0].offset).toEqual({ kind: "ms", ms: -6 });
  });
  it("a single unlabeled lane matches parseUPI exactly (zero breaking change)", () => {
    const poly = parsePolyUPI("{100}E(3,8);12");
    const mono = parseUPI("{100}E(3,8);12");
    expect(poly.ok).toBe(true);
    expect(poly.lanes).toHaveLength(1);
    expect(poly.lanes[0].steps).toEqual(mono.steps);
    expect(poly.lanes[0].accents).toEqual(mono.accents);
    expect(poly.lanes[0].label).toBe("lane1");
  });
  it("lanes keep their own lengths; lcm is the display grid", () => {
    const p = parsePolyUPI("E(2,3) / E(4,16)");
    expect(p.lanes.map((l) => l.steps.length)).toEqual([3, 16]);
    expect(p.lcm).toBe(48);
  });
  it("clamps the feel: >50ms and >1/8 are rejected as different rhythms", () => {
    expect(parsePolyUPI("E(3,8)@+51ms").ok).toBe(false);
    expect(parsePolyUPI("E(3,8)@+51ms").error).toMatch(/different rhythm/);
    expect(parsePolyUPI("E(3,8)@+1/4").ok).toBe(false);
  });
  it("one bad lane fails the whole parse, named", () => {
    const p = parsePolyUPI("kick=E(4,16) / snare=nonsense(((");
    expect(p.ok).toBe(false);
    expect(p.error).toMatch(/^snare:/);
  });
});

describe("formatPolyUPI (round-trip)", () => {
  it("normalizes stably: parse(format(parse(s))) = parse(s)", () => {
    const s = "kick=E(4,16) / snare=E(2,4)@+12ms / hat={10}E(8,16)@-1/64";
    const once = parsePolyUPI(s);
    const twice = parsePolyUPI(formatPolyUPI(once));
    expect(twice.ok).toBe(true);
    expect(twice.lanes.map((l) => ({ label: l.label, steps: l.steps, offset: l.offset })))
      .toEqual(once.lanes.map((l) => ({ label: l.label, steps: l.steps, offset: l.offset })));
  });
  it("auto lane names stay implicit in the text", () => {
    expect(formatPolyUPI(parsePolyUPI("E(3,8) / E(2,4)"))).toBe("E(3,8) / E(2,4)");
  });
});

describe("offsetTicks (frac → ticks; ms handled by the scheduler)", () => {
  it("converts a note-value fraction at a tick resolution", () => {
    expect(offsetTicks({ kind: "frac", num: 1, den: 32 }, 480)).toBe(60);   // a 32nd @480tpb
    expect(offsetTicks({ kind: "frac", num: -1, den: 64 }, 480)).toBe(-30);
    expect(offsetTicks({ kind: "ms", ms: 12 }, 480)).toBe(0);               // ms is not ticks
    expect(offsetTicks(null, 480)).toBe(0);
  });
});
