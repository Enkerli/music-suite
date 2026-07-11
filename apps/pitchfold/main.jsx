// main.jsx — PitchFold React app entry point.

import { initJuceBridge, sendParam, sendSelectPad, sendPadData, sendPanic, PARAM_MAP, juceAvailable }
  from './juce-bridge.js';
import { startWebMidi, selectMidiInput, selectMidiOutput, sendMidiNoteOn, sendMidiNoteOff, midiSupported }
  from './webmidi-bridge.js';
import { quantize } from './engine/pcs.js';
import { VoiceProcessor } from './engine/voices.js';
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
  pcsMask:       0x0AB5,   // Ionian
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
  pads:          Array.from({ length: 16 }, (_, i) => ({ index: i, mask: 0x0AB5, root: 0, label: '', selected: false })),
};

// ── App ───────────────────────────────────────────────────────────────────────

function PitchFoldApp() {
  const paper = window.PAPER || {};
  const [state, setState] = React.useState(DEFAULT_STATE);
  const [tab,   setTab]   = React.useState('scale');   // 'scale' | 'time' | 'voice' | 'pads'
  // Theme — the suite's ONE mechanism (shared-frame pass): [data-theme] on
  // <html>, persisted as "enkerli.theme", OS preference until chosen. The
  // PAPER swap keys off the same resolved value, so SVG attrs and any
  // --es-* CSS agree.
  const resolvedDark = () => {
    try { const s = localStorage.getItem('enkerli.theme'); if (s === 'light' || s === 'dark') return s === 'dark'; } catch { /* fine */ }
    try { return matchMedia('(prefers-color-scheme: dark)').matches; } catch { return false; }
  };
  const [dark, setDark] = React.useState(resolvedDark);
  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }, [dark]);
  const toggleTheme = () => {
    const next = !dark;
    try { localStorage.setItem('enkerli.theme', next ? 'dark' : 'light'); } catch { /* fine */ }
    setDark(next);
  };

  const activePaper = dark ? (window.PAPER_DARK || paper) : paper;

  // ── Standalone MIDI I/O (webapp runtime only; the plugin uses C++ MIDI) ──────
  // PitchFold's webapp is otherwise a UI shell; this is the JS quantizer engine
  // (ported from PCSEngine.h / VoiceProcessor.h) wired to real Web MIDI so the
  // standalone build snaps incoming notes like the plugin: in → quantize → voice
  // mode → out, with a note-map so each input note's outputs release on note-off.
  const standalone = !juceAvailable();
  const [midiPorts, setMidiPorts] = React.useState({ inputs: [], outputs: [] });
  const [midiInId,  setMidiInId]  = React.useState('');
  const [midiOutId, setMidiOutId] = React.useState('');
  const [midiErr,   setMidiErr]   = React.useState('');
  const [scaleFlash, setScaleFlash] = React.useState('');   // "scale received" notice

  const liveRef    = React.useRef(state); liveRef.current = state;
  const outIdRef   = React.useRef(midiOutId); outIdRef.current = midiOutId;
  const lastInRef  = React.useRef(-1);
  const noteMap    = React.useRef(new Map());      // inputNote → [{note, channel}]
  const voicesRef  = React.useRef(null);
  if (!voicesRef.current) voicesRef.current = new VoiceProcessor();

  const releaseNote = (inputNote) => {
    const rec = noteMap.current.get(inputNote);
    if (!rec) return;
    for (const o of rec) sendMidiNoteOff(o.note, o.channel);
    noteMap.current.delete(inputNote);
  };
  const handleNote = (e) => {
    if (!outIdRef.current) return;          // nothing selected to play out
    if (!e.on) { releaseNote(e.note); return; }
    const s = liveRef.current;
    let dir;
    if (s.quantDir === 0)                    // Auto: follow melodic direction
      dir = lastInRef.current < 0 ? 'nearest'
          : e.note > lastInRef.current ? 'up'
          : e.note < lastInRef.current ? 'down' : 'nearest';
    else dir = s.quantDir === 2 ? 'up' : s.quantDir === 3 ? 'down' : 'nearest';
    lastInRef.current = e.note;
    const q = quantize(e.note, s.pcsMask, s.pcsRoot, dir, s.outputLo, s.outputHi);
    const cfg = { mode: s.voiceMode, chordMask: s.pcsMask, chordRoot: s.pcsRoot,
                  splitVoices: s.splitVoices, splitChannel: s.splitChannel,
                  loNote: s.outputLo, hiNote: s.outputHi };
    const outs = voicesRef.current.processNoteOn(q, e.channel, cfg);
    releaseNote(e.note);                     // replace any prior record for this note
    noteMap.current.set(e.note, outs);
    for (const o of outs) sendMidiNoteOn(o.note, e.velocity || 100, o.channel);
  };
  const panic = () => {
    sendPanic();
    if (standalone) for (const k of [...noteMap.current.keys()]) releaseNote(k);
  };

  React.useEffect(() => {
    if (!standalone || !midiSupported()) return undefined;
    let cancelled = false;
    startWebMidi({
      onDevices: p => { if (!cancelled) setMidiPorts(p); },
      onNote: e => handleNote(e),
      // Suite protocol (@enkerli/protocol over SysEx): another suite app —
      // canonically PickPCS — pushes a scale; it lands on the SAME path the
      // scale editor uses, so the engine, pads context, and JUCE param (when
      // bridged) all follow.
      onScale: (body, from) => {
        if (cancelled) return;
        send('pcsMask', body.mask & 0xFFF);
        if (Number.isInteger(body.root)) send('pcsRoot', body.root);
        setScaleFlash(`↧ ${body.name || 'scale'} · from ${from}`);
        window.setTimeout(() => setScaleFlash(''), 4000);
      },
    }).then(res => {
      if (cancelled) return;
      if (res.ok) { setMidiPorts(res.ports); setMidiErr(''); }
      else setMidiErr(res.error || 'MIDI unavailable');
    });
    return () => { cancelled = true; };
  }, [standalone]);
  React.useEffect(() => { selectMidiInput(midiInId); },  [midiInId, midiPorts]);
  React.useEffect(() => { selectMidiOutput(midiOutId); }, [midiOutId, midiPorts]);

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

          {/* Theme — canonical suite control: names the TARGET mode */}
          <button id="theme-toggle" onClick={toggleTheme} title="Switch theme"
            aria-pressed={dark} style={{
            padding: '4px 8px', fontSize: 12, borderRadius: 5, cursor: 'pointer',
            border: `1px solid ${activePaper.rule || '#ddd6ca'}`,
            background: 'transparent', color: activePaper.ink70 || '#4b463e',
          }}>
            {dark ? '☀︎ Light' : '● Dark'}
          </button>

          {/* Panic */}
          <button onClick={panic} title="All Notes Off" style={{
            padding: '4px 8px', fontSize: 11, borderRadius: 5, cursor: 'pointer',
            border: `1px solid ${activePaper.rule || '#D4CAB8'}`,
            background: 'transparent', color: activePaper.ink50 || '#6B5E55',
          }}>
            ✕ Panic
          </button>
        </div>
      </div>

      {/* Standalone MIDI device routing (a plugin host owns this otherwise) */}
      {standalone && (
        <div style={{
          display: 'flex', gap: 16, alignItems: 'center', padding: '6px 16px',
          borderBottom: `1px solid ${activePaper.rule || '#D4CAB8'}`,
          background: activePaper.card || '#FAF8F4', flexShrink: 0, fontSize: 11,
          fontFamily: 'InterTight, system-ui',
        }}>
          <span style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, color: activePaper.ink50 || '#6B5E55' }}>MIDI</span>
          {midiErr
            ? <span style={{ color: activePaper.ink50 || '#6B5E55' }}>{midiErr}</span>
            : <>
                <DeviceSel label="In"  paper={activePaper} ports={midiPorts.inputs}  value={midiInId}  onChange={setMidiInId} />
                <DeviceSel label="Out" paper={activePaper} ports={midiPorts.outputs} value={midiOutId} onChange={setMidiOutId} />
              </>}
          {scaleFlash && <span style={{ color: activePaper.accent || '#B05E2E', fontWeight: 600 }}>{scaleFlash}</span>}
        </div>
      )}

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

function DeviceSel({ label, paper, ports, value, onChange }) {
  return (
    <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', color: paper?.ink70 || '#574E44' }}>
      <span>{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)} aria-label={`MIDI ${label}`} style={{
        fontSize: 11, padding: '3px 6px', borderRadius: 5,
        border: `1px solid ${paper?.rule || '#D4CAB8'}`, background: 'transparent', color: paper?.ink || '#2D2620',
      }}>
        <option value="">{ports.length ? 'None' : 'No devices'}</option>
        {ports.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </label>
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
