/**
 * Per-lane progressive offset — `body%N` inside a poly lane.
 *
 * `/` binds loosest (docs/SERPE_POLY.md §2.5, decided 2026-07-28), so `%N`
 * belongs to the lane it is attached to, not to the whole string. Before that
 * was settled this file's first case came back "lane1: Unrecognised pattern"
 * here while the C++ read the same text as a whole-string offset.
 *
 * The expected rotations are the C++ engine's own, taken from
 * serpe_poly_precedence in the Serpe repo — the same four-step cycle the
 * plugin produced in a live session.
 */
import { describe, it, expect } from "vitest";
import { parsePolyUPI, polyLaneAt, formatPolyUPI } from "./poly.js";

const bits = (steps) => steps.map((s) => (s ? "1" : "0")).join("");

describe("poly lane %N", () => {
  it("attaches the offset to its own lane, leaving the others alone", () => {
    const p = parsePolyUPI("E(3,8)%2/E(3,7)");
    expect(p.ok, p.error).toBe(true);
    expect(p.lanes[0].progressive).toEqual({ kind: "offset", step: 2 });
    expect(p.lanes[1].progressive).toBeNull();
    expect(p.lanes[0].steps.length).toBe(8);
    expect(p.lanes[1].steps.length).toBe(7);
    expect(p.lcm).toBe(56);
  });

  it("keeps %N in the lane source, so a re-parse is distinguishable", () => {
    expect(parsePolyUPI("E(3,8)%2/E(3,7)").lanes[0].source).toContain("%2");
  });

  it("reproduces the C++ engine's rotation cycle", () => {
    // Verbatim from serpe_poly_precedence: rotating E(3,8) by 2 has period 4.
    const CPP = ["10100100", "00101001", "01001010", "10010010", "10100100"];
    const lane = parsePolyUPI("E(3,8)%2/E(3,7)").lanes[0];
    expect(CPP.map((_, i) => bits(polyLaneAt(lane, i + 1)))).toEqual(CPP);
  });

  it("leaves a lane without %N unchanged on every trigger", () => {
    const lane = parsePolyUPI("E(3,8)%2/E(3,7)").lanes[1];
    const first = bits(polyLaneAt(lane, 1));
    for (const n of [2, 3, 7, 40]) expect(bits(polyLaneAt(lane, n))).toBe(first);
  });

  it("round-trips through formatPolyUPI", () => {
    const p = parsePolyUPI("E(3,8)%2/E(3,7)");
    const again = parsePolyUPI(formatPolyUPI(p));
    expect(again.ok, again.error).toBe(true);
    expect(again.lanes[0].progressive).toEqual({ kind: "offset", step: 2 });
  });

  it("still rejects what is genuinely unparseable in a lane", () => {
    // A bare '%' is not an offset, so the whole body has to parse — it does not.
    expect(parsePolyUPI("E(3,8)%/E(3,7)").ok).toBe(false);
    expect(parsePolyUPI("E(3,/E(3,7)").ok).toBe(false);
    // NOT a rejection case: bare words are Morse (`nonsense` -> 23 steps), a
    // documented fallback. Worth pinning so it is not mistaken for a bug.
    expect(parsePolyUPI("nonsense%2/E(3,7)").ok).toBe(true);
  });
});
