# PCS Schema

## Representation

Bitmask convention (strict, suite-wide — see music-suite CONVENTIONS.md):
**pitch class i is bit i — leftmost = LSB** (pc 0 is the low bit, so `0x1` =
`{C}`, `0x2` = `{C♯}`). The 12-char binary string lists pc0…pc11 left to
right; its decimal reads the first char as the low bit: C major triad
`{0,4,7}` `100010010000` = 145 (0x91); C ionian `{0,2,4,5,7,9,11}`
`101011010101` = 2741.

{
  "pcs": [0,2,4,5,7,9,11],
  "bitmask": 2741,
  "cardinality": 7
}

## Subset

{
  "type": "triad",
  "degree": 0,
  "pcs": [0,4,7],
  "bitmask": 145,
  "quality": "maj",
  "label": "I"
}
