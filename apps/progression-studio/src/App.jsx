import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import table from "./data/transitions.json";
import trigrams from "./data/trigrams.json";
import { BEATS_PER_BAR, chordCompletions, chordSlots, divideBar, generateLabels, generateSections, labelMass, nextChordSuggestions, realizeLabel, rhythmBeats, rhythmPlan, startLabel, voiceChord, voiceProgression, voicingSuggestions } from "./generate.js";
import { chordStartBeats, exportProgression, voicingsToClip } from "./exportMidi.js";
import { loadLibrary, saveLibrary, newId } from "./library.js";
import { progressionFromSMF } from "@enkerli/midi";
import { createBridge } from "./juceBridge.js";
import { applySubstitutions, assertDegree, chordScaleFor, modulateLabels, parseLeadsheet, realizeChord, spellRoot } from "@enkerli/theory";
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
    // Durations follow the leadsheet convention: the chords in a bar divide
    // its beats metrically (3 → half + quarter + quarter). Derived from the
    // count, so inserting/removing a chord re-divides the bar — no overflow.
    const durs = divideBar(bar.chords.length);
    bar.chords.forEach((c, i) => {
      const r = realizeChord(c, key);
      const label = c.source === "degree" && c.degree
        ? c.degree.numeral + c.degree.suffix
        : (c.inputText ?? r.symbol);
      out.push({ ...r, label, voicing: c.voicing, dur: durs[i] });
    });
  }
  return out;
}

const clone = (o) => JSON.parse(JSON.stringify(o));

const TONIC_PC = { C: 0, "C♯": 1, "D♭": 1, D: 2, "D♯": 3, "E♭": 3, E: 4, F: 5, "F♯": 6, "G♭": 6, G: 7, "G♯": 8, "A♭": 8, A: 9, "A♯": 10, "B♭": 10, B: 11 };
// Reharm intensity → substitution probabilities (count-preserving subs only;
// passing-dim insertions would change the slot count, so they stay off here).
const REHARM_LEVELS = { subtle: { tritone: 0.25, backdoor: 0.15 }, bold: { tritone: 0.5, backdoor: 0.35 } };
// Smart (variable-order) context strength: how much to trust the corpus
// trigram distribution over the first-order row when a context exists.
const SMART_LEVELS = { on: 0.6, deep: 1 };
const SHARP = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const midiName = (m) => SHARP[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
const LBL = { display: "grid", gap: 4, fontSize: "var(--es-text-sm)" }; // generator control label

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

/** Build a Progression from generated labels and a bar plan (from rhythmPlan):
 *  each chord-bar takes that many labels, held bars become repeat bars (`%`).
 *  Durations aren't stored — they're derived from each bar's chord count at
 *  realization (chordsFromProgression / divideBar). */
/** Map each label index to its section index, sectioning the bar plan every
 *  `barsPerSection` bars (repeat bars hold no labels). Aligned to the same
 *  label order buildProgression consumes — so it indexes a flat label list. */
function labelSections(plan, barsPerSection) {
  const sec = [];
  let bar = 0;
  for (const p of plan) {
    const s = Math.floor(bar / barsPerSection);
    if (!p.repeat) for (let k = 0; k < p.durs.length; k++) sec.push(s);
    bar++;
  }
  return sec;
}

function buildProgression(labels, plan, key) {
  const bars = [];
  let li = 0;
  for (const p of plan) {
    if (p.repeat) { bars.push({ chords: [], repeat: true }); continue; }
    const chords = [];
    for (let k = 0; k < p.durs.length; k++) {
      const label = labels[li++];
      if (label == null) break;
      const ch = parseLeadsheet(label, key).sections[0]?.bars[0]?.chords[0];
      if (ch) chords.push(ch);
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
function LeadsheetEdit({ progression, activeIndex, onEdit, suggest, onRate, ratingOf, rationaleOf, scaleOf, ratingSignal, tool }) {
  const hostRef = useRef(null);
  const edRef = useRef(null);
  // The editor is built once (remounted via key); read callbacks through refs
  // so the "+" picker, the 👍/👎 controls, and the inspector's "why" always see
  // current state (latched chord, voicings, curation).
  const suggestRef = useRef(suggest); suggestRef.current = suggest;
  const onRateRef = useRef(onRate); onRateRef.current = onRate;
  const ratingOfRef = useRef(ratingOf); ratingOfRef.current = ratingOf;
  const rationaleOfRef = useRef(rationaleOf); rationaleOfRef.current = rationaleOf;
  const scaleOfRef = useRef(scaleOf); scaleOfRef.current = scaleOf;
  useEffect(() => {
    edRef.current = createLeadsheetEditor(hostRef.current, {
      progression: clone(progression),
      showKey: false, // the main UI owns the key
      activeIndex,
      onChange: (prog) => onEdit(clone(prog)),
      suggest: (ctx) => suggestRef.current?.(ctx) ?? [],
      onRate: (i, dir) => onRateRef.current?.(i, dir),
      ratingOf: (i) => ratingOfRef.current?.(i) ?? 1,
      rationaleOf: (i) => rationaleOfRef.current?.(i) ?? null,
      scaleOf: (i) => scaleOfRef.current?.(i) ?? null,
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
  profileSummary,
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

/** A labelled group of generator controls (Step 02 — generator, grouped).
 *  Optionally collapsible (the "Sound · advanced" group defaults closed). */
function GenGroup({ label, hint, children, advanced, open, onToggle }) {
  return (
    <div style={{ border: "1px solid var(--es-border)", borderRadius: "var(--es-radius-sm)", padding: "8px 10px 10px", background: "var(--es-bg-raised)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: (advanced && !open) ? 0 : 6 }}>
        <span className="es-eyebrow">{label}</span>
        {hint && <span style={{ fontSize: "var(--es-text-xs)", color: "var(--es-fg-muted)" }}>{hint}</span>}
        {advanced && <button className="es-btn es-small" style={{ marginLeft: "auto", padding: "0 7px" }}
          aria-expanded={open} aria-label={`${open ? "Hide" : "Show"} ${label}`} onClick={onToggle}>{open ? "▾" : "▸"}</button>}
      </div>
      {(!advanced || open) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--es-space-2)", alignItems: "end" }}>{children}</div>
      )}
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
  const [reharm, setReharm] = useState("off"); // substitution reharm: off | subtle | bold
  const [modulate, setModulate] = useState("off"); // key changes every N bars: off | 4 | 8
  const [smart, setSmart] = useState("off"); // variable-order (trigram) context: off | on | deep
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
  const [soundOpen, setSoundOpen] = useState(false); // "Sound · advanced" generator group
  const fileKindRef = useRef("profile"); // routes a native "fileOpened" to the right loader (profile | patch | midi)
  const [library, setLibrary] = useState(loadLibrary); // the musician's saved progressions
  const [docMeta, setDocMeta] = useState({ title: "", composer: "", source: "generated" }); // current document
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [docError, setDocError] = useState(null);
  const [ghostOpen, setGhostOpen] = useState(false); // ghost chip's inline completions/voicings disclosure
  const [showAllWeights, setShowAllWeights] = useState(false); // full curation ledger (one disclosure away)
  const [voiceLeadMode, setVoiceLeadMode] = useState("strict"); // none | loose | strict
  const [variety, setVariety] = useState("fresh"); // faithful | fresh | bold — de-emphasize repeats/returns/ii-V-I
  const [voicingShape, setVoicingShape] = useState("close"); // close|open|drop2|drop3|spread|rootless|shell
  const [midiChord, setMidiChord] = useState({ notes: [], chord: null, symbol: null }); // live MIDI chord input
  const [latched, setLatched] = useState(null); // { symbol, notes } — last chord played, kept after release
  const { play, stop, playing, playhead } = usePlayer();

  useEffect(() => { saveCuration(curation); }, [curation]);
  useEffect(() => { saveLibrary(library); }, [library]);

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
    // A file chosen via the native picker comes back base64-encoded; decode as
    // UTF-8 (labels carry ♭/♯/→) and route to the loader that asked for it.
    const offFile = bridge.on("fileOpened", (d) => {
      try {
        const bytes = Uint8Array.from(atob(d?.b64 ?? ""), (ch) => ch.charCodeAt(0));
        if (fileKindRef.current === "midi") { receiveMidiBytes(bytes); return; }
        // Text kinds: decode as UTF-8 (labels carry ♭/♯/→).
        const text = new TextDecoder().decode(bytes);
        if (fileKindRef.current === "patch") applyPatchText(text);
        else receiveProfileText(text);
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
  const smartStrength = SMART_LEVELS[smart] ?? 0;
  const labels = useMemo(
    () => generateSections(table[mode], mode,
      { length: chordSlots(rhythm), seed, curation, method, temperature, startFrom, variety, trigrams: trigrams[mode], smart: smartStrength }, extensions),
    [mode, rhythm, seed, curation, method, temperature, startFrom, variety, smartStrength, extensions],
  );
  // Key changes (Track C): every N bars, transpose the section to a corpus-
  // common related key (dominant / subdominant / relative / up-a-step), spelled
  // home — genuine modulation in the chords, single-key storage. Seeded → part
  // of the genId. Runs before reharm so substitutions see the modulated roots.
  const modulatedLabels = useMemo(() => {
    if (modulate === "off") return labels;
    return modulateLabels(labels, labelSections(rhythm, Number(modulate)), mode, seed).labels;
  }, [labels, modulate, rhythm, mode, seed]);
  // Reharm (Track C): probabilistic tritone / backdoor substitutions over the
  // (modulated) labels. Count-preserving (so the rhythm slots still line up) and
  // seeded, so it's deterministic and part of the genId. The curation walk
  // stays on the pre-reharm labels; this is an output transform, like editing.
  const reharmedLabels = useMemo(
    () => (reharm === "off" ? modulatedLabels
      : applySubstitutions(modulatedLabels, { mode, seed, allowInsertions: false, ...REHARM_LEVELS[reharm] }).labels),
    [modulatedLabels, reharm, mode, seed],
  );
  // The progression as an editable theory object: generated by default,
  // overridden when the user hand-edits in the leadsheet editor. Editing
  // flows through to the sheet, playback, and export (the embedded
  // Progression). Regeneration or a key change resets the edits.
  const baseProg = useMemo(
    () => buildProgression(reharmedLabels, rhythm, { tonic, mode }),
    [reharmedLabels, rhythm, tonic, mode],
  );
  // genId changes on any GENERATION op (every param that produces `labels`,
  // plus opCount for extend/clear) — but NOT on an edit. An edit is stamped
  // with the genId it was made under; when that no longer matches, the edit
  // is stale and effectiveProg falls back to the fresh generation. This is
  // synchronous (no post-render effect), so a Generate from a blank sheet
  // shows the new progression immediately, without a Curate/Edit toggle.
  const genId = `${tonic}|${mode}|${seed}|${bars}|${harmonicRhythm}|${temperature}|${method}|${startFrom}|${variety}|${reharm}|${modulate}|${smart}|${opCount}`;
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
  // `o` overrides key/mode for ops that change them in the same tick (loading a
  // progression in a new key) — the setters are async, so we can't read them back.
  const genIdFor = (op, o = {}) =>
    `${o.tonic ?? tonic}|${o.mode ?? mode}|${seed}|${bars}|${harmonicRhythm}|${temperature}|${method}|${startFrom}|${variety}|${reharm}|${modulate}|${smart}|${op}`;

  /** Append a chord into the working progression, filling the last bar to the
   *  current rhythm's density (chords/bar) before starting a new bar.
   *  Durations are derived from the bar's count at realization. */
  function appendChord(prog, ch) {
    if (!prog.sections.length) prog.sections = [{ bars: [] }];
    const barsArr = prog.sections[0].bars;
    const last = barsArr[barsArr.length - 1];
    const perBar = Math.max(1, Math.round(BEATS_PER_BAR / rhythmBeats(harmonicRhythm)));
    if (last && !last.repeat && last.chords.length < perBar) last.chords.push(ch);
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

  /** Lineage for the inspector's "why this chord": ties curation to rationale
   *  (Step 05) — when the move into chord `i` is one you've biased, say so, so
   *  curation and "why this chord" are the same story. Neutral moves return
   *  null (no invented rationale). */
  function chordRationale(i) {
    if (i <= 0 || i >= chords.length) return null;
    const from = functionalOfRealized(chords[i - 1], { tonic, mode });
    const to = functionalOfRealized(chords[i], { tonic, mode });
    if (!from || !to || from === to) return null;
    const mult = multiplierFor(curation, from, to);
    if (mult > 1.001) return `You favor ${from}→${to} — boosted ×${mult.toFixed(2)} in your profile.`;
    if (mult < 0.999) return `You’ve eased off ${from}→${to} — softened ÷${(1 / mult).toFixed(2)} in your profile.`;
    return null;
  }

  // Profile-as-shape (Step 05): the strongest few boosts/suppressions + count.
  const profileShape = useMemo(() => profileSummary(curation, { max: 4 }), [curation]);

  /** Chord-scale line for the inspector (Track C): the scale a player draws on
   *  over chord `i`, and its avoid notes — "Mixolydian · avoid F". */
  function chordScaleText(i) {
    const ch = chords[i];
    if (!ch || ch.rootPc == null || !ch.pcs?.length) return null;
    const cs = chordScaleFor(ch.rootPc, ch.pcs);
    if (!cs) return null;
    const keyPc = TONIC_PC[tonic] ?? 0;
    const avoid = cs.avoid.length ? ` · avoid ${cs.avoid.map((pc) => spellRoot(pc, keyPc)).join(" ")}` : "";
    return `${cs.scaleName}${avoid}`;
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
    fileKindRef.current = "profile";
    if (bridge?.openFile?.("*.json")) return; // arrives via the fileOpened listener
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".json,application/json";
    input.onchange = () => input.files?.[0]?.text().then(receiveProfileText).catch(() => setProfileError("Couldn't read that file."));
    input.click();
  }

  // ── Patches — save/recall a whole generator parameter set (Step 02) ──────
  /** The generator settings (a "patch") — not the document, not the profile. */
  function currentPatch() {
    return { tonic, mode, bars, harmonicRhythm, temperature, variety, reharm, modulate, smart, method, startFrom, voicingShape, voiceLeadMode, channelMode };
  }
  /** Apply a loaded patch's settings (each field validated by its setter). */
  function applyPatchText(text) {
    try {
      const p = JSON.parse(text);
      const s = p && (p.params ?? p); // accept {params:{…}} or a bare settings object
      if (!s || typeof s !== "object") throw new Error("not a patch");
      if (s.tonic) setTonic(s.tonic);
      if (s.mode) setMode(s.mode);
      if (s.bars) setBars(s.bars);
      if (s.harmonicRhythm) setHarmonicRhythm(s.harmonicRhythm);
      if (typeof s.temperature === "number") setTemperature(s.temperature);
      if (s.variety) setVariety(s.variety);
      if (s.reharm) setReharm(s.reharm);
      if (s.modulate) setModulate(s.modulate);
      if (s.smart) setSmart(s.smart);
      if (s.method) setMethod(s.method);
      setStartFrom(s.startFrom ?? null);
      if (s.voicingShape) setVoicingShape(s.voicingShape);
      if (s.voiceLeadMode) setVoiceLeadMode(s.voiceLeadMode);
      if (s.channelMode) setChannelMode(s.channelMode);
      setProfileError(null);
    } catch { setProfileError("That file isn't a generator patch."); }
  }
  function savePatch() {
    const savedAt = new Date().toISOString();
    const filename = `proggenie-patch-${savedAt.slice(0, 16).replace(/[:T]/g, "-")}.json`;
    const bytes = new TextEncoder().encode(JSON.stringify({ format: "proggenie-patch", version: 1, savedAt, params: currentPatch() }, null, 2));
    if (bridge?.saveFile?.(filename, bytes)) return;
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }
  function loadPatch() {
    setProfileError(null);
    fileKindRef.current = "patch";
    if (bridge?.openFile?.("*.json")) return;
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".json,application/json";
    input.onchange = () => input.files?.[0]?.text().then(applyPatchText).catch(() => setProfileError("Couldn't read that file."));
    input.click();
  }

  // ── Library & import — the progression as a document (Step 03) ───────────
  // Four front doors: New (Blank) · Generate (New take) · Open (library) ·
  // Import (paste bar notation / open .mid). The library holds only the
  // musician's OWN saved progressions; the corpus is never browsable here.

  /** Make `prog` the working document: adopt its key, stamp it as the current
   *  edit (with the new key baked into the genId so it doesn't read stale),
   *  and record where it came from for the source badge. */
  function loadProgression(prog, meta = {}) {
    const k = prog?.key ?? { tonic, mode };
    const nextTonic = k.tonic ?? tonic;
    const nextMode = k.mode ?? mode;
    if (nextTonic !== tonic) setTonic(nextTonic);
    if (nextMode !== mode) setMode(nextMode);
    setEdited({ genId: genIdFor(opCount + 1, { tonic: nextTonic, mode: nextMode }), prog });
    setOpCount((n) => n + 1);
    setDocMeta({ title: meta.title ?? "", composer: meta.composer ?? "", source: meta.source ?? "loaded" });
    setDocError(null);
    setImportOpen(false);
    setLibraryOpen(false);
  }

  /** Bars in the working progression (counts %-held bars). */
  const docBarCount = effectiveProg.sections.reduce((n, s) => n + s.bars.length, 0);

  /** Save the current document into the library (a snapshot — later edits make
   *  a new entry unless you overwrite by title). */
  function saveToLibrary() {
    const title = (docMeta.title || "").trim() || "Untitled progression";
    const entry = {
      id: newId(), title, composer: (docMeta.composer || "").trim(),
      source: docMeta.source || "edited", savedAt: new Date().toISOString(),
      key: `${tonic} ${mode}`, bars: docBarCount, prog: clone(effectiveProg),
    };
    setLibrary((list) => [entry, ...list]);
    setDocMeta((m) => ({ ...m, title, source: "saved" }));
  }

  /** Recall a saved progression as the working document. */
  function openFromLibrary(entry) {
    loadProgression(clone(entry.prog), { title: entry.title, composer: entry.composer, source: "library" });
  }
  function deleteFromLibrary(id) {
    setLibrary((list) => list.filter((e) => e.id !== id));
  }

  /** Import pasted single-line bar notation (e.g. "Dm7 G7 | Cmaj7") as the
   *  working document, realized in the current key. */
  function importPaste() {
    const text = (pasteText || "").trim();
    if (!text) { setDocError("Paste a line of chords first (e.g. Dm7 G7 | Cmaj7)."); return; }
    const prog = parseLeadsheet(text, { tonic, mode });
    const any = prog?.sections?.some((s) => s.bars.some((b) => b.chords?.length));
    if (!any) { setDocError("Couldn't read any chords from that line."); return; }
    loadProgression(prog, { source: "imported" });
    setPasteText("");
  }

  /** Decode a Standard MIDI File's bytes into a progression (reads the embedded
   *  canonical Progression when present; otherwise infers from the notes). */
  function receiveMidiBytes(bytes) {
    const prog = progressionFromSMF(bytes);
    if (!prog) { setDocError("That .mid file doesn't carry a readable progression."); return; }
    loadProgression(prog, { source: "midi" });
  }

  /** Open a .mid file (native picker in-plugin → on("fileOpened"); <input> in
   *  the browser). */
  function importMidi() {
    setDocError(null);
    fileKindRef.current = "midi";
    if (bridge?.openFile?.("*.mid")) return; // arrives via the fileOpened listener
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".mid,.midi,audio/midi";
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return;
      f.arrayBuffer().then((buf) => receiveMidiBytes(new Uint8Array(buf)))
        .catch(() => setDocError("Couldn't read that file."));
    };
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

        {/* Document strip — the progression as a document: who it is, where it
            came from, and the four front doors (New · Generate · Open · Import). */}
        <div className="es-panel" style={{ marginBottom: "var(--es-space-3)" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--es-space-2)", alignItems: "flex-end" }}>
            <label style={LBL}>Title
              <input className="es-control" style={{ minWidth: 180 }} placeholder="Untitled progression"
                value={docMeta.title} onChange={(e) => setDocMeta((m) => ({ ...m, title: e.target.value }))} />
            </label>
            <label style={LBL}>Composer
              <input className="es-control" style={{ minWidth: 140 }} placeholder="—"
                value={docMeta.composer} onChange={(e) => setDocMeta((m) => ({ ...m, composer: e.target.value }))} />
            </label>
            <span className="es-badge" title="Where this progression came from"
              style={{ alignSelf: "center" }}>{docMeta.source} · {tonic} {mode} · {docBarCount} bar{docBarCount === 1 ? "" : "s"}</span>
            <span style={{ flex: 1 }} />
            <button className="es-btn es-small" title="Blank the sheet — start a new progression from scratch"
              onClick={() => { handleClear(); setDocMeta({ title: "", composer: "", source: "new" }); }}>New</button>
            <button className="es-btn es-small" title="Recall a saved progression" aria-pressed={libraryOpen}
              onClick={() => { setLibraryOpen((o) => !o); setImportOpen(false); }}>Open…{library.length ? ` (${library.length})` : ""}</button>
            <button className="es-btn es-small" title="Paste bar notation or open a .mid file" aria-pressed={importOpen}
              onClick={() => { setImportOpen((o) => !o); setLibraryOpen(false); }}>Import…</button>
            <button className="es-btn es-small es-primary" title="Save this progression to your library" onClick={saveToLibrary}>Save to library</button>
          </div>
          {docError && <p style={{ color: "var(--es-danger, #b3261e)", fontSize: "var(--es-text-sm)", margin: "var(--es-space-2) 0 0" }}>{docError}</p>}

          {importOpen && (
            <div style={{ marginTop: "var(--es-space-3)", paddingTop: "var(--es-space-3)", borderTop: "1px solid var(--es-border)" }}>
              <label style={{ ...LBL, width: "100%" }}>Paste a progression (one line; bars split on <code>|</code>, repeat with <code>%</code>)
                <textarea className="es-control" rows={2} style={{ width: "100%", fontFamily: "var(--es-font-mono, monospace)" }}
                  placeholder="Dm7 G7 | Cmaj7 | A7 | Dm7"
                  value={pasteText} onChange={(e) => setPasteText(e.target.value)} />
              </label>
              <div style={{ display: "flex", gap: "var(--es-space-2)", marginTop: "var(--es-space-2)" }}>
                <button className="es-btn es-small es-primary" onClick={importPaste}>Use pasted chords</button>
                <button className="es-btn es-small" title="Open a Standard MIDI File" onClick={importMidi}>Open .mid…</button>
                <span style={{ fontSize: "var(--es-text-xs)", color: "var(--es-fg-muted)", alignSelf: "center" }}>
                  realized in {tonic} {mode}
                </span>
              </div>
            </div>
          )}

          {libraryOpen && (
            <div style={{ marginTop: "var(--es-space-3)", paddingTop: "var(--es-space-3)", borderTop: "1px solid var(--es-border)" }}>
              {library.length === 0
                ? <p style={{ color: "var(--es-fg-muted)", fontSize: "var(--es-text-sm)", margin: 0 }}>
                    No saved progressions yet. Save the current one to start your library.
                  </p>
                : <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                    {library.map((e) => (
                      <li key={e.id} style={{ display: "flex", gap: "var(--es-space-2)", alignItems: "center" }}>
                        <button className="es-btn es-small" style={{ flex: 1, justifyContent: "flex-start", textAlign: "left" }}
                          title="Open this progression" onClick={() => openFromLibrary(e)}>
                          <strong>{e.title}</strong>
                          <span style={{ color: "var(--es-fg-muted)", marginLeft: 8, fontSize: "var(--es-text-xs)" }}>
                            {e.composer ? `${e.composer} · ` : ""}{e.key} · {e.bars} bar{e.bars === 1 ? "" : "s"} · {e.source}
                          </span>
                        </button>
                        <button className="es-btn es-small" aria-label={`Delete ${e.title}`} title="Remove from library"
                          onClick={() => deleteFromLibrary(e.id)}>✕</button>
                      </li>
                    ))}
                  </ul>}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--es-space-3)", alignItems: "stretch", marginBottom: "var(--es-space-3)" }}>
          <GenGroup label="Tune">
            <label style={LBL}>Key
              <select className="es-control" value={tonic} onChange={(e) => setTonic(e.target.value)}>
                {ROOTS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <label style={LBL}>Mode
              <select className="es-control" value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="major">major</option>
                <option value="minor">minor</option>
              </select>
            </label>
            <label style={LBL}>Bars
              <select className="es-control" value={bars} onChange={(e) => setBars(Number(e.target.value))}>
                {[2, 4, 8, 12, 16, 24, 32].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label style={LBL}>Harmonic rhythm
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
          </GenGroup>

          <GenGroup label="Adventurousness">
            <label style={LBL}>
              Surprise <span className="es-num">{temperature.toFixed(2)}</span>
              <input type="range" min="0" max="100" style={{ width: 110, minHeight: "var(--es-ctl-h)" }}
                title="How unusual each move is — how far down a transition's probability list the walk reaches"
                aria-label="Surprise: higher surfaces more unusual transitions"
                value={Math.round(50 + 50 * Math.log(temperature) / Math.log(4))}
                onChange={(e) => setTemperature(Number((4 ** ((Number(e.target.value) - 50) / 50)).toFixed(2)))}
              />
            </label>
            <label style={LBL}>Freshness
              <select className="es-control" value={variety} onChange={(e) => setVariety(e.target.value)}
                title="How hard to avoid clichés: repeats (X→X), quick returns (X→Y→X), and V→I cadences">
                <option value="faithful">faithful</option>
                <option value="fresh">fresh</option>
                <option value="bold">bold</option>
              </select>
            </label>
          </GenGroup>

          <GenGroup label="Source">
            <label style={LBL}>Engine
              <select className="es-control" value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="markov">corpus walk</option>
                <option value="markov-cadence">corpus walk + cadence</option>
                <option value="circle">circle of fifths</option>
              </select>
            </label>
            <label style={LBL}>Context
              <select className="es-control" value={smart} onChange={(e) => setSmart(e.target.value)}
                title="Variable-order: where the corpus knows what tends to follow a two-chord context, lean on it (longer-range phrasing)">
                <option value="off">1 chord</option>
                <option value="on">2 chords</option>
                <option value="deep">2 chords (deep)</option>
              </select>
            </label>
            <label style={LBL}>Start from
              <select className="es-control" value={startFrom ?? ""} title="Seed the walk from an arbitrary chord"
                onChange={(e) => setStartFrom(e.target.value || null)}>
                <option value="">tonic (auto)</option>
                {startOptions.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </label>
            <label style={LBL}>Reharm
              <select className="es-control" value={reharm} onChange={(e) => setReharm(e.target.value)}
                title="Probabilistic substitutions: tritone (♭II7 for V7) and backdoor (♭VII7) dominants">
                <option value="off">off</option>
                <option value="subtle">subtle</option>
                <option value="bold">bold</option>
              </select>
            </label>
            <label style={LBL}>Modulation
              <select className="es-control" value={modulate} onChange={(e) => setModulate(e.target.value)}
                title="Change key every N bars to a corpus-common related key (dominant / subdominant / relative / up-a-step)">
                <option value="off">none</option>
                <option value="4">every 4 bars</option>
                <option value="8">every 8 bars</option>
              </select>
            </label>
          </GenGroup>

          <GenGroup label="Sound" advanced open={soundOpen} onToggle={() => setSoundOpen((o) => !o)}>
            <label style={LBL}>Voicing
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
            <label style={LBL}>Voice leading
              <select className="es-control" value={voiceLeadMode} onChange={(e) => setVoiceLeadMode(e.target.value)}
                title="none: home shapes · loose: nudged to the nearest register · strict: minimal taxicab motion">
                <option value="none">none</option>
                <option value="loose">loose</option>
                <option value="strict">strict</option>
              </select>
            </label>
            <label style={LBL}>Channels
              <select className="es-control" value={channelMode} onChange={(e) => setChannelMode(e.target.value)}
                title="Route bass and voices to separate MIDI channels">
                <option value="single">single (1)</option>
                <option value="split">bass 1 · chords 2</option>
                <option value="perVoice">per voice (1…)</option>
              </select>
            </label>
          </GenGroup>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--es-space-2)", alignItems: "center", marginBottom: "var(--es-space-4)" }}>
          <button className="es-btn es-primary" title="Re-roll the walk — settings already apply live as you adjust them"
            onClick={() => { setSeed((s) => s + 1); setExtensions([]); }}>New take</button>
          <span style={{ fontSize: "var(--es-text-xs)", color: "var(--es-fg-muted)" }}>updates as you adjust</span>
          <button className="es-btn" title="Append a continuation from the last chord (works from a typed chord, too)" onClick={handleExtend}>+ Extend</button>
          <button className="es-btn" title="Clear the leadsheet — start from scratch" onClick={handleClear}>Blank</button>
          <span style={{ alignSelf: "stretch", width: 1, background: "var(--es-border)", margin: "0 4px" }} />
          <span className="es-eyebrow">patch</span>
          <button className="es-btn es-small" title="Save these generator settings to a file" onClick={savePatch}>Save…</button>
          <button className="es-btn es-small" title="Recall generator settings from a file" onClick={loadPatch}>Load…</button>
          {profileError && <span style={{ color: "var(--es-danger, #b3261e)", fontSize: "var(--es-text-sm)" }}>{profileError}</span>}
          <span style={{ flex: 1 }} />
          {!IN_PLUGIN && <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: "var(--es-text-sm)" }}>Tempo
            <input className="es-control" style={{ width: 64 }} type="number" min="40" max="300" value={bpm} onChange={(e) => setBpm(Number(e.target.value))} />
          </label>}
          {!IN_PLUGIN && <button className="es-btn es-primary" onClick={() => (playing ? stop() : play(voicings, bpm))}>{playing ? "Stop" : "Play"}</button>}
          <button className="es-btn" onClick={() => navigator.clipboard?.writeText(chords.map((c) => c.symbol).join(" | "))}>Copy chords</button>
          {/* Where the document travels — name the destination, not the file
              format (Step 06). Both routes write the same SMF (it embeds the
              canonical Progression), through the one native save/share path. */}
          <span style={{ display: "inline-flex", flexDirection: "column", gap: 2 }}>
            <span style={{ display: "flex", gap: "var(--es-space-2)", alignItems: "center" }}>
              <button className="es-btn es-primary" title="Save a leadsheet-bearing MIDI file to hand to MIDIcurator (open it there — the suite reads the progression back)"
                onClick={() => exportProgression(bridge, voicings, { bpm, tonic, mode, seed, channelMode, title: docMeta.title, destination: "midicurator" })}>
                Send to MIDIcurator
              </button>
              <button className="es-btn es-small" title="Save as a plain Standard MIDI File (chord symbols as markers)"
                onClick={() => exportProgression(bridge, voicings, { bpm, tonic, mode, seed, channelMode, title: docMeta.title })}>
                Export MIDI file
              </button>
            </span>
            <span style={{ fontSize: "var(--es-text-xs)", color: "var(--es-fg-muted)" }}>carries the shared leadsheet — the suite can read it back</span>
          </span>
          <button className="es-btn" aria-label="Toggle color theme" title="Light is the house default; dark is one tap away"
            onClick={() => setThemeState(toggleTheme())}>{theme === "dark" ? "☀︎ Light" : "● Dark"}</button>
        </div>

        <div className="es-panel">
          <div style={{ display: "flex", gap: "var(--es-space-2)", alignItems: "center", marginBottom: "var(--es-space-3)" }}>
            <div role="toolbar" aria-label="Leadsheet tool" style={{ display: "flex", gap: 4 }}>
              {[
                { id: "edit", label: "✏️ Edit", hint: "Tap a chord to open it · tap a caret to insert · grip to move" },
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
              {tool === "edit" ? "tap a chord to open it · carets insert · grip moves"
                : "tap chords to rate the move into each"}
            </span>
          </div>
          <LeadsheetEdit key={genId} progression={effectiveProg} activeIndex={playIdx}
            onEdit={(p) => setEdited({ genId, prog: p })} suggest={suggestNext}
            onRate={rateIncoming} ratingOf={incomingRating} rationaleOf={chordRationale}
            scaleOf={chordScaleText} ratingSignal={curation} tool={tool} />

          {/* Ghost chip — live MIDI writes into the document at a write cursor
              (the end of the sheet). The held chord shows here as a pending
              cell; Add commits it (locking the voicing as played) and advances
              the cursor. Completions and alternate voicings hang off it as an
              inline disclosure, at the point of action (Step 04). */}
          {IN_PLUGIN && latched && (
            <div className="es-ls-ghost" role="group" aria-label="Held MIDI chord — ready to write">
              <div style={{ display: "flex", alignItems: "center", gap: "var(--es-space-2)", flexWrap: "wrap" }}>
                <span className="es-eyebrow" title="Where the held chord will land">writes here →</span>
                <span className="es-ls-ghost-chip">
                  <strong>{latched.symbol}</strong>
                  <span className="es-num" style={{ color: "var(--es-fg-muted)", fontSize: "var(--es-text-xs)", marginLeft: 6 }}>
                    {latched.notes.map((n) => midiName(n)).join(" ")}
                  </span>
                </span>
                {midiChord.notes.length === 0 && <span className="es-badge" title="held after you release the keys">held</span>}
                <button className="es-btn es-small es-primary" onClick={() => { insertMidiChord(); setGhostOpen(false); }}
                  title="Write into the leadsheet, locking the voicing as played, and advance">Add</button>
                <button className="es-btn es-small" onClick={() => { setLatched(null); setGhostOpen(false); }} title="Forget the held chord">Clear</button>
                {(completions.length > 0 || playedVoicings.length > 0) && (
                  <button className="es-btn es-small" aria-expanded={ghostOpen} onClick={() => setGhostOpen((o) => !o)}
                    title="Completions and alternate voicings">{ghostOpen ? "options ▾" : "options ▸"}</button>
                )}
              </div>
              {ghostOpen && (
                <div style={{ marginTop: "var(--es-space-2)", display: "flex", flexDirection: "column", gap: "var(--es-space-2)" }}>
                  {completions.length > 0 && (
                    <div>
                      <div className="es-eyebrow">complete to a common chord (add one tone)</div>
                      {completions.map((s, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: "var(--es-space-2)", marginTop: 2 }}>
                          <span style={{ width: 110, fontWeight: 600 }}>{s.symbol}</span>
                          <span className="es-num" style={{ flex: 1, color: "var(--es-fg-muted)", fontSize: "var(--es-text-sm)" }}>+ {midiName(s.added)}</span>
                          <button className="es-btn es-small" onClick={() => { insertCompletion(s); setGhostOpen(false); }}>Add</button>
                        </div>
                      ))}
                    </div>
                  )}
                  {playedVoicings.length > 0 && (
                    <div>
                      <div className="es-eyebrow">other voicings — smoothest from the last chord first</div>
                      {playedVoicings.map((s, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: "var(--es-space-2)", marginTop: 2 }}>
                          <span style={{ width: 72, color: "var(--es-fg-2)", fontSize: "var(--es-text-sm)" }}>{s.label}</span>
                          <span className="es-num" style={{ flex: 1, color: "var(--es-fg-muted)", fontSize: "var(--es-text-sm)" }}>{s.notes.map((n) => midiName(n)).join(" ")}</span>
                          <span className="es-badge" title="total semitones of voice movement from the last chord">{s.movement} st</span>
                          <button className="es-btn es-small" onClick={() => { insertMidiChord(s.notes); setGhostOpen(false); }}>Add</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

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

        {/* MIDI input is now a status line — the building happens at the ghost
            chip in the document (Step 04). This reports routing and what's
            latched/listening, not a second place to add chords. */}
        {IN_PLUGIN && (
          <div className="es-statusline" style={{ marginTop: "var(--es-space-3)" }}>
            <span className="es-eyebrow">MIDI in</span>
            <span className="es-badge" title="MIDI channel routing for export/playback">{channelMode}</span>
            {latched
              ? <span style={{ color: "var(--es-fg-muted)", fontSize: "var(--es-text-sm)" }}>
                  held <strong style={{ color: "var(--es-fg)" }}>{latched.symbol}</strong> — write it at the cursor above
                </span>
              : midiChord.notes.length > 0
                ? <span style={{ color: "var(--es-accent)", fontSize: "var(--es-text-sm)" }}>listening · {midiChord.symbol ?? "…"}</span>
                : <span style={{ color: "var(--es-fg-muted)", fontSize: "var(--es-text-sm)" }}>play a chord on a routed MIDI keyboard — it's identified, held, and ready to write into the sheet</span>}
          </div>
        )}


        {showCuration && (
          <div className="es-panel" style={{ marginTop: "var(--es-space-3)" }}>
            {/* Profile-as-shape (Step 05): your taste shown as its strongest few
                boosts and suppressions, not a weight ledger. The full table is
                one disclosure away. */}
            <div style={{ display: "flex", alignItems: "baseline", gap: "var(--es-space-2)", flexWrap: "wrap" }}>
              <h2 style={{ fontSize: "var(--es-text-md)", margin: "0 0 var(--es-space-2)" }}>Your profile</h2>
              <span style={{ color: "var(--es-fg-muted)", fontSize: "var(--es-text-sm)" }}>
                {profileShape.count === 0 ? "no taste tweaks yet" : `${profileShape.count} tuned transition${profileShape.count === 1 ? "" : "s"}`}
              </span>
            </div>
            {profileShape.count === 0 ? (
              <p style={{ color: "var(--es-fg-muted)", fontSize: "var(--es-text-sm)", margin: "0 0 var(--es-space-3)" }}>
                Rate chords (👍/👎 in the editor) or whole takes to shape what the generator and the MIDI picker favor. Your strongest leanings show up here.
              </p>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--es-space-3)", marginBottom: "var(--es-space-3)" }}>
                {profileShape.boosts.length > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span className="es-eyebrow">favors</span>
                    {profileShape.boosts.map(([key, v]) => (
                      <span key={key} className="es-badge es-up" title={`boosted ×${v.toFixed(2)}`}>{key} ×{v.toFixed(1)}</span>
                    ))}
                  </div>
                )}
                {profileShape.suppressions.length > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span className="es-eyebrow">eases off</span>
                    {profileShape.suppressions.map(([key, v]) => (
                      <span key={key} className="es-badge" title={`softened ÷${(1 / v).toFixed(2)}`}>{key} ÷{(1 / v).toFixed(1)}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

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
                <button className="es-btn es-small" style={{ marginTop: "var(--es-space-4)" }}
                  aria-expanded={showAllWeights} onClick={() => setShowAllWeights((s) => !s)}>
                  {showAllWeights ? "Hide all weights ▾" : `All weights (${curatedEntries.length}) ▸`}
                </button>
                {showAllWeights && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "var(--es-space-2)", marginTop: "var(--es-space-2)" }}>
                    {curatedEntries.map(([key, value]) => (
                      <div key={key} style={{ display: "flex", alignItems: "center", gap: "var(--es-space-2)", fontSize: "var(--es-text-sm)" }}>
                        <span className="es-num" style={{ flex: 1 }}>{key}</span>
                        <MultiplierBadge value={value} />
                        <button className="es-btn es-small" aria-label={`Reset ${key}`} title="Reset to corpus weight"
                          onClick={() => setCuration((c) => resetTransition(c, key))}>↺</button>
                      </div>
                    ))}
                  </div>
                )}
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
