// chord-pads.jsx — 16 performance pads, each holding a PCS + root + label.
// Tapping a pad activates it (overrides main PCS); tapping again deselects.
// Long-press opens an edit popover.

const NOTE_NAMES_S = ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];

function rootName(root, useFlats = false) {
  const flat = ['C','D♭','D','E♭','E','F','G♭','G','A♭','A','B♭','B'];
  return useFlats ? flat[root] : NOTE_NAMES_S[root];
}

function maskNotesCount(mask) {
  let n = 0;
  for (let i = 0; i < 12; i++) n += (mask >> i) & 1;
  return n;
}

function recognizeName(mask) {
  const m = mask & 0xFFF;
  const found = (window.SCALES || []).find(s => s.mask === m);
  return found ? found.name : 'Custom';
}

// ── Single pad ────────────────────────────────────────────────────────────────

function Pad({ pad, selected, onSelect, onEdit, paper = window.PAPER }) {
  const { index, mask = 0xAD5, root = 0, label = '' } = pad;
  const isActive = selected === index;

  const [pressTimer, setPressTimer] = React.useState(null);

  const handleDown = () => {
    const t = setTimeout(() => {
      onEdit?.(index);
      setPressTimer(null);
    }, 500);
    setPressTimer(t);
  };

  const handleUp = () => {
    if (pressTimer !== null) {
      clearTimeout(pressTimer);
      setPressTimer(null);
      onSelect(isActive ? -1 : index);
    }
  };

  const name = label || recognizeName(mask);
  const root_name = rootName(root);

  return (
    <div
      onPointerDown={handleDown}
      onPointerUp={handleUp}
      onPointerLeave={() => { if (pressTimer !== null) { clearTimeout(pressTimer); setPressTimer(null); } }}
      style={{
        width: 80, height: 64,
        borderRadius: 8,
        border: `2px solid ${isActive ? (paper?.amber || '#C4873A') : (paper?.rule || '#D4CAB8')}`,
        background: isActive
          ? (paper?.bgDeep || '#EDE6D8')
          : (paper?.card || '#FAF8F4'),
        boxShadow: isActive ? `0 0 0 3px ${(paper?.amber || '#C4873A')}44` : 'none',
        cursor: 'pointer',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 2,
        userSelect: 'none', touchAction: 'none',
        transition: 'box-shadow 80ms, background 80ms',
        padding: 4,
      }}>
      <div style={{
        fontSize: 10, fontFamily: 'InterTight, system-ui', fontWeight: 600,
        color: isActive ? (paper?.amber || '#C4873A') : (paper?.ink || '#2D2620'),
        textAlign: 'center', lineHeight: 1.2, maxWidth: '100%',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {root_name} {name}
      </div>
      <div style={{
        fontSize: 9, color: paper?.ink50 || '#6B5E55',
        fontFamily: 'InterTight, system-ui',
      }}>
        {maskNotesCount(mask)} notes
      </div>
      <div style={{
        fontSize: 8, color: paper?.ink30 || '#B3A99E',
        fontFamily: 'InterTight, system-ui',
      }}>
        Pad {index + 1}
      </div>
    </div>
  );
}

// ── 4×4 grid ──────────────────────────────────────────────────────────────────

export function ChordPads({ state, sendSelectPad, sendPadData, paper = window.PAPER }) {
  const { pads = [], pcsMask: mainMask = 0xAD5, pcsRoot: mainRoot = 0 } = state;
  const selected = (pads.find(p => p.selected) || {}).index ?? -1;

  const [editing, setEditing] = React.useState(null);  // pad index being edited

  const handleEdit = (index) => setEditing(index);

  return (
    <div>
      {/* 4×4 grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 80px)', gap: 6,
      }}>
        {pads.map(pad => (
          <Pad key={pad.index} pad={pad} selected={selected}
            onSelect={i => sendSelectPad(i)} onEdit={handleEdit} paper={paper} />
        ))}
      </div>

      {/* Edit popover */}
      {editing !== null && (
        <PadEditor
          pad={pads[editing]}
          mainMask={mainMask} mainRoot={mainRoot}
          paper={paper}
          onSave={(mask, root, label) => {
            sendPadData(editing, mask, root, label);
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

// ── Pad editor (inline popover) ───────────────────────────────────────────────

function PadEditor({ pad, mainMask, mainRoot, paper, onSave, onClose }) {
  const [mask,  setMask]  = React.useState(pad?.mask  ?? mainMask);
  const [root,  setRoot]  = React.useState(pad?.root  ?? mainRoot);
  const [label, setLabel] = React.useState(pad?.label ?? '');

  return (
    <div style={{
      marginTop: 10, padding: 12,
      background: paper?.card || '#FAF8F4',
      border: `1px solid ${paper?.rule || '#D4CAB8'}`,
      borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontFamily: 'Domine, serif', fontStyle: 'italic',
          color: paper?.ink || '#2D2620' }}>
          Edit Pad {(pad?.index ?? 0) + 1}
        </span>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', cursor: 'pointer', fontSize: 14,
          color: paper?.ink50 || '#6B5E55',
        }}>✕</button>
      </div>

      {/* Label */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em',
          color: paper?.ink50 || '#6B5E55', marginBottom: 3,
          fontFamily: 'InterTight, system-ui' }}>Label</div>
        <input
          value={label} onChange={e => setLabel(e.target.value)}
          placeholder={recognizeName(mask)}
          style={{
            width: '100%', padding: '4px 8px', fontSize: 11, borderRadius: 4,
            border: `1px solid ${paper?.rule || '#D4CAB8'}`,
            background: paper?.bg || '#F5F0E8',
            color: paper?.ink || '#2D2620',
            fontFamily: 'InterTight, system-ui',
            outline: 'none',
          }} />
      </div>

      {/* Root buttons */}
      <div style={{ marginBottom: 8, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        {NOTE_NAMES_S.map((n, i) => (
          <button key={i} onClick={() => setRoot(i)} style={{
            width: 28, height: 22, fontSize: 9, borderRadius: 4, cursor: 'pointer',
            border: `1px solid ${i === root ? (paper?.amber || '#C4873A') : (paper?.rule || '#D4CAB8')}`,
            background: i === root ? (paper?.amber || '#C4873A') : (paper?.card || '#FAF8F4'),
            color: i === root ? (paper?.card || '#FAF8F4') : (paper?.ink || '#2D2620'),
            fontFamily: 'InterTight, system-ui',
          }}>{n}</button>
        ))}
      </div>

      {/* Mask bits — simplified: copy from main or toggle */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <button onClick={() => setMask(mainMask)} style={smallBtn(paper)}>Copy main</button>
        <button onClick={() => setMask(0x0FFF)} style={smallBtn(paper)}>All</button>
        <button onClick={() => setMask(0x0800)} style={smallBtn(paper)}>None</button>
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={() => onSave(mask, root, label)} style={{
          ...smallBtn(paper),
          background: paper?.ink || '#2D2620',
          color: paper?.card || '#FAF8F4',
          border: 'none',
        }}>Save</button>
        <button onClick={onClose} style={smallBtn(paper)}>Cancel</button>
      </div>
    </div>
  );
}

function smallBtn(paper) {
  return {
    padding: '4px 10px', fontSize: 11, borderRadius: 4, cursor: 'pointer',
    border: `1px solid ${paper?.rule || '#D4CAB8'}`,
    background: paper?.bg || '#F5F0E8',
    color: paper?.ink || '#2D2620',
    fontFamily: 'InterTight, system-ui',
  };
}
