import { describe, it, expect } from 'vitest';
import { detectChord, detectChordFromPcs } from '../chord-detect';

describe('detectChord — slash chords (inversions)', () => {
  it('first inversion C major [E3, C4, G4] → C/E', () => {
    const match = detectChord([52, 60, 67]);
    expect(match).not.toBeNull();
    expect(match!.root).toBe(0); // C
    expect(match!.quality.key).toBe('maj');
    expect(match!.bassPc).toBe(4); // E
    expect(match!.bassName).toBe('E');
    expect(match!.symbol).toBe('C/E');
  });

  it('second inversion C major [G3, C4, E4] → C/G', () => {
    const match = detectChord([55, 60, 64]);
    expect(match).not.toBeNull();
    expect(match!.root).toBe(0);
    expect(match!.quality.key).toBe('maj');
    expect(match!.bassPc).toBe(7); // G
    expect(match!.bassName).toBe('G');
    expect(match!.symbol).toBe('C/G');
  });

  it('root position C major [C4, E4, G4] → no slash', () => {
    const match = detectChord([60, 64, 67]);
    expect(match).not.toBeNull();
    expect(match!.root).toBe(0);
    expect(match!.quality.key).toBe('maj');
    expect(match!.bassPc).toBeUndefined();
    expect(match!.bassName).toBeUndefined();
    expect(match!.symbol).toBe('C');
  });

  it('non-chord-tone bass [F#3, C4, E4, G4] → C(♯11)/F# (F# is ♯11 of add#11)', () => {
    // F#3 = MIDI 54 — {C, E, F#, G} = [0,4,6,7] now matches add#11 exactly;
    // F# is interval 6 (♯11), a chord tone → slash chord produced
    const match = detectChord([54, 60, 64, 67]);
    expect(match).not.toBeNull();
    expect(match!.root).toBe(0); // C
    expect(match!.quality.key).toBe('add#11'); // exact match
    expect(match!.bassPc).toBe(6); // F# is ♯11 chord tone → slash
    expect(match!.symbol).toContain('/F');
  });

  it('dominant 7th first inversion [E3, G3, Bb3, C4] → C7/E', () => {
    const match = detectChord([52, 55, 58, 60]);
    expect(match).not.toBeNull();
    expect(match!.root).toBe(0); // C
    expect(match!.quality.key).toBe('7');
    expect(match!.bassPc).toBe(4); // E
    expect(match!.symbol).toContain('/E');
  });

  it('dominant 7th third inversion [Bb2, C4, E4, G4] → C7/B♭', () => {
    const match = detectChord([46, 60, 64, 67]);
    expect(match).not.toBeNull();
    expect(match!.root).toBe(0); // C
    expect(match!.quality.key).toBe('7');
    expect(match!.bassPc).toBe(10); // Bb
    expect(match!.symbol).toContain('/B♭');
  });

  it('wide voicing Dm first inversion [F2, D4, A4] → D-/F', () => {
    // F2 = MIDI 41, D4 = 62, A4 = 69
    const match = detectChord([41, 62, 69]);
    expect(match).not.toBeNull();
    expect(match!.root).toBe(2); // D
    expect(match!.quality.key).toBe('min');
    expect(match!.bassPc).toBe(5); // F
    expect(match!.bassName).toBe('F');
    expect(match!.symbol).toBe('D-/F');
  });

  it('Am/C — first inversion Am [C3, E3, A3]', () => {
    const match = detectChord([48, 52, 57]);
    expect(match).not.toBeNull();
    expect(match!.root).toBe(9); // A
    expect(match!.bassPc).toBe(0); // C
    expect(match!.symbol).toContain('/C');
  });

  it('Am/E — second inversion Am [E2, A3, C4]', () => {
    const match = detectChord([40, 57, 60]);
    expect(match).not.toBeNull();
    expect(match!.root).toBe(9); // A
    expect(match!.bassPc).toBe(4); // E
    expect(match!.symbol).toContain('/E');
  });
});

describe('detectChordFromPcs — no slash chords', () => {
  it('pitch-class-only detection never produces slash chords', () => {
    // E, C, G pitch classes — could be "C/E" with register info, but PC-only = no slash
    const match = detectChordFromPcs([4, 0, 7]);
    expect(match).not.toBeNull();
    expect(match!.root).toBe(0); // C
    expect(match!.quality.key).toBe('maj');
    expect(match!.bassPc).toBeUndefined();
    expect(match!.bassName).toBeUndefined();
    // Symbol should not have a slash
    expect(match!.symbol).not.toContain('/');
  });

  it('Dm pitch classes [2, 5, 9] → no slash', () => {
    const match = detectChordFromPcs([2, 5, 9]);
    expect(match).not.toBeNull();
    expect(match!.root).toBe(2);
    expect(match!.bassPc).toBeUndefined();
    expect(match!.symbol).not.toContain('/');
  });
});
