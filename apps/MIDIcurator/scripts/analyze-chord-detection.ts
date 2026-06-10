#!/usr/bin/env tsx

/**
 * Analyze chord detection for files in the ChordSequences folder.
 * Shows which bars have detected chords and which don't, along with pitch classes.
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { parseMIDI } from '../src/lib/midi-parser';
import { extractGesture, extractHarmonic } from '../src/lib/gesture';

const CHORD_SEQUENCES_DIR = 'ChordSequences';

function analyzeMidiFile(filePath: string) {
  const buffer = readFileSync(filePath);
  const uint8Array = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  // Parse the MIDI file
  const parsed = parseMIDI(uint8Array);
  if (!parsed) {
    console.error(`Failed to parse: ${filePath}`);
    return;
  }

  // Extract gesture and harmonic layers
  const gesture = extractGesture(parsed.notes, parsed.ticksPerBeat);
  const harmonic = extractHarmonic(parsed.notes, gesture);

  const barChords = harmonic.barChords || [];

  console.log(`\n${'='.repeat(80)}`);
  console.log(`File: ${filePath}`);
  console.log(`Bars: ${barChords.length}`);
  console.log('-'.repeat(80));

  let undetectedCount = 0;

  for (const bc of barChords) {
    const pcsStr = bc.pitchClasses.length > 0
      ? bc.pitchClasses.sort((a, b) => a - b).join(', ')
      : 'none';
    if (bc.chord) {
      console.log(`Bar ${bc.bar + 1}: ${bc.chord.symbol.padEnd(8)} (${bc.chord.qualityName}) | PCS: [${pcsStr}]`);
    } else {
      if (bc.pitchClasses.length > 0) {
        console.log(`Bar ${bc.bar + 1}: ${'--'.padEnd(8)} (NOT DETECTED) | PCS: [${pcsStr}]`);
        undetectedCount++;
      } else {
        console.log(`Bar ${bc.bar + 1}: ${'--'.padEnd(8)} (empty bar)`);
      }
    }
  }

  if (undetectedCount > 0) {
    console.log(`\n⚠️  ${undetectedCount} bar(s) had undetected chords`);
  }
}

// Get all .mid files from ChordSequences folder
const files = readdirSync(CHORD_SEQUENCES_DIR)
  .filter(f => f.endsWith('.mid'))
  .sort();

console.log(`Found ${files.length} MIDI files in ${CHORD_SEQUENCES_DIR}`);

// Analyze first 5 files
for (const file of files.slice(0, 5)) {
  const fullPath = join(CHORD_SEQUENCES_DIR, file);
  analyzeMidiFile(fullPath);
}
