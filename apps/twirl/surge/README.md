# Twirl's voices as Surge XT patches

Patches for [Surge XT](https://surge-synthesizer.github.io/) (free, open
source) that sound like Twirl's own voices, for playing Twirl's MIDI output
(the web page's Web MIDI, or the plugin's MIDI out) through Surge XT in a
host. Paper's sounds, for now (PLAN.md, 1e):

| Patch | Twirl's voice | Twirl sends it on |
|---|---|---|
| Twirl Paper Pluck | pluck: a saw through a closing lowpass | channel 1 |
| Twirl Paper Bell | bell: two-operator FM, ratio 3.5 | channel 2 |
| Twirl Paper Blip | blip: a square chirping down a fifth | channel 3 |
| Twirl Paper Kick | kick: a sine falling 19 semitones | channel 10, note 36 |
| Twirl Paper Snare | snare: bandpassed noise and a tone | channel 10, note 38 |
| Twirl Paper Hat | hat: highpassed noise | channel 10, note 42 |
| Twirl Paper Shaker | shaker: noise, bandpassed and highpassed | channel 10, note 70 |

## Using them

Copy `patches/*.fxp` into Surge XT's user patches, in a folder of their own:

```sh
mkdir -p ~/Documents/"Surge XT"/Patches/Twirl
cp apps/twirl/surge/patches/*.fxp ~/Documents/"Surge XT"/Patches/Twirl/
```

They then show in Surge XT's patch browser under *Twirl* (or open one with
its menu → *Load patch…*). In a host: one Surge XT per channel, each
listening to its channel only, with Pluck, Bell or Blip. For the drums, a
drum machine (Bitwig's Drum Machine: pads from C1 = 36) with a Surge XT on
pads 36, 38, 42 and 70, with Kick, Snare, Hat and Shaker. Each plays the
note it gets, so the Kick on another pad is another pitch.

Like Twirl, they're one-shots: each note rings out on its own (Twirl's
note-offs come after its own lengths, and the patches let the sound go on
decaying past them).

## How they're made

`make_patches.py` (Python, standard library only) writes them:

```sh
python3 apps/twirl/surge/make_patches.py
```

Each starts from one of Surge XT's own templates (`templates/`, *Init Saw*
and *Init Sine* from its factory patches, CC0) and sets what makes the voice:
the oscillator, the filter, both envelopes, FM. Its numbers are in
`fitted.json`, which `fit.py` makes: it renders Twirl's voices offline in
the page (`../test/render-voices.mjs`), renders each patch in Surge XT
(through [pedalboard](https://github.com/spotify/pedalboard)), and moves the
patch's numbers until the two match in loudness and brightness over time,
at several notes and velocities. `fitted.json` also keeps each fit's score
(the average distance left: dB of loudness while it sounds, plus half the
dB of peak and half the semitones of brightness).

```sh
python3 -m venv /tmp/fitenv && /tmp/fitenv/bin/pip install pedalboard mido numpy
/tmp/fitenv/bin/python apps/twirl/surge/fit.py            # or: … fit.py Bell Snare
python3 apps/twirl/surge/make_patches.py
```

Corrections go into `make_patches.py` (a voice's structure, or how far the
fit may move a number) or `fitted.json`, never by hand into a `.fxp`.

What Surge's numbers mean, as found by rendering: times are log2 seconds;
cutoffs are semitones from 440 Hz; envelopes in *analog* mode fall in a
straight line in dB, as Twirl's exponential ramps do; filter type 1 is a
12 dB lowpass, 4 a highpass, 6 a bandpass; modulation source 1 is velocity,
16 the filter envelope; the amp's velocity sensitivity is in dB below full
for soft notes (velocity 127 is always full; positive makes soft notes
louder), and -13 follows Twirl's loudness, proportional to velocity. A `.fxp` is a 60-byte FXP header (`CcnK`,
`FPCh`, id `cjs3`, the chunk's size), then Surge's chunk: `sub3`, the XML's
length, six wavetable sizes (zero here), then the XML.

CC0, like Twirl.
