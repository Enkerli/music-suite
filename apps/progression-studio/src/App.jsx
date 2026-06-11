import React, { useEffect, useMemo, useRef, useState } from "react";
import table from "./data/transitions.json";
import { generateProgression, realizeLabel, voiceProgression } from "./generate.js";

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
    const barDur = 2 * beat; // two beats per chord keeps audition brisk
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

export default function App() {
  const [tonic, setTonic] = useState("C");
  const [mode, setMode] = useState("major");
  const [length, setLength] = useState(16);
  const [seed, setSeed] = useState(1);
  const [bpm, setBpm] = useState(120);
  const { play, stop, playing, playhead } = usePlayer();

  const labels = useMemo(
    () => generateProgression(table[mode], mode, length, seed),
    [mode, length, seed],
  );
  const chords = useMemo(
    () => labels.map((l) => realizeLabel(l, { tonic, mode })).filter(Boolean),
    [labels, tonic, mode],
  );
  const voicings = useMemo(() => voiceProgression(chords), [chords]);

  const rows = [];
  for (let i = 0; i < chords.length; i += 4) rows.push(chords.slice(i, i + 4));

  return (
    <div style={{ minHeight: "100vh", background: "var(--es-bg)", color: "var(--es-fg)", fontFamily: "var(--es-font-sans)", padding: "var(--es-space-4)" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <header style={{ marginBottom: "var(--es-space-4)" }}>
          <h1 style={{ fontSize: "var(--es-text-xl)", margin: 0 }}>Progression Studio</h1>
          <p style={{ color: "var(--es-fg-muted)", fontSize: "var(--es-text-sm)", margin: "var(--es-space-1) 0 0" }}>
            Markov walk over {Object.keys(table[mode]).length} degree labels from 2,611 jazz lead sheets
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
        </div>

        <div style={{ background: "var(--es-bg-raised)", border: "1px solid var(--es-border)", borderRadius: "var(--es-radius-md)", padding: "var(--es-space-4)" }}>
          {rows.map((row, ri) => (
            <div key={ri} style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--es-space-2)", marginBottom: ri < rows.length - 1 ? "var(--es-space-3)" : 0 }}>
              {row.map((c, ci) => {
                const idx = ri * 4 + ci;
                const active = idx === playhead;
                return (
                  <div key={idx} style={{
                    borderLeft: "2px solid var(--es-border)",
                    paddingLeft: "var(--es-space-2)",
                    background: active ? "var(--es-accent)" : "transparent",
                    color: active ? "var(--es-accent-fg)" : "inherit",
                    borderRadius: "var(--es-radius-sm)",
                    transition: "background var(--es-motion-fast)",
                  }}>
                    <div style={{ fontSize: "var(--es-text-lg)", fontWeight: 600 }}>{c.symbol}</div>
                    <div style={{ fontSize: "var(--es-text-sm)", color: active ? "var(--es-accent-fg)" : "var(--es-fg-muted)" }}>{c.label}</div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <footer style={{ marginTop: "var(--es-space-4)", color: "var(--es-fg-muted)", fontSize: "var(--es-text-sm)" }}>
          Transition statistics derived from the Impro-Visor imaginary-book corpus
          (github.com/Impro-Visor/Impro-Visor, GPL) — counts of chord changes only.
          Degree labels per the suite conventions; voicings via minimal (taxicab) voice leading.
        </footer>
      </div>
    </div>
  );
}
