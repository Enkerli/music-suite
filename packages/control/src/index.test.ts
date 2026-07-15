import { describe, it, expect } from "vitest";
import {
  canonicalCombo, ccToNative, nativeToCc, quantize,
  resolveEvent, validateControlMap, createBindingEngine,
  type ControlMap, type ManifestBody,
} from "./index.js";

const vane: ManifestBody = {
  app: "vane", v: 1,
  params: [
    { id: "filter-cutoff", label: "Filter Cutoff", unit: "hz", min: 20, max: 20000, default: 1128, step: 10, scale: "log" },
    { id: "morph", label: "Morph", unit: "ratio", min: 0, max: 1, default: 0, step: 0.001 },
  ],
  commands: [],
};
const serpe: ManifestBody = {
  app: "serpe", v: 1,
  params: [{ id: "swing", label: "Swing", unit: "ratio", min: 0, max: 1, default: 0, step: 0.01 }],
  commands: [
    { name: "mutate", label: "Mutate", args: [{ id: "amount", unit: "ratio", min: 0, max: 1, default: 0.5 }] },
    { name: "next-pattern", label: "Next" },
  ],
};

describe("canonicalCombo", () => {
  it("folds aliases, sorts modifiers, lowercases", () => {
    expect(canonicalCombo("Cmd+Shift+M")).toBe("mod+shift+m");
    expect(canonicalCombo("shift+mod+m")).toBe("mod+shift+m"); // order-independent
    expect(canonicalCombo("Control+Alt+Delete")).toBe("ctrl+alt+delete");
  });
});

describe("ccToNative / nativeToCc", () => {
  it("linear maps endpoints and midpoint", () => {
    const spec = vane.params[1]!; // morph 0..1 linear
    expect(ccToNative(0, spec)).toBe(0);
    expect(ccToNative(127, spec)).toBe(1);
    expect(ccToNative(64, spec)).toBeCloseTo(0.504, 2);
  });
  it("honors the manifest log scale (Vane cutoff) without the binding restating it", () => {
    const spec = vane.params[0]!; // cutoff 20..20000 log, step 10
    expect(ccToNative(0, spec)).toBe(20);
    expect(ccToNative(127, spec)).toBe(20000);
    // geometric midpoint ≈ sqrt(20*20000) = 632, quantized to step 10
    expect(ccToNative(64, spec)).toBeGreaterThan(600);
    expect(ccToNative(64, spec)).toBeLessThan(680);
  });
  it("round-trips native → cc → native within a step", () => {
    const spec = vane.params[0]!;
    const cc = nativeToCc(1000, spec);
    expect(Math.abs(ccToNative(cc, spec) - 1000)).toBeLessThanOrEqual(spec.step! * 2);
  });
  it("14-bit uses the wider range", () => {
    const spec = vane.params[1]!;
    expect(ccToNative(16383, spec, { bits: 14 })).toBe(1);
    expect(ccToNative(8191, spec, { bits: 14 })).toBeCloseTo(0.5, 2);
  });
  it("toggle curve snaps at the midpoint", () => {
    const spec = vane.params[1]!;
    expect(ccToNative(10, spec, { curve: "toggle" })).toBe(0);
    expect(ccToNative(100, spec, { curve: "toggle" })).toBe(1);
  });
  it("quantize clamps and snaps to step", () => {
    expect(quantize(20005, vane.params[0]!)).toBe(20000); // clamp
    expect(quantize(1003, vane.params[0]!)).toBe(1000);   // snap to 10
  });
});

describe("resolveEvent", () => {
  const map: ControlMap = {
    id: "cm-test", kind: "control-map",
    bindings: [
      { trigger: { kind: "midi-cc", cc: 74, channel: 1 }, action: { app: "vane", param: "filter-cutoff" } },
      { trigger: { kind: "key", combo: "mod+shift+m" }, action: { app: "serpe", command: "mutate", args: { amount: 0.3 } } },
      { trigger: { kind: "midi-note", note: 36, channel: 10 }, action: { app: "serpe", command: "next-pattern" } },
      { trigger: { kind: "midi-cc", cc: 20 }, action: { app: "vane", param: "morph", value: 0.75 } },
    ],
  };
  const manifests = [vane, serpe];

  it("CC → normalized param set (log cutoff)", () => {
    const [m] = resolveEvent(map, { kind: "midi-cc", cc: 74, channel: 1, value: 127 }, manifests);
    expect(m!.type).toBe("param");
    expect(m!.to).toBe("vane");
    expect((m!.body as { id: string; value: number }).id).toBe("filter-cutoff");
    expect((m!.body as { value: number }).value).toBe(20000);
  });
  it("respects the trigger channel filter", () => {
    expect(resolveEvent(map, { kind: "midi-cc", cc: 74, channel: 2, value: 127 }, manifests)).toEqual([]);
  });
  it("key combo → command with args (order-independent match)", () => {
    const [m] = resolveEvent(map, { kind: "key", combo: "Shift+Mod+M" }, manifests);
    expect(m!.type).toBe("command");
    expect(m!.body).toMatchObject({ name: "mutate", args: { amount: 0.3 } });
  });
  it("note → command", () => {
    const [m] = resolveEvent(map, { kind: "midi-note", note: 36, channel: 10, velocity: 100 }, manifests);
    expect((m!.body as { name: string }).name).toBe("next-pattern");
  });
  it("a fixed-value param binding ignores the CC value", () => {
    const [m] = resolveEvent(map, { kind: "midi-cc", cc: 20, channel: 1, value: 5 }, manifests);
    expect((m!.body as { value: number }).value).toBe(0.75);
  });
  it("skips a binding whose param the manifest doesn't declare (lenient)", () => {
    const bad: ControlMap = { id: "x", kind: "control-map", bindings: [{ trigger: { kind: "key", combo: "a" }, action: { app: "vane", param: "no-such" } }] };
    expect(resolveEvent(bad, { kind: "key", combo: "a" }, manifests)).toEqual([]);
  });
  it("stamps the sender (default external, overridable)", () => {
    const [d] = resolveEvent(map, { kind: "midi-note", note: 36, channel: 10, velocity: 1 }, manifests);
    expect(d!.from).toBe("external");
    const [o] = resolveEvent(map, { kind: "midi-note", note: 36, channel: 10, velocity: 1 }, manifests, { from: "pickpcs" });
    expect(o!.from).toBe("pickpcs");
  });
});

describe("CC-to-command switch threshold", () => {
  const map: ControlMap = {
    id: "sw", kind: "control-map",
    bindings: [{ trigger: { kind: "midi-cc", cc: 80 }, action: { app: "serpe", command: "next-pattern" } }],
  };
  it("fires above threshold, silent below", () => {
    expect(resolveEvent(map, { kind: "midi-cc", cc: 80, channel: 1, value: 100 }, [serpe])).toHaveLength(1);
    expect(resolveEvent(map, { kind: "midi-cc", cc: 80, channel: 1, value: 10 }, [serpe])).toHaveLength(0);
  });
});

describe("validateControlMap (strict — the editor's guard)", () => {
  it("accepts a well-formed map", () => {
    const map: ControlMap = { id: "ok", kind: "control-map", bindings: [
      { trigger: { kind: "key", combo: "a" }, action: { app: "serpe", command: "mutate", args: { amount: 0.3 } } },
      { trigger: { kind: "midi-cc", cc: 1 }, action: { app: "vane", param: "morph", value: 0.5 } },
    ] };
    expect(validateControlMap(map, [vane, serpe])).toEqual({ ok: true, errors: [] });
  });
  it("flags an unknown command, an undeclared arg, an out-of-range value, and a missing manifest", () => {
    const map: ControlMap = { id: "bad", kind: "control-map", bindings: [
      { trigger: { kind: "key", combo: "a" }, action: { app: "serpe", command: "nope" } },
      { trigger: { kind: "key", combo: "b" }, action: { app: "serpe", command: "mutate", args: { speed: 1 } } },
      { trigger: { kind: "key", combo: "c" }, action: { app: "vane", param: "morph", value: 5 } },
      { trigger: { kind: "key", combo: "d" }, action: { app: "pitchfold", param: "x" } },
    ] };
    const r = validateControlMap(map, [vane, serpe]);
    expect(r.ok).toBe(false);
    expect(r.errors).toHaveLength(4);
  });
});

describe("createBindingEngine", () => {
  it("forwards resolved messages to the send sink", () => {
    const sent: string[] = [];
    const map: ControlMap = { id: "e", kind: "control-map", bindings: [
      { trigger: { kind: "key", combo: "mod+m" }, action: { app: "serpe", command: "next-pattern" } },
    ] };
    const engine = createBindingEngine({ map, manifests: [serpe], send: (m) => sent.push(m.type) });
    const msgs = engine.handle({ kind: "key", combo: "mod+m" });
    expect(msgs).toHaveLength(1);
    expect(sent).toEqual(["command"]);
  });
});
