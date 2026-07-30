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
import { parsePolyUPI, polyLaneAt, formatPolyUPI, laneScenes } from "./poly.js";

const bits = (steps) => steps.map((s) => (s ? "1" : "0")).join("");

describe("poly lane %N", () => {
  it("attaches the offset to its own lane, leaving the others alone", () => {
    const p = parsePolyUPI("E(3,8)%2/E(3,7)");
    expect(p.ok, p.error).toBe(true);
    expect(p.lanes[0].progressive).toMatchObject({ kind: "offset", step: 2 });
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
    expect(again.lanes[0].progressive).toMatchObject({ kind: "offset", step: 2 });
  });

  it("grows a *N lane by step per trigger, keeping the base as a prefix", () => {
    const random = () => 0.5;                     // pinned only for the test
    const p = parsePolyUPI("E(3,8)*3/E(3,7)");
    expect(p.ok, p.error).toBe(true);
    expect(p.lanes[0].progressive).toMatchObject({ kind: "lengthen", step: 3 });
    expect(p.lanes[1].progressive).toBeNull();
    // Trigger 1 is already base+step (11 steps, not 8) — the engine's phase,
    // seen live when a scene entering E(3,8)*3 played 11 steps immediately.
    const lens = [1, 2, 3, 4].map((n) => polyLaneAt(p.lanes[0], n, { random }).length);
    expect(lens).toEqual([11, 14, 17, 20]);
    const base = bits(p.lanes[0].steps);
    expect(bits(polyLaneAt(p.lanes[0], 3, { random })).startsWith(base)).toBe(true);
  });

  it("gives a lane at most one progressive suffix, offset winning", () => {
    // parseUPI understands '%N' too, so a lane could otherwise be flagged for
    // both. Matches the C++ (serpe_poly_precedence) and the mono ordering.
    const p = parsePolyUPI("E(3,8)%2*3/E(3,7)");
    if (p.ok) expect(p.lanes[0].progressive?.kind).not.toBe("lengthen");
  });

  it("round-trips a *N lane too", () => {
    const p = parsePolyUPI("E(3,8)*3/E(3,7)");
    const again = parsePolyUPI(formatPolyUPI(p));
    expect(again.ok, again.error).toBe(true);
    expect(again.lanes[0].progressive).toMatchObject({ kind: "lengthen", step: 3 });
  });

  it("splits a scene chain inside a lane, not across the string", () => {
    expect(laneScenes("E(3,8)|E(5,8)/E(3,7)")).toEqual([["E(3,8)", "E(5,8)"], ["E(3,7)"]]);
    // A lane with no chain still reports one scene, so callers treat all alike.
    expect(laneScenes("E(3,8)/E(3,7)")).toEqual([["E(3,8)"], ["E(3,7)"]]);
    // Label and @offset belong to the lane, outside the chain.
    expect(laneScenes("kick=E(3,8)|E(5,8)@+12ms/E(3,7)")[0]).toEqual(["E(3,8)", "E(5,8)"]);
  });

  it("resolves whichever scene each lane is on, wrapping", () => {
    const onsets = (idx) =>
      parsePolyUPI("E(3,8)|E(5,8)/E(3,7)", { n: 16 }, [idx, 0])
        .lanes[0].steps.filter(Boolean).length;
    expect([0, 1, 2, 3].map(onsets)).toEqual([3, 5, 3, 5]);
  });

  it("keeps the progressive suffix per SCENE, not per lane", () => {
    const at = (idx) => parsePolyUPI("E(3,8)%2|E(3,8)*3/E(3,7)", { n: 16 }, [idx, 0]).lanes[0];
    expect(at(0).progressive).toMatchObject({ kind: "offset", step: 2 });
    expect(at(1).progressive).toMatchObject({ kind: "lengthen", step: 3 });
  });

  it("parses all three of the strings that started this", () => {
    for (const s of [
      "E(3,17)%2/E(3,5)|E(3,8)*3",
      "E(3,17)/E(3,5)%2",
      "E(3,8)%2|E(3,8)*3/E(3,7)",
    ]) {
      const chains = laneScenes(s);
      const most = Math.max(...chains.map((c) => c.length));
      for (let t = 0; t < most * 2; t++) {
        const r = parsePolyUPI(s, { n: 16 }, chains.map(() => t));
        expect(r.ok, `${s} @ scene ${t}: ${r.error}`).toBe(true);
      }
    }
  });

  it("handles a progressive TRANSFORM in a lane, which regexes here missed", () => {
    for (const s of ["E(7,16)>16/E(1,17)>17", "E(7,16)E>16/E(1,17)E>17"]) {
      const p = parsePolyUPI(s);
      expect(p.ok, `${s}: ${p.error}`).toBe(true);
      expect(p.lanes[0].progressive).toMatchObject({ kind: "transform" });
      expect(p.lanes[1].progressive).toMatchObject({ kind: "transform" });
    }
    // The transformer letter before '>' is read, defaulting to Barlow.
    expect(parsePolyUPI("E(7,16)E>16/E(1,17)>17").lanes[0].progressive.type).toBe("e");
    expect(parsePolyUPI("E(7,16)>16/E(1,17)>17").lanes[0].progressive.type).toBe("b");
  });

  it("advances a >N lane one fold per trigger", () => {
    const lane = parsePolyUPI("E(1,8)>8/E(3,7)").lanes[0];
    const bitsAt = (n) => bits(polyLaneAt(lane, n));
    // Same sequence progressive.js pins against the C++ probe for mono.
    expect([1, 2, 3].map(bitsAt)).toEqual(["10000000", "10000001", "10001001"]);
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
