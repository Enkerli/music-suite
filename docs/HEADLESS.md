# Headless — capability matrix (Track E3)

*Written 2026-07-06, verified against the repos. "Headless" = runs with no
GUI, no DAW, no plugin host: node scripts, console binaries, CI checks,
or a Linux box (MODEP / Ubuntu Studio). More of the suite already runs
headless than the roadmaps acknowledged; this file is the inventory, the
entry points, and the named gaps.*

## The entry point: `@enkerli/cli`

### Build & run

The CLI is a monorepo bin, not a globally-installed program — typing a bare
`enkerli` won't find it. From a fresh clone:

```bash
npm install                         # builds the packages incl. the CLI → packages/cli/dist
npx enkerli chord 60 64 67          # run it (npm resolves the workspace bin)
# equivalently, no npx:
node packages/cli/dist/cli.js chord 60 64 67
# want a global `enkerli` on your PATH? link it once:
npm link -w @enkerli/cli            # then `enkerli …` works anywhere
```

`npm install` runs the package build (`prepare`), so `dist/` exists before the
first run; `npm run build-packages` rebuilds after changes. *(The `enkerli`
name is provisional — see the bin field in `packages/cli/package.json`.)*

### The commands

`npx enkerli <command>` from the monorepo (bin: `packages/cli`, thin argv
wrapper over an import-testable library):

| Command | What it does | Engine |
|---|---|---|
| `enkerli chord 60 64 67 71` | chord identification (MIDI notes or `--pcs`) | `@enkerli/theory` chordDetect |
| `enkerli pattern "E(3,8)"` | rhythm codecs: binary/hex/octal/decimal/onsets (accepts `0x94:8`, `o111:8`, `d73:8`, `10010010`) | `@enkerli/theory` rhythm — leftmost = LSB throughout |
| `enkerli upi "P(3,0)+P(5,0)"` | the **full Serpe UPI language** — polygons, combination (LCM projection), quantization `E(3,8);12`, `{accent}` prefixes, Morse — with analysis | `@enkerli/upi` (the promoted engine) |
| `enkerli smf "Dm7 G7 \| Cmaj7" -o out.mid` | bar notation → canonical Progression → format-0 SMF **with the embedded `MCURATOR:v1 PROG` payload** — the same file "Send to MIDIcurator" writes | `@enkerli/theory` parseLeadsheet + `@enkerli/midi` |
| `enkerli generate --mode major --length 8 --seed 42 [--tonic C] [-o out.mid]` | a progression from the corpus statistics → Roman bars (reproducible by seed), realized to symbols with `--tonic`, or straight to SMF with `-o` — the full **params → progression → SMF** pipeline | `@enkerli/proggen` (the promoted engine) + `@enkerli/theory` |
| `enkerli render 60 64 67 -o out.wav --breath 0.9 --param 12=0.6` | **audio through Vane's real DSP** (the committed `apps/vane/synth/vane-dsp.wasm` the browser standalone plays); breath-driven envelope, wasm param ids | Vane WASM voice in node |
| `enkerli send --to serpe --param density=0.7` · `--command mutate --arg amount=0.3` | control-plane message → one NDJSON `SuiteMessage` (docs/CONTROL_PLANE.md); `\| enkerli recv` reads/validates/summarizes — **`enkerli A \| enkerli B` is tool-to-tool piping over a Unix pipe** | `@enkerli/protocol` (added 2026-07-15) |
| `enkerli describe <app\|manifest.json>` | print a tool's parameter/command surface (`enkerli describe vane` = the pilot manifest, 36 params) | `@enkerli/protocol` + `apps/vane/manifest.json` |
| `enkerli send --to vane --param morph=1.0 \| enkerli render 69 -o out.wav --stream` | **message → sound**: render applies a control-plane `param` stream to Vane's real DSP (manifest id → wasm id), headless | control plane + Vane WASM voice |
| `enkerli bind stage.json --cc 74=40 \| enkerli render 69 -o out.wav --stream` | **input → sound**: a control-map resolves a MIDI knob/key/pad through the manifests to a `param`/`command` message — the whole plane from a knob to audio, headless | `@enkerli/control` + control plane |
| `enkerli bind stage.json --validate` | check a control-map's bindings against the bundled manifests (unknown ids, out-of-range values, undeclared args) | `@enkerli/control` |

## Per tool

| Tool | Headless today | Entry points | Gaps / named refactors |
|---|---|---|---|
| **TS packages** (theory, midi, library, protocol, webmidi codecs, corpus-tools, codegen) | ✅ by construction | `npm test` (937+ vitest, node); `regenerate-transitions` bin (corpus-tools); vector generators (theory, protocol) | — |
| **Vane** | ✅ **four ways** | ① WASM voice in node: `node Tools/wasm/regression-test.mjs` (33 checks) + `enkerli render`; ② console targets: `VaneSelfTest` (unit-test gate), `VaneRenderProbe` (engine measurement), `VanePresetGen`, `VanePresetExport` (→ MODEP LV2 preset bundles); ③ headless Linux **LV2** (default Linux build: no WebView, no WebKitGTK — MODEP/Patchbox); ④ **CLAP** target on every desktop OS | WASM voice still lags the plugin on transient/unison/etc. (parity queue) — `render` reflects the wasm's feature set |
| **Serpe** | ✅ engines **+ package + CLI** | node conformance: `node WebApp/tests/rhythm-conformance.mjs` (134 vectors); C++ `serpe_conformance` console app (CTest + post-build gate); **`@enkerli/upi`** (the promoted engine, 14 vitest) drives `enkerli upi` | ✅ **promoted 2026-07-15**: `apps/serpe/engine/{upi,rhythm,analysis,syncopation,mutate}.js` → `@enkerli/upi` (the DOM SVG views stay in `apps/serpe/engine/render.js`); `enkerli upi` speaks the full notation language. Progressive/scenes stay stateful/engine-side |
| **ProgGenie** | ✅ engine **+ package + CLI** | **`@enkerli/proggen`** (the promoted engine — generation + curation + realization over the derived tables it now ships) drives `enkerli generate`; 52 vitest | ✅ **promoted 2026-07-15**: `apps/progression-studio/src/{generate,curation}.js` + `data/*.json` → `@enkerli/proggen`; `enkerli generate` is the full params → progression → SMF pipeline (chains with `smf`). Corpus stays derived-statistics-only (HANDOFF §5) |
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
- **Both engine promotions are done** (2026-07-15): Serpe → `@enkerli/upi`
  (`enkerli upi`) and ProgGenie → `@enkerli/proggen` (`enkerli generate`).
  That closes the distance between "engines run in node" and "every core
  engine has a headless version." What remains for full headless coverage is
  narrower: DrawnQurve still has **no** headless path (its `GestureEngine`
  test target was never built), and PitchFold/MIDIcurator have importable
  engines but no `enkerli` verb yet.
