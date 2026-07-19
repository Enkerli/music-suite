# Build & deploy — the one guide

*Real commands, one place. If a step here disagrees with an older doc
(HEADLESS.md, JAM.md, a plugin repo's own README), this file wins — it was
verified against the actual repos on 2026-07-19.*

## 0. The pieces

- **This repo** (`music-suite`): shared TypeScript packages, the `msuite`
  CLI, and six webapps (Workspace, MIDIcurator, Progression Studio, PickPCS,
  Chord Dictionary, Exquisite Fingerings, Style Gallery).
- **Six separate repos**: JUCE plugins (AU/VST3/AUv3/LV2/Standalone) whose
  WebView UI is the SAME code as four of the apps above (Serpe, PitchFold,
  Vane, DrawnQurve embed `apps/serpe`, `apps/pitchfold`, `apps/vane`,
  `apps/drawnqurve`; MIDIcurator's and Progression Studio's plugins embed
  their whole app via a build script). All six vendor or fetch
  **`enkerli-juce`**, the shared CMake foundation.
- **The live site**: `https://enkerli.github.io/music-suite/` — every app
  runs there already. You only need to build locally to change code or to
  build a plugin/standalone.

---

## 1. The monorepo (packages, CLI, webapp source)

```bash
git clone https://github.com/Enkerli/music-suite
cd music-suite
npm install          # also compiles the TS packages (the "prepare" script)
npm test             # 1257 tests, should be all green
```

That's it for the Node/TypeScript side. Two things worth knowing:

- **`npm run build-packages`** recompiles the shared packages
  (theory/midi/library/protocol/control/accompaniment/cli/…). `npm install`
  and `npm test` already do this for you; run it by hand after pulling if
  something looks stale.
- **The `msuite` CLI**: `npm run msuite -- <command> …` works with no setup.
  For a bare `msuite` on your PATH: `sudo npm link -w @enkerli/cli` (needs
  `sudo` on most systems — the error if you omit it doesn't say so).

---

## 2. The webapps — use the deployed site, not localhost

The six in-repo apps **auto-deploy**: `.github/workflows/deploy-pages.yml`
rebuilds and publishes `docs/` on every push to `main` that touches
`apps/`, `packages/`, or `docs/`. So for these apps, the whole workflow is:

```bash
# edit apps/workspace/... (or MIDIcurator, progression-studio, etc.)
git add -A && git commit -m "…" && git push
```

Wait ~1–2 minutes (check the Actions tab), then reload
`https://enkerli.github.io/music-suite/apps/<slug>/`. No local server, no
`sync-apps` needed for these six.

**The four plugin-repo WebUIs are different**: Serpe, PitchFold, Vane, and
DrawnQurve live in separate repos GitHub Actions here can't reach, so their
committed builds under `docs/apps/<slug>/` only update when you run this
locally and push:

```bash
node scripts/sync-apps.mjs serpe pitchfold vane drawnqurve   # or omit names for all
git add docs/apps && git commit -m "sync plugin webuis" && git push
```

This only rebuilds source it can find. By default it looks for each plugin
repo as a **sibling directory** on your machine (e.g. `~/Vane`,
`~/Desktop/PitchFold`); if yours are elsewhere, copy
`scripts/apps.local.json.example` to `scripts/apps.local.json` and set the
real paths.

**If you only want to browse the apps, ignore all of this and just open the
deployed URLs.** Local dev servers (`npm run dev -w <app>`) are only for
iterating on an app's code before pushing.

---

## 3. Connecting the deployed Workspace to your local machine (the bridge)

The Workspace page (deployed or local) can hear a `msuite` pipeline running
in your terminal — that's how `msuite accompany --play --loop | msuite
bridge` ends up sounding through the Vane tab.

**Terminal**, on the machine you want to control from:
```bash
msuite accompany --progression "Dm7 | G7 | Cmaj7 | A7" --play --loop | msuite bridge
```
This starts a small local server on `http://localhost:8765`.

**Browser**, on `https://enkerli.github.io/music-suite/apps/workspace/`:
add the **Bridge (CLI)** module, leave the URL as `http://localhost:8765`,
click **connect**.

**Known rough edge — browser-dependent, not fully solved:** an `https://`
page fetching `http://localhost` crosses both a scheme boundary (mixed
content) and, in Chromium, a Private Network Access check — and browsers
disagree on how to handle that:

- **Chrome**: the bridge sends `Access-Control-Allow-Private-Network: true`
  on its CORS responses (added 2026-07-19) specifically to satisfy PNA's
  preflight opt-in — reasoned from the spec, not yet confirmed against a
  real repro.
- **Brave** (2026-07-20 field report): **the same header did not remove
  the need to reconnect.** Brave is Chromium-based but its Shields layer
  makes its own calls about local-network requests from a public page —
  the PNA header alone isn't sufficient there. Unresolved; treat "click
  connect twice" as the working answer on Brave for now.
- **Safari** (2026-07-20 field report): **the bridge module doesn't work
  at all.** Expected, not a bug to chase with a header: WebKit's
  mixed-content model treats `https://` → `http://` as blocked
  subresource loading, a scheme-level policy no CORS or PNA header can
  override (PNA itself is a Chromium-only proposal WebKit hasn't adopted).

**The one fix that would actually cover all three** is removing the
scheme mismatch: serve the bridge over `https://` (a locally-trusted
self-signed certificate, e.g. via `mkcert`) instead of plain `http://`.
Not done yet — it's a real setup change (generating and trusting a local
cert differs by OS), not a one-line patch, so it's queued as a decision to
make rather than something silently attempted. Until then: the bridge
process itself keeps running fine across all of this — it's specifically
the browser's cross-scheme connection that's fragile, and Chrome is the
most reliable browser for this workflow today.

---

## 4. Building the JUCE plugins & standalones

**Shared setup, every repo below:**

- macOS with **Xcode** installed (for AU/AUv3/iOS builds), **CMake ≥ 3.22**.
- **JUCE 8.0.13 is fetched automatically** by `cmake` if you don't have a
  local copy — no manual JUCE clone needed, despite what some READMEs say.
  (Speed-up, optional: `ln -s /Applications/JUCE JUCE` inside the plugin repo.)
- Five repos vendor `enkerli-juce` as a **git submodule** (MIDIcurator,
  ProgGenie, PitchFold, Serpe, workspace-plugin). `--recurse-submodules`
  at clone time is nice but **no longer required**: since 2026-07-19,
  `cmake` initializes the submodule itself when it's empty (a plain clone
  used to die with a cryptic `Unknown CMake command "enkerli_resolve_juce"`
  — the probable cause of the "fresh clone wouldn't build" reports). Vane
  and DrawnQurve don't use the submodule.
- Five repos (Serpe, PitchFold, Vane, DrawnQurve, workspace-plugin) build
  their WebView UI **from this monorepo's `apps/<slug>`** — check out
  `music-suite` and `npm install` it. CMake finds it automatically in any
  of three layouts (added 2026-07-19 after a real Linux failure):
  1. **sibling** — plugin repo next to `music-suite` (e.g. both under
     `~/code/`); the default;
  2. **nested** — plugin repo checked out *inside* the `music-suite`
     directory (e.g. `~/Coding/music-suite/Vane`);
  3. **`MUSIC_SUITE` env var** — `export MUSIC_SUITE=/path/to/music-suite`
     before running `cmake`.
  A gitignored `webui.local.cmake` (copy the `.example`) overrides all
  three. The error message lists exactly what was probed.
- iOS/AUv3 signing: open the generated Xcode project, select the
  `..._Standalone` (and `..._AUv3`) target → **Signing & Capabilities** →
  pick your Apple Developer team. Xcode fills in your machine's default
  account automatically; only override it if you need a specific team (some
  repos support `signing.local.cmake` — see their example file — using the
  10-character team ID from Xcode ▸ Settings ▸ Accounts). **Do this per
  target, not once** — Standalone and AUv3 each carry their own signing
  settings, and on a fresh clone (2026-07-20 field report) Xcode can show a
  stale/missing certificate until you've opened Signing & Capabilities and
  confirmed your team on EACH one — an existing, already-signed clone
  doesn't show this. If a scheme doesn't appear in the scheme picker after
  opening the project, use Xcode's **Manage Schemes → Autocreate schemes**
  (or Product ▸ Scheme ▸ New Scheme) to add the missing one — several
  repos needed this by hand on a fresh clone (2026-07-20 field report).
- **First AUv3 install ritual**: build and run the `..._Standalone` scheme
  to a real iPad once (Simulator doesn't register app extensions reliably).
  After that single run, the AUv3 shows up in a host's MIDI-effect picker
  (e.g. AUM's "MIDI FX" / "MIDI Processor" node).
- **Verify a build** (macOS): `enkerli-juce/tools/validate.sh <repo-dir>
  <aumi|aumu> <4-char-plugin-code>` runs the whole automatable ladder
  (macOS build → iOS compile check → `auval`). Optional but catches most
  problems before a device does.

### MIDIcurator

```bash
git clone --recurse-submodules https://github.com/Enkerli/midicurator-plugin
cd midicurator-plugin
node WebUI/build.mjs /path/to/music-suite/apps/MIDIcurator   # regenerate the UI bundle
cmake -B build-macos -DCMAKE_BUILD_TYPE=Release
cmake --build build-macos -j 8      # AU + VST3 + Standalone
cmake -B build-ios -G Xcode -DCMAKE_SYSTEM_NAME=iOS -DCMAKE_OSX_DEPLOYMENT_TARGET=16.0
open build-ios/MIDIcurator.xcodeproj   # build MIDIcurator_Standalone, then MIDIcurator_AUv3, to a device
```
`WebUI/index.html` is committed, so skip the `node WebUI/build.mjs` step if
you haven't changed `apps/MIDIcurator`. `auval -v aumi Mcur Enke` validates.

### Progression Studio (ProgGenie)

```bash
git clone --recurse-submodules https://github.com/Enkerli/progression-studio-plugin
cd progression-studio-plugin
node WebUI/build.mjs /path/to/music-suite/apps/progression-studio
cmake -B build && cmake --build build      # macOS AU/VST3/Standalone
auval -v aumi Prst Enke                    # AU VALIDATION SUCCEEDED
cmake -B build-ios -G Xcode -DCMAKE_SYSTEM_NAME=iOS -DCMAKE_OSX_DEPLOYMENT_TARGET=16.0
open build-ios/ProgressionStudio.xcodeproj   # run ProgressionStudio_Standalone to an iPad once
```

### PitchFold

```bash
git clone --recurse-submodules https://github.com/Enkerli/PitchFold
cd PitchFold
# WebUI builds automatically from ../music-suite/apps/pitchfold during cmake —
# no separate node step. Override the path in webui.local.cmake if needed.
cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --target PitchFold_Standalone   # or PitchFold_AU, PitchFold_VST3
cmake -B build-ios -G Xcode -DCMAKE_SYSTEM_NAME=iOS -DCMAKE_OSX_DEPLOYMENT_TARGET=16.0
open build-ios/PitchFold.xcodeproj
```

### Vane

```bash
git clone https://github.com/Enkerli/Vane
cd Vane
cmake -S . -B build-mac          # AU · VST3 · Standalone (+ AUv3, MTS if present)
cmake --build build-mac --target Vane_Standalone Vane_AU Vane_VST3
cmake -S . -B build-ios -G Xcode -DCMAKE_SYSTEM_NAME=iOS -DCMAKE_OSX_DEPLOYMENT_TARGET=16.0
open build-ios/Vane.xcodeproj    # run Vane_Standalone, then Vane_AUv3, to an iPad
```
On Linux, `cmake -S . -B build-linux` configures an **LV2 + Standalone**
build instead (no Xcode step) — the headless-synth path (see `docs/JAM.md`
in music-suite). Full Linux sequence, valid for any of the three checkout
layouts above (this exact nested case — `~/Coding/music-suite/Vane` with
the monorepo at `~/Coding/music-suite` — failed before 2026-07-19; now
auto-detected):

```bash
cd ~/Coding/music-suite && npm install     # WebUI deps for the cmake esbuild step
cd Vane
cmake -S . -B build-linux
cmake --build build-linux -j$(nproc)
```

### Serpe

```bash
git clone --recurse-submodules https://github.com/Enkerli/rhythm_pattern_explorer
cd rhythm_pattern_explorer
# WebUI builds automatically from ../music-suite/apps/serpe during cmake.
cmake -B build-macos          # macOS AU/VST3/Standalone; needs SERPE_DESKTOP handled internally
cmake --build build-macos --target Serpe_Standalone Serpe_AU Serpe_VST3
cmake -B build-ios -G Xcode -DCMAKE_SYSTEM_NAME=iOS -DCMAKE_OSX_DEPLOYMENT_TARGET=16.0
open build-ios/Serpe.xcodeproj   # run Serpe_Standalone, then Serpe_AUv3, to an iPad
```
Plugin identity is load-bearing here (`PLUGIN_CODE RPEd`,
`com.enkerli.serpe`) — don't rename anything if you fork this.
To pin a specific Apple team instead of Xcode's default, copy
`signing.local.cmake.example` to `signing.local.cmake` first.

### DrawnQurve

```bash
git clone https://github.com/Enkerli/DrawnQurve
cd DrawnQurve
# WebUI builds automatically from ../music-suite/apps/drawnqurve during cmake.
cmake -S . -B build-ios -G Xcode -DCMAKE_SYSTEM_NAME=iOS -DCMAKE_OSX_DEPLOYMENT_TARGET=16.0
open build-ios/DrawnCurve.xcodeproj   # run DrawnCurve_Standalone, then DrawnCurve_AUv3, to an iPad
```
DrawnQurve is iPad-only (AUv3 + Standalone, no desktop AU/VST3 build). The
Xcode project target is named `DrawnCurve` (no "Q") — a historical rename
that would break too many references to undo.

**Signing note (confirmed cause of a real "wrong team" build failure):**
`CMakeLists.txt` hardcodes the maintainer's own team id
(`XCODE_ATTRIBUTE_DEVELOPMENT_TEAM "P8W7XXJN6C"`) on both the
`DrawnCurve_Standalone` and `DrawnCurve_AUv3` targets — anyone else's
build will show that team and fail signing until you fix it by hand. For
BOTH targets: Signing & Capabilities tab → confirm **your own** Team is
selected (not the hardcoded one) → confirm "Automatically manage signing"
is checked. Do this after every `cmake -B build-ios -G Xcode` regeneration
(Xcode re-evaluates provisioning lazily, so even a correct CMake value
needs this manual nudge the first time a target is selected).

---

### Suite Workspace

Promoted to its own repo 2026-07-19 (the `plugin-shells/` staging copy in
this repo has been removed — the repo is the source of truth now):

```bash
git clone --recurse-submodules https://github.com/Enkerli/workspace-plugin
cd workspace-plugin
# music-suite checked out + npm-installed in any of the three layouts above
# (sibling / nested / MUSIC_SUITE env; webui.local.cmake overrides)
cmake -B build-macos -DCMAKE_BUILD_TYPE=Release && cmake --build build-macos -j 8
auval -v aumi Wksp Enke
cmake -B build-ios -G Xcode -DCMAKE_SYSTEM_NAME=iOS -DCMAKE_OSX_DEPLOYMENT_TARGET=16.0
open build-ios/Workspace.xcodeproj   # run Workspace_Standalone to an iPad once, then Workspace_AUv3
```

Linux configures LV2/Standalone/CLAP (verified 2026-07-20 from the staged
copy, same source).

## 5. If something doesn't match this file

This file is the one meant to stay current — if a plugin repo's own README
says something different, trust this file and fix that README (or flag it).
Everything above was read from each repo's actual `CMakeLists.txt` on
2026-07-19, not reconstructed from memory.
