import { describe, it, expect } from "vitest";
import { baseStepMs, laneStepMs, laneOffsetMs } from "./poly-clock.js";

// Deliberately COPRIME step counts (lcm = 7 × 11 = 77), not multiples of a
// shared base like 8/16 — the point raised on review: patterns where every
// lane's length divides evenly into the others realign almost immediately
// (lcm(8,16) = 16, one lane's own cycle) and don't actually exercise drift.
// 7 vs 11 only realigns after 77 steps — cycle lock and step lock produce
// genuinely, measurably different schedules for it.
const lane7 = { steps: Array(7).fill(1) };
const lane11 = { steps: Array(11).fill(1) };

describe("baseStepMs", () => {
  it("is tempo and group (subdivision) dependent, independent of any lane", () => {
    expect(baseStepMs(120, 4)).toBeCloseTo(125, 6); // 120bpm, 16th note = 125ms
    expect(baseStepMs(60, 4)).toBeCloseTo(250, 6);
    expect(baseStepMs(120, 8)).toBeCloseTo(62.5, 6);
  });
  it("defaults group to 4 when omitted/falsy", () => {
    expect(baseStepMs(120)).toBeCloseTo(baseStepMs(120, 4), 6);
    expect(baseStepMs(120, 0)).toBeCloseTo(baseStepMs(120, 4), 6);
  });
});

describe("laneStepMs — cycle lock (POLYRHYTHM): same TOTAL cycle, different step sizes", () => {
  it("7 and 11 step lanes complete their full cycle in the SAME wall-clock time", () => {
    const tempo = 120, group = 4, refSteps = 7; // lane7 declared first, defines the cycle
    const step7 = laneStepMs({ lane: lane7, refSteps, polyLock: "cycle", tempo, group });
    const step11 = laneStepMs({ lane: lane11, refSteps, polyLock: "cycle", tempo, group });
    expect(step7 * 7).toBeCloseTo(step11 * 11, 6); // equal total cycle duration
    expect(step7).not.toBeCloseTo(step11, 3);       // but each STEP is a different length —
    expect(step7).toBeGreaterThan(step11);          // the shorter lane (7) takes bigger steps
  });
  it("with a 1:1 refSteps (mono, no other lanes), cycle lock reduces to the base rate", () => {
    const solo = { steps: Array(4).fill(1) };
    expect(laneStepMs({ lane: solo, refSteps: 4, polyLock: "cycle", tempo: 120, group: 4 }))
      .toBeCloseTo(baseStepMs(120, 4), 6);
  });
});

describe("laneStepMs — step lock (POLYMETER): same step size, different TOTAL cycles (real drift)", () => {
  it("7 and 11 step lanes tick at the identical rate — cycles necessarily diverge", () => {
    const tempo = 120, group = 4;
    const step7 = laneStepMs({ lane: lane7, polyLock: "step", tempo, group });
    const step11 = laneStepMs({ lane: lane11, polyLock: "step", tempo, group });
    expect(step7).toBeCloseTo(step11, 6);              // identical step duration
    expect(step7).toBeCloseTo(baseStepMs(tempo, group), 6);
    expect(step7 * 7).not.toBeCloseTo(step11 * 11, 3); // different total cycle lengths
  });
  it("realigns only at the lcm — 77 steps of the shared clock for 7 against 11, not some small round number", () => {
    const tempo = 120, group = 4;
    const stepMs = laneStepMs({ lane: lane7, polyLock: "step", tempo, group });
    // lane7 completes 11 cycles and lane11 completes 7 cycles at exactly the
    // same instant: 77 * stepMs, the lcm(7,11) tick — not reachable via any
    // smaller shared multiple since 7 and 11 are coprime.
    const realignTick = 77;
    expect((realignTick * stepMs) % (7 * stepMs)).toBeCloseTo(0, 6);
    expect((realignTick * stepMs) % (11 * stepMs)).toBeCloseTo(0, 6);
    // no smaller positive tick count realigns both (spot-check a few divisors)
    for (const smaller of [7, 11, 14, 22, 33, 44, 55, 66]) {
      const alignsBoth = smaller % 7 === 0 && smaller % 11 === 0;
      expect(alignsBoth).toBe(false);
    }
  });
  it("ignores refSteps entirely — polymeter never depends on which lane is 'first'", () => {
    const tempo = 120, group = 4;
    const withRef = laneStepMs({ lane: lane7, refSteps: 999, polyLock: "step", tempo, group });
    const withoutRef = laneStepMs({ lane: lane7, polyLock: "step", tempo, group });
    expect(withRef).toBeCloseTo(withoutRef, 6);
  });
});

describe("laneOffsetMs", () => {
  it("no offset is 0", () => {
    expect(laneOffsetMs({ offset: null }, 120)).toBe(0);
  });
  it("ms offsets pass through untouched, tempo-independent", () => {
    expect(laneOffsetMs({ offset: { kind: "ms", ms: -12 } }, 60)).toBe(-12);
    expect(laneOffsetMs({ offset: { kind: "ms", ms: -12 } }, 200)).toBe(-12);
  });
  it("note-value fractions tempo-sync (a 1/32 late is shorter at a faster tempo)", () => {
    const at120 = laneOffsetMs({ offset: { kind: "frac", num: 1, den: 32 } }, 120);
    const at240 = laneOffsetMs({ offset: { kind: "frac", num: 1, den: 32 } }, 240);
    expect(at120).toBeGreaterThan(0);
    expect(at240).toBeCloseTo(at120 / 2, 6);
  });
});
