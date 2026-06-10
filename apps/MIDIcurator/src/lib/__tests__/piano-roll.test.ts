import { describe, it, expect } from 'vitest';
import {
  buildChordWindows,
  computeNoteRects,
  noteName,
  isBlackKey,
  computeLayout,
  computeGridLines,
  timeToX,
  velocityColor,
  xToTick,
  snapToNearestBeat,
  collectNoteBoundaries,
  snapToNearestBoundary,
  getNotesInTickRange,
  isMinimumDrag,
  detectChordBlocks,
  snapForScissors,
  segmentFromLeadsheet,
} from '../piano-roll';
import type { Gesture, Harmonic, Leadsheet } from '../../types/clip';

function makeFixture(): { gesture: Gesture; harmonic: Harmonic } {
  return {
    gesture: {
      onsets: [0, 480, 960, 1440],
      durations: [240, 240, 240, 240],
      velocities: [80, 100, 60, 120],
      density: 1,
      syncopation_score: 0,
      avg_velocity: 90,
      velocity_variance: 0,
      avg_duration: 240,
      num_bars: 1,
      ticks_per_bar: 1920,
      ticks_per_beat: 480,
    },
    harmonic: {
      pitches: [60, 64, 67, 72],
      pitchClasses: [0, 4, 7, 0],
    },
  };
}

describe('noteName', () => {
  it('maps MIDI 60 to C4', () => {
    expect(noteName(60)).toBe('C4');
  });

  it('maps MIDI 69 to A4', () => {
    expect(noteName(69)).toBe('A4');
  });

  it('maps MIDI 21 to A0', () => {
    expect(noteName(21)).toBe('A0');
  });
});

describe('isBlackKey', () => {
  it('C is not a black key', () => {
    expect(isBlackKey(60)).toBe(false);
  });

  it('C# is a black key', () => {
    expect(isBlackKey(61)).toBe(true);
  });

  it('E is not a black key', () => {
    expect(isBlackKey(64)).toBe(false);
  });

  it('F# is a black key', () => {
    expect(isBlackKey(66)).toBe(true);
  });
});

describe('computeLayout', () => {
  it('computes pitch range with padding', () => {
    const { gesture, harmonic } = makeFixture();
    const layout = computeLayout(gesture, harmonic, 800, 240);
    // pitches are 60,64,67,72 → min should be 58, max should be 74
    expect(layout.minPitch).toBe(58);
    expect(layout.maxPitch).toBe(74);
  });

  it('has positive pxPerTick and pxPerSemitone', () => {
    const { gesture, harmonic } = makeFixture();
    const layout = computeLayout(gesture, harmonic, 800, 240);
    expect(layout.pxPerTick).toBeGreaterThan(0);
    expect(layout.pxPerSemitone).toBeGreaterThan(0);
  });
});

describe('computeNoteRects', () => {
  it('produces one rect per note', () => {
    const { gesture, harmonic } = makeFixture();
    const layout = computeLayout(gesture, harmonic, 800, 240);
    const rects = computeNoteRects(gesture, harmonic, layout);
    expect(rects).toHaveLength(4);
  });

  it('rects have positive dimensions', () => {
    const { gesture, harmonic } = makeFixture();
    const layout = computeLayout(gesture, harmonic, 800, 240);
    const rects = computeNoteRects(gesture, harmonic, layout);
    for (const rect of rects) {
      expect(rect.w).toBeGreaterThan(0);
      expect(rect.h).toBeGreaterThan(0);
    }
  });

  it('higher pitches have lower y values', () => {
    const { gesture, harmonic } = makeFixture();
    const layout = computeLayout(gesture, harmonic, 800, 240);
    const rects = computeNoteRects(gesture, harmonic, layout);
    // pitch 60 (C4) should be below pitch 72 (C5)
    const c4 = rects.find(r => r.pitch === 60)!;
    const c5 = rects.find(r => r.pitch === 72)!;
    expect(c5.y).toBeLessThan(c4.y);
  });
});

describe('computeGridLines', () => {
  it('marks bar lines', () => {
    const { gesture } = makeFixture();
    const layout = computeLayout(gesture, makeFixture().harmonic, 800, 240);
    const lines = computeGridLines(gesture, layout);
    const barLines = lines.filter(l => l.isBar);
    expect(barLines.length).toBeGreaterThanOrEqual(1);
  });

  it('first line is a bar line', () => {
    const { gesture } = makeFixture();
    const layout = computeLayout(gesture, makeFixture().harmonic, 800, 240);
    const lines = computeGridLines(gesture, layout);
    expect(lines[0]!.isBar).toBe(true);
  });
});

describe('timeToX', () => {
  it('time 0 maps to labelWidth', () => {
    const { gesture, harmonic } = makeFixture();
    const layout = computeLayout(gesture, harmonic, 800, 240);
    expect(timeToX(0, 120, 480, layout)).toBe(layout.labelWidth);
  });

  it('positive time maps beyond labelWidth', () => {
    const { gesture, harmonic } = makeFixture();
    const layout = computeLayout(gesture, harmonic, 800, 240);
    expect(timeToX(1, 120, 480, layout)).toBeGreaterThan(layout.labelWidth);
  });
});

describe('velocityColor', () => {
  it('returns valid rgb string', () => {
    const color = velocityColor(80);
    expect(color).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
  });

  it('higher velocity produces brighter color', () => {
    const low = velocityColor(20);
    const high = velocityColor(120);
    // Extract green channel (most visible brightness component)
    const gLow = parseInt(low.match(/rgb\(\d+, (\d+),/)![1]!);
    const gHigh = parseInt(high.match(/rgb\(\d+, (\d+),/)![1]!);
    expect(gHigh).toBeGreaterThan(gLow);
  });
});

// ─── Range selection functions ─────────────────────────────────────────

describe('xToTick', () => {
  it('inverts tick-to-x at tick 0', () => {
    const { gesture, harmonic } = makeFixture();
    const layout = computeLayout(gesture, harmonic, 800, 240);
    expect(xToTick(layout.labelWidth, layout)).toBeCloseTo(0);
  });

  it('inverts tick-to-x for a known tick', () => {
    const { gesture, harmonic } = makeFixture();
    const layout = computeLayout(gesture, harmonic, 800, 240);
    const tick = 480;
    const x = layout.labelWidth + tick * layout.pxPerTick;
    expect(xToTick(x, layout)).toBeCloseTo(tick);
  });

  it('clamps negative x to tick 0', () => {
    const { gesture, harmonic } = makeFixture();
    const layout = computeLayout(gesture, harmonic, 800, 240);
    expect(xToTick(0, layout)).toBe(0);
  });

  it('roundtrips with timeToX', () => {
    const { gesture, harmonic } = makeFixture();
    const layout = computeLayout(gesture, harmonic, 800, 240);
    const bpm = 120;
    const tpb = 480;
    const x = timeToX(1.0, bpm, tpb, layout);
    const tickFromX = xToTick(x, layout);
    // 1 second at 120 BPM = 2 beats = 960 ticks
    expect(tickFromX).toBeCloseTo(960);
  });
});

describe('snapToNearestBeat', () => {
  it('snaps tick 100 to 0 with ticksPerBeat=480', () => {
    expect(snapToNearestBeat(100, 480)).toBe(0);
  });

  it('snaps tick 300 to 480 with ticksPerBeat=480', () => {
    expect(snapToNearestBeat(300, 480)).toBe(480);
  });

  it('snaps exact beat boundary to itself', () => {
    expect(snapToNearestBeat(960, 480)).toBe(960);
  });

  it('snaps midpoint to nearest beat', () => {
    // 240 is exactly halfway between 0 and 480
    // Math.round(0.5) = 1 in JS, so this snaps to 480
    expect(snapToNearestBeat(240, 480)).toBe(480);
  });
});

describe('getNotesInTickRange', () => {
  it('returns notes whose onset falls in range', () => {
    const onsets =    [0, 480, 960, 1440];
    const durations = [240, 240, 240, 240];
    const indices = getNotesInTickRange(onsets, durations, 480, 960);
    expect(indices).toEqual([1]);
  });

  it('includes sustained notes from before the range', () => {
    const onsets =    [0, 480, 960];
    const durations = [600, 240, 240]; // first note sustains to tick 600
    const indices = getNotesInTickRange(onsets, durations, 480, 960);
    expect(indices).toEqual([0, 1]);
  });

  it('excludes notes that end exactly at range start', () => {
    const onsets =    [0, 480];
    const durations = [480, 240]; // first note ends exactly at 480
    const indices = getNotesInTickRange(onsets, durations, 480, 960);
    expect(indices).toEqual([1]);
  });

  it('returns empty for range with no notes', () => {
    const onsets =    [0, 480];
    const durations = [240, 240];
    const indices = getNotesInTickRange(onsets, durations, 1000, 2000);
    expect(indices).toEqual([]);
  });

  it('handles full-clip range', () => {
    const onsets =    [0, 480, 960, 1440];
    const durations = [240, 240, 240, 240];
    const indices = getNotesInTickRange(onsets, durations, 0, 2000);
    expect(indices).toEqual([0, 1, 2, 3]);
  });
});

describe('isMinimumDrag', () => {
  it('returns true for range >= quarter beat', () => {
    expect(isMinimumDrag(0, 120, 480)).toBe(true); // 120 >= 120
  });

  it('returns false for tiny range', () => {
    expect(isMinimumDrag(0, 50, 480)).toBe(false); // 50 < 120
  });

  it('works with reversed range', () => {
    expect(isMinimumDrag(480, 0, 480)).toBe(true); // abs(480) >= 120
  });
});

describe('collectNoteBoundaries', () => {
  it('returns unique sorted boundaries from onsets and ends', () => {
    const onsets = [0, 480, 960];
    const durations = [240, 240, 240];
    const boundaries = collectNoteBoundaries(onsets, durations);
    expect(boundaries).toEqual([0, 240, 480, 720, 960, 1200]);
  });

  it('handles single note', () => {
    const boundaries = collectNoteBoundaries([100], [50]);
    expect(boundaries).toEqual([100, 150]);
  });

  it('handles overlapping notes (shared boundaries)', () => {
    // Two notes that end at the same tick
    const onsets = [0, 0];
    const durations = [240, 240];
    const boundaries = collectNoteBoundaries(onsets, durations);
    expect(boundaries).toEqual([0, 240]); // Deduped
  });

  it('handles empty arrays', () => {
    expect(collectNoteBoundaries([], [])).toEqual([]);
  });
});

describe('snapToNearestBoundary', () => {
  const ticksPerBeat = 480;
  // NOTE_SNAP_THRESHOLD = 60, GRID_UNIT = 120

  it('snaps to note onset when within threshold', () => {
    const boundaries = [0, 240, 480];
    // rawTick=50 is within 60 of boundary 0
    expect(snapToNearestBoundary(50, boundaries, ticksPerBeat)).toBe(0);
  });

  it('snaps to note end when within threshold', () => {
    const boundaries = [0, 240, 480];
    // rawTick=250 is within 60 of boundary 240
    expect(snapToNearestBoundary(250, boundaries, ticksPerBeat)).toBe(240);
  });

  it('prefers closer boundary', () => {
    const boundaries = [0, 100, 200];
    // rawTick=90 is closer to 100 than to 0
    expect(snapToNearestBoundary(90, boundaries, ticksPerBeat)).toBe(100);
  });

  it('falls back to grid when far from boundaries', () => {
    const boundaries = [0, 1000]; // Far apart
    // rawTick=500 is far from both, snaps to grid (GRID_UNIT=120)
    // 500 / 120 = 4.17, rounds to 4, so 4 * 120 = 480
    expect(snapToNearestBoundary(500, boundaries, ticksPerBeat)).toBe(480);
  });

  it('snaps to exact boundary when on it', () => {
    const boundaries = [0, 240, 480];
    expect(snapToNearestBoundary(240, boundaries, ticksPerBeat)).toBe(240);
  });

  it('handles empty boundaries (falls back to grid)', () => {
    expect(snapToNearestBoundary(500, [], ticksPerBeat)).toBe(480);
  });
});

describe('detectChordBlocks', () => {
  it('groups notes with same onset/end into one block', () => {
    // 3 notes starting and ending together (block chord)
    const indices = [0, 1, 2];
    const onsets = [0, 0, 0];
    const durations = [240, 240, 240];
    const blocks = detectChordBlocks(indices, onsets, durations);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].noteIndices).toEqual([0, 1, 2]);
    expect(blocks[0].startTick).toBe(0);
    expect(blocks[0].endTick).toBe(240);
  });

  it('separates notes with different onsets into separate blocks', () => {
    // Two separate block chords
    const indices = [0, 1, 2, 3];
    const onsets = [0, 0, 480, 480];
    const durations = [240, 240, 240, 240];
    const blocks = detectChordBlocks(indices, onsets, durations);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].noteIndices).toEqual([0, 1]);
    expect(blocks[1].noteIndices).toEqual([2, 3]);
  });

  it('handles tolerance for near-simultaneous notes', () => {
    // Notes start within tolerance (20 ticks) - both round to same quantized key
    const indices = [0, 1];
    const onsets = [5, 8]; // Both round to 0 with BLOCK_TOLERANCE of 20
    const durations = [240, 237]; // End around the same time
    const blocks = detectChordBlocks(indices, onsets, durations);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].noteIndices).toEqual([0, 1]);
  });

  it('splits notes that start together but end differently', () => {
    // Notes start together but have very different durations
    const indices = [0, 1];
    const onsets = [0, 0];
    const durations = [100, 500]; // End spread > BLOCK_TOLERANCE
    const blocks = detectChordBlocks(indices, onsets, durations);
    // Should be split into separate single-note blocks
    expect(blocks).toHaveLength(2);
    expect(blocks[0].noteIndices).toEqual([0]);
    expect(blocks[1].noteIndices).toEqual([1]);
  });

  it('returns empty array for empty indices', () => {
    expect(detectChordBlocks([], [], [])).toEqual([]);
  });

  it('handles repeated identical blocks (same chord played twice)', () => {
    // Same 3-note chord played at tick 0 and tick 480
    const indices = [0, 1, 2, 3, 4, 5];
    const onsets = [0, 0, 0, 480, 480, 480];
    const durations = [200, 200, 200, 200, 200, 200];
    const blocks = detectChordBlocks(indices, onsets, durations);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].noteIndices).toHaveLength(3);
    expect(blocks[1].noteIndices).toHaveLength(3);
  });
});

describe('snapForScissors', () => {
  const tpb = 480; // ticks per beat
  const onsets = [0, 480, 960, 1440];
  const durations = [240, 240, 240, 240];

  it('snaps to nearest note onset within tolerance', () => {
    // Click near onset at 480
    expect(snapForScissors(500, onsets, durations, tpb)).toBe(480);
  });

  it('snaps to nearest note end when no onset is close', () => {
    // All onsets are at 0, 480, 960, 1440.
    // Click at 260: onset 480 is 220 away (within 240 tolerance) → onset wins.
    // To test end-snap, we need a position far from any onset but near an end.
    // With onsets [0,480,960,1440] and durations [240,...], ends are at 240,720,1200,1680.
    // Click at 730: closest onset is 960 (dist 230, within 240) → onset still wins.
    // Use sparse onsets to truly isolate end-snap:
    const sparseOnsets = [0, 1920];
    const sparseDurations = [240, 240];
    // Click at 250: closest onset is 0 (dist 250, outside 240 tolerance).
    // Next onset 1920 is too far. End at 240 is dist 10 (within tolerance).
    expect(snapForScissors(250, sparseOnsets, sparseDurations, tpb)).toBe(240);
  });

  it('falls back to beat grid when no notes nearby', () => {
    // Use sparse onsets so no onset or end is within tolerance of 700
    const sparseOnsets = [0, 1920];
    const sparseDurations = [100, 100];
    // Ends at 100, 2020. Click at 700 — no onset or end within 240 tolerance.
    const result = snapForScissors(700, sparseOnsets, sparseDurations, tpb);
    expect(result % tpb).toBe(0); // Should be on beat grid
    expect(result).toBe(480); // 480 is closest beat to 700
  });

  it('returns raw tick when disableSnap is true', () => {
    expect(snapForScissors(501.7, onsets, durations, tpb, true)).toBe(502);
  });

  it('never returns negative', () => {
    expect(snapForScissors(-10, onsets, durations, tpb, true)).toBe(0);
  });

  it('prefers onset over end when both are close', () => {
    // Note onset at 480, note end at 240 (from note at onset 0, dur 240)
    // Click at 350 — onset 480 is 130 away, end 240 is 110 away
    // But onset should take priority over end
    // 130 < 240 (half beat) so onset is within tolerance
    // 110 < 240 so end is also within tolerance
    // Onset wins by priority order
    // Actually 350 is closer to 240 (end). But onset priority means we check onsets first.
    // Closest onset to 350 is 480 (dist 130, within 240 tolerance)
    // So it should snap to 480
    expect(snapForScissors(350, onsets, durations, tpb)).toBe(480);
  });
});

// ─── buildChordWindows ────────────────────────────────────────────────────────

/** Minimal DetectedChord for testing — only templatePcs and root matter */
function mockChord(root: number, templatePcs: number[]) {
  return {
    root,
    rootName: 'C',
    qualityKey: 'maj',
    symbol: 'C',
    qualityName: 'major',
    templatePcs,
  };
}

function makeLeadsheet(bars: Leadsheet['bars']): Leadsheet {
  return { inputText: '', bars };
}

describe('buildChordWindows', () => {
  const TPB = 480;  // ticks per beat
  const TPBAR = 1920; // ticks per bar (4/4)
  const TOTAL = 3840; // 2 bars

  it('returns empty array for a leadsheet with no bars', () => {
    const ls = makeLeadsheet([]);
    expect(buildChordWindows(ls, TPBAR, TPB, TOTAL)).toEqual([]);
  });

  it('single whole-bar chord covers bar exactly', () => {
    const ls = makeLeadsheet([{
      bar: 0,
      isRepeat: false,
      chords: [{ chord: mockChord(0, [0, 4, 7]), inputText: 'C', position: 0, totalInBar: 1, beatPosition: 0, duration: 4 }],
    }]);
    const windows = buildChordWindows(ls, TPBAR, TPB, TOTAL);
    // One chord window from 0→1920, then a null gap 1920→3840
    expect(windows).toHaveLength(2);
    expect(windows[0]).toMatchObject({ startTick: 0, endTick: 1920 });
    expect(windows[0]!.templatePcs).toEqual([0, 4, 7]);
    expect(windows[0]!.rootPc).toBe(0);
    expect(windows[1]).toMatchObject({ startTick: 1920, endTick: 3840, templatePcs: null, rootPc: null });
  });

  it('two chords per bar build contiguous windows within the bar', () => {
    // Bar 0: Cmaj beats 0–2, Gmaj beats 2–4
    const ls = makeLeadsheet([{
      bar: 0,
      isRepeat: false,
      chords: [
        { chord: mockChord(0, [0, 4, 7]), inputText: 'C', position: 0, totalInBar: 2, beatPosition: 0, duration: 2 },
        { chord: mockChord(7, [7, 11, 2]), inputText: 'G', position: 1, totalInBar: 2, beatPosition: 2, duration: 2 },
      ],
    }]);
    const windows = buildChordWindows(ls, TPBAR, TPB, TOTAL);
    expect(windows[0]).toMatchObject({ startTick: 0, endTick: 960, rootPc: 0 });
    expect(windows[1]).toMatchObject({ startTick: 960, endTick: 1920, rootPc: 7 });
    // Trailing null gap
    expect(windows[2]).toMatchObject({ startTick: 1920, endTick: 3840, templatePcs: null });
  });

  it('classifies note pitches correctly via computeNoteRects', () => {
    // One bar: Cmaj (C E G = pcs 0,4,7), root = 0
    // Notes: C4(60)=root, E4(64)=chord-tone, D4(62)=NCT
    const gesture: Gesture = {
      onsets: [0, 0, 0],
      durations: [480, 480, 480],
      velocities: [80, 80, 80],
      density: 1, syncopation_score: 0, avg_velocity: 80,
      velocity_variance: 0, avg_duration: 480,
      num_bars: 1, ticks_per_bar: TPBAR, ticks_per_beat: TPB,
    };
    const harmonic: Harmonic = { pitches: [60, 64, 62], pitchClasses: [0, 4, 2] };
    const ls = makeLeadsheet([{
      bar: 0,
      isRepeat: false,
      chords: [{ chord: mockChord(0, [0, 4, 7]), inputText: 'C', position: 0, totalInBar: 1, beatPosition: 0, duration: 4 }],
    }]);
    const windows = buildChordWindows(ls, TPBAR, TPB, TPBAR);
    const layout = { width: 500, height: 200, pxPerTick: 0.2, pxPerSemitone: 10, minPitch: 58, maxPitch: 66, labelWidth: 40, topPad: 4 };
    const rects = computeNoteRects(gesture, harmonic, layout, windows);

    expect(rects[0]!.segments).toHaveLength(1);
    expect(rects[0]!.segments![0]!.role).toBe('root');        // C4

    expect(rects[1]!.segments).toHaveLength(1);
    expect(rects[1]!.segments![0]!.role).toBe('chord-tone'); // E4

    expect(rects[2]!.segments).toHaveLength(1);
    expect(rects[2]!.segments![0]!.role).toBe('nct');        // D4
  });

  it('splits a note crossing a chord boundary into two segments', () => {
    // Bar 0 (1920 ticks): Cmaj beats 0–2 (ticks 0–960), Gmaj beats 2–4 (ticks 960–1920)
    // Note: B4 (pc=11) from tick 720 to 1200 — chord-tone in Cmaj(B∈maj7?), NCT in Gmaj
    // For simplicity: Cmaj template has 11, Gmaj template does not
    const gesture: Gesture = {
      onsets: [720],
      durations: [480], // ends at 1200, crosses boundary at 960
      velocities: [80],
      density: 1, syncopation_score: 0, avg_velocity: 80,
      velocity_variance: 0, avg_duration: 480,
      num_bars: 1, ticks_per_bar: TPBAR, ticks_per_beat: TPB,
    };
    const harmonic: Harmonic = { pitches: [71], pitchClasses: [11] }; // B4, pc=11
    const ls = makeLeadsheet([{
      bar: 0,
      isRepeat: false,
      chords: [
        { chord: mockChord(0, [0, 4, 7, 11]), inputText: 'C∆', position: 0, totalInBar: 2, beatPosition: 0, duration: 2 },
        { chord: mockChord(7, [7, 11, 2]),    inputText: 'G',  position: 1, totalInBar: 2, beatPosition: 2, duration: 2 },
      ],
    }]);
    const windows = buildChordWindows(ls, TPBAR, TPB, TPBAR);
    const layout = { width: 500, height: 200, pxPerTick: 0.2, pxPerSemitone: 10, minPitch: 69, maxPitch: 73, labelWidth: 40, topPad: 4 };
    const rects = computeNoteRects(gesture, harmonic, layout, windows);

    const segs = rects[0]!.segments!;
    expect(segs).toHaveLength(2);
    // First segment: ticks 720–960 in Cmaj (pc 11 ∈ template) → chord-tone
    expect(segs[0]!.role).toBe('chord-tone');
    // Second segment: ticks 960–1200 in Gmaj (pc 11 ∈ template [7,11,2]) → also chord-tone here
    // but let's verify the boundary is respected (xOffset > 0 for second segment)
    expect(segs[1]!.xOffset).toBeGreaterThan(0);
    // Both happen to be chord-tones in this example — check widths sum to note width
    const totalSegW = segs.reduce((sum, s) => sum + s.w, 0);
    const noteW = 480 * layout.pxPerTick; // 96px
    expect(totalSegW).toBeCloseTo(noteW, 0);
  });
});

// ─── segmentFromLeadsheet ─────────────────────────────────────────────────────

describe('segmentFromLeadsheet', () => {
  const TPB   = 480;   // ticks per beat
  const TPBAR = 1920;  // ticks per bar (4/4)
  // Use exactly 1-bar total so there is no trailing gap window beyond the chord content
  const TOTAL = TPBAR;

  it('returns empty array when leadsheet has no bars', () => {
    const ls = makeLeadsheet([]);
    expect(segmentFromLeadsheet(ls, TPBAR, TPB, TOTAL, [], [])).toEqual([]);
  });

  it('returns empty array for a single whole-bar chord (no internal boundary)', () => {
    // One chord fills the whole bar — no chord-change boundary exists inside
    const ls = makeLeadsheet([{
      bar: 0, isRepeat: false,
      chords: [{ chord: mockChord(0, [0,4,7]), inputText: 'C', position: 0, totalInBar: 1, beatPosition: 0, duration: 4 }],
    }]);
    expect(segmentFromLeadsheet(ls, TPBAR, TPB, TOTAL, [], [])).toEqual([]);
  });

  it('produces a boundary at the half-bar chord change (no note snapping)', () => {
    // Bar 0: Cmaj beats 0–2, Gmaj beats 2–4 → internal boundary at tick 960
    const ls = makeLeadsheet([{
      bar: 0, isRepeat: false,
      chords: [
        { chord: mockChord(0, [0,4,7]),  inputText: 'C', position: 0, totalInBar: 2, beatPosition: 0, duration: 2 },
        { chord: mockChord(7, [7,11,2]), inputText: 'G', position: 1, totalInBar: 2, beatPosition: 2, duration: 2 },
      ],
    }]);
    // No notes → no snapping, boundary stays at raw tick 960
    const result = segmentFromLeadsheet(ls, TPBAR, TPB, TOTAL, [], []);
    expect(result).toEqual([960]);
  });

  it('snaps boundary to a nearby note onset', () => {
    // Boundary at tick 960, note onset at tick 940 (within half-beat tolerance = 240 ticks)
    const ls = makeLeadsheet([{
      bar: 0, isRepeat: false,
      chords: [
        { chord: mockChord(0, [0,4,7]),  inputText: 'C', position: 0, totalInBar: 2, beatPosition: 0, duration: 2 },
        { chord: mockChord(7, [7,11,2]), inputText: 'G', position: 1, totalInBar: 2, beatPosition: 2, duration: 2 },
      ],
    }]);
    const onsets    = [0,   940];
    const durations = [480, 480];
    const result = segmentFromLeadsheet(ls, TPBAR, TPB, TOTAL, onsets, durations);
    // 940 is 20 ticks from 960, within tolerance 240 → snaps to 940
    expect(result).toEqual([940]);
  });

  it('does not snap to a note onset outside tolerance', () => {
    // Boundary at 960, nearest note onset at 600 (360 ticks away, exceeds half-beat 240)
    const ls = makeLeadsheet([{
      bar: 0, isRepeat: false,
      chords: [
        { chord: mockChord(0, [0,4,7]),  inputText: 'C', position: 0, totalInBar: 2, beatPosition: 0, duration: 2 },
        { chord: mockChord(7, [7,11,2]), inputText: 'G', position: 1, totalInBar: 2, beatPosition: 2, duration: 2 },
      ],
    }]);
    const onsets    = [600];
    const durations = [100];
    const result = segmentFromLeadsheet(ls, TPBAR, TPB, TOTAL, onsets, durations);
    // 600 is too far — boundary stays at 960
    expect(result).toEqual([960]);
  });

  it('produces two boundaries for three chords within one bar', () => {
    // Bar 0: 3 equal chords each 4/3 beats → internal boundaries at ticks ~640 and ~1280
    const bpp = TPBAR / 3; // ~640 ticks per chord
    const ls = makeLeadsheet([{
      bar: 0, isRepeat: false,
      chords: [
        { chord: mockChord(0,  [0,4,7]),  inputText: 'C', position: 0, totalInBar: 3, beatPosition: 0,   duration: 4/3 },
        { chord: mockChord(5,  [5,9,0]),  inputText: 'F', position: 1, totalInBar: 3, beatPosition: 4/3, duration: 4/3 },
        { chord: mockChord(7, [7,11,2]),  inputText: 'G', position: 2, totalInBar: 3, beatPosition: 8/3, duration: 4/3 },
      ],
    }]);
    const result = segmentFromLeadsheet(ls, TPBAR, TPB, TOTAL, [], []);
    expect(result).toHaveLength(2);
    expect(result[0]).toBeCloseTo(bpp, -1);     // ~640
    expect(result[1]).toBeCloseTo(bpp * 2, -1); // ~1280
  });

  it('deduplicates when two raw boundaries snap to the same note onset', () => {
    // Beat-1 boundary (480) has a note right on it; beat-2 boundary (960) is unsnapped
    const ls = makeLeadsheet([{
      bar: 0, isRepeat: false,
      chords: [
        { chord: mockChord(0, [0,4,7]),  inputText: 'C', position: 0, totalInBar: 3, beatPosition: 0, duration: 1 },
        { chord: mockChord(5, [5,9,0]),  inputText: 'F', position: 1, totalInBar: 3, beatPosition: 1, duration: 1 },
        { chord: mockChord(7,[7,11,2]),  inputText: 'G', position: 2, totalInBar: 3, beatPosition: 2, duration: 2 },
      ],
    }]);
    const onsets    = [480];
    const durations = [10];
    const result = segmentFromLeadsheet(ls, TPBAR, TPB, TOTAL, onsets, durations);
    // Result must have no duplicate entries
    expect(result.length).toBe(new Set(result).size);
  });
});
