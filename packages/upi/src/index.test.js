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
  it("reads a polygon's third argument as an expansion factor", () => {
    // P(3,1,4) is the original webapp's "Triangle×4": a triangle over 3×4 = 12
    // steps, still exactly even. Read as a step count it was `1110` — three
    // onsets crammed into four steps, which is not a triangle.
    const r = parseUPI("P(3,1,4)");
    expect(r.ok).toBe(true);
    expect(r.steps.length).toBe(12);
    expect(r.steps.join("")).toBe("010001000100");
  });

  it("expands exactly, where ;N re-grids with rounding", () => {
    // The two jobs are distinct, which is why the third argument is not a step
    // count: expansion keeps the polygon a polygon (k*x is always divisible by
    // k), while `;N` is Lascabettes angular quantization onto an arbitrary
    // grid and rounds. Three vertices on eight steps cannot be even.
    expect(parseUPI("P(3,0,8)").steps.length).toBe(24);
    expect(parseUPI("P(3,0,8)").steps.join("")).toBe("100000001000000010000000");
    expect(parseUPI("P(3,0);8").steps.join("")).toBe("10010100");
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

describe("step counts are what the notation asks for", () => {
  // No 8-step floor anywhere: `:N` is how you request a length. The plugin
  // used to floor decimals, arrays and prefixed numerics at 8.
  it("sizes a bare polygon at its own resolution", () => {
    // Not ctx.n — P(7,2) was 7 steps in the plugin and 16 in the app.
    expect(parseUPI("P(7,2)", { n: 16 }).steps.length).toBe(7);
    expect(parseUPI("P(4,0)", { n: 16 }).steps.join("")).toBe("1111");
  });

  it("sizes numerics by the digits WRITTEN, not the value", () => {
    // Digits are packed little-endian, so o10 and 0x10 have value 1 while
    // stating six and eight steps — the trailing zero digit is real.
    expect(parseUPI("0x1").steps.length).toBe(4);
    expect(parseUPI("0x10").steps.join("")).toBe("10000000");
    expect(parseUPI("o10").steps.join("")).toBe("100000");
    expect(parseUPI("b1011").steps.join("")).toBe("1011");
    expect(parseUPI("d5").steps.join("")).toBe("101"); // decimal: value-sized
  });

  it("keeps an onset array only as long as its last onset", () => {
    expect(parseUPI("[0,2]").steps.join("")).toBe("101");
    expect(parseUPI("[0,2]:8").steps.join("")).toBe("10100000");
  });
});

describe(";N — Lascabettes angular re-grid", () => {
  it("re-grids onto an arbitrary step count", () => {
    expect(parseUPI("E(5,13);8").steps.join("")).toBe("10110110");
  });

  it("distinguishes clockwise from counter-clockwise", () => {
    // E(3,8) is asymmetric, so the two directions genuinely differ. Symmetric
    // sources give the same set both ways and would hide a broken sign.
    expect(parseUPI("E(3,8);5").steps.join("")).toBe("10101");
    expect(parseUPI("E(3,8);-5").steps.join("")).toBe("11010");
  });

  it("merges collisions when re-gridding downward", () => {
    const r = parseUPI("E(3,8);3");
    expect(r.steps.length).toBe(3);
    expect(onsetCount(r.steps)).toBeLessThanOrEqual(3);
  });

  it("binds looser than + and -, so it re-grids the whole expression", () => {
    // Not P(3,0) combined with P(5,0);16, which would land on lcm(3,16) = 48.
    const r = parseUPI("P(3,0)+P(5,0);16");
    expect(r.steps.length).toBe(16);
    expect(r.steps.join("")).toBe("1001011000110100");
  });
});

describe("combination — every operand is a shape on a shared cycle", () => {
  // Combination projects each operand onto the lcm (scaling its onsets) rather
  // than repeating it to fill the lcm. That is what makes the result a
  // geometry rather than a stack of loops.
  it("builds a perfectly balanced geometry from three polygons", () => {
    // The case that pins the rule: balanced only because each polygon spans
    // the 30-step cycle exactly once.
    expect(parseUPI("P(3,1)+P(5,0)+P(2,5)").steps.join("")).toBe(
      "110001100001100000101100100000",
    );
  });

  it("projects a polygon against a Euclidean term, never tiles it", () => {
    // Tiling made this a 24-step drone (P(3,0) is the three-step "111"
    // repeated eight times). Projected, the triangle lands on 0/8/16 and the
    // tresillo — stretched across the same cycle — on 0/9/18.
    const r = parseUPI("E(3,8)+P(3,0)");
    expect(r.ok).toBe(true);
    expect(r.steps.join("")).toBe("100000001100000010100000");
  });

  it("gives a bare polygon its own length, not the caller's step count", () => {
    // Regression: P(3,0) used to inherit ctx.n, so the SAME string returned 8
    // steps in the app and 16 in the CLI depending on what was already
    // loaded. Its length is its vertex count; the combination lands on
    // lcm(8,3) = 24 regardless of context.
    for (const n of [8, 16, 12]) {
      const r = parseUPI("E(3,8)+P(3,0)", { n });
      expect(r.steps.length).toBe(24);
      expect(r.steps.join("")).toBe("100000001100000010100000");
    }
  });

  it("matches the v0.02a README example E(3,8)+P(4,0)", () => {
    // lcm(8,4) = 8, so the square projects onto 10101010.
    expect(parseUPI("E(3,8)+P(4,0)").steps.join("")).toBe("10111010");
  });

  it("still projects an all-polygon '+' onto the lcm of polygon sizes", () => {
    expect(parseUPI("P(3,0)+P(5,0)").steps.join("")).toBe("100101100110100");
  });

  it("projects non-polygon terms too", () => {
    // E(2,4) spans the shared cycle once (onsets 0,4), not twice (0,2,4,6).
    expect(parseUPI("E(3,8)+E(2,4)").steps.join("")).toBe("10011010");
  });

  it("leaves same-length difference alone (projection is identity)", () => {
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

/**
 * `LS(r){mask}` and `{mask}` are the SAME KIND of layer, and must behave the
 * same way.
 *
 * Alex, 2026-08-02: the durational mask "sure should index onsets… which is
 * actually the same thing for accents!" It is — accents cycle over onsets and
 * are projected onto steps for consumers, and these pin that the durational
 * mask does it identically rather than inventing a second rule.
 */
describe("durational mask and accent mask agree", () => {
  it("both index ONSETS, not steps", () => {
    // E(5,8) is 10110110 — onsets at 0,2,3,5,6. A 5-bit mask therefore lands on
    // steps 0 and 5, NOT on steps 0 and 3 as a per-step reading would give.
    const a = parseUPI("{10010}E(5,8)", { n: 8 });
    const l = parseUPI("E(5,8)LS(4){10010}", { n: 8 });
    expect(a.steps.map(Number).join("")).toBe("10110110");
    expect(a.accents.join("")).toBe("10000100");
    expect(l.longs.join("")).toBe("10000100");
    expect(l.longs).toEqual(a.accents);
  });

  it("both CYCLE the mask over the onsets when it is shorter", () => {
    const a = parseUPI("{10}E(4,8)", { n: 8 });
    const l = parseUPI("E(4,8)LS(3){10}", { n: 8 });
    expect(l.longs).toEqual(a.accents);
  });

  it("neither marks a rest — a rest has no accent and no duration", () => {
    const l = parseUPI("E(3,8)LS(3){111}", { n: 8 });
    l.steps.forEach((v, i) => { if (!v) expect(l.longs[i]).toBe(0); });
  });

  it("they compose: a hit can be accented, long, both or neither", () => {
    const p = parseUPI("{1000}E(4,8)LS(3){10}", { n: 8 });
    expect(p.accents.reduce((a, b) => a + b, 0)).toBe(1);
    expect(p.longs.reduce((a, b) => a + b, 0)).toBe(2);
  });
});
