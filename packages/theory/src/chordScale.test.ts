import { describe, expect, it } from "vitest";
import { chordScaleFor } from "./chordScale.js";

// Pitch classes: C=0, D=2, E=4, F=5, G=7, A=9, B=11.
const C = 0;

describe("chordScaleFor — scale choice (textbook chord-scales)", () => {
  const scaleOf = (root: number, pcs: number[]) => chordScaleFor(root, pcs)!.scale;

  it("maj7 → Lydian, not Ionian (avoid-note-free preference, Q5)", () => {
    const cs = chordScaleFor(C, [0, 4, 7, 11])!; // Cmaj7
    expect(cs.scale).toBe("lydian"); // ♯11 replaces Ionian's avoid 4th
    expect(cs.avoid).toEqual([]); // nothing to dodge
    expect(cs.alts).toContain("ionian"); // Ionian demoted to the alternates row
  });

  it("dominant 7 → Mixolydian", () => {
    expect(scaleOf(C, [0, 4, 7, 10])).toBe("mixolydian"); // C7
  });

  it("m7 → Dorian", () => {
    expect(scaleOf(C, [0, 3, 7, 10])).toBe("dorian"); // Cm7
  });

  it("m7♭5 → Locrian", () => {
    expect(scaleOf(C, [0, 3, 6, 10])).toBe("locrian"); // Cm7♭5
  });

  it("dim7 → Diminished (whole-half)", () => {
    expect(scaleOf(C, [0, 3, 6, 9])).toBe("diminishedWholeHalf"); // Cdim7
  });

  it("7♯11 → Lydian dominant", () => {
    expect(scaleOf(C, [0, 4, 7, 10, 6])).toBe("lydianDominant"); // C7♯11
  });

  it("7♭9 → Diminished (half-whole)", () => {
    expect(scaleOf(C, [0, 4, 7, 10, 1])).toBe("diminishedHalfWhole"); // C7♭9
  });

  it("m(maj7) → Melodic minor", () => {
    expect(scaleOf(C, [0, 3, 7, 11])).toBe("melodicMinor"); // Cm(maj7)
  });

  it("maj7♯5 → Lydian augmented", () => {
    expect(scaleOf(C, [0, 4, 8, 11])).toBe("lydianAugmented"); // Cmaj7♯5
  });
});

describe("chordScaleFor — avoid notes (a ♭9 above a chord tone)", () => {
  it("Cmaj7 resolves to avoid-free Lydian (the 4th becomes ♯11, a tension)", () => {
    const cs = chordScaleFor(C, [0, 4, 7, 11])!;
    expect(cs.scale).toBe("lydian");
    expect(cs.avoid).toEqual([]); // F♯ (♯11) is a whole step above E — no clash
    expect(cs.tensions.sort((a, b) => a - b)).toEqual([2, 6, 9]); // D (9), F♯ (♯11), A (13)
    expect(cs.chordTones.sort((a, b) => a - b)).toEqual([0, 4, 7, 11]);
  });

  it("C7/Mixolydian: F (the 11) is the avoid note, above the 3rd (E)", () => {
    const cs = chordScaleFor(C, [0, 4, 7, 10])!;
    expect(cs.avoid).toEqual([5]); // F
  });

  it("Cm7/Dorian: no avoid note (Dorian's character note sits a whole step up)", () => {
    const cs = chordScaleFor(C, [0, 3, 7, 10])!;
    expect(cs.avoid).toEqual([]);
  });

  it("dim7: symmetric scale has no half-step-above-chord-tone, so no avoid notes", () => {
    const cs = chordScaleFor(C, [0, 3, 6, 9])!;
    expect(cs.avoid).toEqual([]);
  });

  it("every scale tone is exactly one of chord tone / tension / avoid", () => {
    const cs = chordScaleFor(C, [0, 4, 7, 10])!;
    const union = [...cs.chordTones, ...cs.tensions, ...cs.avoid].sort((a, b) => a - b);
    expect(union).toEqual([...cs.scalePcs].sort((a, b) => a - b));
  });
});

describe("chordScaleFor — robustness", () => {
  it("is root-agnostic (transposing the chord transposes the scale)", () => {
    const c = chordScaleFor(0, [0, 4, 7, 10])!;
    const g = chordScaleFor(7, [7, 11, 2, 5])!; // G7
    expect(g.scale).toBe(c.scale);
    expect(g.scalePcs).toEqual(c.scalePcs.map((p) => (p + 7) % 12));
  });

  it("returns null for an empty pc set", () => {
    expect(chordScaleFor(0, [])).toBeNull();
  });
});
