/**
 * @enkerli/rnd — the wire codec for the Cymaforma RND Synth.
 *
 * A TypeScript twin of the C++ codec in the rnd-companion repo
 * (Source/Protocol/RndProtocol.{h,cpp}). The two are checked against the same
 * vectors — `vectors/frames.json` here, `Tests/ProtocolTests.cpp` there — so
 * the plugin, the CLI, and the Workspace module cannot quietly disagree about
 * what a seed frame is.
 *
 * None of this is a published spec. It was read off a third-party web app's
 * client code and confirmed against captures from real hardware; see
 * rnd-companion/docs/PROTOCOL.md for what is confirmed versus inferred, and for
 * the caveats that matter musically (the scale/root lock, the moving root byte,
 * reverb applying only to the analog mix).
 *
 * Every frame is  F0 6F 62 78 <cmd> [payload…] F7.  `6F 62 78` is ASCII "obx".
 * 0x6F sits inside the MMA-allocated single-byte manufacturer range rather than
 * the 0x7D non-commercial slot, so the tag alone does not prove the sender is an
 * RND — match the port name too.
 */

export const SYSEX_BEGIN = 0xf0;
export const SYSEX_END = 0xf7;

/** ASCII "obx". */
export const MANUFACTURER_TAG = [0x6f, 0x62, 0x78] as const;

export const Command = {
  seed: 0x10,
  /** Host→device: play-lock = payload[0], then dump status. Mutes briefly. */
  unlock: 0x11,
  /** Device→host: empty payload, opens a dump. */
  dumpBegin: 0x20,
  globals: 0x21,
  trackEngine: 0x22,
} as const;

export type CommandName = keyof typeof Command;

// ── Seeds ────────────────────────────────────────────────────────────────────

/**
 * A 32-bit seed travels as five 7-bit bytes, least-significant septet first —
 * the suite's leftmost = LSB convention, as it happens (CONVENTIONS.md). The
 * fifth byte carries only the top nibble.
 */
export function packSeed(seed: number): number[] {
  const u = seed >>> 0;
  return [u & 0x7f, (u >>> 7) & 0x7f, (u >>> 14) & 0x7f, (u >>> 21) & 0x7f, (u >>> 28) & 0x0f];
}

export function unpackSeed(bytes: ArrayLike<number>): number {
  return (
    (((bytes[0] ?? 0) & 0x7f) |
      (((bytes[1] ?? 0) & 0x7f) << 7) |
      (((bytes[2] ?? 0) & 0x7f) << 14) |
      (((bytes[3] ?? 0) & 0x7f) << 21) |
      (((bytes[4] ?? 0) & 0x0f) << 28)) >>>
    0
  );
}

/** "0x0123abcd" — the form seeds are usually written in. */
export function formatSeed(seed: number): string {
  return `0x${(seed >>> 0).toString(16).padStart(8, "0")}`;
}

/**
 * Accepts "0x1234abcd", bare hex, or a decimal integer. Digits-only input is
 * read as decimal, so typing a tempo-looking number means that number.
 * Returns null rather than throwing, so a UI can validate as you type.
 */
export function parseSeed(text: string): number | null {
  const s = String(text ?? "").trim().toLowerCase();
  if (!s) return null;

  let body = s;
  let base = 10;

  if (body.startsWith("0x")) {
    body = body.slice(2);
    base = 16;
  } else if (/[a-f]/.test(body)) {
    base = 16;
  }

  if (!body || !/^[0-9a-f]+$/.test(body)) return null;
  if (base === 16 && body.length > 8) return null;
  if (base === 10 && body.length > 10) return null;

  const value = Number.parseInt(body, base);
  if (!Number.isFinite(value) || value < 0 || value > 0xffffffff) return null;

  return value >>> 0;
}

// ── Decoded messages ─────────────────────────────────────────────────────────

export interface SeedMessage {
  kind: "seed";
  seed: number;
}
export interface DumpBeginMessage {
  kind: "dumpBegin";
}
export interface GlobalsMessage {
  kind: "globals";
  patchMode: number;
  /** As reported. See PROTOCOL.md before driving a clock from it. */
  tempoBpm: number;
  /** The root the device is playing *now*; it moves while a patch runs. */
  root: number;
  scaleIndex: number;
}
export interface TrackEngineMessage {
  kind: "trackEngine";
  trackIndex: number;
  /** Two per-track fields whose meaning is unknown; they are not constants. */
  unknownA: number;
  unknownB: number;
  engineName: string;
}

export type RndMessage = SeedMessage | DumpBeginMessage | GlobalsMessage | TrackEngineMessage;

/** Strips an optional F0 and F7 so hosts that trim either still parse. */
function bodyOf(bytes: ArrayLike<number>): number[] {
  const all = Array.from(bytes);
  const start = all[0] === SYSEX_BEGIN ? 1 : 0;
  const end = all.length > start && all[all.length - 1] === SYSEX_END ? all.length - 1 : all.length;
  return all.slice(start, end);
}

/**
 * True when a frame carries the RND manufacturer tag, whatever follows it.
 *
 * This is the difference between "someone else's SysEx" and "our SysEx,
 * damaged" — worth drawing carefully: a host that delivers another vendor's
 * frame intact has proved it passes SysEx, while one that delivers ours broken
 * has proved the opposite.
 */
export function hasManufacturerTag(bytes: ArrayLike<number>): boolean {
  const body = bodyOf(bytes);
  return MANUFACTURER_TAG.every((b, i) => body[i] === b);
}

/** A label for a frame that is not ours, or null if it is ours. */
export function describeForeignSysex(bytes: ArrayLike<number>): string | null {
  if (hasManufacturerTag(bytes)) return null;

  const body = bodyOf(bytes);
  if (body.length === 0) return "empty SysEx";

  switch (body[0]) {
    case 0x7e:
      return "universal non-real-time SysEx";
    case 0x7f:
      return "universal real-time SysEx";
    case 0x7d:
      return "non-commercial SysEx";
    default:
      return `manufacturer 0x${(body[0] ?? 0).toString(16).padStart(2, "0").toUpperCase()} SysEx`;
  }
}

/**
 * Decodes one complete frame. Returns null when the bytes are not a well-formed
 * RND frame — wrong tag, unknown command, or a truncated payload. Never throws,
 * never partially applies.
 */
export function decodeSysex(bytes: ArrayLike<number>): RndMessage | null {
  const body = bodyOf(bytes);
  if (body.length < MANUFACTURER_TAG.length + 1) return null;
  if (!hasManufacturerTag(bytes)) return null;

  const command = body[MANUFACTURER_TAG.length];
  const payload = body.slice(MANUFACTURER_TAG.length + 1);

  switch (command) {
    case Command.seed:
      if (payload.length < 5) return null;
      return { kind: "seed", seed: unpackSeed(payload) };

    case Command.dumpBegin:
      if (payload.length !== 0) return null;
      return { kind: "dumpBegin" };

    case Command.globals: {
      if (payload.length < 5) return null;
      return {
        kind: "globals",
        patchMode: payload[0] ?? 0,
        tempoBpm: ((payload[1] ?? 0) & 0x7f) | (((payload[2] ?? 0) & 0x7f) << 7),
        root: payload[3] ?? 0,
        scaleIndex: payload[4] ?? 0,
      };
    }

    case Command.trackEngine: {
      if (payload.length < 3) return null;
      let name = "";
      for (let i = 3; i < payload.length; i++) {
        const c = payload[i] ?? 0;
        if (c === 0) break;
        name += String.fromCharCode(c);
      }
      return {
        kind: "trackEngine",
        trackIndex: payload[0] ?? 0,
        unknownA: payload[1] ?? 0,
        unknownB: payload[2] ?? 0,
        engineName: name,
      };
    }

    // Host→device only. Seeing it means we are watching our own output.
    default:
      return null;
  }
}

// ── Encoded messages (host → device) ─────────────────────────────────────────

function frame(command: number, payload: number[] = []): number[] {
  return [SYSEX_BEGIN, ...MANUFACTURER_TAG, command, ...payload, SYSEX_END];
}

export function encodeSeed(seed: number): number[] {
  return frame(Command.seed, packSeed(seed));
}

/**
 * Clears the play-lock and asks for a status dump. Costs a brief audible mute,
 * so drive it from an explicit action — never a timer. You do not need it to
 * follow the seed: the RND broadcasts one whenever its seed changes.
 */
export function encodeUnlockAndDump(): number[] {
  return frame(Command.unlock, [0x00]);
}

// ── Control-change layer ─────────────────────────────────────────────────────

export const CC = { scale: 9, volume: 7, reverb: 91 } as const;

/** Master (ch 1) plus the per-track takeover band (ch 2–5). 1-based. */
export const MIX_CHANNELS = [1, 2, 3, 4, 5] as const;

export const NUM_SCALES = 20;
export const NUM_ROOTS = 12;

/** The device's own CC9 band midpoints; equals floor(3.2 + 6.4 * index). */
const SCALE_CC_MIDPOINTS = [
  3, 9, 16, 22, 28, 35, 41, 48, 54, 60, 67, 73, 80, 86, 92, 99, 105, 112, 118, 124,
] as const;

export function scaleCcValue(scaleIndex: number): number {
  return SCALE_CC_MIDPOINTS[scaleIndex] ?? SCALE_CC_MIDPOINTS[0];
}

export function scaleIndexForCc(value: number): number {
  return Math.min(NUM_SCALES - 1, Math.floor(((value & 0x7f) * NUM_SCALES) / 128));
}

/**
 * Root is set by pulsing a note on channel 1 — channel 1 notes are read as
 * roots, not as notes to play. Channels 2–5 play their instrument.
 */
export const ROOT_NOTE_BASE = 60;

export function rootNoteNumber(pitchClass: number): number {
  return ROOT_NOTE_BASE + (((pitchClass % NUM_ROOTS) + NUM_ROOTS) % NUM_ROOTS);
}

/**
 * Chromatic names, deliberately: a root byte arrives as a bare pitch class with
 * no chord or scale context to spell it from, and the suite convention is that
 * bare pitch-class data stays chromatic (CONVENTIONS.md).
 */
const ROOT_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

/** Index order is the device's. */
const SCALE_NAMES = [
  "major", "minor", "harmonic minor", "blues", "major pentatonic", "minor pentatonic",
  "dorian", "phrygian", "lydian", "mixolydian", "locrian", "whole tone",
  "double harmonic", "hungarian minor", "phrygian dominant", "hirajoshi", "insen",
  "prometheus", "octatonic (WT/HT)", "persian",
] as const;

export function rootName(pitchClass: number): string {
  return ROOT_NAMES[pitchClass] ?? "?";
}

export function scaleName(scaleIndex: number): string {
  return SCALE_NAMES[scaleIndex] ?? "?";
}

// ── Accumulated device state ─────────────────────────────────────────────────

export interface TrackEngine {
  index: number;
  name: string;
}

export interface DeviceStatus {
  seed?: number;
  patchMode?: number;
  tempoBpm?: number;
  root?: number;
  scaleIndex?: number;
  engines: TrackEngine[];
}

export function emptyStatus(): DeviceStatus {
  return { engines: [] };
}

/**
 * Folds one decoded frame into a status. A `seed` or `dumpBegin` clears the
 * engine list: both mean a new patch is being described, so the old engine
 * names no longer apply. Returns a new object rather than mutating.
 */
export function applyMessage(status: DeviceStatus, message: RndMessage): DeviceStatus {
  switch (message.kind) {
    case "seed":
      return { ...status, seed: message.seed, engines: [] };

    case "dumpBegin":
      return { ...status, engines: [] };

    case "globals":
      return {
        ...status,
        patchMode: message.patchMode,
        tempoBpm: message.tempoBpm,
        root: message.root,
        scaleIndex: message.scaleIndex,
      };

    case "trackEngine": {
      const engines = status.engines.filter((e) => e.index !== message.trackIndex);
      engines.push({ index: message.trackIndex, name: message.engineName });
      engines.sort((a, b) => a.index - b.index);
      return { ...status, engines };
    }
  }
}

/** One line describing a decoded frame, for logs and the CLI. */
export function summarize(message: RndMessage): string {
  switch (message.kind) {
    case "seed":
      return `seed ${formatSeed(message.seed)}`;
    case "dumpBegin":
      return "dump begin";
    case "globals":
      return `globals: mode ${message.patchMode}, ${message.tempoBpm} BPM, root ${rootName(
        message.root,
      )}, ${scaleName(message.scaleIndex)}`;
    case "trackEngine":
      return `track ${message.trackIndex} engine "${message.engineName}" (${message.unknownA}, ${message.unknownB})`;
  }
}

export function toHex(bytes: ArrayLike<number>): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
    .join(" ");
}

export function fromHex(text: string): number[] {
  const cleaned = text.replace(/0x/gi, " ").replace(/[,]/g, " ").trim();
  if (!cleaned) return [];
  return cleaned.split(/\s+/).map((t) => Number.parseInt(t, 16) & 0xff);
}

// ── SysEx out of a Standard MIDI File ────────────────────────────────────────

export interface CapturedFrame {
  tick: number;
  bytes: number[];
}

/**
 * Pulls every SysEx frame out of an SMF, in order. Just enough MIDI-file
 * reading to replay a hardware capture — @enkerli/midi owns real SMF work.
 */
export function sysexFromSmf(data: Uint8Array): CapturedFrame[] {
  const frames: CapturedFrame[] = [];
  let pos = 0;

  const u32 = () => {
    const v =
      ((data[pos] ?? 0) << 24) | ((data[pos + 1] ?? 0) << 16) | ((data[pos + 2] ?? 0) << 8) | (data[pos + 3] ?? 0);
    pos += 4;
    return v >>> 0;
  };
  const u16 = () => {
    const v = ((data[pos] ?? 0) << 8) | (data[pos + 1] ?? 0);
    pos += 2;
    return v;
  };
  const vlq = () => {
    let v = 0;
    for (;;) {
      const b = data[pos++] ?? 0;
      v = (v << 7) | (b & 0x7f);
      if ((b & 0x80) === 0) return v;
    }
  };

  if (String.fromCharCode(...data.slice(0, 4)) !== "MThd") return frames;
  pos = 4;
  const headerLength = u32();
  const headerEnd = pos + headerLength;
  u16(); // format
  const numTracks = u16();
  pos = headerEnd;

  for (let track = 0; track < numTracks && pos < data.length; track++) {
    if (String.fromCharCode(...data.slice(pos, pos + 4)) !== "MTrk") break;
    pos += 4;
    const trackLength = u32();
    const trackEnd = pos + trackLength;

    let tick = 0;
    let runningStatus = 0;

    while (pos < trackEnd) {
      tick += vlq();
      const next = data[pos] ?? 0;

      if (next === 0xff) {
        pos += 2; // 0xFF + meta type
        const length = vlq();
        pos += length;
        continue;
      }

      if (next === 0xf0 || next === 0xf7) {
        pos += 1;
        const length = vlq();
        const bytes = next === 0xf0 ? [0xf0, ...data.slice(pos, pos + length)] : [...data.slice(pos, pos + length)];
        pos += length;
        frames.push({ tick, bytes });
        continue;
      }

      if ((next & 0x80) !== 0) {
        runningStatus = next;
        pos += 1;
      }

      const kind = runningStatus & 0xf0;
      pos += kind === 0xc0 || kind === 0xd0 ? 1 : 2;
    }

    pos = trackEnd;
  }

  return frames;
}
