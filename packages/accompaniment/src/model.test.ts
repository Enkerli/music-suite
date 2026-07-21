import { describe, it, expect } from "vitest";
import { learnStyleModel, addTake, samplePhrase, serializeModel, parseModel, looksLikeModel, validateModel } from "./model.js";
import { extractPhrase, type InputNote } from "./extract.js";
import { groove } from "./pipeline.js";
import type { FrameChord, HarmonicFrame } from "./phrase.js";

const BB7: FrameChord = { symbol: "B♭7", rootPc: 10, pcs: [10, 2, 5, 8] };

/** A synthetic Funkastic-ish corpus: root-heavy one-bar B♭7 funk figures with
 *  a played (off-grid) feel — takes vary in ghosts, octave pops, and lean. */
const take = (variant: number) => {
  const base: InputNote[] = [
    { pitch: 46, startTick: 0 + [0, 4, -3, 6][variant % 4]!, durationTicks: 180, velocity: 112 - variant },
    { pitch: 46, startTick: 360 + [2, -4, 5, 0][variant % 4]!, durationTicks: 90, velocity: 44 + variant },  // ghost
    { pitch: 53, startTick: 720 + [0, 3, -5, 2][variant % 4]!, durationTicks: 170, velocity: 92 },
    { pitch: 46, startTick: 960, durationTicks: 190, velocity: 104 },
    { pitch: variant % 2 ? 58 : 56, startTick: 1440 + [1, -2, 4, -3][variant % 4]!, durationTicks: 160, velocity: 100 }, // pop
  ];
  return extractPhrase(base, {
    id: `take-${variant}`, role: "bass", meter: { numerator: 4, denominator: 4 },
    ticksPerBeat: 480, lengthTicks: 1920, frame: BB7,
  });
};

const corpus = () => [0, 1, 2, 3, 4, 5].map(take);

describe("StyleModel — learn", () => {
  it("accumulates per-slot statistics with coverage", () => {
    const m = learnStyleModel(corpus(), { id: "funk-test" });
    expect(m.takes).toBe(6);
    expect(m.slots.length).toBe(16); // one 4/4 bar of 16ths
    const downbeat = m.slots[0]!;
    expect(downbeat.covered).toBe(6);
    expect(downbeat.count).toBe(6); // every take hits the one
    expect(downbeat.notes["46"]).toBe(6); // always the root
    // The pop slot learned BOTH note choices — the vocabulary, not an average.
    const pop = m.slots[12]!;
    expect(Object.keys(pop.notes).sort()).toEqual(["56", "58"]);
    // Micro-timing: the downbeat's learned deviation is the corpus's lean, not zero.
    expect(Math.abs(downbeat.devSum)).toBeGreaterThan(0);
  });

  it("is incremental: learn(all) === learn(some) + addTake(rest)", () => {
    const all = learnStyleModel(corpus(), { id: "x" });
    const inc = learnStyleModel(corpus().slice(0, 3), { id: "x" });
    for (const p of corpus().slice(3)) addTake(inc, p);
    expect(inc).toEqual(all); // counts and sums — order-free, accumulable
  });

  it("mixed lengths: a short take only votes on the slots it covers", () => {
    const half = extractPhrase(
      [{ pitch: 46, startTick: 0, durationTicks: 180, velocity: 100 }],
      { id: "half", role: "bass", meter: { numerator: 4, denominator: 4 },
        ticksPerBeat: 480, lengthTicks: 960, frame: BB7 }); // half a bar
    const m = learnStyleModel([take(0), half], { id: "x" });
    expect(m.slots[0]!.covered).toBe(2);
    expect(m.slots[12]!.covered).toBe(1); // the half-bar take never saw slot 12
  });
});

describe("StyleModel — sample", () => {
  it("same (seed, pass) → byte-identical take; different passes differ", () => {
    const m = learnStyleModel(corpus(), { id: "funk-test" });
    const a1 = samplePhrase(m, { seed: 7, pass: 0 });
    const a2 = samplePhrase(m, { seed: 7, pass: 0 });
    const b = samplePhrase(m, { seed: 7, pass: 3 });
    expect(a2).toEqual(a1);
    expect(b.events).not.toEqual(a1.events);
  });

  it("reproduces the corpus's character: root-heavy, ghosts kept quiet, off-grid lean", () => {
    const m = learnStyleModel(corpus(), { id: "funk-test" });
    let offGrid = 0, total = 0;
    const noteSet = new Set<number>();
    for (let pass = 0; pass < 6; pass++) {
      const p = samplePhrase(m, { seed: 42, pass });
      for (const e of p.events) {
        noteSet.add(e.note!);
        total++;
        if (e.onset % 120 !== 0) offGrid++; // 120 ticks = one 16th slot
      }
      // The ghost slot (3) stays soft when it appears.
      const ghost = p.events.find((e) => Math.round(e.onset / 120) === 3);
      if (ghost) expect(ghost.velocity).toBeLessThan(70);
    }
    expect([...noteSet].every((n) => [46, 53, 56, 58].includes(n))).toBe(true); // learned vocabulary only
    expect(offGrid / total).toBeGreaterThan(0.2); // the learned pocket survives sampling
  });

  it("humanize 0 plays the averages (still deterministic, still off-grid where the corpus leaned)", () => {
    const m = learnStyleModel(corpus(), { id: "funk-test" });
    const flat1 = samplePhrase(m, { seed: 1, humanize: 0 });
    const flat2 = samplePhrase(m, { seed: 2, humanize: 0 });
    // With no spread, velocities are the means — seeds only affect onset/note draws.
    const v1 = flat1.events.map((e) => e.velocity);
    for (const e of flat2.events) {
      const match = flat1.events.find((x) => Math.round(x.onset / 120) === Math.round(e.onset / 120));
      if (match) expect(e.velocity).toBe(match.velocity);
    }
    expect(v1.length).toBeGreaterThan(0);
  });

  it("a sampled take drops straight into groove() and adapts across a progression", () => {
    const m = learnStyleModel(corpus(), { id: "funk-test" });
    const src = samplePhrase(m, { seed: 42, pass: 1 });
    const r = groove(src, { progression: "Dm7 | G7 | Cmaj7 | A7", seed: 42 });
    expect(r.phrase.events.length).toBeGreaterThan(4);
    // Reharmonized: the output is not stuck on the B♭7 vocabulary.
    const pcs = new Set(r.phrase.events.map((e) => e.pitchClass));
    expect(pcs.has(2) || pcs.has(7) || pcs.has(0)).toBe(true); // D/G/C roots present
  });

  it("never samples silence (the most-played slot stands in)", () => {
    const m = learnStyleModel(corpus(), { id: "x" });
    const p = samplePhrase(m, { seed: 3, density: 0.0001 });
    expect(p.events.length).toBeGreaterThanOrEqual(1);
  });
});

describe("StyleModel — serialization", () => {
  it("round-trips; statistics only (no source events anywhere)", () => {
    const m = learnStyleModel(corpus(), { id: "funk-test" });
    const json = serializeModel(m);
    expect(json).not.toMatch(/"events"/); // the clips never leave the machine
    const back = parseModel(json);
    expect(back).toEqual(m);
    expect(looksLikeModel(back)).toBe(true);
    expect(looksLikeModel(take(0))).toBe(false);
  });

  it("parseModel names what is wrong", () => {
    expect(() => parseModel("{}")).toThrow(/v must be 1/);
    expect(() => parseModel("nope")).toThrow(/not JSON/);
  });

  it("a single-chord model never gains a `frames` field", () => {
    const m = learnStyleModel(corpus(), { id: "funk-test" });
    expect(m.frames).toBeUndefined();
  });
});

// ── progressions (docs/GLORIARP_NEXT.md §3g) ─────────────────────────────────

describe("StyleModel — learned from a real progression, not one vamped chord", () => {
  const DM7: FrameChord = { symbol: "Dm7", rootPc: 2, pcs: [2, 5, 9, 0] };
  const G7: FrameChord = { symbol: "G7", rootPc: 7, pcs: [7, 11, 2, 5] };
  const frames: HarmonicFrame[] = [
    { start: 0, end: 1920, chord: DM7 },
    { start: 1920, end: 3840, chord: G7 },
  ];
  /** A 2-bar Dm7|G7 walking figure with a leading tone INTO the change
   *  (F♯ at 1800, one semitone below G7's root at 1920) — the voice-leading
   *  case single-chord corpora can never produce, since they have nowhere
   *  to lead TO. */
  const progressionTake = (variant: number) => {
    const jitter = [0, 3, -2, 4][variant % 4]!;
    const notes: InputNote[] = [
      { pitch: 38, startTick: 0 + jitter, durationTicks: 180, velocity: 100 },     // D — Dm7 root
      { pitch: 41, startTick: 960, durationTicks: 180, velocity: 92 },             // F — Dm7 3rd
      { pitch: 42, startTick: 1800 + jitter, durationTicks: 90, velocity: 88 },    // F♯ — leads into G7
      { pitch: 43, startTick: 1920, durationTicks: 180, velocity: 104 },           // G — G7 root
      { pitch: 47, startTick: 2880, durationTicks: 180, velocity: 96 },            // B — G7 3rd
    ];
    return extractPhrase(notes, {
      id: `pt-${variant}`, role: "bass", meter: { numerator: 4, denominator: 4 },
      ticksPerBeat: 480, lengthTicks: 3840, frames,
    });
  };
  const progressionCorpus = () => [0, 1, 2, 3].map(progressionTake);

  it("learnStyleModel captures the whole timeline in `frames`, `frame` staying the first chord", () => {
    const m = learnStyleModel(progressionCorpus(), { id: "dm7-g7" });
    expect(m.frames).toEqual(frames);
    expect(m.frame).toEqual(DM7);
    expect(m.bars).toBe(2);
  });

  it("addTake needed no chord-awareness: per-slot vocabulary is still learned correctly across the bar line", () => {
    const m = learnStyleModel(progressionCorpus(), { id: "dm7-g7" });
    const slotTicks = m.ticksPerBeat / m.grid; // 120
    const bar2Downbeat = m.slots[Math.round(1920 / slotTicks)]!;
    expect(bar2Downbeat.notes["43"]).toBe(4); // every take's G at the chord change
  });

  it("a sampled take carries correct chord-relations PER CHORD, not one global one", () => {
    const m = learnStyleModel(progressionCorpus(), { id: "dm7-g7" });
    const p = samplePhrase(m, { seed: 7, humanize: 0 });
    expect(p.harmonicFrames).toEqual(frames);
    const bar1 = p.events.filter((e) => e.onset < 1920);
    const bar2 = p.events.filter((e) => e.onset >= 1920);
    expect(bar1.length).toBeGreaterThan(0);
    expect(bar2.length).toBeGreaterThan(0);
    // Every learned pitch class in each half is drawn from ITS OWN chord's
    // vocabulary (38→D, 41→F in Dm7; 43→G, 47→B in G7) or is the boundary
    // approach (42) — never mislabeled against the wrong half's harmony.
    for (const e of bar1) expect([2, 5, 6]).toContain(e.pitchClass); // D, F, or the F♯ approach
    for (const e of bar2) expect([7, 11]).toContain(e.pitchClass);   // G, B
  });

  it("a progression-learned sample still reharmonizes onto a DIFFERENT target — same 'adapts anywhere' property", () => {
    const m = learnStyleModel(progressionCorpus(), { id: "dm7-g7" });
    const src = samplePhrase(m, { seed: 11 });
    const r = groove(src, { progression: "Cmaj7 | A7", seed: 11 });
    expect(r.phrase.events.length).toBeGreaterThan(0);
    const pcs = new Set(r.phrase.events.map((e) => e.pitchClass));
    expect(pcs.has(0) || pcs.has(9)).toBe(true); // C or A roots present — not stuck on Dm7/G7
  });

  it("validateModel accepts a progression model and still rejects a malformed `frames`", () => {
    const m = learnStyleModel(progressionCorpus(), { id: "dm7-g7" });
    expect(validateModel(m).ok).toBe(true);
    expect(validateModel({ ...m, frames: [{ start: 0, end: 0, chord: DM7 }] }).errors.join())
      .toMatch(/start < end/);
  });

  it("round-trips through JSON with `frames` intact", () => {
    const m = learnStyleModel(progressionCorpus(), { id: "dm7-g7" });
    const back = parseModel(serializeModel(m));
    expect(back).toEqual(m);
    expect(back.frames).toEqual(frames);
  });
});
