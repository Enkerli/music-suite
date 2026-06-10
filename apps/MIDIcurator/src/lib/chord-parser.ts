/**
 * Chord Symbol Parser — parses text like "Am", "F#m7", "Bb" into DetectedChord.
 *
 * Supports common chord notations:
 * - Root notes: C, D, E, F, G, A, B (with # or b accidentals)
 * - Quality suffixes: m, min, -, maj, M, dim, °, aug, +, 7, maj7, m7, etc.
 */

import type { DetectedChord } from '../types/clip';
import { getAllQualities, rootName as getRootName } from './chord-dictionary';

// Letter to pitch class mapping
const LETTER_TO_PC: Record<string, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
};

// Accidental adjustments
const ACCIDENTAL_ADJUST: Record<string, number> = {
  '#': 1, '♯': 1,
  'b': -1, '♭': -1,
  '': 0,
};

// Quality aliases mapping to dictionary keys
const QUALITY_ALIASES: Record<string, string> = {
  // Major variations
  '': 'maj',
  'M': 'maj',
  'maj': 'maj',
  'major': 'maj',

  // Minor variations
  'm': 'min',
  'min': 'min',
  '-': 'min',
  'minor': 'min',

  // Diminished
  'dim': 'dim',
  '°': 'dim',
  'o': 'dim',

  // Augmented
  'aug': 'aug',
  '+': 'aug',

  // Dominant 7th
  '7': '7',
  'dom7': '7',
  'dom': '7',

  // Major 7th
  'maj7': 'maj7',
  'M7': 'maj7',
  '∆': 'maj7',
  '△': 'maj7',
  '∆7': 'maj7',
  'Δ7': 'maj7',

  // Minor 7th
  'm7': 'min7',
  'min7': 'min7',
  '-7': 'min7',

  // Half-diminished (minor 7 flat 5)
  'm7b5': 'm7b5',
  'ø': 'm7b5',
  'ø7': 'm7b5',
  '-7b5': 'm7b5',

  // Diminished 7th
  'dim7': 'dim7',
  '°7': 'dim7',
  'o7': 'dim7',

  // Suspended
  'sus4': 'sus4',
  'sus': 'sus4',
  'sus2': 'sus2',

  // Add chords
  'add9': 'add9',
  'add2': 'add9',

  // 6th chords
  '6': '6',
  'm6': 'm6',
  'min6': 'm6',
  '-6': 'm6',

  // 9th chords
  '9': '9',
  'maj9': 'maj9',
  'M9': 'maj9',
  'm9': 'min9',
  'min9': 'min9',
  '-9': 'min9',

  // Power chord
  '5': '5',
};

// Pattern to match root note (letter + optional accidental)
const ROOT_PATTERN = /^([A-Ga-g])([#♯b♭])?/;

/**
 * Parse a chord symbol string into a DetectedChord.
 *
 * @param symbol The chord symbol (e.g., "Am", "F#m7", "Bb", "Cmaj7")
 * @returns DetectedChord if valid, null if unparseable
 */
export function parseChordSymbol(symbol: string): DetectedChord | null {
  if (!symbol || symbol.trim().length === 0) return null;

  const trimmed = symbol.trim();

  // Check for /Bass suffix — split on last '/' where the part after looks like a note name
  let mainPart = trimmed;
  let bassSuffix: string | undefined;
  const slashIdx = trimmed.lastIndexOf('/');
  if (slashIdx > 0) {
    const afterSlash = trimmed.slice(slashIdx + 1);
    if (ROOT_PATTERN.test(afterSlash)) {
      mainPart = trimmed.slice(0, slashIdx);
      bassSuffix = afterSlash;
    }
  }

  // Extract root note
  const rootMatch = mainPart.match(ROOT_PATTERN);
  if (!rootMatch) return null;

  const letter = rootMatch[1]!.toUpperCase();
  const accidental = rootMatch[2] || '';

  // Calculate root pitch class
  const basePC = LETTER_TO_PC[letter];
  if (basePC === undefined) return null;

  const accidentalAdj = ACCIDENTAL_ADJUST[accidental] ?? 0;
  const root = ((basePC + accidentalAdj) % 12 + 12) % 12;

  // Extract quality part (everything after the root)
  const qualityPart = mainPart.slice(rootMatch[0].length);

  // Look up quality in aliases
  let qualityKey = QUALITY_ALIASES[qualityPart];

  // If not found in aliases, try direct dictionary lookup
  if (!qualityKey) {
    const allQualities = getAllQualities();
    const directMatch = allQualities.find(q =>
      q.key === qualityPart ||
      q.aliases.some(a => a.toLowerCase() === qualityPart.toLowerCase())
    );
    if (directMatch) {
      qualityKey = directMatch.key;
    }
  }

  // Default to major if no quality specified and not found
  if (!qualityKey && qualityPart === '') {
    qualityKey = 'maj';
  }

  if (!qualityKey) return null;

  // Find the quality in the dictionary
  const quality = getAllQualities().find(q => q.key === qualityKey);
  if (!quality) return null;

  // Build the DetectedChord
  const rootDisplayName = getRootName(root);

  // Parse bass note if present
  let bassPc: number | undefined;
  let bassName: string | undefined;
  let bassSymbolSuffix = '';
  if (bassSuffix) {
    const bassMatch = bassSuffix.match(ROOT_PATTERN);
    if (bassMatch) {
      const bassLetter = bassMatch[1]!.toUpperCase();
      const bassAcc = bassMatch[2] || '';
      const bassBase = LETTER_TO_PC[bassLetter];
      if (bassBase !== undefined) {
        const bassAccAdj = ACCIDENTAL_ADJUST[bassAcc] ?? 0;
        bassPc = ((bassBase + bassAccAdj) % 12 + 12) % 12;
        bassName = getRootName(bassPc);
        bassSymbolSuffix = `/${bassName}`;
      }
    }
  }

  return {
    root,
    rootName: rootDisplayName,
    qualityKey: quality.key,
    symbol: `${rootDisplayName}${quality.displayName}${bassSymbolSuffix}`,
    qualityName: quality.fullName,
    bassPc,
    bassName,
  };
}

/**
 * Check if a chord symbol string is valid.
 *
 * @param symbol The chord symbol to validate
 * @returns true if the symbol can be parsed into a valid chord
 */
export function isValidChordSymbol(symbol: string): boolean {
  return parseChordSymbol(symbol) !== null;
}

/**
 * Get suggestions for chord symbols matching a partial input.
 * Useful for autocomplete functionality.
 *
 * @param partial The partial chord symbol typed by user
 * @returns Array of suggested complete chord symbols
 */
export function getChordSuggestions(partial: string): string[] {
  if (!partial || partial.trim().length === 0) return [];

  const trimmed = partial.trim();

  // Strip /Bass suffix for autocomplete matching
  let mainPart = trimmed;
  const slashIdx = trimmed.lastIndexOf('/');
  if (slashIdx > 0) {
    const afterSlash = trimmed.slice(slashIdx + 1);
    if (ROOT_PATTERN.test(afterSlash)) {
      mainPart = trimmed.slice(0, slashIdx);
    }
  }

  // Extract root if present
  const rootMatch = mainPart.match(ROOT_PATTERN);
  if (!rootMatch) return [];

  const rootPart = rootMatch[0];
  const qualityPart = mainPart.slice(rootPart.length).toLowerCase();

  // Get unique quality keys that match the partial
  const matchingQualities = Object.entries(QUALITY_ALIASES)
    .filter(([alias]) => alias.toLowerCase().startsWith(qualityPart))
    .map(([, key]) => key);

  const uniqueKeys = [...new Set(matchingQualities)];

  // Build suggestions
  const allQualities = getAllQualities();
  return uniqueKeys
    .map(key => {
      const quality = allQualities.find(q => q.key === key);
      if (!quality) return null;
      return `${rootPart}${quality.displayName}`;
    })
    .filter((s): s is string => s !== null)
    .slice(0, 8); // Limit to 8 suggestions
}
