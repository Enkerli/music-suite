// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/** Install a fake __JUCE__ backend before each test — juce-bridge.js reads
 *  `window.__JUCE__` at CALL time (juceAvailable()), not at import time, so
 *  installing/removing it per test is safe without re-importing the module. */
function installFakeBackend() {
  const emitted = [];
  const listeners = new Map(); // eventId -> single raw callback (mimics the real backend)
  window.__JUCE__ = {
    backend: {
      emitEvent: (id, payload) => emitted.push({ id, payload }),
      addEventListener: (id, cb) => listeners.set(id, cb),
    },
  };
  return { emitted, fireFromCpp: (id, data) => listeners.get(id)?.(data) };
}

describe("juce-bridge — outside the plugin", () => {
  afterEach(() => { delete window.__JUCE__; });

  it("juceAvailable is false, natives no-op/return false, juceOn returns a harmless unsubscribe", async () => {
    const { juceAvailable, saveFileNative, openFileNative, juceOn } = await import("./juce-bridge.js");
    expect(juceAvailable()).toBe(false);
    expect(saveFileNative("x.mid", new Uint8Array([1]))).toBe(false);
    expect(openFileNative("*.json")).toBe(false);
    expect(() => juceOn("fileOpened", () => {})()).not.toThrow();
  });
});

describe("juce-bridge — inside the plugin", () => {
  let backend;
  beforeEach(() => {
    // juce-bridge.js keeps its own module-level "one subscription per event
    // id" map — reset the module registry too, or a later test's fresh fake
    // backend never gets told about a listener an earlier test already
    // subscribed against ITS (now-gone) backend.
    vi.resetModules();
    backend = installFakeBackend();
  });
  afterEach(() => { delete window.__JUCE__; });

  it("openFileNative emits enkerliOpenFile with the patterns and returns true", async () => {
    const { openFileNative } = await import("./juce-bridge.js");
    expect(openFileNative("*.json")).toBe(true);
    expect(backend.emitted).toContainEqual({ id: "enkerliOpenFile", payload: { patterns: "*.json" } });
  });

  it("saveFileNative base64-encodes and emits enkerliSaveFile", async () => {
    const { saveFileNative } = await import("./juce-bridge.js");
    expect(saveFileNative("x.mid", new Uint8Array([1, 2, 3]))).toBe(true);
    const ev = backend.emitted.find((e) => e.id === "enkerliSaveFile");
    expect(ev.payload.name).toBe("x.mid");
    expect(atob(ev.payload.b64)).toBe("\x01\x02\x03");
  });

  it("juceOn fans ONE backend subscription out to multiple JS callbacks", async () => {
    const { juceOn } = await import("./juce-bridge.js");
    const seenA = [], seenB = [];
    juceOn("fileOpened", (d) => seenA.push(d));
    juceOn("fileOpened", (d) => seenB.push(d));
    backend.fireFromCpp("fileOpened", { name: "x.json" });
    expect(seenA).toEqual([{ name: "x.json" }]);
    expect(seenB).toEqual([{ name: "x.json" }]); // both callbacks reached, one real subscription
  });

  it("juceOn's unsubscribe stops that callback without disturbing others (a rebuilt module doesn't stack listeners)", async () => {
    const { juceOn } = await import("./juce-bridge.js");
    const seen = [];
    const off1 = juceOn("fileOpened", (d) => seen.push(["first", d]));
    off1(); // simulates a module instance torn down before a second one is built
    juceOn("fileOpened", (d) => seen.push(["second", d]));
    backend.fireFromCpp("fileOpened", { name: "y.json" });
    expect(seen).toEqual([["second", { name: "y.json" }]]);
  });

  it("b64ToBytes round-trips saveFileNative's own encoding", async () => {
    const { b64ToBytes } = await import("./juce-bridge.js");
    const bytes = b64ToBytes(btoa("\x01\x02\x03"));
    expect([...bytes]).toEqual([1, 2, 3]);
  });
});
