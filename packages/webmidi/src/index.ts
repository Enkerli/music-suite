/**
 * @enkerli/webmidi — the suite's shared real-time Web MIDI layer.
 *
 * A thin, *suite-shaped* wrapper over WEBMIDI.js (https://webmidijs.org). Apps
 * depend on THIS API — not the library directly — so the surface speaks in the
 * suite's webapp↔plugin parity concepts (clock/transport, note-in → advance,
 * note/CC out) and the underlying library can evolve without touching app code.
 * It also keeps a seam for future web↔web / web↔plugin transports (e.g.
 * BroadcastChannel) behind the same shape. No OSC.
 *
 * Licensing: this wrapper is CC0-1.0 (Public Domain). WEBMIDI.js is Apache-2.0
 * and keeps its own license — bundled with attribution wherever this ships.
 * See THIRD_PARTY_LICENSES.md.
 */

// ── Minimal structural surface of WEBMIDI.js we depend on. Declaring it here
//    (rather than importing the library's types) keeps the wrapper decoupled and
//    unit-testable with a plain fake, and keeps node test runs from touching the
//    browser-only library at all. ──
export interface MidiPortLike {
  id: string;
  name: string;
}
export interface InputLike extends MidiPortLike {
  addListener(event: string, listener: (e: unknown) => void, options?: unknown): void;
  removeListener(event?: string, listener?: (e: unknown) => void): void;
}
export interface OutputLike extends MidiPortLike {
  sendNoteOn(note: number, options?: unknown): void;
  sendNoteOff(note: number, options?: unknown): void;
  sendControlChange(controller: number, value: number, options?: unknown): void;
  sendAllNotesOff(options?: unknown): void;
}
export interface WebMidiLike {
  enable(options?: unknown): Promise<unknown>;
  disable(): void;
  enabled: boolean;
  inputs: InputLike[];
  outputs: OutputLike[];
  addListener(event: string, listener: (e: unknown) => void): void;
  removeListener(event?: string, listener?: (e: unknown) => void): void;
}

export type Unsubscribe = () => void;

export interface NoteEvent {
  note: number;
  velocity: number;
  channel: number;
  on: boolean;
}
export interface CCEvent {
  controller: number;
  value: number;
  channel: number;
}
export type Transport = "start" | "stop" | "continue";

// ── Pure helper: MIDI clock → ticks. 24 pulses-per-quarter is the MIDI spec; a
//    "tick" here is a configurable musical boundary the app advances on (default
//    a quarter-note beat), mirroring the plugin's Tick/MIDI advance. Pure and
//    framework-free so the parity-critical timing is unit-testable. ──
export class ClockCounter {
  private pulses = 0;
  tickCount = 0;

  constructor(
    private readonly onTick: (tickIndex: number) => void,
    private readonly pulsesPerTick = 24,
  ) {}

  /** Feed one 0xF8 timing-clock pulse. */
  pulse(): void {
    if (++this.pulses >= this.pulsesPerTick) {
      this.pulses = 0;
      this.onTick(this.tickCount++);
    }
  }

  /** Reset on transport stop / new pattern. */
  reset(): void {
    this.pulses = 0;
    this.tickCount = 0;
  }
}

interface RawNote {
  note?: { number?: number; rawAttack?: number };
  message?: { channel?: number };
}
interface RawCC {
  controller?: { number?: number };
  rawValue?: number;
  value?: number;
  message?: { channel?: number };
}

/** Pure: normalize a WEBMIDI.js note event to the suite shape. */
export function normalizeNoteEvent(e: unknown, on: boolean): NoteEvent {
  const r = (e ?? {}) as RawNote;
  return {
    note: r.note?.number ?? 0,
    velocity: on ? (r.note?.rawAttack ?? 0) : 0,
    channel: r.message?.channel ?? 1,
    on,
  };
}

/** Pure: normalize a WEBMIDI.js control-change event to the suite shape. */
export function normalizeCCEvent(e: unknown): CCEvent {
  const r = (e ?? {}) as RawCC;
  return {
    controller: r.controller?.number ?? 0,
    value: r.rawValue ?? Math.round((r.value ?? 0) * 127),
    channel: r.message?.channel ?? 1,
  };
}

type Binding = [event: string, fn: (e: unknown) => void];

/**
 * The suite's real-time MIDI handle. Construct with a WEBMIDI.js-like object
 * (see `connect()` for the normal path; tests inject a fake). Input listeners
 * are tracked centrally and re-bound when the selected input changes, so
 * subscriptions survive device switching.
 */
export class SuiteMidi {
  private input: InputLike | null = null;
  private output: OutputLike | null = null;
  private bindings: Binding[] = [];

  constructor(private readonly wm: WebMidiLike) {}

  get enabled(): boolean {
    return this.wm.enabled;
  }
  get inputs(): MidiPortLike[] {
    return this.wm.inputs.map((p) => ({ id: p.id, name: p.name }));
  }
  get outputs(): MidiPortLike[] {
    return this.wm.outputs.map((p) => ({ id: p.id, name: p.name }));
  }

  /** Fires whenever a device is connected or disconnected (hot-plug). */
  onPortsChanged(cb: () => void): Unsubscribe {
    const on = (): void => cb();
    this.wm.addListener("connected", on);
    this.wm.addListener("disconnected", on);
    return () => {
      this.wm.removeListener("connected", on);
      this.wm.removeListener("disconnected", on);
    };
  }

  selectInput(idOrName: string | null): void {
    if (this.input) for (const [ev, fn] of this.bindings) this.input.removeListener(ev, fn);
    this.input = this.resolve(this.wm.inputs, idOrName);
    if (this.input) for (const [ev, fn] of this.bindings) this.input.addListener(ev, fn);
  }
  selectOutput(idOrName: string | null): void {
    this.output = this.resolve(this.wm.outputs, idOrName);
  }

  // ── Input (parity concepts) ──
  onNoteIn(cb: (e: NoteEvent) => void): Unsubscribe {
    return this.bind(
      ["noteon", (e) => cb(normalizeNoteEvent(e, true))],
      ["noteoff", (e) => cb(normalizeNoteEvent(e, false))],
    );
  }
  onControlChange(cb: (e: CCEvent) => void): Unsubscribe {
    return this.bind(["controlchange", (e) => cb(normalizeCCEvent(e))]);
  }
  onClock(cb: () => void): Unsubscribe {
    return this.bind(["clock", () => cb()]);
  }
  onTransport(cb: (t: Transport) => void): Unsubscribe {
    return this.bind(
      ["start", () => cb("start")],
      ["stop", () => cb("stop")],
      ["continue", () => cb("continue")],
    );
  }

  // ── Output ──
  sendNoteOn(note: number, opts: { velocity?: number; channel?: number } = {}): void {
    this.output?.sendNoteOn(note, { rawAttack: opts.velocity ?? 100, channels: opts.channel ?? 1 });
  }
  sendNoteOff(note: number, opts: { channel?: number } = {}): void {
    this.output?.sendNoteOff(note, { channels: opts.channel ?? 1 });
  }
  sendCC(controller: number, value: number, opts: { channel?: number } = {}): void {
    this.output?.sendControlChange(controller, value, { channels: opts.channel ?? 1 });
  }
  allNotesOff(opts: { channel?: number } = {}): void {
    this.output?.sendAllNotesOff({ channels: opts.channel ?? 1 });
  }

  /** Drop all input subscriptions. */
  dispose(): void {
    if (this.input) for (const [ev, fn] of this.bindings) this.input.removeListener(ev, fn);
    this.bindings = [];
  }

  private bind(...pairs: Binding[]): Unsubscribe {
    this.bindings.push(...pairs);
    if (this.input) for (const [ev, fn] of pairs) this.input.addListener(ev, fn);
    return () => {
      this.bindings = this.bindings.filter((b) => !pairs.includes(b));
      if (this.input) for (const [ev, fn] of pairs) this.input.removeListener(ev, fn);
    };
  }
  private resolve<T extends MidiPortLike>(ports: T[], idOrName: string | null): T | null {
    if (idOrName == null) return null;
    return ports.find((p) => p.id === idOrName || p.name === idOrName) ?? null;
  }
}

/**
 * Normal entry point: enable WEBMIDI.js and return a SuiteMidi handle. The
 * library is imported dynamically so this module never touches the browser-only
 * global until an app actually asks to connect.
 */
export async function connect(options: { sysex?: boolean } = {}): Promise<SuiteMidi> {
  const mod = (await import("webmidi")) as unknown as {
    WebMidi?: WebMidiLike;
    default?: WebMidiLike | { WebMidi?: WebMidiLike };
  };
  const wm =
    mod.WebMidi ??
    (mod.default && "enable" in mod.default ? (mod.default as WebMidiLike) : undefined) ??
    (mod.default as { WebMidi?: WebMidiLike } | undefined)?.WebMidi;
  if (!wm) throw new Error("@enkerli/webmidi: could not locate the WebMidi export from 'webmidi'");
  await wm.enable({ sysex: options.sysex ?? false });
  return new SuiteMidi(wm);
}
