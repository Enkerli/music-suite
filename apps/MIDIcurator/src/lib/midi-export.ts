import type { Gesture, Harmonic, Clip, Segmentation, BarChordInfo, Leadsheet, LoopMeta } from '../types/clip';
import { createZip } from './zip';

export function encodeVariableLength(value: number): number[] {
  const bytes: number[] = [];
  bytes.push(value & 0x7F);

  value >>= 7;
  while (value > 0) {
    bytes.unshift((value & 0x7F) | 0x80);
    value >>= 7;
  }

  return bytes;
}

/**
 * Encode a text or marker meta event.
 * @param metaType 0x01 for text, 0x06 for marker
 * @param text UTF-8 string content
 */
export function encodeTextMeta(metaType: 0x01 | 0x03 | 0x06, text: string): number[] {
  const textBytes = new TextEncoder().encode(text);
  return [0xFF, metaType, ...encodeVariableLength(textBytes.length), ...textBytes];
}

export function createMIDIHeader(format: number, ticksPerBeat: number): number[] {
  return [
    0x4D, 0x54, 0x68, 0x64,                            // "MThd"
    0x00, 0x00, 0x00, 0x06,                             // Header length (6 bytes)
    0x00, format,                                        // Format type
    0x00, 0x01,                                          // Number of tracks
    (ticksPerBeat >> 8) & 0xFF, ticksPerBeat & 0xFF,    // Ticks per beat
  ];
}

/**
 * Build a marker + text JSON pair for a single segment boundary.
 */
function buildSegmentEvents(
  tick: number,
  segIndex: number,
  chord: { symbol: string; root: number; observedPcs?: number[]; templatePcs?: number[]; extras?: number[]; bassPc?: number } | null,
): Array<{ tick: number; data: number[] }> {
  const events: Array<{ tick: number; data: number[] }> = [];

  const chordSymbol = chord?.symbol ?? null;

  // Marker event (human-readable, DAW-visible)
  const markerStr = chordSymbol
    ? `MCURATOR v1 SEG ${segIndex} CHORD ${chordSymbol}`
    : `MCURATOR v1 SEG ${segIndex}`;
  events.push({ tick, data: encodeTextMeta(0x06, markerStr) });

  // Text JSON event (machine-readable, full fidelity)
  const segJson: Record<string, unknown> = { seg: segIndex };
  if (chordSymbol) segJson.chord = chordSymbol;
  if (chord) {
    segJson.rootPc = chord.root;
    if (chord.observedPcs) segJson.pcsObs = chord.observedPcs;
    if (chord.templatePcs) segJson.pcsTpl = chord.templatePcs;
    if (chord.extras && chord.extras.length > 0) {
      segJson.extras = chord.extras;
    }
    if (chord.bassPc !== undefined) {
      segJson.bassPc = chord.bassPc;
    }
  }
  events.push({ tick, data: encodeTextMeta(0x01, `MCURATOR:v1 ${JSON.stringify(segJson)}`) });

  return events;
}

/**
 * Build MCURATOR metadata events (file-level + per-segment) as tick-positioned entries.
 */
function buildMetadataEvents(
  segmentation: Segmentation | undefined,
  barChords: BarChordInfo[] | undefined,
  ticksPerBeat: number,
  leadsheet?: Leadsheet,
  title?: string,
  variantOf?: string,
  clipNotes?: string,
  loopMeta?: LoopMeta,
): Array<{ tick: number; data: number[] }> {
  const metaEvents: Array<{ tick: number; data: number[] }> = [];

  // MIDI Sequence/Track Name (meta type 0x03) — visible in DAWs
  if (title) {
    metaEvents.push({ tick: 0, data: encodeTextMeta(0x03, title) });
  }

  // File-level text event at tick 0
  const fileData: Record<string, unknown> = {
    type: 'file',
    schema: 'mcurator-midi',
    version: 1,
    createdBy: 'MIDIcurator',
    createdAt: new Date().toISOString().slice(0, 10),
    ppq: ticksPerBeat,
  };
  if (variantOf) fileData.variantOf = variantOf;
  if (clipNotes) fileData.notes = clipNotes;
  const fileJson = JSON.stringify(fileData);
  metaEvents.push({ tick: 0, data: encodeTextMeta(0x01, `MCURATOR:v1 ${fileJson}`) });

  // Loop metadata event at tick 0 (if sourced from Apple Loops DB)
  if (loopMeta) {
    const lmData = { type: 'loopmeta', ...loopMeta };
    metaEvents.push({ tick: 0, data: encodeTextMeta(0x01, `MCURATOR:v1 ${JSON.stringify(lmData)}`) });
  }

  // Leadsheet text event at tick 0 (if present)
  if (leadsheet && leadsheet.inputText) {
    const lsData: Record<string, unknown> = {
      type: 'leadsheet',
      text: leadsheet.inputText,
      bars: leadsheet.bars.length,
    };

    // Serialize per-chord beat timing (only where explicitly set, to keep payload small).
    // Format: { "barIndex:chordIndex": [beatPosition, duration], ... }
    const timing: Record<string, [number, number]> = {};
    for (const bar of leadsheet.bars) {
      for (let j = 0; j < bar.chords.length; j++) {
        const c = bar.chords[j]!;
        if (c.beatPosition !== undefined && c.duration !== undefined) {
          timing[`${bar.bar}:${j}`] = [c.beatPosition, c.duration];
        }
      }
    }
    if (Object.keys(timing).length > 0) {
      lsData.timing = timing;
    }

    metaEvents.push({ tick: 0, data: encodeTextMeta(0x01, `MCURATOR:v1 ${JSON.stringify(lsData)}`) });
  }

  if (!segmentation || segmentation.boundaries.length === 0) return metaEvents;

  // Emit a marker at each actual boundary tick with chord info for the
  // segment that *follows* the boundary.  On reimport the marker ticks
  // directly reconstruct the boundaries array (no spurious tick-0 entry).
  const segChords = segmentation.segmentChords;
  for (let i = 0; i < segmentation.boundaries.length; i++) {
    const tick = segmentation.boundaries[i]!;
    const segIndex = i + 1;

    // Try to find chord info from the segment that starts at this boundary
    let chord: BarChordInfo['chord'] = null;
    if (segChords) {
      const seg = segChords.find(s => s.startTick === tick);
      if (seg) chord = seg.chord;
    }

    // Fallback: use barChords to approximate chord at this boundary
    if (!chord && barChords) {
      let chordInfo: BarChordInfo | undefined;
      for (const bc of barChords) {
        const barStart = bc.bar * (ticksPerBeat * 4);
        if (barStart <= tick) chordInfo = bc;
      }
      chord = chordInfo?.chord ?? null;
    }

    metaEvents.push(...buildSegmentEvents(tick, segIndex, chord));
  }

  return metaEvents;
}

export function createMIDITrack(
  gesture: Gesture,
  harmonic: Harmonic,
  bpm: number,
  _ticksPerBeat: number,
  segmentation?: Segmentation,
  barChords?: BarChordInfo[],
  leadsheet?: Leadsheet,
  title?: string,
  variantOf?: string,
  clipNotes?: string,
  loopMeta?: LoopMeta,
): number[] {
  // All events as absolute-tick entries, converted to delta at the end
  const allEvents: Array<{ tick: number; data: number[] }> = [];

  // Set tempo event at tick 0
  const microsecondsPerBeat = Math.round(60000000 / bpm);
  allEvents.push({
    tick: 0,
    data: [
      0xFF, 0x51, 0x03, // Meta event: Set Tempo
      (microsecondsPerBeat >> 16) & 0xFF,
      (microsecondsPerBeat >> 8) & 0xFF,
      microsecondsPerBeat & 0xFF,
    ],
  });

  // MCURATOR metadata events
  const metaEvents = buildMetadataEvents(segmentation, barChords, _ticksPerBeat, leadsheet, title, variantOf, clipNotes, loopMeta);
  allEvents.push(...metaEvents);

  // Note events
  for (let i = 0; i < gesture.onsets.length; i++) {
    allEvents.push({
      tick: gesture.onsets[i]!,
      data: [0x90, harmonic.pitches[i]!, gesture.velocities[i]!],
    });
    allEvents.push({
      tick: gesture.onsets[i]! + gesture.durations[i]!,
      data: [0x80, harmonic.pitches[i]!, 0],
    });
  }

  // Sort by tick (stable: metadata before notes at same tick)
  allEvents.sort((a, b) => a.tick - b.tick);

  // Convert to delta-time encoded events
  const events: Array<{ delta: number; data: number[] }> = [];
  let currentTick = 0;
  for (const event of allEvents) {
    const delta = event.tick - currentTick;
    currentTick = event.tick;
    events.push({ delta, data: event.data });
  }

  // End of track
  events.push({
    delta: 0,
    data: [0xFF, 0x2F, 0x00],
  });

  // Encode events
  const trackData: number[] = [];
  for (const event of events) {
    trackData.push(...encodeVariableLength(event.delta));
    trackData.push(...event.data);
  }

  // Create track chunk
  const trackLength = trackData.length;
  return [
    0x4D, 0x54, 0x72, 0x6B, // "MTrk"
    (trackLength >> 24) & 0xFF,
    (trackLength >> 16) & 0xFF,
    (trackLength >> 8) & 0xFF,
    trackLength & 0xFF,
    ...trackData,
  ];
}

export function createMIDI(
  gesture: Gesture,
  harmonic: Harmonic,
  bpm: number,
  segmentation?: Segmentation,
  leadsheet?: Leadsheet,
  title?: string,
  variantOf?: string,
  clipNotes?: string,
  loopMeta?: LoopMeta,
): Uint8Array {
  const ticksPerBeat = gesture.ticks_per_beat || 480;
  const header = createMIDIHeader(1, ticksPerBeat);
  const track = createMIDITrack(gesture, harmonic, bpm, ticksPerBeat, segmentation, harmonic.barChords, leadsheet, title, variantOf, clipNotes, loopMeta);

  return new Uint8Array([...header, ...track]);
}

// DOM-dependent download helpers (future Electron IPC boundary)

export function downloadMIDI(clip: Clip): void {
  const title = clip.filename.replace(/\.mid$/i, '');
  const midiData = createMIDI(
    clip.gesture, clip.harmonic, clip.bpm, clip.segmentation, clip.leadsheet,
    title, clip.sourceFilename, clip.notes || undefined, clip.loopMeta,
  );
  const blob = new Blob([midiData], { type: 'audio/midi' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = clip.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadAllClips(clips: Clip[]): void {
  clips.forEach((clip, index) => {
    setTimeout(() => downloadMIDI(clip), 100 * index);
  });
}

/** Derive a ZIP folder path from a clip's metadata.
 *  Priority: loopMeta.folderPath → sourceFilename stem → flat (no folder)
 *  folderPath uses " / " separators from extractFolderPath(); convert to ZIP "/".
 */
function clipZipFolder(clip: Clip): string {
  if (clip.loopMeta?.folderPath) {
    // "Apple Loops / Alpha Waves" → "Apple Loops/Alpha Waves/"
    return clip.loopMeta.folderPath.split(' / ').join('/') + '/';
  }
  // Future: other source types can add their own folder logic here.
  return '';
}

export async function downloadAllAsZip(clips: Clip[], zipName = 'MIDIcurator-export.zip'): Promise<void> {
  const files = clips.map(clip => {
    const title = clip.filename.replace(/\.mid$/i, '');
    const midiData = createMIDI(
      clip.gesture, clip.harmonic, clip.bpm, clip.segmentation, clip.leadsheet,
      title, clip.sourceFilename, clip.notes || undefined, clip.loopMeta,
    );
    const folder = clipZipFolder(clip);
    return { name: `${folder}${clip.filename}`, data: midiData };
  });

  const zipData = createZip(files);
  const blob = new Blob([zipData], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = zipName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function downloadVariantsAsZip(
  variants: Clip[],
  sourceFilename: string,
): Promise<void> {
  const files = variants.map(variant => {
    const title = variant.filename.replace(/\.mid$/i, '');
    const midiData = createMIDI(
      variant.gesture, variant.harmonic, variant.bpm, variant.segmentation, variant.leadsheet,
      title, variant.sourceFilename ?? sourceFilename, variant.notes || undefined,
    );
    const actualDensity = variant.gesture.density.toFixed(2);
    const baseName = sourceFilename.replace(/\.mid$/i, '');
    const filename = `${baseName}_d${actualDensity}.mid`;
    return { name: filename, data: midiData };
  });

  const zipData = createZip(files);
  const blob = new Blob([zipData], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${sourceFilename.replace(/\.mid$/i, '')}_variants.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generate chord detection debug JSON with detailed timing and note info.
 */
export function generateChordDebugJSON(clip: Clip): string {
  const { gesture, harmonic, bpm } = clip;
  const ticksPerBar = gesture.ticks_per_bar;
  const ticksPerBeat = gesture.ticks_per_beat;

  // Build per-bar analysis with detailed note info
  const barAnalysis = harmonic.barChords?.map(bc => {
    const barStart = bc.bar * ticksPerBar;
    const barEnd = barStart + ticksPerBar;

    // Find notes in this bar (onset in bar OR sustaining into bar)
    const notesInBar: Array<{
      index: number;
      pitch: number;
      pitchClass: number;
      pitchName: string;
      onset: number;
      duration: number;
      endTick: number;
      sustainedFromPrevious: boolean;
    }> = [];

    for (let i = 0; i < gesture.onsets.length; i++) {
      const onset = gesture.onsets[i]!;
      const dur = gesture.durations[i]!;
      const noteEnd = onset + dur;
      const pitch = harmonic.pitches[i]!;

      // Include if note is sounding in this bar
      if ((onset >= barStart && onset < barEnd) ||
          (onset < barStart && noteEnd > barStart)) {
        const pc = ((pitch % 12) + 12) % 12;
        const noteNames = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
        notesInBar.push({
          index: i,
          pitch,
          pitchClass: pc,
          pitchName: noteNames[pc]!,
          onset,
          duration: dur,
          endTick: noteEnd,
          sustainedFromPrevious: onset < barStart,
        });
      }
    }

    return {
      bar: bc.bar,
      barStartTick: barStart,
      barEndTick: barEnd,
      detectedChord: bc.chord ? {
        symbol: bc.chord.symbol,
        root: bc.chord.root,
        rootName: bc.chord.rootName,
        quality: bc.chord.qualityKey,
        qualityName: bc.chord.qualityName,
      } : null,
      pitchClasses: bc.pitchClasses,
      segments: bc.segments,
      notesInBar,
      noteCount: notesInBar.length,
      distinctPitchClasses: [...new Set(notesInBar.map(n => n.pitchClass))].sort((a, b) => a - b),
    };
  }) ?? [];

  const debug = {
    exportedAt: new Date().toISOString(),
    filename: clip.filename,
    clipId: clip.id,
    bpm,
    timing: {
      ticksPerBeat,
      ticksPerBar,
      numBars: gesture.num_bars,
      totalNotes: gesture.onsets.length,
    },
    overallChord: harmonic.detectedChord ? {
      symbol: harmonic.detectedChord.symbol,
      root: harmonic.detectedChord.root,
      rootName: harmonic.detectedChord.rootName,
      quality: harmonic.detectedChord.qualityKey,
    } : null,
    barChords: barAnalysis,
  };

  return JSON.stringify(debug, null, 2);
}

/**
 * Download chord debug JSON for a clip.
 */
export function downloadChordDebug(clip: Clip): void {
  const json = generateChordDebugJSON(clip);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${clip.filename.replace(/\.mid$/i, '')}_chord-debug.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
