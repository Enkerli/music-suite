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

## 2. There is no pitch content at all

Across **all 84 files**, exactly thirteen distinct note numbers appear:

```
72 73 74 75 76 77 78 79 80 81 82 83 84        (C5 … C6, contiguous, no gaps)
```

Twelve different grooves, seven variants each, and not one note outside a
one-octave block starting exactly at C5. Real guitar comping would spread over
forty semitones or more. This is an **index space** — voicing or articulation
slots the plugin reads — not pitch.

So the loop has no chord to extract. Its chord is whatever the plugin is told,
which is exactly why one file can serve E7 and E♭maj7sus2.

**Consequence for the kit:** these must never go through `resolveDrum`. Note 72
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

The drum-style machinery is the wrong tool here, and for a specific reason: a
drum style is **per-slot probabilities**, and quantising this material to slots
would throw away the 0.15-quarter deviations that are the entire comping feel.
The waltz corpus survived that treatment because it was tight (median 0.057
slots off); this one would not.

What fits is closer to what GloriArp already does for phrases —
`learnStyleModel` keeps per-slot onset, velocity, duration AND micro-timing
distributions, so the deviation is retained rather than rounded away. The
adaptation needed is:

1. **Voices are indices, not drums.** The style's `voices` key is already just a
   name per lane; it needs to stop assuming a kit.
2. **Keep onset offsets continuous.** Slot probability plus a micro-timing
   distribution per slot, as the drum styles already carry in `push` — but here
   it is the primary content rather than a nuance.
3. **Take the meter from the filename.** 12-8, 9-8, 6-8, 3-4 are all stated,
   and the timekeeper heuristic cannot find a bar in a guitar part because there
   is no timekeeper voice. Using stated metadata is not cheating.

Generic names when these ship, same as the drum styles, and for the same reason:
so nobody mistakes a style for the library it was learned from.
