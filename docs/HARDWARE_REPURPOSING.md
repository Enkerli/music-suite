# Repurposing Artiphon and ROLI hardware

*Parked 2026-11-26 — planning for later, not current work. Nothing here
overrides [PRIORITIES_2026-08.md](PRIORITIES_2026-08.md) or the integration
moratorium in [HANDOFF.md](../HANDOFF.md) §1. It inherits every rule in
[CONVENTIONS.md](../CONVENTIONS.md), leftmost = LSB above all (see §4.1).*

*Source: an exploratory research note. Every claim about third-party
projects, chips, protocols and companies is **unverified here**: the list
in §11 has to be checked before any of it gets relied on. The interactive
widgets and diagrams in the original note did not survive; their content
is carried as tables and prose.*

---

## 0. The idea in one paragraph

Separate **firmware replacement** from **deep programmability**. Deep
programmability probably gets most of the goal: custom scales, chords,
pitch-class-set selection, adaptive voicing, MPE, just intonation. It does
that without re-engineering sensor processing, gesture recognition, the
Bluetooth stack or the sound engine. Build it as a **device-independent
musical behaviour layer** (§6) with a backend per device, so the work is
one branch of the suite rather than six unrelated hacking projects. That
makes it a sibling of the FM-1 work in `mvane-yard` and a client of
[CONTROL_PLANE.md](CONTROL_PLANE.md).

## 1. Four levels of control

| Level | Approach | Potential |
|---|---|---|
| 1 | Unofficial configuration tools | Custom scales, chords, sounds, MIDI mappings |
| 2 | Reverse-engineered communication protocol | Arbitrary configuration, live control, alternative companion apps |
| 3 | On-device code or firmware modification | Autonomous musical behaviours, new performance modes |
| 4 | Complete replacement firmware | Full control of sensors, synthesis, MIDI, interaction |

**Level 3 is the sweet spot.** It keeps the manufacturer's sensor
calibration, gesture recognition, MPE implementation and BLE-MIDI.

## 2. Feasibility at a glance

Qualitative estimates (1–5), not measurements. A low score means a barrier
or missing documentation, not impossibility.

| Device | Config | On-device code | Firmware | Basis |
|---|:-:|:-:|:-:|---|
| Orba 1 | 5 | 2 | 4 | Recovered firmware; existing chord/scale editors |
| Orba 2 | 5 | 1 | 1 | Documented protocol; encrypted main firmware |
| Instrument 1 | 2 | 1 | 1 | Largely unexplored |
| ROLI Control Blocks (Live, Loop, Touch) | 4 | 2 | 2 | Shared BLOCKS protocol; autonomous scripting unverified |
| Lightpad Block | 5 | 5 | 2 | Littlefoot runs on the device |
| Lightpad Block M | 5 | 5 | 2 | Littlefoot plus a more expressive surface |

**Summary:** ROLI is the quickest route to programmable instruments. Orba 1
is the more compelling native-firmware research target. They complement
each other.

## 3. Artiphon

### 3.1 Orba 1: the firmware candidate (two units on hand)

Reported by the **Artiphon preservation project** (Jay Lee): firmware
recovered, a partly working hardware emulator, and the architecture mapped.

| Component | Reported |
|---|---|
| Main MCU | STM32F730R8T6 (Cortex-M7, 216 MHz) |
| Internal / external flash | 64 KB / ~512 KB |
| Wireless | ESP32-SOLO-1 |
| Touch | Cypress PSoC |
| Main firmware | Bare metal, no RTOS |
| Audio engine | ~124 KB, executed from RAM |

**Intervention point:** leave the ESP32 and PSoC firmware alone and modify
only the musical decision layer on the STM32.

Existing open-source work:

| Project | Relevance |
|---|---|
| `subskybox/Orba` | Custom transposable chord voicings, scales, preset editing (Orba 1) |
| `IanHalbwachs/orba-presets` | Hand-edited XML presets |
| `Batninja/Orba-Preset-Editor` | Alternative preset editing |
| Artiphon preservation | Firmware analysis, hardware investigation, emulation |
| `holofermes/orba-protocol` | Reverse-engineered Orba 2 protocol |
| `holofermes/orba-console` | Independent companion app (Orba 2) |

Custom chords and scales are already possible at the configuration level
(level 1). What would be **new** is making them *performable from the
instrument*, without a companion app.

### 3.2 Orba 2: protocol-first

The Orba 2 uses an NXP i.MX RT processor with hardware AES-128 firmware
encryption, so static analysis is impractical. Whether live debugging is
possible depends on each unit's security fuses, which nobody has checked yet.

The **control protocol** is reverse-engineered (from the Android app, and
checked against hardware). It has MIT-licensed Python and JS
implementations, and the same SysEx payloads work over USB-MIDI and
BLE-MIDI. It covers configuration, key, scale, effects, tempo, transport,
file commands and device registers, with no vendor servers involved. The
Orba 2 already supports sample-based custom instruments, so
reimplementing that workflow independently is realistic.

**Strategy:** Orba 1 → firmware modification *alongside* configuration.
Orba 2 → the deepest possible control through the protocol, i.e. an
independent companion app. That covers everything except autonomous new
behaviours.

### 3.3 Instrument 1: a separate discovery exercise

Least explored. Its guitar-like layout makes it attractive: arbitrary
fingerboard layouts, unusual tunings, adaptive chord fingerings, strumming
across arbitrary PCS. **Don't assume it shares either Orba protocol.**

1. Archive the companion app and firmware packages.
2. Inspect the app for configuration structures and embedded firmware.
3. Capture USB and BLE traffic during parameter changes.
4. Identify the processor and debug interfaces.
5. Find out whether tunings are stored as note tables or generated.

## 4. ROLI: closer to programmable already

**Littlefoot** already exposes notes, pitch bend, channel pressure, poly
aftertouch, CCs, MPE channel allocation, remote device configuration and
touch tracking. **No firmware hacking needed, at least at first.**

| Project | Purpose |
|---|---|
| GRAB | Independent configuration, protocol inspection, discovery. Vendors `roli_blocks_basics` adapted to JUCE 8; portable decoder, CLI, JSON profiles, USB/BLE. **Deliberately excludes flashing and program upload.** |
| `roli_blocks_basics` | Official open-source C++ communication stack |
| Littlefoot API / BLOCKS SDK | On-device programming, documentation |

### 4.1 Control Blocks

The SDK documents button handlers and functions specific to Control
Blocks, so custom behaviour was evidently planned for. **Upload, execution
and persistence still need testing on each model.** First experiment: a
standalone multi-channel MIDI command surface.

```c
// Illustrative Littlefoot, not a tested upload-ready program.
void handleButtonDown (int index) { sendCC (0, 20 + index, 127); }
void handleButtonUp   (int index) { sendCC (0, 20 + index, 0);   }
```

Next steps from there: latching CCs, program/bank changes, transport, mode
switching, chord triggers, snapshots, MPE config, macros. The most useful
role is a **remote performance-mode selector** for another instrument (an
Orba, or an FM-1 running `mvane-yard` firmware).

### 4.2 Lightpad and Lightpad M

Littlefoot gives stable touch IDs, continuous X/Y, pressure and pressure
deltas, plus programmable LEDs. That makes the Lightpad a small, expressive,
reconfigurable musical computer.

| Capability | Feasibility |
|---|---|
| Arbitrary notes, CCs, short MIDI messages | Documented |
| Per-touch MPE channel allocation | Documented |
| Custom layouts, chord generation, PCS selection, JI bends, virtual faders | High |
| Adaptive voice leading; gesture recording/looping | Plausible, resource-limited |
| Inter-Block communication | Supported at API level |
| Arbitrary long SysEx out | **Not established** |
| Persistent custom programs | Supported; test per model |
| Native firmware replacement | Unnecessary for these goals |

ROLI says uploaded apps stay saved on the Block. A BLOCKS API connection
can *temporarily bypass* the saved app, so a standalone programming
utility has to be designed around that. Goal: **replace ROLI Dashboard as
the Littlefoot dev environment**, with a cross-platform compiler/uploader
built on the open stack (the Ubuntu Studio machine is a good host).

## 5. What a customised Orba could do

### 5.1 Pitch-class-set selection on eight pads

All 4096 sets have to be reachable from eight pads.

| Method | Interaction | Trade-off |
|---|---|---|
| Two pages | PCs 0–7, then 8–11 | Complete, needs a page switch |
| Hex | Three digits needed (two aren't enough) | Compact, abstract |
| Four octal digits | Each pad = 0–7 | Complete, four taps, unintuitive |
| Interval entry | Successive intervals around the octave | Musically meaningful |
| Hierarchical browser | Cardinality → set → transposition | PickPCS-like |
| Favourites | Eight stored sets | Best live |

**Proposal:** favourites plus a full two-page editor. The centre button
acts as a modifier to enter the mode, and committing the set returns to
playing.

> **Convention correction.** The original note said the masks were
> "big-endian … C Ionian = 2773". That is the exact error CONVENTIONS.md
> warns about. In this suite pc *i* = bit *i* (leftmost = LSB):
> **C Ionian = 2741 = `0xAB5`**, and 2773 = `0xAD5` is **C Lydian**.
> Any device backend has to use `@enkerli/theory`'s `pcsToDecimal` and
> its vectors, and the octal/hex entry methods above have to follow the
> suite's little-endian digit order. The mode should ship with a
> regression test pinning 2741, so this can't recur on-device.

**Keep the PCS separate from the pad-to-note layout.** Eight pads must
still be able to play sets larger than eight, via octave shifts, banks,
rotations or moving subsets.

### 5.2 Chord modes

| Mode | Behaviour | Example pads |
|---|---|---|
| Chord bank | Eight independent user voicings | Dm9 · G13 · Cmaj9 · A7alt · Fm9 · B♭13 · E♭maj9 · D♭7 |
| Harmonic navigation | Relative functions, transposed to the tonic | I · IIm · IIIm · IV · V · VIm · VIIo · subV |
| Adaptive voicing | Choose a destination; inversion and register follow the previous notes | Imaj7 · IIm7 · V7 · VIm7 · IV7 · ♭VII · V/II · V/V |

Adaptive voicing amounts to an embedded subset of **ProgGenie**. Degree
labels follow CONVENTIONS.md (uppercase numeral + display suffix) and
chord tones are spelled structurally.

Proposed gesture mappings. These are hypothetical: nobody has confirmed
the Orba exposes these sensor callbacks.

| Gesture | Behaviour |
|---|---|
| Tap | Trigger chord |
| Press harder | Brightness / intensity |
| Tilt | Voicing spread |
| Spin | Rotate inversion |
| Slide | Morph to alternate voicing |
| Shake | Rearticulate / strum |
| Centre + pad | Choose chord family |

This turns a chord pad into an *expressive harmonic object* rather than a
fixed note-on macro.

### 5.3 Sound access

There are three separate capabilities: a **librarian** (import, export,
diff, organise, transfer without the vendor app), an **editor** (every
synthesis and modulation parameter, including undocumented ones once
verified), and **performance access** (sound favourites on pads, switching
without a phone). For Orba 1 the priority is the existing engine and its
modulation routings. For Orba 2 it is sample import and instrument
building.

## 6. MPE is non-negotiable

One touch may produce 4–5 independently addressable notes. The musical
layer therefore needs a **voice allocator**, not a pad→channel map. It has
to handle channel reuse, note-off tracking, pitch-bend initialisation,
pressure, timbre, voice stealing, and notes held across scale changes.

With per-note pitch bend, the same machinery gives **just intonation**,
e.g. a pure 4:5:6:7 dominant seventh:

| Note | Ratio | vs 12-TET |
|---|---|---|
| C | 1:1 | 0 ¢ |
| E | 5:4 | −13.69 ¢ |
| G | 3:2 | +1.96 ¢ |
| B♭ | 7:4 | −31.17 ¢ |

This works through an external MPE synth even if the device's own engine
can't play those tunings.

## 7. One behaviour spec, many backends

The goal is a device-independent behaviour description. Shared logic
doesn't mean identical executable code on every processor. Sketch:

```json
{
  "name": "Jazz harmonic navigation",
  "root": 0,
  "pitchClassSet": 2741,
  "voiceLeading": "nearest",
  "tuning": "adaptiveJI",
  "mpe": { "enabled": true, "zone": "lower", "memberChannels": 15, "pitchBendRange": 48 },
  "pads": [
    { "id": 0, "type": "chord", "intervals": [0, 4, 7, 11] },
    { "id": 1, "type": "chord", "intervals": [2, 5, 9, 12] }
  ],
  "gestures": { "pressure": "channelPressure", "tilt": "voicingSpread", "slide": "timbre" }
}
```

(`pitchClassSet` corrected from 2773 to 2741; see §5.1.)

Backends:
- **Orba** → preset structures.
- **Lightpad** → generated Littlefoot.
- **Host** → full real-time behaviour, for prototyping.
- **Native firmware** (eventually) → a compact binary equivalent.

Prototype on the host first, then work out the lowest viable
implementation per device. This should become a schema next to the
existing ones (`apps/PickPCS/PCS_SCHEMA.md`, `@enkerli/protocol`) rather
than a new standalone format.

## 8. Roadmap: two parallel tracks

| Phase | Artiphon (config → firmware) | ROLI (config → embedded code) |
|---|---|---|
| 0 · Preservation | Archive Orba apps, firmware, presets, docs | Archive Dashboard, firmware, Littlefoot tools, factory apps |
| 1 · Discovery | Inspect Orba 1 presets; compare the two units | Probe each Control Block with GRAB |
| 2 · Proof of control | Upload custom chords/scales with an independent tool | Send arbitrary MIDI from button events |
| 3 · Autonomy | Firmware hooks for an on-device PCS selector | Compile, upload, persist custom Littlefoot |
| 4 · Expression | Adaptive chords, gestures, sound favourites | Lightpad PCS, chord engine, MPE layouts |
| 5 · Expansion | Orba 2 protocol backend; Instrument 1 investigation | Lightpad M; multi-Block communication |

**First milestones:**
- **ROLI:** a Control Block runs custom MIDI-generating code, keeps it after
  power-off, and works over BLE without Dashboard.
- **Orba:** arbitrary chord voicings load from a platform-independent
  config file without the official app.

Proposed CLI (doesn't exist yet): `blockctl discover | info | backup |
compile <f> | upload <f> | verify`.

### Rough effort (speculative, assuming community code works)

| Milestone | Estimate |
|---|---|
| Independent Orba 1 chord/scale editor | 1–3 days |
| Orba 1 preset librarian | 3–7 days |
| Control Block MIDI proof of concept | 1–3 days |
| Independent Littlefoot uploader | 3–10 days |
| Lightpad custom expressive instrument | 3–7 days |
| Lightpad adaptive chord engine | 1–3 weeks |
| Orba 2 independent instrument manager | 1–4 weeks |
| Instrument 1 initial protocol investigation | 1–2 weeks |
| First meaningful Orba 1 firmware patch | 2–8 weeks+ |
| Standalone custom Orba 1 firmware | Months+ |
| Orba 2 native firmware modification | Indeterminate |

## 9. Quick wins

- **Universal MIDI command surface:** a Control Block as a programmable macro
  controller (banks, transport, CCs).
- **Orba Chord Lab:** a librarian/editor importing chord banks from
  ProgGenie and scales from PickPCS.
- **PickPCS Lightpad:** an on-device PCS selector, transposition surface and
  expressive grid, with no host needed.
- **Modular harmonic instrument:** a Control Block selects harmonic modes
  while a Lightpad plays adaptive MPE voicings.

## 10. Toolkit and preservation rules

The Linux miniPC is enough for the software side: Ghidra, Capstone, ImHex,
Wireshark + usbmon, BlueZ + btmon, Python (Mido/RtMidi, Bleak),
STM32CubeProgrammer, OpenOCD, JUCE 8. **Don't buy debug probes (ST-Link
etc.) until the software investigation shows they're needed.**

- One Orba 1 stays on stock firmware as the **reference**. The other
  becomes the **experimental** unit, but only once a recovery path exists.
- Before writing persistent firmware, establish: recovery from a failed
  update; where calibration data lives; whether the ESP32 is recoverable
  on its own; whether the image holds per-device data.
- Build a **regression suite** that records stock MIDI behaviour over USB
  and BLE: expressive accuracy, latency, note lifecycles, MPE allocation,
  gesture response. Compare every later implementation against it.
- **Preservation ≠ redistribution.** Recovered binaries don't become open
  source when a company folds. Distribute original code, tools,
  clean-room implementations and patchers, not vendor images.

## 11. Verify before relying

**Ecosystem claims** (from the research note, unchecked):

- [ ] Artiphon's 2025 liquidation, and the preservation project's status
  and contact route.
- [ ] Orba 1 chip list and firmware-recovery claims.
- [ ] Orba 2 i.MX RT plus AES-128 encryption.
- [ ] That the `holofermes` repos, `subskybox/Orba` and GRAB exist and
  work with current firmware.
- [ ] Littlefoot function names and signatures (`sendCC`,
  `handleButtonDown`, …) against the SDK docs.

**Open blockers that need experiments:**

- [ ] Working custom firmware flashing on Orba 1.
- [ ] Any access to Orba 2 native firmware.
- [ ] Standalone Littlefoot execution on each Control Block model.
- [ ] The Instrument 1 architecture.

**Natural first contact:** the Artiphon preservation project. Its goals
overlap heavily with this plan, and two stock Orba 1 units plus
expressive-firmware experience (FM-1) make for a credible collaboration.

---

## 12. Shared harmonic state across devices (added 2026-11-26)

### 12.1 External interchange formats

No public standard for exchanging key or scale between devices was found
(as of 2026-11-26). Move, Live 12, Link, the Deluge community firmware and
the MIDI Association's profiles were all checked. Whatever format appears,
the suite should be able to translate to and from it, and stay a superset
of it (arbitrary masks, cueing, groups). Until then, design to the suite's
own form below.

**BrainBud (Cem Olcay)** is an existing key/scale source to test. On macOS
its MIDI output shows the same Program Change (ch 1, #70) whatever scale is
selected. That suggests the scale itself travels out of band, with the
program change only as a trigger. See the test plan in §12.5.

### 12.2 The suite is already the superset, on paper

`@enkerli/protocol`'s `scale` message (`ScaleBody { mask, root?, name? }`)
carries **any** 12-bit mask, leftmost = LSB. Three gaps remain for
hardware and performance:

1. **Too heavy for small devices.** A JSON envelope inside 7-in-8-packed
   SysEx is fine for apps and plugins. It's too much for FM-1 firmware, an
   Orba patch, or Littlefoot, and Littlefoot can't send long SysEx at all.
   *Candidate compact form:* **NRPN**, whose 14-bit value holds a whole
   12-bit mask. One NRPN number carries the mask and another the root,
   with an optional third for "when" (below). CCs are the one thing every
   device here can send and receive. The JSON message stays canonical, and
   a bridge translates between the two. (The parameter numbers are to be
   chosen; check them against `CONTROL_PLANE.md` before fixing any.)
2. **No "when".** Every message applies immediately. Performance needs
   **cueing**: while you play in one PCS, you silently pick the next, and
   it takes effect on the next bar, loop or phrase, as in a clip launcher.
   *Candidate:* `ScaleBody.at`, either `"now"` or a quantum
   (`"beat"` / `"bar"` / `"loop"`), resolved against the shared beat grid
   (Link or MIDI clock). This is the setlist feature too: a setlist is an
   ordered list of cued scales.
3. **No grouping.** Add an optional group id so two device groups on one
   bus can sit in different keys.

**Design rule: broadcast states, not commands.** A transformation (see
§12.4) is computed *on the device that performs it*, and the result goes
out as a plain mask and root. Receivers never need to know what "one step
darker" means, a device that joins late picks up the current state, and
the message stays idempotent.

### 12.3 Four octal digits

Four octal digits cover all 4096 sets, and each tap is just a pad index
(0–7). **Digit order follows CONVENTIONS.md:** the first digit tapped is
pcs 0–2, and within a digit pc 3k is the low bit.

| Set | pcs 0–2 · 3–5 · 6–8 · 9–11 | Taps | Decimal |
|---|---|---|---|
| C Ionian | `101 · 011 · 010 · 101` | **5 6 2 5** | 2741 |
| C Lydian | `101 · 010 · 110 · 101` | **5 2 3 5** | 2773 |

(Each group is written pc-ascending, so pad value = b₀ + 2b₁ + 4b₂.)
Ionian and Lydian differ only in the two middle taps, which is where F and
F♯ live. Neighbouring sets share taps, so the gesture can become muscle
memory. **Pin this with a test vector from `@enkerli/theory`** before any
firmware implements it.

### 12.4 Semantic switching: a separate layer from entry

Octal entry *names* a set. Semantic moves *derive* the next set from the
current one, so each can be a single gesture with no mode switch:

| Family | Move |
|---|---|
| Modes of one collection | Brighter / darker (Lydian → … → Locrian); same mask, rotated root |
| Transposition | ±1 semitone, ±fifth; the mask rotates |
| Neo-Riemannian (triads) | P, L, R and their compounds |
| Limited transposition | Messiaen modes: step within a mode's distinct transpositions |
| Parsimony | Nearest set that moves one pc by one semitone |
| PitchFold | Its folding operation as one more move |

All of these are pure functions mask → mask, a natural fit for
`@enkerli/theory`. Each device then needs only "apply move *n*" plus the
broadcast from §12.2.

### 12.5 BrainBud test plan

The observation: PC 70 on ch 1 at every scale change, and no SysEx seen.

1. **Rule out the monitor.** Check that MIDI Monitor's SysEx filter is on
   and that "spy on output to destinations" is enabled. An app can send
   straight to destinations and bypass its own virtual source.
2. **The decisive test.** Send PC 70 on ch 1 to ScaleBud 2 from an
   *unrelated* source (any MIDI utility), after changing BrainBud's scale.
   If ScaleBud 2 still follows BrainBud, the scale is shared out of band
   and the PC is only a "go read it" ping.
3. **Find the store.** Look in `~/Library/Group Containers/` for a shared
   container of Cem Olcay's apps. Diff its plists (`defaults read` or
   `plutil -p`) before and after a scale change. `fs_usage -w -f filesys`
   on the BrainBud process shows what it writes.
4. **Inside a host.** Load BrainBud as an AUv3 MIDI effect (in Logic, AUM
   or similar) and monitor what it passes downstream. Plugin-to-plugin
   output may differ from what the standalone app sends.
5. **The PC number.** Check whether #70 ever changes, e.g. with a different
   key, scale family or preset slot.

If the scale lives in an App Group store, interop has to happen at the
data-format level on the Mac, or through BrainBud's documented MIDI
inputs, rather than on the wire.

#### Result (2026-11-26)

- **Trigger confirmed.** BrainBud was set to C Ionian ♯2 while ScaleBud 2
  sat at its default, C major. `sendmidi dev "ScaleBud 2 MIDI In" ch 1 pc 69`
  from an unrelated source then switched ScaleBud 2 to C Ionian ♯2. So the
  program change carries no data and the scale lives elsewhere. (Wire value
  69 = "70" in MIDI Monitor, which numbers programs from 1; ShowMIDI shows
  the raw 69. `pc 70` does nothing.)
- **Not documented in public repos.** Cem's open `MusicTheory` (Swift) has
  no App Group, UserDefaults-suite or notification code. Its `Scale` is
  `Codable` as `{ root, intervals, description }`, and its intervals are
  *spelled* (quality + degree, semitones computed), which matches our
  structural-spelling convention. The likeliest store is an App Group
  container holding that encoding. Step 3 above, run on the Mac, will
  confirm it.
- **Interop path once it's confirmed:** read or write that store with a
  small macOS bridge, then fire PC 69 on ch 1 to make the Bud apps reload.
  Map `intervals` to a mask at the bridge with `@enkerli/theory`. The
  spelling survives the trip, and arbitrary sets work as long as the Bud
  apps accept arbitrary intervals.
