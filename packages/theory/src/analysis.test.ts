import { describe, expect, it } from "vitest";
import vectors from "../vectors/degree-assertion.json";
import { assertDegree, formatDegreeLabel, resolveDegree, type Mode } from "./analysis.js";
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

describe("display suffixes round-trip (convention integrity)", async () => {
  const { displaySuffix, qualityKeyForSuffix } = await import("./chordSymbol.js");
  const { getAllQualities } = await import("./chords.js");

  it("every quality's display suffix parses back to the same key", () => {
    for (const q of getAllQualities()) {
      expect(qualityKeyForSuffix(displaySuffix(q.key)), q.key).toBe(q.key);
    }
  });

  it("yields the legacy-style shorthand", () => {
    expect(displaySuffix("min7")).toBe("m7");
    expect(displaySuffix("maj")).toBe("");
    expect(displaySuffix("maj7")).toBe("maj7");
    expect(displaySuffix("m7b5")).toBe("m7b5");
    expect(displaySuffix("aug")).toBe("+");
  });
});

describe("resolveDegree (inverse of assertDegree)", () => {
  it("resolves diatonic and altered degrees with proper spelling", () => {
    expect(resolveDegree("V", { tonic: "E♭", mode: "major" })).toBe("B♭");
    expect(resolveDegree("♭III", { tonic: "C", mode: "major" })).toBe("E♭");
    expect(resolveDegree("bIII", { tonic: "C", mode: "major" })).toBe("E♭");
    expect(resolveDegree("♯IV", { tonic: "C", mode: "major" })).toBe("F♯");
    expect(resolveDegree("VII", { tonic: "C", mode: "minor" })).toBe("B♭");
    expect(resolveDegree("♯VII", { tonic: "A", mode: "minor" })).toBe("G♯");
    expect(resolveDegree("♭II", { tonic: "F♯", mode: "major" })).toBe("G");
  });

  it("round-trips with assertDegree on the vector cases", () => {
    for (const c of vectors.strict) {
      const key = { tonic: c.tonic, mode: c.mode as Mode };
      expect(resolveDegree(c.numeral, key)).toBe(c.root);
    }
  });

  it("rejects garbage numerals", () => {
    expect(() => resolveDegree("VIII", { tonic: "C", mode: "major" })).toThrow();
    expect(() => resolveDegree("", { tonic: "C", mode: "major" })).toThrow();
  });
});
