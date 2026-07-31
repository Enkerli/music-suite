/**
 * Serpe — canonical rhythm algorithms, ported verbatim from @enkerli/theory
 * (music-suite packages/theory/src/rhythm.ts), which is the suite's reference
 * implementation and is conformance-locked against the original Serpe engine.
 *
 * Replaces the prototype's simplified metric-depth approximation so the WebUI
 * preview and the Dilute/Concentrate/Wolrab/Dilcue transforms match the C++
 * plugin exactly. Patterns are 0/1 number arrays (first step = leftmost).
 */

// ── Euclidean (Bjorklund, rotated so the first onset is at index 0) ──────────
/**
 * Spread `beats` onsets as evenly as possible over `steps` steps.
 *
 *   E(3,8)  → 10010010   the tresillo
 *   E(5,8)  → 10110110   the cinquillo
 *   E(5,13) → 1001010010100
 *
 * WHY THIS IS NOT JUST `round(i * steps / beats)`. Even spacing is only exact
 * when `beats` divides `steps`. Otherwise the remainder has to be distributed,
 * and distributing it *evenly again* is the same problem one level down. That
 * recursion is Euclid's algorithm for gcd — which is why these rhythms are
 * called Euclidean, and why the loop below looks like long division rather
 * than like anything musical.
 *
 * THE ALGORITHM (Bjorklund). Think of it as `beats` groups of `[1]` and
 * `steps - beats` groups of `[0]`, then repeatedly distributing the smaller
 * pile into the larger:
 *
 *   remainders[0] = beats        the onsets
 *   divisor       = steps - beats  the rests
 *
 * Each pass records how many of the current group fit into each of the other
 * (`counts[level]`) and what is left over (`remainders[level+1]`) — exactly the
 * quotient/remainder pair of Euclid's algorithm. The loop stops when the
 * remainder is 0 or 1, i.e. when nothing is left to distribute.
 *
 * `build` then replays that record backwards to emit the actual steps. The two
 * sentinel levels are the base cases and are the only part that touches the
 * output array:
 *
 *   build(-1)  emit a rest   (0)
 *   build(-2)  emit an onset (1)
 *
 * At every real level it emits `counts[l]` copies of the next group down, then
 * one copy of the group below that if there was a remainder to place. Nothing
 * about this is obvious from the code, which is why it is written out here.
 *
 * ROTATION. Bjorklund's output does not necessarily start on an onset — the
 * groups come out in whatever order the distribution produced. Every caller in
 * this suite wants step 0 to be the downbeat, so the pattern is rotated to put
 * the first onset there before returning. `offset` then rotates further, on
 * purpose.
 *
 * Ported verbatim from the C++ engine, which is authoritative (INTENT D3).
 * Changing the tie-breaking here would silently desynchronise the two.
 *
 * @param {number} beats   onsets to place; clamped to [0, steps]
 * @param {number} steps   pattern length
 * @param {number} offset  extra rotation, applied after the downbeat rotation
 * @returns {number[]} 0/1 array, leftmost = first step (INTENT D1)
 */
export function euclideanRhythm(beats, steps, offset = 0) {
  if (beats > steps) beats = steps;
  if (beats <= 0) return new Array(steps).fill(0);

  let pattern = [];
  const counts = [];
  const remainders = [];
  let divisor = steps - beats;
  remainders[0] = beats;
  let level = 0;

  // Euclid's algorithm, keeping the whole quotient/remainder trail rather than
  // just the final gcd — `build` needs every step of it to reassemble groups.
  do {
    counts[level] = Math.floor(divisor / remainders[level]);
    remainders[level + 1] = divisor % remainders[level];
    divisor = remainders[level];
    level++;
  } while (remainders[level] > 1);

  counts[level] = divisor;

  function build(l) {
    if (l === -1) pattern.push(0);        // base case: one rest
    else if (l === -2) pattern.push(1);   // base case: one onset
    else {
      for (let i = 0; i < counts[l]; i++) build(l - 1);
      if (remainders[l] !== 0) build(l - 2);
    }
  }
  build(level);

  // Degenerate inputs can leave the pattern short; pad with rests.
  while (pattern.length < steps) pattern.push(0);

  // Put the first onset on step 0 — see ROTATION above.
  const firstBeatIndex = pattern.findIndex((b) => b);
  if (firstBeatIndex > 0) pattern = pattern.slice(firstBeatIndex).concat(pattern.slice(0, firstBeatIndex));

  if (offset !== 0) {
    offset = ((offset % steps) + steps) % steps;
    const out = new Array(steps);
    for (let i = 0; i < steps; i++) out[i] = pattern[(i - offset + steps) % steps];
    pattern = out;
  }
  return pattern;
}

export function euclideanComplement(beats, steps, offset = 0) {
  return euclideanRhythm(steps - beats, steps, offset);
}

// ── Funky Euclidean generator (ported from the webapp PatternGenerators) ─────
// A Euclidean base, then: randomly nudge some hits ±1 (funkiness), add backbeats
// (2 & 4), and a light shuffle. Stochastic — each call differs. Returns 0/1.
export function funkyEuclidean(steps, params = {}) {
  const n = Math.max(1, steps | 0);
  const {
    hits = Math.floor(n * 0.4),
    rotation = 0,
    funkiness = 0.5,
    backbeat = 0.3,
    shuffle = 0.2,
  } = params;

  const pattern = euclideanRhythm(Math.max(0, Math.min(hits, n)), n, rotation).map(Boolean);

  // Funkiness — move some hits one step left/right into a free slot.
  for (let i = 0; i < n; i++) {
    if (pattern[i] && Math.random() < funkiness) {
      const np = (i + (Math.random() < 0.5 ? -1 : 1) + n) % n;
      if (!pattern[np]) { pattern[i] = false; pattern[np] = true; }
    }
  }

  // Backbeats (steps 2 and 4 in 4/4).
  const q = Math.floor(n / 4);
  for (const beat of [q, q * 3]) if (beat > 0 && beat < n && Math.random() < backbeat) pattern[beat] = true;

  // Shuffle — push some off-beat eighths slightly later.
  const e = Math.floor(n / 8);
  if (e > 0) {
    for (let i = e; i < n; i += e * 2) {
      if (pattern[i] && Math.random() < shuffle) {
        const np = i + Math.floor(e * 0.3);
        if (np < n && !pattern[np]) { pattern[i] = false; pattern[np] = true; }
      }
    }
  }

  return pattern.map(Number);
}

// ── Progressive lengthening: bell-curve random steps (matches the C++ engine
// generateBellCurveRandomSteps). Returns `numSteps` steps with a bell-curve
// number of onsets randomly distributed. *1 is a 50/50 coin flip. ──
/**
 * A normally-distributed sample, by the Box–Muller transform: two uniform
 * randoms in, one Gaussian out. `sqrt(-2 ln u)` gives the radius and
 * `cos(2π v)` the angle, which together turn a uniform square into a normal
 * distribution. (The transform actually produces two independent samples —
 * `sin` gives the other — and we discard it, because one is all we need and
 * caching it would make the RNG consumption order harder to pin in tests.)
 *
 * The `while (u === 0)` guards matter: `Math.log(0)` is -Infinity, and a
 * single zero from the RNG would poison the result. Cheap insurance.
 */
function gaussian(mean, std, random = Math.random) {
  let u = 0, v = 0;
  while (u === 0) u = random();
  while (v === 0) v = random();
  return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
/**
 * @param {number} numSteps
 * @param {() => number} [random] injectable RNG. Defaults to Math.random, so
 *   this stays random by design (progressive lengthening is meant to be, and
 *   the engine's own version is unseeded); the parameter exists so tests can
 *   pin a sequence without imposing seeding on callers.
 */
export function bellCurveRandomSteps(numSteps, random = Math.random) {
  const out = new Array(Math.max(0, numSteps | 0)).fill(0);
  if (numSteps <= 0) return out;
  let onsets;
  if (numSteps === 1) {
    // One step has no distribution to speak of — a coin flip.
    onsets = random() < 0.5 ? 0 : 1;
  } else {
    // How MANY onsets, not where: centred on half the steps, with the spread
    // chosen so ±3σ spans the whole range (σ = (n-1)/6). That makes the
    // extremes — all onsets or none — rare but reachable, which is the point:
    // growth should usually feel like "some more notes" and occasionally
    // surprise. Clamped because a Gaussian has no bounds and this does.
    onsets = Math.round(gaussian(numSteps / 2, (numSteps - 1) / 6, random));
    onsets = Math.max(0, Math.min(numSteps, onsets));
  }
  // WHERE they land: a Fisher-Yates shuffle of the positions, then take the
  // first `onsets`. Uniform over positions on purpose — the bell curve governs
  // density, not placement, so growth does not inherit the base's metric
  // accents and stays recognisably a different kind of material.
  const pos = [...Array(numSteps).keys()];
  for (let i = pos.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pos[i], pos[j]] = [pos[j], pos[i]];
  }
  for (let i = 0; i < onsets; i++) out[pos[i]] = 1;
  return out;
}

// ── Barlow indispensability (matches the plugin's C++ engine) ────────────────
function gcd(a, b) { while (b !== 0) { const t = b; b = a % b; a = t; } return a; }

// Serpe's Barlow indispensability — the SAME heuristic the C++ engine uses
// (PatternUtils::calculateBarlowIndispensability), so the dilute/concentrate
// buttons match the engine's `B>`/`W>` progressive transforms. Unlike the pure
// stratified-meter method this breaks ties on PRIME meters (e.g. 17), where the
// stratified method gives every interior pulse the same weight and dilute/
// concentrate would just fill left-to-right. Values are an arbitrary positive
// scale (downbeat 10, pickup 7, …); only the ORDER matters to the transform.
export function positionIndispensability(position, length) {
  if (position === 0) return 10.0;                  // downbeat — always max
  let ind = 0.0;

  // Metric strength where the position aligns with a subdivision (composites).
  const g = gcd(position, length);
  if (g > 1) ind = (g / length) * 10.0;

  // Alignment with common musical fractions (works for primes too).
  const ratio = position / length;
  const fracPos = [1 / 2, 1 / 4, 3 / 4, 1 / 3, 2 / 3, 1 / 8, 3 / 8, 5 / 8, 7 / 8, 1 / 6, 5 / 6];
  const fracVal = [5, 3, 3, 2.5, 2.5, 1.5, 1.5, 1.5, 1.5, 1, 1];
  let closest = 1.0, fracStrength = 0.0;
  for (let i = 0; i < fracPos.length; i++) {
    const d = Math.abs(ratio - fracPos[i]);
    if (d < closest) { closest = d; fracStrength = fracVal[i]; }
  }
  if (closest <= 0.5 / length) ind = Math.max(ind, fracStrength);

  // Remaining positions: center/edge hierarchy with a small tie-break so the
  // order is well-defined (no sequential filling on primes).
  if (ind < 0.5) {
    const centerDistance = Math.abs(position - length / 2.0) / (length / 2.0);
    const edgeDistance = Math.min(position, length - position) / (length / 2.0);
    ind = (1.0 - centerDistance * 0.3) + (edgeDistance * 0.2);
    ind += (position % 3) * 0.01 + (position % 5) * 0.005;
  }

  if (position === length - 1) ind = Math.max(ind, 7.0); // anacrustic pickup
  return Math.max(ind, 0.1 + position * 0.001);
}

export function barlowIndispensabilityTable(length) {
  const table = new Array(length);
  for (let i = 0; i < length; i++) table[i] = positionIndispensability(i, length);
  return table;
}

function isWeakBeat(position, stepCount) {
  const quarter = stepCount / 4, eighth = stepCount / 8;
  return !(position % quarter === 0 || position % eighth === 0);
}

// ── Barlow transform: dilute / concentrate, with Wolrab (anti) mode ──────────
/**
 * Move a pattern toward `targetOnsets` by adding or removing the *least
 * musically load-bearing* steps first, ranked by Barlow indispensability
 * (above). Removing notes from the weak positions keeps a rhythm recognisable;
 * removing them at random does not.
 *
 * **Wolrab** is "Barlow" backwards, and that is exactly what the mode does:
 * invert the ranking, so it removes the *strongest* positions and adds to the
 * weakest. The result is deliberately awkward — it takes the downbeat away
 * first. That is a feature (INTENT B2/B3: going away from the expected), not a
 * bug to be smoothed out.
 *
 * Reached from UPI as `B>N` (Barlow) and `W>N` (Wolrab); `E>N` and `D>N` use
 * Euclidean and its complement instead and never come through here.
 */
export function barlowTransform(pattern, targetOnsets, options = {}) {
  const stepCount = pattern.length;
  const current = pattern.filter((s) => s).length;
  if (targetOnsets === current) return pattern.slice();

  const table = barlowIndispensabilityTable(stepCount);
  return targetOnsets < current
    ? dilute(pattern, targetOnsets, table, options)
    : concentrate(pattern, targetOnsets, table, options);
}

function dilute(pattern, targetOnsets, table, options) {
  const { preserveDownbeat = true, minimumIndispensability = 0.0, wolrabMode = false } = options;
  const current = pattern.filter((s) => s).length;
  const toRemove = current - targetOnsets;

  const onsets = pattern
    .map((on, i) => ({ position: i, indispensability: table[i], isDownbeat: i === 0, on }))
    .filter((p) => p.on);
  // Removal order. Ascending indispensability normally, so the weakest onsets
  // go first; descending under Wolrab, so the strongest do.
  //
  // Note `preserveDownbeat && !wolrabMode`: the downbeat guard is deliberately
  // switched OFF in Wolrab. Keeping it would defeat the mode — taking the
  // downbeat away is the most characteristic thing Wolrab does, and a guard
  // that protected it would leave the mode barely distinguishable from a mild
  // reshuffle. The asymmetry is intentional; do not "fix" it for symmetry.
  onsets.sort((a, b) => {
    if (preserveDownbeat && !wolrabMode) {
      if (a.isDownbeat && !b.isDownbeat) return 1;   // downbeat sorts last = removed last
      if (!a.isDownbeat && b.isDownbeat) return -1;
    }
    return wolrabMode ? b.indispensability - a.indispensability : a.indispensability - b.indispensability;
  });

  const next = pattern.slice();
  for (let i = 0; i < Math.min(toRemove, onsets.length); i++) {
    const c = onsets[i];
    if (wolrabMode || c.indispensability >= minimumIndispensability || !preserveDownbeat || !c.isDownbeat)
      next[c.position] = 0;
  }
  return next;
}

function concentrate(pattern, targetOnsets, table, options) {
  const { avoidWeakBeats = false, minimumIndispensability = 0.1, wolrabMode = false } = options;
  const stepCount = pattern.length;
  const current = pattern.filter((s) => s).length;
  const toAdd = targetOnsets - current;

  const empty = pattern
    .map((on, i) => ({ position: i, indispensability: table[i], isWeakBeat: isWeakBeat(i, stepCount), on }))
    .filter((p) => !p.on);
  empty.sort((a, b) => {
    if (avoidWeakBeats) {
      if (a.isWeakBeat && !b.isWeakBeat) return 1;
      if (!a.isWeakBeat && b.isWeakBeat) return -1;
    }
    return wolrabMode ? a.indispensability - b.indispensability : b.indispensability - a.indispensability;
  });

  const next = pattern.slice();
  let added = 0;
  // First pass respects the floor, so weak positions are not filled while
  // stronger ones are still free.
  for (let i = 0; i < empty.length && added < toAdd; i++) {
    const c = empty[i];
    if (c.indispensability >= minimumIndispensability) { next[c.position] = 1; added++; }
  }
  // Second pass ignores it. The caller asked for `targetOnsets` and must get
  // them; a floor that silently returned a shorter-than-requested pattern would
  // desynchronise this from the C++ engine, which also always reaches target.
  if (added < toAdd) {
    for (let i = 0; i < empty.length && added < toAdd; i++) {
      const c = empty[i];
      if (next[c.position]) continue;
      next[c.position] = 1; added++;
    }
  }
  return next;
}
