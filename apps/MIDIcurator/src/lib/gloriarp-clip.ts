/**
 * GloriArp inside MIDIcurator: progression text in → accompaniment clip out.
 *
 * Thin converter over the isomorphic `groove()` pipeline in
 * @enkerli/accompaniment — the SAME engine the CLI (`msuite accompany`) and
 * the workspace module run, so a groove generated here is byte-identical to
 * those for the same options. The result is returned as ordinary clip
 * material (Note[] + leadsheet text), which is the whole trick: once it's a
 * Clip, the existing playback paths take over — WebAudio/WebMIDI in the
 * browser, and in the plugin the C++ MidiClipScheduler via bridge.setClip
 * (host-synced, looping, iPad AUv3 and standalone included). No new native
 * code needed.
 *
 * The four bundled styles are the committed CC0 acceptance vectors — the
 * same files the engine's byte-level tests pin.
 */

import { groove } from '@enkerli/accompaniment';
import type { AccompanimentPhrase } from '@enkerli/accompaniment';
import type { Note } from '../types/clip';

import walkingBass from '../../../../packages/accompaniment/vectors/source-walking-bass.json';
import funkGhost from '../../../../packages/accompaniment/vectors/source-funk-ghost.json';
import bossa from '../../../../packages/accompaniment/vectors/source-bossa.json';
import twoFeel from '../../../../packages/accompaniment/vectors/source-two-feel.json';

export const GROOVE_STYLES = {
  'walking-bass': walkingBass as unknown as AccompanimentPhrase,
  'funk-ghost': funkGhost as unknown as AccompanimentPhrase,
  'bossa': bossa as unknown as AccompanimentPhrase,
  'two-feel': twoFeel as unknown as AccompanimentPhrase,
} as const;

export type GrooveStyleName = keyof typeof GROOVE_STYLES;

export const GROOVE_STYLE_NAMES = Object.keys(GROOVE_STYLES) as GrooveStyleName[];

export interface GrooveClipRequest {
  /** Bar notation, e.g. "Dm7 | G7 | Cmaj7 | A7". */
  progression: string;
  style: GrooveStyleName;
  /** Optional UPI rhythm to perform the style's pitch material on. */
  rhythm?: string;
  seed: number;
  bpm: number;
  /** '' = engine default; otherwise staccato | tenuto | legato. */
  gate?: string;
  /** 0..1 each; 0/undefined leaves the articulation stage off. */
  dynamics?: number;
  rests?: number;
  anticipation?: number;
}

export interface GrooveClipData {
  notes: Note[];
  leadsheetText: string;
  filename: string;
  ppq: number;
  bpm: number;
}

/**
 * Run the pipeline and shape the result for the clip pipeline
 * (extractGesture + extractHarmonic + parseLeadsheet, like any import).
 * Throws with a human-readable message on a bad progression or rhythm.
 */
export function generateGrooveClip(req: GrooveClipRequest): GrooveClipData {
  const source = GROOVE_STYLES[req.style];
  const { phrase } = groove(source, {
    progression: req.progression,
    seed: req.seed,
    bpm: req.bpm,
    ...(req.rhythm ? { rhythm: req.rhythm } : {}),
    ...(req.gate ? { gate: req.gate } : {}),
    ...(req.dynamics ? { dynamics: req.dynamics } : {}),
    ...(req.rests ? { rests: req.rests } : {}),
    ...(req.anticipation ? { anticipation: req.anticipation } : {}),
  });

  const notes: Note[] = phrase.events
    .filter((e) => e.note !== undefined)
    .map((e) => ({
      midi: e.note!,
      ticks: e.onset,
      durationTicks: e.duration,
      velocity: e.velocity,
    }));

  return {
    notes,
    leadsheetText: req.progression,
    filename: `gloriarp-${req.style}-s${req.seed}.mid`,
    ppq: phrase.ticksPerBeat,
    bpm: req.bpm,
  };
}
