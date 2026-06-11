import React, { useEffect, useMemo, useRef, useState } from "react";
import table from "./data/transitions.json";
import { generateLabels, labelMass, realizeLabel, startLabel, voiceProgression } from "./generate.js";
import { downloadProgression } from "./exportMidi.js";
import {
  adjustTransition,
  exportCuration,
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

const control = {
  minHeight: "var(--es-touch-target)",
  fontSize: "var(--es-text-md)",
  borderRadius: "var(--es-radius-sm)",
  border: "1px solid var(--es-border)",
  background: "var(--es-bg-raised)",
  color: "var(--es-fg)",
  padding: "0 var(--es-space-2)",
};
const smallBtn = {
  ...control,
  minHeight: 32,
  minWidth: 32,
  fontSize: "var(--es-text-sm)",
  cursor: "pointer",
  padding: "0 var(--es-space-2)",
};

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

function MultiplierBadge({ value }) {
  if (Math.abs(value - 1) < 1e-9) return null;
  const up = value > 1;
  return (
    <span style={{
      fontSize: "var(--es-text-xs)",
      fontFamily: "var(--es-font-mono)",
      padding: "1px 6px",
      borderRadius: 999,
      background: up ? "var(--es-accent)" : "var(--es-border)",
      color: up ? "var(--es-accent-fg)" : "var(--es-fg)",
    }}>
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
    <div style={{ background: "var(--es-bg-raised)", border: "1px solid var(--es-border)", borderRadius: "var(--es-radius-md)", padding: "var(--es-space-4)", marginTop: "var(--es-space-3)" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "var(--es-space-3)", flexWrap: "wrap" }}>
        <h2 style={{ fontSize: "var(--es-text-md)", margin: 0 }}>Corpus statistics</h2>
        <label style={{ display: "flex", gap: "var(--es-space-2)", alignItems: "center", fontSize: "var(--es-text-sm)" }}>
          after
          <select style={{ ...control, minHeight: 36 }} value={selected} onChange={(e) => setStatsLabel(e.target.value)}>
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
              <span style={{ fontFamily: "var(--es-font-mono)" }}>{to}</span>
              <div aria-hidden style={{ height: 10, borderRadius: 5, background: "var(--es-border)", overflow: "hidden" }}>
                <div style={{ width: `${(count * (mult ?? 1)) / maxCount * 100}%`, maxWidth: "100%", height: "100%", background: "var(--es-accent)", transition: "width var(--es-motion-base)" }} />
              </div>
              <span style={{ color: "var(--es-fg-muted)", textAlign: "right", fontFamily: "var(--es-font-mono)" }}>
                {((count / rowTotal) * 100).toFixed(1)}%
              </span>
              <MultiplierBadge value={mult} />
              <span style={{ display: "flex", gap: 4 }}>
                <button style={smallBtn} aria-label={`Emphasize ${selected} to ${to}`}
                  onClick={() => setCuration((c) => adjustTransition(c, selected, to, TRANSITION_STEP))}>▲</button>
                <button style={smallBtn} aria-label={`De-emphasize ${selected} to ${to}`}
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
  const { play, stop, playing, playhead } = usePlayer();

  useEffect(() => { saveCuration(curation); }, [curation]);

  const labels = useMemo(
    () => generateLabels(table[mode], mode, { length, seed, curation, method }),
    [mode, length, seed, curation, method],
  );
  const chords = useMemo(
    () => labels.map((l) => realizeLabel(l, { tonic, mode })).filter(Boolean),
    [labels, tonic, mode],
  );
  const voicings = useMemo(() => voiceProgression(chords), [chords]);

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
    <div style={{ minHeight: "100vh", background: "var(--es-bg)", color: "var(--es-fg)", fontFamily: "var(--es-font-sans)", padding: "var(--es-space-4)" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <header style={{ marginBottom: "var(--es-space-4)" }}>
          <h1 style={{ fontSize: "var(--es-text-xl)", margin: 0 }}>Progression Studio</h1>
          <p style={{ color: "var(--es-fg-muted)", fontSize: "var(--es-text-sm)", margin: "var(--es-space-1) 0 0" }}>
            Markov walk over {Object.keys(table[mode]).length} degree labels from 2,611 jazz lead sheets
            {curatedEntries.length > 0 && <> · {curatedEntries.length} curated weight{curatedEntries.length > 1 ? "s" : ""}</>}
          </p>
        </header>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--es-space-3)", alignItems: "end", marginBottom: "var(--es-space-4)" }}>
          <label style={{ display: "grid", gap: 4, fontSize: "var(--es-text-sm)" }}>Key
            <select style={control} value={tonic} onChange={(e) => setTonic(e.target.value)}>
              {ROOTS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: "var(--es-text-sm)" }}>Mode
            <select style={control} value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="major">major</option>
              <option value="minor">minor</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: "var(--es-text-sm)" }}>Engine
            <select style={control} value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="markov">corpus walk</option>
              <option value="markov-cadence">corpus walk + cadence</option>
              <option value="circle">circle of fifths</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: "var(--es-text-sm)" }}>Chords
            <select style={control} value={length} onChange={(e) => setLength(Number(e.target.value))}>
              {[8, 12, 16, 24, 32].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: "var(--es-text-sm)" }}>Tempo
            <input style={{ ...control, width: 72 }} type="number" min="40" max="300" value={bpm} onChange={(e) => setBpm(Number(e.target.value))} />
          </label>
          <button style={{ ...control, padding: "0 var(--es-space-4)", cursor: "pointer" }} onClick={() => setSeed((s) => s + 1)}>
            New progression
          </button>
          <button
            style={{ ...control, padding: "0 var(--es-space-4)", cursor: "pointer", background: "var(--es-accent)", color: "var(--es-accent-fg)", border: "none" }}
            onClick={() => (playing ? stop() : play(voicings, bpm))}
          >
            {playing ? "Stop" : "Play"}
          </button>
          <button
            style={{ ...control, padding: "0 var(--es-space-4)", cursor: "pointer" }}
            onClick={() => navigator.clipboard?.writeText(chords.map((c) => c.symbol).join(" | "))}
          >
            Copy chords
          </button>
          <button
            style={{ ...control, padding: "0 var(--es-space-4)", cursor: "pointer" }}
            title="Download as a Standard MIDI File (chord symbols as markers)"
            onClick={() => downloadProgression(voicings, { bpm, tonic, mode, seed })}
          >
            Export MIDI
          </button>
        </div>

        <div style={{ background: "var(--es-bg-raised)", border: "1px solid var(--es-border)", borderRadius: "var(--es-radius-md)", padding: "var(--es-space-4)" }}>
          {rows.map((row, ri) => (
            <div key={ri} style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--es-space-2)", marginBottom: ri < rows.length - 1 ? "var(--es-space-3)" : 0 }}>
              {row.map((c, ci) => {
                const idx = ri * 4 + ci;
                const active = idx === playhead;
                return (
                  <div key={idx} role="button" tabIndex={0}
                    onClick={() => setStatsLabel(c.label)}
                    onKeyDown={(e) => e.key === "Enter" && setStatsLabel(c.label)}
                    title={`Show corpus statistics for ${c.label}`}
                    style={{
                    borderLeft: "2px solid var(--es-border)",
                    paddingLeft: "var(--es-space-2)",
                    background: active ? "var(--es-accent)" : "transparent",
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
              style={{ ...control, cursor: "pointer", padding: "0 var(--es-space-3)" }}
              title={`Multiply every transition in this progression by ${PROGRESSION_STEP}`}
              onClick={() => setCuration((c) => rateProgression(c, labels, PROGRESSION_STEP))}
            >
              👍 More like this
            </button>
            <button
              style={{ ...control, cursor: "pointer", padding: "0 var(--es-space-3)" }}
              title={`Divide every transition in this progression by ${PROGRESSION_STEP}`}
              onClick={() => setCuration((c) => rateProgression(c, labels, 1 / PROGRESSION_STEP))}
            >
              👎 Bit meh
            </button>
            <button
              style={{ ...smallBtn, marginLeft: "auto" }}
              onClick={() => setShowCuration((s) => !s)}
              aria-expanded={showCuration}
            >
              {showCuration ? "Hide curation ▾" : "Curation ▸"}
            </button>
          </div>
        </div>

        {showCuration && (
          <div style={{ background: "var(--es-bg-raised)", border: "1px solid var(--es-border)", borderRadius: "var(--es-radius-md)", padding: "var(--es-space-4)", marginTop: "var(--es-space-3)" }}>
            <h2 style={{ fontSize: "var(--es-text-md)", margin: "0 0 var(--es-space-2)" }}>Transitions in this progression</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "var(--es-space-2)" }}>
              {transitions.map(({ from, to, key }) => {
                const mult = multiplierFor(curation, from, to);
                return (
                  <div key={key} style={{ display: "flex", alignItems: "center", gap: "var(--es-space-2)", fontSize: "var(--es-text-sm)" }}>
                    <span style={{ flex: 1, fontFamily: "var(--es-font-mono)" }}>{key}</span>
                    <MultiplierBadge value={mult} />
                    <button style={smallBtn} aria-label={`Emphasize ${key}`} title="Sounds good — emphasize"
                      onClick={() => setCuration((c) => adjustTransition(c, from, to, TRANSITION_STEP))}>▲</button>
                    <button style={smallBtn} aria-label={`De-emphasize ${key}`} title="De-emphasize"
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
                      <span style={{ flex: 1, fontFamily: "var(--es-font-mono)" }}>{key}</span>
                      <MultiplierBadge value={value} />
                      <button style={smallBtn} aria-label={`Reset ${key}`} title="Reset to corpus weight"
                        onClick={() => setCuration((c) => resetTransition(c, key))}>↺</button>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div style={{ display: "flex", gap: "var(--es-space-2)", marginTop: "var(--es-space-4)", flexWrap: "wrap" }}>
              <button style={smallBtn} onClick={() => navigator.clipboard?.writeText(exportCuration(curation))}>
                Copy profile
              </button>
              <button style={smallBtn} onClick={importProfile}>Import profile…</button>
              <button style={smallBtn} onClick={() => window.confirm("Reset all curated weights?") && setCuration({ multipliers: {} })}>
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
