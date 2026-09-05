import { describe, it, expect } from "vitest";
import {
  parseUPI, parseProgressive, progressiveAt,
  analyse, analyzeSyncopation, longShort, durations, interOnsetSteps,
  identify, decompose, parseNamedPattern,
} from "../src/index.js";
import vectors from "./upi.json";

// This file is the cross-language contract for UPI *notation* — the layer above
// @enkerli/theory's rhythm.json, which holds the algorithms. If the engine
// drifts from this file, regenerate with gen-upi-vectors.mjs and read the diff
// before committing it; don't hand-edit upi.json, and don't regenerate to make
// a red test green without knowing which behaviour changed.
//
// A port (C++ UPIParser, Swift Serpe, Lua/PdLua) reads this file rather than
// this codebase. The one thing it will silently get wrong is bit order —
// leftmost = LSB, first character is step 0 — which is why the numeric group
// carries 0x94 and 0x49 side by side.
//
// A suite that passes on its first run is indistinguishable from one that
// checks nothing, so this was made to fail on purpose before it was believed.
// Four divergences were planted in the engine, each the shape of a real
// mistake, and each was caught in the group it belongs to:
//
//   · hex digits read big-endian instead of little-endian  → 3 notation cases
//   · progressive phase moved off base-first (idx, not idx-1) → 3 progressive
//   · accents cycled over STEPS instead of over ONSETS      → 2 notation
//   · polygon combination taking max() instead of lcm()     → 5 cases, across
//     notation and analysis both, which is the coupling working
//
// All four were reverted. If you add a group, plant something before trusting
// the green.

const bits = (steps) => (steps || []).map((s) => (s ? 1 : 0)).join("");
const round = (x, places = 6) =>
  typeof x === "number" && Number.isFinite(x) ? Number(x.toFixed(places)) : x;

const { notation, analysis, longShort: longShortCases, syncopation,
        recognition, progressive, named } = vectors.groups;

describe("notation", () => {
  for (const c of notation) {
    it(c.input === "" ? "(empty input)" : c.input, () => {
      const p = parseUPI(c.input);
      expect(p.ok).toBe(c.ok);
      if (!c.ok) return;
      expect(bits(p.steps)).toBe(c.steps);
      expect(p.label).toBe(c.label);
      if (c.accentPattern !== undefined) expect(bits(p.accentPattern)).toBe(c.accentPattern);
      if (c.accents !== undefined) expect(bits(p.accents)).toBe(c.accents);
      if (c.longs !== undefined) expect(bits(p.longs)).toBe(c.longs);
      if (c.longShort !== undefined) expect(p.longShort).toEqual(c.longShort);
      if (c.microtiming !== undefined) expect(p.microtiming).toEqual(c.microtiming);
    });
  }
});

describe("analysis", () => {
  for (const c of analysis) {
    it(c.input, () => {
      const a = analyse(parseUPI(c.input).steps);
      expect(a.n).toBe(c.n);
      expect(a.k).toBe(c.k);
      expect(round(a.density)).toBe(c.density);
      expect(a.onsets).toEqual(c.onsets);
      expect(a.intervals).toEqual(c.intervals);
      expect(round(a.evenness)).toBe(c.evenness);
      expect(a.balanced).toBe(c.balanced);
      expect(round(a.cog.magnitude)).toBe(c.cog.magnitude);
      expect(round(a.cog.angleSteps)).toBe(c.cog.angleSteps);
      expect(a.binary).toBe(c.binary);
      expect(a.hex).toBe(c.hex);
      expect(a.decimal).toBe(c.decimal);
    });
  }
});

describe("the durational reading", () => {
  for (const c of longShortCases) {
    it(c.input, () => {
      const steps = parseUPI(c.input).steps;
      const ls = longShort(steps);
      expect(ls.intervals).toEqual(c.intervals);
      expect(ls.short).toBe(c.short);
      expect(ls.long).toBe(c.long);
      expect(round(ls.ratio)).toBe(c.ratio);
      expect(ls.types).toEqual(c.types);
      expect(ls.pattern).toBe(c.pattern);
      expect(ls.morse).toBe(c.morse);
      expect(ls.foot).toBe(c.foot);
      expect(ls.isochronous).toBe(c.isochronous);
      expect(durations(steps).map((d) => round(d))).toEqual(c.durations);
      expect(steps.map((_, i) => (steps[i] ? interOnsetSteps(steps, i) : null))
        .filter((v) => v !== null)).toEqual(c.interOnsetSteps);
    });
  }
});

describe("syncopation", () => {
  for (const c of syncopation) {
    it(c.input, () => {
      const steps = parseUPI(c.input).steps;
      const s = analyzeSyncopation(steps, steps.length);
      expect(round(s.weightedNoteToBeats, 3)).toBe(c.weightedNoteToBeats);
      expect(round(s.offBeatRatio, 3)).toBe(c.offBeatRatio);
      expect(round(s.expectancyViolation, 3)).toBe(c.expectancyViolation);
      expect(round(s.rhythmicDisplacement, 3)).toBe(c.rhythmicDisplacement);
      expect(round(s.crossRhythmic, 3)).toBe(c.crossRhythmic);
      expect(round(s.barlowIndispensability, 3)).toBe(c.barlowIndispensability);
      expect(round(s.overallSyncopation, 3)).toBe(c.overallSyncopation);
      expect(s.level).toBe(c.level);
    });
  }
});

describe("recognition", () => {
  for (const c of recognition) {
    it(c.input, () => {
      const steps = parseUPI(c.input).steps;
      const id = identify(steps);
      const euclidean = id.euclidean
        ? { beats: id.euclidean.beats, steps: id.euclidean.steps,
            offset: id.euclidean.offset, formula: id.euclidean.formula }
        : null;
      expect(euclidean).toEqual(c.euclidean);
      expect(id.barlow ? { formula: id.barlow.formula } : null).toEqual(c.barlow);
      expect(id.best ? { formula: id.best.formula, exact: id.best.exact } : null)
        .toEqual(c.best);
      const dec = decompose(steps);
      expect(Array.isArray(dec) ? dec.length : (dec?.readings?.length ?? 0))
        .toBe(c.decomposeCount);
    });
  }
});

describe("progressive notation", () => {
  for (const c of progressive) {
    it(c.input, () => {
      const desc = parseProgressive(c.input);
      expect(desc?.kind ?? null).toBe(c.kind);
      expect(desc?.base ?? null).toBe(c.base);
      for (const step of c.at) {
        const r = progressiveAt(desc, step.trigger, { parseBase: (s) => parseUPI(s) });
        expect(bits(r.steps)).toBe(step.steps);
        expect(r.label).toBe(step.label);
      }
    });
  }
});

describe("named-pattern import", () => {
  for (const c of named) {
    it(c.line, () => {
      if (!c.ok) {
        expect(() => parseNamedPattern(c.line)).toThrow();
        return;
      }
      const r = parseNamedPattern(c.line);
      expect(r.name).toBe(c.name);
      expect(bits(r.steps)).toBe(c.steps);
    });
  }
});
