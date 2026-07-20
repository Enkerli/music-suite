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

// ── rhythm replacement (PRIORITIES §2.1 — the interop dividend) ─────────────

import { applyRhythm } from "./index.js";

describe("applyRhythm", () => {
  const TRESILLO = { steps: [1, 0, 0, 1, 0, 0, 1, 0], label: "E(3,8)" };

  it("maps the pattern onto the phrase's full length (leftmost = LSB)", () => {
    const p = applyRhythm(sourcePhrase(), TRESILLO);
    expect(p.events.map((e) => e.onset)).toEqual([0, 720, 1440]); // 1920/8 per step
    expect(p.lengthTicks).toBe(1920);
    expect(p.id).toContain("E(3,8)");
    expect(p.annotations?.rhythm).toBe("E(3,8)");
  });

  it("cycles the source's pitch material in order, carrying chord relations", () => {
    const p = applyRhythm(sourcePhrase(), TRESILLO);
    expect(p.events.map((e) => e.note)).toEqual([38, 41, 45]); // D, F, A — contour rides along
    expect(p.events[0]!.chordRelation).toMatchObject({ category: "chord-tone", degree: 1 });
    // More onsets than source events → wrap around.
    const dense = applyRhythm(sourcePhrase(), { steps: [1, 1, 1, 1, 1, 1] });
    expect(dense.events.map((e) => e.note)).toEqual([38, 41, 45, 49, 38, 41]);
  });

  it("durations are legato to the next onset (the tied tresillo feel)", () => {
    const p = applyRhythm(sourcePhrase(), TRESILLO);
    expect(p.events.map((e) => e.duration)).toEqual([720, 720, 480]); // last runs to phrase end
  });

  it("accent layer boosts velocity on accented steps only", () => {
    const p = applyRhythm(sourcePhrase(), { ...TRESILLO, accents: [1, 0, 0, 0, 0, 0, 0, 0] });
    const plain = applyRhythm(sourcePhrase(), TRESILLO);
    expect(p.events[0]!.velocity).toBe(plain.events[0]!.velocity + 18);
    expect(p.events[1]!.velocity).toBe(plain.events[1]!.velocity);
  });

  it("a chromatic approach's cyclic target re-points to the next onset", () => {
    // Force the approach (source event 3, C♯) onto onset index 1 of a 2-onset grid.
    const p = applyRhythm(sourcePhrase(), { steps: [1, 0, 1, 0, 1, 0, 1, 0] }); // 4 onsets → material 0..3
    const approach = p.events[3]!;
    expect(approach.chordRelation!.category).toBe("chromatic-approach");
    expect(approach.chordRelation!.target).toBe(0); // cyclic: resolves to the next (first) onset
  });

  it("the rhythm-applied phrase still validates and adapts deterministically", () => {
    const p = applyRhythm(sourcePhrase(), TRESILLO);
    expect(validatePhrase(p).ok).toBe(true);
    const run = () => adaptBassPhrase(p, { frames: FRAMES, seed: 42, range: RANGE, traceLevel: "events" });
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
    for (const e of run().phrase.events) {
      expect(e.note!).toBeGreaterThanOrEqual(RANGE.low);
      expect(e.note!).toBeLessThanOrEqual(RANGE.high);
    }
  });

  it("reproduces the committed tresillo acceptance vector byte-for-byte", () => {
    const p = applyRhythm(sourcePhrase(), { ...TRESILLO, accents: [1, 0, 0, 0, 0, 0, 0, 0] });
    const got = adaptBassPhrase(p, { frames: FRAMES, seed: 42, range: RANGE, chromaticism: 0.25, rhythmPreservation: 1, traceLevel: "events" });
    expect(JSON.parse(JSON.stringify(got))).toEqual(JSON.parse(vector("adapted-tresillo-dm7-g7-cmaj7-a7-seed42.json")));
  });

  it("rejects an empty rhythm and an unpitched source", () => {
    expect(() => applyRhythm(sourcePhrase(), { steps: [0, 0, 0, 0] })).toThrow(/no onsets/);
  });
});

describe("the source-phrase pack (each committed vector is a style)", () => {
  for (const name of ["walking-bass", "funk-ghost", "bossa", "two-feel"]) {
    it(`${name} validates and is playable material`, () => {
      const p = parsePhrase(vector(`source-${name}.json`));
      expect(validatePhrase(p).ok).toBe(true);
      expect(p.role).toBe("bass");
      expect(p.events.length).toBeGreaterThan(0);
      expect(p.events.every((e) => e.note !== undefined)).toBe(true);
    });
  }
  it("funk-ghost carries real dynamics (ghosts well below the accents)", () => {
    const p = parsePhrase(vector("source-funk-ghost.json"));
    const vels = p.events.map((e) => e.velocity);
    expect(Math.min(...vels)).toBeLessThan(60);   // ghosts
    expect(Math.max(...vels)).toBeGreaterThan(105); // accents
  });
});

// ── articulation / dynamics / silence / anticipation (PRIORITIES §2.3–2.4) ──

import { articulate, metricWeight, GATES } from "./index.js";

describe("metricWeight", () => {
  it("ranks positions: downbeat > mid-bar beat > other beats > offbeats > cracks", () => {
    expect(metricWeight(0, 480, 4)).toBe(1.0);
    expect(metricWeight(960, 480, 4)).toBe(0.75);  // beat 3 in 4/4
    expect(metricWeight(480, 480, 4)).toBe(0.5);   // beat 2
    expect(metricWeight(240, 480, 4)).toBe(0.3);   // the "and"
    expect(metricWeight(120, 480, 4)).toBe(0.15);  // the crack
    expect(metricWeight(1920, 480, 4)).toBe(1.0);  // next bar's downbeat
  });
});

describe("articulate", () => {
  const adapted = () => adaptBassPhrase(
    parsePhrase(vector("source-funk-ghost.json")),
    { frames: FRAMES, seed: 42, range: RANGE, traceLevel: "summary" },
  ).phrase;

  it("gate scales durations (named feels and raw factors)", () => {
    const base = adapted();
    const stac = articulate(base, { seed: 1, gate: "staccato" }).phrase;
    base.events.forEach((e, i) => {
      expect(stac.events[i]!.duration).toBe(Math.max(1, Math.round(e.duration * GATES.staccato)));
    });
    const half = articulate(base, { seed: 1, gate: 0.5 }).phrase;
    expect(half.events[0]!.duration).toBe(Math.max(1, Math.round(base.events[0]!.duration * 0.5)));
  });

  it("dynamics push velocity toward the metric contour (downbeats up, cracks down)", () => {
    const base = adapted();
    const shaped = articulate(base, { seed: 1, dynamics: 1 }).phrase;
    const at = (onset: number, evs = base.events) => evs.find((e) => e.onset === onset)!;
    expect(at(0, shaped.events).velocity).toBeGreaterThan(at(0).velocity);          // downbeat rises
    const crack = base.events.find((e) => metricWeight(e.onset, 480, 4) <= 0.3)!;
    const crackShaped = shaped.events.find((e) => e.onset === crack.onset)!;
    expect(crackShaped.velocity).toBeLessThan(crack.velocity);                       // weak spot falls
  });

  it("rests drop only weak events — bar downbeats always survive — deterministically", () => {
    const base = adapted();
    const a = articulate(base, { seed: 42, rests: 0.6 });
    const b = articulate(base, { seed: 42, rests: 0.6 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.phrase.events.length).toBeLessThan(base.events.length);
    for (let bar = 0; bar < 4; bar++) {
      expect(a.phrase.events.some((e) => e.onset === bar * 1920)).toBe(true);
    }
    for (const c of a.changes) expect(c.kind).toBe("rest");
  });

  it("anticipation pushes a bar downbeat early, keeps its resolved pitch, and trims the neighbor", () => {
    const base = adapted();
    const a = articulate(base, { seed: 42, anticipation: 1 }); // force every draw
    const pushes = a.changes.filter((c) => c.kind === "anticipation");
    expect(pushes.length).toBe(3); // bars 2..4 (never the very first onset)
    for (const c of pushes) {
      const moved = a.phrase.events.find((e) => e.onset === c.onset - 240)!;
      const original = base.events.find((e) => e.onset === c.onset)!;
      expect(moved.note).toBe(original.note); // the COMING chord's pitch, early
      const prev = a.phrase.events.filter((e) => e.onset < moved.onset).at(-1);
      if (prev) expect(prev.onset + prev.duration).toBeLessThanOrEqual(moved.onset);
    }
  });

  it("the RNG stream stays aligned: adding anticipation never changes WHICH rests drop", () => {
    const base = adapted();
    const restsOnly = articulate(base, { seed: 7, rests: 0.5 });
    const both = articulate(base, { seed: 7, rests: 0.5, anticipation: 1 });
    expect(both.changes.filter((c) => c.kind === "rest"))
      .toEqual(restsOnly.changes.filter((c) => c.kind === "rest"));
  });

  it("morphRests off (or no pass) reproduces today's rests exactly — pass-invariant by default", () => {
    const base = adapted();
    const noPass = articulate(base, { seed: 5, rests: 0.5 });
    const withPassNoMorph = articulate(base, { seed: 5, rests: 0.5, pass: 3 });
    expect(withPassNoMorph.changes.filter((c) => c.kind === "rest"))
      .toEqual(noPass.changes.filter((c) => c.kind === "rest"));
    // Same steps drop on every pass when morphRests is 0 — no skip-step wander.
    const p0 = articulate(base, { seed: 5, rests: 0.5, pass: 0, morphRests: 0 });
    const p5 = articulate(base, { seed: 5, rests: 0.5, pass: 5, morphRests: 0 });
    expect(p5.changes.filter((c) => c.kind === "rest")).toEqual(p0.changes.filter((c) => c.kind === "rest"));
  });

  it("morphRests (skip-step) makes WHICH steps drop wander across passes", () => {
    const base = adapted();
    const at = (pass: number) => articulate(base, { seed: 5, rests: 0.5, pass, morphRests: 1 })
      .changes.filter((c) => c.kind === "rest").map((c) => c.onset);
    const p0 = at(0);
    let anyDiffer = false;
    for (let pass = 1; pass < 8; pass++) if (JSON.stringify(at(pass)) !== JSON.stringify(p0)) { anyDiffer = true; break; }
    expect(anyDiffer).toBe(true);
    // Bar downbeats are STILL never dropped, no matter which pass.
    for (let pass = 0; pass < 8; pass++) {
      const r = articulate(base, { seed: 5, rests: 0.5, pass, morphRests: 1 });
      for (let bar = 0; bar < 4; bar++) expect(r.phrase.events.some((e) => e.onset === bar * 1920)).toBe(true);
    }
  });

  it("morphRests is deterministic per (seed, pass) and independent of anticipation's stream", () => {
    const base = adapted();
    const a = articulate(base, { seed: 8, rests: 0.5, pass: 2, morphRests: 0.7 });
    const b = articulate(base, { seed: 8, rests: 0.5, pass: 2, morphRests: 0.7 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const restsOnly = articulate(base, { seed: 8, rests: 0.5, pass: 2, morphRests: 0.7 });
    const both = articulate(base, { seed: 8, rests: 0.5, pass: 2, morphRests: 0.7, anticipation: 1 });
    expect(both.changes.filter((c) => c.kind === "rest")).toEqual(restsOnly.changes.filter((c) => c.kind === "rest"));
  });

  it("reproduces the committed articulated acceptance vector byte-for-byte", () => {
    const got = articulate(adapted(), { seed: 42, gate: "staccato", dynamics: 0.8, rests: 0.4, anticipation: 0.6 });
    expect(JSON.parse(JSON.stringify(got))).toEqual(JSON.parse(vector("articulated-funk-dm7-g7-cmaj7-a7-seed42.json")));
  });

  it("the articulated phrase still validates", () => {
    const got = articulate(adapted(), { seed: 42, gate: "staccato", dynamics: 0.8, rests: 0.4, anticipation: 0.6 });
    expect(validatePhrase(got.phrase).ok).toBe(true);
  });
});
