/**
 * Chord Dictionary — provided by @enkerli/theory (the suite's shared theory
 * core). This module re-exports the same surface so existing imports keep
 * working. Migration finalized 2026-06-14 (the local port was removed).
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
