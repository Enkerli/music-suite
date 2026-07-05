import { describe, it, expect, vi } from "vitest";
import {
  ClockCounter,
  normalizeNoteEvent,
  normalizeCCEvent,
  SuiteMidi,
  type InputLike,
  type OutputLike,
  type WebMidiLike,
} from "./index.js";

// ── Pure helpers ──
describe("ClockCounter", () => {
  it("emits one tick every 24 pulses by default (quarter note)", () => {
    const ticks: number[] = [];
    const c = new ClockCounter((i) => ticks.push(i));
    for (let i = 0; i < 48; i++) c.pulse();
    expect(ticks).toEqual([0, 1]);
    expect(c.tickCount).toBe(2);
  });

  it("honours a custom pulses-per-tick and resets", () => {
    const ticks: number[] = [];
    const c = new ClockCounter((i) => ticks.push(i), 6);
    for (let i = 0; i < 6; i++) c.pulse();
    expect(ticks).toEqual([0]);
    c.reset();
    expect(c.tickCount).toBe(0);
    for (let i = 0; i < 5; i++) c.pulse();
    expect(ticks).toEqual([0]); // no extra tick before the boundary
  });
});

describe("normalize helpers", () => {
  it("maps a WEBMIDI.js note event to the suite shape", () => {
    const e = { note: { number: 60, rawAttack: 110 }, message: { channel: 3 } };
    expect(normalizeNoteEvent(e, true)).toEqual({ note: 60, velocity: 110, channel: 3, on: true });
    expect(normalizeNoteEvent(e, false)).toEqual({ note: 60, velocity: 0, channel: 3, on: false });
  });
  it("maps a control-change event, preferring rawValue", () => {
    expect(normalizeCCEvent({ controller: { number: 74 }, rawValue: 64, message: { channel: 1 } }))
      .toEqual({ controller: 74, value: 64, channel: 1 });
  });
});

// ── Fakes for the structural WEBMIDI.js surface ──
class FakeInput implements InputLike {
  listeners = new Map<string, Set<(e: unknown) => void>>();
  constructor(public id: string, public name: string) {}
  addListener(ev: string, fn: (e: unknown) => void): void {
    (this.listeners.get(ev) ?? this.listeners.set(ev, new Set()).get(ev)!).add(fn);
  }
  removeListener(ev?: string, fn?: (e: unknown) => void): void {
    if (!ev) return void this.listeners.clear();
    if (fn) this.listeners.get(ev)?.delete(fn);
    else this.listeners.get(ev)?.clear();
  }
  emit(ev: string, e: unknown): void {
    this.listeners.get(ev)?.forEach((fn) => fn(e));
  }
}
class FakeOutput implements OutputLike {
  sent: Array<[string, number, unknown]> = [];
  constructor(public id: string, public name: string) {}
  sendNoteOn(n: number, o?: unknown): void { this.sent.push(["on", n, o]); }
  sendNoteOff(n: number, o?: unknown): void { this.sent.push(["off", n, o]); }
  sendControlChange(c: number, v: number, o?: unknown): void { this.sent.push(["cc", c, { v, ...(o as object) }]); }
  sendAllNotesOff(o?: unknown): void { this.sent.push(["panic", 0, o]); }
  raw: number[][] = [];
  send(message: number[] | Uint8Array): void { this.raw.push([...message]); }
}
class FakeWebMidi implements WebMidiLike {
  enabled = true;
  constructor(public inputs: FakeInput[], public outputs: FakeOutput[]) {}
  enable(): Promise<unknown> { return Promise.resolve(); }
  disable(): void {}
  addListener(): void {}
  removeListener(): void {}
}

describe("SuiteMidi", () => {
  it("routes note-in from the selected input to the callback", () => {
    const inA = new FakeInput("a", "Keystation");
    const wm = new FakeWebMidi([inA], []);
    const midi = new SuiteMidi(wm);
    midi.selectInput("a");

    const cb = vi.fn();
    const off = midi.onNoteIn(cb);
    inA.emit("noteon", { note: { number: 64, rawAttack: 100 }, message: { channel: 1 } });
    expect(cb).toHaveBeenCalledWith({ note: 64, velocity: 100, channel: 1, on: true });

    off();
    inA.emit("noteon", { note: { number: 65, rawAttack: 100 }, message: { channel: 1 } });
    expect(cb).toHaveBeenCalledTimes(1); // unsubscribed
  });

  it("re-binds existing subscriptions when the input is switched", () => {
    const inA = new FakeInput("a", "A");
    const inB = new FakeInput("b", "B");
    const wm = new FakeWebMidi([inA, inB], []);
    const midi = new SuiteMidi(wm);

    const cb = vi.fn();
    midi.selectInput("a");
    midi.onClock(cb);
    midi.selectInput("b"); // subscription must follow to input B
    inB.emit("clock", {});
    expect(cb).toHaveBeenCalledTimes(1);
    expect(inA.listeners.get("clock")?.size ?? 0).toBe(0); // detached from A
  });

  it("delivers raw SysEx frames to onSysEx as Uint8Array", () => {
    const inA = new FakeInput("a", "IAC");
    const midi = new SuiteMidi(new FakeWebMidi([inA], []));
    midi.selectInput("a");
    const cb = vi.fn();
    midi.onSysEx(cb);
    const frame = [0xf0, 0x7d, 0x45, 0x4b, 0x01, 0xf7];
    inA.emit("sysex", { message: { data: frame } });      // WEBMIDI.js shape
    inA.emit("sysex", { data: Uint8Array.from(frame) });  // fallback shape
    expect(cb).toHaveBeenCalledTimes(2);
    expect([...cb.mock.calls[0]![0]]).toEqual(frame);
    expect(cb.mock.calls[1]![0]).toBeInstanceOf(Uint8Array);
  });

  it("sends a complete SysEx frame as raw bytes", () => {
    const out = new FakeOutput("o", "IAC");
    const midi = new SuiteMidi(new FakeWebMidi([], [out]));
    midi.selectOutput("IAC");
    midi.sendSysEx(Uint8Array.from([0xf0, 0x7d, 0x45, 0x4b, 0x01, 0xf7]));
    expect(out.raw).toEqual([[0xf0, 0x7d, 0x45, 0x4b, 0x01, 0xf7]]);
  });

  it("sends note-on to the selected output", () => {
    const out = new FakeOutput("o", "Synth");
    const wm = new FakeWebMidi([], [out]);
    const midi = new SuiteMidi(wm);
    midi.selectOutput("Synth");
    midi.sendNoteOn(60, { velocity: 90, channel: 2 });
    expect(out.sent).toEqual([["on", 60, { rawAttack: 90, channels: 2 }]]);
  });
});
