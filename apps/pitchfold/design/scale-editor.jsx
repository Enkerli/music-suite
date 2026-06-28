// scale-editor.jsx — PCS selector for PitchFold.
// Adapted from DrawnQurve's scale-editor.jsx; no lane context, global PCS only.

import { PCSExplorer } from './pcs-explorer.jsx';

// ── Helpers ───────────────────────────────────────────────────────────────────

function recognizeScaleId(mask) {
  const m = mask & 0xFFF;
  const found = (window.SCALES || []).find(s => s.mask === m);
  return found ? found.id : 'custom';
}

function pcActive(mask, interval) {
  interval = ((interval % 12) + 12) % 12;
  return !!((mask >> (11 - interval)) & 1);
}

function togglePc(mask, interval) {
  interval = ((interval % 12) + 12) % 12;
  return mask ^ (1 << (11 - interval));
}

// ── Chromatic Wheel ───────────────────────────────────────────────────────────

function ChromaticWheelSVG({ mask, root, useFlats, onMaskChange, onRootChange,
                              size = 220, paper = window.PAPER }) {
  const cx = size / 2, cy = size / 2;
  const R  = size * 0.38;
  const r  = size * 0.065;

  const noteNames = useFlats
    ? ['C','D♭','D','E♭','E','F','G♭','G','A♭','A','B♭','B']
    : ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];

  const nodes = Array.from({ length: 12 }, (_, pc) => {
    const angle   = (pc * 30 - 90) * Math.PI / 180;
    const interval= ((pc - root) % 12 + 12) % 12;
    const active  = pcActive(mask, interval);
    const isRoot  = pc === root;
    return { pc, x: cx + R * Math.cos(angle), y: cy + R * Math.sin(angle), active, isRoot };
  });

  // Polygon of active notes
  const polyPts = nodes.filter(n => n.active)
    .map(n => `${n.x},${n.y}`).join(' ');

  const [pressTimer, setPressTimer] = React.useState(null);

  const handlePointerDown = (pc) => {
    const t = setTimeout(() => {
      onRootChange?.(pc);
      setPressTimer(null);
    }, 400);
    setPressTimer(t);
  };

  const handlePointerUp = (pc) => {
    if (pressTimer !== null) {
      clearTimeout(pressTimer);
      setPressTimer(null);
      const interval = ((pc - root) % 12 + 12) % 12;
      onMaskChange?.(togglePc(mask, interval));
    }
  };

  return (
    <svg width={size} height={size} style={{ userSelect: 'none', touchAction: 'none' }}>
      {/* Guide ring */}
      <circle cx={cx} cy={cy} r={R} fill="none"
        stroke={paper?.rule || '#D4CAB8'} strokeWidth={0.5} />
      {/* Active polygon */}
      {polyPts && (
        <polygon points={polyPts}
          fill={(paper?.ink || '#2D2620') + '14'}
          stroke={paper?.ink || '#2D2620'} strokeWidth={1} />
      )}
      {/* Nodes */}
      {nodes.map(({ pc, x, y, active, isRoot }) => (
        <g key={pc}
          onPointerDown={() => handlePointerDown(pc)}
          onPointerUp={() => handlePointerUp(pc)}
          style={{ cursor: 'pointer' }}>
          <circle cx={x} cy={y} r={r}
            fill={active ? (paper?.ink || '#2D2620') : (paper?.card || '#FAF8F4')}
            stroke={isRoot ? (paper?.amber || '#C4873A') : (paper?.ink || '#2D2620')}
            strokeWidth={isRoot ? 2.5 : 1} />
          {isRoot && (
            <circle cx={x} cy={y} r={r + 3.5}
              fill="none" stroke={paper?.amber || '#C4873A'} strokeWidth={2} />
          )}
          <text x={x} y={y} textAnchor="middle" dominantBaseline="middle"
            fontSize={r * 0.85}
            fill={active ? (paper?.card || '#FAF8F4') : (paper?.ink70 || '#574E44')}
            style={{ pointerEvents: 'none', fontFamily: 'InterTight, system-ui' }}>
            {noteNames[pc]}
          </text>
        </g>
      ))}
      {/* Centre: name + note count */}
      <text x={cx} y={cy - 8} textAnchor="middle"
        fontSize={13} fontFamily="Domine, Georgia, serif" fontStyle="italic"
        fill={paper?.ink || '#2D2620'}>
        {recognizeScaleId(mask) === 'custom' ? 'Custom'
          : (window.SCALES || []).find(s => s.mask === (mask & 0xFFF))?.name || ''}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle"
        fontSize={10} fontFamily="InterTight, system-ui"
        fill={paper?.ink50 || '#6B5E55'}>
        {Array.from({ length: 12 }, (_, i) => (mask >> i) & 1).reduce((a, b) => a + b, 0)} notes
      </text>
    </svg>
  );
}

// ── Two-row 5+7 Lattice ───────────────────────────────────────────────────────

function NeutralLattice({ mask, root, useFlats, onMaskChange, onRootChange,
                          paper = window.PAPER }) {
  const noteNames = useFlats
    ? ['C','D♭','D','E♭','E','F','G♭','G','A♭','A','B♭','B']
    : ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];

  // Bottom row: 7 naturals  [C=0, D=2, E=4, F=5, G=7, A=9, B=11]
  // Top row:    5 chromatics [C#=1, D#=3, F#=6, G#=8, A#=10]  (gap at E-F)
  const naturals   = [0, 2, 4, 5, 7, 9, 11];
  const chromatics = [1, 3, -1, 6, 8, 10];  // -1 = gap between E# and F#

  const R = 16;
  const gap = R * 0.5;
  const step = R * 2 + gap;
  const W = naturals.length * step;

  // x-position for natural index i
  const xNat = i => R + i * step;
  // x-position for chromatic: between natural i and i+1
  const xChr = i => xNat(i) + step / 2;

  const [pressTimers, setPressTimers] = React.useState({});

  const handleDown = (pc, key) => {
    const t = setTimeout(() => {
      onRootChange?.(pc);
      setPressTimers(p => { const q = { ...p }; delete q[key]; return q; });
    }, 400);
    setPressTimers(p => ({ ...p, [key]: t }));
  };

  const handleUp = (pc, key) => {
    if (pressTimers[key] !== undefined) {
      clearTimeout(pressTimers[key]);
      setPressTimers(p => { const q = { ...p }; delete q[key]; return q; });
      const interval = ((pc - root) % 12 + 12) % 12;
      onMaskChange?.(togglePc(mask, interval));
    }
  };

  const Node = ({ pc, x, y }) => {
    const interval = ((pc - root) % 12 + 12) % 12;
    const active   = pcActive(mask, interval);
    const isRoot   = pc === root;
    const key      = `pc${pc}`;
    return (
      <g onPointerDown={() => handleDown(pc, key)}
         onPointerUp={() => handleUp(pc, key)}
         style={{ cursor: 'pointer' }}>
        <circle cx={x} cy={y} r={R}
          fill={active ? (paper?.ink || '#2D2620') : (paper?.card || '#FAF8F4')}
          stroke={isRoot ? (paper?.amber || '#C4873A') : (paper?.rule || '#D4CAB8')}
          strokeWidth={isRoot ? 2.5 : 1} />
        {isRoot && <circle cx={x} cy={y} r={R + 3} fill="none"
          stroke={paper?.amber || '#C4873A'} strokeWidth={2} />}
        <text x={x} y={y} textAnchor="middle" dominantBaseline="middle"
          fontSize={R * 0.72}
          fill={active ? (paper?.card || '#FAF8F4') : (paper?.ink50 || '#6B5E55')}
          style={{ pointerEvents: 'none', fontFamily: 'InterTight, system-ui' }}>
          {noteNames[pc]}
        </text>
      </g>
    );
  };

  const height = R * 2 + gap + R * 2 + 8;

  return (
    <svg width={W + R} height={height + R}
      style={{ userSelect: 'none', touchAction: 'none', overflow: 'visible' }}>
      {/* Bottom row — naturals */}
      {naturals.map((pc, i) => (
        <Node key={pc} pc={pc} x={xNat(i)} y={R * 2 + gap + R} />
      ))}
      {/* Top row — chromatics (with gap) */}
      {chromatics.map((pc, i) => pc >= 0 && (
        <Node key={pc} pc={pc} x={xChr(i)} y={R} />
      ))}
    </svg>
  );
}

// ── All / None / Invert ───────────────────────────────────────────────────────

function MaskControls({ mask, onMaskChange, paper = window.PAPER }) {
  const btn = (label, action) => (
    <button onClick={action} style={{
      padding: '3px 9px', fontSize: 11, borderRadius: 4,
      border: `1px solid ${paper?.rule || '#D4CAB8'}`,
      background: paper?.card || '#FAF8F4',
      color: paper?.ink || '#2D2620',
      cursor: 'pointer', fontFamily: 'InterTight, system-ui',
    }}>
      {label}
    </button>
  );
  return (
    <div style={{ display: 'flex', gap: 4, paddingTop: 4 }}>
      {btn('All',    () => onMaskChange(0x0FFF))}
      {btn('None',   () => onMaskChange(0x0800))}
      {btn('Invert', () => onMaskChange((~mask) & 0x0FFF))}
    </div>
  );
}

// ── Root picker ───────────────────────────────────────────────────────────────

function RootPicker({ root, useFlats, onRootChange, paper = window.PAPER }) {
  const names = useFlats
    ? ['C','D♭','D','E♭','E','F','G♭','G','A♭','A','B♭','B']
    : ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
      {names.map((n, i) => (
        <button key={i} onClick={() => onRootChange(i)} style={{
          width: 30, height: 24, fontSize: 10, borderRadius: 4, cursor: 'pointer',
          border: `1px solid ${i === root ? (paper?.amber || '#C4873A') : (paper?.rule || '#D4CAB8')}`,
          background: i === root ? (paper?.amber || '#C4873A') : (paper?.card || '#FAF8F4'),
          color: i === root ? (paper?.card || '#FAF8F4') : (paper?.ink || '#2D2620'),
          fontFamily: 'InterTight, system-ui',
        }}>
          {n}
        </button>
      ))}
    </div>
  );
}

// ── Scale bank — unified preset + family picker ───────────────────────────────
// Tab row: "Common" (quick performance presets) then one tab per family.
// Scale buttons show note count (k) in family views, echoing PickPCS's k-based
// organisation.  Active scale is amber-highlighted across all views.

// Scales surfaced in the Common tab — ordered by live-performance utility.
const COMMON_IDS = [
  { id: 'ionian',     label: 'Major'     },
  { id: 'aeolian',    label: 'Minor'     },
  { id: 'dorian',     label: 'Dorian'    },
  { id: 'mixolydian', label: 'Mixo.'     },
  { id: 'pentMin',    label: 'Pent. Min' },
  { id: 'pentMaj',    label: 'Pent. Maj' },
  { id: 'blues',      label: 'Blues'     },
  { id: 'chromatic',  label: 'Chromatic' },
];

// Short tab label per family (keep them scannable).
const FAMILY_LABELS = {
  'Diatonic':    'Diatonic',
  'Pentatonic':  'Penta.',
  'Jazz Minor':  'Jazz Min.',
  'Harm. Minor': 'Harm. Min.',
  'Symmetric':   'Symmetric',
  'Bebop':       'Bebop',
  'Blues':       'Blues',
  'Chordal':     'Chordal',
};

function countBits(n) {
  let c = 0, v = n & 0xFFF;
  while (v) { c += v & 1; v >>= 1; }
  return c;
}

function ScaleBank({ mask, root, onSelect, paper = window.PAPER }) {
  const [tab, setTab] = React.useState('Common');
  const scales   = window.SCALES         || [];
  const families = window.SCALE_FAMILIES || [];

  const EXPLORER_TAB = 'Explorer';
  const tabs = ['Common', ...families.map(f => FAMILY_LABELS[f.name] || f.name), EXPLORER_TAB];

  const shown = tab === 'Common'
    ? COMMON_IDS.map(({ id, label }) => {
        const s = scales.find(e => e.id === id);
        return s ? { ...s, label } : null;
      }).filter(Boolean)
    : tab === EXPLORER_TAB
      ? []
      : (() => {
          const fam = families.find(f => (FAMILY_LABELS[f.name] || f.name) === tab);
          return fam ? fam.modes : [];
        })();

  const scaleBtn = (entry, label) => {
    const active = (mask & 0xFFF) === entry.mask;
    const k = countBits(entry.mask);
    return (
      <button key={entry.id}
        onClick={() => onSelect(entry.mask, root)}
        title={`${entry.name} — ${k} notes`}
        style={{
          padding: '4px 9px', fontSize: 11, borderRadius: 5, cursor: 'pointer',
          border: `1px solid ${active ? (paper?.amber || '#C4873A') : (paper?.rule || '#D4CAB8')}`,
          background: active ? (paper?.amber || '#C4873A') : (paper?.card || '#FAF8F4'),
          color: active ? (paper?.card || '#FAF8F4') : (paper?.ink || '#2D2620'),
          fontFamily: 'InterTight, system-ui',
          transition: 'background 100ms',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
        {label ?? entry.name}
        {tab !== 'Common' && tab !== EXPLORER_TAB && (
          <span style={{ fontSize: 9, opacity: 0.6, fontVariantNumeric: 'tabular-nums' }}>{k}</span>
        )}
      </button>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* Tab row */}
      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '3px 8px', fontSize: 10, borderRadius: 4, cursor: 'pointer',
            border: `1px solid ${t === tab ? (paper?.ink || '#2D2620') : (paper?.rule || '#D4CAB8')}`,
            background: t === tab ? (paper?.ink || '#2D2620') : 'transparent',
            color: t === tab ? (paper?.card || '#FAF8F4') : (paper?.ink50 || '#6B5E55'),
            fontFamily: 'InterTight, system-ui',
            letterSpacing: '0.03em',
          }}>{t}</button>
        ))}
      </div>

      {/* Scale buttons (all tabs except Explorer) */}
      {tab !== EXPLORER_TAB && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {shown.map(s => scaleBtn(s, s.label))}
        </div>
      )}

      {/* Explorer tab — concentric PickPCS ring browser */}
      {tab === EXPLORER_TAB && (
        <PCSExplorer mask={mask} root={root} onSelect={onSelect} paper={paper} />
      )}
    </div>
  );
}

// ── Mask input ────────────────────────────────────────────────────────────────
// Direct decimal entry for power users; also shows hex equivalent.

function ScaleMaskInput({ mask, onMaskChange, paper = window.PAPER }) {
  const current = mask & 0xFFF;
  const [draft, setDraft] = React.useState(String(current));

  React.useEffect(() => { setDraft(String(current)); }, [current]);

  const commit = () => {
    const n = parseInt(draft, 10);
    if (Number.isFinite(n) && n >= 0 && n <= 0xFFF && n !== current)
      onMaskChange(n);
    else
      setDraft(String(current));
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{
        fontSize: 10, letterSpacing: '0.07em', textTransform: 'uppercase',
        color: paper?.ink50 || '#6B5E55', fontFamily: 'InterTight, system-ui',
      }}>Mask</span>
      <input type="text" value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') { commit(); e.currentTarget.blur(); }
          if (e.key === 'Escape') { setDraft(String(current)); e.currentTarget.blur(); }
        }}
        onBlur={commit}
        style={{
          width: 56, padding: '3px 6px',
          fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
          fontSize: 12, fontVariantNumeric: 'tabular-nums',
          color: paper?.ink || '#2D2620', background: paper?.bg || '#F5F0E8',
          border: `1px solid ${paper?.rule || '#D4CAB8'}`, borderRadius: 4,
          textAlign: 'right', outline: 'none',
        }} />
      <span style={{
        fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
        fontSize: 10, color: paper?.ink50 || '#6B5E55',
      }}>0x{current.toString(16).toUpperCase().padStart(3, '0')}</span>
    </div>
  );
}

// ── Composed scale editor ─────────────────────────────────────────────────────

export function ScaleEditor({ state, sendParam, paper = window.PAPER }) {
  const { pcsMask: mask = 0x0AD5, pcsRoot: root = 0, useFlats = false } = state;

  const setMask = m => sendParam('pcsMask', m & 0x0FFF);
  const setRoot = r => sendParam('pcsRoot', r);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Scale bank — Common quick presets + full family taxonomy in one tabbed UI */}
      <ScaleBank mask={mask} root={root} paper={paper}
        onSelect={(m, r) => { setMask(m); setRoot(r); }} />
      {/* Wheel + Lattice side by side */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <ChromaticWheelSVG
          mask={mask} root={root} useFlats={useFlats}
          onMaskChange={setMask} onRootChange={setRoot}
          size={200} paper={paper} />
        <div style={{ paddingTop: 8 }}>
          <NeutralLattice
            mask={mask} root={root} useFlats={useFlats}
            onMaskChange={setMask} onRootChange={setRoot}
            paper={paper} />
        </div>
      </div>
      {/* Root */}
      <RootPicker root={root} useFlats={useFlats} onRootChange={setRoot} paper={paper} />
      {/* All / None / Invert */}
      <MaskControls mask={mask} onMaskChange={setMask} paper={paper} />
      {/* Direct mask entry */}
      <ScaleMaskInput mask={mask} onMaskChange={setMask} paper={paper} />
    </div>
  );
}
