import { describe, it, expect } from "vitest";
import { soundingPattern, hasProgression } from "./sounding.js";

const lane = (steps, progressive = null) => ({ steps, accents: steps.map(() => 0), progressive });

describe("soundingPattern — one source for what plays and what draws", () => {
  it("prefers the SOUNDING poly over the typed parse", () => {
    // The regression this module exists for: a lengthened lane. The typed
    // parse still has the base length; displayPoly has the grown one, and the
    // lane clock has to tick the grown one or it truncates every cycle after
    // the first.
    const typed = { lanes: [lane([1, 0, 0, 1, 0, 1, 0, 1, 0], { kind: "lengthen", step: 3 })] };
    const grown = { lanes: [lane(new Array(18).fill(0).map((_, i) => (i % 3 === 0 ? 1 : 0)))] };
    const out = soundingPattern({ steps: [], accents: [], poly: typed, displayPoly: grown });
    expect(out.poly.lanes[0].steps.length).toBe(18);
    expect(out.poly).toBe(grown);
  });

  it("THROWS when a progressive lane arrives with no displayPoly", () => {
    // The wiring mistake this module exists to make impossible. There is no
    // correct rendering of this state: the typed parse never advances, so
    // whatever is drawn or played is wrong from the second trigger on.
    const typed = { lanes: [lane([1, 0, 1], { kind: "lengthen", step: 2 })] };
    expect(() => soundingPattern({ poly: typed, displayPoly: null }))
      .toThrow(/no displayPoly was supplied/);
  });

  it("does not throw once the sounding poly is supplied", () => {
    const typed = { lanes: [lane([1, 0, 1], { kind: "offset", step: 2 })] };
    const sounding = { lanes: [lane([1, 1, 0], { kind: "offset", step: 2 })] };
    expect(() => soundingPattern({ poly: typed, displayPoly: sounding })).not.toThrow();
  });

  it("never fires for the states the app is actually in", () => {
    // Mono (no poly at all), and poly with no progression on any lane. If
    // either of these threw, the guard would be worse than the bug.
    expect(() => soundingPattern({ steps: [1, 0], accents: [0, 0] })).not.toThrow();
    expect(() => soundingPattern({ poly: { lanes: [lane([1, 0]), lane([1, 0, 1])] } })).not.toThrow();
    expect(() => soundingPattern()).not.toThrow();
  });

  it("falls back to the typed parse only when they cannot differ", () => {
    const typed = { lanes: [lane([1, 0, 1, 0])] };   // no progression anywhere
    expect(hasProgression(typed)).toBe(false);
    expect(soundingPattern({ poly: typed, displayPoly: null }).poly).toBe(typed);
  });

  it("is null for mono — there is no poly to sound", () => {
    expect(soundingPattern({ steps: [1, 0, 1], accents: [0, 0, 0] }).poly).toBeNull();
  });

  it("carries mono steps and accents through untouched", () => {
    const steps = [1, 0, 1, 1], accents = [1, 0, 0, 0];
    const out = soundingPattern({ steps, accents });
    expect(out.steps).toBe(steps);
    expect(out.accents).toBe(accents);
  });

  it("never returns undefined fields — a scheduler reading .length must not throw", () => {
    const out = soundingPattern();
    expect(out.steps).toEqual([]);
    expect(out.accents).toEqual([]);
    expect(out.poly).toBeNull();
  });

  it("hasProgression spots a lane that will grow or turn", () => {
    expect(hasProgression({ lanes: [lane([1, 0]), lane([1, 0], { kind: "offset", step: 2 })] })).toBe(true);
    expect(hasProgression(null)).toBe(false);
  });
});
