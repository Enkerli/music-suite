import React, { useMemo, useState } from "react";
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
const mono = { fontFamily: "var(--es-font-mono)", fontSize: "var(--es-text-sm)" };

function exportJson(qualities) {
  const blob = new Blob([JSON.stringify(qualities, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "chord_dictionary.json";
  a.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const [root, setRoot] = useState("C");
  const [query, setQuery] = useState("");

  const qualities = useMemo(() => getAllQualities(), []);
  const rootPc = spelledToPc(parseSpelled(root));

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

  return (
    <div style={{ minHeight: "100vh", background: "var(--es-bg)", color: "var(--es-fg)", fontFamily: "var(--es-font-sans)", padding: "var(--es-space-4)" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <header style={{ display: "flex", flexWrap: "wrap", gap: "var(--es-space-3)", alignItems: "baseline", marginBottom: "var(--es-space-4)" }}>
          <h1 style={{ fontSize: "var(--es-text-xl)", margin: 0 }}>Chord Dictionary</h1>
          <span style={{ color: "var(--es-fg-muted)", fontSize: "var(--es-text-sm)" }}>
            {rows.length} of {dictionarySize()} qualities · fingerprints are MSB-first numerals (pc 0 = leftmost bit) · tones spelled structurally from the root
          </span>
        </header>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--es-space-3)", marginBottom: "var(--es-space-4)", alignItems: "center" }}>
          <label style={{ display: "flex", gap: "var(--es-space-2)", alignItems: "center" }}>
            <span>Root</span>
            <select
              value={root}
              onChange={(e) => setRoot(e.target.value)}
              style={{ minHeight: "var(--es-touch-target)", fontSize: "var(--es-text-md)", borderRadius: "var(--es-radius-sm)", border: "1px solid var(--es-border)", background: "var(--es-bg-raised)", color: "var(--es-fg)", padding: "0 var(--es-space-2)" }}
            >
              {ROOTS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>
          <input
            type="search"
            placeholder="Search name, symbol, alias…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search chord qualities"
            style={{ flex: "1 1 220px", minHeight: "var(--es-touch-target)", fontSize: "var(--es-text-md)", borderRadius: "var(--es-radius-sm)", border: "1px solid var(--es-border)", background: "var(--es-bg-raised)", color: "var(--es-fg)", padding: "0 var(--es-space-3)" }}
          />
          <button
            onClick={() => exportJson(qualities)}
            style={{ minHeight: "var(--es-touch-target)", padding: "0 var(--es-space-4)", borderRadius: "var(--es-radius-sm)", border: "1px solid var(--es-border)", background: "var(--es-accent)", color: "var(--es-accent-fg)", fontSize: "var(--es-text-md)", cursor: "pointer" }}
          >
            Export JSON
          </button>
        </div>

        <div style={{ overflowX: "auto", background: "var(--es-bg-raised)", borderRadius: "var(--es-radius-md)", border: "1px solid var(--es-border)" }}>
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
              {rows.map(({ quality: c, tones, hex }) => (
                <tr key={c.key}>
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
              ))}
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
