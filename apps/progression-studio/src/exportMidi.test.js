import { describe, expect, it } from "vitest";
import { progressionFromSMF } from "@enkerli/midi";
import { exportProgression, progressionToSMF, progressionFromVoicings, voicingsToClip, TICKS_PER_BEAT, BEATS_PER_CHORD } from "./exportMidi.js";
import { realizeLabel, voiceProgression } from "@enkerli/proggen";

describe("voicingsToClip honors per-chord duration (harmonic rhythm)", () => {
  it("lays chords out by their dur, cumulative", () => {
    const voicings = [
      { bass: 36, notes: [60, 64, 67], dur: 2 },
      { bass: 38, notes: [62, 65, 69], dur: 4 },
      { bass: 43, notes: [55, 59, 62], dur: 2 },
    ];
    const { notes, lengthBeats } = voicingsToClip(voicings, "single");
    expect(lengthBeats).toBe(8); // 2 + 4 + 2
    expect([...new Set(notes.map((n) => n.startBeat))].sort((a, b) => a - b)).toEqual([0, 2, 6]);
    expect(notes.find((n) => n.startBeat === 2).lengthBeats).toBe(4); // the 1-bar chord
  });

  it("defaults to a ½-bar chord when dur is absent (back-compat)", () => {
    const { lengthBeats } = voicingsToClip([{ bass: 36, notes: [60] }, { bass: 38, notes: [62] }]);
    expect(lengthBeats).toBe(2 * BEATS_PER_CHORD);
  });
});

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

describe("embedded canonical progression (the suite interchange)", () => {
  const key = { tonic: "F♯", mode: "major" };
  const labels = ["IIm7", "V7", "Imaj7"];
  const voicings = voiceProgression(labels.map((l) => realizeLabel(l, key)));

  it("builds a degree-based Progression from the voicings' labels", () => {
    const prog = progressionFromVoicings(voicings, key);
    expect(prog.key).toEqual(key);
    expect(prog.sections[0].bars.map((b) => b.chords[0])).toMatchObject([
      { source: "degree", degree: { numeral: "II", suffix: "m7" } },
      { source: "degree", degree: { numeral: "V", suffix: "7" } },
      { source: "degree", degree: { numeral: "I", suffix: "maj7" } },
    ]);
  });

  it("embeds it in the exported SMF and recovers it losslessly", () => {
    const smf = progressionToSMF(voicings, { bpm: 120, name: "X", key });
    const back = progressionFromSMF(smf);
    expect(back.key).toEqual(key);
    expect(back.sections[0].bars).toHaveLength(3);
    expect(back.sections[0].bars[2].chords[0].degree).toEqual({ numeral: "I", suffix: "maj7" });
  });

  it("omits the payload when no key is given (back-compat)", () => {
    const smf = progressionToSMF(voicings, { bpm: 120, name: "X" });
    expect(progressionFromSMF(smf)).toBeNull();
  });
});

describe("Send to MIDIcurator vs Export MIDI file (Step 06 — name the destination)", () => {
  const key = { tonic: "C", mode: "major" };
  const voicings = voiceProgression(["IIm7", "V7", "Imaj7"].map((l) => realizeLabel(l, key)));
  const run = (opts) => {
    let captured = null;
    const bridge = { saveFile: (name, bytes) => { captured = { name, bytes }; return true; } };
    exportProgression(bridge, voicings, { bpm: 120, tonic: "C", mode: "major", seed: 7, channelMode: "single", ...opts });
    return captured;
  };

  it("routes both through the native bridge save path", () => {
    expect(run({}).name).toMatch(/\.mid$/);
  });

  it("names the MIDIcurator destination and uses the document title", () => {
    const a = run({ title: "Blue Bossa", destination: "midicurator" });
    expect(a.name).toContain("to-midicurator");
    expect(a.name).toContain("Blue Bossa");
  });

  it("writes the same leadsheet-bearing bytes regardless of destination", () => {
    const send = run({ title: "Tune", destination: "midicurator" });
    const file = run({ title: "Tune" });
    expect([...send.bytes]).toEqual([...file.bytes]); // destination only names the handoff
    expect(progressionFromSMF(send.bytes)).not.toBeNull(); // and it carries the Progression
  });
});

describe("channel modes", async () => {
  const { voicingsToClip } = await import("./exportMidi.js");
  const { realizeLabel, voiceProgression } = await import("@enkerli/proggen");
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
