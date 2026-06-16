/**
 * Transition-table extraction with a full audit trail — the replacement
 * for the original Lua pipeline whose degree assertions drifted on
 * enharmonics and whose mode inference was implicit.
 *
 * Pipeline per sheet: infer key/mode → parse each chord symbol → assert
 * its degree (strict by default; optional reported respelling) → label as
 * numeral + quality (dictionary key when known, raw suffix otherwise) →
 * count transitions between consecutive DISTINCT labels. No-chord
 * markers break the chain (no transition across silence). Nothing is
 * silently dropped: every parse failure, unknown suffix, respelling, and
 * key decision is counted in the audit.
 */

import {
  assertDegree,
  displaySuffix,
  formatDegreeLabel,
  isNoChord,
  parseChordSymbol,
} from "@enkerli/theory";
import { inferKey } from "./key.js";
import type { LeadSheet } from "./leadsheet.js";

export type TransitionCounts = Record<string, Record<string, number>>;
/** Second-order counts: context "prev2 → prev1" → { next: count }. */
export type TrigramCounts = Record<string, Record<string, number>>;

/** Context key for a trigram (the two preceding labels). */
export function trigramContext(prev2: string, prev1: string): string {
  return `${prev2} → ${prev1}`;
}

export interface ExtractionOptions {
  /** Enharmonically respell exotic roots (reported in the audit). */
  respell?: boolean;
  /** Drop trigram next-counts below this (keeps the table sparse). Default 3. */
  minTrigramCount?: number;
}

export interface ExtractionAudit {
  sheetsTotal: number;
  sheetsUsed: number;
  sheetsSkipped: Array<{ title: string; reason: string }>;
  keyInference: Record<string, number>;
  modes: { major: number; minor: number };
  chordTokens: number;
  transitions: number;
  repeatsCollapsed: number;
  noChordMarkers: number;
  parseFailures: Record<string, number>;
  unknownQualitySuffixes: Record<string, number>;
  respelled: Record<string, number>;
  sheetIssues: Array<{ title: string; issues: string[] }>;
}

export interface ExtractionResult {
  major: TransitionCounts;
  minor: TransitionCounts;
  /** Second-order (trigram) tables — the variable-order Markov context. */
  majorTrigrams: TrigramCounts;
  minorTrigrams: TrigramCounts;
  audit: ExtractionAudit;
}

function bump(rec: Record<string, number>, key: string): void {
  rec[key] = (rec[key] ?? 0) + 1;
}

export function extractTransitions(
  sheets: LeadSheet[],
  options: ExtractionOptions = {},
): ExtractionResult {
  const tables: { major: TransitionCounts; minor: TransitionCounts } = { major: {}, minor: {} };
  const trigrams: { major: TrigramCounts; minor: TrigramCounts } = { major: {}, minor: {} };
  const audit: ExtractionAudit = {
    sheetsTotal: sheets.length,
    sheetsUsed: 0,
    sheetsSkipped: [],
    keyInference: {},
    modes: { major: 0, minor: 0 },
    chordTokens: 0,
    transitions: 0,
    repeatsCollapsed: 0,
    noChordMarkers: 0,
    parseFailures: {},
    unknownQualitySuffixes: {},
    respelled: {},
    sheetIssues: [],
  };

  for (const sheet of sheets) {
    if (sheet.issues.length > 0) {
      audit.sheetIssues.push({ title: sheet.title || "(untitled)", issues: sheet.issues });
    }
    const symbols = sheet.bars.flat();
    if (!sheet.keySig || symbols.length === 0) {
      audit.sheetsSkipped.push({
        title: sheet.title || "(untitled)",
        reason: !sheet.keySig ? "missing key signature" : "no chords",
      });
      continue;
    }

    const inference = inferKey(sheet.keySig, symbols[0], symbols[symbols.length - 1]);
    if (!inference) {
      audit.sheetsSkipped.push({ title: sheet.title, reason: `unparseable key signature: ${sheet.keySig}` });
      continue;
    }
    audit.sheetsUsed += 1;
    bump(audit.keyInference, inference.evidence);
    audit.modes[inference.key.mode] += 1;
    const table = tables[inference.key.mode];
    const trigramTable = trigrams[inference.key.mode];

    let previous: string | null = null;
    let prev2: string | null = null;
    for (const symbol of symbols) {
      audit.chordTokens += 1;
      if (isNoChord(symbol)) {
        audit.noChordMarkers += 1;
        previous = null; prev2 = null; // silence breaks the chain
        continue;
      }
      const chord = parseChordSymbol(symbol);
      if (!chord) {
        bump(audit.parseFailures, symbol);
        previous = null; prev2 = null;
        continue;
      }
      if (chord.qualityKey === undefined) {
        bump(audit.unknownQualitySuffixes, chord.suffix);
      }
      // Tritone ties read flat for most qualities (tritone sub: ♭II7) but
      // sharp for the diminished family (passing dim: ♯I°7, ♯IV°7).
      const dimFamily = /^(dim|o(7)?(M7)?$|m7b5|h7|m11b5)/.test(chord.suffix) ||
        (chord.qualityKey !== undefined && /^(dim|m7b5|o7M7|oM7)/.test(chord.qualityKey));
      const degree = assertDegree(chord.rootName, inference.key, {
        respell: options.respell ?? false,
        tieBreak: dimFamily ? "sharp" : "flat",
      });
      if (degree.respelled) {
        bump(audit.respelled, `${chord.rootName}→${degree.rootUsed} in ${inference.key.tonic} ${inference.key.mode}`);
      }
      // Canonical published labels: numeral + display suffix (CONVENTIONS.md);
      // unknown suffixes keep their raw text so nothing is silently dropped.
      const label = formatDegreeLabel(
        degree,
        chord.qualityKey !== undefined ? displaySuffix(chord.qualityKey) : chord.suffix,
      );

      if (previous === label) {
        audit.repeatsCollapsed += 1;
        continue;
      }
      if (previous !== null) {
        const row = (table[previous] ??= {});
        bump(row, label);
        audit.transitions += 1;
      }
      // Trigram: the two preceding DISTINCT labels predict this one.
      if (prev2 !== null && previous !== null) {
        bump((trigramTable[trigramContext(prev2, previous)] ??= {}), label);
      }
      prev2 = previous;
      previous = label;
    }
  }

  // Deterministic output: sort rows and columns by descending count, then name.
  const sortTable = (t: TransitionCounts): TransitionCounts => {
    const sorted: TransitionCounts = {};
    for (const from of Object.keys(t).sort()) {
      const row = t[from]!;
      const entries = Object.entries(row).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
      sorted[from] = Object.fromEntries(entries);
    }
    return sorted;
  };

  // Trigrams are far sparser than pairs; prune low-count next-labels (noise,
  // and most of the file size) and any context left with only one option
  // (which adds nothing over the pair table). Then sort like the pair table.
  const minCount = options.minTrigramCount ?? 3;
  const sortTrigrams = (t: TrigramCounts): TrigramCounts => {
    const sorted: TrigramCounts = {};
    for (const ctx of Object.keys(t).sort()) {
      const kept = Object.entries(t[ctx]!).filter(([, n]) => n >= minCount);
      if (kept.length < 2) continue; // one-option contexts back off to the pair table anyway
      kept.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
      sorted[ctx] = Object.fromEntries(kept);
    }
    return sorted;
  };

  return {
    major: sortTable(tables.major),
    minor: sortTable(tables.minor),
    majorTrigrams: sortTrigrams(trigrams.major),
    minorTrigrams: sortTrigrams(trigrams.minor),
    audit,
  };
}
