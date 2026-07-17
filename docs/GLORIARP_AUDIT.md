# GloriArp — repository audit & first-slice plan

*2026-07-17. The answer the brief (docs/GLORIARP_BRIEF.md §22/§24) requires
before any implementation: what exists, what's reusable, what the first
vertical slice touches. No architecture changed by this document.*

## 1. Answers to the brief's ten questions

**1. Which MIDIcurator modules are already Node-clean and reusable?**
`apps/MIDIcurator/src/lib/` is mostly Node-clean and vitest-covered:
`midi-parser.ts` (SMF → events/notes, plus `extractMcuratorSegments` — the
embedded segment metadata reader), `gesture.ts` (`extractGesture`,
`extractHarmonic`, `computeSyncopation` — rhythm/harmony features from a note
list), `chord-detect.ts`, `chord-segments.ts` (splice/clean segment
boundaries), `progression-import.ts`, `midi-export.ts` (writes the
`MCURATOR:v1 PROG` payload), `transform.ts` (`transformGesture`), and
`generate-clip.ts` (`generateProgressionClip` — already a small
progression-to-notes realizer). Browser-bound and NOT reusable:
`loop-database.ts`/`bridge-db.ts` (sql.js), `db.ts`, `juce-bridge.ts`,
`webmidi-out.ts`, `piano-roll.ts`, `playback.ts`. The shared `Note` type lives
in `apps/MIDIcurator/src/types/clip.ts` — app-local, so the phrase schema must
not import it (define its own event shape; write a converter in MIDIcurator).

**2. Which existing types represent progression, chord, meter, spelling, SMF
metadata?** `@enkerli/theory` `leadsheet.ts`: `ProgChord`, `Bar`, `Section`,
`Progression`, `RealizedChord` — the canonical progression the whole suite
shares (ProgGenie realizes into it, MIDIcurator imports/exports it, `msuite
smf` writes it). `@enkerli/midi`: `MidiNote`, `MidiMarker`, `SmfOptions`,
`MetaTextEvent`, `progressionToSMF`/`progressionFromSMF` (embedded
`MCURATOR:v1 PROG`). Spelling: structural spelling utilities in
`@enkerli/theory` (`spelling.ts`). Meter: SMF time signature only — there is
no standalone `Meter` type yet; the phrase schema introduces one (bar-relative
ticks + numerator/denominator), kept serializable.

**3. Is protocol `pattern` adequate for a phrase?** No. `PatternBody` is
`{steps, mask, name?}` — a boolean rhythm, no pitch/velocity/duration/
expression. A phrase needs its own versioned type eventually (`phrase`), but
**the first slice needs no protocol change at all**: input is a progression
(existing canonical type / `--progression` text), output is SMF + trace JSON,
and live playback can already ride the new `note` message (shipped
2026-07-17) to Vane. Defer `phrase` until MIDIcurator round-trips it (brief
§12's audit-before-adding rule, applied to ourselves).

**4. Where should phrase/library schemas live?** The phrase contract in the
new engine package (`@enkerli/accompaniment/src/phrase.ts`), since it IS the
engine's public contract. Library wrapping stays in `@enkerli/library` — a
phrase is stored as a `LibraryItem` with a new `kind` (see Q5), payload = the
serialized `AccompanimentPhrase`.

**5. How should provenance use the library envelope?** `@enkerli/library`
already has `Provenance`/`ProvenanceSource`/`PayloadRef` and license statuses
— exactly the brief's traceability list. A generated take is a `LibraryItem`
whose provenance points at the source phrase item id + seed + engine version
+ profile; "promote" is just saving that item. No envelope changes needed
beyond adding a `phrase` entry to `KINDS`.

**6. Minimum annotation to generate the first bassline?** Per the brief §17:
role (`bass`), meter, bar alignment, and the harmonic frame the source phrase
was played against (one chord, e.g. Dm7). Chord-relative categories
(chord-tone/passing/approach) are *inferred* by extraction with a confidence
flag — not required as human input for slice 1.

**7. Which rhythm features reuse `@enkerli/upi`?** Everything mask-shaped:
`analyse` (onsets, evenness, balance, center of gravity), `syncopation`,
`intervals`, plus the transforms (rotate/mutate) for rhythm variation.
MIDI-derived features (velocity contour, micro-timing, durations) stay in the
new package — UPI steps are boolean, leftmost = LSB, and the phrase's onset
grid quantizes onto them for exactly these reuses.

**8. Deterministic RNG shared with `@enkerli/proggen`?** `mulberry32` in
`packages/proggen/src/generate.js` — small, proven, already the suite's
seeded-RNG idiom. Promote it to a tiny shared module (either export it from
`@enkerli/proggen` — it already is exported — and depend on it, or lift to
`@enkerli/theory`). Recommendation: **import from `@enkerli/proggen`** for
slice 1; lift only if a dependency cycle appears.

**9. How is a generation trace embedded or linked from SMF?** The same
mechanism as `MCURATOR:v1 PROG`: a meta text event (`GLORIARP:v1 TRACE
<ref>`) carrying either the trace inline (small) or a content hash linking to
the sidecar `trace.json`. `@enkerli/midi` `MetaTextEvent` already supports
this; MIDIcurator's parser already scans meta text.

**10. What exact files and tests comprise the first PR?** See §3 below.

## 2. Decisions proposed

- **Package boundary:** `packages/accompaniment` → `@enkerli/accompaniment`.
  Deps: `@enkerli/theory`, `@enkerli/midi`, `@enkerli/upi`,
  `@enkerli/proggen` (RNG + realization helpers), `@enkerli/library`
  (envelope types). No DOM/WebMIDI/sql.js. "GloriArp" stays the playflow
  name, not a package.
- **Slice 1 scope (brief §17 verbatim):** one curated monophonic bass phrase,
  adapted across a canonical progression; chord-relative pitch model; rhythm
  preservation 1.0 default; controlled chromatic approaches; range clamp;
  seed-deterministic; SMF + trace out; CLI verb `msuite accompany`.
- **No protocol additions in slice 1.** Live output later = `note` messages;
  a `phrase` type comes with the MIDIcurator round-trip slice.
- **No UI in slice 1.** MIDIcurator/workspace surfaces wait for the engine
  contract to hold (brief §21: engine first, UI and CLI call the same engine).

## 3. First-PR file plan

```
packages/accompaniment/package.json         deps as above; tsc -b like siblings
packages/accompaniment/src/phrase.ts        AccompanimentPhrase, PhraseEvent,
                                            ChordRelation, HarmonicFrame, Meter,
                                            (de)serialization + validation
packages/accompaniment/src/extract.ts       notes[] + harmonic frame → phrase
                                            (chord-relative categories, with
                                            "unclassified" honesty + confidence)
packages/accompaniment/src/features.ts      transparent feature vector (reuses
                                            @enkerli/upi analyse for the mask
                                            half; MIDI-derived half local)
packages/accompaniment/src/bass.ts          the deterministic bass adapter:
                                            reharmonize per HarmonicFrame,
                                            range clamp, contour preservation,
                                            optional chromatic approaches
                                            (each carrying category + target)
packages/accompaniment/src/trace.ts         trace levels none|summary|events|full
packages/accompaniment/src/index.ts         public surface
packages/accompaniment/src/*.test.ts        unit tests per brief §19 (serialization
                                            round-trip, range property, approach
                                            resolution, seed determinism)
packages/accompaniment/vectors/…            committed JSON vectors: one source
                                            phrase + Dm7|G7|Cmaj7|A7 expected
                                            output at seed 42 (the brief §17
                                            acceptance test, byte-for-byte)
packages/library/src/index.ts               + "phrase" in KINDS (1 line + test)
packages/cli/src/index.ts                   accompany(opts) library fn
packages/cli/src/cli.ts                     `msuite accompany --progression …
                                            --role bass --seed N -o bass.mid
                                            [--trace t.json] [--explain]`
packages/midi/src/index.ts                  (only if needed) GLORIARP:v1 TRACE
                                            meta-text writer — may already be
                                            expressible with MetaTextEvent
docs/CONTROL_PLANE.md / HEADLESS.md         one row/§ each: the accompany verb
root package.json build-packages            + packages/accompaniment
```

## 4. Risks

- **Type duplication drift:** MIDIcurator's `Note` vs the phrase `PhraseEvent`
  — mitigated by a single converter in MIDIcurator and vectors that pin the
  mapping.
- **`generateProgressionClip` overlap:** MIDIcurator already realizes
  progressions to notes; the bass adapter must not become a second realizer.
  Keep the adapter phrase-driven (it transforms a *source* phrase), and later
  refactor `generate-clip.ts` to call the package rather than vice versa.
- **Meter creep:** slice 1 fixes 4/4; the `Meter` type exists from day one so
  odd meters don't force a schema break.
- **JS vs TS:** `@enkerli/upi`/`@enkerli/proggen` are JS with `.d.ts`;
  `@enkerli/accompaniment` should be TS like theory/midi/library — the
  imports already work that way in `@enkerli/cli`.
