import { describe, it, expect } from 'vitest';
import {
  detectChord,
  detectChordFromPcs,
} from './chordDetect.js';

// ─── Basic triads ──────────────────────────────────────────────────────

describe('detectChord — triads', () => {
  it('C major triad (C4, E4, G4)', () => {
    const match = detectChord([60, 64, 67]);
    expect(match).not.toBeNull();
    expect(match!.root).toBe(0); // C
    expect(match!.quality.key).toBe('maj');
    expect(match!.symbol).toBe('C');
  });

  it('C minor triad (C4, Eb4, G4)', () => {
    const match = detectChord([60, 63, 67]);
    expect(match).not.toBeNull();
    expect(match!.root).toBe(0);
    expect(match!.quality.key).toBe('min');
    expect(match!.symbol).toBe('C-');
  });

  it('D major triad (D4, F#4, A4)', () => {
    const match = detectChord([62, 66, 69]);
    expect(match).not.toBeNull();
    expect(match!.root).toBe(2); // D
    expect(match!.quality.key).toBe('maj');
  });

  it('F# minor triad (F#3, A3, C#4)', () => {
    const match = detectChord([54, 57, 61]);
    expect(match).not.toBeNull();
    expect(match!.root).toBe(6); // F#
    expect(match!.quality.key).toBe('min');
  });

  it('Bb diminished triad', () => {
    // Bb(10), Db(1), Fb=E(4)
    const match = detectChord([58, 61, 64]);
    expect(match).not.toBeNull();
    expect(match!.root).toBe(10); // Bb
    expect(match!.quality.key).toBe('dim');
  });

  it('C augmented triad (C, E, G#)', () => {
    const match = detectChord([60, 64, 68]);
    expect(match).not.toBeNull();
    expect(match!.quality.key).toBe('aug');
    // Augmented is symmetric so root detection may pick any of the 3
    // Just verify it found augmented
  });
});

// ─── Seventh chords ────────────────────────────────────────────────────

describe('detectChord — seventh chords', () => {
  it('C major seventh (C, E, G, B)', () => {
    const match = detectChord([60, 64, 67, 71]);
    expect(match).not.toBeNull();
    expect(match!.root).toBe(0);
    expect(match!.quality.key).toBe('maj7');
    expect(match!.symbol).toBe('C∆');
  });

  it('C minor seventh (C, Eb, G, Bb)', () => {
    const match = detectChord([60, 63, 67, 70]);
    expect(match).not.toBeNull();
    expect(match!.root).toBe(0);
    expect(match!.quality.key).toBe('min7');
    expect(match!.symbol).toBe('C-7');
  });

  it('G dominant seventh (G, B, D, F)', () => {
    const match = detectChord([55, 59, 62, 65]);
    expect(match).not.toBeNull();
    expect(match!.root).toBe(7); // G
    expect(match!.quality.key).toBe('7');
  });

  it('C half-diminished (C, Eb, Gb, Bb)', () => {
    const match = detectChord([60, 63, 66, 70]);
    expect(match).not.toBeNull();
    expect(match!.root).toBe(0);
    expect(match!.quality.key).toBe('m7b5');
    expect(match!.quality.displayName).toBe('ø');
  });

  it('C diminished seventh (C, Eb, Gb, Bbb=A)', () => {
    const match = detectChord([60, 63, 66, 69]);
    expect(match).not.toBeNull();
    // Diminished 7th is symmetric (every 3 semitones)
    expect(match!.quality.key).toBe('dim7');
  });

  it('C minor-major seventh (C, Eb, G, B)', () => {
    const match = detectChord([60, 63, 67, 71]);
    expect(match).not.toBeNull();
    expect(match!.root).toBe(0);
    expect(match!.quality.key).toBe('minMaj7');
  });
});

// ─── Extended chords ───────────────────────────────────────────────────

describe('detectChord — extended chords', () => {
  it('C dominant ninth (C, E, G, Bb, D)', () => {
    const match = detectChord([60, 64, 67, 70, 74]);
    expect(match).not.toBeNull();
    expect(match!.root).toBe(0);
    expect(match!.quality.key).toBe('9');
  });

  it('C major ninth (C, E, G, B, D)', () => {
    const match = detectChord([60, 64, 67, 71, 74]);
    expect(match).not.toBeNull();
    expect(match!.root).toBe(0);
    expect(match!.quality.key).toBe('maj9');
  });

  it('C7b9 (C, E, G, Bb, Db)', () => {
    const match = detectChord([60, 64, 67, 70, 73]);
    expect(match).not.toBeNull();
    expect(match!.root).toBe(0);
    expect(match!.quality.key).toBe('7b9');
  });

  it('C7#9 (C, E, G, Bb, D#)', () => {
    const match = detectChord([60, 64, 67, 70, 75]);
    expect(match).not.toBeNull();
    expect(match!.root).toBe(0);
    expect(match!.quality.key).toBe('7#9');
  });
});

// ─── Suspended chords ──────────────────────────────────────────────────

describe('detectChord — suspended', () => {
  it('C sus4 (C, F, G)', () => {
    const match = detectChord([60, 65, 67]);
    expect(match).not.toBeNull();
    expect(match!.root).toBe(0);
    expect(match!.quality.key).toBe('sus4');
  });

  it('C sus2 (C, D, G)', () => {
    const match = detectChord([60, 62, 67]);
    expect(match).not.toBeNull();
    expect(match!.root).toBe(0);
    expect(match!.quality.key).toBe('sus2');
  });

  it('C7sus4 (C, F, G, Bb)', () => {
    const match = detectChord([60, 65, 67, 70]);
    expect(match).not.toBeNull();
    expect(match!.root).toBe(0);
    expect(match!.quality.key).toBe('7sus4');
  });
});

// ─── Octave doublings and inversions ───────────────────────────────────

describe('detectChord — voicings', () => {
  it('handles octave doublings', () => {
    // C major with doubled C and G
    const match = detectChord([48, 60, 64, 67, 72]);
    expect(match).not.toBeNull();
    expect(match!.root).toBe(0);
    expect(match!.quality.key).toBe('maj');
  });

  it('handles first inversion', () => {
    // C major, first inversion: E, G, C
    const match = detectChord([64, 67, 72]);
    expect(match).not.toBeNull();
    expect(match!.quality.key).toBe('maj');
    // Root should still be C
    expect(match!.root).toBe(0);
  });

  it('handles second inversion', () => {
    // C major, second inversion: G, C, E
    const match = detectChord([55, 60, 64]);
    expect(match).not.toBeNull();
    expect(match!.quality.key).toBe('maj');
    expect(match!.root).toBe(0);
  });

  it('handles wide voicings across octaves', () => {
    // C minor 7th: C2, Bb3, Eb4, G4
    const match = detectChord([36, 58, 63, 67]);
    expect(match).not.toBeNull();
    expect(match!.root).toBe(0);
    expect(match!.quality.key).toBe('min7');
  });
});

// ─── Edge cases ────────────────────────────────────────────────────────

describe('detectChord — edge cases', () => {
  it('returns null for empty input', () => {
    expect(detectChord([])).toBeNull();
  });

  it('returns null for single note', () => {
    expect(detectChord([60])).toBeNull();
  });

  it('handles fifth (power chord)', () => {
    const match = detectChord([60, 67]);
    expect(match).not.toBeNull();
    expect(match!.quality.key).toBe('5');
  });

  it('negative MIDI values are handled gracefully', () => {
    // Should not crash
    const match = detectChord([-1, 60, 64]);
    // Just verify it doesn't throw
    expect(match === null || match !== null).toBe(true);
  });
});

// ─── detectChordFromPcs ────────────────────────────────────────────────

describe('detectChordFromPcs', () => {
  it('C major from pitch classes [0, 4, 7]', () => {
    const match = detectChordFromPcs([0, 4, 7]);
    expect(match).not.toBeNull();
    expect(match!.root).toBe(0);
    expect(match!.quality.key).toBe('maj');
  });

  it('F minor from pitch classes [5, 8, 0]', () => {
    const match = detectChordFromPcs([5, 8, 0]);
    expect(match).not.toBeNull();
    expect(match!.root).toBe(5); // F
    expect(match!.quality.key).toBe('min');
  });
});


