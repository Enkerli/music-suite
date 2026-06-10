#!/usr/bin/env node
/**
 * Generate preloaded MIDI sample files for MIDIcurator.
 *
 * Produces common chord progressions in multiple voicings:
 *   - Block chords (closed root-position triads/7ths, one per bar)
 *   - Arpeggio up-down (ascending then descending per bar)
 *   - Arpeggio bloom (expanding outward from root)
 *   - Arpeggio pseudo-random (deterministic scramble)
 *   - Broken chord (root-5th-3rd-5th Alberti-style pattern)
 *
 * Output: public/samples/*.mid
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'public', 'samples');

// ── MIDI encoding helpers ──────────────────────────────────────────

function encodeVariableLength(value) {
  const bytes = [];
  bytes.push(value & 0x7f);
  value >>= 7;
  while (value > 0) {
    bytes.unshift((value & 0x7f) | 0x80);
    value >>= 7;
  }
  return bytes;
}

function encodeText(metaType, text) {
  const enc = new TextEncoder();
  const textBytes = enc.encode(text);
  return [0xff, metaType, ...encodeVariableLength(textBytes.length), ...textBytes];
}

function midiHeader(ticksPerBeat) {
  return [
    0x4d, 0x54, 0x68, 0x64, // MThd
    0x00, 0x00, 0x00, 0x06, // length=6
    0x00, 0x01,             // format 1
    0x00, 0x01,             // 1 track
    (ticksPerBeat >> 8) & 0xff, ticksPerBeat & 0xff,
  ];
}

function buildTrack(events) {
  // events: [{ tick, data: number[] }]
  events.sort((a, b) => a.tick - b.tick);
  const encoded = [];
  let curTick = 0;
  for (const ev of events) {
    const delta = ev.tick - curTick;
    curTick = ev.tick;
    encoded.push(...encodeVariableLength(delta), ...ev.data);
  }
  // end-of-track
  encoded.push(...encodeVariableLength(0), 0xff, 0x2f, 0x00);

  const len = encoded.length;
  return [
    0x4d, 0x54, 0x72, 0x6b, // MTrk
    (len >> 24) & 0xff, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff,
    ...encoded,
  ];
}

function buildMIDI(bpm, ticksPerBeat, noteEvents, leadsheetText) {
  const allEvents = [];

  // tempo meta
  const uspb = Math.round(60000000 / bpm);
  allEvents.push({
    tick: 0,
    data: [0xff, 0x51, 0x03, (uspb >> 16) & 0xff, (uspb >> 8) & 0xff, uspb & 0xff],
  });

  // MCURATOR file-level metadata
  const fileJson = JSON.stringify({
    type: 'file', schema: 'mcurator-midi', version: 1,
    createdBy: 'MIDIcurator-sample-gen', ppq: ticksPerBeat,
  });
  allEvents.push({ tick: 0, data: encodeText(0x01, `MCURATOR:v1 ${fileJson}`) });

  // Leadsheet metadata
  if (leadsheetText) {
    const lsJson = JSON.stringify({ type: 'leadsheet', text: leadsheetText, bars: leadsheetText.split('|').length });
    allEvents.push({ tick: 0, data: encodeText(0x01, `MCURATOR:v1 ${lsJson}`) });
  }

  allEvents.push(...noteEvents);

  const header = midiHeader(ticksPerBeat);
  const track = buildTrack(allEvents);
  return new Uint8Array([...header, ...track]);
}

// ── Musical definitions ──────────────────────────────────────────

const PPQ = 480;
const BAR = PPQ * 4; // 4/4 time
const BPM = 120;

// Common progressions: each entry has a name, chords as [root_pc, intervals[]].
// Intervals are semitones above root.
const PROGRESSIONS = [
  {
    name: 'Four Chords',
    // I V vi IV in C: C G Am F
    chords: [
      { root: 60, intervals: [0, 4, 7],    label: 'C' },     // C major
      { root: 55, intervals: [0, 4, 7],    label: 'G' },     // G major
      { root: 57, intervals: [0, 3, 7],    label: 'Am' },    // A minor
      { root: 53, intervals: [0, 4, 7],    label: 'F' },     // F major
    ],
    leadsheet: 'C | G | Am | F',
  },
  {
    name: 'Jazz ii-V-I',
    // Dm7 G7 Cmaj7 Cmaj7 in C
    chords: [
      { root: 62, intervals: [0, 3, 7, 10], label: 'Dm7' },   // D minor 7
      { root: 55, intervals: [0, 4, 7, 10], label: 'G7' },    // G dominant 7
      { root: 60, intervals: [0, 4, 7, 11], label: 'Cmaj7' }, // C major 7
      { root: 60, intervals: [0, 4, 7, 11], label: 'Cmaj7' }, // C major 7
    ],
    leadsheet: 'Dm7 | G7 | Cmaj7 | %',
  },
  {
    name: '12-Bar Blues',
    // Classic I-I-I-I  IV-IV-I-I  V-IV-I-V in C
    chords: [
      { root: 60, intervals: [0, 4, 7, 10], label: 'C7' },
      { root: 60, intervals: [0, 4, 7, 10], label: 'C7' },
      { root: 60, intervals: [0, 4, 7, 10], label: 'C7' },
      { root: 60, intervals: [0, 4, 7, 10], label: 'C7' },
      { root: 65, intervals: [0, 4, 7, 10], label: 'F7' },
      { root: 65, intervals: [0, 4, 7, 10], label: 'F7' },
      { root: 60, intervals: [0, 4, 7, 10], label: 'C7' },
      { root: 60, intervals: [0, 4, 7, 10], label: 'C7' },
      { root: 67, intervals: [0, 4, 7, 10], label: 'G7' },
      { root: 65, intervals: [0, 4, 7, 10], label: 'F7' },
      { root: 60, intervals: [0, 4, 7, 10], label: 'C7' },
      { root: 67, intervals: [0, 4, 7, 10], label: 'G7' },
    ],
    leadsheet: 'C7 | % | % | % | F7 | % | C7 | % | G7 | F7 | C7 | G7',
  },
  {
    name: 'Minor ii-V-i',
    // Dm7b5 G7 Cm in C minor
    chords: [
      { root: 62, intervals: [0, 3, 6, 10], label: 'Dm7b5' },  // half-dim
      { root: 55, intervals: [0, 4, 7, 10], label: 'G7' },     // dom7
      { root: 60, intervals: [0, 3, 7],     label: 'Cm' },     // C minor
      { root: 60, intervals: [0, 3, 7],     label: 'Cm' },     // C minor
    ],
    leadsheet: 'Dm7b5 | G7 | Cm | %',
  },
  {
    name: 'Andalusian Cadence',
    // Am G F E in A minor
    chords: [
      { root: 57, intervals: [0, 3, 7],    label: 'Am' },
      { root: 55, intervals: [0, 4, 7],    label: 'G' },
      { root: 53, intervals: [0, 4, 7],    label: 'F' },
      { root: 52, intervals: [0, 4, 7],    label: 'E' },
    ],
    leadsheet: 'Am | G | F | E',
  },
  {
    name: 'Rhythm Changes A',
    // Bbmaj7 G7 Cm7 F7 (first 4 bars of rhythm changes)
    chords: [
      { root: 58, intervals: [0, 4, 7, 11], label: 'Bbmaj7' },
      { root: 55, intervals: [0, 4, 7, 10], label: 'G7' },
      { root: 60, intervals: [0, 3, 7, 10], label: 'Cm7' },
      { root: 53, intervals: [0, 4, 7, 10], label: 'F7' },
    ],
    leadsheet: 'Bbmaj7 | G7 | Cm7 | F7',
  },
];

// ── Voicing patterns ──────────────────────────────────────────────

/**
 * Block chord: all notes of the chord sounding together for a full bar.
 * Closed root position, velocity 90.
 */
function voiceBlock(chord, barIndex) {
  const startTick = barIndex * BAR;
  const dur = BAR - PPQ / 4; // slightly shorter than full bar for separation
  const vel = 90;
  return chord.intervals.map(interval => ({
    tick: startTick,
    pitch: chord.root + interval,
    dur,
    vel,
  }));
}

/**
 * Arpeggio up-down: ascend through chord tones, then descend.
 * 8th notes (PPQ/2 each). If chord has 4 tones: up(4) + down(4) = 8 eighth notes = 1 bar.
 * If chord has 3 tones: up(3) + down(3) = 6 eighths, pad with root octave up+down.
 */
function voiceArpUpDown(chord, barIndex) {
  const startTick = barIndex * BAR;
  const eighth = PPQ / 2;
  const vel = 80;
  const dur = eighth - 20; // slight gap

  const pitches = chord.intervals.map(i => chord.root + i);

  // Build up-down pattern to fill 8 eighth notes
  let pattern;
  if (pitches.length === 3) {
    // 3-note chord: up 3, root octave up, then descend
    pattern = [...pitches, pitches[0] + 12, pitches[0] + 12, ...pitches.slice().reverse()];
    pattern = pattern.slice(0, 8);
  } else {
    // 4-note chord: up 4, down 4 (skip top and bottom to avoid repeats)
    const desc = pitches.slice().reverse();
    pattern = [...pitches, ...desc];
    pattern = pattern.slice(0, 8);
  }

  return pattern.map((pitch, i) => ({
    tick: startTick + i * eighth,
    pitch,
    dur,
    vel,
  }));
}

/**
 * Bloom arpeggio: starts from root, expands outward.
 * Pattern for [R, 3, 5, 7]: R, R+5, R+3, R+7, R, R+5, R+3, R+7
 * Reorders intervals as: root, furthest, middle, next-furthest...
 */
function voiceBloom(chord, barIndex) {
  const startTick = barIndex * BAR;
  const eighth = PPQ / 2;
  const vel = 75;
  const dur = eighth - 20;

  const pitches = chord.intervals.map(i => chord.root + i);

  // Bloom order: alternate from center outward
  let pattern;
  if (pitches.length === 3) {
    // R, 5, 3, R+oct, R, 5, 3, R+oct
    pattern = [pitches[0], pitches[2], pitches[1], pitches[0] + 12,
               pitches[0], pitches[2], pitches[1], pitches[0] + 12];
  } else {
    // R, 7, 3, 5, R, 7, 3, 5
    pattern = [pitches[0], pitches[3], pitches[1], pitches[2],
               pitches[0], pitches[3], pitches[1], pitches[2]];
  }

  return pattern.map((pitch, i) => ({
    tick: startTick + i * eighth,
    pitch,
    dur,
    vel,
  }));
}

/**
 * Pseudo-random arpeggio: deterministic scramble based on bar index.
 * Uses a simple seed to pick chord tones in a shuffled but repeatable order.
 */
function voicePseudoRandom(chord, barIndex) {
  const startTick = barIndex * BAR;
  const eighth = PPQ / 2;
  const vel = 78;
  const dur = eighth - 20;

  const pitches = chord.intervals.map(i => chord.root + i);
  // Add octave above root for more variety
  const pool = [...pitches, pitches[0] + 12];

  // Simple seeded selection
  const seed = (barIndex + 1) * 7 + chord.root;
  const pattern = [];
  for (let i = 0; i < 8; i++) {
    const idx = (seed * (i + 3) + i * 13) % pool.length;
    pattern.push(pool[idx]);
  }

  return pattern.map((pitch, i) => ({
    tick: startTick + i * eighth,
    pitch,
    dur,
    vel,
  }));
}

/**
 * Broken chord (Alberti bass): root-5th-3rd-5th pattern, repeated twice per bar.
 * Classic keyboard accompaniment figure.
 */
function voiceBroken(chord, barIndex) {
  const startTick = barIndex * BAR;
  const eighth = PPQ / 2;
  const vel = 72;
  const dur = eighth - 20;

  const pitches = chord.intervals.map(i => chord.root + i);

  // Alberti: root, top, middle, top (for 3-note chords)
  // For 4-note: root, 5th, 3rd, 7th
  let unit;
  if (pitches.length === 3) {
    unit = [pitches[0], pitches[2], pitches[1], pitches[2]];
  } else {
    unit = [pitches[0], pitches[2], pitches[1], pitches[3]];
  }

  const pattern = [...unit, ...unit]; // repeat for 8 eighth notes

  return pattern.map((pitch, i) => ({
    tick: startTick + i * eighth,
    pitch,
    dur,
    vel,
  }));
}

// ── File generation ──────────────────────────────────────────────

const VOICINGS = [
  { name: 'Block', fn: voiceBlock },
  { name: 'Arp Up-Down', fn: voiceArpUpDown },
  { name: 'Arp Bloom', fn: voiceBloom },
  { name: 'Arp Random', fn: voicePseudoRandom },
  { name: 'Broken', fn: voiceBroken },
];

function generateFile(progression, voicing) {
  const noteEvents = [];
  for (let barIdx = 0; barIdx < progression.chords.length; barIdx++) {
    const chord = progression.chords[barIdx];
    const notes = voicing.fn(chord, barIdx);
    for (const n of notes) {
      noteEvents.push({ tick: n.tick, data: [0x90, n.pitch, n.vel] });
      noteEvents.push({ tick: n.tick + n.dur, data: [0x80, n.pitch, 0] });
    }
  }

  return buildMIDI(BPM, PPQ, noteEvents, progression.leadsheet);
}

// ── Main ─────────────────────────────────────────────────────────

mkdirSync(OUT_DIR, { recursive: true });

const manifest = [];

for (const prog of PROGRESSIONS) {
  for (const voicing of VOICINGS) {
    const safeName = prog.name.replace(/[^a-zA-Z0-9]+/g, '-');
    const safeVoicing = voicing.name.replace(/[^a-zA-Z0-9]+/g, '-');
    const filename = `${safeName}_${safeVoicing}_120bpm.mid`;

    const midi = generateFile(prog, voicing);
    const outPath = join(OUT_DIR, filename);
    writeFileSync(outPath, midi);

    manifest.push({ filename, progression: prog.name, voicing: voicing.name });
    console.log(`  ✓ ${filename}`);
  }
}

// Write manifest JSON for the app to discover files
writeFileSync(
  join(OUT_DIR, 'manifest.json'),
  JSON.stringify(manifest, null, 2),
);

console.log(`\n${manifest.length} sample files generated in public/samples/`);
