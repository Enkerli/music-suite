import { describe, it, expect } from "vitest";
import { upiFamily, patternFacets } from "./library-facets.js";

/**
 * Serpe's library predates poly, and what that hid was not cosmetic:
 * `saveToLibrary` gated on a `parseUPI` result, so a poly pattern, a scene
 * chain and a progressive pattern could not be SAVED AT ALL — the button
 * silently did nothing for three whole classes of notation the app plays.
 *
 * These pin that every layer the notation carries survives into the library,
 * because a facet that quietly disappears is how that happened the first time.
 */
describe("library facets — nothing the notation says gets dropped", () => {
  const all = (u) => { const f = patternFacets(u); return [...f.readings, ...f.feet, ...f.layers]; };

  it("reads recognition and foot for a plain pattern", () => {
    expect(all("E(3,8)")).toContain("E(3,8)");
    expect(all("E(3,8)")).toContain("antibacchic");   // the tresillo's 3+3+2
  });

  it("analyses EVERY lane, not just the first", () => {
    // A 3-against-4 is two different rhythms. Naming the pair after one of
    // them would be worse than saying nothing.
    const f = patternFacets("kick=E(3,8) / snare=E(2,4)");
    expect(f.readings).toEqual(["E(3,8)", "E(2,4)"]);
    expect(f.layers).toContain("poly 2");
  });

  it("de-duplicates, so four identical lanes do not repeat themselves", () => {
    const f = patternFacets("a=E(3,8) / b=E(3,8) / c=E(3,8)");
    expect(f.readings).toEqual(["E(3,8)"]);
    expect(f.layers).toContain("poly 3");
  });

  it("surfaces each layer that only the fuller notation has", () => {
    expect(all("E(3,8)|E(5,8)|E(7,8)")).toContain("scenes 3");
    expect(all("E(1,8)>5")).toContain("progressive");
    expect(all("{10010}E(5,8)")).toContain("accents");
    expect(all("E(3,8)LS(2)")).toContain("durations");
    expect(all("E(3,8)/E(4,8)@+20ms")).toContain("offset");
    expect(all("E(3,8)PD(20%)")).toContain("microtiming");
  });

  it("says nothing about layers a pattern does not have", () => {
    const f = patternFacets("E(3,8)");
    expect(f.layers).toEqual([]);
  });

  it("survives junk without throwing", () => {
    expect(() => patternFacets("E(3,")).not.toThrow();
    expect(() => patternFacets("")).not.toThrow();
  });
});

describe("upiFamily — a lane's family, not the whole string's", () => {
  it("names a plain pattern by its generator", () => {
    expect(upiFamily("E(3,8)")).toBe("Euclidean");
    expect(upiFamily("P(3,0)")).toBe("Polygon");
    expect(upiFamily("0x94:8")).toBe("Numeric");
    expect(upiFamily("{10010}E(5,8)")).toBe("Explicit");
  });

  it("looks past a lane LABEL and past the other lanes", () => {
    // `kick=E(3,8) / snare=E(2,4)` starts with a letter, so the old regex put
    // every labelled or multi-lane pattern in "Other" — unfindable by family.
    expect(upiFamily("kick=E(3,8) / snare=E(2,4)")).toBe("Euclidean");
    expect(upiFamily("lead=P(5,2)")).toBe("Polygon");
  });

  it("still admits it does not know", () => {
    expect(upiFamily("M:sos")).toBe("Other");
  });
});
