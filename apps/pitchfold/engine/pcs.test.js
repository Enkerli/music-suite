import { describe, it, expect } from "vitest";
import { pcActive, pitchInScale, quantize, buildChord, harmonize } from "./pcs.js";

const IONIAN = 0x0AB5; // C major: 0 2 4 5 7 9 11

describe("pcActive / pitchInScale", () => {
  it("reads bit i for pitch class i (leftmost = LSB)", () => {
    expect(pcActive(IONIAN, 0)).toBe(1); // C
    expect(pcActive(IONIAN, 1)).toBe(0); // C#
    expect(pcActive(IONIAN, 4)).toBe(1); // E
  });
  it("is root-relative, wrapping octaves", () => {
    expect(pitchInScale(60, IONIAN, 0)).toBe(true);  // C4, root C
    expect(pitchInScale(72, IONIAN, 0)).toBe(true);  // C5, still root-relative
    expect(pitchInScale(61, IONIAN, 0)).toBe(false); // C#4 not in major
    expect(pitchInScale(64, IONIAN, 2)).toBe(true);  // E4 with root D == interval 2 (D major 2nd)
  });
});

describe("quantize", () => {
  it("passes through unquantized when mask is empty or chromatic", () => {
    expect(quantize(61, 0, 0, "nearest", 0, 127)).toBe(61);
    expect(quantize(61, 0x0FFF, 0, "nearest", 0, 127)).toBe(61);
  });
  it("snaps to the nearest in-scale note", () => {
    expect(quantize(61, IONIAN, 0, "nearest", 0, 127)).toBe(60); // C# -> C (1 semitone) beats D (2)
  });
  it("respects direction: up always snaps upward, down always downward", () => {
    expect(quantize(61, IONIAN, 0, "up", 0, 127)).toBe(62);   // C# -> D
    expect(quantize(61, IONIAN, 0, "down", 0, 127)).toBe(60); // C# -> C
  });
  it("clamps candidates to [loNote, hiNote]", () => {
    // Only C (60) and D (62) are nearby; excluding D forces C even though
    // "nearest" would otherwise prefer neither over an out-of-range note.
    expect(quantize(61, IONIAN, 0, "nearest", 0, 61)).toBe(60);
  });
  it("returns the original note when nothing fits in range", () => {
    expect(quantize(61, IONIAN, 0, "nearest", 61, 61)).toBe(61); // no in-scale note in [61,61]
  });
  it("strength blends toward the snapped note instead of jumping fully (rounded)", () => {
    // 61 -> nearest is 60 (C); strength 0.25 blends most of the way back to
    // 61 itself (60.75, rounds to 61) — distinguishable from strength 1 (60).
    expect(quantize(61, IONIAN, 0, "nearest", 0, 127, 0.25)).toBe(61);
    expect(quantize(61, IONIAN, 0, "nearest", 0, 127, 1)).toBe(60);
  });
  it("strength <= 0 is a full pass-through", () => {
    expect(quantize(61, IONIAN, 0, "nearest", 0, 127, 0)).toBe(61);
  });
});

describe("buildChord (PolySpread)", () => {
  it("stacks scale tones above the root within range", () => {
    const out = buildChord(60, IONIAN, 0, 4, 0, 127);
    expect(out).toEqual([60, 62, 64, 65]); // C D E F (first 4 scale tones from C)
  });
  it("respects the output range", () => {
    const out = buildChord(60, IONIAN, 0, 8, 0, 64);
    expect(out.every((n) => n <= 64)).toBe(true);
  });
  it("caps at maxVoices", () => {
    expect(buildChord(60, IONIAN, 0, 2, 0, 127).length).toBe(2);
  });
  it("empty mask or non-positive maxVoices yields nothing", () => {
    expect(buildChord(60, 0, 0, 4, 0, 127)).toEqual([]);
    expect(buildChord(60, IONIAN, 0, 0, 0, 127)).toEqual([]);
  });
});

describe("harmonize (Chordize)", () => {
  it("adds notes at each active interval above midiNote", () => {
    // mask bit 0 (unison) + bit 4 (major 3rd) + bit 7 (perfect 5th)
    const mask = (1 << 0) | (1 << 4) | (1 << 7);
    expect(harmonize(60, mask, 8, 0, 127)).toEqual([60, 64, 67]);
  });
  it("respects range and maxVoices", () => {
    const mask = 0x0FFF; // every interval
    expect(harmonize(60, mask, 3, 0, 127).length).toBe(3);
    expect(harmonize(120, mask, 12, 0, 127).every((n) => n <= 127)).toBe(true);
  });
});
