#!/usr/bin/env node
/**
 * gen-pcs-select-vectors — write vectors/pcs-select.json.
 *
 *   npm run build -w @enkerli/theory && node packages/theory/vectors/gen-pcs-select-vectors.mjs
 *
 * Same discipline as gen-pcs-vectors.mjs: every expected value is computed by
 * the built reference (dist/pcsSelect.js), so the JSON cannot disagree with
 * @enkerli/theory. The *musical* anchors are asserted here before writing —
 * C Ionian = 2741 = octal "5625", Lydian is the lighter neighbour of Ionian,
 * C major's R is A minor, the whole-tone period is 2 — so a regression in
 * the reference cannot quietly regenerate itself into the vectors.
 *
 * Who reads this file: every port of PCS selection (Lua for FM-1/mvane-yard,
 * C++, Littlefoot for a Lightpad, Swift). A port that passes these cases
 * agrees with the suite on bit order, digit order and every move.
 *
 * Bit order: leftmost = LSB, pc i = bit i (CONVENTIONS.md). Octal digits in
 * tap order, first digit = pcs 0–2.
 *
 * ── Made to fail before the green was believed (2026-11-26) ────────────────
 *
 * Five divergences planted in pcsSelect.ts, each caught by the committed JSON:
 *
 *   · octal digits in reverse (MSB-first) order        → 11 failures
 *   · lighter/darker swapped in parallelModeStep       → 5
 *   · L transposing by 3 instead of 4                  → 3
 *   · a "beat" cue waiting for the bar                 → 1
 *   · the octave-closing interval step dropped         → 6
 *
 * All reverted. If you add a group, plant something before trusting it.
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import * as S from "../dist/pcsSelect.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = join(HERE, "pcs-select.json");

const m = (pcs) => pcs.reduce((a, pc) => a | (1 << pc), 0);

// ── Named sets (context-free PCS names, chromatic — CONVENTIONS.md) ─────────
const SETS = [
  ["empty", []],
  ["{C}", [0]],
  ["{B}", [11]],
  ["chromatic", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]],
  ["C major triad", [0, 4, 7]],
  ["C Ionian", [0, 2, 4, 5, 7, 9, 11]],
  ["C Lydian", [0, 2, 4, 6, 7, 9, 11]],
  ["F Ionian", [5, 7, 9, 10, 0, 2, 4]],
  ["C harmonic minor", [0, 2, 3, 5, 7, 8, 11]],
  ["C major pentatonic", [0, 2, 4, 7, 9]],
  ["whole tone (C)", [0, 2, 4, 6, 8, 10]],
  ["octatonic half-whole (C)", [0, 1, 3, 4, 6, 7, 9, 10]],
];

// Anchors — refuse to write if the reference has drifted.
assert.equal(S.maskFromOctal("5625"), 2741, "C Ionian must be octal 5625 = 2741");
assert.equal(S.maskToOctal(m([0, 2, 4, 6, 7, 9, 11])), "5235", "C Lydian must be 5235");
assert.equal(S.parallelModeStep({ mask: 2741, root: 0 }, 1).mask, 2773, "Ionian, one lighter, is Lydian");
assert.deepEqual(S.riemann(145, "R"), { mask: m([9, 0, 4]), root: 9 }, "R(C) = a");
assert.equal(S.transpositionPeriod(m([0, 2, 4, 6, 8, 10])), 2, "whole tone has 2 transpositions");

// ── octal ───────────────────────────────────────────────────────────────────
const octal = SETS.map(([name, pcs]) => {
  const mask = m(pcs);
  return { name, pcs: S.maskToPcs(mask), mask, digits: S.maskToOctalDigits(mask), octal: S.maskToOctal(mask) };
});

// Tap sequences, including a backspace, through the entry state machine.
function runOctal(taps) {
  let entry = S.EMPTY_OCTAL_ENTRY;
  const masks = [];
  for (const t of taps) {
    if (t === "⌫") { entry = S.octalEntryBackspace(entry); masks.push(null); continue; }
    const r = S.octalEntryTap(entry, t);
    entry = r.entry;
    masks.push(r.mask);
  }
  return { taps, masks, pending: entry.digits };
}
const octalEntry = [
  runOctal([5, 6, 2, 5]),
  runOctal([5, 6, 2, 5, 5, 2, 3, 5]),
  runOctal([5, 6, 7, "⌫", 2, 5]),
  runOctal([0, 0, 0]),
];

// ── two-page ────────────────────────────────────────────────────────────────
function runTwoPage(taps) {
  let mask = 0;
  for (const [page, pad] of taps) mask = S.twoPageToggle(mask, page, pad);
  return { taps, mask, page0: S.twoPagePads(mask, 0), page1: S.twoPagePads(mask, 1) };
}
const twoPage = [
  runTwoPage([[0, 0], [0, 2], [0, 4], [0, 5], [0, 7], [1, 1], [1, 3]]), // C Ionian
  runTwoPage([[0, 0], [0, 0]]), // toggles off
  runTwoPage([[1, 4], [1, 7], [0, 1]]), // unused pads are ignored
];

// ── intervals ───────────────────────────────────────────────────────────────
const intervals = [
  ...[["C Ionian", 2741, 0], ["F Ionian", m([5, 7, 9, 10, 0, 2, 4]), 5], ["C major triad", 145, 0],
      ["C major triad from E", 145, 4], ["{C}", 1, 0], ["C major triad from D (absent)", 145, 2]]
    .map(([name, mask, root]) => ({ name, mask, root, steps: S.maskToIntervals(mask, root) })),
];
function runIntervals(root, pads) {
  let entry = { root, steps: [] };
  const results = [];
  for (const p of pads) {
    const r = S.intervalEntryTap(entry, p);
    entry = r.entry;
    results.push({ mask: r.mask, refused: r.refused });
  }
  return { root, pads, results, pending: entry.steps };
}
const intervalEntry = [
  runIntervals(0, [1, 1, 0, 1, 1, 1, 0]), // steps 2 2 1 2 2 2 1 → C Ionian
  runIntervals(9, [2, 3, 4]), // steps 3, 4, 5 from A → A minor triad {9,0,4}
  runIntervals(0, [7, 7, 3]), // 8, then 8 refused, then 4 completes {0,8}
];

// ── transposition ───────────────────────────────────────────────────────────
const transpose = [
  [2741, 0, 7], [2741, 0, -1], [145, 0, 11], [m([0, 2, 4, 6, 8, 10]), 0, 2], [1, 0, 12],
].map(([mask, root, n]) => ({ from: { mask, root }, n, to: S.transposeState({ mask, root }, n) }));

const periods = [
  ...SETS,
  ["augmented triad", [0, 4, 8]],
  ["diminished seventh", [0, 3, 6, 9]],
  ["tritone dyad", [0, 6]],
  ["Messiaen mode 3", [0, 2, 3, 4, 6, 7, 8, 10, 11]],
  ["Messiaen mode 4", [0, 1, 2, 5, 6, 7, 8, 11]],
].map(([name, pcs]) => {
  const mask = m(pcs);
  return { name, mask, period: S.transpositionPeriod(mask), transpositions: S.distinctTranspositions(mask) };
});

// ── modes ───────────────────────────────────────────────────────────────────
const parallel = [
  ["C Ionian", 2741, 0], ["C harmonic minor", m([0, 2, 3, 5, 7, 8, 11]), 0],
  ["C major pentatonic", m([0, 2, 4, 7, 9]), 0], ["whole tone (C)", m([0, 2, 4, 6, 8, 10]), 0],
  ["C major triad from D (absent)", 145, 2],
].map(([name, mask, root]) => {
  const modes = S.parallelModes({ mask, root });
  return { name, mask, root, modes, brightness: modes.map((x) => S.modeBrightness(x, root)) };
});

const parallelSteps = [
  [2741, 0, 1, false], [2741, 0, -1, false], [m([0, 2, 4, 6, 7, 9, 11]), 0, 1, false],
  [m([0, 2, 4, 6, 7, 9, 11]), 0, 1, true], [m([0, 1, 3, 5, 6, 8, 10]), 0, -1, true],
].map(([mask, root, dir, wrap]) => ({ from: { mask, root }, dir, wrap, to: S.parallelModeStep({ mask, root }, dir, wrap) }));

const relative = [
  [2741, 0, 1], [2741, 0, -1], [2741, 11, 1], [145, 2, 1], [0, 3, 1],
].map(([mask, root, dir]) => ({ from: { mask, root }, dir, to: S.relativeMode({ mask, root }, dir) }));

// ── Riemann ─────────────────────────────────────────────────────────────────
const riemann = [];
for (const [name, mask] of [["C major", 145], ["A minor", m([9, 0, 4])], ["F♯ major", m([6, 10, 1])],
                            ["E♭ minor", m([3, 6, 10])], ["C Ionian (not a triad)", 2741]]) {
  for (const op of ["P", "L", "R"]) riemann.push({ name, mask, op, to: S.riemann(mask, op) });
}

// ── parsimony ───────────────────────────────────────────────────────────────
const parsimony = [["C major triad", 145], ["C Ionian", 2741], ["{C}", 1], ["chromatic", 4095]]
  .map(([name, mask]) => ({ name, mask, neighbours: S.parsimoniousNeighbours(mask) }));

// ── cueing ──────────────────────────────────────────────────────────────────
// A script of events; after each, the expected current/next state.
const C = { mask: 2741, root: 0 };
const G = { mask: S.rotateMask(2741, 7), root: 7 };
const Dd = { mask: 2741, root: 2 };
function runCue(events) {
  let cs = S.cueState(C);
  const after = [];
  for (const e of events) {
    if (e.cue) cs = S.cue(cs, e.cue, e.at);
    else if (e.cancel) cs = S.cancelCue(cs);
    else cs = S.crossBoundary(cs, e.boundary).state;
    after.push({ current: cs.current, next: cs.next, at: cs.at });
  }
  return { start: C, events, after };
}
const cueing = [
  runCue([{ cue: G, at: "bar" }, { boundary: "beat" }, { boundary: "beat" }, { boundary: "bar" }]),
  runCue([{ cue: G, at: "loop" }, { boundary: "bar" }, { cue: Dd, at: "loop" }, { boundary: "loop" }]),
  runCue([{ cue: G, at: "beat" }, { boundary: "loop" }]),
  runCue([{ cue: G, at: "bar" }, { cancel: true }, { boundary: "bar" }]),
  runCue([{ cue: G, at: "now" }]),
];

const doc = {
  description:
    "Cross-language vectors for PCS selection (src/pcsSelect.ts): octal / two-page / interval entry, " +
    "transposition and limited transposition, relative and parallel modes (light ↔ dark), neo-Riemannian " +
    "P/L/R, parsimonious neighbours, and quantised cueing. Bit order: leftmost = LSB, pc i = bit i " +
    "(C Ionian = 2741; 2773 is C Lydian). Octal digits in tap order, first digit = pcs 0–2. " +
    "Regenerate with gen-pcs-select-vectors.mjs; do not hand-edit.",
  octal, octalEntry, twoPage, intervals, intervalEntry,
  transpose, periods, parallel, parallelSteps, relative, riemann, parsimony, cueing,
};
writeFileSync(FILE, JSON.stringify(doc, null, 1) + "\n");
console.log(`wrote ${FILE}`);
