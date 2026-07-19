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

**Known rough edge:** the first connection attempt from an `https://` page
to `http://localhost` can be silently dropped by the browser's Private
Network Access check — clicking **connect** a second time (after the
browser has resolved that check) is what "fixes" it. This build includes
the server-side header (`Access-Control-Allow-Private-Network`) that should
remove the need for that second click; **rebuild the CLI to pick it up**
(`npm run build-packages`, or a fresh `npm install`) before relying on it.
If reconnecting is still ever needed, it's a one-click fix, not a broken
pipe — the bridge process itself keeps running.

---

## 4. Building the JUCE plugins & standalones

**Shared setup, every repo below:**

- macOS with **Xcode** installed (for AU/AUv3/iOS builds), **CMake ≥ 3.22**.
- **JUCE 8.0.13 is fetched automatically** by `cmake` if you don't have a
  local copy — no manual JUCE clone needed, despite what some READMEs say.
  (Speed-up, optional: `ln -s /Applications/JUCE JUCE` inside the plugin repo.)
- Four repos vendor `enkerli-juce` as a **git submodule** — clone those with
  `--recurse-submodules` (or `git submodule update --init` after a plain
  clone). Vane and DrawnQurve don't use the submodule and need neither.
- Four repos (Serpe, PitchFold, Vane, DrawnQurve) build their WebView UI
  **from this monorepo's `apps/<slug>`** — clone `music-suite` as a
  **sibling directory** of the plugin repo (e.g. both under `~/code/`) and
  `npm install` it there; that's the default CMake looks for. Point
  elsewhere by copying that plugin's `webui.local.cmake.example` to
  `webui.local.cmake` and editing the path.
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
in music-suite).

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

## 5. If something doesn't match this file

This file is the one meant to stay current — if a plugin repo's own README
says something different, trust this file and fix that README (or flag it).
Everything above was read from each repo's actual `CMakeLists.txt` on
2026-07-19, not reconstructed from memory.
