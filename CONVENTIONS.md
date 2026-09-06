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

## Bit ordering (binary / decimal / hex) — leftmost = LSB, everywhere

**The first element of any bit-encoded sequence is bit 0 (the LEAST significant
bit).** Sequences read strictly left to right: element i has value 2^i. This
applies identically to pitch-class sets and rhythm patterns, in every language
(TS, Lua, C++) and every representation (binary, octal, decimal, hexadecimal).

### Pitch-class sets
Pitch class i = bit i, so pc 0 (C) is the low bit. The canonical form is the
12-bit **decimal** mask (used as the chord-dictionary key):

| Set | Binary (pc0…pc11) | Decimal |
|---|---|---|
| C major triad `{0,4,7}` | `100010010000` | 145 |
| C ionian `{0,2,4,5,7,9,11}` | `101011010101` | 2741 |

(The binary string lists pc0…pc11 left to right; the decimal reads its first
char as the low bit — so decimal `1` = `{C}`, `2` = `{C♯}`.)

### Rhythm patterns
Step k = bit k. **Hex/octal digits are written little-endian too** — the first
step's nibble (steps 0-3) is the LEFTMOST hex digit — so the hex string is the
reverse of the integer's ordinary numeral:

| Pattern | Meaning | Hex | Octal | Decimal |
|---|---|---|---|---|
| `1000` | hit · rest · rest · rest | 0x1 | 1 | 1 |
| `1011` | hit · rest · hit · hit | 0xD | 51 | 13 |
| `10010010` | E(3,8) tresillo | 0x94 | 111 | 73 |

So hex `0x94` and decimal `73` are the SAME tresillo in different transcriptions
(`0x94` read low-digit-first = 9 + 4·16 = 73), not equal as raw numbers. Decimal
is the plain integer Σ 2^step; only hex/octal reverse the digit order.

### Step counts are explicit
Trailing high bits (the later steps / higher pcs) vanish in a bare numeral, so
rhythm decimal/hex forms always travel with a step count — Serpe's `:N` suffix
(`0x94:8`), or an explicit `steps` parameter in APIs. Patterns whose length is
not a multiple of 4 are still plain numerals, parsed back by padding to the
declared step count. (PCS masks are always 12 wide, so no suffix.)

### Exemption: external file formats
Parsers for formats defined elsewhere (Standard MIDI File variable-length
quantities, Apple Loops metadata masks, etc.) keep that format's native
bit order — the convention governs *our* notation, not other people's
file formats. MIDIcurator's `apple-loops-parser.ts` is the current example.

### Compliance status (2026-06-22; PitchFold updated 2026-07-01)
| Codebase | Status |
|---|---|
| `@enkerli/theory` | ✅ reference — PCS + rhythm codecs both leftmost-LSB |
| `@enkerli/ui` `pcs-ring` | ✅ leftmost-LSB |
| MIDIcurator (via theory) | ✅ |
| PickPCS / chord-dictionary / progression-studio / exquisite-fingerings | ✅ via theory (rebuild deployed bundles) |
| PitchFold `PCSEngine.h` | ✅ harmonized 2026-06-29 (PitchFold repo, incl. the JS side in `apps/pitchfold`) |
| Serpe webapp + plugin | ✅ rhythm leftmost-LSB (**breaking** for saved hex/octal/decimal — see Serpe CHANGELOG) |

### History
Both domains originally read leftmost = LSB. On 2026-06-10 the suite was unified
**MSB-first** (`BREAKING`: tresillo `0x49`→`0x92`, `{0,4,7}` `145`→`2192`). On
2026-06-22 that was reverted: everything is leftmost-LSB again — sequences read
strictly left to right, the low bit first (`0x1` = step 0 / pitch class 0).
`@enkerli/theory`'s codecs (`patternToDecimal`, `patternFromHex`, `pcsToDecimal`,
…) and `packages/theory/vectors/*.json` are the reference.

**One value keeps being written down wrong, in prose, in four separate files:
the C major scale is 2741, not 2773.** Every implementation has always been
right; only the comments were wrong, four times, the same way. It recurs because
2773 is not a nonsense number — it is what you get reading C major's bit string
backwards, and read the right way round it is C **Lydian**, which is also
`M13♯11`'s pitch-class set in the chord dictionary. A wrong number that is a
different real thing survives review in a way that a wrong number never does.

The check, when you are about to write one of these down:

| | leftmost-LSB bit string | value |
|---|---|---|
| C major / Ionian | `101011010101` | 2741 = `0xAB5` |
| C Lydian | `101010110101` | 2773 = `0xAD5` |

They are each other's reverse. If a comment says the major scale is 2773, it is
describing the MSB-first convention this suite abandoned on 2026-06-22 — or it
is describing Lydian.

For the notation *above* those codecs — UPI's `0x…`, `o…`, `d…`, `[i,j,k]:n`
and bare bit-string forms — `packages/upi/vectors/upi.json` is the reference,
and it carries `0x94` and `0x49` side by side precisely because reading the
digits the other way round is the mistake this section exists to prevent. It
also records the widths, which are the second thing a port gets wrong: `d73` is
seven steps and `d73:8` is eight, so a decimal form without an explicit width
loses the pattern's final rest.
