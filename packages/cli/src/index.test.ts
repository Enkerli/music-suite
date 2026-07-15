import { describe, it, expect } from "vitest";
import {
  chordInfo, patternInfo, smfFromBars, progressionFromSmfBytes,
  renderVane, encodeWav16, defaultWasmPath,
  sendMessage, toNdjson, parseNdjson, summarizeMessage, describeManifest,
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

// ── control & interop plane over stdio (docs/CONTROL_PLANE.md) ────────────────

describe("sendMessage / NDJSON transport", () => {
  it("builds a validated param-set message with CLI defaults", () => {
    const m = sendMessage({ to: "serpe", param: { id: "density", value: 0.7 } });
    expect(m.from).toBe("external");   // CLI-originated default sender
    expect(m.to).toBe("serpe");
    expect(m.type).toBe("param");
    expect(m.body).toMatchObject({ mode: "set", id: "density", value: 0.7 });
  });
  it("builds a batch param message from multiple pairs", () => {
    const m = sendMessage({ from: "serpe", mode: "report", params: [{ id: "density", value: 0.7 }, { id: "steps", value: 16 }] });
    expect(m.type).toBe("param");
    expect((m.body as { params: unknown[] }).params).toHaveLength(2);
    expect((m.body as { mode: string }).mode).toBe("report");
  });
  it("builds a command with named args", () => {
    const m = sendMessage({ to: "serpe", command: { name: "mutate", args: { amount: 0.3 } } });
    expect(m.type).toBe("command");
    expect(m.body).toMatchObject({ name: "mutate", args: { amount: 0.3 } });
  });
  it("refuses a param and a command at once", () => {
    expect(() => sendMessage({ to: "serpe", param: { id: "x", value: 1 }, command: { name: "y" } })).toThrow(/not both/);
  });
  it("refuses an empty send", () => {
    expect(() => sendMessage({ to: "serpe" })).toThrow(/required/);
  });
  it("refuses an unknown target app (validation)", () => {
    expect(() => sendMessage({ to: "daw" as never, param: { id: "x", value: 1 } })).toThrow(/invalid message/);
  });
  it("round-trips through NDJSON (the pipe transport)", () => {
    const m = sendMessage({ to: "serpe", command: { name: "next-pattern" } });
    const line = toNdjson(m);
    expect(line.endsWith("\n")).toBe(true);
    const back = parseNdjson(line);
    expect(back).toEqual(m);
  });
  it("parseNdjson rejects blank, foreign, and malformed lines", () => {
    expect(parseNdjson("")).toBeNull();
    expect(parseNdjson("not json")).toBeNull();
    expect(parseNdjson(JSON.stringify({ hello: "world" }))).toBeNull();
  });
  it("summarizes each message type on one line", () => {
    expect(summarizeMessage(sendMessage({ to: "serpe", param: { id: "density", value: 0.7 } }))).toContain("density=0.7");
    expect(summarizeMessage(sendMessage({ to: "serpe", command: { name: "mutate", args: { amount: 0.3 } } }))).toContain("mutate");
  });
});

describe("describeManifest", () => {
  const manifest = {
    app: "serpe", v: 1,
    params: [{ id: "density", label: "Density", unit: "ratio", min: 0, max: 1, default: 0.5, step: 0.01 }],
    commands: [{ name: "mutate", label: "Mutate", args: [{ id: "amount", unit: "ratio", min: 0, max: 1, default: 0.2 }] }],
  };
  it("validates and renders a manifest surface", () => {
    const { lines } = describeManifest(manifest);
    expect(lines[0]).toContain("serpe manifest v1");
    expect(lines.join("\n")).toContain("density");
    expect(lines.join("\n")).toContain("mutate");
  });
  it("throws on an invalid manifest (unknown unit)", () => {
    const bad = { ...manifest, params: [{ ...manifest.params[0], unit: "furlong" }] };
    expect(() => describeManifest(bad)).toThrow(/invalid manifest/);
  });
});

// ── Vane pilot manifest (docs/CONTROL_PLANE.md §6.4) ──────────────────────────

import { readFileSync } from "node:fs";
import { bundledManifestPath, MANIFEST_APPS } from "./index.js";

describe("Vane manifest (the pilot)", () => {
  it("ships a bundled manifest resolvable by app id", () => {
    expect(MANIFEST_APPS.vane).toBeDefined();
    expect(bundledManifestPath("vane")).toMatch(/apps\/vane\/manifest\.json$/);
    expect(bundledManifestPath("no-such-app")).toBeNull();
  });
  it("the committed manifest validates and exposes Vane's continuous surface", () => {
    const body = JSON.parse(readFileSync(bundledManifestPath("vane")!, "utf8"));
    const { manifest, lines } = describeManifest(body);   // throws if invalid
    expect(manifest.app).toBe("vane");
    expect(manifest.params.length).toBeGreaterThanOrEqual(36);
    // the log-scaled cutoff the pilot surfaced
    const cutoff = manifest.params.find((p) => p.id === "filter-cutoff")!;
    expect(cutoff.unit).toBe("hz");
    expect(cutoff.scale).toBe("log");
    expect(cutoff.min).toBeGreaterThan(0); // log scale requires min > 0
    expect(lines[0]).toContain("vane manifest v1");
  });
  it("every manifest param carries an in-range default and a stable kebab id", () => {
    const body = JSON.parse(readFileSync(bundledManifestPath("vane")!, "utf8")) as { params: Array<{ id: string; min: number; max: number; default: number }> };
    for (const p of body.params) {
      expect(p.id).toMatch(/^[a-z0-9-]+$/);
      expect(p.default).toBeGreaterThanOrEqual(p.min);
      expect(p.default).toBeLessThanOrEqual(p.max);
    }
  });
});

// ── control plane → sound: --stream param resolution (CONTROL_PLANE.md §5) ────

import { paramsFromStream, vaneParamIdMap } from "./index.js";

describe("paramsFromStream (message → renderVane params)", () => {
  const map = { "filter-cutoff": 1, "morph": 12 };
  const line = (over: object) => toNdjson(sendMessage({ to: "vane", param: over as never }));
  it("resolves manifest ids to wasm ids, last-write-wins", () => {
    const stream = line({ id: "morph", value: 0.2 }) + line({ id: "morph", value: 0.9 }) + line({ id: "filter-cutoff", value: 800 });
    const r = paramsFromStream(stream, map);
    expect(r.params).toEqual({ 12: 0.9, 1: 800 });   // last morph wins
    expect(r.messages).toBe(3);
    expect(r.unresolved).toEqual([]);
  });
  it("handles the batch param form", () => {
    const stream = toNdjson(sendMessage({ from: "vane", params: [{ id: "morph", value: 0.5 }, { id: "filter-cutoff", value: 500 }] } as never));
    const r = paramsFromStream(stream, map);
    expect(r.params).toEqual({ 12: 0.5, 1: 500 });
  });
  it("surfaces unresolved ids instead of dropping them", () => {
    const r = paramsFromStream(line({ id: "nonesuch", value: 1 }), map);
    expect(r.unresolved).toEqual(["nonesuch"]);
    expect(r.params).toEqual({});
  });
  it("ignores non-param lines and messages for other apps", () => {
    const forSerpe = toNdjson(sendMessage({ to: "serpe", param: { id: "density", value: 0.9 } }));
    const cmd = toNdjson(sendMessage({ to: "vane", command: { name: "panic" } }));
    const r = paramsFromStream(forSerpe + cmd + line({ id: "morph", value: 0.3 }), map);
    expect(r.params).toEqual({ 12: 0.3 });
    expect(r.ignored).toBe(2);
    expect(r.messages).toBe(1);
  });
  it("accepts broadcast (to: '*') param messages", () => {
    const r = paramsFromStream(toNdjson(sendMessage({ from: "vane", to: "*", param: { id: "morph", value: 0.4 } })), map);
    expect(r.params).toEqual({ 12: 0.4 });
  });
});

describe("vaneParamIdMap", () => {
  it("maps Vane manifest ids to their wasm ids", () => {
    const map = vaneParamIdMap();
    expect(map["filter-cutoff"]).toBe(1);   // index.html PARAM_MAP Cutoff:1
    expect(map["morph"]).toBe(12);          // Morph:12
    expect(map["output"]).toBe(8);          // Output:8
  });
});
