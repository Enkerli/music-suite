/**
 * Leadsheet Parser — parses pipe-delimited chord charts into structured bar data.
 *
 * Format: "Fm7 | Am7 D7 | Abm7 Db7 | Bbm7 Eb7"
 *
 * Conventions (iReal Pro–inspired):
 * - `|` bar delimiter
 * - Space-separated chords within a bar (equal time division)
 * - `%` or `-` repeat previous bar
 * - `NC` no chord
 * - Empty bar treated as NC
 */

import { parseChordSymbol } from './chord-parser';
import type { Leadsheet, LeadsheetBar, LeadsheetChord } from '../types/clip';

/**
 * Parse a leadsheet text input into structured bar data.
 *
 * @param input   Pipe-delimited leadsheet text
 * @param numBars Expected number of bars (from clip). Bars beyond this
 *                are truncated; missing bars are filled with NC.
 */
export function parseLeadsheet(input: string, numBars: number): Leadsheet {
  const rawBars = input.split('|').map(s => s.trim());

  // Remove empty trailing entry from trailing pipe
  if (rawBars.length > 0 && rawBars[rawBars.length - 1] === '') {
    rawBars.pop();
  }
  // Remove empty leading entry from leading pipe
  if (rawBars.length > 0 && rawBars[0] === '') {
    rawBars.shift();
  }

  const bars: LeadsheetBar[] = [];
  let prevBar: LeadsheetBar | null = null;

  for (let i = 0; i < Math.max(rawBars.length, numBars); i++) {
    // Auto-fill: bars beyond what was supplied inherit the previous bar (chord resonance).
    // This is distinct from an explicitly-written empty bar or "NC" token.
    if (i >= rawBars.length) {
      const repeated: LeadsheetBar = prevBar
        ? { ...prevBar, bar: i, isRepeat: true }
        : { bar: i, chords: [], isRepeat: true };
      bars.push(repeated);
      prevBar = repeated;
      continue;
    }

    const raw = rawBars[i]!.trim();

    // Repeat token
    if (raw === '%' || raw === '-') {
      const repeated: LeadsheetBar = prevBar
        ? { ...prevBar, bar: i, isRepeat: true }
        : { bar: i, chords: [], isRepeat: true };
      bars.push(repeated);
      prevBar = repeated;
      continue;
    }

    // NC or empty
    if (raw === '' || raw.toUpperCase() === 'NC') {
      const ncBar: LeadsheetBar = {
        bar: i,
        chords: [{
          chord: null,
          inputText: raw || 'NC',
          position: 0,
          totalInBar: 1,
        }],
        isRepeat: false,
      };
      bars.push(ncBar);
      prevBar = ncBar;
      continue;
    }

    // Split on whitespace for multiple chords per bar
    const tokens = raw.split(/\s+/).filter(Boolean);
    const chords: LeadsheetChord[] = tokens.map((token, j) => {
      const parsed = parseChordSymbol(token);
      return {
        chord: parsed,
        inputText: token,
        position: j,
        totalInBar: tokens.length,
      };
    });

    const bar: LeadsheetBar = { bar: i, chords, isRepeat: false };
    bars.push(bar);
    prevBar = bar;
  }

  // Truncate to numBars
  const truncated = bars.slice(0, numBars);

  return { inputText: input, bars: truncated };
}

/**
 * Serialize a Leadsheet back to pipe-delimited text.
 * Inverse of parseLeadsheet().
 */
export function serializeLeadsheet(leadsheet: Leadsheet): string {
  return leadsheet.bars.map(bar => {
    if (bar.isRepeat) return '%';
    if (bar.chords.length === 0) return 'NC';
    if (bar.chords.length === 1 && !bar.chords[0]!.chord && bar.chords[0]!.inputText.toUpperCase() === 'NC') return 'NC';
    return bar.chords.map(c => c.inputText).join(' ');
  }).join(' | ');
}
