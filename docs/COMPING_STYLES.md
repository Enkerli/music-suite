# Comping styles — the toolchain, and the method behind it

*The map. The evidence it rests on is in
[CORPUS_GUITAR_COMPING.md](CORPUS_GUITAR_COMPING.md); this is what was built and
how to run it.*

The short version: a library of guitar loops that contain **no pitch at all**
becomes GloriArp style models that generate comping over any chord. The loops
address voicing slots; the chord arrives at play time. That split is the reason
any of this works, and it is the same pattern-times-harmony split the rest of
the suite runs on.

---

## The pipeline

```
Strum loops ──comp-learn.mjs──────────────────────────────────► style model
      │                                                              │
      └──comp-style.mjs──► gesture style ──comp-model.mjs───────────►┘
                                │                                    │
                                └──comp-generate.mjs──► take         │
                                                        · MIDI       │
                                                        · phrase     │
                                                                     ▼
                                            GloriArp: samplePhrase(seed, pass)
                                                      realizeDegrees(chord)
```

Two routes to the same destination, kept in parallel on purpose.

| tool | what it does |
|---|---|
| `strum-playable.mjs` | holds a chord under a loop so it plays; `--probe` fires all 13 keys |
| `comp-style.mjs` | loops → a **gesture** style (strums as run + direction + spread) |
| `comp-generate.mjs` | a gesture style → a take, as MIDI or as a phrase |
| `comp-model.mjs` | a gesture style → a GloriArp style model |
| `comp-learn.mjs` | loops → a GloriArp style model, **one step** |
| `comp-style-audit.mjs` | the share/don't-share gate — is output distinct and abstract? |
| `build-all-models.sh` | the whole local set, one command |

**`comp-learn` is the short path** and the one to reach for. The gesture format
still earns its place: it is the only representation that keeps a strum as a
sweep rather than six onsets, which is what cross-style work ("a jazz waltz,
funkier") will need.

## Running it

```bash
# everything, from every local corpus
bash tools/build-all-models.sh

# one pack, degree-aware models
node tools/comp-learn.mjs "<pack>" --by-groove --prefix funk-comp --frame Cm7 -o models/

# is a corpus safe to derive shareable styles from?
node tools/comp-style-audit.mjs "<pack>" --takes 200
```

Output lands in `corpora/gloriarp-models/` — see the README there for what is in
each folder and which parts were observed rather than chosen.

## What gets extracted, and why those

Decided by measurement, not by a table:

- **Duration**, from the loops' own note-offs. This is the entire articulation
  story: damped keys at 0.12–0.15 quarters, open ones at 0.18–0.20. A plucked
  or struck instrument that ignores it rings through everything.
- **Velocity**, per event. Most of what separates a comp from a ghost.
- **Microtiming**, per slot, signed.
- **Voice and degree** — which line of the chord, functionally.

**Stroke direction is dropped.** Downstroke and upstroke have the same median
duration (0.198) and near-identical velocity (93.5 vs 91.4) across 9145 events.
Keeping them apart would be bookkeeping without a difference. The gesture layer
still records it.

## Degrees, and being honest about them

Models carry a `degrees` histogram (`degree:alteration:category`) alongside
`notes`, so `realizeDegrees(model, {chord})` moves a model onto a chord the
corpus never contained, rather than replaying pitches.

For the **Strum corpus** a degree is a deterministic function of the voice
index, because the loops have no pitch. It buys chord-independence and nothing
else, and such a corpus **cannot contain a non-chord tone** — an empty NCT
category there is a property of the source, not a finding.

For corpora that *do* have pitch — Funkastic, Troublemaker, Apple Loops later —
the same field carries real information, NCTs included. That is where the
representation starts paying.

---

## The method, since it generalises

This was a reverse-engineering problem before it was a code problem, and the
sequence is worth reusing on the next opaque corpus.

**1. Check the premise before building on it.** The files were assumed to be the
same groove under different chords. `md5` said three of them were byte-identical.
An hour of diffing would have produced nothing, slowly.

**2. Look at the value space, not the values.** Eighty-four files used exactly
thirteen note numbers in a one-octave block. Real guitar spans forty-plus
semitones. That single observation reframed the whole corpus from "pitches we
can't parse" to "an index we can decode".

**3. Let the statistics propose, then find ground truth.** Cluster membership,
contiguity, and mean rank-within-cluster identified six of the thirteen keys as
an ordered voicing before anyone knew their names. The manual then confirmed it
exactly — including that the commonest event in the corpus would be Downstroke.

**4. Make the thing testable by ear.** `strum-playable --probe` fires each key
in turn under a held chord, one per beat, labelled. Playing it settled in
minutes what statistics could only make likely, and the audio measurement
(attack-only spectra, so sustain cannot be mistaken for the next key) confirmed
the six slots ascend: C3 C3 G3 C4 E4 G4 over a C chord.

**5. Measure the thing you were about to assume.** The plan was an articulation
lookup table mapping "palm mute" to a duration. The loops already carried real
durations; reading them was both easier and correct.

**6. Audit before sharing, and measure both properties.** `comp-style-audit`
asks whether generated bars are *distinct* from source bars (near-zero verbatim
matches, ~5.5 of 12 slots differing) and whether the style is *abstract*
(collapse ratio, log2 of the consistent space). The distinctness held; the
compression did not, and saying so is why these stay local.

**7. Keep what does not parse.** Thirteen of 1127 files still do not read as
loop language, each because of one or two notes outside the block. They are
flagged rather than force-fixed. Working with corpora is like that — a better
reading may turn up.

The recurring shape: **a negative control at every step**. The premise that
failed md5, the grid detector that honestly reported a poor fit, the base
detector caught sliding when the low keys were unused, and every load-bearing
test verified by breaking it once. The findings that survived are the ones that
had a chance to fail.
