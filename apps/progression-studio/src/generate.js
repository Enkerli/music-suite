/**
 * Progression generation over corpus transition statistics.
 *
 * Labels follow the suite convention (CONVENTIONS.md): Roman numeral +
 * display suffix ("IIm7", "V7", "♭II7"). Realization goes through
 * @enkerli/theory: resolveDegree gives the properly spelled root,
 * qualityKeyForSuffix recovers the quality, the dictionary gives the
 * pitch classes, and minimalVoiceLeading smooths the playback voicings.
 */

import { effectiveRow, tripleMultiplier } from "./curation.js";
import {
  detectChord,
  findQualityByKey,
  getAllQualities,
  minimalVoiceLeading,
  mod12,
  parseSpelled,
  qualityKeyForSuffix,
  resolveDegree,
  spelledToPc,
} from "@enkerli/theory";

/** Common, nameable qualities a partial chord might be "completing" toward —
 *  in rough priority order (triads/sevenths before dense extensions). Only
 *  these are offered as completions, so a one-note addition lands on a chord
 *  the player recognizes rather than an obscure quality. */
const COMMON_COMPLETIONS = [
  "maj", "min", "7", "maj7", "min7", "6", "m6", "dim", "dim7", "m7b5",
  "9", "min9", "maj9", "minMaj7", "7add6", "m7add13", "7sus4", "sus4", "sus2", "6add9", "13", "min11",
];
const COMPLETION_RANK = new Map(COMMON_COMPLETIONS.map((k, i) => [k, i]));

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
export function generateProgression(table, mode, length, seed, curation = NO_CURATION, temperature = 1, startFrom = null) {
  const rng = mulberry32(seed);
  const tonic = startLabel(table, mode);
  const start = startFrom && table[startFrom] ? startFrom : (startFrom ?? tonic);
  const labels = [start];
  let current = start;
  while (labels.length < length) {
    let row = table[current];
    if (row) {
      row = effectiveRow(row, current, curation);
      // Longer-context (triple) gesture weights on top of pair weights.
      const prev2 = labels.length >= 2 ? labels[labels.length - 2] : null;
      if (prev2 !== null) {
        let adjusted = null;
        for (const to of Object.keys(row)) {
          const m = tripleMultiplier(curation, prev2, current, to);
          if (m !== 1) {
            adjusted ??= { ...row };
            adjusted[to] = row[to] * m;
          }
        }
        if (adjusted) row = adjusted;
      }
      current = weightedPick(row, rng, temperature);
    } else {
      current = tonic; // dead end: come home
    }
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
 * Voice a single chord's pitch classes into MIDI notes per a shape:
 *   close  — tones stacked tightly above the root
 *   open   — every other inner voice lifted an octave (spread)
 *   drop2  — close, with the 2nd-from-top dropped an octave
 *   shell  — root + 3rd + 7th (guide tones) when present
 */
export function voiceChord(pcs, rootPc, shape = "close", base = 60) {
  const r = mod12(rootPc);
  const ordered = [...new Set(pcs.map(mod12))].sort(
    (a, b) => ((a - r + 12) % 12) - ((b - r + 12) % 12),
  );
  const stack = (list) => {
    const notes = [];
    let cursor = -Infinity;
    for (const pc of list) {
      let n = base + pc;
      while (n <= cursor) n += 12;
      notes.push(n);
      cursor = n;
    }
    return notes;
  };
  if (shape === "shell") {
    const find = (lo, hi) => ordered.find((pc) => { const d = (pc - r + 12) % 12; return d >= lo && d <= hi; });
    const sh = [r, find(3, 4), find(10, 11)].filter((x) => x !== undefined);
    if (sh.length >= 2) return stack(sh);
  }
  let notes = stack(ordered);
  if (shape === "open" && notes.length >= 3) {
    notes = notes.map((n, i) => (i % 2 === 1 ? n + 12 : n)).sort((a, b) => a - b);
  } else if (shape === "drop2" && notes.length >= 2) {
    notes = notes.slice();
    notes[notes.length - 2] -= 12;
    notes.sort((a, b) => a - b);
  }
  return notes;
}

/**
 * Voice a realized progression for playback. With `voiceLead` (default),
 * each chord follows the minimal taxicab voice leading from its
 * predecessor (the first seeded from `shape`); with it off, every chord
 * is voiced in its `shape` home position (no smoothing) — so the toggle
 * makes voice leading both visible and controllable. Root doubled in the
 * bass. Returns arrays of MIDI note numbers.
 */
/**
 * The minimal (taxicab) voicing of `toPcs` led from `fromNotes`: each
 * voice moves the least to a target chord tone, one voice per distinct
 * target pc (surplus voices dropped, uncovered tones placed near the rest).
 * The smoothness primitive behind voiceProgression and voicingSuggestions.
 */
export function voiceLed(fromNotes, toPcs) {
  const fromPcs = [...new Set(fromNotes.map((n) => mod12(n)))];
  const toUniq = [...new Set(toPcs.map((pc) => mod12(pc)))];
  const { mapping } = minimalVoiceLeading(fromPcs, toUniq);
  const prevByPc = new Map();
  for (const n of fromNotes) {
    const pc = mod12(n);
    if (!prevByPc.has(pc)) prevByPc.set(pc, []);
    prevByPc.get(pc).push(n);
  }
  const notes = [];
  const seenToPc = new Set();
  for (const [fromPc, toPc] of mapping) {
    if (seenToPc.has(toPc)) continue;
    seenToPc.add(toPc);
    const source = (prevByPc.get(fromPc) ?? [60 + fromPc])[0];
    let note = source + ((((toPc - mod12(source)) % 12) + 18) % 12) - 6;
    while (notes.includes(note)) note += 12;
    notes.push(note);
  }
  const center = notes.length ? Math.round(notes.reduce((a, b) => a + b, 0) / notes.length) : 60;
  for (const pc of toUniq) {
    if (seenToPc.has(pc)) continue;
    seenToPc.add(pc);
    let note = center + ((((pc - mod12(center)) % 12) + 18) % 12) - 6;
    while (notes.includes(note)) note += 12;
    notes.push(note);
  }
  notes.sort((a, b) => a - b);
  return notes;
}

/** Total voice movement: each target note to its nearest source note. */
export function voiceMovement(fromNotes, toNotes) {
  if (!fromNotes || fromNotes.length === 0) return 0;
  return toNotes.reduce((s, n) => s + Math.min(...fromNotes.map((m) => Math.abs(m - n))), 0);
}

/**
 * Candidate voicings of a chord (pcs rooted at rootPc), ranked by how
 * smoothly each leads from `from` (the previous voicing): the taxicab
 * smoothest, the shape home positions (close/open/drop-2/shell), and the
 * inversions — deduped, scored, sorted by least movement. This is the
 * "set of voiceled suggestions" — play a chord, pick how it sits.
 */
export function voicingSuggestions(pcs, rootPc, { from = null, max = 6 } = {}) {
  const seen = new Set();
  const out = [];
  const add = (label, notes) => {
    if (!notes.length) return;
    const key = notes.join(",");
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ label, notes, movement: voiceMovement(from, notes) });
  };
  if (from && from.length) add("smoothest", voiceLed(from, pcs));
  for (const shape of ["close", "open", "drop2", "shell"]) add(shape, voiceChord(pcs, rootPc, shape));
  const close = voiceChord(pcs, rootPc, "close");
  for (let i = 1; i < close.length; i++) {
    add(`inv ${i}`, [...close.slice(i), ...close.slice(0, i).map((n) => n + 12)].sort((a, b) => a - b));
  }
  if (from && from.length) out.sort((a, b) => a.movement - b.movement);
  return out.slice(0, max);
}

/**
 * Completion suggestions: a played chord that's a note shy of a common
 * chord (e.g. E G D F — a G13 missing its 3rd) → propose the completed
 * chord, keeping the notes as played and adding the one missing tone above
 * them (so the bass and the player's voicing survive). Each added note is
 * tried; only completions that land on a COMMON, exact (no missing/extra)
 * quality are kept, ranked by how standard the quality is. Returns
 * { symbol, added, notes }.
 */
export function chordCompletions(playedNotes, { max = 3 } = {}) {
  if (!playedNotes || playedNotes.length < 2) return [];
  const base = detectChord([...playedNotes].sort((a, b) => a - b));
  if (!base) return [];
  const root = base.root;
  const bass = base.bassName && base.bassName !== base.rootName ? "/" + base.bassName : "";
  const observedRel = new Set(playedNotes.map((n) => mod12(n - root)));
  const top = Math.max(...playedNotes);
  const seen = new Set([base.quality.key]); // don't re-offer what's already played
  const out = [];
  for (const q of getAllQualities()) {
    if (!COMPLETION_RANK.has(q.key) || seen.has(q.key)) continue;
    const template = q.pcs.map(mod12);
    // every played tone must belong to the candidate, with exactly one tone
    // missing — the single note that "completes" it.
    if (![...observedRel].every((pc) => template.includes(pc))) continue;
    const addedPcs = template.filter((pc) => !observedRel.has(pc));
    if (addedPcs.length !== 1) continue;
    seen.add(q.key);
    const addedAbs = mod12(root + addedPcs[0]); // template tone → absolute pitch class
    let note = top - mod12(top) + addedAbs; // place the missing tone above the top note
    while (note <= top) note += 12;
    out.push({
      symbol: base.rootName + q.displayName + bass,
      added: note,
      notes: [...playedNotes, note].sort((a, b) => a - b),
      rank: COMPLETION_RANK.get(q.key),
    });
  }
  out.sort((a, b) => a.rank - b.rank);
  return out.slice(0, max).map(({ rank, ...rest }) => rest);
}

/**
 * Suggest NEXT chords from the current chord. The corpus transition row
 * for `lastLabel` gives the candidates (ranked by how often they follow,
 * the corpus's wisdom); each is voiceled from `lastVoicing` so the user
 * sees how smoothly it connects. When the current chord is uncommon (no
 * transition row — e.g. a hand-played altered chord), fall back to
 * `fallback` labels ranked by voiceleading smoothness ("chords that flow
 * well from here"). Returns { label, symbol, notes, movement, weight }.
 */
export function nextChordSuggestions(table, key, lastLabel, lastVoicing, { fallback = [], max = 6 } = {}) {
  const row = table[lastLabel];
  const fromCorpus = !!(row && Object.keys(row).length > 0);
  const labels = fromCorpus
    ? Object.entries(row).sort((a, b) => b[1] - a[1]).slice(0, 16).map(([l]) => l)
    : fallback;
  const seen = new Set();
  const out = [];
  for (const label of labels) {
    if (seen.has(label) || label === lastLabel) continue;
    seen.add(label);
    const ch = realizeLabel(label, key);
    if (!ch) continue;
    const notes = lastVoicing && lastVoicing.length
      ? voiceLed(lastVoicing, ch.pcs)
      : voiceChord(ch.pcs, ch.rootPc, "close");
    out.push({ label, symbol: ch.symbol, notes, movement: voiceMovement(lastVoicing, notes), weight: fromCorpus ? (row[label] ?? 0) : 0 });
  }
  out.sort(fromCorpus ? (a, b) => b.weight - a.weight : (a, b) => a.movement - b.movement);
  return out.slice(0, max).map((s) => ({ ...s, fromCorpus }));
}

export function voiceProgression(chords, { voiceLead = true, shape = "close" } = {}) {
  const voicings = [];
  let previous = null;
  for (const chord of chords) {
    let notes;
    if (chord.voicing && chord.voicing.length) {
      notes = [...chord.voicing]; // user-chosen voicing (locked)
    } else if (!voiceLead || !previous) {
      notes = voiceChord(chord.pcs, chord.rootPc, shape);
    } else {
      notes = voiceLed(previous.notes, chord.pcs);
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
export function generateLabels(table, mode, { length, seed, curation, method = "markov", temperature = 1, startFrom = null }) {
  if (method === "circle") return generateCircleOfFifths(table, mode, length);
  const labels = generateProgression(table, mode, length, seed, curation, temperature, startFrom);
  return method === "markov-cadence" ? applyCadence(table, mode, labels) : labels;
}

/**
 * Sectioned generation: a base section plus extensions, each continuing
 * from the previous section's last chord ("string sections together").
 * Deterministic from the full parameter set.
 */
export function generateSections(table, mode, base, extensions) {
  let labels = generateLabels(table, mode, base);
  for (const ext of extensions) {
    const segment = generateLabels(table, mode, {
      ...base,
      method: "markov", // extensions always walk the corpus
      length: ext.length + 1,
      seed: ext.seed,
      startFrom: labels[labels.length - 1],
    });
    labels = labels.concat(segment.slice(1)); // joint chord not duplicated
  }
  return labels;
}
