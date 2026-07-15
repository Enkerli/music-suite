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
import { parseUPI, analyse } from "@enkerli/upi";
import {
  resolveEvent, validateControlMap,
  type ControlMap, type InputEvent,
} from "@enkerli/control";

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

// ── upi (the full Serpe notation language, via @enkerli/upi) ──────────────────

export interface UpiInfo {
  ok: boolean;
  label: string;
  steps: number[];
  accents: number[];
  analysis: import("@enkerli/upi").Analysis | null;
  error?: string;
}

/**
 * Parse Serpe's UPI notation (the full language: Euclidean, polygons, Morse,
 * combinations `P(3,0)+P(5,0)`, quantization `E(3,8);12`, `{accent}` prefixes,
 * shorthand names) and report the resulting pattern with its analysis. Where
 * `patternInfo` covers the canonical theory codecs, this covers the whole
 * notation — the reason `apps/serpe/engine` was promoted to `@enkerli/upi`.
 */
export function upiInfo(notation: string, steps = 16): UpiInfo {
  const r = parseUPI(notation, { n: steps });
  if (!r.ok) return { ok: false, label: r.label ?? notation, steps: [], accents: [], analysis: null, ...(r.error !== undefined && { error: r.error }) };
  return { ok: true, label: r.label, steps: r.steps, accents: r.accents, analysis: analyse(r.steps) };
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

// ── suite messages: the control & interop plane over stdio (NDJSON) ──────────
// docs/CONTROL_PLANE.md — one message model, several transports. Here the
// transport is one JSON SuiteMessage per line: `enkerli send … | enkerli recv`
// is the message model carried over an ordinary Unix pipe (headless piping).

import {
  makeParam, makeCommand, validateMessage,
  type SuiteMessage, type AppId, type Destination, type ParamMode, type ManifestBody,
} from "@enkerli/protocol";

export interface SendOptions {
  from?: AppId;
  to?: Destination;
  param?: { id: string; value: number; mode?: ParamMode };
  params?: Array<{ id: string; value: number }>;
  command?: { name: string; args?: Record<string, number> };
  mode?: ParamMode;
  id?: string;
  sentAt?: string;
}

/**
 * Build a validated control-plane SuiteMessage from CLI intent. Throws on an
 * invalid message — never emit a malformed frame onto the transport.
 */
export function sendMessage(opts: SendOptions): SuiteMessage {
  const from = opts.from ?? "external";
  const carry = { ...(opts.to !== undefined && { to: opts.to }), ...(opts.id !== undefined && { id: opts.id }), ...(opts.sentAt !== undefined && { sentAt: opts.sentAt }) };
  const isParam = opts.param !== undefined || opts.params !== undefined;
  if (isParam && opts.command) throw new Error("send: give a param or a command, not both");
  let msg: SuiteMessage;
  if (opts.params !== undefined) {
    msg = makeParam(from, { ...(opts.mode && { mode: opts.mode }), params: opts.params }, carry);
  } else if (opts.param !== undefined) {
    msg = makeParam(from, { mode: opts.param.mode ?? opts.mode ?? "set", id: opts.param.id, value: opts.param.value }, carry);
  } else if (opts.command !== undefined) {
    msg = makeCommand(from, opts.command, carry);
  } else {
    throw new Error("send: a --param, --params, or --command is required");
  }
  const r = validateMessage(msg);
  if (!r.ok) throw new Error(`send: invalid message — ${r.errors.join("; ")}`);
  return msg;
}

/** Serialize a message as one NDJSON line (the stdio transport frame). */
export function toNdjson(msg: SuiteMessage): string {
  return JSON.stringify(msg) + "\n";
}

/** Parse one NDJSON line back to a validated SuiteMessage, or null (blank / foreign / invalid). */
export function parseNdjson(line: string): SuiteMessage | null {
  const t = line.trim();
  if (!t) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(t); } catch { return null; }
  return validateMessage(parsed).ok ? (parsed as SuiteMessage) : null;
}

/** A one-line human summary of a message — the `recv` readout. */
export function summarizeMessage(m: SuiteMessage): string {
  const route = `${m.from} → ${m.to}`;
  const b = m.body as Record<string, unknown>;
  switch (m.type) {
    case "param": {
      const mode = (b.mode as string) ?? "set";
      if (Array.isArray(b.params))
        return `param ${mode} [${route}] ${(b.params as Array<{ id: string; value: number }>).map((p) => `${p.id}=${p.value}`).join(" ")}`;
      return `param ${mode} [${route}] ${b.id as string}=${b.value as number}`;
    }
    case "command":
      return `command [${route}] ${b.name as string}` +
        (b.args ? `(${Object.entries(b.args as Record<string, number>).map(([k, v]) => `${k}=${v}`).join(", ")})` : "");
    case "manifest": {
      const mb = m.body as unknown as ManifestBody;
      return `manifest [${route}] ${mb.app} v${mb.v}: ${mb.params.length} params, ${mb.commands.length} commands`;
    }
    case "scale": return `scale [${route}] mask ${b.mask as number}${b.name ? ` (${b.name as string})` : ""}`;
    case "chord": return `chord [${route}] ${(b.symbol as string) ?? `pcs ${b.pcs as number}`}`;
    case "pattern": return `pattern [${route}] ${b.steps as number} steps, mask ${b.mask as number}${b.name ? ` (${b.name as string})` : ""}`;
    case "progression": return `progression [${route}]`;
    default: return `${m.type} [${route}]`;
  }
}

/**
 * Apps that ship a control-plane manifest (docs/CONTROL_PLANE.md), resolvable
 * by id so `enkerli describe <app>` works without a path. Grows as apps adopt.
 */
export const MANIFEST_APPS: Partial<Record<AppId, string>> = {
  vane: "../../../apps/vane/manifest.json",
  serpe: "../../../apps/serpe/manifest.json",
};

/** Absolute path to a bundled app manifest, or null if the app ships none. */
export function bundledManifestPath(app: string): string | null {
  const rel = MANIFEST_APPS[app as AppId];
  return rel ? fileURLToPath(new URL(rel, import.meta.url)) : null;
}

/** Load the bundled manifests for a set of apps (skips apps that ship none). */
export function loadBundledManifests(apps: AppId[]): ManifestBody[] {
  const out: ManifestBody[] = [];
  for (const app of apps) {
    const p = bundledManifestPath(app);
    if (p) out.push(JSON.parse(readFileSync(p, "utf8")) as ManifestBody);
  }
  return out;
}

/** The bundled manifests a control-map's bindings target — for resolution/validation. */
export function manifestsForControlMap(map: ControlMap): ManifestBody[] {
  const apps = [...new Set(map.bindings.map((b) => b.action.app))];
  return loadBundledManifests(apps);
}

/** Re-exported so the CLI can resolve/validate bindings headless. */
export { resolveEvent, validateControlMap, type ControlMap, type InputEvent };

/** A manifest param carrying its engine binding (Vane-specific extension field). */
interface EngineParamSpec { id: string; wasmId?: number }

/**
 * The Vane manifest's `id → wasm param id` map — how a control-plane `param`
 * message (addressed by stable manifest id, e.g. "filter-cutoff") resolves to
 * the numeric engine parameter `renderVane` sets. This is the bridge that lets
 * the plane drive real audio: `enkerli send --to vane --param … | enkerli
 * render --stream`.
 */
export function vaneParamIdMap(): Record<string, number> {
  const path = bundledManifestPath("vane");
  if (!path) return {};
  const body = JSON.parse(readFileSync(path, "utf8")) as { params: EngineParamSpec[] };
  const map: Record<string, number> = {};
  for (const p of body.params) if (typeof p.wasmId === "number") map[p.id] = p.wasmId;
  return map;
}

export interface StreamParamResult {
  /** wasm param id → value (last write wins — `set` semantics). */
  params: Record<number, number>;
  /** each resolved application, in stream order (for the readout). */
  applied: Array<{ id: string; wasmId: number; value: number }>;
  /** manifest ids not in the resolver map (surfaced, not silently dropped). */
  unresolved: string[];
  /** count of `param` messages consumed for the target. */
  messages: number;
  /** count of lines ignored (non-param, or addressed to another app). */
  ignored: number;
}

/**
 * Reduce a `param` NDJSON stream to a wasm-id param set for `renderVane`.
 * Consumes only `param` messages addressed to `target` (or broadcast "*");
 * single and batch forms both handled; last value per id wins. Non-param
 * lines and messages for other apps are counted as ignored, not errors — a
 * stream may legitimately carry more than this renderer cares about.
 */
export function paramsFromStream(
  ndjson: string, idToWasm: Record<string, number>, target: AppId = "vane",
): StreamParamResult {
  const params: Record<number, number> = {};
  const applied: Array<{ id: string; wasmId: number; value: number }> = [];
  const unresolved: string[] = [];
  let messages = 0, ignored = 0;
  const apply = (id: string, value: number) => {
    const wasmId = idToWasm[id];
    if (wasmId === undefined) { if (!unresolved.includes(id)) unresolved.push(id); return; }
    params[wasmId] = value;
    applied.push({ id, wasmId, value });
  };
  for (const line of ndjson.split("\n")) {
    const m = parseNdjson(line);
    if (!m) continue;
    if (m.type !== "param" || (m.to !== target && m.to !== "*")) { ignored++; continue; }
    messages++;
    const b = m.body as { id?: string; value?: number; params?: Array<{ id: string; value: number }> };
    if (Array.isArray(b.params)) for (const p of b.params) apply(p.id, p.value);
    else if (typeof b.id === "string" && typeof b.value === "number") apply(b.id, b.value);
  }
  return { params, applied, unresolved, messages, ignored };
}

/** Validate a hand-authored manifest body and return a human-readable surface. */
export function describeManifest(body: unknown): { manifest: ManifestBody; lines: string[] } {
  if (typeof body !== "object" || body === null || Array.isArray(body))
    throw new Error("describe: manifest must be a JSON object");
  const mb = body as ManifestBody;
  const probe = { protocol: "enkerli-suite", v: 1, id: "describe-probe", from: mb.app, to: "*", sentAt: "2026-01-01T00:00:00Z", type: "manifest", body: mb };
  const r = validateMessage(probe);
  if (!r.ok) throw new Error(`describe: invalid manifest — ${r.errors.join("; ")}`);
  const lines: string[] = [`${mb.app} manifest v${mb.v}`];
  lines.push(`params (${mb.params.length}):`);
  for (const p of mb.params)
    lines.push(`  ${p.id}  ${p.label}  [${p.min}..${p.max} ${p.unit}${p.scale === "log" ? " log" : ""}${p.step ? ` step ${p.step}` : ""}]  default ${p.default}`);
  lines.push(`commands (${mb.commands.length}):`);
  for (const c of mb.commands)
    lines.push(`  ${c.name}  ${c.label}` + (c.args?.length ? `  args: ${c.args.map((a) => `${a.id}[${a.min}..${a.max} ${a.unit}]`).join(", ")}` : ""));
  return { manifest: mb, lines };
}
