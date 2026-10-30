# Twirl's voices as Surge XT patches

Patches for [Surge XT](https://surge-synthesizer.github.io/) (free, open
source) that sound like Twirl's own voices, for playing Twirl's MIDI output
(the web page's Web MIDI, or the plugin's MIDI out) through Surge XT in a
host. All of Twirl's sound packs (HISTORY.md, 2026-10-25 to 27). Twirl sends pluck on
channel 1, bell on 2, blip on 3, and the drums on 10: kick 36, snare 38,
hat 42, shaker 70.

| Pack | Pluck | Bell | Blip | Drums |
|---|---|---|---|---|
| Paper | a saw through a closing lowpass | two-operator FM, ratio 3.5 | a square chirping down a fifth | Kick (a falling sine), Snare (bandpassed noise and a tone), Hat, Shaker (noise) |
| Mallets | marimba: two partials | vibraphone: a sine with tremolo | xylophone: a triangle | Kick (a log drum), Snare (a woodblock), Hat (claves); no shaker (Paper's) |
| Chip | a square | an up-arpeggio of squares | a square dropping an octave | Kick (a falling square), Snare, Hat, Shaker (noise) |
| Felt | a felted upright | the same, an octave up | two soft partials | Paper's |
| Steel | a steelpan: partials 1, 2, 3 | the same, longer | two partials | Mallets' |
| Kalimba | a tine, a high ping, a click | the same | two partials | Mallets' |
| Chimes | a damped bar | a wind chime: five inharmonic partials | a tiny chime | Paper's |

Each is *Twirl <pack> <voice>*. A pack only has the voices it changes;
where it has none, Twirl plays Paper's (or, for Steel's and Kalimba's
drums, Mallets').

**Twirl Drone**, for every pack: Twirl sends the Drone on channel 4 as held
notes, changing as Walk moves them, with its level as velocity. The patch
is Twirl's pad: two saws a note, 12 cents apart, one left and one right,
through a lowpass that breathes slowly, drifting across, a hint of tape
wobble, a 2-second swell and fade. It's made by hand from Twirl's recipe,
not fitted; its level was measured against Twirl's own Drone (within
0.2 dB at the default level and at the top). The Drone's *space*
(binaural, rotating) and Warmth's wobble stay Twirl's own.

## Using them

Copy `patches/*.fxp` into Surge XT's user patches, in a folder of their own:

```sh
mkdir -p ~/Documents/"Surge XT"/Patches/Twirl
cp apps/twirl/surge/patches/*.fxp ~/Documents/"Surge XT"/Patches/Twirl/
```

They then show in Surge XT's patch browser under *Twirl* (or open one with
its menu → *Load patch…*). In a host: one Surge XT per channel, each
listening to its channel only, with a pack's Pluck, Bell or Blip. For the
drums, a drum machine (Bitwig's Drum Machine: pads from C1 = 36) with a
Surge XT on pads 36, 38, 42 and 70, with Kick, Snare, Hat and Shaker. Paper's
and Mallets' kicks, and the tone in Paper's snare, follow the note (another
pad, another pitch); the rest sound the same on any note.

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
louder), and -13 follows Twirl's loudness, proportional to velocity; an
oscillator's pitch, and a modulation of it, are in semitones, but in octaves
with Surge's "extended range" on (so it's left off here); with keytracking
off, an oscillator plays C4; voice LFOs with the envelope shape (6) give
each oscillator its own envelope; scene mode 2 plays both scenes. A `.fxp` is a 60-byte FXP header (`CcnK`,
`FPCh`, id `cjs3`, the chunk's size), then Surge's chunk: `sub3`, the XML's
length, six wavetable sizes (zero here), then the XML.

CC0, like Twirl.
