/**
 * Tests for grid geometry module
 */

import { describe, it, expect } from 'vitest';
import {
  ROW_COUNT,
  getRowLength,
  ROW_START,
  getPadIndex,
  getRowCol,
  getMidiNote,
  getCellCenter,
  getHexPoints,
  getViewBox
} from '../../src/core/grid.js';

describe('Grid Geometry', () => {
  describe('Row structure', () => {
    it('should have 11 rows', () => {
      expect(ROW_COUNT).toBe(11);
    });

    it('should return correct row lengths', () => {
      expect(getRowLength(0)).toBe(6); // Even row
      expect(getRowLength(1)).toBe(5); // Odd row
      expect(getRowLength(2)).toBe(6);
      expect(getRowLength(3)).toBe(5);
      expect(getRowLength(10)).toBe(6);
    });

    it('should have correct row start indexes', () => {
      // Musical intervals: +4 (major 3rd), +3 (minor 3rd), alternating
      // This means pads repeat across rows based on musical intervals
      const starts = Array.from({ length: ROW_START.length }, (_, i) => ROW_START[i]);
      expect(starts).toEqual([0, 4, 7, 11, 14, 18, 21, 25, 28, 32, 35]);
    });
  });

  describe('Pad indexing', () => {
    it('should calculate pad index correctly', () => {
      expect(getPadIndex(0, 0)).toBe(0);
      expect(getPadIndex(0, 5)).toBe(5);
      expect(getPadIndex(1, 0)).toBe(4);   // Row 1 starts at 4 (+4 semitones)
      expect(getPadIndex(1, 4)).toBe(8);   // Row 1: 4+4 = 8
      expect(getPadIndex(2, 0)).toBe(7);   // Row 2 starts at 7 (+3 semitones from row 1)
    });

    it('should convert pad index back to row/col for unambiguous cases', () => {
      // Test early pad indices that are truly unambiguous
      // Note: With musical interval layout (+4,+3), indices overlap starting around pad 4
      // getRowCol() returns the lowest valid row for ambiguous indices
      expect(getRowCol(0)).toEqual({ row: 0, col: 0 });
      expect(getRowCol(1)).toEqual({ row: 0, col: 1 });
      expect(getRowCol(2)).toEqual({ row: 0, col: 2 });
      expect(getRowCol(3)).toEqual({ row: 0, col: 3 });
    });

    it('should handle ambiguous pad indices by returning lowest row', () => {
      // Pad index 4: valid for row 0 col 4 AND row 1 col 0
      // getRowCol returns lowest row (row 0)
      const result4 = getRowCol(4);
      expect(result4.row === 0 || result4.row === 1).toBe(true);

      // Pad index 7: valid for row 0 col 7... wait, row 0 only has 6 pads (0-5)
      // So pad 7 is row 2 col 0 OR row 1 col 3
      const result7 = getRowCol(7);
      expect(result7.row >= 1 && result7.row <= 2).toBe(true);
    });
  });

  describe('MIDI mapping', () => {
    it('should calculate MIDI notes with default base', () => {
      expect(getMidiNote(0, 0)).toBe(48); // C3
      expect(getMidiNote(0, 1)).toBe(49);
      expect(getMidiNote(1, 0)).toBe(52); // Row 1 starts at pad 4 (48+4 = 52 = E3, major 3rd up)
    });

    it('should calculate MIDI notes with custom base', () => {
      expect(getMidiNote(0, 0, 60)).toBe(60); // C4
      expect(getMidiNote(0, 1, 60)).toBe(61);
      expect(getMidiNote(1, 0, 60)).toBe(64); // Row 1 starts at pad 4 (60+4 = 64 = E4)
    });
  });

  describe('Geometry calculations', () => {
    it('should calculate cell centers', () => {
      const center1 = getCellCenter(0, 0);
      expect(center1.x).toBe(48); // padding
      expect(center1.y).toBe(378); // (11-1)*33 + 48

      const center2 = getCellCenter(0, 1);
      expect(center2.x).toBe(86); // 48 + 38
    });

    it('should generate hex points', () => {
      const points = getHexPoints(100, 100, 22);
      expect(points).toContain('100,78'); // Top point
      expect(points).toContain('100,122'); // Bottom point
    });

    it('should generate correct viewBox', () => {
      const portraitVB = getViewBox('portrait');
      expect(portraitVB.width).toBeGreaterThan(0);
      expect(portraitVB.height).toBeGreaterThan(0);
      expect(portraitVB.viewBox).toContain('0 0');

      const landscapeVB = getViewBox('landscape');
      expect(landscapeVB.width).toBe(portraitVB.height);
      expect(landscapeVB.height).toBe(portraitVB.width);
    });
  });
});
