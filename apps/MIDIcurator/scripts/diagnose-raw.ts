/**
 * Raw MIDI diagnostic: show all events in all tracks.
 */
import { readFileSync } from 'fs';
import { parseMIDI } from '../src/lib/midi-parser';

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: npx tsx scripts/diagnose-raw.ts <file.mid>');
  process.exit(1);
}

const buf = readFileSync(filePath);
const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const midiData = parseMIDI(arrayBuffer);

console.log(`\n=== ${filePath} ===`);
console.log(`Ticks per beat: ${midiData.ticksPerBeat}`);
console.log(`Tracks: ${midiData.tracks.length}`);

for (let t = 0; t < midiData.tracks.length; t++) {
  const events = midiData.tracks[t];
  console.log(`\n--- Track ${t}: ${events.length} events ---`);
  let absTime = 0;
  let noteOnCount = 0;
  let noteOffCount = 0;
  for (const ev of events) {
    absTime += ev.delta;
    if (ev.type === 'noteOn') noteOnCount++;
    if (ev.type === 'noteOff') noteOffCount++;
  }
  console.log(`  noteOn: ${noteOnCount}, noteOff: ${noteOffCount}`);

  // Show first 30 events
  absTime = 0;
  const shown = events.slice(0, 40);
  for (const ev of shown) {
    absTime += ev.delta;
    const info = ev.note !== undefined ? ` note=${ev.note}` : '';
    const vel = ev.velocity !== undefined ? ` vel=${ev.velocity}` : '';
    const ch = ev.channel !== undefined ? ` ch=${ev.channel}` : '';
    const bpm = ev.bpm !== undefined ? ` bpm=${ev.bpm}` : '';
    console.log(`  t=${absTime.toString().padStart(6)} delta=${ev.delta.toString().padStart(4)} type=${ev.type}${ch}${info}${vel}${bpm}`);
  }
  if (events.length > 40) {
    console.log(`  ... (${events.length - 40} more events)`);
  }
}
