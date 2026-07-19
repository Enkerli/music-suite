import { describe, it, expect } from "vitest";
import { learnStyleModel, addTake, samplePhrase, serializeModel, parseModel, looksLikeModel } from "./model.js";
import { extractPhrase, type InputNote } from "./extract.js";
import { groove } from "./pipeline.js";
import type { FrameChord } from "./phrase.js";

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
});
