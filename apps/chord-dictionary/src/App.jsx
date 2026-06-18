import React, { useEffect, useMemo, useRef, useState } from "react";
import { resolvedTheme, toggleTheme } from "@enkerli/ui/theme";
import { createPitchGrid } from "@enkerli/ui/pitch-grid";
import { chordCircleSVG } from "./chordCircle.js";
import {
  dictionarySize,
  getAllQualities,
  spellChordTones,
  spelledToPc,
  parseSpelled,
} from "@enkerli/theory";

// Spelled roots — C♯ and D♭ are different choices on purpose (see
// music-suite CONVENTIONS.md): once the root is named, every chord tone
// follows structurally. G♯'s major third is B♯; A♭'s is C.
const ROOTS = [
  "C", "C♯", "D♭", "D", "D♯", "E♭", "E", "F",
  "F♯", "G♭", "G", "G♯", "A♭", "A", "A♯", "B♭", "B",
];

const cell = { padding: "var(--es-space-2) var(--es-space-3)", borderBottom: "1px solid var(--es-border)", textAlign: "left", verticalAlign: "top" };
const th = { ...cell, position: "sticky", top: 0, background: "var(--es-bg-raised)", fontSize: "var(--es-text-sm)", color: "var(--es-fg-muted)" };
const mono = { fontFamily: "var(--es-font-mono)", fontSize: "var(--es-text-sm)", fontVariantNumeric: "tabular-nums" };

function exportJson(qualities) {
  const blob = new Blob([JSON.stringify(qualities, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "chord_dictionary.json";
  a.click();
  URL.revokeObjectURL(url);
}

/** The selected chord, drawn one of three ways (MIDIsplainer display options):
 *  circle = chromatic rim + interval spiral (app-local SVG); square / hex =
 *  the shared @enkerli/ui pitch-grid, mounted as a React island. */
function ChordView({ mode, root, rootPc, intervals, notes, pcs, names }) {
  const hostRef = useRef(null);
  useEffect(() => {
    if (mode === "circle") return; // circle is plain markup, below
    const el = hostRef.current;
    // chord tones get the solid "chord" role; the rest of the grid is context
    const roles = new Map([...pcs].map((pc) => [pc, "chord"]));
    const handle = createPitchGrid(el, {
      layout: mode, rows: 5, cols: 5, baseMidi: 48 + rootPc,
      rowStep: mode === "hex" ? 4 : 5, colStep: 1, // hex = Exquis; square = fourths
      roles, labels: "note", names, cellSize: 34,
    });
    return () => handle.destroy();
  }, [mode, rootPc, pcs, names]);

  if (mode === "circle") {
    return (
      <div
        style={{ width: 252 }}
        dangerouslySetInnerHTML={{ __html: chordCircleSVG({ root, intervals, notes }) }}
      />
    );
  }
  return <div ref={hostRef} style={{ display: "inline-block" }} />;
}

/** MIDIsplainer-style chord-symbol resolution: "Bb7", "F#m7", or a bare
 *  alias/suffix ("min7", "-7", "maj7") → { root, qualityKey }. Returns null if
 *  the quality can't be matched. Root accidentals normalize b/#→♭/♯; quality
 *  suffixes are matched raw (the dictionary's keys/aliases are ASCII). */
function resolveChordSymbol(input, qualities, roots) {
  const s = input.trim();
  if (!s) return null;
  const m = s.match(/^([A-Ga-g])([b#♭♯]?)(.*)$/);
  let root = "C", suffix = s;
  if (m) {
    root = m[1].toUpperCase() + m[2].replace("b", "♭").replace("#", "♯");
    suffix = m[3];
  }
  if (m && !roots.includes(root)) return null; // looked like a root but isn't one
  const want = suffix.trim();
  const norm = (x) => x.toLowerCase().replace(/♭/g, "b").replace(/♯/g, "#");
  const match = (c) =>
    c.key === want || c.displayName === want || c.aliases.includes(want) ||
    norm(c.key) === norm(want) || c.aliases.some((a) => norm(a) === norm(want));
  const q = qualities.find(match);
  return q ? { root, qualityKey: q.key } : null;
}

export default function App() {
  const [root, setRoot] = useState("C");
  const [query, setQuery] = useState("");
  const [theme, setThemeState] = useState(resolvedTheme);
  const [mode, setMode] = useState("circle"); // circle | square | hex

  const qualities = useMemo(() => getAllQualities(), []);
  const rootPc = spelledToPc(parseSpelled(root));

  const defaultKey = useMemo(
    () => (qualities.find((q) => q.fullName === "major triad") ?? qualities[0])?.key,
    [qualities],
  );
  const [selectedKey, setSelectedKey] = useState(null);
  const activeKey = selectedKey ?? defaultKey;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return qualities
      .filter((c) =>
        !q ||
        c.key.toLowerCase().includes(q) ||
        c.fullName.toLowerCase().includes(q) ||
        c.displayName.toLowerCase().includes(q) ||
        c.aliases.some((a) => a.toLowerCase().includes(q)),
      )
      .map((c) => ({
        quality: c,
        tones: spellChordTones(root, c.intervals, c.pcs) ?? [],
        hex: "0x" + c.decimal.toString(16).toUpperCase(),
      }));
  }, [qualities, root, query]);

  const selected = useMemo(
    () => qualities.find((c) => c.key === activeKey) ?? qualities[0],
    [qualities, activeKey],
  );
  // Sounding pitch classes + spelled names for the selected chord at this root.
  const selTones = useMemo(
    () => (selected ? spellChordTones(root, selected.intervals, selected.pcs) ?? [] : []),
    [selected, root],
  );
  const selPcs = useMemo(
    () => new Set((selected?.pcs ?? []).map((pc) => (pc + rootPc) % 12)),
    [selected, rootPc],
  );
  const selNames = useMemo(() => {
    const m = new Map();
    (selected?.pcs ?? []).forEach((pc, i) => m.set((pc + rootPc) % 12, selTones[i] ?? ""));
    return m;
  }, [selected, rootPc, selTones]);

  return (
    <div className="es-app" style={{ padding: "var(--es-space-4)" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <header style={{ display: "flex", flexWrap: "wrap", gap: "var(--es-space-3)", alignItems: "baseline", marginBottom: "var(--es-space-4)" }}>
          <h1 style={{ fontSize: "var(--es-text-xl)", margin: 0 }}>Chord Dictionary</h1>
          <span style={{ color: "var(--es-fg-muted)", fontSize: "var(--es-text-sm)" }}>
            {rows.length} of {dictionarySize()} qualities · pick a row to inspect it · fingerprints are MSB-first numerals (pc 0 = leftmost bit)
          </span>
        </header>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--es-space-3)", marginBottom: "var(--es-space-4)", alignItems: "center" }}>
          <label style={{ display: "flex", gap: "var(--es-space-2)", alignItems: "center" }}>
            <span>Root</span>
            <select value={root} onChange={(e) => setRoot(e.target.value)} className="es-control">
              {ROOTS.map((r) => (<option key={r} value={r}>{r}</option>))}
            </select>
          </label>
          <input
            type="search"
            placeholder="Type a chord (Bb7, F#m7) or filter…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              const hit = resolveChordSymbol(query, qualities, ROOTS);
              if (hit) { setRoot(hit.root); setSelectedKey(hit.qualityKey); }
            }}
            aria-label="Type a chord symbol, or filter the table by name, symbol, or alias"
            className="es-control"
            style={{ flex: "1 1 220px" }}
          />
          <button onClick={() => exportJson(qualities)} className="es-btn es-primary">Export JSON</button>
          <button className="es-btn" aria-label="Toggle color theme" onClick={() => setThemeState(toggleTheme())}>
            {theme === "dark" ? "☀︎ Light" : "● Dark"}
          </button>
        </div>

        {/* Per-quality inspector — the MIDIsplainer-style explainer with
            square / hex / circle display options. */}
        {selected && (
          <div className="es-panel" style={{ display: "flex", flexWrap: "wrap", gap: "var(--es-space-4)", marginBottom: "var(--es-space-4)", alignItems: "flex-start" }}>
            <div style={{ minWidth: 200, flex: "1 1 240px" }}>
              <div style={{ fontSize: "var(--es-text-2xl, 2rem)", fontWeight: 700, lineHeight: 1.05 }}>{root}{selected.displayName}</div>
              <div style={{ color: "var(--es-fg-2)", marginBottom: "var(--es-space-2)" }}>{selected.fullName}</div>
              <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "2px var(--es-space-3)", margin: 0, fontSize: "var(--es-text-sm)" }}>
                <dt style={{ color: "var(--es-fg-muted)" }}>Notes</dt><dd style={{ margin: 0, fontWeight: 600 }}>{selTones.join(" ")}</dd>
                <dt style={{ color: "var(--es-fg-muted)" }}>Intervals</dt><dd style={{ margin: 0, ...mono }}>{selected.intervals.join(" ")}</dd>
                <dt style={{ color: "var(--es-fg-muted)" }}>Pitch classes</dt><dd style={{ margin: 0, ...mono }}>{[...selPcs].sort((a, b) => a - b).join(",")}</dd>
                <dt style={{ color: "var(--es-fg-muted)" }}>Binary</dt><dd style={{ margin: 0, ...mono }}>{selected.binary}</dd>
                <dt style={{ color: "var(--es-fg-muted)" }}>Decimal</dt><dd style={{ margin: 0, ...mono }}>{selected.decimal}</dd>
                {selected.aliases.length > 0 && (<>
                  <dt style={{ color: "var(--es-fg-muted)" }}>Aliases</dt>
                  <dd style={{ margin: 0, color: "var(--es-fg-muted)" }}>{selected.aliases.join(", ")}</dd>
                </>)}
              </dl>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--es-space-2)" }}>
              <div style={{ display: "flex", gap: 4 }}>
                {[["circle", "◯ circle"], ["square", "▦ square"], ["hex", "⬡ hex"]].map(([m, label]) => (
                  <button key={m} className={`es-btn es-small ${mode === m ? "es-primary" : ""}`} onClick={() => setMode(m)}>{label}</button>
                ))}
              </div>
              <ChordView mode={mode} root={root} rootPc={rootPc} intervals={selected.intervals} notes={selTones} pcs={selPcs} names={selNames} />
            </div>
          </div>
        )}

        <div className="es-panel" style={{ overflowX: "auto", padding: 0 }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                <th style={th} scope="col">Symbol</th>
                <th style={th} scope="col">Full name</th>
                <th style={th} scope="col">Tones (from {root})</th>
                <th style={th} scope="col">Intervals</th>
                <th style={th} scope="col">PCS</th>
                <th style={th} scope="col">Binary</th>
                <th style={th} scope="col">Dec</th>
                <th style={th} scope="col">Hex</th>
                <th style={th} scope="col">Aliases</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ quality: c, tones, hex }) => {
                const active = c.key === activeKey;
                return (
                  <tr
                    key={c.key}
                    onClick={() => setSelectedKey(c.key)}
                    style={{ cursor: "pointer", background: active ? "var(--es-bg-sunken)" : undefined }}
                  >
                    <td style={{ ...cell, fontWeight: 600, whiteSpace: "nowrap" }}>{root}{c.displayName}</td>
                    <td style={cell}>{c.fullName}</td>
                    <td style={{ ...cell, whiteSpace: "nowrap" }}>{tones.join(" ")}</td>
                    <td style={{ ...cell, ...mono }}>{c.intervals.join(" ")}</td>
                    <td style={{ ...cell, ...mono }}>{c.pcs.join(",")}</td>
                    <td style={{ ...cell, ...mono }}>{c.binary}</td>
                    <td style={{ ...cell, ...mono }}>{c.decimal}</td>
                    <td style={{ ...cell, ...mono }}>{hex}</td>
                    <td style={{ ...cell, fontSize: "var(--es-text-sm)", color: "var(--es-fg-muted)" }}>{c.aliases.join(", ")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <footer style={{ marginTop: "var(--es-space-4)", color: "var(--es-fg-muted)", fontSize: "var(--es-text-sm)" }}>
          Successor to the MIDIsplainer Chord-Dictionary branch — all data from <code style={mono}>@enkerli/theory</code>. CC0.
        </footer>
      </div>
    </div>
  );
}
