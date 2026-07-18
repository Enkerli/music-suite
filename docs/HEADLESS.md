# Headless — capability matrix (Track E3)

*Written 2026-07-06, verified against the repos. "Headless" = runs with no
GUI, no DAW, no plugin host: node scripts, console binaries, CI checks,
or a Linux box (MODEP / Ubuntu Studio). More of the suite already runs
headless than the roadmaps acknowledged; this file is the inventory, the
entry points, and the named gaps.*

## The entry point: `@enkerli/cli`

### Build & run

The CLI is a monorepo bin named `msuite`, not a globally-installed program —
typing a bare `msuite` in a fresh shell won't find it. From a clone:

```bash
npm install                         # builds the packages incl. the CLI → packages/cli/dist
npm run msuite -- chord 60 64 67    # run it (root script — always works after install)
# equivalently, no wrapper:
node packages/cli/dist/cli.js chord 60 64 67
# want a bare `msuite` on your PATH? link it once (needs a writable npm prefix —
# on macOS with a system-owned prefix, prefix the command with sudo):
npm link -w @enkerli/cli            # then `msuite …` works anywhere
```

`npm install` runs the package build (`prepare`), so `dist/` exists before the
first run; `npm run build-packages` rebuilds after changes. The **`npm run
msuite --`** form needs no global install and is the one to reach for if `npm
link` fails (a common macOS global-prefix permission issue). *In the command
tables below, `msuite` is shorthand for whichever launcher you picked.*

### The commands

Run `msuite <command>` from the monorepo (bin: `packages/cli`, thin argv
wrapper over an import-testable library):

| Command | What it does | Engine |
|---|---|---|
| `msuite chord 60 64 67 71` | chord identification (MIDI notes or `--pcs`) | `@enkerli/theory` chordDetect |
| `msuite pattern "E(3,8)"` | rhythm codecs: binary/hex/octal/decimal/onsets (accepts `0x94:8`, `o111:8`, `d73:8`, `10010010`) | `@enkerli/theory` rhythm — leftmost = LSB throughout |
| `msuite upi "P(3,0)+P(5,0)"` | the **full Serpe UPI language** — polygons, combination (LCM projection), quantization `E(3,8);12`, `{accent}` prefixes, Morse — with analysis | `@enkerli/upi` (the promoted engine) |
| `msuite smf "Dm7 G7 \| Cmaj7" -o out.mid` | bar notation → canonical Progression → format-0 SMF **with the embedded `MCURATOR:v1 PROG` payload** — the same file "Send to MIDIcurator" writes | `@enkerli/theory` parseLeadsheet + `@enkerli/midi` |
| `msuite generate --mode major --length 8 --seed 42 [--tonic C] [-o out.mid]` | a progression from the corpus statistics → Roman bars (reproducible by seed), realized to symbols with `--tonic`, or straight to SMF with `-o` — the full **params → progression → SMF** pipeline | `@enkerli/proggen` (the promoted engine) + `@enkerli/theory` |
| `msuite render 60 64 67 -o out.wav --breath 0.9 --param 12=0.6` | **audio through Vane's real DSP** (the committed `apps/vane/synth/vane-dsp.wasm` the browser standalone plays); breath-driven envelope, wasm param ids | Vane WASM voice in node |
| `msuite send --to serpe --param density=0.7` · `--command mutate --arg amount=0.3` · `--to vane --note 60,64,67 --duration 500` | control-plane message → one NDJSON `SuiteMessage` (docs/CONTROL_PLANE.md): `param` shapes a tool, `command` fires an action, **`note` plays a chord on a voice**; `\| msuite recv` reads/validates/summarizes — **`msuite A \| msuite B` is tool-to-tool piping over a Unix pipe** | `@enkerli/protocol` (added 2026-07-15) |
| `msuite describe <app\|manifest.json>` | print a tool's parameter/command surface (`msuite describe vane` = the pilot manifest, 36 params) | `@enkerli/protocol` + `apps/vane/manifest.json` |
| `msuite send --to vane --param morph=1.0 \| msuite render 69 -o out.wav --stream` | **message → sound**: render applies a control-plane `param` stream to Vane's real DSP (manifest id → wasm id), headless | control plane + Vane WASM voice |
| `msuite bind stage.json --cc 74=40 \| msuite render 69 -o out.wav --stream` | **input → sound**: a control-map resolves a MIDI knob/key/pad through the manifests to a `param`/`command` message — the whole plane from a knob to audio, headless | `@enkerli/control` + control plane |
| `msuite bind stage.json --validate` | check a control-map's bindings against the bundled manifests (unknown ids, out-of-range values, undeclared args) | `@enkerli/control` |
| `msuite accompany --progression "Dm7 \| G7 \| Cmaj7 \| A7" --seed 42 -o bass.mid [--trace t.json] [--explain]` | **GloriArp slice 1**: one curated bass phrase adapted across a progression — chord-relative reharmonization, range clamp, seeded determinism, a trace that explains every note (`GLORIARP:v1 TRACE` header embedded in the SMF) | `@enkerli/accompaniment` (docs/GLORIARP_BRIEF.md, docs/GLORIARP_AUDIT.md) |
| `msuite generate --mode minor --length 8 --seed 7 \| msuite accompany --seed 9 --tonic A --mode minor -o bass.mid` | **the GloriArp pipeline** (brief §11, verbatim shape): corpus statistics generate the progression, the adapter walks a bass through it — piped `generate` emits bare bar notation (also via `--bars-only`); `accompany` with no `--progression` reads it from stdin | `@enkerli/proggen` + `@enkerli/accompaniment` |
| `msuite accompany --progression "Dm7 \| G7" --rhythm "E(3,8)" --source funk-ghost` | **rhythm replacement — the interop dividend** (PRIORITIES §2.1): perform any source phrase's pitch material on any UPI grid — Serpe's whole rhythm language as GloriArp's rhythm section (`E(3,8)` = instant tresillo bass; `{100}E(3,8)` adds accents; `P(3,0)+P(5,0)` works too). `--source` picks a bundled style — `walking-bass` · `funk-ghost` (ghost-note dynamics) · `bossa` · `two-feel` — or your own phrase JSON | `applyRhythm` (@enkerli/accompaniment) + `@enkerli/upi`; committed tresillo acceptance vector |
| `… --gate staccato --dynamics 0.7 --rests 0.3 --anticipation 0.5` | **the articulation pack — grooves that breathe** (PRIORITIES §2.3–2.4): gate shapes note lengths (staccato/tenuto/legato or a factor), dynamics follows the metric-weight contour (downbeats up, cracks down), rests drop metrically weak events (a bar downbeat never drops), anticipation pushes a downbeat half a beat early — sounding the COMING chord before the barline, replacing any pickup it lands on (a mono line stays mono). All seeded, every edit reported (`--explain` prints them); expression is explicit data, never hidden randomness (brief §14) | `articulate` (@enkerli/accompaniment, 8 tests); committed articulated acceptance vector |
| `msuite accompany --progression "Dm7 \| G7" --play [--loop \| --loop-count N] \| msuite recv` | **perform**: stream the adapted bassline as real-time control-plane `note` messages (NDJSON, self-releasing via durationMs, paced by `--bpm`) — human chatter goes to stderr so the pipe stays clean. `--loop` repeats forever, a continuous groove (Ctrl-C stops it gracefully — after the current note); `--loop-count N` repeats a fixed number of times | control plane + `@enkerli/accompaniment` (`performPhrase`, 5 tests) |
| `msuite accompany --progression "Dm7 \| G7" --play --loop \| msuite bridge` | **the pipe reaches the browser**: `bridge` serves the stream to browsers over SSE (localhost, no deps); the workspace's **Bridge (CLI)** module republishes onto the tab-spanning bus, so the **Vane tab plays the bassline out loud**, continuously | control plane transport adapter (`startBridge`, 5 tests) |
| `msuite accompany --play \| msuite bridge \| msuite recv` | **full duplex**: `bridge` sits in the middle of the pipe — stdin plays TO browsers, while any bus activity a connected tab originates locally (a knob move, a click) POSTs back to `/send` and lands on `bridge`'s own stdout, so the process on the FAR end of the pipe sees the browser's traffic too. `POST /send` also takes one-shots from curl / Apple Shortcuts | control plane transport adapter (`startBridge`, full-duplex tests) |
| `msuite accompany --play --loop --midi-out virtual` · `… \| msuite play --midi-out <port>` | **REAL MIDI out — the P1 "Plug & Jam" unblocker** (docs/JAM.md): note messages become MIDI bytes on an ALSA rawmidi port (dependency-free file I/O; `snd-virmidi` for a virtual port, `aconnect` into jalv running the **headless Vane LV2**, fluidsynth, or hardware). Breath (CC2 = velocity) precedes notes for the wind-model envelope (`--breath-cc off` for other synths); exit always leaves the synth silent (note-offs + CC123). `msuite play --list` enumerates ports; a plain file path captures the raw performance | `midiout.ts` (14 tests + subprocess e2e) — Linux-first by design; macOS live = the browser bridge |

## Per tool

| Tool | Headless today | Entry points | Gaps / named refactors |
|---|---|---|---|
| **TS packages** (theory, midi, library, protocol, webmidi codecs, corpus-tools, codegen) | ✅ by construction | `npm test` (937+ vitest, node); `regenerate-transitions` bin (corpus-tools); vector generators (theory, protocol) | — |
| **Vane** | ✅ **four ways** | ① WASM voice in node: `node Tools/wasm/regression-test.mjs` (33 checks) + `msuite render`; ② console targets: `VaneSelfTest` (unit-test gate), `VaneRenderProbe` (engine measurement), `VanePresetGen`, `VanePresetExport` (→ MODEP LV2 preset bundles); ③ headless Linux **LV2** (default Linux build: no WebView, no WebKitGTK — MODEP/Patchbox); ④ **CLAP** target on every desktop OS | WASM voice still lags the plugin on transient/unison/etc. (parity queue) — `render` reflects the wasm's feature set |
| **Serpe** | ✅ engines **+ package + CLI** | node conformance: `node WebApp/tests/rhythm-conformance.mjs` (134 vectors); C++ `serpe_conformance` console app (CTest + post-build gate); **`@enkerli/upi`** (the promoted engine, 14 vitest) drives `msuite upi` | ✅ **promoted 2026-07-15**: `apps/serpe/engine/{upi,rhythm,analysis,syncopation,mutate}.js` → `@enkerli/upi` (the DOM SVG views stay in `apps/serpe/engine/render.js`); `msuite upi` speaks the full notation language. Progressive/scenes stay stateful/engine-side |
| **ProgGenie** | ✅ engine **+ package + CLI** | **`@enkerli/proggen`** (the promoted engine — generation + curation + realization over the derived tables it now ships) drives `msuite generate`; 52 vitest | ✅ **promoted 2026-07-15**: `apps/progression-studio/src/{generate,curation}.js` + `data/*.json` → `@enkerli/proggen`; `msuite generate` is the full params → progression → SMF pipeline (chains with `smf`). Corpus stays derived-statistics-only (HANDOFF §5) |
| **MIDIcurator** | 🟡 analysis only | `src/lib/` (gesture/harmonic/leadsheet analysis, SMF metadata) runs in node via vitest | no CLI entry; Apple-Loops DB reading is sql.js/browser-bound by design |
| **PitchFold** | ✅ engine | `apps/pitchfold/engine/{pcs,voices}.js` node-clean, unit-tested (quantizer verified against the C++ probe) | no CLI entry (quantize-a-stream would be trivial once wanted) |
| **DrawnQurve** | ✗ | — | its own roadmap Q3: `GestureEngine` is host-free C++, "directly unit-testable" — the test target was never built; no console/render path |
| **Plugins in a headless host** | ✅ path exists | **LV2** (Vane today; the enkerli-juce Linux archetype emits LV2 for all) and **CLAP** (all desktop plugins since 2026-07-04) → MODEP, headless Ardour, `clap-validator` in CI | Linux plugin builds still need per-plugin verification (the Ubuntu Studio phase) |

## Notes

- `msuite render` resolves the wasm relative to the monorepo
  (`apps/vane/synth/vane-dsp.wasm`); use `--wasm <path>` elsewhere. A loud
  chord at full breath rides the standalone master limiter by design — the
  Output param (id 8) is the headroom lever.
- Everything here obeys the suite conventions: leftmost = LSB masks,
  structural spelling, derived-statistics-only corpus data.
- **Both engine promotions are done** (2026-07-15): Serpe → `@enkerli/upi`
  (`msuite upi`) and ProgGenie → `@enkerli/proggen` (`msuite generate`).
  That closes the distance between "engines run in node" and "every core
  engine has a headless version." What remains for full headless coverage is
  narrower: DrawnQurve still has **no** headless path (its `GestureEngine`
  test target was never built), and PitchFold/MIDIcurator have importable
  engines but no `msuite` verb yet.
