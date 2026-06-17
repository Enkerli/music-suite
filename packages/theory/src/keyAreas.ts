/**
 * Implied modulations — detect the local key areas a progression's harmony
 * implies, so they can be re-spelled in their own key (the quiet divider +
 * re-anchored labels from the multi-section editor, Q2).
 *
 * Unlike the mechanical "modulate every N bars" control, this reads the actual
 * harmony. The signal is a **secondary dominant resolving to its target**:
 * a dominant chord whose root falls a fifth (up a fourth) to a tonic-quality
 * chord OFF the home tonic — V7/x → x (C7 → Fmaj7, A7 → Dm7). That target is a
 * local tonic, so the span is a key area. When a matching **ii** precedes the
 * dominant (a minor chord another fourth back), the area extends to cover the
 * full ii–V–I. Adjacent/overlapping cadences to the same key merge.
 *
 * Working in home-relative semitone space; a home-resolving dominant (V7 → I,
 * target = home tonic) is not a modulation. This fires on the bare secondary
 * dominant on purpose — requiring a full ii–V–I almost never matches a
 * home-key Markov walk. Broader key-finding (sustained diatonic runs) is a
 * later refinement. Vectors in `keyAreas.test.ts`.
 */

import { parseDegreeLabel } from "./substitutions.js";

type Mode = "major" | "minor";

export interface KeyArea {
  /** First and last chord index of the area (inclusive), in the label stream. */
  start: number;
  end: number;
  /** Local tonic as semitones above the home tonic (≠ 0 — home isn't an area). */
  interval: number;
  /** The local key's mode. */
  mode: Mode;
}

/** Coarse chord-quality family from a degree suffix. */
function quality(suffix: string): "dom" | "maj" | "min" | "dim" | "other" {
  if (/^(7|9|11|13)/.test(suffix)) return "dom"; // 7/9/11/13 lead a dominant
  if (/^m(?!aj)|^min|^-/.test(suffix)) return "min"; // m, m7, -7 … (not "maj")
  if (suffix === "" || /^(maj|M[0-9]|6|69|△|∆|\^|add)/.test(suffix)) return "maj";
  if (/dim|°|ø|o7/.test(suffix)) return "dim";
  return "other";
}

/**
 * Detect the implied local key areas in a degree-label progression. `homeMode`
 * frames the parse; areas are returned in home-relative interval space (the
 * caller spells the absolute tonic). Spans not covered are the home key.
 */
export function analyzeKeyAreas(labels: string[], homeMode: Mode = "major"): KeyArea[] {
  const chords = labels.map((l) => {
    const p = parseDegreeLabel(l, homeMode);
    return p ? { sem: p.semitone, q: quality(p.suffix) } : null;
  });
  const areas: KeyArea[] = [];
  for (let i = 0; i + 1 < chords.length; i++) {
    const b = chords[i], c = chords[i + 1];
    if (!b || !c) continue;
    // V7/x → x: a dominant falling a fifth (root up a fourth) to a tonic-quality
    // chord off the home tonic. (A home-resolving dominant has c.sem === 0.)
    if (b.q !== "dom" || (c.q !== "maj" && c.q !== "min")) continue;
    if (c.sem !== (b.sem + 5) % 12) continue;
    const interval = c.sem; // local tonic relative to home
    if (interval === 0) continue; // resolves home — not a modulation
    const mode: Mode = c.q === "min" ? "minor" : "major";
    // Pull in a preceding ii (a minor chord another fourth back) for the full
    // ii–V–I when it's there.
    const a = i > 0 ? chords[i - 1] : null;
    const start = a && a.q === "min" && b.sem === (a.sem + 5) % 12 ? i - 1 : i;
    const end = i + 1;
    const last = areas[areas.length - 1];
    if (last && last.interval === interval && last.mode === mode && start <= last.end + 1) {
      last.end = Math.max(last.end, end); // merge an adjacent cadence to the same key
    } else {
      areas.push({ start, end, interval, mode });
    }
  }
  return areas;
}
