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

## Still open

1. **Nothing calls `dynamicDurations` at PLAYBACK yet.** The panel computes
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
