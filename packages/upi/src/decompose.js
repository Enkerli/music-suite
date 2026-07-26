/**
 * Pattern recognition and decomposition — "what IS this rhythm, in terms of
 * the generators we already have?"
 *
 * Three layers, smallest first:
 *
 *   detectEuclidean(steps)  →  is the whole pattern E(k,n,rotation)?
 *   detectBarlow(steps)     →  is it the Barlow reduction B(k,n)?
 *   decompose(steps)        →  if not, which UNION of generators makes it?
 *
 * Restores capability that the original Rhythm Pattern Explorer's
 * `PatternAnalyzer.detectEuclideanPattern` had (it tested every rotation and
 * returned the formula) and that this package lost in the move — see
 * docs/SERPE_RECOVERY.md. The decomposition on top is new: the old code could
 * say "this IS Euclidean", not "this is these two Euclideans superposed".
 *
 * Decomposition is exact and set-based: a candidate is only admitted if its
 * onsets are a SUBSET of the target (a generator may never add an onset the
 * pattern doesn't have), and a decomposition is only returned if the union of
 * its terms equals the target exactly. That makes every result verifiable —
 * `E(3,8) + E(2,8,3)` means those two patterns superposed literally reproduce
 * the input, not "approximately resemble" it. Approximate/lossy matching is a
 * different question and deliberately not answered here.
 */
import { euclideanRhythm, barlowTransform } from "./rhythm.js";
import { onsetIndices } from "./analysis.js";

const key = (steps) => steps.map((s) => (s ? "1" : "0")).join("");
const onsetCount = (steps) => steps.reduce((n, s) => n + (s ? 1 : 0), 0);

/** Is `sub` a subset of `sup` (both boolean step arrays of equal length)? */
function isSubset(sub, sup) {
  for (let i = 0; i < sub.length; i++) if (sub[i] && !sup[i]) return false;
  return true;
}

/**
 * Does every term earn its place? A reading like `E(3,8) + E(1,8)` is a lie by
 * padding — E(1,8)'s only onset already sits inside E(3,8), so the term adds
 * nothing and the "decomposition" merely re-lists the pattern. Require that
 * dropping ANY term breaks the cover.
 */
function isIrredundant(chosen, n) {
  if (chosen.length < 2) return true;
  for (let skip = 0; skip < chosen.length; skip++) {
    const rest = chosen.filter((_, i) => i !== skip).map((c) => c.steps);
    const u = union(rest, n);
    let same = true;
    for (let i = 0; i < n; i++) {
      if (u[i] !== (chosen.some((c) => c.steps[i]))) { same = false; break; }
    }
    if (same) return false; // the skipped term contributed nothing
  }
  return true;
}

function union(patterns, n) {
  const out = new Array(n).fill(false);
  for (const p of patterns) for (let i = 0; i < n; i++) if (p[i]) out[i] = true;
  return out;
}

/**
 * Exact Euclidean identification, rotation-aware.
 * @returns {{beats:number,steps:number,offset:number,formula:string}|null}
 */
export function detectEuclidean(steps) {
  const n = steps.length;
  const k = onsetCount(steps);
  if (k === 0 || n === 0) return null;
  const target = key(steps);
  for (let offset = 0; offset < n; offset++) {
    if (key(euclideanRhythm(k, n, offset)) === target) {
      return { beats: k, steps: n, offset,
               formula: offset === 0 ? `E(${k},${n})` : `E(${k},${n},${offset})` };
    }
  }
  return null;
}

/**
 * Exact Barlow identification: does reducing a full n-step bar down to k
 * onsets by indispensability land exactly on this pattern? Checks both the
 * normal ranking and Wolrab (anti-metric) mode, since Serpe exposes both.
 * @returns {{beats:number,steps:number,wolrab:boolean,formula:string}|null}
 */
export function detectBarlow(steps) {
  const n = steps.length;
  const k = onsetCount(steps);
  if (k === 0 || n === 0) return null;
  const target = key(steps);
  const full = new Array(n).fill(true);
  for (const wolrab of [false, true]) {
    let got;
    try { got = barlowTransform(full, k, { wolrabMode: wolrab }); } catch { continue; }
    if (got && key(got) === target) {
      return { beats: k, steps: n, wolrab,
               formula: `${wolrab ? "W" : "B"}(${k},${n})` };
    }
  }
  return null;
}

/**
 * Every generator whose onsets fit INSIDE the target — the candidate pool the
 * search draws from. Euclidean at each rotation, plus Barlow/Wolrab, for every
 * onset count from 1 up to the target's own.
 */
function candidates(steps) {
  const n = steps.length;
  const kMax = onsetCount(steps);
  const found = new Map(); // key → {steps, formula, weight}
  const offer = (pat, formula) => {
    if (!pat || onsetCount(pat) === 0) return;
    if (!isSubset(pat, steps)) return;
    const kk = key(pat);
    // Prefer the simplest formula naming the same set of onsets.
    if (!found.has(kk) || formula.length < found.get(kk).formula.length) {
      found.set(kk, { steps: pat, formula, onsets: onsetCount(pat) });
    }
  };
  const full = new Array(n).fill(true);
  for (let k = 1; k <= kMax; k++) {
    for (let offset = 0; offset < n; offset++) {
      offer(euclideanRhythm(k, n, offset),
            offset === 0 ? `E(${k},${n})` : `E(${k},${n},${offset})`);
    }
    for (const wolrab of [false, true]) {
      try { offer(barlowTransform(full, k, { wolrabMode: wolrab }), `${wolrab ? "W" : "B"}(${k},${n})`); }
      catch { /* not reducible to k here */ }
    }
  }
  return [...found.values()];
}

/**
 * Decompose a pattern into a union of Euclidean/Barlow generators.
 *
 * Exhaustive over term counts (1, then 2, …) so the FEWEST-term reading wins,
 * and among equal counts the one using the fewest total onsets — a decomposition
 * should explain the pattern, not merely re-list it. Returns [] when no exact
 * cover exists within `maxTerms` (a real answer: not every rhythm is a
 * superposition of these two families).
 *
 * Readings made ENTIRELY of single-onset terms (`E(1,n,a) + E(1,n,b) + …`) are
 * dropped unless `allowTrivial` is set: every k-onset pattern decomposes that
 * way, so it is a restatement, not an explanation. When that is all there is,
 * the honest answer is an empty list.
 *
 * @param {boolean[]} steps
 * @param {{maxTerms?:number, maxResults?:number, allowTrivial?:boolean}} [opts]
 * @returns {Array<{terms:string[], formula:string, exact:boolean}>}
 */
export function decompose(steps, opts = {}) {
  const { maxTerms = 3, maxResults = 8, allowTrivial = false } = opts;
  const n = steps.length;
  if (n === 0 || onsetCount(steps) === 0) return [];

  // A single generator that IS the pattern outranks any multi-term reading.
  const whole = detectEuclidean(steps) ?? detectBarlow(steps);
  const results = [];
  if (whole) results.push({ terms: [whole.formula], formula: whole.formula, exact: true });

  const pool = candidates(steps).sort((a, b) => b.onsets - a.onsets);
  const target = key(steps);

  for (let size = 2; size <= maxTerms && results.length < maxResults; size++) {
    const chosen = [];
    const walk = (start) => {
      if (results.length >= maxResults) return;
      if (chosen.length === size) {
        const allSingletons = chosen.every((c) => c.onsets === 1);
        if (key(union(chosen.map((c) => c.steps), n)) === target
            && isIrredundant(chosen, n)
            && (allowTrivial || !allSingletons)) {
          const terms = chosen.map((c) => c.formula);
          const formula = terms.join(" + ");
          if (!results.some((r) => r.formula === formula)) {
            results.push({ terms, formula, exact: true });
          }
        }
        return;
      }
      for (let i = start; i < pool.length; i++) {
        chosen.push(pool[i]);
        walk(i + 1);
        chosen.pop();
        if (results.length >= maxResults) return;
      }
    };
    walk(0);
  }
  return results;
}

/**
 * The one-call summary: what this pattern is, and how it can be read.
 * Shapes the three detectors into something a UI or the CLI can print.
 */
export function identify(steps) {
  const euclidean = detectEuclidean(steps);
  const barlow = detectBarlow(steps);
  const readings = decompose(steps);
  return {
    onsets: onsetIndices(steps),
    stepCount: steps.length,
    euclidean,
    barlow,
    readings,
    /** Shortest exact reading, or null if the families can't express it. */
    best: readings[0] ?? null,
  };
}
