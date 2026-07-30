# Build & deploy — the one guide

*Real commands, one place. If a step here disagrees with an older doc
(HEADLESS.md, JAM.md, a plugin repo's own README), this file wins — it was
verified against the actual repos on 2026-07-19 (build tooling refreshed
2026-07-22).*

---

## Quickstart — build the JUCE plugins

Every plugin repo builds from **one parent directory of sibling checkouts**,
driven by a single script (`enkerli-juce/tools/suite-build`). Pick a parent
dir (`~/code` throughout) and pick your path.

**A. From scratch** — one repo, then one command:

```bash
mkdir -p ~/code && cd ~/code
git clone --recurse-submodules https://github.com/Enkerli/enkerli-juce
enkerli-juce/tools/suite-build all
```

`suite-build` clones what it needs into the same parent: music-suite, every
plugin repo, **JUCE** (when the machine has no system one — Linux has no
standard location), and **clap-juce-extensions**. It then `npm install`s the
monorepo, builds the shared packages, and links `msuite` to this checkout.
`--no-clone` turns the provisioning off if you'd rather do it by hand.

**B. Already cloned** — update and rebuild everything, one command:

```bash
cd ~/code            # ~/Documents/Coding on the Mac
enkerli-juce/tools/suite-build all --pull
```

`--pull` updates music-suite and every selected repo (plus submodules),
builds the shared TypeScript packages, regenerates the two committed WebUI
bundles, and runs `npm install` itself if the monorepo has never been
installed here. Nothing to prepare by hand.

**If you have more than one checkout**, this matters: a global `msuite` is a
link into **one** tree, so building a different one leaves the command running
the old source — and because `@enkerli/upi` loads straight from `src/`, there
is no stale `dist/` to give it away; a notation simply appears not to exist.
(Real case, 2026-07-27: `A(2,2,3,2)` parsed on one machine and not the other
at the same commit — two roots, `~/code` and `~/Coding`, with the link on the
one that wasn't being updated.) `suite-build` now **relinks `msuite` to the
checkout it just built**; `--no-link` opts out. To see where yours points:
`readlink -f "$(which msuite)"`.

**C. Build** (from `~/code`):

```bash
enkerli-juce/tools/suite-build all            # every plugin, this platform's formats
enkerli-juce/tools/suite-build all --ladder   # macOS: + iOS compile + strict auval + pluginval(VST3)
enkerli-juce/tools/suite-build vane           # just one
enkerli-juce/tools/suite-build drawnqurve,serpe --formats vst3,clap   # a subset, chosen formats
enkerli-juce/tools/suite-build --list         # the aliases
```

A `FAILED` in the end-of-run summary is real — scroll up to that repo's
`=== … ===` block for the error. `all` keeps going past a missing or failing
repo, so a partial checkout still builds what it can.

**JUCE** — nothing to do on **macOS** if `/Applications/JUCE` exists (the
standard installer location): it's found automatically. On **Linux** (no
`/Applications/JUCE`) clone JUCE once as a tenth sibling so every repo shares
it instead of each fetching and building its own ~500 MB copy:

```bash
git clone --branch 8.0.13 --depth 1 https://github.com/juce-framework/JUCE ~/code/JUCE
```

`suite-build` points every repo at `~/code/JUCE` when it's there. On **Linux**
also `apt install xvfb` (or your distro's equivalent) — the LV2 build runs the
plugin headlessly for its manifest and needs a display; `suite-build` wraps
that step in `xvfb-run` automatically.

Per-repo signing, iOS device install, layout overrides, and troubleshooting
are in **§4** below.

---

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

The three copy-paste paths (clone-all / update-all / build) are in the
**Quickstart** at the top of this file. This section is the reference behind
them: the sibling layout the tools assume, how to override it, and what each
build flag does.

### 4.0 The sibling layout, and how the tools find things

The Quickstart's clone step lays down nine repos (ten with a shared JUCE) in
one parent: `enkerli-juce` (the shared CMake foundation), `music-suite` (this
repo — the WebUI source for five of the plugins), and the seven plugin repos.
What the build tools expect, and how to bend it:

- **Verify a fresh checkout** before building anything:
  ```bash
  enkerli-juce/tools/suite-build --list         # aliases → dirs / plugin codes
  enkerli-juce/tools/suite-build all --dry-run  # prints every command, runs nothing
  ```
  A repo reported "not found" either wasn't cloned or isn't a flat sibling —
  fix the layout or set the overrides below.
- **Where plugin repos are found**: as siblings of `enkerli-juce`, i.e.
  `$SUITE_ROOT/<dir>`, where `SUITE_ROOT` defaults to `enkerli-juce`'s parent.
  Override with `export SUITE_ROOT=~/code`. Directory names match
  **case-insensitively**, so a lowercase `vane`/`pitchfold`/`drawnqurve`
  checkout still resolves to the manifest's `Vane`/`PitchFold`/`DrawnQurve`.
- **Both layouts work.** Siblings (`<root>/music-suite` + `<root>/Vane` …)
  is the documented default; **repos nested inside the music-suite checkout**
  (`<root>/music-suite/Vane` …) is detected too — there `SUITE_ROOT` *is*
  music-suite, and the script resolves `MUSIC_SUITE` to it rather than
  looking for a `music-suite/music-suite` that will never exist.
- **Where music-suite is found**: `$MUSIC_SUITE` (default
  `$SUITE_ROOT/music-suite`, or `$SUITE_ROOT` itself in the nested layout;
  override `export MUSIC_SUITE=/path/to/music-suite`)
  — consulted for MIDIcurator's and Progression Studio's WebUI regen. The
  other five plugins find music-suite themselves at CMake time (the
  sibling · nested · `MUSIC_SUITE`-env · `webui.local.cmake` probing in the
  per-repo notes below).
- **Where clap-juce-extensions is found**: `$CLAP_JUCE_PATH` → a repo-local
  `clap-juce-extensions/` → a `FetchContent` download. It carries the CLAP SDK
  as git submodules, so a private copy per repo is the slowest thing in a cold
  build; clone it **once beside the repos** and `suite-build` points every repo
  at it (2026-07-27):
  ```bash
  git clone --recurse-submodules https://github.com/free-audio/clap-juce-extensions ~/code/clap-juce-extensions
  ```
- **Where JUCE is found** (resolution order): a repo-local `JUCE/` dir → the
  `$JUCE_PATH` env var (which `suite-build` sets to `$SUITE_ROOT/JUCE`) →
  `/Applications/JUCE` → a `FetchContent` download of 8.0.13. So
  `/Applications/JUCE` on macOS and a `~/code/JUCE` sibling on Linux both work
  with nothing to configure; set none of them and each repo fetches (and
  builds) its own copy.
- **Submodules self-heal**: the five submodule repos (MIDIcurator, ProgGenie,
  PitchFold, Serpe, workspace-plugin) initialize an empty `enkerli-juce`
  submodule themselves at cmake time (since 2026-07-19), so a plain clone
  without `--recurse-submodules` still builds. Vane and DrawnQurve don't use
  the submodule.

- **The two repos off the shared archetype are where install bugs hide.** Vane
  and DrawnQurve reimplement `EnkerliPlugin.cmake` inline rather than calling
  it, so they do not inherit changes to it — and on 2026-07-29 a sanity check
  found both had the *same* setting wrong, in opposite directions:

  | Repo | `COPY_PLUGIN_AFTER_BUILD` was | Effect |
  |---|---|---|
  | DrawnQurve | hardcoded `FALSE` | **no build ever installed.** `suite-build` reported success while the installed plugin sat three weeks behind its source (AU Jul 13, VST3/CLAP Jul 8, HEAD Jul 27) |
  | Vane | hardcoded `TRUE` | **`--no-install` silently did nothing.** A branch build would still have overwritten the installed plugin — the hazard that flag exists for |

  Both now declare and honour `option(ENKERLI_INSTALL_PLUGINS … ON)`, matching
  the archetype (DrawnQurve `63ee261`, Vane `62a8989`). iOS stays `FALSE` in
  both: a cross-compile has no install location on the build host.

  The lesson for the next change to `EnkerliPlugin.cmake`: **grep Vane and
  DrawnQurve for the same setting**, because nothing else will tell you they
  diverged. A build step that silently does nothing does not fail a build.

- **Checking what is actually installed**: compare the Mach-O *inside* the
  bundle, never the bundle's own timestamp. `.component`/`.vst3`/`.clap` are
  directories, and a directory's mtime changes only when a direct child does —
  which is how a current CLAP can look two days stale (I made that mistake
  before catching it):

  ```bash
  find ~/Library/Audio/Plug-Ins/CLAP/Serpe.clap -type f -perm -u+x -path '*MacOS*' \
    | head -1 | xargs ls -lT
  ```

### 4.1 Build flags

`suite-build <repo[,repo…]|all> [flags]` (full text: `suite-build --help`):

- **bare** — a quick build for this platform (macOS: AU/VST3/Standalone+CLAP;
  Linux: LV2/VST3/CLAP/Standalone).
- **`--ladder`** — the full automatable ladder: macOS build → iOS unsigned
  compile → strict `auval` → `pluginval` (strictness 8, on the VST3). macOS
  only; on Linux it's just the platform build. (The AU is covered by native
  `auval -strict`; pluginval's own AU-component sub-test was dropped 2026-07-22
  — it drove auval through the slow AUAudioUnit bridge and timed out on
  heavy instruments like Vane, while native strict auval passes in ~30s.)
- **`--formats a,b`** — narrow the targets. macOS:
  `au,vst3,clap,standalone` (+ `auv3`, see below); Linux:
  `lv2,vst3,clap,standalone` (no `au` — Apple-only). No effect under
  `--ladder`. A requested format the repo doesn't build **on this platform**
  is reported as a `NOTE:` and skipped, and the rest still build; only a
  request where *nothing* is buildable fails.
  **`auv3` is the iPadOS format**, not a macOS one, for the six archetype
  repos — ask for it there and the script says so and points you at `--ios`.
  Vane is the exception: it declares a macOS AUv3 alongside its AU, so
  `--formats auv3` builds a real target there.
- **`--pull`** — update first: music-suite, then each selected repo and its
  submodules. **`suite-build all --pull` is the whole "update everything"
  command**; it replaces the by-hand nine-repo loop the Quickstart used to
  require. A repo with local changes fails loudly rather than being skipped —
  except the two committed WebUI bundles, generated files the script rewrites
  anyway.
- **`--fresh`** — wipe `build*/` dirs first (catches stale/hollow-bundle
  builds). **`--ios`** — add the iOS unsigned compile to a non-ladder run.
  **`--dry-run`** — print commands, run nothing. **`--no-node`** — skip the
  shared-package build below (only when you know it is current).
- **Every run first builds the shared packages** (`npm run build-packages`
  in music-suite, incremental `tsc -b` — a no-op when current). This is not
  optional politeness: `@enkerli/*` resolve to `packages/*/dist`, and `dist/`
  is **gitignored**, so after a pull that touched theory/ui the MIDIcurator
  and ProgGenie bundles would otherwise be regenerated against *stale* shared
  code — the same staleness class that shipped GloriArp two weeks old, one
  level down. Missing `node_modules` is **installed for you**, not reported as
  homework — "prepare the tree yourself, then call me" is the friction this
  entry point exists to remove.

`all` and comma-separated lists keep going past a missing/failing repo and
print a pass/fail summary. **A rung that fails is reported `FAILED`, never a
silent `OK`** — a repo shows `OK` only if every step that ran succeeded; on
`FAILED`, scroll up to that repo's `=== … ===` block. None of this touches
the Xcode signing/scheme/device-install steps — those stay manual, per repo,
below.

**Shared setup, every repo below:**

- **Prerequisites**: macOS with **Xcode** (for AU/AUv3/iOS builds) or Linux
  with a C++ toolchain; **CMake ≥ 3.22** either way. On Linux also install
  **`xvfb`** (Quickstart explains why). **JUCE and its submodule are handled
  for you** — the resolution order and the shared-JUCE option are in §4.0; a
  plain clone (no `--recurse-submodules`) still builds, because the submodule
  self-heals at cmake time. If a *fresh* clone ever dies with
  `Unknown CMake command "enkerli_resolve_juce"`, that's the pre-2026-07-19
  behaviour — just re-pull `enkerli-juce`.
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
  (macOS build → iOS compile check → strict `auval` → `pluginval` on the
  VST3). Optional but catches most problems before a device does.
- **`suite-build`** (the Quickstart at the top has the clone-everything and
  update-everything walkthroughs) wraps `validate.sh` per-repo and adds the
  Linux LV2/VST3/CLAP/Standalone leg `validate.sh` doesn't cover. It does NOT
  replace the Xcode signing/scheme/device-install steps below — those stay
  manual. Per-repo quick invocations are noted under each heading; the full
  manual commands remain underneath for anything the script doesn't cover.

### MIDIcurator

Quick: `suite-build midicurator --ladder` (add `--fresh` after a stale-bundle
scare). Manual:

```bash
git clone --recurse-submodules https://github.com/Enkerli/midicurator-plugin
cd midicurator-plugin
node WebUI/build.mjs /path/to/music-suite/apps/MIDIcurator   # regenerate the UI bundle
cmake -B build-macos -DCMAKE_BUILD_TYPE=Release
cmake --build build-macos -j 8      # AU + VST3 + Standalone
cmake -B build-ios -G Xcode -DCMAKE_SYSTEM_NAME=iOS -DCMAKE_OSX_DEPLOYMENT_TARGET=16.0
open build-ios/MIDIcurator.xcodeproj   # build MIDIcurator_Standalone, then MIDIcurator_AUv3, to a device
```
`WebUI/index.html` is **committed and does not track the monorepo** — it
is exactly as old as the last time someone ran `node WebUI/build.mjs`.
**Run that step whenever the monorepo's `apps/MIDIcurator` has moved**
(check: `git -C <plugin> log -1 --format=%ad -- WebUI/index.html` vs
`git -C <music-suite> log -1 --format=%ad -- apps/MIDIcurator`). This bit
twice in July 2026: the plugin shipped without GloriArp for two weeks
(ProgGenie's bundle was a month stale the same day). Same rule for
Progression Studio below. `auval -v aumi Mcur Enke` validates.

### Progression Studio (ProgGenie)

Quick: `suite-build proggenie --ladder`. Manual:

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

Quick: `suite-build pitchfold --ladder` (or `--formats standalone,au,vst3`).
Manual:

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

Quick: `suite-build vane --ladder` (macOS), `suite-build vane` on Linux
(LV2/VST3/CLAP/Standalone). Manual — note this uses its own `build-mac`
dir name, independent of the script's `build`:

```bash
git clone https://github.com/Enkerli/Vane
cd Vane
cmake -S . -B build-mac          # AU · VST3 · Standalone (+ AUv3, MTS if present)
cmake --build build-mac --target Vane_Standalone Vane_AU Vane_VST3
cmake -S . -B build-ios -G Xcode -DCMAKE_SYSTEM_NAME=iOS -DCMAKE_OSX_DEPLOYMENT_TARGET=16.0
open build-ios/Vane.xcodeproj    # run Vane_Standalone, then Vane_AUv3, to an iPad
```
On Linux, `cmake -S . -B build-linux` configures an **LV2 + VST3 +
Standalone** build (plus CLAP), no Xcode step — the headless-synth path
(see `docs/JAM.md` in music-suite). Full Linux sequence, valid for any of
the three checkout
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

Quick: `suite-build serpe --ladder`. Manual:

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

Quick: `suite-build drawnqurve --ladder` (macOS), `suite-build drawnqurve` on
Linux. The signing-team fix below still needs doing by hand either way.
Manual:

```bash
git clone https://github.com/Enkerli/DrawnQurve
cd DrawnQurve
# WebUI builds automatically from ../music-suite/apps/drawnqurve during cmake.
cmake -S . -B build-ios -G Xcode -DCMAKE_SYSTEM_NAME=iOS -DCMAKE_OSX_DEPLOYMENT_TARGET=16.0
open build-ios/DrawnCurve.xcodeproj   # run DrawnCurve_Standalone, then DrawnCurve_AUv3, to an iPad
```
DrawnQurve is **cross-platform** (an older claim of iPad-only was wrong —
corrected 2026-07-19 against CMakeLists): macOS builds AU/AUv3/VST3/
Standalone (`cmake -B build-mac && cmake --build build-mac`, verified),
Linux builds VST3/LV2/CLAP/Standalone (`cmake -B build-linux`). The Xcode
project target is named `DrawnCurve` (no "Q") — a historical rename that
would break too many references to undo.

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
this repo has been removed — the repo is the source of truth now).

Quick: `suite-build workspace --ladder` (macOS), `suite-build workspace` on
Linux (LV2/VST3/CLAP/Standalone). Manual:

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

Linux configures LV2/VST3/CLAP/Standalone (verified 2026-07-20 from the staged
copy, same source).

## 4.9 Working on a branch without confusing your builds

Desktop builds **install into the shared user plug-in folders**
(`~/Library/Audio/Plug-Ins/...`), so a branch build silently replaces the
plugin your DAW loads — and nothing on screen says which build it is. This
bit on 2026-07-27: a revert-branch Serpe took over the installed one
mid-session. Three layers, cheapest first:

1. **`--no-install`** — build without copying into the plug-in folders:
   ```bash
   enkerli-juce/tools/suite-build serpe --formats vst3 --no-install
   ```
   Artefacts stay under `build/`, so a host only sees them if you point it
   there. Backed by the archetype's `ENKERLI_INSTALL_PLUGINS` option
   (default ON — normal builds still install). **Use it for every
   experimental branch.**

2. **Test with the Standalone.** It registers nothing and needs no host:
   `build/<Target>_artefacts/Release/Standalone/<Name>.app`. For anything
   you can judge by ear — scenes, progressive patterns, feel — this is the
   cleanest isolation there is.

3. **A worktree per branch**, so main and the branch each keep their own
   checkout *and* their own `build/`, with no rebuild churn when you switch:
   ```bash
   cd ~/Documents/Coding
   git -C rhythm_pattern_explorer worktree add ../serpe-revert serpe/progressive-manager-revert
   ./enkerli-juce/tools/suite-build --root . serpe --no-install   # or build in ../serpe-revert directly
   ```
   Remove it with `git -C rhythm_pattern_explorer worktree remove ../serpe-revert`.

**What isolation cannot give you**: two *installed* AUs of the same plugin
side by side. macOS registers an AU by its four-character code, and those are
forever (`plugin-codes-are-forever`) — changing one to fork a build would
poison host sessions that reference it. VST3/CLAP are path-based and slightly
more forgiving, but the honest answer is: install one build at a time, and use
`--no-install` plus the Standalone for the other.

**If you are ever unsure which build is installed**, compare timestamps:
```bash
ls -ld ~/Library/Audio/Plug-Ins/{Components,VST3}/Serpe.*
git -C ~/Documents/Coding/rhythm_pattern_explorer log -1 --format='%h %s'
```

## 5. If something doesn't match this file

This file is the one meant to stay current — if a plugin repo's own README
says something different, trust this file and fix that README (or flag it).
Everything above was read from each repo's actual `CMakeLists.txt` on
2026-07-19, not reconstructed from memory.

---

## 6. Verified build matrix — 2026-07-19 (Mac, Apple Silicon)

Run via `enkerli-juce/tools/validate.sh` (macOS AU/VST3/Standalone build →
iOS unsigned compile → strict `auval` → `pluginval` s8 on the VST3), after
the day's fixes (WebUI layout probing, submodule auto-init, workspace wasm
loaders):

| Plugin | Result |
|---|---|
| MIDIcurator (`aumi Mcur`) | **PASS** — full ladder |
| ProgGenie (`aumi Prst`) | **PASS** — full ladder |
| PitchFold (`aumi Pqf1`) | **PASS** — full ladder |
| Serpe (`aumi RPEd`) | **PASS** — full ladder |
| Vane (`aumu VAne`) | **PASS** — full ladder |
| Suite Workspace (`aumi Wksp`) | **PASS** — full ladder (after the wasm-loader fix; first run caught it) |
| DrawnQurve | **PASS** — iOS unsigned compile (iPad-only by design) |

Fresh-clone checks the same day: MIDIcurator iOS **BUILD SUCCEEDED** from a
virgin clone; a submodule-less plain clone now self-heals at `cmake` time.
Still human/device territory: signed installs (per-target Signing &
Capabilities), AUv3 registration on iPads, and the Linux legs on the miniPC
(the nested-checkout layout that failed there is now auto-detected — re-run
`git pull` in each plugin repo first).
