import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import table from "./data/transitions.json";
import { BEATS_PER_BAR, chordCompletions, chordSlots, generateLabels, generateSections, labelMass, nextChordSuggestions, realizeLabel, rhythmBeats, rhythmPlan, startLabel, voiceChord, voiceProgression, voicingSuggestions } from "./generate.js";
import { chordStartBeats, exportProgression, voicingsToClip } from "./exportMidi.js";
import { createBridge } from "./juceBridge.js";
import { assertDegree, parseLeadsheet, realizeChord } from "@enkerli/theory";
import { resolvedTheme, toggleTheme } from "@enkerli/ui/theme";
import { createPianoRoll } from "@enkerli/ui/piano-roll";
import { createLeadsheetEditor } from "@enkerli/ui/leadsheet-editor";
import { createChordInput } from "./chordInput.js";

/**
 * Realize a Progression to the chord shape the rest of ProgGenie expects
 * (voiceProgression / the sheet / export): adds a `label` (the token as
 * authored — degree numeral or, for hand-edited chords, the symbol).
 */
function chordsFromProgression(prog, key) {
  const out = [];
  for (const bar of prog.sections[0]?.bars ?? []) {
    if (bar.repeat) {
      if (out.length) out.push(out[out.length - 1]);
      continue;
    }
    for (const c of bar.chords) {
      const r = realizeChord(c, key);
      const label = c.source === "degree" && c.degree
        ? c.degree.numeral + c.degree.suffix
        : (c.inputText ?? r.symbol);
      out.push({ ...r, label, voicing: c.voicing, dur: c.dur ?? 2 });
    }
  }
  return out;
}

const clone = (o) => JSON.parse(JSON.stringify(o));

const SHARP = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const midiName = (m) => SHARP[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);

/** The transition-table label (numeral + suffix) for a progression chord, in
 *  a key — degree chords read it off directly; absolute chords derive the
 *  numeral via assertDegree. Returns null if the root won't resolve. */
function labelOfChord(c, key) {
  if (!c) return null;
  if (c.source === "degree" && c.degree) return c.degree.numeral + c.degree.suffix;
  const sym = c.symbol;
  if (!sym?.root) return null;
  try {
    return assertDegree(sym.root, key).numeral + (sym.suffix ?? "");
  } catch {
    return null;
  }
}

/** Map a clip-relative beat to the index of the chord sounding then, given
 *  cumulative chord start beats (chord-follow with variable durations). */
function beatToChordIndex({ starts, total }, beat) {
  if (!starts.length) return -1;
  const b = total > 0 ? ((beat % total) + total) % total : beat;
  let idx = -1;
  for (let i = 0; i < starts.length; i++) { if (starts[i] <= b + 1e-6) idx = i; else break; }
  return idx;
}

/** The corpus transition label (numeral + suffix) of a realized chord — used
 *  to map per-chord ratings onto the corpus's functional transition keys, so
 *  degree and absolute chords rate the same pair. */
function functionalOfRealized(r, key) {
  if (!r?.rootName) return null;
  try {
    return assertDegree(r.rootName, key).numeral + (r.suffix ?? "");
  } catch {
    return null;
  }
}

/** Build a Progression from generated labels and a bar plan (from rhythmPlan).
 *  Chord-bars consume labels and stamp each chord's `dur`; held bars become
 *  repeat bars (`%`), so a multi-bar chord keeps its barlines. */
function buildProgression(labels, plan, key) {
  const bars = [];
  let li = 0;
  for (const p of plan) {
    if (p.repeat) { bars.push({ chords: [], repeat: true }); continue; }
    const chords = [];
    for (const d of p.durs) {
      const label = labels[li++];
      if (label == null) break;
      const ch = parseLeadsheet(label, key).sections[0]?.bars[0]?.chords[0];
      if (ch) { ch.dur = d; chords.push(ch); }
    }
    bars.push({ chords });
  }
  if (!bars.length) bars.push({ chords: [] });
  return { key, sections: [{ bars }] };
}

/** Editable leadsheet — the shared @enkerli/ui editor, the primary surface.
 *  Mounts once; the caller forces a remount (via React key) on external
 *  ops (generate/extend/clear/key change) so internal edits don't reset it.
 *  activeIndex drives the chord-follow highlight without remounting. */
function LeadsheetEdit({ progression, activeIndex, onEdit, suggest, onRate, ratingOf, ratingSignal, tool }) {
  const hostRef = useRef(null);
  const edRef = useRef(null);
  // The editor is built once (remounted via key); read callbacks through refs
  // so the "+" picker and the 👍/👎 controls always see current state (latched
  // chord, voicings, curation).
  const suggestRef = useRef(suggest); suggestRef.current = suggest;
  const onRateRef = useRef(onRate); onRateRef.current = onRate;
  const ratingOfRef = useRef(ratingOf); ratingOfRef.current = ratingOf;
  useEffect(() => {
    edRef.current = createLeadsheetEditor(hostRef.current, {
      progression: clone(progression),
      showKey: false, // the main UI owns the key
      activeIndex,
      onChange: (prog) => onEdit(clone(prog)),
      suggest: (ctx) => suggestRef.current?.(ctx) ?? [],
      onRate: (i, dir) => onRateRef.current?.(i, dir),
      ratingOf: (i) => ratingOfRef.current?.(i) ?? 1,
      tool,
    });
    return () => edRef.current.destroy();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- remount via key
  useEffect(() => { edRef.current?.update({ activeIndex }); }, [activeIndex]);
  useEffect(() => { edRef.current?.update({ tool }); }, [tool]);
  // Ratings changed (curation) — re-render chips to re-reflect the 👍/👎 state.
  useEffect(() => { edRef.current?.refresh(); }, [ratingSignal]);
  return <div ref={hostRef} />;
}

// Module singleton: detected once, same UI runs in browser and plugin.
const bridge = createBridge();
const IN_PLUGIN = bridge.kind === "juce";
import {
  adjustTransition,
  exportCuration,
  importCuration,
  loadCuration,
  mergeCuration,
  multiplierFor,
  pairKey,
  PROGRESSION_STEP,
  rateProgression,
  resetTransition,
  saveCuration,
  TRANSITION_STEP,
} from "./curation.js";

const ROOTS = [
  "C", "C♯", "D♭", "D", "D♯", "E♭", "E", "F",
  "F♯", "G♭", "G", "G♯", "A♭", "A", "A♯", "B♭", "B",
];


function usePlayer() {
  const ctxRef = useRef(null);
  const stopRef = useRef(() => {});
  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(-1);

  function stop() {
    stopRef.current();
    setPlaying(false);
    setPlayhead(-1);
  }

  function play(voicings, bpm) {
    stopRef.current();
    const ctx = (ctxRef.current ??= new (window.AudioContext || window.webkitAudioContext)());
    const beat = 60 / bpm;
    const t0 = ctx.currentTime + 0.05;
    const nodes = [];
    const timers = [];

    let accBeats = 0;
    voicings.forEach((v, i) => {
      const start = t0 + accBeats * beat;
      const dur = (v.dur ?? 2) * beat; // honor the harmonic rhythm
      for (const midi of [v.bass, ...v.notes]) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.value = 440 * 2 ** ((midi - 69) / 12);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(midi === v.bass ? 0.12 : 0.07, start + 0.02);
        gain.gain.setTargetAtTime(0, start + Math.max(0.05, dur - 0.15), 0.05);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + dur);
        nodes.push(osc);
      }
      timers.push(setTimeout(() => setPlayhead(i), (start - ctx.currentTime) * 1000));
      accBeats += v.dur ?? 2;
    });
    timers.push(setTimeout(() => { setPlaying(false); setPlayhead(-1); }, (t0 - ctx.currentTime + accBeats * beat) * 1000));

    stopRef.current = () => {
      for (const n of nodes) { try { n.stop(); } catch { /* already stopped */ } }
      for (const t of timers) clearTimeout(t);
    };
    setPlaying(true);
  }

  useEffect(() => () => stopRef.current(), []);
  return { play, stop, playing, playhead };
}

/** Progression shape — the suite's shared piano roll, read-only. */
function ProgressionShape({ voicings, channelMode, beat }) {
  const hostRef = useRef(null);
  const rollRef = useRef(null);
  const { notes, lengthBeats } = useMemo(
    () => voicingsToClip(voicings, channelMode),
    [voicings, channelMode],
  );
  useEffect(() => {
    rollRef.current = createPianoRoll(hostRef.current, { height: 120 });
    return () => rollRef.current.destroy();
  }, []);
  useEffect(() => { rollRef.current.update({ notes, lengthBeats }); }, [notes, lengthBeats]);
  useEffect(() => { rollRef.current.setPlayhead(beat); }, [beat]);
  return <div ref={hostRef} />;
}

function MultiplierBadge({ value }) {
  if (Math.abs(value - 1) < 1e-9) return null;
  const up = value > 1;
  return (
    <span className={up ? "es-badge es-up" : "es-badge"}>
      ×{value >= 1 ? value.toFixed(2).replace(/\.?0+$/, "") : value.toPrecision(2)}
    </span>
  );
}

function CorpusStats({ table, mode, statsLabel, setStatsLabel, curation, setCuration }) {
  const labelsByMass = useMemo(() => {
    const mass = labelMass(table);
    return [...mass.entries()].sort((a, b) => b[1] - a[1]).map(([l]) => l);
  }, [table]);
  const selected = statsLabel && table[statsLabel] ? statsLabel : startLabel(table, mode);
  const row = table[selected] ?? {};
  const entries = Object.entries(row).sort((a, b) => b[1] - a[1]).slice(0, 12);
  const rowTotal = Object.values(row).reduce((a, b) => a + b, 0);
  const maxCount = entries.length ? entries[0][1] : 1;

  return (
    <div className="es-panel" style={{ marginTop: "var(--es-space-3)" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "var(--es-space-3)", flexWrap: "wrap" }}>
        <h2 style={{ fontSize: "var(--es-text-md)", margin: 0 }}>Corpus statistics</h2>
        <label style={{ display: "flex", gap: "var(--es-space-2)", alignItems: "center", fontSize: "var(--es-text-sm)" }}>
          after
          <select className="es-control" style={{ minHeight: 36 }} value={selected} onChange={(e) => setStatsLabel(e.target.value)}>
            {labelsByMass.slice(0, 80).map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
        <span style={{ color: "var(--es-fg-muted)", fontSize: "var(--es-text-sm)" }}>
          {rowTotal.toLocaleString()} transitions out of {selected} in the corpus
        </span>
      </div>
      <div style={{ display: "grid", gap: 6, marginTop: "var(--es-space-3)" }}>
        {entries.map(([to, count]) => {
          const mult = multiplierFor(curation, selected, to);
          return (
            <div key={to} style={{ display: "grid", gridTemplateColumns: "90px 1fr 64px 48px auto", gap: "var(--es-space-2)", alignItems: "center", fontSize: "var(--es-text-sm)" }}>
              <span className="es-num">{to}</span>
              <div aria-hidden className="es-bar">
                <div style={{ width: `${(count * (mult ?? 1)) / maxCount * 100}%` }} />
              </div>
              <span style={{ color: "var(--es-fg-muted)", textAlign: "right", fontFamily: "var(--es-font-mono)" }}>
                {((count / rowTotal) * 100).toFixed(1)}%
              </span>
              <MultiplierBadge value={mult} />
              <span style={{ display: "flex", gap: 4 }}>
                <button className="es-btn es-small" aria-label={`Emphasize ${selected} to ${to}`}
                  onClick={() => setCuration((c) => adjustTransition(c, selected, to, TRANSITION_STEP))}>▲</button>
                <button className="es-btn es-small" aria-label={`De-emphasize ${selected} to ${to}`}
                  onClick={() => setCuration((c) => adjustTransition(c, selected, to, 1 / TRANSITION_STEP))}>▼</button>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function App() {
  const [tonic, setTonic] = useState("C");
  const [mode, setMode] = useState("major");
  const [bars, setBars] = useState(8);             // progression length in 4/4 bars
  const [harmonicRhythm, setHarmonicRhythm] = useState("half"); // quarter|half|whole|double|quad|varied
  const [seed, setSeed] = useState(1);
  const [method, setMethod] = useState("markov");
  const [statsLabel, setStatsLabel] = useState(null);
  const [bpm, setBpm] = useState(120);
  const [curation, setCuration] = useState(loadCuration);
  const [showCuration, setShowCuration] = useState(true);
  const [host, setHost] = useState({ playing: false, bpm: 0 });
  const [runtime, setRuntime] = useState(null);
  const [theme, setThemeState] = useState(resolvedTheme);
  const [temperature, setTemperature] = useState(1);
  const [channelMode, setChannelMode] = useState("single");
  const [hostPlayhead, setHostPlayhead] = useState(-1);
  const [hostBeat, setHostBeat] = useState(-1);
  const chordSpansRef = useRef({ starts: [], total: 0 }); // cumulative chord beats, for host chord-follow
  const [startFrom, setStartFrom] = useState(null);
  const [extensions, setExtensions] = useState([]);
  const [opCount, setOpCount] = useState(0); // bumps on extend/clear (forces editor remount)
  const [tool, setTool] = useState("edit"); // leadsheet tool: edit | rate-up | rate-down
  const [resetArmed, setResetArmed] = useState(false); // two-tap confirm (WKWebView has no window.confirm)
  const [pendingProfile, setPendingProfile] = useState(null); // a loaded profile awaiting Replace/Merge
  const [profileError, setProfileError] = useState(null);
  const [voiceLeadMode, setVoiceLeadMode] = useState("strict"); // none | loose | strict
  const [variety, setVariety] = useState("fresh"); // faithful | fresh | bold — de-emphasize repeats/returns/ii-V-I
  const [voicingShape, setVoicingShape] = useState("close"); // close|open|drop2|drop3|spread|rootless|shell
  const [midiChord, setMidiChord] = useState({ notes: [], chord: null, symbol: null }); // live MIDI chord input
  const [latched, setLatched] = useState(null); // { symbol, notes } — last chord played, kept after release
  const { play, stop, playing, playhead } = usePlayer();

  useEffect(() => { saveCuration(curation); }, [curation]);

  // Plugin integration: host transport display + session-state restore.
  useEffect(() => {
    if (!IN_PLUGIN) return;
    const offTransport = bridge.on("transport", (t) => {
      setHost({ playing: !!t.playing, bpm: t.bpm || 0 });
      // Chord-follow: the scheduler reports its clip-relative beat; map it to
      // the sounding chord via the cumulative durations (variable rhythm).
      setHostPlayhead(t.playing && t.beat >= 0 ? beatToChordIndex(chordSpansRef.current, t.beat) : -1);
      setHostBeat(t.playing && t.beat >= 0 ? t.beat : -1);
    });
    const offRuntime = bridge.on("runtime", setRuntime);
    const offState = bridge.on("state", (s) => {
      try {
        if (s.tonic) setTonic(s.tonic);
        if (s.mode) setMode(s.mode);
        if (s.bars) setBars(s.bars);
        else if (s.length) setBars(Math.max(1, Math.round(s.length / 2))); // migrate chord-count → bars (½-bar default)
        if (s.harmonicRhythm) setHarmonicRhythm(s.harmonicRhythm);
        if (s.seed !== undefined) setSeed(s.seed);
        if (s.method) setMethod(s.method);
        if (s.curation && typeof s.curation.multipliers === "object") setCuration(s.curation);
        if (typeof s.temperature === "number") setTemperature(s.temperature);
        if (s.channelMode) setChannelMode(s.channelMode);
        if (s.startFrom !== undefined) setStartFrom(s.startFrom);
        if (Array.isArray(s.extensions)) setExtensions(s.extensions);
        if (typeof s.voiceLeadMode === "string") setVoiceLeadMode(s.voiceLeadMode);
        else if (typeof s.voiceLead === "boolean") setVoiceLeadMode(s.voiceLead ? "strict" : "none"); // migrate older sessions
        if (s.voicingShape) setVoicingShape(s.voicingShape);
        setVariety(s.variety ?? "faithful"); // pre-variety sessions keep their original walk
      } catch { /* malformed saved state — keep defaults */ }
    });
    // A profile file chosen via the native picker comes back base64-encoded;
    // decode as UTF-8 (the labels carry ♭/♯/→) and stage it for Replace/Merge.
    const offFile = bridge.on("fileOpened", (d) => {
      try {
        const bin = atob(d?.b64 ?? "");
        const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
        receiveProfileText(new TextDecoder().decode(bytes));
      } catch { setProfileError("Couldn't read that file."); }
    });
    bridge.ready();
    return () => { offTransport(); offRuntime(); offState(); offFile(); };
  }, []);

  // MIDI chord input (ChordID): the processor forwards played notes; we
  // track the held set and detect the chord. Plugin-only (the browser has
  // no bridge MIDI yet — a WebMIDI feed could fill the same shape later).
  useEffect(() => {
    if (!IN_PLUGIN) return;
    const ci = createChordInput(bridge, { onUpdate: setMidiChord });
    return () => ci.stop();
  }, []);

  // Latch: the played chord doesn't sustain past release (both hands may be
  // on the keys), so keep the last identified chord — with the notes as
  // played — until the user adds or clears it. The next chord played replaces
  // it; a quiet release does not.
  useEffect(() => {
    if (midiChord.chord && midiChord.symbol) {
      setLatched({ symbol: midiChord.symbol, notes: midiChord.notes, chord: midiChord.chord });
    }
  }, [midiChord]);

  // Harmonic rhythm: a bar plan (chord durations + held bars) for `bars` bars;
  // the number of chord slots is how many chords to generate.
  const rhythm = useMemo(() => rhythmPlan(bars, harmonicRhythm, seed), [bars, harmonicRhythm, seed]);
  const labels = useMemo(
    () => generateSections(table[mode], mode,
      { length: chordSlots(rhythm), seed, curation, method, temperature, startFrom, variety }, extensions),
    [mode, rhythm, seed, curation, method, temperature, startFrom, variety, extensions],
  );
  // The progression as an editable theory object: generated by default,
  // overridden when the user hand-edits in the leadsheet editor. Editing
  // flows through to the sheet, playback, and export (the embedded
  // Progression). Regeneration or a key change resets the edits.
  const baseProg = useMemo(
    () => buildProgression(labels, rhythm, { tonic, mode }),
    [labels, rhythm, tonic, mode],
  );
  // genId changes on any GENERATION op (every param that produces `labels`,
  // plus opCount for extend/clear) — but NOT on an edit. An edit is stamped
  // with the genId it was made under; when that no longer matches, the edit
  // is stale and effectiveProg falls back to the fresh generation. This is
  // synchronous (no post-render effect), so a Generate from a blank sheet
  // shows the new progression immediately, without a Curate/Edit toggle.
  const genId = `${tonic}|${mode}|${seed}|${bars}|${harmonicRhythm}|${temperature}|${method}|${startFrom}|${variety}|${opCount}`;
  const [edited, setEdited] = useState(null); // { genId, prog } | null
  const effectiveProg = edited && edited.genId === genId ? edited.prog : baseProg;
  const chords = useMemo(
    () => chordsFromProgression(effectiveProg, { tonic, mode }),
    [effectiveProg, tonic, mode],
  );
  const voicings = useMemo(
    () => voiceProgression(chords, { mode: voiceLeadMode, shape: voicingShape }),
    [chords, voiceLeadMode, voicingShape],
  );
  // Cumulative chord start beats (chord-follow + the local player + the shape
  // playhead all read this so they agree with the harmonic rhythm).
  const chordSpans = useMemo(() => {
    const starts = chordStartBeats(voicings);
    const total = starts.length ? starts[starts.length - 1] + (voicings[voicings.length - 1].dur ?? 2) : 0;
    return { starts, total };
  }, [voicings]);
  chordSpansRef.current = chordSpans;

  // Plugin: every regeneration updates the host clip (strict transport
  // sync — the host's play button is the play button) and persists the
  // session state into the plugin (DAW sessions recall it).
  // NB: must live AFTER the voicings memo — dependency arrays evaluate at
  // render time, and a use-before-declare here is a TDZ crash (found by
  // the WKWebView smoke after shipping blank to an iPad, 2026-06-12).
  useEffect(() => {
    if (!IN_PLUGIN) return;
    const { notes, lengthBeats } = voicingsToClip(voicings, channelMode);
    bridge.setClip(notes, lengthBeats, { loop: true });
    bridge.send("enkerliState", { tonic, mode, bars, harmonicRhythm, seed, method, curation, temperature, channelMode, startFrom, extensions, voiceLeadMode, voicingShape, variety });
  }, [voicings, tonic, mode, bars, harmonicRhythm, seed, method, curation, temperature, channelMode, startFrom, extensions, voiceLeadMode, voicingShape, variety]);

  const startOptions = useMemo(() => {
    const mass = labelMass(table[mode]);
    return [...mass.entries()].sort((a, b) => b[1] - a[1]).slice(0, 80).map(([l]) => l);
  }, [mode]);

  const transitions = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (let i = 1; i < labels.length; i++) {
      if (labels[i - 1] === labels[i]) continue;
      const key = pairKey(labels[i - 1], labels[i]);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ from: labels[i - 1], to: labels[i], key });
    }
    return out;
  }, [labels]);

  const curatedEntries = Object.entries(curation.multipliers)
    .sort((a, b) => b[1] - a[1]);

  const playIdx = IN_PLUGIN ? hostPlayhead : playhead;

  // Common opening chords (for the first slot of an empty progression): the
  // corpus's most likely start, then the most common chords overall.
  const openerLabels = useMemo(() => {
    const start = startLabel(table[mode], mode);
    return [start, ...startOptions.filter((l) => l !== start)].slice(0, 6);
  }, [mode, startOptions]);

  // The "+" picker's suggester: where to go next from the chord before the
  // insertion point. Offers the held MIDI chord first (input by MIDI), then
  // corpus continuations voiceled from the previous voicing — or, for the
  // first chord, common openers. Read through a ref by the editor, so it
  // always sees the current latch and voicings.
  const suggestNext = useCallback(({ before, atEnd, key }) => {
    const out = [];
    if (latched) out.push({ label: latched.symbol, symbol: latched.symbol, notes: latched.notes, kind: "played" });
    const lastLabel = before ? labelOfChord(before, key) : null;
    if (lastLabel) {
      const lastVoicing = atEnd && voicings.length
        ? voicings[voicings.length - 1].notes
        : voiceChord(realizeChord(before, key).pcs, realizeChord(before, key).rootPc, "close");
      for (const s of nextChordSuggestions(table[key.mode], key, lastLabel, lastVoicing, { fallback: openerLabels, max: 7 })) {
        out.push({ label: s.label, symbol: s.symbol, notes: s.notes, movement: s.movement });
      }
    } else {
      for (const label of openerLabels) {
        const ch = realizeLabel(label, key);
        if (ch) out.push({ label, symbol: ch.symbol, notes: voiceChord(ch.pcs, ch.rootPc, "close") });
      }
    }
    return out;
  }, [latched, voicings, openerLabels]);

  // MIDI panel: alternative voicings of the held chord (smoothest first), and
  // "completions" — common chords the played notes are one tone shy of.
  const playedVoicings = useMemo(() => {
    if (!latched?.chord) return [];
    const pcs = latched.chord.templatePcs ?? latched.chord.observedPcs ?? [];
    const from = voicings.length ? voicings[voicings.length - 1].notes : null;
    return voicingSuggestions(pcs, latched.chord.root, { from, max: 4 });
  }, [latched, voicings]);
  const completions = useMemo(
    () => (latched ? chordCompletions(latched.notes, { max: 3 }) : []),
    [latched],
  );
  // The genId an op produces (only opCount changes for extend/clear/reset).
  const genIdFor = (op) => `${tonic}|${mode}|${seed}|${bars}|${harmonicRhythm}|${temperature}|${method}|${startFrom}|${variety}|${op}`;

  /** Append a chord into the working progression, packing 4/4 bars by
   *  duration (an added chord defaults to the current harmonic rhythm; fill
   *  the last bar until it's full, then start a new one). */
  function appendChord(prog, ch) {
    if (!ch.dur) ch.dur = rhythmBeats(harmonicRhythm);
    if (!prog.sections.length) prog.sections = [{ bars: [] }];
    const barsArr = prog.sections[0].bars;
    const last = barsArr[barsArr.length - 1];
    const beats = (b) => b.chords.reduce((s, c) => s + (c.dur ?? 2), 0);
    if (last && !last.repeat && beats(last) + ch.dur <= BEATS_PER_BAR) last.chords.push(ch);
    else barsArr.push({ chords: [ch] });
  }

  /** Append a generated continuation from the working progression's last
   *  chord (extend-from-chord; works from a hand-typed chord or blank). */
  function handleExtend() {
    const flat = effectiveProg.sections.flatMap((s) => s.bars).flatMap((b) => (b.repeat ? [] : b.chords));
    const last = flat[flat.length - 1];
    const startTok = last
      ? (last.source === "degree" && last.degree ? last.degree.numeral + last.degree.suffix : (last.inputText ?? null))
      : null;
    const cont = generateLabels(table[mode], mode,
      { length: 5, seed: seed * 31 + opCount + 1, curation, method: "markov", temperature, startFrom: startTok });
    const toks = startTok && cont[0] === startTok ? cont.slice(1) : cont;
    const next = clone(effectiveProg);
    for (const tok of toks) {
      const ch = parseLeadsheet(tok, { tonic, mode }).sections[0]?.bars[0]?.chords[0];
      if (ch) appendChord(next, ch);
    }
    setEdited({ genId: genIdFor(opCount + 1), prog: next });
    setOpCount((n) => n + 1);
  }

  /** Append a chord (already parsed) to the working progression and stamp it
   *  as the current edit. The shared tail of every add path. */
  function commitChord(ch) {
    if (!ch) return;
    const next = clone(effectiveProg);
    appendChord(next, ch);
    setEdited({ genId: genIdFor(opCount + 1), prog: next });
    setOpCount((n) => n + 1);
  }

  /** Rate the transition INTO chord `i` (👍 dir +1 / 👎 dir −1): nudges the
   *  corpus weight for the move prev→this. The first chord has no incoming
   *  transition. */
  function rateIncoming(i, dir) {
    if (i <= 0 || i >= chords.length) return;
    const from = functionalOfRealized(chords[i - 1], { tonic, mode });
    const to = functionalOfRealized(chords[i], { tonic, mode });
    if (!from || !to || from === to) return;
    setCuration((c) => adjustTransition(c, from, to, dir > 0 ? TRANSITION_STEP : 1 / TRANSITION_STEP));
  }
  /** Current multiplier on the transition into chord `i` (drives 👍/👎 state). */
  function incomingRating(i) {
    if (i <= 0 || i >= chords.length) return 1;
    const from = functionalOfRealized(chords[i - 1], { tonic, mode });
    const to = functionalOfRealized(chords[i], { tonic, mode });
    return from && to ? multiplierFor(curation, from, to) : 1;
  }

  /** Add the latched MIDI chord to the leadsheet (ChordID), locking a voicing
   *  — the notes as played by default, or `voicing` (a chosen alternative).
   *  Clears the latch once consumed. */
  function insertMidiChord(voicing = null) {
    if (!latched) return;
    const ch = parseLeadsheet(latched.symbol, { tonic, mode }).sections[0]?.bars[0]?.chords[0];
    if (!ch) return;
    const v = voicing && voicing.length ? voicing : latched.notes;
    if (v?.length) ch.voicing = [...v];
    commitChord(ch);
    setLatched(null);
  }

  /** Add a completion of the played chord (the played notes + the one missing
   *  tone), locking that voicing. Consumes the latch. */
  function insertCompletion(s) {
    const ch = parseLeadsheet(s.symbol, { tonic, mode }).sections[0]?.bars[0]?.chords[0];
    if (!ch) return;
    if (s.notes?.length) ch.voicing = [...s.notes];
    commitChord(ch);
    setLatched(null);
  }

  /** Blank the leadsheet — start from scratch (type a chord, then Extend). */
  function handleClear() {
    setEdited({ genId: genIdFor(opCount + 1), prog: { key: { tonic, mode }, sections: [{ bars: [] }] } });
    setOpCount((n) => n + 1);
  }

  /** Save the curation profile to a file (native picker in-plugin; download in
   *  the browser — blob/data: anchors crash the WKWebView). */
  function saveProfile() {
    const savedAt = new Date().toISOString();
    const stamp = savedAt.slice(0, 16).replace(/[:T]/g, "-"); // 2026-06-14-15-30
    const filename = `curation-profile-${stamp}.json`;
    const bytes = new TextEncoder().encode(exportCuration(curation, { savedAt }));
    if (bridge?.saveFile?.(filename, bytes)) return;
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  /** Parse a profile's text and stage it for Replace/Merge. */
  function receiveProfileText(text) {
    try {
      const incoming = importCuration(text);
      setPendingProfile({ multipliers: incoming.multipliers, count: Object.keys(incoming.multipliers).length });
      setProfileError(null);
    } catch {
      setProfileError("That file isn't a curation profile.");
    }
  }

  /** Load a profile from a file (native picker in-plugin → on("fileOpened");
   *  <input type=file> in the browser). */
  function loadProfile() {
    setProfileError(null);
    if (bridge?.openFile?.("*.json")) return; // arrives via the fileOpened listener
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".json,application/json";
    input.onchange = () => input.files?.[0]?.text().then(receiveProfileText).catch(() => setProfileError("Couldn't read that file."));
    input.click();
  }

  return (
    <div className="es-app" style={{ padding: "var(--es-space-4)" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <header style={{ marginBottom: "var(--es-space-4)" }}>
          <h1 style={{ fontSize: "var(--es-text-xl)", margin: 0 }}>Progression Studio</h1>
          <p style={{ color: "var(--es-fg-muted)", fontSize: "var(--es-text-sm)", margin: "var(--es-space-1) 0 0" }}>
            Markov walk over {Object.keys(table[mode]).length} degree labels from 2,611 jazz lead sheets
            {IN_PLUGIN && <> · host {host.playing ? "playing" : "stopped"}{host.bpm ? ` · ${Math.round(host.bpm)} bpm` : ""}</>}
            {IN_PLUGIN && runtime && <> · {runtime.host} · {runtime.wrapper} · {runtime.memMB} MB</>}
            {curatedEntries.length > 0 && <> · {curatedEntries.length} curated weight{curatedEntries.length > 1 ? "s" : ""}</>}
          </p>
        </header>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--es-space-3)", alignItems: "end", marginBottom: "var(--es-space-4)" }}>
          <label style={{ display: "grid", gap: 4, fontSize: "var(--es-text-sm)" }}>Key
            <select className="es-control" value={tonic} onChange={(e) => setTonic(e.target.value)}>
              {ROOTS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: "var(--es-text-sm)" }}>Mode
            <select className="es-control" value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="major">major</option>
              <option value="minor">minor</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: "var(--es-text-sm)" }}>Start from
            <select className="es-control" value={startFrom ?? ""} title="Seed the walk from an arbitrary chord"
              onChange={(e) => setStartFrom(e.target.value || null)}>
              <option value="">tonic (auto)</option>
              {startOptions.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: "var(--es-text-sm)" }}>Engine
            <select className="es-control" value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="markov">corpus walk</option>
              <option value="markov-cadence">corpus walk + cadence</option>
              <option value="circle">circle of fifths</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: "var(--es-text-sm)" }}>Variety
            <select className="es-control" value={variety} onChange={(e) => setVariety(e.target.value)}
              title="De-emphasize static/clichéd moves: repeats (X→X), quick returns (X→Y→X), and ii–V–I">
              <option value="faithful">faithful</option>
              <option value="fresh">fresh</option>
              <option value="bold">bold</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: "var(--es-text-sm)" }}>
            Temperature <span className="es-num">{temperature.toFixed(2)}</span>
            <input type="range" min="0" max="100" style={{ width: 110, minHeight: "var(--es-ctl-h)" }}
              aria-label="Transition temperature: higher surfaces more unusual transitions"
              value={Math.round(50 + 50 * Math.log(temperature) / Math.log(4))}
              onChange={(e) => setTemperature(Number((4 ** ((Number(e.target.value) - 50) / 50)).toFixed(2)))}
            />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: "var(--es-text-sm)" }}>Channels
            <select className="es-control" value={channelMode} onChange={(e) => setChannelMode(e.target.value)}
              title="Route bass and voices to separate MIDI channels">
              <option value="single">single (1)</option>
              <option value="split">bass 1 · chords 2</option>
              <option value="perVoice">per voice (1…)</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: "var(--es-text-sm)" }}>Voicing
            <select className="es-control" value={voicingShape} onChange={(e) => setVoicingShape(e.target.value)}
              title="Initial chord voicing shape (the seed for voice leading)">
              <option value="close">close</option>
              <option value="open">open</option>
              <option value="drop2">drop-2</option>
              <option value="drop3">drop-3</option>
              <option value="spread">spread</option>
              <option value="rootless">rootless</option>
              <option value="shell">shell (3rd+7th)</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: "var(--es-text-sm)" }}>Voice leading
            <select className="es-control" value={voiceLeadMode} onChange={(e) => setVoiceLeadMode(e.target.value)}
              title="none: home-position shapes · loose: home shapes nudged to the nearest register · strict: minimal taxicab motion (smoothest, may obscure the chord)">
              <option value="none">none</option>
              <option value="loose">loose</option>
              <option value="strict">strict</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: "var(--es-text-sm)" }}>Bars
            <select className="es-control" value={bars} onChange={(e) => setBars(Number(e.target.value))}>
              {[2, 4, 8, 12, 16, 24, 32].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: "var(--es-text-sm)" }}>Harmonic rhythm
            <select className="es-control" value={harmonicRhythm} onChange={(e) => setHarmonicRhythm(e.target.value)}
              title="Default chord length; 'varied' mixes lengths for a breathing harmonic rhythm">
              <option value="quarter">1 beat</option>
              <option value="half">½ bar (2 beats)</option>
              <option value="whole">1 bar</option>
              <option value="double">2 bars</option>
              <option value="quad">4 bars</option>
              <option value="varied">varied</option>
            </select>
          </label>
          {!IN_PLUGIN && <label style={{ display: "grid", gap: 4, fontSize: "var(--es-text-sm)" }}>Tempo
            <input className="es-control" style={{ width: 72 }} type="number" min="40" max="300" value={bpm} onChange={(e) => setBpm(Number(e.target.value))} />
          </label>}
          <button className="es-btn" onClick={() => { setSeed((s) => s + 1); setExtensions([]); }}>
            Generate
          </button>
          <button className="es-btn" title="Append a continuation from the last chord (works from a typed chord, too)"
            onClick={handleExtend}>
            + Extend
          </button>
          <button className="es-btn" title="Clear the leadsheet — start from scratch"
            onClick={handleClear}>
            Blank
          </button>
          {!IN_PLUGIN && <button
            className="es-btn es-primary"
            onClick={() => (playing ? stop() : play(voicings, bpm))}
          >
            {playing ? "Stop" : "Play"}
          </button>}
          <button
            className="es-btn"
            onClick={() => navigator.clipboard?.writeText(chords.map((c) => c.symbol).join(" | "))}
          >
            Copy chords
          </button>
          <button
            className="es-btn"
            title="Download as a Standard MIDI File (chord symbols as markers)"
            onClick={() => exportProgression(bridge, voicings, { bpm, tonic, mode, seed, channelMode })}
          >
            Export MIDI
          </button>
          <button
            className="es-btn"
            aria-label="Toggle color theme"
            title="Light is the house default; dark is one tap away"
            onClick={() => setThemeState(toggleTheme())}
          >
            {theme === "dark" ? "☀︎ Light" : "● Dark"}
          </button>
        </div>

        <div className="es-panel">
          <div style={{ display: "flex", gap: "var(--es-space-2)", alignItems: "center", marginBottom: "var(--es-space-3)" }}>
            <div role="toolbar" aria-label="Leadsheet tool" style={{ display: "flex", gap: 4 }}>
              {[
                { id: "edit", label: "✏️ Edit", hint: "Tap a chord to retype it" },
                { id: "rate-up", label: "👍", hint: "Tap chords to reinforce the move into them" },
                { id: "rate-down", label: "👎", hint: "Tap chords to weaken the move into them" },
              ].map((t) => (
                <button key={t.id} className={`es-btn es-small ${tool === t.id ? "es-primary" : ""}`}
                  aria-pressed={tool === t.id} title={t.hint}
                  onClick={() => setTool(t.id)}>{t.label}</button>
              ))}
            </div>
            {edited && edited.genId === genId && <span style={{ color: "var(--es-accent)", fontSize: "var(--es-text-sm)" }}>· edited</span>}
            {edited && edited.genId === genId && <button className="es-btn es-small" onClick={() => { setEdited(null); setOpCount((n) => n + 1); }}>Reset to generated</button>}
            <span style={{ marginLeft: "auto", color: "var(--es-fg-muted)", fontSize: "var(--es-text-sm)" }}>
              {tool === "edit" ? "tap a chord to retype · + to add" : "tap chords to rate the move into each"}
            </span>
          </div>
          <LeadsheetEdit key={genId} progression={effectiveProg} activeIndex={playIdx}
            onEdit={(p) => setEdited({ genId, prog: p })} suggest={suggestNext}
            onRate={rateIncoming} ratingOf={incomingRating} ratingSignal={curation} tool={tool} />

          <div style={{ display: "flex", gap: "var(--es-space-2)", marginTop: "var(--es-space-4)", flexWrap: "wrap" }}>
            <button
              className="es-btn"
              title={`Multiply every transition in this progression by ${PROGRESSION_STEP}`}
              onClick={() => setCuration((c) => rateProgression(c, labels, PROGRESSION_STEP))}
            >
              👍 More like this
            </button>
            <button
              className="es-btn"
              title={`Divide every transition in this progression by ${PROGRESSION_STEP}`}
              onClick={() => setCuration((c) => rateProgression(c, labels, 1 / PROGRESSION_STEP))}
            >
              👎 Bit meh
            </button>
            <button
              className="es-btn es-small" style={{ marginLeft: "auto" }}
              onClick={() => setShowCuration((s) => !s)}
              aria-expanded={showCuration}
            >
              {showCuration ? "Hide curation ▾" : "Curation ▸"}
            </button>
          </div>
        </div>

        <details className="es-section" open style={{ marginTop: "var(--es-space-3)" }}>
          <summary>Progression shape</summary>
          <div className="es-section-body">
            <ProgressionShape
              voicings={voicings}
              channelMode={channelMode}
              beat={IN_PLUGIN ? hostBeat : playhead >= 0 ? (chordSpans.starts[playhead] ?? 0) : -1}
            />
          </div>
        </details>

        {IN_PLUGIN && (
          <details className="es-section" open style={{ marginTop: "var(--es-space-3)" }}>
            <summary>MIDI chord input
              {midiChord.notes.length > 0 && <span style={{ color: "var(--es-accent)", fontWeight: 400 }}> · playing {midiChord.symbol ?? "…"}</span>}
            </summary>
            <div className="es-section-body">
              {!latched ? (
                <p style={{ color: "var(--es-fg-muted)", margin: 0 }}>Play a chord on a MIDI keyboard routed into this plugin — it's identified here and held, so you can release both hands and then add it (with the voicing as you played it). It's also offered in the leadsheet's “+” picker.</p>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--es-space-3)", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "var(--es-text-lg)", fontWeight: 600 }}>{latched.symbol}</span>
                    <span className="es-num" style={{ color: "var(--es-fg-muted)", fontSize: "var(--es-text-sm)" }}>
                      {latched.notes.map((n) => midiName(n)).join(" ")}
                    </span>
                    {midiChord.notes.length === 0 && <span className="es-badge" title="the chord is held after you release the keys">held</span>}
                    <button className="es-btn" onClick={() => insertMidiChord()}
                      title="Add to the leadsheet, locking the voicing as played">
                      Add chord
                    </button>
                    <button className="es-btn es-small" onClick={() => setLatched(null)} title="Forget the held chord">
                      Clear
                    </button>
                  </div>

                  {completions.length > 0 && (
                    <div style={{ marginTop: "var(--es-space-3)" }}>
                      <div className="es-eyebrow">complete to a common chord (add one tone)</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: "var(--es-space-1)" }}>
                        {completions.map((s, i) => (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: "var(--es-space-2)" }}>
                            <span style={{ width: 110, fontWeight: 600 }}>{s.symbol}</span>
                            <span className="es-num" style={{ flex: 1, color: "var(--es-fg-muted)", fontSize: "var(--es-text-sm)" }}>
                              + {midiName(s.added)}
                            </span>
                            <button className="es-btn es-small" onClick={() => insertCompletion(s)}>Add</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {playedVoicings.length > 0 && (
                    <div style={{ marginTop: "var(--es-space-3)" }}>
                      <div className="es-eyebrow">other voicings — smoothest from the last chord first</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: "var(--es-space-1)" }}>
                        {playedVoicings.map((s, i) => (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: "var(--es-space-2)" }}>
                            <span style={{ width: 72, color: "var(--es-fg-2)", fontSize: "var(--es-text-sm)" }}>{s.label}</span>
                            <span className="es-num" style={{ flex: 1, color: "var(--es-fg-muted)", fontSize: "var(--es-text-sm)" }}>
                              {s.notes.map((n) => midiName(n)).join(" ")}
                            </span>
                            <span className="es-badge" title="total semitones of voice movement from the last chord">{s.movement} st</span>
                            <button className="es-btn es-small" onClick={() => insertMidiChord(s.notes)}>Add</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </details>
        )}


        {showCuration && (
          <div className="es-panel" style={{ marginTop: "var(--es-space-3)" }}>
            <h2 style={{ fontSize: "var(--es-text-md)", margin: "0 0 var(--es-space-2)" }}>Transitions in this progression</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "var(--es-space-2)" }}>
              {transitions.map(({ from, to, key }) => {
                const mult = multiplierFor(curation, from, to);
                return (
                  <div key={key} style={{ display: "flex", alignItems: "center", gap: "var(--es-space-2)", fontSize: "var(--es-text-sm)" }}>
                    <span className="es-num" style={{ flex: 1 }}>{key}</span>
                    <MultiplierBadge value={mult} />
                    <button className="es-btn es-small" aria-label={`Emphasize ${key}`} title="Sounds good — emphasize"
                      onClick={() => setCuration((c) => adjustTransition(c, from, to, TRANSITION_STEP))}>▲</button>
                    <button className="es-btn es-small" aria-label={`De-emphasize ${key}`} title="De-emphasize"
                      onClick={() => setCuration((c) => adjustTransition(c, from, to, 1 / TRANSITION_STEP))}>▼</button>
                  </div>
                );
              })}
            </div>

            {curatedEntries.length > 0 && (
              <>
                <h2 style={{ fontSize: "var(--es-text-md)", margin: "var(--es-space-4) 0 var(--es-space-2)" }}>
                  Curated weights ({curatedEntries.length})
                </h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "var(--es-space-2)" }}>
                  {curatedEntries.map(([key, value]) => (
                    <div key={key} style={{ display: "flex", alignItems: "center", gap: "var(--es-space-2)", fontSize: "var(--es-text-sm)" }}>
                      <span className="es-num" style={{ flex: 1 }}>{key}</span>
                      <MultiplierBadge value={value} />
                      <button className="es-btn es-small" aria-label={`Reset ${key}`} title="Reset to corpus weight"
                        onClick={() => setCuration((c) => resetTransition(c, key))}>↺</button>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div style={{ display: "flex", gap: "var(--es-space-2)", marginTop: "var(--es-space-4)", flexWrap: "wrap", alignItems: "center" }}>
              <button className="es-btn es-small" title="Copy the profile JSON to the clipboard"
                onClick={() => navigator.clipboard?.writeText(exportCuration(curation, { savedAt: new Date().toISOString() }))}>
                Copy profile
              </button>
              <button className="es-btn es-small" onClick={saveProfile}>Save profile…</button>
              <button className="es-btn es-small" onClick={loadProfile}>Load profile…</button>
              <button className={`es-btn es-small ${resetArmed ? "es-primary" : ""}`}
                title="Clear every curated weight"
                onClick={() => {
                  if (resetArmed) { setCuration({ multipliers: {} }); setResetArmed(false); }
                  else { setResetArmed(true); setTimeout(() => setResetArmed(false), 3000); }
                }}>
                {resetArmed ? "Tap again to reset" : "Reset all"}
              </button>
              {profileError && <span style={{ color: "var(--es-danger, #b3261e)", fontSize: "var(--es-text-sm)" }}>{profileError}</span>}
            </div>
            {pendingProfile && (
              <div style={{ display: "flex", gap: "var(--es-space-2)", marginTop: "var(--es-space-2)", alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: "var(--es-text-sm)" }}>Loaded {pendingProfile.count} weight{pendingProfile.count === 1 ? "" : "s"} —</span>
                <button className="es-btn es-small" title="Replace the current curation with the loaded profile"
                  onClick={() => { setCuration({ multipliers: pendingProfile.multipliers }); setPendingProfile(null); }}>Replace</button>
                <button className="es-btn es-small es-primary" title="Compound the loaded weights into the current curation"
                  onClick={() => { setCuration((c) => mergeCuration(c, pendingProfile)); setPendingProfile(null); }}>Merge</button>
                <button className="es-btn es-small" onClick={() => setPendingProfile(null)}>Cancel</button>
              </div>
            )}
          </div>
        )}

        <CorpusStats
          table={table[mode]}
          mode={mode}
          statsLabel={statsLabel}
          setStatsLabel={setStatsLabel}
          curation={curation}
          setCuration={setCuration}
        />

        <footer style={{ marginTop: "var(--es-space-4)", color: "var(--es-fg-muted)", fontSize: "var(--es-text-sm)" }}>
          Transition statistics derived from the Impro-Visor imaginary-book corpus
          (github.com/Impro-Visor/Impro-Visor, GPL) — counts of chord changes only.
          Curation multiplies those counts locally (saved in this browser; export to share).
          Degree labels per the suite conventions; voicings via minimal (taxicab) voice leading.
        </footer>
      </div>
    </div>
  );
}
