#!/usr/bin/env node
/**
 * Analyze Apple Loop files and extract all available metadata.
 *
 * Usage:
 *   node scripts/analyze-apple-loops.mjs <file1.aif> <file2.caf> ...
 *   node scripts/analyze-apple-loops.mjs *.aif
 */

import { readFileSync } from 'fs';
import { basename } from 'path';

// ─── Inline minimal parser (for use outside the main codebase) ────

function decodeIntervalMask(mask) {
  const intervals = [];
  for (let i = 0; i < 12; i++) {
    if (mask & (1 << i)) intervals.push(i);
  }
  return intervals;
}

function decodeRootNote(b8, b9) {
  const pc = b9 % 12;
  const accidental = b8;

  // Natural notes (b8 = 2)
  const naturals = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const naturalPcs = [0, 2, 4, 5, 7, 9, 11];

  if (accidental === 2) {
    const idx = naturalPcs.indexOf(pc);
    if (idx >= 0) return { name: naturals[idx], pc };
  } else if (accidental === 3) {
    // Sharp
    const sharpNames = ['C♯', 'D♯', 'F♯', 'G♯', 'A♯'];
    const sharpPcs = [1, 3, 6, 8, 10];
    const idx = sharpPcs.indexOf(pc);
    if (idx >= 0) return { name: sharpNames[idx], pc };
  } else if (accidental === 1) {
    // Flat
    const flatNames = ['D♭', 'E♭', 'G♭', 'A♭', 'B♭'];
    const flatPcs = [1, 3, 6, 8, 10];
    const idx = flatPcs.indexOf(pc);
    if (idx >= 0) return { name: flatNames[idx], pc };
  }

  return null;
}

function decodeBe22(be22, beatsPerBar) {
  const lo16 = be22 & 0xFFFF;  // Use low 16 bits only
  const norm = lo16 / 65536.0;
  let pos = (1.0 - norm) * beatsPerBar;
  pos = ((pos % beatsPerBar) + beatsPerBar) % beatsPerBar;
  return pos;
}

// Minimal chord quality lookup (subset of common qualities)
const CHORD_QUALITIES = [
  { key: "maj", displayName: "", pcs: [0,4,7] },
  { key: "min", displayName: "-", pcs: [0,3,7] },
  { key: "maj7", displayName: "∆", pcs: [0,4,7,11] },
  { key: "min7", displayName: "-7", pcs: [0,3,7,10] },
  { key: "7", displayName: "7", pcs: [0,4,7,10] },
  { key: "min7b5", displayName: "ø", pcs: [0,3,6,10] },
  { key: "dim7", displayName: "°7", pcs: [0,3,6,9] },
  { key: "sus4", displayName: "sus4", pcs: [0,5,7] },
  { key: "sus2", displayName: "sus2", pcs: [0,2,7] },
  { key: "7sus4", displayName: "7sus4", pcs: [0,5,7,10] },
  { key: "maj6", displayName: "6", pcs: [0,4,7,9] },
  { key: "min6", displayName: "-6", pcs: [0,3,7,9] },
  { key: "7b9", displayName: "7b9", pcs: [0,4,7,10,1] },
  { key: "7#9", displayName: "7#9", pcs: [0,4,7,10,3] },
  { key: "7b13", displayName: "7b13", pcs: [0,4,7,10,8] },
  { key: "9", displayName: "9", pcs: [0,4,7,10,2] },
  { key: "maj9", displayName: "∆9", pcs: [0,4,7,11,2] },
  { key: "min9", displayName: "-9", pcs: [0,3,7,10,2] },
];

function findQualityByIntervals(intervals) {
  const sorted = [...new Set(intervals)].sort((a, b) => a - b);

  for (const quality of CHORD_QUALITIES) {
    if (quality.pcs.length === sorted.length &&
        quality.pcs.every((pc, i) => pc === sorted[i])) {
      return quality;
    }
  }

  return null;
}

function parseIffChunks(data, startOffset = 0) {
  const chunks = [];
  let offset = startOffset;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  while (offset + 8 <= data.length) {
    const id = String.fromCharCode(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]);
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
    if (size % 2 !== 0 && offset < data.length) {
      offset += 1;
    }
  }

  return chunks;
}

function extractChordEventsFromSequ(data, beatsPerBar) {
  const events = [];
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const RECORD_SIZE = 32; // Corrected: 32 bytes, not 30

  // Scan every 2-byte boundary
  for (let off = 0; off + RECORD_SIZE <= data.length; off += 2) {
    const type = view.getUint16(off, true); // Little-endian
    if (type !== 103) continue;

    const mask = view.getUint16(off + 0x04, true); // Little-endian!
    const b8 = data[off + 0x08];
    const b9 = data[off + 0x09];
    const be22 = view.getUint32(off + 0x18, false); // Big-endian, offset corrected

    const intervals = decodeIntervalMask(mask);
    const positionBeats = decodeBe22(be22, beatsPerBar);
    const root = decodeRootNote(b8, b9);

    events.push({
      mask,
      intervals,
      positionBeats,
      rawBe22: be22,
      b8,
      b9,
      rootName: root?.name,
      rootPc: root?.pc,
    });
  }

  events.sort((a, b) => a.positionBeats - b.positionBeats);
  return events;
}

function findMThd(data) {
  for (let i = 0; i <= data.length - 4; i++) {
    if (data[i] === 0x4D && data[i + 1] === 0x54 && data[i + 2] === 0x68 && data[i + 3] === 0x64) {
      return i;
    }
  }
  return -1;
}

function computeSmfSize(data, start) {
  const view = new DataView(data.buffer, data.byteOffset + start, data.byteLength - start);

  if (start + 14 > data.length) return -1;

  const headerSize = view.getUint32(4);
  let offset = 8 + headerSize;

  const trackCount = view.getUint16(10);

  for (let i = 0; i < trackCount; i++) {
    if (start + offset + 8 > data.length) return -1;

    const chunkId = String.fromCharCode(
      data[start + offset],
      data[start + offset + 1],
      data[start + offset + 2],
      data[start + offset + 3],
    );

    if (chunkId !== 'MTrk') return -1;

    const trackLen = view.getUint32(offset + 4);
    offset += 8 + trackLen;
  }

  return offset;
}

function extractEmbeddedMidi(data) {
  const mthdOffset = findMThd(data);
  if (mthdOffset < 0) return null;

  const smfSize = computeSmfSize(data, mthdOffset);
  if (smfSize <= 0) return null;

  return data.subarray(mthdOffset, mthdOffset + smfSize);
}

function parseAiff(arrayBuffer) {
  const data = new Uint8Array(arrayBuffer);
  const view = new DataView(arrayBuffer);

  const formTag = String.fromCharCode(data[0], data[1], data[2], data[3]);
  if (formTag !== 'FORM') {
    throw new Error('Not a valid AIFF file');
  }

  const formSize = view.getUint32(4);
  const formType = String.fromCharCode(data[8], data[9], data[10], data[11]);

  if (formType !== 'AIFF' && formType !== 'AIFC') {
    throw new Error(`Not a valid AIFF file: unexpected form type "${formType}"`);
  }

  const format = formType === 'AIFC' ? 'aifc' : 'aiff';

  const bodyEnd = Math.min(8 + formSize, data.length);
  const bodyData = data.subarray(12, bodyEnd);
  const topChunks = parseIffChunks(bodyData);

  let midi = null;
  const allChordEvents = [];
  const beatsPerBar = 4;
  const allChunks = {};

  for (const chunk of topChunks) {
    allChunks[chunk.id] = (allChunks[chunk.id] || 0) + 1;

    if (chunk.id === 'MIDI') {
      const extracted = extractEmbeddedMidi(chunk.data);
      if (extracted && !midi) {
        midi = extracted;
      }
    }

    // Top-level Sequ chunk (found in some user-generated Apple Loops)
    if (chunk.id === 'Sequ') {
      const events = extractChordEventsFromSequ(chunk.data, beatsPerBar);
      allChordEvents.push(...events);
    }

    if (chunk.id === 'APPL') {
      const subChunks = parseIffChunks(chunk.data);

      for (const sub of subChunks) {
        if (sub.id === 'Sequ') {
          const events = extractChordEventsFromSequ(sub.data, beatsPerBar);
          allChordEvents.push(...events);
        }
      }

      if (!midi) {
        const extracted = extractEmbeddedMidi(chunk.data);
        if (extracted) {
          midi = extracted;
        }
      }
    }
  }

  if (!midi) {
    midi = extractEmbeddedMidi(data);
  }

  return { midi, chordEvents: allChordEvents, beatsPerBar, format, chunks: allChunks };
}

function parseCaf(arrayBuffer) {
  const data = new Uint8Array(arrayBuffer);
  const view = new DataView(arrayBuffer);

  const magic = String.fromCharCode(data[0], data[1], data[2], data[3]);
  if (magic !== 'caff') {
    throw new Error('Not a valid CAF file');
  }

  let midi = null;
  const allChordEvents = [];
  const beatsPerBar = 4;
  const allChunks = {};

  let offset = 8;

  while (offset + 12 <= data.length) {
    const chunkType = String.fromCharCode(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]);

    const sizeHi = view.getUint32(offset + 4);
    const sizeLo = view.getUint32(offset + 8);
    const chunkSize = sizeHi === 0 ? sizeLo : -1;

    offset += 12;

    if (chunkSize < 0 || offset + chunkSize > data.length) break;

    allChunks[chunkType] = (allChunks[chunkType] || 0) + 1;

    const chunkData = data.subarray(offset, offset + chunkSize);

    if (chunkType === 'midi') {
      const extracted = extractEmbeddedMidi(chunkData);
      if (extracted && !midi) {
        midi = extracted;
      }
    }

    if (chunkType === 'user' || chunkType === 'APPL') {
      const subChunks = parseIffChunks(chunkData);
      for (const sub of subChunks) {
        if (sub.id === 'Sequ') {
          const events = extractChordEventsFromSequ(sub.data, beatsPerBar);
          allChordEvents.push(...events);
        }
      }

      if (!midi) {
        const extracted = extractEmbeddedMidi(chunkData);
        if (extracted) {
          midi = extracted;
        }
      }
    }

    offset += chunkSize;
  }

  if (!midi) {
    midi = extractEmbeddedMidi(data);
  }

  return { midi, chordEvents: allChordEvents, beatsPerBar, format: 'caf', chunks: allChunks };
}

function parseAppleLoop(arrayBuffer) {
  const data = new Uint8Array(arrayBuffer);

  if (data.length < 12) {
    throw new Error('File too small');
  }

  const magic4 = String.fromCharCode(data[0], data[1], data[2], data[3]);

  if (magic4 === 'FORM') {
    return parseAiff(arrayBuffer);
  }

  if (magic4 === 'caff') {
    return parseCaf(arrayBuffer);
  }

  throw new Error(`Unrecognized format (magic: "${magic4}")`);
}

// ─── CLI ────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Usage: node analyze-apple-loops.mjs <file1.aif> <file2.caf> ...');
  process.exit(1);
}

for (const filePath of args) {
  try {
    const buffer = readFileSync(filePath);
    const result = parseAppleLoop(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));

    console.log('\n' + '='.repeat(70));
    console.log(`FILE: ${basename(filePath)}`);
    console.log('='.repeat(70));

    console.log(`Format: ${result.format.toUpperCase()}`);
    console.log(`File size: ${(buffer.length / 1024).toFixed(2)} KB`);
    console.log(`Embedded MIDI: ${result.midi ? `YES (${result.midi.length} bytes)` : 'NO'}`);

    console.log(`\nChunks found:`);
    for (const [id, count] of Object.entries(result.chunks)) {
      console.log(`  ${id}: ${count}`);
    }

    if (result.chordEvents.length > 0) {
      console.log(`\nChord Events (${result.chordEvents.length}):`);
      for (const event of result.chordEvents) {
        const quality = findQualityByIntervals(event.intervals);
        const symbol = event.rootName && quality
          ? `${event.rootName}${quality.displayName}`
          : event.rootName
            ? `${event.rootName}[${event.intervals.join(',')}]`
            : quality
              ? `?${quality.displayName}`
              : `[${event.intervals.join(',')}]`;
        console.log(`  Beat ${event.positionBeats.toFixed(2)}: ${symbol}`);
        console.log(`    mask=0x${event.mask.toString(16).padStart(3, '0')} be22=0x${event.rawBe22.toString(16).padStart(8, '0')} b8=${event.b8} b9=${event.b9}`);
      }
    } else {
      console.log('\nChord Events: NONE');
    }

    if (result.midi) {
      // Parse MIDI header for basic info
      const midiView = new DataView(result.midi.buffer, result.midi.byteOffset, result.midi.byteLength);
      const ppq = midiView.getUint16(12);
      const trackCount = midiView.getUint16(10);
      console.log(`\nMIDI Info:`);
      console.log(`  Tracks: ${trackCount}`);
      console.log(`  PPQ (ticks per quarter): ${ppq}`);
    }

  } catch (error) {
    console.error(`\nERROR processing ${filePath}:`, error.message);
  }
}

console.log('\n' + '='.repeat(70));
