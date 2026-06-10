import type { MidiEvent, ParsedMidi } from '../types/midi';
import type { Note, LoopMeta } from '../types/clip';

export function parseMIDI(arrayBuffer: ArrayBuffer): ParsedMidi {
  const view = new DataView(arrayBuffer);
  let offset = 0;

  // Read header chunk
  const headerType = String.fromCharCode(...new Uint8Array(arrayBuffer, offset, 4));
  offset += 4;

  if (headerType !== 'MThd') {
    throw new Error('Not a valid MIDI file');
  }

  offset += 4; // header length (always 6)

  offset += 2; // format (unused but consumed)

  const trackCount = view.getUint16(offset);
  offset += 2;

  const division = view.getUint16(offset);
  offset += 2;

  let ticksPerBeat: number;
  if (division & 0x8000) {
    // SMPTE format
    console.warn('SMPTE format MIDI not fully supported');
    ticksPerBeat = 480; // fallback
  } else {
    ticksPerBeat = division;
  }

  // Read tracks
  const tracks: MidiEvent[][] = [];
  for (let i = 0; i < trackCount; i++) {
    const trackType = String.fromCharCode(...new Uint8Array(arrayBuffer, offset, 4));
    offset += 4;

    if (trackType !== 'MTrk') {
      throw new Error('Invalid track header');
    }

    const trackLength = view.getUint32(offset);
    offset += 4;

    const trackData = new Uint8Array(arrayBuffer, offset, trackLength);
    tracks.push(parseTrack(trackData));

    offset += trackLength;
  }

  return { ticksPerBeat, tracks };
}

export function parseTrack(data: Uint8Array): MidiEvent[] {
  const events: MidiEvent[] = [];
  let offset = 0;
  let runningStatus = 0;
  // Accumulate delta time across silently-consumed events so it isn't lost.
  // When a meta event is skipped, its delta carries forward to the next stored event.
  let pendingDelta = 0;

  while (offset < data.length) {
    // Read variable-length delta time
    let delta = 0;
    let byte: number;
    do {
      byte = data[offset++]!;
      delta = (delta << 7) | (byte & 0x7F);
    } while (byte & 0x80);

    // Accumulate into pendingDelta; will be used for the next stored event
    pendingDelta += delta;

    // Read event
    let status = data[offset]!;

    if (status < 0x80) {
      // Running status
      status = runningStatus;
    } else {
      offset++;
      runningStatus = status;
    }

    const channel = status & 0x0F;

    if (status === 0xFF) {
      // Meta event — check full status byte before masking
      const metaType = data[offset++]!;
      let length = 0;
      do {
        byte = data[offset++]!;
        length = (length << 7) | (byte & 0x7F);
      } while (byte & 0x80);

      const metaData = data.slice(offset, offset + length);
      offset += length;

      if (metaType === 0x51) {
        // Set Tempo
        const microsecondsPerBeat = (metaData[0]! << 16) | (metaData[1]! << 8) | metaData[2]!;
        const bpm = Math.round(60000000 / microsecondsPerBeat);
        events.push({ delta: pendingDelta, type: 'tempo', bpm });
        pendingDelta = 0;
      } else if (metaType === 0x58 && length >= 2) {
        // Time Signature: nn/2^dd
        const numerator = metaData[0]!;
        const denominator = Math.pow(2, metaData[1]!);
        events.push({ delta: pendingDelta, type: 'timeSig', numerator, denominator });
        pendingDelta = 0;
      } else if (metaType === 0x06) {
        // Marker
        const text = new TextDecoder().decode(metaData);
        events.push({ delta: pendingDelta, type: 'marker', text });
        pendingDelta = 0;
      } else if (metaType === 0x01) {
        // Text event
        const text = new TextDecoder().decode(metaData);
        events.push({ delta: pendingDelta, type: 'text', text });
        pendingDelta = 0;
      } else if (metaType === 0x2F) {
        // End of Track
        break;
      }
      // Other meta events silently consumed — pendingDelta accumulates
    } else if (status === 0xF0 || status === 0xF7) {
      // SysEx events — variable-length data
      let length = 0;
      do {
        byte = data[offset++]!;
        length = (length << 7) | (byte & 0x7F);
      } while (byte & 0x80);
      offset += length;
    } else if (status >= 0xF0) {
      // Other system common/realtime messages
      if (status === 0xF2) {
        offset += 2; // Song Position Pointer
      } else if (status === 0xF1 || status === 0xF3) {
        offset += 1; // MTC Quarter Frame, Song Select
      }
      // 0xF4-0xF6, 0xF8-0xFE: 0 data bytes
    } else {
      // Channel voice messages
      const type = status & 0xF0;

      if (type === 0x90) {
        // Note On
        const note = data[offset++]!;
        const velocity = data[offset++]!;
        events.push({ delta: pendingDelta, type: 'noteOn', note, velocity, channel });
        pendingDelta = 0;
      } else if (type === 0x80) {
        // Note Off
        const note = data[offset++]!;
        const velocity = data[offset++]!;
        events.push({ delta: pendingDelta, type: 'noteOff', note, velocity, channel });
        pendingDelta = 0;
      } else if (type === 0xC0 || type === 0xD0) {
        // Program Change, Channel Pressure: 1 data byte
        // Non-note events: consume data but don't reset pendingDelta
        offset += 1;
      } else if (type === 0xB0 || type === 0xE0 || type === 0xA0) {
        // Control Change, Pitch Bend, Aftertouch: 2 data bytes
        // Non-note events: consume data but don't reset pendingDelta
        offset += 2;
      }
    }
  }

  return events;
}

export function extractNotes(midiData: ParsedMidi): Note[] {
  const notes: Note[] = [];
  const activeNotes = new Map<string, { tick: number; velocity: number; note: number }>();

  for (const track of midiData.tracks) {
    let currentTick = 0;

    for (const event of track) {
      currentTick += event.delta;

      if (event.type === 'noteOn' && event.velocity! > 0) {
        const key = `${event.note}-${event.channel}`;
        activeNotes.set(key, { tick: currentTick, velocity: event.velocity!, note: event.note! });
      } else if (event.type === 'noteOff' || (event.type === 'noteOn' && event.velocity === 0)) {
        const key = `${event.note}-${event.channel}`;
        const noteOn = activeNotes.get(key);
        if (noteOn) {
          notes.push({
            midi: noteOn.note,
            ticks: noteOn.tick,
            durationTicks: currentTick - noteOn.tick,
            velocity: noteOn.velocity,
          });
          activeNotes.delete(key);
        }
      }
    }
  }

  const sorted = notes.sort((a, b) => a.ticks - b.ticks);

  // Normalize: if the first note doesn't start at tick 0, shift all notes
  // so the first onset lands at tick 0. This handles Apple Loops and other
  // files where MIDI content is positioned late in a larger timeline.
  if (sorted.length > 0 && sorted[0]!.ticks > 0) {
    const offset = sorted[0]!.ticks;
    for (const note of sorted) {
      note.ticks -= offset;
    }
  }

  return sorted;
}

export function extractBPM(midiData: ParsedMidi): number {
  for (const track of midiData.tracks) {
    for (const event of track) {
      if (event.type === 'tempo') {
        return event.bpm!;
      }
    }
  }
  return 120;
}

/**
 * Extract the first time signature from MIDI data.
 * Returns [numerator, denominator] (e.g. [3, 4] for 3/4 time).
 * Defaults to [4, 4] if no time signature event is found.
 */
export function extractTimeSignature(midiData: ParsedMidi): [number, number] {
  for (const track of midiData.tracks) {
    for (const event of track) {
      if (event.type === 'timeSig') {
        return [event.numerator!, event.denominator!];
      }
    }
  }
  return [4, 4];
}

/** Parsed segment from MCURATOR metadata. */
export interface McuratorSegment {
  tick: number;
  index: number;
  chord: string | null;
  json?: Record<string, unknown>;
}

/** Result of extracting MCURATOR metadata from a MIDI file. */
export interface McuratorMetadata {
  boundaries: number[];
  segments: McuratorSegment[];
  fileInfo?: Record<string, unknown>;
  /** Raw leadsheet input text (if embedded in MIDI metadata). */
  leadsheetText?: string;
  /**
   * Per-chord beat timing overrides, keyed by "barIndex:chordIndex".
   * Each value is [beatPosition, duration] in beats from the bar start.
   * Only present when chords have non-equal-division timing (e.g. after a drag).
   */
  leadsheetTiming?: Record<string, [number, number]>;
  /** Source clip filename (for variants). */
  variantOf?: string;
  /** Clip notes / generation info (for variants). */
  clipNotes?: string;
  /** Loop metadata restored from an embedded MCURATOR:v1 loopmeta event. */
  loopMeta?: LoopMeta;
  /** UJAM Virtual Pianist metadata extracted from the file-level event. */
  vpMeta?: { source: string; pattern: string; intensity: string };
}

const MARKER_PREFIX = 'MCURATOR v1 SEG';
const TEXT_PREFIX = 'MCURATOR:v1 ';

/**
 * Parse an MCURATOR marker string.
 * Format: "MCURATOR v1 SEG <n> CHORD <symbol> [KEY <key>] [FLAGS <flags>]"
 */
function parseMarker(text: string): { index: number; chord: string | null } | null {
  if (!text.startsWith(MARKER_PREFIX)) return null;
  const rest = text.slice(MARKER_PREFIX.length).trim();
  const tokens = rest.split(/\s+/);
  const index = parseInt(tokens[0] ?? '', 10);
  if (isNaN(index)) return null;

  let chord: string | null = null;
  const chordIdx = tokens.indexOf('CHORD');
  if (chordIdx >= 0 && chordIdx + 1 < tokens.length) {
    chord = tokens[chordIdx + 1]!;
  }
  return { index, chord };
}

/**
 * Parse an MCURATOR text event JSON payload.
 * Format: "MCURATOR:v1 <JSON>"
 */
function parseTextJson(text: string): Record<string, unknown> | null {
  if (!text.startsWith(TEXT_PREFIX)) return null;
  const jsonStr = text.slice(TEXT_PREFIX.length);
  try {
    return JSON.parse(jsonStr) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Reconstruct a LoopMeta object from a raw JSON payload (the 'loopmeta' text event).
 * All required fields must be present and correctly typed; returns undefined if not.
 */
function restoreLoopMeta(json: Record<string, unknown>): LoopMeta | undefined {
  const { cafFilename, rootPc, keyType, tempo, numberOfBeats,
          timeSignatureTop, timeSignatureBottom,
          instrumentType, instrumentSubType, genre, descriptors, collection, author,
          gbLoopType } = json;

  if (
    typeof cafFilename !== 'string' ||
    typeof rootPc !== 'number' ||
    typeof keyType !== 'number' ||
    typeof tempo !== 'number' ||
    typeof numberOfBeats !== 'number' ||
    typeof timeSignatureTop !== 'number' ||
    typeof timeSignatureBottom !== 'number'
  ) return undefined;

  const kt = keyType as 0 | 1 | 2 | 3;
  if (kt < 0 || kt > 3) return undefined;

  return {
    cafFilename,
    rootPc,
    keyType: kt,
    tempo,
    numberOfBeats,
    timeSignatureTop,
    timeSignatureBottom,
    instrumentType:    typeof instrumentType    === 'string' ? instrumentType    : '',
    instrumentSubType: typeof instrumentSubType === 'string' ? instrumentSubType : '',
    genre:             typeof genre             === 'string' ? genre             : '',
    descriptors:       typeof descriptors       === 'string' ? descriptors       : '',
    collection:        typeof collection        === 'string' ? collection        : '',
    author:            typeof author            === 'string' ? author            : '',
    gbLoopType:        typeof gbLoopType        === 'number' ? gbLoopType        : 0,
    hasMidi:           0,  // not stored in MIDI metadata; default to 0
  };
}

/**
 * Extract MCURATOR segmentation metadata from a parsed MIDI file.
 * Scans all tracks for MCURATOR marker and text meta events.
 */
export function extractMcuratorSegments(midiData: ParsedMidi): McuratorMetadata | null {
  // Collect all marker/text events with absolute ticks across all tracks
  const markerEvents: Array<{ tick: number; text: string }> = [];
  const textEvents: Array<{ tick: number; text: string }> = [];

  for (const track of midiData.tracks) {
    let tick = 0;
    for (const event of track) {
      tick += event.delta;
      if (event.type === 'marker' && event.text) {
        markerEvents.push({ tick, text: event.text });
      } else if (event.type === 'text' && event.text) {
        textEvents.push({ tick, text: event.text });
      }
    }
  }

  // Parse file-level info, leadsheet, and variant metadata from text events
  let fileInfo: Record<string, unknown> | undefined;
  let leadsheetText: string | undefined;
  let leadsheetTiming: Record<string, [number, number]> | undefined;
  let variantOf: string | undefined;
  let clipNotes: string | undefined;
  let loopMeta: LoopMeta | undefined;
  let vpMeta: { source: string; pattern: string; intensity: string } | undefined;
  for (const te of textEvents) {
    const json = parseTextJson(te.text);
    if (!json) continue;
    if (json.type === 'file') {
      fileInfo = json;
      if (typeof json.variantOf === 'string') variantOf = json.variantOf;
      if (typeof json.notes === 'string') clipNotes = json.notes;
      if (typeof json.vpSource === 'string' &&
          typeof json.vpPattern === 'string' &&
          typeof json.vpIntensity === 'string') {
        vpMeta = { source: json.vpSource, pattern: json.vpPattern, intensity: json.vpIntensity };
      }
    } else if (json.type === 'leadsheet' && typeof json.text === 'string') {
      leadsheetText = json.text;
      // Restore per-chord beat timing if present (e.g. after boundary drag)
      if (json.timing && typeof json.timing === 'object' && !Array.isArray(json.timing)) {
        const raw = json.timing as Record<string, unknown>;
        const timing: Record<string, [number, number]> = {};
        for (const [key, val] of Object.entries(raw)) {
          if (Array.isArray(val) && val.length === 2 &&
              typeof val[0] === 'number' && typeof val[1] === 'number') {
            timing[key] = [val[0], val[1]];
          }
        }
        if (Object.keys(timing).length > 0) leadsheetTiming = timing;
      }
    } else if (json.type === 'loopmeta') {
      // Restore Apple Loops metadata from embedded MIDI text event
      loopMeta = restoreLoopMeta(json);
    }
  }

  // Parse segment markers
  const segmentMap = new Map<number, McuratorSegment>();

  for (const me of markerEvents) {
    const parsed = parseMarker(me.text);
    if (!parsed) continue;
    segmentMap.set(me.tick, {
      tick: me.tick,
      index: parsed.index,
      chord: parsed.chord,
    });
  }

  // Merge text JSON into segments (JSON overrides marker per spec §8.3)
  for (const te of textEvents) {
    const json = parseTextJson(te.text);
    if (!json || json.type === 'file') continue;
    if (typeof json.seg !== 'number') continue;

    const existing = segmentMap.get(te.tick);
    if (existing) {
      existing.json = json;
      // JSON chord overrides marker chord
      if (typeof json.chord === 'string') {
        existing.chord = json.chord;
      }
    } else {
      // Text-only segment (no marker)
      segmentMap.set(te.tick, {
        tick: te.tick,
        index: json.seg as number,
        chord: typeof json.chord === 'string' ? json.chord : null,
        json,
      });
    }
  }

  if (segmentMap.size === 0 && !fileInfo && !leadsheetText && !variantOf && !clipNotes && !loopMeta) return null;

  const segments = [...segmentMap.values()].sort((a, b) => a.tick - b.tick);
  const boundaries = segments.map(s => s.tick);

  return { boundaries, segments, fileInfo, leadsheetText, leadsheetTiming, variantOf, clipNotes, loopMeta, vpMeta };
}
