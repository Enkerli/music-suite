# Suite conventions

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
