import { describe, expect, it } from "vitest";
import { inferKey, relativeMinorTonic } from "./key.js";
import { parseLeadSheet } from "./leadsheet.js";
import { extractTransitions } from "./transitions.js";

// Synthetic fixtures — written for these tests, no corpus material.
const BLUES = `Title = Test Blues
ComposedBy = Fixture
DBKeySig = F
TimeSig = 4 4
Bars = 12
 F7 | Bb7 | F7 | F7 |
 Bb7 | Bb7 | F7 | F7 |
 Gm7 | C7 | F7 | C7 |
`;

const MINOR_TUNE = `Title = Test Minor
DBKeySig = Eb
TimeSig = 4 4
Bars = 4
 Cm7 | Fm7 | G7 | Cm7 |
`;

const EXOTIC = `Title = Test Exotic
DBKeySig = Eb
TimeSig = 4 4
Bars = 4
 EbM7 | G#dim7 | Fm7 NC | EbM7 |
`;

describe("lead-sheet parsing", () => {
  it("parses headers and the bar grid", () => {
    const sheet = parseLeadSheet(BLUES);
    expect(sheet.title).toBe("Test Blues");
    expect(sheet.keySig).toBe("F");
    expect(sheet.barsDeclared).toBe(12);
    expect(sheet.bars).toHaveLength(12);
    expect(sheet.bars[8]).toEqual(["Gm7"]);
    expect(sheet.issues).toEqual([]);
  });

  it("flags bar-count mismatches without throwing", () => {
    const sheet = parseLeadSheet(BLUES.replace("Bars = 12", "Bars = 16"));
    expect(sheet.issues.some((i) => i.includes("mismatch"))).toBe(true);
  });
});

describe("key/mode inference", () => {
  it("computes properly spelled relative minors", () => {
    expect(relativeMinorTonic("Eb")).toBe("C");
    expect(relativeMinorTonic("Gb")).toBe("E♭");
    expect(relativeMinorTonic("F#")).toBe("D♯");
    expect(relativeMinorTonic("C")).toBe("A");
  });

  it("hears a minor tune from the last chord", () => {
    const inf = inferKey("Eb", "Cm7", "Cm7")!;
    expect(inf.key).toEqual({ tonic: "C", mode: "minor" });
    expect(inf.evidence).toBe("last-chord");
  });

  it("falls back to the first chord, then to default-major", () => {
    const inf = inferKey("F", "F7", "C7")!; // last chord is no witness
    expect(inf.key).toEqual({ tonic: "F", mode: "major" });
    expect(inf.evidence).toBe("first-chord");
    const none = inferKey("F", "Gm7", "C7")!;
    expect(none.key).toEqual({ tonic: "F", mode: "major" });
    expect(none.evidence).toBe("default-major");
  });
});

describe("transition extraction", () => {
  it("counts blues transitions in major with degree labels", () => {
    const { major, minor, audit } = extractTransitions([parseLeadSheet(BLUES)]);
    expect(audit.modes).toEqual({ major: 1, minor: 0 });
    expect(minor).toEqual({});
    // F7 | Bb7 | F7 F7 | ... — repeats collapse, so I7→IV7 twice:
    expect(major["I7"]!["IV7"]).toBe(2);
    expect(major["II min7"] ?? major["IImin7"]).toBeDefined();
    expect(audit.repeatsCollapsed).toBeGreaterThan(0);
  });

  it("routes minor tunes to the minor table with natural-minor degrees", () => {
    const { minor, audit } = extractTransitions([parseLeadSheet(MINOR_TUNE)]);
    expect(audit.modes.minor).toBe(1);
    // C minor: Cm7 = Imin7, Fm7 = IVmin7, G7 = V7
    expect(minor["Imin7"]!["IVmin7"]).toBe(1);
    expect(minor["IVmin7"]!["V7"]).toBe(1);
    expect(minor["V7"]!["Imin7"]).toBe(1);
  });

  it("strict mode keeps written exotic spellings; NC breaks the chain", () => {
    const { major, audit } = extractTransitions([parseLeadSheet(EXOTIC)]);
    expect(major["Imaj7"]!["♯IIIdim7"]).toBe(1);
    expect(audit.noChordMarkers).toBe(1);
    // chain broken after NC: no IImin7→Imaj7 transition recorded
    expect(major["IImin7"]?.["Imaj7"]).toBeUndefined();
  });

  it("respell mode normalizes and reports", () => {
    const { major, audit } = extractTransitions([parseLeadSheet(EXOTIC)], { respell: true });
    expect(major["Imaj7"]!["IVdim7"]).toBe(1);
    expect(Object.keys(audit.respelled)).toContain("G♯→A♭ in E♭ major");
  });
});
