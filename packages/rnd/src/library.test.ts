import { describe, expect, it } from "vitest";
import { validateEnvelope } from "@enkerli/library";

import { emptyStatus, applyMessage, decodeSysex, fromHex } from "./index.js";
import { libraryItemToSeed, seedToLibraryItem, SEED_FORMAT } from "./library.js";

const capturedStatus = () => {
  let s = emptyStatus();
  for (const hex of [
    "F0 6F 62 78 10 67 59 10 52 0A F7",
    "F0 6F 62 78 21 02 7D 00 02 11 F7",
    "F0 6F 62 78 22 00 00 01 46 4D 00 F7",
  ]) {
    const m = decodeSysex(fromHex(hex));
    if (m) s = applyMessage(s, m);
  }
  return s;
};

describe("seeds as library items", () => {
  it("produces an envelope the suite validator accepts", () => {
    const item = seedToLibraryItem({ seed: 0xaa442ce7, rating: "keep", status: capturedStatus() });
    const result = validateEnvelope(item);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("validates a sparse capture too — no status is a valid entry", () => {
    const item = seedToLibraryItem({ seed: 1 });
    expect(validateEnvelope(item).ok).toBe(true);
    expect(item.facets?.hasStatus).toBe(false);
    expect((item.payload as { captured?: unknown }).captured).toBeUndefined();
  });

  it("files a seed as a patch, titled by its own hex", () => {
    const item = seedToLibraryItem({ seed: 0xaa442ce7 });
    expect(item.kind).toBe("patch");
    expect(item.app).toBe("rnd-companion");
    expect(item.format).toBe(SEED_FORMAT);
    expect(item.title).toBe("0xaa442ce7");
    // The id is never derived from the title (LIBRARY_SPEC §1).
    expect(item.id).not.toContain("aa442ce7");
  });

  it("puts what you would search on into facets, names included", () => {
    const item = seedToLibraryItem({ seed: 0xaa442ce7, rating: "keep", status: capturedStatus() });

    expect(item.facets).toMatchObject({
      seedValue: 0xaa442ce7,
      rating: "keep",
      hasStatus: true,
      tempoBpm: 125,
      scaleIndex: 17,
      scale: "prometheus",
      rootWhenCaptured: 2,
      rootName: "D",
      trackCount: 1,
      engines: "FM",
    });

    expect(item.tags).toContain("keep");
    expect(item.tags).toContain("prometheus");
  });

  it("round-trips through the envelope without losing anything", () => {
    const status = capturedStatus();
    const item = seedToLibraryItem({
      seed: 0xaa442ce7, rating: "pass", note: "too busy", status,
    });

    const back = libraryItemToSeed(item);
    expect(back).not.toBeNull();
    expect(back!.seed).toBe(0xaa442ce7);
    expect(back!.rating).toBe("pass");
    expect(back!.note).toBe("too busy");
    expect(back!.status?.tempoBpm).toBe(125);
    expect(back!.status?.scaleIndex).toBe(17);
    expect(back!.status?.engines).toEqual([{ index: 0, name: "FM" }]);

    // Identity and time survive, so re-saving does not fork the item.
    expect(back!.id).toBe(item.id);
    expect(back!.savedAt).toBe(item.savedAt);
    expect(validateEnvelope(seedToLibraryItem(back!)).ok).toBe(true);
  });

  it("refuses items that are not ours", () => {
    const item = seedToLibraryItem({ seed: 1 });
    expect(libraryItemToSeed({ ...item, format: "proggenie-patch" })).toBeNull();
    expect(libraryItemToSeed({ ...item, payload: undefined })).toBeNull();
    expect(libraryItemToSeed({ ...item, payload: { seed: "not a seed", rating: "keep" } })).toBeNull();
  });

  it("keeps the root labelled as a moment, not a setting", () => {
    const item = seedToLibraryItem({ seed: 1, status: capturedStatus() });
    const payload = item.payload as { captured?: Record<string, unknown> };
    // The device reports the root it is playing now; naming the field for that
    // is the difference between a record and a claim.
    expect(payload.captured).toHaveProperty("rootWhenCaptured");
    expect(payload.captured).not.toHaveProperty("tonic");
  });
});
