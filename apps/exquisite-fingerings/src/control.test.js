import { describe, it, expect } from "vitest";
import { scaleMessageFromPcs } from "./control.js";
import { validateMessage } from "@enkerli/protocol";

describe("scaleMessageFromPcs (fingering → the bus, use case U2)", () => {
  it("builds a valid scale message with a leftmost=LSB mask", () => {
    const m = scaleMessageFromPcs(new Set([0, 2, 4, 5, 7, 9, 11]), "7-note fingering"); // C major
    expect(validateMessage(m).ok).toBe(true);
    expect(m.type).toBe("scale");
    expect(m.from).toBe("exquisite-fingerings");
    expect(m.body.mask).toBe(2741);
  });
  it("normalizes pitch classes into 0..11 (a fingering may carry raw notes)", () => {
    const m = scaleMessageFromPcs([60, 64, 67]); // C E G as MIDI → pc 0,4,7
    expect(m.body.mask).toBe((1 << 0) | (1 << 4) | (1 << 7)); // 145
  });
});
