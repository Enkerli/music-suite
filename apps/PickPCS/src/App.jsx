import React, { useMemo, useState } from "react";
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
  return <circle cx={x} cy={y} r={active ? 7 : 0} fill="#0f172a" opacity={active ? 0.9 : 0} />;
}

export default function App() {
  const [mode, setMode] = useState("browse");
  const [selectedK, setSelectedK] = useState(7);
  const [selectedRootPc, setSelectedRootPc] = useState(0);
  const [selectedRingKey, setSelectedRingKey] = useState(null);
  const [selectedDegree, setSelectedDegree] = useState(null);
  const [pulse, setPulse] = useState(false);

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

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", padding: 16 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", background: "white", border: "1px solid #cbd5e1", borderRadius: 28, padding: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        <div style={{ borderRadius: 24, overflow: "hidden", background: "radial-gradient(circle at center, white, #edf2f7)" }}>
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
                  fill="#0f172a"
                >
                  {label}
                </text>
              );
            })}

            {mode === "browse" && browseRings.map(({ k, outer, inner }) => {
              const p = polar(cx, cy, (outer + inner) / 2, Math.PI * 0.08);
              return (
                <text key={`k-${k}`} x={p.x} y={p.y} fontSize="12" fill="#334155" textAnchor="start" dominantBaseline="middle">
                  {k}
                </text>
              );
            })}

            {mode === "system" && selectedK >= 5 && innerRings.map((ring, ringIndex) => {
              const outer = 286 - ringIndex * 56;
              const inner = outer - 38;
              const p = polar(cx, cy, (outer + inner) / 2, Math.PI * 0.08);
              return (
                <text key={`inner-label-${ring.key}`} x={p.x} y={p.y} fontSize="12" fill="#334155" textAnchor="start" dominantBaseline="middle">
                  {ring.shortLabel}
                </text>
              );
            })}

            {mode === "system" && selectedK < 5 && innerRings.map((ring, ringIndex) => {
              const outer = ringIndex === 0 ? 250 : 190;
              const inner = outer - 52;
              const p = polar(cx, cy, (outer + inner) / 2, Math.PI * 0.08);
              return (
                <text key={`small-label-${ring.key}`} x={p.x} y={p.y} fontSize="12" fill="#334155" textAnchor="start" dominantBaseline="middle">
                  {ring.shortLabel}
                </text>
              );
            })}

            <circle cx={cx} cy={cy} r={86} fill="white" stroke="rgba(148,163,184,0.42)" strokeWidth="1.5" />

            {mode === "browse" ? (
              <>
                <text x={cx} y={cy - 8} textAnchor="middle" fontSize="28" fontWeight="700" fill="#0f172a">12</text>
                <text x={cx} y={cy + 18} textAnchor="middle" fontSize="13" fill="#64748b">8 7 6 5 4 3</text>
              </>
            ) : (
              <>
                <text x={cx} y={cy - 26} textAnchor="middle" fontSize="20" fontWeight="700" fill="#0f172a">
                  {selectedK}
                </text>
                <text x={cx} y={cy} textAnchor="middle" fontSize="26" fontWeight="700" fill="#0f172a">
                  {pcsToBitmask(selectedScaleOrdered)}
                </text>
                <text x={cx} y={cy + 24} textAnchor="middle" fontSize="14" fill="#475569">
                  {activeItem?.numeral ?? "–"}
                </text>
                <text x={cx} y={cy + 44} textAnchor="middle" fontSize="12" fill="#64748b">
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
