/**
 * Leadsheet ↔ SMF bridge (SUITE_AUDIT_AND_PLAN §7, step 3). Carries a
 * theory `Progression` through a Standard MIDI File: a playable block-chord
 * realization for any DAW, DAW-visible per-chord markers, and the full
 * progression embedded as an MCURATOR text-meta payload so it round-trips
 * losslessly. This is what lets ProgGenie hand a progression to MIDIcurator
 * (and back) as an ordinary `.mid` — the first horizontal suite link.
 *
 * Lives in @enkerli/midi (which owns the SMF codec) so theory stays
 * zero-dep; depends on theory only for the type + realize.
 */

import { realizeLeadsheet, type Progression } from "@enkerli/theory";
import { createSMF, readMetaTextEvents, type MidiMarker, type MidiNote } from "./index.js";

/** Marker prefix for the embedded progression (the MCURATOR JSON family). */
const PROG_PREFIX = "MCURATOR:v1 PROG ";

/**
 * The text-meta event that embeds a Progression in an SMF. Apps that build
 * their own richer SMF (e.g. ProgGenie's voiced, channel-split export) add
 * this to `textEvents` so the file still carries the canonical leadsheet.
 */
export function progressionTextEvent(prog: Progression): MidiMarker {
  return { tick: 0, text: PROG_PREFIX + JSON.stringify(prog) };
}

export interface ProgressionSmfOptions {
  bpm?: number;
  /** Beats each chord occupies in the realized clip (default 2). */
  beatsPerChord?: number;
  ticksPerBeat?: number;
  trackName?: string;
}

/**
 * Render a Progression to a Standard MIDI File: block-chord notes (pcs in
 * the octave above middle C, root doubled in the bass), per-chord symbol
 * markers, and the embedded progression payload.
 */
export function progressionToSMF(prog: Progression, opts: ProgressionSmfOptions = {}): Uint8Array {
  const { bpm = prog.meta?.bpm ?? 120, beatsPerChord = 2, ticksPerBeat = 480 } = opts;
  const trackName = opts.trackName ?? prog.meta?.title;

  const notes: MidiNote[] = [];
  const markers: MidiMarker[] = [];
  const stepTicks = beatsPerChord * ticksPerBeat;

  let i = 0;
  for (const bar of realizeLeadsheet(prog)) {
    for (const chord of bar) {
      const startTick = i * stepTicks;
      markers.push({ tick: startTick, text: chord.symbol });

      const used = new Set<number>();
      for (const pc of chord.pcs) {
        let n = 60 + (((pc % 12) + 12) % 12);
        while (used.has(n)) n += 12;
        used.add(n);
        notes.push({ pitch: n, startTick, durationTicks: stepTicks, velocity: 80 });
      }
      notes.push({ pitch: 36 + (((chord.rootPc % 12) + 12) % 12), startTick, durationTicks: stepTicks, velocity: 88 });
      i++;
    }
  }

  return createSMF(notes, {
    bpm,
    ticksPerBeat,
    ...(trackName ? { trackName } : {}),
    markers,
    textEvents: [progressionTextEvent(prog)],
  });
}

/**
 * Recover the embedded Progression from an SMF written by progressionToSMF.
 * Returns null if the file carries no progression payload.
 */
export function progressionFromSMF(bytes: Uint8Array): Progression | null {
  for (const ev of readMetaTextEvents(bytes)) {
    if (ev.metaType === 0x01 && ev.text.startsWith(PROG_PREFIX)) {
      return JSON.parse(ev.text.slice(PROG_PREFIX.length)) as Progression;
    }
  }
  return null;
}
