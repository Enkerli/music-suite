/**
 * `msuite rnd` — headless work with a Cymaforma RND Synth.
 *
 * The codec lives in @enkerli/rnd, shared with the Workspace module and checked
 * against the same vectors as the C++ implementation in the rnd-companion repo,
 * so a seed means the same thing in a plugin, a browser, and a pipe.
 *
 * Two halves, as elsewhere in this CLI:
 *   · pure — encode, decode, scan a capture. Runs anywhere, tested directly.
 *   · effectful — writing to and reading from an ALSA rawmidi device. Linux
 *     only, and dependency-free for the same reason midiout.ts is: rawmidi
 *     devices are plain character files, so "sending SysEx" is writing bytes.
 *     On macOS the live path is the plugin or the browser.
 */
import { readFileSync } from "node:fs";
import { open } from "node:fs/promises";

import {
  applyMessage,
  decodeSysex,
  describeForeignSysex,
  emptyStatus,
  encodeSeed,
  encodeUnlockAndDump,
  formatSeed,
  hasManufacturerTag,
  parseSeed,
  rootName,
  scaleName,
  summarize,
  sysexFromSmf,
  toHex,
  type DeviceStatus,
  type RndMessage,
} from "@enkerli/rnd";

// ── Pure ─────────────────────────────────────────────────────────────────────

export interface ScanRow {
  tick: number;
  hex: string;
  /** null when the frame is not ours, or is ours but will not parse. */
  message: RndMessage | null;
  note: string;
}

/**
 * Every SysEx frame in a capture, decoded. Frames that are not ours are
 * labelled rather than dropped — a capture full of somebody else's SysEx is
 * useful information, not noise.
 */
export function scanCapture(bytes: Uint8Array): { rows: ScanRow[]; status: DeviceStatus } {
  let status = emptyStatus();
  const rows: ScanRow[] = [];

  for (const frame of sysexFromSmf(bytes)) {
    const message = decodeSysex(frame.bytes);
    let note: string;

    if (message) {
      note = summarize(message);
      status = applyMessage(status, message);
    } else if (hasManufacturerTag(frame.bytes)) {
      note = "OUR TAG BUT DAMAGED";
    } else {
      note = describeForeignSysex(frame.bytes) ?? "unrecognised";
    }

    rows.push({ tick: frame.tick, hex: toHex(frame.bytes), message, note });
  }

  return { rows, status };
}

export function describeStatus(status: DeviceStatus): string[] {
  const lines: string[] = [];

  lines.push(status.seed !== undefined ? `seed      ${formatSeed(status.seed)}` : "seed      (not seen)");

  if (status.tempoBpm !== undefined) lines.push(`tempo     ${status.tempoBpm} BPM as reported`);
  if (status.patchMode !== undefined) lines.push(`mode      ${status.patchMode}`);
  if (status.scaleIndex !== undefined) lines.push(`scale     ${scaleName(status.scaleIndex)}`);
  // Labelled as a sample, because it is: the device reports the root it is
  // playing now, and that moves while the patch runs.
  if (status.root !== undefined) lines.push(`root      ${rootName(status.root)} (when captured)`);

  if (status.engines.length)
    lines.push(`engines   ${status.engines.map((e) => `${e.index}:${e.name}`).join("  ")}`);

  return lines;
}

// ── Effectful: ALSA rawmidi ──────────────────────────────────────────────────

export async function writeRawMidi(devicePath: string, bytes: number[]): Promise<void> {
  const handle = await open(devicePath, "w");
  try {
    await handle.write(Uint8Array.from(bytes));
  } finally {
    await handle.close();
  }
}

/**
 * Reads frames off a rawmidi device until `signal` aborts, calling `onFrame`
 * for each complete SysEx. Everything that is not SysEx is ignored: this is a
 * seed watcher, not a MIDI monitor.
 *
 * The device re-broadcasts its whole status hundreds of times a second once
 * poked, so callers are expected to filter — see `watchSeeds`.
 */
export async function readSysexStream(
  devicePath: string,
  onFrame: (bytes: number[]) => void,
  signal?: AbortSignal,
): Promise<void> {
  const handle = await open(devicePath, "r");
  const buffer = Buffer.alloc(1024);
  let frame: number[] | null = null;

  try {
    while (!signal?.aborted) {
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
      if (bytesRead <= 0) continue;

      for (let i = 0; i < bytesRead; i++) {
        const byte = buffer[i] ?? 0;

        if (byte === 0xf0) {
          frame = [byte];
        } else if (frame) {
          frame.push(byte);
          if (byte === 0xf7) {
            onFrame(frame);
            frame = null;
          } else if (frame.length > 4096) {
            frame = null; // never grow without bound on a malformed stream
          }
        }
      }
    }
  } finally {
    await handle.close();
  }
}

// ── Command surface ──────────────────────────────────────────────────────────

export const RND_USAGE = `msuite rnd <subcommand>
  seed <value>                    build the SysEx frame for a seed (hex out)
  read                            build the status-request frame (mutes the device briefly)
  decode <hex…>                   decode SysEx bytes: "F0 6F 62 78 10 …" or bare
  scan <capture.mid> [--json]     every SysEx frame in a MIDI capture, decoded
  send <value> --port <path>      write a seed to an ALSA rawmidi device (Linux)
  watch --port <path> [--all]     print seeds as the device broadcasts them

Values are hex ("0xaa442ce7"), bare hex, or decimal. --port takes a
/dev/snd/midiC*D* path; "msuite midi ports" lists them.`;

export interface RndResult {
  lines: string[];
  code: number;
}

/**
 * The pure subcommands, split out so they can be tested without a device.
 * `flags` is anything with a `has` — the CLI's parser hands over a Map.
 */
export function runRndPure(
  sub: string,
  positional: string[],
  flags: { has(name: string): boolean },
): RndResult | null {
  switch (sub) {
    case "seed": {
      const value = parseSeed(positional[0] ?? "");
      if (value === null) return { lines: [`rnd seed: "${positional[0] ?? ""}" is not a seed`], code: 1 };
      return { lines: [toHex(encodeSeed(value))], code: 0 };
    }

    case "read":
      return { lines: [toHex(encodeUnlockAndDump())], code: 0 };

    case "decode": {
      const bytes = positional.flatMap((t) => t.split(/[\s,]+/)).filter(Boolean)
        .map((t) => Number.parseInt(t.replace(/^0x/i, ""), 16) & 0xff);

      if (!bytes.length) return { lines: ["rnd decode: some hex bytes, please"], code: 1 };

      const message = decodeSysex(bytes);
      if (message) return { lines: [summarize(message)], code: 0 };

      const foreign = describeForeignSysex(bytes);
      if (foreign) return { lines: [`not ours: ${foreign}`], code: 1 };

      return { lines: ["our manufacturer tag, but the frame does not parse"], code: 1 };
    }

    case "scan": {
      const path = positional[0];
      if (!path) return { lines: ["rnd scan: a .mid path is required"], code: 1 };

      const { rows, status } = scanCapture(new Uint8Array(readFileSync(path)));

      if (flags.has("json"))
        return { lines: [JSON.stringify({ rows, status }, null, 2)], code: 0 };

      const lines = rows.map((r) => `${String(r.tick).padStart(8)}  ${r.note}`);
      lines.push("", ...describeStatus(status));

      if (!rows.length) lines.unshift("no SysEx in this capture");
      return { lines, code: 0 };
    }

    default:
      return null;   // not a pure subcommand
  }
}
