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
 *
 * And it is ENFORCED, not just documented — see the invariant in
 * soundingPattern(). Every one of the three bugs above was a silent wrong
 * answer, which is the kind this codebase keeps paying for: a comment asking
 * for care is not a guard, and the reader who needs it is the one who has not
 * read it.
 */

/**
 * Development build?
 *
 * esbuild replaces the literal `process.env.NODE_ENV` at build time, so this
 * resolves to a constant. It is NOT dead-code-eliminated, though — checked
 * 2026-08-01, and the throw is still present in the minified production
 * bundle. Wrapping the read in a try/catch defeats esbuild's constant folding,
 * and that is a trade worth making: the guard costs a branch and a string,
 * while a bare `process.env.NODE_ENV` would be a ReferenceError at module load
 * in any host that neither defines `process` nor performs the substitution —
 * i.e. the app would not open at all.
 *
 * So: dev THROWS, production LOGS. Both paths ship; only the behaviour differs.
 */
const IS_DEV = (() => {
  try { return process.env.NODE_ENV !== "production"; } catch { return true; }
})();

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
  // THE INVARIANT. A lane that carries progression cannot be represented by
  // the typed parse: it is a different length, or turned, the moment it has
  // been triggered once. Arriving here without a displayPoly means the caller
  // is about to play or draw the base forever, which is precisely the
  // 100101010*3/101*2 bug — and that one shipped, was heard, and had to be
  // reported before anyone found it.
  //
  // Dev throws: this is a wiring mistake with no correct rendering, and a
  // console line is exactly what got missed three times. Production logs and
  // carries on with the best available pattern — a truncated cycle is bad, an
  // app that will not open is worse, and a listener should not lose a session
  // to our bookkeeping.
  if (!displayPoly && hasProgression(poly)) {
    const msg =
      "soundingPattern: a lane carries progression but no displayPoly was supplied — " +
      "this would play/draw the TYPED pattern, which never advances. " +
      "See apps/serpe/engine/sounding.js.";
    if (IS_DEV) throw new Error(msg);
    console.error(msg);
  }
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
