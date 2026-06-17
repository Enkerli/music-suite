/**
 * Implied modulations — detect the local key areas a progression's harmony
 * implies, so they can be re-spelled in their own key (the quiet divider +
 * re-anchored labels from the multi-section editor, Q2).
 *
 * Unlike the mechanical "modulate every N bars" control, this reads the actual
 * harmony: a **ii–V–I cadence to a non-home key** is the reliable, unambiguous
 * signal of a tonicization (Am7 D7 Gmaj7 in C → a G key area). Working in
 * home-relative semitone space, the cadence is three roots each up a fourth
 * (ii→V→I) with qualities minor · dominant · tonic; when the I lands somewhere
 * other than the home tonic, that span is a local key area. Adjacent/over-
 * lapping cadences to the same key merge.
 *
 * Conservative by design (don't over-segment): a lone secondary dominant
 * (V/x → x, two chords) is left in the home frame; only a full ii–V–I earns a
 * key area. Broader key-finding (sustained diatonic runs, V–I without the ii)
 * is a later refinement. Vectors in `keyAreas.test.ts`.
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
  for (let i = 0; i + 2 < chords.length; i++) {
    const a = chords[i], b = chords[i + 1], c = chords[i + 2];
    if (!a || !b || !c) continue;
    // ii–V–I: minor · dominant · tonic, roots each up a fourth (+5 semitones).
    const cadence = a.q === "min" && b.q === "dom" && (c.q === "maj" || c.q === "min")
      && b.sem === (a.sem + 5) % 12 && c.sem === (b.sem + 5) % 12;
    if (!cadence) continue;
    const interval = c.sem; // local tonic relative to home
    if (interval === 0) continue; // resolves home — not a modulation
    const mode: Mode = c.q === "min" ? "minor" : "major";
    const last = areas[areas.length - 1];
    if (last && last.interval === interval && last.mode === mode && i <= last.end + 1) {
      last.end = i + 2; // merge an adjacent/overlapping cadence to the same key
    } else {
      areas.push({ start: i, end: i + 2, interval, mode });
    }
  }
  return areas;
}
