# JUCE independence — what's achievable, what it costs, what it risks

*Assessment drafted 2026-07-01 to inform a medium-term platform decision.
Facts below were measured on the actual repos that day; framework claims
about third-party projects reflect knowledge as of early 2026 and carry a
verification checklist (§6).*

## 1. Where JUCE actually sits today (measured)

Native C++/Objective-C in each repo, **excluding** JUCE itself, generated
JuceLibraryCode, and build trees:

| Repo | Native LOC | What it is |
|---|---:|---|
| enkerli-juce (foundation) | **921** (+216 CMake) | BridgedWebView, MidiClipScheduler, MidiInputCollector, FileImport/FileExport, archetype functions |
| progression-studio-plugin | 1,162 | thin shell over the webapp |
| midicurator-plugin | 1,090 | thin shell over the webapp |
| PitchFold | 4,024 | quantizer engine + shell |
| Vane | 11,942 | synth DSP + shell |
| Serpe | 19,095 | the authoritative rhythm engine (UPIParser, managers) + shell |
| DrawnQurve | 25,204 | JUCE-7 **native UI** + engine (the WebUI in the monorepo is expected to obsolete much of this) |

Already JUCE-free, running in plain browsers today: all ten web UIs, the
whole `@enkerli/*` package layer (theory, ui, midi, webmidi, codegen,
corpus-tools, 847 tests), and — the keystone proof — **Vane's actual DSP**:
`Vane/Tools/wasm/build.sh` compiles the plugin's real `Oscillator`/`SVFilter`
sources to WASM against a ~tiny `juce-stub`, no JUCE linked. The synth that
plays in the browser standalone is the same voice the plugin ships. JUCE's
reach into the *code* is therefore header-shallow; its reach into the
*product* is the shell.

## 2. What JUCE irreplaceably provides right now

1. **Plugin-format packaging**: AU, VST3, AUv3, LV2, Standalone from one
   CMake target. (Notably **not CLAP** — a stated suite goal JUCE only
   reaches via third-party `clap-juce-extensions`.)
2. **WebView-in-editor**, cross-platform (WKWebView / WebView2 / WebKitGTK),
   plus resource serving (`juce://`) — the load-bearing piece of the whole
   WebView-UI architecture.
3. **Host plumbing**: AudioPlayHead transport, parameters/state chunks,
   real-time MIDI I/O in plugin context.
4. **Scar tissue**: the archetypes encode hard-won host quirks (Logic's
   silent AU rejection, AUv3 registration ritual, iOS orientations /
   background audio, plugin-codes-are-forever). Some of this is
   JUCE-specific; the *knowledge* (TESTING.md, DEVICE_TESTING_CHECKLIST.md)
   is framework-agnostic.

Also relevant: JUCE 8 is AGPLv3-or-commercial. Suite sources are Public
Domain and public, so AGPL compliance is trivially met — but the shipped
*binaries* can never themselves be Public Domain while JUCE is linked.
That is a philosophical cost, not a legal risk, and it is one of the few
arguments for full independence rather than thinning.

## 3. The options

### Option 0 — Keep JUCE, keep thinning (the current trajectory)
Effort ≈ 0. The architecture already guarantees the lock-in cannot deepen:
UI, theory, and DSP live outside; the bridge (`enkerli-bridge.js`) already
abstracts JUCE vs WebMIDI vs no-MIDI, so a different shell is a new bridge
backend, not a UI rewrite. **Risks:** binaries stay AGPL-encumbered; JUCE 8
churn; no native CLAP.

### Option 1 — Desktop shells on CLAP (the pragmatic middle)
Write the shell against **CLAP** (MIT, stable C ABI), get **VST3 + AUv2 +
Standalone** via `free-audio/clap-wrapper`; embed the UI with **choc**'s
single-header WebView (ISC; WKWebView/WebView2/WebKitGTK). Re-implement the
enkerli-juce surface — bridge events, transport snapshot, params, state,
MIDI collector, file dialogs — against those APIs.

- **Effort (solo, agent-assisted):** foundation **3–6 weeks**; then per app:
  ProgGenie/MIDIcurator **2–4 days each** (the 1.1k-LOC shells are the
  proving ground), PitchFold **~1 week**, Serpe **2–3 weeks**, Vane **2–3
  weeks**, DrawnQurve last and only after its WebUI migration completes.
- **Gains:** native CLAP (goal met), no AGPL on desktop binaries, smaller
  artifacts, one fewer big-framework dependency.
- **Losses/gaps:** **LV2 is not covered** by clap-wrapper — Patchbox/MOD
  needs either retained JUCE LV2 builds, DPF, or a hand-rolled LV2 shell
  (LV2 is a plain C API; moderate but real work). **AUv3/iPadOS is not
  covered at all.**
- **Risks:** clap-wrapper's AUv2 target maturity (verify, §6); re-earning
  host-compat scars under a new shell (mitigated by pluginval + the
  framework-agnostic testing ladder); WebView-in-host quirks resurfacing
  (the opaque-origin / no-window.confirm / download-manager lessons are
  already documented and port conceptually).

### Option 2 — Full independence, including iPadOS
Option 1 **plus** a native Swift/Obj-C **AUv3 app-extension shell** hosting
WKWebView and the C++ engine directly. Technically well-trodden by others,
but this is where the suite's hardest-won scars live (registration ritual,
background audio, orientations, App Group sandboxing) and they would be
re-won under a new shell. **Effort:** +3–4 weeks foundation, then days per
app. **Total full-independence estimate: ~3–5 focused months** solo across
all six plugins. Note the recurring iOS **signing-account lapse is not a
JUCE problem** and survives any framework change.

### Option 3 — DPF as a single alternative framework
DISTRHO Plugin Framework (ISC): LV2 + VST2/3 + CLAP (+ AUv2, newer).
Covers the LV2 gap in one framework and is permissive. **But:** no AUv3,
WebView support is not first-class, smaller community than either JUCE or
raw-CLAP-land. Worth a look mainly as the **LV2 answer** inside Option 1.

## 4. Recommendation

**Hybrid, staged, everything shippable at every step** (the same rule the
phases used):

1. Treat **Option 0 as the safe resting state** — the architecture is
   already at the point where JUCE is a replaceable ~1k-LOC-deep shim for
   four of six plugins. If little dev time follows July 2026, nothing
   worsens by waiting.
2. When shell work resumes, run **Option 1 with ProgGenie as pathfinder**
   (smallest shell, device-verified webapp, low blast radius — the same
   role PitchFold played for the WebView pattern). Success criteria: same
   UI bundle, bridge backend swapped, pluginval + in-host pass.
3. **Keep JUCE for AUv3/iPadOS** until the desktop foundation has hardened
   — iPadOS is precisely where JUCE earns its keep. Revisit Option 2 only
   after ≥2 desktop apps ship on the new shell.
4. Keep LV2 via retained JUCE builds (or evaluate DPF) so Patchbox never
   regresses.

The medium-term "right spot," concretely: **CLAP+VST3+AU desktop shells
with zero JUCE, JUCE-shelled AUv3 on iPadOS, identical web UI everywhere.**
Estimated path there: ~6–10 weeks of focused shell work after the
foundation spike, spendable incrementally app-by-app with no big-bang.

## 5. What this changes about the code today

Nothing structural — that is the point. Two cheap disciplines protect the
option: (a) keep everything new out of the shells (the 1k-LOC ceiling for
thin apps is a feature); (b) keep `enkerli-bridge.js` the *only* place UI
code learns what shell it lives in.

## 6. Verification checklist (before committing to Option 1)

- [ ] `free-audio/clap-wrapper`: current AUv2 target status, auval results
      on a toy plugin, standalone wrapper state.
- [ ] `choc` WebView: maintenance status; message-bridge ergonomics vs the
      existing event contract; Linux (WebKitGTK) behavior in plugin hosts.
- [ ] DPF: AUv2 export maturity; whether its LV2 target covers the
      Vane `modgui/` pattern.
- [ ] One-day spike: BridgePilot-equivalent on CLAP + choc (macOS), i.e.
      the same role BridgePilot played for enkerli-juce.
- [ ] Confirm Serpe's engine sources compile shell-free (they are plain
      C++, but prove it the way `vane-dsp.cpp` proved Vane's).
