#!/usr/bin/env node
/**
 * Regenerate Serpe's MicrotimingVectors.h from packages/upi/src/microtiming.js.
 *
 * The header has always said "regenerate when the JS changes" — but there was
 * nothing to regenerate it WITH, so the first time the model changed (raising
 * maxShift) the instruction was unfollowable. This is that script.
 *
 *   node scripts/gen-microtiming-vectors.mjs > \
 *     ../rhythm_pattern_explorer/Source/Tests/MicrotimingVectors.h
 *
 * Then rebuild and run serpe_microtiming_conformance. A red result after a
 * deliberate change to the model is the tool working: it means the C++ has not
 * been updated to match, and the plugin would feel different from the browser.
 *
 * The vector set is deliberately small and hand-chosen rather than exhaustive:
 * an aksak bar (odd length, uneven anchors), a tresillo (the canonical 8), a
 * dense 12, and a saturating case at depth 1 that pins the CLAMP itself.
 */
import { microtiming, timingScales } from "../packages/upi/src/microtiming.js";

const CASES = [
  { binary: "101010100", depth: 0.6, seed: 7, pass: 0 },
  { binary: "101010100", depth: 0.9, seed: 1, pass: 0 },
  { binary: "101010100", depth: 0.9, seed: 1, pass: 1 },
  { binary: "10010010", depth: 0.5, seed: 3, pass: 0 },
  { binary: "101011010101", depth: 0.75, seed: 42, pass: 2 },
  { binary: "10101010", depth: 1, seed: 9, pass: 0 },
];

const num = (x) => x.toFixed(9);
const list = (xs) => `{ ${xs.map(num).join(", ")} }`;

const rows = CASES.map(({ binary, depth, seed, pass }) => {
  const steps = binary.split("").map((c) => c === "1");
  const shift = microtiming(steps, { depth, seed, pass });
  const scales = timingScales(shift);
  return `    { "${binary}", ${depth}, ${seed}, ${pass},\n` +
         `      ${list(shift)},\n` +
         `      ${list(scales)} },`;
}).join("\n");

process.stdout.write(`/*
    MicrotimingVectors.h — generated from music-suite
    packages/upi/src/microtiming.js. DO NOT hand-edit: regenerate with
    music-suite/scripts/gen-microtiming-vectors.mjs when the JS changes, so
    the plugin and the webapp can never drift apart in feel.
*/
#pragma once
#include <vector>

struct MicrotimingVector {
    const char* binary;
    double depth; int seed; int pass;
    std::vector<double> shift;
    std::vector<double> scales;
};

// Generated from packages/upi/src/microtiming.js — the C++ must match exactly.
static const MicrotimingVector kMicrotimingVectors[] = {
${rows}
};
`);
