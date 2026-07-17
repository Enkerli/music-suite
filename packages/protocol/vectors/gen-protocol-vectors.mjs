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
  // ── control & interop plane (docs/CONTROL_PLANE.md) ──
  {
    name: "manifest: Serpe declares its addressable surface",
    msgId: 6,
    chunkBytes: 200,
    message: {
      protocol: "enkerli-suite", v: 1, id: "vec-manifest-serpe",
      from: "serpe", to: "*", sentAt: "2026-07-05T12:00:00Z",
      type: "manifest",
      body: {
        app: "serpe", v: 1,
        params: [
          { id: "density", label: "Density", unit: "ratio", min: 0, max: 1, default: 0.5, step: 0.01 },
          { id: "steps", label: "Steps", unit: "count", min: 1, max: 128, default: 16, step: 1 },
        ],
        commands: [
          { name: "next-pattern", label: "Next pattern" },
          { name: "mutate", label: "Mutate", args: [{ id: "amount", unit: "ratio", min: 0, max: 1, default: 0.2 }] },
        ],
      },
    },
  },
  {
    name: "param set: Serpe density → 0.7 (native unit)",
    msgId: 7,
    message: {
      protocol: "enkerli-suite", v: 1, id: "vec-param-density",
      from: "external", to: "serpe", sentAt: "2026-07-05T12:00:00Z",
      type: "param", body: { mode: "set", id: "density", value: 0.7 },
    },
  },
  {
    name: "param report batch: a preset-recall snapshot",
    msgId: 8,
    message: {
      protocol: "enkerli-suite", v: 1, id: "vec-param-batch",
      from: "serpe", to: "*", sentAt: "2026-07-05T12:00:00Z",
      type: "param", body: { mode: "report", params: [{ id: "density", value: 0.7 }, { id: "steps", value: 16 }] },
    },
  },
  {
    name: "command: mutate with a named arg",
    msgId: 9,
    message: {
      protocol: "enkerli-suite", v: 1, id: "vec-command-mutate",
      from: "external", to: "serpe", sentAt: "2026-07-05T12:00:00Z",
      type: "command", body: { name: "mutate", args: { amount: 0.3 } },
    },
  },
  {
    name: "note: play a C major triad on Vane for 500ms",
    msgId: 10,
    message: {
      protocol: "enkerli-suite", v: 1, id: "vec-note-cmajor",
      from: "proggenie", to: "vane", sentAt: "2026-07-05T12:00:00Z",
      type: "note", body: { notes: [60, 64, 67], velocity: 100, durationMs: 500 },
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
