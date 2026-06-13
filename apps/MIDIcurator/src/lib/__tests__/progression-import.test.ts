import { describe, expect, it } from 'vitest';
import { parseLeadsheet } from '@enkerli/theory';
import { progressionToSMF } from '@enkerli/midi';
import { readEmbeddedProgression, leadsheetTextFromProgression } from '../progression-import';

describe('progression import (ProgGenie → MIDIcurator leadsheet)', () => {
  it('recovers an embedded progression from a written SMF', () => {
    const prog = parseLeadsheet('IIm7 V7 | Imaj7', { tonic: 'C', mode: 'major' });
    const smf = progressionToSMF(prog);
    const back = readEmbeddedProgression(smf.buffer.slice(0) as ArrayBuffer);
    expect(back).toEqual(prog);
  });

  it('returns null when the SMF has no embedded progression', () => {
    expect(readEmbeddedProgression(new Uint8Array([0x4d, 0x54, 0x68, 0x64]).buffer)).toBeNull();
  });

  it('realizes degree chords to absolute symbols, laid out across bars', () => {
    const prog = parseLeadsheet('IIm7 V7 Imaj7 VIm7', { tonic: 'C', mode: 'major' });
    // 4 chords across 2 bars → 2 per bar, realized to concrete spellings
    expect(leadsheetTextFromProgression(prog, 2)).toBe('Dm7 G7 | Cmaj7 Am7');
  });

  it('re-anchors realization to the key (♭II7 in C = D♭7)', () => {
    const prog = parseLeadsheet('♭II7', { tonic: 'C', mode: 'major' });
    expect(leadsheetTextFromProgression(prog, 1)).toBe('D♭7');
  });

  it('the recovered text re-parses through MIDIcurator parseLeadsheet', () => {
    const prog = parseLeadsheet('IIm7 V7 | Imaj7', { tonic: 'C', mode: 'major' });
    const text = leadsheetTextFromProgression(prog, 2)!;
    const ls = parseLeadsheet2(text, 2);
    expect(ls.bars).toHaveLength(2);
  });
});

// MIDIcurator's own leadsheet parser (numBars-based), imported lazily to
// keep this test focused on the bridge converter.
import { parseLeadsheet as parseLeadsheet2 } from '../leadsheet-parser';
