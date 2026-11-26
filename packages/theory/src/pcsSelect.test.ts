import { describe, expect, it } from "vitest";
import vectors from "../vectors/pcs-select.json";
import * as S from "./pcsSelect.js";
import { patternFromDecimal, patternToOctal } from "./rhythm.js";

// ── Vectors: the cross-language contract (regenerate, never hand-edit) ─────

describe("octal (vectors)", () => {
  for (const v of vectors.octal) {
    it(`${v.name}: ${v.mask} ↔ "${v.octal}"`, () => {
      expect(S.maskToOctal(v.mask)).toBe(v.octal);
      expect(S.maskToOctalDigits(v.mask)).toEqual(v.digits);
      expect(S.maskFromOctal(v.octal)).toBe(v.mask);
      expect(S.maskToPcs(v.mask)).toEqual(v.pcs);
    });
  }
  for (const v of vectors.octalEntry) {
    it(`taps ${v.taps.join(" ")}`, () => {
      let entry = S.EMPTY_OCTAL_ENTRY;
      const masks: (number | null)[] = [];
      for (const t of v.taps) {
        if (t === "⌫") { entry = S.octalEntryBackspace(entry); masks.push(null); continue; }
        const r = S.octalEntryTap(entry, t as number);
        entry = r.entry;
        masks.push(r.mask);
      }
      expect(masks).toEqual(v.masks);
      expect(entry.digits).toEqual(v.pending);
    });
  }
});

describe("two-page entry (vectors)", () => {
  for (const v of vectors.twoPage) {
    it(`taps ${JSON.stringify(v.taps)}`, () => {
      let mask = 0;
      for (const [page, pad] of v.taps) mask = S.twoPageToggle(mask, page as S.Page, pad!);
      expect(mask).toBe(v.mask);
      expect(S.twoPagePads(mask, 0)).toEqual(v.page0);
      expect(S.twoPagePads(mask, 1)).toEqual(v.page1);
    });
  }
});

describe("interval entry (vectors)", () => {
  for (const v of vectors.intervals) {
    it(`${v.name}`, () => {
      expect(S.maskToIntervals(v.mask, v.root)).toEqual(v.steps);
      if (v.steps) expect(S.maskFromIntervals(v.root, v.steps)).toBe(v.mask);
    });
  }
  for (const v of vectors.intervalEntry) {
    it(`root ${v.root}, pads ${v.pads.join(" ")}`, () => {
      let entry: S.IntervalEntry = { root: v.root, steps: [] };
      const results = v.pads.map((p) => {
        const r = S.intervalEntryTap(entry, p);
        entry = r.entry;
        return { mask: r.mask, refused: r.refused };
      });
      expect(results).toEqual(v.results);
      expect(entry.steps).toEqual(v.pending);
    });
  }
});

describe("transposition (vectors)", () => {
  for (const v of vectors.transpose) {
    it(`${JSON.stringify(v.from)} + ${v.n}`, () => expect(S.transposeState(v.from, v.n)).toEqual(v.to));
  }
  for (const v of vectors.periods) {
    it(`${v.name}: period ${v.period}`, () => {
      expect(S.transpositionPeriod(v.mask)).toBe(v.period);
      expect(S.distinctTranspositions(v.mask)).toEqual(v.transpositions);
    });
  }
});

describe("modes (vectors)", () => {
  for (const v of vectors.parallel) {
    it(`parallel modes of ${v.name}`, () => {
      const modes = S.parallelModes({ mask: v.mask, root: v.root });
      expect(modes).toEqual(v.modes);
      expect(modes.map((x) => S.modeBrightness(x, v.root))).toEqual(v.brightness);
    });
  }
  for (const v of vectors.parallelSteps) {
    it(`parallel step ${JSON.stringify(v.from)} dir ${v.dir} wrap ${v.wrap}`, () =>
      expect(S.parallelModeStep(v.from, v.dir as 1 | -1, v.wrap)).toEqual(v.to));
  }
  for (const v of vectors.relative) {
    it(`relative ${JSON.stringify(v.from)} dir ${v.dir}`, () =>
      expect(S.relativeMode(v.from, v.dir as 1 | -1)).toEqual(v.to));
  }
});

describe("neo-Riemannian (vectors)", () => {
  for (const v of vectors.riemann) {
    it(`${v.op}(${v.name})`, () => expect(S.riemann(v.mask, v.op as S.RiemannOp)).toEqual(v.to));
  }
});

describe("parsimonious neighbours (vectors)", () => {
  for (const v of vectors.parsimony) {
    it(v.name, () => expect(S.parsimoniousNeighbours(v.mask)).toEqual(v.neighbours));
  }
});

describe("cueing (vectors)", () => {
  vectors.cueing.forEach((v, i) => {
    it(`script ${i + 1}`, () => {
      let cs = S.cueState(v.start);
      const after = v.events.map((e: Record<string, unknown>) => {
        if (e.cue) cs = S.cue(cs, e.cue as S.PcsState, e.at as S.Quantum);
        else if (e.cancel) cs = S.cancelCue(cs);
        else cs = S.crossBoundary(cs, e.boundary as S.Boundary).state;
        return { current: cs.current, next: cs.next, at: cs.at };
      });
      expect(after).toEqual(v.after);
    });
  });
});

// ── Properties over all 4096 sets ──────────────────────────────────────────

const ALL = Array.from({ length: 4096 }, (_, m) => m);

describe("properties", () => {
  it("anchors: C Ionian = 2741 = 5625; 2773 is Lydian", () => {
    expect(S.maskFromOctal("5625")).toBe(2741);
    expect(S.maskToPcs(2773)).toEqual([0, 2, 4, 6, 7, 9, 11]);
  });

  it("octal round-trips every set", () => {
    for (const m of ALL) expect(S.maskFromOctal(S.maskToOctal(m))).toBe(m);
  });

  it("octal digit order agrees with the rhythm octal codec (one convention, two domains)", () => {
    // The rhythm codec trims high (trailing, little-endian) zero digits — rhythm
    // widths travel separately — while a PCS entry is always four taps.
    for (const m of ALL) expect(S.maskToOctal(m)).toBe(patternToOctal(patternFromDecimal(m, 12)).padEnd(4, "0"));
  });

  it("two-page entry reaches every set, and each pad toggles", () => {
    for (const m of ALL) {
      let built = 0;
      for (const pc of S.maskToPcs(m)) built = S.twoPageToggle(built, pc < 8 ? 0 : 1, pc % 8);
      expect(built).toBe(m);
    }
  });

  it("intervals round-trip from every member of every non-empty set", () => {
    for (const m of ALL) for (const r of S.maskToPcs(m)) {
      const steps = S.maskToIntervals(m, r)!;
      expect(steps.reduce((a, b) => a + b, 0)).toBe(12);
      expect(S.maskFromIntervals(r, steps)).toBe(m);
    }
  });

  it("transposition: rotate by n then -n is identity; period divides 12", () => {
    for (const m of ALL) {
      for (const n of [1, 5, 7, 11]) expect(S.rotateMask(S.rotateMask(m, n), -n)).toBe(m);
      expect(12 % S.transpositionPeriod(m)).toBe(0);
    }
  });

  it("parallel modes: same root, same set class, brightness non-increasing", () => {
    for (const m of ALL) for (const r of S.maskToPcs(m)) {
      const modes = S.parallelModes({ mask: m, root: r });
      expect(modes).toContain(m);
      const b = modes.map((x) => S.modeBrightness(x, r));
      for (let i = 1; i < b.length; i++) expect(b[i]!).toBeLessThanOrEqual(b[i - 1]!);
      for (const x of modes) {
        expect(S.maskHas(x, r)).toBe(true);
        expect(S.maskCardinality(x)).toBe(S.maskCardinality(m));
      }
    }
  });

  it("P, L, R are involutions on all 24 consonant triads, each moving one voice", () => {
    for (let r = 0; r < 12; r++) for (const base of [145, 137]) {
      const t = S.rotateMask(base, r);
      for (const op of ["P", "L", "R"] as const) {
        const u = S.riemann(t, op)!;
        expect(S.riemann(u.mask, op)!.mask).toBe(t);
        expect(S.maskCardinality(t & u.mask)).toBe(2);
      }
    }
  });

  it("parsimonious neighbours keep cardinality and share all but one pc", () => {
    for (const m of ALL) for (const n of S.parsimoniousNeighbours(m)) {
      expect(S.maskCardinality(n.mask)).toBe(S.maskCardinality(m));
      expect(S.maskCardinality(m & n.mask)).toBe(S.maskCardinality(m) - 1);
    }
  });

  it("setlist steps cue in order and clamp at the ends", () => {
    const items = [{ mask: 2741, root: 0 }, { mask: 2741, root: 2 }];
    let cs = S.cueState(items[0]!);
    let list: S.Setlist = { items, index: 0 };
    ({ state: cs, list } = S.setlistStep(cs, list, "bar"));
    expect(cs.next).toEqual(items[1]);
    ({ state: cs, list } = S.setlistStep(cs, list, "bar"));
    expect(list.index).toBe(1);
    expect(S.crossBoundary(cs, "bar").state.current).toEqual(items[1]);
  });

  it("rejects out-of-range input", () => {
    expect(() => S.maskToPcs(4096)).toThrow(RangeError);
    expect(() => S.maskFromOctal("5628")).toThrow(RangeError);
    expect(() => S.octalEntryTap(S.EMPTY_OCTAL_ENTRY, 8)).toThrow(RangeError);
    expect(() => S.maskFromIntervals(0, [7, 7])).toThrow(RangeError);
  });
});
