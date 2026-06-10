import { describe, expect, it } from "vitest";
import vectors from "../vectors/pcs-families.json";
import {
  chromaticToFifthsIndex,
  classifyDegreeChord,
  degreeChords,
  fifthsIndexToChromatic,
  pcsToBitmask,
  scaleFamily,
  type DegreeChordType,
} from "./pcs.js";

describe("circle of fifths mapping", () => {
  it("round-trips all 12 pitch classes", () => {
    for (let pc = 0; pc < 12; pc++) {
      expect(fifthsIndexToChromatic(chromaticToFifthsIndex(pc))).toBe(pc);
    }
  });

  it("places C at 0 and G at 1", () => {
    expect(chromaticToFifthsIndex(0)).toBe(0);
    expect(chromaticToFifthsIndex(7)).toBe(1);
  });
});

describe("scale families (vectors)", () => {
  for (const f of vectors.families) {
    it(`k=${f.k} root=${f.root} (${f.name})`, () => {
      const pcs = scaleFamily(f.k, f.root);
      expect(pcs).toEqual(f.pcs);
      expect(pcsToBitmask(pcs)).toBe(f.bitmask);
    });
  }

  it("returns [] outside k=3..8", () => {
    expect(scaleFamily(2, 0)).toEqual([]);
    expect(scaleFamily(9, 0)).toEqual([]);
  });
});

describe("degree chords (vectors)", () => {
  for (const d of vectors.degreeChords) {
    it(`${d.scale} ${d.type}`, () => {
      const scale = scaleFamily(d.k, d.root);
      const chords = degreeChords(scale, d.type as DegreeChordType);
      expect(chords.map((c) => c.numeral)).toEqual(d.numerals);
    });
  }

  it("C major triads carry the expected roots and bitmasks", () => {
    const chords = degreeChords(scaleFamily(7, 0), "triads");
    expect(chords[0]!.pcs).toEqual([0, 4, 7]);
    expect(chords[0]!.bitmask).toBe(2192);
    expect(chords[4]!.rootPc).toBe(7); // V rooted on G
  });
});

describe("classifyDegreeChord", () => {
  it("identifies common qualities", () => {
    expect(classifyDegreeChord([0, 4, 7]).quality).toBe("maj");
    expect(classifyDegreeChord([2, 5, 9, 0]).quality).toBe("min7");
    expect(classifyDegreeChord([11, 2, 5, 9]).quality).toBe("halfDim7");
  });

  it("falls back to 'set' for unmatched collections", () => {
    const info = classifyDegreeChord([0, 1, 2]);
    expect(info.quality).toBe("set");
    expect(info.root).toBeNull();
  });

  it("returns null quality for fewer than 3 pcs", () => {
    expect(classifyDegreeChord([0, 7]).quality).toBeNull();
  });
});
