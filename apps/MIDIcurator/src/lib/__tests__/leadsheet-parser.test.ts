import { describe, it, expect } from 'vitest';
import { parseLeadsheet, serializeLeadsheet } from '../leadsheet-parser';

describe('parseLeadsheet', () => {
  it('parses basic single-chord bars', () => {
    const ls = parseLeadsheet('Cm7 | Fm7 | G7 | Cm7', 4);
    expect(ls.bars).toHaveLength(4);
    expect(ls.bars[0]!.chords).toHaveLength(1);
    expect(ls.bars[0]!.chords[0]!.chord?.rootName).toBe('C');
    expect(ls.bars[0]!.chords[0]!.chord?.qualityKey).toBe('min7');
    expect(ls.bars[1]!.chords[0]!.chord?.rootName).toBe('F');
    expect(ls.bars[2]!.chords[0]!.chord?.qualityKey).toBe('7');
    expect(ls.bars[3]!.chords[0]!.chord?.rootName).toBe('C');
  });

  it('parses multi-chord bars', () => {
    const ls = parseLeadsheet('Am7 D7 | Gmaj7', 2);
    expect(ls.bars[0]!.chords).toHaveLength(2);
    expect(ls.bars[0]!.chords[0]!.chord?.rootName).toBe('A');
    expect(ls.bars[0]!.chords[0]!.totalInBar).toBe(2);
    expect(ls.bars[0]!.chords[1]!.chord?.rootName).toBe('D');
    expect(ls.bars[0]!.chords[1]!.position).toBe(1);
    expect(ls.bars[1]!.chords).toHaveLength(1);
    expect(ls.bars[1]!.chords[0]!.chord?.qualityKey).toBe('maj7');
  });

  it('handles repeat (%) token', () => {
    const ls = parseLeadsheet('Fm7 | % | Bbm7 | %', 4);
    expect(ls.bars[0]!.isRepeat).toBe(false);
    expect(ls.bars[1]!.isRepeat).toBe(true);
    expect(ls.bars[1]!.chords[0]!.chord?.rootName).toBe('F');
    expect(ls.bars[2]!.isRepeat).toBe(false);
    expect(ls.bars[3]!.isRepeat).toBe(true);
    expect(ls.bars[3]!.chords[0]!.chord?.symbol).toBe(ls.bars[2]!.chords[0]!.chord?.symbol);
  });

  it('handles NC token', () => {
    const ls = parseLeadsheet('Cm7 | NC | Fm7', 3);
    expect(ls.bars[1]!.chords).toHaveLength(1);
    expect(ls.bars[1]!.chords[0]!.chord).toBeNull();
    expect(ls.bars[1]!.isRepeat).toBe(false);
  });

  it('treats empty bars as NC', () => {
    const ls = parseLeadsheet('Cm7 | | Fm7', 3);
    expect(ls.bars[1]!.chords[0]!.chord).toBeNull();
  });

  it('ignores trailing pipe', () => {
    const ls = parseLeadsheet('Cm7 | Fm7 |', 2);
    expect(ls.bars).toHaveLength(2);
    expect(ls.bars[0]!.chords[0]!.chord?.rootName).toBe('C');
    expect(ls.bars[1]!.chords[0]!.chord?.rootName).toBe('F');
  });

  it('ignores leading pipe', () => {
    const ls = parseLeadsheet('| Cm7 | Fm7', 2);
    expect(ls.bars).toHaveLength(2);
    expect(ls.bars[0]!.chords[0]!.chord?.rootName).toBe('C');
    expect(ls.bars[1]!.chords[0]!.chord?.rootName).toBe('F');
  });

  it('truncates bars beyond numBars', () => {
    const ls = parseLeadsheet('C | D | E | F | G | A', 4);
    expect(ls.bars).toHaveLength(4);
    expect(ls.bars[3]!.chords[0]!.chord?.rootName).toBe('F');
  });

  it('auto-fills missing bars as repeats (chord resonance)', () => {
    // Bars beyond the supplied tokens inherit the previous bar via isRepeat,
    // so the chord carries forward rather than becoming NC.
    const ls = parseLeadsheet('Cm7 | Fm7', 4);
    expect(ls.bars).toHaveLength(4);
    expect(ls.bars[0]!.chords[0]!.chord?.rootName).toBe('C');
    expect(ls.bars[1]!.chords[0]!.chord?.rootName).toBe('F');
    // Bars 2 and 3 are auto-filled repeats of bar 1 (Fm7)
    expect(ls.bars[2]!.isRepeat).toBe(true);
    expect(ls.bars[2]!.chords[0]!.chord?.rootName).toBe('F');
    expect(ls.bars[3]!.isRepeat).toBe(true);
    expect(ls.bars[3]!.chords[0]!.chord?.rootName).toBe('F');
  });

  it('preserves invalid chord inputText with null chord', () => {
    const ls = parseLeadsheet('Cm7 | Xyz | Fm7', 3);
    expect(ls.bars[1]!.chords[0]!.chord).toBeNull();
    expect(ls.bars[1]!.chords[0]!.inputText).toBe('Xyz');
  });

  it('handles dash as repeat (synonym for %)', () => {
    const ls = parseLeadsheet('Cm7 | -', 2);
    expect(ls.bars[1]!.isRepeat).toBe(true);
    expect(ls.bars[1]!.chords[0]!.chord?.rootName).toBe('C');
  });

  it('handles case-insensitive NC', () => {
    const ls = parseLeadsheet('Cm7 | nc | Fm7', 3);
    expect(ls.bars[1]!.chords[0]!.chord).toBeNull();
  });

  it('assigns correct bar indices', () => {
    const ls = parseLeadsheet('Am | Bm | Cm | Dm', 4);
    expect(ls.bars[0]!.bar).toBe(0);
    expect(ls.bars[1]!.bar).toBe(1);
    expect(ls.bars[2]!.bar).toBe(2);
    expect(ls.bars[3]!.bar).toBe(3);
  });

  it('stores the original input text', () => {
    const input = 'Fm7 | Am7 D7 | Bbm7';
    const ls = parseLeadsheet(input, 3);
    expect(ls.inputText).toBe(input);
  });

  it('handles repeat with no previous bar', () => {
    const ls = parseLeadsheet('% | Cm7', 2);
    expect(ls.bars[0]!.isRepeat).toBe(true);
    expect(ls.bars[0]!.chords).toHaveLength(0);
  });
});

describe('serializeLeadsheet', () => {
  it('round-trips basic input', () => {
    const input = 'Cm7 | Fm7 | G7 | Cm7';
    const ls = parseLeadsheet(input, 4);
    const output = serializeLeadsheet(ls);
    expect(output).toBe('Cm7 | Fm7 | G7 | Cm7');
  });

  it('round-trips multi-chord bars', () => {
    const input = 'Am7 D7 | Gmaj7';
    const ls = parseLeadsheet(input, 2);
    const output = serializeLeadsheet(ls);
    expect(output).toBe('Am7 D7 | Gmaj7');
  });

  it('round-trips repeats', () => {
    const input = 'Fm7 | % | Bbm7 | %';
    const ls = parseLeadsheet(input, 4);
    const output = serializeLeadsheet(ls);
    expect(output).toBe('Fm7 | % | Bbm7 | %');
  });

  it('round-trips NC bars', () => {
    const input = 'Cm7 | NC | Fm7';
    const ls = parseLeadsheet(input, 3);
    const output = serializeLeadsheet(ls);
    expect(output).toBe('Cm7 | NC | Fm7');
  });

  it('serializes invalid chords using original inputText', () => {
    const input = 'Cm7 | Xyz | Fm7';
    const ls = parseLeadsheet(input, 3);
    const output = serializeLeadsheet(ls);
    expect(output).toBe('Cm7 | Xyz | Fm7');
  });
});
