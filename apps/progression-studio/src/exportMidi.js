/**
 * MIDI export — the generated, curated progression as a Standard MIDI
 * File, matching what playback renders: two beats per chord, taxicab
 * voice-led voicings over a root bass note, with each chord's symbol and
 * degree label as DAW-visible markers.
 */

import { createSMF, progressionTextEvent } from "@enkerli/midi";
import { parseLeadsheet } from "@enkerli/theory";
import { timestampedName } from "@enkerli/ui/naming";

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
  let startBeat = 0;
  for (const v of voicings) {
    const len = v.dur ?? BEATS_PER_CHORD; // per-chord duration (harmonic rhythm)
    notes.push({ startBeat, lengthBeats: len, pitch: v.bass, velocity: 88, channel: 1 });
    v.notes.forEach((pitch, vi) => {
      const channel =
        channelMode === "perVoice" ? Math.min(16, 2 + vi)
        : channelMode === "split" ? 2
        : 1;
      notes.push({ startBeat, lengthBeats: len, pitch, velocity: 72, channel });
    });
    startBeat += len;
  }
  return { notes, lengthBeats: startBeat };
}

/** Cumulative start beat of each voicing (for markers / chord-follow). */
export function chordStartBeats(voicings) {
  const starts = [];
  let acc = 0;
  for (const v of voicings) { starts.push(acc); acc += v.dur ?? BEATS_PER_CHORD; }
  return starts;
}

/**
 * Build SMF bytes from voiced chords (see generate.js voiceProgression).
 * Keeps ProgGenie's rich voiced, channel-split realization AND embeds the
 * canonical Progression (when `key` is given) so MIDIcurator and the rest
 * of the suite can recover the leadsheet from the file.
 */
export function progressionToSMF(voicings, { bpm = 120, name = "Progression", channelMode = "single", key = null } = {}) {
  const { notes: clipNotes } = voicingsToClip(voicings, channelMode);
  const starts = chordStartBeats(voicings);
  const markers = voicings.map((v, i) => ({
    tick: Math.round(starts[i] * TICKS_PER_BEAT),
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

/** A filename-safe slug from a free-text title (keeps it readable). */
function slug(s) {
  return s.replace(/♯/g, "#").replace(/♭/g, "b").replace(/[^\w #-]+/g, " ").trim().replace(/\s+/g, " ");
}

function exportFileName({ tonic, mode, seed, title, destination }) {
  // Timestamped so repeated exports never collide ("…_1 2.mid"): the title (or
  // seed) identifies the progression, the timestamp keeps the file unique. A
  // "midicurator" destination prefixes the name so the handoff is legible.
  const t = tonic.replace(/♯/g, "#").replace(/♭/g, "b");
  const base = title?.trim() ? slug(title) : `progression_${t}_${mode}_${seed}`;
  const prefix = destination === "midicurator" ? "to-midicurator " : "";
  return timestampedName(`${prefix}${base}`, "mid");
}

/**
 * Export entry point. In the plugin the bytes go over the bridge and C++
 * saves them natively (blob:/data: downloads kill the page in WKWebView —
 * "Frame load interrupted"); in a browser, ordinary download.
 *
 * The SMF embeds the canonical Progression as an `MCURATOR` meta-event, so
 * the suite (MIDIcurator) reads the leadsheet back — `destination` only
 * names the handoff and the filename, it doesn't change the bytes. The live
 * link is future; today both "Send to MIDIcurator" and "Export MIDI file"
 * route through the one native save/share path.
 */
export function exportProgression(bridge, voicings, { bpm, tonic, mode, seed, channelMode, title, destination }) {
  const name = title?.trim() || `progression ${tonic} ${mode} #${seed}`;
  const bytes = progressionToSMF(voicings, { bpm, name, channelMode, key: { tonic, mode } });
  const filename = exportFileName({ tonic, mode, seed, title, destination });
  if (bridge?.saveFile?.(filename, bytes)) return;
  const blob = new Blob([bytes], { type: "audio/midi" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
