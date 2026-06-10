import { describe, it, expect } from 'vitest';
import { parseChordSymbol, isValidChordSymbol, getChordSuggestions } from '../chord-parser';

describe('parseChordSymbol — basic chords', () => {
  it('parses "C" as C major', () => {
    const result = parseChordSymbol('C');
    expect(result).not.toBeNull();
    expect(result!.root).toBe(0);
    expect(result!.qualityKey).toBe('maj');
    expect(result!.bassPc).toBeUndefined();
  });

  it('parses "Am7" as A minor 7th', () => {
    const result = parseChordSymbol('Am7');
    expect(result).not.toBeNull();
    expect(result!.root).toBe(9);
    expect(result!.qualityKey).toBe('min7');
    expect(result!.bassPc).toBeUndefined();
  });

  it('parses "F#m" as F# minor', () => {
    const result = parseChordSymbol('F#m');
    expect(result).not.toBeNull();
    expect(result!.root).toBe(6);
    expect(result!.qualityKey).toBe('min');
  });
});

describe('parseChordSymbol — slash chords', () => {
  it('parses "Dm/F" → root D, bassPc 5 (F)', () => {
    const result = parseChordSymbol('Dm/F');
    expect(result).not.toBeNull();
    expect(result!.root).toBe(2);
    expect(result!.qualityKey).toBe('min');
    expect(result!.bassPc).toBe(5);
    expect(result!.bassName).toBeDefined();
    expect(result!.symbol).toContain('/');
  });

  it('parses "G7/B" → root G, bassPc 11 (B)', () => {
    const result = parseChordSymbol('G7/B');
    expect(result).not.toBeNull();
    expect(result!.root).toBe(7);
    expect(result!.qualityKey).toBe('7');
    expect(result!.bassPc).toBe(11);
    expect(result!.symbol).toContain('/B');
  });

  it('parses "Am7/G" → root A, bassPc 7 (G)', () => {
    const result = parseChordSymbol('Am7/G');
    expect(result).not.toBeNull();
    expect(result!.root).toBe(9);
    expect(result!.qualityKey).toBe('min7');
    expect(result!.bassPc).toBe(7);
  });

  it('parses "C/E" → root C, bassPc 4 (E)', () => {
    const result = parseChordSymbol('C/E');
    expect(result).not.toBeNull();
    expect(result!.root).toBe(0);
    expect(result!.qualityKey).toBe('maj');
    expect(result!.bassPc).toBe(4);
    expect(result!.symbol).toContain('/E');
  });

  it('parses "Bb/D" → root Bb, bassPc 2 (D)', () => {
    const result = parseChordSymbol('Bb/D');
    expect(result).not.toBeNull();
    expect(result!.root).toBe(10);
    expect(result!.bassPc).toBe(2);
  });

  it('slash-free chord has no bassPc', () => {
    const result = parseChordSymbol('Cmaj7');
    expect(result).not.toBeNull();
    expect(result!.bassPc).toBeUndefined();
    expect(result!.bassName).toBeUndefined();
    expect(result!.symbol).not.toContain('/');
  });
});

describe('parseChordSymbol — quality keys match dictionary', () => {
  it('parses "Dm7b5" → qualityKey m7b5 (half-diminished)', () => {
    const result = parseChordSymbol('Dm7b5');
    expect(result).not.toBeNull();
    expect(result!.root).toBe(2);
    expect(result!.qualityKey).toBe('m7b5');
  });

  it('parses "Dø" → qualityKey m7b5', () => {
    const result = parseChordSymbol('Dø');
    expect(result).not.toBeNull();
    expect(result!.qualityKey).toBe('m7b5');
  });

  it('parses "Cm6" → qualityKey m6', () => {
    const result = parseChordSymbol('Cm6');
    expect(result).not.toBeNull();
    expect(result!.qualityKey).toBe('m6');
  });
});

describe('isValidChordSymbol — slash chords', () => {
  it('"Dm/F" is valid', () => {
    expect(isValidChordSymbol('Dm/F')).toBe(true);
  });

  it('"C/E" is valid', () => {
    expect(isValidChordSymbol('C/E')).toBe(true);
  });

  it('"C/Z" is invalid (Z is not a note)', () => {
    expect(isValidChordSymbol('C/Z')).toBe(false);
  });
});

describe('getChordSuggestions — slash chords', () => {
  it('strips /Bass suffix for matching', () => {
    const suggestions = getChordSuggestions('Dm/F');
    // Should return suggestions for "Dm" quality, stripping the /F
    expect(suggestions.length).toBeGreaterThan(0);
  });

  it('returns suggestions without slash suffix', () => {
    const suggestions = getChordSuggestions('C');
    expect(suggestions.length).toBeGreaterThan(0);
  });
});
