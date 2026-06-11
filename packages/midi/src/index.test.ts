import { describe, expect, it } from "vitest";
import {
  createMIDIHeader,
  createSMF,
  encodeTextMeta,
  encodeVariableLength,
} from "./index.js";

describe("variable-length quantities (SMF spec)", () => {
  it("encodes spec reference values", () => {
    expect(encodeVariableLength(0)).toEqual([0x00]);
    expect(encodeVariableLength(0x40)).toEqual([0x40]);
    expect(encodeVariableLength(0x7f)).toEqual([0x7f]);
    expect(encodeVariableLength(0x80)).toEqual([0x81, 0x00]);
    expect(encodeVariableLength(0x2000)).toEqual([0xc0, 0x00]);
    expect(encodeVariableLength(0x3fff)).toEqual([0xff, 0x7f]);
    expect(encodeVariableLength(0x4000)).toEqual([0x81, 0x80, 0x00]);
  });
});

describe("meta events", () => {
  it("encodes UTF-8 text with length", () => {
    const bytes = encodeTextMeta(0x06, "Dm7");
    expect(bytes.slice(0, 3)).toEqual([0xff, 0x06, 3]);
    expect(String.fromCharCode(...bytes.slice(3))).toBe("Dm7");
  });
});

describe("createSMF", () => {
  const smf = createSMF(
    [
      { pitch: 60, startTick: 0, durationTicks: 480 },
      { pitch: 64, startTick: 0, durationTicks: 480 },
      { pitch: 62, startTick: 480, durationTicks: 480, velocity: 80, channel: 1 },
    ],
    { bpm: 120, ticksPerBeat: 480, trackName: "Test", markers: [{ tick: 0, text: "Cmaj" }] },
  );

  it("has valid MThd and MTrk chunks", () => {
    expect([...smf.slice(0, 4)]).toEqual([0x4d, 0x54, 0x68, 0x64]); // MThd
    expect(smf[9]).toBe(0); // format 0
    expect((smf[12]! << 8) | smf[13]!).toBe(480); // ticks per beat
    expect([...smf.slice(14, 18)]).toEqual([0x4d, 0x54, 0x72, 0x6b]); // MTrk
    const declared = (smf[18]! << 24) | (smf[19]! << 16) | (smf[20]! << 8) | smf[21]!;
    expect(smf.length).toBe(22 + declared);
  });

  it("contains tempo, name, marker, notes, and end-of-track", () => {
    const bytes = [...smf];
    const find = (pattern: number[]) =>
      bytes.some((_, i) => pattern.every((p, j) => bytes[i + j] === p));
    expect(find([0xff, 0x51, 0x03, 0x07, 0xa1, 0x20])).toBe(true); // 120 bpm
    expect(find([0xff, 0x03])).toBe(true); // track name
    expect(find([0xff, 0x06])).toBe(true); // marker
    expect(find([0x90, 60, 96])).toBe(true); // note on ch0
    expect(find([0x91, 62, 80])).toBe(true); // note on ch1
    expect(find([0x80, 60, 0])).toBe(true); // note off
    expect(bytes.slice(-3)).toEqual([0xff, 0x2f, 0x00]); // EOT
  });

  it("note-offs precede note-ons at the same tick", () => {
    const seq = createSMF([
      { pitch: 60, startTick: 0, durationTicks: 480 },
      { pitch: 62, startTick: 480, durationTicks: 480 },
    ]);
    const bytes = [...seq];
    const offIdx = bytes.findIndex((_, i) => bytes[i] === 0x80 && bytes[i + 1] === 60);
    const onIdx = bytes.findIndex((_, i) => bytes[i] === 0x90 && bytes[i + 1] === 62);
    expect(offIdx).toBeLessThan(onIdx);
  });
});
