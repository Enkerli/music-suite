/**
 * Transition character — how a progression *moves* from one chord to the next,
 * by root interval. Drives ProgGenie's opt-in motion overlay (design Q4):
 * texture-first, two readings —
 *   - **step**  → a quiet underline (stepwise motion, ½ or whole step),
 *   - **fifth** → an arrow (root by a perfect fifth/fourth — the circle-of-
 *     fifths cadence: V→I, ii→V, and secondary dominants).
 *
 * `notable` is the default density filter: structural fifths are always
 * notable; non-fifth motion is notable only when it leaves the key (chromatic /
 * secondary), so ordinary diatonic steps stay unmarked unless you ask for all.
 * Pure interval math (no spelling); vectors in `motion.test.ts`.
 */

type Mode = "major" | "minor";

const MAJOR_DEGREE_PCS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_DEGREE_PCS = [0, 2, 3, 5, 7, 8, 10];

export type Motion = "repeat" | "step" | "fifth" | "third" | "tritone";

export interface TransitionMotion {
  motion: Motion;
  /** Worth marking at the default ("notable") density. */
  notable: boolean;
}

/** Is a pitch class diatonic to the key (root in the mode's scale)? */
function inKey(pc: number, keyTonicPc: number, mode: Mode): boolean {
  const rel = (((pc - keyTonicPc) % 12) + 12) % 12;
  return (mode === "minor" ? MINOR_DEGREE_PCS : MAJOR_DEGREE_PCS).includes(rel);
}

/**
 * Classify the root motion from `fromPc` to `toPc` in a key.
 * Intervals: 5/7 = perfect fourth/fifth → "fifth"; 1/2/10/11 = ½/whole step →
 * "step"; 6 = "tritone"; 3/4/8/9 = "third"; 0 = "repeat".
 */
export function transitionMotion(fromPc: number, toPc: number, keyTonicPc: number, mode: Mode = "major"): TransitionMotion {
  const iv = (((toPc - fromPc) % 12) + 12) % 12;
  let motion: Motion;
  if (iv === 0) motion = "repeat";
  else if (iv === 5 || iv === 7) motion = "fifth";
  else if (iv === 1 || iv === 2 || iv === 10 || iv === 11) motion = "step";
  else if (iv === 6) motion = "tritone";
  else motion = "third";
  const diatonic = inKey(fromPc, keyTonicPc, mode) && inKey(toPc, keyTonicPc, mode);
  // Fifths are the structural cadences (always notable); other motion earns a
  // mark when it's chromatic (a root off the scale → secondary/borrowed).
  const notable = motion === "repeat" ? false : motion === "fifth" ? true : !diatonic;
  return { motion, notable };
}
