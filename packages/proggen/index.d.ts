/**
 * Type declarations for @enkerli/proggen (hand-authored — the engine is JS
 * ESM). Pragmatic types over the generation/realization surface the CLI and
 * other TS consumers use; the app (JSX) consumes the rest untyped.
 */

/** Corpus transition table: opaque to consumers, produced by @enkerli/corpus-tools. */
export type TransitionTable = Record<string, unknown>;
export type Mode = "major" | "minor";

export interface GenerateOptions {
  length: number;
  seed?: number;
  curation?: unknown;
  method?: "markov" | "markov-cadence" | "circle";
  temperature?: number;
  startFrom?: string | null;
  variety?: string;
  trigrams?: unknown;
  smart?: number;
}

/** Generate a progression as Roman-numeral labels (the suite convention). */
export function generateLabels(table: TransitionTable, mode: Mode, opts: GenerateOptions): string[];
export function generateProgression(
  table: TransitionTable, mode: Mode, length: number, seed?: number,
  curation?: unknown, temperature?: number, startFrom?: string | null,
  variety?: string, trigrams?: unknown, smart?: number,
): string[];
export function startLabel(table: TransitionTable, mode: Mode): string;

export interface RealizedChord {
  label: string;
  symbol: string;
  rootName: string;
  rootPc: number;
  pcs: number[];
  qualityKey: string | null;
}
export interface Key { tonic: string; mode: Mode }
/** Resolve a Roman-numeral label to a spelled chord in a key. */
export function realizeLabel(label: string, key: Key): RealizedChord | null;

export const BEATS_PER_BAR: number;
export function mulberry32(seed: number): () => number;

// The remaining generation/voicing/curation exports are available at runtime
// (re-exported from generate.js / curation.js); typed loosely for TS consumers.
export const NO_CURATION: unknown;
