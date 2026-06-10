/**
 * Minimal voice leading between pitch-class sets under the L1 ("taxicab") norm.
 *
 * Implements the dynamic-programming algorithm from the supplement to
 * Dmitri Tymoczko, "The Geometry of Musical Chords" (Science, 2006):
 * chords are treated as cyclic sequences; for a fixed initial pair the
 * matrix entry e[i][j] adds dist(a_i, b_j) to the cheapest of the three
 * predecessor entries; the bottom-right entry counts the initial pair twice
 * and is corrected before output. Minimizing over all initial pairs (cyclic
 * rotations of one chord) yields the global minimum. Voices may double
 * (a note of one chord may map to several notes of the other), which is what
 * makes voice leadings between sets of different cardinality well-defined.
 *
 * This is the suite's reference implementation; the Lua (PdLua) and C++
 * ports must match the shared vectors in vectors/voice-leading.json.
 */

import { intervalClass, mod12, pcSet, type PitchClass } from "./pitch.js";

export interface VoiceLeading {
  /** Total L1 size: sum of interval classes moved by every voice. */
  size: number;
  /** One minimal mapping as [fromPc, toPc] pairs (doublings possible). */
  mapping: [PitchClass, PitchClass][];
}

interface Candidate {
  size: number;
  pairs: [PitchClass, PitchClass][];
}

function solveForRotation(a: PitchClass[], b: PitchClass[]): Candidate {
  // Extend both cyclic sequences by repeating their first element.
  const ax = [...a, a[0]!];
  const bx = [...b, b[0]!];
  const m = ax.length;
  const n = bx.length;

  const e: number[][] = Array.from({ length: m }, () => Array(n).fill(Infinity));
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      const d = intervalClass(ax[i]!, bx[j]!);
      if (i === 0 && j === 0) {
        e[i]![j] = d;
        continue;
      }
      const up = i > 0 ? e[i - 1]![j]! : Infinity;
      const left = j > 0 ? e[i]![j - 1]! : Infinity;
      const diag = i > 0 && j > 0 ? e[i - 1]![j - 1]! : Infinity;
      e[i]![j] = d + Math.min(up, left, diag);
    }
  }

  // Trace back one minimal path; the (0,0) and (m-1,n-1) entries are the
  // same pair counted twice, so drop the duplicate and subtract its cost.
  const pairs: [PitchClass, PitchClass][] = [];
  let i = m - 1;
  let j = n - 1;
  while (i > 0 || j > 0) {
    pairs.push([ax[i]!, bx[j]!]);
    const up = i > 0 ? e[i - 1]![j]! : Infinity;
    const left = j > 0 ? e[i]![j - 1]! : Infinity;
    const diag = i > 0 && j > 0 ? e[i - 1]![j - 1]! : Infinity;
    const best = Math.min(up, left, diag);
    if (best === diag) {
      i--; j--;
    } else if (best === up) {
      i--;
    } else {
      j--;
    }
  }
  pairs.push([ax[0]!, bx[0]!]);
  pairs.reverse();
  pairs.pop(); // duplicate of the initial pair

  return { size: e[m - 1]![n - 1]! - intervalClass(ax[0]!, bx[0]!), pairs };
}

/**
 * Minimal L1 voice leading from one pitch-class set to another.
 * Inputs are deduplicated and reduced mod 12; order does not matter.
 */
export function minimalVoiceLeading(from: Iterable<number>, to: Iterable<number>): VoiceLeading {
  const a = pcSet(from);
  const b = pcSet(to);
  if (a.length === 0 || b.length === 0) {
    return { size: 0, mapping: [] };
  }

  let best: Candidate | undefined;
  for (let r = 0; r < b.length; r++) {
    const rotated = [...b.slice(r), ...b.slice(0, r)];
    const candidate = solveForRotation(a, rotated);
    if (!best || candidate.size < best.size) best = candidate;
  }
  const mapping = best!.pairs
    .map(([x, y]) => [mod12(x), mod12(y)] as [PitchClass, PitchClass])
    .sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  return { size: best!.size, mapping };
}

/** Convenience: just the minimal L1 size. */
export function voiceLeadingSize(from: Iterable<number>, to: Iterable<number>): number {
  return minimalVoiceLeading(from, to).size;
}
