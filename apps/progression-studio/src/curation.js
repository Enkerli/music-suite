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

/** Split a transition key "FROM → TO" back into its two degree labels. */
export function splitTransitionKey(key) {
  const i = key.indexOf(" → ");
  return i < 0 ? [key, ""] : [key.slice(0, i), key.slice(i + 3)];
}

/**
 * Filter curated [key, value] entries by origin and/or destination degree
 * ("any" matches all) — the filter-by-degree lens (design Q6). Because weights
 * are functional (degree→degree, key-independent), the result holds across
 * every section's key.
 */
export function filterWeights(entries, from = "any", to = "any") {
  return entries.filter(([key]) => {
    const [f, t] = splitTransitionKey(key);
    return (from === "any" || f === from) && (to === "any" || t === to);
  });
}

/** Distinct origin and destination degrees present in curated entries (sorted). */
export function transitionDegrees(entries) {
  const origins = new Set();
  const dests = new Set();
  for (const [key] of entries) {
    const [f, t] = splitTransitionKey(key);
    origins.add(f); if (t) dests.add(t);
  }
  return { origins: [...origins].sort(), dests: [...dests].sort() };
}

/** n-gram key: "A → B → C" — same map as pairs, longer context. */
export function sequenceKey(labels) {
  return labels.join(" → ");
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

/**
 * Gesture curation: rate a stretch of 3+ chords as a unit. Stores a
 * multiplier on every overlapping TRIPLE in the stretch — generation
 * consults triples as longer-context weights on top of pairs (the first
 * step toward variable-order generation).
 */
export function rateGesture(curation, labels, factor) {
  if (labels.length < 3) return rateProgression(curation, labels, factor);
  let multipliers = { ...curation.multipliers };
  for (let i = 2; i < labels.length; i++) {
    const key = sequenceKey([labels[i - 2], labels[i - 1], labels[i]]);
    const next = Math.min(16, Math.max(1 / 16, (multipliers[key] ?? 1) * factor));
    if (Math.abs(next - 1) < 1e-9) delete multipliers[key];
    else multipliers[key] = next;
  }
  return { multipliers };
}

/** Triple-context multiplier for a candidate next label, default 1. */
export function tripleMultiplier(curation, prev2, prev1, candidate) {
  return curation.multipliers[sequenceKey([prev2, prev1, candidate])] ?? 1;
}

export function resetTransition(curation, key) {
  const multipliers = { ...curation.multipliers };
  delete multipliers[key];
  return { multipliers };
}

export function multiplierFor(curation, from, to) {
  return curation.multipliers[pairKey(from, to)] ?? 1;
}

/**
 * Profile-as-shape: the strongest few boosts and suppressions plus the total
 * count — a glanceable summary of taste, instead of the full weight ledger.
 * Boosts are ordered strongest-first (largest multiplier); suppressions
 * most-suppressed-first (smallest multiplier).
 */
export function profileSummary(curation, { max = 4 } = {}) {
  const entries = Object.entries(curation?.multipliers ?? {});
  const boosts = entries.filter(([, v]) => v > 1).sort((a, b) => b[1] - a[1]).slice(0, max);
  const suppressions = entries.filter(([, v]) => v < 1).sort((a, b) => a[1] - b[1]).slice(0, max);
  return { boosts, suppressions, count: entries.length };
}

/**
 * Merge an incoming profile into a base, compounding multipliers on shared
 * transitions (base × incoming, clamped) — two boosts stack, a boost and a
 * cut partly cancel. Transitions present in only one side are kept as-is.
 */
export function mergeCuration(base, incoming) {
  const multipliers = { ...base.multipliers };
  for (const [key, v] of Object.entries(incoming?.multipliers ?? {})) {
    if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) continue;
    const next = clamp((multipliers[key] ?? 1) * v);
    if (Math.abs(next - 1) < 1e-9) delete multipliers[key];
    else multipliers[key] = next;
  }
  return { multipliers };
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

export function exportCuration(curation, { savedAt } = {}) {
  return JSON.stringify(
    { format: "progression-studio-curation", version: 1, ...(savedAt ? { savedAt } : {}), ...curation },
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
