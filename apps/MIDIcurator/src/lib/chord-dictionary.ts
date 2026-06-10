/**
 * Chord Dictionary — now provided by @enkerli/theory (the suite's shared
 * theory core). This module re-exports the same surface so existing imports
 * keep working. The previous local implementation is preserved unchanged in
 * ./chord-dictionary.local.ts until the migration is finalized.
 */
export {
  type ChordQuality,
  type ChordMatch,
  rootName,
  rootNameSharp,
  rootNameFlat,
  spellRoot,
  spellInChordContext,
  buildChordToneSpellingMap,
  pcsToBinary,
  binaryToDecimal,
  pcsToDecimal,
  rotatePcs,
  lookupByDecimal,
  getAllQualities,
  findQualityByKey,
  dictionarySize,
  findQualityByIntervals,
} from "@enkerli/theory";
