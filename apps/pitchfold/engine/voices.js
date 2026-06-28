/**
 * PitchFold voice processing — JS port of Source/Quantizer/VoiceProcessor.h.
 * Given one quantized note, produce the output notes for the current mode.
 * Note-off matching is handled by the caller via a note-map (mirrors the C++
 * PluginProcessor), so this only computes Note-On outputs + holds VoiceSplit's
 * round-robin index.
 */
import { buildChord, harmonize } from "./pcs.js";

export const VoiceMode = { Through: 0, MonoMerge: 1, PolySpread: 2, VoiceSplit: 3, Chordize: 4 };
const MAX_CHORD_VOICES = 8;

export class VoiceProcessor {
  constructor() { this._splitIndex = 0; }
  reset() { this._splitIndex = 0; }

  /** Returns an array of { note, channel } to emit for this Note-On. */
  processNoteOn(note, channel, cfg) {
    switch (cfg.mode) {
      case VoiceMode.PolySpread:
        return buildChord(note, cfg.chordMask, cfg.chordRoot, MAX_CHORD_VOICES, cfg.loNote, cfg.hiNote)
          .map((n) => ({ note: n, channel: 1 }));

      case VoiceMode.Chordize:
        return harmonize(note, cfg.chordMask, MAX_CHORD_VOICES, cfg.loNote, cfg.hiNote)
          .map((n) => ({ note: n, channel: 1 }));

      case VoiceMode.VoiceSplit: {
        const span = Math.max(1, cfg.splitVoices);
        const ch = Math.min(16, Math.max(1, cfg.splitChannel + (this._splitIndex % span)));
        this._splitIndex = (this._splitIndex + 1) % span;
        return [{ note, channel: ch }];
      }

      case VoiceMode.MonoMerge:
      case VoiceMode.Through:
      default:
        return [{ note, channel }];
    }
  }
}
