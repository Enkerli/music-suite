import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import table from "@enkerli/proggen/data/transitions.json";
import trigrams from "@enkerli/proggen/data/trigrams.json";
import { BEATS_PER_BAR, chordCompletions, chordSlots, divideBar, generateLabels, generateSections, labelMass, nextChordSuggestions, realizeLabel, rhythmBeats, rhythmPlan, startLabel, voiceChord, voiceProgression, voicingSuggestions } from "@enkerli/proggen";
import { chordStartBeats, exportProgression, voicingsToClip, progressionFromVoicings } from "./exportMidi.js";
import { publishProgression } from "./suite-bus.js";
import { loadLibrary, saveLibrary, newId } from "./library.js";
import { progressionFromSMF } from "@enkerli/midi";
import { createBridge } from "./juceBridge.js";
import * as midiOut from "./webmidi-out.js";
import { analyzeKeyAreas, applySubstitutions, assertDegree, chordScaleFor, parseLeadsheet, planModulation, realizeChord, resolveDegree, spellRoot, transitionMotion } from "@enkerli/theory";
import { createGlobalCluster } from "@enkerli/ui/global-cluster";
import appIcon from "@enkerli/ui/icons/proggenie.svg";
import { createPianoRoll } from "@enkerli/ui/piano-roll";
import { createPitchGrid } from "@enkerli/ui/pitch-grid";
import { createLibraryBrowser } from "@enkerli/ui/library-browser";
import { toast } from "@enkerli/ui/toast";
import { createLeadsheetEditor } from "@enkerli/ui/leadsheet-editor";
import { createChordInput } from "./chordInput.js";

/**
 * Realize a Progression to the chord shape the rest of ProgGenie expects
 * (voiceProgression / the sheet / export): adds a `label` (the token as
 * authored — degree numeral or, for hand-edited chords, the symbol).
 */
function chordsFromProgression(prog, key) {
  const out = [];
  // Each section realizes against its own key (modulation, Q2), else the
  // progression/fallback key. `secKey` rides on each realized chord so the
  // functional analysis (rating, rationale) reads it in the right key.
  for (const section of prog.sections ?? []) {
    const k = section.key ?? key;
    for (const bar of section.bars ?? []) {
      if (bar.repeat) {
        if (out.length) out.push(out[out.length - 1]);
        continue;
      }
      // Durations follow the leadsheet convention: the chords in a bar divide
      // its beats metrically (3 → half + quarter + quarter). Derived from the
      // count, so inserting/removing a chord re-divides the bar — no overflow.
      const durs = divideBar(bar.chords.length);
      bar.chords.forEach((c, i) => {
        const r = realizeChord(c, k);
        const label = c.source === "degree" && c.degree
          ? c.degree.numeral + c.degree.suffix
          : (c.inputText ?? r.symbol);
        out.push({ ...r, label, voicing: c.voicing, dur: durs[i], secKey: k });
      });
    }
  }
  return out;
}

/** Spell the tonic `interval` semitones above `homeTonic` via its major-frame
 *  degree (V=dominant, IV=subdominant, VI=relative, II=up-a-step …) so a
 *  modulated section's key gets a conventional name (C+7 → G, E♭+9 → C). */
const INTERVAL_NUMERAL = { 0: "I", 1: "♭II", 2: "II", 3: "♭III", 4: "III", 5: "IV", 6: "♯IV", 7: "V", 8: "♭VI", 9: "VI", 10: "♭VII", 11: "VII" };
function tonicAtInterval(homeTonic, interval) {
  const num = INTERVAL_NUMERAL[((interval % 12) + 12) % 12] ?? "I";
  return resolveDegree(num, { tonic: homeTonic, mode: "major" });
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

/** Build a multi-section Progression by per-bar key (Q2 / implied modulation):
 *  `keyForBar(barIndex)` gives each bar's key; consecutive same-key bars group
 *  into a section. The labels are the *same* home-key walk — a section realizes
 *  them against its key, so "IIm7 V7 Imaj7" in a G section sounds and reads as
 *  Am7 D7 Gmaj7. Home sections carry no `key` (they fall back to the home key).
 *  Sounding/export are identical to a single key — only the labels read true. */
function buildProgressionSectioned(labels, plan, homeKey, keyForBar) {
  const homeLabel = `${homeKey.tonic} ${homeKey.mode}`;
  const prog = { key: homeKey, sections: [] };
  let li = 0, cur = null, curLabel = null;
  plan.forEach((p, b) => {
    const k = keyForBar(b) ?? homeKey;
    const kLabel = `${k.tonic} ${k.mode}`;
    if (kLabel !== curLabel) {
      cur = { bars: [] };
      if (kLabel !== homeLabel) cur.key = k; // home sections stay key-less (use prog.key)
      prog.sections.push(cur);
      curLabel = kLabel;
    }
    if (p.repeat) { cur.bars.push({ chords: [], repeat: true }); return; }
    const chords = [];
    for (let kk = 0; kk < p.durs.length; kk++) {
      const label = labels[li++];
      if (label == null) break;
      const ch = parseLeadsheet(label, k).sections[0]?.bars[0]?.chords[0];
      if (ch) chords.push(ch);
    }
    cur.bars.push({ chords });
  });
  prog.sections = prog.sections.filter((s) => s.bars.length);
  if (!prog.sections.length) prog.sections.push({ bars: [] });
  return prog;
}

/** Editable leadsheet — the shared @enkerli/ui editor, the primary surface.
 *  Mounts once; the caller forces a remount (via React key) on external
 *  ops (generate/extend/clear/key change) so internal edits don't reset it.
 *  activeIndex drives the chord-follow highlight without remounting. */
function LeadsheetEdit({ progression, activeIndex, onEdit, suggest, onRate, ratingOf, rationaleOf, scaleOf, scaleGridOf, ratingSignal, tool, display, keyAreas, ghost, motionOf, motionSignal, gridLayout, onGridLayout }) {
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
  const motionOfRef = useRef(motionOf); motionOfRef.current = motionOf;
  const scaleGridOfRef = useRef(scaleGridOf); scaleGridOfRef.current = scaleGridOf;
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
      scaleGridOf: (i) => scaleGridOfRef.current?.(i) ?? null,
      motionOf: (i) => motionOfRef.current?.(i) ?? null,
      tool,
      display,
      keyAreas,
      ghost,
      gridLayout,
      onGridLayout,
    });
    return () => edRef.current.destroy();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- remount via key
  useEffect(() => { edRef.current?.update({ activeIndex }); }, [activeIndex]);
  useEffect(() => { edRef.current?.update({ tool }); }, [tool]);
  useEffect(() => { edRef.current?.update({ display }); }, [display]);
  useEffect(() => { edRef.current?.update({ keyAreas }); }, [keyAreas]);
  useEffect(() => { edRef.current?.update({ ghost }); }, [ghost]);
  useEffect(() => { edRef.current?.update({ gridLayout }); }, [gridLayout]);
  // Ratings changed (curation) — re-render chips to re-reflect the 👍/👎 state.
  useEffect(() => { edRef.current?.refresh(); }, [ratingSignal, motionSignal]);
  return <div ref={hostRef} />;
}

// Module singleton: detected once, same UI runs in browser and plugin.
const bridge = createBridge();
const IN_PLUGIN = bridge.kind === "juce";
import {
  adjustTransition,
  exportCuration,
  filterWeights,
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
  transitionDegrees,
  TRANSITION_STEP,
} from "@enkerli/proggen";

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
    // When a MIDI output is chosen, notes go there (external synth / another
    // suite app) instead of the internal Web Audio preview — never both, so
    // you don't hear a doubled, slightly-flammed chord.
    const useMidi = midiOut.midiActive();
    const beat = 60 / bpm;
    const t0 = ctx.currentTime + 0.05;
    const nodes = [];
    const timers = [];
    const msFromNow = (t) => Math.max(0, (t - ctx.currentTime) * 1000);

    let accBeats = 0;
    voicings.forEach((v, i) => {
      const start = t0 + accBeats * beat;
      const dur = (v.dur ?? 2) * beat; // honor the harmonic rhythm
      const chordNotes = [v.bass, ...v.notes];
      if (useMidi) {
        for (const midi of chordNotes) {
          const vel = midi === v.bass ? 100 : 80;
          timers.push(setTimeout(() => midiOut.sendNoteOn(midi, vel, 1), msFromNow(start)));
          timers.push(setTimeout(() => midiOut.sendNoteOff(midi, 1), msFromNow(start + dur)));
        }
      } else {
        for (const midi of chordNotes) {
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
      }
      timers.push(setTimeout(() => setPlayhead(i), msFromNow(start)));
      accBeats += v.dur ?? 2;
    });
    timers.push(setTimeout(() => { setPlaying(false); setPlayhead(-1); }, (t0 - ctx.currentTime + accBeats * beat) * 1000));

    stopRef.current = () => {
      for (const n of nodes) { try { n.stop(); } catch { /* already stopped */ } }
      for (const t of timers) clearTimeout(t);
      if (useMidi) midiOut.allNotesOff(1); // silence any note left hanging by an early stop
    };
    setPlaying(true);
  }

  useEffect(() => () => stopRef.current(), []);
  return { play, stop, playing, playhead };
}

/** Standalone MIDI output: enable Web MIDI, track ports, remember the choice
 *  by name (port ids aren't stable across sessions). A no-op in the browser
 *  with no Web MIDI. */
const MIDI_OUT_KEY = "proggenie.midi-out-name";
function useMidiOut(enabled) {
  const [outputs, setOutputs] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!enabled || !midiOut.midiSupported()) return undefined;
    let cancelled = false;
    const apply = (ports) => {
      if (cancelled) return;
      setOutputs(ports);
      // Re-bind a remembered port by name once it (re)appears.
      const saved = (() => { try { return localStorage.getItem(MIDI_OUT_KEY); } catch { return null; } })();
      if (saved && !midiOut.selectedOutputId()) {
        const match = ports.find((p) => p.name === saved);
        if (match) { midiOut.selectOutput(match.id); setSelectedId(match.id); }
      }
    };
    const off = midiOut.onDevices(apply);
    midiOut.startMidiOut().then((r) => {
      if (cancelled) return;
      if (r.ok) { setError(""); apply(r.outputs); }
      else setError(r.error || "MIDI unavailable");
    });
    return () => { cancelled = true; off(); };
  }, [enabled]);

  const select = useCallback((id) => {
    midiOut.selectOutput(id);
    setSelectedId(id || null);
    try {
      const name = midiOut.outputs().find((p) => p.id === id)?.name;
      if (name) localStorage.setItem(MIDI_OUT_KEY, name);
      else localStorage.removeItem(MIDI_OUT_KEY);
    } catch { /* private mode — selection stays in memory */ }
  }, []);

  return { outputs, selectedId, error, select };
}

/** The shared frame's global cluster (theme · MIDI · density · Library) as a
 *  React island. MIDI is now the shared chip + popover panel — this retired
 *  the app's own MidiOutSelect (the chrome lives in @enkerli/ui, DIN-5 icon
 *  included). `midi` must be memoized upstream: update() re-renders the
 *  cluster, and playback re-renders App at 10 Hz. */
function GlobalClusterMount({ midi, densityTargetRef, libCount, onLibToggle }) {
  const hostRef = useRef(null);
  const clusterRef = useRef(null);
  const onLibRef = useRef(onLibToggle); onLibRef.current = onLibToggle;
  useEffect(() => {
    clusterRef.current = createGlobalCluster(hostRef.current, {
      midi, densityTarget: densityTargetRef.current,
      library: { count: libCount, onToggle: () => onLibRef.current() },
    });
    return () => clusterRef.current.destroy();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- mounts once
  useEffect(() => {
    clusterRef.current?.update({ midi, library: { count: libCount, onToggle: () => onLibRef.current() } });
  }, [midi, libCount]);
  return <div ref={hostRef} />;
}

/** The Library — the musician's saved things, as the shared @enkerli/ui
 *  LibraryBrowser (Design pass · Q2) — a React island over the
 *  framework-agnostic component. Entries are @enkerli/library envelopes;
 *  since the shared-frame pass this is a MIXED-KIND list (documents ·
 *  patches · profiles, see library.js), so a Kind facet joins Key/Source/
 *  Composer (blank for non-document kinds) and rowActionsFor keeps
 *  Duplicate to documents only — duplicateInLibrary assumes a progression
 *  shape. Front doors are hidden (the document toolbar carries the four),
 *  and delete uses the undo-toast idiom. */
function LibraryPanel({ library, onOpen, onRename, onDuplicate, onDelete }) {
  const hostRef = useRef(null);
  const browserRef = useRef(null);
  const cb = useRef({});
  cb.current = { onOpen, onRename, onDuplicate, onDelete };
  useEffect(() => {
    browserRef.current = createLibraryBrowser(hostRef.current, {
      items: library,
      title: "Library",
      favorites: false,
      frontDoors: false,
      keys: { name: "title", date: "savedAt" },
      sorts: [
        { value: "recent", label: "Recent" },
        { value: "name", label: "Name A–Z" },
        { value: "key", label: "Key" },
      ],
      facets: [
        { key: "kind", label: "Kind", kind: "multi", badge: true,
          accessor: (it) => (it.kind === "patch" ? "Patch" : it.kind === "profile" ? "Profile" : "Document") },
        { key: "key", label: "Key", kind: "multi", accessor: (it) => it.key || "—" },
        { key: "source", label: "Source", kind: "multi", defaultOpen: false, accessor: (it) => it.source || "edited" },
        { key: "composer", label: "Composer", kind: "multi", defaultOpen: false, accessor: (it) => (it.composer || "").trim() || "—" },
      ],
      rowActionsFor: (it) => (it.kind === "document" ? ["open", "rename", "duplicate", "delete"] : ["open", "rename", "delete"]),
      emptyHint: "Save a progression, patch, or profile to start your library.",
      onOpen: (it) => cb.current.onOpen(it),
      onRename: (it, name) => cb.current.onRename(it, name),
      onDuplicate: (copy) => cb.current.onDuplicate(copy),
      onDelete: (it) => cb.current.onDelete(it),
    });
    return () => browserRef.current?.destroy();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { browserRef.current?.setItems(library); }, [library]);
  return <div ref={hostRef} style={{ height: "min(52vh, 460px)", border: "1px solid var(--es-border)", borderRadius: "var(--es-radius-md)", overflow: "hidden", background: "var(--es-bg)" }} />;
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

/** A chord-scale pad grid (shared @enkerli/ui pitch-grid) as a React island.
 *  `sig` gates the (otherwise per-frame) update to per-chord, so playback at
 *  10 Hz doesn't re-render the SVG every tick. */
function PadGrid({ rootPc, roles, now, layout, sig, cellSize = 30 }) {
  const hostRef = useRef(null);
  const gridRef = useRef(null);
  useEffect(() => {
    gridRef.current = createPitchGrid(hostRef.current, {
      layout, rows: 5, cols: 5, baseMidi: 48 + rootPc,
      rowStep: layout === "hex" ? 4 : 5, colStep: 1, // hex = Exquis; square = fourths
      roles, now: now ?? new Set(), labels: "note", cellSize,
    });
    return () => gridRef.current.destroy();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    gridRef.current?.update({ layout, baseMidi: 48 + rootPc, rowStep: layout === "hex" ? 4 : 5, roles, now: now ?? new Set() });
  }, [sig, layout]); // eslint-disable-line react-hooks/exhaustive-deps -- sig captures rootPc/roles/now
  return <div ref={hostRef} />;
}

/** Stable per-chord signature for a grid data object (root + roles + sounding). */
function gridSig(grid) {
  if (!grid) return "none";
  const roles = [...grid.roles].map(([k, v]) => `${k}${v[0]}`).join("");
  return `${grid.rootPc}:${roles}:${[...(grid.now ?? [])].join(",")}`;
}

/** Now-playing chord card — follows the playhead (Q5 live): the sounding chord
 *  big, its lit scale grid, and what's next up. */
function NowPlaying({ current, next, grid, layout, onLayout }) {
  return (
    <div className="es-panel" style={{ marginTop: "var(--es-space-3)", display: "flex", gap: "var(--es-space-4)", alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ minWidth: 110 }}>
        <div className="es-eyebrow">now playing</div>
        <div style={{ fontSize: "var(--es-text-xl)", fontWeight: 700, lineHeight: 1.1 }}>{current.primary}</div>
        <div style={{ color: "var(--es-fg-muted)", fontFamily: "var(--es-font-mono)" }}>{current.secondary}</div>
      </div>
      {grid && <PadGrid rootPc={grid.rootPc} roles={grid.roles} now={grid.now} layout={layout} sig={gridSig(grid)} />}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 200 }}>
        {current.scale && <span style={{ fontSize: "var(--es-text-sm)", color: "var(--es-fg-2)" }}>{current.scale}</span>}
        <div style={{ display: "flex", gap: 4 }}>
          {[["square", "▦ square"], ["hex", "⬡ hex"]].map(([l, g]) => (
            <button key={l} className={`es-btn es-small ${layout === l ? "es-primary" : ""}`} onClick={() => onLayout(l)}>{g}</button>
          ))}
        </div>
      </div>
      {next && (
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div className="es-eyebrow">next up</div>
          <div style={{ fontSize: "var(--es-text-lg)", fontWeight: 600, color: "var(--es-fg-2)" }}>{next.primary}</div>
          <div style={{ color: "var(--es-fg-muted)", fontFamily: "var(--es-font-mono)", fontSize: "var(--es-text-sm)" }}>{next.secondary}</div>
        </div>
      )}
    </div>
  );
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
  const appRef = useRef(null); // the shared frame's density target (.es-dense)
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
  const [display, setDisplay] = useState("functional"); // chip reading: functional (degrees) | absolute (chord names)
  const [showImplied, setShowImplied] = useState(false); // recognize implied key areas (display analysis, any progression)
  const [showMotion, setShowMotion] = useState("off"); // transition-character overlay (Q4): off | notable | all
  const [gridLayout, setGridLayout] = useState("square"); // pad-grid geometry (Q5): square | hex (shared: inspector + now-playing)
  const [resetArmed, setResetArmed] = useState(false); // two-tap confirm (WKWebView has no window.confirm)
  const [pendingProfile, setPendingProfile] = useState(null); // a loaded profile awaiting Replace/Merge
  const [profileError, setProfileError] = useState(null);
  const [depthOpen, setDepthOpen] = useState(false); // "Depth · advanced" generator group (Context/Reharm/Modulation)
  const fileKindRef = useRef("profile"); // routes a native "fileOpened" to the right loader (profile | midi)
  const [library, setLibrary] = useState(loadLibrary); // the musician's saved things (documents · patches · profiles)
  const [docMeta, setDocMeta] = useState({ title: "", composer: "", source: "generated" }); // current document
  const [libraryOpen, setLibraryOpen] = useState(false); // the shared-frame Library drawer
  const [importOpen, setImportOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [docError, setDocError] = useState(null);
  const [showAllWeights, setShowAllWeights] = useState(false); // full curation ledger (one disclosure away)
  const [curFrom, setCurFrom] = useState("any"); // filter-by-degree (Q6): origin
  const [curTo, setCurTo] = useState("any"); //                          destination
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
        // Text kind (profile): decode as UTF-8 (labels carry ♭/♯/→).
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
  const smartStrength = SMART_LEVELS[smart] ?? 0;
  const labels = useMemo(
    () => generateSections(table[mode], mode,
      { length: chordSlots(rhythm), seed, curation, method, temperature, startFrom, variety, trigrams: trigrams[mode], smart: smartStrength }, extensions),
    [mode, rhythm, seed, curation, method, temperature, startFrom, variety, smartStrength, extensions],
  );
  // Reharm (Track C): probabilistic tritone / backdoor substitutions over the
  // generated labels. Count-preserving (so the rhythm slots still line up) and
  // seeded, so it's deterministic and part of the genId. The curation walk
  // stays on the pre-reharm labels; this is an output transform, like editing.
  const reharmedLabels = useMemo(
    () => (reharm === "off" ? labels
      : applySubstitutions(labels, { mode, seed, allowInsertions: false, ...REHARM_LEVELS[reharm] }).labels),
    [labels, reharm, mode, seed],
  );
  // Key changes (Q2): the progression splits into SECTIONS with their own keys;
  // each section realizes the (unchanged) labels against its key, so the
  // modulation reads in the new key's degrees and the editor shows a quiet
  // "→ G major" divider. Sounding/export are identical to a single key.
  //   · "4"/"8" — mechanical: a new corpus-common related key every N bars
  //     (real SECTIONS, the bold distinction). Implied modulation is NOT here —
  //     it's a display toggle (`showImplied`) that annotates any progression.
  const intervalToKey = (interval, m) => ({ tonic: tonicAtInterval(tonic, interval), mode: m });
  const baseProg = useMemo(() => {
    if (modulate === "off") return buildProgression(reharmedLabels, rhythm, { tonic, mode });
    const n = Number(modulate);
    const plan = planModulation(Math.ceil(rhythm.length / n), mode, seed);
    const sectionKeys = plan.map((m) => intervalToKey(m.interval, m.mode));
    return buildProgressionSectioned(reharmedLabels, rhythm, { tonic, mode }, (b) => sectionKeys[Math.floor(b / n)]);
  }, [reharmedLabels, rhythm, tonic, mode, modulate, seed]);
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
  // Implied-modulation key areas (flat chord-index space) — the subtle, quiet
  // re-spelling annotation for the editor + per-chord functional key. Computed
  // from the DISPLAYED chords' home-key functional degrees, so it works on any
  // progression — generated, hand-edited, or imported/pasted. The local tonic
  // takes its spelling from the actual target chord's root (so a C♯ minor area
  // reads "C♯m", not a frame-guessed "D♭m"). Empty unless `showImplied`.
  const impliedAreas = useMemo(() => {
    if (!showImplied) return [];
    const degLabels = chords.map((c) => functionalOfRealized(c, { tonic, mode }) ?? c.label);
    return analyzeKeyAreas(degLabels, mode).map((a) => ({
      start: a.start, end: a.end,
      key: { tonic: chords[a.end]?.rootName ?? tonicAtInterval(tonic, a.interval), mode: a.mode },
    }));
  }, [showImplied, chords, tonic, mode]);
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

  // The standalone is "in plugin" (juce bridge) but has no external host
  // transport, so it needs the local WebAudio Play button — same as the
  // browser. The AUv3 in a DAW is host-driven (no local Play).
  const isStandalone = IN_PLUGIN && /standalone/i.test(runtime?.wrapper ?? "");
  const showLocalPlay = !IN_PLUGIN || isStandalone;
  // Standalone MIDI output — drive an external synth (or another suite app)
  // instead of the internal Web Audio preview. Same gate as the local Play.
  const midiOutUi = useMidiOut(showLocalPlay);
  // Chord-follow source: the local player when it's running (browser/standalone),
  // else the host transport (AUv3 in a DAW).
  const playIdx = IN_PLUGIN && !playing ? hostPlayhead : playhead;

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
  // The inline ghost (Q1): the held live-MIDI chord, rendered at the write
  // cursor inside the editor. ✓ writes it (locking the played voicing) and
  // advances; the options disclosure carries completions + alternate voicings.
  // The editor does the insertion at its cursor; `onConsumed` clears the latch.
  const ghost = useMemo(() => {
    if (!IN_PLUGIN || !latched) return null;
    return {
      label: latched.symbol,
      detail: latched.notes.map((n) => midiName(n)).join(" "),
      confirm: { token: latched.symbol, voicing: latched.notes },
      options: [
        ...completions.map((s) => ({ label: s.symbol, detail: "+ " + midiName(s.added), insert: { token: s.symbol, voicing: s.notes } })),
        ...playedVoicings.map((s) => ({ label: s.label, detail: `${s.notes.map((n) => midiName(n)).join(" ")} · ${s.movement} st`, insert: { token: latched.symbol, voicing: s.notes } })),
      ],
      onConsumed: () => setLatched(null),
    };
  }, [latched, completions, playedVoicings]);
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

  /** Rate the transition INTO chord `i` (👍 dir +1 / 👎 dir −1): nudges the
   *  corpus weight for the move prev→this. The first chord has no incoming
   *  transition. */
  // Functional degrees read in each chord's OWN section key (Q2/Q6) — so a V→I
  // in the G bridge writes to the same key-independent "V7→Imaj7" weight as in
  // the C verse (the one functional ledger).
  function keyAt(i) {
    const area = impliedAreas.find((a) => i >= a.start && i <= a.end);
    return area?.key ?? chords[i]?.secKey ?? { tonic, mode };
  }
  function rateIncoming(i, dir) {
    if (i <= 0 || i >= chords.length) return;
    const from = functionalOfRealized(chords[i - 1], keyAt(i - 1));
    const to = functionalOfRealized(chords[i], keyAt(i));
    if (!from || !to || from === to) return;
    setCuration((c) => adjustTransition(c, from, to, dir > 0 ? TRANSITION_STEP : 1 / TRANSITION_STEP));
  }
  /** Current multiplier on the transition into chord `i` (drives 👍/👎 state). */
  function incomingRating(i) {
    if (i <= 0 || i >= chords.length) return 1;
    const from = functionalOfRealized(chords[i - 1], keyAt(i - 1));
    const to = functionalOfRealized(chords[i], keyAt(i));
    return from && to ? multiplierFor(curation, from, to) : 1;
  }

  /** Lineage for the inspector's "why this chord": ties curation to rationale
   *  (Step 05) — when the move into chord `i` is one you've biased, say so, so
   *  curation and "why this chord" are the same story. Neutral moves return
   *  null (no invented rationale). */
  function chordRationale(i) {
    if (i <= 0 || i >= chords.length) return null;
    const from = functionalOfRealized(chords[i - 1], keyAt(i - 1));
    const to = functionalOfRealized(chords[i], keyAt(i));
    if (!from || !to || from === to) return null;
    const mult = multiplierFor(curation, from, to);
    if (mult > 1.001) return `You favor ${from}→${to} — boosted ×${mult.toFixed(2)} in your profile.`;
    if (mult < 0.999) return `You’ve eased off ${from}→${to} — softened ÷${(1 / mult).toFixed(2)} in your profile.`;
    return null;
  }

  // Profile-as-shape (Step 05): the strongest few boosts/suppressions + count.
  const profileShape = useMemo(() => profileSummary(curation, { max: 4 }), [curation]);

  /** Chord-scale line for the inspector (Track C / design Q5): the scale a
   *  player draws on over chord `i`, with each option's avoid notes spelled
   *  out — "Lydian · or Ionian (avoid F)" / "Mixolydian (avoid F)". The
   *  headline prefers the avoid-note-free scale; alternates are demoted but
   *  still call out their own avoid notes. */
  function chordScaleText(i) {
    const ch = chords[i];
    if (!ch || ch.rootPc == null || !ch.pcs?.length) return null;
    const cs = chordScaleFor(ch.rootPc, ch.pcs);
    if (!cs) return null;
    const keyPc = TONIC_PC[keyAt(i).tonic] ?? 0;
    const avoidOf = (avoid) => (avoid.length ? ` (avoid ${avoid.map((pc) => spellRoot(pc, keyPc)).join(" ")})` : "");
    const head = `${cs.scaleName}${avoidOf(cs.avoid)}`;
    const alts = cs.alternates.length
      ? ` · or ${cs.alternates.map((a) => `${a.scaleName}${avoidOf(a.avoid)}`).join(", ")}` : "";
    return `${head}${alts}`;
  }

  /** Chord-scale grid data for the inspector hero (Q5): the chord's root + a
   *  per-pc role map (chord / scale / tension / avoid) for the pad grid. */
  function scaleGridOf(i) {
    const ch = chords[i];
    if (!ch || ch.rootPc == null || !ch.pcs?.length) return null;
    const cs = chordScaleFor(ch.rootPc, ch.pcs);
    if (!cs) return null;
    const roles = new Map();
    for (const pc of cs.scalePcs) roles.set(pc, "scale");
    for (const pc of cs.tensions) roles.set(pc, "tension");
    for (const pc of cs.avoid) roles.set(pc, "avoid");
    for (const pc of ch.pcs) roles.set(pc, "chord"); // chord tones win
    // Live: when this chord is the one sounding now, pulse its tones (the editor
    // re-renders on the playhead, so the grid lights as playback reaches it).
    const now = i === playIdx && playIdx >= 0 ? new Set(ch.pcs) : undefined;
    return { rootPc: ch.rootPc, roles, now };
  }

  /** Card data for a chord (now-playing / next-up): the two readings + scale. */
  function chordCard(i) {
    const ch = chords[i];
    if (!ch) return null;
    const degree = functionalOfRealized(ch, keyAt(i)) || ch.label;
    const name = ch.symbol;
    return {
      primary: display === "absolute" ? name : degree,
      secondary: display === "absolute" ? degree : name,
      scale: chordScaleText(i),
    };
  }

  /** Motion overlay (Q4): the root-motion character INTO chord `i` — "fifth"
   *  (cadence) / "step" — or null. Honors the density ("notable" hides ordinary
   *  diatonic steps; "all" shows every step/fifth). */
  function motionOf(i) {
    if (showMotion === "off" || i <= 0 || i >= chords.length) return null;
    const a = chords[i - 1], b = chords[i];
    if (a?.rootPc == null || b?.rootPc == null) return null;
    const k = keyAt(i);
    const { motion, notable } = transitionMotion(a.rootPc, b.rootPc, TONIC_PC[k.tonic] ?? 0, k.mode);
    if (motion !== "fifth" && motion !== "step") return null;
    if (showMotion === "notable" && !notable) return null;
    return motion;
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
  /** Keep the current generator settings in the Library (kind: patch) — the
   *  shared drawer replaced the old file-based patch Save…/Load… segment;
   *  the same self-identified proggenie-patch JSON now travels as the
   *  envelope payload (wrapPatch) instead of a loose file. */
  function savePatchToLibrary() {
    const savedAt = new Date().toISOString();
    const entry = {
      id: newId(), kind: "patch", savedAt,
      title: `Patch — ${tonic} ${mode} · ${bars} bars · ${method}`,
      file: { format: "proggenie-patch", version: 1, savedAt, params: currentPatch() },
    };
    setLibrary((list) => [entry, ...list]);
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
      id: newId(), kind: "document", title, composer: (docMeta.composer || "").trim(),
      source: docMeta.source || "edited", savedAt: new Date().toISOString(),
      key: `${tonic} ${mode}`, bars: docBarCount, prog: clone(effectiveProg),
    };
    setLibrary((list) => [entry, ...list]);
    setDocMeta((m) => ({ ...m, title, source: "saved" }));
  }

  /** Keep a snapshot of the curation profile in the Library (kind: profile).
   *  File export/import stays in the curation panel for cross-device sharing. */
  function saveProfileToLibrary() {
    const savedAt = new Date().toISOString();
    const n = Object.keys(curation.multipliers).length;
    const entry = {
      id: newId(), kind: "profile", savedAt,
      title: `Profile — ${n} weight${n === 1 ? "" : "s"}`,
      file: JSON.parse(exportCuration(curation, { savedAt })),
    };
    setLibrary((list) => [entry, ...list]);
  }

  /** Recall a saved progression as the working document. */
  function openFromLibrary(entry) {
    loadProgression(clone(entry.prog), { title: entry.title, composer: entry.composer, source: "library" });
  }
  function renameInLibrary(entry, title) {
    setLibrary((list) => list.map((e) => (e.id === entry.id ? { ...e, title } : e)));
  }
  function duplicateInLibrary(entry) {
    const copy = {
      id: newId(), title: `${entry.title} copy`, composer: entry.composer || "",
      source: "edited", savedAt: new Date().toISOString(),
      key: entry.key, bars: entry.bars, prog: clone(entry.prog),
    };
    setLibrary((list) => [copy, ...list]);
  }
  /** Delete with the suite's one destructive idiom (Q4): optimistic + undo toast. */
  function deleteFromLibrary(entry) {
    const idx = library.findIndex((e) => e.id === entry.id);
    setLibrary((list) => list.filter((e) => e.id !== entry.id));
    toast({
      text: `Deleted “${entry.title}”`,
      undo: () => setLibrary((list) => {
        if (list.some((e) => e.id === entry.id)) return list;
        const n = [...list]; n.splice(Math.min(idx < 0 ? 0 : idx, n.length), 0, entry); return n;
      }),
    });
  }

  /** The Library panel's Open, dispatched by kind: documents open as the
   *  working progression; patches apply their generator params; profiles
   *  stage as the pending Replace/Merge (never silently clobber taste). */
  function recallFromLibrary(entry) {
    if (entry.kind === "patch") {
      applyPatchText(JSON.stringify(entry.file));
      setLibraryOpen(false);
    } else if (entry.kind === "profile") {
      receiveProfileText(JSON.stringify(entry.file));
      setShowCuration(true); // the Replace/Merge staging lives in the curation panel
      setLibraryOpen(false);
    } else {
      openFromLibrary(entry);
    }
  }

  /** Import typed/pasted bar notation (e.g. "Dm7 G7 | Cmaj7") as the working
   *  document, realized in the current key. A line break reads as a bar
   *  boundary too, so multi-line lead sheets paste in naturally. */
  function importPaste() {
    const text = (pasteText || "").trim();
    if (!text) { setDocError("Type or paste some chords first (e.g. Dm7 G7 | Cmaj7)."); return; }
    const prog = parseLeadsheet(text.replace(/\n+/g, " | "), { tonic, mode });
    const any = prog?.sections?.some((s) => s.bars.some((b) => b.chords?.length));
    if (!any) { setDocError("Couldn't read any chords from that — use bar notation like Dm7 G7 | Cmaj7."); return; }
    loadProgression(prog, { source: "imported" });
    // You typed chord names, so show chord names (you can still flip to degrees).
    if (/[A-G]/.test(text)) setDisplay("absolute");
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

  // Cluster slot 2 (MIDI) — memoized so playback's 10 Hz re-renders don't
  // re-render the cluster (update() would close an open popover). Hidden
  // in-DAW (the host owns routing); "No Web MIDI" is a chip state, not
  // a hidden control.
  const clusterMidi = useMemo(() => {
    if (!showLocalPlay) return null;
    // JUCE standalone (iPad/desktop): MIDI is native — the C++ side owns
    // routing (the wrapper's audio/MIDI settings), so "No Web MIDI" would
    // be false. WebMIDI only ever applies in a browser.
    if (IN_PLUGIN) return { native: true, badge: isStandalone ? "Standalone" : undefined };
    if (!midiOut.midiSupported() || midiOutUi.error) return { unavailable: true };
    return {
      outputs: midiOutUi.outputs.map((p) => ({ id: p.id, name: p.name })),
      selectedOutId: midiOutUi.selectedId,
      noneOption: "Internal (Web Audio)",
      onSelectOut: midiOutUi.select,
      badge: isStandalone ? "Standalone" : undefined,
    };
  }, [showLocalPlay, midiOutUi.outputs, midiOutUi.selectedId, midiOutUi.error, midiOutUi.select, isStandalone]);

  return (
    <div className="es-app" ref={appRef}>
      {/* The shared frame: brand · (transport is host-owned) · the global
          cluster — theme · MIDI · density · Library, same slots as every
          suite app. */}
      <div className="es-shellbar">
        <div className="brand">
          <img src={appIcon} alt="" />
          <span className="nm">Progression Studio</span>
          <span className="k">ProgGenie</span>
        </div>
        <div className="mid"></div>
        <GlobalClusterMount midi={clusterMidi} densityTargetRef={appRef}
          libCount={library.length} onLibToggle={() => setLibraryOpen((o) => !o)} />
      </div>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "var(--es-space-4)" }}>
        <header style={{ marginBottom: "var(--es-space-4)" }}>
          <p style={{ color: "var(--es-fg-muted)", fontSize: "var(--es-text-sm)", margin: 0 }}>
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
            {/* Open moved to the shared-frame Library (cluster, top right,
                Design pass · Q2's LibraryBrowser) — the doc strip keeps the
                input paths plus the save affordance the browser doesn't own. */}
            <button className="es-btn es-small" title="Blank the sheet — start a new progression from scratch"
              onClick={() => { handleClear(); setDocMeta({ title: "", composer: "", source: "new" }); }}>New</button>
            <button className="es-btn es-small" title="Type or paste a leadsheet in bar notation, or open a .mid file" aria-pressed={importOpen}
              onClick={() => { setImportOpen((o) => !o); setLibraryOpen(false); }}>Type / Import…</button>
            <button className="es-btn es-small es-primary" title="Save this progression to your library" onClick={saveToLibrary}>Save to library</button>
          </div>
          {docError && <p style={{ color: "var(--es-danger, #b3261e)", fontSize: "var(--es-text-sm)", margin: "var(--es-space-2) 0 0" }}>{docError}</p>}

          {importOpen && (
            <div style={{ marginTop: "var(--es-space-3)", paddingTop: "var(--es-space-3)", borderTop: "1px solid var(--es-border)" }}>
              <label style={{ ...LBL, width: "100%" }}>Type or paste a leadsheet — bar notation (bars split on <code>|</code>, repeat a bar with <code>%</code>; several lines are fine)
                <textarea className="es-control" rows={4} style={{ width: "100%", fontFamily: "var(--es-font-mono, monospace)" }}
                  placeholder={"Dm7 G7 | Cmaj7 | A7 | Dm7\nCmaj7 | Am7 | Dm7 G7 | Cmaj7 | %"}
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
              <LibraryPanel library={library}
                onOpen={recallFromLibrary}
                onRename={renameInLibrary}
                onDuplicate={duplicateInLibrary}
                onDelete={deleteFromLibrary} />
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--es-space-3)", alignItems: "stretch", marginBottom: "var(--es-space-3)" }}>
          {/* Q3 — Key/Mode stay grouped for now; they fold into the section
              header once sections own their key (Q2). */}
          <GenGroup label="Key">
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
          </GenGroup>

          <GenGroup label="Length & pacing">
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
            <label style={LBL}>Start from
              <select className="es-control" value={startFrom ?? ""} title="Seed the walk from an arbitrary chord"
                onChange={(e) => setStartFrom(e.target.value || null)}>
                <option value="">tonic (auto)</option>
                {startOptions.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </label>
          </GenGroup>

          {/* Q3 — "Sound" → "Voice" (it's about voices, not timbre). Channels
              stays here too: it divides the output BY VOICE (Alex). */}
          <GenGroup label="Voice">
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
                title="Route the voices to MIDI channels — divides the output by voice">
                <option value="single">single (1)</option>
                <option value="split">bass 1 · chords 2</option>
                <option value="perVoice">per voice (1…)</option>
              </select>
            </label>
          </GenGroup>

          {/* Q3 — the three occasionally-set depth knobs live behind advanced. */}
          <GenGroup label="Depth" advanced open={depthOpen} onToggle={() => setDepthOpen((o) => !o)}>
            <label style={LBL}>Context
              <select className="es-control" value={smart} onChange={(e) => setSmart(e.target.value)}
                title="Variable-order: where the corpus knows what tends to follow a two-chord context, lean on it (longer-range phrasing)">
                <option value="off">1 chord</option>
                <option value="on">2 chords</option>
                <option value="deep">2 chords (deep)</option>
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
                title="Mechanical key changes to a related key every N bars (real sections). For reading the harmony's own key areas, use 'implied keys' by the leadsheet.">
                <option value="off">none</option>
                <option value="4">every 4 bars</option>
                <option value="8">every 8 bars</option>
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
          {/* Patch save/recall moved to the Library (drawer, kind: patch);
              MIDI out moved to the cluster's chip. */}
          <button className="es-btn es-small" title="Keep these generator settings in the Library (recall them from the drawer)"
            onClick={savePatchToLibrary}>Save patch</button>
          {profileError && <span style={{ color: "var(--es-danger, #b3261e)", fontSize: "var(--es-text-sm)" }}>{profileError}</span>}
          <span style={{ flex: 1 }} />
          {showLocalPlay && <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: "var(--es-text-sm)" }}>Tempo
            <input className="es-control" style={{ width: 64 }} type="number" min="40" max="300" value={bpm} onChange={(e) => setBpm(Number(e.target.value))} />
          </label>}
          {showLocalPlay && <button className="es-btn es-primary" onClick={() => (playing ? stop() : play(voicings, bpm))}>{playing ? "Stop" : "Play"}</button>}
          <button className="es-btn" onClick={() => navigator.clipboard?.writeText(chords.map((c) => c.symbol).join(" | "))}>Copy chords</button>
          <button className="es-btn" title="Publish this progression on the suite bus — a looping GloriArp groove in the Workspace tab adopts it at its next pass"
            onClick={() => {
              const prog = progressionFromVoicings(voicings, { tonic, mode });
              if (publishProgression(prog)) toast({ text: "Progression on the suite bus — GloriArp in the Workspace picks it up" });
              else toast({ text: "Nothing to publish yet (or no BroadcastChannel here)" });
            }}>
            → Workspace
          </button>
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
          {/* Theme moved to the cluster (slot 1, top right) — the frame owns it. */}
        </div>

        {/* Now-playing chord card — follows the playhead during playback (Q5
            live): the sounding chord, its lit scale grid, and what's next. */}
        {playIdx >= 0 && playIdx < chords.length && (
          <NowPlaying
            current={chordCard(playIdx)}
            next={playIdx + 1 < chords.length ? chordCard(playIdx + 1) : null}
            grid={scaleGridOf(playIdx)}
            layout={gridLayout}
            onLayout={setGridLayout}
          />
        )}

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
            {/* Global functional/absolute toggle (the critique's cross-cutting
                call): show the leadsheet as degrees (Imaj7) or chord names
                (Cmaj7). Composing thinks in degrees; reading/entering a known
                tune thinks in names. */}
            <button className="es-btn es-small" aria-pressed={display === "absolute"}
              title="Show chords as Roman degrees or as chord names"
              onClick={() => setDisplay((d) => (d === "absolute" ? "functional" : "absolute"))}>
              {display === "absolute" ? "Cmaj7 ⇄ I" : "I ⇄ Cmaj7"}
            </button>
            {/* Read the harmony's own key areas (secondary dominants / ii–V–Is)
                and re-spell them in their local key — works on any progression,
                generated or pasted/imported. A display toggle, not generation. */}
            <button className="es-btn es-small" aria-pressed={showImplied}
              title="Recognize implied key areas (secondary dominants / tonicizations) and re-spell them"
              onClick={() => setShowImplied((s) => !s)}>
              {showImplied ? "◆ implied keys" : "◇ implied keys"}
            </button>
            {/* Q4 — opt-in motion overlay: ↝ for a fifth (cadence), underline for
                a step. "notable" hides ordinary diatonic steps. */}
            <label style={{ display: "flex", gap: 4, alignItems: "center", fontSize: "var(--es-text-sm)" }} title="Mark root-motion character: ↝ a fifth (cadence), underline a step">Motion
              <select className="es-control" style={{ width: "auto" }} value={showMotion} onChange={(e) => setShowMotion(e.target.value)}>
                <option value="off">off</option>
                <option value="notable">notable</option>
                <option value="all">all</option>
              </select>
            </label>
            {edited && edited.genId === genId && <span style={{ color: "var(--es-accent)", fontSize: "var(--es-text-sm)" }}>· edited</span>}
            {edited && edited.genId === genId && <button className="es-btn es-small" onClick={() => { setEdited(null); setOpCount((n) => n + 1); }}>Reset to generated</button>}
            <span style={{ marginLeft: "auto", color: "var(--es-fg-muted)", fontSize: "var(--es-text-sm)" }}>
              {tool === "edit" ? "tap a chord to open it · carets insert · grip moves"
                : "tap chords to rate the move into each"}
            </span>
          </div>
          {/* Empty-state prompt — makes the text-entry path discoverable: a
              blank sheet invites typing/pasting a leadsheet (not only the
              Import disclosure) or generating. */}
          {chords.length === 0 && (
            <div style={{ display: "flex", gap: "var(--es-space-2)", alignItems: "center", flexWrap: "wrap", padding: "var(--es-space-3)", marginBottom: "var(--es-space-2)", border: "1px dashed var(--es-border)", borderRadius: "var(--es-radius-sm)", color: "var(--es-fg-muted)", fontSize: "var(--es-text-sm)" }}>
              <span>Empty sheet —</span>
              <button className="es-btn es-small es-primary" onClick={() => { setSeed((s) => s + 1); setExtensions([]); }}>New take</button>
              <span>or</span>
              <button className="es-btn es-small" onClick={() => { setImportOpen(true); setLibraryOpen(false); }}>Type / paste a leadsheet…</button>
              <span style={{ fontSize: "var(--es-text-xs)" }}>(bar notation: <code>Dm7 G7 | Cmaj7</code>), or play MIDI.</span>
            </div>
          )}
          <LeadsheetEdit key={genId} progression={effectiveProg} activeIndex={playIdx}
            onEdit={(p) => setEdited({ genId, prog: p })} suggest={suggestNext}
            onRate={rateIncoming} ratingOf={incomingRating} rationaleOf={chordRationale}
            scaleOf={chordScaleText} scaleGridOf={scaleGridOf} ratingSignal={curation} tool={tool} display={display} keyAreas={impliedAreas} ghost={ghost}
            motionOf={motionOf} motionSignal={`${showMotion}|${showImplied}`}
            gridLayout={gridLayout} onGridLayout={setGridLayout} />


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
              beat={IN_PLUGIN && !playing ? hostBeat : playhead >= 0 ? (chordSpans.starts[playhead] ?? 0) : -1}
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
                {showAllWeights && (() => {
                  const { origins, dests } = transitionDegrees(curatedEntries);
                  const filtered = filterWeights(curatedEntries, curFrom, curTo);
                  return (
                    <div style={{ marginTop: "var(--es-space-2)" }}>
                      {/* Q6 — filter the one functional ledger by degree; because
                          weights are key-independent, it holds in every section. */}
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--es-space-2)", flexWrap: "wrap", marginBottom: "var(--es-space-2)" }}>
                        <label style={{ display: "flex", gap: 4, alignItems: "center", fontSize: "var(--es-text-sm)" }}>from
                          <select className="es-control" style={{ width: "auto" }} value={curFrom} onChange={(e) => setCurFrom(e.target.value)}>
                            <option value="any">any</option>
                            {origins.map((d) => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </label>
                        <span className="es-num" style={{ color: "var(--es-fg-muted)" }}>→</span>
                        <label style={{ display: "flex", gap: 4, alignItems: "center", fontSize: "var(--es-text-sm)" }}>into
                          <select className="es-control" style={{ width: "auto" }} value={curTo} onChange={(e) => setCurTo(e.target.value)}>
                            <option value="any">any</option>
                            {dests.map((d) => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </label>
                        <span style={{ fontSize: "var(--es-text-xs)", color: "var(--es-fg-muted)" }}>
                          {filtered.length} of {curatedEntries.length} weight{curatedEntries.length === 1 ? "" : "s"} · applies in every section's key
                        </span>
                        {(curFrom !== "any" || curTo !== "any") &&
                          <button className="es-btn es-small" onClick={() => { setCurFrom("any"); setCurTo("any"); }}>clear</button>}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "var(--es-space-2)" }}>
                        {filtered.map(([key, value]) => (
                          <div key={key} style={{ display: "flex", alignItems: "center", gap: "var(--es-space-2)", fontSize: "var(--es-text-sm)" }}>
                            <span className="es-num" style={{ flex: 1 }}>{key}</span>
                            <MultiplierBadge value={value} />
                            <button className="es-btn es-small" aria-label={`Reset ${key}`} title="Reset to corpus weight"
                              onClick={() => setCuration((c) => resetTransition(c, key))}>↺</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </>
            )}

            <div style={{ display: "flex", gap: "var(--es-space-2)", marginTop: "var(--es-space-4)", flexWrap: "wrap", alignItems: "center" }}>
              <button className="es-btn es-small" title="Copy the profile JSON to the clipboard"
                onClick={() => navigator.clipboard?.writeText(exportCuration(curation, { savedAt: new Date().toISOString() }))}>
                Copy profile
              </button>
              <button className="es-btn es-small" title="Keep a snapshot of this profile in the Library"
                onClick={saveProfileToLibrary}>Save to Library</button>
              <button className="es-btn es-small" title="Save the profile to a file (share it across devices)" onClick={saveProfile}>Save file…</button>
              <button className="es-btn es-small" title="Load a profile file" onClick={loadProfile}>Load file…</button>
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
