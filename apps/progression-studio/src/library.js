/**
 * Progression library — the musician's *own* saved progressions, persisted in
 * localStorage. The 2,611-sheet corpus is never stored or browsable here; only
 * documents the user explicitly saves (Track A / SUITE_AUDIT_AND_PLAN §7).
 *
 * An entry is metadata + the canonical Progression object (so locked voicings
 * and durations survive, not just the bar-notation text):
 *   { id, title, composer, source, savedAt, key, bars, prog }
 */

const KEY = "proggenie.library.v1";

export function loadLibrary() {
  try {
    const a = JSON.parse(globalThis.localStorage?.getItem(KEY) ?? "null");
    return Array.isArray(a) ? a : [];
  } catch {
    return []; // unavailable or corrupted — start empty
  }
}

export function saveLibrary(list) {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(list));
  } catch { /* private mode / quota — library stays in memory */ }
}

/** A new id (crypto.randomUUID when available, else timestamp-based). */
export function newId() {
  return globalThis.crypto?.randomUUID?.() ?? `p${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}
