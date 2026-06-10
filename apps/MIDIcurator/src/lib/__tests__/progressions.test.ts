import { describe, it, expect } from 'vitest';
import { PROGRESSIONS, transposeProgression } from '../progressions';

/** Helper: extract chord labels from a transposed progression. */
function labels(progIndex: number, semitones: number): string[] {
  const transposed = transposeProgression(PROGRESSIONS[progIndex]!, semitones);
  return transposed.chords.map(c => c.label);
}

describe('transposeProgression — enharmonic spelling', () => {
  // Jazz ii-V-I is PROGRESSIONS[1]: Dm7 | G7 | Cmaj7 | Cmaj7

  it('Jazz ii-V-I in D♭ (+1): all flats', () => {
    const l = labels(1, 1);
    expect(l[0]).toBe('E♭m7');
    expect(l[1]).toBe('A♭7');
    expect(l[2]).toBe('D♭maj7');
  });

  it('Jazz ii-V-I in F♯ (+6): all sharps', () => {
    const l = labels(1, 6);
    expect(l[0]).toBe('G♯m7');
    expect(l[1]).toBe('C♯7');
    expect(l[2]).toBe('F♯maj7');
  });

  it('Jazz ii-V-I in B (+11): sharps', () => {
    const l = labels(1, 11);
    expect(l[0]).toBe('C♯m7');
    expect(l[1]).toBe('F♯7');
    expect(l[2]).toBe('Bmaj7');
  });

  it('Jazz ii-V-I in A♭ (+8): flats', () => {
    const l = labels(1, 8);
    expect(l[0]).toBe('B♭m7');
    expect(l[1]).toBe('E♭7');
    expect(l[2]).toBe('A♭maj7');
  });

  it('Jazz ii-V-I in E (+4): sharps', () => {
    const l = labels(1, 4);
    expect(l[0]).toBe('F♯m7');
    expect(l[1]).toBe('B7');
    expect(l[2]).toBe('Emaj7');
  });

  // Four Chords is PROGRESSIONS[0]: C | G | Am | F

  it('Four Chords in E (+4): sharps', () => {
    const l = labels(0, 4);
    expect(l[0]).toBe('E');
    expect(l[1]).toBe('B');
    expect(l[2]).toBe('C♯m');
    expect(l[3]).toBe('A');
  });

  it('Four Chords in E♭ (+3): flats', () => {
    const l = labels(0, 3);
    expect(l[0]).toBe('E♭');
    expect(l[1]).toBe('B♭');
    expect(l[2]).toBe('Cm');
    expect(l[3]).toBe('A♭');
  });

  it('Four Chords in A (+9): sharps', () => {
    const l = labels(0, 9);
    expect(l[0]).toBe('A');
    expect(l[1]).toBe('E');
    expect(l[2]).toBe('F♯m');
    expect(l[3]).toBe('D');
  });

  it('Four Chords in B♭ (+10): flats', () => {
    const l = labels(0, 10);
    expect(l[0]).toBe('B♭');
    expect(l[1]).toBe('F');
    expect(l[2]).toBe('Gm');
    expect(l[3]).toBe('E♭');
  });
});

describe('transposeProgression — leadsheet text', () => {
  it('Jazz ii-V-I in F♯ leadsheet uses sharps', () => {
    const prog = transposeProgression(PROGRESSIONS[1]!, 6);
    expect(prog.leadsheet).toBe('G♯m7 | C♯7 | F♯maj7 | %');
  });

  it('Jazz ii-V-I in D♭ leadsheet uses flats', () => {
    const prog = transposeProgression(PROGRESSIONS[1]!, 1);
    expect(prog.leadsheet).toBe('E♭m7 | A♭7 | D♭maj7 | %');
  });
});

describe('transposeProgression — identity', () => {
  it('transposing by 0 returns original', () => {
    const original = PROGRESSIONS[0]!;
    const result = transposeProgression(original, 0);
    expect(result).toBe(original); // Same reference
  });

  it('transposing by 12 returns equivalent labels', () => {
    const result = transposeProgression(PROGRESSIONS[0]!, 12);
    // Labels should be identical to original (C major → C major, one octave up)
    expect(result.chords.map(c => c.label)).toEqual(
      PROGRESSIONS[0]!.chords.map(c => c.label),
    );
  });
});

describe('transposeProgression — slash chord labels', () => {
  it('transposes slash chord labels correctly', () => {
    const prog = {
      name: 'Slash Test',
      chords: [
        { root: 60, intervals: [0, 4, 7], label: 'C/E' },
        { root: 55, intervals: [0, 4, 7], label: 'G/B' },
        { root: 53, intervals: [0, 4, 7], label: 'F/A' },
      ],
      leadsheet: 'C/E | G/B | F/A',
    };

    // Transpose up by 2 semitones (C → D)
    const transposed = transposeProgression(prog, 2);
    expect(transposed.chords[0]!.label).toBe('D/F♯');
    expect(transposed.chords[1]!.label).toBe('A/C♯');
    expect(transposed.chords[2]!.label).toBe('G/B');
  });

  it('transposes slash chord to flat keys', () => {
    const prog = {
      name: 'Slash Flat Test',
      chords: [
        { root: 60, intervals: [0, 3, 7], label: 'Cm/Eb' },
      ],
      leadsheet: 'Cm/Eb',
    };

    // Transpose up by 1 semitone (→ Db)
    const transposed = transposeProgression(prog, 1);
    expect(transposed.chords[0]!.label).toBe('D♭m/E');
  });

  it('labels without slash are unaffected', () => {
    const prog = {
      name: 'No Slash',
      chords: [
        { root: 60, intervals: [0, 4, 7], label: 'C' },
      ],
      leadsheet: 'C',
    };

    const transposed = transposeProgression(prog, 5);
    expect(transposed.chords[0]!.label).toBe('F');
    expect(transposed.chords[0]!.label).not.toContain('/');
  });
});

describe('transposeProgression — re-parse Unicode labels', () => {
  it('labels with Unicode accidentals survive re-parsing by parseLabelRoot', () => {
    // Transpose to F♯ (+6), producing Unicode sharp labels
    const toFSharp = transposeProgression(PROGRESSIONS[1]!, 6);
    expect(toFSharp.chords[0]!.label).toBe('G♯m7');

    // Transpose the F♯ version by +6 more → C (targetKeyPc = 0 from the offset)
    // Note: transposeProgression uses semitones for targetKeyPc, so +6 from F♯-key
    // content means targetKeyPc = 6 (F♯ again). This is a known limitation:
    // the function assumes transposition from C. For chained transpositions,
    // the key context may be wrong. What we verify here is that the Unicode
    // labels (G♯, C♯, F♯) are correctly re-parsed and the MIDI roots are correct.
    const further = transposeProgression(toFSharp, 6);
    // MIDI roots should be correct regardless of spelling:
    // G♯m7 root=68(G♯4) +6 = 74(D5) — root PC should be 2
    expect(further.chords[0]!.root).toBe(74);
    expect(further.chords[1]!.root).toBe(67); // C♯ was 61+6=67
    expect(further.chords[2]!.root).toBe(72); // F♯ was 66+6=72
  });
});
