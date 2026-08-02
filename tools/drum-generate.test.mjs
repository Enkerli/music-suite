import { describe, it, expect } from "vitest";
import { generate, toUPI } from "./drum-generate.mjs";
import { parsePolyUPI } from "@enkerli/upi";
import { drumForLabel } from "@enkerli/drumsynth";

/**
 * A hand-written style, not one learned from the corpus — the EZdrummer source
 * is licensed and gitignored (D7), so a test that needed it could not run in
 * CI. This one is shaped like a jazz waltz: 9 slots, ride on 1/2/a-of-2/3,
 * pedal hat on beat 2, snare comping loud and ghosting soft.
 */
const STYLE = {
  id: "test-waltz", kind: "drum-style", version: 1,
  grid: { perBeat: 3, beatsPerBar: 3, slotsPerBar: 9, meterConfidence: 1 },
  bars: 100,
  swing: [{ nominal: 0.667, played: 0.674, n: 500 }],
  voices: [
    { drum: "ride", note: 59, hits: 400, slots: [
      { slot: 0, p: 1, velocity: { mean: 105, sd: 3, n: 100 }, push: 0.012 },
      { slot: 3, p: 1, velocity: { mean: 100, sd: 3, n: 100 }, push: 0.016 },
      { slot: 5, p: 1, velocity: { mean: 80, sd: 3, n: 100 }, push: 0.032 },
      { slot: 6, p: 1, velocity: { mean: 102, sd: 3, n: 100 }, push: 0.006 }] },
    { drum: "pedalHat", note: 44, hits: 100, slots: [
      { slot: 3, p: 1, velocity: { mean: 88, sd: 2, n: 100 }, push: 0.03 }] },
    { drum: "snare", note: 38, hits: 200, slots: [
      { slot: 5, p: 1, velocity: { mean: 87, sd: 2, n: 100 }, push: 0.057 },
      { slot: 6, p: 1, velocity: { mean: 60, sd: 2, n: 100 }, push: -0.007 }] },
    { drum: "never", note: 36, hits: 0, slots: [{ slot: 0, p: 0, velocity: null, push: 0 }] },
  ],
};

describe("style → pattern", () => {
  it("emits UPI the suite's own parser accepts", () => {
    const { upi } = toUPI(generate(STYLE, { bars: 1, seed: 5 }));
    const p = parsePolyUPI(upi, { n: 9 });
    expect(p.ok, upi).toBe(true);
    expect(p.lanes.length).toBeGreaterThan(2);
    for (const l of p.lanes) expect(l.steps.length).toBe(9);
  });

  it("labels every lane with a name the kit resolves", () => {
    // The lane label IS the drum — `msuite upi --wav` looks it up. A label the
    // kit cannot resolve would render as silence.
    const { upi } = toUPI(generate(STYLE, { bars: 1, seed: 5 }));
    for (const l of parsePolyUPI(upi, { n: 9 }).lanes)
      expect(drumForLabel(l.label), l.label).not.toBeNull();
  });

  it("puts the learned hits where the style says", () => {
    const { upi } = toUPI(generate(STYLE, { bars: 1, seed: 5 }));
    const p = parsePolyUPI(upi, { n: 9 });
    const ride = p.lanes.find((l) => l.label === "ride");
    expect(ride.steps.map(Number).join("")).toBe("100101100");   // 1, 2, a-of-2, 3
    const ped = p.lanes.find((l) => l.label === "pedalHat");
    expect(ped.steps.map(Number).join("")).toBe("000100000");    // beat 2 only
  });

  it("turns the velocity split into accents, per lane", () => {
    // The snare comps at 87 and ghosts at 60 — that gap is what an accent mask
    // can carry, and the threshold is the LANE's own midpoint, since "loud for
    // a ghosting snare" is not "loud for a ride".
    const { upi } = toUPI(generate(STYLE, { bars: 1, seed: 5 }));
    const snare = parsePolyUPI(upi, { n: 9 }).lanes.find((l) => l.label === "snare");
    expect(snare.accentPattern).toEqual([1, 0]);                  // comp accented, ghost not
  });

  it("drops a voice whose probability is zero", () => {
    const { upi } = toUPI(generate(STYLE, { bars: 1, seed: 5 }));
    expect(upi).not.toContain("never");
  });

  it("follows GloriArp's seed/pass convention — a pass is a fresh take", () => {
    // "every --pass is a fresh take" (msuite accompany). Same seed, next pass:
    // a different bar from the same distribution, repeatably. rng(seed, pass)
    // already had that signature, and it is the same mulberry32 the C++ engine
    // grows `*N` with, so a seed means one thing suite-wide.
    const varied = { ...STYLE, voices: STYLE.voices.map((v) => ({ ...v, slots: v.slots.map((s) => ({ ...s, p: s.p ? 0.5 : 0 })) })) };
    const p0 = toUPI(generate(varied, { bars: 1, seed: 7, pass: 0 })).upi;
    const p1 = toUPI(generate(varied, { bars: 1, seed: 7, pass: 1 })).upi;
    expect(p1).not.toBe(p0);
    // ...and repeatable, so a take can be returned to.
    expect(toUPI(generate(varied, { bars: 1, seed: 7, pass: 1 })).upi).toBe(p1);
  });

  it("keeps the style's near-certain hits across passes", () => {
    // The identity of a groove is the slots it almost always plays. Those
    // should survive a pass change; the 50/50 material is what varies.
    const rides = [0, 1, 2].map((pass) => {
      const { upi } = toUPI(generate(STYLE, { bars: 1, seed: 7, pass }));
      return parsePolyUPI(upi, { n: 9 }).lanes.find((l) => l.label === "ride").steps.map(Number).join("");
    });
    expect(new Set(rides).size).toBe(1);
    expect(rides[0]).toBe("100101100");
  });

  it("is reproducible by seed, and different across seeds", () => {
    const a = toUPI(generate(STYLE, { bars: 1, seed: 7 })).upi;
    expect(toUPI(generate(STYLE, { bars: 1, seed: 7 })).upi).toBe(a);
    const varied = { ...STYLE, voices: STYLE.voices.map((v) => ({ ...v, slots: v.slots.map((s) => ({ ...s, p: s.p ? 0.5 : 0 })) })) };
    const x = toUPI(generate(varied, { bars: 1, seed: 1 })).upi;
    const y = toUPI(generate(varied, { bars: 1, seed: 2 })).upi;
    expect(x).not.toBe(y);
  });

  it("REPORTS the per-slot microtiming it cannot express", () => {
    // The honest part. A style knows the snare drags 0.057 slots on the "a" of
    // 2 and rushes 0.007 on beat 3; UPI has one offset per lane. The generator
    // averages and says what it flattened rather than dropping it quietly.
    const { lost } = toUPI(generate(STYLE, { bars: 1, seed: 5 }));
    const snare = lost.find((l) => l.drum === "snare");
    expect(snare).toBeTruthy();
    expect(snare.pushSpreadSlots).toBeCloseTo(0.064, 2);
  });

  it("keeps the lossless events available", () => {
    // --json exists because the UPI is a projection. Anyone wanting per-hit
    // velocity and push feeds these to a MIDI writer instead.
    const take = generate(STYLE, { bars: 2, seed: 5 });
    expect(take.events.length).toBeGreaterThan(10);
    for (const e of take.events) {
      expect(e).toHaveProperty("velocity");
      expect(e).toHaveProperty("push");
    }
  });
});
