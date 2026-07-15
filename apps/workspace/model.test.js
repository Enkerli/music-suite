import { describe, it, expect } from "vitest";
import { sliderToNative, nativeToSlider, paramSet, commandInvoke, formatValue } from "./model.js";

const cutoff = { id: "filter-cutoff", label: "Filter Cutoff", unit: "hz", min: 20, max: 20000, default: 1128, step: 10, scale: "log" };
const morph = { id: "morph", label: "Morph", unit: "ratio", min: 0, max: 1, default: 0, step: 0.001 };

describe("slider ↔ native mapping (scale-aware, via @enkerli/control)", () => {
  it("maps endpoints", () => {
    expect(sliderToNative(0, cutoff)).toBe(20);
    expect(sliderToNative(1, cutoff)).toBe(20000);
    expect(sliderToNative(0, morph)).toBe(0);
    expect(sliderToNative(1, morph)).toBe(1);
  });
  it("a log cutoff's midpoint is geometric, not arithmetic", () => {
    const mid = sliderToNative(0.5, cutoff);
    expect(mid).toBeGreaterThan(600);   // ≈ sqrt(20*20000) = 632, not 10010
    expect(mid).toBeLessThan(680);
  });
  it("round-trips native → slider → native within a step", () => {
    const u = nativeToSlider(1000, cutoff);
    expect(Math.abs(sliderToNative(u, cutoff) - 1000)).toBeLessThanOrEqual(cutoff.step * 2);
  });
});

describe("message builders", () => {
  it("paramSet targets the app with a set message", () => {
    const m = paramSet("external", "vane", "morph", 0.7);
    expect(m.type).toBe("param");
    expect(m.to).toBe("vane");
    expect(m.body).toMatchObject({ mode: "set", id: "morph", value: 0.7 });
  });
  it("commandInvoke carries named args", () => {
    const m = commandInvoke("external", "serpe", "mutate", { amount: 0.3 });
    expect(m.type).toBe("command");
    expect(m.body).toMatchObject({ name: "mutate", args: { amount: 0.3 } });
  });
});

describe("formatValue", () => {
  it("formats by unit", () => {
    expect(formatValue(cutoff, 2500)).toBe("2.50 kHz");
    expect(formatValue({ unit: "cents" }, 12)).toBe("+12 ¢");
    expect(formatValue({ unit: "count" }, 16)).toBe("16");
    expect(formatValue(morph, 0.5)).toBe("0.500");
  });
});
