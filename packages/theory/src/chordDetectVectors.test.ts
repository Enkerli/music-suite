import { describe, expect, it } from "vitest";
import vectors from "../vectors/chord-detection.json";
import { detectChord, detectChordFromPcs, dictionarySize } from "./index.js";

describe("chord detection vectors (cross-language contract)", () => {
  it("dictionary size matches the vectors' snapshot", () => {
    expect(dictionarySize()).toBe(vectors.dictionarySize);
  });

  for (const c of vectors.cases) {
    it(c.name, () => {
      const m = detectChordFromPcs(c.pcs);
      if (c.match === null) {
        expect(m).toBeNull();
      } else {
        expect(m).not.toBeNull();
        expect(m!.root).toBe(c.match.root);
        expect(m!.quality.key).toBe(c.match.qualityKey);
        expect(m!.symbol).toBe(c.match.symbol);
      }
    });
  }

  for (const c of vectors.slashCases) {
    it(c.name, () => {
      const m = detectChord(c.pitches);
      expect(m).not.toBeNull();
      expect(m!.root).toBe(c.match.root);
      expect(m!.quality.key).toBe(c.match.qualityKey);
      expect(m!.symbol).toBe(c.match.symbol);
      expect(m!.bassPc ?? null).toBe(c.match.bassPc);
    });
  }
});
