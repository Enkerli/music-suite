/**
 * Pitch-class-set selection: the pure functions behind every PCS-selection
 * interface in the suite — a web prototype, a Lightpad, an Orba, the FM-1.
 * Plan: docs/HARDWARE_REPURPOSING.md §5.1 and §12.
 *
 * Everything here is mask → mask (or state → state). No I/O, no clocks, no
 * device knowledge, so a C++/Lua/Littlefoot port can be checked against
 * vectors/pcs-select.json case by case.
 *
 * Three layers, kept separate on purpose:
 *
 *   1. ENTRY — how a performer *names* a set on eight pads:
 *        octal       four taps, each a pad index 0–7 (all 4096 sets)
 *        two-page    pads toggle pcs 0–7, then 8–11
 *        intervals   successive steps around the octave (pad i = step i+1)
 *   2. MOVES — how a performer *derives* the next set from the current one:
 *        transpose, relative/parallel modes (light ↔ dark), neo-Riemannian
 *        P/L/R, limited transposition, parsimonious (one-semitone) neighbours.
 *   3. CUEING — when a chosen set takes effect: now, or at the next beat /
 *        bar / loop, clip-launcher style; a setlist is a list of cued states.
 *
 * Bit order, as everywhere in this suite (CONVENTIONS.md): leftmost = LSB,
 * pitch class i = bit i. C Ionian is 2741 (0xAB5); 2773 is C Lydian.
 * Octal digits are little-endian too: the FIRST digit tapped holds pcs 0–2,
 * and within a digit pc 3k is the low bit — the same rule as the rhythm
 * octal codec (patternToOctal), which the tests cross-check.
 *
 * Masks are plain numbers in [0, 4095]. States carry a root because modes,
 * P/L/R and interval entry need one; the mask alone is what gets broadcast
 * (see the "states, not commands" rule in HARDWARE_REPURPOSING.md §12.2).
 */

import { mod12 } from "./pitch.js";

export const FULL_MASK = 0xfff;

/** A set plus the pitch class it is heard from. */
export interface PcsState {
  mask: number;
  root: number;
}

// ─── Mask basics ────────────────────────────────────────────────────────

function assertMask(mask: number): void {
  if (!Number.isInteger(mask) || mask < 0 || mask > FULL_MASK) {
    throw new RangeError(`PCS mask must be an integer in 0..4095, got ${mask}`);
  }
}

/** Ascending pitch classes of a mask. */
export function maskToPcs(mask: number): number[] {
  assertMask(mask);
  const out: number[] = [];
  for (let pc = 0; pc < 12; pc++) if (mask & (1 << pc)) out.push(pc);
  return out;
}

export function maskHas(mask: number, pc: number): boolean {
  return (mask & (1 << mod12(pc))) !== 0;
}

export function maskCardinality(mask: number): number {
  let n = 0;
  for (let m = mask; m; m &= m - 1) n++;
  return n;
}

/** Transpose a mask: pitch class i moves to i + n (bit i → bit i+n, wrapping). */
export function rotateMask(mask: number, n: number): number {
  assertMask(mask);
  const s = mod12(n);
  if (s === 0) return mask;
  return ((mask << s) | (mask >> (12 - s))) & FULL_MASK;
}

// ─── 1a. Octal entry ────────────────────────────────────────────────────

/**
 * The four octal digits of a mask, in tap order: digit k = pcs 3k..3k+2,
 * value b(3k) + 2·b(3k+1) + 4·b(3k+2).  C Ionian → [5, 6, 2, 5].
 */
export function maskToOctalDigits(mask: number): [number, number, number, number] {
  assertMask(mask);
  return [mask & 7, (mask >> 3) & 7, (mask >> 6) & 7, (mask >> 9) & 7];
}

export function maskFromOctalDigits(digits: readonly number[]): number {
  if (digits.length !== 4 || digits.some((d) => !Number.isInteger(d) || d < 0 || d > 7)) {
    throw new RangeError(`octal entry needs exactly four digits 0..7, got [${digits.join(",")}]`);
  }
  return digits[0]! | (digits[1]! << 3) | (digits[2]! << 6) | (digits[3]! << 9);
}

/** Four-character string form, tap order: C Ionian → "5625". */
export function maskToOctal(mask: number): string {
  return maskToOctalDigits(mask).join("");
}

export function maskFromOctal(octal: string): number {
  if (!/^[0-7]{4}$/.test(octal)) throw new RangeError(`expected four octal digits, got "${octal}"`);
  return maskFromOctalDigits([...octal].map(Number));
}

/** Digits tapped so far (0–3 of them). */
export interface OctalEntry {
  digits: number[];
}

export const EMPTY_OCTAL_ENTRY: OctalEntry = { digits: [] };

/**
 * One pad tap. The fourth tap completes the set: `mask` is returned and the
 * entry resets, ready for the next set. Before that, `mask` is null.
 */
export function octalEntryTap(entry: OctalEntry, pad: number): { entry: OctalEntry; mask: number | null } {
  if (!Number.isInteger(pad) || pad < 0 || pad > 7) throw new RangeError(`pad must be 0..7, got ${pad}`);
  const digits = [...entry.digits, pad];
  if (digits.length < 4) return { entry: { digits }, mask: null };
  return { entry: { digits: [] }, mask: maskFromOctalDigits(digits) };
}

export function octalEntryBackspace(entry: OctalEntry): OctalEntry {
  return { digits: entry.digits.slice(0, -1) };
}

// ─── 1b. Two-page entry ─────────────────────────────────────────────────

export type Page = 0 | 1;

/** Pitch class under a pad on a page, or null (page 1, pads 4–7). */
export function twoPagePc(page: Page, pad: number): number | null {
  if (!Number.isInteger(pad) || pad < 0 || pad > 7) throw new RangeError(`pad must be 0..7, got ${pad}`);
  const pc = page * 8 + pad;
  return pc < 12 ? pc : null;
}

/** Toggle the pitch class under a pad. Unused pads leave the mask unchanged. */
export function twoPageToggle(mask: number, page: Page, pad: number): number {
  assertMask(mask);
  const pc = twoPagePc(page, pad);
  return pc === null ? mask : mask ^ (1 << pc);
}

/** What the eight pads should show: lit / unlit, null for an unused pad. */
export function twoPagePads(mask: number, page: Page): (boolean | null)[] {
  assertMask(mask);
  return Array.from({ length: 8 }, (_, pad) => {
    const pc = twoPagePc(page, pad);
    return pc === null ? null : maskHas(mask, pc);
  });
}

// ─── 1c. Interval entry ─────────────────────────────────────────────────

/**
 * Successive steps from the root, closing the octave: C Ionian from 0 →
 * [2, 2, 1, 2, 2, 2, 1]. The steps always sum to 12. The root must be in
 * the set (otherwise there is nothing to step from) — null if it is not.
 */
export function maskToIntervals(mask: number, root: number): number[] | null {
  assertMask(mask);
  const r = mod12(root);
  if (!maskHas(mask, r)) return null;
  const rel = maskToPcs(rotateMask(mask, -r)); // starts with 0
  return rel.map((pc, i) => (rel[i + 1] ?? 12) - pc);
}

/**
 * The set built from a root and successive steps. A closing step that lands
 * on the octave is allowed and changes nothing; steps that pass the octave
 * are an error (the caller should have refused the tap — see below).
 */
export function maskFromIntervals(root: number, steps: readonly number[]): number {
  let pos = 0;
  let mask = 1;
  for (const s of steps) {
    if (!Number.isInteger(s) || s < 1) throw new RangeError(`steps must be positive integers, got ${s}`);
    pos += s;
    if (pos > 12) throw new RangeError(`steps [${steps.join(",")}] pass the octave`);
    if (pos < 12) mask |= 1 << pos;
  }
  return rotateMask(mask, root);
}

export interface IntervalEntry {
  root: number;
  steps: number[];
}

/**
 * One pad tap during interval entry: pad i adds a step of i + 1 semitones
 * (1..8). Reaching the octave exactly completes the set; a tap that would
 * pass it is refused (`refused: true`, entry unchanged) so the performer
 * can choose a smaller step. A completed entry resets to the same root.
 */
export function intervalEntryTap(
  entry: IntervalEntry,
  pad: number,
): { entry: IntervalEntry; mask: number | null; refused: boolean } {
  if (!Number.isInteger(pad) || pad < 0 || pad > 7) throw new RangeError(`pad must be 0..7, got ${pad}`);
  const step = pad + 1;
  const sum = entry.steps.reduce((a, b) => a + b, 0) + step;
  if (sum > 12) return { entry, mask: null, refused: true };
  const steps = [...entry.steps, step];
  if (sum < 12) return { entry: { root: entry.root, steps }, mask: null, refused: false };
  return { entry: { root: entry.root, steps: [] }, mask: maskFromIntervals(entry.root, steps), refused: false };
}

// ─── 2a. Transposition ──────────────────────────────────────────────────

export function transposeState(state: PcsState, n: number): PcsState {
  return { mask: rotateMask(state.mask, n), root: mod12(state.root + n) };
}

/**
 * How many distinct transpositions a set has: 12 for most sets, fewer for
 * Messiaen's modes of limited transposition (whole tone 2, octatonic 3,
 * augmented 4, …), 1 for the empty and chromatic sets.
 */
export function transpositionPeriod(mask: number): number {
  assertMask(mask);
  for (let t = 1; t <= 12; t++) if (rotateMask(mask, t) === mask) return t;
  return 12; // unreachable: t = 12 always matches
}

/** The distinct transpositions themselves, by ascending transposition 0..period-1. */
export function distinctTranspositions(mask: number): number[] {
  return Array.from({ length: transpositionPeriod(mask) }, (_, t) => rotateMask(mask, t));
}

// ─── 2b. Modes: relative and parallel (light ↔ dark) ────────────────────

/**
 * Modal brightness: the sum of every pitch class's distance above the root.
 * For the diatonic modes from one root: Lydian 39, Ionian 38, Mixolydian 37,
 * Dorian 36, Aeolian 35, Phrygian 34, Locrian 33 — each step one note
 * lowered by a semitone. Defined for any set; the root need not be in it.
 */
export function modeBrightness(mask: number, root: number): number {
  return maskToPcs(rotateMask(mask, -root)).reduce((a, b) => a + b, 0);
}

/**
 * Relative mode: same collection, the root moves to the next pitch class of
 * the set (dir +1 up, -1 down). C Ionian → D Dorian. If the root is not in
 * the set, it moves to the nearest member in that direction.
 */
export function relativeMode(state: PcsState, dir: 1 | -1 = 1): PcsState {
  assertMask(state.mask);
  if (state.mask === 0) return state;
  for (let k = 1; k <= 12; k++) {
    const pc = mod12(state.root + dir * k);
    if (maskHas(state.mask, pc)) return { mask: state.mask, root: pc };
  }
  return state;
}

/**
 * Every parallel mode of a set's collection on a fixed root, brightest
 * first: each member of the set takes a turn as the root, and the result is
 * transposed back onto `root`. Symmetric sets collapse (whole tone → 1).
 * Ties in brightness (possible for unusual sets) break by ascending mask so
 * the order is total. The root must be in the set, else [].
 */
export function parallelModes(state: PcsState): number[] {
  assertMask(state.mask);
  const r = mod12(state.root);
  if (!maskHas(state.mask, r)) return [];
  const seen = new Set<number>();
  for (const pc of maskToPcs(state.mask)) seen.add(rotateMask(state.mask, r - pc));
  return [...seen].sort((a, b) => modeBrightness(b, r) - modeBrightness(a, r) || a - b);
}

/**
 * One step lighter (dir +1) or darker (dir -1) among the parallel modes,
 * same root. C Ionian → C Lydian (lighter) / C Mixolydian (darker).
 * At either end it stays put unless `wrap` is set. A root outside the set
 * returns the state unchanged.
 */
export function parallelModeStep(state: PcsState, dir: 1 | -1, wrap = false): PcsState {
  const modes = parallelModes(state);
  const i = modes.indexOf(state.mask);
  if (i < 0) return state;
  let j = i - dir; // brightest first, so lighter = earlier
  if (j < 0 || j >= modes.length) {
    if (!wrap) return state;
    j = (j + modes.length) % modes.length;
  }
  return { mask: modes[j]!, root: state.root };
}

// ─── 2c. Neo-Riemannian P, L, R ─────────────────────────────────────────

const MAJOR_TRIAD = 0b000010010001; // {0,4,7} = 145
const MINOR_TRIAD = 0b000010001001; // {0,3,7} = 137

/** A consonant triad's root and quality, or null for any other set. */
export function triadOf(mask: number): { root: number; quality: "major" | "minor" } | null {
  assertMask(mask);
  for (let r = 0; r < 12; r++) {
    if (rotateMask(MAJOR_TRIAD, r) === mask) return { root: r, quality: "major" };
    if (rotateMask(MINOR_TRIAD, r) === mask) return { root: r, quality: "minor" };
  }
  return null;
}

export type RiemannOp = "P" | "L" | "R";

/**
 * P (parallel): C ↔ c.  L (leading-tone exchange): C ↔ e.
 * R (relative): C ↔ a.  Each is an involution and moves one voice.
 * Null when the set is not a major or minor triad. The returned root is
 * the new triad's root.
 */
export function riemann(mask: number, op: RiemannOp): PcsState | null {
  const t = triadOf(mask);
  if (!t) return null;
  const major = t.quality === "major";
  const [shift, toMajor] =
    op === "P" ? [0, !major] :
    op === "L" ? [major ? 4 : 8, !major] :
                 [major ? 9 : 3, !major];
  const root = mod12(t.root + shift);
  return { mask: rotateMask(toMajor ? MAJOR_TRIAD : MINOR_TRIAD, root), root };
}

// ─── 2d. Parsimonious neighbours ────────────────────────────────────────

export interface Neighbour {
  mask: number;
  /** The pitch class that moved, and where to. */
  from: number;
  to: number;
}

/**
 * Every set reachable by moving one member a semitone up or down onto a
 * pitch class not already in the set (cardinality preserved). Sorted by
 * mask, then by `from`. For a diatonic set these include its neighbours
 * on the circle of fifths; for a triad, the P and L moves.
 */
export function parsimoniousNeighbours(mask: number): Neighbour[] {
  assertMask(mask);
  const out: Neighbour[] = [];
  for (const from of maskToPcs(mask)) {
    for (const d of [-1, 1]) {
      const to = mod12(from + d);
      if (maskHas(mask, to)) continue;
      out.push({ mask: (mask & ~(1 << from)) | (1 << to), from, to });
    }
  }
  return out.sort((a, b) => a.mask - b.mask || a.from - b.from);
}

// ─── 3. Cueing ──────────────────────────────────────────────────────────

/** When a cued set takes effect. Each boundary implies the finer ones. */
export type Quantum = "now" | "beat" | "bar" | "loop";
export type Boundary = Exclude<Quantum, "now">;

const QUANTUM_RANK: Record<Quantum, number> = { now: 0, beat: 1, bar: 2, loop: 3 };

export interface CueState {
  current: PcsState;
  next: PcsState | null;
  at: Quantum;
}

export function cueState(current: PcsState): CueState {
  return { current, next: null, at: "now" };
}

/**
 * Cue the next set. "now" applies it at once; anything else waits for the
 * matching boundary. A new cue replaces a pending one (last choice wins).
 */
export function cue(cs: CueState, next: PcsState, at: Quantum): CueState {
  if (at === "now") return { current: next, next: null, at: "now" };
  return { current: cs.current, next, at };
}

export function cancelCue(cs: CueState): CueState {
  return { current: cs.current, next: null, at: "now" };
}

/**
 * A boundary of the shared beat grid has been crossed. A bar boundary is
 * also a beat, and a loop boundary also a bar, so a cue fires on any
 * boundary at least as coarse as the one it waits for.
 */
export function crossBoundary(cs: CueState, boundary: Boundary): { state: CueState; changed: boolean } {
  if (!cs.next || QUANTUM_RANK[cs.at] > QUANTUM_RANK[boundary]) return { state: cs, changed: false };
  return { state: { current: cs.next, next: null, at: "now" }, changed: true };
}

/** An ordered list of states; `index` is the entry currently cued or playing. */
export interface Setlist {
  items: PcsState[];
  index: number;
}

/**
 * Cue the setlist's next entry (dir +1) or previous (dir -1), clamped at
 * the ends. Returns the cue state with that entry pending, and the setlist
 * pointing at it.
 */
export function setlistStep(
  cs: CueState,
  list: Setlist,
  at: Quantum,
  dir: 1 | -1 = 1,
): { state: CueState; list: Setlist } {
  const index = Math.min(list.items.length - 1, Math.max(0, list.index + dir));
  if (index === list.index || list.items.length === 0) return { state: cs, list };
  return { state: cue(cs, list.items[index]!, at), list: { items: list.items, index } };
}
