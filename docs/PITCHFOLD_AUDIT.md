# PitchFold feature audit (KNOWLEDGE_TRANSFER.md item 8)

*2026-07-20. Deliverable per the KT brief: an audit, not code — nothing in this
document changes behavior. Alex's framing: features "thrown together
haphazardly"; voice splitting is the named promotion candidate.*

## Method

Read the whole webapp (`apps/pitchfold/**` — engine, control plane, UI panels)
and cross-referenced every parameter and mode against the real plugin's C++
source (`Enkerli/PitchFold`, added to this session: `Source/PCS/PCSEngine.h`,
`Source/PCS/ScaleData.h`, `Source/Quantizer/{VoiceProcessor,TimeQuantizer,
DelayBuffer}.h`, `Source/Pads/ChordPadBank.h`, `Source/PluginProcessor.cpp`,
`Source/WebUI/PitchFoldEditor.cpp`, `Source/UI/*.h`). For every entry in
`PARAM_MAP` (`apps/pitchfold/juce-bridge.js`) I traced: is there a UI control
for it? does the JS engine read it? does the C++ engine read it? Findings
below are evidence-based (file:line on request), not impressions — several
contradict what the KT note already assumed, which is itself a useful result.

## Headline findings (read this first)

1. **Voice splitting earns its promotion.** `VoiceMode.VoiceSplit` is small,
   correct, C++/JS parity confirmed, and genuinely engine-agnostic (note in,
   `{note,channel}[]` out). Good candidate for a shared module.
2. **Three parameters are pure theater** — automatable from a DAW host,
   visible in the UI (two of them), and provably zero-effect in *both*
   engines: **Mono Merge** (a whole voice mode + 4 sub-modes), **Swing**
   (a Time-tab slider), and **Snap Strength** (host-automatable, no UI at
   all). Someone maps a controller to "Snap Strength" expecting a gradient
   and gets nothing.
3. **Pad selection is 100% cosmetic in the standalone webapp** — worse than
   the KT note's "unresolved" suggested. Tapping a pad changes which button
   glows and fires a no-op JUCE event; the actual quantizer keeps reading the
   main scale. In the real plugin, pads work correctly.
4. **The whole Time tab is inert in the standalone webapp.** There's no JS
   time-quantizer twin at all (only pitch + voice engines were ported) — five
   of six Time params do nothing outside the real plugin.
5. **~1,500 lines of dead native-UI C++**, pre-dating the WebView migration,
   never compiled into anything. Safe to delete.
6. **A stale doc comment** in `PCSEngine.h` documents the wrong (pre-harmonization)
   bit order — the code is correct, the comment would mislead the next person
   who trusts it over the code.

## By tab

### Scale (PCS + Quantizer)

| Feature | Status | Note |
|---|---|---|
| Root/mask editing (wheel, lattice, mask input, scale bank) | **Real** | Full per-note toggling; C++/JS parity confirmed |
| Snap direction (Auto/Nearest/Up/Down) | **Real** | Identical branching in both engines |
| Output range | **Real** | Clamped correctly both ends |
| `useFlats` | **Real** | Cosmetic (note-name spelling), works as intended |
| `quantStrength` ("Snap Strength") | **Dead** | See below |

`quantStrength` is registered as an automatable APVTS parameter ("Snap
Strength") — a host can map a knob to it. But `quantize()`'s call site in
*both* `PluginProcessor.cpp` and `main.jsx` never passes it through (the
function's own `strength` argument silently defaults to full-strength 1.0
at every call site). There's also no UI slider —
`quantizer-panel.jsx` explicitly comments "Strength is hidden (reserved for
future probability/histogram features)." The engine already supports partial
blending (`quantize()` takes `strength` and blends toward the snapped note);
wiring it is two one-line call-site changes plus a slider. **Recommend:
either wire it (cheap, and it's already a real host-automatable param
someone might be surprised isn't doing anything) or remove the APVTS param
so host automation doesn't silently no-op.**

### PickPCS (embedded explorer)

A self-contained ~354-line reimplementation "adapted from PickPCS" (the
standalone `apps/PickPCS` app) — concentric-ring browsing by note-count,
drilling into chord subsets. Verified independently: correct bit-mask
emission, consistent with the suite convention. **Real, keep.** Flag for
later: this duplicates logic that already exists in `apps/PickPCS` — two
implementations that can drift. Not urgent; worth folding into KT item 6
(shared library) rather than fixing now.

### Pads

| Feature | Status | Note |
|---|---|---|
| 16-pad bank (mask/root/label storage, radio select) | **Real** | |
| Pad editor | **Real, but crude** | 3 buttons: copy-main / all / root-only — no per-note toggling |
| Pad-override in plugin | **Real** | `ChordPadBank::activeMask/activeRoot` correctly resolve |
| Pad-override in standalone webapp | **Dead** | See below — the top actionable bug in this audit |
| MIDI-triggered pad switching | **Dead code** | `setTriggerNote`/`padForNote` never called anywhere |

**Pad-override in the standalone is broken, not just "unresolved."** In
`main.jsx`, selecting a pad only updates `state.pads[].selected` (which
button glows) and forwards a no-op `sendSelectPad` JUCE event; the actual
quantizer (`handleNote()`) always reads `state.pcsMask`/`state.pcsRoot`
directly and never resolves through the selected pad's own mask/root. In the
real plugin, `ChordPadBank::activeMask(mask)`/`activeRoot(root)` do this
correctly every block. Net effect: **pads work in the plugin and do nothing
audible in the browser standalone** — tap a pad, nothing changes. This is
the single most likely thing to make someone think the whole app is broken
when trying it as a webapp. Not code-audit scope to fix here, but it's the
clearest, highest-value fix on this list.

The pad editor's own comment calls its mask control "simplified" — it can
copy the main scale, go chromatic, or go root-only, but can't compose an
arbitrary custom PCS the way the Scale tab's wheel/lattice can. Worth
reusing that same component in the pad editor someday; not urgent.

`ChordPadBank::setTriggerNote`/`padForNote` (map an incoming MIDI note to a
pad recall) are declared and fully implemented but never called from
anywhere in the plugin or the webapp — grepped both repos, zero hits outside
the declaration. Pure dead code (plus a latent uninitialized-array read in
`_triggerNotes` that's harmless only because nothing ever calls
`padForNote`). **Drop, or finish it** — it's a small, well-scoped feature if
wanted.

### Voice

| Mode | Status |
|---|---|
| Through | **Real** |
| Poly Spread | **Real**, C++/JS parity confirmed |
| Chordize | **Real**, C++/JS parity confirmed |
| Voice Split | **Real**, C++/JS parity confirmed — **the promotion candidate** |
| Mono Merge | **Dead** — the headline finding |

**Voice Split** is clean: round-robin channel distribution, correctly
clamped to MIDI channels 1–16, stateless aside from one rotating index,
zero PitchFold-specific coupling beyond "note in, `{note,channel}[]` out."
**Recommend promoting it to a shared module** — Vane poly and Workspace are
reasonable first adopters, per the KT note.

**Mono Merge is the clearest "thrown together" feature in the app.** The UI
is fully built: a mode button plus four sub-mode buttons (Last / Lowest /
Highest / First — `MONO_MODES` in `voice-panel.jsx`), backed by a real
`MonoSelect` enum and `monoSelect` APVTS parameter on the C++ side. But
`VoiceProcessor::processMono()` — in *both* the C++ engine and the JS
twin — discards the config and passes every note straight through,
byte-identical to Through. The C++ source even has a comment claiming
`monoSelect` "used in the higher-level routing layer" (`VoiceProcessor.h`);
that layer doesn't exist anywhere in the codebase — grepped the whole
plugin repo. A user selecting "Mono Merge → Lowest" gets ordinary
polyphonic pass-through with no indication anything is wrong. **Either drop
the mode (simplify Voice to 4 real modes) or implement it properly**
(genuine note-stealing + monoSelect priority logic, in both engines) — the
half-built silent-no-op state is the worst of the three options.

### Time

| Feature | Plugin | Standalone webapp |
|---|---|---|
| Grid snap + strength | **Real** | **Dead — no JS engine exists** |
| Humanize time/velocity | **Real** | **Dead — no JS engine exists** |
| Look-ahead (delay buffer) | **Real** | Not attempted (reasonable scope boundary, see below) |
| Swing | **Dead in both** | **Dead in both** |

Grid snap, strength, and both humanize params are genuinely implemented and
correct in `TimeQuantizer::applyGrid()` (verified: every one of those fields
is read and applied). But **there is no JS port of the time engine at
all** — only `pcs.js` and `voices.js` exist under `apps/pitchfold/engine/`.
The whole Time tab's five active sliders update React state that only ever
gets sent toward a JUCE backend; in the standalone browser build there's no
backend to send it to, so nothing about note timing or velocity is ever
touched. This is a bigger gap than the pad-override wart (it takes out 5 of
6 Time params, not one pad interaction) and wasn't previously flagged in the
KT note.

`lookAheadMs` (backed by `DelayBuffer`, a real fixed-latency MIDI queue) is
correctly implemented in the plugin and reasonably scoped as plugin-only — a
live WebMIDI stream can't "look ahead" without literally adding the same
output latency, which the webapp doesn't attempt. That's a defensible
boundary, not a bug, unlike the rest of the Time tab.

**Swing is dead even inside the plugin.** It's a real APVTS param, has a
working UI slider (`time-panel.jsx`, 0–100%, "Straight"/"N%"), and is read
into `TimeConfig::swing` every block in `PluginProcessor.cpp` — but
`TimeQuantizer::applyGrid()` never references `cfg.swing` anywhere in its
body. Same "looks real, does nothing" pattern as Mono Merge and Snap
Strength, just narrower in scope (one slider vs. a whole mode).

## Cross-cutting engine findings

**Stale doc comment, `Source/PCS/PCSEngine.h` lines 8–10**: documents the
*old* MSB-first bit convention ("bit (11−interval) = 1 → interval is
active... bit 11 = unison, bit 0 = major 7th") — the pre-2026-06-28
harmonization scheme. The actual code three lines below (`pcActive`:
`(mask >> interval) & 1`) is LSB-first and correct, matching the sibling
`ScaleData.h`'s comment (which WAS updated) and the JS twin's comment
(also correctly updated). Only this one file's top comment is stale.
Low-risk (the code is right), but a real trap for whoever next implements
something new by reading the header instead of the code.

**~1,517 lines of dead native-JUCE-Component UI**, pre-dating the WebView
migration: `Source/UI/ChromaticWheel.h` (406 lines), `ScaleLattice.h` (393),
`PCSPreview.h` (86) are listed in `CMakeLists.txt` ("Header-only — shown in
Xcode navigator") but `#include`d nowhere — never compiled into the binary.
`IconFactory.h` (632 lines) isn't even in CMakeLists.txt; fully orphaned.
Zero runtime risk since nothing references them, but real repo weight and
IDE noise. Safe to delete whenever someone's next in that area.

## Summary — keep / promote / drop

| Feature | Verdict |
|---|---|
| Scale editing, snap direction, output range, useFlats, PickPCS explorer | **Keep** |
| Voice Split | **Promote** — extract as a shared module (Vane poly, Workspace) |
| Poly Spread, Chordize, Through | **Keep** |
| Pad bank (storage/selection/labels) | **Keep**, but fix the standalone override bug (real code, out of this audit's scope) |
| Pad editor's reduced mask control | **Reconsider** — reuse the Scale tab's wheel/lattice; not urgent |
| Grid snap, humanize, look-ahead (plugin) | **Keep** |
| Time engine, standalone webapp | **Gap** — no JS twin exists; needs a decision (port it, or explicitly scope Time as plugin-only) |
| Mono Merge | **Decide** — drop the mode, or actually implement it; don't leave it silently no-op |
| Snap Strength (`quantStrength`) | **Decide** — wire it (cheap) or remove the automatable param |
| Swing | **Decide** — wire it (needs real triplet-swing offset math in `applyGrid()`) or remove the param + slider |
| MIDI-triggered pad switching (`setTriggerNote`/`padForNote`) | **Drop** — dead code, or finish it as a real feature |
| `Source/UI/{ChromaticWheel,IconFactory,PCSPreview,ScaleLattice}.h` | **Drop** — ~1,517 lines, compiled into nothing |
| `PCSEngine.h` header comment (bit order) | **Fix** — one-line comment correction, no behavior change |

## Follow-up, same day: shipped + the rest of the roadmap

Alex's call: don't leave these on paper — implement what's cheap, roadmap
what isn't. The hunch ("shouldn't be too difficult") held for about half
the list and didn't for the other half; both outcomes are below, honestly.

### Shipped

- **Pad-override in the standalone webapp** — fixed. `apps/pitchfold/engine/
  pads.js` is a small, unit-tested JS port of `ChordPadBank::activeMask/
  activeRoot`; `main.jsx`'s `handleNote()` now resolves through it before
  quantizing. This was correctly sized as small — one pure function, no
  design decision needed, the C++ side already specified the exact
  behavior to copy.
- **`quantStrength` ("Snap Strength")** — wired end-to-end. A visible slider
  in `quantizer-panel.jsx`, threaded through `main.jsx`'s `quantize()` call,
  and the matching one-line fix in `PluginProcessor.cpp` (`Enkerli/
  PitchFold`, not build-verified — no JUCE/Xcode here, but it's the same
  two-line shape as the already-correct call sites around it). Also
  correctly sized as small.
- **`Source/UI/{ChromaticWheel,IconFactory,PCSPreview,ScaleLattice}.h`** —
  deleted (~1,517 lines), `CMakeLists.txt` updated. Zero risk, confirmed
  nothing referenced them.
- **`PCSEngine.h`'s stale bit-order comment** — fixed to match the code and
  its sibling file.
- **Voice Split promoted** to `packages/voice-routing`
  (`@enkerli/voice-routing`, `VoiceSplitter` — round-robin channel
  distribution, 8 tests). PitchFold's own JS engine now imports it instead
  of carrying its own copy (`apps/pitchfold/engine/voices.js`) — proof the
  extraction is real, not just a package that sits unused. Also gave
  `engine/pcs.js`/`voices.js` their first-ever test coverage (37 tests) —
  a gap the original audit didn't even flag, found while touching the file.
- **Workspace modules**, the "might fit well in… the Workspace" ask
  (`apps/workspace/modules.js`, `MODULES["pcs-pads"]`/`["voice-split"]`):
  - **PCS Pads** — a Workspace-native pad bank that broadcasts `scale` bus
    messages, the *exact* contract `apps/PickPCS` already sends and
    `apps/pitchfold/control.js` already listens for. Zero changes needed on
    either side — this interoperates with PitchFold today. Pads are
    populated by "learn" (grab the last `scale` heard on the bus) rather
    than reimplementing PitchFold's own mask editor from scratch — the bus
    already IS the scale-editing surface; this just gives it a memory.
  - **Voice Split** — subscribes to `note` messages from a chosen source (or
    any app) and republishes each on the next channel in the rotation to a
    chosen destination, using the same shared `VoiceSplitter`. Verified
    over the REAL cross-tab transport (BroadcastChannel), not just
    in-memory: injected notes as if from an external `proggenie` instance,
    confirmed correct channel rotation landed on the Bus Monitor.
  - **Found and fixed while building it**: the module-slot state object
    `main.js`'s `addModule()` hands every module already reserves `state.
    span` for panel layout size ("s"/"m"/"l"). Voice Split's own channel-span
    field collided with it — the string `"s"` landed silently in a
    `type=number` input, which renders blank rather than erroring. Renamed
    to `channelSpan`. Worth remembering for the NEXT module that wants a
    field named `span`, `app`, `upi`, `id`, or `type` — those five are the
    module-slot's own reserved keys.
  - **Known scoping limit, not a bug**: every Workspace-originated message
    (Pattern Player, GloriArp, Recorder, and now Voice Split's own output)
    publishes with the same `from: "external"` identity — there's no
    per-module address. Voice Split's loop-guard (never re-process a
    message it sent itself) is therefore also, incidentally, a wall against
    ever reacting to another *same-workspace* module's notes — it only sees
    genuinely external sources (a real PitchFold/ProgGenie instance, the CLI
    bridge). Chaining Voice Split after e.g. the Pattern Player, in the same
    canvas, doesn't work today. Fixing that needs per-module addressing on
    the bus — a real design question, not this session's to decide
    unilaterally; flagged for whoever picks up KT item 6 (shared library /
    bus architecture).
  - 6 new render/module tests (`pcsPadsModule`, `voiceSplitModule`),
    verified live via Playwright against real dev builds of both
    `apps/pitchfold` and `apps/workspace`.

1442/1442 monorepo tests after all of the above (up from 1373 at session
start; +69 across `voice-routing`, `pitchfold/engine/{pcs,voices,pads}`,
and the two new Workspace modules).

### Still on the roadmap — sized honestly

| Item | Size | Why |
|---|---|---|
| **Mono Merge** — implement real note-stealing + `monoSelect` priority (Last/Lowest/Highest/First) | **M**, both engines | The spec already exists and is unambiguous (standard mono-synth priority modes) — genuinely not a product-taste question, just real work: track currently-held input notes, decide the sounding note on every on/off using the priority rule, and correctly re-trigger the next-priority note when the current one releases. That note-off interaction is the part that isn't "small" — it's real, if bounded, DSP-adjacent logic in two engines. **Alternative, cheaper**: drop the mode and its 4 sub-buttons entirely (S). Needs a call either way before touching code — this is the one item where "shouldn't be too difficult" doesn't fully hold if "implement it for real" is the choice. |
| **Swing**, real triplet-swing offset in `TimeQuantizer::applyGrid()` | **S–M**, plugin only | Bounded and well-understood (push every other grid-aligned event late by `swing × offset`), but it's C++ DSP-timing code this container can't build or hear — real risk of a subtle off-by-one in the grid math going unverified. Correctly sized as small in the original audit; the *verification* gap, not the implementation, is what makes this not a same-session task. |
| **Time engine, JS port for the standalone webapp** | **L** | The audit's biggest surprise, and the one place the "shouldn't be too difficult" hunch is wrong. `TimeQuantizer` is sample-accurate, block-based DSP (`applyGrid()` reasons in samples-per-block against a host PPQ clock); the webapp has no audio block callback at all — its note path is direct WebMIDI send-now. A port isn't a mechanical translation like `pcs.js`/`voices.js` were; it needs an actual scheduling model (something `setTimeout`-based, reasoning in wall-clock ms against a locally-tracked tempo instead of PPQ) — closer to designing a new subsystem than porting one. Recommend treating this as its own slice, not a quick fix, and deciding first whether the standalone even needs full DSP-grade timing or a simpler ms-based approximation is enough. |
| **MIDI-triggered pad switching** (`ChordPadBank::setTriggerNote`/`padForNote`) | **S**, plugin only, if wanted | The dead code already has the right shape (`padForNote(midiNote)` → pad index); wiring it is a few lines in `PluginProcessor.cpp`'s note-on handler PLUS one product decision: should a trigger note also sound (quantized/routed normally) or only silently select the pad? That decision, not the code, is what's actually open. |
| **Pad editor** — reuse the Scale tab's wheel/lattice instead of the 3-button shortcut | **M**, webapp UI | Real UI work (extracting `ChromaticWheelSVG`/`NeutralLattice` from `scale-editor.jsx` into something both panels can mount), not a quick win — correctly flagged as "not urgent" in the original audit. |
| **PickPCS embedded explorer** — fold the duplicated logic into a shared package | **M**, ties to KT item 6 | Not urgent on its own; bundle it with whatever shared-library work KT item 6 does, rather than a standalone slice. |

Net read on the hunch: pure "wire an existing, unambiguous engine value
through to where it's already read" (pad-override, Snap Strength) and pure
cleanup (dead headers, stale comment, promoting an already-clean
algorithm) really were cheap — that's most of what's now shipped. What
wasn't cheap were the two places where the JS twin was never just a port
in the first place: Mono Merge (needs new stateful logic, not present in
either engine) and the Time engine (needs a different SCHEDULING MODEL,
not a translation). Both are real, scoped, buildable — just not
same-session-cheap.

### Reprioritized, 2026-07-20: roadmap, not this pass

Alex's call: Mono Merge, Swing, and the Time engine made sense as
priorities at the time — part of the original brief's inspiration was
PageFail's "Cality" AUv3, which leans on exactly this kind of
mono/timing-feel shaping. But with how the rest of the suite has
unfolded since (Workspace becoming the cross-app integration surface —
`voice-split`/`pcs-pads` modules, the bus-native "learn from whatever's
playing" pattern), these three specific PitchFold-internal engine
features may not be the highest-value use of the next slice of effort.
Staying on the roadmap, explicitly not descoped — just not assumed to
be next. Worth reconsidering **as Workspace features** instead of (or
before) PitchFold-internal ones when someone does pick this up: e.g. a
Workspace-level "hold to mono" note-router (the same shared-module
instinct that produced `voice-split`) might deliver Mono Merge's actual
value — priority-based note selection — to every app on the bus at
once, rather than rebuilding it twice inside one plugin's two engines
for PitchFold alone.

**Mono Merge: done, 2026-07-21 — exactly that Workspace module.** Real
priority-based note-stealing (`@enkerli/voice-routing`'s new `MonoMerge`
class: Last/Lowest/Highest/First, the same four sub-modes this doc named
above — track held notes, decide the sounding one on every on/off,
correctly re-trigger the next-priority note when the current one
releases), wired into a new `mono-merge` Workspace module
(`apps/workspace/modules.js`) behind a momentary hold-pad gesture
(docs/DESIGN_AGENT_ANSWERS.md §4). PitchFold's own two engines are
UNTOUCHED — this doesn't retrofit `VoiceProcessor::processMono()`,
it delivers the value at the bus level instead, reaching every app at
once rather than one plugin. PitchFold's `voiceMode`/`monoSelect` params
remain exactly the theater this audit found; nothing here changes that
finding, it routes around it. Full writeup: `docs/DESIGN_AGENT_ANSWERS.md`
§4's implementation notes.
