/**
 * Key changes — modulate a degree-label progression every N bars to a
 * corpus-common related key.
 *
 * A modulation here is a *transposition* of a section's chords to a related
 * key, re-spelled in the home key's degree frame (so storage stays
 * single-key and every downstream consumer — editor, realization, export —
 * is untouched; the chords themselves are genuinely the new key's). The
 * targets are the common modulation relationships — dominant, subdominant,
 * relative, up-a-step — weighted by how common they are; the boundary chord
 * functions as the pivot. Deterministic for a given (sectionCount, seed).
 *
 * The fuller treatment — sections that keep the *new key's* Roman labels and
 * re-anchor `resolveDegree` per section — needs a multi-section, per-section-
 * key editor, and is left for the design pass. Vectors in `modulation.test.ts`.
 */

import { parseDegreeLabel, semitoneToNumeral } from "./substitutions.js";

type Mode = "major" | "minor";

export interface KeyMove {
  /** Semitones above the home tonic (0 = home). */
  interval: number;
  /** The target key's mode (the relative move flips it). */
  mode: Mode;
  /** Human name of the relationship ("dominant", "relative minor", …). */
  name: string;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The common modulation targets from a home key, with relative weights. */
export function relatedKeys(mode: Mode): { move: KeyMove; weight: number }[] {
  const flip: Mode = mode === "major" ? "minor" : "major";
  return [
    { move: { interval: 7, mode, name: "dominant" }, weight: 4 },
    { move: { interval: mode === "major" ? 9 : 3, mode: flip, name: mode === "major" ? "relative minor" : "relative major" }, weight: 3 },
    { move: { interval: 5, mode, name: "subdominant" }, weight: 2 },
    { move: { interval: 2, mode, name: "up a step" }, weight: 1 },
  ];
}

/** Pick a related key, weighted by commonness. */
export function pickKeyMove(mode: Mode, rng: () => number): KeyMove {
  const opts = relatedKeys(mode);
  const total = opts.reduce((s, o) => s + o.weight, 0);
  let r = rng() * total;
  for (const o of opts) { r -= o.weight; if (r <= 0) return o.move; }
  return opts[0]!.move;
}

/**
 * Transpose a degree-label slice by `interval` semitones, re-spelled in the
 * `mode` frame (flat-preferring) — the chords of the new key, written home.
 */
export function transposeLabels(labels: string[], interval: number, mode: Mode = "major"): string[] {
  if (((interval % 12) + 12) % 12 === 0) return labels.slice();
  return labels.map((l) => {
    const p = parseDegreeLabel(l, mode);
    if (!p) return l;
    return semitoneToNumeral((p.semitone + interval) % 12, mode, "flat") + p.suffix;
  });
}

/**
 * A modulation plan: one KeyMove per section. Section 0 is always the home
 * key (interval 0); each later section picks a related key (seeded).
 */
export function planModulation(sectionCount: number, mode: Mode = "major", seed = 1): KeyMove[] {
  const rng = mulberry32(seed);
  const plan: KeyMove[] = [{ interval: 0, mode, name: "home" }];
  for (let i = 1; i < sectionCount; i++) plan.push(pickKeyMove(mode, rng));
  return plan;
}

/**
 * Re-anchor a flat label stream into per-section keys. `sectionOf[i]` gives
 * label i's section index; the section's KeyMove transposes it. Section 0
 * (home) is unchanged. Returns the re-spelled labels and the plan used.
 */
export function modulateLabels(
  labels: string[],
  sectionOf: number[],
  mode: Mode = "major",
  seed = 1,
): { labels: string[]; plan: KeyMove[] } {
  const sectionCount = sectionOf.length ? Math.max(...sectionOf) + 1 : 1;
  const plan = planModulation(sectionCount, mode, seed);
  const out = labels.map((l, i) => {
    const move = plan[sectionOf[i] ?? 0];
    return move && move.interval ? transposeLabels([l], move.interval, mode)[0]! : l;
  });
  return { labels: out, plan };
}
