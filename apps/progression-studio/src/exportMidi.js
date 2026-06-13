/**
 * MIDI export — the generated, curated progression as a Standard MIDI
 * File, matching what playback renders: two beats per chord, taxicab
 * voice-led voicings over a root bass note, with each chord's symbol and
 * degree label as DAW-visible markers.
 */

import { createSMF, progressionTextEvent } from "@enkerli/midi";
import { parseLeadsheet } from "@enkerli/theory";

export const TICKS_PER_BEAT = 480;
export const BEATS_PER_CHORD = 2;

/**
 * Build the canonical theory Progression from the voiced chords' degree
 * labels ("IIm7", "V7", …) — one chord per bar, key-relative — so the
 * exported SMF carries the leadsheet (parseLeadsheet reads each label as a
 * degree chord). Returns null when there are no labels to embed.
 */
export function progressionFromVoicings(voicings, key, meta) {
  const labels = voicings.map((v) => v.label).filter(Boolean);
  if (labels.length === 0 || !key) return null;
  const prog = parseLeadsheet(labels.join(" | "), key);
  if (meta) prog.meta = meta;
  return prog;
}

/**
 * Beat-positioned clip from voiced chords — shared by SMF export and the
 * plugin bridge (enkerli MidiClipScheduler takes the same shape).
 */
/**
 * channelMode routes voices for downstream splitting:
 *   "single"   — everything on ch 1 (default)
 *   "split"    — bass on ch 1, chord voices on ch 2
 *   "perVoice" — bass on ch 1, voice i on ch 2+i (capped at 16)
 */
export function voicingsToClip(voicings, channelMode = "single") {
  const notes = [];
  voicings.forEach((v, i) => {
    const startBeat = i * BEATS_PER_CHORD;
    const bassCh = 1;
    notes.push({ startBeat, lengthBeats: BEATS_PER_CHORD, pitch: v.bass, velocity: 88, channel: bassCh });
    v.notes.forEach((pitch, vi) => {
      const channel =
        channelMode === "perVoice" ? Math.min(16, 2 + vi)
        : channelMode === "split" ? 2
        : 1;
      notes.push({ startBeat, lengthBeats: BEATS_PER_CHORD, pitch, velocity: 72, channel });
    });
  });
  return { notes, lengthBeats: voicings.length * BEATS_PER_CHORD };
}

/**
 * Build SMF bytes from voiced chords (see generate.js voiceProgression).
 * Keeps ProgGenie's rich voiced, channel-split realization AND embeds the
 * canonical Progression (when `key` is given) so MIDIcurator and the rest
 * of the suite can recover the leadsheet from the file.
 */
export function progressionToSMF(voicings, { bpm = 120, name = "Progression", channelMode = "single", key = null } = {}) {
  const { notes: clipNotes } = voicingsToClip(voicings, channelMode);
  const markers = voicings.map((v, i) => ({
    tick: i * TICKS_PER_BEAT * BEATS_PER_CHORD,
    text: `${v.symbol} (${v.label})`,
  }));
  const notes = clipNotes.map((n) => ({
    pitch: n.pitch,
    startTick: Math.round(n.startBeat * TICKS_PER_BEAT),
    durationTicks: Math.round(n.lengthBeats * TICKS_PER_BEAT),
    velocity: n.velocity,
    channel: (n.channel ?? 1) - 1, // SMF channels are 0-based
  }));
  const prog = progressionFromVoicings(voicings, key, { bpm, title: name });
  return createSMF(notes, {
    bpm,
    ticksPerBeat: TICKS_PER_BEAT,
    trackName: name,
    markers,
    textEvents: prog ? [progressionTextEvent(prog)] : [],
  });
}

function exportFileName({ tonic, mode, seed }) {
  return `progression_${tonic.replace(/♯/g, "#").replace(/♭/g, "b")}_${mode}_${seed}.mid`;
}

/**
 * Export entry point. In the plugin the bytes go over the bridge and C++
 * saves them natively (blob:/data: downloads kill the page in WKWebView —
 * "Frame load interrupted"); in a browser, ordinary download.
 */
export function exportProgression(bridge, voicings, { bpm, tonic, mode, seed, channelMode }) {
  const name = `progression ${tonic} ${mode} #${seed}`;
  const bytes = progressionToSMF(voicings, { bpm, name, channelMode, key: { tonic, mode } });
  const filename = exportFileName({ tonic, mode, seed });
  if (bridge?.saveFile?.(filename, bytes)) return;
  const blob = new Blob([bytes], { type: "audio/midi" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
