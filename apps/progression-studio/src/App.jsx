import React, { useEffect, useMemo, useRef, useState } from "react";
import table from "./data/transitions.json";
import { generateSections, labelMass, realizeLabel, startLabel, voiceProgression } from "./generate.js";
import { exportProgression, voicingsToClip } from "./exportMidi.js";
import { createBridge } from "./juceBridge.js";
import { resolvedTheme, toggleTheme } from "@enkerli/ui/theme";
import { createPianoRoll } from "@enkerli/ui/piano-roll";

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
      } catch { /* malformed saved state — keep defaults */ }
    });
    bridge.ready();
    return () => { offTransport(); offRuntime(); offState(); };
  }, []);

  const labels = useMemo(
    () => generateSections(table[mode], mode,
      { length, seed, curation, method, temperature, startFrom }, extensions),
    [mode, length, seed, curation, method, temperature, startFrom, extensions],
  );
  const chords = useMemo(
    () => labels.map((l) => realizeLabel(l, { tonic, mode })).filter(Boolean),
    [labels, tonic, mode],
  );
  const voicings = useMemo(() => voiceProgression(chords), [chords]);

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
    bridge.send("enkerliState", { tonic, mode, length, seed, method, curation, temperature, channelMode, startFrom, extensions });
  }, [voicings, tonic, mode, length, seed, method, curation, temperature, channelMode, startFrom, extensions]);

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
          <label style={{ display: "grid", gap: 4, fontSize: "var(--es-text-sm)" }}>Chords
            <select className="es-control" value={length} onChange={(e) => setLength(Number(e.target.value))}>
              {[8, 12, 16, 24, 32].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          {!IN_PLUGIN && <label style={{ display: "grid", gap: 4, fontSize: "var(--es-text-sm)" }}>Tempo
            <input className="es-control" style={{ width: 72 }} type="number" min="40" max="300" value={bpm} onChange={(e) => setBpm(Number(e.target.value))} />
          </label>}
          <button className="es-btn" onClick={() => { setSeed((s) => s + 1); setExtensions([]); setGestureAnchor(null); setGestureRange(null); }}>
            New progression
          </button>
          <button className="es-btn" title="Append a section continuing from the last chord"
            onClick={() => setExtensions((x) => [...x, { seed: seed * 31 + x.length + 1, length }])}>
            + Extend
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
          {rows.map((row, ri) => (
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
          ))}

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
