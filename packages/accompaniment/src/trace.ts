/**
 * Generation traces (GLORIARP_BRIEF §20): every output must be able to answer
 * "which engine, which seed, which source, why THIS note". A trace is plain
 * serializable data, built at a chosen level — `none` still records the
 * reproducibility header (engine/seed/source) because reproducibility is not
 * optional, it's the contract.
 */

export const TRACE_LEVELS = ["none", "summary", "events", "full"] as const;
export type TraceLevel = (typeof TRACE_LEVELS)[number];

export interface TraceHeader {
  engine: string;
  engineVersion: string;
  seed: number;
  sourcePhraseId: string;
  /** Frame symbols in order — the harmonic timeline at a glance. */
  frames: string[];
  options: Record<string, unknown>;
}

export interface TraceEvent {
  /** Output event index (post-drop), or -1 for a dropped source event. */
  index: number;
  onset: number;
  bar: number;
  sourceEventId?: string;
  category: string;
  /** Source pitch → transposition ideal → chosen output pitch. */
  sourceNote?: number;
  ideal?: number;
  chosen?: number;
  reason: string;
  /** Constraint repairs applied, in order (range shifts, leap guards…). */
  repairs?: string[];
}

export interface TraceSummary {
  sourceEvents: number;
  outputEvents: number;
  dropped: number;
  chordTones: number;
  approachesKept: number;
  approachesSnapped: number;
  repairs: number;
}

export interface Trace {
  level: TraceLevel;
  header: TraceHeader;
  summary?: TraceSummary;
  events?: TraceEvent[];
}

/** Assemble a trace honoring the level (events kept only at events/full). */
export function buildTrace(
  level: TraceLevel,
  header: TraceHeader,
  summary: TraceSummary,
  events: TraceEvent[],
): Trace {
  const t: Trace = { level, header };
  if (level !== "none") t.summary = summary;
  if (level === "events" || level === "full") t.events = events;
  return t;
}
