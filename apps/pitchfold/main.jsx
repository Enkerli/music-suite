// main.jsx — PitchFold React app entry point.

import { initJuceBridge, sendParam, sendSelectPad, sendPadData, sendPanic, PARAM_MAP }
  from './juce-bridge.js';
import './design/tokens.jsx';              // window.PAPER, SCALES, SCALE_FAMILIES, PITCH_*
import { ScaleEditor }    from './design/scale-editor.jsx';
import { PCSExplorer }    from './design/pcs-explorer.jsx';
import { QuantizerPanel } from './design/quantizer-panel.jsx';
import { ChordPads }      from './design/chord-pads.jsx';
import { VoicePanel }     from './design/voice-panel.jsx';
import { TimePanel }      from './design/time-panel.jsx';

// ── Initial state (demo defaults; JUCE overwrites via stateSnapshot) ───────────

const DEFAULT_STATE = {
  pcsRoot:       0,
  pcsMask:       0x0AD5,   // Ionian
  quantDir:      0,
  quantStrength: 1.0,
  outputLo:      0,
  outputHi:      127,
  useFlats:      false,
  timeGrid:      0,
  timeStrength:  1.0,
  humanizeTime:  0.0,
  humanizeVel:   0.0,
  swing:         0.0,
  lookAheadMs:   0.0,
  voiceMode:     0,
  monoSelect:    0,
  splitVoices:   2,
  splitChannel:  1,
  pads:          Array.from({ length: 16 }, (_, i) => ({ index: i, mask: 0x0AD5, root: 0, label: '', selected: false })),
};

// ── App ───────────────────────────────────────────────────────────────────────

function PitchFoldApp() {
  const paper = window.PAPER || {};
  const [state, setState] = React.useState(DEFAULT_STATE);
  const [tab,   setTab]   = React.useState('scale');   // 'scale' | 'time' | 'voice' | 'pads'
  const [dark,  setDark]  = React.useState(false);

  const activePaper = dark ? (window.PAPER_DARK || paper) : paper;

  // ── JUCE bridge ────────────────────────────────────────────────────────────

  React.useEffect(() => {
    initJuceBridge(event => {
      if (event.type === 'stateSnapshot') {
        setState(prev => ({ ...prev, ...event.snap }));
      } else if (event.type === 'paramChange') {
        // Find the PARAM_MAP entry for this APVTS param id.
        const entry = PARAM_MAP.find(([, id]) => id === event.id);
        if (entry) {
          const [field, , rawToReact] = entry;
          setState(prev => ({ ...prev, [field]: rawToReact(event.value) }));
        }
      }
    });
  }, []);

  // ── Param sender ───────────────────────────────────────────────────────────

  const send = (field, value) => {
    setState(prev => ({ ...prev, [field]: value }));
    sendParam(field, value);
  };

  // ── Tabs ───────────────────────────────────────────────────────────────────

  const TABS = [
    { id: 'scale',   label: 'Scale'   },
    { id: 'pickpcs', label: 'PickPCS' },
    { id: 'pads',    label: 'Pads'    },
    { id: 'voice',   label: 'Voice'   },
    { id: 'time',    label: 'Time'    },
  ];

  return (
    <div style={{
      width: '100%', height: '100%',
      background: activePaper.bg || '#F5F0E8',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'InterTight, system-ui',
      color: activePaper.ink || '#2D2620',
    }}>
      {/* Header */}
      <div style={{
        padding: '8px 16px',
        borderBottom: `1px solid ${activePaper.rule || '#D4CAB8'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: activePaper.card || '#FAF8F4',
        flexShrink: 0,
      }}>
        <span style={{
          fontFamily: 'Domine, Georgia, serif', fontStyle: 'italic',
          fontSize: 18, color: activePaper.ink || '#2D2620',
        }}>
          PitchFold
        </span>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {/* Tab bar */}
          {TABS.map(t => (
            <button key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '4px 12px', fontSize: 11, borderRadius: 5, cursor: 'pointer',
                border: `1px solid ${tab === t.id ? (activePaper.ink || '#2D2620') : (activePaper.rule || '#D4CAB8')}`,
                background: tab === t.id ? (activePaper.ink || '#2D2620') : 'transparent',
                color: tab === t.id ? (activePaper.card || '#FAF8F4') : (activePaper.ink || '#2D2620'),
                transition: 'background 100ms',
              }}>
              {t.label}
            </button>
          ))}

          {/* Dark mode */}
          <button onClick={() => setDark(d => !d)} title="Toggle dark mode" style={{
            padding: '4px 8px', fontSize: 12, borderRadius: 5, cursor: 'pointer',
            border: `1px solid ${activePaper.rule || '#D4CAB8'}`,
            background: 'transparent', color: activePaper.ink70 || '#574E44',
          }}>
            {dark ? '☀' : '◑'}
          </button>

          {/* Panic */}
          <button onClick={sendPanic} title="All Notes Off" style={{
            padding: '4px 8px', fontSize: 11, borderRadius: 5, cursor: 'pointer',
            border: `1px solid ${activePaper.rule || '#D4CAB8'}`,
            background: 'transparent', color: activePaper.ink50 || '#6B5E55',
          }}>
            ✕ Panic
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {tab === 'scale' && (
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div style={{ flex: '0 0 auto' }}>
              <SectionTitle paper={activePaper}>Pitch Class Set</SectionTitle>
              <ScaleEditor state={state} sendParam={send} paper={activePaper} />
            </div>
            <div style={{ flex: '0 0 220px' }}>
              <SectionTitle paper={activePaper}>Quantizer</SectionTitle>
              <QuantizerPanel state={state} sendParam={send} paper={activePaper} />
            </div>
          </div>
        )}

        {tab === 'pickpcs' && (
          <div style={{ maxWidth: 520, margin: '0 auto' }}>
            <SectionTitle paper={activePaper}>PickPCS Explorer</SectionTitle>
            <PCSExplorer
              mask={state.pcsMask}
              root={state.pcsRoot}
              paper={activePaper}
              onSelect={(m, r) => { send('pcsMask', m); send('pcsRoot', r); }}
            />
          </div>
        )}

        {tab === 'pads' && (
          <div>
            <SectionTitle paper={activePaper}>Chord Pads</SectionTitle>
            <div style={{
              fontSize: 10, color: activePaper.ink50 || '#6B5E55',
              marginBottom: 10, fontFamily: 'InterTight, system-ui',
            }}>
              Tap to activate · Long-press to edit · Active pad overrides main PCS
            </div>
            <ChordPads state={state} paper={activePaper}
              sendSelectPad={i => { setState(p => ({ ...p, pads: p.pads.map(pd => ({ ...pd, selected: pd.index === i })) })); sendSelectPad(i); }}
              sendPadData={(i, mask, root, label) => {
                setState(p => ({ ...p, pads: p.pads.map(pd => pd.index === i ? { ...pd, mask, root, label } : pd) }));
                sendPadData(i, mask, root, label);
              }} />
          </div>
        )}

        {tab === 'voice' && (
          <div style={{ maxWidth: 480 }}>
            <SectionTitle paper={activePaper}>Voice</SectionTitle>
            <VoicePanel state={state} sendParam={send} paper={activePaper} />
          </div>
        )}

        {tab === 'time' && (
          <div style={{ maxWidth: 380 }}>
            <SectionTitle paper={activePaper}>Time</SectionTitle>
            <TimePanel state={state} sendParam={send} paper={activePaper} />
          </div>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ paper, children }) {
  return (
    <div style={{
      fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em',
      color: paper?.ink50 || '#6B5E55', marginBottom: 10,
      fontFamily: 'InterTight, system-ui', fontWeight: 600,
      borderBottom: `1px solid ${paper?.ruleFaint || '#EAE3D8'}`,
      paddingBottom: 4,
    }}>{children}</div>
  );
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<PitchFoldApp />);
