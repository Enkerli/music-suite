/** A synthesised drum kit — see src/kit.js and src/voices.js. */
export interface DrumDef { note: number; pc: number; label: string }
export declare const KIT: Record<string, DrumDef>;
export declare const BY_NOTE: Record<number, string>;
export declare const BY_PC: Record<number, string>;
export declare const KIT_PCS: number[];
/** Kit name, GM note or pitch class → kit name; null when even the pc is unclaimed. */
export declare function resolveDrum(x: string | number): string | null;
/** A lane label ("kick", "hh", "Closed Hat") → kit name, or null. */
export declare function drumForLabel(label: string): string | null;
export declare const VOICES: Record<string, (ctx: unknown, p?: Record<string, number>) => void>;

export interface Hit {
  drum: string | number;
  timeSec: number;
  velocity?: number;
  params?: Record<string, number>;
}
export declare function renderHits(
  hits: Hit[],
  opts?: { sampleRate?: number; tailSec?: number; seed?: number },
): Float32Array;
export declare function wavMono16(samples: Float32Array, sampleRate?: number): Uint8Array;
