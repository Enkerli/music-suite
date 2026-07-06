/**
 * @enkerli/cli — headless suite tools (plan §6, Track E3), as a LIBRARY.
 * The `enkerli` bin (cli.ts) is a thin argv wrapper over these functions so
 * every capability is import-testable and reusable (a future daemon, a CI
 * check, another CLI) without spawning a process.
 *
 * Four capabilities, each riding an engine that already runs in node:
 *   chordInfo    — @enkerli/theory chord detection (MIDI notes or pcs)
 *   patternInfo  — rhythm codecs + Euclid (leftmost = LSB, suite-wide)
 *   smfFromBars  — bar notation → canonical Progression → Standard MIDI File
 *   renderVane   — notes → AUDIO through Vane's real WASM voice (the same
 *                  vane-dsp.wasm the browser standalone plays; committed at
 *                  apps/vane/synth/). No GUI, no DAW, no plugin host.
 *
 * The full Serpe UPI language is NOT here: its JS engine lives in apps/serpe
 * (an app, not a package) — promoting it is the named refactor in
 * docs/HEADLESS.md. `patternInfo` covers the canonical theory subset.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  detectChord, detectChordFromPcs, type ChordMatch,
  euclideanRhythm,
  patternToBinaryString, patternFromBinaryString,
  patternToDecimal, patternFromDecimal,
  patternToHex, patternFromHex,
  patternToOctal, patternFromOctal,
  parseLeadsheet, type Progression,
} from "@enkerli/theory";
import { progressionToSMF, progressionFromSMF } from "@enkerli/midi";

// ── chord ─────────────────────────────────────────────────────────────────────

export interface ChordInfo {
  input: number[];
  interpretation: "midi-notes" | "pitch-classes";
  match: ChordMatch | null;
}

/**
 * Identify a chord from MIDI notes (default) or bare pitch classes. Values
 * all ≤ 11 are treated as pcs unless `asNotes` forces the MIDI reading.
 */
export function chordInfo(values: number[], opts: { asNotes?: boolean } = {}): ChordInfo {
  const pcsOnly = !opts.asNotes && values.every((v) => v >= 0 && v <= 11);
  return pcsOnly
    ? { input: values, interpretation: "pitch-classes", match: detectChordFromPcs(values) }
    : { input: values, interpretation: "midi-notes", match: detectChord(values) };
}

// ── pattern ───────────────────────────────────────────────────────────────────

export interface PatternInfo {
  steps: number;
  onsets: number[];
  onsetCount: number;
  binary: string;
  hex: string;
  octal: string;
  decimal: number;
}

/**
 * Parse a rhythm spec and report every codec view of it. Accepted specs
 * (leftmost = LSB throughout — element i is bit i):
 *   E(k,n[,rot])       Euclidean
 *   0x94:8 / 94:8      hex (suite little-endian digits) with step count
 *   0o111:8 / o111:8   octal with step count
 *   d73:8              decimal with step count
 *   b10010010 / 10010010   binary (steps = length)
 */
export function patternInfo(spec: string): PatternInfo {
  const s = spec.trim();
  let pattern: boolean[];

  const euclid = /^[Ee]\((\d+),(\d+)(?:,(-?\d+))?\)$/.exec(s);
  const hex = /^(?:0x)([0-9a-fA-F]+):(\d+)$/.exec(s) ?? /^([0-9a-fA-F]+):(\d+)$/.exec(s);
  const oct = /^(?:0o|o)([0-7]+):(\d+)$/.exec(s);
  const dec = /^d(\d+):(\d+)$/.exec(s);
  const bin = /^b?([01]{2,})$/.exec(s);

  if (euclid) {
    pattern = euclideanRhythm(Number(euclid[1]), Number(euclid[2]), Number(euclid[3] ?? 0));
  } else if (oct) {
    pattern = patternFromOctal(oct[1]!, Number(oct[2]));
  } else if (dec) {
    pattern = patternFromDecimal(Number(dec[1]), Number(dec[2]));
  } else if (hex) {
    pattern = patternFromHex(hex[1]!, Number(hex[2]));
  } else if (bin) {
    pattern = patternFromBinaryString(bin[1]!);
  } else {
    throw new Error(`unrecognized pattern spec: "${spec}" — try E(3,8), 0x94:8, o111:8, d73:8, or 10010010`);
  }

  const onsets = pattern.flatMap((on, i) => (on ? [i] : []));
  return {
    steps: pattern.length,
    onsets,
    onsetCount: onsets.length,
    binary: patternToBinaryString(pattern),
    hex: patternToHex(pattern),
    octal: patternToOctal(pattern),
    decimal: patternToDecimal(pattern),
  };
}

// ── smf ───────────────────────────────────────────────────────────────────────

export interface SmfOptions {
  tonic?: string;
  mode?: "major" | "minor";
  bpm?: number;
  beatsPerChord?: number;
}

export interface SmfResult {
  bytes: Uint8Array;
  prog: Progression;
  chordCount: number;
}

/**
 * Bar notation → canonical Progression → format-0 SMF with the embedded
 * `MCURATOR:v1 PROG` payload — the same file "Send to MIDIcurator" writes,
 * so anything the suite exports, this can generate from a one-line string.
 */
export function smfFromBars(text: string, opts: SmfOptions = {}): SmfResult {
  const prog = parseLeadsheet(text, {
    tonic: opts.tonic ?? "C",
    mode: opts.mode ?? "major",
  });
  const chordCount = prog.sections?.reduce(
    (n, sec) => n + sec.bars.reduce((m, b) => m + b.chords.length, 0), 0)
    ?? 0;
  if (chordCount === 0) throw new Error("no chords parsed from the bar notation");
  const bytes = progressionToSMF(prog, {
    ...(opts.bpm !== undefined && { bpm: opts.bpm }),
    ...(opts.beatsPerChord !== undefined && { beatsPerChord: opts.beatsPerChord }),
  });
  return { bytes, prog, chordCount };
}

/** Round-trip check helper (also used by tests). */
export function progressionFromSmfBytes(bytes: Uint8Array): Progression | null {
  return progressionFromSMF(bytes);
}

// ── render (Vane WASM voice) ──────────────────────────────────────────────────

/** The monorepo's committed voice artifact (three levels up from this file). */
export function defaultWasmPath(): string {
  return fileURLToPath(new URL("../../../apps/vane/synth/vane-dsp.wasm", import.meta.url));
}

interface VaneExports {
  _initialize?: () => void;
  vane_init(sr: number): void;
  vane_set_cc(cc: number, v: number): void;
  vane_set_param(id: number, v: number): void;
  vane_note_on(note: number, vel: number, ch: number): void;
  vane_note_off(note: number, ch: number): void;
  vane_render(n: number): void;
  vane_buffer(): number;
  memory: WebAssembly.Memory;
}

export interface RenderOptions {
  /** MIDI notes, each on its own MPE channel. */
  notes: number[];
  /** Held duration, seconds (a 0.4 s release tail is appended). */
  seconds?: number;
  /** Breath (CC2) level 0–1 — Vane's real envelope; 0 renders silence. */
  breath?: number;
  sampleRate?: number;
  /** Extra engine params, by Vane's wasm param ids (e.g. { 12: 0.8 } = Morph). */
  params?: Record<number, number>;
  wasmPath?: string;
}

export interface RenderResult {
  samples: Float32Array;
  sampleRate: number;
  peak: number;
  /** 16-bit PCM mono WAV, ready to write to disk. */
  wav: Uint8Array;
}

/** Render notes through the real Vane DSP (WASM) and encode a WAV. */
export async function renderVane(opts: RenderOptions): Promise<RenderResult> {
  const sr = opts.sampleRate ?? 48000;
  const seconds = opts.seconds ?? 2;
  const breath = opts.breath ?? 0.9;
  const bytes = readFileSync(opts.wasmPath ?? defaultWasmPath());
  const { instance } = await WebAssembly.instantiate(bytes, {
    wasi_snapshot_preview1: new Proxy({}, { get: () => () => 0 }),
  });
  const e = instance.exports as unknown as VaneExports;
  e._initialize?.(); // WASI reactor: static C++ ctors (tuning tables) need this
  e.vane_init(sr);
  e.vane_set_cc(2, breath);
  for (const [id, v] of Object.entries(opts.params ?? {}))
    e.vane_set_param(Number(id), v);
  opts.notes.forEach((n, i) => e.vane_note_on(n, 100, 2 + (i % 14)));

  const block = 128;
  const holdBlocks = Math.ceil((seconds * sr) / block);
  const tailBlocks = Math.ceil((0.4 * sr) / block);
  const samples = new Float32Array((holdBlocks + tailBlocks) * block);
  let o = 0;
  const pull = () => {
    e.vane_render(block);
    samples.set(new Float32Array(e.memory.buffer, e.vane_buffer(), block), o);
    o += block;
  };
  for (let i = 0; i < holdBlocks; i++) pull();
  opts.notes.forEach((n, i) => e.vane_note_off(n, 2 + (i % 14)));
  for (let i = 0; i < tailBlocks; i++) pull();

  let peak = 0;
  for (const v of samples) peak = Math.max(peak, Math.abs(v));
  return { samples, sampleRate: sr, peak, wav: encodeWav16(samples, sr) };
}

/** Minimal 16-bit PCM mono WAV encoder. */
export function encodeWav16(samples: Float32Array, sampleRate: number): Uint8Array {
  const data = new DataView(new ArrayBuffer(44 + samples.length * 2));
  const ascii = (off: number, s: string) => { for (let i = 0; i < s.length; i++) data.setUint8(off + i, s.charCodeAt(i)); };
  ascii(0, "RIFF"); data.setUint32(4, 36 + samples.length * 2, true); ascii(8, "WAVE");
  ascii(12, "fmt "); data.setUint32(16, 16, true);
  data.setUint16(20, 1, true);            // PCM
  data.setUint16(22, 1, true);            // mono
  data.setUint32(24, sampleRate, true);
  data.setUint32(28, sampleRate * 2, true);
  data.setUint16(32, 2, true);
  data.setUint16(34, 16, true);
  ascii(36, "data"); data.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]!));
    data.setInt16(44 + i * 2, Math.round(v * 32767), true);
  }
  return new Uint8Array(data.buffer);
}
