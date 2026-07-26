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

## Still open

1. **The pattern database.** Not restored here. The suite now has
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
