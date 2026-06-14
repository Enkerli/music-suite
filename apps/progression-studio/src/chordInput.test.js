import { describe, expect, it } from "vitest";
import { createChordInput } from "./chordInput.js";

/** Minimal bridge stub exposing the onMidiNotes callback for the test. */
function mockBridge() {
  let cb = null;
  return {
    onMidiNotes(c) { cb = c; return () => { cb = null; }; },
    fire(notes) { cb?.(notes); },
  };
}

describe("chord input (held notes → detected chord)", () => {
  it("detects a chord from played note-ons", () => {
    const bridge = mockBridge();
    let last = null;
    createChordInput(bridge, { onUpdate: (s) => (last = s) });
    bridge.fire([{ note: 60, velocity: 90, on: true }]);
    expect(last.chord).toBeNull(); // one note isn't a chord
    bridge.fire([{ note: 64, velocity: 90, on: true }, { note: 67, velocity: 90, on: true }]);
    expect(last.notes).toEqual([60, 64, 67]);
    expect(last.chord.symbol).toBe("C"); // C E G
    expect(last.symbol).toBe("C"); // displayed symbol is the detector's structural symbol
  });

  it("reports the detector's structural symbol for a partial chord (no underscores)", () => {
    const bridge = mockBridge();
    let last = null;
    createChordInput(bridge, { onUpdate: (s) => (last = s) });
    bridge.fire([52, 67, 74, 77].map((note) => ({ note, velocity: 90, on: true }))); // E G D F — G7(13), no 3rd
    expect(last.symbol).toBe(last.chord.symbol);
    expect(last.symbol).not.toMatch(/_/); // never the raw "5_7_13" quality key
  });

  it("releases notes on note-off and re-detects", () => {
    const bridge = mockBridge();
    let last = null;
    createChordInput(bridge, { onUpdate: (s) => (last = s) });
    bridge.fire([62, 65, 69].map((note) => ({ note, velocity: 90, on: true }))); // D minor
    expect(last.chord.symbol).toBe("D-"); // detector uses jazz notation
    bridge.fire([{ note: 62, velocity: 0, on: false }]); // release the root
    expect(last.notes).toEqual([65, 69]); // F A remain
  });

  it("treats note-on velocity 0 as a release (running-status note-off)", () => {
    const bridge = mockBridge();
    let last = null;
    createChordInput(bridge, { onUpdate: (s) => (last = s) });
    bridge.fire([{ note: 60, velocity: 90, on: true }, { note: 64, velocity: 90, on: true }]);
    bridge.fire([{ note: 60, velocity: 0, on: true }]); // on with vel 0 = off
    expect(last.notes).toEqual([64]);
  });

  it("reset() clears the held set", () => {
    const bridge = mockBridge();
    let last = null;
    const ci = createChordInput(bridge, { onUpdate: (s) => (last = s) });
    bridge.fire([60, 64, 67].map((note) => ({ note, velocity: 90, on: true })));
    ci.reset();
    expect(last.notes).toEqual([]);
    expect(last.chord).toBeNull();
  });
});
