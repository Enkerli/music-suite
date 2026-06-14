import React, { useEffect, useMemo, useRef, useState } from "react";
import table from "./data/transitions.json";
import { generateLabels, generateSections, labelMass, startLabel, voiceProgression } from "./generate.js";
import { exportProgression, voicingsToClip } from "./exportMidi.js";
import { createBridge } from "./juceBridge.js";
import { parseLeadsheet, realizeChord } from "@enkerli/theory";
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
      out.push({ ...r, label });
    }
  }
  return out;
}

const clone = (o) => JSON.parse(JSON.stringify(o));

const SHARP = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const midiName = (m) => SHARP[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);

/** Generated labels → bar-notation text, CHORDS_PER_BAR per bar (the
 *  generation plays 2 beats/chord, i.e. 2 chords per 4/4 bar — so the
 *  editable/curatable leadsheet matches what's heard and exported). */
const CHORDS_PER_BAR = 2;
function labelsToBars(labels, perBar = CHORDS_PER_BAR) {
  const bars = [];
  for (let i = 0; i < labels.length; i += perBar) bars.push(labels.slice(i, i + perBar).join(" "));
  return bars.join(" | ");
}

/** Editable leadsheet — the shared @enkerli/ui editor, the primary surface.
 *  Mounts once; the caller forces a remount (via React key) on external
 *  ops (generate/extend/clear/key change) so internal edits don't reset it.
 *  activeIndex drives the chord-follow highlight without remounting. */
function LeadsheetEdit({ progression, activeIndex, onEdit }) {
  const hostRef = useRef(null);
  const edRef = useRef(null);
  useEffect(() => {
    edRef.current = createLeadsheetEditor(hostRef.current, {
      progression: clone(progression),
      showKey: false, // the main UI owns the key
      activeIndex,
      onChange: (prog) => onEdit(clone(prog)),
    });
    return () => edRef.current.destroy();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- remount via key
  useEffect(() => { edRef.current?.update({ activeIndex }); }, [activeIndex]);
  return <div ref={hostRef} />;
}

// Module singleton: detected once, same UI runs in browser and plugin.
const bridge = createBridge();
const IN_PLUGIN = bridge.kind === "juce";
import {
  adjustTransition,
  exportCuration,
  rateGesture,
  importCuration,
  loadCuration,
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
    const barDur = 2 * beat;
    const t0 = ctx.currentTime + 0.05;
    const nodes = [];
    const timers = [];

    voicings.forEach((v, i) => {
      const start = t0 + i * barDur;
      for (const midi of [v.bass, ...v.notes]) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.value = 440 * 2 ** ((midi - 69) / 12);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(midi === v.bass ? 0.12 : 0.07, start + 0.02);
        gain.gain.setTargetAtTime(0, start + barDur - 0.15, 0.05);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + barDur);
        nodes.push(osc);
      }
      timers.push(setTimeout(() => setPlayhead(i), (start - ctx.currentTime) * 1000));
    });
    timers.push(setTimeout(() => { setPlaying(false); setPlayhead(-1); }, (t0 - ctx.currentTime + voicings.length * barDur) * 1000));

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
  const [length, setLength] = useState(16);
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
  const [startFrom, setStartFrom] = useState(null);
  const [extensions, setExtensions] = useState([]);
  const [gestureAnchor, setGestureAnchor] = useState(null);
  const [gestureRange, setGestureRange] = useState(null); // [from, to] indices
  const [surfaceMode, setSurfaceMode] = useState("edit"); // "edit" | "curate"
  const [opCount, setOpCount] = useState(0); // bumps on extend/clear (forces editor remount)
  const [voiceLead, setVoiceLead] = useState(true); // taxicab smoothing on/off
  const [voicingShape, setVoicingShape] = useState("close"); // close|open|drop2|shell
  const [midiChord, setMidiChord] = useState({ notes: [], chord: null }); // MIDI chord input
  const { play, stop, playing, playhead } = usePlayer();

  useEffect(() => { saveCuration(curation); }, [curation]);

  // Plugin integration: host transport display + session-state restore.
  useEffect(() => {
    if (!IN_PLUGIN) return;
    const offTransport = bridge.on("transport", (t) => {
      setHost({ playing: !!t.playing, bpm: t.bpm || 0 });
      // Chord-follow: the scheduler reports its clip-relative beat;
      // 2 beats per chord (voicingsToClip's grid).
      setHostPlayhead(t.playing && t.beat >= 0 ? Math.floor(t.beat / 2) : -1);
      setHostBeat(t.playing && t.beat >= 0 ? t.beat : -1);
    });
    const offRuntime = bridge.on("runtime", setRuntime);
    const offState = bridge.on("state", (s) => {
      try {
        if (s.tonic) setTonic(s.tonic);
        if (s.mode) setMode(s.mode);
        if (s.length) setLength(s.length);
        if (s.seed !== undefined) setSeed(s.seed);
        if (s.method) setMethod(s.method);
        if (s.curation && typeof s.curation.multipliers === "object") setCuration(s.curation);
        if (typeof s.temperature === "number") setTemperature(s.temperature);
        if (s.channelMode) setChannelMode(s.channelMode);
        if (s.startFrom !== undefined) setStartFrom(s.startFrom);
        if (Array.isArray(s.extensions)) setExtensions(s.extensions);
        if (typeof s.voiceLead === "boolean") setVoiceLead(s.voiceLead);
        if (s.voicingShape) setVoicingShape(s.voicingShape);
      } catch { /* malformed saved state — keep defaults */ }
    });
    bridge.ready();
    return () => { offTransport(); offRuntime(); offState(); };
  }, []);

  // MIDI chord input (ChordID): the processor forwards played notes; we
  // track the held set and detect the chord. Plugin-only (the browser has
  // no bridge MIDI yet — a WebMIDI feed could fill the same shape later).
  useEffect(() => {
    if (!IN_PLUGIN) return;
    const ci = createChordInput(bridge, { onUpdate: setMidiChord });
    return () => ci.stop();
  }, []);

  const labels = useMemo(
    () => generateSections(table[mode], mode,
      { length, seed, curation, method, temperature, startFrom }, extensions),
    [mode, length, seed, curation, method, temperature, startFrom, extensions],
  );
  // The progression as an editable theory object: generated by default,
  // overridden when the user hand-edits in the leadsheet editor. Editing
  // flows through to the sheet, playback, and export (the embedded
  // Progression). Regeneration or a key change resets the edits.
  const baseProg = useMemo(
    () => parseLeadsheet(labelsToBars(labels), { tonic, mode }),
    [labels, tonic, mode],
  );
  // genId changes on any GENERATION op (every param that produces `labels`,
  // plus opCount for extend/clear) — but NOT on an edit. An edit is stamped
  // with the genId it was made under; when that no longer matches, the edit
  // is stale and effectiveProg falls back to the fresh generation. This is
  // synchronous (no post-render effect), so a Generate from a blank sheet
  // shows the new progression immediately, without a Curate/Edit toggle.
  const genId = `${tonic}|${mode}|${seed}|${length}|${temperature}|${method}|${startFrom}|${opCount}`;
  const [edited, setEdited] = useState(null); // { genId, prog } | null
  const effectiveProg = edited && edited.genId === genId ? edited.prog : baseProg;
  const chords = useMemo(
    () => chordsFromProgression(effectiveProg, { tonic, mode }),
    [effectiveProg, tonic, mode],
  );
  const voicings = useMemo(
    () => voiceProgression(chords, { voiceLead, shape: voicingShape }),
    [chords, voiceLead, voicingShape],
  );

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
    bridge.send("enkerliState", { tonic, mode, length, seed, method, curation, temperature, channelMode, startFrom, extensions, voiceLead, voicingShape });
  }, [voicings, tonic, mode, length, seed, method, curation, temperature, channelMode, startFrom, extensions, voiceLead, voicingShape]);

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
  // The genId an op produces (only opCount changes for extend/clear/reset).
  const genIdFor = (op) => `${tonic}|${mode}|${seed}|${length}|${temperature}|${method}|${startFrom}|${op}`;

  /** Append a chord into the working progression, keeping CHORDS_PER_BAR
   *  per bar (fill the last bar, then start new ones). */
  function appendChord(prog, ch) {
    if (!prog.sections.length) prog.sections = [{ bars: [] }];
    const bars = prog.sections[0].bars;
    const last = bars[bars.length - 1];
    if (last && !last.repeat && last.chords.length < CHORDS_PER_BAR) last.chords.push(ch);
    else bars.push({ chords: [ch] });
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

  /** Insert the chord currently played on MIDI into the leadsheet (ChordID).
   *  The played chord is absolute (its actual spelling), appended to the end. */
  function insertMidiChord() {
    if (!midiChord.chord) return;
    const ch = parseLeadsheet(midiChord.chord.symbol, { tonic, mode }).sections[0]?.bars[0]?.chords[0];
    if (!ch) return;
    const next = clone(effectiveProg);
    appendChord(next, ch);
    setEdited({ genId: genIdFor(opCount + 1), prog: next });
    setOpCount((n) => n + 1);
    setSurfaceMode("edit");
  }

  /** Blank the leadsheet — start from scratch (type a chord, then Extend). */
  function handleClear() {
    setEdited({ genId: genIdFor(opCount + 1), prog: { key: { tonic, mode }, sections: [{ bars: [] }] } });
    setSurfaceMode("edit");
    setOpCount((n) => n + 1);
  }

  function importProfile() {
    const json = window.prompt("Paste a curation profile (JSON):");
    if (!json) return;
    try {
      setCuration(importCuration(json));
    } catch {
      window.alert("That doesn't look like a curation profile.");
    }
  }

  const rows = [];
  for (let i = 0; i < chords.length; i += 4) rows.push(chords.slice(i, i + 4));

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
              <option value="shell">shell (3rd+7th)</option>
            </select>
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: "var(--es-text-sm)", minHeight: "var(--es-ctl-h)" }}
            title="Taxicab voice leading: smooth each chord from the previous, or voice each in its home position">
            <input type="checkbox" checked={voiceLead} onChange={(e) => setVoiceLead(e.target.checked)} />
            voice-lead
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: "var(--es-text-sm)" }}>Chords
            <select className="es-control" value={length} onChange={(e) => setLength(Number(e.target.value))}>
              {[8, 12, 16, 24, 32].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          {!IN_PLUGIN && <label style={{ display: "grid", gap: 4, fontSize: "var(--es-text-sm)" }}>Tempo
            <input className="es-control" style={{ width: 72 }} type="number" min="40" max="300" value={bpm} onChange={(e) => setBpm(Number(e.target.value))} />
          </label>}
          <button className="es-btn" onClick={() => { setSeed((s) => s + 1); setExtensions([]); setGestureAnchor(null); setGestureRange(null); }}>
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
            <div role="tablist" aria-label="Leadsheet surface" style={{ display: "flex", gap: 4 }}>
              <button className={`es-btn es-small ${surfaceMode === "edit" ? "es-primary" : ""}`} aria-pressed={surfaceMode === "edit"} onClick={() => setSurfaceMode("edit")}>Edit</button>
              <button className={`es-btn es-small ${surfaceMode === "curate" ? "es-primary" : ""}`} aria-pressed={surfaceMode === "curate"} onClick={() => setSurfaceMode("curate")}>Curate</button>
            </div>
            {edited && edited.genId === genId && <span style={{ color: "var(--es-accent)", fontSize: "var(--es-text-sm)" }}>· edited</span>}
            {edited && edited.genId === genId && <button className="es-btn es-small" onClick={() => { setEdited(null); setOpCount((n) => n + 1); }}>Reset to generated</button>}
            <span style={{ marginLeft: "auto", color: "var(--es-fg-muted)", fontSize: "var(--es-text-sm)" }}>
              {surfaceMode === "edit" ? "click a chord to retype · Roman (IIm7) or absolute (Dm7)" : "tap a chord for stats · tap 2 apart to rate a gesture"}
            </span>
          </div>
          {surfaceMode === "edit" ? (
            <LeadsheetEdit key={genId} progression={effectiveProg} activeIndex={playIdx} onEdit={(p) => setEdited({ genId, prog: p })} />
          ) : (
          rows.map((row, ri) => (
            <div key={ri} style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--es-space-2)", marginBottom: ri < rows.length - 1 ? "var(--es-space-3)" : 0 }}>
              {row.map((c, ci) => {
                const idx = ri * 4 + ci;
                const active = idx === (IN_PLUGIN ? hostPlayhead : playhead);
                const inRange = gestureRange && idx >= gestureRange[0] && idx <= gestureRange[1];
                const isAnchor = gestureAnchor === idx && !gestureRange;
                return (
                  <div key={idx} role="button" tabIndex={0}
                    onClick={() => {
                      setStatsLabel(c.label);
                      if (gestureAnchor === null || gestureRange) { setGestureAnchor(idx); setGestureRange(null); }
                      else if (Math.abs(idx - gestureAnchor) >= 2) { setGestureRange([Math.min(gestureAnchor, idx), Math.max(gestureAnchor, idx)]); }
                      else { setGestureAnchor(idx); }
                    }}
                    onKeyDown={(e) => e.key === "Enter" && setStatsLabel(c.label)}
                    title={`Stats for ${c.label} · tap another chord 2+ away to select a gesture`}
                    style={{
                    borderLeft: "2px solid var(--es-border)",
                    paddingLeft: "var(--es-space-2)",
                    background: active ? "var(--es-accent)" : inRange ? "var(--es-dim-bend-tint)" : "transparent",
                    outline: isAnchor ? "2px dashed var(--es-fg-muted)" : "none",
                    color: active ? "var(--es-accent-fg)" : "inherit",
                    borderRadius: "var(--es-radius-sm)",
                    transition: "background var(--es-motion-fast)",
                    cursor: "pointer",
                  }}>
                    <div style={{ fontSize: "var(--es-text-lg)", fontWeight: 600 }}>{c.symbol}</div>
                    <div style={{ fontSize: "var(--es-text-sm)", color: active ? "var(--es-accent-fg)" : "var(--es-fg-muted)" }}>{c.label}</div>
                  </div>
                );
              })}
            </div>
          ))
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
            {gestureRange && <>
              <span className="es-num" style={{ alignSelf: "center", fontSize: "var(--es-text-sm)" }}>
                gesture: {labels.slice(gestureRange[0], gestureRange[1] + 1).join(" → ")}
              </span>
              <button className="es-btn" title="Emphasize this stretch as a unit (triple contexts)"
                onClick={() => { setCuration((c) => rateGesture(c, labels.slice(gestureRange[0], gestureRange[1] + 1), TRANSITION_STEP)); }}>
                👍 gesture
              </button>
              <button className="es-btn" title="De-emphasize this stretch"
                onClick={() => { setCuration((c) => rateGesture(c, labels.slice(gestureRange[0], gestureRange[1] + 1), 1 / TRANSITION_STEP)); }}>
                👎 gesture
              </button>
              <button className="es-btn es-small" aria-label="Clear gesture selection"
                onClick={() => { setGestureAnchor(null); setGestureRange(null); }}>✕</button>
            </>}
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
              beat={IN_PLUGIN ? hostBeat : playhead >= 0 ? playhead * 2 : -1}
            />
          </div>
        </details>

        {IN_PLUGIN && (
          <details className="es-section" open style={{ marginTop: "var(--es-space-3)" }}>
            <summary>MIDI chord input {midiChord.chord && <span style={{ color: "var(--es-accent)", fontWeight: 400 }}>· {midiChord.chord.symbol}</span>}</summary>
            <div className="es-section-body">
              {midiChord.notes.length === 0 ? (
                <p style={{ color: "var(--es-fg-muted)", margin: 0 }}>Play a chord on a MIDI keyboard routed into this plugin — it's identified here and can be added to the leadsheet.</p>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: "var(--es-space-3)", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "var(--es-text-lg)", fontWeight: 600 }}>{midiChord.chord ? midiChord.chord.symbol : "—"}</span>
                  <span className="es-num" style={{ color: "var(--es-fg-muted)", fontSize: "var(--es-text-sm)" }}>
                    {midiChord.notes.map((n) => midiName(n)).join(" ")}
                  </span>
                  <button className="es-btn es-primary" disabled={!midiChord.chord} onClick={insertMidiChord}>
                    Add to leadsheet
                  </button>
                </div>
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

            <div style={{ display: "flex", gap: "var(--es-space-2)", marginTop: "var(--es-space-4)", flexWrap: "wrap" }}>
              <button className="es-btn es-small" onClick={() => navigator.clipboard?.writeText(exportCuration(curation))}>
                Copy profile
              </button>
              <button className="es-btn es-small" onClick={importProfile}>Import profile…</button>
              <button className="es-btn es-small" onClick={() => window.confirm("Reset all curated weights?") && setCuration({ multipliers: {} })}>
                Reset all
              </button>
            </div>
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
