/**
 * Accents belong to a LANE — `{…}` inside a poly string.
 *
 * `/` binds loosest (docs/INTENT.md §D4), so the split into lanes happens
 * first and a brace reaches parseUPI as part of the lane body it was written
 * in. `{1001010}E(5,8)/E(1,17)>17` therefore accents lane 1 and says nothing
 * about lane 2; each lane gets its own with `{101}E(3,8)/{11}E(3,7)`. Written
 * down as §D8 on 2026-08-01, after Alex played that first string in Logic and
 * heard no accents at all.
 *
 * This module always carried the per-lane field — the plugin parsed it and
 * threw it away (SERPE_DAW_FINDINGS_2026-08 F2). These cases exist so the
 * reference cannot quietly drift to a whole-string reading while the C++ is
 * pinned to this one by serpe_poly_precedence.
 */
import { describe, it, expect } from "vitest";
import { parsePolyUPI } from "./poly.js";

const bits = (a) => a.map((x) => (x ? "1" : "0")).join("");

describe("poly lane accents", () => {
  it("attaches a leading brace to its own lane, not to the whole string", () => {
    const p = parsePolyUPI("{1001010}E(5,8)/E(1,17)>17");
    expect(p.ok, p.error).toBe(true);
    expect(bits(p.lanes[0].accentPattern)).toBe("1001010");
    expect(p.lanes[1].accentPattern).toBeFalsy();
  });

  it("lets every lane carry its own layer, of its own length", () => {
    const p = parsePolyUPI("{101}E(3,8)/{11}E(3,7)");
    expect(p.ok, p.error).toBe(true);
    expect(bits(p.lanes[0].accentPattern)).toBe("101");
    expect(bits(p.lanes[1].accentPattern)).toBe("11");
  });

  it("accents cycle over a lane's ONSETS, not its steps", () => {
    // {101} over E(3,8) = 10010010: onsets 0,3,6 take accents 1,0,1 — so the
    // accent marks land on steps 0 and 6, and step 3 stays plain. A step-indexed
    // reading would put the second accent on step 2, which has no onset at all.
    const p = parsePolyUPI("{101}E(3,8)/E(3,7)");
    expect(bits(p.lanes[0].steps)).toBe("10010010");
    expect(bits(p.lanes[0].accents)).toBe("10000010");
  });

  it("a lane's accents survive a label and an @offset", () => {
    // Both are stripped before the body is parsed, so the brace still reads as
    // part of the lane it was written in.
    const p = parsePolyUPI("kick={11}E(3,8)@+12ms/snare=E(3,7)");
    expect(p.ok, p.error).toBe(true);
    expect(bits(p.lanes[0].accentPattern)).toBe("11");
    expect(p.lanes[0].offset).toMatchObject({ kind: "ms", ms: 12 });
  });
});
