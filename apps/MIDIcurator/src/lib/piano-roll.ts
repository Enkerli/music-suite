import type { Gesture, Harmonic, Leadsheet } from '../types/clip';
import { findQualityByKey } from './chord-dictionary';

/**
 * Layout constants and coordinate math for piano roll rendering.
 * Pure functions — no Canvas/DOM dependency.
 */

export interface PianoRollLayout {
  /** Total width in pixels */
  width: number;
  /** Total height in pixels */
  height: number;
  /** Pixels per tick */
  pxPerTick: number;
  /** Pixels per MIDI semitone */
  pxPerSemitone: number;
  /** Lowest MIDI note displayed */
  minPitch: number;
  /** Highest MIDI note displayed */
  maxPitch: number;
  /** Left padding for pitch labels */
  labelWidth: number;
  /** Top padding */
  topPad: number;
}

/**
 * The harmonic role of a note (or a sub-segment of a note) relative to
 * the active leadsheet chord at that moment in time.
 *
 *  'root'       — pitch class matches the chord root
 *  'chord-tone' — pitch class is in the chord template (non-root)
 *  'nct'        — pitch class is not in the chord template (non-chord tone)
 *  'none'       — no leadsheet context; rendered as plain velocity colour
 */
export type NoteRole = 'root' | 'chord-tone' | 'nct' | 'none';

/**
 * A sub-segment of a note rect that falls within a single chord window.
 * A note spanning a chord boundary will have two segments with potentially
 * different roles (e.g. chord-tone in the first chord, NCT in the second).
 */
export interface NoteRectSegment {
  /** X pixel offset from the note rect's own x (0 = note start) */
  xOffset: number;
  /** Width of this sub-segment in pixels */
  w: number;
  /** Harmonic role within this chord window */
  role: NoteRole;
}

export interface NoteRect {
  x: number;
  y: number;
  w: number;
  h: number;
  velocity: number;
  pitch: number;
  /**
   * Per-chord-window segments. Present only when a leadsheet is supplied to
   * computeNoteRects. A single-element array means the note falls entirely
   * within one chord window. Multiple elements mean the note crosses one or
   * more chord boundaries — each segment has its own role.
   */
  segments?: NoteRectSegment[];
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export function noteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[midi % 12]}${octave}`;
}

export function isBlackKey(midi: number): boolean {
  const pc = midi % 12;
  return pc === 1 || pc === 3 || pc === 6 || pc === 8 || pc === 10;
}

/**
 * Compute layout metrics from gesture/harmonic data and available canvas size.
 * Adds 2 semitones of padding above and below the pitch range.
 *
 * When zoomLevel > 1, pxPerTick increases proportionally, making the canvas
 * wider than the container (the caller is responsible for scroll overflow).
 */
export function computeLayout(
  gesture: Gesture,
  harmonic: Harmonic,
  canvasWidth: number,
  canvasHeight: number,
  zoomLevel = 1,
): PianoRollLayout {
  const labelWidth = 40;
  const topPad = 4;
  const baseDrawWidth = canvasWidth - labelWidth;
  const drawHeight = canvasHeight - topPad * 2;

  const minPitch = Math.max(0, Math.min(...harmonic.pitches) - 2);
  const maxPitch = Math.min(127, Math.max(...harmonic.pitches) + 2);
  const pitchRange = maxPitch - minPitch + 1;

  // Canvas scale = max(MIDI note extent, harmonic grid).
  // The harmonic grid (numBars * ticksPerBar) anchors bar lines correctly.
  // MIDI extent may exceed the grid if notes extend past bar boundaries.
  // We do NOT add extra padding so notes for Apple Loops that end at
  // the bar boundary (e.g. tick 3840 = bar 2 end) fill the canvas fully.
  const lastTick = gesture.onsets.length > 0
    ? Math.max(...gesture.onsets.map((onset, i) => onset + gesture.durations[i]!))
    : gesture.num_bars * gesture.ticks_per_bar;
  const totalTicks = Math.max(lastTick, gesture.num_bars * gesture.ticks_per_bar);

  const pxPerTick = (baseDrawWidth / totalTicks) * zoomLevel;
  const pxPerSemitone = drawHeight / pitchRange;

  // When zoomed, the full canvas width expands beyond the container
  const width = zoomLevel > 1
    ? Math.ceil(baseDrawWidth * zoomLevel) + labelWidth
    : canvasWidth;

  return {
    width,
    height: canvasHeight,
    pxPerTick,
    pxPerSemitone,
    minPitch,
    maxPitch,
    labelWidth,
    topPad,
  };
}

// ─── Leadsheet chord window helpers ────────────────────────────────────────

/**
 * A flat, sorted list of absolute-tick chord windows derived from a leadsheet.
 * Covers the full clip duration with no gaps.
 */
export interface ChordWindow {
  startTick: number;
  endTick: number;
  /** null = NC bar */
  templatePcs: number[] | null;
  /** root PC, or null for NC */
  rootPc: number | null;
  /** Chord quality key (e.g. "maj7", "min") for degree-name lookup, or null for NC */
  qualityKey: string | null;
}

/**
 * Build a flat, contiguous array of chord windows from a leadsheet.
 * Each LeadsheetChord's beatPosition/duration → absolute tick range.
 * Gaps (NC bars with no prior chord) remain as null-template windows.
 */
export function buildChordWindows(
  leadsheet: Leadsheet,
  ticksPerBar: number,
  ticksPerBeat: number,
  totalTicks: number,
): ChordWindow[] {
  // Collect all (startTick, endTick, chord) entries from every bar/chord
  const raw: Array<{ startTick: number; endTick: number; templatePcs: number[] | null; rootPc: number | null; qualityKey: string | null }> = [];

  for (const bar of leadsheet.bars) {
    const barStartTick = bar.bar * ticksPerBar;
    const beatsPerBar = ticksPerBar / ticksPerBeat;

    if (bar.chords.length === 0) continue;

    for (let ci = 0; ci < bar.chords.length; ci++) {
      const lc = bar.chords[ci]!;
      const bp = lc.beatPosition ?? (ci / lc.totalInBar) * beatsPerBar;
      const dur = lc.duration ?? (beatsPerBar / lc.totalInBar);
      const startTick = barStartTick + bp * ticksPerBeat;
      const endTick = barStartTick + (bp + dur) * ticksPerBeat;
      const rootPc = lc.chord?.root ?? null;
      const qualityKey = lc.chord?.qualityKey ?? null;
      // templatePcs may be absent on chords produced by parseLeadsheet (text path).
      // Reconstruct from the dictionary so texture analysis always has a template.
      let tpcs = lc.chord?.templatePcs ?? null;
      if (!tpcs && rootPc !== null && qualityKey) {
        const quality = findQualityByKey(qualityKey);
        if (quality) tpcs = quality.pcs.map(pc => (pc + rootPc) % 12).sort((a, b) => a - b);
      }
      raw.push({ startTick, endTick, templatePcs: tpcs, rootPc, qualityKey });
    }
  }

  if (raw.length === 0) return [];

  // Sort by start tick
  raw.sort((a, b) => a.startTick - b.startTick);

  // Build contiguous windows: fill any leading gap with null, then each entry
  const windows: ChordWindow[] = [];
  let cursor = 0;

  for (const entry of raw) {
    if (entry.startTick > cursor) {
      // Gap before this chord — null window
      windows.push({ startTick: cursor, endTick: entry.startTick, templatePcs: null, rootPc: null, qualityKey: null });
    }
    windows.push({ startTick: entry.startTick, endTick: entry.endTick, templatePcs: entry.templatePcs, rootPc: entry.rootPc, qualityKey: entry.qualityKey });
    cursor = entry.endTick;
  }

  // Trailing gap
  if (cursor < totalTicks) {
    windows.push({ startTick: cursor, endTick: totalTicks, templatePcs: null, rootPc: null, qualityKey: null });
  }

  return windows;
}

/**
 * Derive segment boundaries from a leadsheet by converting each chord
 * change point to an absolute tick position, then snapping each boundary
 * to the nearest note onset or note-end within `snapTolerance` ticks.
 *
 * This gives a "headstart" segmentation that corresponds to the leadsheet
 * chords but honours the actual note content (pickups, suspensions).
 *
 * @param leadsheet       The leadsheet to derive boundaries from.
 * @param ticksPerBar     Ticks per bar.
 * @param ticksPerBeat    Ticks per beat.
 * @param totalTicks      Total clip length in ticks (for clamping).
 * @param onsets          All note onset ticks (from gesture).
 * @param durations       All note duration ticks (from gesture).
 * @param snapTolerance   Max ticks to snap to a note event (default: half a beat).
 * @returns Sorted, deduplicated array of boundary tick positions.
 */
export function segmentFromLeadsheet(
  leadsheet: Leadsheet,
  ticksPerBar: number,
  ticksPerBeat: number,
  totalTicks: number,
  onsets: number[],
  durations: number[],
  snapTolerance?: number,
): number[] {
  const tol = snapTolerance ?? ticksPerBeat / 2;

  // Collect chord-change points: only where the chord actually changes.
  // Boundaries at bar lines where the chord is identical to the previous
  // window (repeat bars, sustained chords) are skipped — they produce
  // segments with identical content that add no analytical value.
  const windows = buildChordWindows(leadsheet, ticksPerBar, ticksPerBeat, totalTicks);
  const rawBoundaries: number[] = [];
  for (let i = 1; i < windows.length; i++) {
    const prev = windows[i - 1]!;
    const curr = windows[i]!;
    if (curr.startTick <= 0 || curr.startTick >= totalTicks) continue;
    // Emit a boundary only when the harmony actually changes.
    const chordChanged = curr.rootPc !== prev.rootPc || curr.qualityKey !== prev.qualityKey;
    if (chordChanged) rawBoundaries.push(curr.startTick);
  }

  if (rawBoundaries.length === 0) return [];

  // Build the set of candidate snap targets: note onsets and note ends.
  const snapTargets: number[] = [];
  for (let i = 0; i < onsets.length; i++) {
    const onset = onsets[i]!;
    const end   = onset + durations[i]!;
    if (onset > 0 && onset < totalTicks) snapTargets.push(onset);
    if (end   > 0 && end   < totalTicks) snapTargets.push(end);
  }
  snapTargets.sort((a, b) => a - b);

  // Snap each raw boundary to the nearest note event within tolerance.
  const snapped = rawBoundaries.map(raw => {
    let best = raw;
    let bestDist = tol + 1; // start beyond tolerance so we only snap if within range
    for (const t of snapTargets) {
      const d = Math.abs(t - raw);
      if (d < bestDist) { bestDist = d; best = t; }
      if (t > raw + tol) break; // sorted — no need to go further
    }
    return best;
  });

  // Remove anticipation boundaries: if a snapped boundary is within one beat
  // of the next bar line, it's a pickup/anticipation note that arrived before
  // the downbeat.  Keeping it creates a tiny trailing segment that (a) looks
  // wrong in the chord bar and (b) can't be labelled with degrees because its
  // midpoint still falls in the *previous* chord's window.  Round such
  // boundaries forward to the bar line itself so the segment starts cleanly.
  const roundedToBarLine = snapped.map(b => {
    const nextBarLine = Math.ceil(b / ticksPerBar) * ticksPerBar;
    if (nextBarLine <= b) return b; // already on a bar line
    const distToBar = nextBarLine - b;
    if (distToBar < ticksPerBeat) return nextBarLine; // anticipation — move to bar line
    return b;
  });

  // Deduplicate and sort; remove any that landed on 0 or totalTicks after rounding
  return [...new Set(roundedToBarLine)]
    .filter(b => b > 0 && b < totalTicks)
    .sort((a, b) => a - b);
}

/**
 * Classify a note's pitch class against a chord window's template.
 */
function classifyPc(pc: number, window: ChordWindow): NoteRole {
  if (window.templatePcs === null) return 'none';
  if (window.rootPc === pc) return 'root';
  if (window.templatePcs.includes(pc)) return 'chord-tone';
  return 'nct';
}

// ─── Note rectangles ────────────────────────────────────────────────────────

/**
 * Convert gesture+harmonic note data into pixel-space rectangles.
 * When `chordWindows` is supplied, each rect gains a `segments` array
 * describing the harmonic role of each portion of the note.
 */
export function computeNoteRects(
  gesture: Gesture,
  harmonic: Harmonic,
  layout: PianoRollLayout,
  chordWindows?: ChordWindow[],
): NoteRect[] {
  const rects: NoteRect[] = [];

  for (let i = 0; i < gesture.onsets.length; i++) {
    const onset = gesture.onsets[i]!;
    const duration = gesture.durations[i]!;
    const velocity = gesture.velocities[i]!;
    const pitch = harmonic.pitches[i]!;
    const pc = pitch % 12;

    const x = layout.labelWidth + onset * layout.pxPerTick;
    // Piano roll: higher pitch = higher on screen (y=0 is top)
    const y = layout.topPad + (layout.maxPitch - pitch) * layout.pxPerSemitone;
    const w = Math.max(1, duration * layout.pxPerTick);
    const h = Math.max(1, layout.pxPerSemitone - 1); // 1px gap between rows

    let segments: NoteRectSegment[] | undefined;

    if (chordWindows && chordWindows.length > 0) {
      const noteEnd = onset + duration;
      // Find all chord windows that overlap [onset, noteEnd)
      const overlapping = chordWindows.filter(
        cw => cw.startTick < noteEnd && cw.endTick > onset,
      );

      if (overlapping.length > 0) {
        segments = overlapping.map(cw => {
          const segStart = Math.max(onset, cw.startTick);
          const segEnd = Math.min(noteEnd, cw.endTick);
          const xOffset = (segStart - onset) * layout.pxPerTick;
          const segW = Math.max(1, (segEnd - segStart) * layout.pxPerTick);
          return { xOffset, w: segW, role: classifyPc(pc, cw) };
        });
      }
    }

    rects.push({ x, y, w, h, velocity, pitch, segments });
  }

  return rects;
}

/**
 * Compute the x-position of vertical beat/bar grid lines.
 */
export function computeGridLines(
  gesture: Gesture,
  layout: PianoRollLayout,
): Array<{ x: number; isBar: boolean; label: string }> {
  const lines: Array<{ x: number; isBar: boolean; label: string }> = [];

  const totalTicks = gesture.num_bars * gesture.ticks_per_bar;

  for (let tick = 0; tick <= totalTicks; tick += gesture.ticks_per_beat) {
    const x = layout.labelWidth + tick * layout.pxPerTick;
    const isBar = tick % gesture.ticks_per_bar === 0;
    const barNum = Math.floor(tick / gesture.ticks_per_bar) + 1;
    const beatInBar = Math.floor((tick % gesture.ticks_per_bar) / gesture.ticks_per_beat) + 1;
    const label = isBar ? `${barNum}` : `${barNum}.${beatInBar}`;
    lines.push({ x, isBar, label });
  }

  return lines;
}

/**
 * Convert a playback time (in seconds) to an x-position for the playhead.
 */
export function timeToX(
  seconds: number,
  bpm: number,
  ticksPerBeat: number,
  layout: PianoRollLayout,
): number {
  const beatsPerSecond = bpm / 60;
  const ticksPerSecond = beatsPerSecond * ticksPerBeat;
  const tick = seconds * ticksPerSecond;
  return layout.labelWidth + tick * layout.pxPerTick;
}

// ─── Range selection ───────────────────────────────────────────────────

/** A selected tick range on the piano roll (UI state, not clip data). */
export interface TickRange {
  /** Start tick (inclusive), snapped to beat */
  startTick: number;
  /** End tick (exclusive), snapped to beat */
  endTick: number;
}

/**
 * Convert a pixel x-coordinate to a tick value (inverse of tick-to-x).
 * Clamps to >= 0.
 */
export function xToTick(x: number, layout: PianoRollLayout): number {
  return Math.max(0, (x - layout.labelWidth) / layout.pxPerTick);
}

/**
 * Snap a tick value to the nearest beat boundary.
 */
export function snapToNearestBeat(tick: number, ticksPerBeat: number): number {
  return Math.round(tick / ticksPerBeat) * ticksPerBeat;
}

/**
 * Collect all unique note start/end boundaries, sorted.
 * Used for snap-to-note functionality.
 */
export function collectNoteBoundaries(onsets: number[], durations: number[]): number[] {
  const boundaries = new Set<number>();
  for (let i = 0; i < onsets.length; i++) {
    boundaries.add(onsets[i]!);
    boundaries.add(onsets[i]! + durations[i]!);
  }
  return [...boundaries].sort((a, b) => a - b);
}

/**
 * Snap to nearest note boundary if close, otherwise to 1/4 beat grid.
 * Provides precise selection for short chords while maintaining grid feel.
 */
export function snapToNearestBoundary(
  rawTick: number,
  boundaries: number[],
  ticksPerBeat: number,
): number {
  const NOTE_SNAP_THRESHOLD = ticksPerBeat / 8;  // 60 ticks at 480 tpb
  const GRID_UNIT = ticksPerBeat / 4;            // 120 ticks (1/4 beat)

  // Find closest boundary
  let closest = boundaries[0] ?? 0;
  let minDist = Math.abs(rawTick - closest);
  for (const b of boundaries) {
    const dist = Math.abs(rawTick - b);
    if (dist < minDist) {
      minDist = dist;
      closest = b;
    }
  }

  // Snap to boundary if within threshold
  if (minDist <= NOTE_SNAP_THRESHOLD) {
    return closest;
  }

  // Fall back to 1/4 beat grid
  return Math.round(rawTick / GRID_UNIT) * GRID_UNIT;
}

/**
 * Get the indices of notes that overlap a tick range.
 * A note overlaps if:
 *   1. Its onset is within [startTick, endTick), OR
 *   2. It started before startTick but is still sounding (onset + duration > startTick)
 */
export function getNotesInTickRange(
  onsets: number[],
  durations: number[],
  startTick: number,
  endTick: number,
): number[] {
  const indices: number[] = [];
  for (let i = 0; i < onsets.length; i++) {
    const onset = onsets[i]!;
    const dur = durations[i]!;
    const noteEnd = onset + dur;
    if ((onset >= startTick && onset < endTick) ||
        (onset < startTick && noteEnd > startTick)) {
      indices.push(i);
    }
  }
  return indices;
}

/**
 * Check if a tick range is large enough to be a meaningful selection.
 * Returns true if the range spans at least a quarter beat.
 */
export function isMinimumDrag(
  startTick: number,
  endTick: number,
  ticksPerBeat: number,
): boolean {
  return Math.abs(endTick - startTick) >= ticksPerBeat / 4;
}

/**
 * Velocity to color: low velocity = dim blue, high velocity = bright cyan/white.
 */
export function velocityColor(velocity: number): string {
  const t = velocity / 127;
  const r = Math.round(40 + t * 60);
  const g = Math.round(80 + t * 140);
  const b = Math.round(140 + t * 115);
  return `rgb(${r}, ${g}, ${b})`;
}

// ─── Scissors tool: boundary snapping ──────────────────────────────────

/**
 * Snap a raw tick position for the scissors tool.
 * Priority order:
 *   1. Note onset within tolerance (half a beat)
 *   2. Note end within tolerance
 *   3. Beat grid (if no notes nearby)
 * Shift key disables snapping entirely (caller passes `disableSnap`).
 * Never snaps more than 1 beat away from click position.
 */
export function snapForScissors(
  rawTick: number,
  onsets: number[],
  durations: number[],
  ticksPerBeat: number,
  disableSnap = false,
): number {
  if (disableSnap) return Math.max(0, Math.round(rawTick));

  const MAX_SNAP = ticksPerBeat; // never snap more than 1 beat
  const ONSET_TOLERANCE = ticksPerBeat / 2;
  const END_TOLERANCE = ticksPerBeat / 2;

  // 1. Find closest note onset
  let closestOnset = Infinity;
  let closestOnsetDist = Infinity;
  for (const onset of onsets) {
    const dist = Math.abs(rawTick - onset);
    if (dist < closestOnsetDist && dist <= ONSET_TOLERANCE && dist <= MAX_SNAP) {
      closestOnsetDist = dist;
      closestOnset = onset;
    }
  }
  if (closestOnset !== Infinity) return closestOnset;

  // 2. Find closest note end
  let closestEnd = Infinity;
  let closestEndDist = Infinity;
  for (let i = 0; i < onsets.length; i++) {
    const noteEnd = onsets[i]! + durations[i]!;
    const dist = Math.abs(rawTick - noteEnd);
    if (dist < closestEndDist && dist <= END_TOLERANCE && dist <= MAX_SNAP) {
      closestEndDist = dist;
      closestEnd = noteEnd;
    }
  }
  if (closestEnd !== Infinity) return closestEnd;

  // 3. Fall back to beat grid
  return Math.max(0, Math.round(rawTick / ticksPerBeat) * ticksPerBeat);
}

// ─── Block chord detection ─────────────────────────────────────────────

/** A group of notes that start and end together (block chord). */
export interface ChordBlock {
  startTick: number;
  endTick: number;
  noteIndices: number[];
}

/** Tolerance for "simultaneous" note starts/ends (in ticks). */
const BLOCK_TOLERANCE = 30;

/**
 * Detect chord blocks within selected notes.
 * Groups notes that start and end together into blocks.
 * Block chords = notes held together, not changing.
 */
export function detectChordBlocks(
  indices: number[],
  onsets: number[],
  durations: number[],
): ChordBlock[] {
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
  const blocks: ChordBlock[] = [];
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
