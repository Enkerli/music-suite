# Drum styles

Seven jazz waltzes, learned from a commercial MIDI library. **These are not the
library** — they are statistics about it, and the difference is the whole reason
they can be here.

```bash
msuite drums gen jazz-waltz-90 --seed 7 --pass 2 --morph 0.35
```

## What a style is

A style is a probability per slot, a velocity distribution per slot, and a
microtiming push per slot. `jazz-waltz-90` reads as the groove it is:

```
ride      slot0 p.95  slot3 p.93  slot6 p.81  slot5 p.55   1, 2, 2-a, 3
pedalHat  slot3 p.97                                       beat 2, once a bar
snare     slot5 p.73 v87   slot6 p.56 v60                  comp loud, ghost soft
kick      slot0 p.41 v81                                   sparse, feathered
swing     0.333 played 0.321  ·  0.667 played 0.674
```

Nine slots because 3/4 in triplets is nine. Every one of these came back as
3 per beat with no exceptions, which settled the triplets-versus-swung-sixteenths
question for this material by measurement rather than assumption
(`tools/drum-grid.mjs`).

## Why the names are generic

Not to hide where they came from — the note above says plainly that they were
learned from a commercial library. It is so that **nobody mistakes these for the
originals**. Somebody who wants the high-quality source material should go and
buy it, and a file called `waltzing-90.json` sitting in a repo invites exactly
the wrong assumption about what it is and what it substitutes for.

`jazz-waltz-90` says what the music is. The tempo is a fact about the material;
the folder name was a product's preset name.

The closest honest analogy is not a dataset or a model dump. It is closer to
having learned to play jazz waltz from scores, and now holding an abstract
method from that playing. What is here is the method.

## What it means that they are abstract

The transform is one-way, and measurably so. For `jazz-waltz-90`:

- **128 source bars collapsed into 33 slot statistics.**
- 28 of those 33 are probabilistic — neither always nor never — so roughly
  2^28 bar-patterns are consistent with the style.
- No field holds an ordering, a bar index, or a file identity. A slot is
  `{slot, p, velocity: {mean, sd, n}, push}` and nothing else.

You cannot get a bar of the source back out. This is the same discipline the
jazz corpus has always had (INTENT D7 — the corpus is never published, only what
is derived from it) and the same shape GloriArp's `model.json` uses.

The names are generic on purpose: `jazz-waltz-90` says what the material is,
where the source folder said whose preset it was. The tempo is a fact about the
music; the folder name was branding.

## Using them

A style is a distribution, so it does not play — you sample it, and the sample
is UPI:

```bash
$ msuite drums gen jazz-waltz-90 --seed 7 --pass 2 --morph 0.35
ride={101010}101101101@+3ms / snare={0101}101001100@+3ms / pedalHat=000100000@+5ms

$ msuite upi "<that>" --wav take.wav --bpm 90
```

`--seed` names the take, `--pass` is the next time round the loop, and `--morph`
is how much re-rolls between them — 0 means the loop repeats exactly, 1 means
every pass is unrelated, and in between the groove **drifts**. Same convention
as `msuite accompany`, same PRNG the plugin uses, so a seed means one thing
everywhere.

`--morph-hits` and `--morph-dynamics` move independently: hold the rhythm and
let the accents wander, or the reverse.

## What UPI keeps, and what it does not

Keeps: which drum plays where, the grid, comps against ghosts (an accent mask is
exactly two velocity levels, which is what that distinction is), and a lane that
sits behind the beat.

Drops: **per-slot microtiming**. A style knows the snare drags 0.057 slots on
the "a" of 2 while rushing on beat 3; UPI has one offset per lane. The generator
averages and reports the spread it flattened rather than hiding it.
`tools/drum-generate.mjs --json` gives the lossless events if you want to write
MIDI instead.

Also worth knowing: a **dynamics** morph is often invisible in the notation,
because it only shows when a hit crosses its lane's accent threshold. Render the
audio to hear that one.
