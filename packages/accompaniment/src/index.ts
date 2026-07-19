/**
 * @enkerli/accompaniment — GloriArp's engine (docs/GLORIARP_BRIEF.md,
 * docs/GLORIARP_AUDIT.md). Slice 1: the canonical phrase contract,
 * extraction with honest chord-relative inference, transparent features,
 * and the deterministic bass adapter with traces. Headless by construction —
 * no DOM, no WebMIDI, no storage; UI and CLI call this same engine.
 */

export {
  PHRASE_SCHEMA_V, ROLES, RELATION_CATEGORIES,
  validatePhrase, serializePhrase, parsePhrase,
  type AccompanimentPhrase, type AccompanimentRole, type PhraseEvent,
  type ChordRelation, type ChordRelationCategory, type FrameChord,
  type HarmonicFrame, type Meter, type ProvenanceRef, type PhraseValidation,
} from "./phrase.js";
export { extractPhrase, chordDegreeOf, type ExtractOptions, type InputNote } from "./extract.js";
export { applyRhythm, type RhythmSpec } from "./rhythm.js";
export {
  articulate, metricWeight, GATES,
  type ArticulateOptions, type ArticulateResult, type ArticulationChange,
} from "./articulate.js";
export {
  expressPhrase,
  type ExpressOptions, type ExpressResult, type ExpressChange,
} from "./express.js";
export {
  groove, framesFromProgression,
  type GrooveOptions, type GrooveResult, type FramesOptions,
} from "./pipeline.js";
export { computeFeatures, type PhraseFeatures } from "./features.js";
export {
  adaptBassPhrase, ENGINE, ENGINE_VERSION,
  type BassAdaptOptions, type BassAdaptResult, type PitchRange,
} from "./bass.js";
export {
  buildTrace, TRACE_LEVELS,
  type Trace, type TraceEvent, type TraceHeader, type TraceLevel, type TraceSummary,
} from "./trace.js";
