import { describe, expect, it } from "vitest";
import { applySubstitutions, parseDegreeLabel, semitoneToNumeral } from "./substitutions.js";

describe("degree-label parsing & spelling (mode-aware)", () => {
  it("parses numerals to tonic-relative semitones per the mode frame", () => {
    expect(parseDegreeLabel("V7", "major")!.semitone).toBe(7);
    expect(parseDegreeLabel("♭II7", "major")!.semitone).toBe(1);
    expect(parseDegreeLabel("III", "major")!.semitone).toBe(4);
    expect(parseDegreeLabel("III", "minor")!.semitone).toBe(3); // minor frame's 3rd degree
    expect(parseDegreeLabel("V7", "major")).toMatchObject({ numeral: "V", suffix: "7" });
  });

  it("spells semitones with the fewest accidentals, mode-aware", () => {
    expect(semitoneToNumeral(1, "major", "flat")).toBe("♭II");
    expect(semitoneToNumeral(10, "major", "flat")).toBe("♭VII");
    expect(semitoneToNumeral(10, "minor", "flat")).toBe("VII"); // 10 is natural in minor
    expect(semitoneToNumeral(1, "major", "sharp")).toBe("♯I");
  });
});

describe("tritone substitution (♭II7 ↔ V7)", () => {
  it("replaces a down-a-fifth dominant with the dominant a tritone away", () => {
    const r = applySubstitutions(["IIm7", "V7", "Imaj7"], { tritone: 1, mode: "major" });
    expect(r.labels).toEqual(["IIm7", "♭II7", "Imaj7"]);
    expect(r.edits).toEqual([{ index: 1, rule: "tritone", from: "V7", to: "♭II7" }]);
  });

  it("preserves the dominant's tensions in the substitute", () => {
    const r = applySubstitutions(["V13b9", "Imaj7"], { tritone: 1 });
    expect(r.labels).toEqual(["♭II13b9", "Imaj7"]);
  });

  it("leaves a dominant that doesn't resolve down a fifth alone", () => {
    const r = applySubstitutions(["V7", "VIm7"], { tritone: 1 }); // V→vi is not down-a-fifth
    expect(r.labels).toEqual(["V7", "VIm7"]);
    expect(r.edits).toEqual([]);
  });
});

describe("backdoor substitution (♭VII7)", () => {
  it("replaces a dominant resolving to a major tonic with the backdoor dominant", () => {
    const r = applySubstitutions(["V7", "Imaj7"], { backdoor: 1, mode: "major" });
    expect(r.labels).toEqual(["♭VII7", "Imaj7"]);
    expect(r.edits[0]).toMatchObject({ rule: "backdoor", to: "♭VII7" });
  });

  it("does not fire when the target is not major", () => {
    const r = applySubstitutions(["V7", "Im7"], { backdoor: 1 });
    expect(r.labels).toEqual(["V7", "Im7"]);
  });

  it("tritone wins when both are enabled on the same chord", () => {
    const r = applySubstitutions(["V7", "Imaj7"], { tritone: 1, backdoor: 1 });
    expect(r.labels).toEqual(["♭II7", "Imaj7"]);
    expect(r.edits[0]!.rule).toBe("tritone");
  });
});

describe("passing diminished (insertion)", () => {
  it("inserts a ♯i°7 between two chords an ascending whole tone apart", () => {
    const r = applySubstitutions(["Imaj7", "IIm7"], { passingDim: 1, mode: "major" });
    expect(r.labels).toEqual(["Imaj7", "♯I°7", "IIm7"]);
    expect(r.edits[0]).toMatchObject({ rule: "passingDim", to: "♯I°7" });
  });

  it("respects allowInsertions:false (count-preserving only)", () => {
    const r = applySubstitutions(["Imaj7", "IIm7"], { passingDim: 1, allowInsertions: false });
    expect(r.labels).toEqual(["Imaj7", "IIm7"]);
  });
});

describe("probability & determinism", () => {
  it("probability 0 is the identity", () => {
    const labels = ["IIm7", "V7", "Imaj7", "VIm 7".replace(" ", "")];
    expect(applySubstitutions(labels, {}).labels).toEqual(labels);
  });

  it("is deterministic for a given seed", () => {
    const labels = ["IIm7", "V7", "Imaj7", "IIIm7", "VI7", "IIm7", "V7", "Imaj7"];
    const a = applySubstitutions(labels, { tritone: 0.5, backdoor: 0.3, seed: 42 });
    const b = applySubstitutions(labels, { tritone: 0.5, backdoor: 0.3, seed: 42 });
    const c = applySubstitutions(labels, { tritone: 0.5, backdoor: 0.3, seed: 99 });
    expect(a.labels).toEqual(b.labels);
    expect(a.labels).not.toEqual(c.labels); // a different seed reaches different chords
  });
});
