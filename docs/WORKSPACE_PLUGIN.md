# Workspace as plugin — design note

*2026-07-20, from the user's "Big ask: Workspace as plugin." Audit-first,
per the house rule. The verdict up front: this is the CHEAPEST plugin in
the suite to build, because everything hard already exists — the shell is
the midicurator-plugin pattern (~250 LOC of C++), the bundle is already
plugin-safe (classic script, no module tags, CSS inlined), and the bus was
designed for exactly this kind of transport swap.*

## 1. What the Workspace plugin IS

The suite's hub as an **aumi MIDI-effect plugin** (AU/VST3/AUv3/LV2/CLAP/
Standalone via the enkerli-juce archetype): modules on one bus, inside a
DAW. What changes is what the bus's edges connect to:

| Bus edge | Browser | Plugin |
|---|---|---|
| `note` messages out | Vane tab (BroadcastChannel) | **the plugin's MIDI out** — host-routed to ANY synth, including the Vane plugin on the next track |
| MIDI in | — (never wired) | **host MIDI in → the bindings module**: a hardware knob/pad drives any module's params/commands (the control-map layer, finally fed real MIDI) |
| CLI bridge | SSE to localhost:8765 | browser-only (module says so) — the plugin IS the bridge |
| Persistence | localStorage | localStorage **and** DAW session (state mirrored over the bridge) |
| Tempo | typed bpm | host transport chip; GloriArp adopts host bpm |

The payoff scenario: GloriArp module looping in the Workspace plugin on a
MIDI track, its live groove (variety/pocket/morph, tweaks at pass
boundaries) driving a synth on the next track, hardware controller mapped
through the bindings module — **the whole control plane, in a DAW, on an
iPad**.

## 2. Repo & build (the established pattern, applied verbatim)

- **New repo `Enkerli/workspace-plugin`** — WebUIs live in the monorepo,
  C++ shells in their own repos (HANDOFF §2; deliberate).
- Shell modeled on **midicurator-plugin** (BridgedWebView + event map +
  TransportSnapshot; ~250 LOC), with the WebUI built at configure time
  from the **monorepo sibling checkout** (the Serpe CMake pattern:
  `WORKSPACE_WEBUI_DIR` + `webui.local.cmake` override; esbuild emits
  bundle.js, index.html embeds from source — no committed artifacts).
- Identity (forever): `PLUGIN_CODE Wksp`, `BUNDLE_ID
  com.enkerli.workspace`, product name "Suite Workspace".

## 3. The bridge contract (all of it)

JS → C++:
- `uiReady` — handshake; C++ answers with `state`.
- `noteOut { notes:[..], velocity, durationMs, channel? }` — a bus `note`
  message crossing to MIDI. Scheduled by a small lock-free
  LiveNoteScheduler (message thread pushes, processBlock drains, note-offs
  tracked by sample time — Serpe's activeNotes discipline; CC123+explicit
  offs on stop). MidiClipScheduler is NOT used: it is host-beat-synced
  clips, and the workspace's groove player is its own clock by design
  (live loops, pass regeneration).
- `allOff` — panic/stop path.
- `enkerliState { json }` — the layout+module state (same JSON as
  localStorage), stored via getStateInformation → DAW session.
- `enkerliSaveFile { name, b64 }` — GloriArp's ⬇ .mid via native save
  (blob downloads kill WKWebView — TESTING.md).
- `enkerliOpenFile { patterns }` — GloriArp's ⬆ import .json via native
  open (`<input type="file">` is as unreliable under WKWebView as blob
  downloads — enkerli-juce FileImport.h; the same trap MIDIcurator hit
  first). Answered by `fileOpened` below; nothing fires on cancel.
- `log` — console mirror.

C++ → JS:
- `state { json }` — session-restored workspace state, after uiReady.
- `transport { bpm, playing }` — 10 Hz, change-deduped by the page.
- `midiIn { kind:"note"|"cc", note?, cc?, value?, velocity?, channel }` —
  host MIDI in, drained from the audio thread by a ring collector.
  enkerli-juce's MidiInputCollector carries notes only; the plugin carries
  an extended collector (notes + CC) locally — upstreaming it to the
  foundation is noted as a follow-on, not done under this slice.
- `fileOpened { name, b64 }` — the chosen file, base64. GloriArp's import
  filters to `.json` (another module could claim `.mid` on the same
  channel later, MIDIcurator-style).

## 4. Webapp changes (monorepo, plugin mode)

- `apps/workspace/juce-bridge.js` — IN_PLUGIN detection + emit/on (the
  Serpe wrapper, trimmed).
- Bus tap: every `note` message published on the bus ALSO emits `noteOut`
  in plugin mode (the GloriArp module needs zero changes to sound through
  the host).
- `midiIn` events → `engine.handle({kind:"midi-cc"|"midi-note", …})` in
  the bindings module (the @enkerli/control engine already speaks these —
  the workspace just never had a MIDI source).
- Bridge (CLI) module: in plugin mode renders a "browser-only" note (a
  WKWebView fetch to localhost from the juce:// scheme is exactly the
  kind of thing TESTING.md says never to assume — not attempted).
- GloriArp ⬇ .mid → bridge saveFile when in plugin.
- GloriArp ⬆ import .json → bridge openFile when in plugin (falls back to
  `<input type="file">` in the browser); `juceOn` now fans one real backend
  subscription per event id out to any number of JS callbacks and returns
  an unsubscribe function, so a module torn down and rebuilt (a bento
  resize) doesn't stack duplicate listeners.
- State: save() keeps writing localStorage AND mirrors to `enkerliState`;
  at startup in plugin mode, module creation waits briefly (400 ms cap)
  for the session `state` event — DAW session wins over the container's
  localStorage; a fresh session falls back to it.
- Host chip in the topbar: bpm + playing from `transport`.

## 5. Explicitly out (v1)

- Cross-INSTANCE bus (two Workspace plugins, or plugin ↔ browser tab):
  BroadcastChannel scope inside a WKWebView container is unverified; the
  suite's SysEx transport is the principled route later.
- Vane/Serpe control-surface manifests driving OTHER plugins' parameters
  via MIDI out (needs the SysEx transport in the receiving plugins).
- App Group shared container on iPadOS (standalone and AUv3 keep separate
  localStorage, same as MIDIcurator's documented state).

## 5b. Field notes — 2026-07-19 (Alex, queued for the next plugin pass)

- **DAW sync.** The plugin should follow host transport (tempo + play
  state) the way ProgGenie does — GloriArp/player loops locked to the
  host beat, not a free-running clock. The foundation's
  `TransportSnapshot` is the carrier.
- **Keep playing with the GUI closed.** Today the bus and the module
  logic live in the WebView, so closing the editor stops the music. The
  playback-critical state (active loop, scheduler feed) must move to the
  processor side (C++ owns the loop; the WebView is a *view* of it) —
  the same lesson as MIDIcurator's file-backed library: the WebView is
  not a place to keep running state.
- **Control Surface should control Vane** — the module's gestures out as
  bus/MIDI the Vane instance (plugin or tab) responds to; pairs with the
  §5 "control-surface manifests driving other plugins" item, but the
  Vane pairing is the concrete first target.
- **Recorder saves the tape as a MIDI file** — the captured bus
  performance exports as an SMF through the native save path (browser
  download / share sheet), like GloriArp's ⬇ .mid.
- **Workspace webapp MIDI edges:** real **MIDI out** (route bus notes to
  a hardware/virtual port for further processing) and **MIDI in**
  (controllers and note input — including feeding **GloriArp's learn
  mode** from a keyboard) via `@enkerli/webmidi`, standalone-gated as
  in Serpe/PitchFold.

## 6. Verification here vs. by a human

Buildable and testable in this environment: the webapp plugin-mode logic
(vitest, fake `__JUCE__`), the full plugin compile on Linux (LV2 +
Standalone, the same toolchain Serpe's poly work used). NOT verifiable
here, per TESTING.md: WKWebView rendering, AUv3 registration, host MIDI
routing, share-sheet export — the device ladder is the user's, as always.
