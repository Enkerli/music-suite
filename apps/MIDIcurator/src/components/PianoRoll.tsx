import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import type { Clip } from '../types/clip';
import {
  computeLayout,
  computeNoteRects,
  buildChordWindows,
  computeGridLines,
  timeToX,
  velocityColor,
  isBlackKey,
  noteName,
  xToTick,
  collectNoteBoundaries,
  snapToNearestBoundary,
  isMinimumDrag,
  snapForScissors,
} from '../lib/piano-roll';
import type { PianoRollLayout, TickRange, NoteRole, ChordWindow } from '../lib/piano-roll';

interface PianoRollProps {
  clip: Clip;
  /** Current playback time in seconds (0 when stopped) */
  playbackTime: number;
  /** Whether playback is active (controls playhead visibility) */
  isPlaying: boolean;
  /** Canvas height in CSS pixels */
  height?: number;
  /** Zoom level (1 = fit to width, >1 = zoomed in) */
  zoomLevel?: number;
  /** Called when user zooms via Ctrl/Cmd+wheel */
  onZoomChange?: (newZoom: number) => void;
  /** Snapped tick range to highlight (null = no selection) */
  selectionRange: TickRange | null;
  /** Called when user completes a drag selection or clicks to clear */
  onRangeSelect: (range: TickRange | null) => void;
  /** Whether scissors mode is active */
  scissorsMode?: boolean;
  /** Existing segmentation boundary tick positions */
  boundaries?: number[];
  /** Called when user clicks to add a boundary in scissors mode */
  onBoundaryAdd?: (tick: number) => void;
  /** Called when user right-clicks or shift-clicks to remove a boundary */
  onBoundaryRemove?: (tick: number) => void;
  /** Called when user drags a boundary to a new position */
  onBoundaryMove?: (fromTick: number, toTick: number) => void;
}

/** Tolerance in pixels for clicking on an existing boundary to remove it. */
const BOUNDARY_HIT_PX = 8;

/**
 * Read CSS custom properties from the document root for canvas rendering.
 * Falls back to dark-theme defaults if properties are not set.
 */
function getThemeColors(): {
  bg: string;
  laneDark: string;
  laneLight: string;
  gridBar: string;
  gridBeat: string;
  label: string;
  noteBorder: string;
} {
  const style = getComputedStyle(document.documentElement);
  return {
    bg: style.getPropertyValue('--mc-piano-bg').trim() || '#181818',
    laneDark: style.getPropertyValue('--mc-piano-lane-dark').trim() || '#1e1e1e',
    laneLight: style.getPropertyValue('--mc-piano-lane-light').trim() || '#222',
    gridBar: style.getPropertyValue('--mc-piano-grid-bar').trim() || '#444',
    gridBeat: style.getPropertyValue('--mc-piano-grid-beat').trim() || '#2a2a2a',
    label: style.getPropertyValue('--mc-piano-label').trim() || '#666',
    noteBorder: style.getPropertyValue('--mc-text').trim()?.replace(')', ', 0.1)').replace('rgb(', 'rgba(') || 'rgba(255,255,255,0.1)',
  };
}

/** Min / max zoom bounds */
const MIN_ZOOM = 1;
const MAX_ZOOM = 10;

// ─── Note segment rendering ───────────────────────────────────────────────

/**
 * Colours for each harmonic role.
 *
 *  root       — warm yellow-white: visually orthogonal to both the blue
 *               chord-tone family and the amber NCT colour
 *  chord-tone — velocity-tinted blue (existing palette, unchanged)
 *  nct        — warm amber, desaturated to avoid alarm-red connotations
 *  none       — velocity-tinted blue (same as chord-tone; no leadsheet context)
 */
function noteRoleFill(role: NoteRole, velocity: number): string {
  if (role === 'none' || role === 'chord-tone') return velocityColor(velocity);
  const t = velocity / 127;
  if (role === 'root') {
    // Bright yellow-white: clearly distinct from blue (chord-tone) and amber (NCT)
    const r = Math.round(220 + t * 35);
    const g = Math.round(215 + t * 40);
    const b = Math.round(100 + t * 60);
    return `rgb(${r},${g},${b})`;
  }
  // nct — amber, velocity-modulated brightness
  const r = Math.round(180 + t * 55);
  const g = Math.round(120 + t * 60);
  const b = Math.round(30  + t * 20);
  return `rgb(${r},${g},${b})`;
}

/**
 * Draw a single note segment with role-appropriate styling.
 *
 * Visual encoding (two independent axes — colour + shape/texture):
 *
 *  root       — yellow-white fill + bright left-edge flag bar (full height, 2px)
 *               + strong outline. The left-edge bar reads as a "ground marker"
 *               even in greyscale and at small note sizes.
 *  chord-tone — solid blue fill (unchanged behaviour)
 *  nct        — dimmed amber fill + 45° diagonal hatch stripes (texture marks
 *               instability monochromatically) + amber outline
 *  none       — solid blue fill (no leadsheet; unchanged behaviour)
 */
function drawNoteSegment(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  role: NoteRole,
  velocity: number,
): void {
  const fill = noteRoleFill(role, velocity);

  if (role === 'nct') {
    // Dimmed base fill
    ctx.fillStyle = fill;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;

    // Diagonal hatch stripes — clip to this segment's rect
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    ctx.strokeStyle = fill;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.7;
    // Lines at 45°, spaced 3px apart
    const step = 3;
    const span = w + h;
    for (let d = -h; d < w + h; d += step) {
      ctx.beginPath();
      ctx.moveTo(x + d, y);
      ctx.lineTo(x + d + span, y + span);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // Amber outline
    ctx.strokeStyle = 'rgba(200,140,40,0.5)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(x, y, w, h);

  } else if (role === 'root') {
    // Main fill
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);

    // Left-edge flag bar: full-height, 2px wide, bright white
    // Works as a "this is the root" marker even at 1-pixel note heights
    const flagW = Math.min(2, w);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(x, y, flagW, h);

    // Stronger outline than chord tones for extra pop
    ctx.strokeStyle = 'rgba(255,240,120,0.7)';
    ctx.lineWidth = 0.75;
    ctx.strokeRect(x, y, w, h);

  } else {
    // chord-tone or none — solid fill, subtle outline (original behaviour)
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);

    ctx.strokeStyle = 'rgba(128,128,128,0.2)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(x, y, w, h);
  }
}

/**
 * Generate a text description of notes for screen readers.
 * Returns a summary string listing unique notes present in the clip.
 */
function generateNoteDescriptions(clip: Clip): string {
  const uniquePitches = [...new Set(clip.harmonic.pitches)].sort((a, b) => a - b);
  if (uniquePitches.length === 0) return 'No notes';

  const noteNames = uniquePitches.map(p => noteName(p)).join(', ');
  return `${uniquePitches.length} unique notes: ${noteNames}`;
}

export function PianoRoll({
  clip,
  playbackTime,
  isPlaying,
  height = 240,
  zoomLevel = 1,
  onZoomChange,
  selectionRange,
  onRangeSelect,
  scissorsMode = false,
  boundaries = [],
  onBoundaryAdd,
  onBoundaryRemove,
  onBoundaryMove,
}: PianoRollProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<PianoRollLayout | null>(null);

  // Transient drag state (refs, not reactive — we redraw manually during drag)
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragCurrentX = useRef(0);

  // Scissors hover state (refs, not reactive — redraw on mousemove)
  const scissorsHoverTick = useRef<number | null>(null);
  // Whether the scissors cursor is hovering over an existing boundary (→ pointer cursor)
  const scissorsHoverOnBoundary = useRef(false);

  // Boundary drag state (for moving existing boundaries)
  const isDraggingBoundary = useRef(false);
  const draggingBoundaryTick = useRef<number | null>(null);
  const draggingBoundaryCurrentTick = useRef<number | null>(null);

  // Keyboard navigation state
  const [keyboardMode, setKeyboardMode] = useState<'none' | 'selection' | 'scissors'>('none');
  const [keyboardCursor, setKeyboardCursor] = useState(0); // Tick position
  const [selectionAnchor, setSelectionAnchor] = useState<number | null>(null);

  const draw = useCallback(
    (canvas: HTMLCanvasElement, containerWidth: number) => {
      const dpr = window.devicePixelRatio || 1;
      // Compute layout with zoom — when zoomed, layout.width > containerWidth
      const layout = computeLayout(clip.gesture, clip.harmonic, containerWidth, height, zoomLevel);
      layoutRef.current = layout;
      const width = layout.width;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.scale(dpr, dpr);

      const theme = getThemeColors();

      // Background
      ctx.fillStyle = theme.bg;
      ctx.fillRect(0, 0, width, height);

      // Piano key lanes (horizontal stripes for each pitch)
      for (let pitch = layout.minPitch; pitch <= layout.maxPitch; pitch++) {
        const y =
          layout.topPad + (layout.maxPitch - pitch) * layout.pxPerSemitone;
        ctx.fillStyle = isBlackKey(pitch) ? theme.laneDark : theme.laneLight;
        ctx.fillRect(layout.labelWidth, y, width - layout.labelWidth, layout.pxPerSemitone);
      }

      // Grid lines (beats and bars)
      const gridLines = computeGridLines(clip.gesture, layout);
      for (const line of gridLines) {
        ctx.strokeStyle = line.isBar ? theme.gridBar : theme.gridBeat;
        ctx.lineWidth = line.isBar ? 1 : 0.5;
        ctx.beginPath();
        ctx.moveTo(line.x, 0);
        ctx.lineTo(line.x, height);
        ctx.stroke();
      }

      // Bar number labels (top of each bar line)
      ctx.fillStyle = theme.label;
      ctx.font = '9px system-ui';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      for (const line of gridLines) {
        if (line.isBar) {
          ctx.fillText(line.label, line.x + 3, 2);
        }
      }

      // Pitch labels (left gutter, only C notes and edges)
      ctx.fillStyle = theme.label;
      ctx.font = '9px system-ui';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (let pitch = layout.minPitch; pitch <= layout.maxPitch; pitch++) {
        if (pitch % 12 === 0 || pitch === layout.minPitch || pitch === layout.maxPitch) {
          const y =
            layout.topPad +
            (layout.maxPitch - pitch) * layout.pxPerSemitone +
            layout.pxPerSemitone / 2;
          ctx.fillText(noteName(pitch), layout.labelWidth - 4, y);
        }
      }

      // ─── Note rectangles ─────────────────────────────────────────────
      // Build chord windows from leadsheet (if present) so notes can be
      // coloured by harmonic role. Without a leadsheet, all notes render
      // with the plain velocity colour (unchanged behaviour).
      const totalTicks = clip.gesture.num_bars * clip.gesture.ticks_per_bar;
      const chordWindows: ChordWindow[] | undefined = clip.leadsheet
        ? buildChordWindows(
            clip.leadsheet,
            clip.gesture.ticks_per_bar,
            clip.gesture.ticks_per_beat,
            totalTicks,
          )
        : undefined;

      const rects = computeNoteRects(clip.gesture, clip.harmonic, layout, chordWindows);

      for (const rect of rects) {
        if (!rect.segments) {
          // No leadsheet context — plain velocity colour (original behaviour)
          ctx.fillStyle = velocityColor(rect.velocity);
          ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
          ctx.strokeStyle = 'rgba(128,128,128,0.2)';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
        } else {
          // Draw each chord-window segment with its role-appropriate style
          for (const seg of rect.segments) {
            const sx = rect.x + seg.xOffset;
            drawNoteSegment(ctx, sx, rect.y, seg.w, rect.h, seg.role, rect.velocity);
          }
        }
      }

      // ─── Segmentation boundaries (always rendered when present) ─────
      if (boundaries.length > 0) {
        for (const tick of boundaries) {
          // If this boundary is being dragged, render at drag position instead
          const isBeingDragged = isDraggingBoundary.current && draggingBoundaryTick.current === tick;
          const renderTick = isBeingDragged && draggingBoundaryCurrentTick.current !== null
            ? draggingBoundaryCurrentTick.current
            : tick;

          const bx = layout.labelWidth + renderTick * layout.pxPerTick;
          const alpha = isBeingDragged ? 0.6 : 1;
          // Dashed orange line
          ctx.strokeStyle = isBeingDragged ? `rgba(232, 135, 42, ${alpha})` : '#e8872a';
          ctx.lineWidth = isBeingDragged ? 2 : 1.5;
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          ctx.moveTo(bx, 0);
          ctx.lineTo(bx, height);
          ctx.stroke();
          ctx.setLineDash([]);

          // Small triangle marker at top
          ctx.fillStyle = isBeingDragged ? `rgba(232, 135, 42, ${alpha})` : '#e8872a';
          ctx.beginPath();
          ctx.moveTo(bx - 4, 0);
          ctx.lineTo(bx + 4, 0);
          ctx.lineTo(bx, 7);
          ctx.closePath();
          ctx.fill();
        }
      }

      // ─── Scissors hover guide line ──────────────────────────────────
      if (scissorsMode && scissorsHoverTick.current !== null) {
        const hx = layout.labelWidth + scissorsHoverTick.current * layout.pxPerTick;
        ctx.strokeStyle = 'rgba(232, 135, 42, 0.5)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(hx, 0);
        ctx.lineTo(hx, height);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Selection overlay (finalized selection from prop)
      if (selectionRange) {
        const x1 = layout.labelWidth + selectionRange.startTick * layout.pxPerTick;
        const x2 = layout.labelWidth + selectionRange.endTick * layout.pxPerTick;
        ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
        ctx.fillRect(x1, 0, x2 - x1, height);

        // Edge lines
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x1, 0); ctx.lineTo(x1, height);
        ctx.moveTo(x2, 0); ctx.lineTo(x2, height);
        ctx.stroke();
      }

      // ─── Keyboard navigation cursors ────────────────────────────────

      // Selection mode cursor (blue dashed line)
      if (keyboardMode === 'selection') {
        const cx = layout.labelWidth + keyboardCursor * layout.pxPerTick;
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        ctx.beginPath();
        ctx.moveTo(cx, 0);
        ctx.lineTo(cx, height);
        ctx.stroke();
        ctx.setLineDash([]);

        // Top indicator
        ctx.fillStyle = 'rgba(59, 130, 246, 0.9)';
        ctx.font = 'bold 11px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('↕', cx, 2);
      }

      // Scissors mode cursor (orange dashed line with scissors icon)
      if (keyboardMode === 'scissors') {
        const cx = layout.labelWidth + keyboardCursor * layout.pxPerTick;
        ctx.strokeStyle = 'rgba(232, 135, 42, 0.8)';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        ctx.beginPath();
        ctx.moveTo(cx, 0);
        ctx.lineTo(cx, height);
        ctx.stroke();
        ctx.setLineDash([]);

        // Top indicator (scissors emoji)
        ctx.fillStyle = 'rgba(232, 135, 42, 0.9)';
        ctx.font = '14px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('✂', cx, 0);
      }

      // Playhead
      if (isPlaying && playbackTime > 0) {
        const px = timeToX(
          playbackTime,
          clip.bpm,
          clip.gesture.ticks_per_beat,
          layout,
        );
        if (px >= layout.labelWidth && px <= width) {
          ctx.strokeStyle = '#ff6a4a';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(px, 0);
          ctx.lineTo(px, height);
          ctx.stroke();
        }
      }
    },
    [clip, playbackTime, isPlaying, height, zoomLevel, selectionRange, scissorsMode, boundaries, keyboardMode, keyboardCursor],
  );

  // ─── Mouse handlers ─────────────────────────────────────────────────

  /**
   * Find an existing boundary near a pixel x position (within BOUNDARY_HIT_PX).
   * Returns the boundary tick or null.
   */
  const findBoundaryNear = useCallback((x: number): number | null => {
    const layout = layoutRef.current;
    if (!layout || boundaries.length === 0) return null;

    for (const tick of boundaries) {
      const bx = layout.labelWidth + tick * layout.pxPerTick;
      if (Math.abs(x - bx) <= BOUNDARY_HIT_PX) return tick;
    }
    return null;
  }, [boundaries]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const layout = layoutRef.current;
    if (!canvas || !layout) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;

    // Ignore clicks in the label gutter
    if (x < layout.labelWidth) return;

    if (scissorsMode) {
      const rawTick = xToTick(x, layout);
      const hitBoundary = findBoundaryNear(x);

      // Click or drag on existing boundary.
      // We always start a drag attempt; if mouseUp sees no movement it becomes a remove.
      if (hitBoundary !== null) {
        isDraggingBoundary.current = true;
        draggingBoundaryTick.current = hitBoundary;
        draggingBoundaryCurrentTick.current = hitBoundary;
        return;
      }

      // Click on empty space → add new boundary
      const snappedTick = snapForScissors(
        rawTick,
        clip.gesture.onsets,
        clip.gesture.durations,
        clip.gesture.ticks_per_beat,
        e.shiftKey,
      );
      onBoundaryAdd?.(snappedTick);
      return;
    }

    // Normal selection mode
    isDragging.current = true;
    dragStartX.current = x;
    dragCurrentX.current = x;
  }, [scissorsMode, clip.gesture, findBoundaryNear, onBoundaryAdd, onBoundaryRemove]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const layout = layoutRef.current;
    if (!canvas || !layout) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;

    if (scissorsMode) {
      // Boundary drag in progress
      if (isDraggingBoundary.current) {
        const rawTick = xToTick(x, layout);
        draggingBoundaryCurrentTick.current = snapForScissors(
          rawTick,
          clip.gesture.onsets,
          clip.gesture.durations,
          clip.gesture.ticks_per_beat,
          e.shiftKey,
        );
        // Redraw with boundary at new position
        const container = containerRef.current;
        if (container) draw(canvas, container.clientWidth);
        return;
      }

      // Scissors mode: show hover guide line, update cursor for boundary proximity
      const onBoundary = findBoundaryNear(x) !== null;
      if (onBoundary !== scissorsHoverOnBoundary.current) {
        scissorsHoverOnBoundary.current = onBoundary;
        // Swap cursor class: pointer when over a boundary (click = remove), scissors otherwise
        canvas.classList.toggle('mc-piano-roll-canvas--scissors-remove', onBoundary);
      }

      if (x < layout.labelWidth) {
        scissorsHoverTick.current = null;
      } else {
        const rawTick = xToTick(x, layout);
        scissorsHoverTick.current = snapForScissors(
          rawTick,
          clip.gesture.onsets,
          clip.gesture.durations,
          clip.gesture.ticks_per_beat,
          e.shiftKey,
        );
      }

      // Redraw with hover guide
      const container = containerRef.current;
      if (container) {
        draw(canvas, container.clientWidth);
      }
      return;
    }

    // Normal selection mode: drag preview
    if (!isDragging.current) return;

    dragCurrentX.current = x;

    // Live preview: redraw base then overlay the drag region
    const container = containerRef.current;
    if (container) {
      draw(canvas, container.clientWidth);

      // Draw temporary drag overlay on top
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const x1 = Math.min(dragStartX.current, dragCurrentX.current);
        const x2 = Math.max(dragStartX.current, dragCurrentX.current);
        ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
        ctx.fillRect(x1, 0, x2 - x1, height);
      }
    }
  }, [scissorsMode, clip.gesture, draw, height]);

  const handleMouseUp = useCallback(() => {
    // Finish boundary drag
    if (isDraggingBoundary.current) {
      isDraggingBoundary.current = false;
      const from = draggingBoundaryTick.current;
      const to = draggingBoundaryCurrentTick.current;
      if (from !== null && to !== null) {
        if (from !== to) {
          onBoundaryMove?.(from, to);   // dragged to a new position → move
        } else {
          onBoundaryRemove?.(from);     // no movement → click → remove
        }
      }
      draggingBoundaryTick.current = null;
      draggingBoundaryCurrentTick.current = null;
      return;
    }

    if (scissorsMode) return; // Scissors mode uses click, not drag

    if (!isDragging.current) return;
    isDragging.current = false;

    const layout = layoutRef.current;
    if (!layout) return;

    const rawStart = xToTick(dragStartX.current, layout);
    const rawEnd = xToTick(dragCurrentX.current, layout);

    // Minimum drag check — tiny drags treated as click → clear selection
    if (!isMinimumDrag(rawStart, rawEnd, clip.gesture.ticks_per_beat)) {
      onRangeSelect(null);
      return;
    }

    // Collect note boundaries for snap-to-note functionality
    const noteBounds = collectNoteBoundaries(clip.gesture.onsets, clip.gesture.durations);

    const startTick = snapToNearestBoundary(
      Math.min(rawStart, rawEnd),
      noteBounds,
      clip.gesture.ticks_per_beat,
    );
    const endTick = snapToNearestBoundary(
      Math.max(rawStart, rawEnd),
      noteBounds,
      clip.gesture.ticks_per_beat,
    );

    // Edge case: snapping collapsed the range to zero
    if (startTick === endTick) {
      onRangeSelect(null);
      return;
    }

    onRangeSelect({ startTick, endTick });
  }, [scissorsMode, clip.gesture.onsets, clip.gesture.durations, clip.gesture.ticks_per_beat, onRangeSelect, onBoundaryMove]);

  const handleMouseLeave = useCallback(() => {
    // Cancel any boundary drag on leave
    if (isDraggingBoundary.current) {
      isDraggingBoundary.current = false;
      draggingBoundaryTick.current = null;
      draggingBoundaryCurrentTick.current = null;
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (canvas && container) draw(canvas, container.clientWidth);
      return;
    }

    if (scissorsMode) {
      // Clear hover guide and boundary-remove cursor
      scissorsHoverTick.current = null;
      scissorsHoverOnBoundary.current = false;
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (canvas) canvas.classList.remove('mc-piano-roll-canvas--scissors-remove');
      if (canvas && container) {
        draw(canvas, container.clientWidth);
      }
      return;
    }
    // Normal mode: treat as mouseup
    handleMouseUp();
  }, [scissorsMode, draw, handleMouseUp]);

  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (scissorsMode) {
      e.preventDefault(); // Prevent browser context menu in scissors mode
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const hitBoundary = findBoundaryNear(x);
      if (hitBoundary !== null) {
        onBoundaryRemove?.(hitBoundary);
      }
    }
  }, [scissorsMode, findBoundaryNear, onBoundaryRemove]);

  // Ctrl/Cmd + wheel → zoom in/out
  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();

    const factor = e.deltaY < 0 ? 1.2 : 1 / 1.2;
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoomLevel * factor));
    onZoomChange?.(next);
  }, [zoomLevel, onZoomChange]);

  // ─── Keyboard Navigation ────────────────────────────────────────────

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLCanvasElement>) => {
    const layout = layoutRef.current;
    if (!layout) return;

    const ticksPerBeat = clip.gesture.ticks_per_beat;
    const totalTicks = clip.gesture.num_bars * clip.gesture.ticks_per_bar;

    // Shift+S: Toggle selection mode (only when not in scissors mode via parent)
    if (e.key === 'S' && e.shiftKey && !scissorsMode) {
      e.preventDefault();
      if (keyboardMode === 'selection') {
        setKeyboardMode('none');
        setKeyboardCursor(0);
        setSelectionAnchor(null);
        onRangeSelect(null);
      } else {
        setKeyboardMode('selection');
        setKeyboardCursor(0);
        setSelectionAnchor(null);
      }
      return;
    }

    // Escape: Exit keyboard navigation mode
    if (e.key === 'Escape') {
      e.preventDefault();
      setKeyboardMode('none');
      setKeyboardCursor(0);
      setSelectionAnchor(null);
      if (!scissorsMode) onRangeSelect(null);
      return;
    }

    // Arrow Left/Right: Move cursor
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();

      // If scissors mode is active (from parent), enable scissors keyboard mode
      const activeMode = scissorsMode && keyboardMode === 'none' ? 'scissors' : keyboardMode;
      if (activeMode === 'none' && scissorsMode) {
        setKeyboardMode('scissors');
        setKeyboardCursor(0);
      }

      const step = ticksPerBeat / 2; // Move by eighth notes
      const direction = e.key === 'ArrowLeft' ? -1 : 1;
      const newCursor = Math.max(0, Math.min(totalTicks, keyboardCursor + direction * step));
      setKeyboardCursor(newCursor);

      // Shift+Arrow: Extend selection in selection mode
      if (e.shiftKey && keyboardMode === 'selection') {
        if (selectionAnchor === null) {
          setSelectionAnchor(keyboardCursor);
        }
        const start = Math.min(selectionAnchor ?? keyboardCursor, newCursor);
        const end = Math.max(selectionAnchor ?? keyboardCursor, newCursor);
        onRangeSelect({ startTick: start, endTick: end });
      }
      return;
    }

    // Enter or Space: Confirm action based on mode
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();

      if (keyboardMode === 'selection' && selectionAnchor !== null) {
        // Confirm selection
        const start = Math.min(selectionAnchor, keyboardCursor);
        const end = Math.max(selectionAnchor, keyboardCursor);
        if (start !== end) {
          onRangeSelect({ startTick: start, endTick: end });
        }
        setSelectionAnchor(null);
      } else if (scissorsMode || keyboardMode === 'scissors') {
        // Place boundary at cursor
        const snappedTick = snapForScissors(
          keyboardCursor,
          clip.gesture.onsets,
          clip.gesture.durations,
          ticksPerBeat,
          false,
        );
        onBoundaryAdd?.(snappedTick);
      }
      return;
    }

    // Delete or Backspace in scissors mode: Remove nearest boundary
    if ((e.key === 'Delete' || e.key === 'Backspace') && (scissorsMode || keyboardMode === 'scissors')) {
      e.preventDefault();
      if (boundaries.length > 0) {
        // Find nearest boundary to cursor
        const nearest = boundaries.reduce((closest, tick) =>
          Math.abs(tick - keyboardCursor) < Math.abs(closest - keyboardCursor) ? tick : closest
        );
        onBoundaryRemove?.(nearest);
      }
      return;
    }
  }, [
    clip.gesture,
    scissorsMode,
    keyboardMode,
    keyboardCursor,
    selectionAnchor,
    boundaries,
    onRangeSelect,
    onBoundaryAdd,
    onBoundaryRemove,
  ]);

  // Observe container width for responsive sizing
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        if (width > 0) draw(canvas, width);
      }
    });

    observer.observe(container);

    // Initial draw
    const width = container.clientWidth;
    if (width > 0) draw(canvas, width);

    return () => observer.disconnect();
  }, [draw]);

  // Generate dynamic aria-label based on mode
  const ariaLabel = useMemo(() => {
    const noteDesc = generateNoteDescriptions(clip);
    const bars = clip.gesture.num_bars;
    const bpm = clip.bpm;

    if (keyboardMode === 'selection') {
      return `Piano roll: ${bars} bars, ${bpm} BPM. Selection mode active. Use Arrow keys to move cursor, Shift+Arrow to select range, Enter to confirm, Escape to exit. ${noteDesc}`;
    } else if (scissorsMode || keyboardMode === 'scissors') {
      return `Piano roll: ${bars} bars, ${bpm} BPM. Scissors mode active. Use Arrow keys to position cursor, Enter or Space to place boundary, Delete to remove nearest boundary, Escape to exit. ${noteDesc}`;
    } else {
      return `Piano roll: ${bars} bars, ${bpm} BPM. Press Shift+S to enter selection mode for keyboard navigation. Use mouse to drag select notes or click to place scissor boundaries. ${noteDesc}`;
    }
  }, [clip, scissorsMode, keyboardMode]);

  // Generate detailed note list for aria-describedby (screen reader only)
  const noteListId = `piano-roll-notes-${clip.id}`;
  const noteListContent = useMemo(() => {
    const uniquePitches = [...new Set(clip.harmonic.pitches)].sort((a, b) => b - a);
    return uniquePitches.map(p => noteName(p)).join(', ');
  }, [clip.harmonic.pitches, clip.id]);

  return (
    <div ref={containerRef} className="mc-piano-roll-container">
      {/* Hidden div with note details for screen readers */}
      <div id={noteListId} className="sr-only">
        Notes in pattern: {noteListContent}
      </div>

      <canvas
        ref={canvasRef}
        className={`mc-piano-roll-canvas ${scissorsMode ? 'mc-piano-roll-canvas--scissors' : ''}`}
        role="img"
        aria-label={ariaLabel}
        aria-describedby={noteListId}
        tabIndex={0}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onContextMenu={handleContextMenu}
        onWheel={handleWheel}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}
