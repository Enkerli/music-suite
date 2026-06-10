import { useState, useEffect, useRef } from 'react';
import type { BarChordInfo, ChordSegment, DetectedChord, Gesture, Harmonic, Leadsheet, SegmentChordInfo } from '../types/clip';
import type { TickRange } from '../lib/piano-roll';
import { buildChordWindows } from '../lib/piano-roll';
import { describeSegmentDegrees } from '../lib/chord-detect';

interface ChordBarProps {
  barChords: BarChordInfo[];
  ticksPerBar: number;
  ticksPerBeat: number;
  /** Total tick span matching the piano roll (note extent + padding). */
  totalTicks?: number;
  /** When set, use pixel widths instead of percentages (for zoom alignment). */
  drawWidth?: number;
  selectionRange?: TickRange | null;
  onSegmentClick?: (startTick: number, endTick: number) => void;
  onChordEdit?: (startTick: number, endTick: number, newChordSymbol: string) => void;
  /** When present, render segment-based view instead of bar-based view. */
  segmentChords?: SegmentChordInfo[];
  /** Full gesture + harmonic + leadsheet — needed for texture analysis in segment view. */
  gesture?: Gesture;
  harmonic?: Harmonic;
  leadsheet?: Leadsheet;
}

/**
 * Format a chord for display in a cell or segment.
 */
function formatChordDisplay(
  chord: DetectedChord | null,
  pitchClasses: number[],
): { displayText: string; isEmpty: boolean; hasExtras: boolean } {
  if (chord) {
    const hasExtras = (chord.extras?.length ?? 0) > 0;
    return { displayText: chord.symbol, isEmpty: false, hasExtras };
  }
  if (pitchClasses.length > 0) {
    const pcsStr = `[${[...pitchClasses].sort((a, b) => a - b).join(',')}]`;
    return { displayText: `?? ${pcsStr}`, isEmpty: false, hasExtras: false };
  }
  return { displayText: '—', isEmpty: true, hasExtras: false };
}

/**
 * Inline editing input for chord symbols.
 */
function ChordEditInput({
  initialValue,
  onSubmit,
  onCancel,
}: {
  initialValue: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus and select all text when mounted
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (value.trim()) {
        onSubmit(value.trim());
      } else {
        onCancel();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      className="mc-chord-edit-input"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={onCancel}
    />
  );
}

/**
 * Render a single chord segment within a bar.
 */
function ChordSegmentCell({
  segment,
  ticksPerBar,
  pitchClasses,
  isSelected,
  isEditing,
  onClick,
  onDoubleClick,
  onEditSubmit,
  onEditCancel,
}: {
  segment: ChordSegment;
  ticksPerBar: number;
  pitchClasses: number[];
  isSelected: boolean;
  isEditing: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
  onEditSubmit?: (value: string) => void;
  onEditCancel?: () => void;
}) {
  const leftPercent = (segment.startTick / ticksPerBar) * 100;
  const widthPercent = ((segment.endTick - segment.startTick) / ticksPerBar) * 100;
  const { displayText, isEmpty, hasExtras } = formatChordDisplay(segment.chord, pitchClasses);

  return (
    <div
      className={`mc-chord-bar-segment ${isEmpty ? 'mc-chord-bar-segment--empty' : ''} ${isSelected ? 'mc-chord-bar-segment--selected' : ''} ${isEditing ? 'mc-chord-bar-segment--editing' : ''}`}
      style={{
        left: `${leftPercent}%`,
        width: `${widthPercent}%`,
        cursor: onClick ? 'pointer' : undefined,
      }}
      title={!isEditing ? (segment.chord ? segment.chord.qualityName : undefined) : undefined}
      onClick={!isEditing ? onClick : undefined}
      onDoubleClick={!isEditing ? onDoubleClick : undefined}
    >
      {isEditing && onEditSubmit && onEditCancel ? (
        <ChordEditInput
          initialValue={segment.chord?.symbol ?? ''}
          onSubmit={onEditSubmit}
          onCancel={onEditCancel}
        />
      ) : (
        <span className={`mc-chord-bar-symbol ${hasExtras ? 'mc-chord-bar-symbol--has-extras' : ''}`}>{displayText}</span>
      )}
    </div>
  );
}

/**
 * Check if a segment matches the current selection range.
 */
function isSegmentSelected(
  barIndex: number,
  segment: ChordSegment,
  ticksPerBar: number,
  selectionRange: TickRange | null | undefined,
): boolean {
  if (!selectionRange) return false;
  const barStartTick = barIndex * ticksPerBar;
  const segStartAbs = barStartTick + segment.startTick;
  const segEndAbs = barStartTick + segment.endTick;
  return selectionRange.startTick === segStartAbs && selectionRange.endTick === segEndAbs;
}

/**
 * Horizontal bar showing detected chord per bar.
 * Placed above the piano roll to show the harmonic progression.
 * Supports sub-bar segments for bars with multiple chords.
 * Click a segment or cell to select it.
 * Double-click to edit the chord symbol inline.
 */
export function ChordBar({
  barChords,
  ticksPerBar,
  ticksPerBeat,
  totalTicks: totalTicksProp,
  drawWidth,
  selectionRange,
  onSegmentClick,
  onChordEdit,
  segmentChords,
  gesture,
  harmonic,
  leadsheet,
}: ChordBarProps) {
  // Track which cell/segment is being edited: { bar, segmentIndex } or null
  // segmentIndex = -1 means editing the whole bar (single-chord cell)
  const [editingCell, setEditingCell] = useState<{ bar: number; segmentIndex: number } | null>(null);

  if (barChords.length === 0) return null;

  // Bar widths always use the harmonic grid (numBars * ticksPerBar) so bars
  // are evenly spaced regardless of MIDI note extent.
  // totalTicks (MIDI extent) is only used for segment-mode width calculations.
  const numBars = barChords.length;
  const harmonicTicks = numBars * ticksPerBar;
  const totalTicks = totalTicksProp ?? harmonicTicks;

  // When drawWidth is provided (zoom mode), use pixel widths; otherwise percentages
  const usePixelWidths = drawWidth !== undefined;
  const barWidthPercent = (1 / numBars) * 100;
  const barWidthPx = usePixelWidths ? drawWidth / numBars : 0;

  const handleDoubleClick = (bar: number, segmentIndex: number) => {
    if (onChordEdit) {
      setEditingCell({ bar, segmentIndex });
    }
  };

  const handleEditSubmit = (startTick: number, endTick: number, newSymbol: string) => {
    setEditingCell(null);
    if (onChordEdit) {
      onChordEdit(startTick, endTick, newSymbol);
    }
  };

  const handleEditCancel = () => {
    setEditingCell(null);
  };

  // Helper: width style for a given tick span
  const widthStyle = (ticks: number) =>
    usePixelWidths
      ? { width: `${(ticks / totalTicks) * drawWidth}px` }
      : { width: `${(ticks / totalTicks) * 100}%` };

  // Total container width when zoomed
  const containerStyle = usePixelWidths
    ? { width: `${drawWidth}px` }
    : undefined;

  // Build chord windows once — used for texture analysis in both rendering paths
  const chordWindows = (leadsheet && gesture)
    ? buildChordWindows(leadsheet, ticksPerBar, ticksPerBeat, totalTicks)
    : null;

  /**
   * Collect MIDI pitches sounding within [startTick, endTick).
   * Includes notes that onset in the range or sustain into it from before.
   */
  const getSegmentPitches = (startTick: number, endTick: number): number[] => {
    if (!gesture || !harmonic) return [];
    const pitches: number[] = [];
    for (let i = 0; i < gesture.onsets.length; i++) {
      const onset = gesture.onsets[i]!;
      const dur   = gesture.durations[i]!;
      if ((onset >= startTick && onset < endTick) ||
          (onset < startTick && onset + dur > startTick)) {
        pitches.push(harmonic.pitches[i]!);
      }
    }
    return pitches;
  };

  /**
   * Return the best informative label for a tick range:
   *   - When a leadsheet is present: degree description ("R 3 ♭7") or null (NC/empty segment).
   *     No texture heuristic fallback — the leadsheet context is authoritative.
   *   - When no leadsheet: texture heuristic (block/arp/etc.) if gesture+harmonic available.
   */
  /**
   * When a leadsheet is present: returns the degree label (replaces chord symbol).
   * When no leadsheet: returns null (chord symbol is kept; use getTextureGlyph for decoration).
   */
  const getSegmentLabel = (startTick: number, endTick: number): string | null => {
    if (!gesture || !harmonic || !chordWindows) return null;
    const segPitches = getSegmentPitches(startTick, endTick);

    // Try candidate windows in priority order: midpoint, then start, then end.
    // This handles boundary segments that straddle two chord windows — the
    // midpoint window may be wrong if the segment is very short.
    const mid = (startTick + endTick) / 2;
    const candidatePositions = [mid, startTick + 1, endTick - 1];
    const seenWindowStarts = new Set<number>();

    for (const pos of candidatePositions) {
      const w = chordWindows.find(w => w.startTick <= pos && w.endTick > pos);
      if (!w || w.rootPc === null) continue;
      if (seenWindowStarts.has(w.startTick)) continue; // already tried this window
      seenWindowStarts.add(w.startTick);
      const degrees = describeSegmentDegrees(segPitches, w.rootPc, w.qualityKey ?? null);
      if (degrees) return degrees;
    }
    return null;
  };

  // getTextureGlyph removed — texture feature disabled pending calibration

  // ─── Segment-based rendering (when segmentation boundaries exist) ────
  if (segmentChords && segmentChords.length > 0) {

    return (
      <div className="mc-chord-bar" style={containerStyle}>
        {segmentChords.map((seg) => {
          const { displayText, isEmpty, hasExtras } = formatChordDisplay(seg.chord, seg.pitchClasses);
          const isSelected = selectionRange
            && selectionRange.startTick === seg.startTick
            && selectionRange.endTick === seg.endTick;

          const segmentLabel = getSegmentLabel(seg.startTick, seg.endTick);
          const textureGlyph = null; // disabled pending calibration

          const titleSuffix = segmentLabel ? ` · ${segmentLabel}` : '';
          const title = seg.chord
            ? `Segment ${seg.index + 1}: ${seg.chord.symbol} (${seg.chord.qualityName})${titleSuffix}`
            : `Segment ${seg.index + 1}: ${seg.pitchClasses.length > 0 ? `[${seg.pitchClasses.join(',')}]` : 'no notes'}${titleSuffix}`;

          return (
            <div
              key={seg.index}
              className={`mc-chord-bar-cell mc-chord-bar-cell--segment-mode ${isEmpty ? 'mc-chord-bar-cell--empty' : ''} ${isSelected ? 'mc-chord-bar-cell--selected' : ''}`}
              style={{
                ...widthStyle(seg.endTick - seg.startTick),
                cursor: onSegmentClick ? 'pointer' : undefined,
              }}
              title={title}
              onClick={onSegmentClick ? () => onSegmentClick(seg.startTick, seg.endTick) : undefined}
            >
              {segmentLabel ? (
                // Leadsheet context: degree label replaces chord symbol (symbol already
                // shown in the leadsheet bar above).
                <span className="mc-chord-bar-degrees">{segmentLabel}</span>
              ) : (
                // No leadsheet: show chord symbol, with optional texture glyph alongside.
                <span className={`mc-chord-bar-symbol ${hasExtras ? 'mc-chord-bar-symbol--has-extras' : ''}`}>
                  {displayText}
                  {textureGlyph && (
                    <span className="mc-chord-bar-texture-glyph">{textureGlyph}</span>
                  )}
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // ─── Bar-based rendering (default, no segmentation) ──────────────────
  return (
    <div className="mc-chord-bar" style={containerStyle}>
      {barChords.map((bc) => {
        // Check if this bar has multiple segments
        const hasSegments = bc.segments && bc.segments.length > 1;
        const barStartTick = bc.bar * ticksPerBar;

        if (hasSegments) {
          // Render segmented bar with chord inheritance
          let prevChord: DetectedChord | null = null;
          return (
            <div
              key={bc.bar}
              className="mc-chord-bar-cell mc-chord-bar-cell--segmented"
              style={{ ...(usePixelWidths ? { width: `${barWidthPx}px` } : { width: `${barWidthPercent}%` }) }}
              title={`Bar ${bc.bar + 1}: ${bc.segments!.length} segments`}
            >
              {bc.segments!.map((seg, i) => {
                // Use previous chord if this segment has no chord (resonance principle)
                const effectiveChord = seg.chord ?? prevChord;
                if (seg.chord) prevChord = seg.chord; // Update for next segment

                const effectiveSeg = { ...seg, chord: effectiveChord };
                const isSelected = isSegmentSelected(bc.bar, seg, ticksPerBar, selectionRange);
                const isEditing = editingCell?.bar === bc.bar && editingCell?.segmentIndex === i;
                const segStartAbs = barStartTick + seg.startTick;
                const segEndAbs = barStartTick + seg.endTick;

                return (
                  <ChordSegmentCell
                    key={i}
                    segment={effectiveSeg}
                    ticksPerBar={ticksPerBar}
                    pitchClasses={bc.pitchClasses}
                    isSelected={isSelected}
                    isEditing={isEditing}
                    onClick={
                      onSegmentClick
                        ? () => onSegmentClick(segStartAbs, segEndAbs)
                        : undefined
                    }
                    onDoubleClick={() => handleDoubleClick(bc.bar, i)}
                    onEditSubmit={(value) => handleEditSubmit(segStartAbs, segEndAbs, value)}
                    onEditCancel={handleEditCancel}
                  />
                );
              })}
            </div>
          );
        }

        // Single chord (or single segment) - render normally
        const effectiveChord = bc.segments?.[0]?.chord ?? bc.chord;
        const { displayText, isEmpty, hasExtras } = formatChordDisplay(effectiveChord, bc.pitchClasses);

        // Check if this whole bar is selected
        const barEndTick = barStartTick + ticksPerBar;
        const isBarSelected =
          selectionRange &&
          selectionRange.startTick === barStartTick &&
          selectionRange.endTick === barEndTick;
        const isEditing = editingCell?.bar === bc.bar && editingCell?.segmentIndex === -1;

        const segmentLabel = !isEditing ? getSegmentLabel(barStartTick, barEndTick) : null;

        const extrasInfo = hasExtras && effectiveChord?.extras
          ? ` | extras: [${effectiveChord.extras.join(',')}]`
          : '';
        const textureSuffix = segmentLabel ? ` · ${segmentLabel}` : '';
        const titleText = effectiveChord
          ? `Bar ${bc.bar + 1}: ${effectiveChord.symbol} (${effectiveChord.qualityName})${extrasInfo}${textureSuffix}`
          : bc.pitchClasses.length > 0
            ? `Bar ${bc.bar + 1}: unrecognized structure [${bc.pitchClasses.sort((a, b) => a - b).join(',')}]`
            : `Bar ${bc.bar + 1}: no notes`;

        return (
          <div
            key={bc.bar}
            className={`mc-chord-bar-cell mc-chord-bar-cell--segment-mode ${isEmpty ? 'mc-chord-bar-cell--empty' : ''} ${isBarSelected ? 'mc-chord-bar-cell--selected' : ''} ${isEditing ? 'mc-chord-bar-cell--editing' : ''}`}
            style={{
              ...(usePixelWidths ? { width: `${barWidthPx}px` } : { width: `${barWidthPercent}%` }),
              cursor: onSegmentClick ? 'pointer' : undefined,
            }}
            title={!isEditing ? titleText : undefined}
            onClick={!isEditing && onSegmentClick ? () => onSegmentClick(barStartTick, barEndTick) : undefined}
            onDoubleClick={!isEditing ? () => handleDoubleClick(bc.bar, -1) : undefined}
          >
            {isEditing ? (
              <ChordEditInput
                initialValue={effectiveChord?.symbol ?? ''}
                onSubmit={(value) => handleEditSubmit(barStartTick, barEndTick, value)}
                onCancel={handleEditCancel}
              />
            ) : (
              <>
                {segmentLabel ? (
                  <span className="mc-chord-bar-degrees">{segmentLabel}</span>
                ) : (
                  <span className={`mc-chord-bar-symbol ${hasExtras ? 'mc-chord-bar-symbol--has-extras' : ''}`}>{displayText}</span>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
