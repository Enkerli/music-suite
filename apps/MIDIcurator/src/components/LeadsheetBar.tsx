import { useCallback, useRef, useState } from 'react';
import type { Leadsheet, LeadsheetChord } from '../types/clip';

interface LeadsheetBarProps {
  leadsheet: Leadsheet;
  ticksPerBar: number;
  ticksPerBeat: number;
  numBars: number;
  /** When set, use pixel widths instead of percentages (for zoom alignment). */
  drawWidth?: number;
  /**
   * Called when the user drags a chord boundary divider.
   * @param barIndex       0-based bar index
   * @param boundaryIndex  0-based index of the divider (0 = between chord 0 and 1, etc.)
   * @param newBeatPosition New beat position (beats from bar start) of that boundary
   */
  onBoundaryMove?: (barIndex: number, boundaryIndex: number, newBeatPosition: number) => void;
}

/**
 * Bar-quantized leadsheet display showing the underlying harmony.
 * Rendered above the realized ChordBar.
 *
 * Drag the vertical dividers between chords to adjust their relative durations.
 */
export function LeadsheetBar({
  leadsheet,
  ticksPerBar,
  ticksPerBeat,
  numBars,
  drawWidth,
  onBoundaryMove,
}: LeadsheetBarProps) {
  if (leadsheet.bars.length === 0) return null;

  // Use bar grid (numBars * ticksPerBar) for harmonic alignment, not totalTicks (MIDI extent)
  const harmonicTicks = numBars * ticksPerBar;

  const usePixelWidths = drawWidth !== undefined;
  const barWidthPercent = (ticksPerBar / harmonicTicks) * 100;
  const barWidthPx = usePixelWidths ? (ticksPerBar / harmonicTicks) * drawWidth : 0;
  const barWidthStyle = usePixelWidths
    ? { width: `${barWidthPx}px` }
    : { width: `${barWidthPercent}%` };
  const containerStyle = usePixelWidths ? { width: `${drawWidth}px` } : undefined;

  const beatsPerBar = ticksPerBar / ticksPerBeat;

  /**
   * Calculate chord style (position and width) based on beat timing.
   * Falls back to equal division if timing is not specified.
   */
  const getChordStyle = (
    chord: LeadsheetChord,
    chordIndex: number,
  ): React.CSSProperties => {
    // If chord has explicit beat position and duration, use those
    if (chord.beatPosition !== undefined && chord.duration !== undefined) {
      const leftPercent = (chord.beatPosition / beatsPerBar) * 100;
      const widthPercent = (chord.duration / beatsPerBar) * 100;
      return {
        position: 'absolute',
        left: `${leftPercent}%`,
        width: `${widthPercent}%`,
      };
    }

    // Fallback: equal division based on totalInBar
    const widthPercent = 100 / chord.totalInBar;
    const leftPercent = chordIndex * widthPercent;
    return {
      position: 'absolute',
      left: `${leftPercent}%`,
      width: `${widthPercent}%`,
    };
  };

  return (
    <div className="mc-leadsheet-bar" style={containerStyle}>
      {Array.from({ length: numBars }, (_, i) => {
        const bar = leadsheet.bars.find(b => b.bar === i);

        if (!bar || bar.chords.length === 0) {
          return (
            <div
              key={i}
              className="mc-leadsheet-cell mc-leadsheet-cell--nc"
              style={barWidthStyle}
              title={`Bar ${i + 1}: no chord`}
            >
              <span className="mc-leadsheet-chord mc-leadsheet-chord--nc">NC</span>
            </div>
          );
        }

        if (bar.isRepeat) {
          return (
            <div
              key={i}
              className="mc-leadsheet-cell mc-leadsheet-cell--repeat"
              style={barWidthStyle}
              title={`Bar ${i + 1}: repeat`}
            >
              <span className="mc-leadsheet-chord mc-leadsheet-chord--repeat">%</span>
            </div>
          );
        }

        // Detect a carried chord: a single-chord bar whose chord is identical
        // to the previous bar's last chord (same root + quality). These arise
        // when Apple Loop chords span multiple bars and we extend them forward.
        // Display a continuation marker instead of repeating the symbol.
        const prevBar = i > 0 ? leadsheet.bars.find(b => b.bar === i - 1) : null;
        const prevLastChordObj = prevBar ? prevBar.chords[prevBar.chords.length - 1] : null;
        const prevChord = prevLastChordObj?.chord ?? null;
        const thisChord = bar.chords.length === 1 ? bar.chords[0]!.chord : null;
        const isCarried = !bar.isRepeat
          && thisChord !== null
          && prevChord !== null
          && thisChord.root === prevChord.root
          && thisChord.qualityKey === prevChord.qualityKey;

        if (isCarried) {
          // If the source chord started in the last quarter of the previous bar
          // (beatPosition > 75%), its label is unreadable in that tiny sliver.
          // Show the symbol here instead of a dash, so it's legible.
          const prevBeatPos = prevLastChordObj?.beatPosition;
          const sourceLate = prevBeatPos !== undefined && prevBeatPos >= beatsPerBar * 0.75;
          return (
            <div
              key={i}
              className={`mc-leadsheet-cell mc-leadsheet-cell--carried${sourceLate ? ' mc-leadsheet-cell--carried-label' : ''}`}
              style={barWidthStyle}
              title={`Bar ${i + 1}: ${thisChord!.symbol} (continued)`}
            >
              {sourceLate ? (
                <span className="mc-leadsheet-chord mc-leadsheet-chord--carried-label">{thisChord!.symbol}</span>
              ) : (
                <span className="mc-leadsheet-chord mc-leadsheet-chord--carried">—</span>
              )}
            </div>
          );
        }

        // Single or multi-chord bar
        const isNc = bar.chords.length === 1 && !bar.chords[0]!.chord && bar.chords[0]!.inputText.toUpperCase() === 'NC';
        if (isNc) {
          return (
            <div
              key={i}
              className="mc-leadsheet-cell mc-leadsheet-cell--nc"
              style={barWidthStyle}
              title={`Bar ${i + 1}: no chord`}
            >
              <span className="mc-leadsheet-chord mc-leadsheet-chord--nc">NC</span>
            </div>
          );
        }

        const hasMultiple = bar.chords.length > 1;

        return (
          <div
            key={i}
            className="mc-leadsheet-cell"
            style={{ ...barWidthStyle, position: 'relative' }}
            title={`Bar ${i + 1}: ${bar.chords.map(c => c.chord?.symbol ?? c.inputText).join(' ')}`}
          >
            {bar.chords.map((lc, j) => {
              const isInvalid = !lc.chord && lc.inputText.toUpperCase() !== 'NC';
              return (
                <span
                  key={j}
                  className={`mc-leadsheet-chord ${isInvalid ? 'mc-leadsheet-chord--invalid' : ''}`}
                  style={getChordStyle(lc, j)}
                >
                  {lc.chord?.symbol ?? lc.inputText}
                </span>
              );
            })}
            {/* Drag handles between adjacent chords */}
            {hasMultiple && onBoundaryMove && bar.chords.slice(0, -1).map((_lc, j) => {
              // The boundary position = start of chord j+1
              const nextChord = bar.chords[j + 1]!;
              const boundaryBeat = nextChord.beatPosition !== undefined
                ? nextChord.beatPosition
                : ((j + 1) / bar.chords.length) * beatsPerBar;
              const leftPercent = (boundaryBeat / beatsPerBar) * 100;

              return (
                <LeadsheetDragHandle
                  key={`handle-${j}`}
                  leftPercent={leftPercent}
                  barIndex={i}
                  boundaryIndex={j}
                  beatsPerBar={beatsPerBar}
                  chords={bar.chords}
                  onBoundaryMove={onBoundaryMove}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ─── Drag Handle Component ────────────────────────────────────────────────────

interface LeadsheetDragHandleProps {
  leftPercent: number;
  barIndex: number;
  boundaryIndex: number;
  beatsPerBar: number;
  chords: LeadsheetChord[];
  onBoundaryMove: (barIndex: number, boundaryIndex: number, newBeatPosition: number) => void;
}

const SNAP_BEATS = 0.25; // Snap to quarter-beat grid

function LeadsheetDragHandle({
  leftPercent,
  barIndex,
  boundaryIndex,
  beatsPerBar,
  chords,
  onBoundaryMove,
}: LeadsheetDragHandleProps) {
  const handleRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{
    startX: number;
    startBeat: number;
    cellWidth: number;
    minBeat: number;
    maxBeat: number;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const cell = handleRef.current?.parentElement;
    if (!cell) return;

    const cellRect = cell.getBoundingClientRect();
    const cellWidthPx = cellRect.width;

    // Current boundary position in beats
    const currentBeat = (leftPercent / 100) * beatsPerBar;

    // Minimum: must stay at least 0.25 beats after the START of previous chord (chord[boundaryIndex])
    const prevChord = chords[boundaryIndex]!;
    const prevStart = prevChord.beatPosition !== undefined
      ? prevChord.beatPosition
      : (boundaryIndex / chords.length) * beatsPerBar;
    const minBeat = prevStart + SNAP_BEATS;

    // Maximum: must stay at least 0.25 beats before the END of the next chord (chord[boundaryIndex+1])
    const nextChord = chords[boundaryIndex + 1]!;
    const nextEnd = nextChord.beatPosition !== undefined && nextChord.duration !== undefined
      ? nextChord.beatPosition + nextChord.duration
      : ((boundaryIndex + 2) / chords.length) * beatsPerBar;
    const maxBeat = nextEnd - SNAP_BEATS;

    dragState.current = {
      startX: e.clientX,
      startBeat: currentBeat,
      cellWidth: cellWidthPx,
      minBeat,
      maxBeat,
    };
    setIsDragging(true);

    const onMouseMove = (me: MouseEvent) => {
      if (!dragState.current) return;
      const { startX, startBeat, cellWidth, minBeat, maxBeat } = dragState.current;
      const dx = me.clientX - startX;
      const beatDelta = (dx / cellWidth) * beatsPerBar;
      let newBeat = startBeat + beatDelta;

      // Snap to grid
      newBeat = Math.round(newBeat / SNAP_BEATS) * SNAP_BEATS;

      // Clamp
      newBeat = Math.max(minBeat, Math.min(maxBeat, newBeat));

      onBoundaryMove(barIndex, boundaryIndex, newBeat);
    };

    const onMouseUp = () => {
      dragState.current = null;
      setIsDragging(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [leftPercent, barIndex, boundaryIndex, beatsPerBar, chords, onBoundaryMove]);

  return (
    <div
      ref={handleRef}
      className={`mc-leadsheet-divider${isDragging ? ' mc-leadsheet-divider--dragging' : ''}`}
      style={{ left: `${leftPercent}%` }}
      onMouseDown={handleMouseDown}
      title="Drag to adjust chord boundary"
    />
  );
}
