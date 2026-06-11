/**
 * MIDI export — the generated, curated progression as a Standard MIDI
 * File, matching what playback renders: two beats per chord, taxicab
 * voice-led voicings over a root bass note, with each chord's symbol and
 * degree label as DAW-visible markers.
 */

import { createSMF } from "@enkerli/midi";

export const TICKS_PER_BEAT = 480;
export const BEATS_PER_CHORD = 2;

/** Build SMF bytes from voiced chords (see generate.js voiceProgression). */
export function progressionToSMF(voicings, { bpm = 120, name = "Progression" } = {}) {
  const ticksPerChord = TICKS_PER_BEAT * BEATS_PER_CHORD;
  const notes = [];
  const markers = [];

  voicings.forEach((v, i) => {
    const startTick = i * ticksPerChord;
    markers.push({ tick: startTick, text: `${v.symbol} (${v.label})` });
    notes.push({ pitch: v.bass, startTick, durationTicks: ticksPerChord, velocity: 88 });
    for (const pitch of v.notes) {
      notes.push({ pitch, startTick, durationTicks: ticksPerChord, velocity: 72 });
    }
  });

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
