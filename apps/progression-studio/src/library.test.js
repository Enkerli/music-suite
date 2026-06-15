// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { loadLibrary, newId, saveLibrary } from "./library.js";

describe("progression library store", () => {
  beforeEach(() => globalThis.localStorage?.clear());

  it("starts empty and round-trips a saved list", () => {
    expect(loadLibrary()).toEqual([]);
    const list = [{ id: "a", title: "Tune", prog: { sections: [] } }];
    saveLibrary(list);
    expect(loadLibrary()).toEqual(list);
  });

  it("treats corrupted storage as empty (never throws)", () => {
    globalThis.localStorage.setItem("proggenie.library.v1", "{not json");
    expect(loadLibrary()).toEqual([]);
  });

  it("mints unique ids", () => {
    expect(newId()).not.toBe(newId());
  });
});
