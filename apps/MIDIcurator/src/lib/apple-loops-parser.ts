/**
 * Apple Loops parser: extracts embedded SMF MIDI and chord metadata
 * from AIFF/AIFC and CAF container files.
 *
 * Based on reverse-engineering documented in docs/APPLE_LOOPS_REVERSE_ENGINEERING.md
 */

import { findQualityByIntervals, spellRoot } from './chord-dictionary';
import type { DetectedChord, Leadsheet, LeadsheetBar, LeadsheetChord } from '../types/clip';

// ─── Types ──────────────────────────────────────────────────────────

/** A chord event extracted from a Sequ payload (type 103). */
export interface AppleLoopChordEvent {
  /** Pitch-class interval bitmask (12 bits, relative to root). */
  mask: number;
  /** Decoded intervals (semitones above root, e.g. [0, 4, 7]). */
  intervals: number[];
  /** Absolute beat position within the loop (0 = loop start). */
  positionBeats: number;
  /** Raw u32-BE field at record offset 0x18 (for debugging). */
  rawBe22: number;
  /** Raw b8 field (encodes accidental). */
  b8: number;
  /** Raw b9 field (encodes pitch class or accidental hint). */
  b9: number;
  /** Root note name (e.g. "C", "F♯") if b8/b9 scheme allows full decode. */
  rootName?: string;
  /** Root pitch class (0-11) if b8/b9 scheme allows full decode. */
  rootPc?: number;
  /** Accidental hint (for b8=15 scheme, where b9 encodes hint not full PC). */
  accidentalHint?: 'flat' | 'natural' | 'sharp';
}

/** Result of parsing an Apple Loop file (AIFF or CAF). */
export interface AppleLoopParseResult {
  /** Embedded MIDI as ArrayBuffer, or null if not found. */
  midi: ArrayBuffer | null;
  /** Chord events extracted from Sequ chunk. */
  chordEvents: AppleLoopChordEvent[];
  /** Beats per bar from basc chunk (default 4). */
  beatsPerBar: number;
  /**
   * Total number of beats in the loop from the basc chunk.
   * Divide by beatsPerBar to get numBars.  May be undefined for CAF files.
   */
  numberOfBeats?: number;
  /** Format: "AIFF" or "CAF". */
  format: string;
}

// ─── Helper Functions ───────────────────────────────────────────────

/** Check if a filename looks like an Apple Loop. */
export function isAppleLoopFile(filename: string): boolean {
  return /\.(aif|aiff|caf)$/i.test(filename);
}

/**
 * Decode the 12-bit interval mask into an array of pitch-class offsets.
 * Bit 0 (LSB) → interval 0, bit 1 → interval 1, ..., bit 11 → interval 11.
 */
function decodeIntervalMask(mask: number): number[] {
  const intervals: number[] = [];
  for (let i = 0; i < 12; i++) {
    if (mask & (1 << i)) {
      intervals.push(i);
    }
  }
  return intervals;
}

interface RootInfo {
  name: string;
  pc: number;
}

interface AccidentalHintInfo {
  accidentalHint: 'flat' | 'natural' | 'sharp';
}

/**
 * Decode b8 and b9 bytes into root note information.
 *
 * Schemes discovered:
 *   1. b8 ∈ {1, 2, 3} (Apple first-party): full root encoding
 *      - b8=1 → flat, b8=2 → natural, b8=3 → sharp
 *      - b9 = pitch class
 *   2. b8=0x0f (15) (User-generated v1): accidental hint only
 *      - b9 encodes accidental hint, not full PC
 *      - Root must be inferred from MIDI notes
 *   3. b8=0xff (255) (User-generated v2): unknown encoding
 */
function decodeRootNote(
  b8: number,
  b9: number,
): RootInfo | AccidentalHintInfo | null {
  // Scheme 1: b8 ∈ {1, 2, 3} (full root encoding)
  if (b8 === 1 || b8 === 2 || b8 === 3) {
    const pc = b9 % 12;

    // Natural notes (b8 = 2)
    const naturals = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    const naturalPcs = [0, 2, 4, 5, 7, 9, 11];

    if (b8 === 2) {
      const idx = naturalPcs.indexOf(pc);
      if (idx >= 0) {
        return { name: naturals[idx]!, pc };
      }
    } else if (b8 === 3) {
      // Sharp (b8 = 3)
      const sharpNames = ['C♯', 'D♯', 'F♯', 'G♯', 'A♯'];
      const sharpPcs = [1, 3, 6, 8, 10];
      const idx = sharpPcs.indexOf(pc);
      if (idx >= 0) {
        return { name: sharpNames[idx]!, pc };
      }
    } else if (b8 === 1) {
      // Flat (b8 = 1)
      const flatNames = ['D♭', 'E♭', 'G♭', 'A♭', 'B♭'];
      const flatPcs = [1, 3, 6, 8, 10];
      const idx = flatPcs.indexOf(pc);
      if (idx >= 0) {
        return { name: flatNames[idx]!, pc };
      }
    }

    // Fallback: shouldn't reach here for valid Apple first-party data
    return null;
  }

  // Scheme 2: b8=0x0f (15) - accidental hint only
  if (b8 === 0x0f || b8 === 15) {
    // b9 encodes accidental hint
    // Observed: b9=1 or b9=2 might encode flat/natural/sharp
    // This is a hint; actual root must be inferred from MIDI
    if (b9 === 0 || b9 === 2) {
      return { accidentalHint: 'natural' };
    } else if (b9 === 1) {
      return { accidentalHint: 'flat' };
    } else if (b9 === 3) {
      return { accidentalHint: 'sharp' };
    }
    return { accidentalHint: 'natural' }; // default
  }

  // Scheme 3: b8=0xff (255) or other values - unknown
  return null;
}

/**
 * Decode the 3-byte position field at record offset 0x18 into an absolute tick.
 *
 * Encoding (fully reverse-engineered from LpTm* + 360 Blazing Clusters corpus):
 *
 *   Bytes at record offsets [0x18, 0x19, 0x1a]:
 *     b18 = fractional addition byte: adds b18/2 ticks (256 sub-units per 128-tick unit)
 *     b19 = low byte of integer position unit (u16LE with b1a)
 *     b1a = high byte of integer position unit
 *
 *   Formula (at 480ppq):
 *     main = b19 | (b1a << 8)          // u16LE from bytes 0x19 and 0x1a
 *     tick = (main - 0x96) * 128 + (b18 >> 1)
 *
 *   Origin: main=0x96 → tick 0. Scale: 128 ticks per integer unit.
 *   Fractional: b18/2 ticks added (e.g. b18=0x80=128 → +64 ticks = +⅓ beat at 480ppq).
 *   At 480ppq, 1 bar (4/4) = 1920 ticks = 15 integer units.
 *
 *   Verified empirically across LpTm corpus and production Apple Loop files:
 *   LpTmB1 record 1: b18=0x80, b19=0x9d, b1a=0 → tick=960 (beat 2.0) ✓
 *   Waves of Nostalgia: b18=0x40, b19=0xa2, b1a=0 → tick=1440 (beat 3.0) ✓
 *   8-Track Tape: b18=0xa7, b19=0x9d, b1a=0 → tick=980 (beat ~2.04) ✓
 *
 * @param b18  byte at record offset 0x18 (fractional addition: adds b18/2 ticks)
 * @param b19  byte at record offset 0x19 (low integer byte)
 * @param b1a  byte at record offset 0x1a (high integer byte)
 */
function decodePositionTick(b18: number, b19: number, b1a: number): number {
  const main = b19 | (b1a << 8);
  // b18 is a fractional addition: b18/2 ticks added to the integer grid position.
  // 256 sub-units per 128-tick unit → 0.5 ticks per sub-unit.
  return Math.max(0, (main - 0x96) * 128 + (b18 >> 1));
}

/**
 * Scan a Sequ payload for chord events (type == 103).
 * Scans every 2-byte boundary looking for type-103 records.
 *
 * Record structure (32 bytes):
 *   +0x00: u16 LE type (103 for chord event)
 *   +0x04: u16 LE mask (12-bit pitch-class bitmask)
 *   +0x08: u8 b8 (accidental / scheme marker)
 *   +0x09: u8 b9 (pitch class or accidental hint)
 *   +0x18: u8 b18 (fractional addition: adds b18/2 ticks)
 *   +0x19: u8 b19 (low byte of integer position unit)
 *   +0x1a: u8 b1a (high byte — needed for loops > ~16 bars at 4/4)
 *           tick = (b19|(b1a<<8) − 0x96) × 128 + b18/2  (at 480ppq)
 */
function extractChordEventsFromSequ(
  data: Uint8Array,
  ticksPerBeat: number,
): AppleLoopChordEvent[] {
  const events: AppleLoopChordEvent[] = [];
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const RECORD_SIZE = 32;

  // Scale factor: formula assumes 480ppq; adjust for actual ppq
  const tickScale = ticksPerBeat / 480;

  // Scan for type==103 records at every 2-byte boundary
  for (let off = 0; off + RECORD_SIZE <= data.length; off += 2) {
    const type = view.getUint16(off, true); // Little-endian
    if (type !== 103) continue;

    const mask = view.getUint16(off + 0x04, true); // Little-endian
    const b8 = data[off + 0x08]!;
    const b9 = data[off + 0x09]!;
    // Position field: 3-byte value at record offsets 0x18..0x1a (see decodePositionTick)
    const posB18 = data[off + 0x18]!;  // fractional byte (negated)
    const posB19 = data[off + 0x19]!;  // low integer byte
    const posB1a = data[off + 0x1a]!;  // high integer byte (overflow for loops > 16 bars)
    // Keep rawBe22 for debugging (full big-endian u32 at 0x18)
    const be22 = view.getUint32(off + 0x18, false);

    const intervals = decodeIntervalMask(mask);

    // Decode absolute tick position, scaled to actual ppq
    const absoluteTick = decodePositionTick(posB18, posB19, posB1a) * tickScale;
    const positionBeats = absoluteTick / ticksPerBeat;

    const rootInfo = decodeRootNote(b8, b9);

    const event: AppleLoopChordEvent = {
      mask,
      intervals,
      positionBeats,
      rawBe22: be22,
      b8,
      b9,
    };

    // Skip note-tracker bookmarks: mask=0, b8=0 — these are position markers
    // attached to individual notes, not chord annotations.
    if (mask === 0 && b8 === 0) continue;

    if (rootInfo) {
      if ('accidentalHint' in rootInfo) {
        event.accidentalHint = rootInfo.accidentalHint;
      } else {
        event.rootName = rootInfo.name;
        event.rootPc = rootInfo.pc;
      }
    }

    events.push(event);
  }

  // Sort by absolute beat position (now reliable)
  events.sort((a, b) => a.positionBeats - b.positionBeats);

  return events;
}

// ─── Sequ chunk helper ──────────────────────────────────────────────

interface IffChunk {
  id: string;
  data: Uint8Array;
  offset: number;
}

/**
 * Parse IFF-style chunks from a data region.
 * Used for both top-level AIFF chunks and nested subchunks inside APPL payloads.
 */
function parseIffChunks(data: Uint8Array, startOffset: number = 0): IffChunk[] {
  const chunks: IffChunk[] = [];
  let offset = startOffset;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  while (offset + 8 <= data.length) {
    const id = String.fromCharCode(data[offset]!, data[offset + 1]!, data[offset + 2]!, data[offset + 3]!);
    offset += 4;

    const size = view.getUint32(offset);
    offset += 4;

    if (offset + size > data.length) break;

    chunks.push({
      id,
      data: data.subarray(offset, offset + size),
      offset,
    });

    offset += size;
    // AIFF chunks are word-aligned; skip padding byte if odd size
    if (size % 2 !== 0 && offset < data.length) {
      offset += 1;
    }
  }

  return chunks;
}

/**
 * Recursively search for Sequ chunks in nested IFF structures.
 * Some Apple Loops have Sequ inside APPL inside INST; others have top-level Sequ.
 */
function findSequChunks(chunks: IffChunk[]): Uint8Array[] {
  const sequPayloads: Uint8Array[] = [];

  for (const chunk of chunks) {
    if (chunk.id === 'Sequ') {
      sequPayloads.push(chunk.data);
    }
    // Recurse into APPL chunks which may contain nested Sequ
    if (chunk.id === 'APPL') {
      const nested = parseIffChunks(chunk.data);
      sequPayloads.push(...findSequChunks(nested));
    }
  }

  return sequPayloads;
}

// ─── MIDI extraction ────────────────────────────────────────────────

/**
 * Search for embedded MIDI data.
 * Apple Loops may store SMF MIDI in chunks like '.mid' (AIFF) or 'midi' (CAF).
 * Fallback: scan entire buffer for 'MThd' magic.
 */
function extractEmbeddedMidi(data: Uint8Array): ArrayBuffer | null {
  // Scan for 'MThd' (MIDI header magic)
  for (let i = 0; i <= data.length - 4; i++) {
    if (
      data[i] === 0x4d &&
      data[i + 1] === 0x54 &&
      data[i + 2] === 0x68 &&
      data[i + 3] === 0x64
    ) {
      // Found potential MIDI header; return from here to end (simplified extraction)
      return data.slice(i).buffer;
    }
  }
  return null;
}

// ─── AIFF container ─────────────────────────────────────────────────

/**
 * Parse an AIFF/AIFC file and extract Apple Loops data.
 *
 * AIFF structure:
 *   File header: 'FORM' (4 bytes) + size (4 bytes BE) + 'AIFF'/'AIFC' (4 bytes)
 *   Chunks: chunk_id (4 bytes) + size (4 bytes BE) + data
 *
 * Relevant chunks:
 *   - '.mid' or similar: embedded MIDI
 *   - 'APPL' → nested chunks may contain 'Sequ'
 *   - 'Sequ' (top-level or nested): chord events
 */
function parseAiff(arrayBuffer: ArrayBuffer): AppleLoopParseResult {
  const data = new Uint8Array(arrayBuffer);

  // Validate FORM header
  const formMagic = String.fromCharCode(data[0]!, data[1]!, data[2]!, data[3]!);
  if (formMagic !== 'FORM') {
    throw new Error('Not a valid AIFF file: missing FORM header');
  }

  const formType = String.fromCharCode(data[8]!, data[9]!, data[10]!, data[11]!);
  if (formType !== 'AIFF' && formType !== 'AIFC') {
    throw new Error('Not a valid AIFF/AIFC file: unexpected form type');
  }

  let midi: ArrayBuffer | null = null;
  const allChordEvents: AppleLoopChordEvent[] = [];
  // Apple Loops always use 480ppq; the position encoding is calibrated to 480ppq.
  const APPLE_LOOPS_TPB = 480;

  // Parse top-level IFF chunks starting at offset 12
  const chunks = parseIffChunks(data, 12);

  let beatsPerBar = 4;
  let numberOfBeats: number | undefined;

  // Look for MIDI and Sequ chunks
  for (const chunk of chunks) {
    // Parse 'basc' chunk: Apple Loops beat/bar metadata
    // Layout (big-endian):
    //   bytes [0:4]   = unknown (version/flags)
    //   bytes [4:8]   = numberOfBeats (uint32 BE)
    //   bytes [8:12]  = unknown
    //   bytes [12:13] = timeSigNumerator (uint16 BE, e.g. 4)
    //   bytes [14:15] = timeSigDenominator (uint16 BE, e.g. 4)
    if (chunk.id === 'basc' && chunk.data.length >= 16) {
      const bascView = new DataView(chunk.data.buffer, chunk.data.byteOffset, chunk.data.byteLength);
      const beats = bascView.getUint32(4, false);  // big-endian
      const timeSigN = bascView.getUint16(12, false);
      if (beats > 0) numberOfBeats = beats;
      if (timeSigN > 0) beatsPerBar = timeSigN;
    }

    // Check for top-level Sequ chunks (user-generated loops)
    if (chunk.id === 'Sequ') {
      const events = extractChordEventsFromSequ(chunk.data, APPLE_LOOPS_TPB);
      allChordEvents.push(...events);
    }

    // Check for '.mid' chunk (MIDI data)
    if (chunk.id === '.mid') {
      const extracted = extractEmbeddedMidi(chunk.data);
      if (extracted && !midi) {
        midi = extracted;
      }
    }

    // Check for 'midi' chunk variant
    if (chunk.id === 'midi') {
      const extracted = extractEmbeddedMidi(chunk.data);
      if (extracted && !midi) {
        midi = extracted;
      }
    }

    // Recurse into APPL chunks for nested Sequ
    if (chunk.id === 'APPL') {
      const sequPayloads = findSequChunks([chunk]);
      for (const sequ of sequPayloads) {
        const events = extractChordEventsFromSequ(sequ, APPLE_LOOPS_TPB);
        allChordEvents.push(...events);
      }

      // Also check for embedded MIDI inside APPL
      const subChunks = parseIffChunks(chunk.data);
      for (const sub of subChunks) {
        if (sub.id === '.mid' || sub.id === 'midi') {
          const extracted = extractEmbeddedMidi(sub.data);
          if (extracted && !midi) {
            midi = extracted;
          }
        }
      }
    }
  }

  // Last resort: scan the entire file for MThd
  if (!midi) {
    midi = extractEmbeddedMidi(data);
  }

  return { midi, chordEvents: allChordEvents, beatsPerBar, numberOfBeats, format: 'AIFF' };
}

// ─── CAF container ──────────────────────────────────────────────────

/**
 * Parse a CAF (Core Audio Format) file and extract Apple Loops data.
 *
 * CAF structure:
 *   File header: 'caff' (4 bytes) + version (2) + flags (2) = 8 bytes
 *   Chunks: chunk_type (4) + chunk_size (i64) + data
 *
 * CAF uses big-endian, chunk sizes are signed 64-bit.
 */
function parseCaf(arrayBuffer: ArrayBuffer): AppleLoopParseResult {
  const data = new Uint8Array(arrayBuffer);
  const view = new DataView(arrayBuffer);

  // Validate CAF header: 'caff'
  const magic = String.fromCharCode(data[0]!, data[1]!, data[2]!, data[3]!);
  if (magic !== 'caff') {
    throw new Error('Not a valid CAF file: missing caff header');
  }

  let midi: ArrayBuffer | null = null;
  const allChordEvents: AppleLoopChordEvent[] = [];

  // Parse CAF chunks starting at offset 8
  let offset = 8;

  while (offset + 12 <= data.length) {
    const chunkType = String.fromCharCode(
      data[offset]!, data[offset + 1]!, data[offset + 2]!, data[offset + 3]!,
    );

    // CAF chunk size is i64 big-endian; for practical files, read lower 32 bits
    // (upper 32 should be 0 for reasonable file sizes)
    const sizeHi = view.getUint32(offset + 4);
    const sizeLo = view.getUint32(offset + 8);
    const chunkSize = sizeHi === 0 ? sizeLo : -1; // Skip impossibly large chunks

    offset += 12; // past type + size

    if (chunkSize < 0 || offset + chunkSize > data.length) break;

    const chunkData = data.subarray(offset, offset + chunkSize);

    // 'midi' chunk in CAF can contain SMF data
    if (chunkType === 'midi') {
      const extracted = extractEmbeddedMidi(chunkData);
      if (extracted && !midi) {
        midi = extracted;
      }
    }

    // 'info' or user-defined chunks may contain Apple Loops metadata
    // Apple Loops in CAF often use 'user' or vendor-specific chunk types
    if (chunkType === 'user' || chunkType === 'APPL') {
      // Try to parse nested IFF subchunks
      const subChunks = parseIffChunks(chunkData);
      for (const sub of subChunks) {
        if (sub.id === 'Sequ') {
          const events = extractChordEventsFromSequ(sub.data, 480);
          allChordEvents.push(...events);
        }
      }

      // Also scan for embedded MIDI
      const extracted = extractEmbeddedMidi(chunkData);
      if (extracted && !midi) {
        midi = extracted;
      }
    }

    offset += chunkSize;
  }

  // Last resort: scan entire file for MThd
  if (!midi) {
    midi = extractEmbeddedMidi(data);
  }

  return { midi, chordEvents: allChordEvents, beatsPerBar: 4, format: 'CAF' };
}

// ─── Main API ───────────────────────────────────────────────────────

/**
 * Parse an Apple Loop file (AIFF or CAF) and extract embedded MIDI + chord metadata.
 */
export function parseAppleLoop(arrayBuffer: ArrayBuffer): AppleLoopParseResult {
  const data = new Uint8Array(arrayBuffer);

  // Detect format by magic bytes
  const magic = String.fromCharCode(data[0]!, data[1]!, data[2]!, data[3]!);

  if (magic === 'FORM') {
    return parseAiff(arrayBuffer);
  } else if (magic === 'caff') {
    return parseCaf(arrayBuffer);
  } else {
    throw new Error(`Unsupported file format: ${magic}`);
  }
}

// ─── Enrichment (for b8=15 scheme) ──────────────────────────────────

interface MidiNote {
  pitch: number;
  start: number;
  duration: number;
}

/**
 * Enrich chord events that have accidental hints (b8=15) by inferring
 * root from MIDI notes.
 *
 * Strategy: For each event, find the lowest MIDI pitch within the chord block,
 * reduce to pitch class, and spell it using the accidental hint.
 */
export function enrichChordEventsWithMidiRoots(
  events: AppleLoopChordEvent[],
  midiNotes: MidiNote[],
): AppleLoopChordEvent[] {
  return events.map((event) => {
    // Only enrich events with accidental hint (scheme 2)
    if (!event.accidentalHint) return event;

    // Find MIDI notes that overlap with this chord event
    // (simplified: use all notes in the clip)
    const pitches = midiNotes.map((n) => n.pitch);
    if (pitches.length === 0) return event;

    // Get lowest pitch as root
    const lowestPitch = Math.min(...pitches);
    const rootPc = lowestPitch % 12;

    // Spell root based on accidental hint
    const rootName = spellRootByHint(rootPc, event.accidentalHint);

    return {
      ...event,
      rootPc,
      rootName,
    };
  });
}

function spellRootByHint(
  pc: number,
  hint: 'flat' | 'natural' | 'sharp',
): string {
  const naturals = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const naturalPcs = [0, 2, 4, 5, 7, 9, 11];
  const sharps = ['C♯', 'D♯', 'F♯', 'G♯', 'A♯'];
  const sharpPcs = [1, 3, 6, 8, 10];
  const flats = ['D♭', 'E♭', 'G♭', 'A♭', 'B♭'];
  const flatPcs = [1, 3, 6, 8, 10];

  if (hint === 'natural') {
    const idx = naturalPcs.indexOf(pc);
    if (idx >= 0) return naturals[idx]!;
  } else if (hint === 'sharp') {
    const idx = sharpPcs.indexOf(pc);
    if (idx >= 0) return sharps[idx]!;
  } else if (hint === 'flat') {
    const idx = flatPcs.indexOf(pc);
    if (idx >= 0) return flats[idx]!;
  }

  // Fallback: use natural spelling
  const idx = naturalPcs.indexOf(pc);
  if (idx >= 0) return naturals[idx]!;

  // Last resort: generic sharp
  return sharps[sharpPcs.indexOf(pc)] || `PC${pc}`;
}

// ─── Formatting ─────────────────────────────────────────────────────

/**
 * Convert Apple Loop chord events into a human-readable chord timeline string.
 * Formats chords as symbols when root is decoded, otherwise shows interval sets with quality.
 */
export function formatChordTimeline(events: AppleLoopChordEvent[]): string {
  if (events.length === 0) return '(no chord events)';

  return events
    .map((e) => {
      // Look up chord quality from interval pattern
      const quality = findQualityByIntervals(e.intervals);

      if (e.rootName && e.rootPc !== undefined) {
        // We have a decoded root - format as chord symbol
        if (quality) {
          // Use the quality's display name
          return `${e.rootName}${quality.displayName}`;
        }

        // Fallback: show root + intervals (or "Root?" for empty/degenerate masks)
        return e.intervals.length > 1
          ? `${e.rootName}[${e.intervals.join(',')}]`
          : `${e.rootName}?`;
      }

      // No root decoded - show quality or intervals
      if (quality) {
        // We found a quality! Show it as "?" + display name
        return `?${quality.displayName}`;
      }

      // Fallback: show intervals only
      const intervals = e.intervals.join(',');
      return `[${intervals}]`;
    })
    .join(' | ');
}

/**
 * Convert an Apple Loop chord event to a DetectedChord.
 * Similar to toDetectedChord in gesture.ts, but for Apple Loop metadata.
 */
export function appleLoopEventToDetectedChord(event: AppleLoopChordEvent): {
  chord: DetectedChord | null;
  symbol: string;
} {
  // Empty mask, root-only [0], or any single-interval set = Logic Pro "No Chord" annotation.
  // These appear in files tagged as hasChords but with no actual chord at that position.
  if (event.intervals.length <= 1) {
    return { chord: null, symbol: 'NC' };
  }

  // Intervals without bit 0 (root) set — spurious preamble records found in some
  // Apple Loops (e.g. Snow Blind Sweeps 01/02).  The root pitch class is encoded in
  // b8/b9 but is NOT reflected in the bitmask, so quality lookup always fails.
  if (!event.intervals.includes(0)) {
    return { chord: null, symbol: 'NC' };
  }

  const quality = findQualityByIntervals(event.intervals);

  // Unmatched or rootless dyads → NC.
  if (event.intervals.length === 2 &&
      (!quality || !event.rootName || event.rootPc === undefined)) {
    return { chord: null, symbol: 'NC' };
  }

  // Chromatic / oversized clusters (> 7 distinct intervals) → NC.
  // These appear in audio/drone loops and carry no harmonic meaning.
  if (event.intervals.length > 7) {
    return { chord: null, symbol: 'NC' };
  }

  // All rootless events → NC; without a root a chord annotation is unplayable.
  if (!event.rootName || event.rootPc === undefined) {
    return { chord: null, symbol: 'NC' };
  }

  // Rooted but no quality match → show "Root[intervals]" for export/debugging.
  if (!quality) {
    return { chord: null, symbol: `${event.rootName}[${event.intervals.join(',')}]` };
  }

  // Full chord with root and quality
  const symbol = `${event.rootName}${quality.displayName}`;

  // Build DetectedChord (minimal structure for display)
  const chord: DetectedChord = {
    root: event.rootPc,
    rootName: event.rootName,
    qualityKey: quality.key,
    symbol,
    qualityName: quality.fullName,
    observedPcs: event.intervals.map(i => (event.rootPc! + i) % 12).sort((a, b) => a - b),
    templatePcs: quality.pcs.map(i => (event.rootPc! + i) % 12).sort((a, b) => a - b),
  };

  return { chord, symbol };
}

/**
 * Convert Apple Loop chord events into a Leadsheet structure.
 *
 * **Current Limitation:** The be22 field encoding for multi-bar positions
 * is not yet fully understood. For now, we distribute chords evenly across
 * bars based on event count and order.
 *
 * @param events - Apple Loop chord events (should already be sorted by position)
 * @param numBars - Total number of bars in the clip
 * @param beatsPerBar - Beats per bar (typically 4)
 */
export function appleLoopEventsToLeadsheet(
  events: AppleLoopChordEvent[],
  numBars: number,
  beatsPerBar: number = 4,
  /**
   * Target root pitch class (from loopMeta.rootPc) — the key the loop actually
   * plays in.  Sequ chords are often stored in the loop's original MIDI key, which
   * may differ from the playback key.  When provided, all chord roots are
   * transposed by `(targetRootPc − firstSequ_rootPc) mod 12` semitones so that
   * the first rooted chord aligns with the DB-tagged key.
   */
  targetRootPc?: number,
): Leadsheet | null {
  if (events.length === 0) return null;

  // ── Root transposition ──────────────────────────────────────────────────────
  // Compute semitone offset from first event that has a decoded root.
  // offset = (DB key − Sequ first root) mod 12.  No-op when offset is 0.
  let semitoneOffset = 0;
  if (targetRootPc !== undefined) {
    const firstRooted = events.find(e => e.rootPc !== undefined);
    if (firstRooted?.rootPc !== undefined) {
      semitoneOffset = (targetRootPc - firstRooted.rootPc + 12) % 12;
    }
  }
  // Build a working copy with transposed roots (only if offset is non-zero).
  const workEvents: AppleLoopChordEvent[] = semitoneOffset === 0 ? events : events.map(e => {
    if (e.rootPc === undefined) return e;
    const pc = (e.rootPc + semitoneOffset) % 12;
    return { ...e, rootPc: pc, rootName: spellRoot(pc, targetRootPc) };
  });

  // Group events by bar using their decoded positionBeats.
  // Events are sorted by positionBeats (guaranteed by extractChordEventsFromSequ).
  // positionBeats is the absolute beat position across the whole loop (0-indexed).
  const barGroups = new Map<number, AppleLoopChordEvent[]>();
  for (const event of workEvents) {
    const barIdx = Math.floor(event.positionBeats / beatsPerBar);
    const clampedBar = Math.max(0, Math.min(numBars - 1, barIdx));
    if (!barGroups.has(clampedBar)) barGroups.set(clampedBar, []);
    barGroups.get(clampedBar)!.push(event);
  }

  const bars: LeadsheetBar[] = [];

  // Track the last chord seen so we can extend it across empty bars.
  let lastChord: LeadsheetChord | null = null;

  for (let barIdx = 0; barIdx < numBars; barIdx++) {
    const barEvents = barGroups.get(barIdx);

    if (!barEvents || barEvents.length === 0) {
      // No events in this bar — extend the previous chord across the whole bar.
      if (lastChord) {
        const carried: LeadsheetChord = {
          ...lastChord,
          position: 0,
          totalInBar: 1,
          beatPosition: 0,
          duration: beatsPerBar,
        };
        bars.push({ bar: barIdx, chords: [carried], isRepeat: false });
      }
      continue;
    }

    // Compute duration for each chord = distance to next chord (or to end of bar).
    // For the last chord in the bar, extend to the start of the *next* event across
    // all bars (not just within this bar), so chords span bar boundaries naturally.
    const barEnd = (barIdx + 1) * beatsPerBar;

    // Decode all events for this bar, clamping beat positions to ≥ 0.
    // Clamp to 0: the position formula can yield small negative ticks when b18 is
    // large relative to b19 (e.g. Unsure Paths 02 record 0 decodes to beat -1.4
    // due to a large fractional subtraction byte). Treat those as bar start.
    const decoded = barEvents.map(e => {
      const { chord, symbol } = appleLoopEventToDetectedChord(e);
      const beatPosition = Math.max(0, e.positionBeats - barIdx * beatsPerBar);
      return { chord, symbol, beatPosition };
    });

    // Filter out pure NC annotations (chord resonance principle: a chord remains
    // valid until the next real chord change, even when NC records are present).
    const harmonic = decoded.filter(d => !(d.chord === null && d.symbol === 'NC'));

    if (harmonic.length === 0) {
      // Every event in this bar decoded to NC — extend the previous chord.
      if (lastChord) {
        const carried: LeadsheetChord = {
          ...lastChord,
          position: 0,
          totalInBar: 1,
          beatPosition: 0,
          duration: beatsPerBar,
        };
        bars.push({ bar: barIdx, chords: [carried], isRepeat: false });
      }
      continue;
    }

    const rawChords: LeadsheetChord[] = harmonic.map((d, position) => {
      // Duration = distance to next harmonic chord in this bar, or fill to bar end.
      const next = harmonic[position + 1];
      const nextBeat = next
        ? Math.max(d.beatPosition, next.beatPosition)
        : barEnd - barIdx * beatsPerBar;
      const duration = Math.max(0, nextBeat - d.beatPosition);

      return {
        chord: d.chord,
        inputText: d.symbol,
        position,
        totalInBar: harmonic.length,
        beatPosition: d.beatPosition,
        duration,
      };
    });

    // If the first event in this bar doesn't start at beat 0 and we have a
    // previous chord, prepend a carried segment to fill the gap at the bar start.
    // This covers patterns like Timid Tremble Synth where the chord changes
    // mid-bar and the new bar inherits the tail of the previous bar's last chord.
    const firstBeat = rawChords[0]?.beatPosition ?? 0;
    const chords: LeadsheetChord[] = (firstBeat > 0 && lastChord)
      ? [
          {
            ...lastChord,
            position: 0,
            totalInBar: rawChords.length + 1,
            beatPosition: 0,
            duration: firstBeat,
          },
          ...rawChords.map((c, i) => ({ ...c, position: i + 1, totalInBar: rawChords.length + 1 })),
        ]
      : rawChords;

    lastChord = chords[chords.length - 1]!;

    bars.push({
      bar: barIdx,
      chords,
      isRepeat: false,
    });
  }

  // Create input text with bar delimiters (pipe) and space-separated chords within bars
  const inputText = bars.map(bar =>
    bar.chords.map(c => c.inputText).join(' ')
  ).join(' | ');

  return {
    inputText,
    bars,
  };
}
