#!/usr/bin/env node
/**
 * gen-pcs-vectors — extend vectors/pcs-families.json in place.
 *
 *   node packages/theory/vectors/gen-pcs-vectors.mjs
 *
 * Same shape as gen-rhythm-codecs.mjs: expected values are computed from the
 * built reference (dist/pcs.js), so the committed JSON cannot disagree with
 * @enkerli/theory. Run after `npm run build -w @enkerli/theory`, then commit.
 *
 * ── Why ────────────────────────────────────────────────────────────────────
 *
 * pcs-families.json was hand-written and covered two things: seven scale
 * families, and the Roman numerals of three degree-chord stacks. `consonance`
 * and `classifyDegreeChord` had no vector at all, and `degreeChords` was
 * checked only by the strings it prints — not by the pitch classes it picks or
 * the qualities it decides.
 *
 * That is the same gap `@enkerli/upi` had before upi.json, and the same
 * argument applies: a port reads this file rather than the TypeScript, so
 * whatever is not in here is whatever a port is free to get wrong. PitchFold's
 * PCS engine is being ported to Swift, which is what makes it worth widening
 * now rather than after.
 *
 * ── Scope ──────────────────────────────────────────────────────────────────
 *
 * `families` and `degreeChords` keep their existing shape and cases — pcs.test.ts
 * reads them and this file only adds — with more roots and the `sus` stacking
 * that had no case. Then three new groups:
 *
 *   fifths          the circle-of-fifths mapping, both directions. A property
 *                   test already round-trips it; a port needs the actual table,
 *                   because "round-trips" is also true of the identity.
 *   consonance      the interval-class weighting, over sets chosen to span it:
 *                   a major triad near the top, a chromatic cluster near the
 *                   bottom, and the single-pc and empty edges.
 *   classify        classifyDegreeChord on its own, including the sets it
 *                   refuses to name and falls back to "set" on.
 *
 * Bitmask convention, as everywhere in this suite: leftmost = LSB, pitch class
 * i contributes 2^i. [0,4,7] = 145. See CONVENTIONS.md.
 *
 * ── Made to fail before the widening was believed ──────────────────────────
 *
 * A generated file that reproduces itself is not evidence of anything, so four
 * divergences were planted in pcs.ts and each was caught where it belongs:
 *
 *   · one interval-class weight moved 0.35 → 0.30       → 4 consonance cases
 *   · the classifier's candidate roots searched in the
 *     other order                                       → 13, across classify
 *                                                          and degreeChords
 *   · two entries swapped in the fifths table           → 3 fifths cases
 *   · minMaj7 dropped from the lower-cased qualities    → 8 numerals
 *
 * All reverted. If you add a group, plant something before trusting the green.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  chromaticToFifthsIndex,
  classifyDegreeChord,
  consonance,
  degreeChords,
  fifthsIndexToChromatic,
  pcsToBitmask,
  romanNumeral,
  scaleFamily,
} from "../dist/pcs.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = join(HERE, "pcs-families.json");
const doc = JSON.parse(readFileSync(FILE, "utf8"));

const round = (x) => Number(x.toFixed(6));

// ── families ───────────────────────────────────────────────────────────────
//
// Every k at three roots rather than mostly at C: `scaleFamily` adds the root
// to each interval and takes it mod 12, so a root that wraps the set past B is
// where an off-by-one would show, and every existing case starts at 0.

const FAMILY_NAMES = {
  3: "augmented", 4: "diminished seventh", 5: "major pentatonic",
  6: "whole tone", 7: "major scale", 8: "octatonic (half-whole)",
};

const families = [];
for (const k of [3, 4, 5, 6, 7, 8]) {
  for (const root of [0, 5, 11]) {
    const pcs = scaleFamily(k, root);
    families.push({ k, root, pcs, bitmask: pcsToBitmask(pcs), name: FAMILY_NAMES[k] });
  }
}
// The refusals are part of the contract too.
for (const k of [2, 9]) {
  families.push({ k, root: 0, pcs: scaleFamily(k, 0), bitmask: pcsToBitmask(scaleFamily(k, 0)),
                  name: "outside k=3..8" });
}

// ── degreeChords ───────────────────────────────────────────────────────────
//
// The whole result, not only the numerals: which pitch classes each degree
// stacks, what the classifier calls it, and the bitmask. `sus` had no case at
// all, and it is the one stacking whose offsets are not thirds.

const SCALES = [
  { scale: "C major", k: 7, root: 0 },
  { scale: "F major", k: 7, root: 5 },
  { scale: "C whole tone", k: 6, root: 0 },
  { scale: "C octatonic (half-whole)", k: 8, root: 0 },
  { scale: "C major pentatonic", k: 5, root: 0 },
];

const chords = [];
for (const { scale, k, root } of SCALES) {
  for (const type of ["triads", "sus", "sevenths"]) {
    const stacked = degreeChords(scaleFamily(k, root), type);
    chords.push({
      scale, k, root, type,
      numerals: stacked.map((c) => c.numeral),
      degrees: stacked.map((c) => ({
        degree: c.degree,
        rootPc: c.rootPc,
        pcs: c.pcs,
        bitmask: c.bitmask,
        quality: c.info.quality,
        chordRoot: c.info.root,
        name: c.info.name,
      })),
    });
  }
}

// ── fifths ─────────────────────────────────────────────────────────────────

const fifths = Array.from({ length: 12 }, (_, i) => ({
  index: i,
  chromatic: fifthsIndexToChromatic(i),
  backToIndex: chromaticToFifthsIndex(fifthsIndexToChromatic(i)),
}));

// ── consonance ─────────────────────────────────────────────────────────────
//
// Chosen to span the range and to pin the edges rather than to sample it: the
// mean is over interval CLASSES, so a set and its inversion score the same, and
// a set with fewer than two distinct pitch classes is trivially 1.

const CONSONANCE_SETS = [
  { pcs: [0, 4, 7], note: "major triad" },
  { pcs: [0, 3, 7], note: "minor triad — same interval classes as the major" },
  { pcs: [0, 4, 8], note: "augmented" },
  { pcs: [0, 3, 6], note: "diminished" },
  { pcs: [0, 5, 7], note: "sus4" },
  { pcs: [0, 4, 7, 11], note: "major seventh" },
  { pcs: [0, 4, 7, 10], note: "dominant seventh" },
  { pcs: [0, 2, 4, 5, 7, 9, 11], note: "major scale" },
  { pcs: [0, 1, 2], note: "chromatic cluster — the dark end" },
  { pcs: [0, 6], note: "tritone alone" },
  { pcs: [0, 7], note: "fifth alone — the bright end" },
  { pcs: [0], note: "one pitch class is trivially consonant" },
  { pcs: [], note: "and so is none" },
  { pcs: [0, 12, 24], note: "octave equivalence: three Cs are one pitch class" },
];

const consonanceCases = CONSONANCE_SETS.map(({ pcs, note }) => ({
  pcs, note, value: round(consonance(pcs)),
}));

// ── classify ───────────────────────────────────────────────────────────────
//
// classifyDegreeChord on its own, away from a scale. It searches every member
// as a candidate root and prefers sevenths over triads, so the interesting
// cases are the ones with more than one plausible reading and the ones with
// none.

const CLASSIFY_SETS = [
  { pcs: [0, 4, 7], note: "root position" },
  { pcs: [4, 7, 0], note: "same set, written in another order" },
  { pcs: [4, 7, 12], note: "and with an octave in it" },
  { pcs: [0, 3, 7], note: "minor" },
  { pcs: [0, 3, 6], note: "diminished" },
  { pcs: [0, 4, 8], note: "augmented — symmetrical, so the root it picks is a choice" },
  { pcs: [0, 5, 7], note: "sus4" },
  { pcs: [0, 4, 7, 11], note: "sevenths are tried before triads" },
  { pcs: [0, 3, 6, 9], note: "dim7 — every member is an equally good root" },
  { pcs: [0, 3, 7, 11], note: "minMaj7" },
  { pcs: [0, 3, 6, 10], note: "half-diminished" },
  { pcs: [0, 1, 2], note: "no reading — falls back to 'set'" },
  { pcs: [0, 4], note: "fewer than three has no reading at all" },
  { pcs: [0, 2, 4, 5, 7, 9, 11], note: "a whole scale is a set, not a chord" },
];

const classify = CLASSIFY_SETS.map(({ pcs, note }) => {
  const info = classifyDegreeChord(pcs);
  return { pcs, note, quality: info.quality, root: info.root, name: info.name };
});

// ── numerals ───────────────────────────────────────────────────────────────
//
// romanNumeral is display, and display is where two implementations diverge
// without anybody noticing, because nothing downstream reads it.

const numerals = [];
for (let degree = 0; degree < 8; degree++) {
  for (const quality of ["maj", "min", "dim", "aug", "sus4", "maj7", "7",
                          "min7", "halfDim7", "dim7", "minMaj7", "set", null]) {
    numerals.push({ degree, quality, numeral: romanNumeral(degree, quality) });
  }
}

doc.description =
  "Cross-language vectors for Euclidean scale families, degree chords, the "
  + "circle-of-fifths mapping, set consonance and the degree-chord classifier — "
  + "ported from PickPCS. Bitmask convention: leftmost = LSB, pitch class i "
  + "contributes 2^i ([0,4,7] = 145). Widened from seven families and three "
  + "numeral lists when the PCS engine was ported to Swift for PitchFold: "
  + "consonance and classifyDegreeChord had no coverage at all, and degreeChords "
  + "was checked only by the strings it prints. Regenerate with "
  + "gen-pcs-vectors.mjs; do not hand-edit.";
doc.families = families;
doc.degreeChords = chords;
doc.fifths = fifths;
doc.consonance = consonanceCases;
doc.classify = classify;
doc.numerals = numerals;

writeFileSync(FILE, JSON.stringify(doc, null, 1) + "\n");
console.log(`wrote ${FILE}`);
console.log(`  families ${families.length}, degreeChords ${chords.length}, `
            + `fifths ${fifths.length}, consonance ${consonanceCases.length}, `
            + `classify ${classify.length}, numerals ${numerals.length}`);
