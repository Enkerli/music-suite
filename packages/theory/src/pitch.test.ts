import { describe, expect, it } from "vitest";
import { directedInterval, intervalClass, mod12, nameToPc, pcSet, pcToName } from "./pitch.js";

describe("pitch fundamentals", () => {
  it("mod12 normalizes negatives", () => {
    expect(mod12(-1)).toBe(11);
    expect(mod12(12)).toBe(0);
    expect(mod12(-13)).toBe(11);
  });

  it("parses note names including multiple accidentals", () => {
    expect(nameToPc("C")).toBe(0);
    expect(nameToPc("Eb")).toBe(3);
    expect(nameToPc("F#")).toBe(6);
    expect(nameToPc("Cb")).toBe(11);
    expect(nameToPc("B##")).toBe(1);
    expect(nameToPc("bb")).toBe(10);
    expect(nameToPc("H")).toBeUndefined();
    expect(nameToPc("")).toBeUndefined();
  });

  it("renders names under both spelling policies", () => {
    expect(pcToName(3)).toBe("Eb");
    expect(pcToName(3, "sharp")).toBe("D#");
    expect(pcToName(10, "flat")).toBe("Bb");
  });

  it("interval class is symmetric and capped at 6", () => {
    expect(intervalClass(0, 7)).toBe(5);
    expect(intervalClass(7, 0)).toBe(5);
    expect(intervalClass(0, 6)).toBe(6);
    expect(intervalClass(11, 0)).toBe(1);
  });

  it("directed interval picks the short way, tritone resolves to +6", () => {
    expect(directedInterval(0, 7)).toBe(-5);
    expect(directedInterval(0, 5)).toBe(5);
    expect(directedInterval(0, 6)).toBe(6);
    expect(directedInterval(11, 0)).toBe(1);
  });

  it("pcSet sorts, dedupes, and normalizes", () => {
    expect(pcSet([7, 0, 4, 12, -5])).toEqual([0, 4, 7]);
  });
});
