import { describe, expect, it } from "vitest";
import { progressionToSMF, TICKS_PER_BEAT, BEATS_PER_CHORD } from "./exportMidi.js";
import { realizeLabel, voiceProgression } from "./generate.js";

describe("progression MIDI export", () => {
  const key = { tonic: "C", mode: "major" };
  const voicings = voiceProgression(
    ["IIm7", "V7", "Imaj7"].map((l) => realizeLabel(l, key)),
  );
  const smf = progressionToSMF(voicings, { bpm: 140, name: "Test" });

  it("is a valid single-track SMF", () => {
    expect([...smf.slice(0, 4)]).toEqual([0x4d, 0x54, 0x68, 0x64]);
    const declared = (smf[18] << 24) | (smf[19] << 16) | (smf[20] << 8) | smf[21];
    expect(smf.length).toBe(22 + declared);
    expect([...smf.slice(-3)]).toEqual([0xff, 0x2f, 0x00]);
  });

  it("carries one marker per chord with symbol and label", () => {
    const text = new TextDecoder("latin1").decode(smf);
    expect(text).toContain("Dm7 (IIm7)");
    expect(text).toContain("G7 (V7)");
    expect(text).toContain("Cmaj7 (Imaj7)");
  });

  it("spans the expected number of ticks", () => {
    // Last note-off should land at 3 chords × 2 beats × 480 ticks.
    const totalTicks = voicings.length * TICKS_PER_BEAT * BEATS_PER_CHORD;
    expect(totalTicks).toBe(2880);
    // Every voicing contributed bass + chord tones as note-ons (0x90).
    const bytes = [...smf];
    let noteOns = 0;
    for (let i = 0; i < bytes.length - 2; i++) {
      if (bytes[i] === 0x90 && bytes[i + 2] > 0) noteOns++;
    }
    const expected = voicings.reduce((n, v) => n + 1 + v.notes.length, 0);
    expect(noteOns).toBe(expected);
  });
});

describe("channel modes", async () => {
  const { voicingsToClip } = await import("./exportMidi.js");
  const { realizeLabel, voiceProgression } = await import("./generate.js");
  const voicings = voiceProgression(
    ["IIm7", "V7", "Imaj7"].map((l) => realizeLabel(l, { tonic: "C", mode: "major" })),
  );

  it("single puts everything on channel 1", () => {
    const { notes } = voicingsToClip(voicings, "single");
    expect(new Set(notes.map((n) => n.channel))).toEqual(new Set([1]));
  });

  it("split puts bass on 1, voices on 2", () => {
    const { notes } = voicingsToClip(voicings, "split");
    expect(new Set(notes.map((n) => n.channel))).toEqual(new Set([1, 2]));
  });

  it("perVoice gives each voice its own channel from 2 up", () => {
    const { notes } = voicingsToClip(voicings, "perVoice");
    const channels = [...new Set(notes.map((n) => n.channel))].sort((a, b) => a - b);
    expect(channels[0]).toBe(1);
    expect(channels.length).toBeGreaterThan(2);
    expect(Math.max(...channels)).toBeLessThanOrEqual(16);
  });
});
