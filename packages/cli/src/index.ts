/**
 * @enkerli/cli — headless suite tools (plan §6, Track E3), as a LIBRARY.
 * The `msuite` bin (cli.ts) is a thin argv wrapper over these functions so
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
  parseLeadsheet, realizeLeadsheet, type Progression,
} from "@enkerli/theory";
import { progressionToSMF, progressionFromSMF, readSmfNotes } from "@enkerli/midi";
import { parseUPI, analyse, parsePolyUPI, splitLanes, type PolyResult } from "@enkerli/upi";
import { generateLabels, realizeLabel } from "@enkerli/proggen";
import {
  parsePhrase, serializePhrase, groove, extractPhrase,
  learnStyleModel, samplePhrase, serializeModel, parseModel, looksLikeModel,
  type AccompanimentPhrase, type HarmonicFrame, type Trace, type TraceLevel, type ArticulationChange,
  type ExpressChange, type StyleModel, type InputNote, type NoteInflection,
} from "@enkerli/accompaniment";
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

/** Is this notation poly (top-level `/` lanes — docs/SERPE_POLY.md)? */
export function isPolyUpi(notation: string): boolean {
  return splitLanes(String(notation)).length > 1;
}

export interface PolyUpiInfo {
  ok: boolean;
  poly: PolyResult | null;
  /** Per-lane analysis, aligned with poly.lanes. */
  analyses: Array<import("@enkerli/upi").Analysis>;
  error?: string;
}

/** Parse + analyse poly notation, one analysis per lane. */
export function polyUpiInfo(notation: string, steps = 16): PolyUpiInfo {
  const p = parsePolyUPI(notation, { n: steps });
  if (!p.ok) return { ok: false, poly: null, analyses: [], ...(p.error !== undefined && { error: p.error }) };
  return { ok: true, poly: p, analyses: p.lanes.map((l) => analyse(l.steps)) };
}

// ── generate (ProgGenie's corpus generation, via @enkerli/proggen) ────────────

/** The bundled corpus transition table (derived statistics only, ships in the package). */
export function proggenTablePath(): string {
  return fileURLToPath(new URL("../../proggen/src/data/transitions.json", import.meta.url));
}

export interface GenerateInfo {
  mode: "major" | "minor";
  labels: string[];
  /** Bar notation (one Roman-numeral chord per bar) — feeds `msuite smf`. */
  bars: string;
  /** Realized chord symbols in the given key, when a tonic is supplied. */
  symbols?: string[];
}

/**
 * Generate a progression from the corpus transition statistics — the full
 * headless pipeline the ProgGenie promotion unlocks. Output is Roman-numeral
 * bar notation (the suite convention) that chains straight into `smfFromBars`;
 * with a tonic, also realizes the chords to spelled symbols.
 */
export function generateInfo(opts: {
  mode?: "major" | "minor"; length?: number; seed?: number;
  method?: "markov" | "markov-cadence" | "circle"; variety?: string; tonic?: string;
} = {}): GenerateInfo {
  const tables = JSON.parse(readFileSync(proggenTablePath(), "utf8")) as Record<"major" | "minor", Record<string, unknown>>;
  const mode = opts.mode ?? "major";
  const labels = generateLabels(tables[mode], mode, {
    length: opts.length ?? 8,
    ...(opts.seed !== undefined && { seed: opts.seed }),
    method: opts.method ?? "markov",
    variety: opts.variety ?? "faithful",
  });
  const bars = labels.join(" | ");
  const info: GenerateInfo = { mode, labels, bars };
  if (opts.tonic) {
    const key = { tonic: opts.tonic, mode };
    info.symbols = labels.map((l) => realizeLabel(l, key)?.symbol ?? l);
  }
  return info;
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

// ── accompany (GloriArp slice 1, via @enkerli/accompaniment) ─────────────────
// One curated phrase adapted across a progression: bar notation → canonical
// Progression → harmonic frames → the deterministic bass adapter → SMF with
// the trace's reproducibility header embedded (GLORIARP:v1 TRACE, the same
// meta-text mechanism as MCURATOR:v1 PROG). docs/GLORIARP_AUDIT.md §3.

/** The bundled CC0 source phrases — each committed vector is a "style". */
export const BUNDLED_PHRASES = ["walking-bass", "funk-ghost", "bossa", "two-feel"] as const;

/** Resolve a --source spec: a path (has / or .json) passes through; a bare
 *  name picks a bundled phrase. */
export function phrasePath(spec?: string): string {
  const name = spec ?? "walking-bass";
  if (name.includes("/") || name.endsWith(".json")) return name;
  if (!(BUNDLED_PHRASES as readonly string[]).includes(name))
    throw new Error(`accompany: unknown source "${name}" — bundled: ${BUNDLED_PHRASES.join(", ")} (or a phrase.json path)`);
  return fileURLToPath(new URL(`../../accompaniment/vectors/source-${name}.json`, import.meta.url));
}

/** The bundled CC0 source phrase (the committed acceptance-vector fixture). */
export function defaultPhrasePath(): string {
  return phrasePath();
}

// ── style learn: MIDI clips + one chord → a StyleModel (statistics only) ─────

export interface LearnStyleOptions {
  /** Paths to .mid files — the corpus, all played against `chord`. */
  files: string[];
  /** The shared chord (e.g. "Bb7"): the harmonic frame relations infer against. */
  chord: string;
  id: string;
  role?: "bass" | "comping" | "groove" | "arp" | "melodic-fill" | "unknown";
  /** Grid slots per beat (default 4 = sixteenths). */
  grid?: number;
  tonic?: string;
  mode?: "major" | "minor";
}

export interface LearnStyleResult {
  model: StyleModel;
  modelJson: string;
  /** Per-file take summaries, for the report. */
  takes: { file: string; events: number; bars: number }[];
}

/**
 * Learn a style model from MIDI clips (docs/GLORIARP_NEXT.md: curated
 * capture → statistics). Each clip's notes are extracted against the shared
 * chord with the honest relation inference, then folded into per-slot
 * distributions. The output is STATISTICS ONLY — the clips never enter the
 * artifact (the brief's no-corpus-publication rule, held by construction).
 */
export function learnStyle(opts: LearnStyleOptions): LearnStyleResult {
  if (!opts.files.length) throw new Error("style learn: at least one .mid file required");
  // Resolve the chord through the canonical leadsheet path (one bar).
  const prog = parseLeadsheet(opts.chord, { tonic: opts.tonic ?? "C", mode: opts.mode ?? "major" });
  const realized = realizeLeadsheet(prog);
  const c = realized[0]?.[0];
  if (!c) throw new Error(`style learn: could not parse chord "${opts.chord}"`);
  const frame = { symbol: c.symbol, rootPc: c.rootPc, pcs: c.pcs };

  const takes: { file: string; events: number; bars: number }[] = [];
  const phrases: AccompanimentPhrase[] = [];
  for (const file of opts.files) {
    const { ticksPerBeat, notes } = readSmfNotes(readFileSync(file));
    if (!notes.length) { takes.push({ file, events: 0, bars: 0 }); continue; }
    // Normalize to 480 tpb so mixed-PPQ corpora fold onto one grid.
    const scale = 480 / ticksPerBeat;
    const t0 = notes[0]!.startTick; // clip-relative: a pickup-less clip starts at 0
    const input: InputNote[] = notes.map((n) => ({
      pitch: n.pitch,
      startTick: Math.round((n.startTick - t0) * scale),
      durationTicks: Math.max(1, Math.round(n.durationTicks * scale)),
      ...(n.velocity !== undefined && { velocity: n.velocity }),
    }));
    const lastEnd = Math.max(...input.map((n) => n.startTick + n.durationTicks));
    const barTicks = 4 * 480;
    const bars = Math.max(1, Math.ceil(lastEnd / barTicks));
    phrases.push(extractPhrase(input, {
      id: `${opts.id}-${takes.length}`,
      role: opts.role ?? "bass",
      meter: { numerator: 4, denominator: 4 },
      ticksPerBeat: 480,
      lengthTicks: bars * barTicks,
      frame,
      source: { note: `extracted from local clip (statistics only leave this machine)` },
    }));
    takes.push({ file, events: input.length, bars });
  }
  if (!phrases.length) throw new Error("style learn: no notes found in any file");

  const model = learnStyleModel(phrases, {
    id: opts.id,
    ...(opts.role !== undefined && { role: opts.role }),
    ...(opts.grid !== undefined && { grid: opts.grid }),
    source: { note: `learned from ${phrases.length} local clips against ${frame.symbol}` },
  });
  return { model, modelJson: serializeModel(model), takes };
}

/** "C2", "F♯1", "Bb3" → MIDI note number (C4 = 60). */
export function noteNameToMidi(name: string): number {
  const m = /^([A-Ga-g])([#♯b♭]?)(-?\d+)$/.exec(name.trim());
  if (!m) throw new Error(`bad note name "${name}" (try C2, F#1, Bb3)`);
  const base = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }[m[1]!.toLowerCase() as "c"]!;
  const acc = m[2] === "#" || m[2] === "♯" ? 1 : m[2] === "b" || m[2] === "♭" ? -1 : 0;
  return 12 * (Number(m[3]) + 1) + base + acc;
}

export interface AccompanyOptions {
  /** Bar notation, e.g. "Dm7 | G7 | Cmaj7 | A7". */
  progression: string;
  tonic?: string;
  mode?: "major" | "minor";
  /** A bundled style name (walking-bass · funk-ghost · bossa · two-feel) or
   *  a path to an AccompanimentPhrase JSON. Default walking-bass. */
  source?: string;
  /** UPI rhythm notation (e.g. "E(3,8)", "P(3,0)+P(5,0)", "{100}E(3,8)"):
   *  perform the source's pitch material on THIS onset grid instead of its
   *  own — Serpe's rhythm language as GloriArp's rhythm section. */
  rhythm?: string;
  /** Duration feel: staccato · tenuto · legato · mixed, or a 0..1+ factor.
   *  "mixed" articulates per note from melodic context. */
  gate?: string;
  /** 0..1 — velocity follows the metric contour (downbeats up, cracks down). */
  dynamics?: number;
  /** 0..1 — metrically weak events drop out (never bar downbeats). */
  rests?: number;
  /** 0..1 — bar downbeats may sound half a beat EARLY (the push). */
  anticipation?: number;
  /** 0..1 — passing tones, octave pops, chord-tone reselection (weak beats). */
  variety?: number;
  /** 0..1 — correlated push/pull micro-timing + micro-dynamics (the Keil walk). */
  pocket?: number;
  /** 0..1 — blanket fraction of variety/pocket/rests decisions re-rolled
   *  per pass. Alias for morphNotes/morphPocket/morphRests when the
   *  per-dimension ones aren't given (continuous mutation, one dimension
   *  at a time — docs/KNOWLEDGE_TRANSFER.md item 5). */
  morph?: number;
  /** 0..1 — note-choice (variety) re-roll rate per pass, independent of
   *  morphPocket/morphRests. */
  morphNotes?: number;
  /** 0..1 — pocket (timing/dynamics walk) re-roll rate per pass,
   *  independent of morphNotes/morphRests. */
  morphPocket?: number;
  /** 0..1 — rests (skip-step) re-roll rate per pass: WHICH steps drop
   *  wanders across loop repeats, independent of morphNotes/morphPocket. */
  morphRests?: number;
  /** 0..1 — per-note wind articulation: sforzando/staccato/legato/marcato…,
   *  each note with its own breath envelope (CC2 curves in the .mid). */
  inflect?: number;
  /** 0..1 — accent decisions (inflect's sforzando/marcato, staccato/tenuto,
   *  slide promotion) re-roll rate per pass. Needs inflect to matter. */
  morphAccents?: number;
  /** 0..1 — probability an eligible legato transition becomes an audible
   *  SLIDE (portamento) instead of an instant pitch join. Needs inflect. */
  slide?: number;
  /** Portamento time (ms) for a promoted slide. Default 120. */
  glideMs?: number;
  /** Loop-pass index to render (0-based). */
  pass?: number;
  /** Tile the progression's bars out to this many bars. */
  bars?: number;
  seed?: number;
  /** MIDI note bounds, inclusive. Default C2..C4 (36..60). */
  range?: { low: number; high: number };
  chromaticism?: number;
  rhythmPreservation?: number;
  bpm?: number;
  traceLevel?: TraceLevel;
}

export interface AccompanyResult {
  phrase: AccompanimentPhrase;
  trace: Trace;
  frames: HarmonicFrame[];
  smf: Uint8Array;
  phraseJson: string;
  /** What the articulation pass did (rests dropped, downbeats anticipated). */
  articulation: ArticulationChange[];
  /** What the expression stage did (passing tones, pocket leans, gates). */
  expression: ExpressChange[];
  /** Per-note articulations + breath envelopes (empty unless inflect). */
  inflections: NoteInflection[];
  /** Non-error remarks the pipeline wants surfaced — see GrooveResult.notices. */
  notices: string[];
}

/**
 * Run the slice-1 pipeline. Deterministic: identical options → identical
 * bytes (the acceptance contract; the vectors pin it in the engine's tests).
 */
export function accompany(opts: AccompanyOptions): AccompanyResult {
  // Thin over the isomorphic engine pipeline (@enkerli/accompaniment groove):
  // the CLI's whole job is path resolution and file I/O — the same engine
  // call a browser module or a plugin WebView makes.
  //
  // --source accepts a PHRASE json (a single curated take) or a STYLE MODEL
  // json (`msuite style learn` output): a model is sampled per (seed, pass)
  // — every pass a fresh take, the learned variability of performance.
  const raw = readFileSync(phrasePath(opts.source), "utf8");
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { parsed = null; }
  const source = looksLikeModel(parsed)
    ? samplePhrase(parseModel(raw), { seed: opts.seed ?? 42, ...(opts.pass !== undefined && { pass: opts.pass }) })
    : parsePhrase(raw);
  const { progression, tonic, mode, rhythm, bars, seed, range, chromaticism,
          rhythmPreservation, gate, dynamics, rests, anticipation,
          variety, pocket, morph, morphNotes, morphPocket, morphRests,
          inflect, morphAccents, slide, glideMs, pass, bpm, traceLevel } = opts;
  const r = groove(source, {
    progression,
    ...(tonic !== undefined && { tonic }),
    ...(mode !== undefined && { mode }),
    ...(rhythm !== undefined && { rhythm }),
    ...(bars !== undefined && { bars }),
    ...(seed !== undefined && { seed }),
    ...(range !== undefined && { range }),
    ...(chromaticism !== undefined && { chromaticism }),
    ...(rhythmPreservation !== undefined && { rhythmPreservation }),
    ...(gate !== undefined && { gate }),
    ...(dynamics !== undefined && { dynamics }),
    ...(rests !== undefined && { rests }),
    ...(anticipation !== undefined && { anticipation }),
    ...(variety !== undefined && { variety }),
    ...(pocket !== undefined && { pocket }),
    ...(morph !== undefined && { morph }),
    ...(morphNotes !== undefined && { morphNotes }),
    ...(morphPocket !== undefined && { morphPocket }),
    ...(morphRests !== undefined && { morphRests }),
    ...(inflect !== undefined && { inflect }),
    ...(morphAccents !== undefined && { morphAccents }),
    ...(slide !== undefined && { slide }),
    ...(glideMs !== undefined && { glideMs }),
    ...(pass !== undefined && { pass }),
    ...(bpm !== undefined && { bpm }),
    ...(traceLevel !== undefined && { traceLevel }),
  });
  return { ...r, phraseJson: serializePhrase(r.phrase) };
}

// ── suite messages: the control & interop plane over stdio (NDJSON) ──────────
// docs/CONTROL_PLANE.md — one message model, several transports. Here the
// transport is one JSON SuiteMessage per line: `msuite send … | msuite recv`
// is the message model carried over an ordinary Unix pipe (headless piping).

import {
  makeParam, makeCommand, makeNote, validateMessage,
  type SuiteMessage, type AppId, type Destination, type ParamMode, type ManifestBody, type NoteBody,
} from "@enkerli/protocol";
import { VoiceSplitter } from "@enkerli/voice-routing";

export interface SendOptions {
  from?: AppId;
  to?: Destination;
  param?: { id: string; value: number; mode?: ParamMode };
  params?: Array<{ id: string; value: number }>;
  command?: { name: string; args?: Record<string, number> };
  note?: { notes: number[]; velocity?: number; channel?: number; gate?: "on" | "off"; durationMs?: number };
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
  const kinds = [isParam, opts.command !== undefined, opts.note !== undefined].filter(Boolean).length;
  if (kinds > 1) throw new Error("send: give one of a param, a command, or a note");
  let msg: SuiteMessage;
  if (opts.params !== undefined) {
    msg = makeParam(from, { ...(opts.mode && { mode: opts.mode }), params: opts.params }, carry);
  } else if (opts.param !== undefined) {
    msg = makeParam(from, { mode: opts.param.mode ?? opts.mode ?? "set", id: opts.param.id, value: opts.param.value }, carry);
  } else if (opts.command !== undefined) {
    msg = makeCommand(from, opts.command, carry);
  } else if (opts.note !== undefined) {
    msg = makeNote(from, opts.note, carry);
  } else {
    throw new Error("send: a --param, --command, or --note is required");
  }
  const r = validateMessage(msg);
  if (!r.ok) throw new Error(`send: invalid message — ${r.errors.join("; ")}`);
  return msg;
}

/** Serialize a message as one NDJSON line (the stdio transport frame). */
export function toNdjson(msg: SuiteMessage): string {
  return JSON.stringify(msg) + "\n";
}

/**
 * Voice Split as an NDJSON pipe filter (`msuite voice-split`) — the CLI's
 * share of `@enkerli/voice-routing` (docs/PITCHFOLD_AUDIT.md: the one
 * voice-routing mode the audit found genuinely clean, now reused rather
 * than reimplemented per surface — PitchFold's own engine, the Workspace
 * `voice-split` module, and this). Round-robins `note` messages across
 * `baseChannel..baseChannel+span-1`; any other message type passes through
 * unchanged. `to`, when given, re-addresses split notes to a new
 * destination (matching the Workspace module's own `to` option); omitted,
 * the incoming message's own `to` is kept.
 */
export function applyVoiceSplit(
  msg: SuiteMessage,
  splitter: VoiceSplitter,
  opts: { baseChannel?: number; span?: number; to?: Destination } = {},
): SuiteMessage {
  if (msg.type !== "note") return msg;
  const channel = splitter.next(opts.baseChannel ?? 1, opts.span ?? 4);
  return makeNote(msg.from, { ...(msg.body as unknown as NoteBody), channel }, { to: opts.to ?? msg.to, id: msg.id, sentAt: msg.sentAt });
}

/** A note message scheduled at a millisecond offset from performance start. */
export interface TimedNote {
  atMs: number;
  msg: SuiteMessage;
}

/**
 * An adapted phrase as a performable stream of control-plane `note` messages
 * (self-releasing via durationMs, so no note-offs to pair). This is how
 * `msuite accompany --play` drives a listener — the same messages the bus
 * carries in the browser, paced by the phrase's own ticks at the given bpm.
 */
export function notesFromPhrase(
  phrase: AccompanimentPhrase,
  opts: { bpm?: number; to?: Destination; from?: AppId; inflections?: NoteInflection[] } = {},
): TimedNote[] {
  const bpm = opts.bpm ?? 120;
  const msPerTick = 60000 / (bpm * phrase.ticksPerBeat);
  const infByIndex = new Map((opts.inflections ?? []).map((n) => [n.index, n]));
  return phrase.events
    .map((e, i) => ({ e, inf: infByIndex.get(i) }))
    .filter(({ e }) => e.note !== undefined)
    .map(({ e, inf }) => ({
      atMs: Math.round(e.onset * msPerTick),
      msg: makeNote(opts.from ?? "external", {
        notes: [e.note!],
        velocity: e.velocity,
        durationMs: Math.max(1, Math.round(e.duration * msPerTick)),
        // Per-note wind articulation (inflect stage): the breath envelope and
        // tonguing hint ride the note message — consumers that understand
        // them (Vane's worklet, the rawmidi player) render the curve; others
        // ignore the extra fields (the protocol's open-body rule).
        ...(inf && {
          articulation: inf.articulation,
          env: inf.envelope,
          attack: inf.attack,
          // Always explicit (0 default), never conditionally omitted: a
          // receiver's glide-time is a PERSISTENT param — a stale nonzero
          // value from a previous slide must not leak into this note.
          glideMs: inf.glideMs ?? 0,
        }),
      }, { to: opts.to ?? "vane" }),
    }));
}

/** How long one pass of a phrase takes to perform, at a given bpm. */
export function loopPeriodMs(phrase: AccompanimentPhrase, bpm = 120): number {
  return (phrase.lengthTicks / phrase.ticksPerBeat) * (60000 / bpm);
}

export interface PerformOptions {
  bpm?: number;
  to?: Destination;
  from?: AppId;
  /** Per-note articulations (inflect stage) — envelopes ride the messages. */
  inflections?: NoteInflection[];
  /** Passes over the phrase; `Infinity` performs until `isStopped()` says so. Default 1. */
  loopCount?: number;
  /** Polled between waits — the graceful-stop hook (e.g. a caught SIGINT). */
  isStopped?: () => boolean;
  /** Injectable clock/waiter, so tests can drive this without real time passing. */
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Perform a phrase as a real-time stream of `note` messages — the engine
 * behind `accompany --play [--loop]`. Each pass is scheduled off a single
 * absolute start time (not chained `setTimeout`s), so passes never drift
 * relative to each other. A generator rather than a callback: the caller
 * decides what "deliver a message" means (write NDJSON, POST to a bridge, …).
 */
export async function* performPhrase(phrase: AccompanimentPhrase, opts: PerformOptions = {}): AsyncGenerator<SuiteMessage> {
  const bpm = opts.bpm ?? 120;
  const timed = notesFromPhrase(phrase, {
    bpm, ...(opts.to !== undefined && { to: opts.to }), ...(opts.from !== undefined && { from: opts.from }),
    ...(opts.inflections !== undefined && { inflections: opts.inflections }),
  });
  const periodMs = loopPeriodMs(phrase, bpm);
  const loopCount = opts.loopCount ?? 1;
  const isStopped = opts.isStopped ?? (() => false);
  const now = opts.now ?? Date.now;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((res) => setTimeout(res, ms)));
  const t0 = now();
  for (let iter = 0; iter < loopCount && !isStopped(); iter++) {
    for (const { atMs, msg } of timed) {
      if (isStopped()) return;
      const target = t0 + iter * periodMs + atMs;
      // Wait in short slices (not one long sleep) so isStopped() is checked
      // promptly — a real Ctrl-C shouldn't wait out an entire beat to land.
      while (!isStopped()) {
        const remain = target - now();
        if (remain <= 0) break;
        await sleep(Math.min(remain, 200));
      }
      if (isStopped()) return;
      yield msg;
    }
  }
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
    case "note": {
      const g = b.gate ? ` ${b.gate as string}` : (b.durationMs ? ` ${b.durationMs as number}ms` : "");
      return `note [${route}]${g} [${(b.notes as number[]).join(" ")}]${b.velocity !== undefined ? ` v${b.velocity as number}` : ""}`;
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
 * by id so `msuite describe <app>` works without a path. Grows as apps adopt.
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
 * the plane drive real audio: `msuite send --to vane --param … | enkerli
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

// ── bridge: stdio-NDJSON → browsers over SSE (the transport adapter) ─────────
export { startBridge, type Bridge, type BridgeOptions } from "./bridge.js";

// ── midi out: suite messages → real MIDI bytes (ALSA rawmidi, P1 Plug & Jam) ─
export {
  listMidiPorts, resolveMidiPort, noteMessageToMidi, createMidiPlayer,
  type MidiPort, type MidiPlayer, type MidiPlayerOptions, type MidiConvertOptions, type TimedMidi,
} from "./midiout.js";

/* Comping loops (voicing slots rather than pitches) → a GloriArp style model.
   Kept beside learnStyle: same destination, different source material. */
export {
  learnCompModel, detectBase, meterFromName, voicingStack, voicesOfGesture,
  STRUM_KEY_NAMES, ARPEGGIO_OFFSETS, SLOT_TICKS,
  type LearnCompOptions, type LearnCompResult,
} from "./comping.js";
