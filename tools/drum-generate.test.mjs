import { describe, it, expect } from "vitest";
import { generate, toUPI } from "@enkerli/drumsynth";
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

  it("follows GloriArp's seed/pass/morph convention", () => {
    // "--morph 0..1 re-rolls that much per pass. 0 = every pass identical."
    // So a pass ALONE changes nothing — morph is the dial, and pass is what it
    // acts on. This test asserted the opposite before morph existed, which was
    // the pre-morph contract and is now wrong by design.
    const varied = { ...STYLE, voices: STYLE.voices.map((v) => ({ ...v, slots: v.slots.map((s) => ({ ...s, p: s.p ? 0.5 : 0 })) })) };
    const at = (pass, morph) => toUPI(generate(varied, { bars: 1, seed: 7, pass, morph })).upi;

    expect(at(1, 0)).toBe(at(0, 0));          // morph 0: the loop repeats
    expect(at(1, 1)).not.toBe(at(0, 1));      // morph 1: every pass unrelated
    expect(at(1, 0.5)).not.toBe(at(0, 0.5));  // in between: it drifts
    expect(at(2, 0.5)).toBe(at(2, 0.5));      // and any take can be returned to
  });

  it("morphs the two axes independently", () => {
    // Asserted on the EVENTS, not the UPI. morphDynamics moves velocities, and
    // UPI carries only an accent bit — so a dynamics morph is invisible in the
    // notation unless it happens to flip a hit across its lane's midpoint. On
    // the real corpus it does (ride 101101001 held while its mask went {10101}
    // → {10010} → {11100}, sd there being ~10); this fixture's sd of 3 is too
    // tight for that, and testing through the lossy projection would have made
    // a working feature look broken.
    const takes = [0, 1, 2].map((pass) =>
      generate(STYLE, { bars: 1, seed: 7, pass, morphHits: 0, morphDynamics: 1 }));
    const slotsOf = (t) => t.events.map((e) => `${e.drum}:${e.slot}`).sort().join(" ");
    const velsOf = (t) => t.events.map((e) => e.velocity).join(" ");
    expect(new Set(takes.map(slotsOf)).size).toBe(1);            // rhythm held
    expect(new Set(takes.map(velsOf)).size).toBeGreaterThan(1);  // dynamics wandered
  });

  it("morphing hits alone leaves the dynamics rule intact", () => {
    const a = generate(STYLE, { bars: 1, seed: 7, pass: 1, morphHits: 1, morphDynamics: 0 });
    const b = generate(STYLE, { bars: 1, seed: 7, pass: 2, morphHits: 1, morphDynamics: 0 });
    // Different bars, but every hit still drawn from its own slot's velocity
    // distribution — a morph must not make a ghost note loud.
    for (const t of [a, b]) for (const e of t.events) {
      const slot = STYLE.voices.find((v) => v.drum === e.drum)?.slots.find((s) => s.slot === e.slot);
      if (slot?.velocity) expect(Math.abs(e.velocity - slot.velocity.mean)).toBeLessThanOrEqual(slot.velocity.sd + 1);
    }
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
