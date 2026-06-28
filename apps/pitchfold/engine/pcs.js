/**
 * PitchFold PCS quantizer — a faithful JS port of Source/PCS/PCSEngine.h, so the
 * standalone webapp snaps notes exactly like the plugin.
 *
 * BIT ORDER: these masks are MSB-first (pitch class 0 = bit 11), matching the
 * PitchFold C++ engine and its webapp UI. This is NOT the suite's leftmost-LSB
 * convention — converging PitchFold onto it is a later "harmonize" step. Keep the
 * `>> (11 - interval)` form to stay byte-for-byte compatible with the plugin.
 */

export function pcActive(mask, interval) {
  return (mask >> (11 - interval)) & 1;
}

export function pitchInScale(pitch, mask, root) {
  const interval = (((pitch - root) % 12) + 12) % 12;
  return pcActive(mask, interval) === 1;
}

/**
 * Snap `midiNote` to the nearest active pitch class.
 * @param {'nearest'|'up'|'down'} dir
 * Returns the original note if the mask is empty/chromatic or nothing fits.
 */
export function quantize(midiNote, mask, root, dir, loNote, hiNote, strength = 1) {
  if (mask === 0 || strength <= 0) return midiNote;
  if (mask === 0x0fff) return midiNote; // chromatic — no snap

  let best = -1;
  let bestDist = Infinity;
  for (let delta = -12; delta <= 12; delta++) {
    const candidate = midiNote + delta;
    if (candidate < loNote || candidate > hiNote) continue;
    if (!pitchInScale(candidate, mask, root)) continue;
    if (dir === "up") {
      if (delta < 0) continue;
      if (delta < bestDist) { best = candidate; bestDist = delta; }
    } else if (dir === "down") {
      if (delta > 0) continue;
      if (-delta < bestDist) { best = candidate; bestDist = -delta; }
    } else {
      if (Math.abs(delta) < bestDist) { best = candidate; bestDist = Math.abs(delta); }
    }
  }

  if (best < 0) return midiNote;
  if (strength >= 1) return best;
  return Math.round(midiNote + (best - midiNote) * strength);
}

/** Stack the scale's tones above `rootNote` into a chord (PolySpread). */
export function buildChord(rootNote, mask, scaleRoot, maxVoices, loNote, hiNote) {
  const out = [];
  if (maxVoices <= 0 || mask === 0) return out;
  if (rootNote >= loNote && rootNote <= hiNote) out.push(rootNote);
  for (let delta = 1; delta <= 24 && out.length < maxVoices; delta++) {
    const candidate = rootNote + delta;
    if (candidate > hiNote) break;
    if (pitchInScale(candidate, mask, scaleRoot)) out.push(candidate);
  }
  return out;
}

/** Add stacked interval offsets above `midiNote` (Chordize). Bit i = +i semis. */
export function harmonize(midiNote, intervalsMask, maxVoices, loNote, hiNote) {
  const out = [];
  if (maxVoices <= 0) return out;
  for (let i = 0; i < 12 && out.length < maxVoices; i++) {
    if (!((intervalsMask >> (11 - i)) & 1)) continue;
    const note = midiNote + i;
    if (note >= loNote && note <= hiNote) out.push(note);
  }
  return out;
}
