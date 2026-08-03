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

import { applyArticulationTimbre, ARTICULATION_TIMBRE } from "./control.js";
import { vaneIdToWasm as _idmap } from "./control.js";

describe("articulation → timbre (GloriArp driving Vane)", () => {
  const ids = _idmap();
  const valueOf = (post, id) => post.mock.calls.map((c) => c[0]).find((m) => m.type === "param" && m.id === id)?.value;

  it("posts nothing at depth 0 — Vane sounds exactly as before", () => {
    const post = vi.fn();
    expect(applyArticulationTimbre(post, "sforzando", 0)).toBe(false);
    expect(applyArticulationTimbre(post, "sforzando", undefined)).toBe(false);
    expect(post).not.toHaveBeenCalled();
  });

  it("opens the tone on a sforzando and pulls it back on a ghost", () => {
    const bright = ids["wg-bell-bright"], growl = ids["wg-growl"], air = ids["wg-breath-noise"];
    const sf = vi.fn(); applyArticulationTimbre(sf, "sforzando", 1);
    const gh = vi.fn(); applyArticulationTimbre(gh, "ghost", 1);
    expect(valueOf(sf, growl)).toBeGreaterThan(valueOf(gh, growl));
    expect(valueOf(sf, bright)).toBeGreaterThan(valueOf(gh, bright));
    // A ghost is airier, not just quieter.
    expect(valueOf(gh, air)).toBeGreaterThan(valueOf(sf, air));
  });

  it("scales with depth, from the manifest defaults", () => {
    const growl = ids["wg-growl"];
    const half = vi.fn(); applyArticulationTimbre(half, "sforzando", 0.5);
    const full = vi.fn(); applyArticulationTimbre(full, "sforzando", 1);
    expect(valueOf(half, growl)).toBeCloseTo(valueOf(full, growl) / 2, 5);
    // tenuto is the neutral: every value lands back on the manifest default.
    const neutral = vi.fn(); applyArticulationTimbre(neutral, "tenuto", 1);
    expect(valueOf(neutral, ids["wg-bell-bright"])).toBeCloseTo(0.7, 5);
    expect(valueOf(neutral, growl)).toBeCloseTo(0, 5);
  });

  it("never leaves the model's safe range, at any depth", () => {
    for (const name of Object.keys(ARTICULATION_TIMBRE)) {
      for (const d of [0.25, 0.5, 1]) {
        const post = vi.fn(); applyArticulationTimbre(post, name, d);
        for (const m of post.mock.calls.map((c) => c[0])) {
          expect(m.value).toBeGreaterThanOrEqual(0);
          expect(m.value).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("never touches bore damping", () => {
    // It can cut the model so far it needs a long rest before speaking again,
    // which is the last thing an automatic modulation should reach for.
    const bore = ids["wg-bore-damping"];
    for (const name of Object.keys(ARTICULATION_TIMBRE)) {
      const post = vi.fn(); applyArticulationTimbre(post, name, 1);
      expect(post.mock.calls.map((c) => c[0].id)).not.toContain(bore);
    }
  });

  it("re-posts on EVERY note, so a sforzando's growl cannot stick", () => {
    // These are persistent synth params. Posting only on change would leave
    // the accent's growl running under the next twenty notes — the same leak
    // glide-time already documents.
    const growl = ids["wg-growl"];
    const post = vi.fn();
    applyVaneNote(post, makeNote("gloriarp", { notes: [60], velocity: 90, durationMs: 100,
      articulation: "sforzando", timbre: 1 }, { to: "vane" }));
    const loud = valueOf(post, growl);
    post.mockClear();
    applyVaneNote(post, makeNote("gloriarp", { notes: [62], velocity: 60, durationMs: 100,
      articulation: "legato-inside", timbre: 1 }, { to: "vane" }));
    expect(valueOf(post, growl)).toBeLessThan(loud);
  });

  it("ignores an unknown articulation rather than guessing", () => {
    const post = vi.fn();
    expect(applyArticulationTimbre(post, "spiccato", 1)).toBe(false);
    expect(post).not.toHaveBeenCalled();
  });

  it("a note without a timbre depth posts no timbre params at all", () => {
    const post = vi.fn();
    applyVaneNote(post, makeNote("gloriarp", { notes: [60], velocity: 90, durationMs: 50,
      articulation: "sforzando" }, { to: "vane" }));
    expect(post.mock.calls.map((c) => c[0]).some((m) => m.type === "param" && m.id === ids["wg-growl"])).toBe(false);
  });
});
