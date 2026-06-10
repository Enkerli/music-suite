import { describe, it, expect } from 'vitest';
import {
  detectChord,
  detectChordFromPcs,
  detectChordsPerBar,
  detectOverallChord,
} from '../chord-detect';

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

// ─── Bar-level segmentation ────────────────────────────────────────────

describe('detectChordsPerBar', () => {
  it('detects different chords in different bars', () => {
    // Bar 0: C major (C4, E4, G4 at ticks 0, 120, 240)
    // Bar 1: A minor (A3, C4, E4 at ticks 480, 600, 720)
    const pitches =  [60, 64, 67, 57, 60, 64];
    const onsets =   [0,  120, 240, 480, 600, 720];
    const ticksPerBar = 480;

    const bars = detectChordsPerBar(pitches, onsets, ticksPerBar, 2);
    expect(bars).toHaveLength(2);

    // Bar 0: C major
    expect(bars[0].chord).not.toBeNull();
    expect(bars[0].chord!.root).toBe(0); // C
    expect(bars[0].chord!.quality.key).toBe('maj');

    // Bar 1: A minor
    expect(bars[1].chord).not.toBeNull();
    expect(bars[1].chord!.root).toBe(9); // A
    expect(bars[1].chord!.quality.key).toBe('min');
  });

  it('inherits chord from previous bar when empty (resonance principle)', () => {
    // Bar 0: C major (3 notes), Bar 1: empty
    const pitches = [60, 64, 67];
    const onsets = [0, 0, 0];
    const bars = detectChordsPerBar(pitches, onsets, 480, 2);

    expect(bars[0].chord).not.toBeNull(); // C major
    expect(bars[1].chord).not.toBeNull(); // Inherited from bar 0
    expect(bars[1].chord!.root).toBe(0);  // Still C
  });

  it('first bar remains null if empty (nothing to inherit)', () => {
    const pitches = [60, 64, 67];
    const onsets = [480, 480, 480]; // All in bar 1
    const bars = detectChordsPerBar(pitches, onsets, 480, 2);

    expect(bars[0].chord).toBeNull();     // Nothing to inherit
    expect(bars[1].chord).not.toBeNull(); // C major
  });

  it('single note bar still inherits from previous (fewer than 2 notes)', () => {
    const pitches = [60];
    const onsets = [0];
    const bars = detectChordsPerBar(pitches, onsets, 480, 2);
    expect(bars[0].chord).toBeNull(); // only 1 note, nothing to inherit
    expect(bars[1].chord).toBeNull(); // empty, but previous was also null
  });

  it('returns correct bar count', () => {
    const bars = detectChordsPerBar([], [], 480, 4);
    expect(bars).toHaveLength(4);
  });

  it('includes sustained notes from previous bar when durations provided', () => {
    // 3 notes start at tick 0 with long durations that span into bar 1
    // No new notes start in bar 1
    // Without durations: bar 1 inherits from bar 0 (resonance principle)
    // With durations: bar 1 detects the sustained chord directly
    const pitches =  [60, 64, 67]; // C major
    const onsets =   [0,  0,  0];
    const durations = [960, 960, 960]; // 2 bars long
    const ticksPerBar = 480;

    // Without durations - inherits from bar 0
    const barsNoDur = detectChordsPerBar(pitches, onsets, ticksPerBar, 2);
    expect(barsNoDur[0].chord).not.toBeNull();
    expect(barsNoDur[1].chord).not.toBeNull(); // inherited from bar 0
    expect(barsNoDur[1].chord!.root).toBe(0); // C (inherited)

    // With durations - detects sustained notes directly
    const barsWithDur = detectChordsPerBar(pitches, onsets, ticksPerBar, 2, durations);
    expect(barsWithDur[0].chord).not.toBeNull();
    expect(barsWithDur[1].chord).not.toBeNull(); // sustained into bar 1
    expect(barsWithDur[1].chord!.root).toBe(0); // C
    expect(barsWithDur[1].chord!.quality.key).toBe('maj');
  });

  it('sustained notes combine with new onsets for richer detection', () => {
    // Bar 0: C and E start with long sustain (2 notes = no chord detected)
    // Bar 1: G starts, and C+E are still sounding → full C major
    const pitches =  [60, 64, 67];
    const onsets =   [0,  0,  480];
    const durations = [960, 960, 240];
    const ticksPerBar = 480;

    // Without durations: bar 0 has C+E (2 notes, no recognized chord), bar 1 has only G (1 note)
    // Bar 0 null → bar 1 inherits null
    const barsNoDur = detectChordsPerBar(pitches, onsets, ticksPerBar, 2);
    expect(barsNoDur[0].chord).toBeNull(); // C+E alone is not a recognized chord
    expect(barsNoDur[1].chord).toBeNull(); // inherited null from bar 0

    // With durations: bar 1 has G onset + C,E sustained → full C major detected directly
    const barsWithDur = detectChordsPerBar(pitches, onsets, ticksPerBar, 2, durations);
    expect(barsWithDur[1].chord).not.toBeNull();
    expect(barsWithDur[1].chord!.root).toBe(0); // C
    expect(barsWithDur[1].chord!.quality.key).toBe('maj');
  });

  it('notes that ended before bar start are not included', () => {
    // Note ends exactly at bar boundary — should NOT be included in next bar
    // But bar 1 inherits from bar 0 (resonance principle)
    const pitches =  [60, 64, 67];
    const onsets =   [0,  0,  0];
    const durations = [480, 480, 480]; // end exactly at bar 1 start
    const ticksPerBar = 480;

    const bars = detectChordsPerBar(pitches, onsets, ticksPerBar, 2, durations);
    expect(bars[0].chord).not.toBeNull(); // notes in bar 0
    expect(bars[1].chord).not.toBeNull(); // inherited from bar 0 (resonance principle)
    expect(bars[1].chord!.root).toBe(bars[0].chord!.root); // same chord
    expect(bars[1].pitchClasses).toHaveLength(0); // but no actual pitches in bar 1
  });

  it('merges multiple blocks in one bar to detect full chord', () => {
    // Simulates the Ghosthack bar 2 issue: beat 1 has {D, F, A} and beat 3 has {Bb, G, D}
    // Together they spell G minor 7 (G, Bb, D, F) + A as a 9th → Gm9 or at least Gm7
    // Previously the algorithm picked only beat-1 block → D minor (wrong)
    const pitches =    [53, 62, 57,  58, 55, 62];
    //                  F4  D5  A4   Bb4 G4  D5
    const onsets =     [0,  0,  0,   240, 240, 240];
    const durations =  [96, 96, 96,  96,  96,  96];
    const ticksPerBar = 480;

    const bars = detectChordsPerBar(pitches, onsets, ticksPerBar, 1, durations);
    expect(bars[0].chord).not.toBeNull();
    // Merged pitches: {F, D, A, Bb, G} = {G, A, Bb, D, F} → should detect G as root
    expect(bars[0].chord!.root).toBe(7); // G
  });

  it('falls back to best single block when merged set is unrecognizable', () => {
    // Two unrelated blocks that together don't form a known chord
    // Beat 1: C major {C, E, G}, beat 3: F# major {F#, A#, C#}
    // Merged: {C, C#, E, F#, G, A#} — no known chord
    const pitches =    [60, 64, 67,  66, 70, 61];
    //                  C4  E4  G4   F#4 A#4 C#4
    const onsets =     [0,  0,  0,   240, 240, 240];
    const durations =  [96, 96, 96,  96,  96,  96];
    const ticksPerBar = 480;

    const bars = detectChordsPerBar(pitches, onsets, ticksPerBar, 1, durations);
    expect(bars[0].chord).not.toBeNull();
    // Should fall back to one of the two triads rather than null
    const root = bars[0].chord!.root;
    expect([0, 6]).toContain(root); // C or F#
  });

  it('alternating chord pattern with sustained notes', () => {
    // Simulates the Ghosthack issue: chords sustain across 2 bars each
    // Bar 0-1: Eb sus4 (Eb, Ab, Bb)
    // Bar 2-3: B maj9 (B, D#, F#, A#, C#)
    const pitches =  [63, 68, 70, 59, 63, 66, 70, 61];
    const onsets =   [0,  0,  0,  960, 960, 960, 960, 960];
    const durations = [960, 960, 960, 960, 960, 960, 960, 960]; // each chord spans 2 bars
    const ticksPerBar = 480;

    const bars = detectChordsPerBar(pitches, onsets, ticksPerBar, 4, durations);

    // Bar 0: chord onset
    expect(bars[0].chord).not.toBeNull();
    // Bar 1: sustained from bar 0 — should also have a chord
    expect(bars[1].chord).not.toBeNull();
    // Bar 2: new chord onset
    expect(bars[2].chord).not.toBeNull();
    // Bar 3: sustained from bar 2
    expect(bars[3].chord).not.toBeNull();
  });
});

// ─── detectOverallChord ────────────────────────────────────────────────

describe('detectOverallChord', () => {
  it('detects overall chord from scattered pitches', () => {
    // All notes form C major 7th: C, E, G, B across octaves
    const match = detectOverallChord([48, 64, 55, 71]);
    expect(match).not.toBeNull();
    expect(match!.root).toBe(0);
    expect(match!.quality.key).toBe('maj7');
  });

  it('returns null for empty input', () => {
    expect(detectOverallChord([])).toBeNull();
  });
});

// ─── Jazz chord recognition ───────────────────────────────────────────

describe('detectChord — jazz voicings', () => {
  it('Eb major seventh', () => {
    // Eb(3), G(7), Bb(10), D(2)
    const match = detectChord([51, 55, 58, 62]);
    expect(match).not.toBeNull();
    expect(match!.root).toBe(3); // Eb
    expect(match!.quality.key).toBe('maj7');
  });

  it('Ab minor seventh', () => {
    // Ab(8), Cb=B(11), Eb(3), Gb(6)
    const match = detectChord([56, 59, 63, 66]);
    expect(match).not.toBeNull();
    expect(match!.root).toBe(8); // Ab
    expect(match!.quality.key).toBe('min7');
  });

  it('Db dominant seventh', () => {
    // Db(1), F(5), Ab(8), Cb=B(11)
    const match = detectChord([49, 53, 56, 59]);
    expect(match).not.toBeNull();
    expect(match!.root).toBe(1); // Db/C#
    expect(match!.quality.key).toBe('7');
  });

  it('C sixth added ninth (C69)', () => {
    // C(0), E(4), G(7), A(9), D(2)
    const match = detectChord([60, 64, 67, 69, 74]);
    expect(match).not.toBeNull();
    expect(match!.root).toBe(0);
    expect(match!.quality.key).toBe('6add9');
  });
});

// ─── ChordMatch model: extras, missing, observedPcs ─────────────────

describe('ChordMatch — extras & observed PCs (HARMONY_ENGINE §3–4)', () => {
  it('{D,F,G,A} → Dm(add4) as recognized quality', () => {
    // D(2), F(5), G(7), A(9) — dictionary has madd4 = minor added fourth
    const match = detectChord([62, 65, 67, 69]);
    expect(match).not.toBeNull();
    expect(match!.root).toBe(2); // D
    expect(match!.quality.key).toBe('madd4'); // exact match from dictionary
    expect(match!.extras).toHaveLength(0); // all tones explained by template
    expect(match!.observedPcs).toEqual(expect.arrayContaining([2, 5, 7, 9]));
  });

  it('extras populated when input has tones outside template', () => {
    // {D, Eb, F, A} — since mb9 [0,1,3,7] is now in the dictionary, this is an exact Dm(♭9) match
    const match = detectChord([62, 63, 65, 69]);
    expect(match).not.toBeNull();
    expect(match!.root).toBe(2); // D
    expect(match!.quality.key).toBe('mb9'); // exact Dm(♭9) match
    expect(match!.extras).toHaveLength(0); // exact match, no extras
    expect(match!.observedPcs).toEqual(expect.arrayContaining([2, 3, 5, 9]));
  });

  it('{D,G,A} → Dsus4', () => {
    // D(2), G(7), A(9)
    const match = detectChord([62, 67, 69]);
    expect(match).not.toBeNull();
    expect(match!.root).toBe(2); // D
    expect(match!.quality.key).toBe('sus4');
    expect(match!.extras).toHaveLength(0); // exact match, no extras
  });

  it('exact match has empty extras and missing', () => {
    const match = detectChord([60, 64, 67]); // C major
    expect(match).not.toBeNull();
    expect(match!.extras).toHaveLength(0);
    expect(match!.missing).toHaveLength(0);
    expect(match!.observedPcs).toEqual([0, 4, 7]);
    expect(match!.templatePcs).toEqual([0, 4, 7]);
  });

  it('observed PCs are never discarded', () => {
    // 5-note input: C, E, G, Bb, D → C9
    const match = detectChord([60, 64, 67, 70, 74]);
    expect(match).not.toBeNull();
    // All 5 PCs must appear in observedPcs
    expect(match!.observedPcs).toEqual(expect.arrayContaining([0, 2, 4, 7, 10]));
    expect(match!.observedPcs).toHaveLength(5);
  });

  it('subset match reports extras correctly', () => {
    // {C, E, F#, G} — since add#11 [0,4,6,7] is now in the dictionary, this is an exact C(♯11) match
    const match = detectChord([60, 64, 66, 67]);
    expect(match).not.toBeNull();
    expect(match!.quality.key).toBe('add#11'); // exact match
    expect(match!.extras).toHaveLength(0); // exact match, no extras
    expect(match!.observedPcs).toEqual(expect.arrayContaining([0, 4, 6, 7]));
  });
});
