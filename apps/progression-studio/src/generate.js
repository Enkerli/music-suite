/**
 * Progression generation over corpus transition statistics.
 *
 * Labels follow the suite convention (CONVENTIONS.md): Roman numeral +
 * display suffix ("IIm7", "V7", "♭II7"). Realization goes through
 * @enkerli/theory: resolveDegree gives the properly spelled root,
 * qualityKeyForSuffix recovers the quality, the dictionary gives the
 * pitch classes, and minimalVoiceLeading smooths the playback voicings.
 */

import { effectiveRow } from "./curation.js";
import {
  findQualityByKey,
  minimalVoiceLeading,
  mod12,
  parseSpelled,
  qualityKeyForSuffix,
  resolveDegree,
  spelledToPc,
} from "@enkerli/theory";

/** Deterministic RNG (mulberry32) so progressions are reproducible by seed. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NUMERAL_RE = /^([♭♯b#𝄪𝄫]*(?:VII|VI|V|IV|III|II|I))(.*)$/;

/** Split a table label into numeral and suffix. */
export function splitLabel(label) {
  const m = NUMERAL_RE.exec(label);
  if (!m) return null;
  return { numeral: m[1], suffix: m[2] };
}

function weightedPick(row, rng, temperature = 1) {
  const entries = Object.entries(row);
  const inv = 1 / Math.max(0.01, temperature);
  let total = 0;
  const weights = entries.map(([, n]) => {
    const w = temperature === 1 ? n : Math.pow(n, inv);
    total += w;
    return w;
  });
  let r = rng() * total;
  for (let i = 0; i < entries.length; i++) {
    r -= weights[i];
    if (r <= 0) return entries[i][0];
  }
  return entries[0][0];
}

/** Identity curation used when none is supplied. */
const NO_CURATION = { multipliers: {} };

/** Most common tonic-family label to start from, per mode. */
export function startLabel(table, mode) {
  const preferred = mode === "minor" ? ["Im7", "Im", "Im6", "ImM7"] : ["Imaj7", "I", "I6"];
  for (const p of preferred) if (table[p]) return p;
  // Fallback: the row with the largest outgoing mass.
  let best = null;
  let bestMass = -1;
  for (const [label, row] of Object.entries(table)) {
    const mass = Object.values(row).reduce((a, b) => a + b, 0);
    if (mass > bestMass) { best = label; bestMass = mass; }
  }
  return best;
}

/**
 * Generate a progression of `length` labels by weighted Markov walk.
 * Dead ends (labels with no outgoing row) restart from the start label.
 * `curation` (optional) multiplies corpus counts per transition — the
 * ear-driven layer (see curation.js); generation stays deterministic
 * for a given (seed, curation) pair.
 */
export function generateProgression(table, mode, length, seed, curation = NO_CURATION, temperature = 1) {
  const rng = mulberry32(seed);
  const start = startLabel(table, mode);
  const labels = [start];
  let current = start;
  while (labels.length < length) {
    const row = table[current];
    current = row ? weightedPick(effectiveRow(row, current, curation), rng, temperature) : start;
    labels.push(current);
  }
  return labels;
}

/**
 * Realize a label in a key: properly spelled chord symbol + pitch classes.
 * Unknown suffixes realize as a bare root (audible, visible, not dropped).
 */
export function realizeLabel(label, key) {
  const parts = splitLabel(label);
  if (!parts) return null;
  const rootName = resolveDegree(parts.numeral, key);
  const qualityKey = qualityKeyForSuffix(parts.suffix);
  const quality = qualityKey ? findQualityByKey(qualityKey) : undefined;
  const rootPc = spelledToPc(parseSpelled(rootName));
  const pcs = (quality ? quality.pcs : [0]).map((pc) => mod12(rootPc + pc));
  return {
    label,
    symbol: rootName + parts.suffix,
    rootName,
    rootPc,
    pcs,
    qualityKey: qualityKey ?? null,
  };
}

/**
 * Voice a realized progression for playback: the first chord sits in a
 * middle window; each next chord follows the minimal taxicab voice
 * leading from its predecessor, mapped to the nearest MIDI notes.
 * Returns arrays of MIDI note numbers (root doubled in the bass).
 */
export function voiceProgression(chords) {
  const voicings = [];
  let previous = null;
  for (const chord of chords) {
    let notes;
    if (!previous) {
      // First chord: place each pc in the octave above middle C,
      // lifting collisions upward.
      notes = [];
      for (const pc of chord.pcs) {
        let note = 60 + mod12(pc);
        while (notes.includes(note)) note += 12;
        notes.push(note);
      }
    } else {
      const { mapping } = minimalVoiceLeading(previous.pcs, chord.pcs);
      const prevByPc = new Map();
      for (const n of previous.notes) {
        if (!prevByPc.has(mod12(n))) prevByPc.set(mod12(n), []);
        prevByPc.get(mod12(n)).push(n);
      }
      notes = [];
      for (const [fromPc, toPc] of mapping) {
        const sources = prevByPc.get(fromPc) ?? [60 + fromPc];
        const source = sources[0];
        // nearest realization of toPc to the source note
        let note = source + ((((toPc - mod12(source)) % 12) + 18) % 12) - 6;
        while (notes.includes(note)) note += 12;
        notes.push(note);
      }
      notes.sort((a, b) => a - b);
    }
    const bass = 36 + mod12(chord.rootPc);
    voicings.push({ ...chord, notes, bass });
    previous = { pcs: chord.pcs, notes };
  }
  return voicings;
}

// ─── Rule-based engines ──────────────────────────────────────────────────
//
// Rules give the root path; the corpus gives the qualities. labelMass and
// commonLabelForNumeral derive, per numeral, the label the corpus uses
// most (in C major: I→Imaj7, II→IIm7, V→V7, VII→VIIm7b5 …).

/** Total corpus mass of each label (outgoing + incoming counts). */
export function labelMass(table) {
  const mass = new Map();
  for (const [from, row] of Object.entries(table)) {
    for (const [to, n] of Object.entries(row)) {
      mass.set(from, (mass.get(from) ?? 0) + n);
      mass.set(to, (mass.get(to) ?? 0) + n);
    }
  }
  return mass;
}

/** The corpus's most common label for a bare numeral ("II" → "IIm7"). */
export function commonLabelForNumeral(table, numeral) {
  const mass = labelMass(table);
  let best = null;
  let bestMass = -1;
  for (const [label, m] of mass) {
    const parts = splitLabel(label);
    if (parts && parts.numeral === numeral && m > bestMass) {
      best = label;
      bestMass = m;
    }
  }
  return best;
}

/** The label most often preceding `target` in the corpus. */
export function commonPredecessor(table, target) {
  let best = null;
  let bestCount = -1;
  for (const [from, row] of Object.entries(table)) {
    const n = row[target];
    if (n !== undefined && from !== target && n > bestCount) {
      best = from;
      bestCount = n;
    }
  }
  return best;
}

/**
 * Force a cadential ending: the last two labels become the corpus's most
 * common pre-tonic label and the tonic itself.
 */
export function applyCadence(table, mode, labels) {
  if (labels.length < 2) return labels;
  const tonic = startLabel(table, mode);
  const pre = commonPredecessor(table, tonic);
  if (!pre) return labels;
  const out = [...labels];
  out[out.length - 2] = pre;
  out[out.length - 1] = tonic;
  // avoid an accidental immediate repeat just before the cadence
  if (out.length >= 3 && out[out.length - 3] === pre) out[out.length - 3] = tonic;
  return out;
}

/** Diatonic circle of fifths: I IV VII III VI II V, ending on the tonic. */
const FIFTHS_CYCLE = ["I", "IV", "VII", "III", "VI", "II", "V"];

/**
 * Rule-based generation: roots walk the diatonic circle of fifths
 * (the classic I–IV–VII–III–VI–II–V–I cycle), qualities are the
 * corpus's most common per degree. Deterministic.
 */
export function generateCircleOfFifths(table, mode, length) {
  const labels = [];
  for (let i = 0; i < length - 1; i++) {
    const numeral = FIFTHS_CYCLE[i % 7];
    labels.push(commonLabelForNumeral(table, numeral) ?? numeral);
  }
  labels.push(startLabel(table, mode));
  return labels;
}

/**
 * Unified entry point for the UI.
 * method: "markov" | "markov-cadence" | "circle"
 */
export function generateLabels(table, mode, { length, seed, curation, method = "markov", temperature = 1 }) {
  if (method === "circle") return generateCircleOfFifths(table, mode, length);
  const labels = generateProgression(table, mode, length, seed, curation, temperature);
  return method === "markov-cadence" ? applyCadence(table, mode, labels) : labels;
}
