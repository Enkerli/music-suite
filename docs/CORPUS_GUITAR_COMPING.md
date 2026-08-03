# Guitar comping corpus — what is actually in these files

*Analysed 2026-08-02, 84 files: 12 grooves × 7 variants, ternary meters
(3/4, 6/8, 9/8, 12/8). The MIDI is licensed loop-library content and lives in
the gitignored `corpora/guitar-comping-ternary/`; nothing here reproduces it.*

Three findings, and each one changes the plan that prompted the analysis.

---

## 1. The "different chord" files are byte-identical

Alex's premise: *"`… D.mid` is the original… `… D 2.mid` is played in E7, `… D
3.mid` is in E♭maj7sus2. So if we compare these files and get what the
underlying chord is…"*

They are the same file.

```
4b3685f196073c87179471186a3ab8d7   Mister Blisters 12-8 195-bpm D.mid
4b3685f196073c87179471186a3ab8d7   Mister Blisters 12-8 195-bpm D 2.mid
4b3685f196073c87179471186a3ab8d7   Mister Blisters 12-8 195-bpm D 3.mid
4688afb158792e436d6ca3ae55a86a7b   Mister Blisters 12-8 195-bpm E.mid
4688afb158792e436d6ca3ae55a86a7b   Mister Blisters 12-8 195-bpm E 2.mid
```

The ` 2` / ` 3` suffixes are macOS duplicate-file naming. The harmonisation
happens in the plugin, downstream of the MIDI — so there is nothing to diff, and
the comparison approach cannot recover a chord.

## 2. The notes are strings, and six of them are decoded

Across **all 84 files**, exactly thirteen distinct note numbers appear:

```
72 73 74 75 76 77 78 79 80 81 82 83 84        (C5 … C6, contiguous, no gaps)
```

Twelve grooves, seven loops each, and not one note outside a one-octave block
starting at C5. So this is an index space, not pitch — and the index is
readable. **Six of the thirteen are the guitar's strings.**

The source is **AAS Strum GS-2** in Loop mode, and these files came out of its
`MIDI Drag` button: they are Strum's own loop language, not a performance.
Alex, playing Mister Blisters Loop C in F: *"I get string 6 then a strum on
strings 3-2-1."* Loop C's first bar is `76` alone, then repeated `78`, then
`81 83 84` together. That reads directly:

```
76  77  79  81  83  84        ← the six string slots
 6   5   4   3   2   1        ← low to high
```

Three independent measurements agree:

- **98.2% of every cluster in the corpus (381 of 388) is drawn entirely from
  those six notes.** The other seven note numbers essentially never appear in a
  chord — 72, 73, 74, 75, 78, 80 and 82 are 98–100% solo.
- **74% of those clusters are contiguous string runs** — `77,79` is strings 5-4,
  `81,83,84` is 3-2-1, `79,81,83,84` is 4-3-2-1. That is what a strum is: a pick
  crossing adjacent strings. The remaining quarter skip a string, which is also
  what real voicings do.
- **Mean rank within the cluster rises monotonically** across 77 → 79 → 81 → 83
  → 84 (0.10, 0.48, 0.59, 1.12, 1.49), exactly as a low-to-high ordering must.

The strums are also directional and tight: **112 downstrokes (6→1), 76 upstrokes
(1→6)**, 95 simultaneous, mean spread 2.7 ticks — 0.028 of a quarter.

### The slots are voicing-relative, not physical

Alex again: *"with some other notes, the 6th string shifts to the 5th one."*
That is Strum's `Movable-Root` voicing deciding where the root sits, and it means
slot 6 is better read as **"lowest sounding voice of the chord"** than as a
physical string. The loop addresses *slots*; the voicing supplies the pitch.

Which is the useful finding, and the answer to the original question: the loop is
**pitch-free and chord-relative by design**. There is no chord to recover because
the chord was never in there — and that is precisely what makes the material
usable. Alex's own guess, "chord degree, in a somewhat obfuscated way", is right.

### The full map, from the manual

The GS-2 panel names all thirteen Strumming Keys, and the statistics above
turn out to have predicted it exactly:

| note | key | measured |
|---|---|---|
| 72 | Downstroke | 444 solo — the commonest event in the corpus |
| 73 | Palm mute | 238 solo |
| 74 | Upstroke | 139 solo |
| 75 | Alternate bass | 10 solo |
| **76** | **Arpeggio 6 (bass)** | cluster member, lowest rank |
| **77** | **Arpeggio 5** | cluster, rank 0.10 |
| 78 | Muffled down | 47 solo |
| **79** | **Arpeggio 4** | cluster, rank 0.48 |
| 80 | Muffled up | 81 solo |
| **81** | **Arpeggio 3** | cluster, rank 0.59 |
| 82 | Mute | 67 solo |
| **83** | **Arpeggio 2** | cluster, rank 1.12 |
| **84** | **Arpeggio 1** | cluster, rank 1.49 |

The six cluster notes are exactly the six **Arpeggio** keys, in order. Every
always-solo note is a whole-hand action — which is *why* it is always solo: a
downstroke is one event that strums the entire chord, so it has nothing to
co-occur with. The measurement even predicted that 72 would dominate the corpus,
before the label was known.

They are called *Arpeggio* keys, which is a pleasing thing to discover on the way
to teaching an arpeggiator.

Grooves use different subsets, and that is itself a style signature: `Lone Star`
uses 72 73 74 76 78 80 82 and never strums at all, while `Impressions` uses ten
of the thirteen.

### Why the loop files will not play

A dragged loop contains Strumming Keys *only*. Nothing sounds in any play mode
because **no chord is held** — the file says how to play and never what. The
Chord Keys are a separate region, and the panel spells quality positionally:

```
root alone            major
+ 1st BLACK on left   minor
+ 1st WHITE on left   seventh
+ both                minor seventh
```

`tools/strum-playable.mjs` holds a chord under a loop for its full length, which
makes the file self-contained and the decoding above testable by ear:

Both commands below are runnable as written. `$C` is the corpus, which lives
outside the repo — and so does everything these commands write, because the
output carries corpus content (D7). Note the explicit `-o`: without one, the
loop form writes next to its input, and the probe writes into the current
directory, which is the repo if that is where you are standing.

```bash
C=~/Desktop/"Jazz Progs and Gen"/corpora/guitar-comping-ternary
mkdir -p "$C/_playable"
node tools/strum-playable.mjs "$C/Mister Blisters 12-8 195-bpm C.mid" --chord Fm7 -o "$C/_playable/blisters-C [Fm7].mid"
node tools/strum-playable.mjs --probe --chord C -o "$C/_playable/strum-key-probe [C].mid"
```

The probe is the decisive experiment: one labelled key per beat, in order. If
beat 5 is not the bass string and beat 13 is not the top one, this document is
wrong.

### The probe was run, and it confirms all of it

Recorded off Strum over a C chord and measured from the audio — new partials
appearing at each attack, so sustain from the previous key cannot be mistaken
for the current one:

| beat | key | measured |
|---|---|---|
| 1 | Downstroke | 131 196 262 330 393 — **the whole chord** |
| 2 | Palm mute | broadband, damped, no clear pitch |
| 3 | Upstroke | 261 328 394 522 661 783 — chord, **treble strings only** |
| 4 | Alternate bass | 100 Hz **G2** — the fifth below the root, alone |
| 5 | **Arpeggio 6 (bass)** | **130.83 Hz — C3** |
| 6 | **Arpeggio 5** | **130.83 Hz — C3** |
| 7 | Muffled down | broadband, inharmonic |
| 8 | **Arpeggio 4** | **196 Hz — G3** |
| 9 | Muffled up | broadband, inharmonic |
| 10 | **Arpeggio 3** | **262 Hz — C4** |
| 11 | Mute | short, dull, no clear pitch |
| 12 | **Arpeggio 2** | **330 Hz — E4** |
| 13 | **Arpeggio 1** | **393 Hz — G4** |

The six Arpeggio slots ascend — C3, C3, G3, C4, E4, G4 — which is a C major
guitar voicing read low to high. Every action key does what it is called: the
alternate bass is the fifth, alone; the upstroke carries only the treble strings
because that is where an upstroke starts.

Two details worth keeping:

- **The downstroke's partials are exactly the slot pitches.** Measured
  independently: 130.9, 196.1, 261.8, 329.9, 392.7 against 130.8, 196.0, 261.6,
  329.6, 392.0. A strum *is* the slots sounded together — confirmed from the
  audio, not assumed.
- **Slots 6 and 5 are the same pitch to 0.02 Hz** (130.83 both). Not a
  coincidence and not a doubling: for this voicing the sixth string is not
  played, so the bass slot renders on the fifth. That is Alex's original
  observation — *"the 6th string shifts to the 5th one"* — measured. It is also
  the clearest possible demonstration that these are **voicing slots, not
  strings**.

**One caution for the kit:** these must never go through `resolveDrum`. Note 72
is `72 % 12 == 0` → kick. The whole corpus would render as drums.

## 3. The meter is real; the grid is not

Folding one 12/8 file to a six-quarter bar shows the two bars land in the same
places, so the bar length is confirmed by measurement rather than by the
filename:

```
bar 1   0.00 0.85 1.23 1.39 1.55 2.36 2.84 4.01 4.39 4.57 5.50
bar 2   0.00 0.83 1.08 1.29 1.43 2.36 2.88 4.00 4.29 4.48 5.49
```

But those positions are **not on a grid**. The 12/8 eighth grid in quarters is
0, 0.5, 1.0, 1.5 … — and 0.85, 1.23, 2.36, 2.84 miss it by up to 0.15 of a
quarter, the same way in both bars. `tools/drum-grid.mjs` reports a mean fit of
0.18 slots off with nothing fitting better, which is the correct answer: this
material is played, not quantised.

Two smaller notes on the rhythm:

- **18% of onsets are strum-internal**, clustering 2.7 ticks apart at division
  96 — a pick crossing strings. Collapsing those into one gesture before
  grid-fitting helps, but only slightly (0.0487 → 0.0458 corpus-wide), so it is
  not the main story. The main story is that the playing is expressive.
- **Ternary here is at the BAR level, not the subdivision.** 12/8 against a
  quarter-note tick base is two eighths per quarter — a binary subdivision
  grouped in threes. That is the opposite of the EZdrummer jazz waltzes, where
  ternary WAS the subdivision (3 per beat, unanimous across 104 files). Same
  word, different level; the grid detector is right about both.

---

## What this means for learning from them

This is for **GloriArp**, not the kit — and the corpus turns out to be an
unusually good fit for it, because the separation GloriArp needs is already done.

A comping loop here is **six lanes** (the string slots) carrying onsets,
velocities and stroke direction, with **no harmony of its own**. GloriArp
supplies the chord; the loop supplies which voice, when, and how hard. That is
the same pattern-times-harmony split the suite already runs on, arriving
pre-separated — the reason a single file can serve E7 and E♭maj7sus2.

Six lanes with per-lane onsets is also, structurally, a **poly pattern**, which
the engine already plays (INTENT D5, D8). The nearest existing relative is
Funkastic, the clav comping generator.

Three things the machinery needs:

1. **Lanes are voicing slots, not drums.** `learnStyle` calls `resolveDrum` and
   assumes a kit. The slot index is the lane; the pitch comes from the chord at
   play time, not from the style.
2. **Keep onset offsets continuous.** Per-slot probability alone would quantise
   away the 0.15-quarter deviations that are the comping feel — the waltzes
   survived that because they were tight (0.057 slots), this would not.
   `learnStyleModel` already keeps micro-timing distributions; here they are the
   primary content rather than a nuance.
3. **Keep the strum as one gesture.** A strum is a contiguous run of slots
   spread over ~2.7 ticks with a direction. Stored as six independent lane
   onsets it survives, but stored as a *gesture* — run, direction, spread — it
   can be regenerated over a different voicing, which is what makes cross-style
   work ("a jazz waltz, funkier") possible.

Meter comes from the filename: 12-8, 9-8, 6-8, 3-4 are all stated, and the
timekeeper heuristic cannot find a bar in a guitar part because there is no
timekeeper voice. Using stated metadata is not cheating.

Open question, cheap to answer: what the seven non-string notes articulate.

Generic names when these ship, same as the drum styles and for the same reason:
so nobody mistakes a style for the library it was learned from.
