/**
 * Progression library — the musician's *own* saved progressions, persisted in
 * localStorage. The 2,611-sheet corpus is never stored or browsable here; only
 * documents the user explicitly saves (Track A / SUITE_AUDIT_AND_PLAN §7).
 *
 * Storage format: `@enkerli/library` envelopes (docs/LIBRARY_SPEC.md) — each
 * saved progression is a described item (identity, provenance, facets) whose
 * payload carries the canonical Progression verbatim, so locked voicings and
 * durations survive. The app-facing entry shape is unchanged:
 *   { id, title, composer, source, savedAt, key, bars, prog }
 * loadLibrary() unwraps envelopes back to that shape; saveLibrary() wraps.
 * Legacy (pre-envelope) entries upgrade mechanically on their next save; an
 * entry that cannot form a *valid* envelope is stored verbatim rather than
 * lost — this store never throws and never drops data.
 */

import {
  wrapProgression, unwrapProgression, validateEnvelope,
} from "@enkerli/library";

const KEY = "proggenie.library.v1";

function isEnvelope(x) {
  return !!x && typeof x === "object" && x.envelope === "enkerli-library-item";
}

export function loadLibrary() {
  try {
    const a = JSON.parse(globalThis.localStorage?.getItem(KEY) ?? "null");
    if (!Array.isArray(a)) return [];
    return a.map((entry) => {
      if (isEnvelope(entry) && validateEnvelope(entry).ok) {
        try { return unwrapProgression(entry); } catch { return entry; }
      }
      return entry; // legacy entry (or unknown) — passed through untouched
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
        const item = wrapProgression(entry);
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
