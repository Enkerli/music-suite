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
 * STYLES = the four bundled CC0 acceptance vectors + the user's LEARNED
 * styles (docs/GLORIARP_NEXT.md slice C): any clip with a chord can be
 * captured as a source phrase via extractPhrase — curated capture, the
 * "learning" v1 — persisted locally and offered in the same style list.
 * A learned style is exactly the phrase-JSON contract external tools
 * (including local models) write, so export/import is the same format.
 */

import { groove, extractPhrase, validatePhrase } from '@enkerli/accompaniment';
import type { AccompanimentPhrase, AccompanimentRole, FrameChord, InputNote } from '@enkerli/accompaniment';
import type { Clip, Note } from '../types/clip';
import { getEffectiveBarChords } from './gesture';

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

// ── Learned styles: the user's captured phrases, persisted locally ───────────

const USER_STYLES_KEY = 'midicurator.gloriarp-styles';

/** Injectable for tests; defaults to window.localStorage when present. */
type KV = { getItem(k: string): string | null; setItem(k: string, v: string): void };
function store(kv?: KV): KV | null {
  if (kv) return kv;
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
}

export function listUserStyles(kv?: KV): { name: string; phrase: AccompanimentPhrase }[] {
  const s = store(kv);
  if (!s) return [];
  try {
    const raw = JSON.parse(s.getItem(USER_STYLES_KEY) ?? '[]') as { name: string; phrase: unknown }[];
    // Never trust storage: a corrupt or hand-edited phrase is dropped, not thrown.
    return raw.filter((e) => e && typeof e.name === 'string' && validatePhrase(e.phrase).ok)
      .map((e) => ({ name: e.name, phrase: e.phrase as AccompanimentPhrase }));
  } catch { return []; }
}

export function saveUserStyle(name: string, phrase: AccompanimentPhrase, kv?: KV): void {
  const s = store(kv);
  if (!s) throw new Error('no local storage available to keep learned styles');
  const list = listUserStyles(kv).filter((e) => e.name !== name); // replace same-name
  list.push({ name, phrase });
  s.setItem(USER_STYLES_KEY, JSON.stringify(list));
}

/** Every style name offered in the UI: bundled first, then learned. */
export function allStyleNames(kv?: KV): string[] {
  return [...GROOVE_STYLE_NAMES, ...listUserStyles(kv).map((e) => e.name)];
}

function resolveStyle(name: string, kv?: KV): AccompanimentPhrase {
  if (name in GROOVE_STYLES) return GROOVE_STYLES[name as GrooveStyleName];
  const user = listUserStyles(kv).find((e) => e.name === name);
  if (!user) throw new Error(`unknown style "${name}" — bundled: ${GROOVE_STYLE_NAMES.join(', ')}`);
  return user.phrase;
}

// ── Learn: a curated clip becomes a source phrase (extraction, slice-1 code) ─

/**
 * Capture a clip as a GloriArp style. The clip needs ONE identifiable chord
 * (its leadsheet's first chord, or the whole-clip detected chord) — the
 * harmonic frame extractPhrase infers chord-relations against. Inference is
 * honest by design: chord tones and approaches get confidence, the rest
 * stays unclassified. Role is a register heuristic the user can see in the
 * saved phrase (avg pitch below E3 → bass, else melodic-fill).
 */
export function learnStyleFromClip(clip: Clip, name: string, kv?: KV): AccompanimentPhrase {
  const g = clip.gesture;
  const pitches = clip.harmonic.pitches;
  if (!g.onsets.length || !pitches.length) throw new Error('clip has no notes to learn from');

  // The frame chord: leadsheet first, detection as fallback.
  const barChords = getEffectiveBarChords(clip);
  const lead = clip.leadsheet?.bars?.[0]?.chords?.[0]?.chord ?? null;
  const detected = lead ?? barChords?.find((b) => b.chord)?.chord ?? clip.harmonic.detectedChord ?? null;
  if (!detected) throw new Error('clip needs a chord (add a leadsheet, or let detection find one) so the phrase knows its harmony');
  const pcs = detected.templatePcs ?? detected.observedPcs ?? [];
  if (!pcs.length) throw new Error(`chord ${detected.symbol} carries no pitch classes to relate against`);
  const frame: FrameChord = { symbol: detected.symbol, rootPc: detected.root, pcs };

  const notes: InputNote[] = g.onsets.map((onset, i) => ({
    pitch: pitches[i] ?? 60,
    startTick: onset,
    durationTicks: Math.max(1, g.durations[i] ?? g.ticks_per_beat),
    velocity: g.velocities[i] ?? 96,
  }));
  const avg = notes.reduce((s, n) => s + n.pitch, 0) / notes.length;
  const role: AccompanimentRole = avg < 52 ? 'bass' : 'melodic-fill';

  const phrase = extractPhrase(notes, {
    id: `${name}-${detected.symbol}-v1`,
    role,
    meter: { numerator: 4, denominator: 4 },
    ticksPerBeat: g.ticks_per_beat || 480,
    lengthTicks: Math.max(1, g.num_bars * (g.ticks_per_bar || (g.ticks_per_beat || 480) * 4)),
    frame,
    source: { note: `learned from MIDIcurator clip "${clip.filename}" against ${detected.symbol}` },
  });
  saveUserStyle(name, phrase, kv);
  return phrase;
}

// ── Generate ────────────────────────────────────────────────────────────────

export interface GrooveClipRequest {
  /** Bar notation, e.g. "Dm7 | G7 | Cmaj7 | A7". */
  progression: string;
  /** A bundled style name or a learned one (allStyleNames lists both). */
  style: string;
  /** Optional UPI rhythm to perform the style's pitch material on. */
  rhythm?: string;
  seed: number;
  bpm: number;
  /** '' = engine default; staccato | tenuto | legato | mixed. */
  gate?: string;
  /** 0..1 each; 0/undefined leaves that stage off. */
  dynamics?: number;
  rests?: number;
  anticipation?: number;
  variety?: number;
  pocket?: number;
  /** morph + pass: render loop-pass N with that much per-pass re-roll —
   *  also the cheap "variant" axis: same seed, pass 0,1,2… are takes. */
  morph?: number;
  pass?: number;
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
export function generateGrooveClip(req: GrooveClipRequest, kv?: KV): GrooveClipData {
  const source = resolveStyle(req.style, kv);
  const { phrase } = groove(source, {
    progression: req.progression,
    seed: req.seed,
    bpm: req.bpm,
    ...(req.rhythm ? { rhythm: req.rhythm } : {}),
    ...(req.gate ? { gate: req.gate } : {}),
    ...(req.dynamics ? { dynamics: req.dynamics } : {}),
    ...(req.rests ? { rests: req.rests } : {}),
    ...(req.anticipation ? { anticipation: req.anticipation } : {}),
    ...(req.variety ? { variety: req.variety } : {}),
    ...(req.pocket ? { pocket: req.pocket } : {}),
    ...(req.morph ? { morph: req.morph } : {}),
    ...(req.pass ? { pass: req.pass } : {}),
  });

  const notes: Note[] = phrase.events
    .filter((e) => e.note !== undefined)
    .map((e) => ({
      midi: e.note!,
      ticks: e.onset,
      durationTicks: e.duration,
      velocity: e.velocity,
    }));

  const passTag = req.pass ? `-p${req.pass}` : '';
  return {
    notes,
    leadsheetText: req.progression,
    filename: `gloriarp-${req.style}-s${req.seed}${passTag}.mid`,
    ppq: phrase.ticksPerBeat,
    bpm: req.bpm,
  };
}
