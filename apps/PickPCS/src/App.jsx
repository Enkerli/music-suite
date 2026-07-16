import React, { useEffect, useMemo, useRef, useState } from "react";
import { pushScale, midiOutState, rememberOutput } from "./scale-push.js";
import { broadcastScale } from "./control.js";
import { createGlobalCluster } from "@enkerli/ui/global-cluster";
import { createLibraryBrowser } from "@enkerli/ui/library-browser";
import { toast } from "@enkerli/ui/toast";
import appIcon from "@enkerli/ui/icons/pickpcs.svg";
// Theory logic now comes from the suite's shared core (@enkerli/theory).
// The previous self-contained implementation is preserved unchanged in
// ./App.local.jsx until the migration is finalized.
import {
  chromaticToFifthsIndex,
  degreeChords,
  fifthsIndexToChromatic,
  pcsToBitmask,
  scaleFamily,
} from "@enkerli/theory";

const NOTE_NAMES_FIFTHS = ["C", "G", "D", "A", "E", "B", "F#", "C#", "Ab", "Eb", "Bb", "F"];
const BROWSER_RINGS = [8, 7, 6, 5, 4, 3];

// ── The shared frame ────────────────────────────────────────────────────
// Saved scale sets — plain JSON in localStorage (the app has no other
// persistence; the @enkerli/library envelope can wrap these later).
const LIB_KEY = "pickpcs.library.v1";
function loadScaleLib() {
  try { const a = JSON.parse(globalThis.localStorage?.getItem(LIB_KEY) ?? "null"); return Array.isArray(a) ? a : []; }
  catch { return []; }
}
function saveScaleLib(list) {
  try { globalThis.localStorage?.setItem(LIB_KEY, JSON.stringify(list)); } catch { /* private mode */ }
}

/** The global cluster (theme · MIDI · Library — density omitted: the app has
 *  no dense control surface) as a React island. */
function GlobalClusterMount({ midi, libCount, onLibToggle }) {
  const hostRef = useRef(null);
  const clusterRef = useRef(null);
  const onLibRef = useRef(onLibToggle); onLibRef.current = onLibToggle;
  const lib = (count) => ({ count, onToggle: () => onLibRef.current() });
  useEffect(() => {
    clusterRef.current = createGlobalCluster(hostRef.current, { midi, library: lib(libCount) });
    return () => clusterRef.current.destroy();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- mounts once
  useEffect(() => { clusterRef.current?.update({ midi, library: lib(libCount) }); }, [midi, libCount]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div ref={hostRef} />;
}

/** The Library — saved scale sets — as the shared @enkerli/ui LibraryBrowser
 *  (Design pass · Q2), the same pattern ProgGenie/Serpe/MIDIcurator use. */
function ScaleLibraryPanel({ items, onSave, onOpen, onRename, onDelete }) {
  const hostRef = useRef(null);
  const browserRef = useRef(null);
  const cb = useRef({});
  cb.current = { onOpen, onRename, onDelete };
  useEffect(() => {
    browserRef.current = createLibraryBrowser(hostRef.current, {
      items,
      title: "Library",
      favorites: false,
      frontDoors: false,
      keys: { name: "name", date: "savedAt" },
      sorts: [{ value: "recent", label: "Recent" }, { value: "name", label: "Name A–Z" }],
      facets: [{ key: "k", label: "Notes", kind: "multi", badge: true, accessor: (it) => `${it.k}-note` }],
      rowActions: ["open", "rename", "delete"],
      emptyHint: "Save the current scale set to start your library.",
      onOpen: (it) => cb.current.onOpen(it),
      onRename: (it, name) => cb.current.onRename(it, name),
      onDelete: (it) => cb.current.onDelete(it),
    });
    return () => browserRef.current?.destroy();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { browserRef.current?.setItems(items); }, [items]);
  return (
    <div style={{ width: 320 }}>
      <button className="es-btn es-small es-primary" style={{ width: "100%", marginBottom: 8 }} onClick={onSave}>
        + Save current scale set
      </button>
      <div ref={hostRef} style={{ height: 360, border: "1px solid var(--es-border)", borderRadius: "var(--es-radius-md)", overflow: "hidden", background: "var(--es-bg)" }} />
    </div>
  );
}

function polar(cx, cy, r, angle) {
  return {
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  };
}

function arcPath(cx, cy, rInner, rOuter, start, end) {
  const p1 = polar(cx, cy, rOuter, start);
  const p2 = polar(cx, cy, rOuter, end);
  const p3 = polar(cx, cy, rInner, end);
  const p4 = polar(cx, cy, rInner, start);
  const large = end - start > Math.PI ? 1 : 0;
  return [
    `M ${p1.x} ${p1.y}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${p4.x} ${p4.y}`,
    "Z",
  ].join(" ");
}

function midAngle(start, end) {
  return (start + end) / 2;
}

function rootColor(pc) {
  const fi = chromaticToFifthsIndex(pc);
  const hue = (fi * 30) % 360;
  return `hsl(${hue} 78% 58%)`;
}

function fadeColor(pc, alpha) {
  const fi = chromaticToFifthsIndex(pc);
  const hue = (fi * 30) % 360;
  return `hsla(${hue} 78% 58% / ${alpha})`;
}

function makeStaticRingData(label, count = 12) {
  return Array.from({ length: count }, (_, i) => ({
    degree: i,
    rootPc: fifthsIndexToChromatic(i),
    numeral: label,
    bitmask: null,
    pcs: [],
  }));
}

function getInnerRingConfig(k, triads, sus, sevenths) {
  if (k > 5) {
    return [
      { key: "triads", data: triads, color: "rgba(59,130,246,0.82)", shortLabel: "3" },
      { key: "sus", data: sus, color: "rgba(168,85,247,0.82)", shortLabel: "s" },
      { key: "sevenths", data: sevenths, color: "rgba(16,185,129,0.82)", shortLabel: "7" },
    ];
  }
  if (k === 5) {
    return [
      { key: "triads", data: triads, color: "rgba(59,130,246,0.82)", shortLabel: "3" },
      { key: "sus", data: sus, color: "rgba(168,85,247,0.82)", shortLabel: "s" },
    ];
  }
  return [
    { key: "4", data: makeStaticRingData("4"), color: "rgba(245,158,11,0.78)", shortLabel: "4" },
    { key: "3", data: makeStaticRingData("3"), color: "rgba(239,68,68,0.78)", shortLabel: "3" },
  ];
}

function Dot({ x, y, active }) {
  return <circle cx={x} cy={y} r={active ? 7 : 0} fill="var(--es-fg)" opacity={active ? 0.9 : 0} />;
}

export default function App() {
  const [mode, setMode] = useState("browse");
  const [selectedK, setSelectedK] = useState(7);
  const [selectedRootPc, setSelectedRootPc] = useState(0);
  const [selectedRingKey, setSelectedRingKey] = useState(null);
  const [selectedDegree, setSelectedDegree] = useState(null);
  const [pulse, setPulse] = useState(false);
  const [pushStatus, setPushStatus] = useState("");
  // Shared frame: MIDI chip state (lazy SysEx connect), the Library drawer.
  const [clusterMidi, setClusterMidi] = useState(null); // null until probed
  const [scaleLib, setScaleLib] = useState(loadScaleLib);
  const [libOpen, setLibOpen] = useState(false);
  useEffect(() => { saveScaleLib(scaleLib); }, [scaleLib]);
  const probeMidi = async () => {
    const s = await midiOutState();
    setClusterMidi(s.unavailable ? { unavailable: true, sysex: true }
      : { outputs: s.outputs, selectedOutId: s.selectedOutId, sysex: true,
          onSelectOut: (id) => { rememberOutput(id); } });
  };
  useEffect(() => {
    // Permission is a panel state, not a page-load prompt: probe on mount
    // only when SysEx MIDI is ALREADY granted; otherwise the chip reads
    // "MIDI · 0" and the first "Push scale" (which prompts, as before)
    // refreshes it.
    let on = true;
    (async () => {
      if (!("requestMIDIAccess" in navigator)) { if (on) setClusterMidi({ unavailable: true }); return; }
      try {
        const st = await navigator.permissions?.query?.({ name: "midi", sysex: true });
        if (st?.state !== "granted") { if (on) setClusterMidi({ outputs: [], sysex: true }); return; }
      } catch { /* permissions API absent — leave the chip unprobed */ }
      if (on) await probeMidi();
    })();
    return () => { on = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedScaleOrdered = useMemo(() => scaleFamily(selectedK, selectedRootPc), [selectedK, selectedRootPc]);
  const selectedScaleSet = useMemo(() => new Set(selectedScaleOrdered), [selectedScaleOrdered]);
  const triads = useMemo(() => degreeChords(selectedScaleOrdered, "triads"), [selectedScaleOrdered]);
  const sus = useMemo(() => degreeChords(selectedScaleOrdered, "sus"), [selectedScaleOrdered]);
  const sevenths = useMemo(() => (selectedK > 5 ? degreeChords(selectedScaleOrdered, "sevenths") : []), [selectedScaleOrdered, selectedK]);
  const innerRings = useMemo(() => getInnerRingConfig(selectedK, triads, sus, sevenths), [selectedK, triads, sus, sevenths]);

  const activeRing = innerRings.find((r) => r.key === selectedRingKey) || null;
  const activeItem = activeRing && selectedDegree !== null ? activeRing.data[selectedDegree] || null : null;
  const subsetPcs = activeItem?.pcs || [];
  const subsetSet = useMemo(() => new Set(subsetPcs), [subsetPcs]);

  const cx = 420;
  const cy = 420;
  const browseRings = BROWSER_RINGS.map((k, idx) => ({ k, outer: 338 - idx * 34, inner: 312 - idx * 34 }));
  const outerExtra = pulse ? 12 : 0;
  const outerSystem = { outer: 346 + outerExtra, inner: 304 + outerExtra };

  function enterSystem(k, rootPc) {
    setPulse(true);
    setSelectedK(k);
    setSelectedRootPc(rootPc);
    setSelectedRingKey(null);
    setSelectedDegree(null);
    setMode("system");
    window.setTimeout(() => setPulse(false), 240);
  }

  function handleOuterClick(pc) {
    if (pc === selectedRootPc) {
      setMode("browse");
      setSelectedRingKey(null);
      setSelectedDegree(null);
      return;
    }
    enterSystem(selectedK, pc);
  }

  function handleSmallSystemClick(ringKey, pc, index) {
    const targetK = ringKey === "4" ? 4 : 3;
    const isCurrent = selectedK === targetK && selectedRootPc === pc;
    if (isCurrent) {
      setMode("browse");
      setSelectedRingKey(null);
      setSelectedDegree(null);
      return;
    }
    setSelectedK(targetK);
    setSelectedRootPc(pc);
    setSelectedRingKey(ringKey);
    setSelectedDegree(index);
    setMode("system");
  }

  const outerSystemSlices = useMemo(() => {
    return Array.from({ length: 12 }, (_, fi) => {
      const pc = fifthsIndexToChromatic(fi);
      return {
        fi,
        pc,
        included: selectedScaleSet.has(pc),
        subset: subsetSet.has(pc),
      };
    });
  }, [selectedScaleSet, subsetSet]);

  // Control plane: broadcast the current selection onto the shared bus, live,
  // so PitchFold / the workspace / another tab reflect it without MIDI (the
  // explicit MIDI push below is unchanged — same message, the other transport).
  useEffect(() => {
    broadcastScale({
      mask: pcsToBitmask(selectedScaleOrdered),
      root: selectedRootPc,
      name: `${NOTE_NAMES_FIFTHS[chromaticToFifthsIndex(selectedRootPc)]} · ${selectedK}-note`,
    });
  }, [selectedScaleOrdered, selectedRootPc, selectedK]);

  async function handlePushScale() {
    // The suite scale message: mask is pcsToBitmask (leftmost = LSB — one
    // convention, everywhere), root is the selected root pc.
    const name = `${NOTE_NAMES_FIFTHS[chromaticToFifthsIndex(selectedRootPc)]} · ${selectedK}-note`;
    setPushStatus("…");
    const r = await pushScale({ mask: pcsToBitmask(selectedScaleOrdered), root: selectedRootPc, name });
    setPushStatus(r.ok ? `sent ${r.detail}` : r.detail);
    window.setTimeout(() => setPushStatus(""), 4000);
    probeMidi(); // permission granted (or refused) just now — refresh the chip
  }

  // The Library's save/recall — a scale set is the selection (k, root).
  function saveScaleSet() {
    const name = `${NOTE_NAMES_FIFTHS[chromaticToFifthsIndex(selectedRootPc)]} · ${selectedK}-note`;
    const entry = { id: `s${Date.now()}-${Math.floor(Math.random() * 1e6)}`, name,
      k: selectedK, rootPc: selectedRootPc, savedAt: new Date().toISOString() };
    setScaleLib((l) => [entry, ...l]);
  }
  function recallScaleSet(entry) {
    enterSystem(entry.k, entry.rootPc);
    setLibOpen(false);
  }
  function renameScaleSet(entry, name) {
    setScaleLib((l) => l.map((e) => (e.id === entry.id ? { ...e, name } : e)));
  }
  /** Delete with the suite's one destructive idiom (Q4): optimistic + undo toast. */
  function deleteScaleSet(entry) {
    const idx = scaleLib.findIndex((e) => e.id === entry.id);
    setScaleLib((l) => l.filter((e) => e.id !== entry.id));
    toast({
      text: `Deleted “${entry.name}”`,
      undo: () => setScaleLib((l) => {
        if (l.some((e) => e.id === entry.id)) return l;
        const n = [...l]; n.splice(Math.min(idx < 0 ? 0 : idx, n.length), 0, entry); return n;
      }),
    });
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--es-bg)", padding: 16, fontFamily: "var(--es-font-sans)", color: "var(--es-fg)", position: "relative" }}>
      {/* The shared frame, archetype D: minimal brand top-left, the global
          cluster floating top-right — the canvas keeps the whole stage. */}
      <div style={{ position: "absolute", top: 16, left: 16, display: "flex", alignItems: "center", gap: 8, color: "var(--es-fg-muted)", fontWeight: 600, zIndex: 5 }}>
        <img src={appIcon} alt="" style={{ width: 24, height: 24, borderRadius: 6 }} />
        <span>PickPCS</span>
      </div>
      <div className="es-float-bar" style={{ flexDirection: "column", alignItems: "stretch" }}>
        <GlobalClusterMount midi={clusterMidi} libCount={scaleLib.length}
          onLibToggle={() => setLibOpen((o) => !o)} />
        {libOpen && (
          <div style={{ marginTop: 8 }}>
            <ScaleLibraryPanel items={scaleLib} onSave={saveScaleSet}
              onOpen={recallScaleSet} onRename={renameScaleSet} onDelete={deleteScaleSet} />
          </div>
        )}
      </div>
      <div style={{ maxWidth: 1100, margin: "0 auto", background: "var(--es-bg-raised)", border: "1px solid var(--es-border)", borderRadius: 28, padding: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        {mode === "system" && (
          <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "2px 8px 10px" }}>
            <button
              onClick={handlePushScale}
              title="Send this scale to other suite apps over MIDI (SysEx) — e.g. PitchFold picks it up as its active scale. Route through an IAC bus."
              style={{ font: "inherit", fontSize: 13, padding: "6px 14px", borderRadius: 999,
                       border: "1px solid var(--es-border)", background: "var(--es-bg)",
                       color: "var(--es-fg)", cursor: "pointer" }}>
              Push scale ⇢
            </button>
            {pushStatus && <span style={{ fontSize: 12, color: "var(--es-fg-muted)" }}>{pushStatus}</span>}
          </div>
        )}
        <div style={{ borderRadius: 24, overflow: "hidden", background: "radial-gradient(circle at center, var(--es-bg-raised), var(--es-bg-sunken))" }}>
          <svg viewBox="0 0 840 840" style={{ width: "100%", height: "auto", display: "block" }}>
            <circle cx={cx} cy={cy} r={376} fill="none" stroke="rgba(148,163,184,0.25)" strokeWidth="1.5" />

            {mode === "browse" && (
              <>
                {browseRings.map(({ k, outer, inner }) => (
                  <g key={`browse-${k}`}>
                    {Array.from({ length: 12 }).map((_, fi) => {
                      const pc = fifthsIndexToChromatic(fi);
                      const start = -Math.PI / 2 + (fi * Math.PI * 2) / 12;
                      const end = -Math.PI / 2 + ((fi + 1) * Math.PI * 2) / 12;
                      return (
                        <path
                          key={`${k}-${fi}`}
                          d={arcPath(cx, cy, inner, outer, start + 0.008, end - 0.008)}
                          fill={fadeColor(pc, 0.34)}
                          stroke={k === 7 || k === 5 ? "rgba(15,23,42,0.58)" : "rgba(15,23,42,0.24)"}
                          strokeWidth={k === 7 || k === 5 ? 2.4 : 1.2}
                          style={{ cursor: "pointer", transition: "opacity 0.15s ease" }}
                          onClick={() => enterSystem(k, pc)}
                        />
                      );
                    })}
                  </g>
                ))}
              </>
            )}

            {mode === "system" && selectedK >= 5 && (
              <>
                {outerSystemSlices.map(({ fi, pc, included, subset }) => {
                  const start = -Math.PI / 2 + (fi * Math.PI * 2) / 12;
                  const end = -Math.PI / 2 + ((fi + 1) * Math.PI * 2) / 12;
                  const dotPoint = polar(cx, cy, (outerSystem.inner + outerSystem.outer) / 2, midAngle(start, end));
                  return (
                    <g key={`outer-${fi}`}>
                      <path
                        d={arcPath(cx, cy, outerSystem.inner, outerSystem.outer, start + 0.008, end - 0.008)}
                        fill={fadeColor(pc, included ? 0.88 : 0.22)}
                        stroke={pc === selectedRootPc ? "rgba(15,23,42,0.92)" : "rgba(15,23,42,0.28)"}
                        strokeWidth={pc === selectedRootPc ? 3 : 1.1}
                        style={{ cursor: "pointer" }}
                        onClick={() => handleOuterClick(pc)}
                      />
                      <Dot x={dotPoint.x} y={dotPoint.y} active={subset} />
                    </g>
                  );
                })}

                {innerRings.map((ring, ringIndex) => {
                  const outer = 286 - ringIndex * 56;
                  const inner = outer - 38;
                  const count = ring.data.length;
                  return (
                    <g key={`ring-${ring.key}`}>
                      {ring.data.map((item, i) => {
                        const start = -Math.PI / 2 + (i * Math.PI * 2) / count;
                        const end = -Math.PI / 2 + ((i + 1) * Math.PI * 2) / count;
                        const active = ring.key === selectedRingKey && i === selectedDegree;
                        return (
                          <path
                            key={`${ring.key}-${i}`}
                            d={arcPath(cx, cy, inner, outer, start + 0.012, end - 0.012)}
                            fill={active ? ring.color : ring.color.replace(/0\.82/g, "0.22")}
                            stroke={active ? rootColor(selectedRootPc) : "rgba(100,116,139,0.45)"}
                            strokeWidth={active ? 2.5 : 1}
                            style={{ cursor: "pointer" }}
                            onClick={() => {
                              setSelectedRingKey(ring.key);
                              setSelectedDegree(i);
                            }}
                          />
                        );
                      })}
                    </g>
                  );
                })}
              </>
            )}

            {mode === "system" && selectedK < 5 && (
              <>
                {innerRings.map((ring, ringIndex) => {
                  const outer = ringIndex === 0 ? 250 : 190;
                  const inner = outer - 52;
                  return (
                    <g key={`small-${ring.key}`}>
                      {ring.data.map((item, i) => {
                        const start = -Math.PI / 2 + (i * Math.PI * 2) / 12;
                        const end = -Math.PI / 2 + ((i + 1) * Math.PI * 2) / 12;
                        const pc = item.rootPc;
                        const targetK = ring.key === "4" ? 4 : 3;
                        const active = selectedK === targetK && pc === selectedRootPc;
                        return (
                          <path
                            key={`${ring.key}-${i}`}
                            d={arcPath(cx, cy, inner, outer, start + 0.012, end - 0.012)}
                            fill={fadeColor(pc, 0.34)}
                            stroke={active ? "rgba(15,23,42,0.92)" : "rgba(15,23,42,0.28)"}
                            strokeWidth={active ? 3 : 1.1}
                            style={{ cursor: "pointer" }}
                            onClick={() => handleSmallSystemClick(ring.key, pc, i)}
                          />
                        );
                      })}
                    </g>
                  );
                })}
              </>
            )}

            {NOTE_NAMES_FIFTHS.map((label, fi) => {
              const start = -Math.PI / 2 + (fi * Math.PI * 2) / 12;
              const end = -Math.PI / 2 + ((fi + 1) * Math.PI * 2) / 12;
              const p = polar(cx, cy, 392, midAngle(start, end));
              const selected = fi === chromaticToFifthsIndex(selectedRootPc) && mode === "system";
              return (
                <text
                  key={`label-${label}`}
                  x={p.x}
                  y={p.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="16"
                  fontWeight={selected ? 700 : 500}
                  fill="var(--es-fg)"
                >
                  {label}
                </text>
              );
            })}

            {mode === "browse" && browseRings.map(({ k, outer, inner }) => {
              const p = polar(cx, cy, (outer + inner) / 2, Math.PI * 0.08);
              return (
                <text key={`k-${k}`} x={p.x} y={p.y} fontSize="12" fill="var(--es-fg-2)" textAnchor="start" dominantBaseline="middle">
                  {k}
                </text>
              );
            })}

            {mode === "system" && selectedK >= 5 && innerRings.map((ring, ringIndex) => {
              const outer = 286 - ringIndex * 56;
              const inner = outer - 38;
              const p = polar(cx, cy, (outer + inner) / 2, Math.PI * 0.08);
              return (
                <text key={`inner-label-${ring.key}`} x={p.x} y={p.y} fontSize="12" fill="var(--es-fg-2)" textAnchor="start" dominantBaseline="middle">
                  {ring.shortLabel}
                </text>
              );
            })}

            {mode === "system" && selectedK < 5 && innerRings.map((ring, ringIndex) => {
              const outer = ringIndex === 0 ? 250 : 190;
              const inner = outer - 52;
              const p = polar(cx, cy, (outer + inner) / 2, Math.PI * 0.08);
              return (
                <text key={`small-label-${ring.key}`} x={p.x} y={p.y} fontSize="12" fill="var(--es-fg-2)" textAnchor="start" dominantBaseline="middle">
                  {ring.shortLabel}
                </text>
              );
            })}

            <circle cx={cx} cy={cy} r={86} fill="var(--es-bg-raised)" stroke="rgba(148,163,184,0.42)" strokeWidth="1.5" />

            {mode === "browse" ? (
              <>
                <text x={cx} y={cy - 8} textAnchor="middle" fontSize="28" fontWeight="700" fill="var(--es-fg)">12</text>
                <text x={cx} y={cy + 18} textAnchor="middle" fontSize="13" fill="var(--es-fg-muted)">8 7 6 5 4 3</text>
              </>
            ) : (
              <>
                <text x={cx} y={cy - 26} textAnchor="middle" fontSize="20" fontWeight="700" fill="var(--es-fg)">
                  {selectedK}
                </text>
                <text x={cx} y={cy} textAnchor="middle" fontSize="26" fontWeight="700" fill="var(--es-fg)">
                  {pcsToBitmask(selectedScaleOrdered)}
                </text>
                <text x={cx} y={cy + 24} textAnchor="middle" fontSize="14" fill="var(--es-fg-2)">
                  {activeItem?.numeral ?? "–"}
                </text>
                <text x={cx} y={cy + 44} textAnchor="middle" fontSize="12" fill="var(--es-fg-muted)">
                  {activeItem?.bitmask ?? ""}
                </text>
              </>
            )}
          </svg>
        </div>
      </div>
    </div>
  );
}
