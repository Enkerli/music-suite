import { describe, it, expect } from "vitest";
import { VoiceSplitter, splitChannel } from "./index.js";

describe("VoiceSplitter", () => {
  it("round-robins across the span, wrapping back to the base channel", () => {
    const s = new VoiceSplitter();
    expect(s.next(3, 3)).toBe(3);
    expect(s.next(3, 3)).toBe(4);
    expect(s.next(3, 3)).toBe(5);
    expect(s.next(3, 3)).toBe(3); // wraps
  });

  it("clamps the result to MIDI channels 1..16", () => {
    const s = new VoiceSplitter();
    expect(s.next(15, 4)).toBe(15);
    expect(s.next(15, 4)).toBe(16);
    expect(s.next(15, 4)).toBe(16); // base+2=17, clamped
    expect(s.next(15, 4)).toBe(16); // base+3=18, clamped
    const s2 = new VoiceSplitter();
    expect(s2.next(0, 1)).toBe(1); // base below range clamps up
  });

  it("span=1 always returns the base channel (degenerate case, not an error)", () => {
    const s = new VoiceSplitter();
    expect(s.next(7, 1)).toBe(7);
    expect(s.next(7, 1)).toBe(7);
    expect(s.next(7, 1)).toBe(7);
  });

  it("reset() restarts the rotation from the first channel", () => {
    const s = new VoiceSplitter();
    s.next(1, 3); s.next(1, 3); // index now at 2
    s.reset();
    expect(s.next(1, 3)).toBe(1);
  });

  it("treats a fractional/zero span as at-least-1 (matches PitchFold's Math.max(1, splitVoices))", () => {
    const s = new VoiceSplitter();
    expect(s.next(5, 0)).toBe(5);
    expect(s.next(5, 0)).toBe(5);
    const s2 = new VoiceSplitter();
    expect(s2.next(5, 2.9)).toBe(5); // floors to 2
    expect(s2.next(5, 2.9)).toBe(6);
    expect(s2.next(5, 2.9)).toBe(5);
  });
});

describe("splitChannel — stateless equivalent", () => {
  it("agrees with an equivalently-advanced VoiceSplitter at every step", () => {
    const s = new VoiceSplitter();
    for (let i = 0; i < 10; i++) {
      expect(splitChannel(4, 3, i)).toBe(s.next(4, 3));
    }
  });

  it("clamps and floors the same way the stateful form does", () => {
    expect(splitChannel(15, 4, 2)).toBe(16); // 15+2=17, clamped
    expect(splitChannel(0, 1, 5)).toBe(1);
  });

  it("a negative priorCount still resolves to a valid in-rotation channel", () => {
    expect(splitChannel(1, 4, -1)).toBe(4); // -1 mod 4 == 3 (last slot)
  });
});
