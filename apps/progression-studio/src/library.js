/**
 * The Library — the musician's *own* saved things, persisted in localStorage.
 * The 2,611-sheet corpus is never stored or browsable here; only items the
 * user explicitly saves (Track A / SUITE_AUDIT_AND_PLAN §7).
 *
 * Since the shared-frame consistency pass this is ONE mixed-kind store — the
 * suite's three saved-thing kinds in one list, one drawer, one envelope:
 *   document — a progression   { id, kind, title, composer, source, savedAt, key, bars, prog }
 *   patch    — generator params { id, kind, title, savedAt, file }   (file = proggenie-patch JSON)
 *   profile  — curation weights { id, kind, title, savedAt, file }   (file = progression-studio-curation JSON)
 *
 * Storage format: `@enkerli/library` envelopes (docs/LIBRARY_SPEC.md) via
 * wrapProgression / wrapPatch / wrapCurationProfile. loadLibrary() unwraps
 * back to the app shapes above; saveLibrary() wraps. Legacy (pre-envelope,
 * pre-kind) entries read as documents and upgrade mechanically on their next
 * save; an entry that cannot form a *valid* envelope is stored verbatim
 * rather than lost — this store never throws and never drops data.
 */

import {
  wrapProgression, unwrapProgression, wrapPatch, wrapCurationProfile,
  unwrapSelfIdentified, validateEnvelope,
} from "@enkerli/library";

const KEY = "proggenie.library.v1";

function isEnvelope(x) {
  return !!x && typeof x === "object" && x.envelope === "enkerli-library-item";
}

function fromEnvelope(item) {
  if (item.kind === "progression") {
    return { kind: "document", ...unwrapProgression(item) };
  }
  if (item.kind === "patch" || item.kind === "curation-profile") {
    return {
      id: item.id,
      kind: item.kind === "patch" ? "patch" : "profile",
      title: item.title,
      savedAt: item.savedAt,
      file: unwrapSelfIdentified(item),
    };
  }
  return item; // unknown kind — passed through untouched
}

function toEnvelope(entry) {
  const opts = { id: entry.id, savedAt: entry.savedAt };
  if (entry.kind === "patch") return wrapPatch(entry.file, entry.title, opts);
  if (entry.kind === "profile") return wrapCurationProfile(entry.file, entry.title, opts);
  const { kind, ...doc } = entry; // document (or legacy, kind-less)
  return wrapProgression(doc);
}

export function loadLibrary() {
  try {
    const a = JSON.parse(globalThis.localStorage?.getItem(KEY) ?? "null");
    if (!Array.isArray(a)) return [];
    return a.map((entry) => {
      if (isEnvelope(entry) && validateEnvelope(entry).ok) {
        try { return fromEnvelope(entry); } catch { return entry; }
      }
      // legacy entry (or unknown) — a saved progression from before kinds
      return entry && typeof entry === "object" && !entry.kind
        ? { kind: "document", ...entry } : entry;
    });
  } catch {
    return []; // unavailable or corrupted — start empty
  }
}

export function saveLibrary(list) {
  try {
    const wrapped = list.map((entry) => {
      if (isEnvelope(entry)) return entry; // already an envelope
      try {
        const item = toEnvelope(entry);
        // Data preservation first: only store the envelope when it is valid
        // (e.g. a synthetic short id fails the schema's id rule — keep the
        // original entry verbatim rather than persist an invalid item).
        return validateEnvelope(item).ok ? item : entry;
      } catch {
        return entry;
      }
    });
    globalThis.localStorage?.setItem(KEY, JSON.stringify(wrapped));
  } catch { /* private mode / quota — library stays in memory */ }
}

/** A new id (crypto.randomUUID when available, else timestamp-based). */
export function newId() {
  return globalThis.crypto?.randomUUID?.() ?? `p${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}
