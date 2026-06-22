#!/usr/bin/env node
/**
 * gen-rhythm-codecs — extend vectors/rhythm.json's codec section in place.
 *
 * The codec vectors are the cross-language contract for numeric pattern
 * notation (binary / decimal / hex / octal / onset-array), leftmost = LSB
 * (first step = least significant bit; step k has value 2^k). They are consumed by:
 *   - this package's rhythm.test.ts (locks the reference impl),
 *   - the Serpe webapp's PatternConverter (Node conformance test),
 *   - the Serpe plugin's UPIParser/PatternUtils (C++ conformance test).
 *
 * Expected values are computed from the built reference (dist/rhythm.js) so the
 * committed JSON cannot disagree with @enkerli/theory. Run after `npm run build
 * -w @enkerli/theory`, then commit vectors/rhythm.json.
 *
 *   node packages/theory/vectors/gen-rhythm-codecs.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  patternFromBinaryString,
  patternToDecimal,
  patternToHex,
  patternToOctal,
} from "../dist/rhythm.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = join(HERE, "rhythm.json");

const onsets = (pattern) => {
  const out = [];
  pattern.split("").forEach((c, i) => { if (c === "1") out.push(i); });
  return out;
};

// Fill every numeric encoding for a binary pattern string from the reference.
const encode = (pattern) => {
  const p = patternFromBinaryString(pattern);
  return {
    pattern,
    steps: pattern.length,
    decimal: patternToDecimal(p),
    hex: patternToHex(p),
    octal: patternToOctal(p),
    onsets: onsets(pattern),
  };
};

// Deterministic PRNG (mulberry32) — a fixed seed makes the batch reproducible
// and identical across languages (the other impls read this committed JSON,
// they do not re-run the PRNG).
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A spread of step counts including non-nibble lengths and leading-rest cases.
function buildBatch() {
  const rand = mulberry32(0x5e72e); // "Serpe"-ish fixed seed
  const cases = [];
  for (let steps = 1; steps <= 24; steps++) {
    const perLen = steps <= 8 ? 4 : 6;
    for (let k = 0; k < perLen; k++) {
      let s = "";
      for (let i = 0; i < steps; i++) s += rand() < 0.4 ? "1" : "0";
      const v = encode(s);
      v.name = `batch ${steps}.${k}`;
      cases.push(v);
    }
  }
  return cases;
}

const doc = JSON.parse(readFileSync(FILE, "utf8"));

// 1) Add octal + onsets to the hand-curated named codec cases (kept verbatim
//    otherwise — they document the convention with human-readable names).
doc.codecs = doc.codecs.map((c) => {
  const e = encode(c.pattern);
  // sanity: the curated decimal/hex must already match the reference
  if (c.decimal !== e.decimal || c.hex !== e.hex)
    throw new Error(`curated codec case "${c.name}" disagrees with reference`);
  return { name: c.name, pattern: c.pattern, steps: e.steps, decimal: e.decimal, hex: e.hex, octal: e.octal, onsets: e.onsets };
});

// 2) Replace the generated batch (seeded, so stable across regenerations).
doc.codecBatch = buildBatch();

doc.description = doc.description.replace(/ Octal added.*$/, "") +
  " Octal added 2026-06-20; codecBatch is a seeded, reproducible set read identically by the webapp and plugin conformance suites.";

writeFileSync(FILE, JSON.stringify(doc, null, 2) + "\n");
console.log(`✓ vectors/rhythm.json — ${doc.codecs.length} named codec cases, ${doc.codecBatch.length} batch cases`);
