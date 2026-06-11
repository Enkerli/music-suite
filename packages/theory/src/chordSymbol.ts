/**
 * Chord-symbol parsing — text like "Bbm7", "F7#5b9", "Cm7/Bb" into a
 * spelled root plus a quality. Built for the jazz lead-sheet vocabulary
 * of the suite's corpus (and general jazz shorthand).
 *
 * The root keeps its written spelling (a SpelledNote) — per CONVENTIONS.md
 * the root's spelling is the only free enharmonic choice, and degree
 * assertion (analysis.ts) depends on it. Quality resolution is
 * best-effort: when the suffix maps to a dictionary quality the key is
 * returned; unknown suffixes still parse (root + raw suffix) so corpus
 * pipelines can count and audit them instead of dropping data.
 */

import { findQualityByKey, getAllQualities } from "./chords.js";
import { formatSpelled, parseSpelled, type SpelledNote } from "./spelling.js";

export interface ParsedChordSymbol {
  /** The input, trimmed. */
  symbol: string;
  /** Canonical (Unicode-accidental) root name, spelling preserved. */
  rootName: string;
  root: SpelledNote;
  /** Raw quality suffix as written (before any slash bass). */
  suffix: string;
  /** Dictionary quality key when the suffix is recognized. */
  qualityKey?: string;
  /** Slash-bass note name (canonical spelling), if present. */
  bassName?: string;
}

/** "No chord" markers used in lead sheets. */
export function isNoChord(symbol: string): boolean {
  const s = symbol.trim().toUpperCase();
  return s === "NC" || s === "N.C." || s === "N.C" || s === "X";
}

/**
 * Manual suffix → dictionary-key mappings for shorthand the alias table
 * doesn't cover. Kept explicit (and alphabetized) so additions are easy
 * to review against the corpus inventory.
 */
const MANUAL_SUFFIX_KEYS: Record<string, string> = {
  "": "maj",
  "+7": "aug7",
  "+add9": "M#5add9",
  "13sus": "13sus4",
  "2": "sus2",
  "4": "sus4",
  "67": "7add6",
  "69": "6add9",
  "6#11": "M6#11",
  "7+": "aug7",
  "7add13": "7add6",
  "7alt": "alt7",
  "7b6": "7b13",
  "7sus": "7sus4",
  "7b9sus4": "b9sus",
  "7sus4b9": "b9sus",
  "7susb9": "b9sus",
  "9+": "9#5",
  "9sus": "9sus4",
  "M": "maj",
  "M13": "maj13",
  "M6": "6",
  "M69": "6add9",
  "M69#11": "69#11",
  "M7": "maj7",
  "M7#11": "maj#4",
  "maj7#11": "maj#4",
  "M7#5": "augMaj7",
  "M7#9#11": "maj7#9#11",
  "M9#11": "maj9#11",
  "M7+": "augMaj7",
  "M7add13": "maj7add13",
  "M9#5": "maj9#5",
  "addb9": "Maddb9",
  "h7": "m7b5",
  "m": "min",
  "m+": "m#5",
  "m7add4": "m7add11",
  "maj7#5": "augMaj7",
  "mi": "min",
  "mM7": "minMaj7",
  "mM7b6": "mMaj7b6",
  "mMaj7": "minMaj7",
  "o": "dim",
  "phryg": "b9sus",
  "o7": "dim7",
  "oM7": "oM7",
  "sus": "sus4",
  "susb9": "b9sus",
};

/** Alias → key index built from the dictionary, plus manual extras. */
let SUFFIX_INDEX: Map<string, string> | null = null;
function suffixIndex(): Map<string, string> {
  if (SUFFIX_INDEX) return SUFFIX_INDEX;
  const index = new Map<string, string>();
  // Lowest precedence first: lowercased aliases, then exact aliases,
  // then exact keys, then the manual map.
  for (const q of getAllQualities()) {
    for (const alias of q.aliases) index.set(alias.toLowerCase(), q.key);
  }
  for (const q of getAllQualities()) {
    for (const alias of q.aliases) index.set(alias, q.key);
  }
  for (const q of getAllQualities()) index.set(q.key, q.key);
  for (const [suffix, key] of Object.entries(MANUAL_SUFFIX_KEYS)) index.set(suffix, key);
  SUFFIX_INDEX = index;
  return index;
}

/** Resolve a quality suffix to a dictionary key, or undefined. */
export function qualityKeyForSuffix(suffix: string): string | undefined {
  const idx = suffixIndex();
  const key = idx.get(suffix) ?? idx.get(suffix.toLowerCase());
  return key !== undefined && findQualityByKey(key) ? key : undefined;
}

const ROOT_RE = /^([A-Ga-g])(𝄪|𝄫|##|bb|♯♯|♭♭|[#♯b♭])?/;

/**
 * Parse a chord symbol. Returns null for empty input, no-chord markers,
 * or an unintelligible root. Unknown quality suffixes still parse
 * (qualityKey stays undefined).
 */
export function parseChordSymbol(input: string): ParsedChordSymbol | null {
  const symbol = input.trim();
  if (!symbol || isNoChord(symbol)) return null;

  const m = ROOT_RE.exec(symbol);
  if (!m) return null;
  const rootText = m[0]!;
  const root = parseSpelled(rootText);
  if (!root) return null;

  let rest = symbol.slice(rootText.length);

  // Slash bass: split on the last '/' whose remainder parses as a note.
  let bassName: string | undefined;
  const slash = rest.lastIndexOf("/");
  if (slash >= 0) {
    const bass = parseSpelled(rest.slice(slash + 1));
    if (bass) {
      bassName = formatSpelled(bass);
      rest = rest.slice(0, slash);
    }
  }

  const suffix = rest;
  const result: ParsedChordSymbol = {
    symbol,
    rootName: formatSpelled(root),
    root,
    suffix,
    ...(bassName !== undefined ? { bassName } : {}),
  };
  const qualityKey = qualityKeyForSuffix(suffix);
  return qualityKey !== undefined ? { ...result, qualityKey } : result;
}

// ─── Display suffixes ────────────────────────────────────────────────────
//
// Canonical compact suffix for published labels (transition tables,
// progression displays): jazz shorthand, ASCII, and — by contract — always
// a recognized alias, so qualityKeyForSuffix(displaySuffix(key)) === key.
// Qualities without an entry use their dictionary key (same guarantee).

const DISPLAY_SUFFIXES: Record<string, string> = {
  // bare "4" parses as sus4 (corpus convention), so quartal displays by its alias
  "4": "quartal",
  maj: "",
  min: "m",
  min7: "m7",
  min9: "m9",
  min11: "m11",
  min13: "m13",
  minMaj7: "mM7",
  aug: "+",
  aug7: "7#5",
  augMaj7: "M7#5",
  "6add9": "69",
  "maj#4": "M7#11",
  Maddb9: "addb9",
  Madd9: "add9",
  "M#5add9": "+add9",
  b9sus: "7sus4b9",
  "m#5": "m#5",
  alt7: "7alt",
};

/** Canonical display suffix for a dictionary quality key. */
export function displaySuffix(qualityKey: string): string {
  return DISPLAY_SUFFIXES[qualityKey] ?? qualityKey;
}
