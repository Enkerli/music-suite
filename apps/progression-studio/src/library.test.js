// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { loadLibrary, newId, saveLibrary } from "./library.js";

const KEY = "proggenie.library.v1";

/** A realistic entry, as App.jsx mints them (UUID id, ISO savedAt). */
function entry(over = {}) {
  return {
    id: "33333333-aaaa-bbbb-cccc-000000000003",
    title: "Warm ballad",
    composer: "Alex",
    source: "edited",
    savedAt: "2026-07-04T12:00:00.000Z",
    key: "E♭ major",
    bars: 8,
    prog: { sections: [{ chords: ["E♭maj7", "Cm7"] }] },
    ...over,
  };
}

describe("progression library store", () => {
  beforeEach(() => globalThis.localStorage?.clear());

  it("starts empty and round-trips a saved list", () => {
    expect(loadLibrary()).toEqual([]);
    const list = [entry()];
    saveLibrary(list);
    expect(loadLibrary()).toEqual(list);
  });

  it("persists @enkerli/library envelopes, not bare entries", () => {
    saveLibrary([entry()]);
    const raw = JSON.parse(globalThis.localStorage.getItem(KEY));
    expect(raw).toHaveLength(1);
    expect(raw[0].envelope).toBe("enkerli-library-item");
    expect(raw[0].kind).toBe("progression");
    expect(raw[0].facets).toEqual({ key: "E♭ major", bars: 8 });
    // the canonical Progression travels verbatim in the payload
    expect(raw[0].payload.prog).toEqual(entry().prog);
  });

  it("upgrades legacy (pre-envelope) entries on load + next save", () => {
    // simulate a pre-envelope library already in storage
    globalThis.localStorage.setItem(KEY, JSON.stringify([entry()]));
    const list = loadLibrary();
    expect(list).toEqual([entry()]); // app shape unchanged
    saveLibrary(list); // …and the next save upgrades the storage format
    const raw = JSON.parse(globalThis.localStorage.getItem(KEY));
    expect(raw[0].envelope).toBe("enkerli-library-item");
  });

  it("loads a mixed library (envelopes + legacy) as uniform entries", () => {
    saveLibrary([entry()]); // stored as envelope
    const raw = JSON.parse(globalThis.localStorage.getItem(KEY));
    raw.push(entry({ id: "44444444-aaaa-bbbb-cccc-000000000004", title: "Old sketch" }));
    globalThis.localStorage.setItem(KEY, JSON.stringify(raw));
    const titles = loadLibrary().map((e) => e.title);
    expect(titles).toEqual(["Warm ballad", "Old sketch"]);
  });

  it("never loses an entry that cannot form a valid envelope", () => {
    const odd = entry({ id: "a" }); // short id fails the schema's id rule
    saveLibrary([odd]);
    expect(loadLibrary()).toEqual([odd]); // stored verbatim, round-trips
    const raw = JSON.parse(globalThis.localStorage.getItem(KEY));
    expect(raw[0].envelope).toBeUndefined();
  });

  it("treats corrupted storage as empty (never throws)", () => {
    globalThis.localStorage.setItem(KEY, "{not json");
    expect(loadLibrary()).toEqual([]);
  });

  it("mints unique ids", () => {
    expect(newId()).not.toBe(newId());
  });
});
