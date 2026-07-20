/**
 * PitchFold voice processing — JS port of Source/Quantizer/VoiceProcessor.h.
 * Given one quantized note, produce the output notes for the current mode.
 * Note-off matching is handled by the caller via a note-map (mirrors the C++
 * PluginProcessor), so this only computes Note-On outputs + holds VoiceSplit's
 * round-robin index.
 */
import { buildChord, harmonize } from "./pcs.js";
import { VoiceSplitter } from "@enkerli/voice-routing";

export const VoiceMode = { Through: 0, MonoMerge: 1, PolySpread: 2, VoiceSplit: 3, Chordize: 4 };
const MAX_CHORD_VOICES = 8;

export class VoiceProcessor {
  constructor() { this._splitter = new VoiceSplitter(); }
  reset() { this._splitter.reset(); }

  /** Returns an array of { note, channel } to emit for this Note-On. */
  processNoteOn(note, channel, cfg) {
    switch (cfg.mode) {
      case VoiceMode.PolySpread:
        return buildChord(note, cfg.chordMask, cfg.chordRoot, MAX_CHORD_VOICES, cfg.loNote, cfg.hiNote)
          .map((n) => ({ note: n, channel: 1 }));

      case VoiceMode.Chordize:
        return harmonize(note, cfg.chordMask, MAX_CHORD_VOICES, cfg.loNote, cfg.hiNote)
          .map((n) => ({ note: n, channel: 1 }));

      case VoiceMode.VoiceSplit:
        // Promoted to @enkerli/voice-routing (docs/PITCHFOLD_AUDIT.md) — the
        // one voice mode the audit found genuinely clean, now shared instead
        // of duplicated per app.
        return [{ note, channel: this._splitter.next(cfg.splitChannel, cfg.splitVoices) }];

      case VoiceMode.MonoMerge:
      case VoiceMode.Through:
      default:
        return [{ note, channel }];
    }
  }
}
