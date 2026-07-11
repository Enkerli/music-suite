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

  it("starts empty and round-trips a saved list (kind surfaces on load)", () => {
    expect(loadLibrary()).toEqual([]);
    const list = [entry()];
    saveLibrary(list);
    // The mixed-kind store types every entry on the way out.
    expect(loadLibrary()).toEqual([{ kind: "document", ...entry() }]);
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
    expect(list).toEqual([{ kind: "document", ...entry() }]); // legacy reads as a document
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
    expect(loadLibrary()).toEqual([{ kind: "document", ...odd }]); // stored verbatim, round-trips
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

  // The shared-frame Library holds all three kinds in one list (D4).
  it("round-trips patches and profiles beside documents, via their envelopes", () => {
    const patch = {
      id: "55555555-aaaa-bbbb-cccc-000000000005", kind: "patch",
      title: "Ballad generator", savedAt: "2026-07-04T12:00:00.000Z",
      file: { format: "proggenie-patch", version: 1, savedAt: "2026-07-04T12:00:00.000Z", params: { tonic: "C", bars: 8 } },
    };
    const profile = {
      id: "66666666-aaaa-bbbb-cccc-000000000006", kind: "profile",
      title: "Taste profile", savedAt: "2026-07-04T12:00:00.000Z",
      file: { format: "progression-studio-curation", version: 1, savedAt: "2026-07-04T12:00:00.000Z", multipliers: { "V7\u2192Imaj7": 1.4 } },
    };
    saveLibrary([entry(), patch, profile]);
    const raw = JSON.parse(globalThis.localStorage.getItem(KEY));
    expect(raw.map((r) => r.kind)).toEqual(["progression", "patch", "curation-profile"]);
    expect(raw.every((r) => r.envelope === "enkerli-library-item")).toBe(true);
    const back = loadLibrary();
    expect(back[0]).toEqual({ kind: "document", ...entry() });
    expect(back[1]).toEqual(patch); // self-identified file travels verbatim
    expect(back[2]).toEqual(profile);
  });
});
