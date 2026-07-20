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
