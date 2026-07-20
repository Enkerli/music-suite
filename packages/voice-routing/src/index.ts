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
