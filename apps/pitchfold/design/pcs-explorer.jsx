// pcs-explorer.jsx — Concentric-ring PCS browser, adapted from PickPCS.
// https://github.com/Enkerli/PickPCS
//
// Circle-of-fifths layout.  Browse by note count (k = 3–8), then drill into
// a root to see chord subsets (triads, sus4, 7ths) as inner rings.
// Any selection emits (pfMask, rootPc) in PitchFold's interval bitmask format.

// ── Geometry ──────────────────────────────────────────────────────────────────

function exPolar(cx, cy, r, a) {
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function exArc(cx, cy, ri, ro, a0, a1) {
  const p0 = exPolar(cx, cy, ro, a0);
  const p1 = exPolar(cx, cy, ro, a1);
  const p2 = exPolar(cx, cy, ri, a1);
  const p3 = exPolar(cx, cy, ri, a0);
  const lg = a1 - a0 > Math.PI ? 1 : 0;
  return `M${p0.x} ${p0.y} A${ro} ${ro} 0 ${lg} 1 ${p1.x} ${p1.y} L${p2.x} ${p2.y} A${ri} ${ri} 0 ${lg} 0 ${p3.x} ${p3.y}Z`;
}

function exMidPt(cx, cy, r, a0, a1) {
  return exPolar(cx, cy, r, (a0 + a1) / 2);
}

// ── Pitch class helpers ───────────────────────────────────────────────────────

const FIFTHS_TO_CHROM = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];
const FIFTHS_NAMES    = ['C','G','D','A','E','B','F♯','D♭','A♭','E♭','B♭','F'];

function fifthsToChrom(fi) { return FIFTHS_TO_CHROM[fi]; }
function chromToFifths(pc) { return ((pc * 7) % 12 + 12) % 12; }

// Standard Euclidean-ish interval patterns for each k (same as PickPCS).
function kIntervals(k) {
  if (k === 7) return [0, 2, 4, 5, 7, 9, 11];
  if (k === 6) return [0, 2, 4, 6, 8, 10];
  if (k === 5) return [0, 2, 4, 7, 9];
  if (k === 8) return [0, 2, 3, 5, 6, 8, 9, 11];
  if (k === 4) return [0, 3, 6, 9];
  if (k === 3) return [0, 4, 8];
  return [];
}

// PitchFold interval bitmask: bit(11 − interval) = 1.
function toPFMask(intervals) {
  return intervals.reduce((m, iv) => m | (1 << (11 - ((iv % 12 + 12) % 12))), 0) & 0xFFF;
}

// Absolute pitch-class array + root → PitchFold interval mask.
function absToPFMask(rootPc, absPcs) {
  return toPFMask(absPcs.map(pc => (pc - rootPc + 12) % 12));
}

// Absolute pitch classes for a k-scale rooted at rootPc.
function kAbsPcs(k, rootPc) {
  return kIntervals(k).map(iv => (rootPc + iv) % 12);
}

function countBits(n) { let c = 0, v = n & 0xFFF; while (v) { c += v & 1; v >>= 1; } return c; }

// ── Chord detection (from PickPCS) ────────────────────────────────────────────

const TRIADS = { maj:[0,4,7], min:[0,3,7], dim:[0,3,6], aug:[0,4,8], sus4:[0,5,7] };
const SEVENTHS = {
  maj7:[0,4,7,11], dom7:[0,4,7,10], min7:[0,3,7,10],
  halfDim7:[0,3,6,10], dim7:[0,3,6,9], minMaj7:[0,3,7,11],
};

function detectChord(pcsIn) {
  const pcs = [...pcsIn].sort((a, b) => a - b);
  for (const root of pcs) {
    const norm = pcs.map(v => (v - root + 12) % 12).sort((a, b) => a - b);
    for (const [q, pat] of Object.entries(SEVENTHS)) {
      if (norm.length === pat.length && norm.every((v, i) => v === pat[i]))
        return { quality: q, root };
    }
    for (const [q, pat] of Object.entries(TRIADS)) {
      if (norm.length === pat.length && norm.every((v, i) => v === pat[i]))
        return { quality: q, root };
    }
  }
  return { quality: 'set', root: pcs[0] ?? 0 };
}

function romanFor(deg, quality) {
  const R = ['I','II','III','IV','V','VI','VII'][deg] || `${deg + 1}`;
  let base = R;
  if (['min','min7','minMaj7'].includes(quality)) base = base.toLowerCase();
  if (['dim','dim7'].includes(quality))           base += '°';
  if (quality === 'halfDim7') return base.toLowerCase() + 'ø7';
  if (quality === 'maj7')  base += '∆';
  else if (quality === 'dom7') base += '7';
  else if (quality === 'min7') base += '⁻7';
  else if (quality === 'sus4') base += 'sus';
  return base;
}

function buildDegreeChords(absPcs, type) {
  if (!absPcs.length) return [];
  const offsets =
    type === 'sus'     ? [0, 3, 4]    :
    type === 'sevenths'? [0, 2, 4, 6] : [0, 2, 4];
  return absPcs.map((rootPc, i) => {
    const pcs  = offsets.map(off => absPcs[(i + off) % absPcs.length]).sort((a, b) => a - b);
    const info = detectChord(pcs);
    return { degree: i, rootPc, pcs, quality: info.quality, numeral: romanFor(i, info.quality) };
  });
}

// ── PCSExplorer component ─────────────────────────────────────────────────────

const BROWSE_RINGS = [
  { k: 8, outer: 336, inner: 308 },
  { k: 7, outer: 300, inner: 272 },
  { k: 6, outer: 264, inner: 236 },
  { k: 5, outer: 228, inner: 200 },
  { k: 4, outer: 192, inner: 164 },
  { k: 3, outer: 156, inner: 128 },
];

export function PCSExplorer({ mask, root, onSelect, paper = window.PAPER }) {
  const initK = () => { const k = countBits(mask); return (k >= 3 && k <= 8) ? k : 7; };

  const [mode,     setMode]     = React.useState('browse');
  const [selK,     setSelK]     = React.useState(initK);
  const [selRoot,  setSelRoot]  = React.useState(root);
  const [innerKey, setInnerKey] = React.useState(null);
  const [innerDeg, setInnerDeg] = React.useState(null);

  const scalePcs  = React.useMemo(() => kAbsPcs(selK, selRoot), [selK, selRoot]);
  const scaleSet  = React.useMemo(() => new Set(scalePcs), [scalePcs]);
  const triads    = React.useMemo(() => buildDegreeChords(scalePcs, 'triads'),   [scalePcs]);
  const sus       = React.useMemo(() => buildDegreeChords(scalePcs, 'sus'),      [scalePcs]);
  const sevenths  = React.useMemo(() => selK > 5 ? buildDegreeChords(scalePcs, 'sevenths') : [], [scalePcs, selK]);

  const ink   = paper?.ink   || '#2D2620';
  const amber = paper?.amber || '#C4873A';
  const card  = paper?.card  || '#FAF8F4';
  const rule  = paper?.rule  || '#D4CAB8';
  const ink50 = paper?.ink50 || '#6B5E55';

  const innerRings = React.useMemo(() => {
    const rings = [
      { key: 'triads',   data: triads,   col: paper?.laneInk   || '#3A4060' },
      { key: 'sus',      data: sus,      col: paper?.lanePlum  || '#6B4F7C' },
    ];
    if (selK > 5) rings.push({ key: 'sevenths', data: sevenths, col: paper?.laneMoss || '#4A7A55' });
    return rings;
  }, [triads, sus, sevenths, selK, paper]);

  const activeInner = innerRings.find(r => r.key === innerKey);
  const activeItem  = activeInner && innerDeg != null ? activeInner.data[innerDeg] : null;
  const subsetSet   = React.useMemo(() => new Set(activeItem?.pcs || []), [activeItem]);

  const emitScale = (k, rootPc) =>
    onSelect?.(toPFMask(kIntervals(k)), rootPc);

  const emitChord = (item) => {
    if (item?.pcs?.length) onSelect?.(absToPFMask(item.rootPc, item.pcs), item.rootPc);
  };

  const enterSystem = (k, rootPc) => {
    setSelK(k); setSelRoot(rootPc); setInnerKey(null); setInnerDeg(null); setMode('system');
    emitScale(k, rootPc);
  };

  const cx = 420, cy = 420;

  // Centre bitmask readout value
  const centreMask = activeItem
    ? absToPFMask(activeItem.rootPc, activeItem.pcs)
    : toPFMask(kIntervals(selK));

  return (
    <div style={{ width: '100%' }}>
      <svg viewBox="0 0 840 840" style={{ width: '100%', height: 'auto', display: 'block' }}>

        {/* Outer guide ring */}
        <circle cx={cx} cy={cy} r={374} fill="none" stroke={rule} strokeWidth="1" opacity=".4" />

        {/* ── BROWSE MODE ─────────────────────────────────────────────── */}
        {mode === 'browse' && BROWSE_RINGS.map(({ k, outer, inner }) =>
          Array.from({ length: 12 }, (_, fi) => {
            const rootPc = fifthsToChrom(fi);
            const a0 = -Math.PI / 2 + fi       * Math.PI * 2 / 12;
            const a1 = -Math.PI / 2 + (fi + 1) * Math.PI * 2 / 12;
            const prominent = k === 7 || k === 5;
            return (
              <path key={`${k}-${fi}`}
                d={exArc(cx, cy, inner, outer, a0 + 0.008, a1 - 0.008)}
                fill={k === 7 ? amber + '55' : k === 5 ? amber + '30' : rule + '70'}
                stroke={prominent ? ink + '90' : rule}
                strokeWidth={prominent ? 1.5 : 0.8}
                style={{ cursor: 'pointer' }}
                onClick={() => enterSystem(k, rootPc)}
              />
            );
          })
        )}

        {/* k labels in browse mode */}
        {mode === 'browse' && BROWSE_RINGS.map(({ k, outer, inner }) => {
          const p = exPolar(cx, cy, (outer + inner) / 2, Math.PI * 0.055);
          return (
            <text key={`lbl-${k}`} x={p.x} y={p.y}
              fontSize="14" fill={ink50} textAnchor="start" dominantBaseline="middle"
              style={{ pointerEvents: 'none', fontFamily: 'InterTight, system-ui' }}>
              {k}
            </text>
          );
        })}

        {/* ── SYSTEM MODE ─────────────────────────────────────────────── */}
        {mode === 'system' && (() => {
          const ro = 346, ri = 304;
          return (
            <>
              {/* Outer ring — 12 pitch classes (circle of fifths order) */}
              {Array.from({ length: 12 }, (_, fi) => {
                const pc  = fifthsToChrom(fi);
                const a0  = -Math.PI / 2 + fi       * Math.PI * 2 / 12;
                const a1  = -Math.PI / 2 + (fi + 1) * Math.PI * 2 / 12;
                const inScale  = scaleSet.has(pc);
                const isRoot   = pc === selRoot;
                const inSubset = subsetSet.has(pc);
                const dotPt    = exMidPt(cx, cy, (ri + ro) / 2, a0, a1);
                return (
                  <g key={fi}>
                    <path
                      d={exArc(cx, cy, ri, ro, a0 + 0.008, a1 - 0.008)}
                      fill={isRoot ? ink : inScale ? amber + 'BB' : rule + '40'}
                      stroke={isRoot ? ink : inScale ? amber : rule}
                      strokeWidth={isRoot ? 2.5 : 0.9}
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        if (pc === selRoot) { setMode('browse'); return; }
                        setSelRoot(pc); setInnerKey(null); setInnerDeg(null);
                        emitScale(selK, pc);
                      }}
                    />
                    {inSubset && (
                      <circle cx={dotPt.x} cy={dotPt.y} r={5.5}
                        fill={card} opacity=".9" style={{ pointerEvents: 'none' }} />
                    )}
                  </g>
                );
              })}

              {/* Inner chord rings */}
              {innerRings.map((ring, ri2) => {
                const ro2 = 282 - ri2 * 56;
                const ri2i = ro2 - 40;
                return ring.data.map((item, i) => {
                  const a0     = -Math.PI / 2 + i         * Math.PI * 2 / ring.data.length;
                  const a1     = -Math.PI / 2 + (i + 1)   * Math.PI * 2 / ring.data.length;
                  const active = ring.key === innerKey && i === innerDeg;
                  return (
                    <path key={`${ring.key}-${i}`}
                      d={exArc(cx, cy, ri2i, ro2, a0 + 0.012, a1 - 0.012)}
                      fill={active ? ring.col + 'CC' : ring.col + '30'}
                      stroke={active ? ring.col : rule}
                      strokeWidth={active ? 2 : 0.8}
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        const toggling = ring.key === innerKey && i === innerDeg;
                        setInnerKey(toggling ? null : ring.key);
                        setInnerDeg(toggling ? null : i);
                        toggling ? emitScale(selK, selRoot) : emitChord(item);
                      }}
                    />
                  );
                });
              })}

              {/* Inner ring type labels */}
              {innerRings.map((ring, ri2) => {
                const ro2 = 282 - ri2 * 56, ri2i = ro2 - 40;
                const p   = exPolar(cx, cy, (ro2 + ri2i) / 2, Math.PI * 0.055);
                return (
                  <text key={`rl-${ring.key}`} x={p.x} y={p.y}
                    fontSize="13" fill={ink50} textAnchor="start" dominantBaseline="middle"
                    style={{ pointerEvents: 'none', fontFamily: 'InterTight, system-ui' }}>
                    {ring.key === 'triads' ? '3' : ring.key === 'sus' ? 's' : '7'}
                  </text>
                );
              })}
            </>
          );
        })()}

        {/* Circle-of-fifths note labels (outer) */}
        {FIFTHS_NAMES.map((name, fi) => {
          const a0 = -Math.PI / 2 + fi       * Math.PI * 2 / 12;
          const a1 = -Math.PI / 2 + (fi + 1) * Math.PI * 2 / 12;
          const p  = exPolar(cx, cy, 396, (a0 + a1) / 2);
          const isCurRoot = mode === 'system' && fi === chromToFifths(selRoot);
          return (
            <text key={name} x={p.x} y={p.y}
              textAnchor="middle" dominantBaseline="middle"
              fontSize="18" fontWeight={isCurRoot ? 700 : 500}
              fill={isCurRoot ? amber : ink}
              style={{ pointerEvents: 'none', fontFamily: 'InterTight, system-ui' }}>
              {name}
            </text>
          );
        })}

        {/* Centre disc */}
        <circle cx={cx} cy={cy} r={84} fill={card} stroke={rule} strokeWidth="1" />
        {mode === 'browse' ? (
          <>
            <text x={cx} y={cy - 10} textAnchor="middle" fontSize="28" fontWeight="700"
              fill={ink} style={{ fontFamily: 'InterTight, system-ui' }}>12</text>
            <text x={cx} y={cy + 16} textAnchor="middle" fontSize="12" fill={ink50}
              style={{ fontFamily: 'InterTight, system-ui' }}>k = 3–8</text>
          </>
        ) : (
          <>
            <text x={cx} y={cy - 26} textAnchor="middle" fontSize="14" fill={ink50}
              style={{ fontFamily: 'InterTight, system-ui' }}>k={selK}</text>
            <text x={cx} y={cy - 2} textAnchor="middle" fontSize="24" fontWeight="700"
              fill={ink} style={{ fontFamily: 'Domine, Georgia, serif', fontStyle: 'italic' }}>
              {FIFTHS_NAMES[chromToFifths(selRoot)]}
            </text>
            {activeItem && (
              <text x={cx} y={cy + 22} textAnchor="middle" fontSize="14" fill={amber}
                style={{ fontFamily: 'InterTight, system-ui' }}>
                {activeItem.numeral}
              </text>
            )}
            <text x={cx} y={cy + (activeItem ? 42 : 24)} textAnchor="middle" fontSize="11" fill={ink50}
              style={{ fontFamily: 'ui-monospace,"SF Mono",monospace', fontVariantNumeric: 'tabular-nums' }}>
              {centreMask}
            </text>
          </>
        )}
      </svg>

      {/* Back to browse */}
      {mode === 'system' && (
        <button
          onClick={() => { setMode('browse'); setInnerKey(null); setInnerDeg(null); }}
          style={{
            display: 'block', margin: '2px auto 0',
            padding: '3px 14px', fontSize: 11, borderRadius: 4, cursor: 'pointer',
            border: `1px solid ${rule}`, background: 'transparent',
            color: ink50, fontFamily: 'InterTight, system-ui',
          }}>← Browse all k</button>
      )}
    </div>
  );
}
