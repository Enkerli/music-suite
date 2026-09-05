import { describe, expect, it } from "vitest";
import vectors from "../vectors/pcs-families.json";
import {
  chromaticToFifthsIndex,
  classifyDegreeChord,
  consonance,
  degreeChords,
  fifthsIndexToChromatic,
  pcsToBitmask,
  romanNumeral,
  scaleFamily,
  type DegreeChordType,
  type DegreeQuality,
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
      // The whole result, not only what it prints. The numerals alone left the
      // pitch classes, the bitmasks and the classifier's verdict uncovered,
      // which is most of what a port has to reproduce.
      expect(chords.map((c) => ({
        degree: c.degree, rootPc: c.rootPc, pcs: c.pcs, bitmask: c.bitmask,
        quality: c.info.quality, chordRoot: c.info.root, name: c.info.name,
      }))).toEqual(d.degrees);
    });
  }

  it("C major triads carry the expected roots and bitmasks", () => {
    const chords = degreeChords(scaleFamily(7, 0), "triads");
    expect(chords[0]!.pcs).toEqual([0, 4, 7]);
    expect(chords[0]!.bitmask).toBe(145); // leftmost = LSB: {0,4,7} = 1+16+128
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

describe("consonance", () => {
  it("ranks triads from bright to dark", () => {
    const maj = consonance([0, 4, 7]);
    const min = consonance([0, 3, 7]);
    const dim = consonance([0, 3, 6]);
    const aug = consonance([0, 4, 8]);
    const cluster = consonance([0, 1, 2]);
    expect(maj).toBeGreaterThan(dim);
    expect(min).toBeGreaterThan(dim);
    expect(dim).toBeGreaterThan(cluster);
    expect(aug).toBeGreaterThan(cluster);
    for (const c of [maj, min, dim, aug, cluster]) {
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(1);
    }
  });

  it("is octave- and order-independent, and trivial for < 2 pcs", () => {
    expect(consonance([0, 4, 7])).toBeCloseTo(consonance([12, 67, 4]), 12);
    expect(consonance([5])).toBe(1);
    expect(consonance([])).toBe(1);
  });
});

// ── The groups added when the PCS engine was ported to Swift ───────────────
//
// Each of these was uncovered: `consonance` and `classifyDegreeChord` had
// hand-written spot checks and no vector, `romanNumeral` had neither, and the
// fifths mapping was checked by a round-trip property — which is also true of
// the identity function. Regenerate with vectors/gen-pcs-vectors.mjs.

describe("circle of fifths (vectors)", () => {
  for (const f of vectors.fifths) {
    it(`index ${f.index}`, () => {
      expect(fifthsIndexToChromatic(f.index)).toBe(f.chromatic);
      expect(chromaticToFifthsIndex(f.chromatic)).toBe(f.backToIndex);
    });
  }
});

describe("consonance (vectors)", () => {
  for (const c of vectors.consonance) {
    it(c.note, () => {
      expect(Number(consonance(c.pcs).toFixed(6))).toBe(c.value);
    });
  }
});

describe("classifyDegreeChord (vectors)", () => {
  for (const c of vectors.classify) {
    it(c.note, () => {
      const info = classifyDegreeChord(c.pcs);
      expect(info.quality).toBe(c.quality);
      expect(info.root).toBe(c.root);
      expect(info.name).toBe(c.name);
    });
  }
});

describe("romanNumeral (vectors)", () => {
  for (const n of vectors.numerals) {
    it(`degree ${n.degree} ${n.quality ?? "null"}`, () => {
      expect(romanNumeral(n.degree, n.quality as DegreeQuality | null)).toBe(n.numeral);
    });
  }
});
