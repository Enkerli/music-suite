/**
 * Voice Split — round-robin channel distribution.
 *
 * Extracted from PitchFold's `VoiceProcessor.VoiceSplit` mode
 * (`Source/Quantizer/VoiceProcessor.h` in Enkerli/PitchFold, JS twin in
 * `apps/pitchfold/engine/voices.js`). The PitchFold audit
 * (docs/PITCHFOLD_AUDIT.md) singled this mode out as the one voice-routing
 * feature with clean C++/JS parity and zero engine-specific coupling — note
 * in, channel out — so it's promoted here rather than staying duplicated
 * per app. Other suite tools that want the same "spread these notes across
 * a few channels/voices, round-robin" behavior (Vane poly, the Workspace
 * bus) use this instead of reimplementing the rotation.
 *
 * Deliberately narrow: this is ONLY the channel-picking rule, not a note
 * router. Callers own their own note-on/off semantics (a plugin's
 * MidiBuffer, a suite bus `note` message, a synth voice pool, whatever) —
 * `next()` just answers "which channel does the NEXT note go to."
 */
export class VoiceSplitter {
  private index = 0;

  /** Restart the rotation from the first channel in the span. */
  reset(): void {
    this.index = 0;
  }

  /**
   * Pick the next channel in the rotation and advance.
   * @param baseChannel first channel in the span (1-based; clamped 1..16)
   * @param span how many consecutive channels to rotate across (>= 1)
   */
  next(baseChannel: number, span: number): number {
    const n = Math.max(1, Math.floor(span));
    const ch = Math.round(baseChannel) + (this.index % n);
    this.index = (this.index + 1) % n;
    return Math.min(16, Math.max(1, ch));
  }
}

/**
 * Stateless one-shot form: given how many notes have already been split
 * (`priorCount`), which channel does note number `priorCount` land on.
 * Equivalent to a fresh `VoiceSplitter` advanced `priorCount` times, for
 * callers that don't want to hold an instance (e.g. deriving a channel from
 * an externally-tracked counter).
 */
export function splitChannel(baseChannel: number, span: number, priorCount: number): number {
  const n = Math.max(1, Math.floor(span));
  const idx = ((Math.floor(priorCount) % n) + n) % n;
  return Math.min(16, Math.max(1, Math.round(baseChannel) + idx));
}

/**
 * Mono Merge — priority-based note-stealing for a monophonic voice.
 *
 * The other half of PitchFold's original `VoiceProcessor` voice modes
 * (docs/PITCHFOLD_AUDIT.md): where Mono Merge's C++/JS engines both had a
 * real `monoSelect` param that neither `processMono()` implementation ever
 * read (pure theater — the audit's headline finding), this is the actual
 * priority-selection rule, extracted fresh rather than ported from dead
 * code. The 2026-07-20 "Reprioritized" note proposed delivering it as a
 * Workspace-level note-router instead of rebuilding it twice inside one
 * plugin's two engines — this class is the shared rule that router uses.
 *
 * Deliberately narrow, same discipline as VoiceSplitter: this tracks HELD
 * NOTES and answers "what should be sounding now," not "how do I turn that
 * into MIDI/bus messages." A caller feeds it note-on/note-off events (bare
 * note numbers) and gets back which note to ATTACK and which to RELEASE —
 * both may be set at once (a genuine steal: the new note attacks the
 * instant the old one releases), either may be null, but never garbled: a
 * decision's `attack`/`release` always reflect exactly what changed about
 * "what's sounding," nothing more. Velocity/channel/articulation for the
 * attacked note are the CALLER's concern — this class only ever sees plain
 * note numbers, so it has nothing else to carry.
 */
export type MonoPriority = "last" | "lowest" | "highest" | "first";

export interface MonoDecision {
  /** The note that should start sounding now, or null if nothing changed
   *  about what's attacking. */
  attack: number | null;
  /** The note that should stop sounding now, or null if nothing changed
   *  about what's releasing. Can be set alongside `attack` (a steal). */
  release: number | null;
}

const NO_CHANGE: MonoDecision = { attack: null, release: null };

export class MonoMerge {
  private held: number[] = []; // arrival order, oldest first
  private priorityMode: MonoPriority;

  constructor(mode: MonoPriority = "last") {
    this.priorityMode = mode;
  }

  get mode(): MonoPriority {
    return this.priorityMode;
  }

  /** Which currently-held note wins, under the active priority rule —
   *  null when nothing is held. */
  private pick(): number | null {
    if (!this.held.length) return null;
    switch (this.priorityMode) {
      case "last": return this.held[this.held.length - 1]!;
      case "first": return this.held[0]!;
      case "lowest": return this.held.reduce((a, b) => (b < a ? b : a));
      case "highest": return this.held.reduce((a, b) => (b > a ? b : a));
    }
  }

  private decide(before: number | null): MonoDecision {
    const after = this.pick();
    if (after === before) return NO_CHANGE;
    return { attack: after, release: before !== null && before !== after ? before : null };
  }

  /** A note starts. Idempotent if it's already held (a duplicate on with
   *  no intervening off doesn't retrigger or reorder it) — a caller that
   *  wants retrigger-on-repeat behavior can noteOff() first. */
  noteOn(note: number): MonoDecision {
    const before = this.pick();
    if (!this.held.includes(note)) this.held.push(note);
    return this.decide(before);
  }

  /** A note ends. A no-op (returns NO_CHANGE) if it wasn't held. */
  noteOff(note: number): MonoDecision {
    const before = this.pick();
    this.held = this.held.filter((n) => n !== note);
    return this.decide(before);
  }

  /** Change priority rule live — if a different note now wins under the
   *  new rule, this returns the same attack/release shape as a note event
   *  would, so a caller can apply mode changes through the identical
   *  publish path instead of a special case. */
  setMode(mode: MonoPriority): MonoDecision {
    const before = this.pick();
    this.priorityMode = mode;
    return this.decide(before);
  }

  /** Every held note released at once — engagement ending mid-note, or a
   *  panic reset. Returns what WAS sounding (to release), or null if
   *  nothing was. */
  releaseAll(): number | null {
    const was = this.pick();
    this.held = [];
    return was;
  }

  /** Held notes, arrival order — read-only diagnostic, not part of the
   *  decision contract. */
  get heldNotes(): number[] {
    return [...this.held];
  }
}
