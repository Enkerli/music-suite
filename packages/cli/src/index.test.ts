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
  it("refuses more than one kind at once (param + command)", () => {
    expect(() => sendMessage({ to: "serpe", param: { id: "x", value: 1 }, command: { name: "y" } })).toThrow(/one of/);
  });
  it("builds a note message that plays a chord on Vane", () => {
    const m = sendMessage({ to: "vane", note: { notes: [60, 64, 67], velocity: 100, durationMs: 500 } });
    expect(m.type).toBe("note");
    expect(m.to).toBe("vane");
    expect(m.body).toMatchObject({ notes: [60, 64, 67], velocity: 100, durationMs: 500 });
  });
  it("refuses a note alongside a param", () => {
    expect(() => sendMessage({ to: "vane", note: { notes: [60] }, param: { id: "x", value: 1 } })).toThrow(/one of/);
  });
  it("rejects an out-of-range note (validation)", () => {
    expect(() => sendMessage({ to: "vane", note: { notes: [200] } })).toThrow(/invalid message/);
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
    expect(summarizeMessage(sendMessage({ to: "vane", note: { notes: [60, 64, 67], velocity: 100, durationMs: 500 } }))).toContain("note");
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

// ── upi verb (the promoted @enkerli/upi engine) ──────────────────────────────

import { upiInfo } from "./index.js";

describe("upiInfo (full Serpe UPI language, headless)", () => {
  it("parses Euclidean E(3,8) to the tresillo with analysis", () => {
    const r = upiInfo("E(3,8)");
    expect(r.ok).toBe(true);
    expect(r.analysis!.binary).toBe("10010010");
    expect(r.analysis!.hex).toBe("0x94");
    expect(r.analysis!.decimal).toBe(73);
    expect(r.analysis!.onsets).toEqual([0, 3, 6]);
  });
  it("handles polygon-LCM combination P(3,0)+P(5,0) → 15 steps", () => {
    const r = upiInfo("P(3,0)+P(5,0)");
    expect(r.ok).toBe(true);
    expect(r.analysis!.n).toBe(15);   // lcm(3,5)
  });
  it("carries an {accent} layer", () => {
    const r = upiInfo("{100}E(3,8)");
    expect(r.accents.some((x) => x)).toBe(true);
  });
  it("respects the --steps context for bare specs", () => {
    expect(upiInfo("E(5,8);16", 16).analysis!.n).toBe(16);
  });
});

describe("Serpe manifest", () => {
  it("resolves by app id and validates", () => {
    expect(bundledManifestPath("serpe")).toMatch(/apps\/serpe\/manifest\.json$/);
    const body = JSON.parse(readFileSync(bundledManifestPath("serpe")!, "utf8"));
    const { manifest } = describeManifest(body);   // throws if invalid
    expect(manifest.app).toBe("serpe");
    expect(manifest.params.map((p) => p.id)).toContain("steps");
    expect(manifest.commands.map((c) => c.name)).toContain("rotate");
  });
});

// ── bind: the binding layer, headless (docs/CONTROL_PLANE.md §4) ──────────────

import { resolveEvent, validateControlMap, manifestsForControlMap, loadBundledManifests } from "./index.js";

const stageMap = {
  id: "cm-test", kind: "control-map" as const,
  bindings: [
    { trigger: { kind: "midi-cc" as const, cc: 74, channel: 1 }, action: { app: "vane" as const, param: "filter-cutoff" } },
    { trigger: { kind: "key" as const, combo: "mod+shift+m" }, action: { app: "serpe" as const, command: "mutate", args: { amount: 0.3 } } },
    { trigger: { kind: "midi-note" as const, note: 36, channel: 10 }, action: { app: "serpe" as const, command: "complement" } },
  ],
};

describe("bind (control-map resolution over bundled manifests)", () => {
  it("loads the manifests a map targets", () => {
    const ms = manifestsForControlMap(stageMap);
    expect(ms.map((m) => m.app).sort()).toEqual(["serpe", "vane"]);
    expect(loadBundledManifests(["vane"])).toHaveLength(1);
  });
  it("validates the shipped stage map against the shipped Vane/Serpe manifests", () => {
    const r = validateControlMap(stageMap, manifestsForControlMap(stageMap));
    expect(r).toEqual({ ok: true, errors: [] });
  });
  it("resolves a CC knob to a normalized Vane param (log cutoff → full)", () => {
    const [m] = resolveEvent(stageMap, { kind: "midi-cc", cc: 74, channel: 1, value: 127 }, manifestsForControlMap(stageMap));
    expect(m!.to).toBe("vane");
    expect((m!.body as { id: string; value: number })).toMatchObject({ id: "filter-cutoff", value: 20000 });
  });
  it("resolves a keystroke to a Serpe command", () => {
    const [m] = resolveEvent(stageMap, { kind: "key", combo: "mod+shift+m" }, manifestsForControlMap(stageMap));
    expect(m!.type).toBe("command");
    expect((m!.body as { name: string }).name).toBe("mutate");
  });
});

// ── generate (the promoted @enkerli/proggen engine) ──────────────────────────

import { generateInfo, proggenTablePath } from "./index.js";
import { existsSync as exists2 } from "node:fs";

describe("generateInfo (corpus progression generation, headless)", () => {
  it("ships the bundled transition table", () => {
    expect(exists2(proggenTablePath())).toBe(true);
  });
  it("generates a progression of the requested length, starting on the tonic", () => {
    const r = generateInfo({ mode: "major", length: 8, seed: 42 });
    expect(r.labels).toHaveLength(8);
    expect(r.labels[0]).toBe("Imaj7"); // major start label
    expect(r.bars).toBe(r.labels.join(" | "));
  });
  it("is reproducible by seed and varies with it", () => {
    const a = generateInfo({ mode: "major", length: 8, seed: 42 });
    const b = generateInfo({ mode: "major", length: 8, seed: 42 });
    const c = generateInfo({ mode: "major", length: 8, seed: 43 });
    expect(a.bars).toBe(b.bars);
    expect(a.bars).not.toBe(c.bars);
  });
  it("realizes Roman labels to spelled symbols in a key", () => {
    const r = generateInfo({ mode: "major", length: 6, seed: 7, tonic: "C" });
    expect(r.symbols).toBeDefined();
    expect(r.symbols[0]).toBe("Cmaj7"); // Imaj7 in C
    expect(r.symbols).toHaveLength(r.labels.length);
  });
  it("the circle method walks the circle of fifths", () => {
    const r = generateInfo({ mode: "major", method: "circle", length: 6 });
    expect(r.labels).toHaveLength(6);
  });
  it("generated bars feed smfFromBars (the full headless pipeline)", () => {
    const g = generateInfo({ mode: "major", length: 4, seed: 3 });
    const smf = smfFromBars(g.bars, { tonic: "C", mode: "major" });
    expect(smf.chordCount).toBe(4);
    expect(smf.bytes[0]).toBe(0x4d); // "M" — a real MIDI file
  });
});

// ── accompany (GloriArp slice 1) ─────────────────────────────────────────────

import { accompany, noteNameToMidi, defaultPhrasePath, notesFromPhrase, loopPeriodMs, performPhrase } from "./index.js";
import type { SuiteMessage } from "@enkerli/protocol";
import { readMetaTextEvents } from "@enkerli/midi";

describe("noteNameToMidi", () => {
  it("maps note names with accidentals and octaves (C4 = 60)", () => {
    expect(noteNameToMidi("C4")).toBe(60);
    expect(noteNameToMidi("C2")).toBe(36);
    expect(noteNameToMidi("F#1")).toBe(30);
    expect(noteNameToMidi("Bb3")).toBe(58);
  });
  it("rejects garbage", () => {
    expect(() => noteNameToMidi("H2")).toThrow(/bad note name/);
    expect(() => noteNameToMidi("C")).toThrow(/bad note name/);
  });
});

describe("accompany (bar notation → adapted bass → SMF + trace)", () => {
  it("ships its bundled source phrase", () => {
    expect(existsSync(defaultPhrasePath())).toBe(true);
  });
  it("runs the acceptance pipeline deterministically", () => {
    const run = () => accompany({ progression: "Dm7 | G7 | Cmaj7 | A7", seed: 42 });
    const a = run();
    expect(a.phrase.events).toHaveLength(16);
    expect(a.frames.map((f) => f.chord.symbol)).toEqual(["Dm7", "G7", "Cmaj7", "A7"]);
    expect(Buffer.from(a.smf).equals(Buffer.from(run().smf))).toBe(true); // byte-identical
  });
  it("embeds the GLORIARP:v1 TRACE header and chord markers in the SMF", () => {
    const r = accompany({ progression: "Dm7 | G7", seed: 7 });
    const meta = readMetaTextEvents(r.smf);
    const trace = meta.find((e) => e.text.startsWith("GLORIARP:v1 TRACE "));
    expect(trace).toBeDefined();
    const embedded = JSON.parse(trace!.text.slice("GLORIARP:v1 TRACE ".length));
    expect(embedded.header).toMatchObject({ seed: 7, engine: "@enkerli/accompaniment" });
    expect(meta.filter((e) => e.metaType === 6).map((e) => e.text)).toEqual(["Dm7", "G7"]);
  });
  it("tiles the progression with --bars and splits multi-chord bars into frames", () => {
    const r = accompany({ progression: "Dm7 G7 | Cmaj7", bars: 4, seed: 1 });
    expect(r.frames.map((f) => f.chord.symbol)).toEqual(["Dm7", "G7", "Cmaj7", "Dm7", "G7", "Cmaj7"]);
    expect(r.frames[0]!.end).toBe(960); // half a bar each when two chords share it
  });
  it("honors the range as a hard constraint", () => {
    const r = accompany({ progression: "Dm7 | G7 | Cmaj7 | A7", seed: 3, range: { low: 48, high: 55 } });
    for (const e of r.phrase.events) {
      expect(e.note!).toBeGreaterThanOrEqual(48);
      expect(e.note!).toBeLessThanOrEqual(55);
    }
  });
  it("rejects an empty progression", () => {
    expect(() => accompany({ progression: "" })).toThrow();
  });
});

describe("notesFromPhrase (accompany --play: phrase → timed note messages)", () => {
  it("emits one validated, self-releasing note message per event, paced by bpm", () => {
    const { phrase } = accompany({ progression: "Dm7 | G7", seed: 42 });
    const timed = notesFromPhrase(phrase, { bpm: 120 });
    expect(timed).toHaveLength(phrase.events.length);
    // one beat at 120 bpm = 500 ms; quarters land a beat apart
    expect(timed[0]).toMatchObject({ atMs: 0 });
    expect(timed[1]!.atMs).toBe(500);
    for (const { msg } of timed) {
      expect(msg.type).toBe("note");
      expect(msg.to).toBe("vane"); // default target
      const b = msg.body as { notes: number[]; durationMs?: number };
      expect(b.notes).toHaveLength(1); // bass is monophonic
      expect(b.durationMs).toBe(500); // quarters self-release after one beat
      expect(parseNdjson(toNdjson(msg))).toEqual(msg); // wire-valid
    }
  });
  it("honors bpm and target overrides", () => {
    const { phrase } = accompany({ progression: "Dm7", seed: 1 });
    const timed = notesFromPhrase(phrase, { bpm: 240, to: "*" });
    expect(timed[1]!.atMs).toBe(250);
    expect(timed[0]!.msg.to).toBe("*");
  });
});

describe("loopPeriodMs / performPhrase (accompany --play --loop)", () => {
  it("loopPeriodMs is the phrase's own length in ms at a given bpm", () => {
    const { phrase } = accompany({ progression: "Dm7", seed: 1 }); // 1 bar, 4/4 @ 480 tpb
    expect(loopPeriodMs(phrase, 120)).toBe(2000); // 4 beats * 500ms
    expect(loopPeriodMs(phrase, 240)).toBe(1000);
  });

  it("performPhrase yields one pass by default (loopCount omitted)", async () => {
    const { phrase } = accompany({ progression: "Dm7 | G7", seed: 42 });
    const got: string[] = [];
    // A fake clock: sleep() advances it directly instead of waiting for real
    // time, so the test is instant but still exercises the real scheduling math.
    let clock = 0;
    const now = () => clock;
    const sleep = async (ms: number) => { clock += ms; };
    for await (const msg of performPhrase(phrase, { bpm: 120, now, sleep })) {
      got.push((msg.body as { notes: number[] }).notes.join(","));
    }
    expect(got).toHaveLength(phrase.events.length);
  });

  it("loopCount repeats the whole phrase that many times, back-to-back", async () => {
    const { phrase } = accompany({ progression: "Dm7", seed: 1 });
    let clock = 0;
    const now = () => clock;
    const sleep = async (ms: number) => { clock += ms; };
    const got: number[] = [];
    for await (const msg of performPhrase(phrase, { bpm: 120, loopCount: 3, now, sleep })) {
      got.push(clock);
      void msg;
    }
    expect(got).toHaveLength(phrase.events.length * 3);
  });

  it("isStopped ends an infinite loop early — the Ctrl-C contract", async () => {
    const { phrase } = accompany({ progression: "Dm7", seed: 1 });
    let clock = 0;
    let stopped = false;
    const now = () => clock;
    const sleep = async (ms: number) => { clock += ms; };
    const got: unknown[] = [];
    for await (const msg of performPhrase(phrase, { bpm: 120, loopCount: Infinity, now, sleep, isStopped: () => stopped })) {
      got.push(msg);
      if (got.length === phrase.events.length + 1) stopped = true; // stop mid-second-pass
    }
    expect(got.length).toBe(phrase.events.length + 1);
  });

  it("performPhrase messages are the same shape notesFromPhrase produces", async () => {
    const { phrase } = accompany({ progression: "Dm7", seed: 1 });
    const timed = notesFromPhrase(phrase, { bpm: 120, to: "*" });
    const got: SuiteMessage[] = [];
    let clock = 0;
    const now = () => clock;
    const sleep = async (ms: number) => { clock += ms; };
    for await (const msg of performPhrase(phrase, { bpm: 120, to: "*", now, sleep })) got.push(msg);
    // id/sentAt are freshly minted per call (makeNote), so compare shape only.
    const shape = (m: SuiteMessage) => ({ to: m.to, from: m.from, type: m.type, body: m.body });
    expect(got.map(shape)).toEqual(timed.map((t) => shape(t.msg)));
  });
});

describe("accompany --rhythm / bundled --source styles", () => {
  it("performs the walking material on a tresillo grid (E(3,8))", () => {
    const r = accompany({ progression: "Dm7 | G7", seed: 42, rhythm: "E(3,8)" });
    expect(r.phrase.events.map((e) => e.onset % 1920).filter((o, i, a) => a.indexOf(o) === i)).toEqual([0, 720, 1440]);
    expect(r.phrase.events).toHaveLength(6); // 3 onsets × 2 bars
  });
  it("accepts an accented UPI ({100}E(3,8) boosts the downbeat)", () => {
    const plain = accompany({ progression: "Dm7", seed: 42, rhythm: "E(3,8)" });
    const accented = accompany({ progression: "Dm7", seed: 42, rhythm: "{100}E(3,8)" });
    expect(accented.phrase.events[0]!.velocity).toBeGreaterThan(plain.phrase.events[0]!.velocity);
  });
  it("bundled styles resolve by name; unknown names list the options", () => {
    const r = accompany({ progression: "Dm7 | G7", seed: 7, source: "funk-ghost" });
    expect(r.phrase.events.length).toBe(16); // 8 funk events × 2 bars
    expect(() => accompany({ progression: "Dm7", source: "nope" })).toThrow(/bundled: walking-bass/);
  });
  it("rejects an unparseable rhythm", () => {
    expect(() => accompany({ progression: "Dm7", rhythm: "not-a-rhythm(((" })).toThrow(/did not parse as UPI/);
  });
});
