/**
 * Chord segment splicing — manages sub-bar chord assignments.
 *
 * When a user manually assigns a chord to a portion of a bar (via range selection),
 * this module handles the segment splitting logic.
 */

import type { ChordSegment, DetectedChord } from '../types/clip';

/**
 * Splice a new chord segment into an existing segments array.
 *
 * Given a bar's existing segments (or a fallback single-chord),
 * splice in a new chord assignment for [newStart, newEnd).
 *
 * All ticks are relative to bar start (0 to ticksPerBar).
 *
 * Algorithm:
 *   1. If no existing segments, create one covering [0, ticksPerBar) with the bar's fallback chord.
 *   2. Walk existing segments. For each:
 *      a. If it's entirely before or after [newStart, newEnd): keep it unchanged.
 *      b. If it partially overlaps: trim it (create a "before" portion, an "after" portion, or both).
 *      c. The overlap region is replaced by the new segment.
 *   3. Insert the new segment at [newStart, newEnd) with the given chord.
 *   4. Filter out any zero-width segments.
 *   5. Sort by startTick.
 *
 * @param existing The bar's current segments array (may be undefined or empty)
 * @param fallbackChord The bar's chord field (used if no segments exist yet)
 * @param ticksPerBar Number of ticks in one bar
 * @param newStart Start tick of the new segment (bar-relative)
 * @param newEnd End tick of the new segment (bar-relative)
 * @param newChord The chord to assign to the new segment
 * @returns A new segments array with the splice applied
 */
export function spliceSegment(
  existing: ChordSegment[] | undefined,
  fallbackChord: DetectedChord | null,
  ticksPerBar: number,
  newStart: number,
  newEnd: number,
  newChord: DetectedChord | null,
): ChordSegment[] {
  // Step 1: Ensure we have a segments array to work with
  const segments: ChordSegment[] = (existing && existing.length > 0)
    ? existing.map(s => ({ ...s })) // shallow clone
    : [{ startTick: 0, endTick: ticksPerBar, chord: fallbackChord }];

  const result: ChordSegment[] = [];

  for (const seg of segments) {
    // Case A: segment entirely before the new range
    if (seg.endTick <= newStart) {
      result.push(seg);
      continue;
    }
    // Case B: segment entirely after the new range
    if (seg.startTick >= newEnd) {
      result.push(seg);
      continue;
    }
    // Case C: overlap — trim the segment
    // Left remainder (before the new range)
    if (seg.startTick < newStart) {
      result.push({ startTick: seg.startTick, endTick: newStart, chord: seg.chord });
    }
    // Right remainder (after the new range)
    if (seg.endTick > newEnd) {
      result.push({ startTick: newEnd, endTick: seg.endTick, chord: seg.chord });
    }
    // The overlapping portion is discarded (replaced by the new segment)
  }

  // Insert the new segment
  result.push({ startTick: newStart, endTick: newEnd, chord: newChord });

  // Sort by startTick, filter zero-width, then merge adjacent duplicates
  const sorted = result
    .filter(s => s.endTick > s.startTick)
    .sort((a, b) => a.startTick - b.startTick);

  return mergeAdjacentSegments(sorted);
}

/**
 * Merge adjacent segments with the same chord symbol.
 * This eliminates duplicates like G-→G- caused by splicing.
 */
function mergeAdjacentSegments(segments: ChordSegment[]): ChordSegment[] {
  if (segments.length <= 1) return segments;

  const merged: ChordSegment[] = [];
  let current = segments[0]!;

  for (let i = 1; i < segments.length; i++) {
    const next = segments[i]!;
    // Check if same chord (by symbol) - merge them
    const currentSymbol = current.chord?.symbol ?? null;
    const nextSymbol = next.chord?.symbol ?? null;

    if (currentSymbol === nextSymbol) {
      // Extend current segment to include next
      current = { ...current, endTick: next.endTick };
    } else {
      // Different chord - push current, start new
      merged.push(current);
      current = next;
    }
  }
  merged.push(current);

  return merged;
}

/**
 * Remove segments that contain no notes (rests).
 * A rest cannot carry chord information - only notes define chords.
 *
 * @param segments The segments array to filter
 * @param barStart The absolute tick where the bar starts
 * @param onsets Array of note onset times (absolute ticks)
 * @param durations Array of note durations in ticks
 * @returns Filtered segments array with rest segments removed
 */
export function removeRestSegments(
  segments: ChordSegment[],
  barStart: number,
  onsets: number[],
  durations: number[],
): ChordSegment[] {
  return segments.filter(seg => {
    // Convert segment to absolute ticks
    const segStartAbs = barStart + seg.startTick;
    const segEndAbs = barStart + seg.endTick;

    // Check if any note sounds during this segment
    for (let i = 0; i < onsets.length; i++) {
      const noteStart = onsets[i]!;
      const noteEnd = noteStart + durations[i]!;
      // Note overlaps with segment if it sounds during segment time
      if (noteStart < segEndAbs && noteEnd > segStartAbs) {
        return true; // Keep this segment - it has notes
      }
    }
    return false; // Remove - it's a rest
  });
}

/**
 * Check whether a segments array is "trivial" (single segment covering the whole bar).
 * If so, the bar can be represented with just the `chord` field.
 */
export function isTrivialSegments(
  segments: ChordSegment[] | undefined,
  ticksPerBar: number,
): boolean {
  if (!segments || segments.length === 0) return true;
  if (segments.length === 1 &&
      segments[0].startTick === 0 &&
      segments[0].endTick === ticksPerBar) {
    return true;
  }
  return false;
}
