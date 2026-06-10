/**
 * Debug the parser step by step.
 */
import { readFileSync } from 'fs';

const filePath = process.argv[2]!;
const buf = readFileSync(filePath);
const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

const view = new DataView(arrayBuffer);
let offset = 0;

// Read header
const headerType = String.fromCharCode(...new Uint8Array(arrayBuffer, offset, 4));
offset += 4;
console.log(`Header: ${headerType}`);

const headerLen = view.getUint32(offset);
offset += 4;
console.log(`Header length: ${headerLen}`);

const format = view.getUint16(offset);
offset += 2;
console.log(`Format: ${format}`);

const trackCount = view.getUint16(offset);
offset += 2;
console.log(`Track count: ${trackCount}`);

const division = view.getUint16(offset);
offset += 2;
console.log(`Division: ${division} (${division & 0x8000 ? 'SMPTE' : 'ticks per beat'})`);

// Read track header
const trackType = String.fromCharCode(...new Uint8Array(arrayBuffer, offset, 4));
offset += 4;
console.log(`\nTrack type: ${trackType}`);

const trackLength = view.getUint32(offset);
offset += 4;
console.log(`Track length: ${trackLength} bytes`);

const trackData = new Uint8Array(arrayBuffer, offset, trackLength);

// Now parse events manually with detailed debug
let tOffset = 0;
let runningStatus = 0;
let eventCount = 0;

while (tOffset < trackData.length && eventCount < 30) {
  const startOffset = tOffset;

  // Read delta
  let delta = 0;
  let byte: number;
  do {
    byte = trackData[tOffset++]!;
    delta = (delta << 7) | (byte & 0x7F);
  } while (byte & 0x80);

  // Read status
  let status = trackData[tOffset]!;
  let usedRunning = false;

  if (status < 0x80) {
    status = runningStatus;
    usedRunning = true;
  } else {
    tOffset++;
    runningStatus = status;
  }

  const type = status & 0xF0;
  const channel = status & 0x0F;

  let desc = '';

  if (type === 0x90) {
    const note = trackData[tOffset++]!;
    const vel = trackData[tOffset++]!;
    desc = `noteOn ch=${channel} note=${note} vel=${vel}`;
  } else if (type === 0x80) {
    const note = trackData[tOffset++]!;
    const vel = trackData[tOffset++]!;
    desc = `noteOff ch=${channel} note=${note} vel=${vel}`;
  } else if (type === 0xFF || status === 0xFF) {
    const metaType = trackData[tOffset++]!;
    // Variable-length meta length
    let metaLen = 0;
    do {
      byte = trackData[tOffset++]!;
      metaLen = (metaLen << 7) | (byte & 0x7F);
    } while (byte & 0x80);
    const metaBytes = Array.from(trackData.slice(tOffset, tOffset + metaLen)).map(b => b.toString(16).padStart(2, '0')).join(' ');
    tOffset += metaLen;
    desc = `meta type=0x${metaType.toString(16)} len=${metaLen} data=[${metaBytes}]`;
  } else if (type === 0xF0) {
    // SysEx
    let sysexLen = 0;
    do {
      byte = trackData[tOffset++]!;
      sysexLen = (sysexLen << 7) | (byte & 0x7F);
    } while (byte & 0x80);
    tOffset += sysexLen;
    desc = `sysex len=${sysexLen}`;
  } else if (type === 0xC0 || type === 0xD0) {
    tOffset += 1;
    desc = `type=0x${type.toString(16)} ch=${channel} (1 data byte)`;
  } else if (type === 0xB0 || type === 0xE0 || type === 0xA0) {
    tOffset += 2;
    desc = `type=0x${type.toString(16)} ch=${channel} (2 data bytes)`;
  } else {
    desc = `UNKNOWN status=0x${status.toString(16)} type=0x${type.toString(16)}`;
  }

  const rawBytes = Array.from(trackData.slice(startOffset, tOffset)).map(b => b.toString(16).padStart(2, '0')).join(' ');
  console.log(`  [${startOffset.toString().padStart(4)}] delta=${delta} ${usedRunning ? '(running) ' : ''}${desc}  raw=[${rawBytes}]`);

  eventCount++;
}
console.log(`\n  ... parsed ${eventCount} events, tOffset=${tOffset}/${trackData.length}`);
