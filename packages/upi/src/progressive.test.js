/**
 * Progressive notation — ported from the C++ engine, pinned to ITS output.
 *
 * The CPP_SEQUENCES below are not hand-written expectations: they are the
 * Serpe C++ engine's own results, taken 2026-07-27 from
 *
 *   cd rhythm_pattern_explorer
 *   cmake --build build --target serpe_parser_probe
 *   ./build/serpe_parser_probe_artefacts/Release/serpe_parser_probe
 *
 * whose progressive section calls UPIParser::parse() on the same string N
 * times — the engine is stateful, so each call returns the next trigger. That
 * is the sequence progressiveAt(desc, n) has to reproduce. Regenerate the same
 * way if the engine's algorithm ever changes; do not "fix" a vector by hand.
 *
 * OFFSET is now covered too. It was excluded because its state lives in
 * PatternEngine (processor-side) where a parser probe cannot reach — but a
 * poly lane reaches it, so `serpe_poly_precedence` in the Serpe repo produces
 * the vector below. That closed two bugs at once: the rotation SIGN (the two
 * `rotate` helpers have opposite conventions) and the PHASE (the engine's
 * first trigger is already offset by one step; this module used to return the
 * bare base, so it ran a trigger behind the plugin).
 *
 * LENGTHENING stays structural: it is random by design, so only its phase and
 * growth can be pinned, not its bits.
 */
import { describe, it, expect } from "vitest";
import { parseProgressive, progressiveAt, ProgressiveRun } from "./progressive.js";
import { parseUPI } from "./upi.js";

const parseBase = (s) => {
  const r = parseUPI(s, { n: 16 });
  return r.ok ? { steps: r.steps } : null;
};
const seq = (input, k, opts = {}) =>
  Array.from({ length: k }, (_, i) =>
    progressiveAt(parseProgressive(input), i + 1, { parseBase, ...opts }).steps.join(""),
  ).join(" ");

/** Verbatim from the C++ probe (see header). */
const CPP_SEQUENCES = {
  "E(1,8)>8":
    "10000000 10000001 10001001 10101001 10101011 11101011 11111011 11111111 10000000 10000001",
  "B(1,17)>17":
    "10000000000000000 10000000000000001 10001000000000001 10001000000001001 " +
    "10001010000001001 10001010000101001 10101010000101001 10101010000101011",
  "E(8,8)>1":
    "11111111 10111111 10101111 10101011 10001011 10001001 10000001 10000000 11111111",
};

/**
 * Progressive OFFSET, verbatim from serpe_poly_precedence (Serpe repo), which
 * drives a real PatternEngine through setProgressiveOffset /
 * triggerProgressiveOffset — the path the plugin itself uses. Rotating an
 * 8-step pattern by 2 has period 4, so the 5th trigger repeats the 1st.
 *
 * Re-taken 2026-07-30 after the move to base-first: trigger 1 is now the bare
 * E(3,8) and the whole sequence shifted one to the right. The old first
 * element (10100100) is now the second.
 */
const CPP_OFFSET = {
  "E(3,8)%2": "10010010 10100100 00101001 01001010 10010010",
};

describe("progressive transform — bit-identical to the C++ engine", () => {
  for (const [input, expected] of Object.entries(CPP_SEQUENCES)) {
    it(`${input} reproduces the engine's sequence`, () => {
      expect(seq(input, expected.split(" ").length)).toBe(expected);
    });
  }

  it("loops back to the base once the target is reached", () => {
    // The engine cycles for live use rather than sticking at the target: the
    // 8th trigger of E(1,8)>8 is full, the 9th is the base again.
    const s = seq("E(1,8)>8", 9).split(" ");
    expect(s[7]).toBe("11111111");
    expect(s[8]).toBe(s[0]);
  });

  it("dilutes as well as concentrates (target below the base)", () => {
    const s = seq("E(8,8)>1", 3).split(" ");
    expect(s[0].split("1").length - 1).toBe(8);
    expect(s[1].split("1").length - 1).toBe(7);
    expect(s[2].split("1").length - 1).toBe(6);
  });
});

describe("parseProgressive", () => {
  it("reads the transformer letter before '>', defaulting to Barlow", () => {
    expect(parseProgressive("E(1,8)>8")).toMatchObject({ kind: "transform", base: "E(1,8)", type: "b", target: 8 });
    expect(parseProgressive("E(1,8)W>8")).toMatchObject({ base: "E(1,8)", type: "w" });
    expect(parseProgressive("E(1,8)e>8")).toMatchObject({ base: "E(1,8)", type: "e" });
  });

  it("distinguishes progressive offset from pattern combination", () => {
    // `pat+N` (numeric tail) is an offset; `pat+pat` is combination and must
    // fall through to the pure parser untouched.
    expect(parseProgressive("E(3,8)+3")).toMatchObject({ kind: "offset", step: 3 });
    expect(parseProgressive("E(3,8)+P(4,0)")).toBeNull();
    expect(parseProgressive("P(3,0)+P(5,0)")).toBeNull();
  });

  it("reads %, and * lengthening", () => {
    expect(parseProgressive("E(3,8)%2")).toMatchObject({ kind: "offset", step: 2 });
    expect(parseProgressive("E(3,8)*3")).toMatchObject({ kind: "lengthen", step: 3 });
  });

  it("returns null for ordinary notation, so callers can fall through", () => {
    for (const p of ["E(3,8)", "0x94:8", "A(2,2,3,2)", "E(3,8);5", "tresillo"]) {
      expect(parseProgressive(p), p).toBeNull();
    }
  });
});

describe("progressive offset — bit-identical to the C++ engine", () => {
  for (const [input, expected] of Object.entries(CPP_OFFSET)) {
    it(`${input} reproduces the engine's rotations`, () => {
      expect(seq(input, expected.split(" ").length)).toBe(expected);
    });
  }

  it("trigger 1 is the BARE BASE — what you typed is what you hear first", () => {
    // Base-first, chosen by Alex 2026-07-30 and applied to every progressive
    // operator in the same commit as the engine. `%N` and `*N` used to apply
    // one step on setup so the base was never heard; `>N` never did. See
    // docs/PROGRESSIVE_PHASE.md.
    const base = parseBase("E(3,8)").steps.join("");
    const s = seq("E(3,8)%2", 5).split(" ");
    expect(s[0]).toBe(base);
    expect(s[1]).not.toBe(base);  // rotation starts on trigger 2
    expect(s[4]).toBe(base);      // 4 * 2 = 8 = a full turn, back to base
    // onset count is invariant under rotation
    for (const p of s) expect(p.split("1").length - 1).toBe(3);
  });

  it("is pure — the same trigger index always gives the same pattern", () => {
    expect(seq("E(5,13)%5", 6)).toBe(seq("E(5,13)%5", 6));
  });
});

describe("progressive lengthening", () => {
  // Seeded from the base pattern since 2026-08-02. Before that it used
  // Math.random, so a given trigger did not name a pattern — Serpe and
  // Workspace both showed "trigger N" as though it did, and the same trigger
  // re-rolled on every recompute.
  it("is REPRODUCIBLE: the same trigger always gives the same pattern", () => {
    const d = parseProgressive("E(3,8)*4");
    const a = progressiveAt(d, 3, { parseBase }).steps;
    const b = progressiveAt(d, 3, { parseBase }).steps;
    expect(a).toEqual(b);
  });

  it("GROWS: each trigger extends the one before rather than re-rolling it", () => {
    // The musical point. With a fresh RNG per call the whole tail was
    // regenerated on every advance, so a lane rewrote its own history each time
    // it got longer and never settled into anything learnable.
    const d = parseProgressive("E(3,8)*4");
    const t2 = progressiveAt(d, 2, { parseBase }).steps;
    const t3 = progressiveAt(d, 3, { parseBase }).steps;
    expect(t3.slice(0, t2.length)).toEqual(t2);
  });

  it("gives DIFFERENT patterns different material", () => {
    // Seeded from the base's own bits, so reproducible does not mean identical
    // across patterns.
    const a = progressiveAt(parseProgressive("E(3,8)*4"), 3, { parseBase }).steps;
    const b = progressiveAt(parseProgressive("E(5,8)*4"), 3, { parseBase }).steps;
    expect(a.length).toBe(b.length);
    expect(a).not.toEqual(b);
  });

  it("still takes an injected RNG, for a caller that wants fresh material", () => {
    const d = parseProgressive("E(3,8)*4");
    const ones = progressiveAt(d, 3, { parseBase, random: () => 0.99 }).steps;
    const zeros = progressiveAt(d, 3, { parseBase, random: () => 0.01 }).steps;
    expect(ones).not.toEqual(zeros);
  });

  it("grows by `step` steps per trigger, keeping the base as a prefix", () => {
    const random = () => 0.5;                       // pinned only for the test
    const d = parseProgressive("E(3,8)*4");
    const a = progressiveAt(d, 1, { parseBase, random }).steps;
    const b = progressiveAt(d, 3, { parseBase, random }).steps;
    // Trigger 1 is the bare base: a lane entering `E(3,8)*4` plays 8 steps,
    // then 12, then 16. It used to play 12 immediately and never 8 — changed
    // 2026-07-30 with the engine (serpe_poly_precedence prints 8,11,14,17 for
    // the *3 case).
    expect(a.length).toBe(8);
    expect(b.length).toBe(8 + 4 + 4);
    expect(b.slice(0, 8)).toEqual(a);
  });
});

describe("ProgressiveRun", () => {
  it("advances one trigger at a time and resets", () => {
    // `>N` transforms are unaffected by the offset/lengthening phase change:
    // their sequences were already pinned to the engine's own output.
    const run = new ProgressiveRun("E(1,8)>8", { parseBase });
    expect(run.next().steps.join("")).toBe("10000000");
    expect(run.next().steps.join("")).toBe("10000001");
    run.reset();
    expect(run.next().steps.join("")).toBe("10000000");
  });

  it("refuses non-progressive notation rather than silently doing nothing", () => {
    expect(() => new ProgressiveRun("E(3,8)", { parseBase })).toThrow(/not progressive/);
  });
});
