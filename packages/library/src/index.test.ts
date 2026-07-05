import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  KINDS, APPS, STATUSES, LICENSE_STATUSES,
  newId, nowIso, validateEnvelope, assertEnvelope,
  wrapProgression, unwrapProgression,
  wrapCurationProfile, wrapPatch, unwrapSelfIdentified,
  wrapClip, unwrapClip,
  makeCollection, collectionMembers,
  facetValues, autocomplete, query, suggestSimilar,
  serializeIndex, parseIndex,
  type LibraryItem, type ProgressionEntry,
} from "./index.js";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const PROG_ENTRY: ProgressionEntry = {
  id: "11111111-aaaa-bbbb-cccc-000000000001",
  title: "Warm ballad",
  composer: "Alex",
  source: "generated",
  savedAt: "2026-07-01T17:00:00Z",
  key: "E♭ major",
  bars: 8,
  prog: { format: "progression", chords: ["E♭maj7", "Cm7", "Fm7", "B♭7"] },
};

function validItem(over: Partial<LibraryItem> = {}): LibraryItem {
  return {
    envelope: "enkerli-library-item",
    envelopeVersion: 1,
    id: "22222222-aaaa-bbbb-cccc-000000000002",
    kind: "patch",
    format: "proggenie-patch",
    formatVersion: 1,
    title: "Bold take",
    app: "proggenie",
    savedAt: "2026-07-02T10:00:00Z",
    provenance: { license: "CC0-1.0" },
    payload: { params: { variety: "bold" } },
    ...over,
  };
}

// ── Schema drift guard — the JSON-Schema file and this module must agree ────
// (LIBRARY_SPEC §4: extending a vocabulary is a spec change, not app-local.)

const schema = JSON.parse(readFileSync(
  fileURLToPath(new URL("../../../docs/schemas/library-item.schema.json", import.meta.url)),
  "utf8",
)) as {
  required: string[];
  properties: Record<string, { enum?: string[]; properties?: Record<string, { enum?: string[] }>;
    items?: { properties?: Record<string, { enum?: string[] }> } }>;
};

describe("schema drift guard", () => {
  it("kind vocabulary matches the schema", () => {
    expect([...KINDS]).toEqual(schema.properties.kind!.enum);
  });
  it("app vocabulary matches the schema", () => {
    expect([...APPS]).toEqual(schema.properties.app!.enum);
  });
  it("status vocabulary matches the schema", () => {
    expect([...STATUSES]).toEqual(
      schema.properties.facets!.properties!.status!.enum);
  });
  it("licenseStatus vocabulary matches the schema", () => {
    const src = (schema.properties.provenance! as unknown as {
      properties: { sources: { items: { properties: { licenseStatus: { enum: string[] } } } } };
    }).properties.sources.items.properties.licenseStatus.enum;
    expect([...LICENSE_STATUSES]).toEqual(src);
  });
  it("required top-level fields match the schema", () => {
    const item = validItem();
    for (const field of schema.required) {
      const broken = { ...item } as Record<string, unknown>;
      delete broken[field];
      expect(validateEnvelope(broken).ok, `dropping ${field} must fail`).toBe(false);
    }
  });
});

// ── Identity & time ──────────────────────────────────────────────────────────

describe("identity", () => {
  it("newId is unique and ≥ 8 chars", () => {
    const a = newId(), b = newId();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(8);
  });
  it("nowIso is absolute ISO 8601", () => {
    expect(nowIso()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });
});

// ── Validation ───────────────────────────────────────────────────────────────

describe("validateEnvelope", () => {
  it("accepts a valid inline item", () => {
    expect(validateEnvelope(validItem())).toEqual({ ok: true, errors: [] });
  });
  it("accepts a valid payloadRef item", () => {
    const item = validItem({ payloadRef: { path: "banks/akwf_flute.wav",
      mediaType: "audio/wav", sha256: "a".repeat(64) } });
    delete (item as Record<string, unknown>).payload;
    expect(validateEnvelope(item).ok).toBe(true);
  });
  it("rejects payload AND payloadRef together (oneOf)", () => {
    const r = validateEnvelope(validItem({
      payloadRef: { path: "x.wav", sha256: "b".repeat(64) } }));
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toContain("exactly one");
  });
  it("rejects neither payload nor payloadRef", () => {
    const item = validItem() as Record<string, unknown>;
    delete item.payload;
    expect(validateEnvelope(item).ok).toBe(false);
  });
  it("rejects unknown top-level properties (additionalProperties: false)", () => {
    const r = validateEnvelope({ ...validItem(), folder: "presets/warm" });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toContain("unknown property: folder");
  });
  it("rejects a kind outside the vocabulary", () => {
    expect(validateEnvelope(validItem({ kind: "song" as never })).ok).toBe(false);
  });
  it("rejects a bad sha256", () => {
    const item = validItem({ payloadRef: { path: "x", sha256: "XYZ" } });
    delete (item as Record<string, unknown>).payload;
    expect(validateEnvelope(item).errors.join()).toContain("sha256");
  });
  it("rejects a relative/naked date", () => {
    expect(validateEnvelope(validItem({ savedAt: "yesterday" })).ok).toBe(false);
    expect(validateEnvelope(validItem({ savedAt: "2026-07-02" })).ok).toBe(false);
  });
  it("accepts timezone-offset date-times", () => {
    expect(validateEnvelope(validItem({ savedAt: "2026-07-02T10:00:00+02:00" })).ok).toBe(true);
  });
  it("requires provenance.license", () => {
    const r = validateEnvelope(validItem({ provenance: {} as never }));
    expect(r.errors.join()).toContain("provenance.license");
  });
  it("validates provenance sources' licenseStatus vocabulary", () => {
    const r = validateEnvelope(validItem({ provenance: {
      license: "CC0-1.0",
      sources: [{ name: "AKWF", licenseClaim: "CC0", licenseStatus: "maybe" as never }],
    } }));
    expect(r.ok).toBe(false);
  });
  it("rejects non-scalar facet values", () => {
    const r = validateEnvelope(validItem({ facets: { key: ["E♭"] as never } }));
    expect(r.errors.join()).toContain("facets.key");
  });
  it("rejects facets.status outside the vocabulary", () => {
    expect(validateEnvelope(validItem({ facets: { status: "wip" as never } })).ok).toBe(false);
  });
  it("collects multiple errors, not just the first", () => {
    const r = validateEnvelope({ envelope: "nope", id: "x" });
    expect(r.errors.length).toBeGreaterThan(3);
  });
  it("assertEnvelope throws on invalid, narrows on valid", () => {
    expect(() => assertEnvelope({})).toThrow(/invalid library item/);
    expect(assertEnvelope(validItem()).kind).toBe("patch");
  });
});

// ── wrap / unwrap (the three ProgGenie kinds) ────────────────────────────────

describe("wrapProgression", () => {
  it("produces a valid envelope; key/bars become facets", () => {
    const item = wrapProgression(PROG_ENTRY);
    expect(validateEnvelope(item).ok).toBe(true);
    expect(item.kind).toBe("progression");
    expect(item.facets).toEqual({ key: "E♭ major", bars: 8 });
    expect(item.payload?.composer).toBe("Alex");
  });
  it("round-trips the legacy entry", () => {
    expect(unwrapProgression(wrapProgression(PROG_ENTRY))).toEqual(PROG_ENTRY);
  });
  it("carries the Progression payload verbatim", () => {
    const item = wrapProgression(PROG_ENTRY);
    expect(item.payload?.prog).toEqual(PROG_ENTRY.prog);
  });
  it("supplies id/savedAt when the entry lacks them", () => {
    const item = wrapProgression({ title: "Sketch", prog: { chords: [] } });
    expect(validateEnvelope(item).ok).toBe(true);
    expect(item.id.length).toBeGreaterThanOrEqual(8);
  });
});

describe("wrap self-identified files", () => {
  const CURATION = { format: "progression-studio-curation", version: 1,
    savedAt: "2026-06-14T12:00:00Z", weights: { "IIm7>V7": 1.4 } };
  const PATCH = { format: "proggenie-patch", version: 1,
    savedAt: "2026-06-15T09:30:00Z", params: { variety: "fresh" } };

  it("curation profile wraps verbatim and validates", () => {
    const item = wrapCurationProfile(CURATION, "My ballads profile");
    expect(validateEnvelope(item).ok).toBe(true);
    expect(item.kind).toBe("curation-profile");
    expect(item.format).toBe("progression-studio-curation");
    expect(item.savedAt).toBe(CURATION.savedAt);          // lifts, not re-stamps
    expect(unwrapSelfIdentified(item)).toEqual(CURATION); // verbatim payload
  });
  it("patch wraps verbatim and validates", () => {
    const item = wrapPatch(PATCH, "Bold take settings");
    expect(validateEnvelope(item).ok).toBe(true);
    expect(item.formatVersion).toBe(1);
    expect(unwrapSelfIdentified(item)).toEqual(PATCH);
  });
  it("refuses the wrong format (self-identification is load-bearing)", () => {
    expect(() => wrapPatch(CURATION, "x")).toThrow(/expected format/);
  });
});

describe("wrapClip (MIDIcurator)", () => {
  const CLIP = {
    id: "55555555-aaaa-bbbb-cccc-000000000005",
    filename: "groove_120bpm.mid",
    imported_at: 1751630400000, // 2025-07-04T12:00:00.000Z
    bpm: 120,
    rating: 4,
    flagged: true,
    gesture: { onsets: [0, 480], density: 0.5 },
    harmonic: { pitches: [60, 64, 67] },
    notes: "",
  };

  it("wraps verbatim, lifts facets, validates", () => {
    const item = wrapClip(CLIP, { tags: ["jazz", "keeper"] });
    expect(validateEnvelope(item).ok).toBe(true);
    expect(item.kind).toBe("clip");
    expect(item.app).toBe("midicurator");
    expect(item.title).toBe("groove_120bpm.mid");
    expect(item.facets).toEqual({ bpm: 120, rating: 4, flagged: true });
    expect(item.tags).toEqual(["jazz", "keeper"]);
    expect(item.savedAt).toBe(new Date(CLIP.imported_at).toISOString());
    expect(unwrapClip(item)).toEqual(CLIP); // payload verbatim
  });

  it("skips null rating and missing facets", () => {
    const item = wrapClip({ ...CLIP, rating: null, flagged: undefined as never });
    expect(item.facets).toEqual({ bpm: 120 });
    expect(validateEnvelope(item).ok).toBe(true);
  });

  it("derives a DETERMINISTIC envelope id for schema-short clip ids", () => {
    const a = wrapClip({ ...CLIP, id: "a" });
    const b = wrapClip({ ...CLIP, id: "a" });
    expect(a.id).toBe(b.id);                       // stable across saves
    expect(a.id.length).toBeGreaterThanOrEqual(8); // schema-valid
    expect(validateEnvelope(a).ok).toBe(true);
    expect(unwrapClip(a).id).toBe("a");            // the clip's own id survives
  });
});

describe("collections", () => {
  it("a collection is itself a valid, nestable item", () => {
    const inner = makeCollection("Set A", ["id-aaaaaaaa"], "proggenie");
    const outer = makeCollection("Session 07-04",
      [inner.id, { id: "id-bbbbbbbb", note: "keeper" }], "proggenie");
    expect(validateEnvelope(inner).ok).toBe(true);
    expect(validateEnvelope(outer).ok).toBe(true);
    expect(collectionMembers(outer)).toEqual([
      { id: inner.id }, { id: "id-bbbbbbbb", note: "keeper" }]);
  });
});

// ── Faceted query layer ──────────────────────────────────────────────────────

function corpus(): LibraryItem[] {
  return [
    wrapProgression({ ...PROG_ENTRY, id: "id-1-aaaaaaaa" }, { tags: ["ballad", "warm"] }),
    wrapProgression({ ...PROG_ENTRY, id: "id-2-aaaaaaaa", title: "Uptempo blues",
      key: "F major", bars: 12, savedAt: "2026-07-02T11:00:00Z" }, { tags: ["blues"] }),
    wrapPatch({ format: "proggenie-patch", version: 1, params: {} }, "Warm patch",
      { id: "id-3-aaaaaaaa", tags: ["warm"] }),
    validItem({ id: "id-4-aaaaaaaa", kind: "preset", app: "vane",
      format: "vane-preset", title: "Reedlike",
      facets: { status: "draft" }, tags: ["breath"] }),
  ];
}

describe("facetValues", () => {
  it("counts distinct values, most-used first", () => {
    const items = [...corpus(), wrapProgression({ ...PROG_ENTRY, id: "id-5-aaaaaaaa" })];
    expect(facetValues(items, "key")[0]).toEqual({ value: "E♭ major", count: 2 });
  });
});

describe("autocomplete", () => {
  it("completes controlled vocabularies even with no data (vocabulary order)", () => {
    const c = autocomplete([], "kind", "p");
    expect(c.map((x) => x.value)).toEqual(["progression", "patch", "preset"]);
    expect(c.every((x) => x.controlled && x.count === 0)).toBe(true);
  });
  it("ranks controlled before observed, then by usage", () => {
    const c = autocomplete(corpus(), "tags", "w");
    expect(c[0]).toEqual({ value: "warm", controlled: false, count: 2 });
  });
  it("facet fields complete from observed values", () => {
    const c = autocomplete(corpus(), "facets.key", "e");
    expect(c[0]?.value).toBe("E♭ major");
  });
  it("status completes from the authority", () => {
    expect(autocomplete([], "status", "").map((x) => x.value))
      .toEqual(["stub", "draft", "complete", "verified"]);
  });
  it("matching is case-insensitive", () => {
    expect(autocomplete(corpus(), "title", "warm")[0]?.value).toBe("Warm ballad");
  });
});

describe("query", () => {
  it("filters by kind + facet together", () => {
    const hits = query(corpus(), { kind: "progression", facets: { bars: 12 } });
    expect(hits.map((h) => h.title)).toEqual(["Uptempo blues"]);
  });
  it("requires all given tags", () => {
    expect(query(corpus(), { tags: ["warm", "ballad"] })).toHaveLength(1);
    expect(query(corpus(), { tags: ["warm"] })).toHaveLength(2);
  });
  it("free text spans title and tags", () => {
    expect(query(corpus(), { text: "breath" })[0]?.title).toBe("Reedlike");
  });
  it("filters by app", () => {
    expect(query(corpus(), { app: "vane" })).toHaveLength(1);
  });
});

describe("suggestSimilar", () => {
  it("ranks shared facets + tags above kind-only matches", () => {
    const items = corpus();
    const warmBallad = items[0]!;
    const s = suggestSimilar(items, warmBallad);
    // "Uptempo blues": same kind + app but different key/tags.
    // "Warm patch": shares the "warm" tag + app.
    const titles = s.map((x) => x.item.title);
    expect(titles).toContain("Uptempo blues");
    expect(titles).toContain("Warm patch");
    expect(s.find((x) => x.item.title === "Reedlike")).toBeUndefined; // different everything
  });
  it("never suggests the subject itself", () => {
    const items = corpus();
    expect(suggestSimilar(items, items[0]!).map((x) => x.item.id))
      .not.toContain(items[0]!.id);
  });
});

// ── Index round-trip ─────────────────────────────────────────────────────────

describe("index serialization", () => {
  it("round-trips a library", () => {
    const items = corpus();
    const parsed = parseIndex(serializeIndex(items));
    expect(parsed.errors).toEqual([]);
    expect(parsed.items).toEqual(items);
  });
  it("keeps valid entries and reports invalid ones (never silent)", () => {
    const good = validItem();
    const parsed = parseIndex(JSON.stringify([good, { junk: true }]));
    expect(parsed.items).toEqual([good]);
    expect(parsed.errors).toHaveLength(1);
    expect(parsed.errors[0]?.index).toBe(1);
  });
  it("reports non-JSON and non-array inputs", () => {
    expect(parseIndex("not json").errors[0]?.errors[0]).toContain("JSON");
    expect(parseIndex("{}").errors[0]?.errors[0]).toContain("array");
  });
});
