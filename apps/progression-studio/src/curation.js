/**
 * Curation layer — ear-driven weight tweaks over the corpus statistics.
 *
 * The corpus table is immutable; curation is a separate map of
 * multipliers per transition (from→to). Effective sampling weight =
 * corpus count × multiplier. Two gestures feed it:
 *   - emphasize/de-emphasize one transition ("this change sounds good");
 *   - rate a whole progression, nudging every transition in it
 *     ("this one's a bit meh").
 * Multipliers are clamped to [1/16, 16] and persist in localStorage;
 * profiles export/import as JSON for sharing and versioning.
 */

export const TRANSITION_STEP = 1.5; // single-transition emphasize/cut
export const PROGRESSION_STEP = 1.25; // whole-progression like/meh
const MIN_MULT = 1 / 16;
const MAX_MULT = 16;
const STORAGE_KEY = "progression-studio.curation.v1";

export function pairKey(from, to) {
  return `${from} → ${to}`;
}

export function emptyCuration() {
  return { multipliers: {} };
}

function clamp(x) {
  return Math.min(MAX_MULT, Math.max(MIN_MULT, x));
}

/** Multiply one transition's weight; multiplier 1 entries are dropped. */
export function adjustTransition(curation, from, to, factor) {
  const key = pairKey(from, to);
  const current = curation.multipliers[key] ?? 1;
  const next = clamp(current * factor);
  const multipliers = { ...curation.multipliers };
  if (Math.abs(next - 1) < 1e-9) delete multipliers[key];
  else multipliers[key] = next;
  return { multipliers };
}

/** Nudge every transition of a progression (consecutive label pairs). */
export function rateProgression(curation, labels, factor) {
  let result = curation;
  for (let i = 1; i < labels.length; i++) {
    if (labels[i - 1] === labels[i]) continue;
    result = adjustTransition(result, labels[i - 1], labels[i], factor);
  }
  return result;
}

export function resetTransition(curation, key) {
  const multipliers = { ...curation.multipliers };
  delete multipliers[key];
  return { multipliers };
}

export function multiplierFor(curation, from, to) {
  return curation.multipliers[pairKey(from, to)] ?? 1;
}

/** Effective sampling row: corpus counts × curation multipliers. */
export function effectiveRow(baseRow, from, curation) {
  let changed = false;
  const out = {};
  for (const [to, count] of Object.entries(baseRow)) {
    const mult = curation.multipliers[pairKey(from, to)];
    if (mult !== undefined) changed = true;
    out[to] = count * (mult ?? 1);
  }
  return changed ? out : baseRow;
}

// ─── Persistence (guarded: works in tests/SSR without localStorage) ─────

export function loadCuration() {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return emptyCuration();
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.multipliers === "object") return parsed;
  } catch { /* corrupted or unavailable — start fresh */ }
  return emptyCuration();
}

export function saveCuration(curation) {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(curation));
  } catch { /* private mode etc. — curation stays in-memory */ }
}

export function exportCuration(curation) {
  return JSON.stringify(
    { format: "progression-studio-curation", version: 1, ...curation },
    null,
    2,
  );
}

export function importCuration(json) {
  const parsed = JSON.parse(json);
  if (!parsed || typeof parsed.multipliers !== "object") {
    throw new Error("Not a curation profile");
  }
  const multipliers = {};
  for (const [key, value] of Object.entries(parsed.multipliers)) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      multipliers[key] = clamp(value);
    }
  }
  return { multipliers };
}
