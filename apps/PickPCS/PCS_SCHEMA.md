# PCS Schema

## Representation

Bitmask convention (strict, suite-wide — see music-suite CONVENTIONS.md):
**pitch class 0 is the leftmost / most significant bit** (pc 0 contributes
2^11 in a 12-bit mask). A mask is the ordinary binary numeral of the
left-to-right bit string: C ionian `101011010101` = 2773; C major triad
`100010010000` = 2192.

{
  "pcs": [0,2,4,5,7,9,11],
  "bitmask": 2773,
  "cardinality": 7
}

## Subset

{
  "type": "triad",
  "degree": 0,
  "pcs": [0,4,7],
  "bitmask": 2192,
  "quality": "maj",
  "label": "I"
}
