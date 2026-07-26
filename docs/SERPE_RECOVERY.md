# What the original Rhythm Pattern Explorer had that Serpe lost

*Investigated 2026-07-22 against `Enkerli/rhythm_pattern_explorer` (the
`WebApp/` tree at HEAD, plus the full history), prompted by "the original had
a more elaborate database, Euclidean detection, maybe a named-pattern
catalogue, and long/short notation." Three of those checked out. One did not
— and saying so is the point of writing this down.*

## Verdict, item by item

| Remembered | Verdict | Evidence |
|---|---|---|
| A more elaborate **pattern database** | **Real, and still gone.** | `WebApp/app/pattern-database.js`, 989 lines: `add`/`remove`/`update`/`search`/`filter`/`filterByStepCount`/`filterCombined`/`getStatistics`/`export`/`import`, dedup by binary+stepCount, localStorage-backed. Records carry `name`, `binary`, `hex`, `decimal`, `polygonType`, `euclidean`, `expression`, and combined-pattern provenance (`combined.originalPatterns`). Current suite: **0 files** match `database`. |
| **Euclidean detection**, rotation-aware | **Real. Now restored.** | `PatternAnalyzer.detectEuclideanPattern` (pattern-analysis.js:272) looped every offset and returned `{beats, steps, offset, formula}`. Current suite before this pass: **0 files** matched `detectEuclidean`. |
| **Long/short notation** with relative durations | **Real. Now restored.** | `LongShortAnalyzer` (pattern-analysis.js:347) produced IOIs, `shortInterval`/`longInterval`, an `LSSL` string, dot/dash Morse, and a prosody type. Current suite before this pass: **0 files** matched `longShort`/`prosody`. |
| A catalogue of **named patterns (Bembé, Maqsum)** | **Never existed.** | `bembe`, `bembé`, `maqsum`, `baiao`, `shiko`, `soukous`, `rumba`: **zero hits across every commit in the repo's history.** What does exist is `tresillo` (117 hits), `clave` (9), `gahu` (9) — as *documentation examples* (`E(7,12) # West African Gahu`) and one preset, `{"Son Clave", "Basic Patterns", …, "E(3,8)|E(2,8)"}`. So: named examples in prose and a preset list, not a catalogue. The memory is a conflation, not a lost feature. |

### The dots-and-dashes confusion, resolved

Worth stating plainly, because it is why the long/short layer looked like it
was still there:

- **UPI's `.` / `-` (current, present):** *input* notation. `SOS`, `.-..`,
  `M:-.-` — a way to **write** a pattern, where `.` = onset and `-` = onset +
  rest (`upi.js:93`).
- **`LongShortAnalyzer`'s `.` / `-` (original, was missing):** *output*
  notation. A **reading** of the durations already in a pattern, where `.` =
  short IOI and `-` = long IOI.

Same glyphs, opposite directions. Finding the first and concluding the second
survived is the natural mistake.

## What this pass restored (and added)

`packages/upi/src/decompose.js` and `packages/upi/src/longshort.js`, exported
from `@enkerli/upi` and surfaced in `msuite pattern`.

### Recognition

- `detectEuclidean(steps)` — tries every rotation, returns
  `{beats, steps, offset, formula}` (`E(3,8)`, or `E(3,8,1)` when rotated), or
  `null`. Behaviour-parity with the original.
- `detectBarlow(steps)` — the equivalent the original never had: is this the
  indispensability reduction `B(k,n)`, or its anti-metric twin `W(k,n)`?

### Decomposition (new — the actual request)

`decompose(steps, { maxTerms = 3 })` answers *"which union of Euclidean and
Barlow generators makes this pattern?"* The original could say "this **is**
Euclidean"; it could not say "this **is these two** superposed".

Three rules keep the answers meaningful rather than merely true:

1. **Exact, never approximate.** A candidate is admitted only if its onsets
   are a *subset* of the target, and a reading is returned only if the union
   equals the target exactly. `E(3,8) + E(2,8,3)` means those two patterns
   superposed literally reproduce the input.
2. **Irredundant.** Every term must earn its place — drop any one and the
   cover must break. Without this the search happily emits `E(3,8) + E(1,8)`,
   where the second term's only onset already sits inside the first.
3. **No trivial readings.** Any k-onset pattern decomposes into k
   single-onset terms; that is a restatement, not an explanation, so
   all-singleton readings are suppressed (`allowTrivial: true` to see them).

Consequence worth knowing: **son clave (`1001001000101000`) has no exact
reading in these two families** — not at 3 terms, not at 5. That is a real
result about the rhythm, not a limitation to route around.

### Long/short, built for the dynamic ambition

`longShort(steps, { tolerance })` returns the original's fields —
`intervals`, `short`, `long`, `pattern` (`"LLS"`), `morse` (`"--."`), a named
prosodic foot — plus what the integer-only original could not express:

- **`ratio` is a float.** The tresillo reads `3,3,2` → short 2, long 3,
  **ratio 1.50**, foot *antibacchic*.
- **`tolerance`** (a fraction of the interval span) lets intervals that are
  *near* a pole still classify as it. This is the hook for adaptive/expressive
  L/S: real playing never lands on integers, so the analysis must not demand
  them.
- **`durations(steps, { unit, ratio })`** turns the reading into performable
  values — measured by default (`[1.5, 1.5, 1]`), or forced to the classic
  integer reading (`{ ratio: 3 }` → `[3, 3, 1]`), or swung (`1.6`).

Named feet include the two-value classics plus `antibacchic` (LLS — the
tresillo), `bacchic`, and `cretic`.

## Named-pattern import (2026-07-22, second pass)

The adapter, built onto `@enkerli/library` rather than porting the old
localStorage store — so Serpe's rhythms sit beside every other kind of suite
content and inherit its identity/provenance/facet model.

**`0x5BA` is correct.** Decoded in UPI's own hex convention (each nibble
bit-reversed — `0x94:8` is the tresillo, not `0x92`), `0x5BA:12` yields
`[0,2,4,5,7,9,11]`: exactly the standard bembé/short-bell timeline.

One entry per line, `Name: spec`, where spec is any UPI expression plus a
bare onset list. All four forms work, one at a time or as a pasted block:

```
Fume-Fume: [0,2,4,7,9]/12     onset indices, /12 = step count
Bembé: 0x5BA:12               hex (nibble-reversed, as UPI has always read it)
Tresillo: 10010010            binary
Gahu: E(7,12)                 any UPI expression
```

`msuite pattern --import <file|-> [--json]` prints a table, or emits validated
library items. A bad line reports its line number and is skipped — one typo in
a pasted list never discards the other forty.

Analysis is computed **at import** and stored as facets (`euclidean`,
`reading`, `longShort`, `foot`, `ratio`, `steps`, `onsets`), which is what
makes the database browsable the way the original's `euclidean` field was —
"show me the Euclidean ones", "everything antibacchic", "12-step only".

A result that fell out of it: **Bembé is `E(7,12,7)`** — a *rotation* of the
same Euclidean that gives Gahu (`E(7,12)`). The rotation-aware detector earns
its keep on the first real vocabulary it met.

No canned catalogue ships. Which timeline is "the" bembé depends on tradition,
region and transcription; baking one spelling into the suite would launder an
editorial choice into an apparent fact. The importer is the feature; the
vocabulary is yours.

## Dynamic long/short — push/pull

`dynamicDurations(steps, { ratio, depth, seed, pass })` makes the long/short
contrast breathe. It **reuses GloriArp's pocket model** rather than inventing
a second one: the same correlated, mean-reverting walk from
`@enkerli/accompaniment`'s `express.ts` (GLORIARP_NEXT §2), where metric
weight sets how hard each position pulls the walk home. There it displaces
onsets in milliseconds; here it stretches the durational contrast — the same
Keil gesture applied to duration rather than placement.

- `ratio` takes a point (`1.5`) **or a range** (`[1.4, 1.8]`), and a range is
  a promise: the walk never leaves it (verified across 200 seeds).
- `depth` 0..1; **depth 0 returns exactly the static `durations()`**.
- Deterministic — `(seed, pass)` reproduces byte-identically, and a new
  `pass` breathes differently, matching the discipline every other expressive
  layer in the suite follows.

## In the UI (2026-07-22, third pass)

Both features are now reachable from Serpe, verified in a real browser.

**Correction to the previous pass:** Serpe was described here as having "no
browsing UI" for patterns. That was wrong — it already used the shared
`createLibraryBrowser` (`PatternLibrary`), with saved/preset/recent entries
persisted at the `serpe.library` key. So the right move was to *extend* that
one library, not add a rival panel beside it.

### Durations (long/short) — `DurationsPanel`

A new section showing the `longShort` reading (morse, L/S string, named foot,
measured ratio and intervals) plus the two controls that make it playable:

- **Ratio**, as two numbers. Equal = static; second > first = a range.
- **Push / pull** (0–100%) = `dynamicDurations`' `depth`.

**What you must input to get a DYNAMIC long/short: both.** A range *and*
push/pull above zero — either alone is inert, and the panel says which is
missing rather than looking broken. Verified live: at depth 0 the durations
read `[1.50 1.00 1.50 1.00 1.50]`; at 70% with a 1.5–2.2 range they read
`[1.87 1.00 1.72 1.00 1.98]` — the longs move, the shorts stay at the unit.
The contrast breathes; the grid does not.

The bar chart and the printed duration list update live, so the setting is
legible rather than a number you have to trust.

### Named import — folded into the existing library

*import named…* under **Patterns** accepts one line or a pasted block, and
entries land in the same browser as everything else with a `Named` source
facet. Errors report their line number and don't discard the batch.

Two things fell out of wiring it in:

- Every library row now carries its analysis as tags, so the **existing
  presets** gained it too: `tresillo` shows `#E(3,8) #antibacchic`,
  `khafif-e-ramal` shows `#E(2,5) #trochaic`. That is the original RPE
  database's `euclidean`-field capability, now on the shared browser.
- Serpe's presets already included some named rhythms (`khafif-e-ramal`,
  `aksak`) — worth knowing given the "was there a catalogue?" question this
  investigation started from. Still not a catalogue; still prose-adjacent
  presets. But not nothing.

## The notation: `LS(…)` (2026-07-22, fourth pass)

The previous pass shipped panel controls but **no way to say any of it in
UPI** — so "what do I type to get a dynamic long/short?" had no answer. It
does now; the durational layer is part of the notation:

```
E(3,8) LS(3)                 fixed: a long lasts 3× a short
E(3,8) LS(1.4..1.8)          a range — the contrast breathes within it
E(3,8) LS(1.4..1.8, 70%)     …with an explicit push/pull depth (or 0.7)
{101}E(5,8) LS(1.5..2)       composes with accents
P(3,0)+P(5,0) LS(2..3)       …and with combinations
```

Three decisions worth keeping:

- **`..` for the range, not `-`.** The combination parser splits on top-level
  `+`/`-`; a hyphen inside `LS()` would be ambiguous the moment someone wrote
  `E(3,8)+E(2,8) LS(1.4-1.8)`. The suffix is also stripped *first*, before any
  other parsing, exactly like the `{…}` accent prefix — so its contents can
  never reach the splitter at all. A regression test covers precisely this.
- **A range with no depth means full depth.** `LS(1.4..1.8)` obviously intends
  movement; defaulting depth to 0 would make it silently inert, which is the
  same trap the panel warns about. A *bare* ratio (`LS(3)`) has no range, so
  its depth is 0 — static, as written.
- **Values are clamped, not rejected.** `LS(0.2..0.1, 500%)` yields a sane
  min ≥ 1, max ≥ min, depth ≤ 1 rather than an error or an inverted range.

`parseUPI` returns the spec as `longShort: {min, max, depth}` (or `null`).
Serpe's `applyPattern` feeds it straight into the Durations controls —
verified in a browser: typing `E(3,8) LS(1.4..1.8, 70%)` moves the ratio
fields to 1.4/1.8 and push/pull to 70%. `msuite pattern "E(3,8) LS(3)"`
prints `durate  fixed 3:1  →  [3.00 3.00 1.00]`.

## Additive / aksak meters — the notation that really did change (fifth pass)

**This is the "long/short" that was actually missing**, and the earlier passes
in this document answered a different question. Recorded plainly because the
confusion cost several rounds:

| "Long/short" can mean | Status |
|---|---|
| **Counting a bar as long and short BEATS** — Balkan 9/8 as *short short short long* (2+2+2+3). Structural: it defines the rhythm. | **The real gap. Fixed in this pass.** |
| *Reading* an existing pattern's gaps as long/short (`LLS`, `--.`) | Restored earlier (`longShort`) |
| *Stretching* how long notes SOUND at playback | Added earlier (`LS(…)`, `dynamicDurations`) |

### What changed in the notation, and when

The original Rhythm Pattern Explorer documented two related input forms
(`WebApp/app/index.html`, syntax list):

```
Morse Intervals: -.-- (dots=short, dashes=long intervals)
Custom Durations: D:1,5 pattern (short=1, long=5), D:3,1 (reverse short/long)
```

The dot/dash form survived into UPI. **`D:s,l` did not** — so the surviving
form was stuck at short=1, long=2, and `...-` produced `11110` (5 steps)
rather than a 9-step aksak. The *interval* reading was intact; the ability to
say **what a short and a long are worth** was gone, and that is exactly the
control an additive meter needs. Nothing recorded the removal, which is why it
read as "the notation changed and I never documented it" — accurate.

### Restored, plus a more general form

```
D:2,3 ...-      short short short long → 2+2+2+3 = the Balkan 9/8
A(2,2,2,3)      the same bar, as explicit beat GROUPS
A(2,2,3,2)      a ROTATION — a different rhythm, and E(4,9) won't give it
A(2,2,3)        7/8;  A(2,3,2,2,2) → 11/8
D:1,5 .-        the original's own example (1+5)
D:3,1 .-        reversed feel (3+1)
```

`D:s,l` is the original's syntax, restored verbatim. `A(…)` is new and more
general: aksak meters are not always two-valued (2+2+3+2+2), and `A()` says
the groups outright instead of encoding them as short/long.

**`E(4,9)` is not a substitute.** It happens to equal 2+2+2+3, which is why it
sat in the presets as "aksak" — but it cannot express that bar's rotations
(`A(2,2,3,2)`, `A(3,2,2,2)`), and most additive meters are not Euclidean at
all. The coincidence is what let the gap hide.

### It round-trips

`A(2,2,2,3)` analysed by `longShort` gives intervals `[2,2,2,3]`, pattern
`SSSL`, morse `...-` — the notation you typed. Input and analysis are proper
inverses, which is the check that they are the same concept rather than two
lookalikes. A test asserts it.

Defaults are untouched: a bare `...-` still means short=1/long=2, and `SOS`
still gives its 12 steps.

## Microtiming — the push/pull that was actually meant (sixth pass)

**A correction.** Asked for "a dynamic long/short — a push/pull, like Keil's
participatory discrepancies", this document's previous pass built
`dynamicDurations`: it varies how long a note **lasts**. Push/pull is about
**where the attack lands** — ahead of or behind the beat. Those are different
musical parameters, and the wrong one was built. Worse, `LS(…)` was never
wired to playback at all, so it was inaudible: correct-looking numbers in a
panel, silence in the ears. "I'm not hearing a difference" was the accurate
report of a real defect, not a misunderstanding.

`packages/upi/src/microtiming.js` is the right primitive, and it **is** wired
to Serpe's scheduler.

### The model

`microtiming(steps, {depth, seed, pass})` returns a displacement per onset in
fractions of a step (+ late, − early). Four properties, each load-bearing:

1. **Per ONSET, not per interval** — the thing being displaced is an attack.
2. **Correlated, not i.i.d.** — the walk accumulates and resolves, so the
   phrase leans and settles. Independent per-note noise is what sounds like a
   broken quantiser, and is the usual wrong implementation of this idea.
3. **Anchored by metric weight** — downbeat pinned hardest, offbeats loosest.
4. **Bar length preserved EXACTLY.** `timingScales()` differences the
   displacements into per-step multipliers, so lengthening one gap necessarily
   shortens another. Verified across 30 seeds at full depth: the cycle sums to
   its nominal length to 9 decimal places. This is what separates "playing
   with the beat" from "drifting away from it", and it is why the primitive
   returns displacements to be differenced rather than perturbing intervals
   directly.

Displacement is capped at ±0.35 of a step — past ~0.5 an onset crosses its
neighbour and the result reads as a different rhythm, not as feel.

### It is audible — measured, not assumed

Serpe's `stepDur(idx)` (the function feeding the scheduler's `setTimeout`) now
applies the scales, memoised per cycle. Instrumenting the real page:

```
A(2,2,2,3)            step gaps: 125 125 125 125 …          (1 distinct value)
A(2,2,2,3) PD(60%)    step gaps: 125 125 129.04 120.96 94.82 155.18 …
```

Note the compensation — a long gap followed by a short one. That is the
bar-preserving property visible in the scheduled timing itself.

### Notation

```
A(2,2,2,3) PD(20%)          a light lean
E(3,8) PD(0.25, 7)          depth as a fraction, with an explicit seed
A(2,2,2,3) LS(1.4..1.8) PD(30%)   length and placement compose
```

Push/pull rides **on top of** swing rather than replacing it: swing is a
fixed, repeating subdivision; PD is a walk that differs every cycle (Serpe
bumps the pass at each cycle boundary).

### The vocabulary, finally straight

| Parameter | Notation | What it changes | Wired to playback? |
|---|---|---|---|
| Structure | `A(2,2,2,3)`, `D:2,3 ...-` | which beats are long/short | yes (it *is* the pattern) |
| **Placement** | **`PD(20%)`** | **when attacks land — push/pull** | **yes, web audio** |
| Length | `LS(1.4..1.8)` | how long notes sound (gate) | **no — readout only** |

## Poly lanes, and verifying by MIDI rather than by ear (seventh pass)

Reported: `A(2,2,2,3) PD(90%)/A(2,2,2,3)` — the two lanes still sounded in
sync. Correct report; **three** separate faults, only the first of which the
previous pass had addressed.

1. **`parsePolyUPI` dropped per-lane `PD(…)` entirely** — the lane's own
   suffix parsed to `microtiming: null`, so the depth never reached anything.
   (The *pattern* was fine, because `parseUPI` strips the suffix before
   parsing; only the feel was discarded.) Lanes now carry their own
   `microtiming` and `longShort`, which is the point of poly: one lane pushes
   while another stays straight.
2. **Poly runs a different scheduler.** The previous pass wired mono's
   `stepDur()`; poly ticks each lane on `laneStepMs(lane)` — one fixed value,
   no per-step variation. Now `laneStepMsAt(lane, li, idx)` applies that
   lane's own walk, cached per (lane, depth, seed, cycle).
3. **A React bug in the first attempt at (2).** The next step index and its
   timing were computed *inside* a `setLanePh(ph => …)` updater, then used on
   the line after — but a functional setState may run after the caller
   returns (and twice under StrictMode), so the scheduler kept reading the
   pre-update value and nothing changed. The phase now advances in a **ref**,
   synchronously; the state update is for display only. Worth remembering as
   a pattern: *anything a timer needs synchronously must not be computed
   inside a state updater.*

Measured in the real page (scheduled `setTimeout` gaps):

```
A(2,2,2,3)/A(2,2,2,3)             60 125 60 125 125 125 …   (2 distinct)
A(2,2,2,3) PD(90%)/A(2,2,2,3)     60 125 60 125 120.94 125 60 129.06 …
```

### `msuite upi --midi` — checking timing objectively

Suggested during the same report, and a much better instrument than ears:
render the pattern to a Standard MIDI File with `PD(…)` applied and read the
ticks.

```
msuite upi "A(2,2,2,3)"          --midi straight.mid --bars 2
msuite upi "A(2,2,2,3) PD(60%)"  --midi pushed.mid   --bars 2
```

Note-on ticks parsed back **out of the written files**:

```
straight: 0 240 480 720 | 1080 1320 1560 1800
pushed  : 0 240 462 706 | 1080 1317 1535 1791
delta   : 0   0 -18 -14 |    0   -3  -25   -9  ticks
```

Cycle 2 begins at tick **1080 in both** — the attacks are displaced, the bar
is not. That is the bar-preserving property demonstrated on artefact bytes
rather than asserted, and it is the check to reach for whenever "is this
actually doing anything?" comes up again.

## Still open

1. **`LS(…)` is still not wired to playback** — it remains a readout. Its
   likely home is **articulation**: note length against step length is exactly
   staccato-vs-legato, which is a more useful framing than "dynamic long/short"
   and is how it should probably be presented and named.
2. **The C++ engine has neither.** `microtiming.js` is JS; Serpe's plugin
   scheduler would need the same treatment (the model is small and portable —
   displacements, differenced, downbeat pinned). Needs a Mac to build.
3. **Nothing calls `dynamicDurations` at PLAYBACK yet.** The panel computes
   and displays the durations, and they are correct — but Serpe's scheduler
   (and the C++ plugin engine) still play fixed-length notes. Making the
   rhythm actually *sound* dynamic means feeding these durations into the
   note-length path on both sides. That is the honest boundary of this pass:
   the control is real and its output is real, but it is a readout, not yet
   an instruction to the player. The suite now has
   `@enkerli/library` (identity/provenance/facets) and a `library-browser`
   component, which is a better foundation than the original's
   localStorage-and-binary-dedup approach — so the right move is probably a
   Serpe adapter onto `@enkerli/library`, not a port of the old file. Needs a
   decision before code.
2. **Dynamic L/S / participatory discrepancies.** `tolerance`, float `ratio`
   and `durations()` are the analysis groundwork. The *generative* half — a
   long/short that adapts to context as it plays, rather than being measured
   once — is unbuilt, and is a design conversation (what does the ratio
   respond to: position in the cycle? density? a running feel parameter?
   ranges rather than points?).
3. **A named-pattern catalogue** genuinely does not exist anywhere in the
   history. If it is wanted, it is new work — and `identify()` now makes it
   cheap to attach names to recognised formulas.
