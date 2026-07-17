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
import { extractPhrase, adaptBassPhrase, serializePhrase } from "@enkerli/accompaniment";

const HERE = dirname(fileURLToPath(import.meta.url));

// The curated source: one bar of 4/4 walking bass over Dm7 —
// D2, F2, A2 (chord tones 1-2-3) then C♯3, the classic semitone approach
// back to the loop's downbeat D.
const DM7 = { symbol: "Dm7", rootPc: 2, pcs: [2, 5, 9, 0] };
const source = extractPhrase(
  [
    { pitch: 38, startTick: 0, durationTicks: 480, velocity: 96 },
    { pitch: 41, startTick: 480, durationTicks: 480, velocity: 88 },
    { pitch: 45, startTick: 960, durationTicks: 480, velocity: 90 },
    { pitch: 49, startTick: 1440, durationTicks: 480, velocity: 92 },
  ],
  {
    id: "walking-bass-dm7-v1",
    role: "bass",
    meter: { numerator: 4, denominator: 4 },
    ticksPerBeat: 480,
    lengthTicks: 1920,
    frame: DM7,
    source: { note: "hand-written CC0 fixture (GLORIARP_BRIEF §19 corpus)" },
  },
);
writeFileSync(join(HERE, "source-walking-bass.json"), serializePhrase(source));

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

console.log(`source: ${source.events.length} events; adapted: ${phrase.events.length} events over ${frames.length} bars`);
console.log(`trace summary:`, trace.summary);
