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

// ── Message envelope ─────────────────────────────────────────────────────────

export const PROTOCOL = "enkerli-suite" as const;
export const PROTOCOL_VERSION = 1;

export const MESSAGE_TYPES = ["scale", "chord", "progression", "pattern"] as const;
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
export interface PatternBody {
  /** Step count (mask bits beyond steps are meaningless). */
  steps: number;
  /** Rhythm mask, leftmost = LSB (onset i = bit i). Tresillo/8 = 73. */
  mask: number;
  name?: string;
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
      case "pattern":
        if (!Number.isInteger(b.steps) || (b.steps as number) < 1 || (b.steps as number) > 128)
          err("body.steps: integer 1–128 required");
        if (!Number.isInteger(b.mask) || (b.mask as number) < 0)
          err("body.mask: non-negative integer required (leftmost = LSB)");
        break;
    }
  }
  return { ok: errors.length === 0, errors };
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
