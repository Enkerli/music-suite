/**
 * Diagnostic script: parse MIDI files and show what chord detection sees.
 * Usage: npx tsx scripts/diagnose-midi.ts "path/to/file.mid"
 */
import { readFileSync } from 'fs';
import { parseMIDI, extractNotes } from '../src/lib/midi-parser';
import { extractGesture, extractHarmonic } from '../src/lib/gesture';
import { detectChord, detectChordsPerBar } from '../src/lib/chord-detect';

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: npx tsx scripts/diagnose-midi.ts <file.mid>');
  process.exit(1);
}

const buf = readFileSync(filePath);
const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const midiData = parseMIDI(arrayBuffer);
const notes = extractNotes(midiData);

console.log(`\n=== ${filePath} ===`);
console.log(`Ticks per beat: ${midiData.ticksPerBeat}`);
console.log(`Tracks: ${midiData.tracks.length}`);
console.log(`Total notes: ${notes.length}`);

if (notes.length === 0) {
  console.log('No notes found!');
  process.exit(0);
}

const gesture = extractGesture(notes, midiData.ticksPerBeat);
const harmonic = extractHarmonic(notes, gesture);

console.log(`Bars: ${gesture.num_bars}`);
console.log(`Ticks per bar: ${gesture.ticks_per_bar}`);
console.log(`Density: ${gesture.density.toFixed(2)}`);
console.log(`Overall chord: ${harmonic.detectedChord?.symbol ?? 'none'}`);

// Show note details
console.log(`\n--- All notes ---`);
const pitchNames = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
for (const n of notes) {
  const name = pitchNames[n.midi % 12] + Math.floor(n.midi / 12 - 1);
  const bar = Math.floor(n.ticks / gesture.ticks_per_bar);
  const beatInBar = ((n.ticks % gesture.ticks_per_bar) / gesture.ticks_per_beat).toFixed(2);
  console.log(`  tick=${n.ticks.toString().padStart(6)} bar=${bar} beat=${beatInBar} ${name.padEnd(4)} vel=${n.velocity} dur=${n.durationTicks}`);
}

// Per-bar analysis
console.log(`\n--- Per-bar chord detection ---`);
const pitches = notes.map(n => n.midi);
const onsets = notes.map(n => n.ticks);

for (let bar = 0; bar < gesture.num_bars; bar++) {
  const barStart = bar * gesture.ticks_per_bar;
  const barEnd = barStart + gesture.ticks_per_bar;

  const barNotes = notes.filter(n => n.ticks >= barStart && n.ticks < barEnd);
  const barPitches = barNotes.map(n => n.midi);
  const barPcs = [...new Set(barPitches.map(p => p % 12))].sort((a, b) => a - b);
  const barPcsNames = barPcs.map(pc => pitchNames[pc]);

  const chord = barPitches.length >= 2 ? detectChord(barPitches) : null;

  console.log(`  Bar ${bar}: ${barNotes.length} notes, PCS=[${barPcsNames.join(',')}] → ${chord?.symbol ?? '(no chord)'}`);

  // Also show notes that are SOUNDING in this bar (started before but still ringing)
  const sustainedNotes = notes.filter(n =>
    n.ticks < barStart && (n.ticks + n.durationTicks) > barStart
  );
  if (sustainedNotes.length > 0) {
    const sustainedPitches = sustainedNotes.map(n => n.midi);
    const sustainedPcs = [...new Set(sustainedPitches.map(p => p % 12))].sort((a, b) => a - b);
    const sustainedNames = sustainedPcs.map(pc => pitchNames[pc]);
    console.log(`         (sustained from prev: PCS=[${sustainedNames.join(',')}])`);

    // Try combined detection
    const allPitchesInBar = [...barPitches, ...sustainedPitches];
    if (allPitchesInBar.length >= 2) {
      const combinedChord = detectChord(allPitchesInBar);
      console.log(`         (combined with sustained: ${combinedChord?.symbol ?? '(no chord)'})`);
    }
  }
}
