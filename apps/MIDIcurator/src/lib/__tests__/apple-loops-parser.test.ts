import { describe, it, expect } from 'vitest';
import {
  isAppleLoopFile,
  parseAppleLoop,
  formatChordTimeline,
  type AppleLoopChordEvent,
} from '../apple-loops-parser';

// Test helper: decode interval mask (functionality is private in implementation)
function decodeIntervalMask(mask: number): number[] {
  const intervals: number[] = [];
  for (let i = 0; i < 12; i++) {
    if (mask & (1 << i)) {
      intervals.push(i);
    }
  }
  return intervals;
}

// ─── Helper: build a minimal AIFF container ────────────────────────

/** Create a minimal valid AIFF file with the given chunks. */
function buildAiff(
  chunks: Array<{ id: string; data: Uint8Array }>,
  formType: 'AIFF' | 'AIFC' = 'AIFF',
): ArrayBuffer {
  // Calculate total body size: 4 (form type) + sum of chunks
  let bodySize = 4;
  for (const c of chunks) {
    bodySize += 8 + c.data.length;
    if (c.data.length % 2 !== 0) bodySize += 1; // pad byte
  }

  const buf = new ArrayBuffer(8 + bodySize);
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);

  // FORM header
  bytes.set([0x46, 0x4F, 0x52, 0x4D], 0); // 'FORM'
  view.setUint32(4, bodySize);
  bytes.set(
    formType === 'AIFC'
      ? [0x41, 0x49, 0x46, 0x43]
      : [0x41, 0x49, 0x46, 0x46],
    8,
  ); // 'AIFF' or 'AIFC'

  let offset = 12;
  for (const c of chunks) {
    // Chunk ID
    for (let i = 0; i < 4; i++) bytes[offset + i] = c.id.charCodeAt(i);
    offset += 4;
    // Chunk size
    view.setUint32(offset, c.data.length);
    offset += 4;
    // Chunk data
    bytes.set(c.data, offset);
    offset += c.data.length;
    // Pad byte
    if (c.data.length % 2 !== 0) {
      bytes[offset] = 0;
      offset += 1;
    }
  }

  return buf;
}

/** Create a minimal SMF (1 track, 1 note) as Uint8Array. */
function buildMinimalSmf(ppq: number = 480): Uint8Array {
  const header = new Uint8Array(14);
  const hView = new DataView(header.buffer);
  // MThd
  header.set([0x4D, 0x54, 0x68, 0x64], 0);
  hView.setUint32(4, 6);       // header data length
  hView.setUint16(8, 0);       // format 0
  hView.setUint16(10, 1);      // 1 track
  hView.setUint16(12, ppq);    // ticks per beat

  // Track: note on C4 vel 80, delta 480, note off, end of track
  const trackData = new Uint8Array([
    0x00, 0x90, 60, 80,         // delta=0, note on C4 vel 80
    0x83, 0x60, 0x80, 60, 0,    // delta=480, note off C4
    0x00, 0xFF, 0x2F, 0x00,     // delta=0, end of track
  ]);

  const track = new Uint8Array(8 + trackData.length);
  const tView = new DataView(track.buffer);
  track.set([0x4D, 0x54, 0x72, 0x6B], 0); // MTrk
  tView.setUint32(4, trackData.length);
  track.set(trackData, 8);

  const smf = new Uint8Array(header.length + track.length);
  smf.set(header, 0);
  smf.set(track, header.length);
  return smf;
}

/** Build a fake 30-byte Sequ chord event record with type 103. */
function buildChordRecord(
  mask: number,
  be22: number,
  b8: number = 2,  // Default to natural (b8=2)
  b9: number = 0,  // Default to C (pc=0)
): Uint8Array {
  const rec = new Uint8Array(32);  // 32 bytes, not 30
  const view = new DataView(rec.buffer);
  view.setUint16(0, 103, true);       // type (little-endian)
  view.setUint16(2, 0, true);         // w1
  view.setUint16(4, mask, true);      // mask (little-endian!)
  view.setUint16(6, 0x0f07, true);    // w3
  rec[8] = b8;
  rec[9] = b9;
  view.setUint16(10, 0xb200, true);   // x10
  view.setUint16(12, 0, true);        // x12
  view.setUint32(14, 0x00008000, false); // be14 (big-endian)
  view.setUint32(0x18, be22, false);  // be22 at offset 0x18 (big-endian)
  view.setUint32(0x1c, 0, false);     // be26 (big-endian)
  return rec;
}

/** Build an APPL chunk containing nested subchunks. */
function buildApplChunk(
  subchunks: Array<{ id: string; data: Uint8Array }>,
): Uint8Array {
  let totalSize = 0;
  for (const s of subchunks) {
    totalSize += 8 + s.data.length;
    if (s.data.length % 2 !== 0) totalSize += 1;
  }

  const result = new Uint8Array(totalSize);
  const view = new DataView(result.buffer);
  let offset = 0;

  for (const s of subchunks) {
    for (let i = 0; i < 4; i++) result[offset + i] = s.id.charCodeAt(i);
    offset += 4;
    view.setUint32(offset, s.data.length);
    offset += 4;
    result.set(s.data, offset);
    offset += s.data.length;
    if (s.data.length % 2 !== 0) {
      result[offset] = 0;
      offset += 1;
    }
  }

  return result;
}

// ─── Tests ──────────────────────────────────────────────────────────

describe('decodeIntervalMask', () => {
  it('decodes root only (bit 0)', () => {
    expect(decodeIntervalMask(0b000000000001)).toEqual([0]);
  });

  it('decodes major triad intervals [0,4,7]', () => {
    // bit 0 + bit 4 + bit 7 = 0b000010010001 = 0x91
    const mask = (1 << 0) | (1 << 4) | (1 << 7);
    expect(decodeIntervalMask(mask)).toEqual([0, 4, 7]);
  });

  it('decodes maj7 intervals [0,4,7,11]', () => {
    const mask = (1 << 0) | (1 << 4) | (1 << 7) | (1 << 11);
    expect(decodeIntervalMask(mask)).toEqual([0, 4, 7, 11]);
  });

  it('decodes minor triad intervals [0,3,7]', () => {
    const mask = (1 << 0) | (1 << 3) | (1 << 7);
    expect(decodeIntervalMask(mask)).toEqual([0, 3, 7]);
  });

  it('returns empty array for mask 0', () => {
    expect(decodeIntervalMask(0)).toEqual([]);
  });

  it('decodes all 12 bits set', () => {
    expect(decodeIntervalMask(0xFFF)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });
});

describe('isAppleLoopFile', () => {
  it('recognizes .aif files', () => {
    expect(isAppleLoopFile('My Loop.aif')).toBe(true);
  });

  it('recognizes .aiff files', () => {
    expect(isAppleLoopFile('Loop.aiff')).toBe(true);
  });

  it('recognizes .caf files', () => {
    expect(isAppleLoopFile('Piano.caf')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isAppleLoopFile('LOOP.AIF')).toBe(true);
    expect(isAppleLoopFile('Loop.CAF')).toBe(true);
  });

  it('rejects .mid files', () => {
    expect(isAppleLoopFile('file.mid')).toBe(false);
  });

  it('rejects .wav files', () => {
    expect(isAppleLoopFile('file.wav')).toBe(false);
  });
});

describe('parseAppleLoop — AIFF', () => {
  it('throws for files too small', () => {
    expect(() => parseAppleLoop(new ArrayBuffer(4))).toThrow('Unsupported file format');
  });

  it('throws for non-AIFF/CAF files', () => {
    const wav = new ArrayBuffer(12);
    const bytes = new Uint8Array(wav);
    bytes.set([0x52, 0x49, 0x46, 0x46], 0); // 'RIFF'
    expect(() => parseAppleLoop(wav)).toThrow('Unsupported file format');
  });

  it('parses an AIFF with a MIDI chunk', () => {
    const smf = buildMinimalSmf();
    const aiff = buildAiff([{ id: 'MIDI', data: smf }]);

    const result = parseAppleLoop(aiff);
    expect(result.format).toBe('AIFF');
    expect(result.midi).not.toBeNull();
    expect(result.chordEvents).toHaveLength(0);

    // Verify extracted MIDI is valid SMF
    const midiBytes = new Uint8Array(result.midi!);
    expect(String.fromCharCode(...midiBytes.subarray(0, 4))).toBe('MThd');
  });

  it('parses an AIFC file', () => {
    const smf = buildMinimalSmf();
    const aiff = buildAiff([{ id: 'MIDI', data: smf }], 'AIFC');

    const result = parseAppleLoop(aiff);
    expect(result.format).toBe('AIFF');
    expect(result.midi).not.toBeNull();
  });

  it('extracts chord events from Sequ payload inside APPL', () => {
    // Major triad mask: [0,4,7]
    const majMask = (1 << 0) | (1 << 4) | (1 << 7);
    const record = buildChordRecord(majMask, 0x00010000); // some be22 value

    const sequData = record;
    const applPayload = buildApplChunk([{ id: 'Sequ', data: sequData }]);

    const aiff = buildAiff([{ id: 'APPL', data: applPayload }]);
    const result = parseAppleLoop(aiff);

    expect(result.chordEvents.length).toBeGreaterThanOrEqual(1);
    const chord = result.chordEvents[0]!;
    expect(chord.intervals).toEqual([0, 4, 7]);
    expect(chord.mask).toBe(majMask);
  });

  it('extracts both MIDI and chord events', () => {
    const smf = buildMinimalSmf();

    const minMask = (1 << 0) | (1 << 3) | (1 << 7);
    const record = buildChordRecord(minMask, 0x00000000);
    const applPayload = buildApplChunk([{ id: 'Sequ', data: record }]);

    const aiff = buildAiff([
      { id: 'MIDI', data: smf },
      { id: 'APPL', data: applPayload },
    ]);

    const result = parseAppleLoop(aiff);
    expect(result.midi).not.toBeNull();
    expect(result.chordEvents.length).toBeGreaterThanOrEqual(1);
    expect(result.chordEvents[0]!.intervals).toEqual([0, 3, 7]);
  });

  it('returns null midi when no MIDI data is embedded', () => {
    // AIFF with only a dummy COMM chunk (no MIDI)
    const commData = new Uint8Array(18); // minimal COMM chunk data
    const aiff = buildAiff([{ id: 'COMM', data: commData }]);

    const result = parseAppleLoop(aiff);
    expect(result.midi).toBeNull();
    expect(result.format).toBe('AIFF');
  });

  it('handles multiple chord events sorted by position', () => {
    const maj = (1 << 0) | (1 << 4) | (1 << 7);
    const min = (1 << 0) | (1 << 3) | (1 << 7);

    // be22 values chosen so second record sorts before first when decoded
    const rec1 = buildChordRecord(maj, 0x0000C000); // higher norm → earlier position
    const rec2 = buildChordRecord(min, 0x00004000); // lower norm → later position

    const sequData = new Uint8Array(rec1.length + rec2.length);
    sequData.set(rec1, 0);
    sequData.set(rec2, rec1.length);

    const applPayload = buildApplChunk([{ id: 'Sequ', data: sequData }]);
    const aiff = buildAiff([{ id: 'APPL', data: applPayload }]);

    const result = parseAppleLoop(aiff);
    expect(result.chordEvents.length).toBeGreaterThanOrEqual(2);

    // Should be sorted by positionBeats (ascending)
    for (let i = 1; i < result.chordEvents.length; i++) {
      expect(result.chordEvents[i]!.positionBeats)
        .toBeGreaterThanOrEqual(result.chordEvents[i - 1]!.positionBeats);
    }
  });
});

describe('parseAppleLoop — CAF', () => {
  /** Build a minimal CAF file with the given chunks. */
  function buildCaf(
    chunks: Array<{ type: string; data: Uint8Array }>,
  ): ArrayBuffer {
    let totalSize = 8; // caff header
    for (const c of chunks) {
      totalSize += 12 + c.data.length; // type(4) + size(8) + data
    }

    const buf = new ArrayBuffer(totalSize);
    const view = new DataView(buf);
    const bytes = new Uint8Array(buf);

    // CAF header: 'caff' + version(1) + flags(0)
    bytes.set([0x63, 0x61, 0x66, 0x66], 0);
    view.setUint16(4, 1);  // version
    view.setUint16(6, 0);  // flags

    let offset = 8;
    for (const c of chunks) {
      for (let i = 0; i < 4; i++) bytes[offset + i] = c.type.charCodeAt(i);
      offset += 4;
      view.setUint32(offset, 0);           // size hi
      view.setUint32(offset + 4, c.data.length); // size lo
      offset += 8;
      bytes.set(c.data, offset);
      offset += c.data.length;
    }

    return buf;
  }

  it('parses a CAF file with embedded MIDI', () => {
    const smf = buildMinimalSmf();
    const caf = buildCaf([{ type: 'midi', data: smf }]);

    const result = parseAppleLoop(caf);
    expect(result.format).toBe('CAF');
    expect(result.midi).not.toBeNull();
  });

  it('returns null midi for CAF with no MIDI chunk', () => {
    const descData = new Uint8Array(32); // dummy desc chunk
    const caf = buildCaf([{ type: 'desc', data: descData }]);

    const result = parseAppleLoop(caf);
    expect(result.format).toBe('CAF');
    expect(result.midi).toBeNull();
  });
});

describe('formatChordTimeline', () => {
  it('returns "(no chord events)" for empty array', () => {
    expect(formatChordTimeline([])).toBe('(no chord events)');
  });

  it('formats a single event', () => {
    const events: AppleLoopChordEvent[] = [
      {
        mask: 0x91,
        intervals: [0, 4, 7],
        positionBeats: 0,
        rawBe22: 0,
        b8: 2,
        b9: 0,
        rootName: 'C',
        rootPc: 0,
      },
    ];
    // With root C and intervals [0,4,7] (major triad), should format as "C"
    expect(formatChordTimeline(events)).toBe('C');
  });

  it('formats multiple events separated by pipes', () => {
    const events: AppleLoopChordEvent[] = [
      { mask: 0x91, intervals: [0, 4, 7], positionBeats: 0, rawBe22: 0, b8: 2, b9: 0, rootName: 'C', rootPc: 0 },
      { mask: 0x89, intervals: [0, 3, 7], positionBeats: 2, rawBe22: 0, b8: 2, b9: 2, rootName: 'D', rootPc: 2 },
    ];
    const result = formatChordTimeline(events);
    expect(result).toContain('|');
    expect(result).toContain('C'); // Major triad
    expect(result).toContain('D-'); // Minor triad
  });
});
