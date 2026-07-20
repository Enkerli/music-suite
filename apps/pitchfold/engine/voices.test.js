import { describe, it, expect } from "vitest";
import { VoiceProcessor, VoiceMode } from "./voices.js";

const IONIAN = 0x0AB5;
const cfg = (over = {}) => ({
  mode: VoiceMode.Through, chordMask: IONIAN, chordRoot: 0,
  splitVoices: 2, splitChannel: 1, loNote: 0, hiNote: 127, ...over,
});

describe("VoiceProcessor — Through", () => {
  it("passes the note straight through on its own channel", () => {
    const v = new VoiceProcessor();
    expect(v.processNoteOn(60, 5, cfg())).toEqual([{ note: 60, channel: 5 }]);
  });
});

describe("VoiceProcessor — MonoMerge", () => {
  it("current behavior: identical to Through (docs/PITCHFOLD_AUDIT.md — this mode is a documented no-op, not yet real)", () => {
    const v = new VoiceProcessor();
    const through = v.processNoteOn(60, 3, cfg({ mode: VoiceMode.Through }));
    const mono = v.processNoteOn(60, 3, cfg({ mode: VoiceMode.MonoMerge, monoSelect: 2 }));
    expect(mono).toEqual(through);
  });
});

describe("VoiceProcessor — PolySpread", () => {
  it("builds a chord from the active PCS on channel 1", () => {
    const v = new VoiceProcessor();
    const out = v.processNoteOn(60, 4, cfg({ mode: VoiceMode.PolySpread }));
    expect(out).toEqual([
      { note: 60, channel: 1 }, { note: 62, channel: 1 },
      { note: 64, channel: 1 }, { note: 65, channel: 1 },
      { note: 67, channel: 1 }, { note: 69, channel: 1 },
      { note: 71, channel: 1 }, { note: 72, channel: 1 },
    ]);
  });
});

describe("VoiceProcessor — Chordize", () => {
  it("harmonizes with stacked intervals from the mask", () => {
    const v = new VoiceProcessor();
    const mask = (1 << 0) | (1 << 4) | (1 << 7); // unison, maj3, perf5
    const out = v.processNoteOn(60, 2, cfg({ mode: VoiceMode.Chordize, chordMask: mask }));
    expect(out).toEqual([{ note: 60, channel: 1 }, { note: 64, channel: 1 }, { note: 67, channel: 1 }]);
  });
});

describe("VoiceProcessor — VoiceSplit (promoted to @enkerli/voice-routing)", () => {
  it("round-robins across splitChannel..splitChannel+splitVoices-1", () => {
    const v = new VoiceProcessor();
    const c = cfg({ mode: VoiceMode.VoiceSplit, splitChannel: 3, splitVoices: 3 });
    expect(v.processNoteOn(60, 1, c)).toEqual([{ note: 60, channel: 3 }]);
    expect(v.processNoteOn(61, 1, c)).toEqual([{ note: 61, channel: 4 }]);
    expect(v.processNoteOn(62, 1, c)).toEqual([{ note: 62, channel: 5 }]);
    expect(v.processNoteOn(63, 1, c)).toEqual([{ note: 63, channel: 3 }]); // wraps
  });
  it("reset() restarts the rotation", () => {
    const v = new VoiceProcessor();
    const c = cfg({ mode: VoiceMode.VoiceSplit, splitChannel: 1, splitVoices: 2 });
    v.processNoteOn(60, 1, c);
    v.reset();
    expect(v.processNoteOn(61, 1, c)).toEqual([{ note: 61, channel: 1 }]);
  });
  it("clamps to MIDI channel 16 (matches the shared VoiceSplitter, matches PitchFold's C++ jlimit)", () => {
    const v = new VoiceProcessor();
    const c = cfg({ mode: VoiceMode.VoiceSplit, splitChannel: 15, splitVoices: 4 });
    expect(v.processNoteOn(60, 1, c)[0].channel).toBe(15);
    expect(v.processNoteOn(61, 1, c)[0].channel).toBe(16);
    expect(v.processNoteOn(62, 1, c)[0].channel).toBe(16); // 17, clamped
  });
});
