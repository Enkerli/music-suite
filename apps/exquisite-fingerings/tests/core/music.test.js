/**
 * Tests for music theory module
 */

import { describe, it, expect } from 'vitest';
import {
  NOTE_TO_PC,
  PC_TO_NOTE_SHARP,
  getPitchClasses,
  parseCustomPitchClasses,
  midiToNoteName,
  midiToPitchClass,
  pcsToBinary,
  binaryToPcs,
  getInterval,
  transposePcs
} from '../../src/core/music.js';

describe('Music Theory', () => {
  describe('Note/PC conversions', () => {
    it('should convert note names to pitch classes', () => {
      expect(NOTE_TO_PC['C']).toBe(0);
      expect(NOTE_TO_PC['C#']).toBe(1);
      expect(NOTE_TO_PC['Db']).toBe(1);
      expect(NOTE_TO_PC['G']).toBe(7);
      expect(NOTE_TO_PC['B']).toBe(11);
    });

    it('should convert pitch classes to note names', () => {
      expect(PC_TO_NOTE_SHARP[0]).toBe('C');
      expect(PC_TO_NOTE_SHARP[1]).toBe('C#');
      expect(PC_TO_NOTE_SHARP[7]).toBe('G');
      expect(PC_TO_NOTE_SHARP[11]).toBe('B');
    });

    it('should convert MIDI to pitch class', () => {
      expect(midiToPitchClass(60)).toBe(0); // C4
      expect(midiToPitchClass(61)).toBe(1); // C#4
      expect(midiToPitchClass(67)).toBe(7); // G4
      expect(midiToPitchClass(72)).toBe(0); // C5
    });

    it('should convert MIDI to note name', () => {
      expect(midiToNoteName(60)).toBe('C4');
      expect(midiToNoteName(61)).toBe('C#4');
      expect(midiToNoteName(67)).toBe('G4');
    });
  });

  describe('Pitch Class Sets', () => {
    it('should get pitch classes for C major', () => {
      const pcs = getPitchClasses('C', 'maj');
      expect(pcs).toEqual(new Set([0, 2, 4, 5, 7, 9, 11]));
    });

    it('should get pitch classes for D major', () => {
      const pcs = getPitchClasses('D', 'maj');
      expect(pcs).toEqual(new Set([2, 4, 6, 7, 9, 11, 1]));
    });

    it('should get pitch classes for C major triad', () => {
      const pcs = getPitchClasses('C', 'majtriad');
      expect(pcs).toEqual(new Set([0, 4, 7]));
    });

    it('should parse custom pitch classes', () => {
      const pcs = parseCustomPitchClasses('0,3,7');
      expect(pcs).toEqual(new Set([0, 3, 7]));
    });

    it('should handle empty custom pitch classes', () => {
      const pcs = parseCustomPitchClasses('');
      expect(pcs).toEqual(new Set());
    });
  });

  describe('Binary representation', () => {
    it('should convert C major triad to binary', () => {
      const pcs = new Set([0, 4, 7]); // C, E, G
      const binary = pcsToBinary(pcs);
      // leftmost-LSB: pc i contributes 2^i (pc 0 = bit 0 = 2^0)
      // 2^0 + 2^4 + 2^7 = 145
      expect(binary).toBe(145);
    });

    it('should convert binary back to PCS', () => {
      const binary = 145; // C major triad
      const pcs = binaryToPcs(binary);
      expect(pcs).toEqual(new Set([0, 4, 7]));
    });

    it('should handle chromatic scale', () => {
      const pcs = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
      const binary = pcsToBinary(pcs);
      expect(binary).toBe(4095); // All bits set: 2^12 - 1
    });
  });

  describe('Intervals and transposition', () => {
    it('should calculate intervals', () => {
      expect(getInterval(0, 4)).toBe(4); // C to E = major third
      expect(getInterval(0, 7)).toBe(7); // C to G = perfect fifth
      expect(getInterval(7, 0)).toBe(5); // G to C = perfect fourth
    });

    it('should transpose pitch class sets', () => {
      const cMajor = new Set([0, 4, 7]);
      const dMajor = transposePcs(cMajor, 2);
      expect(dMajor).toEqual(new Set([2, 6, 9]));
    });

    it('should handle negative transposition', () => {
      const cMajor = new Set([0, 4, 7]);
      const bflatMajor = transposePcs(cMajor, -2);
      expect(bflatMajor).toEqual(new Set([10, 2, 5]));
    });
  });
});
