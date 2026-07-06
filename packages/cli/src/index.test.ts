import { describe, it, expect } from "vitest";
import {
  chordInfo, patternInfo, smfFromBars, progressionFromSmfBytes,
  renderVane, encodeWav16, defaultWasmPath,
} from "./index.js";
import { existsSync } from "node:fs";

// ── chord ─────────────────────────────────────────────────────────────────────

describe("chordInfo", () => {
  it("identifies a C major triad from MIDI notes", () => {
    const r = chordInfo([60, 64, 67]);
    expect(r.interpretation).toBe("midi-notes"); // 60+ forces the note reading
    expect(r.match?.root).toBe(0);
    expect(r.match?.symbol).toMatch(/^C/);
  });
  it("treats all-small values as pitch classes", () => {
    const r = chordInfo([0, 4, 7]);
    expect(r.interpretation).toBe("pitch-classes");
    expect(r.match?.root).toBe(0);
  });
  it("--notes forces the MIDI reading of small values", () => {
    expect(chordInfo([0, 4, 7], { asNotes: true }).interpretation).toBe("midi-notes");
  });
});

// ── pattern (leftmost = LSB, pinned) ─────────────────────────────────────────

describe("patternInfo", () => {
  it("E(3,8) is the tresillo: onsets {0,3,6}, hex 0x94, d73", () => {
    const p = patternInfo("E(3,8)");
    expect(p.onsets).toEqual([0, 3, 6]);
    expect(p.binary).toBe("10010010");
    expect(p.hex.toLowerCase()).toBe("94");
    expect(p.decimal).toBe(73);
  });
  it("all codec spellings of the tresillo agree", () => {
    for (const spec of ["0x94:8", "94:8", "d73:8", "b10010010", "10010010"]) {
      expect(patternInfo(spec).onsets, spec).toEqual([0, 3, 6]);
    }
  });
  it("euclid rotation shifts the onsets", () => {
    expect(patternInfo("E(3,8,1)").onsets).not.toEqual(patternInfo("E(3,8)").onsets);
  });
  it("rejects an unrecognized spec with guidance", () => {
    expect(() => patternInfo("tresillo")).toThrow(/unrecognized pattern spec/);
  });
});

// ── smf ───────────────────────────────────────────────────────────────────────

describe("smfFromBars", () => {
  it("a ii–V–I round-trips through the embedded Progression", () => {
    const r = smfFromBars("Dm7 G7 | Cmaj7", { bpm: 120 });
    expect(r.chordCount).toBe(3);
    expect(r.bytes[0]).toBe(0x4d); // "M" — MThd
    const back = progressionFromSmfBytes(r.bytes);
    expect(back).not.toBeNull();
    expect(JSON.stringify(back)).toContain("Dm7");
  });
  it("refuses empty notation", () => {
    expect(() => smfFromBars("| |")).toThrow(/no chords/);
  });
});

// ── render (the real Vane DSP) ────────────────────────────────────────────────

describe("renderVane", () => {
  it("finds the committed wasm artifact", () => {
    expect(existsSync(defaultWasmPath())).toBe(true);
  });

  it("renders audible audio with breath, near-silence without", async () => {
    const loud = await renderVane({ notes: [60, 64], seconds: 0.4, breath: 0.9 });
    const quiet = await renderVane({ notes: [60, 64], seconds: 0.4, breath: 0.0 });
    expect(loud.peak).toBeGreaterThan(0.05);   // Vane's envelope IS breath
    expect(quiet.peak).toBeLessThan(0.01);
    expect(loud.samples.length / loud.sampleRate).toBeGreaterThan(0.5); // hold + tail
  }, 20000);

  it("engine params reach the voice (Morph changes the spectrum)", async () => {
    const sine = await renderVane({ notes: [69], seconds: 0.5, params: { 12: 0.0, 1: 18000 } });
    const rich = await renderVane({ notes: [69], seconds: 0.5, params: { 12: 1.0, 1: 18000 } });
    // Goertzel-style: 2nd-harmonic vs fundamental energy (the vane regression
    // suite's proven morph metric) over the settled middle of the render.
    const h2h1 = (r: { samples: Float32Array; sampleRate: number }) => {
      const f0 = 440;
      const s = r.samples.subarray(Math.floor(r.samples.length * 0.3),
                                   Math.floor(r.samples.length * 0.7));
      const energy = (hz: number) => {
        let re = 0, im = 0;
        for (let i = 0; i < s.length; i++) {
          const w = (2 * Math.PI * hz * i) / r.sampleRate;
          re += s[i]! * Math.cos(w); im += s[i]! * Math.sin(w);
        }
        return re * re + im * im;
      };
      return energy(2 * f0) / energy(f0);
    };
    expect(h2h1(rich)).toBeGreaterThan(h2h1(sine) * 5);
  }, 20000);
});

// ── wav ───────────────────────────────────────────────────────────────────────

describe("encodeWav16", () => {
  it("writes a well-formed 16-bit mono header and clamps samples", () => {
    const wav = encodeWav16(Float32Array.from([0, 0.5, -0.5, 2.0]), 48000);
    const text = (o: number, n: number) => String.fromCharCode(...wav.slice(o, o + n));
    expect(text(0, 4)).toBe("RIFF");
    expect(text(8, 4)).toBe("WAVE");
    expect(text(36, 4)).toBe("data");
    const view = new DataView(wav.buffer);
    expect(view.getUint16(22, true)).toBe(1);       // mono
    expect(view.getUint32(24, true)).toBe(48000);   // sample rate
    expect(view.getInt16(44 + 6, true)).toBe(32767); // 2.0 clamped to full scale
    expect(wav.length).toBe(44 + 4 * 2);
  });
});
