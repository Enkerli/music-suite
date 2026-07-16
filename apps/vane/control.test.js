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
