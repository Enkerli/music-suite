# Articulation examples — legato and detached, from a sequencer

Six MIDI files for driving Vane (or anything else) with **notes only**: no
breath CC, no expression, no aftertouch. That is what a sequencer, a piano roll
and most keyboards send, and it is the case Vane's synthetic breath exists for
(`Vane/docs/sequencer-playability.md`).

They come in pairs so the contrast is audible rather than asserted — and each
`.mid` ships with a `.wav` rendered through Vane, so you can hear the difference
without installing the plugin or owning a breath controller.

Everything here is generated: `node generate.mjs` rebuilds the MIDI through the
shipped CLI, `node render-audio.mjs` renders the audio through the committed
`apps/vane/synth/vane-dsp.wasm`.

## The files

**Rhythmic — one pitch, so only the articulation changes.** `E(4,8)` at 100 bpm,
two cycles, note 60.

| file | gate | what it does |
|---|---|---|
| `rhythm-detached` | 0.5 | the sequencer default — a fresh attack every note |
| `rhythm-legato` | 1.0 | each note lasts exactly until the next begins |

**Melodic — several pitches, which is where melisma lives.** `Dm7 \| G7 \|
Cmaj7 \| Cmaj7`, seed 7, in sax register (C4:C5).

| file | gate | what it does |
|---|---|---|
| `line-detached` | staccato | a separate breath per note |
| `line-legato` | 1.0 | one breath, notes abutting |
| `line-overlap` | 1.3 | one breath, notes overlapping |
| `line-mixed` | mixed | some slurred, some tongued |

**Durational — `LS(…)`, and the even-grid problem.** `E(8,16)` at 100 bpm, note 42.

`LS(r)` says how much longer a long note is than a short one, reading the
pattern's OWN inter-onset intervals. On an even grid there are none to read, so
`E(8,16)LS(4)` renders identically to `E(8,16)` — pinned as a test. The
`{mask}` form names which onsets are long, which is the only way to reach the
case that wants it most: which hi-hats ring and which choke.

| file | notation | what it does |
|---|---|---|
| `hat-flat` | `E(8,16)` | every hit the same |
| `hat-alternate` | `E(8,16)LS(4){10}` | every other hit rings |
| `hat-backbeat` | `E(8,16)LS(4){1000}` | one ring in four, overlapping the next hit |

**`LS(r){mask}` is a PROPOSAL, not settled** — see `docs/PRIORITIES_2026-08.md`
N1b. It extends the durational notation that already exists rather than adding a
second one, and its mask is indexed over ONSETS (cycling), unlike the `{…}`
accent prefix which is per step: a rest has no duration to lengthen.

## The audio

The `line-*` and `rhythm-*` files are played by **Vane**; the `hat-*` files by
the **synthesised kit** (`@enkerli/drumsynth`, via `msuite upi --wav`), because
a reed cannot articulate a 50 ms choke and a hat can. The note's own length
drives the hat's decay, so `LS(4){1000}` really does ring one hat in four:

```
hat-flat       █▅▃▂▁          █▅▃▂▁          █▅▃▂▁          █▅▃▂▁
hat-alternate  █▆▄▃▂▂▁▁       ▆▂             █▆▄▃▂▁▁▁       ▆▂
hat-backbeat   █▆▅▄▃▃▂▂▁▁▁    ▆▃▁            ▆▃▁            ▆▃▁
```

Mono, 16-bit, 48 kHz, about 6 MB for the nine. Mono is not a compromise: with
unison off a Vane voice is a centre image (L == R exactly — one of the wasm
regression checks), so stereo would be the same data twice.

**One shared gain across the whole set**, not per-file normalisation. These
files exist to be compared, and a detached take really is quieter than a slurred
one over the same material — that difference IS the result, and normalising each
to full scale would erase it:

```
rhythm-detached.wav  rms 0.188      rhythm-legato.wav  rms 0.260
line-detached.wav    rms 0.231      line-legato.wav    rms 0.339
```

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
node examples/articulation/generate.mjs && node examples/articulation/render-audio.mjs && node examples/articulation/verify.mjs
```

`verify.mjs` and `render-audio.mjs` drive the engine through the same
`engine.mjs`, so the audio is the measurement rather than an illustration of it.

The `.mid` files are committed so they can just be dragged into a DAW. The
generator is here so a change in the renderer shows up as a diff rather than as
stale binaries nobody can re-derive.
