/**
 * Regenerate the committed accompaniment vectors (GLORIARP_BRIEF §17/§19):
 *   · source-walking-bass.json — the curated one-bar walking-bass phrase,
 *     annotated relative to Dm7 (extraction output, human-checkable).
 *   · adapted-dm7-g7-cmaj7-a7-seed42.json — the acceptance-test output:
 *     that phrase adapted across Dm7 | G7 | Cmaj7 | A7 at seed 42,
 *     range C2..C4, chromaticism 0.25, rhythm preservation 1.0 — with trace.
 *
 * Run after any engine change:  node vectors/gen-accompaniment-vectors.mjs
 * The tests assert the engine reproduces these byte-for-byte; a diff in git
 * IS the review surface for behavior changes.
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseLeadsheet, realizeLeadsheet } from "@enkerli/theory";
import { extractPhrase, adaptBassPhrase, applyRhythm, articulate, expressPhrase, serializePhrase } from "@enkerli/accompaniment";

const HERE = dirname(fileURLToPath(import.meta.url));

const DM7 = { symbol: "Dm7", rootPc: 2, pcs: [2, 5, 9, 0] };
const CC0 = { note: "hand-written CC0 fixture (GLORIARP_BRIEF §19 corpus)" };
const meta = (id) => ({
  id, role: "bass",
  meter: { numerator: 4, denominator: 4 }, ticksPerBeat: 480, lengthTicks: 1920,
  frame: DM7, source: CC0,
});

// ── The source-phrase pack: each committed phrase is a "style" for free ──────

// Walking: D2, F2, A2 (chord tones 1-2-3) then C♯3, the classic semitone
// approach back to the loop's downbeat D.
const source = extractPhrase(
  [
    { pitch: 38, startTick: 0, durationTicks: 480, velocity: 96 },
    { pitch: 41, startTick: 480, durationTicks: 480, velocity: 88 },
    { pitch: 45, startTick: 960, durationTicks: 480, velocity: 90 },
    { pitch: 49, startTick: 1440, durationTicks: 480, velocity: 92 },
  ],
  meta("walking-bass-dm7-v1"),
);
writeFileSync(join(HERE, "source-walking-bass.json"), serializePhrase(source));

// Funk with ghosts: staccato root hits, low-velocity ghost notes in the
// sixteenth cracks, the octave pop on 4, a seventh passing on the and-of-3 —
// space on beat 2 (the rest IS the funk).
const funk = extractPhrase(
  [
    { pitch: 38, startTick: 0, durationTicks: 200, velocity: 112 },
    { pitch: 38, startTick: 360, durationTicks: 90, velocity: 42 },   // ghost
    { pitch: 41, startTick: 600, durationTicks: 180, velocity: 90 },
    { pitch: 38, startTick: 720, durationTicks: 90, velocity: 58 },   // ghost
    { pitch: 45, startTick: 960, durationTicks: 200, velocity: 102 },
    { pitch: 48, startTick: 1200, durationTicks: 110, velocity: 84 }, // 7th
    { pitch: 50, startTick: 1440, durationTicks: 200, velocity: 108 },// octave
    { pitch: 48, startTick: 1680, durationTicks: 130, velocity: 64 },
  ],
  meta("funk-ghost-dm7-v1"),
);
writeFileSync(join(HERE, "source-funk-ghost.json"), serializePhrase(funk));

// Bossa: the dotted-quarter/eighth root–fifth ostinato.
const bossa = extractPhrase(
  [
    { pitch: 38, startTick: 0, durationTicks: 700, velocity: 92 },
    { pitch: 45, startTick: 720, durationTicks: 230, velocity: 76 },
    { pitch: 38, startTick: 960, durationTicks: 700, velocity: 86 },
    { pitch: 45, startTick: 1680, durationTicks: 230, velocity: 72 },
  ],
  meta("bossa-dm7-v1"),
);
writeFileSync(join(HERE, "source-bossa.json"), serializePhrase(bossa));

// Two-feel: half-note root–fifth, the sparse jazz floor.
const twoFeel = extractPhrase(
  [
    { pitch: 38, startTick: 0, durationTicks: 900, velocity: 95 },
    { pitch: 45, startTick: 960, durationTicks: 900, velocity: 87 },
  ],
  meta("two-feel-dm7-v1"),
);
writeFileSync(join(HERE, "source-two-feel.json"), serializePhrase(twoFeel));

// The acceptance progression, realized through the suite's canonical types —
// the exact path `msuite accompany` takes.
const prog = parseLeadsheet("Dm7 | G7 | Cmaj7 | A7", { tonic: "C", mode: "major" });
const bars = realizeLeadsheet(prog);
const BAR = 4 * 480;
const frames = bars.map((chords, i) => {
  const c = chords[0];
  return { start: i * BAR, end: (i + 1) * BAR, chord: { symbol: c.symbol, rootPc: c.rootPc, pcs: c.pcs } };
});

const { phrase, trace } = adaptBassPhrase(source, {
  frames,
  seed: 42,
  range: { low: 36, high: 60 }, // C2..C4
  chromaticism: 0.25,
  rhythmPreservation: 1,
  traceLevel: "events",
});
writeFileSync(
  join(HERE, "adapted-dm7-g7-cmaj7-a7-seed42.json"),
  JSON.stringify({ phrase, trace }, null, 2) + "\n",
);

// The rhythm-replacement acceptance: the SAME walking pitch material,
// performed on the tresillo — E(3,8), accents on the first onset — then
// adapted across the same progression at the same seed. The committed diff
// of this file IS the review surface for rhythm-mapping changes.
const tresillo = applyRhythm(source, {
  steps: [1, 0, 0, 1, 0, 0, 1, 0],
  accents: [1, 0, 0, 0, 0, 0, 0, 0],
  label: "E(3,8)",
});
const withRhythm = adaptBassPhrase(tresillo, {
  frames,
  seed: 42,
  range: { low: 36, high: 60 },
  chromaticism: 0.25,
  rhythmPreservation: 1,
  traceLevel: "events",
});
writeFileSync(
  join(HERE, "adapted-tresillo-dm7-g7-cmaj7-a7-seed42.json"),
  JSON.stringify(withRhythm, null, 2) + "\n",
);

// The articulation acceptance: the funk-ghost material adapted across the
// progression, then breathed — staccato gate, full metric dynamics, weak-beat
// rests, anticipated downbeats. Same seed everywhere; the committed diff is
// the review surface for articulation changes.
const funkAdapted = adaptBassPhrase(funk, {
  frames, seed: 42, range: { low: 36, high: 60 }, chromaticism: 0.25, traceLevel: "summary",
});
const breathed = articulate(funkAdapted.phrase, {
  seed: 42, gate: "staccato", dynamics: 0.8, rests: 0.4, anticipation: 0.6,
});
writeFileSync(
  join(HERE, "articulated-funk-dm7-g7-cmaj7-a7-seed42.json"),
  JSON.stringify(breathed, null, 2) + "\n",
);

// The expression acceptance (docs/GLORIARP_NEXT.md): the funk material at
// pass 0 AND pass 3 under morph — variety (passing tones, reselection),
// pocket (correlated push/pull + micro-dynamics), mixed gate. Committing two
// passes pins BOTH determinism-per-pass and the morph behavior itself.
const expressed = [0, 3].map((pass) => expressPhrase(funkAdapted.phrase, {
  seed: 42, pass, morph: 0.5, variety: 0.6, pocket: 0.5, mixedGate: true, bpm: 120,
}));
writeFileSync(
  join(HERE, "expressed-funk-dm7-g7-cmaj7-a7-seed42.json"),
  JSON.stringify({ pass0: expressed[0], pass3: expressed[1] }, null, 2) + "\n",
);

console.log(`source: ${source.events.length} events; adapted: ${phrase.events.length} events over ${frames.length} bars`);
console.log(`trace summary:`, trace.summary);
console.log(`tresillo: ${withRhythm.phrase.events.length} events (${withRhythm.phrase.events.filter((e) => e.onset % 1920 === 0).length} downbeats)`);
console.log(`articulated funk: ${breathed.phrase.events.length} events, ${breathed.changes.length} changes (${breathed.changes.filter((c) => c.kind === "rest").length} rests, ${breathed.changes.filter((c) => c.kind === "anticipation").length} anticipations)`);
