import { describe, expect, it } from "vitest";
import table from "./data/transitions.json";
import {
  adjustTransition,
  effectiveRow,
  emptyCuration,
  exportCuration,
  importCuration,
  mergeCuration,
  filterWeights,
  multiplierFor,
  pairKey,
  profileSummary,
  rateProgression,
  splitTransitionKey,
  transitionDegrees,
  resetTransition,
  TRANSITION_STEP,
} from "./curation.js";
import { generateProgression } from "./generate.js";

describe("mergeCuration", () => {
  it("compounds shared transitions and keeps the rest", () => {
    const a = { multipliers: { "A → B": 1.5, "C → D": 0.5 } };
    const b = { multipliers: { "A → B": 2, "E → F": 1.5 } };
    const m = mergeCuration(a, b);
    expect(m.multipliers["A → B"]).toBeCloseTo(3); // 1.5 × 2
    expect(m.multipliers["C → D"]).toBe(0.5); // only in base
    expect(m.multipliers["E → F"]).toBe(1.5); // only in incoming
  });

  it("clamps to [1/16, 16] and drops weights that compound back to neutral", () => {
    expect(mergeCuration({ multipliers: { "A → B": 8 } }, { multipliers: { "A → B": 8 } })
      .multipliers["A → B"]).toBe(16); // 64 clamped
    expect(mergeCuration({ multipliers: { "X → Y": 2 } }, { multipliers: { "X → Y": 0.5 } })
      .multipliers["X → Y"]).toBeUndefined(); // 2 × 0.5 = 1 → dropped
  });
});

describe("profileSummary (profile-as-shape)", () => {
  it("surfaces the strongest boosts and suppressions with a total count", () => {
    const c = { multipliers: { "V7 → I": 4, "IIm7 → V7": 1.5, "I → IV": 0.5, "VI → II": 0.25, "X → Y": 1.1 } };
    const s = profileSummary(c, { max: 2 });
    expect(s.count).toBe(5);
    expect(s.boosts.map(([k]) => k)).toEqual(["V7 → I", "IIm7 → V7"]); // strongest first
    expect(s.suppressions.map(([k]) => k)).toEqual(["VI → II", "I → IV"]); // most-suppressed first
  });

  it("is empty and safe on a blank profile", () => {
    const s = profileSummary({ multipliers: {} });
    expect(s).toEqual({ boosts: [], suppressions: [], count: 0 });
    expect(profileSummary(undefined).count).toBe(0);
  });
});

describe("filter-by-degree (profile lens, Q6)", () => {
  const entries = Object.entries({
    "IIm7 → V7": 1.5, "♭VImaj7 → V7": 1.35, "IVmaj7 → V7": 0.6, "V7 → Imaj7": 1.74, "Imaj7 → Imaj7": 0.34,
  });

  it("splits a transition key into its two degrees", () => {
    expect(splitTransitionKey("IIm7 → V7")).toEqual(["IIm7", "V7"]);
  });

  it("filters by destination degree (everything into V7)", () => {
    const into = filterWeights(entries, "any", "V7");
    expect(into.map(([k]) => k)).toEqual(["IIm7 → V7", "♭VImaj7 → V7", "IVmaj7 → V7"]);
  });

  it("filters by origin, and 'any/any' is the identity", () => {
    expect(filterWeights(entries, "V7", "any").map(([k]) => k)).toEqual(["V7 → Imaj7"]);
    expect(filterWeights(entries, "any", "any")).toHaveLength(entries.length);
  });

  it("lists the distinct origin and destination degrees", () => {
    const { origins, dests } = transitionDegrees(entries);
    expect(origins).toContain("IIm7");
    expect(dests).toEqual(["Imaj7", "V7"]);
  });
});

describe("curation multipliers", () => {
  it("adjusts, accumulates, clamps, and drops identity entries", () => {
    let c = emptyCuration();
    c = adjustTransition(c, "IIm7", "V7", TRANSITION_STEP);
    expect(multiplierFor(c, "IIm7", "V7")).toBeCloseTo(1.5);
    c = adjustTransition(c, "IIm7", "V7", 1 / TRANSITION_STEP);
    expect(multiplierFor(c, "IIm7", "V7")).toBe(1);
    expect(Object.keys(c.multipliers)).toHaveLength(0);
    for (let i = 0; i < 20; i++) c = adjustTransition(c, "IIm7", "V7", 2);
    expect(multiplierFor(c, "IIm7", "V7")).toBe(16); // clamped
  });

  it("rates whole progressions pair by pair", () => {
    const c = rateProgression(emptyCuration(), ["Imaj7", "IIm7", "V7", "Imaj7"], 0.8);
    expect(multiplierFor(c, "Imaj7", "IIm7")).toBeCloseTo(0.8);
    expect(multiplierFor(c, "IIm7", "V7")).toBeCloseTo(0.8);
    expect(multiplierFor(c, "V7", "Imaj7")).toBeCloseTo(0.8);
  });

  it("effectiveRow scales counts without touching the base table", () => {
    const base = { V7: 100, IIIm7: 50 };
    const c = adjustTransition(emptyCuration(), "IIm7", "V7", 0.5);
    const eff = effectiveRow(base, "IIm7", c);
    expect(eff.V7).toBe(50);
    expect(eff.IIIm7).toBe(50);
    expect(base.V7).toBe(100);
    expect(effectiveRow(base, "IIm7", emptyCuration())).toBe(base); // no copy when untouched
  });

  it("round-trips through export/import and rejects garbage", () => {
    const c = adjustTransition(emptyCuration(), "Imaj7", "♭II7", 4);
    const back = importCuration(exportCuration(c));
    expect(back.multipliers[pairKey("Imaj7", "♭II7")]).toBe(4);
    expect(() => importCuration('{"nope": true}')).toThrow();
    // optional savedAt timestamp is embedded and ignored on import
    const stamped = exportCuration(c, { savedAt: "2026-06-14T15:30:00.000Z" });
    expect(JSON.parse(stamped).savedAt).toBe("2026-06-14T15:30:00.000Z");
    expect(importCuration(stamped).multipliers[pairKey("Imaj7", "♭II7")]).toBe(4);
  });
});

describe("curation steers generation", () => {
  it("a heavy boost makes the boosted transition dominate", () => {
    // Find Imaj7's most and least likely successors, boost a rare one hard.
    const row = table.major["Imaj7"];
    const targets = Object.keys(row);
    const rare = targets[Math.min(40, targets.length - 1)];
    let boosted = emptyCuration();
    for (let i = 0; i < 10; i++) boosted = adjustTransition(boosted, "Imaj7", rare, 2);

    const count = (curation) => {
      let hits = 0;
      for (let seed = 0; seed < 60; seed++) {
        const labels = generateProgression(table.major, "major", 12, seed, curation);
        for (let i = 1; i < labels.length; i++) {
          if (labels[i - 1] === "Imaj7" && labels[i] === rare) hits++;
        }
      }
      return hits;
    };
    expect(count(boosted)).toBeGreaterThan(count(emptyCuration()) * 2);
  });

  it("generation stays deterministic for a (seed, curation) pair", () => {
    const c = adjustTransition(emptyCuration(), "IIm7", "V7", 3);
    expect(generateProgression(table.major, "major", 16, 5, c))
      .toEqual(generateProgression(table.major, "major", 16, 5, c));
  });
});
