// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { applyControlMessage, SERPE_KEYMAP, comboFromEvent, connectSerpe } from "./control.js";
import { resolveEvent } from "@enkerli/control";
import { makeParam, makeCommand, makeMessage } from "@enkerli/protocol";
import serpeManifest from "./manifest.json";

const mockApi = () => ({
  rotate: vi.fn(), invert: vi.fn(), complement: vi.fn(), mutate: vi.fn(),
  setTempo: vi.fn(), setSwing: vi.fn(), setSteps: vi.fn(), setPattern: vi.fn(),
});

describe("applyControlMessage — command routing", () => {
  it("rotate carries its arg", () => {
    const api = mockApi();
    expect(applyControlMessage(api, makeCommand("external", { name: "rotate", args: { by: 3 } }, { to: "serpe" }))).toBe(true);
    expect(api.rotate).toHaveBeenCalledWith(3);
  });
  it("invert / complement / mutate route to their handlers", () => {
    const api = mockApi();
    applyControlMessage(api, makeCommand("external", { name: "invert" }, { to: "serpe" }));
    applyControlMessage(api, makeCommand("external", { name: "complement" }, { to: "serpe" }));
    applyControlMessage(api, makeCommand("external", { name: "mutate", args: { amount: 0.3 } }, { to: "serpe" }));
    expect(api.invert).toHaveBeenCalled();
    expect(api.complement).toHaveBeenCalled();
    expect(api.mutate).toHaveBeenCalledWith(0.3);
  });
  it("mutate with no amount passes undefined (app uses its UI default)", () => {
    const api = mockApi();
    applyControlMessage(api, makeCommand("external", { name: "mutate" }, { to: "serpe" }));
    expect(api.mutate).toHaveBeenCalledWith(undefined);
  });
  it("an unknown command is ignored (returns false)", () => {
    expect(applyControlMessage(mockApi(), makeCommand("external", { name: "nope" }, { to: "serpe" }))).toBe(false);
  });
});

describe("applyControlMessage — param routing", () => {
  it("tempo / swing / steps set their values", () => {
    const api = mockApi();
    applyControlMessage(api, makeParam("external", { id: "tempo", value: 140 }, { to: "serpe" }));
    applyControlMessage(api, makeParam("external", { id: "swing", value: 0.3 }, { to: "serpe" }));
    applyControlMessage(api, makeParam("external", { id: "steps", value: 16 }, { to: "serpe" }));
    expect(api.setTempo).toHaveBeenCalledWith(140);
    expect(api.setSwing).toHaveBeenCalledWith(0.3);
    expect(api.setSteps).toHaveBeenCalledWith(16);
  });
  it("handles a batch param snapshot", () => {
    const api = mockApi();
    applyControlMessage(api, makeParam("external", { params: [{ id: "tempo", value: 90 }, { id: "swing", value: 0.1 }] }, { to: "serpe" }));
    expect(api.setTempo).toHaveBeenCalledWith(90);
    expect(api.setSwing).toHaveBeenCalledWith(0.1);
  });
});

describe("applyControlMessage — pattern routing", () => {
  it("decodes a pattern mask (leftmost = LSB) into a steps array", () => {
    const api = mockApi();
    // E(3,8): onsets at 0/3/6 → mask 73 (0b01001001, bit i = step i)
    const m = makeMessage("external", "pattern", { steps: 8, mask: 73, name: "E(3,8)" }, { to: "*" });
    expect(applyControlMessage(api, m)).toBe(true);
    expect(api.setPattern).toHaveBeenCalledWith([1, 0, 0, 1, 0, 0, 1, 0]);
  });
  it("survives a pattern past 32 steps (no 32-bit truncation)", () => {
    const api = mockApi();
    const m = makeMessage("external", "pattern", { steps: 40, mask: 2 ** 39 + 1 }, { to: "serpe" });
    expect(applyControlMessage(api, m)).toBe(true);
    const steps = api.setPattern.mock.calls[0][0];
    expect(steps).toHaveLength(40);
    expect(steps[0]).toBe(1);
    expect(steps[39]).toBe(1);
    expect(steps.reduce((a, b) => a + b, 0)).toBe(2);
  });
  it("without a setPattern callback it declines (returns false)", () => {
    const { setPattern, ...api } = mockApi();
    const m = makeMessage("external", "pattern", { steps: 8, mask: 73 }, { to: "serpe" });
    expect(applyControlMessage(api, m)).toBe(false);
  });
});

describe("applyControlMessage — addressing", () => {
  it("ignores a message for another app", () => {
    expect(applyControlMessage(mockApi(), makeCommand("external", { name: "rotate" }, { to: "vane" }))).toBe(false);
  });
  it("acts on a broadcast", () => {
    const api = mockApi();
    expect(applyControlMessage(api, makeCommand("external", { name: "complement" }, { to: "*" }))).toBe(true);
    expect(api.complement).toHaveBeenCalled();
  });
});

describe("keyboard map", () => {
  it("resolves ] to rotate +1 against Serpe's manifest", () => {
    const [m] = resolveEvent(SERPE_KEYMAP, { kind: "key", combo: "]" }, [serpeManifest]);
    expect(m.type).toBe("command");
    expect(m.body).toMatchObject({ name: "rotate", args: { by: 1 } });
  });
  it("comboFromEvent folds modifiers", () => {
    expect(comboFromEvent({ key: "M", shiftKey: true })).toBe("shift+m");
    expect(comboFromEvent({ key: "]" })).toBe("]");
  });
});

describe("connectSerpe (DOM wiring)", () => {
  it("a keydown drives the api and a bad target is ignored", () => {
    const api = mockApi();
    const off = connectSerpe({ getApi: () => api, manifests: [serpeManifest] });

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "]" }));
    expect(api.rotate).toHaveBeenCalledWith(1);

    // typing in an input must not trigger shortcuts
    const input = document.createElement("input");
    document.body.append(input);
    const ev = new KeyboardEvent("keydown", { key: "m", bubbles: true });
    Object.defineProperty(ev, "target", { value: input });
    window.dispatchEvent(ev);
    expect(api.mutate).not.toHaveBeenCalled();

    off();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "i" }));
    expect(api.invert).not.toHaveBeenCalled(); // disconnected
  });
});
