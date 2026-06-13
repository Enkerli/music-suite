import { describe, expect, it } from "vitest";
import {
  formatLeadsheet,
  parseLeadsheet,
  realizeChord,
  realizeLeadsheet,
  type KeyContext,
} from "./index.js";

const C: KeyContext = { tonic: "C", mode: "major" };

describe("bar-notation parse", () => {
  it("splits bars on | and chords on whitespace", () => {
    const p = parseLeadsheet("Dm7 G7 | Cmaj7", C);
    const bars = p.sections[0]!.bars;
    expect(bars).toHaveLength(2);
    expect(bars[0]!.chords.map((c) => c.inputText)).toEqual(["Dm7", "G7"]);
    expect(bars[1]!.chords).toHaveLength(1);
  });

  it("parses absolute chords with slash bass and extensions", () => {
    const p = parseLeadsheet("A13#9/D", C);
    const c = p.sections[0]!.bars[0]!.chords[0]!;
    expect(c.source).toBe("absolute");
    expect(c.symbol).toMatchObject({ root: "A", suffix: "13♯9", bass: "D" });
  });

  it("recognizes Roman-numeral tokens as degree chords", () => {
    const p = parseLeadsheet("IIm7 ♭II7 | I", C);
    const [b0, b1] = p.sections[0]!.bars;
    expect(b0!.chords[0]).toMatchObject({ source: "degree", degree: { numeral: "II", suffix: "m7" } });
    expect(b0!.chords[1]).toMatchObject({ source: "degree", degree: { numeral: "♭II", suffix: "7" } });
    expect(b1!.chords[0]!.degree).toEqual({ numeral: "I", suffix: "" });
  });

  it("handles repeat bars (% and -)", () => {
    const p = parseLeadsheet("Cmaj7 | % | -", C);
    const bars = p.sections[0]!.bars;
    expect(bars[1]!.repeat).toBe(true);
    expect(bars[2]!.repeat).toBe(true);
    expect(bars[1]!.chords).toHaveLength(0);
  });
});

describe("round-trip: format(parse(t)) === t (normalized)", () => {
  const cases = [
    "Dm7 G7 | Cmaj7",
    "C7(∆7,9) A13♯9/D | F6(♯9)/D C∆13sus4/D | F∆9♯11/C A13♭9(add♭13) | C∆11 F∆11/C",
    "IIm7 V7 | Imaj7",
    "Cmaj7 | % | F7",
  ];
  for (const t of cases) {
    it(t.slice(0, 32), () => {
      expect(formatLeadsheet(parseLeadsheet(t, C))).toBe(t);
    });
  }

  it("normalizes ASCII accidentals to Unicode", () => {
    expect(formatLeadsheet(parseLeadsheet("Bb7 F#m7/A", C))).toBe("B♭7 F♯m7/A");
  });
});

describe("realization", () => {
  it("realizes an absolute chord to spelled symbol + pcs", () => {
    const p = parseLeadsheet("Dm7", C);
    const r = realizeChord(p.sections[0]!.bars[0]!.chords[0]!, C);
    expect(r.symbol).toBe("Dm7");
    expect([...r.pcs].sort((a, b) => a - b)).toEqual([0, 2, 5, 9]);
  });

  it("realizes a degree chord through resolveDegree (♭II7 in C = D♭7)", () => {
    const p = parseLeadsheet("♭II7", C);
    const r = realizeChord(p.sections[0]!.bars[0]!.chords[0]!, C);
    expect(r.symbol).toBe("D♭7");
    expect(r.qualityKey).toBe(qualityKeyOf7());
  });

  it("degree realization re-anchors per key (V7 in F♯ = C♯7)", () => {
    const p = parseLeadsheet("V7", C);
    const r = realizeChord(p.sections[0]!.bars[0]!.chords[0]!, { tonic: "F♯", mode: "major" });
    expect(r.rootName).toBe("C♯");
  });

  it("falls back to the paren-stripped base, then bare root", () => {
    const p = parseLeadsheet("C7(∆7,9) Czzz", C);
    const [a, b] = p.sections[0]!.bars[0]!.chords;
    const ra = realizeChord(a!, C);
    expect(ra.rootPc).toBe(0);
    expect(ra.qualityKey).not.toBeNull(); // "7" recognized after stripping (…)
    expect(ra.pcs.length).toBeGreaterThan(1);
    const rb = realizeChord(b!, C);
    expect(rb.qualityKey).toBeNull(); // truly unknown → bare root
    expect(rb.pcs).toEqual([0]);
  });

  it("realizeLeadsheet expands repeat bars from the prior bar", () => {
    const p = parseLeadsheet("Dm7 G7 | %", C);
    const realized = realizeLeadsheet(p);
    expect(realized).toHaveLength(2);
    expect(realized[1]!.map((r) => r.symbol)).toEqual(["Dm7", "G7"]);
  });
});

function qualityKeyOf7(): string {
  const p = parseLeadsheet("C7", C);
  return realizeChord(p.sections[0]!.bars[0]!.chords[0]!, C).qualityKey!;
}
