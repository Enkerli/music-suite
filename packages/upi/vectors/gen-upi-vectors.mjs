#!/usr/bin/env node
// gen-upi-vectors — emit packages/upi/vectors/upi.json, the cross-language
// contract for UPI *notation* and the readings taken over a parsed pattern.
//
//   node packages/upi/vectors/gen-upi-vectors.mjs
//
// Commit the regenerated file; upi.test.js asserts it stays reproduced.
//
// ── Why this exists ────────────────────────────────────────────────────────
//
// The suite's rule is "test vectors are the cross-language contract; any
// algorithm ported to Lua or C++ gets a JSON vector file here first"
// (CONVENTIONS.md). `@enkerli/theory`'s rhythm.json holds the *algorithms* —
// Bjorklund, Barlow tables, complement, the codecs — which is why a port of
// those is already honest. What it does not hold is the layer above: the
// notation. `parseUPI` is about 260 lines of grammar with a dozen forms in it,
// and until this file the whole of `@enkerli/upi`'s coverage was poly.json,
// 3.5 KB about lane splitting.
//
// MelGen's PORTING.md §5 says the same thing from the other side, about a
// planned Swift Serpe: "Write UPI vectors first, in the monorepo. One thin file
// is not enough to hold a port honest. This is a prerequisite for Swift Serpe
// and it pays off for the Lua/PdLua branch at the same time."
//
// ── Scope, and what is deliberately outside it ─────────────────────────────
//
// In: every deterministic `parseUPI` form, the analysis readings, the
// durational (long/short) reading, syncopation, recognition, progressive
// notation, and named-pattern import.
//
// Out, and each for a stated reason rather than by oversight:
//
//   · `R(k,n)` — random onsets from `Math.random`. A vector would pin nothing.
//   · `mutatePattern` — also `Math.random`; checked, not assumed: calling it
//     twice on one pattern gives two answers.
//   · the DOM visualisers — app-side by design (see index.js).
//
// Everything else here was checked to be reproducible before it was included.
//
// Steps are bit-strings, leftmost = LSB — the first character is step 0, per
// CONVENTIONS.md. That is the single thing a port in a new language will
// silently invert, so every pattern in this file is written that way and the
// hex cases are here to catch it: tresillo is `10010010` and `0x94`.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  parseUPI, parseProgressive, progressiveAt,
  analyse, analyzeSyncopation, longShort, durations, interOnsetSteps,
  identify, decompose, parseNamedPattern,
} from "../src/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "upi.json");

const bits = (steps) => (steps || []).map((s) => (s ? 1 : 0)).join("");
const round = (x, places = 6) =>
  typeof x === "number" && Number.isFinite(x)
    ? Number(x.toFixed(places))
    : x;

/* ── 1. Notation ──────────────────────────────────────────────────────────
 *
 * One case per form the grammar accepts, plus the places two forms meet: an
 * accent prefix on a quantized combination is three features at once and is
 * where a port's ordering assumptions show.
 */
const NOTATION = [
  // Euclidean, with and without rotation, and both degenerate densities.
  ["E(3,8)", "the tresillo, and the pattern every other case is checked against"],
  ["E(5,8)", "cinquillo"],
  ["E(5,16)", "the default Serpe loads with"],
  ["E(3,8,2)", "rotation is a third argument, not a separate operator"],
  ["E(3,8,-2)", "and it goes both ways"],
  ["E(0,8)", "no onsets is a pattern, not an error"],
  ["E(8,8)", "and so is every step"],
  ["E(9,8)", "more onsets than steps — saturates rather than failing"],

  // Polygons. The third argument is an EXPANSION FACTOR, not a step count;
  // that reading was a real bug and the note in upi.js explains it.
  ["P(3,0)", "a bare k-gon is k steps — its own resolution, not ctx.n"],
  ["P(3,1)", "offset"],
  ["P(5,0)", ""],
  ["P(3,1,4)", "triangle x4 — 12 steps, still exactly even"],
  ["P(7,2)", "seven steps, not sixteen"],

  // Barlow family. D is the anti-Euclidean (Dilcue).
  ["B(3,8)", "concentrate to 3 by indispensability, from the downbeat"],
  ["W(3,8)", "Wolrab — the same, anti-indispensability"],
  ["D(3,8)", "Dilcue — complement of E(n-k,n)"],

  // Additive / aksak: beat groups, one onset each.
  ["A(2,2,2,3)", "aksak 9/8"],
  ["A(3,3,2)", ""],

  // Morse. Checked before combination, because Morse uses '-'.
  ["M:...-", "explicit prefix"],
  [".-", "a bare dot-dash string"],
  ["sos", "a bare letter word"],
  ["D:1,3 -.-", "custom durations, the webapp's spelling"],
  ["L:1,3 -.-", "and the C++ engine's — both accepted in both, which the "
              + "divergence between them used to cost real confusion"],

  // Combination. The all-polygon rule and the general projection rule are two
  // different code paths that have to agree on P(3,0)+P(5,0).
  ["P(3,0)+P(5,0)", "polygons land on lcm(3,5)=15"],
  ["P(3,1)+P(5,0)+P(2,5)", "perfectly balanced across 30 — only because each "
                         + "polygon spans the cycle once"],
  ["E(3,8)+P(3,0)", "a shape and a pattern, projected rather than tiled"],
  ["E(3,8)-E(2,8)", "subtraction"],
  ["E(3,8)+2", "REFUSED, and deliberately: a numeric term is a progressive "
           + "offset, handled by the progressive layer, not a combination"],

  // Quantization (Lascabettes angular), clockwise and counter.
  ["E(3,8);12", ""],
  ["E(3,8);-12", "counter-clockwise"],
  ["P(3,0);8", "a triangle on an eight-step grid"],
  ["tresillo;12", "shorthand resolves before quantization"],

  // Accents cycle over ONSETS, not steps.
  ["{10}E(3,8)", "three onsets, a two-long accent cycle: 1,0,1"],
  ["{100}E(3,8);12", "accent prefix over a quantized base"],
  ["{1011}E(5,16)", ""],

  // Numeric forms. These are the ones that invert in a careless port.
  ["0x94", "tresillo — hex digits little-endian, first step's nibble leftmost"],
  ["0x94:8", "explicit width, same answer"],
  ["0x49", "the SAME digits read the other way round are a different pattern, "
         + "which is what the convention is for"],
  ["0x1:4", "step 0 alone"],
  ["o111:8", "tresillo in octal — digits little-endian too"],
  ["o111", "and without a width it is 9 steps, not 8: the width comes from the "
         + "digit count (3 bits each), so the pattern gains a rest"],
  ["o222", "not a tresillo — 0o222 sets bits 1,4,7, so this is the tresillo "
         + "rotated by one over 9 steps. Here because it is the shape of "
         + "mistake a port makes and then cannot see"],
  ["d73", "73 is tresillo's value, but the width is its bit length, so this is "
        + "7 steps and the pattern has lost its final rest"],
  ["d73:8", "which is why a decimal form usually wants an explicit width"],
  ["[0,3,6]:8", "onset indices"],
  ["[0,3,6]", "width from the largest index"],
  ["10010010", "a bare bit-string is itself"],
  ["b10010010", "and the b prefix is optional"],

  // Shorthand names.
  ["tresillo", ""],
  ["cinquillo", ""],
  ["tri", "P(3,0)"],
  ["hept", "P(7,0)"],

  // The two suffixes, stripped before anything else parses.
  ["E(3,8) LS(1..3,50%)", "durational suffix"],
  ["E(8,16) LS(1..2){1010}", "which onsets are long, for a grid whose own "
                           + "intervals cannot say"],
  ["E(3,8) PD(20%)", "microtiming"],
  ["E(3,8) PD(20%, 7)", "with a seed"],

  // Refusals. A parser's failures are part of its contract.
  ["nonsense(((", "unparseable"],
  ["", "empty"],
  ["E(3,)", "malformed arguments fall through to the bit-string matcher and fail"],
];

const notation = NOTATION.map(([input, note]) => {
  const p = parseUPI(input);
  const row = { input, ok: !!p.ok };
  if (note) row.note = note;
  if (!p.ok) {
    // The parser returns a fallback pattern on failure, deliberately, so a live
    // UI has something to draw. The contract is `ok:false` and the error text's
    // existence — not the fallback, which a port is free to choose differently.
    row.error = typeof p.error === "string" ? p.error : true;
    return row;
  }
  row.steps = bits(p.steps);
  row.label = p.label;
  if (p.accentPattern) row.accentPattern = bits(p.accentPattern);
  if (p.accents && p.accents.some(Boolean)) row.accents = bits(p.accents);
  if (p.longs) row.longs = bits(p.longs);
  if (p.longShort) row.longShort = p.longShort;
  if (p.microtiming) row.microtiming = p.microtiming;
  return row;
});

/* ── 2. Analysis ─────────────────────────────────────────────────────────── */
const ANALYSIS_PATTERNS = [
  "E(3,8)", "E(5,8)", "E(5,16)", "E(4,16)", "P(3,0)", "P(3,1)+P(5,0)",
  "P(3,1)+P(5,0)+P(2,5)", "10000000", "11111111", "A(2,2,2,3)", "[0,1,2,3]:16",
];

const analysis = ANALYSIS_PATTERNS.map((input) => {
  const p = parseUPI(input);
  const a = analyse(p.steps);
  return {
    input,
    steps: bits(p.steps),
    n: a.n,
    k: a.k,
    density: round(a.density),
    onsets: a.onsets,
    intervals: a.intervals,
    evenness: round(a.evenness),
    balanced: a.balanced,
    cog: { magnitude: round(a.cog.magnitude), angleSteps: round(a.cog.angleSteps) },
    binary: a.binary,
    hex: a.hex,
    decimal: a.decimal,
  };
});

/* ── 3. The durational reading ───────────────────────────────────────────── */
const longShortCases = ["E(3,8)", "E(5,8)", "E(5,16)", "E(8,16)", "A(2,2,2,3)",
                        "P(3,0)", "10000000"].map((input) => {
  const p = parseUPI(input);
  const ls = longShort(p.steps);
  return {
    input,
    steps: bits(p.steps),
    intervals: ls.intervals,
    short: ls.short,
    long: ls.long,
    ratio: round(ls.ratio),
    types: ls.types,
    pattern: ls.pattern,
    morse: ls.morse,
    foot: ls.foot,
    isochronous: ls.isochronous,
    durations: durations(p.steps).map((d) => round(d)),
    // What one onset owns, which is what a gate length is measured against.
    interOnsetSteps: p.steps.map((_, i) => (p.steps[i] ? interOnsetSteps(p.steps, i) : null))
      .filter((v) => v !== null),
  };
});

/* ── 4. Syncopation ───────────────────────────────────────────────────────
 *
 * `@enkerli/theory`'s rhythm.json has a `syncopation` group, and it is a
 * different measure: one number, weighted note-to-beat. This is Serpe's own
 * six-way readout, and the two must not be confused for each other.
 */
const syncopation = ["E(3,8)", "E(5,8)", "10000000", "01010101", "E(5,16)",
                     "A(2,2,2,3)"].map((input) => {
  const p = parseUPI(input);
  const s = analyzeSyncopation(p.steps, p.steps.length);
  return {
    input,
    steps: bits(p.steps),
    weightedNoteToBeats: round(s.weightedNoteToBeats, 3),
    offBeatRatio: round(s.offBeatRatio, 3),
    expectancyViolation: round(s.expectancyViolation, 3),
    rhythmicDisplacement: round(s.rhythmicDisplacement, 3),
    crossRhythmic: round(s.crossRhythmic, 3),
    barlowIndispensability: round(s.barlowIndispensability, 3),
    overallSyncopation: round(s.overallSyncopation, 3),
    level: s.level,
  };
});

/* ── 5. Recognition — the other direction ────────────────────────────────── */
const recognition = ["E(3,8)", "E(5,16)", "P(3,0)", "P(3,1)+P(5,0)",
                     "10010010", "10110110", "10001001", "11111111"].map((input) => {
  const p = parseUPI(input);
  const id = identify(p.steps);
  const dec = decompose(p.steps);
  return {
    input,
    steps: bits(p.steps),
    euclidean: id.euclidean ? { beats: id.euclidean.beats, steps: id.euclidean.steps,
                                offset: id.euclidean.offset, formula: id.euclidean.formula } : null,
    barlow: id.barlow ? { formula: id.barlow.formula } : null,
    best: id.best ? { formula: id.best.formula, exact: id.best.exact } : null,
    decomposeCount: Array.isArray(dec) ? dec.length : (dec?.readings?.length ?? 0),
  };
});

/* ── 6. Progressive notation ──────────────────────────────────────────────
 *
 * Stateful in the engine, pure here: `progressiveAt(desc, n)` derives the state
 * from the trigger index rather than storing it. Trigger 1 is the bare base in
 * every form — that was three code paths that disagreed by one character until
 * it was settled base-first, so it is exactly the kind of thing a port gets
 * wrong quietly. The `*N` lengthening is seeded FROM THE BASE PATTERN, which is
 * what makes it reproducible enough to appear here at all.
 */
const PROGRESSIVE = ["E(3,8)>8", "E(3,8)%4", "E(3,8)+2", "E(3,8)*2", "E(5,16)+3"];
const progressive = PROGRESSIVE.map((source) => {
  const desc = parseProgressive(source);
  const at = [1, 2, 3, 5].map((n) => {
    const r = progressiveAt(desc, n, { parseBase: (s) => parseUPI(s) });
    return { trigger: n, steps: bits(r.steps), label: r.label };
  });
  return { input: source, kind: desc?.kind ?? null, base: desc?.base ?? null,
           type: desc?.type ?? null, target: desc?.target ?? null,
           step: desc?.step ?? null, at };
});

/* ── 7. Named-pattern import ─────────────────────────────────────────────── */
const named = [
  "Fume-Fume: [0,2,4,7,9]/12",
  "Tresillo: 10010010",
  "Bembe: [0,2,4,5,7,9,11]/12",
  "not a named pattern",
].map((line) => {
  // It throws on a malformed line rather than returning `{ok:false}`, unlike
  // parseUPI. That inconsistency is real and is part of the contract until
  // somebody decides otherwise, so the vector records it as such.
  try {
    const r = parseNamedPattern(line);
    return { line, ok: true, name: r.name, steps: bits(r.steps) };
  } catch (e) {
    return { line, ok: false, throws: true };
  }
});

const doc = {
  description:
    "Cross-language vectors for @enkerli/upi — Serpe's UPI notation and the "
    + "readings taken over a parsed pattern. @enkerli/theory's rhythm.json holds "
    + "the algorithms (Bjorklund, Barlow tables, complement, codecs); this holds "
    + "the layer above them, which had no coverage beyond poly.json. Steps are "
    + "bit-strings, leftmost = LSB: the first character is step 0, hex digits are "
    + "little-endian, and tresillo is 10010010 = 0x94 = d73. That convention is "
    + "the single thing a port into a new language silently inverts, which is why "
    + "the numeric forms are here. Out of scope, deliberately: R(k,n) and "
    + "mutatePattern, both of which draw from Math.random and would pin nothing; "
    + "and the DOM visualisers, which are app-side by design. Regenerate with "
    + "gen-upi-vectors.mjs; upi.test.js asserts this file stays reproduced.",
  groups: {
    notation,
    analysis,
    longShort: longShortCases,
    syncopation,
    recognition,
    progressive,
    named,
  },
};

writeFileSync(OUT, JSON.stringify(doc, null, 1) + "\n");
const counts = Object.entries(doc.groups)
  .map(([k, v]) => `${k} ${v.length}`).join(", ");
console.log(`wrote ${OUT}`);
console.log(`  ${counts}`);
