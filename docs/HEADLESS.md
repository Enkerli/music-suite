# Headless — capability matrix (Track E3)

*Written 2026-07-06, verified against the repos. "Headless" = runs with no
GUI, no DAW, no plugin host: node scripts, console binaries, CI checks,
or a Linux box (MODEP / Ubuntu Studio). More of the suite already runs
headless than the roadmaps acknowledged; this file is the inventory, the
entry points, and the named gaps.*

## The entry point: `@enkerli/cli`

`npx enkerli <command>` from the monorepo (bin: `packages/cli`, thin argv
wrapper over an import-testable library):

| Command | What it does | Engine |
|---|---|---|
| `enkerli chord 60 64 67 71` | chord identification (MIDI notes or `--pcs`) | `@enkerli/theory` chordDetect |
| `enkerli pattern "E(3,8)"` | rhythm codecs: binary/hex/octal/decimal/onsets (accepts `0x94:8`, `o111:8`, `d73:8`, `10010010`) | `@enkerli/theory` rhythm — leftmost = LSB throughout |
| `enkerli smf "Dm7 G7 \| Cmaj7" -o out.mid` | bar notation → canonical Progression → format-0 SMF **with the embedded `MCURATOR:v1 PROG` payload** — the same file "Send to MIDIcurator" writes | `@enkerli/theory` parseLeadsheet + `@enkerli/midi` |
| `enkerli render 60 64 67 -o out.wav --breath 0.9 --param 12=0.6` | **audio through Vane's real DSP** (the committed `apps/vane/synth/vane-dsp.wasm` the browser standalone plays); breath-driven envelope, wasm param ids | Vane WASM voice in node |
| `enkerli send --to serpe --param density=0.7` · `--command mutate --arg amount=0.3` | control-plane message → one NDJSON `SuiteMessage` (docs/CONTROL_PLANE.md); `\| enkerli recv` reads/validates/summarizes — **`enkerli A \| enkerli B` is tool-to-tool piping over a Unix pipe** | `@enkerli/protocol` (added 2026-07-15) |
| `enkerli describe <app\|manifest.json>` | print a tool's parameter/command surface (`enkerli describe vane` = the pilot manifest, 36 params) | `@enkerli/protocol` + `apps/vane/manifest.json` |
| `enkerli send --to vane --param morph=1.0 \| enkerli render 69 -o out.wav --stream` | **message → sound**: render applies a control-plane `param` stream to Vane's real DSP (manifest id → wasm id), headless | control plane + Vane WASM voice |

## Per tool

| Tool | Headless today | Entry points | Gaps / named refactors |
|---|---|---|---|
| **TS packages** (theory, midi, library, protocol, webmidi codecs, corpus-tools, codegen) | ✅ by construction | `npm test` (937+ vitest, node); `regenerate-transitions` bin (corpus-tools); vector generators (theory, protocol) | — |
| **Vane** | ✅ **four ways** | ① WASM voice in node: `node Tools/wasm/regression-test.mjs` (33 checks) + `enkerli render`; ② console targets: `VaneSelfTest` (unit-test gate), `VaneRenderProbe` (engine measurement), `VanePresetGen`, `VanePresetExport` (→ MODEP LV2 preset bundles); ③ headless Linux **LV2** (default Linux build: no WebView, no WebKitGTK — MODEP/Patchbox); ④ **CLAP** target on every desktop OS | WASM voice still lags the plugin on transient/unison/etc. (parity queue) — `render` reflects the wasm's feature set |
| **Serpe** | ✅ engines | node conformance: `node WebApp/tests/rhythm-conformance.mjs` (134 vectors); C++ `serpe_conformance` console app (CTest + post-build gate); `apps/serpe/engine/*.js` runs in node (vitest) | **UPI engine is app code, not a package** — promoting `apps/serpe/engine` → `@enkerli/upi` would unlock `enkerli upi` with the full notation language (progressive/scenes stay stateful/engine-side) |
| **ProgGenie** | 🟡 in principle | `apps/progression-studio/src/generate.js` is plain ESM over `@enkerli/theory` + the derived tables (`data/transitions.json`, `data/trigrams.json`) — vitest exercises it in node today | **generation is app code, not a package** — promoting it would unlock `enkerli generate` (params → progression → SMF, the full headless pipeline with `smf`) |
| **MIDIcurator** | 🟡 analysis only | `src/lib/` (gesture/harmonic/leadsheet analysis, SMF metadata) runs in node via vitest | no CLI entry; Apple-Loops DB reading is sql.js/browser-bound by design |
| **PitchFold** | ✅ engine | `apps/pitchfold/engine/{pcs,voices}.js` node-clean, unit-tested (quantizer verified against the C++ probe) | no CLI entry (quantize-a-stream would be trivial once wanted) |
| **DrawnQurve** | ✗ | — | its own roadmap Q3: `GestureEngine` is host-free C++, "directly unit-testable" — the test target was never built; no console/render path |
| **Plugins in a headless host** | ✅ path exists | **LV2** (Vane today; the enkerli-juce Linux archetype emits LV2 for all) and **CLAP** (all desktop plugins since 2026-07-04) → MODEP, headless Ardour, `clap-validator` in CI | Linux plugin builds still need per-plugin verification (the Ubuntu Studio phase) |

## Notes

- `enkerli render` resolves the wasm relative to the monorepo
  (`apps/vane/synth/vane-dsp.wasm`); use `--wasm <path>` elsewhere. A loud
  chord at full breath rides the standalone master limiter by design — the
  Output param (id 8) is the headroom lever.
- Everything here obeys the suite conventions: leftmost = LSB masks,
  structural spelling, derived-statistics-only corpus data.
- The two promotions (Serpe UPI engine, ProgGenie generation) are the whole
  distance between "engines run in node" and "every tool has a headless
  version"; both are mechanical extractions, queued in plan §6 E3.
