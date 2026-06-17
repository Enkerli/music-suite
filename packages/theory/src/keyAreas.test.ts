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

  it("ignores a lone secondary dominant (V/x → x, no ii) as too brief", () => {
    // II7 → V (A7→G style) without a preceding ii is not a full ii–V–I.
    expect(analyzeKeyAreas(["Imaj7", "VI7", "IIm7"], "major")).toEqual([]);
  });

  it("finds a tonicization embedded in a longer progression", () => {
    // Imaj7 | (VIm7 II7 Vmaj7 = ii–V–I in G) | Imaj7
    const areas = analyzeKeyAreas(["Imaj7", "VIm7", "II7", "Vmaj7", "Imaj7"], "major");
    expect(areas).toEqual([{ start: 1, end: 3, interval: 7, mode: "major" }]);
  });
});
