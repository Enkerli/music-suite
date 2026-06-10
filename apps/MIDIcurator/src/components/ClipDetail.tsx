import { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import type { Clip, DetectedChord } from '../types/clip';
import type { PlaybackState } from '../lib/playback';
import type { TickRange } from '../lib/piano-roll';
import { StatsGrid } from './StatsGrid';
import { PianoRoll } from './PianoRoll';
import { ChordBar } from './ChordBar';
import { LeadsheetBar } from './LeadsheetBar';
import { LeadsheetInput } from './LeadsheetInput';
import { TransportBar } from './TransportBar';
import { TagEditor } from './TagEditor';
import { TransformControls } from './TransformControls';
import { VpIntensityControls } from './VpIntensityControls';
import { GeneralIntensityControls } from './GeneralIntensityControls';
import { ChordRealizeControls } from './ChordRealizeControls';
import type { IntensityPreset } from '../lib/intensity-synthesis';
import { ActionBar } from './ActionBar';
import { VariantInfo } from './VariantInfo';
import { downloadChordDebug } from '../lib/midi-export';
import { parseChordSymbol } from '../lib/chord-parser';
import { getEffectiveBarChords } from '../lib/gesture';

interface ClipDetailProps {
  clip: Clip;
  clips: Clip[];
  tags: string[];
  newTag: string;
  onNewTagChange: (value: string) => void;
  onAddTag: () => void;
  editingBpm: boolean;
  bpmValue: string;
  onBpmChange: (value: string) => void;
  onBpmSave: () => void;
  onStartEditBpm: () => void;
  densityMultiplier: number;
  onDensityChange: (value: number) => void;
  onGenerateSingle: () => void;
  onGenerateVariants: () => void;
  onDownload: () => void;
  onDelete: () => void;
  onDownloadVariantsZip: () => void;
  playbackState: PlaybackState;
  playbackTime: number;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  selectionRange: TickRange | null;
  onRangeSelect: (range: TickRange | null) => void;
  rangeChordInfo: {
    chord: DetectedChord | null;
    pitchClasses: number[];
    noteCount: number;
  } | null;
  onOverrideChord: () => void;
  onAdaptChord?: (newChord: DetectedChord) => void;
  scissorsMode: boolean;
  onToggleScissors: () => void;
  onAddBoundary: (tick: number) => void;
  onRemoveBoundary: (tick: number) => void;
  onMoveBoundary: (fromTick: number, toTick: number) => void;
  /** When present, auto-segment from leadsheet boundaries is available. */
  onSegmentFromLeadsheet?: () => void;
  onFilterByTag?: (tag: string) => void;
  onLeadsheetChange?: (inputText: string) => void;
  onLeadsheetBoundaryMove?: (barIndex: number, boundaryIndex: number, newBeatPosition: number) => void;
  /** Sibling VP clips at other intensity levels (same source + pattern). */
  vpSiblings?: Clip[];
  /** Called when the user requests a synthesized intensity variant (either direction). */
  onSynthesizeIntensity?: (targetIntensity: string) => void;
  /** Called to batch-synthesize multiple intensity variants at once. */
  onSynthesizeAllIntensities?: (targets: string[]) => void;
  /** Called to synthesize an intensity variant for any clip (ratio-based). */
  onSynthesizeGeneralIntensity?: (preset: IntensityPreset) => void;
  /** Called when the user requests a chord realization (degree-mapped pitch transform). */
  onRealizeForChord?: (sourceChord: DetectedChord, targetChord: DetectedChord) => void;
}

export function ClipDetail({
  clip,
  clips,
  tags,
  newTag,
  onNewTagChange,
  onAddTag,
  editingBpm,
  bpmValue,
  onBpmChange,
  onBpmSave,
  onStartEditBpm,
  densityMultiplier,
  onDensityChange,
  onGenerateSingle,
  onGenerateVariants,
  onDownload,
  onDelete,
  onDownloadVariantsZip,
  playbackState,
  playbackTime,
  onPlay,
  onPause,
  onStop,
  selectionRange,
  onRangeSelect,
  rangeChordInfo,
  onOverrideChord,
  onAdaptChord,
  scissorsMode,
  onToggleScissors,
  onAddBoundary,
  onRemoveBoundary,
  onMoveBoundary,
  onFilterByTag,
  onLeadsheetChange,
  onLeadsheetBoundaryMove,
  onSegmentFromLeadsheet,
  vpSiblings = [],
  onSynthesizeIntensity,
  onSynthesizeAllIntensities,
  onSynthesizeGeneralIntensity,
  onRealizeForChord,
}: ClipDetailProps) {
  const sourceClip = clip.source ? clips.find(c => c.id === clip.source) : undefined;
  const variantCount = clips.filter(c => c.source === clip.id).length;
  const hasFilenameMatch = clip.filename.match(/(\d+)[-_\s]?bpm/i);

  // totalTicks = max(MIDI note extent, harmonic grid), matching piano-roll.ts.
  // Used for segment-mode chord bar tick↔pixel mapping and playhead auto-scroll.
  // Bar widths in ChordBar and LeadsheetBar always use numBars * ticksPerBar independently.
  const totalTicks = useMemo(() => {
    const { onsets, durations, num_bars, ticks_per_bar } = clip.gesture;
    const lastTick = onsets.length > 0
      ? Math.max(...onsets.map((onset, i) => onset + durations[i]!))
      : num_bars * ticks_per_bar;
    return Math.max(lastTick, num_bars * ticks_per_bar);
  }, [clip.gesture]);

  // ─── Zoom state ────────────────────────────────────────────────────
  const [zoomLevel, setZoomLevel] = useState(1);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const labelWidth = 40;

  // Track container width via ResizeObserver
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // drawWidth = the pixel width of the drawing area (excluding labels), scaled by zoom
  const drawWidth = containerWidth > 0
    ? (containerWidth - labelWidth) * zoomLevel
    : undefined;

  // Reset zoom when switching clips
  useEffect(() => {
    setZoomLevel(1);
  }, [clip.id]);

  const handleZoomChange = useCallback((newZoom: number) => {
    setZoomLevel(newZoom);
  }, []);

  // Auto-scroll to keep playhead visible during playback
  useEffect(() => {
    if (playbackState !== 'playing' || zoomLevel <= 1) return;
    const container = scrollContainerRef.current;
    if (!container || containerWidth <= 0) return;

    const baseDrawWidth = containerWidth - labelWidth;
    const pxPerTick = (baseDrawWidth / totalTicks) * zoomLevel;
    const beatsPerSecond = clip.bpm / 60;
    const ticksPerSecond = beatsPerSecond * clip.gesture.ticks_per_beat;
    const playheadX = labelWidth + playbackTime * ticksPerSecond * pxPerTick;

    const viewLeft = container.scrollLeft;
    const viewRight = viewLeft + containerWidth;

    // Scroll when playhead exits the visible viewport
    if (playheadX < viewLeft + labelWidth || playheadX > viewRight - 40) {
      container.scrollLeft = playheadX - containerWidth / 3;
    }
  }, [playbackTime, playbackState, zoomLevel, containerWidth, totalTicks, clip.bpm, clip.gesture.ticks_per_beat, labelWidth]);

  // Handle inline chord editing from chord bar
  const handleChordBarEdit = useCallback(
    (startTick: number, endTick: number, newSymbol: string) => {
      const parsed = parseChordSymbol(newSymbol);
      if (parsed && onAdaptChord) {
        // First select the range, then adapt
        onRangeSelect({ startTick, endTick });
        // Use setTimeout to ensure selection is applied before adaptation
        setTimeout(() => onAdaptChord(parsed), 0);
      }
    },
    [onRangeSelect, onAdaptChord],
  );

  return (
    <div className="mc-main">
      <h1>{clip.filename}</h1>

      <div className="mc-piano-roll-section">
        <div className="mc-piano-roll-toolbar">
          <TransportBar
            state={playbackState}
            currentTime={playbackTime}
            onPlay={onPlay}
            onPause={onPause}
            onStop={onStop}
          />
          <button
            className={`mc-btn--tool ${scissorsMode ? 'mc-btn--tool-active' : ''}`}
            onClick={onToggleScissors}
            title={scissorsMode ? 'Exit scissors mode (S or Esc)' : 'Scissors tool — click to add a boundary, click a boundary to remove it, drag to move (S)'}
          >
            ✂
          </button>
          {onSegmentFromLeadsheet && (
            <button
              className="mc-btn--tool"
              onClick={onSegmentFromLeadsheet}
              title="Auto-segment from leadsheet chord boundaries"
            >
              ♩÷
            </button>
          )}
          <div className="mc-zoom-controls">
            <button
              className="mc-btn--tool"
              onClick={() => setZoomLevel(z => Math.max(1, z / 1.3))}
              disabled={zoomLevel <= 1}
              title="Zoom out"
            >
              −
            </button>
            <span
              className="mc-zoom-label"
              title="Double-click to reset zoom"
              onDoubleClick={() => setZoomLevel(1)}
            >
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              className="mc-btn--tool"
              onClick={() => setZoomLevel(z => Math.min(10, z * 1.3))}
              disabled={zoomLevel >= 10}
              title="Zoom in"
            >
              +
            </button>
          </div>
        </div>
        {clip.harmonic.barChords && clip.harmonic.barChords.length > 0 && (
          <LeadsheetInput
            value={clip.leadsheet?.inputText ?? ''}
            numBars={clip.gesture.num_bars}
            onSubmit={onLeadsheetChange ?? (() => {})}
            harmonic={clip.harmonic}
          />
        )}
        <div
          ref={scrollContainerRef}
          className="mc-piano-roll-scroll"
        >
        {clip.harmonic.barChords && clip.harmonic.barChords.length > 0 && clip.leadsheet && clip.leadsheet.bars.length > 0 && (
            <LeadsheetBar
              leadsheet={clip.leadsheet}
              ticksPerBar={clip.gesture.ticks_per_bar}
              ticksPerBeat={clip.gesture.ticks_per_beat}
              numBars={clip.gesture.num_bars}
              drawWidth={drawWidth}
              onBoundaryMove={onLeadsheetBoundaryMove}
            />
        )}
        {clip.harmonic.barChords && clip.harmonic.barChords.length > 0 && (
          <ChordBar
            barChords={getEffectiveBarChords(clip) ?? clip.harmonic.barChords}
            ticksPerBar={clip.gesture.ticks_per_bar}
            ticksPerBeat={clip.gesture.ticks_per_beat}
            totalTicks={totalTicks}
            drawWidth={drawWidth}
            selectionRange={selectionRange}
            onSegmentClick={(startTick, endTick) => onRangeSelect({ startTick, endTick })}
            onChordEdit={handleChordBarEdit}
            segmentChords={clip.segmentation?.segmentChords}
            gesture={clip.gesture}
            harmonic={clip.harmonic}
            leadsheet={clip.leadsheet}
          />
        )}
        <PianoRoll
          clip={clip}
          playbackTime={playbackTime}
          isPlaying={playbackState === 'playing'}
          height={240}
          zoomLevel={zoomLevel}
          onZoomChange={handleZoomChange}
          selectionRange={selectionRange}
          onRangeSelect={onRangeSelect}
          scissorsMode={scissorsMode}
          boundaries={clip.segmentation?.boundaries ?? []}
          onBoundaryAdd={onAddBoundary}
          onBoundaryRemove={onRemoveBoundary}
          onBoundaryMove={onMoveBoundary}
        />
        </div>
      </div>

      <StatsGrid
        clip={clip}
        editingBpm={editingBpm}
        bpmValue={bpmValue}
        onBpmChange={onBpmChange}
        onBpmSave={onBpmSave}
        onStartEditBpm={onStartEditBpm}
        playbackTime={playbackTime}
        isPlaying={playbackState === 'playing'}
        rangeChordInfo={rangeChordInfo}
        onOverrideChord={onOverrideChord}
        onAdaptChord={onAdaptChord}
        onFilterByTag={onFilterByTag}
      />

      <div className="mc-debug-info">
        <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>Timing Debug Info:</strong>
          <button
            className="mc-btn--small"
            onClick={() => downloadChordDebug(clip)}
            title="Download detailed chord detection data as JSON"
          >
            Export Chord Debug
          </button>
        </div>
        <div>
          Ticks per beat:{' '}
          <span className="mc-debug-highlight">
            {clip.gesture.ticks_per_beat || 'not stored'}
          </span>
        </div>
        <div>Ticks per bar: {clip.gesture.ticks_per_bar}</div>
        <div>Bars: {clip.gesture.num_bars}</div>
        <div>
          BPM: <span className="mc-debug-highlight">{clip.bpm}</span>
          {hasFilenameMatch && (
            <span className="mc-debug-filename-tag">(from filename)</span>
          )}
        </div>
        <div className="mc-debug-separator">
          First note: tick {clip.gesture.onsets[0]}, pitch {clip.harmonic.pitches[0]}
        </div>
        <div>Last note onset: tick {clip.gesture.onsets[clip.gesture.onsets.length - 1]}</div>
        <div>Canvas scale: {totalTicks} ticks ({clip.gesture.num_bars} bars × {clip.gesture.ticks_per_bar})</div>
        <div className="mc-debug-hint">
          Click the BPM value above to edit it if the tempo is wrong
        </div>
      </div>

      <TagEditor
        tags={tags}
        newTag={newTag}
        onNewTagChange={onNewTagChange}
        onAddTag={onAddTag}
        onTagClick={onFilterByTag}
      />

      {clip.vpMeta && onSynthesizeIntensity && (
        <VpIntensityControls
          clip={clip}
          siblings={vpSiblings}
          onSynthesize={onSynthesizeIntensity}
          onSynthesizeAll={onSynthesizeAllIntensities}
        />
      )}

      {!clip.vpMeta && onSynthesizeGeneralIntensity && (
        <GeneralIntensityControls
          clip={clip}
          onSynthesize={onSynthesizeGeneralIntensity}
        />
      )}

      {onRealizeForChord && (
        <ChordRealizeControls
          clip={clip}
          onRealize={onRealizeForChord}
        />
      )}

      <TransformControls
        densityMultiplier={densityMultiplier}
        onDensityChange={onDensityChange}
        noteCount={clip.gesture.onsets.length}
      />

      <ActionBar
        onGenerateSingle={onGenerateSingle}
        onGenerateVariants={onGenerateVariants}
        onDownload={onDownload}
        onDelete={onDelete}
      />

      <div className="mc-zip-download">
        <button className="mc-btn--zip" onClick={onDownloadVariantsZip}>
          Download All Variants as ZIP ({variantCount})
        </button>
      </div>

      <VariantInfo clip={clip} sourceClip={sourceClip} />

      {clip.notes && (
        <div className="mc-clip-notes">
          <strong>Notes:</strong>
          <div className="mc-clip-notes-content">{clip.notes}</div>
        </div>
      )}
    </div>
  );
}
