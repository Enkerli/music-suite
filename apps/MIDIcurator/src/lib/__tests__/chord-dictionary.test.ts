import { describe, it, expect } from 'vitest';
import {
  pcsToBinary,
  binaryToDecimal,
  pcsToDecimal,
  rotatePcs,
  rootName,
  rootNameSharp,
  rootNameFlat,
  spellRoot,
  spellInChordContext,
  lookupByDecimal,
  getAllQualities,
  dictionarySize,
} from '../chord-dictionary';

describe('pcsToBinary', () => {
  it('C major triad → 100010010000', () => {
    expect(pcsToBinary([0, 4, 7])).toBe('100010010000');
  });

  it('empty set → 000000000000', () => {
    expect(pcsToBinary([])).toBe('000000000000');
  });

  it('all 12 pitch classes → 111111111111', () => {
    expect(pcsToBinary([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])).toBe('111111111111');
  });

  it('handles duplicates', () => {
    expect(pcsToBinary([0, 0, 4, 4, 7])).toBe('100010010000');
  });
});

describe('binaryToDecimal', () => {
  it('C major triad binary → 2192', () => {
    expect(binaryToDecimal('100010010000')).toBe(2192);
  });

  it('all zeros → 0', () => {
    expect(binaryToDecimal('000000000000')).toBe(0);
  });
});

describe('pcsToDecimal', () => {
  it('C major triad → 2192', () => {
    expect(pcsToDecimal([0, 4, 7])).toBe(2192);
  });

  it('C minor triad → 2320', () => {
    expect(pcsToDecimal([0, 3, 7])).toBe(2320);
  });

  it('C dominant seventh → 2194', () => {
    expect(pcsToDecimal([0, 4, 7, 10])).toBe(2194);
  });
});

describe('rotatePcs', () => {
  it('rotating [0,4,7] by root=0 gives [0,4,7]', () => {
    expect(rotatePcs([0, 4, 7], 0)).toEqual([0, 4, 7]);
  });

  it('rotating [2,6,9] by root=2 gives [0,4,7]', () => {
    // D major = D(2), F#(6), A(9) → rotated to root = [0,4,7]
    expect(rotatePcs([2, 6, 9], 2)).toEqual([0, 4, 7]);
  });

  it('rotating [7,11,2] by root=7 gives [0,4,7]', () => {
    // G major = G(7), B(11), D(2) → rotated to root = [0,4,7]
    expect(rotatePcs([7, 11, 2], 7)).toEqual([0, 4, 7]);
  });

  it('handles wrap-around correctly', () => {
    // Eb minor = Eb(3), Gb(6), Bb(10) → rotated by root=3 = [0,3,7]
    expect(rotatePcs([3, 6, 10], 3)).toEqual([0, 3, 7]);
  });
});

describe('rootName', () => {
  it('0 → C', () => expect(rootName(0)).toBe('C'));
  it('1 → C♯', () => expect(rootName(1)).toBe('C♯'));
  it('3 → E♭', () => expect(rootName(3)).toBe('E♭'));
  it('6 → F♯', () => expect(rootName(6)).toBe('F♯'));
  it('11 → B', () => expect(rootName(11)).toBe('B'));
});

describe('rootNameSharp / rootNameFlat', () => {
  it('sharp spellings', () => {
    expect(rootNameSharp(1)).toBe('C♯');
    expect(rootNameSharp(3)).toBe('D♯');
    expect(rootNameSharp(6)).toBe('F♯');
  });

  it('flat spellings', () => {
    expect(rootNameFlat(1)).toBe('D♭');
    expect(rootNameFlat(3)).toBe('E♭');
    expect(rootNameFlat(6)).toBe('G♭');
  });
});

describe('lookupByDecimal', () => {
  it('finds major triad', () => {
    const q = lookupByDecimal(2192);
    expect(q).toBeDefined();
    expect(q!.key).toBe('maj');
    expect(q!.fullName).toBe('major triad');
  });

  it('finds minor seventh', () => {
    const q = lookupByDecimal(2322);
    expect(q).toBeDefined();
    expect(q!.key).toBe('min7');
  });

  it('finds dominant seventh', () => {
    const q = lookupByDecimal(2194);
    expect(q).toBeDefined();
    expect(q!.key).toBe('7');
  });

  it('returns undefined for unknown decimal', () => {
    expect(lookupByDecimal(9999)).toBeUndefined();
  });
});

describe('getAllQualities', () => {
  it('returns all 167 qualities', () => {
    expect(getAllQualities().length).toBe(167);
  });

  it('each quality has required fields', () => {
    for (const q of getAllQualities()) {
      expect(q.key).toBeTruthy();
      expect(q.fullName).toBeTruthy();
      expect(typeof q.displayName).toBe('string');
      expect(q.pcs.length).toBeGreaterThanOrEqual(2);
      expect(q.binary).toHaveLength(12);
      expect(q.decimal).toBeGreaterThan(0);
      expect(q.intervals.length).toBe(q.pcs.length);
    }
  });
});

describe('dictionarySize', () => {
  it('returns 167', () => {
    expect(dictionarySize()).toBe(167);
  });
});

describe('decimal consistency', () => {
  it('all qualities have consistent binary ↔ decimal', () => {
    for (const q of getAllQualities()) {
      const computedDecimal = binaryToDecimal(q.binary);
      expect(computedDecimal).toBe(q.decimal);
    }
  });

  it('all qualities have consistent pcs ↔ binary', () => {
    for (const q of getAllQualities()) {
      const computedBinary = pcsToBinary(q.pcs);
      expect(computedBinary).toBe(q.binary);
    }
  });
});

describe('spellRoot', () => {
  it('falls back to rootName() when no keyPc', () => {
    for (let pc = 0; pc < 12; pc++) {
      expect(spellRoot(pc)).toBe(rootName(pc));
    }
  });

  it('C major uses mixed default', () => {
    expect(spellRoot(1, 0)).toBe('C♯');
    expect(spellRoot(3, 0)).toBe('E♭');
    expect(spellRoot(6, 0)).toBe('F♯');
    expect(spellRoot(8, 0)).toBe('A♭');
    expect(spellRoot(10, 0)).toBe('B♭');
  });

  // ── Sharp keys ──
  it('G major (1♯) uses sharp chromatic names', () => {
    expect(spellRoot(1, 7)).toBe('C♯');
    expect(spellRoot(3, 7)).toBe('D♯');
    expect(spellRoot(8, 7)).toBe('G♯');
    expect(spellRoot(10, 7)).toBe('A♯');
  });

  it('D major (2♯) uses sharps', () => {
    expect(spellRoot(1, 2)).toBe('C♯');
    expect(spellRoot(8, 2)).toBe('G♯');
  });

  it('A major (3♯) uses sharps', () => {
    expect(spellRoot(1, 9)).toBe('C♯');
    expect(spellRoot(3, 9)).toBe('D♯');
    expect(spellRoot(8, 9)).toBe('G♯');
  });

  it('E major (4♯) uses sharps', () => {
    expect(spellRoot(1, 4)).toBe('C♯');
    expect(spellRoot(3, 4)).toBe('D♯');
    expect(spellRoot(8, 4)).toBe('G♯');
    expect(spellRoot(10, 4)).toBe('A♯');
  });

  // ── Flat keys ──
  it('F major (1♭) uses flat chromatic names', () => {
    expect(spellRoot(1, 5)).toBe('D♭');
    expect(spellRoot(3, 5)).toBe('E♭');
    expect(spellRoot(6, 5)).toBe('G♭');
    expect(spellRoot(8, 5)).toBe('A♭');
  });

  it('B♭ major (2♭) uses flats', () => {
    expect(spellRoot(1, 10)).toBe('D♭');
    expect(spellRoot(6, 10)).toBe('G♭');
    expect(spellRoot(8, 10)).toBe('A♭');
  });

  it('E♭ major (3♭) uses flats', () => {
    expect(spellRoot(1, 3)).toBe('D♭');
    expect(spellRoot(6, 3)).toBe('G♭');
    expect(spellRoot(8, 3)).toBe('A♭');
  });

  it('A♭ major (4♭) uses flats', () => {
    expect(spellRoot(1, 8)).toBe('D♭');
    expect(spellRoot(6, 8)).toBe('G♭');
  });

  it('D♭ major (5♭) uses flats', () => {
    expect(spellRoot(6, 1)).toBe('G♭');
    expect(spellRoot(8, 1)).toBe('A♭');
  });

  // ── Extreme key diatonic overrides ──
  it('F♯ major: PC 0 → B♯, PC 5 → E♯', () => {
    expect(spellRoot(0, 6)).toBe('B♯');
    expect(spellRoot(5, 6)).toBe('E♯');
  });

  it('B major: PC 5 → E♯', () => {
    expect(spellRoot(5, 11)).toBe('E♯');
  });

  it('A♭ major: PC 4 → F♭', () => {
    expect(spellRoot(4, 8)).toBe('F♭');
  });

  it('D♭ major: PC 11 → C♭', () => {
    expect(spellRoot(11, 1)).toBe('C♭');
  });

  // ── Full scale checks for edge-case keys ──
  it('F♯ major scale is spelled correctly', () => {
    // F♯ G♯ A♯ B C♯ D♯ E♯
    expect(spellRoot(6, 6)).toBe('F♯');
    expect(spellRoot(8, 6)).toBe('G♯');
    expect(spellRoot(10, 6)).toBe('A♯');
    expect(spellRoot(11, 6)).toBe('B');
    expect(spellRoot(1, 6)).toBe('C♯');
    expect(spellRoot(3, 6)).toBe('D♯');
    expect(spellRoot(5, 6)).toBe('E♯');
  });

  it('D♭ major scale is spelled correctly', () => {
    // D♭ E♭ F G♭ A♭ B♭ C
    expect(spellRoot(1, 1)).toBe('D♭');
    expect(spellRoot(3, 1)).toBe('E♭');
    expect(spellRoot(5, 1)).toBe('F');
    expect(spellRoot(6, 1)).toBe('G♭');
    expect(spellRoot(8, 1)).toBe('A♭');
    expect(spellRoot(10, 1)).toBe('B♭');
    expect(spellRoot(0, 1)).toBe('C');
  });
});

describe('spellInChordContext', () => {
  // The core issue: rootName(1) = "C♯" but spellRoot(*, 1) treats PC 1 as D♭ (flat key).
  // spellInChordContext derives direction from the root NAME, not the root PC.

  it('C♯ chord (rootName "C♯") spells notes with sharps + diatonic E♯/B♯', () => {
    // C♯7 = C♯ E♯ G♯ B
    expect(spellInChordContext(1, 1, 'C♯')).toBe('C♯');
    expect(spellInChordContext(5, 1, 'C♯')).toBe('E♯');  // major 3rd of C♯
    expect(spellInChordContext(8, 1, 'C♯')).toBe('G♯');
    expect(spellInChordContext(11, 1, 'C♯')).toBe('B');
    // C♯maj7 seventh = B♯
    expect(spellInChordContext(0, 1, 'C♯')).toBe('B♯');
  });

  it('D♭ chord (explicit flat root) spells notes with flats', () => {
    // D♭ major = D♭ F A♭
    expect(spellInChordContext(1, 1, 'D♭')).toBe('D♭');
    expect(spellInChordContext(5, 1, 'D♭')).toBe('F');
    expect(spellInChordContext(8, 1, 'D♭')).toBe('A♭');
  });

  it('B7 chord (natural root, sharp key) spells notes with sharps', () => {
    // B7 = B D♯ F♯ A
    expect(spellInChordContext(11, 11)).toBe('B');
    expect(spellInChordContext(3, 11)).toBe('D♯');
    expect(spellInChordContext(6, 11)).toBe('F♯');
    expect(spellInChordContext(9, 11)).toBe('A');
  });

  it('E♭ chord (flat root) spells notes with flats', () => {
    // E♭ major = E♭ G B♭
    expect(spellInChordContext(3, 3, 'E♭')).toBe('E♭');
    expect(spellInChordContext(7, 3, 'E♭')).toBe('G');
    expect(spellInChordContext(10, 3, 'E♭')).toBe('B♭');
  });

  it('A♭7 chord (flat root) spells notes with flats', () => {
    // A♭7 = A♭ C E♭ G♭
    expect(spellInChordContext(8, 8, 'A♭')).toBe('A♭');
    expect(spellInChordContext(0, 8, 'A♭')).toBe('C');
    expect(spellInChordContext(3, 8, 'A♭')).toBe('E♭');
    expect(spellInChordContext(6, 8, 'A♭')).toBe('G♭');
  });

  it('F♯ chord (sharp root) spells notes with sharps + diatonic E♯/B♯', () => {
    // F♯ minor = F♯ A C♯
    expect(spellInChordContext(6, 6, 'F♯')).toBe('F♯');
    expect(spellInChordContext(9, 6, 'F♯')).toBe('A');
    expect(spellInChordContext(1, 6, 'F♯')).toBe('C♯');
    // F♯ major 7th = E♯, augmented 4th context = B♯
    expect(spellInChordContext(5, 6, 'F♯')).toBe('E♯');
    expect(spellInChordContext(0, 6, 'F♯')).toBe('B♯');
  });

  it('G♭ chord (flat root at same PC as F♯) spells notes with flats + diatonic C♭/F♭', () => {
    // G♭ major = G♭ B♭ D♭
    expect(spellInChordContext(6, 6, 'G♭')).toBe('G♭');
    expect(spellInChordContext(10, 6, 'G♭')).toBe('B♭');
    expect(spellInChordContext(1, 6, 'G♭')).toBe('D♭');
    // G♭ major 7th = F♭, 4th = C♭
    expect(spellInChordContext(4, 6, 'G♭')).toBe('F♭');
    expect(spellInChordContext(11, 6, 'G♭')).toBe('C♭');
  });

  it('C chord (natural root, C key) uses mixed default', () => {
    // C major = C E G — all natural, no conflict
    expect(spellInChordContext(0, 0)).toBe('C');
    expect(spellInChordContext(4, 0)).toBe('E');
    expect(spellInChordContext(7, 0)).toBe('G');
  });

  it('G chord (natural root, sharp key) uses sharp spelling', () => {
    // G7 = G B D F — natural root, but G is a sharp key
    expect(spellInChordContext(7, 7)).toBe('G');
    expect(spellInChordContext(11, 7)).toBe('B');
    expect(spellInChordContext(2, 7)).toBe('D');
    expect(spellInChordContext(5, 7)).toBe('F');
  });

  it('F chord (natural root, flat key) uses flat spelling', () => {
    // F7 = F A C E♭ — natural root, but F is a flat key
    expect(spellInChordContext(5, 5)).toBe('F');
    expect(spellInChordContext(9, 5)).toBe('A');
    expect(spellInChordContext(0, 5)).toBe('C');
    expect(spellInChordContext(3, 5)).toBe('E♭');
  });
});
