/**
 * The full GloriArp pipeline as an ISOMORPHIC engine call — the reason
 * "plugins and standalones" is cheap: everything here runs identically in
 * Node (the CLI), a browser tab (the workspace module, any webapp), and a
 * plugin's WebView. No file I/O, no DOM — a source phrase goes in as data,
 * a performed phrase + trace + SMF bytes come out. `msuite accompany` is a
 * thin wrapper over this (path resolution + file writes and nothing else),
 * per the brief's rule: UI and CLI must call the same engine.
 *
 * Pipeline order (each stage documented in its own module):
 *   rhythm replacement (optional, UPI) → bass adapter (frames) →
 *   articulation (optional) → SMF with the GLORIARP:v1 TRACE header.
 */
import { parseLeadsheet, realizeLeadsheet } from "@enkerli/theory";
import { createSMF, type MidiNote, type MidiMarker, type MidiController } from "@enkerli/midi";
import { parseUPI } from "@enkerli/upi";
import type { AccompanimentPhrase, HarmonicFrame } from "./phrase.js";
import { adaptBassPhrase } from "./bass.js";
import { applyRhythm } from "./rhythm.js";
import { articulate, GATES, type ArticulationChange } from "./articulate.js";
import { expressPhrase, type ExpressChange } from "./express.js";
import { inflectPhrase, type NoteInflection } from "./inflect.js";
import type { Trace, TraceLevel } from "./trace.js";

export interface FramesOptions {
  tonic?: string;
  mode?: "major" | "minor";
  /** Ticks per beat of the target phrase (sets the frame time base). */
  ticksPerBeat: number;
  /** Fallback beats-per-bar when the progression has no time signature. */
  beatsPerBar: number;
  /** Tile the progression's bars out to this many bars. */
  bars?: number;
}

/** Bar notation → contiguous harmonic frames (multi-chord bars split evenly). */
export function framesFromProgression(progression: string, opts: FramesOptions): HarmonicFrame[] {
  const prog = parseLeadsheet(progression, {
    tonic: opts.tonic ?? "C",
    mode: opts.mode ?? "major",
  });
  const realized = realizeLeadsheet(prog);
  if (!realized.length || realized.every((bar) => !bar.length))
    throw new Error("accompany: no chords parsed from the progression");
  const beatsPerBar = prog.meta?.timeSig?.[0] ?? opts.beatsPerBar;
  const barTicks = beatsPerBar * opts.ticksPerBeat;
  const barCount = opts.bars ?? realized.length;
  const frames: HarmonicFrame[] = [];
  for (let bar = 0; bar < barCount; bar++) {
    const chords = realized[bar % realized.length]!;
    const span = barTicks / Math.max(1, chords.length);
    chords.forEach((c, i) => {
      frames.push({
        start: bar * barTicks + i * span,
        end: bar * barTicks + (i + 1) * span,
        chord: { symbol: c.symbol, rootPc: c.rootPc, pcs: c.pcs },
      });
    });
  }
  return frames;
}

export interface GrooveOptions {
  /** Bar notation, e.g. "Dm7 | G7 | Cmaj7 | A7". */
  progression: string;
  tonic?: string;
  mode?: "major" | "minor";
  /** UPI rhythm to perform the source's pitch material on (e.g. "E(3,8)"). */
  rhythm?: string;
  bars?: number;
  seed?: number;
  range?: { low: number; high: number };
  chromaticism?: number;
  rhythmPreservation?: number;
  /** staccato · tenuto · legato · mixed, or a numeric factor as a string/number.
   *  "mixed" = per-note contextual articulation (legato into stepwise motion,
   *  detached repeats, ghosty cracks) — the expression stage, not a factor. */
  gate?: string | number;
  dynamics?: number;
  rests?: number;
  anticipation?: number;
  /** 0..1 — note-choice variety: octave displacement, chord-tone
   *  reselection, passing tones on weak beats (docs/GLORIARP_NEXT.md §1). */
  variety?: number;
  /** 0..1 — Keil pocket: correlated push/pull timing + micro-dynamics
   *  (docs/GLORIARP_NEXT.md §2). */
  pocket?: number;
  /** Loop pass index (0-based) — players hand each repeat its pass. */
  pass?: number;
  /** 0..1 — blanket fraction of variety/pocket/rests decisions re-rolled
   *  per pass, so the take morphs over loop repeats. 0 = every pass
   *  identical. Alias: sets morphNotes/morphPocket/morphRests when the
   *  per-dimension ones aren't given (docs/KNOWLEDGE_TRANSFER.md item 5 —
   *  Troublemaker/Rozeta-style continuous mutation, one dimension at a
   *  time instead of a wholesale re-roll). */
  morph?: number;
  /** 0..1 — note-choice (variety) re-roll rate per pass, independent of
   *  morphPocket/morphRests. */
  morphNotes?: number;
  /** 0..1 — pocket (timing/dynamics walk) re-roll rate per pass,
   *  independent of morphNotes/morphRests. */
  morphPocket?: number;
  /** 0..1 — rests (skip-step) re-roll rate per pass: WHICH steps drop
   *  wanders across loop repeats instead of staying fixed, independent of
   *  morphNotes/morphPocket. */
  morphRests?: number;
  /** 0..1 — per-note wind articulation (inflect stage): every note gets its
   *  own articulation and breath envelope — sforzando, staccato, legato
   *  slurs, marcato… 0/undefined = off. */
  inflect?: number;
  bpm?: number;
  traceLevel?: TraceLevel;
}

export interface GrooveResult {
  phrase: AccompanimentPhrase;
  trace: Trace;
  frames: HarmonicFrame[];
  smf: Uint8Array;
  articulation: ArticulationChange[];
  expression: ExpressChange[];
  /** Per-note articulations + breath envelopes (empty unless opts.inflect). */
  inflections: NoteInflection[];
}

/**
 * Run the whole pipeline over a source phrase. Deterministic: identical
 * (source, options) → byte-identical result on every platform.
 */
export function groove(sourceIn: AccompanimentPhrase, opts: GrooveOptions): GrooveResult {
  let source = sourceIn;
  if (opts.rhythm !== undefined) {
    const r = parseUPI(opts.rhythm, { n: 16 });
    if (!r.ok || !r.steps.length) throw new Error(`accompany: --rhythm "${opts.rhythm}" did not parse as UPI${r.error ? ` — ${r.error}` : ""}`);
    source = applyRhythm(source, {
      steps: r.steps,
      ...(r.accents.some((x: number) => x) && { accents: r.accents }),
      label: r.label ?? opts.rhythm,
    });
  }

  const frames = framesFromProgression(opts.progression, {
    ...(opts.tonic !== undefined && { tonic: opts.tonic }),
    ...(opts.mode !== undefined && { mode: opts.mode }),
    ticksPerBeat: source.ticksPerBeat,
    beatsPerBar: source.meter.numerator,
    ...(opts.bars !== undefined && { bars: opts.bars }),
  });

  const adapted = adaptBassPhrase(source, {
    frames,
    seed: opts.seed ?? 42,
    range: opts.range ?? { low: 36, high: 60 },
    ...(opts.chromaticism !== undefined && { chromaticism: opts.chromaticism }),
    ...(opts.rhythmPreservation !== undefined && { rhythmPreservation: opts.rhythmPreservation }),
    traceLevel: opts.traceLevel ?? "events",
  });
  const trace = adapted.trace;

  // Articulation runs AFTER the adapter (pitches resolved against frames), so
  // an anticipated downbeat truly sounds the coming chord early.
  let phrase = adapted.phrase;
  let articulation: ArticulationChange[] = [];
  const mixedGate = opts.gate === "mixed"; // per-note articulation — the expression stage's job
  if ((opts.gate !== undefined && !mixedGate) || opts.dynamics || opts.rests || opts.anticipation) {
    let gate: number | keyof typeof GATES | undefined;
    if (opts.gate !== undefined && !mixedGate) {
      gate = typeof opts.gate === "string" && opts.gate in GATES
        ? (opts.gate as keyof typeof GATES)
        : Number(opts.gate);
      if (typeof gate === "number" && (!Number.isFinite(gate) || gate <= 0))
        throw new Error(`accompany: --gate wants staccato|tenuto|legato|mixed or a factor > 0, not "${opts.gate}"`);
    }
    const a = articulate(phrase, {
      seed: opts.seed ?? 42,
      ...(gate !== undefined && { gate }),
      ...(opts.dynamics !== undefined && { dynamics: opts.dynamics }),
      ...(opts.rests !== undefined && { rests: opts.rests }),
      ...(opts.anticipation !== undefined && { anticipation: opts.anticipation }),
      ...(opts.pass !== undefined && { pass: opts.pass }),
      ...((opts.morphRests ?? opts.morph) !== undefined && { morphRests: opts.morphRests ?? opts.morph }),
    });
    phrase = a.phrase;
    articulation = a.changes;
  }

  // Expression & variation (docs/GLORIARP_NEXT.md): variety, pocket, mixed
  // gate, pass/morph — after articulation so it shapes what will actually
  // sound. All defaults off → this stage doesn't run and earlier vectors
  // stay byte-identical.
  let expression: ExpressChange[] = [];
  if (opts.variety || opts.pocket || mixedGate) {
    const x = expressPhrase(phrase, {
      seed: opts.seed ?? 42,
      bpm: opts.bpm ?? 120,
      ...(opts.pass !== undefined && { pass: opts.pass }),
      ...(opts.morph !== undefined && { morph: opts.morph }),
      ...(opts.morphNotes !== undefined && { morphNotes: opts.morphNotes }),
      ...(opts.morphPocket !== undefined && { morphPocket: opts.morphPocket }),
      ...(opts.variety !== undefined && { variety: opts.variety }),
      ...(opts.pocket !== undefined && { pocket: opts.pocket }),
      ...(mixedGate && { mixedGate: true }),
    });
    phrase = x.phrase;
    expression = x.changes;
  }

  // Per-note articulation LAST: it shapes the notes that will actually sound
  // (post-variety pitches, post-pocket onsets), giving each its own envelope.
  let inflections: NoteInflection[] = [];
  if (opts.inflect) {
    const inf = inflectPhrase(phrase, { seed: opts.seed ?? 42, intensity: opts.inflect });
    phrase = inf.phrase;
    inflections = inf.notes;
  }

  const notes: MidiNote[] = phrase.events.map((e) => ({
    pitch: e.note ?? 0,
    startTick: e.onset,
    durationTicks: e.duration,
    velocity: e.velocity,
  }));
  const markers: MidiMarker[] = frames.map((f) => ({ tick: f.start, text: f.chord.symbol }));
  // Each note's breath envelope becomes a CC2 curve in the file — a DAW (or
  // Vane behind one) replays the exact wind articulation the engine chose.
  const controllers: MidiController[] = [];
  for (const inf of inflections) {
    const e = phrase.events[inf.index]!;
    for (const p of inf.envelope)
      controllers.push({ tick: e.onset + Math.round(p.at * e.duration), controller: 2, value: Math.round(p.value * 127) });
  }
  const embedded = { header: trace.header, ...(trace.summary && { summary: trace.summary }) };
  const smf = createSMF(notes, {
    bpm: opts.bpm ?? 120,
    ticksPerBeat: source.ticksPerBeat,
    trackName: "GloriArp bass",
    markers,
    ...(controllers.length && { controllers }),
    textEvents: [{ tick: 0, text: `GLORIARP:v1 TRACE ${JSON.stringify(embedded)}` }],
  });

  return { phrase, trace, frames, smf, articulation, expression, inflections };
}
