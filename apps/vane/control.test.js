import { describe, it, expect, vi } from "vitest";
import { applyVaneParam, vaneIdToWasm } from "./control.js";
import { makeParam, makeCommand } from "@enkerli/protocol";

const idToWasm = vaneIdToWasm();

describe("vaneIdToWasm", () => {
  it("maps manifest ids to Vane wasm ids", () => {
    expect(idToWasm["filter-cutoff"]).toBe(1); // index.html PARAM_MAP Cutoff:1
    expect(idToWasm["morph"]).toBe(12);
    expect(idToWasm["output"]).toBe(8);
  });
  it("covers the whole continuous surface", () => {
    expect(Object.keys(idToWasm).length).toBeGreaterThanOrEqual(36);
  });
});

describe("applyVaneParam — drives the worklet by wasm id", () => {
  it("resolves a single param and posts native value straight through", () => {
    const post = vi.fn();
    expect(applyVaneParam(post, idToWasm, makeParam("external", { id: "filter-cutoff", value: 800 }, { to: "vane" }))).toBe(true);
    expect(post).toHaveBeenCalledWith({ type: "param", id: 1, value: 800 });
  });
  it("handles a batch snapshot", () => {
    const post = vi.fn();
    applyVaneParam(post, idToWasm, makeParam("external", { params: [{ id: "morph", value: 0.7 }, { id: "output", value: 0.5 }] }, { to: "vane" }));
    expect(post).toHaveBeenCalledWith({ type: "param", id: 12, value: 0.7 });
    expect(post).toHaveBeenCalledWith({ type: "param", id: 8, value: 0.5 });
  });
  it("acts on a broadcast", () => {
    const post = vi.fn();
    expect(applyVaneParam(post, idToWasm, makeParam("external", { id: "morph", value: 1 }, { to: "*" }))).toBe(true);
  });
  it("ignores a message for another app", () => {
    const post = vi.fn();
    expect(applyVaneParam(post, idToWasm, makeParam("external", { id: "morph", value: 1 }, { to: "serpe" }))).toBe(false);
    expect(post).not.toHaveBeenCalled();
  });
  it("ignores a command message (Vane's surface is params)", () => {
    const post = vi.fn();
    expect(applyVaneParam(post, idToWasm, makeCommand("external", { name: "mutate" }, { to: "vane" }))).toBe(false);
    expect(post).not.toHaveBeenCalled();
  });
  it("ignores an unknown param id", () => {
    const post = vi.fn();
    expect(applyVaneParam(post, idToWasm, makeParam("external", { id: "no-such", value: 1 }, { to: "vane" }))).toBe(false);
    expect(post).not.toHaveBeenCalled();
  });
});

import { applyVaneNote } from "./control.js";
import { makeNote } from "@enkerli/protocol";

describe("applyVaneNote — plays the voice", () => {
  it("posts breath (CC2) then a noteOn per note, spread across MPE channels", () => {
    const post = vi.fn();
    expect(applyVaneNote(post, makeNote("proggenie", { notes: [60, 64, 67], velocity: 90 }, { to: "vane" }))).toBe(true);
    // Vane's amp envelope is breath-driven — without CC2 a noteOn is SILENT.
    // Velocity stands in for breath, and it must arrive before the notes.
    expect(post.mock.calls[0][0]).toEqual({ type: "cc", cc: 2, value: 90 / 127 });
    expect(post).toHaveBeenCalledWith({ type: "noteOn", note: 60, vel: 90, channel: 2 });
    expect(post).toHaveBeenCalledWith({ type: "noteOn", note: 64, vel: 90, channel: 3 });
    expect(post).toHaveBeenCalledWith({ type: "noteOn", note: 67, vel: 90, channel: 4 });
  });
  it("gate:'off' does NOT touch breath (other voices may still be sounding)", () => {
    const post = vi.fn();
    applyVaneNote(post, makeNote("proggenie", { notes: [60], gate: "off" }, { to: "vane" }));
    expect(post.mock.calls.every((c) => c[0].type === "noteOff")).toBe(true);
  });
  it("gate:'off' releases the notes", () => {
    const post = vi.fn();
    applyVaneNote(post, makeNote("proggenie", { notes: [60], gate: "off" }, { to: "vane" }));
    expect(post).toHaveBeenCalledWith({ type: "noteOff", note: 60, channel: 2 });
  });
  it("durationMs schedules a self-release (one-shot)", () => {
    const post = vi.fn();
    const scheduled = [];
    applyVaneNote(post, makeNote("proggenie", { notes: [60], durationMs: 500 }, { to: "vane" }), (fn) => scheduled.push(fn));
    expect(post).toHaveBeenCalledWith({ type: "noteOn", note: 60, vel: 100, channel: 2 });
    scheduled[0](); // fire the timer
    expect(post).toHaveBeenCalledWith({ type: "noteOff", note: 60, channel: 2 });
  });
  it("ignores a note for another app / a non-note message", () => {
    const post = vi.fn();
    expect(applyVaneNote(post, makeNote("proggenie", { notes: [60] }, { to: "serpe" }))).toBe(false);
    expect(applyVaneNote(post, makeNote("proggenie", { notes: [60] }, { to: "*" }))).toBe(true); // broadcast ok
  });
  it("a breath ENVELOPE plays out over the note (per-note articulation)", () => {
    const post = vi.fn();
    const scheduled = [];
    applyVaneNote(post,
      makeNote("external", {
        notes: [46], velocity: 118, durationMs: 400, articulation: "sforzando", attack: 1.6,
        env: [{ at: 0, value: 1 }, { at: 0.15, value: 0.45 }, { at: 0.65, value: 0.93 }, { at: 1, value: 0.65 }],
      }, { to: "vane" }),
      (fn, ms) => scheduled.push({ fn, ms }));
    // Tonguing first (transient-gain), then the at=0 breath, then the noteOn.
    expect(post.mock.calls[0][0]).toEqual({ type: "param", id: 44, value: 1.6 });
    expect(post.mock.calls[1][0]).toEqual({ type: "cc", cc: 2, value: 1 });
    expect(post.mock.calls[2][0]).toEqual({ type: "noteOn", note: 46, vel: 118, channel: 2 });
    // The bite→swell→release points are scheduled along the note's life.
    const envTimers = scheduled.filter((s) => s.ms < 400);
    expect(envTimers.map((s) => s.ms)).toEqual([0.15 * 400, 0.65 * 400]);
    envTimers.forEach((s) => s.fn());
    expect(post).toHaveBeenCalledWith({ type: "cc", cc: 2, value: 0.45 });
    expect(post).toHaveBeenCalledWith({ type: "cc", cc: 2, value: 0.93 });
    // …and the at=1 release point rides at durationMs, with the noteOff.
    expect(scheduled.some((s) => s.ms === 400)).toBe(true);
  });
  it("attack 0 = slurred: no re-tonguing, envelope still breathes", () => {
    const post = vi.fn();
    applyVaneNote(post, makeNote("external", {
      notes: [52], velocity: 96, durationMs: 240, articulation: "legato-inside", attack: 0,
      env: [{ at: 0, value: 0.64 }, { at: 1, value: 0.68 }],
    }, { to: "vane" }), () => {});
    expect(post.mock.calls[0][0]).toEqual({ type: "param", id: 44, value: 0 });
    expect(post.mock.calls[1][0]).toEqual({ type: "cc", cc: 2, value: 0.64 });
  });
  it("a promoted slide posts glide-time (wasmId 10) before the noteOn — Vane's own legato detection does the rest", () => {
    const post = vi.fn();
    applyVaneNote(post, makeNote("external", {
      notes: [53], velocity: 96, durationMs: 240, articulation: "legato-inside", attack: 0, glideMs: 300,
    }, { to: "vane" }), () => {});
    expect(post.mock.calls[0][0]).toEqual({ type: "param", id: 44, value: 0 }); // attack (transient-gain)
    expect(post.mock.calls[1][0]).toEqual({ type: "param", id: 10, value: 300 }); // glide-time
    expect(post.mock.calls[2][0]).toEqual({ type: "cc", cc: 2, value: 96 / 127 }); // breath (no env here)
  });
  it("glideMs 0 is posted explicitly (not skipped) — resets a PREVIOUS note's slide instead of leaking into this one", () => {
    const post = vi.fn();
    applyVaneNote(post, makeNote("external", {
      notes: [55], velocity: 96, durationMs: 240, articulation: "tenuto", attack: 0.5, glideMs: 0,
    }, { to: "vane" }), () => {});
    expect(post).toHaveBeenCalledWith({ type: "param", id: 10, value: 0 });
  });
  it("no glideMs at all (not an inflected take) → glide-time is never touched", () => {
    const post = vi.fn();
    applyVaneNote(post, makeNote("external", { notes: [60], velocity: 100 }, { to: "vane" }), () => {});
    expect(post.mock.calls.some((c) => c[0].type === "param" && c[0].id === 10)).toBe(false);
  });
});
