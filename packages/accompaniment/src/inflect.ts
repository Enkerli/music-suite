/**
 * Per-note articulation — the WIND PLAYER's grammar (docs/GLORIARP_NEXT.md).
 * Where `articulate` shapes the phrase (rests, anticipation, one global gate)
 * and `express` shapes the take (variety, pocket), THIS stage gives every
 * note its own articulation and its own breath envelope: a sforzando bites
 * and swells back, a staccato is a short tongued puff, a legato slur joins
 * stepwise neighbours without re-tonguing, a marcato lands full and releases
 * clean. Vane is a wind model — breath (CC2) IS its amplitude envelope — so
 * these curves are not decoration: they are the note's actual dynamic life.
 *
 * Pure and seeded like every other stage: fixed RNG draw budget per event
 * (option changes never de-align the stream), identical (phrase, options)
 * → identical inflections on every platform. The output is explicit data
 * (GLORIARP_BRIEF §14): consumers render the envelopes as CC2 breakpoints
 * (SMF, rawmidi) or as scheduled breath posts into the worklet; `attack` is
 * a per-note tonguing hint (Vane's transient-gain, native 0..2 — 0 on the
 * inside of a slur: no re-tonguing is what MAKES it a slur).
 *
 * ACCENTS + SLIDES (docs/KNOWLEDGE_TRANSFER.md item 5, the two dimensions
 * left over from the morph split — GLORIARP_NEXT.md §3e):
 *  - accents: which notes land sforzando/marcato vs. plain tenuto, and
 *    which legato transitions get promoted to slides, are seeded choices
 *    like everything else — `morphAccents` (+ `pass`) makes THOSE choices
 *    wander across loop passes, sharing express.ts's three-stream
 *    discipline via its exported `passSeed`. 0/no pass = today's fixed
 *    per-seed choices, unchanged.
 *  - slides: Vane glides automatically whenever a note-change arrives
 *    while the previous note's breath is still flowing (its own legato
 *    detection) — legato-inside/-end transitions ALREADY connect that way.
 *    What was missing is TIME: `glide-time` (wasmId 10) never gets set, so
 *    every legato transition glides in 0ms — an instant pitch jump, not an
 *    audible slide. `slide` (0..1) promotes a probability of eligible
 *    legato transitions to carry a real `glideMs` (default `glideMs`
 *    option, 120ms); everything else stays a plain (instant) legato join.
 */

import { mulberry32 } from "@enkerli/proggen";
import type { AccompanimentPhrase } from "./phrase.js";
import { metricWeight } from "./articulate.js";
import { passSeed } from "./express.js";

export const ARTICULATION_NAMES = [
  "sforzando", "marcato", "staccato", "tenuto",
  "legato-start", "legato-inside", "legato-end", "ghost",
] as const;
export type ArticulationName = (typeof ARTICULATION_NAMES)[number];

/** One breakpoint of a note's breath curve: `at` is a 0..1 fraction of the
 *  sounded duration, `value` is absolute breath 0..1 (velocity already in). */
export interface EnvPoint { at: number; value: number }

export interface NoteInflection {
  /** Index into the phrase's events (alignment key for every consumer). */
  index: number;
  onset: number;
  articulation: ArticulationName;
  /** Duration multiplier that was applied to the event (legato may exceed 1). */
  gate: number;
  /** Tonguing transient, native Vane transient-gain units 0..2. 0 = slurred. */
  attack: number;
  envelope: EnvPoint[];
  /** Portamento time in ms for THIS note's arrival (Vane glide-time, wasmId
   *  10) — present only on a legato transition promoted by `slide`. 0/absent
   *  = instant (today's behavior; still legato-connected if articulation
   *  says so, just no audible glide). */
  glideMs?: number;
}

export interface InflectOptions {
  seed: number;
  /** 0..1 — how far articulations depart from a neutral sustained note.
   *  0 = stage is inert (flat envelopes, unit gates). Default 1. */
  intensity?: number;
  /** Loop pass index, 0-based — needed only alongside morphAccents. */
  pass?: number;
  /** 0..1 — fraction of ACCENT decisions (sforzando-vs-marcato,
   *  staccato-vs-tenuto, and slide promotion) re-rolled per pass, so which
   *  notes carry the emphasis wanders across loop repeats instead of
   *  staying fixed. 0/undefined = every pass chooses the same way. */
  morphAccents?: number;
  /** 0..1 — probability an eligible legato transition (legato-inside/-end)
   *  is promoted to an audible SLIDE (a real glideMs instead of 0/instant).
   *  0/undefined = off — legato stays legato, never glides. */
  slide?: number;
  /** Portamento time (ms) applied to a promoted slide. Default 120. */
  glideMs?: number;
}

export interface InflectResult {
  phrase: AccompanimentPhrase;
  notes: NoteInflection[];
}

/** Shape tables: envelope as velocity-relative multipliers, gate, attack.
 *  A sforzando's 1.25 bite saturates at breath 1.0 for loud notes — that IS
 *  the effect (a full-breath sfz has nowhere to bite BUT down). */
const SHAPES: Record<ArticulationName, { env: [number, number][]; gate: number; attack: number }> = {
  sforzando: { env: [[0, 1.25], [0.15, 0.5], [0.65, 1.0], [1, 0.7]], gate: 0.85, attack: 1.6 },
  marcato: { env: [[0, 1.25], [0.12, 1.0], [0.8, 0.95], [1, 0.35]], gate: 0.7, attack: 1.3 },
  staccato: { env: [[0, 1.1], [1, 0.45]], gate: 0.45, attack: 0.9 },
  tenuto: { env: [[0, 0.95], [0.5, 1.0], [1, 0.8]], gate: 0.85, attack: 0.5 },
  "legato-start": { env: [[0, 1.0], [1, 0.95]], gate: 1.0, attack: 0.7 },
  "legato-inside": { env: [[0, 0.85], [0.5, 0.95], [1, 0.9]], gate: 1.0, attack: 0 },
  "legato-end": { env: [[0, 0.9], [1, 0.55]], gate: 0.92, attack: 0 },
  ghost: { env: [[0, 0.5], [1, 0.25]], gate: 0.55, attack: 0.2 },
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Slur membership: consecutive notes join a slur when they are CONNECTED
 *  (gap under an eighth of a beat) and CONJUNCT (within 4 semitones) — the
 *  finger-slide/lip-slur territory; a leap gets its own tongue stroke.
 *
 *  POLYPHONY guard: a slur is a MELODIC relationship — two notes in the same
 *  voice line, one genuinely following the other. Without this, two
 *  simultaneous chord tones (comping) can look "joined" (their gap, being
 *  negative — they overlap — trivially clears the threshold) and get
 *  fused into a false slur across what's actually one struck chord. Require
 *  real forward motion (b starts after a starts) and — when either carries
 *  a voice id — that they're the SAME voice; different voices never slur
 *  into each other even if adjacent in the sorted event list. */
function slurGroups(phrase: AccompanimentPhrase): number[][] {
  const evs = phrase.events;
  const groups: number[][] = [];
  let run: number[] = [];
  const joined = (i: number) => {
    const a = evs[i]!, b = evs[i + 1]!;
    if (a.note === undefined || b.note === undefined) return false;
    if (b.onset <= a.onset) return false;
    if ((a.voice ?? 0) !== (b.voice ?? 0)) return false;
    const gap = b.onset - (a.onset + a.duration);
    return gap <= phrase.ticksPerBeat / 8 && Math.abs(b.note - a.note) <= 4 && b.note !== a.note;
  };
  for (let i = 0; i < evs.length; i++) {
    run.push(i);
    if (i + 1 >= evs.length || !joined(i)) {
      if (run.length >= 2) groups.push(run);
      run = [];
    }
  }
  return groups;
}

export function inflectPhrase(phrase: AccompanimentPhrase, opts: InflectOptions): InflectResult {
  const rng = mulberry32(opts.seed);
  const intensity = opts.intensity ?? 1;
  const tpb = phrase.ticksPerBeat;
  const bpb = phrase.meter.numerator;

  // Accents: the articulation-choice draw becomes pass-aware exactly like
  // articulate.ts's rests did — `rng` IS the stable stream, unmodified, so
  // morphAccents=0 (or no pass) reproduces today's fixed per-seed choices
  // byte-for-byte. perPass/gate are separate generators that only ever get
  // CONSULTED when morphAccents is nonzero; they never advance `rng` itself.
  const morphAccents = opts.morphAccents ?? 0;
  const pass = opts.pass ?? 0;
  const accentPerPassRng = mulberry32(passSeed(opts.seed, pass) ^ 0x1acce_112);
  const accentGateRng = mulberry32((opts.seed ^ 0x1ac0_5eed) >>> 0);
  const accentDraw = (): number => {
    const s = rng();
    const p = accentPerPassRng();
    const g = accentGateRng();
    return g < morphAccents ? p : s;
  };

  // Slides: a fully independent draw (own generators, seeded off `opts.seed`
  // but never sharing rng's own sequence) so slide=0 leaves EVERYTHING else
  // byte-identical, including when morphAccents/pass are also in play.
  const slide = opts.slide ?? 0;
  const glideMsOpt = opts.glideMs ?? 120;
  const slideStableRng = mulberry32(opts.seed ^ 0x5117e_beef);
  const slidePerPassRng = mulberry32(passSeed(opts.seed, pass) ^ 0x5117e_1234);
  const slideGateRng = mulberry32((opts.seed ^ 0x5117e_9a3c) >>> 0);
  const slideDraw = (): number => {
    const s = slideStableRng();
    const p = slidePerPassRng();
    const g = slideGateRng();
    return g < morphAccents ? p : s;
  };

  // Slur positions first (no RNG — pure structure).
  const slurPos = new Map<number, ArticulationName>();
  for (const g of slurGroups(phrase)) {
    g.forEach((idx, j) => slurPos.set(idx,
      j === 0 ? "legato-start" : j === g.length - 1 ? "legato-end" : "legato-inside"));
  }

  const events = phrase.events.map((e) => ({ ...e }));
  const notes: NoteInflection[] = [];
  for (let i = 0; i < events.length; i++) {
    const e = events[i]!;
    const draw = accentDraw(); // one draw per event, always — the stream stays aligned
    const slideRoll = slideDraw(); // ditto, its own independent stream
    const w = metricWeight(e.onset, tpb, bpb);
    const isLast = i === events.length - 1;

    let name: ArticulationName;
    const slurred = slurPos.get(i);
    if (slurred) name = slurred;
    else if (e.velocity <= 52) name = "ghost";
    else if (isLast && e.velocity >= 90) name = "marcato"; // …ending on marcato, wherever it lands
    else if (w >= 0.75 && e.velocity >= 100) name = draw < 0.5 ? "sforzando" : "marcato";
    else if (e.duration <= tpb * 0.3 || (w <= 0.3 && e.velocity < 90)) name = "staccato";
    else name = draw < 0.25 ? "staccato" : "tenuto";

    const shape = SHAPES[name];
    // Gate: legato joins THIS note to the next onset (a hair past it — the
    // slur's overlap); everything else scales its own duration.
    let gate = 1 + (shape.gate - 1) * intensity;
    if ((name === "legato-start" || name === "legato-inside") && i + 1 < events.length) {
      const target = events[i + 1]!.onset - e.onset + Math.round(tpb / 96);
      gate = target / e.duration;
    }
    e.duration = Math.max(1, Math.round(e.duration * gate));

    const breath = e.velocity / 127;
    const envelope: EnvPoint[] = shape.env.map(([at, mult]) => ({
      at,
      value: clamp01(breath + (breath * mult - breath) * intensity),
    }));
    // Slide promotion: only a note ARRIVING via a slur (legato-inside/-end —
    // legato-start has no prior connected note to glide FROM) is eligible.
    const eligible = name === "legato-inside" || name === "legato-end";
    const glideMs = eligible && slideRoll < slide ? glideMsOpt : undefined;
    notes.push({
      index: i, onset: e.onset, articulation: name, gate, attack: shape.attack * intensity, envelope,
      ...(glideMs !== undefined && { glideMs }),
    });
  }

  return {
    phrase: {
      ...phrase,
      events,
      annotations: {
        ...phrase.annotations,
        inflect: JSON.stringify({
          seed: opts.seed, intensity,
          ...(morphAccents && { morphAccents, pass }),
          ...(slide && { slide, glideMs: glideMsOpt }),
        }),
      },
    },
    notes,
  };
}
