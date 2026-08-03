/**
 * mulberry32 — the suite's one seeded PRNG.
 *
 * Inlined rather than depended on: `@enkerli/upi` stays dependency-free by
 * design. Shared rather than re-inlined: this existed twice (microtiming.js and
 * longshort.js) and the copies had already drifted — one multiplied the seed
 * with `Math.imul`, the other with `*`, which disagree the moment the product
 * exceeds 2^53. Two patterns seeded the same could therefore produce different
 * material depending on which module asked. INTENT L5, and it was heading for a
 * third copy when progressive lengthening needed one.
 *
 * `Math.imul` is the correct one: it is the 32-bit multiply the algorithm
 * specifies, and it is what the microtiming vectors were generated against.
 */
export function rng(seed, pass = 0) {
  let s = (Math.imul(seed | 0, 0x9e3779b1) + Math.imul(pass | 0, 0x85ebca6b)) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A stable 32-bit seed for a step pattern (FNV-1a over the bits).
 *
 * Lets a pattern seed its own generated material, so two different patterns
 * grow differently while one pattern grows the same way every time.
 */
export function seedFromSteps(steps, salt = 0) {
  let h = 0x811c9dc5 ^ (salt | 0);
  for (let i = 0; i < steps.length; i++) {
    h ^= steps[i] ? 1 : 0;
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Morph — how much of a take is re-rolled on each pass.
 *
 * GloriArp's model, same meaning everywhere: 0 means every pass is the same
 * bar, 1 means every pass is independent, and in between a FRACTION of the
 * decisions get a new answer while the rest stand. That is what makes a groove
 * drift rather than jump.
 *
 * Both streams are drawn from on EVERY decision, even when only one is used.
 * Consuming them unevenly would make the result depend on how many earlier
 * decisions happened to morph, and a take would stop being reproducible.
 *
 * Lives here, beside `rng`, because it is a seeding convention rather than a
 * drum one — it started private to `@enkerli/drumsynth` and the comping styles
 * needed the identical rule. A second copy would have drifted (INTENT L5, five
 * incidents and counting), and "same seed, same take" has to hold suite-wide.
 */
export function morpher(seed, pass, rate) {
  const base = rng(seed >>> 0, 0);                    // the pass-0 take, drifted from
  const mut = rng(seed >>> 0, pass >>> 0);            // where this pass wants to go
  const pick = rng((seed ^ 0x9e3779b9) >>> 0, pass >>> 0);
  return () => {
    const a = base(), b = mut(), p = pick();
    return pass > 0 && p < rate ? b : a;
  };
}
