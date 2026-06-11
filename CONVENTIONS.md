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

## Bit ordering (binary / decimal / hex) — strict, everywhere

**The first element of any bit-encoded sequence is the leftmost bit, i.e. the
most significant bit of the numeral.** A bit string is read as an ordinary
binary number. This applies identically to pitch-class sets and rhythm
patterns, in every language (TS, Lua, C++) and every representation
(binary, octal, decimal, hexadecimal).

### Pitch-class sets
Bit i (from the left, 0-based) = pitch class i. A 12-bit mask:

| Set | Binary | Decimal |
|---|---|---|
| C ionian | `101011010101` | 2773 |
| C major triad | `100010010000` | 2192 |

### Rhythm patterns
Bit i (from the left) = step i. Examples:

| Pattern | Meaning | Hex | Decimal |
|---|---|---|---|
| `1011` | hit · rest · hit · hit | 0xB | 11 |
| `10111010` | hit · rest · hit · hit · hit · rest · hit · rest | 0xBA | 186 |
| `10010010` | E(3,8) tresillo | 0x92 | 146 |

### Step counts are explicit
Leading rests vanish in a bare numeral (`0010` = 2 = `10`), so decimal/hex
forms always travel with a step count — Serpe's `:N` suffix (`0x92:8`),
or an explicit `steps` parameter in APIs. Patterns whose length is not a
multiple of 4 are still plain numerals: `101110` (6 steps) = 0x2E, parsed
back by left-padding to the declared step count.

### Exemption: external file formats
Parsers for formats defined elsewhere (Standard MIDI File variable-length
quantities, Apple Loops metadata masks, etc.) keep that format's native
bit order — the convention governs *our* notation, not other people's
file formats. MIDIcurator's `apple-loops-parser.ts` is the current example.

### Compliance status (2026-06-10)
| Codebase | Status |
|---|---|
| `@enkerli/theory` (PCS + rhythm codecs) | ✅ reference implementation |
| MIDIcurator (via theory) | ✅ |
| PickPCS code | ✅ already MSB; PCS_SCHEMA.md example fixed |
| PitchFold `PCSEngine.h` | ✅ already MSB (`bit (11 − interval)`) |
| Serpe webapp + plugin | ✅ flipped 2026-06-10 (**breaking** for saved hex/octal/decimal patterns — see Serpe CHANGELOG) |
| exquisite-fingerings | ✅ flipped 2026-06-10 (was LSB) |

### History
Serpe's webapp/plugin previously used the opposite rule (leftmost = LSB,
`1000` = 0x1), while its own documentation example (`0x92:8` for tresillo)
already assumed MSB-first. PickPCS's PCS_SCHEMA.md mixed both. As of
2026-06-10 the MSB-first rule above is canonical; `@enkerli/theory`'s
codecs (`patternToDecimal`, `patternFromHex`, `pcsToDecimal`, …) are the
reference implementations, pinned by `packages/theory/vectors/*.json`.
