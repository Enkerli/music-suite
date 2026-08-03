import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  sendNoteOut, sendAllOff, midiActive, midiPorts, __setMidiForTests,
} from "./webmidi-bridge.js";

/** A stand-in SuiteMidi that records what it was told to do. */
function fakeMidi() {
  const calls = [];
  return {
    calls,
    inputs: [{ id: "i1", name: "Keystation" }],
    outputs: [{ id: "o1", name: "IAC Bus 1" }],
    sendNoteOn: (n, o) => calls.push(["on", n, o]),
    sendNoteOff: (n, o) => calls.push(["off", n, o]),
    allNotesOff: (o) => calls.push(["allOff", o]),
    onPortsChanged: () => () => {},
    onNoteIn: () => () => {},
    onControlChange: () => () => {},
    selectInput: () => {}, selectOutput: () => {},
  };
}

describe("webmidi-bridge", () => {
  let m;
  beforeEach(() => { vi.useFakeTimers(); m = fakeMidi(); __setMidiForTests(m); });
  afterEach(() => { __setMidiForTests(null); vi.useRealTimers(); });

  it("no-ops before MIDI is enabled, rather than throwing", () => {
    __setMidiForTests(null);
    expect(midiActive()).toBe(false);
    expect(midiPorts()).toEqual({ inputs: [], outputs: [] });
    // Importing and using this in a browser with no Web MIDI must be safe.
    expect(() => sendNoteOut({ notes: [60] })).not.toThrow();
    expect(() => sendAllOff()).not.toThrow();
  });

  it("sends a one-shot and schedules its note-off", () => {
    sendNoteOut({ notes: [60, 64], velocity: 100, durationMs: 200 });
    expect(m.calls).toEqual([["on", 60, { velocity: 100 }], ["on", 64, { velocity: 100 }]]);
    vi.advanceTimersByTime(199);
    expect(m.calls.filter((c) => c[0] === "off")).toHaveLength(0);
    vi.advanceTimersByTime(2);
    expect(m.calls.filter((c) => c[0] === "off").map((c) => c[1])).toEqual([60, 64]);
  });

  it("leaves a sustained note ringing — the sender owns its note-off", () => {
    // gate:"on" is Mono Merge's model. Auto-releasing it here would cut every
    // legato line short, and the bug would look like the merge misbehaving.
    sendNoteOut({ notes: [60], gate: "on", velocity: 90 });
    vi.advanceTimersByTime(10_000);
    expect(m.calls).toEqual([["on", 60, { velocity: 90 }]]);
  });

  it("sends note-offs only for gate:off", () => {
    sendNoteOut({ notes: [60], gate: "off" });
    expect(m.calls).toEqual([["off", 60, {}]]);
  });

  it("carries the channel through when one is given, and omits it otherwise", () => {
    sendNoteOut({ notes: [60], gate: "on", velocity: 80, channel: 3 });
    sendNoteOut({ notes: [62], gate: "on", velocity: 80 });
    expect(m.calls).toEqual([
      ["on", 60, { velocity: 80, channel: 3 }],
      ["on", 62, { velocity: 80 }],
    ]);
  });

  it("re-triggering a ringing one-shot does not let the old timer cut the new note", () => {
    // The stuck/cut-note bug: without clearing, note 60's first timeout fires
    // 50 ms into the second note and silences it.
    sendNoteOut({ notes: [60], durationMs: 100 });
    vi.advanceTimersByTime(50);
    sendNoteOut({ notes: [60], durationMs: 100 });
    vi.advanceTimersByTime(60);            // past the FIRST timer's deadline
    expect(m.calls.filter((c) => c[0] === "off")).toHaveLength(0);
    vi.advanceTimersByTime(50);            // past the second's
    expect(m.calls.filter((c) => c[0] === "off")).toHaveLength(1);
  });

  it("all-off cancels pending releases so they cannot fire into silence later", () => {
    sendNoteOut({ notes: [60, 64], durationMs: 500 });
    sendAllOff();
    expect(m.calls.at(-1)).toEqual(["allOff", {}]);
    const before = m.calls.length;
    vi.advanceTimersByTime(1000);
    expect(m.calls).toHaveLength(before);   // no late note-offs
  });

  it("ignores messages that are not note bodies", () => {
    sendNoteOut(undefined);
    sendNoteOut({});
    sendNoteOut({ notes: "60" });
    expect(m.calls).toEqual([]);
  });

  it("defaults velocity and duration the same way the plugin bridge does", () => {
    sendNoteOut({ notes: [60] });
    expect(m.calls[0]).toEqual(["on", 60, { velocity: 96 }]);
    vi.advanceTimersByTime(250);
    expect(m.calls.at(-1)).toEqual(["off", 60, {}]);
  });
});
