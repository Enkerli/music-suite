# Suite conventions

## Note spelling in chords and scales — structural, never chromatic-table lookup

**In a chord or scale context, notes are called by their proper names.**
B♯ is the same pitch class as C and F♭ the same as E, but from G♯ the major
third is **B♯** — C would be a diminished fourth. Proper names are derived
structurally, never by looking a pitch class up in a chromatic table:

1. **The interval's degree fixes the letter.** A third above G♯ is some kind
   of B; a seventh above G♯ is some kind of F. Compound degrees keep their
   letter (9th = 2nd, 11th = 4th, 13th = 6th).
2. **The interval's size in semitones fixes the alteration.** G♯ + 4
   semitones on letter B → B♯; G♯maj7's seventh → F𝄪. Double accidentals
   are correct outcomes, not errors.
3. **Heptatonic scales use seven consecutive letters, one each.**
   F♯ major ends with E♯; C♭ major contains F♭.
4. **The root's spelling is the only free enharmonic choice.** Once the root
   is named (G♯ vs A♭), every chord tone and scale degree follows
   deterministically. This is what makes scale-degree work and functional
   analysis trustworthy.

**Pitch-class sets are different.** A bare PCS has no proper spelling —
there is no way to tell G from F𝄪 without context. Context-free PCS display
uses chromatic names (a declared sharp/flat policy) and that's fine; what's
forbidden is using chromatic tables where a chord/scale context exists.

Reference implementation: `@enkerli/theory` `spelling.ts`
(`parseSpelled`, `transposeSpelled`, `spellChordTones`, `spellScale`),
pinned by `packages/theory/vectors/spelling.json`. Chord-tone naming flows
through `buildChordToneSpellingMap` (structural); `spellRoot` /
`spellInChordContext` are heuristics reserved for context-free display and
non-chord tones, and are documented as such in the code.

### Compliance status (2026-06-10)
| Codebase | Status |
|---|---|
| `@enkerli/theory` | ✅ `spelling.ts` reference; `buildChordToneSpellingMap` + slash-chord bass names rewired to structural spelling |
| MIDIcurator (via theory) | ✅ chord tones structurally spelled through the shims |
| PickPCS | ✅ by design: PCS display (chromatic) — correct for its context |
| exquisite-fingerings | ✅ (2026-06-11, monorepo copy): spelled key selector (17 roots incl. D♭/D♯/G♭/G♯/A♯); grid labels spell structurally via theory (`spellScale` for heptatonic scales, degree labels for chords/pentatonics); chromatic fallback retained for chromatic/whole-tone/custom sets — correct, those are context-free PCS |
| Local Lua / future Roman-numeral work | must consume codegen'd spelling rules; the degree-assertion regeneration (Phase 1) depends on this convention |

## Degree labels in published tables

Transition tables and progression displays label chords as
**Roman numeral + compact display suffix**: `IIm7`, `V7`, `Imaj7`, `♭II7`,
`VIIm7b5`, `Im7`. Numerals are always uppercase with Unicode accidental
prefixes (♭ ♯ 𝄫 𝄪); quality is carried entirely by the suffix.
The suffix is the dictionary key's canonical shorthand
(`displaySuffix()` in `@enkerli/theory`), with a contract enforced by test:
**every display suffix parses back to its quality**
(`qualityKeyForSuffix(displaySuffix(k)) === k`), so labels are
machine-round-trippable, never just decoration. Unknown corpus suffixes
pass through as written (and are audited).

## Bit ordering (binary / decimal / hex) — strict, by domain

Bit-encoded sequences are read **left to right**, but the numeral convention
differs by domain (they were briefly unified MSB-first on 2026-06-10; rhythm
reverted to leftmost-LSB on 2026-06-22 — see History):

- **Rhythm patterns: leftmost = LSB.** The first step is bit 0, so step k has
  value 2^k. Read strictly left to right (`0x1:4` = `1000`).
- **Pitch-class sets: leftmost = MSB.** Bit i from the left (0-based) = pitch
  class i, read as an ordinary binary numeral.

Each rule applies in every language (TS, Lua, C++) and representation
(binary, octal, decimal, hexadecimal).

### Pitch-class sets (leftmost = MSB)
Bit i (from the left, 0-based) = pitch class i. A 12-bit mask:

| Set | Binary | Decimal |
|---|---|---|
| C ionian | `101011010101` | 2773 |
| C major triad | `100010010000` | 2192 |

### Rhythm patterns (leftmost = LSB)
Step k (from the left, 0-based) has value 2^k. Examples:

| Pattern | Meaning | Hex | Decimal |
|---|---|---|---|
| `1000` | hit · rest · rest · rest | 0x1 | 1 |
| `1011` | hit · rest · hit · hit | 0xD | 13 |
| `10010010` | E(3,8) tresillo | 0x49 | 73 |

### Step counts are explicit
Trailing rests (the high steps) vanish in a bare numeral, so rhythm
decimal/hex forms always travel with a step count — Serpe's `:N` suffix
(`0x49:8`), or an explicit `steps` parameter in APIs. Patterns whose length
is not a multiple of 4 are still plain numerals, parsed back by padding to
the declared step count. (PCS masks are always 12 wide, so no suffix.)

### Exemption: external file formats
Parsers for formats defined elsewhere (Standard MIDI File variable-length
quantities, Apple Loops metadata masks, etc.) keep that format's native
bit order — the convention governs *our* notation, not other people's
file formats. MIDIcurator's `apple-loops-parser.ts` is the current example.

### Compliance status (2026-06-22)
| Codebase | Status |
|---|---|
| `@enkerli/theory` | ✅ reference — PCS codecs MSB, rhythm codecs leftmost-LSB |
| MIDIcurator (via theory) | ✅ |
| PickPCS code | ✅ PCS MSB |
| PitchFold `PCSEngine.h` | ✅ PCS MSB (`bit (11 − interval)`) |
| exquisite-fingerings | ✅ PCS MSB |
| Serpe webapp + plugin | ✅ rhythm leftmost-LSB (reverted 2026-06-22; **breaking** for saved hex/octal/decimal patterns — see Serpe CHANGELOG) |

### History
Rhythm patterns originally read leftmost = LSB (`1000` = 0x1, tresillo =
`0x49`). On 2026-06-10 the suite unified *everything* MSB-first (`BREAKING`),
making tresillo `0x92`. On 2026-06-22 the rhythm convention was reverted to
leftmost-LSB — patterns should read strictly left to right, the low bit on the
first step — while pitch-class sets stay MSB-first (PCS_SCHEMA, PitchFold,
exquisite-fingerings unchanged). `@enkerli/theory`'s rhythm codecs
(`patternToDecimal`, `patternFromHex`, …) and `packages/theory/vectors/rhythm.json`
are the reference for rhythm; its PCS codecs (`pcsToDecimal`, …) remain the
reference for pitch-class sets.
