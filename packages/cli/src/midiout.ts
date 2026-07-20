/**
 * MIDI out — the suite's messages becoming REAL MIDI bytes
 * (docs/PRIORITIES.md §1, slice A: the P1 "Plug & Jam" unblocker).
 *
 * Linux-first and dependency-free by design: ALSA rawmidi devices are plain
 * character devices (`/dev/snd/midiC<card>D<dev>`), so "sending MIDI" is
 * writing 3-byte messages to a file. `modprobe snd-virmidi` provides VIRTUAL
 * rawmidi devices bridged to the ALSA sequencer — write here, `aconnect` the
 * resulting port into jalv (Vane LV2), fluidsynth, or hardware. macOS's live
 * path stays the browser bridge (transport 4); the miniPC target IS Linux.
 *
 * Two layers, both pure over their effects for testability:
 *   · noteMessageToMidi — a control-plane `note` SuiteMessage → MIDI events
 *   · createMidiPlayer  — a stateful consumer that writes note-ons now,
 *     schedules the self-releasing note-offs (durationMs), tracks what's
 *     sounding, and can silence everything (Ctrl-C must never leave a note
 *     hanging on an external synth — unlike the WASM voice, it remembers).
 *
 * Breath: Vane is a wind-model voice headless too (the LV2 has the same
 * engine), so like the browser bus path, velocity stands in for breath —
 * CC2 = velocity precedes the note-ons. `breathCc: null` disables it for
 * synths that would misread CC2.
 */
import { readdirSync, readFileSync } from "node:fs";
import type { SuiteMessage } from "@enkerli/protocol";

// ── Port discovery (ALSA rawmidi via /dev/snd + /proc/asound) ────────────────

export interface MidiPort {
  path: string;
  card: number;
  device: number;
  /** The ALSA card id, e.g. "VirMIDI", "USBMIDI" — what users match on. */
  id: string;
}

export interface PortScanRoots {
  devRoot?: string;
  procRoot?: string;
}

/** Enumerate rawmidi devices. Roots are injectable for tests. */
export function listMidiPorts(roots: PortScanRoots = {}): MidiPort[] {
  const dev = roots.devRoot ?? "/dev/snd";
  const proc = roots.procRoot ?? "/proc/asound";
  let entries: string[];
  try { entries = readdirSync(dev); } catch { return []; }
  const ports: MidiPort[] = [];
  for (const e of entries) {
    const m = /^midiC(\d+)D(\d+)$/.exec(e);
    if (!m) continue;
    const card = Number(m[1]);
    let id = `card${card}`;
    try { id = readFileSync(`${proc}/card${card}/id`, "utf8").trim(); } catch { /* keep fallback */ }
    ports.push({ path: `${dev}/${e}`, card, device: Number(m[2]), id });
  }
  return ports.sort((a, b) => a.card - b.card || a.device - b.device);
}

/**
 * Resolve a `--midi-out` spec to a writable device path:
 *   · an absolute path passes through untouched (incl. a plain file — tests,
 *     or capturing a performance as raw MIDI bytes);
 *   · `virtual` picks the first snd-virmidi port;
 *   · anything else is a case-insensitive substring match on the card id.
 */
export function resolveMidiPort(spec: string, ports?: MidiPort[]): string {
  if (spec.startsWith("/")) return spec;
  const all = ports ?? listMidiPorts();
  const want = spec.toLowerCase();
  const match = want === "virtual"
    ? all.find((p) => /virmidi/i.test(p.id))
    : all.find((p) => p.id.toLowerCase().includes(want));
  if (!match) {
    const listing = all.length
      ? `ports: ${all.map((p) => `${p.id} (${p.path})`).join(", ")}`
      : "no rawmidi ports found — is snd-virmidi loaded? (sudo modprobe snd-virmidi)";
    throw new Error(`midi-out: no port matches "${spec}" — ${listing}`);
  }
  return match.path;
}

// ── Message → bytes ──────────────────────────────────────────────────────────

const clamp7 = (n: number) => Math.max(0, Math.min(127, Math.round(n)));

export interface MidiConvertOptions {
  /** 1..16; a note body's own `channel` wins over this. Default 1. */
  channel?: number;
  /** Controller number for the breath stand-in; null disables. Default 2. */
  breathCc?: number | null;
}

export interface TimedMidi {
  /** 0 = write immediately; >0 = schedule this many ms out (note-offs). */
  afterMs: number;
  bytes: number[];
}

/**
 * One control-plane `note` message → the MIDI events that perform it.
 * Non-note messages yield []. gate:"off" yields immediate note-offs.
 */
export function noteMessageToMidi(msg: SuiteMessage, opts: MidiConvertOptions = {}): TimedMidi[] {
  if (msg.type !== "note") return [];
  const b = msg.body as {
    notes?: number[]; velocity?: number; channel?: number; gate?: string; durationMs?: number;
    env?: Array<{ at: number; value: number }>; glideMs?: number;
  };
  const notes = Array.isArray(b.notes) ? b.notes : [];
  if (!notes.length) return [];
  const ch = ((b.channel ?? opts.channel ?? 1) - 1) & 0x0f;
  if (b.gate === "off") {
    return notes.map((n) => ({ afterMs: 0, bytes: [0x80 | ch, clamp7(n), 0] }));
  }
  const vel = clamp7(b.velocity ?? 100);
  const out: TimedMidi[] = [];
  const breathCc = opts.breathCc === undefined ? 2 : opts.breathCc;
  const durationMs = Number.isFinite(b.durationMs) && b.durationMs! > 0 ? b.durationMs! : null;
  const env = Array.isArray(b.env) && b.env.length ? b.env : null;
  if (breathCc !== null) {
    if (env && durationMs) {
      // A per-note breath ENVELOPE (inflect stage): the whole articulation —
      // sfz bite-and-swell, staccato puff, slur hold — as a timed CC curve.
      // The at=0 point replaces the velocity stand-in and still precedes the
      // note-ons (the wind-model contract).
      for (const p of env) out.push({ afterMs: p.at * durationMs, bytes: [0xb0 | ch, breathCc & 0x7f, clamp7(p.value * 127)] });
    } else {
      out.push({ afterMs: 0, bytes: [0xb0 | ch, breathCc & 0x7f, vel] });
    }
  }
  // Slides: standard MIDI portamento (CC5 time, CC65 on/off) — explicit
  // every time glideMs rides the message at all (0 included), so a rawmidi
  // synth's persistent portamento state never inherits a stale value from a
  // previous note (same discipline as the .mid writer — pipeline.ts).
  if (Number.isFinite(b.glideMs)) {
    const glideMs = b.glideMs!;
    out.push({ afterMs: 0, bytes: [0xb0 | ch, 65, glideMs > 0 ? 127 : 0] });
    if (glideMs > 0) out.push({ afterMs: 0, bytes: [0xb0 | ch, 5, clamp7((glideMs / 2000) * 127)] });
  }
  for (const n of notes) out.push({ afterMs: 0, bytes: [0x90 | ch, clamp7(n), vel] });
  if (durationMs) {
    for (const n of notes) out.push({ afterMs: durationMs, bytes: [0x80 | ch, clamp7(n), 0] });
  }
  return out;
}

// ── The player (stateful: scheduling + hanging-note safety) ──────────────────

export interface MidiPlayerOptions extends MidiConvertOptions {
  write: (bytes: Uint8Array) => void;
  /** Injectable timer (tests). Default setTimeout. */
  schedule?: (fn: () => void, ms: number) => void;
}

export interface MidiPlayer {
  /** Perform one message. Returns true if it produced MIDI. */
  handleMessage(msg: SuiteMessage): boolean;
  /** Notes currently sounding (note-ons written, note-offs not yet). */
  activeCount(): number;
  /** Explicit note-offs for everything sounding + CC123 All Notes Off. */
  allOff(): void;
}

export function createMidiPlayer(opts: MidiPlayerOptions): MidiPlayer {
  const schedule = opts.schedule ?? ((fn: () => void, ms: number) => { setTimeout(fn, ms); });
  /** key `ch:note` → refcount, so overlapping repeats don't cut each other off early. */
  const active = new Map<string, number>();
  const emit = (bytes: number[]) => opts.write(Uint8Array.from(bytes));

  const track = (bytes: number[]) => {
    const status = bytes[0]! & 0xf0;
    const key = `${bytes[0]! & 0x0f}:${bytes[1]}`;
    if (status === 0x90 && bytes[2]! > 0) active.set(key, (active.get(key) ?? 0) + 1);
    if (status === 0x80 || (status === 0x90 && bytes[2] === 0)) {
      const n = (active.get(key) ?? 0) - 1;
      if (n <= 0) active.delete(key); else active.set(key, n);
    }
  };

  return {
    handleMessage(msg) {
      const events = noteMessageToMidi(msg, opts);
      for (const ev of events) {
        if (ev.afterMs <= 0) { track(ev.bytes); emit(ev.bytes); }
        else schedule(() => { track(ev.bytes); emit(ev.bytes); }, ev.afterMs);
      }
      return events.length > 0;
    },
    activeCount: () => active.size,
    allOff() {
      const channels = new Set<number>();
      for (const key of [...active.keys()]) {
        const [ch, note] = key.split(":").map(Number);
        channels.add(ch!);
        emit([0x80 | ch!, note!, 0]);
      }
      if (channels.size === 0) channels.add(((opts.channel ?? 1) - 1) & 0x0f);
      for (const ch of channels) emit([0xb0 | ch, 123, 0]); // All Notes Off
      active.clear();
    },
  };
}
