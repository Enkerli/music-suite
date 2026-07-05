#!/usr/bin/env node
// Regenerate vectors/protocol.json — the cross-language frame contract
// (the future enkerli-juce C++ shim must reproduce these bytes exactly).
// Run from the monorepo root AFTER building packages:
//   node packages/protocol/vectors/gen-protocol-vectors.mjs
// Deterministic: fixed ids, timestamps, and msgIds; no randomness.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { encodeMessage } from "../dist/index.js";

const CASES = [
  {
    name: "scale push: C major (mask 2741 = 0xAB5, leftmost = LSB)",
    msgId: 1,
    message: {
      protocol: "enkerli-suite", v: 1, id: "vec-scale-cmajor",
      from: "pickpcs", to: "pitchfold", sentAt: "2026-07-05T12:00:00Z",
      type: "scale", body: { mask: 2741, root: 0, name: "C major" },
    },
  },
  {
    name: "scale push with unicode: E♭ major (multibyte UTF-8 through pack7)",
    msgId: 2,
    message: {
      protocol: "enkerli-suite", v: 1, id: "vec-scale-eflat",
      from: "pickpcs", to: "*", sentAt: "2026-07-05T12:00:00Z",
      type: "scale", body: { mask: 1715, root: 3, name: "E♭ major" },
    },
  },
  {
    name: "pattern: tresillo over 8 steps (mask 73, leftmost = LSB)",
    msgId: 3,
    message: {
      protocol: "enkerli-suite", v: 1, id: "vec-pattern-tresillo",
      from: "serpe", to: "*", sentAt: "2026-07-05T12:00:00Z",
      type: "pattern", body: { steps: 8, mask: 73, name: "tresillo" },
    },
  },
  {
    name: "chord id broadcast",
    msgId: 4,
    message: {
      protocol: "enkerli-suite", v: 1, id: "vec-chord-cmaj7",
      from: "proggenie", to: "*", sentAt: "2026-07-05T12:00:00Z",
      type: "chord", body: { pcs: 2193, symbol: "Cmaj7", root: 0 },
    },
  },
  {
    name: "chunked: a progression split across frames (chunkBytes 96)",
    msgId: 5,
    chunkBytes: 96,
    message: {
      protocol: "enkerli-suite", v: 1, id: "vec-progression",
      from: "proggenie", to: "midicurator", sentAt: "2026-07-05T12:00:00Z",
      type: "progression",
      body: { prog: { key: "C major", sections: [{ bars: [["Dm7", "G7"], ["Cmaj7"]] }] } },
    },
  },
];

const vectors = CASES.map((c) => ({
  ...c,
  frames: encodeMessage(c.message, { msgId: c.msgId, chunkBytes: c.chunkBytes })
    .map((f) => [...f].map((b) => b.toString(16).padStart(2, "0")).join("")),
}));

const out = fileURLToPath(new URL("./protocol.json", import.meta.url));
writeFileSync(out, JSON.stringify(vectors, null, 2) + "\n");
console.log(`wrote ${out}: ${vectors.length} vectors, ${vectors.reduce((n, v) => n + v.frames.length, 0)} frames`);
