/**
 * @enkerli/library — the suite content model (implementation of
 * docs/LIBRARY_SPEC.md; envelope schema: docs/schemas/library-item.schema.json).
 *
 * One JSON envelope wraps every content kind the suite produces; existing
 * formats are carried as payloads, VERBATIM — adoption means wrapping, not
 * migrating. The envelope supplies what a folder of files cannot: stable
 * identity, provenance chains, controlled vocabularies, and faceted search.
 *
 * This module is zero-dependency (like @enkerli/theory) and browser/node
 * neutral: no storage here — storage profiles (localStorage, bridge-backed
 * file, app-data dir) are the adopting app's concern (LIBRARY_SPEC §3).
 * A test cross-checks the vocabularies and structural rules against the
 * JSON-Schema file so the two sources of truth cannot drift silently.
 */

// ── Controlled vocabularies (LIBRARY_SPEC §4 — the authorities) ──────────────
// Extending one of these is a spec change (PR to LIBRARY_SPEC.md + schema),
// not an app-local invention.

export const KINDS = [
  "progression", "curation-profile", "patch", "clip", "preset",
  "wavetable", "controller-profile", "qurve", "derived-table", "collection",
  "phrase", "pattern", "control-map",
] as const;
export type Kind = (typeof KINDS)[number];

/**
 * Addressable destinations on the control plane. A message's `to` must be one
 * of these or `*` — anything else is rejected by validateMessage.
 *
 * `drums` is not an app with a window; it is the synthesised kit
 * (@enkerli/drumsynth), addressable the same way `vane` is because it is the
 * same kind of thing — an instrument that takes notes. Added 2026-08-02, when
 * pointing the Pattern Player at the Workspace's Drum Kit module produced
 * silence: the notes were being published and DROPPED by validation, with
 * nothing said, because "drums" was not a destination anyone had declared.
 */
export const APPS = [
  "proggenie", "midicurator", "serpe", "vane", "drawnqurve",
  "pitchfold", "exquisite-fingerings", "pickpcs", "chord-dictionary",
  "drums", "external",
] as const;
export type AppId = (typeof APPS)[number];

export const STATUSES = ["stub", "draft", "complete", "verified"] as const;
export type Status = (typeof STATUSES)[number];

export const LICENSE_STATUSES = [
  "verified", "needs_local_verification", "unverified",
] as const;
export type LicenseStatus = (typeof LICENSE_STATUSES)[number];

// ── Envelope types ────────────────────────────────────────────────────────────

export interface ProvenanceSource {
  name: string;
  url?: string;
  licenseClaim: string;
  licenseStatus: LicenseStatus;
  licenseEvidence?: string;
}

export interface Provenance {
  generator?: { app?: string; version?: string };
  derivedFrom?: Array<{ id: string; role?: string }>;
  sources?: ProvenanceSource[];
  /** SPDX identifier for THIS item. User material defaults to CC0-1.0. */
  license: string;
}

export interface PayloadRef {
  /** Relative to the library index. */
  path: string;
  mediaType?: string;
  sha256: string;
}

export type FacetValue = string | number | boolean;

export interface LibraryItem {
  envelope: "enkerli-library-item";
  envelopeVersion: number;
  /** Stable unique id (UUID preferred). Never derived from title or path. */
  id: string;
  kind: Kind;
  /** The payload's self-name, e.g. "proggenie-patch". */
  format: string;
  formatVersion: number;
  title: string;
  creator?: string;
  app: AppId;
  /** Absolute ISO 8601. Never rely on file-system dates. */
  savedAt: string;
  provenance: Provenance;
  facets?: Record<string, FacetValue>;
  tags?: string[];
  /** Exactly one of payload / payloadRef is present. */
  payload?: Record<string, unknown>;
  payloadRef?: PayloadRef;
}

// ── Identity & time ───────────────────────────────────────────────────────────

/** A new id (crypto.randomUUID when available — ProgGenie's pattern). */
export function newId(): string {
  const uuid = (globalThis as { crypto?: { randomUUID?: () => string } })
    .crypto?.randomUUID?.();
  return uuid ?? `it${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

/** Absolute ISO 8601, seconds precision (LIBRARY_SPEC §1.6 preservation rule). */
export function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

// ── Validation (mirrors library-item.schema.json — drift-guarded by test) ────

const REQUIRED_TOP = [
  "envelope", "envelopeVersion", "id", "kind", "format",
  "formatVersion", "title", "app", "savedAt", "provenance",
] as const;

const ALLOWED_TOP = [
  ...REQUIRED_TOP, "creator", "facets", "tags", "payload", "payloadRef",
] as const;

const SHA256_RE = /^[0-9a-f]{64}$/;
// ISO 8601 date-time (the schema's `format: date-time`): date, 'T', time, zone.
const DATE_TIME_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

/**
 * Validate an envelope against the spec's structural rules. Returns every
 * violation found (not just the first) so an adopting app can report well.
 */
export function validateEnvelope(x: unknown): ValidationResult {
  const errors: string[] = [];
  const err = (m: string) => errors.push(m);

  if (!isPlainObject(x)) return { ok: false, errors: ["item: not an object"] };

  for (const k of REQUIRED_TOP) if (!(k in x)) err(`missing required: ${k}`);
  for (const k of Object.keys(x))
    if (!(ALLOWED_TOP as readonly string[]).includes(k))
      err(`unknown property: ${k}`);

  if (x.envelope !== undefined && x.envelope !== "enkerli-library-item")
    err(`envelope: must be "enkerli-library-item"`);
  if (x.envelopeVersion !== undefined &&
      (!Number.isInteger(x.envelopeVersion) || (x.envelopeVersion as number) < 1))
    err("envelopeVersion: integer ≥ 1 required");
  if (x.id !== undefined && (typeof x.id !== "string" || x.id.length < 8))
    err("id: string of length ≥ 8 required");
  if (x.kind !== undefined && !(KINDS as readonly string[]).includes(x.kind as string))
    err(`kind: not in controlled vocabulary (${String(x.kind)})`);
  if (x.format !== undefined && typeof x.format !== "string")
    err("format: string required");
  if (x.formatVersion !== undefined &&
      (!Number.isInteger(x.formatVersion) || (x.formatVersion as number) < 1))
    err("formatVersion: integer ≥ 1 required");
  if (x.title !== undefined && typeof x.title !== "string")
    err("title: string required");
  if (x.creator !== undefined && typeof x.creator !== "string")
    err("creator: string required");
  if (x.app !== undefined && !(APPS as readonly string[]).includes(x.app as string))
    err(`app: not in controlled vocabulary (${String(x.app)})`);
  if (x.savedAt !== undefined &&
      (typeof x.savedAt !== "string" || !DATE_TIME_RE.test(x.savedAt)))
    err("savedAt: absolute ISO 8601 date-time required");

  // provenance
  if (x.provenance !== undefined) {
    if (!isPlainObject(x.provenance)) err("provenance: object required");
    else {
      const p = x.provenance;
      if (typeof p.license !== "string") err("provenance.license: string required (SPDX)");
      if (p.generator !== undefined && !isPlainObject(p.generator))
        err("provenance.generator: object required");
      if (p.derivedFrom !== undefined) {
        if (!Array.isArray(p.derivedFrom)) err("provenance.derivedFrom: array required");
        else p.derivedFrom.forEach((d, i) => {
          if (!isPlainObject(d) || typeof d.id !== "string")
            err(`provenance.derivedFrom[${i}]: {id: string} required`);
        });
      }
      if (p.sources !== undefined) {
        if (!Array.isArray(p.sources)) err("provenance.sources: array required");
        else p.sources.forEach((s, i) => {
          if (!isPlainObject(s)) { err(`provenance.sources[${i}]: object required`); return; }
          if (typeof s.name !== "string") err(`provenance.sources[${i}].name: string required`);
          if (typeof s.licenseClaim !== "string")
            err(`provenance.sources[${i}].licenseClaim: string required`);
          if (!(LICENSE_STATUSES as readonly string[]).includes(s.licenseStatus as string))
            err(`provenance.sources[${i}].licenseStatus: not in vocabulary`);
        });
      }
    }
  }

  // facets: values must be string | number | boolean; status controlled.
  if (x.facets !== undefined) {
    if (!isPlainObject(x.facets)) err("facets: object required");
    else {
      for (const [k, v] of Object.entries(x.facets)) {
        const t = typeof v;
        if (t !== "string" && t !== "number" && t !== "boolean")
          err(`facets.${k}: string | number | boolean required`);
      }
      if (x.facets.status !== undefined &&
          !(STATUSES as readonly string[]).includes(x.facets.status as string))
        err("facets.status: not in controlled vocabulary");
    }
  }

  if (x.tags !== undefined &&
      (!Array.isArray(x.tags) || x.tags.some((t) => typeof t !== "string")))
    err("tags: array of strings required");

  // payload XOR payloadRef
  const hasPayload = x.payload !== undefined;
  const hasRef = x.payloadRef !== undefined;
  if (hasPayload === hasRef)
    err("exactly one of payload / payloadRef is required");
  if (hasPayload && !isPlainObject(x.payload)) err("payload: object required");
  if (hasRef) {
    if (!isPlainObject(x.payloadRef)) err("payloadRef: object required");
    else {
      const r = x.payloadRef;
      if (typeof r.path !== "string") err("payloadRef.path: string required");
      if (typeof r.sha256 !== "string" || !SHA256_RE.test(r.sha256))
        err("payloadRef.sha256: 64 lowercase hex chars required");
      if (r.mediaType !== undefined && typeof r.mediaType !== "string")
        err("payloadRef.mediaType: string required");
    }
  }

  return { ok: errors.length === 0, errors };
}

/** Validate and narrow. Throws with all messages when invalid. */
export function assertEnvelope(x: unknown): LibraryItem {
  const r = validateEnvelope(x);
  if (!r.ok) throw new Error(`invalid library item: ${r.errors.join("; ")}`);
  return x as LibraryItem;
}

// ── wrap()/unwrap() — the three ProgGenie kinds (LIBRARY_SPEC §6 MVP) ────────
// Payloads are carried verbatim; the envelope only *describes* (§2 rules).

export interface WrapOptions {
  id?: string;
  savedAt?: string;
  creator?: string;
  tags?: string[];
  /** Overrides the CC0-1.0 default for THIS item's rights. */
  license?: string;
  generatorVersion?: string;
}

function baseProvenance(app: AppId, opts?: WrapOptions): Provenance {
  return {
    license: opts?.license ?? "CC0-1.0",
    generator: {
      app,
      ...(opts?.generatorVersion !== undefined && { version: opts.generatorVersion }),
    },
  };
}

/** ProgGenie library entry — `{ id, title, composer, source, savedAt, key, bars, prog }`. */
export interface ProgressionEntry {
  id?: string;
  title: string;
  composer?: string;
  source?: string;
  savedAt?: string;
  key?: string;
  bars?: number;
  prog: Record<string, unknown>;
}

/**
 * Wrap a ProgGenie progression document. Per the §5 mapping: id/title/savedAt
 * lift into the envelope; key/bars become facets; composer/source travel in
 * the payload beside the canonical Progression.
 */
export function wrapProgression(entry: ProgressionEntry, opts?: WrapOptions): LibraryItem {
  return {
    envelope: "enkerli-library-item",
    envelopeVersion: 1,
    id: entry.id ?? opts?.id ?? newId(),
    kind: "progression",
    format: "proggenie-progression",
    formatVersion: 1,
    title: entry.title,
    creator: opts?.creator ?? "user",
    app: "proggenie",
    savedAt: entry.savedAt ?? opts?.savedAt ?? nowIso(),
    provenance: baseProvenance("proggenie", opts),
    facets: {
      ...(entry.key !== undefined && { key: entry.key }),
      ...(entry.bars !== undefined && { bars: entry.bars }),
    },
    ...(opts?.tags !== undefined && { tags: opts.tags }),
    payload: {
      prog: entry.prog,
      ...(entry.composer !== undefined && { composer: entry.composer }),
      ...(entry.source !== undefined && { source: entry.source }),
    },
  };
}

/** Recover the legacy ProgGenie library entry from a progression envelope. */
export function unwrapProgression(item: LibraryItem): ProgressionEntry {
  if (item.kind !== "progression" || !item.payload)
    throw new Error("not an inline progression item");
  const p = item.payload;
  return {
    id: item.id,
    title: item.title,
    savedAt: item.savedAt,
    ...(typeof p.composer === "string" && { composer: p.composer }),
    ...(typeof p.source === "string" && { source: p.source }),
    ...(typeof item.facets?.key === "string" && { key: item.facets.key }),
    ...(typeof item.facets?.bars === "number" && { bars: item.facets.bars }),
    prog: p.prog as Record<string, unknown>,
  };
}

/** A self-identifying ProgGenie export: `{ format, version, savedAt, … }`. */
export interface SelfIdentifiedFile {
  format: string;
  version: number;
  savedAt?: string;
  [k: string]: unknown;
}

function wrapSelfIdentified(
  file: SelfIdentifiedFile, expectFormat: string, kind: Kind,
  title: string, opts?: WrapOptions,
): LibraryItem {
  if (file.format !== expectFormat)
    throw new Error(`expected format "${expectFormat}", got "${file.format}"`);
  return {
    envelope: "enkerli-library-item",
    envelopeVersion: 1,
    // These files are anonymous today — the envelope adds the identity (§5).
    id: opts?.id ?? newId(),
    kind,
    format: file.format,
    formatVersion: file.version,
    title,
    creator: opts?.creator ?? "user",
    app: "proggenie",
    savedAt: (typeof file.savedAt === "string" && DATE_TIME_RE.test(file.savedAt)
      ? file.savedAt : undefined) ?? opts?.savedAt ?? nowIso(),
    provenance: baseProvenance("proggenie", opts),
    ...(opts?.tags !== undefined && { tags: opts.tags }),
    payload: { ...file }, // verbatim
  };
}

/** Wrap a ProgGenie curation profile (`progression-studio-curation`). */
export function wrapCurationProfile(
  file: SelfIdentifiedFile, title: string, opts?: WrapOptions,
): LibraryItem {
  return wrapSelfIdentified(file, "progression-studio-curation", "curation-profile", title, opts);
}

/** Wrap a ProgGenie generator patch (`proggenie-patch`). */
export function wrapPatch(
  file: SelfIdentifiedFile, title: string, opts?: WrapOptions,
): LibraryItem {
  return wrapSelfIdentified(file, "proggenie-patch", "patch", title, opts);
}

/** Recover the original exported file, verbatim. */
export function unwrapSelfIdentified(item: LibraryItem): SelfIdentifiedFile {
  if (!item.payload) throw new Error("item has no inline payload");
  return item.payload as unknown as SelfIdentifiedFile;
}

// ── MIDIcurator clips (LIBRARY_SPEC §5: library.json → an envelope index) ────

/** The structural minimum of a MIDIcurator clip; everything else rides verbatim. */
export interface ClipLike {
  id: string;
  filename: string;
  /** Import time, epoch milliseconds (the app's existing field). */
  imported_at: number;
  bpm?: number;
  rating?: number | null;
  flagged?: boolean;
  [k: string]: unknown;
}

/**
 * Envelope id for a clip: the clip's own id when it satisfies the schema,
 * else a DETERMINISTIC derivation — identity must be stable across saves,
 * so a fresh UUID per persist would be wrong.
 */
function clipEnvelopeId(clipId: string): string {
  return clipId.length >= 8 ? clipId : `clip:${clipId}`.padEnd(8, "_");
}

/**
 * Wrap a MIDIcurator clip. The clip travels verbatim as the payload;
 * bpm/rating/flagged surface as facets; the clip's tag strings (kept as
 * separate TagRecords in the app) ride as envelope tags.
 */
export function wrapClip(clip: ClipLike, opts?: WrapOptions): LibraryItem {
  const importedIso = Number.isFinite(clip.imported_at)
    ? new Date(clip.imported_at).toISOString() : undefined;
  return {
    envelope: "enkerli-library-item",
    envelopeVersion: 1,
    id: clipEnvelopeId(clip.id),
    kind: "clip",
    format: "midicurator-clip",
    formatVersion: 1,
    title: clip.filename,
    creator: opts?.creator ?? "user",
    app: "midicurator",
    savedAt: importedIso ?? opts?.savedAt ?? nowIso(),
    provenance: baseProvenance("midicurator", opts),
    facets: {
      ...(typeof clip.bpm === "number" && Number.isFinite(clip.bpm) && { bpm: clip.bpm }),
      ...(typeof clip.rating === "number" && { rating: clip.rating }),
      ...(typeof clip.flagged === "boolean" && { flagged: clip.flagged }),
    },
    ...(opts?.tags !== undefined && { tags: opts.tags }),
    payload: { ...clip }, // verbatim
  };
}

/** Recover the original clip, verbatim. */
export function unwrapClip(item: LibraryItem): ClipLike {
  if (item.kind !== "clip" || !item.payload)
    throw new Error("not an inline clip item");
  return item.payload as unknown as ClipLike;
}

// ── Collections (LIBRARY_SPEC §2: described objects, nestable) ───────────────

export interface CollectionMember { id: string; note?: string }

export function makeCollection(
  title: string, members: Array<string | CollectionMember>,
  app: AppId, opts?: WrapOptions,
): LibraryItem {
  const norm: CollectionMember[] = members.map((m) =>
    typeof m === "string" ? { id: m } : m);
  return {
    envelope: "enkerli-library-item",
    envelopeVersion: 1,
    id: opts?.id ?? newId(),
    kind: "collection",
    format: "enkerli-collection",
    formatVersion: 1,
    title,
    creator: opts?.creator ?? "user",
    app,
    savedAt: opts?.savedAt ?? nowIso(),
    provenance: { license: opts?.license ?? "CC0-1.0" },
    ...(opts?.tags !== undefined && { tags: opts.tags }),
    payload: { members: norm },
  };
}

export function collectionMembers(item: LibraryItem): CollectionMember[] {
  if (item.kind !== "collection" || !item.payload) return [];
  const m = item.payload.members;
  return Array.isArray(m) ? (m as CollectionMember[]) : [];
}

// ── Faceted query layer (E1: facets, autocomplete, suggestions) ──────────────

/** Case/diacritic-insensitive normalization for matching (not for storage). */
function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export interface FacetCount { value: FacetValue; count: number }

/** Distinct values of one facet across items, most-used first. */
export function facetValues(items: LibraryItem[], facet: string): FacetCount[] {
  const counts = new Map<FacetValue, number>();
  for (const it of items) {
    const v = it.facets?.[facet];
    if (v !== undefined) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || String(a.value).localeCompare(String(b.value)));
}

export interface Completion {
  value: string;
  /** From a controlled vocabulary (authority) rather than observed data. */
  controlled: boolean;
  /** How many existing items carry it (0 for unused vocabulary values). */
  count: number;
}

/**
 * Autocomplete for a field. Controlled vocabularies complete even with no
 * data (the authority is the source); observed values complete from items.
 * Fields: "kind" | "app" | "status" | "tags" | "title" | "facets.<name>".
 */
export function autocomplete(
  items: LibraryItem[], field: string, prefix: string,
): Completion[] {
  const p = norm(prefix);
  const vocab: readonly string[] =
    field === "kind" ? KINDS :
    field === "app" ? APPS :
    field === "status" || field === "facets.status" ? STATUSES : [];

  const counts = new Map<string, number>();
  const bump = (v: string) => counts.set(v, (counts.get(v) ?? 0) + 1);
  for (const it of items) {
    if (field === "kind") bump(it.kind);
    else if (field === "app") bump(it.app);
    else if (field === "title") bump(it.title);
    else if (field === "tags") (it.tags ?? []).forEach(bump);
    else if (field === "status" || field.startsWith("facets.")) {
      const name = field === "status" ? "status" : field.slice("facets.".length);
      const v = it.facets?.[name];
      if (v !== undefined) bump(String(v));
    }
  }

  // Controlled values keep their VOCABULARY order (e.g. status is an ordered
  // progression: stub → draft → complete → verified); observed values follow,
  // by usage. The authority's ordering is part of its meaning.
  const out = new Map<string, Completion>();
  for (const v of vocab)
    if (p === "" || norm(v).startsWith(p))
      out.set(v, { value: v, controlled: true, count: counts.get(v) ?? 0 });
  const observed: Completion[] = [];
  for (const [v, count] of counts)
    if (!out.has(v) && (p === "" || norm(v).startsWith(p)))
      observed.push({ value: v, controlled: false, count });
  observed.sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
  return [...out.values(), ...observed];
}

export interface Query {
  kind?: Kind;
  app?: AppId;
  /** All given facets must match exactly. */
  facets?: Record<string, FacetValue>;
  /** All given tags must be present (case/diacritic-insensitive). */
  tags?: string[];
  /** Substring over title + tags (case/diacritic-insensitive). */
  text?: string;
}

export function query(items: LibraryItem[], q: Query): LibraryItem[] {
  const text = q.text !== undefined ? norm(q.text) : undefined;
  const wantTags = (q.tags ?? []).map(norm);
  return items.filter((it) => {
    if (q.kind !== undefined && it.kind !== q.kind) return false;
    if (q.app !== undefined && it.app !== q.app) return false;
    if (q.facets)
      for (const [k, v] of Object.entries(q.facets))
        if (it.facets?.[k] !== v) return false;
    if (wantTags.length) {
      const have = (it.tags ?? []).map(norm);
      if (!wantTags.every((t) => have.includes(t))) return false;
    }
    if (text !== undefined) {
      const hay = norm(it.title) + " " + (it.tags ?? []).map(norm).join(" ");
      if (!hay.includes(text)) return false;
    }
    return true;
  });
}

export interface Suggestion { item: LibraryItem; score: number }

/**
 * "More like this": rank other items by shared facets (2 each), shared tags
 * (1 each), same kind (1), same app (0.5). Zero-score items are omitted.
 */
export function suggestSimilar(
  items: LibraryItem[], subject: LibraryItem, limit = 5,
): Suggestion[] {
  const subjTags = new Set((subject.tags ?? []).map(norm));
  const out: Suggestion[] = [];
  for (const it of items) {
    if (it.id === subject.id) continue;
    let score = 0;
    if (subject.facets && it.facets)
      for (const [k, v] of Object.entries(subject.facets))
        if (it.facets[k] === v) score += 2;
    for (const t of it.tags ?? []) if (subjTags.has(norm(t))) score += 1;
    if (it.kind === subject.kind) score += 1;
    if (it.app === subject.app) score += 0.5;
    if (score > 0) out.push({ item: it, score });
  }
  return out
    .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title))
    .slice(0, limit);
}

// ── Index serialization (a library on disk = index + payload files, §3) ──────

/** Serialize an index: an array of envelopes, pretty-printed and stable. */
export function serializeIndex(items: LibraryItem[]): string {
  return JSON.stringify(items, null, 2) + "\n";
}

export interface ParsedIndex {
  items: LibraryItem[];
  /** Per-entry validation failures (index position → messages). Bad entries are skipped, never dropped silently. */
  errors: Array<{ index: number; errors: string[] }>;
}

/** Parse + validate an index. Invalid entries are reported, valid ones kept. */
export function parseIndex(json: string): ParsedIndex {
  let raw: unknown;
  try { raw = JSON.parse(json); }
  catch { return { items: [], errors: [{ index: -1, errors: ["not valid JSON"] }] }; }
  if (!Array.isArray(raw))
    return { items: [], errors: [{ index: -1, errors: ["index: array required"] }] };
  const items: LibraryItem[] = [];
  const errors: ParsedIndex["errors"] = [];
  raw.forEach((entry, index) => {
    const r = validateEnvelope(entry);
    if (r.ok) items.push(entry as LibraryItem);
    else errors.push({ index, errors: r.errors });
  });
  return { items, errors };
}

// ── Rhythm patterns (Serpe) ───────────────────────────────────────────────────

/** A named rhythm, as produced by `@enkerli/upi`'s `describeNamedPattern`. */
export interface PatternEntry {
  id?: string;
  /** The rhythm's name — "Fume-Fume", "Bembé". */
  name: string;
  /** Step string, "1" = onset. The canonical payload. */
  binary: string;
  stepCount: number;
  onsets: number[];
  onsetCount: number;
  /** What the user typed: "[0,2,4,7,9]/12", "0x5BA:12", "E(7,12)". */
  source?: string;
  /** Analysis computed at import, so the library is searchable by it. */
  euclidean?: string | null;
  barlow?: string | null;
  reading?: string | null;
  longShort?: string;
  foot?: string;
  intervals?: number[];
  ratio?: number | null;
  savedAt?: string;
}

/**
 * Wrap a named rhythm as a library item.
 *
 * The analysis fields become FACETS rather than payload, because they are what
 * you browse and filter by — "show me the Euclidean ones", "show me everything
 * antibacchic", "12-step only". That is the capability the original Rhythm
 * Pattern Explorer's own database had (it searched its `euclidean` field
 * directly); here it comes from the shared library layer instead of a
 * bespoke localStorage store, so Serpe's patterns sit beside every other
 * kind of suite content. Facet values must stay scalar — `onsets` and
 * `intervals` are arrays, so they travel in the payload.
 */
export function wrapPattern(entry: PatternEntry, opts?: WrapOptions): LibraryItem {
  return {
    envelope: "enkerli-library-item",
    envelopeVersion: 1,
    id: entry.id ?? opts?.id ?? newId(),
    kind: "pattern",
    format: "serpe-pattern",
    formatVersion: 1,
    title: entry.name,
    creator: opts?.creator ?? "user",
    app: "serpe",
    savedAt: entry.savedAt ?? opts?.savedAt ?? nowIso(),
    provenance: baseProvenance("serpe", opts),
    facets: {
      steps: entry.stepCount,
      onsets: entry.onsetCount,
      ...(entry.euclidean != null && { euclidean: entry.euclidean }),
      ...(entry.barlow != null && { barlow: entry.barlow }),
      ...(entry.reading != null && { reading: entry.reading }),
      ...(entry.longShort !== undefined && { longShort: entry.longShort }),
      ...(entry.foot !== undefined && { foot: entry.foot }),
      ...(entry.ratio != null && { ratio: entry.ratio }),
    },
    ...(opts?.tags !== undefined && { tags: opts.tags }),
    payload: {
      binary: entry.binary,
      onsetPositions: entry.onsets,
      ...(entry.intervals !== undefined && { intervals: entry.intervals }),
      ...(entry.source !== undefined && { source: entry.source }),
    },
  };
}

/** Recover a named rhythm from a pattern envelope. */
export function unwrapPattern(item: LibraryItem): PatternEntry {
  if (item.kind !== "pattern" || !item.payload)
    throw new Error("not an inline pattern item");
  const p = item.payload;
  const f = item.facets ?? {};
  return {
    id: item.id,
    name: item.title,
    binary: p.binary as string,
    stepCount: typeof f.steps === "number" ? f.steps : (p.binary as string).length,
    onsets: (p.onsetPositions as number[]) ?? [],
    onsetCount: typeof f.onsets === "number" ? f.onsets : 0,
    savedAt: item.savedAt,
    ...(typeof p.source === "string" && { source: p.source }),
    ...(typeof f.euclidean === "string" && { euclidean: f.euclidean }),
    ...(typeof f.barlow === "string" && { barlow: f.barlow }),
    ...(typeof f.reading === "string" && { reading: f.reading }),
    ...(typeof f.longShort === "string" && { longShort: f.longShort }),
    ...(typeof f.foot === "string" && { foot: f.foot }),
    ...(typeof f.ratio === "number" && { ratio: f.ratio }),
    ...(Array.isArray(p.intervals) && { intervals: p.intervals as number[] }),
  };
}
