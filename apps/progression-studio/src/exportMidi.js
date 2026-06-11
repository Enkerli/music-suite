/**
 * MIDI export — the generated, curated progression as a Standard MIDI
 * File, matching what playback renders: two beats per chord, taxicab
 * voice-led voicings over a root bass note, with each chord's symbol and
 * degree label as DAW-visible markers.
 */

import { createSMF } from "@enkerli/midi";

export const TICKS_PER_BEAT = 480;
export const BEATS_PER_CHORD = 2;

/**
 * Beat-positioned clip from voiced chords — shared by SMF export and the
 * plugin bridge (enkerli MidiClipScheduler takes the same shape).
 */
export function voicingsToClip(voicings) {
  const notes = [];
  voicings.forEach((v, i) => {
    const startBeat = i * BEATS_PER_CHORD;
    notes.push({ startBeat, lengthBeats: BEATS_PER_CHORD, pitch: v.bass, velocity: 88, channel: 1 });
    for (const pitch of v.notes) {
      notes.push({ startBeat, lengthBeats: BEATS_PER_CHORD, pitch, velocity: 72, channel: 1 });
    }
  });
  return { notes, lengthBeats: voicings.length * BEATS_PER_CHORD };
}

/** Build SMF bytes from voiced chords (see generate.js voiceProgression). */
export function progressionToSMF(voicings, { bpm = 120, name = "Progression" } = {}) {
  const { notes: clipNotes } = voicingsToClip(voicings);
  const markers = voicings.map((v, i) => ({
    tick: i * TICKS_PER_BEAT * BEATS_PER_CHORD,
    text: `${v.symbol} (${v.label})`,
  }));
  const notes = clipNotes.map((n) => ({
    pitch: n.pitch,
    startTick: Math.round(n.startBeat * TICKS_PER_BEAT),
    durationTicks: Math.round(n.lengthBeats * TICKS_PER_BEAT),
    velocity: n.velocity,
  }));
  return createSMF(notes, { bpm, ticksPerBeat: TICKS_PER_BEAT, trackName: name, markers });
}

/** Browser download helper. */
export function downloadProgression(voicings, { bpm, tonic, mode, seed }) {
  const name = `progression ${tonic} ${mode} #${seed}`;
  const bytes = progressionToSMF(voicings, { bpm, name });
  const blob = new Blob([bytes], { type: "audio/midi" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `progression_${tonic.replace(/♯/g, "#").replace(/♭/g, "b")}_${mode}_${seed}.mid`;
  a.click();
  URL.revokeObjectURL(url);
}
