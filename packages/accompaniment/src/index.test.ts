import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  PHRASE_SCHEMA_V, validatePhrase, serializePhrase, parsePhrase,
  extractPhrase, computeFeatures, adaptBassPhrase,
  type AccompanimentPhrase, type FrameChord, type HarmonicFrame,
} from "./index.js";

const vector = (name: string) =>
  readFileSync(fileURLToPath(new URL(`../vectors/${name}`, import.meta.url)), "utf8");

const DM7: FrameChord = { symbol: "Dm7", rootPc: 2, pcs: [2, 5, 9, 0] };

const sourcePhrase = (): AccompanimentPhrase => parsePhrase(vector("source-walking-bass.json"));

/** The acceptance progression's frames: Dm7 | G7 | Cmaj7 | A7, 4/4 @ 480. */
const FRAMES: HarmonicFrame[] = [
  { start: 0, end: 1920, chord: DM7 },
  { start: 1920, end: 3840, chord: { symbol: "G7", rootPc: 7, pcs: [7, 11, 2, 5] } },
  { start: 3840, end: 5760, chord: { symbol: "Cmaj7", rootPc: 0, pcs: [0, 4, 7, 11] } },
  { start: 5760, end: 7680, chord: { symbol: "A7", rootPc: 9, pcs: [9, 1, 4, 7] } },
];
const RANGE = { low: 36, high: 60 }; // C2..C4

// ── phrase schema ────────────────────────────────────────────────────────────

describe("phrase schema", () => {
  it("the committed source vector validates and round-trips serialization", () => {
    const p = sourcePhrase();
    expect(validatePhrase(p).ok).toBe(true);
    expect(parsePhrase(serializePhrase(p))).toEqual(p);
  });
  it("rejects malformed phrases with specific errors", () => {
    expect(validatePhrase(null).ok).toBe(false);
    const base = sourcePhrase();
    const bad = (patch: object) => validatePhrase({ ...base, ...patch });
    expect(bad({ v: 99 }).errors.join()).toMatch(/v must be/);
    expect(bad({ role: "lead" }).errors.join()).toMatch(/role/);
    expect(bad({ lengthTicks: 0 }).errors.join()).toMatch(/lengthTicks/);
    const e0 = { ...base.events[0]!, velocity: 0 };
    expect(bad({ events: [e0] }).errors.join()).toMatch(/velocity/);
    const e1 = { ...base.events[0]!, note: 200 };
    expect(bad({ events: [e1] }).errors.join()).toMatch(/note/);
    expect(bad({ harmonicFrames: [{ start: 0, end: 0, chord: DM7 }] }).errors.join()).toMatch(/start < end/);
  });
  it("parsePhrase throws on non-JSON and on invalid phrases", () => {
    expect(() => parsePhrase("not json")).toThrow(/not JSON/);
    expect(() => parsePhrase("{}")).toThrow(/invalid/);
  });
});

// ── extraction ───────────────────────────────────────────────────────────────

describe("extractPhrase — chord-relative inference", () => {
  const notes = [
    { pitch: 38, startTick: 0, durationTicks: 480, velocity: 96 },   // D — root
    { pitch: 41, startTick: 480, durationTicks: 480, velocity: 88 }, // F — 2nd chord tone
    { pitch: 45, startTick: 960, durationTicks: 480, velocity: 90 }, // A — 3rd
    { pitch: 49, startTick: 1440, durationTicks: 480, velocity: 92 },// C♯ — approach to D
  ];
  const opts = {
    id: "t", role: "bass" as const, meter: { numerator: 4, denominator: 4 },
    ticksPerBeat: 480, lengthTicks: 1920, frame: DM7,
  };
  it("labels chord tones with 1-based degree and full confidence", () => {
    const p = extractPhrase(notes, opts);
    expect(p.events[0]!.chordRelation).toMatchObject({ category: "chord-tone", degree: 1, confidence: 1 });
    expect(p.events[1]!.chordRelation).toMatchObject({ category: "chord-tone", degree: 2 });
    expect(p.events[2]!.chordRelation).toMatchObject({ category: "chord-tone", degree: 3 });
  });
  it("hears the bar-end semitone as a CYCLIC chromatic approach to the downbeat", () => {
    const p = extractPhrase(notes, opts);
    expect(p.events[3]!.chordRelation).toMatchObject({
      category: "chromatic-approach", alteration: -1, target: 0,
    });
    expect(p.events[3]!.chordRelation!.confidence).toBeLessThan(1); // inferred, not certain
  });
  it("leaves what it cannot classify unclassified at confidence 0", () => {
    const p = extractPhrase([{ pitch: 44, startTick: 0, durationTicks: 480 }], opts); // G♯ vs Dm7, no neighbor
    expect(p.events[0]!.chordRelation).toMatchObject({ category: "unclassified", confidence: 0 });
  });
});

// ── features ─────────────────────────────────────────────────────────────────

describe("computeFeatures", () => {
  it("quantizes onsets to a leftmost-LSB step mask and reuses upi analysis", () => {
    const f = computeFeatures(sourcePhrase());
    expect(f.grid).toBe(120);           // 480 tpb → sixteenths
    expect(f.steps).toHaveLength(16);   // one 4/4 bar
    expect(f.steps[0]).toBe(1);
    expect(f.steps[4]).toBe(1);         // quarters land every 4 sixteenths
    expect(f.rhythm.k).toBe(4);
    expect(f.rhythm.n).toBe(16);
  });
  it("computes register, histograms, and rest ratio", () => {
    const f = computeFeatures(sourcePhrase());
    expect(f.register).toMatchObject({ low: 38, high: 49 });
    expect(f.pitchClassHistogram[2]).toBe(1); // one D
    expect(f.categoryHistogram["chord-tone"]).toBe(3);
    expect(f.categoryHistogram["chromatic-approach"]).toBe(1);
    expect(f.restRatio).toBe(0);              // wall-to-wall quarters
  });
});

// ── the bass adapter (GLORIARP_BRIEF §17 acceptance) ─────────────────────────

describe("adaptBassPhrase — determinism", () => {
  const run = () => adaptBassPhrase(sourcePhrase(), {
    frames: FRAMES, seed: 42, range: RANGE, chromaticism: 0.25, rhythmPreservation: 1, traceLevel: "events",
  });
  it("repeated runs are byte-for-byte identical", () => {
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
  });
  it("reproduces the committed acceptance vector exactly", () => {
    expect(JSON.parse(JSON.stringify(run()))).toEqual(JSON.parse(vector("adapted-dm7-g7-cmaj7-a7-seed42.json")));
  });
});

describe("adaptBassPhrase — acceptance properties", () => {
  const accept = (seed: number, extra: object = {}) => adaptBassPhrase(sourcePhrase(), {
    frames: FRAMES, seed, range: RANGE, chromaticism: 0.25, rhythmPreservation: 1, traceLevel: "events", ...extra,
  });
  it("outputs four bars whose rhythm matches the source in each bar", () => {
    const { phrase } = accept(42);
    expect(phrase.lengthTicks).toBe(7680);
    const src = sourcePhrase();
    for (let bar = 0; bar < 4; bar++) {
      const onsets = phrase.events.filter((e) => e.onset >= bar * 1920 && e.onset < (bar + 1) * 1920)
        .map((e) => e.onset - bar * 1920);
      expect(onsets).toEqual(src.events.map((e) => e.onset));
    }
  });
  it("strong beats obey the chord-tone policy (downbeat = a chord tone of its frame)", () => {
    const { phrase } = accept(42);
    for (const e of phrase.events.filter((ev) => ev.onset % 1920 === 0)) {
      const frame = FRAMES.find((f) => e.onset >= f.start && e.onset < f.end)!;
      expect(frame.chord.pcs.map((pc) => pc % 12)).toContain(e.note! % 12);
    }
  });
  it("all notes stay in range across many seeds (hard constraint, seed-independent)", () => {
    for (const seed of [1, 7, 42, 99, 1234]) {
      for (const e of accept(seed).phrase.events) {
        expect(e.note!).toBeGreaterThanOrEqual(RANGE.low);
        expect(e.note!).toBeLessThanOrEqual(RANGE.high);
      }
    }
  });
  it("changing only the seed never changes the rhythm at preservation 1.0", () => {
    const onsets = (seed: number) => accept(seed).phrase.events.map((e) => e.onset);
    expect(onsets(7)).toEqual(onsets(42));
  });
  it("surviving chromatic approaches sit one semitone from their resolved target", () => {
    const { phrase, trace } = accept(42, { chromaticism: 1 }); // force approaches through
    const approaches = trace.events!.filter((t) => t.reason.startsWith("chromatic approach"));
    expect(approaches.length).toBeGreaterThan(0);
    for (const a of approaches) {
      const next = phrase.events.find((e) => e.onset > a.onset);
      if (next) expect(Math.abs(a.chosen! - next.note!)).toBe(1);
    }
  });
  it("an approach to a range-edge target flips sides instead of jumping octaves", () => {
    // Target the range floor: an approach "from below" would leave the range.
    const lowFrames: HarmonicFrame[] = [
      { start: 0, end: 1920, chord: DM7 },
      { start: 1920, end: 3840, chord: { symbol: "Cmaj7", rootPc: 0, pcs: [0, 4, 7, 11] } },
    ];
    const { phrase } = adaptBassPhrase(sourcePhrase(), {
      frames: lowFrames, seed: 42, range: { low: 36, high: 55 }, chromaticism: 1, traceLevel: "events",
    });
    const downbeat2 = phrase.events.find((e) => e.onset === 1920)!;
    const approach = phrase.events.find((e) => e.onset === 1440)!;
    expect(Math.abs(approach.note! - downbeat2.note!)).toBe(1); // adjacency preserved
  });
  it("rhythm preservation < 1 thins non-downbeats deterministically, never downbeats", () => {
    const a = accept(42, { rhythmPreservation: 0.3 });
    const b = accept(42, { rhythmPreservation: 0.3 });
    expect(JSON.stringify(a.phrase.events)).toBe(JSON.stringify(b.phrase.events));
    expect(a.phrase.events.length).toBeLessThan(16);
    for (let bar = 0; bar < 4; bar++) {
      expect(a.phrase.events.some((e) => e.onset === bar * 1920)).toBe(true);
    }
  });
  it("every note off follows its note on and stays inside the timeline", () => {
    const { phrase } = accept(42);
    for (const e of phrase.events) {
      expect(e.duration).toBeGreaterThan(0);
      expect(e.onset + e.duration).toBeLessThanOrEqual(phrase.lengthTicks);
    }
  });
  it("the trace explains each event and honors levels", () => {
    const full = accept(42);
    expect(full.trace.events).toHaveLength(16);
    for (const t of full.trace.events!) expect(t.reason).toBeTruthy();
    const summary = accept(42, { traceLevel: "summary" });
    expect(summary.trace.summary).toBeDefined();
    expect(summary.trace.events).toBeUndefined();
    const none = accept(42, { traceLevel: "none" });
    expect(none.trace.summary).toBeUndefined();
    expect(none.trace.header.seed).toBe(42); // reproducibility header always kept
  });
  it("the adapted phrase itself validates and round-trips", () => {
    const { phrase } = accept(42);
    expect(validatePhrase(phrase).ok).toBe(true);
    expect(parsePhrase(serializePhrase(phrase))).toEqual(phrase);
  });
});
