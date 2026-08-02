/**
 * @enkerli/protocol — the suite's live message protocol (plan §6, Track E2).
 *
 * A versioned JSON envelope carried over MIDI System Exclusive. SysEx is the
 * deliberately boring transport: suite plugins are MIDI plugins, so messages
 * ride ordinary MIDI routing — web app ↔ web app over an IAC bus (macOS,
 * today, no provisioning), web ↔ plugin and plugin ↔ plugin via host MIDI
 * routing (an enkerli-juce shim later speaks the same frames). The committed
 * vectors (vectors/protocol.json, drift-guarded by test) are the
 * cross-language contract for that C++ side, exactly like @enkerli/theory's
 * rhythm vectors.
 *
 * Frame layout (every data byte 7-bit clean):
 *   F0 7D 'E' 'K' <ver> | msgId(2×7) | chunkIndex(2×7) | chunkTotal(2×7)
 *   | payload, 7-in-8 packed | F7
 * 0x7D is the MIDI manufacturer id reserved for non-commercial use. The
 * payload is the UTF-8 JSON of a SuiteMessage, split across frames when it
 * exceeds the chunk size, MSB-packed (each group: 1 MSB byte + ≤7 data
 * bytes) so ♭/♯ and any other non-ASCII survive.
 *
 * Suite conventions carried through: `from`/`to` use @enkerli/library's app
 * vocabulary (one authority — LIS principle); every pitch-class or rhythm
 * mask is leftmost = LSB (element i = bit i = 2^i): C major = 0xAB5 = 2741,
 * tresillo (8 steps) = 73. Masks are NUMBERS here; hex-digit display
 * conventions stay app-side.
 */

import { APPS, type AppId } from "@enkerli/library";

// Re-exported: `AppId` and `Destination` are part of this protocol's public
// addressing surface (the envelope `from`/`to`), so consumers need not also
// depend on @enkerli/library just to name a sender or target.
export type { AppId };

// ── Message envelope ─────────────────────────────────────────────────────────

export const PROTOCOL = "enkerli-suite" as const;
export const PROTOCOL_VERSION = 1;

export const MESSAGE_TYPES = [
  // data-sharing (the original four)
  "scale", "chord", "progression", "pattern",
  // control & interop plane (docs/CONTROL_PLANE.md) — additive vocabulary,
  // still protocol v1: the wire envelope/framing is unchanged, only the set
  // of `type` values grows. A pre-plane receiver rejects these as unknown
  // types, which is correct — it cannot act on them.
  "manifest", "param", "command",
  // performance: play notes on an instrument (e.g. a progression/gesture/clip
  // source driving Vane). Distinct from `param` (timbre) — this is what sounds.
  "note",
] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];

/** `to` is an app id or "*" (broadcast — every listener may act). */
export type Destination = AppId | "*";

export interface SuiteMessage {
  protocol: typeof PROTOCOL;
  v: number;
  /** Message id (≥ 8 chars; UUID preferred) — future dedup/ack. */
  id: string;
  from: AppId;
  to: Destination;
  /** Absolute ISO 8601. */
  sentAt: string;
  type: MessageType;
  body: Record<string, unknown>;
}

/** PCS scale push (the canonical PickPCS → PitchFold pair). */
export interface ScaleBody {
  /** 12-bit pitch-class mask, leftmost = LSB (pc i = bit i). */
  mask: number;
  /** Root pitch class 0–11, optional. */
  root?: number;
  /** Display name in the sender's terms, optional. */
  name?: string;
}

/** Chord identification broadcast. */
export interface ChordBody {
  /** Pitch-class mask, leftmost = LSB. */
  pcs?: number;
  /** Concrete MIDI notes, when voicing matters. */
  notes?: number[];
  symbol?: string;
  root?: number;
}

/** A canonical Progression (@enkerli/theory §7 type), carried verbatim. */
export interface ProgressionBody {
  prog: Record<string, unknown>;
}

/** Serpe-style rhythm pattern. */
/**
 * One lane of a poly pattern. Lanes advance INDEPENDENTLY (INTENT D5) and each
 * carries its own accents (D8) — an accent mask on the pattern as a whole would
 * be the wrong shape.
 */
export interface PatternLane {
  /** This lane's own step count — lanes need not agree. */
  steps: number;
  /** Rhythm mask, leftmost = LSB. */
  mask: number;
  /** Lane label as the notation spelled it (`kick=E(4,16)` → "kick"). */
  name?: string;
  /**
   * Accent mask, leftmost = LSB, over this lane's steps. Per-lane by
   * construction: D8.
   */
  accents?: number;
  /**
   * Durational layer, when the lane carries `LS(r){mask}`: `longs` is the
   * per-step mask of which hits are LONG (leftmost = LSB, same convention as
   * `accents`), `lsRatio` how much longer.
   *
   * Carried because a receiver that only gets onsets plays every hit the same
   * length, and on drums that is the difference between an open hat and a
   * closed one. `msuite upi --wav` already honours it; a Workspace that did not
   * would show a pattern it cannot play.
   */
  longs?: number;
  lsRatio?: number;
  /**
   * MIDI note for this lane, when the sender has an opinion. Receivers
   * otherwise assign by position (base + index), which is what
   * `msuite upi --midi` does. Drum material is the case that needs it stated:
   * a kick is a particular pitch, not "lane 0".
   */
  note?: number;
}

export interface PatternBody {
  /**
   * Step count of LANE 1 (mask bits beyond steps are meaningless).
   *
   * `steps`/`mask` describe lane 1 alone and are required, so a mono receiver
   * written before poly existed still hears something musical rather than a
   * flattened union of every lane. `lanes` carries the whole truth.
   */
  steps: number;
  /** Rhythm mask of LANE 1, leftmost = LSB (onset i = bit i). Tresillo/8 = 73. */
  mask: number;
  name?: string;
  /**
   * Every lane, lane 1 first. Optional: a mono sender omits it. When present,
   * `lanes[0]` MUST agree with `steps`/`mask` — validated, because two
   * descriptions of the same lane are exactly the kind of pair that drifts.
   */
  lanes?: PatternLane[];
}

// ── Control & interop plane bodies (docs/CONTROL_PLANE.md) ───────────────────

/**
 * Controlled vocabulary for a parameter's unit — the authority a binder reads
 * to normalize (CC ↔ native), format, and range-check. Suite conventions
 * carry through: `pc-mask`/`rhythm-mask` values are integers, leftmost = LSB.
 */
export const PARAM_UNITS = [
  "ratio",       // dimensionless 0..1 (the modulation lingua franca)
  "percent",     // 0..100
  "count",       // integer quantity (steps, voices)
  "semitone",    // pitch interval
  "cents",
  "pc",          // pitch class 0..11
  "pc-mask",     // 12-bit pitch-class mask (leftmost = LSB)
  "rhythm-mask", // rhythm onset mask (leftmost = LSB)
  "bpm", "ms", "hz", "db",
  "bool",        // 0/1
  "enum",        // one of `values`
] as const;
export type ParamUnit = (typeof PARAM_UNITS)[number];

/** One addressable parameter in a tool's manifest. `id` is the contract. */
export interface ParamSpec {
  /** Stable, unique within the app, never localized (LIS identity). */
  id: string;
  /** Display label — localizable, never used for addressing. */
  label: string;
  unit: ParamUnit;
  /** Native range (min ≤ max). Lets any binder normalize to/from 0..1. */
  min: number;
  max: number;
  default: number;
  /** Optional quantization; absent = continuous. */
  step?: number;
  /**
   * How the native range maps to a normalized 0..1 knob/CC. "linear"
   * (default) or "log" (exponential — most of the musical action is low, e.g.
   * a filter cutoff). Surfaced by the Vane pilot, whose Cutoff/TrDecay are log.
   */
  scale?: "linear" | "log";
  /** For unit "enum": the ordered value labels (value is the index). */
  values?: string[];
}

/** One named argument of a command. */
export interface ArgSpec {
  id: string;
  unit: ParamUnit;
  min: number;
  max: number;
  default: number;
  values?: string[];
}

/** One invokable action in a tool's manifest. */
export interface CommandSpec {
  /** Stable, unique within the app, never localized. */
  name: string;
  label: string;
  args?: ArgSpec[];
}

/**
 * A tool's addressable surface — the keystone of the control plane. Carried
 * as a SuiteMessage (`type: "manifest"`) so tools are self-describing: a tool
 * broadcasts it on start and answers a `describe` command with it.
 */
export interface ManifestBody {
  /** The declaring app (redundant with the envelope `from`, but self-contained). */
  app: AppId;
  /** Manifest schema revision for this app (bump when ids change). */
  v: number;
  params: ParamSpec[];
  commands: CommandSpec[];
}

/** How a `param` message acts on its target. */
export const PARAM_MODES = ["set", "report", "observe"] as const;
export type ParamMode = (typeof PARAM_MODES)[number];

/**
 * Set, report, or observe one or more parameters. Structural validation only
 * here (id is a string, value a number) — manifest-conformance (id exists,
 * value in range) is the RECEIVER's job, since only it holds the manifest.
 */
export interface ParamBody {
  /** set (default) | report (tool announcing its own state) | observe (subscribe). */
  mode?: ParamMode;
  /** Single-param form. */
  id?: string;
  value?: number;
  /** Batch form (preset recall / one automation frame). */
  params?: Array<{ id: string; value: number }>;
}

/** Invoke a named action; args are named and manifest-validated by the receiver. */
export interface CommandBody {
  name: string;
  args?: Record<string, number>;
}

/**
 * Play notes on an instrument — the performance message (a progression, gesture,
 * or clip source driving Vane). `gate` sustains ("on"/"off"); alternatively a
 * `durationMs` makes it a self-releasing one-shot. Notes are MIDI numbers; the
 * receiver chooses voicing/channel allocation (Vane spreads them MPE-style).
 */
export interface NoteBody {
  /** MIDI note numbers 0–127 (a chord is many). */
  notes: number[];
  /** 0–127, default 100. */
  velocity?: number;
  /** MIDI channel 1–16, default 1 (receivers may reallocate for polyphony). */
  channel?: number;
  /** Sustained gate: "on" starts, "off" releases. Default "on". */
  gate?: "on" | "off";
  /** One-shot: start, then auto-release after this many ms (overrides gate). */
  durationMs?: number;
  /** Wind articulation name (GloriArp's inflect stage) — informational. */
  articulation?: string;
  /** Per-note breath envelope: breakpoints over the note's life
   *  (`at` = 0..1 of durationMs, `value` = 0..1 breath). Receivers with a
   *  breath axis (Vane's CC2, a rawmidi breath CC) render the curve; others
   *  ignore it. Meaningful only with durationMs. */
  env?: Array<{ at: number; value: number }>;
  /** Tonguing transient hint, native Vane transient-gain units (0..2).
   *  0 = slurred (no re-tonguing — what makes a legato slur a slur). */
  attack?: number;
  /** Portamento time in ms for THIS note's arrival (GloriArp's inflect
   *  `slide`; Vane's glide-time, native 0..2000ms). Absent/0 = instant —
   *  still legato-connected if articulation says so, just no audible glide. */
  glideMs?: number;
}

function newId(): string {
  const uuid = (globalThis as { crypto?: { randomUUID?: () => string } })
    .crypto?.randomUUID?.();
  return uuid ?? `msg${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** Build a well-formed message (id/sentAt/protocol filled in). */
export function makeMessage(
  from: AppId, type: MessageType, body: Record<string, unknown>,
  opts: { to?: Destination; id?: string; sentAt?: string } = {},
): SuiteMessage {
  return {
    protocol: PROTOCOL,
    v: PROTOCOL_VERSION,
    id: opts.id ?? newId(),
    from,
    to: opts.to ?? "*",
    sentAt: opts.sentAt ?? nowIso(),
    type,
    body,
  };
}

type MakeOpts = { to?: Destination; id?: string; sentAt?: string };

/** A tool announcing its addressable surface (`type: "manifest"`). */
export function makeManifest(from: AppId, body: ManifestBody, opts: MakeOpts = {}): SuiteMessage {
  return makeMessage(from, "manifest", body as unknown as Record<string, unknown>, opts);
}

/** Set / report / observe a parameter (`type: "param"`). */
export function makeParam(from: AppId, body: ParamBody, opts: MakeOpts = {}): SuiteMessage {
  return makeMessage(from, "param", { mode: "set", ...body } as Record<string, unknown>, opts);
}

/** Invoke a named action (`type: "command"`). */
export function makeCommand(from: AppId, body: CommandBody, opts: MakeOpts = {}): SuiteMessage {
  return makeMessage(from, "command", body as unknown as Record<string, unknown>, opts);
}

/** Play notes on an instrument (`type: "note"`). */
export function makeNote(from: AppId, body: NoteBody, opts: MakeOpts = {}): SuiteMessage {
  return makeMessage(from, "note", body as unknown as Record<string, unknown>, opts);
}

export interface ValidationResult { ok: boolean; errors: string[] }

const DATE_TIME_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

export function validateMessage(x: unknown): ValidationResult {
  const errors: string[] = [];
  const err = (m: string) => errors.push(m);
  if (!isPlainObject(x)) return { ok: false, errors: ["message: not an object"] };

  if (x.protocol !== PROTOCOL) err(`protocol: must be "${PROTOCOL}"`);
  if (!Number.isInteger(x.v) || (x.v as number) < 1) err("v: integer ≥ 1 required");
  if (typeof x.id !== "string" || x.id.length < 8) err("id: string ≥ 8 chars required");
  if (!(APPS as readonly string[]).includes(x.from as string))
    err(`from: not in the app vocabulary (${String(x.from)})`);
  if (x.to !== "*" && !(APPS as readonly string[]).includes(x.to as string))
    err(`to: "*" or an app id required (${String(x.to)})`);
  if (typeof x.sentAt !== "string" || !DATE_TIME_RE.test(x.sentAt))
    err("sentAt: absolute ISO 8601 required");
  if (!(MESSAGE_TYPES as readonly string[]).includes(x.type as string))
    err(`type: not a known message type (${String(x.type)})`);
  if (!isPlainObject(x.body)) err("body: object required");
  else {
    const b = x.body;
    const maskOk = (m: unknown, bits: number) =>
      Number.isInteger(m) && (m as number) >= 0 && (m as number) < 2 ** bits;
    switch (x.type) {
      case "scale":
        if (!maskOk(b.mask, 12)) err("body.mask: 12-bit integer required (leftmost = LSB)");
        if (b.root !== undefined && !(Number.isInteger(b.root) && (b.root as number) >= 0 && (b.root as number) <= 11))
          err("body.root: pitch class 0–11 required");
        break;
      case "chord":
        if (b.pcs !== undefined && !maskOk(b.pcs, 12)) err("body.pcs: 12-bit integer required");
        if (b.notes !== undefined &&
            (!Array.isArray(b.notes) || b.notes.some((n) => !Number.isInteger(n) || (n as number) < 0 || (n as number) > 127)))
          err("body.notes: array of MIDI notes 0–127 required");
        if (b.pcs === undefined && b.notes === undefined && b.symbol === undefined)
          err("body: chord needs at least one of pcs / notes / symbol");
        break;
      case "progression":
        if (!isPlainObject(b.prog)) err("body.prog: the canonical Progression object required");
        break;
      case "pattern": {
        if (!Number.isInteger(b.steps) || (b.steps as number) < 1 || (b.steps as number) > 128)
          err("body.steps: integer 1–128 required");
        if (!Number.isInteger(b.mask) || (b.mask as number) < 0)
          err("body.mask: non-negative integer required (leftmost = LSB)");
        if (b.lanes !== undefined) {
          if (!Array.isArray(b.lanes) || b.lanes.length === 0) {
            err("body.lanes: non-empty array of lanes required when present");
            break;
          }
          if ((b.lanes as unknown[]).length > 16) err("body.lanes: at most 16 lanes");
          (b.lanes as Record<string, unknown>[]).forEach((L, i) => {
            if (!isPlainObject(L)) { err(`body.lanes[${i}]: object required`); return; }
            if (!Number.isInteger(L.steps) || (L.steps as number) < 1 || (L.steps as number) > 128)
              err(`body.lanes[${i}].steps: integer 1–128 required`);
            if (!Number.isInteger(L.mask) || (L.mask as number) < 0)
              err(`body.lanes[${i}].mask: non-negative integer required`);
            if (L.accents !== undefined && (!Number.isInteger(L.accents) || (L.accents as number) < 0))
              err(`body.lanes[${i}].accents: non-negative integer mask required`);
            if (L.longs !== undefined && (!Number.isInteger(L.longs) || (L.longs as number) < 0))
              err(`body.lanes[${i}].longs: non-negative integer mask required`);
            if (L.lsRatio !== undefined && (typeof L.lsRatio !== "number" || !(L.lsRatio > 0)))
              err(`body.lanes[${i}].lsRatio: positive number required`);
            if (L.note !== undefined && (!Number.isInteger(L.note) || (L.note as number) < 0 || (L.note as number) > 127))
              err(`body.lanes[${i}].note: integer 0–127 required`);
          });
          // lanes[0] IS lane 1 — the compat fields must not disagree with it.
          const first = (b.lanes as Record<string, unknown>[])[0];
          if (isPlainObject(first) && (first.steps !== b.steps || first.mask !== b.mask))
            err("body.lanes[0] must match body.steps/body.mask — they describe the same lane");
        }
        break;
      }
      case "manifest":
        validateManifestBody(b, err);
        break;
      case "param":
        validateParamBody(b, err);
        break;
      case "command":
        if (typeof b.name !== "string" || b.name.length === 0)
          err("body.name: non-empty command name required");
        if (b.args !== undefined && !isPlainObject(b.args))
          err("body.args: object of named arguments required");
        break;
      case "note":
        if (!Array.isArray(b.notes) || b.notes.length === 0 ||
            b.notes.some((n) => !Number.isInteger(n) || (n as number) < 0 || (n as number) > 127))
          err("body.notes: non-empty array of MIDI notes 0–127 required");
        if (b.velocity !== undefined && !(Number.isInteger(b.velocity) && (b.velocity as number) >= 0 && (b.velocity as number) <= 127))
          err("body.velocity: integer 0–127 required");
        if (b.channel !== undefined && !(Number.isInteger(b.channel) && (b.channel as number) >= 1 && (b.channel as number) <= 16))
          err("body.channel: integer 1–16 required");
        if (b.gate !== undefined && b.gate !== "on" && b.gate !== "off")
          err('body.gate: "on" or "off" required');
        if (b.durationMs !== undefined && !(typeof b.durationMs === "number" && (b.durationMs as number) > 0))
          err("body.durationMs: positive number required");
        if (b.env !== undefined && !(Array.isArray(b.env) && (b.env as unknown[]).every((p) =>
          typeof p === "object" && p !== null &&
          typeof (p as { at?: unknown }).at === "number" && typeof (p as { value?: unknown }).value === "number")))
          err("body.env: array of {at, value} numbers required");
        if (b.glideMs !== undefined && !(typeof b.glideMs === "number" && (b.glideMs as number) >= 0))
          err("body.glideMs: non-negative number required");
        break;
    }
  }
  return { ok: errors.length === 0, errors };
}

const UNIT_SET = new Set<string>(PARAM_UNITS);

/** A param/arg spec is structurally sound: id, label, unit, ordered range, in-range default. */
function validateSpec(
  s: unknown, where: string, err: (m: string) => void, keyName: "id" | "name",
): void {
  if (!isPlainObject(s)) { err(`${where}: object required`); return; }
  if (typeof s[keyName] !== "string" || (s[keyName] as string).length === 0)
    err(`${where}.${keyName}: non-empty string required`);
  if (keyName === "id" && s.label !== undefined && typeof s.label !== "string")
    err(`${where}.label: string required`);
  if (!UNIT_SET.has(s.unit as string))
    err(`${where}.unit: one of ${PARAM_UNITS.join("|")} required (${String(s.unit)})`);
  const nums = ["min", "max", "default"] as const;
  for (const k of nums)
    if (typeof s[k] !== "number" || !Number.isFinite(s[k] as number))
      err(`${where}.${k}: finite number required`);
  if (typeof s.min === "number" && typeof s.max === "number" && (s.min as number) > (s.max as number))
    err(`${where}: min must be ≤ max`);
  if (typeof s.default === "number" && typeof s.min === "number" && typeof s.max === "number" &&
      ((s.default as number) < (s.min as number) || (s.default as number) > (s.max as number)))
    err(`${where}.default: must be within [min, max]`);
  if (s.step !== undefined && (typeof s.step !== "number" || (s.step as number) <= 0))
    err(`${where}.step: positive number required`);
  if (s.scale !== undefined && s.scale !== "linear" && s.scale !== "log")
    err(`${where}.scale: "linear" or "log" required`);
  if (s.scale === "log" && (typeof s.min === "number") && (s.min as number) <= 0)
    err(`${where}: log scale requires min > 0`);
  if (s.unit === "enum" && (!Array.isArray(s.values) || (s.values as unknown[]).length === 0))
    err(`${where}: enum unit requires a non-empty values[]`);
}

function validateManifestBody(b: Record<string, unknown>, err: (m: string) => void): void {
  if (!(APPS as readonly string[]).includes(b.app as string))
    err(`body.app: not in the app vocabulary (${String(b.app)})`);
  if (!Number.isInteger(b.v) || (b.v as number) < 1) err("body.v: integer ≥ 1 required");
  if (!Array.isArray(b.params)) err("body.params: array required");
  else {
    const ids = new Set<string>();
    b.params.forEach((p, i) => {
      validateSpec(p, `body.params[${i}]`, err, "id");
      const id = isPlainObject(p) ? (p.id as string) : undefined;
      if (typeof id === "string") {
        if (ids.has(id)) err(`body.params[${i}].id: duplicate "${id}"`);
        ids.add(id);
      }
    });
  }
  if (!Array.isArray(b.commands)) err("body.commands: array required");
  else b.commands.forEach((c, i) => {
    if (!isPlainObject(c)) { err(`body.commands[${i}]: object required`); return; }
    if (typeof c.name !== "string" || c.name.length === 0)
      err(`body.commands[${i}].name: non-empty string required`);
    if (typeof c.label !== "string") err(`body.commands[${i}].label: string required`);
    if (c.args !== undefined) {
      if (!Array.isArray(c.args)) err(`body.commands[${i}].args: array required`);
      else c.args.forEach((a, j) => validateSpec(a, `body.commands[${i}].args[${j}]`, err, "id"));
    }
  });
}

function validateParamBody(b: Record<string, unknown>, err: (m: string) => void): void {
  if (b.mode !== undefined && !(PARAM_MODES as readonly string[]).includes(b.mode as string))
    err(`body.mode: one of ${PARAM_MODES.join("|")} required`);
  const single = b.id !== undefined;
  const batch = b.params !== undefined;
  if (single === batch) err("body: exactly one of single (id+value) or batch (params[]) required");
  if (single) {
    if (typeof b.id !== "string" || (b.id as string).length === 0) err("body.id: non-empty string required");
    if (typeof b.value !== "number" || !Number.isFinite(b.value as number))
      err("body.value: finite number required");
  }
  if (batch) {
    if (!Array.isArray(b.params) || b.params.length === 0) err("body.params: non-empty array required");
    else b.params.forEach((p, i) => {
      if (!isPlainObject(p) || typeof p.id !== "string" || (p.id as string).length === 0)
        err(`body.params[${i}].id: non-empty string required`);
      else if (typeof p.value !== "number" || !Number.isFinite(p.value as number))
        err(`body.params[${i}].value: finite number required`);
    });
  }
}

// ── 7-in-8 packing (SysEx data bytes must stay below 0x80) ──────────────────

/**
 * Pack arbitrary bytes into 7-bit-clean groups: each group of ≤7 input bytes
 * is emitted as one MSB byte (bit i = input byte i's high bit) followed by
 * the 7-bit remainders. The classic SysEx packing — dense (8/7) and trivial
 * to mirror in C++.
 */
export function pack7(bytes: Uint8Array): Uint8Array {
  const groups = Math.ceil(bytes.length / 7);
  const out = new Uint8Array(bytes.length + groups);
  let o = 0;
  for (let g = 0; g < groups; g++) {
    const start = g * 7;
    const n = Math.min(7, bytes.length - start);
    let msb = 0;
    for (let i = 0; i < n; i++) if (bytes[start + i]! & 0x80) msb |= 1 << i;
    out[o++] = msb;
    for (let i = 0; i < n; i++) out[o++] = bytes[start + i]! & 0x7f;
  }
  return out;
}

/** Reverse of pack7. Throws on a malformed stream (any byte ≥ 0x80). */
export function unpack7(packed: Uint8Array): Uint8Array {
  const out: number[] = [];
  let i = 0;
  while (i < packed.length) {
    const msb = packed[i++]!;
    if (msb & 0x80) throw new Error("unpack7: byte ≥ 0x80 in packed stream");
    const n = Math.min(7, packed.length - i);
    for (let j = 0; j < n; j++) {
      const b = packed[i + j]!;
      if (b & 0x80) throw new Error("unpack7: byte ≥ 0x80 in packed stream");
      out.push(b | ((msb >> j) & 1 ? 0x80 : 0));
    }
    i += n;
  }
  return new Uint8Array(out);
}

// ── Framing & chunking ───────────────────────────────────────────────────────

export const SYSEX_START = 0xf0;
export const SYSEX_END = 0xf7;
/** MIDI manufacturer id reserved for non-commercial/educational use. */
export const MANUFACTURER_ID = 0x7d;
/** Suite tag bytes: "E" "K" (both 7-bit clean). */
export const TAG = [0x45, 0x4b] as const;

const HEADER_LEN = 11; // F0 7D 45 4B ver id id idx idx tot tot

/**
 * Raw payload bytes per frame before packing. 720 raw → 823 packed → 834-byte
 * frames: comfortably under common host/driver SysEx buffer limits (1 KB).
 */
export const DEFAULT_CHUNK_BYTES = 720;

function push14(out: number[], v: number): void {
  out.push((v >> 7) & 0x7f, v & 0x7f);
}

export interface FrameInfo {
  msgId: number;
  index: number;
  total: number;
  /** This frame's UNPACKED payload bytes. */
  data: Uint8Array;
}

/**
 * Encode a message into one or more complete SysEx frames (F0 … F7 included,
 * ready for a raw MIDI send). Throws when the message fails validation —
 * never put a malformed message on the wire.
 */
export function encodeMessage(
  msg: SuiteMessage, opts: { chunkBytes?: number; msgId?: number } = {},
): Uint8Array[] {
  const r = validateMessage(msg);
  if (!r.ok) throw new Error(`invalid suite message: ${r.errors.join("; ")}`);
  const chunkBytes = Math.max(1, opts.chunkBytes ?? DEFAULT_CHUNK_BYTES);
  const json = new TextEncoder().encode(JSON.stringify(msg));
  const total = Math.max(1, Math.ceil(json.length / chunkBytes));
  if (total > 16383) throw new Error("message too large (chunk total exceeds 14 bits)");
  const msgId = (opts.msgId ?? Math.floor(Math.random() * 16384)) & 0x3fff;

  const frames: Uint8Array[] = [];
  for (let c = 0; c < total; c++) {
    const raw = json.subarray(c * chunkBytes, (c + 1) * chunkBytes);
    const head: number[] = [SYSEX_START, MANUFACTURER_ID, TAG[0], TAG[1], PROTOCOL_VERSION];
    push14(head, msgId);
    push14(head, c);
    push14(head, total);
    frames.push(Uint8Array.from([...head, ...pack7(raw), SYSEX_END]));
  }
  return frames;
}

/**
 * Parse one SysEx frame. Returns null for anything that is not a suite frame
 * (other manufacturers, other tags, wrong version) — safe to feed every
 * SysEx the port receives.
 */
export function decodeFrame(frame: Uint8Array): FrameInfo | null {
  if (frame.length < HEADER_LEN + 1) return null;
  if (frame[0] !== SYSEX_START || frame[frame.length - 1] !== SYSEX_END) return null;
  if (frame[1] !== MANUFACTURER_ID || frame[2] !== TAG[0] || frame[3] !== TAG[1]) return null;
  if (frame[4] !== PROTOCOL_VERSION) return null;
  const at = (i: number) => frame[HEADER_LEN - 6 + i]!;
  const msgId = (at(0) << 7) | at(1);
  const index = (at(2) << 7) | at(3);
  const total = (at(4) << 7) | at(5);
  if (total < 1 || index >= total) return null;
  let data: Uint8Array;
  try {
    data = unpack7(frame.subarray(HEADER_LEN, frame.length - 1));
  } catch {
    return null;
  }
  return { msgId, index, total, data };
}

/**
 * Reassemble chunked messages, tolerant of interleaving (different msgIds in
 * flight) and out-of-order arrival. Incomplete messages are evicted after
 * `staleMs` so a lost chunk can't leak memory. push() returns the completed,
 * validated SuiteMessage, or null while waiting / for foreign SysEx.
 */
export class Reassembler {
  private pending = new Map<number, { total: number; parts: Map<number, Uint8Array>; at: number }>();

  constructor(private readonly staleMs = 60_000) {}

  push(frame: Uint8Array, now = Date.now()): SuiteMessage | null {
    this.evict(now);
    const f = decodeFrame(frame);
    if (!f) return null;

    let entry = this.pending.get(f.msgId);
    if (!entry || entry.total !== f.total) {
      entry = { total: f.total, parts: new Map(), at: now };
      this.pending.set(f.msgId, entry);
    }
    entry.parts.set(f.index, f.data);
    entry.at = now;
    if (entry.parts.size < entry.total) return null;

    this.pending.delete(f.msgId);
    const len = [...entry.parts.values()].reduce((n, p) => n + p.length, 0);
    const bytes = new Uint8Array(len);
    let o = 0;
    for (let i = 0; i < entry.total; i++) {
      const part = entry.parts.get(i);
      if (!part) return null; // duplicate indices masked a hole
      bytes.set(part, o);
      o += part.length;
    }
    try {
      const msg: unknown = JSON.parse(new TextDecoder().decode(bytes));
      return validateMessage(msg).ok ? (msg as SuiteMessage) : null;
    } catch {
      return null;
    }
  }

  private evict(now: number): void {
    for (const [id, e] of this.pending)
      if (now - e.at > this.staleMs) this.pending.delete(id);
  }
}
