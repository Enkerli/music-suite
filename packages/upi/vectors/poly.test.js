import { describe, it, expect } from "vitest";
import { parsePolyUPI } from "../src/poly.js";
import vectors from "./poly.json";

// This file is also the cross-language contract for Serpe's C++ UPIParser
// lanes (docs/SERPE_POLY.md §8 milestone 1) — vendored into the plugin repo
// as WebApp/tests/poly-vectors.json. If parsePolyUPI drifts from this file,
// regenerate with gen-poly-vectors.mjs and re-vendor; don't hand-edit poly.json.
const bits = (steps) => steps.join("");

describe("poly.json vectors stay reproduced by parsePolyUPI", () => {
  for (const c of vectors.cases) {
    it(c.input, () => {
      const p = parsePolyUPI(c.input);
      expect(p.ok).toBe(c.ok);
      if (!c.ok) return;
      expect(p.lcm).toBe(c.lcm);
      expect(p.lanes.map((l) => ({ label: l.label, steps: bits(l.steps), offset: l.offset })))
        .toEqual(c.lanes);
    });
  }
});
