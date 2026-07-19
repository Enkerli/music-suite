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
 * material — TWO kinds now (docs/GLORIARP_NEXT.md slice C, then the
 * statistics arc): a curated PHRASE (one clip, extractPhrase — the original
 * "learning" v1) or a STYLE MODEL (many clips against one chord,
 * learnStyleModel — per-slot statistics, sampled fresh per pass). Both are
 * persisted locally and offered in the same style list; both are exactly
 * the JSON contracts the CLI (`msuite style learn` / `accompany --source`)
 * and the workspace module read and write, so export/import round-trips
 * across every surface (§ import, below).
 *
 * POLYPHONY (EP comping etc.): extractPhrase itself detects simultaneous
 * notes and tags them with a voice id; here that just changes the role
 * label the user sees ("comping" instead of the register heuristic) — the
 * engine (extract/adapt/model) does the actual chord-aware work.
 *
 * Vane's per-note wind envelopes (inflect stage) don't ride through the
 * Note[] clip format yet — MIDIcurator's Note has no CC/envelope field —
 * but `inflect`'s duration/gate shaping (sforzando bite, staccato punch,
 * legato joins) DOES apply, since it's audible via plain note durations.
 */

import {
  groove, extractPhrase, validatePhrase, learnStyleModel, samplePhrase,
  looksLikeModel, parseModel, serializeModel, validateModel, serializePhrase,
} from '@enkerli/accompaniment';
import type {
  AccompanimentPhrase, AccompanimentRole, FrameChord, InputNote, StyleModel,
} from '@enkerli/accompaniment';
import { findQualityByKey } from '@enkerli/theory';
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

// ── Learned styles: the user's captured phrases + models, persisted locally ──

const USER_STYLES_KEY = 'midicurator.gloriarp-styles';
const USER_MODELS_KEY = 'midicurator.gloriarp-models';

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

export function listUserModels(kv?: KV): { name: string; model: StyleModel }[] {
  const s = store(kv);
  if (!s) return [];
  try {
    const raw = JSON.parse(s.getItem(USER_MODELS_KEY) ?? '[]') as { name: string; model: unknown }[];
    return raw.filter((e) => e && typeof e.name === 'string' && validateModel(e.model).ok)
      .map((e) => ({ name: e.name, model: e.model as StyleModel }));
  } catch { return []; }
}

export function saveUserModel(name: string, model: StyleModel, kv?: KV): void {
  const s = store(kv);
  if (!s) throw new Error('no local storage available to keep style models');
  const list = listUserModels(kv).filter((e) => e.name !== name); // replace same-name
  list.push({ name, model });
  s.setItem(USER_MODELS_KEY, JSON.stringify(list));
}

/** Every style name offered in the UI: bundled first, then learned phrases,
 *  then learned/imported models. */
export function allStyleNames(kv?: KV): string[] {
  return [...GROOVE_STYLE_NAMES, ...listUserStyles(kv).map((e) => e.name), ...listUserModels(kv).map((e) => e.name)];
}

/** A resolved style source: either kind drops straight into groove(), a
 *  model sampled fresh per pass (parity with the CLI's --source dispatch). */
type ResolvedStyle = { kind: 'phrase'; phrase: AccompanimentPhrase } | { kind: 'model'; model: StyleModel };

function resolveStyle(name: string, kv?: KV): ResolvedStyle {
  if (name in GROOVE_STYLES) return { kind: 'phrase', phrase: GROOVE_STYLES[name as GrooveStyleName] };
  const user = listUserStyles(kv).find((e) => e.name === name);
  if (user) return { kind: 'phrase', phrase: user.phrase };
  const model = listUserModels(kv).find((e) => e.name === name);
  if (model) return { kind: 'model', model: model.model };
  throw new Error(`unknown style "${name}" — bundled: ${GROOVE_STYLE_NAMES.join(', ')}`);
}

/**
 * Import an externally-produced phrase.json or style-model.json (msuite
 * style learn / accompany --phrase-out, a workspace export, another
 * MIDIcurator's export…) into the local style list under `name`. Returns
 * which kind it turned out to be, so the caller can report it honestly.
 */
export function importStyleFromJson(text: string, name: string, kv?: KV): 'phrase' | 'model' {
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new Error('not JSON'); }
  if (looksLikeModel(parsed)) {
    saveUserModel(name, parseModel(text), kv);
    return 'model';
  }
  if (!validatePhrase(parsed).ok) throw new Error('neither a valid phrase.json nor a style-model.json');
  saveUserStyle(name, parsed as AccompanimentPhrase, kv);
  return 'phrase';
}

/** The reverse of import: hand a learned/imported style back out as JSON
 *  text — the same contract the CLI and workspace read, so it round-trips. */
export function exportStyleJson(name: string, kv?: KV): { kind: 'phrase' | 'model'; json: string } {
  const resolved = resolveStyle(name, kv);
  return resolved.kind === 'model'
    ? { kind: 'model', json: serializeModel(resolved.model) }
    : { kind: 'phrase', json: serializePhrase(resolved.phrase) };
}

// ── Learn: a curated clip becomes a source phrase (extraction, slice-1 code) ─

/** The frame chord a clip was played against: leadsheet first, detection as
 *  fallback. A DETECTED chord carries its pcs; a LEADSHEET-parsed chord
 *  carries only root + qualityKey (the "chord C7 carries no pitch classes"
 *  bug, 2026-07-20) — derive them from the dictionary quality, absolute
 *  against the root, falling back to the clip's own notes as a last resort. */
function resolveClipFrame(clip: Clip): FrameChord {
  const pitches = clip.harmonic.pitches;
  const barChords = getEffectiveBarChords(clip);
  const lead = clip.leadsheet?.bars?.[0]?.chords?.[0]?.chord ?? null;
  const detected = lead ?? barChords?.find((b) => b.chord)?.chord ?? clip.harmonic.detectedChord ?? null;
  if (!detected) throw new Error('clip needs a chord (add a leadsheet, or let detection find one) so the phrase knows its harmony');
  let pcs = detected.templatePcs ?? detected.observedPcs ?? [];
  if (!pcs.length && detected.qualityKey) {
    const q = findQualityByKey(detected.qualityKey);
    if (q) pcs = q.pcs.map((p) => (((detected.root + p) % 12) + 12) % 12);
  }
  if (!pcs.length) pcs = [...new Set(pitches.map((p) => ((p % 12) + 12) % 12))]; // last resort: the notes themselves
  if (!pcs.length) throw new Error(`chord ${detected.symbol} carries no pitch classes to relate against`);
  return { symbol: detected.symbol, rootPc: detected.root, pcs };
}

/** A clip's raw notes as extractPhrase input (onsets/pitches/durations/velocities). */
function clipToInputNotes(clip: Clip): InputNote[] {
  const g = clip.gesture;
  const pitches = clip.harmonic.pitches;
  if (!g.onsets.length || !pitches.length) throw new Error('clip has no notes to learn from');
  return g.onsets.map((onset, i) => ({
    pitch: pitches[i] ?? 60,
    startTick: onset,
    durationTicks: Math.max(1, g.durations[i] ?? g.ticks_per_beat),
    velocity: g.velocities[i] ?? 96,
  }));
}

/**
 * Extract a clip against its own frame. Role: POLYPHONY wins outright (any
 * simultaneous notes — an EP comping voicing — extractPhrase tags them with
 * a voice id, and that's decisive); otherwise the register heuristic (avg
 * pitch below E3 → bass, else melodic-fill).
 */
function clipToPhrase(clip: Clip, id: string): AccompanimentPhrase {
  const frame = resolveClipFrame(clip);
  const notes = clipToInputNotes(clip);
  const g = clip.gesture;
  const avg = notes.reduce((s, n) => s + n.pitch, 0) / notes.length;
  const role: AccompanimentRole = avg < 52 ? 'bass' : 'melodic-fill';
  const phrase = extractPhrase(notes, {
    id,
    role,
    meter: { numerator: 4, denominator: 4 },
    ticksPerBeat: g.ticks_per_beat || 480,
    lengthTicks: Math.max(1, g.num_bars * (g.ticks_per_bar || (g.ticks_per_beat || 480) * 4)),
    frame,
    source: { note: `learned from MIDIcurator clip "${clip.filename}" against ${frame.symbol}` },
  });
  if (phrase.events.some((e) => e.voice !== undefined)) phrase.role = 'comping';
  return phrase;
}

/**
 * Capture a clip as a GloriArp style — curated capture, docs/GLORIARP_NEXT.md
 * slice C. Inference is honest by design: chord tones and approaches get
 * confidence, the rest stays unclassified.
 */
export function learnStyleFromClip(clip: Clip, name: string, kv?: KV): AccompanimentPhrase {
  const frame = resolveClipFrame(clip); // validated eagerly so the id below can name it
  const phrase = clipToPhrase(clip, `${name}-${frame.symbol}-v1`);
  saveUserStyle(name, phrase, kv);
  return phrase;
}

/**
 * Learn a STYLE MODEL (per-slot statistics, docs/GLORIARP_NEXT.md's
 * statistics arc) from SEVERAL clips — the "Funkastic" workflow: many takes
 * played against one chord become one model, sampled fresh per pass. Every
 * clip resolves its OWN chord (leadsheet or detection) and they must all
 * agree — a mismatched clip is refused by name rather than silently
 * polluting the model with the wrong harmony.
 */
export function learnStyleModelFromClips(clips: Clip[], name: string, kv?: KV): StyleModel {
  if (!clips.length) throw new Error('learnStyleModelFromClips: at least one clip is required');
  const phrases = clips.map((c, i) => clipToPhrase(c, `${name}-${i}`));
  const sortedPcs = (pcs: number[]) => [...pcs].sort((a, b) => a - b).join(',');
  const first = phrases[0]!.harmonicFrames![0]!.chord;
  phrases.forEach((p, i) => {
    const f = p.harmonicFrames![0]!.chord;
    if (f.rootPc !== first.rootPc || sortedPcs(f.pcs) !== sortedPcs(first.pcs))
      throw new Error(`learnStyleModelFromClips: "${clips[i]!.filename}" is in ${f.symbol}, not ${first.symbol} — every clip must share one chord`);
  });
  const model = learnStyleModel(phrases, { id: name });
  saveUserModel(name, model, kv);
  return model;
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
  /** 0..1 — per-note wind articulation (sforzando/staccato/legato/marcato…).
   *  Duration/gate shaping is audible via plain note durations; the breath
   *  envelope itself doesn't ride the Note[] clip format yet. */
  inflect?: number;
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
  const resolved = resolveStyle(req.style, kv);
  // A MODEL samples a fresh take per (seed, pass) — the learned variability
  // of performance; a PHRASE is used exactly as before (parity with the
  // CLI's `accompany --source` and the workspace module's dispatch).
  const source = resolved.kind === 'model'
    ? samplePhrase(resolved.model, { seed: req.seed, ...(req.pass ? { pass: req.pass } : {}) })
    : resolved.phrase;
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
    ...(req.inflect ? { inflect: req.inflect } : {}),
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
