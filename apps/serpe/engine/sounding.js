/**
 * The sounding pattern — the single source anything that PLAYS or DRAWS reads.
 *
 * Serpe holds a pattern twice, and the difference is the whole reason this
 * module exists:
 *
 *   the TYPED pattern    what `parseField` got out of the text. `poly` from
 *                        parsePolyUPI, `steps` from parseUPI. It is the base:
 *                        no progression applied, no engine state folded in.
 *
 *   the SOUNDING pattern what is actually being heard right now. A lengthened
 *                        lane is longer than it was typed; a rotating one is
 *                        turned; in a plugin the C++ engine's lanes replace the
 *                        JS parse outright (INTENT D3).
 *
 * They are identical for any pattern without progression, which is exactly why
 * reading the wrong one survives so long: every simple case looks right.
 *
 * THREE BUGS IN TWO DAYS came from a reader picking the typed copy:
 *
 *   · the poly panel drew the typed text while the engine cycled scenes, so a
 *     `|` chain displayed its first scene forever (2026-07-29);
 *   · the dataflow probe read the processor's mono engine for poly sessions,
 *     where it holds the untouched DEFAULT pattern, so a test compared two
 *     identical irrelevancies and passed regardless (2026-08-01);
 *   · the lane clock ticked the typed length, so `100101010*3/101*2` drew 21
 *     steps and played 9 — the first cycle correct, every one after it
 *     truncated (2026-08-01).
 *
 * So: **the scheduler and the views both take their pattern from here, and
 * nothing else assembles one.** If you find yourself reaching for `poly` or a
 * raw parse result to decide what to play or draw, that is the bug.
 */

/**
 * @param {object}   src
 * @param {number[]} src.steps        mono steps, engine-overlaid where relevant
 * @param {number[]} src.accents      mono accents at their current precession
 * @param {object|null} src.poly      the TYPED poly parse (parsePolyUPI), or null
 * @param {object|null} src.displayPoly  the SOUNDING poly — progression resolved
 *        at the current trigger, or the engine's own lanes in a plugin
 * @returns {{steps: number[], accents: number[], poly: object|null}}
 */
export function soundingPattern({ steps, accents, poly, displayPoly } = {}) {
  return {
    steps: steps ?? [],
    accents: accents ?? [],
    // displayPoly wins whenever it exists. It falls back to the typed parse
    // only for the case where they cannot differ — a poly pattern with no
    // progression on any lane, where displayPoly returns `poly` unchanged.
    poly: displayPoly ?? poly ?? null,
  };
}

/**
 * Does this poly pattern have anything that makes sounding differ from typed?
 * Used to keep the fallback above honest: if a lane carries progression and the
 * caller still hands us no displayPoly, that is a wiring mistake, not a state
 * the app should render.
 */
export function hasProgression(poly) {
  return !!poly?.lanes?.some((l) => l.progressive);
}
