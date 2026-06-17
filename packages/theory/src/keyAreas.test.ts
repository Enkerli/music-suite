import { describe, expect, it } from "vitest";
import { analyzeKeyAreas } from "./keyAreas.js";

describe("analyzeKeyAreas — implied modulation (ii–V–I to a non-home key)", () => {
  it("detects a ii–V–I that tonicizes the dominant (G area in C)", () => {
    // Am7 D7 Gmaj7 in C = VIm7 II7 Vmaj7 (home labels) — a ii–V–I in G.
    const areas = analyzeKeyAreas(["VIm7", "II7", "Vmaj7"], "major");
    expect(areas).toEqual([{ start: 0, end: 2, interval: 7, mode: "major" }]);
  });

  it("leaves a home-key ii–V–I alone (it isn't a modulation)", () => {
    expect(analyzeKeyAreas(["IIm7", "V7", "Imaj7"], "major")).toEqual([]);
  });

  it("tonicizes a minor target (ii–V–i to the relative/ii area)", () => {
    // Em7♭5 A7 Dm7 in C = IIIm7♭5 VI7 IIm7 — a ii–V–i in D minor.
    const areas = analyzeKeyAreas(["IIIm7b5", "VI7", "IIm7"], "major");
    expect(areas).toEqual([{ start: 0, end: 2, interval: 2, mode: "minor" }]);
  });

  it("merges two adjacent cadences to the same key", () => {
    const areas = analyzeKeyAreas(["VIm7", "II7", "Vmaj7", "VIm7", "II7", "Vmaj7"], "major");
    expect(areas).toEqual([{ start: 0, end: 5, interval: 7, mode: "major" }]);
  });

  it("fires on a bare secondary dominant resolving to its target (V/ii → ii, no ii)", () => {
    // VI7 → IIm7 (A7 → Dm7) tonicizes D minor even without a preceding ii.
    expect(analyzeKeyAreas(["Imaj7", "VI7", "IIm7"], "major")).toEqual([{ start: 1, end: 2, interval: 2, mode: "minor" }]);
  });

  it("fires on V7/IV → IV (the common blues/tonicization motion)", () => {
    // I7 → IVmaj7 (C7 → Fmaj7) tonicizes F.
    expect(analyzeKeyAreas(["Imaj7", "I7", "IVmaj7"], "major")).toEqual([{ start: 1, end: 2, interval: 5, mode: "major" }]);
  });

  it("finds a tonicization embedded in a longer progression", () => {
    // Imaj7 | (VIm7 II7 Vmaj7 = ii–V–I in G) | Imaj7
    const areas = analyzeKeyAreas(["Imaj7", "VIm7", "II7", "Vmaj7", "Imaj7"], "major");
    expect(areas).toEqual([{ start: 1, end: 3, interval: 7, mode: "major" }]);
  });
});
