import { describe, expect, it } from "vitest";
import table from "./data/transitions.json";
import {
  generateProgression,
  mulberry32,
  realizeLabel,
  splitLabel,
  startLabel,
  voiceProgression,
} from "./generate.js";

describe("label splitting", () => {
  it("separates numerals from display suffixes", () => {
    expect(splitLabel("IIm7")).toEqual({ numeral: "II", suffix: "m7" });
    expect(splitLabel("♭II7")).toEqual({ numeral: "♭II", suffix: "7" });
    expect(splitLabel("VIIm7b5")).toEqual({ numeral: "VII", suffix: "m7b5" });
    expect(splitLabel("I")).toEqual({ numeral: "I", suffix: "" });
    expect(splitLabel("nonsense")).toBeNull();
  });
});

describe("generation over the canonical table", () => {
  it("is deterministic by seed and starts on the tonic family", () => {
    const a = generateProgression(table.major, "major", 16, 42);
    const b = generateProgression(table.major, "major", 16, 42);
    const c = generateProgression(table.major, "major", 16, 43);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect(a[0]).toBe(startLabel(table.major, "major"));
    expect(a).toHaveLength(16);
  });

  it("minor table starts on a minor tonic", () => {
    const labels = generateProgression(table.minor, "minor", 8, 7);
    expect(labels[0].startsWith("Im")).toBe(true);
  });

  it("every generated label realizes in every key", () => {
    const labels = generateProgression(table.major, "major", 64, 1);
    for (const tonic of ["C", "F♯", "E♭", "C♭"]) {
      for (const label of labels) {
        const chord = realizeLabel(label, { tonic, mode: "major" });
        expect(chord, `${label} in ${tonic}`).not.toBeNull();
        expect(chord.pcs.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("realization spelling", () => {
  it("IIm7 in C is Dm7; ♭II7 in C is D♭7; V7 in F♯ is C♯7", () => {
    expect(realizeLabel("IIm7", { tonic: "C", mode: "major" }).symbol).toBe("Dm7");
    expect(realizeLabel("♭II7", { tonic: "C", mode: "major" }).symbol).toBe("D♭7");
    expect(realizeLabel("V7", { tonic: "F♯", mode: "major" }).symbol).toBe("C♯7");
  });

  it("realizes pcs from the dictionary", () => {
    const dm7 = realizeLabel("IIm7", { tonic: "C", mode: "major" });
    expect([...dm7.pcs].sort((a, b) => a - b)).toEqual([0, 2, 5, 9]);
  });
});

describe("voicing", () => {
  it("voices a ii-V-I smoothly (no leaps over an octave per voice)", () => {
    const key = { tonic: "C", mode: "major" };
    const chords = ["IIm7", "V7", "Imaj7"].map((l) => realizeLabel(l, key));
    const voiced = voiceProgression(chords);
    expect(voiced).toHaveLength(3);
    for (const v of voiced) {
      expect(v.notes.length).toBeGreaterThanOrEqual(3);
      for (const n of v.notes) expect(n).toBeGreaterThan(40);
    }
  });

  it("rng is stable", () => {
    const r = mulberry32(1);
    expect(r()).toBeCloseTo(mulberry32(1)(), 12);
  });
});
