import { describe, expect, it } from "vitest";
import vectors from "../vectors/degree-assertion.json";
import { assertDegree, formatDegreeLabel, type Mode } from "./analysis.js";
import { isNoChord, parseChordSymbol } from "./chordSymbol.js";

describe("degree assertion — strict (vectors)", () => {
  for (const c of vectors.strict) {
    it(c.name, () => {
      const result = assertDegree(c.root, { tonic: c.tonic, mode: c.mode as Mode });
      expect(result.numeral).toBe(c.numeral);
      expect(result.rootUsed).toBe(c.root);
      expect(result.respelled).toBe(false);
    });
  }

  it("throws on unparseable input", () => {
    expect(() => assertDegree("H", { tonic: "C", mode: "major" })).toThrow();
    expect(() => assertDegree("C", { tonic: "X", mode: "major" })).toThrow();
  });
});

describe("degree assertion — respell (vectors)", () => {
  for (const c of vectors.respell) {
    it(c.name, () => {
      const result = assertDegree(c.root, { tonic: c.tonic, mode: c.mode as Mode }, { respell: true });
      expect(result.numeral).toBe(c.numeral);
      expect(result.rootUsed).toBe(c.rootUsed);
      expect(result.respelled).toBe(c.respelled);
    });
  }
});

describe("degree labels", () => {
  it("formats transition-table style labels", () => {
    const v = assertDegree("B♭", { tonic: "E♭", mode: "major" });
    expect(formatDegreeLabel(v, "7")).toBe("V7");
    const sub = assertDegree("D♭", { tonic: "C", mode: "major" });
    expect(formatDegreeLabel(sub, "7")).toBe("♭II7");
  });
});

describe("chord-symbol parsing (vectors)", () => {
  for (const c of vectors.symbols) {
    it(c.symbol, () => {
      const parsed = parseChordSymbol(c.symbol);
      expect(parsed).not.toBeNull();
      expect(parsed!.rootName).toBe(c.rootName);
      expect(parsed!.suffix).toBe(c.suffix);
      expect(parsed!.qualityKey ?? null).toBe(c.qualityKey);
      if (c.bassName) expect(parsed!.bassName).toBe(c.bassName);
    });
  }

  it("treats no-chord markers as null", () => {
    expect(isNoChord("NC")).toBe(true);
    expect(isNoChord("N.C.")).toBe(true);
    expect(parseChordSymbol("NC")).toBeNull();
  });

  it("rejects garbage", () => {
    expect(parseChordSymbol("")).toBeNull();
    expect(parseChordSymbol("H7")).toBeNull();
    expect(parseChordSymbol("7")).toBeNull();
  });

  it("ASCII and Unicode accidentals parse alike", () => {
    expect(parseChordSymbol("Bbm7")!.rootName).toBe("B♭");
    expect(parseChordSymbol("B♭m7")!.rootName).toBe("B♭");
    expect(parseChordSymbol("F#7")!.rootName).toBe("F♯");
  });
});

describe("degree assertion — sharp tie-break (vectors)", () => {
  for (const c of vectors.respellSharpTieBreak) {
    it(c.name, () => {
      const result = assertDegree(c.root, { tonic: c.tonic, mode: c.mode as Mode }, { respell: true, tieBreak: "sharp" });
      expect(result.numeral).toBe(c.numeral);
      expect(result.rootUsed).toBe(c.rootUsed);
      expect(result.respelled).toBe(c.respelled);
    });
  }
});
