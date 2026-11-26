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
