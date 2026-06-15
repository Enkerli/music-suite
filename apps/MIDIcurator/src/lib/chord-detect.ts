/**
 * Chord detection — the detection core (detectChord, detectChordFromPcs)
 * now comes from @enkerli/theory; this module re-exports it and keeps the
 * MIDIcurator-specific layers (bar segmentation, segment detection, degree
 * description, texture analysis). Migration finalized 2026-06-14 (the local
 * port was removed).
 */
import {
  type ChordMatch,
  detectChord,
  findQualityByKey,
  intervalLabel,
} from "@enkerli/theory";

export { detectChord, detectChordFromPcs, type ChordMatch } from "@enkerli/theory";

// ─── Bar-level segmentation ────────────────────────────────────────────

export interface BarChord {
  /** Bar index (0-based) */
  bar: number;
  /** Detected chord for this bar, or null */
  chord: ChordMatch | null;
  /** Pitch classes present in this bar */
  pitchClasses: number[];
  /** MIDI pitches in this bar */
  pitches: number[];
}

/**
 * Segment notes by bar and detect a chord for each bar.
 * Includes notes that are still sounding (sustained) from previous bars.
 *
 * @param pitches     Array of MIDI pitches (parallel with onsets/durations)
 * @param onsets      Array of onset times in ticks
 * @param ticksPerBar Ticks per bar
 * @param numBars     Total number of bars
 * @param durations   Optional array of note durations in ticks.
 *                    When provided, notes sustaining into a bar are included.
 */
/** Tolerance for "simultaneous" note starts/ends (in ticks). */
const BLOCK_TOLERANCE = 30;

/** Check if chord quality is a "simple" triad (preferred in detection). */
function isSimpleTriad(qualityKey: string): boolean {
  return ['maj', 'min', '5'].includes(qualityKey);
}

/**
 * Detect chord blocks within a set of note indices.
 * Groups notes that start and end together into blocks.
 */
function detectBlocksInBar(
  indices: number[],
  onsets: number[],
  durations: number[],
): Array<{ noteIndices: number[]; startTick: number; endTick: number }> {
  if (indices.length === 0) return [];

  // Group by quantized onset
  const groups = new Map<number, number[]>();
  for (const i of indices) {
    const onset = onsets[i]!;
    const key = Math.round(onset / BLOCK_TOLERANCE) * BLOCK_TOLERANCE;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(i);
  }

  // Convert groups to blocks, verify notes end together
  const blocks: Array<{ noteIndices: number[]; startTick: number; endTick: number }> = [];
  for (const [, noteIndices] of groups) {
    const starts = noteIndices.map(i => onsets[i]!);
    const ends = noteIndices.map(i => onsets[i]! + durations[i]!);

    const minStart = Math.min(...starts);
    const maxEnd = Math.max(...ends);
    const endSpread = Math.max(...ends) - Math.min(...ends);

    // Only treat as block if notes end together (within tolerance)
    if (endSpread <= BLOCK_TOLERANCE) {
      blocks.push({ startTick: minStart, endTick: maxEnd, noteIndices });
    } else {
      // Notes don't end together - treat each note as its own "block"
      for (const i of noteIndices) {
        blocks.push({
          startTick: onsets[i]!,
          endTick: onsets[i]! + durations[i]!,
          noteIndices: [i],
        });
      }
    }
  }

  return blocks.sort((a, b) => a.startTick - b.startTick);
}

export function detectChordsPerBar(
  pitches: number[],
  onsets: number[],
  ticksPerBar: number,
  numBars: number,
  durations?: number[],
): BarChord[] {
  const bars: BarChord[] = [];

  for (let bar = 0; bar < numBars; bar++) {
    const barStart = bar * ticksPerBar;
    const barEnd = barStart + ticksPerBar;

    // Collect note indices in this bar
    const barIndices: number[] = [];
    for (let i = 0; i < onsets.length; i++) {
      const onset = onsets[i]!;
      const dur = durations ? durations[i]! : 0;
      const noteEnd = onset + dur;

      // Include if:
      // 1. Note starts in this bar, OR
      // 2. Note started before but is still sounding in this bar
      if ((onset >= barStart && onset < barEnd) ||
          (durations && onset < barStart && noteEnd > barStart)) {
        barIndices.push(i);
      }
    }

    // All pitches in bar (for pitchClasses field)
    const barPitches = barIndices.map(i => pitches[i]!);
    const barPcs = [...new Set(barPitches.map(p => ((p % 12) + 12) % 12))];

    // Detect chord using block-aware logic if durations available
    let chord: ChordMatch | null = null;
    if (durations && barIndices.length >= 2) {
      // Use block detection to find the dominant chord
      const blocks = detectBlocksInBar(barIndices, onsets, durations);

      // Find blocks with 3+ notes (likely full triads or larger chords)
      const chordBlocks = blocks.filter(b => b.noteIndices.length >= 3);

      if (chordBlocks.length > 0) {
        // Strategy: merge all chord-block pitches first — within a bar,
        // arpeggiated/broken patterns collectively spell one harmony.
        const mergedPitches = chordBlocks.flatMap(b =>
          b.noteIndices.map(i => pitches[i]!)
        );
        const mergedChord = detectChord(mergedPitches);

        if (mergedChord) {
          chord = mergedChord;
        } else {
          // Merged set too dense / unrecognizable — fall back to best single block
          const ticksPerBeat = ticksPerBar / 4;
          const scoredBlocks = chordBlocks.map(block => {
            const localTick = block.startTick - barStart;
            const beat = Math.floor(localTick / ticksPerBeat);
            const beatBonus = (beat === 0 || beat === 3) ? 2 : 0;

            const blockPitches = block.noteIndices.map(i => pitches[i]!);
            const blockChord = detectChord(blockPitches);
            const qualityBonus = blockChord && isSimpleTriad(blockChord.quality.key) ? 1 : 0;

            return {
              block,
              chord: blockChord,
              score: block.noteIndices.length * 10 + beatBonus + qualityBonus
            };
          });

          const best = scoredBlocks.reduce((a, b) => b.score > a.score ? b : a);
          chord = best.chord;
        }
      }

      // If no chord from blocks (or no 3+ note blocks), try all pitches
      // This handles sustained notes + new onsets forming a complete chord
      if (!chord) {
        chord = detectChord(barPitches);
      }
    } else if (barPitches.length >= 2) {
      // Fallback: no durations, use all pitches
      chord = detectChord(barPitches);
    }

    // Empty bar inherits previous chord (resonance principle: chord sustains until next change)
    if (chord === null && bar > 0 && bars[bar - 1]) {
      chord = bars[bar - 1].chord;
    }

    bars.push({
      bar,
      chord,
      pitchClasses: barPcs,
      pitches: barPitches,
    });
  }

  return bars;
}

/**
 * Detect a single overall chord for an entire clip.
 * Uses all unique pitch classes across all notes.
 */
export function detectOverallChord(pitches: number[]): ChordMatch | null {
  return detectChord(pitches);
}

// ─── Segment-aware chord detection ─────────────────────────────────────

/** Per-segment chord result (raw, before conversion to DetectedChord). */
export interface SegmentChord {
  index: number;
  startTick: number;
  endTick: number;
  chord: ChordMatch | null;
  pitchClasses: number[];
}

/**
 * Detect chords per segment, where segments are defined by boundary tick positions.
 * Segments are: [0…b1), [b1…b2), …, [bn…clipEnd].
 *
 * A note is attributed to a segment if:
 *   1. Its onset falls within [start, end), OR
 *   2. It started before `start` but is still sounding (onset + duration > start).
 *
 * Uses the same merge-first strategy as detectChordsPerBar.
 */
export function detectChordsForSegments(
  pitches: number[],
  onsets: number[],
  durations: number[],
  boundaries: number[],
  clipEndTick: number,
): SegmentChord[] {
  if (boundaries.length === 0) return [];

  // Build segment ranges: [0…b1), [b1…b2), …, [bn…clipEnd]
  const ranges: Array<{ start: number; end: number }> = [];
  const sorted = [...boundaries].sort((a, b) => a - b);

  // First segment: 0 to first boundary
  if (sorted[0]! > 0) {
    ranges.push({ start: 0, end: sorted[0]! });
  }

  // Middle segments
  for (let i = 0; i < sorted.length - 1; i++) {
    ranges.push({ start: sorted[i]!, end: sorted[i + 1]! });
  }

  // Last segment: last boundary to clip end
  const lastBoundary = sorted[sorted.length - 1]!;
  if (lastBoundary < clipEndTick) {
    ranges.push({ start: lastBoundary, end: clipEndTick });
  }

  const results: SegmentChord[] = [];

  for (let segIdx = 0; segIdx < ranges.length; segIdx++) {
    const { start, end } = ranges[segIdx]!;

    // Collect notes that are sounding in this segment:
    //   onset in [start, end)  OR  onset < start AND onset+duration > start
    const segPitches: number[] = [];
    for (let i = 0; i < onsets.length; i++) {
      const onset = onsets[i]!;
      const dur = durations[i]!;
      const noteEnd = onset + dur;

      if ((onset >= start && onset < end) ||
          (onset < start && noteEnd > start)) {
        segPitches.push(pitches[i]!);
      }
    }

    const pcs = [...new Set(segPitches.map(p => ((p % 12) + 12) % 12))].sort((a, b) => a - b);

    // Detect chord using merge-first strategy
    let chord: ChordMatch | null = null;
    if (segPitches.length >= 2) {
      chord = detectChord(segPitches);
    }

    // No resonance for explicit segments — if a user-placed boundary
    // creates an empty segment, it should display as empty ("–"), not
    // inherit the previous chord.  Resonance remains in detectChordsPerBar
    // where empty bars are a grid artifact, not user intent.

    results.push({
      index: segIdx,
      startTick: start,
      endTick: end,
      chord,
      pitchClasses: pcs,
    });
  }

  return results;
}

// ─── Segment degree description ─────────────────────────────────────────────

/**
 * Describe which chord degrees are present in a segment, relative to a known
 * leadsheet chord.  Returns a compact string like "R 3 ♭7" for the chord tones
 * that are actually sounded, optionally suffixed with "+N" where N is the number
 * of non-chord-tone pitch classes (e.g. "R 3 ♭7 +1").
 *
 * Returns null when there is no usable context (no rootPc, no qualityKey, or no
 * notes in the segment).
 *
 * @param segmentPitches  MIDI pitches (absolute) for notes sounding in the segment
 * @param rootPc          Root pitch class of the leadsheet chord (0-11)
 * @param qualityKey      Quality key string (e.g. "maj7", "min", "7b9")
 */
export function describeSegmentDegrees(
  segmentPitches: number[],
  rootPc: number | null,
  qualityKey: string | null | undefined,
): string | null {
  if (rootPc === null || !qualityKey || segmentPitches.length === 0) return null;

  const quality = findQualityByKey(qualityKey);
  if (!quality) return null;

  // Build interval-name map: root-relative semitones → interval label
  // quality.pcs[i] and quality.intervals[i] are parallel
  const degreeMap = new Map<number, string>();
  for (let i = 0; i < quality.pcs.length; i++) {
    const relPc = ((quality.pcs[i]! % 12) + 12) % 12;
    degreeMap.set(relPc, quality.intervals[i]!);
  }

  // Build a map from pitch class → lowest sounding MIDI pitch in this segment.
  // This lets us sort degrees by range order (lowest note first) so inversions
  // are immediately visible — if the root isn't the bass, it won't appear first.
  const lowestPitchForPc = new Map<number, number>();
  for (const p of segmentPitches) {
    const pc = ((p % 12) + 12) % 12;
    const current = lowestPitchForPc.get(pc);
    if (current === undefined || p < current) lowestPitchForPc.set(pc, p);
  }

  // Collect unique pitch classes present in the segment
  const uniquePcs = [...lowestPitchForPc.keys()];

  // Partition into chord tones (with degree name) and NCTs (named by interval)
  const presentDegrees: Array<{ label: string; lowestPitch: number }> = [];
  const nctLabels: Array<{ label: string; lowestPitch: number }> = [];

  for (const pc of uniquePcs) {
    const relPc = ((pc - rootPc) + 12) % 12;
    const lowestPitch = lowestPitchForPc.get(pc)!;
    const label = degreeMap.get(relPc);
    if (label !== undefined) {
      if (!presentDegrees.some(d => d.label === label)) {
        presentDegrees.push({ label, lowestPitch });
      }
    } else {
      const nctLabel = intervalLabel(relPc);
      if (!nctLabels.some(d => d.label === nctLabel)) {
        nctLabels.push({ label: nctLabel, lowestPitch });
      }
    }
  }

  if (presentDegrees.length === 0 && nctLabels.length === 0) return null;

  // Sort both groups by the lowest sounding pitch (range order, not interval order)
  const ctPart = presentDegrees
    .sort((a, b) => a.lowestPitch - b.lowestPitch)
    .map(d => d.label)
    .join(' ');

  const nctPart = nctLabels
    .sort((a, b) => a.lowestPitch - b.lowestPitch)
    .map(d => d.label)
    .join(' ');

  return nctPart ? `${ctPart} (${nctPart})` : ctPart || null;
}

// ─── Segment texture analysis ───────────────────────────────────────────────

/**
 * High-level characterisation of how a chord is realised in a segment.
 *
 *  'block'     — 3+ chord tones onset simultaneously (block chord / stab)
 *  'shell'     — block chord, root + 3rd + 7th only (guide tones, no 5th)
 *  'inversion' — block chord where the lowest pitch is not the root
 *  'arpeggio'  — chord tones played sequentially (broken chord)
 *  'bassline'  — single-note motion, predominantly chord tones
 *  'melody'    — single-note motion with non-chord tones present
 *  'sustained' — a single note (or unison) held through most of the segment
 *  'mixed'     — simultaneous and sequential content that doesn't fit above
 *  'sparse'    — only 1 unique pitch class; can't characterise texture
 *  'empty'     — no notes at all
 */
export type SegmentTexture =
  | 'block'
  | 'shell'
  | 'inversion'
  | 'arpeggio'
  | 'bassline'
  | 'melody'
  | 'sustained'
  | 'mixed'
  | 'sparse'
  | 'empty';

/**
 * Short display label for each texture (fits in a narrow chip).
 */
export const TEXTURE_LABEL: Record<SegmentTexture, string> = {
  block:     'block',
  shell:     'shell',
  inversion: 'inv',
  arpeggio:  'arp',
  bassline:  'bass',
  melody:    'mel',
  sustained: 'sus',
  mixed:     'mix',
  sparse:    '–',
  empty:     '–',
};

/**
 * Analyse the textural character of a segment relative to its leadsheet chord.
 *
 * @param pitches      All MIDI pitches in the clip (parallel with onsets/durations)
 * @param onsets       All onset ticks
 * @param durations    All durations
 * @param segStart     Segment start tick (inclusive)
 * @param segEnd       Segment end tick (exclusive)
 * @param templatePcs  Chord tone pitch-classes from the leadsheet chord (may be empty/null)
 * @param rootPc       Root pitch-class of the leadsheet chord (or null)
 */
export function analyseSegmentTexture(
  pitches: number[],
  onsets: number[],
  durations: number[],
  segStart: number,
  segEnd: number,
  templatePcs: number[] | null,
  rootPc: number | null,
): SegmentTexture {
  // Gather notes that sound within this segment
  const segNotes: Array<{ pitch: number; onset: number; duration: number }> = [];
  for (let i = 0; i < onsets.length; i++) {
    const onset = onsets[i]!;
    const dur   = durations[i]!;
    const noteEnd = onset + dur;
    // Include notes that onset in the segment, or sustain into it from before
    if ((onset >= segStart && onset < segEnd) || (onset < segStart && noteEnd > segStart)) {
      segNotes.push({ pitch: pitches[i]!, onset, duration: dur });
    }
  }

  if (segNotes.length === 0) return 'empty';

  const uniquePcs = [...new Set(segNotes.map(n => n.pitch % 12))];
  if (uniquePcs.length === 1) return 'sparse';

  const template = new Set(templatePcs ?? []);
  const hasTemplate = template.size > 0;

  // Count notes that onset inside the segment (not just sustaining in)
  const onsetNotes = segNotes.filter(n => n.onset >= segStart && n.onset < segEnd);

  // ── Block detection: notes that start simultaneously (within BLOCK_TOLERANCE) ──
  // Group onset-notes by quantized onset
  const onsetGroups = new Map<number, typeof onsetNotes>();
  for (const n of onsetNotes) {
    const key = Math.round(n.onset / BLOCK_TOLERANCE) * BLOCK_TOLERANCE;
    if (!onsetGroups.has(key)) onsetGroups.set(key, []);
    onsetGroups.get(key)!.push(n);
  }

  const blocks = [...onsetGroups.values()].filter(g => g.length >= 2);

  // Count how many onset-notes land in a simultaneous group vs alone.
  // A pattern is "block-dominant" only when most notes are in groups —
  // this prevents a bass+first-arp-note pair from masking an arpeggio.
  const notesInBlocks = blocks.reduce((sum, g) => sum + g.length, 0);
  const blockFraction = onsetNotes.length > 0 ? notesInBlocks / onsetNotes.length : 0;
  const isBlockDominant = blockFraction >= 0.67;

  // ── Single sustained note: only one distinct onset group of size 1,
  //    and the note's duration covers most of the segment ──
  const segDuration = segEnd - segStart;
  if (onsetNotes.length === 1) {
    const n = onsetNotes[0]!;
    const soundingLen = Math.min(n.onset + n.duration, segEnd) - Math.max(n.onset, segStart);
    if (soundingLen >= segDuration * 0.7) return 'sustained';
  }
  // Also catch: all notes are the same pitch (unison doublings, octave)
  if (onsetNotes.length > 0 && new Set(onsetNotes.map(n => n.pitch % 12)).size === 1) {
    const longestSounding = Math.max(...onsetNotes.map(n =>
      Math.min(n.onset + n.duration, segEnd) - Math.max(n.onset, segStart)
    ));
    if (longestSounding >= segDuration * 0.7) return 'sustained';
  }

  if (isBlockDominant) {
    // Find the largest block (most simultaneous notes)
    const largestBlock = blocks.reduce((a, b) => a.length >= b.length ? a : b);
    const blockPcs = new Set(largestBlock.map(n => n.pitch % 12));

    // Shell voicing: contains root, 3rd (±4 from root), 7th (±10 or 11 from root),
    // but NOT the 5th (7 semitones from root). Requires a template with a root.
    if (hasTemplate && rootPc !== null && blockPcs.has(rootPc % 12)) {
      const relIntervals = [...blockPcs].map(pc => ((pc - rootPc) + 12) % 12);
      const has3rd  = relIntervals.includes(3) || relIntervals.includes(4);
      const has7th  = relIntervals.includes(10) || relIntervals.includes(11);
      const has5th  = relIntervals.includes(7);
      const has5thAlt = relIntervals.includes(6) || relIntervals.includes(8); // b5 / #5
      if (has3rd && has7th && !has5th && !has5thAlt && blockPcs.size <= 4) {
        return 'shell';
      }
    }

    // Inversion: block chord where the lowest sounding note ≠ root
    if (hasTemplate && rootPc !== null) {
      const lowestPitch = Math.min(...largestBlock.map(n => n.pitch));
      const lowestPc = lowestPitch % 12;
      if (lowestPc !== rootPc % 12 && template.has(lowestPc)) {
        return 'inversion';
      }
    }

    return 'block';
  }

  // ── Mostly sequential motion (solo notes dominate) ──
  if (!hasTemplate) {
    // Without a template we can't distinguish bassline from melody
    return uniquePcs.length <= 3 ? 'bassline' : 'melody';
  }

  const ctNotes    = onsetNotes.filter(n => template.has(((n.pitch % 12) + 12) % 12));
  const nctNotes   = onsetNotes.filter(n => !template.has(((n.pitch % 12) + 12) % 12));
  const ctFraction = onsetNotes.length > 0 ? ctNotes.length / onsetNotes.length : 0;

  // Arpeggio: mostly chord tones, more than one unique CT pitch class
  const uniqueCtPcs = new Set(ctNotes.map(n => n.pitch % 12));
  if (ctFraction >= 0.75 && uniqueCtPcs.size >= 2) return 'arpeggio';

  // Bassline: high chord-tone fraction, few unique PCs (linear, not spread)
  if (ctFraction >= 0.6 && uniquePcs.length <= 4 && nctNotes.length <= 1) return 'bassline';

  // Melody: NCTs dominate or are significant
  if (nctNotes.length > 0 && ctFraction < 0.75) return 'melody';

  // Fallback for mixed content
  return 'mixed';
}

/**
 * Returns a compact glyph summarising the textural shape of a segment,
 * to be appended to the degree label in the chord bar.
 *
 * Only two textures get glyphs (per the design intent):
 *   Block / shell chord that fills the whole segment → '■'  (or '□' for shell)
 *   Arpeggio with a clear direction                  → '↑' / '↓' / '↑↓' / '↓↑'
 *
 * Everything else (melody, bassline, mixed, sparse, …) → null.
 *
 * @param pitches     All MIDI pitches in the clip
 * @param onsets      All onset ticks (parallel with pitches)
 * @param durations   All durations (parallel with pitches)
 * @param segStart    Segment start tick (inclusive)
 * @param segEnd      Segment end tick (exclusive)
 * @param templatePcs Chord-tone pitch classes from the leadsheet chord
 * @param rootPc      Root pitch class of the leadsheet chord
 */
export function segmentTextureGlyph(
  pitches: number[],
  onsets: number[],
  durations: number[],
  segStart: number,
  segEnd: number,
  templatePcs: number[] | null,
  rootPc: number | null,
): string | null {
  const texture = analyseSegmentTexture(
    pitches, onsets, durations, segStart, segEnd, templatePcs, rootPc,
  );

  // ── Block glyphs ────────────────────────────────────────────────────────────
  if (texture === 'block') return '■';
  if (texture === 'shell') return '□';

  // ── Arpeggio direction ──────────────────────────────────────────────────────
  if (texture === 'arpeggio') {
    // Collect chord-tone notes that onset within the segment, in onset order.
    const template = new Set(templatePcs ?? []);
    const ctNotes: Array<{ pitch: number; onset: number }> = [];
    for (let i = 0; i < onsets.length; i++) {
      const onset = onsets[i]!;
      if (onset < segStart || onset >= segEnd) continue;
      const pc = ((pitches[i]! % 12) + 12) % 12;
      if (template.size === 0 || template.has(pc)) {
        ctNotes.push({ pitch: pitches[i]!, onset });
      }
    }
    ctNotes.sort((a, b) => a.onset - b.onset);

    if (ctNotes.length < 2) return null;

    // Walk the pitch sequence and record direction changes.
    // A "run" is a consecutive group of same-direction steps.
    // We count ascending (↑) and descending (↓) steps.
    let ups = 0;
    let downs = 0;
    // Also track whether there's a clear single reversal point (up-then-down or down-then-up)
    let lastDir: 1 | -1 | 0 = 0;
    let dirChanges = 0;

    for (let i = 1; i < ctNotes.length; i++) {
      const delta = ctNotes[i]!.pitch - ctNotes[i - 1]!.pitch;
      if (delta === 0) continue; // skip unisons / repeated pitch
      const dir: 1 | -1 = delta > 0 ? 1 : -1;
      if (dir === 1) ups++;
      else downs++;
      if (lastDir !== 0 && dir !== lastDir) dirChanges++;
      lastDir = dir;
    }

    if (ups === 0 && downs === 0) return null; // all unisons

    // Pure direction: at most one negligible step in the other direction
    const total = ups + downs;
    if (downs === 0 || ups / total >= 0.85) return '↑';
    if (ups === 0 || downs / total >= 0.85) return '↓';

    // Mixed (ups and downs roughly balanced) — covers both single-arch and
    // repeating up-down patterns across multiple bars.
    // Use the first non-unison step to determine which direction leads.
    if (ups / total >= 0.3 && downs / total >= 0.3) {
      for (let i = 1; i < ctNotes.length; i++) {
        const delta = ctNotes[i]!.pitch - ctNotes[i - 1]!.pitch;
        if (delta === 0) continue;
        return delta > 0 ? '↑↓' : '↓↑';
      }
    }

    return null; // irregular / indeterminate
  }

  return null;
}
