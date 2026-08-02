# Articulation examples — legato and detached, from a sequencer

Six MIDI files for driving Vane (or anything else) with **notes only**: no
breath CC, no expression, no aftertouch. That is what a sequencer, a piano roll
and most keyboards send, and it is the case Vane's synthetic breath exists for
(`Vane/docs/sequencer-playability.md`).

They come in pairs so the contrast is audible rather than asserted. Everything
here is written by the shipped CLI — `node generate.mjs` rebuilds all six.

## The files

**Rhythmic — one pitch, so only the articulation changes.** `E(4,8)` at 100 bpm,
two cycles, note 60.

| file | gate | what it does |
|---|---|---|
| `rhythm-detached.mid` | 0.5 | the sequencer default — a fresh attack every note |
| `rhythm-legato.mid` | 1.0 | each note lasts exactly until the next begins |

**Melodic — several pitches, which is where melisma lives.** `Dm7 \| G7 \|
Cmaj7 \| Cmaj7`, seed 7, in sax register (C4:C5).

| file | gate | what it does |
|---|---|---|
| `line-detached.mid` | staccato | a separate breath per note |
| `line-legato.mid` | 1.0 | one breath, notes abutting |
| `line-overlap.mid` | 1.3 | one breath, notes overlapping |
| `line-mixed.mid` | mixed | some slurred, some tongued |

## What they measure

Read the files — `node ../../tools/midi-timing.mjs <file>` reports the
articulation of each line:

```
rhythm-detached.mid    detached              overlap -120
rhythm-legato.mid      legato (abutting)     overlap 0
line-overlap.mid       legato (overlapping)  overlap 144
line-mixed.mid         mixed — 2/15 slurred  overlap -72 0
```

Or play them through Vane's engine — `node verify.mjs` drives the committed
`apps/vane/synth/vane-dsp.wasm` with the waveguide on and synthetic breath on
Auto, and reports how much level survives each note boundary:

```
rhythm-detached.mid    mean 14%    detached
rhythm-legato.mid      mean 57%    4.1x the detached file
line-detached.mid      mean  0%    detached
line-legato.mid        mean 81%    81.2x the detached file
```

A slur does lose some level — the bore re-entrains at the new delay length, and
a wide leap costs more than a step. That is the model behaving physically, not a
fault. What matters is the ratio against the same material re-articulated.

## Two things worth knowing

**A lane is one note number, so `upi --midi` cannot overlap.** MIDI has no way
to sound two instances of the same pitch at once — the first note's note-off
silences the second — so a gate above 1.0 there produces a hole, not a slur.
`msuite upi --midi --gate` clamps at 1.0 and says so. Overlap needs changing
pitches, which is why only the melodic files have an overlapping variant.

**On a mono instrument, abutting and overlapping sound the same.**
`line-legato.mid` and `line-overlap.mid` are genuinely different files (overlap
0 vs 144 ticks), and they measure identically through Vane: in mono, the new
note retargets the voice and the trailing note-off is a no-op. Overlap is how
you make a slur unambiguous on paper and across hosts, not a second kind of
legato. It matters more with a polyphonic receiver.

## Regenerating

```bash
node examples/articulation/generate.mjs && node examples/articulation/verify.mjs
```

The `.mid` files are committed so they can just be dragged into a DAW. The
generator is here so a change in the renderer shows up as a diff rather than as
stale binaries nobody can re-derive.
