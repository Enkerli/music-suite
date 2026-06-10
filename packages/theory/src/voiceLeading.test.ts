import { describe, expect, it } from "vitest";
import vectors from "../vectors/voice-leading.json";
import { minimalVoiceLeading, voiceLeadingSize } from "./voiceLeading.js";
import { intervalClass } from "./pitch.js";

describe("minimal taxicab voice leading", () => {
  for (const c of vectors.cases) {
    it(c.name, () => {
      expect(voiceLeadingSize(c.from, c.to)).toBe(c.size);
    });
  }

  it("is symmetric on all vectors", () => {
    for (const c of vectors.cases) {
      expect(voiceLeadingSize(c.to, c.from)).toBe(c.size);
    }
  });

  it("mapping covers every pc of both sets and its cost equals size", () => {
    for (const c of vectors.cases) {
      const { size, mapping } = minimalVoiceLeading(c.from, c.to);
      const froms = new Set(mapping.map(([a]) => a));
      const tos = new Set(mapping.map(([, b]) => b));
      for (const pc of new Set(c.from.map((n) => ((n % 12) + 12) % 12))) {
        expect(froms.has(pc)).toBe(true);
      }
      for (const pc of new Set(c.to.map((n) => ((n % 12) + 12) % 12))) {
        expect(tos.has(pc)).toBe(true);
      }
      const cost = mapping.reduce((s, [a, b]) => s + intervalClass(a, b), 0);
      expect(cost).toBe(size);
    }
  });

  it("handles empty input", () => {
    expect(minimalVoiceLeading([], [0, 4, 7])).toEqual({ size: 0, mapping: [] });
  });
});
