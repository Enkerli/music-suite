#!/usr/bin/env node
// Regenerate apps/vane/manifest.json — Vane's control-plane manifest
// (docs/CONTROL_PLANE.md), the first real per-tool manifest (the pilot).
//
// Run from the monorepo root AFTER building packages:
//   node apps/vane/gen-manifest.mjs
//
// SOURCE OF TRUTH: this table is transcribed from index.html's RANGE / LOGK
// tables and the state.patch defaults, and PARAM_MAP in synth-main.js. Until a
// derivation extracts those directly, KEEP THIS IN SYNC when a slider's range,
// default, or wasm id changes. Manifest v1 covers Vane's CONTINUOUS
// (RANGE-table) parameters — the surface that matters for modulation and
// automation. Discrete mode switches (Mode, NoiseType, VowelMode, Waveguide/
// Unison enables, glide curves) need enum value vocabularies and are v2.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { makeManifest, validateMessage } from "../../packages/protocol/dist/index.js";

// [id, label, unit, min, max, step, default, wasmId, scale?]
// id = stable kebab addressing contract; wasmId = index.html PARAM_MAP (kept
// here so a future `enkerli render`/live bridge can resolve id → engine param).
const P = [
  ["morph",           "Morph",                 "ratio",   0,     1,      0.001, 0.0,   12],
  ["pulse-width",     "Pulse Width",           "ratio",   0.5,   0.999,  0.001, 0.5,   13],
  ["wavefold",        "Wavefold",              "ratio",   0,     1,      0.01,  0.0,   17],
  ["inharmonicity",   "Inharmonicity",         "ratio",   0,     1,      0.01,  0.0,   14],
  ["hard-sync",       "Hard Sync",             "ratio",   1,     8,      0.01,  1.0,   15],
  ["noise",           "Noise",                 "ratio",   0,     1,      0.01,  0.0,   26],
  ["detune",          "Detune",                "cents",  -100,   100,    1,     0,     28],
  ["filter-cutoff",   "Filter Cutoff",         "hz",      20,    20000,  10,    1128,  1,   "log"],
  ["filter-resonance","Filter Resonance",      "ratio",   0,     1,      0.01,  0.1,   2],
  ["output",          "Output",                "ratio",   0,     1,      0.01,  0.8,   8],
  ["vel-vca",         "Velocity → VCA",        "ratio",   0,     1,      0.01,  0.0,   9],
  ["glide-time",      "Glide Time",            "ms",      0,     2000,   5,     0,     10],
  ["master-tune",     "Master Tune",           "cents",  -100,   100,    1,     0,     29],
  ["unison-detune",   "Unison Detune",         "cents",   0,     50,     1,     14,    40],
  ["unison-width",    "Unison Width",          "ratio",   0,     1,      0.01,  0.7,   41],
  ["vowel",           "Vowel",                 "ratio",   0,     1,      0.01,  0.5,   20],
  ["vowel-front",     "Vowel Front",           "ratio",   0,     1,      0.01,  0.5,   21],
  ["vowel-round",     "Vowel Round",           "ratio",   0,     1,      0.01,  0,     22],
  ["vowel-amount",    "Vowel Amount",          "ratio",   0,     1,      0.01,  1,     23],
  ["vowel-bite",      "Vowel Bite",            "ratio",   0,     1,      0.01,  0.5,   24],
  ["vowel-move",      "Vowel Move",            "ratio",   0,     1,      0.01,  0,     25],
  ["wg-embouchure",   "Waveguide Embouchure",  "ratio",   0,     1,      0.01,  0.5,   31],
  ["wg-reed-stiff",   "Waveguide Reed Stiffness","ratio", 0,     1,      0.01,  0.5,   32],
  ["wg-reed-aperture","Waveguide Reed Aperture","ratio",  0,     1,      0.01,  0.5,   33],
  ["wg-bore-damping", "Waveguide Bore Damping","ratio",   0,     1,      0.01,  0.2,   34],
  ["wg-bell-bright",  "Waveguide Bell Brightness","ratio",0,     1,      0.01,  0.7,   35],
  ["wg-conical",      "Waveguide Conical",     "ratio",   0,     1,      0.01,  0.62,  36],
  ["wg-breath-noise", "Waveguide Breath Noise","ratio",   0,     1,      0.01,  0.05,  37],
  ["wg-growl",        "Waveguide Growl",       "ratio",   0,     1,      0.01,  0.0,   38],
  ["transient-gain",  "Transient Gain",        "ratio",   0,     2,      0.01,  0.0,   44],
  ["transient-decay", "Transient Decay",       "ms",      10,    2000,   1,     200,   45,  "log"],
  ["transient-var",   "Transient Variation",   "ratio",   0,     1,      0.01,  0.3,   47],
  ["transient-dyn",   "Transient Dynamics",    "ratio",   0,     1,      0.01,  0.75,  49],
  ["transient-reso",  "Transient Resonance",   "ratio",   0,     1,      0.01,  0.3,   50],
  ["transient-damp",  "Transient Damping",     "ratio",   0,     1,      0.01,  0.5,   51],
  ["transient-morph", "Transient Morph",       "ms",      0,     50,     1,     12,    52],
];

const params = P.map(([id, label, unit, min, max, step, def, wasmId, scale]) => ({
  id, label, unit, min, max, step, default: def,
  ...(scale ? { scale } : {}),
  // engine binding (not part of ManifestBody's validated shape; Vane-specific):
  wasmId,
}));

// Validate the ManifestBody shape (wasmId is an extra field — ignored by the
// validator, which only checks the declared surface).
const manifest = { app: "vane", v: 1, params, commands: [] };
const probe = makeManifest("vane", manifest);
const r = validateMessage(probe);
if (!r.ok) { console.error("manifest INVALID:\n  " + r.errors.join("\n  ")); process.exit(1); }

const out = fileURLToPath(new URL("./manifest.json", import.meta.url));
writeFileSync(out, JSON.stringify(manifest, null, 2) + "\n");
console.log(`wrote ${out}: ${params.length} params, ${manifest.commands.length} commands (valid)`);
