import { describe, it, expect } from "vitest";
import { chordMessage } from "./control.js";
import { validateMessage } from "@enkerli/protocol";

describe("chordMessage (Chord Dictionary → the bus, use case U3)", () => {
  it("builds a valid chord message: pcs mask + root + symbol", () => {
    const m = chordMessage({ pcs: [0, 4, 7], root: 0, symbol: "C" }); // C major triad
    expect(validateMessage(m).ok).toBe(true);
    expect(m.type).toBe("chord");
    expect(m.from).toBe("chord-dictionary");
    expect(m.body.pcs).toBe((1 << 0) | (1 << 4) | (1 << 7)); // 145, leftmost = LSB
    expect(m.body.root).toBe(0);
    expect(m.body.symbol).toBe("C");
  });
  it("a chord message needs at least pcs/notes/symbol — pcs suffices", () => {
    expect(validateMessage(chordMessage({ pcs: [2, 5, 9], root: 2 })).ok).toBe(true);
  });
});
