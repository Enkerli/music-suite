/**
 * Chord detection — identifies chord quality and root from a set of MIDI pitches.
 *
 * Algorithm:
 *   1. Extract unique pitch classes from the input pitches.
 *   2. Try each of the 12 possible roots.
 *   3. Rotate the pitch class set so the candidate root is 0.
 *   4. Compute the decimal fingerprint of the rotated set.
 *   5. Look up the fingerprint in the chord dictionary.
 *   6. Among all matches, prefer:
 *      a. Exact match (same number of pitch classes)
 *      b. Fewest extra pitch classes (simpler quality)
 *      c. Lowest root pitch class (conventional preference for lower roots)
 *   7. If no dictionary match is found, return null.
 */

import {
  type ChordMatch,
  type ChordQuality,
  lookupByDecimal,
  pcsToDecimal,
  rotatePcs,
  rootName,
  spellInChordContext,
} from './chords.js';

export type { ChordMatch } from './chords.js';

// ─── Single-set detection ──────────────────────────────────────────────

/**
 * Detect a chord from a set of MIDI pitches (absolute, 0-127).
 * Returns the best ChordMatch, or null if no chord quality matches.
 */
export function detectChord(pitches: number[]): ChordMatch | null {
  if (pitches.length === 0) return null;

  // Extract unique pitch classes
  const uniquePcs = [...new Set(pitches.map(p => ((p % 12) + 12) % 12))];

  if (uniquePcs.length < 2) return null; // Single note = no chord

  // Compute lowest sounding pitch for slash chord detection
  const lowestPitch = Math.min(...pitches);

  // Try exact match first (all PCs in input match a dictionary entry exactly)
  const exactMatch = findExactMatch(uniquePcs, lowestPitch);
  if (exactMatch) return exactMatch;

  // Try subset matching: maybe the input has passing tones or doublings
  // that don't match exactly, but a subset does
  const subsetMatch = findBestSubsetMatch(uniquePcs, lowestPitch);
  if (subsetMatch) return subsetMatch;

  return null;
}

/**
 * Detect a chord from pitch classes (0-11) directly.
 * No register info available, so slash chords are never produced.
 */
export function detectChordFromPcs(pitchClasses: number[]): ChordMatch | null {
  const uniquePcs = [...new Set(pitchClasses.map(p => ((p % 12) + 12) % 12))];
  if (uniquePcs.length < 2) return null;

  const exactMatch = findExactMatch(uniquePcs);
  if (exactMatch) return exactMatch;

  const subsetMatch = findBestSubsetMatch(uniquePcs);
  if (subsetMatch) return subsetMatch;

  return null;
}

// ─── Internal matching ─────────────────────────────────────────────────

interface ScoredMatch {
  root: number;
  quality: ChordQuality;
  /** Lower is better: 0 = exact, positive = extra notes in input */
  extraNotes: number;
}

function findExactMatch(uniquePcs: number[], lowestPitch?: number): ChordMatch | null {
  const candidates: ScoredMatch[] = [];

  for (let root = 0; root < 12; root++) {
    const rotated = rotatePcs(uniquePcs, root);
    const decimal = pcsToDecimal(rotated);
    const quality = lookupByDecimal(decimal);

    if (quality) {
      // Normalize the quality's PCS for comparison
      const qualityPcsNorm = [...new Set(quality.pcs.map(p => ((p % 12) + 12) % 12))];
      if (qualityPcsNorm.length === uniquePcs.length) {
        candidates.push({ root, quality, extraNotes: 0 });
      }
    }
  }

  if (candidates.length === 0) return null;

  // Prefer simpler qualities (fewer notes = more fundamental)
  // Then prefer conventional root ordering
  candidates.sort((a, b) => {
    // Prefer fewer PCS in quality (simpler chord)
    const aSize = a.quality.pcs.length;
    const bSize = b.quality.pcs.length;
    if (aSize !== bSize) return aSize - bSize;

    // Prefer the bass note as root (lowest pitch class present)
    return a.root - b.root;
  });

  const best = candidates[0]!;
  return buildMatch(best.root, best.quality, uniquePcs, lowestPitch);
}

function findBestSubsetMatch(uniquePcs: number[], lowestPitch?: number): ChordMatch | null {
  const candidates: ScoredMatch[] = [];

  // For each possible root, try to find a quality where the quality's PCS
  // is a subset of the input (input may have extra notes like passing tones)
  for (let root = 0; root < 12; root++) {
    const rotated = rotatePcs(uniquePcs, root);
    const rotatedSet = new Set(rotated);

    // Try progressively smaller subsets by removing notes
    // First: try the full set as-is (already tried above, skip)
    // Then: try removing one note at a time to see if a smaller chord matches
    if (uniquePcs.length >= 3) {
      for (let skip = 0; skip < rotated.length; skip++) {
        const subset = rotated.filter((_, i) => i !== skip);
        if (subset.length < 2) continue;
        // Ensure root (0) is still in subset
        if (!subset.includes(0)) continue;

        const decimal = pcsToDecimal(subset);
        const quality = lookupByDecimal(decimal);
        if (quality) {
          const qualityPcsNorm = [...new Set(quality.pcs.map(p => ((p % 12) + 12) % 12))];
          const extraNotes = rotatedSet.size - qualityPcsNorm.length;
          candidates.push({ root, quality, extraNotes: Math.max(0, extraNotes) });
        }
      }
    }
  }

  if (candidates.length === 0) return null;

  // Sort: prefer fewer extra notes, then simpler quality, then lower root
  candidates.sort((a, b) => {
    if (a.extraNotes !== b.extraNotes) return a.extraNotes - b.extraNotes;
    const aSize = a.quality.pcs.length;
    const bSize = b.quality.pcs.length;
    if (aSize !== bSize) return bSize - aSize; // prefer larger match (more notes explained)
    return a.root - b.root;
  });

  const best = candidates[0]!;
  return buildMatch(best.root, best.quality, uniquePcs, lowestPitch);
}

/** Map a root-relative semitone distance to a readable interval label. */
export function intervalLabel(semitones: number): string {
  const labels: Record<number, string> = {
    0: 'R', 1: 'b9', 2: '9', 3: '#9', 4: '3', 5: '11',
    6: '#11', 7: '5', 8: 'b13', 9: '13', 10: 'b7', 11: '7',
  };
  return labels[semitones] ?? `+${semitones}`;
}

function buildMatch(
  root: number,
  quality: ChordQuality,
  observedPcsAbsolute: number[],
  lowestPitch?: number,
): ChordMatch {
  const rn = rootName(root);

  // Compute absolute template PCs
  const templatePcs = quality.pcs.map(pc => (pc + root) % 12).sort((a, b) => a - b);
  const templateSet = new Set(templatePcs);
  const observedSet = new Set(observedPcsAbsolute);

  const extras = observedPcsAbsolute.filter(pc => !templateSet.has(pc)).sort((a, b) => a - b);
  const missing = templatePcs.filter(pc => !observedSet.has(pc)).sort((a, b) => a - b);

  // Build symbol: base quality + extras suffix
  const display = quality.displayName;
  let extrasSuffix = '';
  if (extras.length > 0) {
    const extraIntervals = extras.map(pc => `add${intervalLabel((pc - root + 12) % 12)}`);
    extrasSuffix = `(${extraIntervals.join(',')})`;
  }

  // Slash chord detection: when lowest pitch is a chord tone but not the root
  let bassPc: number | undefined;
  let bassName: string | undefined;
  let bassSuffix = '';
  if (lowestPitch !== undefined) {
    const lowestPc = ((lowestPitch % 12) + 12) % 12;
    if (lowestPc !== root && templateSet.has(lowestPc)) {
      bassPc = lowestPc;
      bassName = spellInChordContext(lowestPc, root, rn);
      bassSuffix = `/${bassName}`;
    }
  }

  const symbol = `${rn}${display}${extrasSuffix}${bassSuffix}`;

  return {
    root,
    rootName: rn,
    quality,
    symbol,
    observedPcs: [...observedSet].sort((a, b) => a - b),
    templatePcs,
    extras,
    missing,
    ...(bassPc !== undefined && bassName !== undefined ? { bassPc, bassName } : {}),
  };
}

