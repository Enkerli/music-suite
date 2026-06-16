import { describe, expect, it } from "vitest";
import { modulateLabels, planModulation, relatedKeys, transposeLabels } from "./modulation.js";

describe("transposeLabels", () => {
  it("transposes a ii–V–I up a fifth (to the dominant), spelled home", () => {
    // II(2)→VI(9), V(7)→II(2), I(0)→V(7); suffixes preserved.
    expect(transposeLabels(["IIm7", "V7", "Imaj7"], 7, "major")).toEqual(["VIm7", "II7", "Vmaj7"]);
  });

  it("is the identity for interval 0 (and octave multiples)", () => {
    expect(transposeLabels(["IIm7", "V7"], 0, "major")).toEqual(["IIm7", "V7"]);
    expect(transposeLabels(["IIm7", "V7"], 12, "major")).toEqual(["IIm7", "V7"]);
  });

  it("produces chromatic degrees when needed (up a half step)", () => {
    expect(transposeLabels(["Imaj7"], 1, "major")).toEqual(["♭IImaj7"]);
  });
});

describe("relatedKeys / planModulation", () => {
  it("offers the common targets, mode-aware relative key", () => {
    expect(relatedKeys("major").find((o) => o.move.name.startsWith("relative"))!.move.interval).toBe(9);
    expect(relatedKeys("minor").find((o) => o.move.name.startsWith("relative"))!.move.interval).toBe(3);
  });

  it("keeps section 0 at home and is deterministic per seed", () => {
    const a = planModulation(4, "major", 7);
    const b = planModulation(4, "major", 7);
    expect(a[0]).toEqual({ interval: 0, mode: "major", name: "home" });
    expect(a).toEqual(b);
    expect(a).toHaveLength(4);
  });
});

describe("modulateLabels", () => {
  it("re-anchors per section, leaving the home section untouched", () => {
    // 4 labels: first two in section 0 (home), last two in section 1.
    const labels = ["IIm7", "V7", "IIm7", "V7"];
    const sectionOf = [0, 0, 1, 1];
    const { labels: out, plan } = modulateLabels(labels, sectionOf, "major", 7);
    expect(out.slice(0, 2)).toEqual(["IIm7", "V7"]); // home unchanged
    // section 1 is transposed by its move's interval
    const move = plan[1]!;
    expect(out.slice(2)).toEqual(transposeLabels(["IIm7", "V7"], move.interval, "major"));
  });

  it("is a no-op when there is only the home section", () => {
    expect(modulateLabels(["IIm7", "V7"], [0, 0], "major", 1).labels).toEqual(["IIm7", "V7"]);
  });
});
