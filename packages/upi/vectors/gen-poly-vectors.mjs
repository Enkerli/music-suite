#!/usr/bin/env node
// gen-poly-vectors — emit packages/upi/vectors/poly.json from parsePolyUPI,
// the cross-language contract for Serpe's poly-lane notation (docs/
// SERPE_POLY.md §8 milestone 1: "C++ UPIParser lanes... conformance-locked
// against the JS vectors, the same cross-language ritual as the rhythm
// codecs"). Scope matches that milestone: lane SPLITTING (labels, offsets,
// lcm) and each lane's step pattern — not the full accent-cycling surface,
// which is unchanged, already-mono-tested territory.
//
//   node packages/upi/vectors/gen-poly-vectors.mjs
//
// Commit the regenerated file; poly.test.js asserts it stays reproduced.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parsePolyUPI } from "../src/poly.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "poly.json");

// Leftmost = LSB, everywhere: join the 0/1 step array in index order is
// exactly the suite's left-to-right bit-string convention.
const bits = (steps) => steps.join("");

const CASES = [
  "E(4,16) / E(3,8) / {10}E(2,3)",
  "kick=E(4,16) / snare=E(2,4)@+12ms / hat={10}E(8,16)@-1/64",
  "E(3,8)@-6",
  "E(3,8)@-1/64",
  "{100}E(3,8);12",
  "E(2,3) / E(4,16)",
  "kick=E(4,16)@+1/32 / snare=E(2,4)",
  "E(3,8)@+51ms",
  "E(3,8)@+1/4",
  "kick=E(4,16) / snare=nonsense(((",
  "P(3,1)+P(5,0)",
];

const cases = CASES.map((input) => {
  const p = parsePolyUPI(input);
  if (!p.ok) return { input, ok: false };
  return {
    input,
    ok: true,
    lcm: p.lcm,
    lanes: p.lanes.map((l) => ({
      label: l.label,
      steps: bits(l.steps),
      offset: l.offset,
    })),
  };
});

const doc = {
  description:
    "Cross-language vectors for Serpe's poly-lane notation (docs/SERPE_POLY.md), " +
    "ported to C++ UPIParser lanes. Scope: lane splitting (top-level '/', atomic " +
    "'@' offset tokens), labels (explicit 'name=' or default 'laneN'), per-lane " +
    "offset (ms or note-value fraction, both units' out-of-range clamps), and the " +
    "resulting lcm. Steps are bit-strings, leftmost = LSB (suite-wide convention: " +
    "first character is step 0). Accent-pattern cycling is out of scope here — " +
    "unchanged, already-conformant mono-grammar territory.",
  cases,
};

writeFileSync(OUT, JSON.stringify(doc, null, 2) + "\n");
console.log(`wrote ${OUT} (${cases.length} cases)`);
