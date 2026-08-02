/**
 * The voices — x0x-style synthesis, no samples.
 *
 * WHY SYNTHESIS. A sampled kit would sound better in an afternoon, and it would
 * drag the licensing question into a repository whose whole discipline is that
 * nothing ships which cannot be shipped (INTENT D7). "Public domain drum
 * samples" is a claim that has to be verified per file, forever, by whoever
 * touches the repo next. Synthesis has no provenance to audit.
 *
 * It also happens to be the right instrument for the job: these sounds are
 * PARAMETERS, so a learned groove can vary its snare rather than replaying one
 * recording, and a hat can be genuinely half-open rather than a third sample.
 *
 * Every voice is a pure function that ADDS into a buffer. No allocation per
 * hit, no shared state between hits, so the same code renders offline for a
 * `.wav` and inside an AudioWorklet.
 *
 * The techniques are the classic ones, stated plainly:
 *
 *   kick   sine with a fast downward pitch sweep, plus a click transient. The
 *          sweep IS the beater; a fixed-pitch sine is a test tone.
 *   snare  a tuned body (two detuned sines) under a noise burst, the noise
 *          decaying slower — the body gives pitch, the noise gives snares.
 *   hats   bandpassed noise. The 808 used six squares through a highpass; the
 *          audible difference at this scale is small and noise is far cheaper
 *          to keep stable. Closed and open differ ONLY in decay, which is what
 *          makes a choke meaningful.
 *   clap   three fast noise bursts then a longer tail — the bursts are the
 *          several-hands-not-quite-together part, and without them a clap is
 *          just a short snare.
 *   toms   like the kick but slower, higher, and tuned.
 *   crash  long bandpassed noise, brighter and far longer than a hat.
 */

const TAU = Math.PI * 2;

/** Exponential decay to -60 dB over `ms`. */
function decayRate(ms, sr) {
  return Math.exp(-6.9078 / Math.max(1, (ms / 1000) * sr));
}

/**
 * A one-pole state-variable-ish bandpass, run per sample.
 * Cheap and stable; drum noise does not need anything sharper.
 */
function makeBandpass(freq, q, sr) {
  const f = 2 * Math.sin((Math.PI * Math.min(freq, sr * 0.45)) / sr);
  const damp = Math.min(1, 1 / Math.max(0.5, q));
  let low = 0, band = 0;
  return (x) => {
    low += f * band;
    const high = x - low - damp * band;
    band += f * high;
    return band;
  };
}

function makeHighpass(freq, sr) {
  const rc = 1 / (TAU * freq);
  const a = rc / (rc + 1 / sr);
  let prevIn = 0, prevOut = 0;
  return (x) => { const y = a * (prevOut + x - prevIn); prevIn = x; prevOut = y; return y; };
}

/** Deterministic white noise — a session renders the same file twice. */
function makeNoise(seed = 1) {
  let s = (seed | 0) || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s | 0) / 2147483648); };
}

const add = (buf, i, v) => { if (i < buf.length) buf[i] += v; };

/**
 * @typedef {object} VoiceCtx
 * @property {Float32Array} buf   destination
 * @property {number} at          sample offset of the hit
 * @property {number} sr          sample rate
 * @property {number} velocity    0..1
 * @property {number} [seed]      for the noise sources
 */

export function kick(ctx, p = {}) {
  const { buf, at, sr, velocity = 1 } = ctx;
  const { startHz = 120, endHz = 45, pitchMs = 45, decayMs = 260, click = 0.35, gain = 1 } = p;
  const n = Math.ceil((decayMs / 1000) * sr);
  const ampR = decayRate(decayMs, sr);
  const pitchR = decayRate(pitchMs, sr);
  let amp = velocity * gain, pitchEnv = 1, phase = 0;
  for (let i = 0; i < n; i++) {
    const hz = endHz + (startHz - endHz) * pitchEnv;
    phase += (TAU * hz) / sr;
    // The click is a couple of samples of the transient, not a separate
    // oscillator: it is what makes a kick audible on a phone speaker.
    const c = i < 3 ? click * velocity * (1 - i / 3) : 0;
    add(buf, at + i, Math.sin(phase) * amp + c);
    amp *= ampR; pitchEnv *= pitchR;
  }
}

export function tom(ctx, p = {}) {
  return kick(ctx, { startHz: 260, endHz: 150, pitchMs: 90, decayMs: 380, click: 0.08, ...p });
}

export function snare(ctx, p = {}) {
  const { buf, at, sr, velocity = 1, seed = 1 } = ctx;
  const { bodyHz = 185, bodyMs = 110, noiseMs = 190, noiseMix = 0.7, gain = 1 } = p;
  const n = Math.ceil((Math.max(bodyMs, noiseMs) / 1000) * sr);
  const bodyR = decayRate(bodyMs, sr), noiseR = decayRate(noiseMs, sr);
  const noise = makeNoise(seed), hp = makeHighpass(1200, sr);
  let bodyAmp = velocity * gain * (1 - noiseMix), noiseAmp = velocity * gain * noiseMix;
  let p1 = 0, p2 = 0;
  for (let i = 0; i < n; i++) {
    // Two detuned sines, not one: a single tone reads as a tom.
    p1 += (TAU * bodyHz) / sr;
    p2 += (TAU * bodyHz * 1.48) / sr;
    const body = (Math.sin(p1) + Math.sin(p2) * 0.6) * bodyAmp;
    add(buf, at + i, body + hp(noise()) * noiseAmp);
    bodyAmp *= bodyR; noiseAmp *= noiseR;
  }
}

/**
 * Hat. Closed and open are THE SAME VOICE at different decays — which is the
 * point: a choke is a duration, and `LS(r){mask}` says which hits ring.
 */
export function hat(ctx, p = {}) {
  const { buf, at, sr, velocity = 1, seed = 7 } = ctx;
  const { decayMs = 55, toneHz = 8200, q = 1.4, gain = 0.7 } = p;
  const n = Math.ceil((decayMs / 1000) * sr);
  const r = decayRate(decayMs, sr);
  const noise = makeNoise(seed), bp = makeBandpass(toneHz, q, sr), hp = makeHighpass(6000, sr);
  let amp = velocity * gain;
  for (let i = 0; i < n; i++) {
    add(buf, at + i, hp(bp(noise())) * amp);
    amp *= r;
  }
}

export const closedHat = (ctx, p = {}) => hat(ctx, { decayMs: 55, ...p });
export const openHat = (ctx, p = {}) => hat(ctx, { decayMs: 420, ...p });
export const crash = (ctx, p = {}) =>
  hat(ctx, { decayMs: 1400, toneHz: 5200, q: 0.7, gain: 0.55, ...p });

export function clap(ctx, p = {}) {
  const { buf, at, sr, velocity = 1, seed = 3 } = ctx;
  const { burstMs = 9, burstGapMs = 11, bursts = 3, tailMs = 210, gain = 0.9 } = p;
  const noise = makeNoise(seed), bp = makeBandpass(1400, 1.1, sr);
  const gap = Math.round((burstGapMs / 1000) * sr);
  const total = Math.ceil((tailMs / 1000) * sr) + gap * bursts;
  const burstR = decayRate(burstMs, sr), tailR = decayRate(tailMs, sr);
  // The bursts are several hands not quite together. Without them this is a
  // short snare, which is the usual way a synthesised clap goes wrong.
  let tail = 0, tailAmp = 0;
  for (let i = 0; i < total; i++) {
    let v = 0;
    for (let b = 0; b < bursts; b++) {
      const start = b * gap;
      if (i >= start) v += velocity * gain * Math.pow(burstR, i - start);
    }
    if (i === gap * (bursts - 1)) tailAmp = velocity * gain * 0.55;
    tail = tailAmp; tailAmp *= tailR;
    add(buf, at + i, bp(noise()) * (v * 0.5 + tail));
  }
}

/** name → voice. Kept beside the kit so a sound cannot exist without a synth. */
export const VOICES = {
  kick, snare, clap, closedHat, openHat, crash,
  lowTom: (ctx, p = {}) => tom(ctx, { startHz: 190, endHz: 105, ...p }),
  midTom: (ctx, p = {}) => tom(ctx, { startHz: 280, endHz: 160, ...p }),
};
