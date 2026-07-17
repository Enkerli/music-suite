/**
 * The canonical accompaniment phrase — GloriArp's core contract
 * (docs/GLORIARP_BRIEF.md §5, docs/GLORIARP_AUDIT.md §2). A phrase stores
 * musical FUNCTION, not just MIDI numbers: each event may carry a
 * chord-relative interpretation so the phrase survives reharmonization and
 * transposition. Inferred fields carry confidence — the schema preserves
 * uncertainty rather than inventing certainty.
 *
 * Serialization is plain JSON (versioned, validated, round-trippable);
 * nothing here touches the DOM, WebMIDI, or storage.
 */

export const PHRASE_SCHEMA_V = 1;

export const ROLES = ["bass", "comping", "groove", "arp", "melodic-fill", "unknown"] as const;
export type AccompanimentRole = (typeof ROLES)[number];

/** Time signature; ticks are absolute from phrase start (`ticksPerBeat` scales them). */
export interface Meter {
  numerator: number;
  denominator: number;
}

export const RELATION_CATEGORIES = [
  "chord-tone", "extension", "scale-tone", "chromatic-approach", "passing-tone",
  "neighbor-tone", "enclosure", "suspension", "anticipation", "pedal", "unclassified",
] as const;
export type ChordRelationCategory = (typeof RELATION_CATEGORIES)[number];

/** How an event relates to the chord sounding under it. */
export interface ChordRelation {
  /** 1-based position in the chord's pcs (1 = root); 0 when not a chord tone. */
  degree: number;
  /** Semitone offset from the related tone (0 for an exact chord tone). */
  alteration: number;
  /** MIDI octave of the event (floor(note / 12)). */
  octave: number;
  category: ChordRelationCategory;
  /** 0..1 for inferred relations; omitted means human-asserted. */
  confidence?: number;
  /** Event index this one approaches/resolves to — cyclic, so a bar-end
   *  approach can target the loop's first event (chord-change behavior). */
  target?: number;
}

export interface PhraseEvent {
  /** Absolute start in ticks from phrase start. */
  onset: number;
  /** In ticks, > 0. */
  duration: number;
  /** 1..127. */
  velocity: number;
  /** MIDI note 0..127; omit for unpitched (percussive) events. */
  note?: number;
  /** 0..11; derivable from note but storable alone for pitch-class material. */
  pitchClass?: number;
  chordRelation?: ChordRelation;
  /** Polyphonic voice id (bass slice is monophonic; comping will need it). */
  voice?: number;
  /** Stable id back to the source clip's event (provenance per event). */
  sourceEventId?: string;
}

/** The chord a frame sounds — structurally a subset of theory's RealizedChord,
 *  so a RealizedChord assigns directly; redeclared to stay serialization-thin. */
export interface FrameChord {
  symbol: string;
  rootPc: number;
  pcs: number[];
}

/** One span of the harmonic timeline (ticks, [start, end)). */
export interface HarmonicFrame {
  start: number;
  end: number;
  chord: FrameChord;
}

/** Link to the curated source (an @enkerli/library item id, or free text). */
export interface ProvenanceRef {
  itemId?: string;
  note?: string;
}

export interface AccompanimentPhrase {
  v: number;
  id: string;
  role: AccompanimentRole;
  lengthTicks: number;
  ticksPerBeat: number;
  meter: Meter;
  source?: ProvenanceRef;
  events: PhraseEvent[];
  /** The harmony the events were played against (extraction) or generated
   *  for (adaptation). Optional: a phrase can be purely rhythmic. */
  harmonicFrames?: HarmonicFrame[];
  annotations?: Record<string, string>;
}

// ── Validation (never trust a phrase off the wire / disk) ────────────────────

export interface PhraseValidation {
  ok: boolean;
  errors: string[];
}

const isInt = (x: unknown): x is number => typeof x === "number" && Number.isInteger(x);
const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

export function validatePhrase(x: unknown): PhraseValidation {
  const errors: string[] = [];
  const p = x as Partial<AccompanimentPhrase> | null;
  if (typeof p !== "object" || p === null) return { ok: false, errors: ["not an object"] };
  if (p.v !== PHRASE_SCHEMA_V) errors.push(`v must be ${PHRASE_SCHEMA_V}`);
  if (typeof p.id !== "string" || !p.id) errors.push("id must be a non-empty string");
  if (!ROLES.includes(p.role as AccompanimentRole)) errors.push(`role must be one of ${ROLES.join("|")}`);
  if (!isInt(p.lengthTicks) || p.lengthTicks <= 0) errors.push("lengthTicks must be a positive integer");
  if (!isInt(p.ticksPerBeat) || p.ticksPerBeat <= 0) errors.push("ticksPerBeat must be a positive integer");
  const m = p.meter as Meter | undefined;
  if (!m || !isInt(m.numerator) || m.numerator < 1 || !isInt(m.denominator) || m.denominator < 1)
    errors.push("meter must have positive integer numerator/denominator");
  if (!Array.isArray(p.events)) {
    errors.push("events must be an array");
  } else {
    p.events.forEach((e, i) => {
      if (!isNum(e?.onset) || e.onset < 0) errors.push(`events[${i}].onset must be >= 0`);
      if (!isNum(e?.duration) || e.duration <= 0) errors.push(`events[${i}].duration must be > 0`);
      if (!isInt(e?.velocity) || e.velocity < 1 || e.velocity > 127) errors.push(`events[${i}].velocity must be 1..127`);
      if (e?.note !== undefined && (!isInt(e.note) || e.note < 0 || e.note > 127)) errors.push(`events[${i}].note must be 0..127`);
      if (e?.pitchClass !== undefined && (!isInt(e.pitchClass) || e.pitchClass < 0 || e.pitchClass > 11)) errors.push(`events[${i}].pitchClass must be 0..11`);
      const r = e?.chordRelation;
      if (r !== undefined) {
        if (!RELATION_CATEGORIES.includes(r.category)) errors.push(`events[${i}].chordRelation.category unknown`);
        if (!isInt(r.degree) || r.degree < 0) errors.push(`events[${i}].chordRelation.degree must be an integer >= 0`);
        if (!isInt(r.alteration)) errors.push(`events[${i}].chordRelation.alteration must be an integer`);
        if (r.confidence !== undefined && (!isNum(r.confidence) || r.confidence < 0 || r.confidence > 1))
          errors.push(`events[${i}].chordRelation.confidence must be 0..1`);
      }
    });
  }
  const frames = p.harmonicFrames;
  if (frames !== undefined) {
    if (!Array.isArray(frames)) errors.push("harmonicFrames must be an array");
    else frames.forEach((f, i) => {
      if (!isNum(f?.start) || !isNum(f?.end) || f.end <= f.start) errors.push(`harmonicFrames[${i}] must have start < end`);
      const c = f?.chord;
      if (!c || typeof c.symbol !== "string" || !isInt(c.rootPc) || c.rootPc < 0 || c.rootPc > 11 ||
          !Array.isArray(c.pcs) || c.pcs.length === 0 || !c.pcs.every((pc) => isInt(pc) && pc >= 0 && pc <= 11))
        errors.push(`harmonicFrames[${i}].chord must have symbol, rootPc 0..11, non-empty pcs 0..11`);
    });
  }
  return { ok: errors.length === 0, errors };
}

/** Stable JSON (2-space) — the committed-vector / on-disk form. */
export function serializePhrase(p: AccompanimentPhrase): string {
  return JSON.stringify(p, null, 2) + "\n";
}

/** Parse + validate; throws with the validation errors on bad input. */
export function parsePhrase(text: string): AccompanimentPhrase {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error(`phrase: not JSON — ${(e as Error).message}`);
  }
  const r = validatePhrase(parsed);
  if (!r.ok) throw new Error(`phrase: invalid — ${r.errors.join("; ")}`);
  return parsed as AccompanimentPhrase;
}
