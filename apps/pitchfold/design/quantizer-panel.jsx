// quantizer-panel.jsx — Snap direction, output range.
// Strength is hidden (reserved for future probability/histogram features).

const NOTE_NAMES = ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
function noteName(n) {
  return NOTE_NAMES[((n % 12) + 12) % 12] + (Math.floor(n / 12) - 1);
}

// quantDir: 0=Auto 1=Nearest 2=Up 3=Down
const SNAP_DIRS  = ['Auto', 'Nearest', 'Up', 'Down'];
const SNAP_ICONS = ['⟳', '⇅', '↑', '↓'];
const SNAP_TIPS  = [
  'Follows pitch direction',
  'Snap to nearest active pitch',
  'Always snap up',
  'Always snap down',
];

export function QuantizerPanel({ state, sendParam, paper = window.PAPER }) {
  const {
    quantDir = 0,
    outputLo = 0,
    outputHi = 127,
  } = state;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Snap direction */}
      <div>
        <Label paper={paper}>Snap</Label>
        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
          {SNAP_DIRS.map((d, i) => (
            <button key={i} onClick={() => sendParam('quantDir', i)}
              title={SNAP_TIPS[i]}
              style={chipStyle(i === quantDir, paper)}>
              <span style={{ marginRight: 3 }}>{SNAP_ICONS[i]}</span>{d}
            </button>
          ))}
        </div>
      </div>

      {/* Output range — single drag control */}
      <div>
        <Label paper={paper}>Output range</Label>
        <RangeSlider
          lo={outputLo} hi={outputHi}
          min={0} max={127}
          paper={paper}
          onChangeLo={v => sendParam('outputLo', v)}
          onChangeHi={v => sendParam('outputHi', v)}
          onChangeRange={(lo, hi) => { sendParam('outputLo', lo); sendParam('outputHi', hi); }}
        />
      </div>
    </div>
  );
}

// ── Range slider ──────────────────────────────────────────────────────────────
// Two handles on one track.  Drag a handle to move that boundary.
// Drag the filled section between handles to shift the whole range at once.

function RangeSlider({ lo, hi, min, max, onChangeLo, onChangeHi, onChangeRange, paper }) {
  const trackRef  = React.useRef(null);
  // Use a ref for drag state so event-listener closures always see current values.
  const dragRef   = React.useRef({ which: null, startX: 0, startLo: 0, startHi: 0 });

  const frac    = v => (v - min) / (max - min);
  const fromFrac = f => Math.round(Math.max(min, Math.min(max, min + f * (max - min))));

  const getX = e => {
    const touch = e.touches?.[0] ?? e;
    const rect  = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    return Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
  };

  React.useEffect(() => {
    // Capture lo/hi in the effect so event handlers see live values.
    const loSnap = lo, hiSnap = hi;

    const onMove = e => {
      const d = dragRef.current;
      if (!d.which) return;
      const f  = getX(e);
      const df = f - d.startX;

      if (d.which === 'lo') {
        onChangeLo(Math.max(min, Math.min(fromFrac(frac(d.startLo) + df), d.startHi - 1)));
      } else if (d.which === 'hi') {
        onChangeHi(Math.min(max, Math.max(fromFrac(frac(d.startHi) + df), d.startLo + 1)));
      } else {  // 'range' — each handle clamps independently so the range
               //  narrows when pushed past a boundary (DrawnQurve behaviour)
        let newLo = fromFrac(frac(d.startLo) + df);
        let newHi = fromFrac(frac(d.startHi) + df);
        if (newLo > newHi) newLo = newHi;
        onChangeRange(newLo, newHi);
      }
    };

    const onUp = () => { dragRef.current.which = null; };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup',   onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup',   onUp);
    };
  }, [lo, hi, min, max]);  // rebind when values change so startLo/Hi are accurate

  const startDrag = (e, which) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { which, startX: getX(e), startLo: lo, startHi: hi };
  };

  const loF = frac(lo);
  const hiF = frac(hi);
  const ink     = paper?.ink   || '#2D2620';
  const amber   = paper?.amber || '#C4873A';
  const card    = paper?.card  || '#FAF8F4';
  const rule    = paper?.rule  || '#D4CAB8';
  const ink50   = paper?.ink50 || '#6B5E55';

  return (
    <div style={{ marginTop: 6 }}>
      {/* Track */}
      <div ref={trackRef}
        style={{ position: 'relative', height: 28, marginBottom: 2 }}>

        {/* Track BG */}
        <div style={{
          position: 'absolute', top: 12, left: 0, right: 0, height: 4,
          background: rule, borderRadius: 2,
        }} />

        {/* Active range — drag to shift whole range */}
        <div
          onPointerDown={e => startDrag(e, 'range')}
          style={{
            position: 'absolute', top: 12, height: 4,
            left: `${loF * 100}%`,
            width: `${(hiF - loF) * 100}%`,
            background: amber, borderRadius: 2,
            cursor: 'grab', userSelect: 'none', touchAction: 'none',
          }} />

        {/* Lo handle */}
        <Handle frac={loF} onDown={e => startDrag(e, 'lo')} ink={ink} card={card} />
        {/* Hi handle */}
        <Handle frac={hiF} onDown={e => startDrag(e, 'hi')} ink={ink} card={card} />
      </div>

      {/* Labels */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        fontSize: 10, color: ink50,
        fontFamily: 'InterTight, system-ui',
      }}>
        <span style={{ fontFamily: 'Domine, serif', fontStyle: 'italic', fontSize: 11,
          color: ink }}>{noteName(lo)}</span>
        <span>{lo === hi ? 'Single note' : `${hi - lo} semitones`}</span>
        <span style={{ fontFamily: 'Domine, serif', fontStyle: 'italic', fontSize: 11,
          color: ink }}>{noteName(hi)}</span>
      </div>
    </div>
  );
}

function Handle({ frac, onDown, ink, card }) {
  return (
    <div
      onPointerDown={onDown}
      style={{
        position: 'absolute', top: 6, width: 16, height: 16,
        borderRadius: '50%',
        background: card,
        border: `2px solid ${ink}`,
        left: `calc(${frac * 100}% - 8px)`,
        cursor: 'ew-resize',
        userSelect: 'none', touchAction: 'none',
        boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
      }} />
  );
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function Label({ paper, children }) {
  return (
    <div style={{
      fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em',
      color: paper?.ink50 || '#6B5E55', fontFamily: 'InterTight, system-ui',
    }}>{children}</div>
  );
}

function chipStyle(active, paper) {
  return {
    padding: '4px 9px', fontSize: 11, borderRadius: 5, cursor: 'pointer',
    border: `1px solid ${active ? (paper?.ink || '#2D2620') : (paper?.rule || '#D4CAB8')}`,
    background: active ? (paper?.ink || '#2D2620') : (paper?.card || '#FAF8F4'),
    color: active ? (paper?.card || '#FAF8F4') : (paper?.ink || '#2D2620'),
    fontFamily: 'InterTight, system-ui',
    transition: 'background 100ms',
  };
}
