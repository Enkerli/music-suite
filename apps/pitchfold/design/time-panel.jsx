// time-panel.jsx — time grid, humanization, look-ahead.

const GRID_LABELS = ['Off', '1/32', '1/16T', '1/16', '1/8T', '1/8', '1/4T', '1/4'];

export function TimePanel({ state, sendParam, paper = window.PAPER }) {
  const {
    timeGrid      = 0,
    timeStrength  = 1.0,
    humanizeTime  = 0.0,
    humanizeVel   = 0.0,
    swing         = 0.0,
    lookAheadMs   = 0.0,
  } = state;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Grid */}
      <div>
        <Label paper={paper}>Grid</Label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
          {GRID_LABELS.map((l, i) => (
            <button key={i} onClick={() => sendParam('timeGrid', i)}
              style={{ ...chipStyle(i === timeGrid, paper), padding: '3px 8px', fontSize: 10 }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Grid strength — only relevant when grid != Off */}
      {timeGrid > 0 && (
        <SliderRow label="Grid strength" value={timeStrength} min={0} max={1} step={0.01}
          format={v => Math.round(v * 100) + '%'}
          onChange={v => sendParam('timeStrength', v)} paper={paper} />
      )}

      {/* Swing */}
      {timeGrid > 0 && (
        <SliderRow label="Swing" value={swing} min={0} max={1} step={0.01}
          format={v => v === 0 ? 'Straight' : Math.round(v * 100) + '%'}
          onChange={v => sendParam('swing', v)} paper={paper} />
      )}

      {/* Humanize time */}
      <SliderRow label="Humanize time" value={humanizeTime} min={0} max={200} step={0.5}
        format={v => v === 0 ? 'Off' : v.toFixed(0) + ' ms'}
        onChange={v => sendParam('humanizeTime', v)} paper={paper} />

      {/* Humanize velocity */}
      <SliderRow label="Humanize velocity" value={humanizeVel} min={0} max={1} step={0.01}
        format={v => v === 0 ? 'Off' : '±' + Math.round(v * 100) + '%'}
        onChange={v => sendParam('humanizeVel', v)} paper={paper} />

      {/* Look-ahead */}
      <div>
        <SliderRow label="Look-ahead" value={lookAheadMs} min={0} max={500} step={1}
          format={v => v === 0 ? 'Off' : v.toFixed(0) + ' ms'}
          onChange={v => sendParam('lookAheadMs', v)} paper={paper} />
        {lookAheadMs > 0 && (
          <div style={{
            marginTop: 3, fontSize: 9, color: paper?.ink50 || '#6B5E55',
            fontFamily: 'InterTight, system-ui',
          }}>
            Adds {lookAheadMs.toFixed(0)} ms latency — enables retroactive quantization.
          </div>
        )}
      </div>
    </div>
  );
}

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
    padding: '4px 10px', fontSize: 11, borderRadius: 5, cursor: 'pointer',
    border: `1px solid ${active ? (paper?.ink || '#2D2620') : (paper?.rule || '#D4CAB8')}`,
    background: active ? (paper?.ink || '#2D2620') : (paper?.card || '#FAF8F4'),
    color: active ? (paper?.card || '#FAF8F4') : (paper?.ink || '#2D2620'),
    fontFamily: 'InterTight, system-ui', transition: 'background 100ms',
  };
}

function SliderRow({ label, value, min, max, step, format, onChange, paper }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <Label paper={paper}>{label}</Label>
        <span style={{ fontSize: 11, color: paper?.ink70 || '#574E44',
          fontFamily: 'InterTight, system-ui' }}>
          {format ? format(value) : value}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: paper?.ink || '#2D2620' }} />
    </div>
  );
}
