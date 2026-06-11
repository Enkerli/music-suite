import { describe, expect, it } from "vitest";
import vectors from "../vectors/spelling.json";
import {
  degreeFromIntervalLabel,
  formatSpelled,
  parseSpelled,
  spellChordTones,
  spellScale,
  spelledToPc,
  transposeSpelled,
} from "./spelling.js";

describe("spelled-note parsing and formatting", () => {
  it("parses ASCII and Unicode accidentals", () => {
    expect(parseSpelled("G#")).toEqual({ letterIndex: 4, alteration: 1 });
    expect(parseSpelled("G♯")).toEqual({ letterIndex: 4, alteration: 1 });
    expect(parseSpelled("Fx")).toEqual({ letterIndex: 3, alteration: 2 });
    expect(parseSpelled("F𝄪")).toEqual({ letterIndex: 3, alteration: 2 });
    expect(parseSpelled("B𝄫")).toEqual({ letterIndex: 6, alteration: -2 });
    expect(parseSpelled("bb")).toEqual({ letterIndex: 6, alteration: -1 });
    expect(parseSpelled("H")).toBeUndefined();
    expect(parseSpelled("C%")).toBeUndefined();
  });

  it("round-trips format/parse", () => {
    for (const name of ["C", "F♯", "B♭", "F𝄪", "B𝄫", "E♯", "C♭"]) {
      expect(formatSpelled(parseSpelled(name)!)).toBe(name);
    }
  });

  it("computes pitch classes (B♯ = C = 0, F♭ = E = 4)", () => {
    expect(spelledToPc(parseSpelled("B♯")!)).toBe(0);
    expect(spelledToPc(parseSpelled("F♭")!)).toBe(4);
    expect(spelledToPc(parseSpelled("F𝄪")!)).toBe(7);
  });
});

describe("structural transposition", () => {
  it("major third from G♯ is B♯, never C", () => {
    const result = transposeSpelled(parseSpelled("G♯")!, 2, 4);
    expect(formatSpelled(result)).toBe("B♯");
  });

  it("diminished fourth from G♯ is C", () => {
    const result = transposeSpelled(parseSpelled("G♯")!, 3, 4);
    expect(formatSpelled(result)).toBe("C");
  });
});

describe("interval-label degrees", () => {
  it("maps labels to degrees", () => {
    expect(degreeFromIntervalLabel("R")).toBe(1);
    expect(degreeFromIntervalLabel("♭3")).toBe(3);
    expect(degreeFromIntervalLabel("𝄫7")).toBe(7);
    expect(degreeFromIntervalLabel("♯11")).toBe(11);
    expect(degreeFromIntervalLabel("∆7")).toBe(7);
    expect(degreeFromIntervalLabel("b13")).toBe(13);
    expect(degreeFromIntervalLabel("?")).toBeUndefined();
  });
});

describe("chord spelling (vectors)", () => {
  for (const c of vectors.chords) {
    it(c.name, () => {
      expect(spellChordTones(c.root, c.intervals, c.semitones)).toEqual(c.spelled);
    });
  }
});

describe("scale spelling (vectors)", () => {
  for (const s of vectors.scales) {
    it(s.name, () => {
      expect(spellScale(s.root, s.intervals)).toEqual(s.spelled);
    });
  }

  it("refuses non-heptatonic collections (no single proper spelling)", () => {
    expect(spellScale("C", [0, 2, 4, 7, 9])).toBeUndefined();
    expect(spellScale("C", [0, 3, 6, 9])).toBeUndefined();
  });
});
