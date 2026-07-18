# Plug & Jam — the miniPC recipe (P1)

*The playflow the suite was pointed at all along: walk to the Ubuntu Studio
(or MODEP/Patchbox) box, plug in a controller, play — with automated
accompaniment underneath. No browser, no DAW, no laptop. This page is the
setup-once, jam-forever recipe. docs/PRIORITIES.md §1 is the reasoning;
docs/HEADLESS.md is the full capability matrix.*

## The architecture in one line

```
you + controller ──ALSA──▶ jalv (Vane LV2, headless) ──▶ audio out
msuite accompany --play --loop --midi-out virtual ──ALSA──▶ (a second synth, or the same one)
```

Your hands play the **plugin** voice directly (lowest latency, full engine —
the LV2 is Vane's real C++ engine, not the WASM subset). The accompaniment
is the suite's control-plane note stream turned into **real MIDI** by
`--midi-out`, entering ALSA through a virtual rawmidi port. Any synth can sit
on either side — fluidsynth, hardware, a second jalv.

## One-time setup

```bash
# 1. The virtual MIDI port the CLI writes into (survives reboots via /etc/modules)
sudo modprobe snd-virmidi
echo snd-virmidi | sudo tee -a /etc/modules

# 2. A host for the Vane LV2 (jalv is the smallest; from your distro's repos)
sudo apt install jalv
jalv -l                      # confirm Vane's LV2 URI appears after installing the plugin

# 3. Confirm the suite CLI sees the virtual port
msuite play --list           # → VirMIDI  card N device 0  /dev/snd/midiCND0
```

## Every jam

```bash
# Terminal 1 — the synth (headless host running Vane LV2)
jalv <vane-lv2-uri>

# Terminal 2 — wire MIDI with aconnect (numbers from `aconnect -l`)
aconnect -l                          # find: your controller, VirMIDI, jalv
aconnect <controller>:0 <jalv>:0     # your hands → Vane
aconnect <VirMIDI>:0    <jalv>:0     # the accompaniment → Vane (or another synth)

# Terminal 3 — the accompaniment, looping until Ctrl-C
msuite generate --mode minor --length 8 --seed 7 \
  | msuite accompany --seed 9 --tonic A --mode minor --bpm 100 \
      --play --loop --midi-out virtual
```

Play over it. Change `--seed` for a different bassline over the same rhythm;
change the `generate` seed for a whole new progression; drop `generate` and
pass `--progression "Dm7 | G7 | Cmaj7 | A7"` for a tune you already know.

Change the *feel* without changing the harmony:

```bash
--source funk-ghost                  # ghost-note funk instead of walking
--source bossa                       # the root–fifth bossa ostinato
--source two-feel                    # sparse half-note jazz floor
--rhythm "E(3,8)"                    # perform the material on a tresillo
--rhythm "{100}E(3,8)"               # …with the downbeat accented
--rhythm "P(3,0)+P(5,0)"             # …or on a 15-step polygon composite
```

## Details that matter

- **Breath**: Vane is a wind-model voice — the amp envelope follows breath
  (CC2), not noteOn. The `--midi-out` stream sends CC2 = velocity before
  each note (same convention as the browser bus path), so the accompaniment
  speaks without a breath controller. *Your own playing* still needs a
  breath/pressure source — a wind controller, an expression pedal mapped to
  CC2, or aftertouch, depending on your controller. Targeting a non-wind
  synth for the accompaniment instead? `--breath-cc off`.
- **No hanging notes**: Ctrl-C (or any exit) sends explicit note-offs plus
  CC123 All Notes Off — external synths remember what a killed process
  forgets.
- **Channels**: `--channel N` (1–16) if the receiving synth is channel-picky;
  a note message's own channel field wins when present.
- **No VirMIDI listed?** The module isn't loaded (`sudo modprobe
  snd-virmidi`), or you're not on Linux — on macOS the live path is the
  browser bridge (docs/BROWSER_TEST.md §6b); `--midi-out` also accepts a
  `/dev/…` path directly, including a plain file to capture a performance's
  raw bytes.
- **Drum machines / other gear**: the same stream drives anything ALSA sees.
  `aconnect <VirMIDI>:0 <hardware>:0` and the GloriArp groove role
  (PRIORITIES §2.7) will land on real pads.

## Where this goes next

The same `msuite play` adapter accepts ANY suite NDJSON note stream — so as
GloriArp grows roles (comping, grooves) and Serpe goes poly, every one of
them reaches this rig through the port you just set up. The quantize-your-
hands stage (PitchFold in the middle of the controller path) is the natural
next insert.
