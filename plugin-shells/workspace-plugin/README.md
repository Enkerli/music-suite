# Suite Workspace (plugin)

The [music-suite](https://github.com/Enkerli/music-suite) Suite Workspace
webapp (`apps/workspace`) as an **aumi MIDI processor** on the
[enkerli-juce](https://github.com/Enkerli/enkerli-juce) foundation: the
suite's movable modules on one message bus, inside a DAW. Design note:
`music-suite/docs/WORKSPACE_PLUGIN.md`.

What the plugin swaps at the bus's edges (the modules are unchanged):

- **Bus `note` messages exit as real host MIDI** (lock-free
  `LiveNoteScheduler`, tracked note-offs, CC123 on stop) — a looping
  GloriArp groove drives any synth on the next track, live tweaks and all.
- **Host MIDI in feeds the bindings module** (`MidiInCollector`, notes +
  CC): a hardware knob or pad drives any module's params/commands through
  the same @enkerli/control engine the keyboard triggers use.
- **The workspace layout rides the DAW session** (`enkerliState` →
  getStateInformation), with the container's localStorage as fallback.
- The CLI bridge module is browser-only (it says so in the plugin); the
  GloriArp ⬇ .mid uses the native save path (share sheet on iPadOS).

Incoming MIDI **passes through** — a hub sitting mid-chain must not eat
the keyboard; the scheduler's notes are appended.

## Build

```sh
git clone --recurse-submodules https://github.com/Enkerli/workspace-plugin
cd workspace-plugin
# music-suite checked out as a sibling and `npm install`ed (the WebUI builds
# from apps/workspace at cmake time; override via webui.local.cmake).
cmake -B build-macos -DCMAKE_BUILD_TYPE=Release && cmake --build build-macos -j 8
auval -v aumi Wksp Enke                    # AU VALIDATION SUCCEEDED expected
cmake -B build-ios -G Xcode -DCMAKE_SYSTEM_NAME=iOS -DCMAKE_OSX_DEPLOYMENT_TARGET=16.0
open build-ios/Workspace.xcodeproj   # run Workspace_Standalone to an iPad once, then Workspace_AUv3
```

Validation ladder: `enkerli-juce/tools/validate.sh . aumi Wksp`, then real
hosts on ≥2 iPads (enkerli-juce/TESTING.md). Fonts are not embedded (the
suite webfonts 404 under `juce://` and fall back to system faces —
cosmetic, known).

## Suite handoff

This repo is part of the Enkerli music suite. For the whole-suite picture —
repo map, conventions (leftmost-LSB bit order, structural spelling),
build/validation ladders, and open queues — start at the suite handoff:
<https://github.com/Enkerli/music-suite/blob/main/HANDOFF.md>.
