// main.jsx — PitchFold React app entry point.

import { initJuceBridge, sendParam, sendSelectPad, sendPadData, sendPanic, PARAM_MAP, juceAvailable }
  from './juce-bridge.js';
import { startWebMidi, selectMidiInput, selectMidiOutput, sendMidiNoteOn, sendMidiNoteOff, midiSupported }
  from './webmidi-bridge.js';
import { connectPitchFold } from './control.js';
import { quantize } from './engine/pcs.js';
import { VoiceProcessor } from './engine/voices.js';
import { activePcs } from './engine/pads.js';
import './design/tokens.jsx';              // window.PAPER, SCALES, SCALE_FAMILIES, PITCH_*
import { initTheme, resolvedTheme } from '@enkerli/ui/theme';
import { createGlobalCluster } from '@enkerli/ui/global-cluster';
import { toast } from '@enkerli/ui/toast';
import esTokensCss from '@enkerli/ui/tokens.css';
import esComponentsCss from '@enkerli/ui/components.css';

// Shared-frame CSS (tokens are :root vars only; components are .es-*-scoped —
// neither touches PitchFold's inline PAPER styling) + the ONE theme mechanism.
for (const css of [esTokensCss, esComponentsCss]) {
  const s = document.createElement('style');
  s.textContent = css;
  document.head.appendChild(s);
}
initTheme();
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
  // Theme — @enkerli/ui/theme owns [data-theme] + the "enkerli.theme" key
  // (this file used to carry the third private copy of that logic — design
  // audit 2026-07-19 F4). React only mirrors the resolved value so the PAPER
  // swap keys off the same truth; the cluster's toggle drives changes.
  const [dark, setDark] = React.useState(() => resolvedTheme() === 'dark');

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
    const { mask: activeMask, root: activeRoot } = activePcs(s);
    // quantStrength (docs/PITCHFOLD_AUDIT.md): was registered as an
    // automatable param but never actually reached this call site (defaulted
    // to full-strength 1 always). Now threaded through for real.
    const q = quantize(e.note, activeMask, activeRoot, dir, s.outputLo, s.outputHi, s.quantStrength);
    const cfg = { mode: s.voiceMode, chordMask: activeMask, chordRoot: activeRoot,
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
    // Suite protocol (@enkerli/protocol): another suite app — canonically
    // PickPCS — pushes a scale; it lands on the SAME path the scale editor
    // uses, so the engine, pads context, and JUCE param (when bridged) all
    // follow. One handler, two transports: MIDI SysEx AND the in-browser bus.
    const onScale = (body, from) => {
      if (cancelled) return;
      send('pcsMask', body.mask & 0xFFF);
      if (Number.isInteger(body.root)) send('pcsRoot', body.root);
      // Transient notice → the suite's toast idiom (was an inline device-bar
      // flash; that bar is gone — the cluster popover owns devices now).
      toast(`↧ ${body.name || 'scale'} · from ${from}`);
    };
    startWebMidi({
      onDevices: p => { if (!cancelled) setMidiPorts(p); },
      onNote: e => handleNote(e),
      onScale,
    }).then(res => {
      if (cancelled) return;
      if (res.ok) { setMidiPorts(res.ports); setMidiErr(''); }
      else setMidiErr(res.error || 'MIDI unavailable');
    });
    const offBus = connectPitchFold({ onScale });   // the in-browser bus transport
    return () => { cancelled = true; offBus(); };
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

  // ── Shared frame: cluster MIDI state ───────────────────────────────────────
  // Standalone: real Web MIDI ports in the cluster popover (replacing the old
  // DeviceSel bar). Plugin/JUCE-standalone: MIDI is native — the honest chip.
  const clusterMidi = React.useMemo(() => {
    if (!standalone) return { native: true };
    if (!midiSupported() || midiErr) return { unavailable: true };
    return {
      inputs:  midiPorts.inputs.map(p => ({ id: p.id, name: p.name })),
      outputs: midiPorts.outputs.map(p => ({ id: p.id, name: p.name })),
      selectedInId: midiInId, selectedOutId: midiOutId,
      onSelectIn: setMidiInId, onSelectOut: setMidiOutId,
      badge: 'Standalone',
    };
  }, [standalone, midiErr, midiPorts, midiInId, midiOutId]);

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
          {/* Tab bar — the shared .es-tabs recipe (design audit F10) */}
          <div className="es-tabs" role="tablist" aria-label="Sections">
            {TABS.map(t => (
              <button key={t.id} className="es-tab" role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Panic */}
          <button onClick={panic} title="All Notes Off" style={{
            padding: '4px 8px', fontSize: 11, borderRadius: 5, cursor: 'pointer',
            border: `1px solid ${activePaper.rule || '#D4CAB8'}`,
            background: 'transparent', color: activePaper.ink50 || '#6B5E55',
          }}>
            ✕ Panic
          </button>

          {/* Shared frame: theme · MIDI (popover replaces the old DeviceSel
              bar) · density. The cluster's toggle carries #theme-toggle. */}
          <ClusterMount midi={clusterMidi}
            onThemeChange={(t) => setDark(t === 'dark')} />
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

/** Shared-frame mount (theme · MIDI popover · density), React-wrapped the
 *  same way ProgGenie/PickPCS/Serpe do it. Replaces the old DeviceSel bar. */
function ClusterMount({ midi, onThemeChange }) {
  const host = React.useRef(null), cluster = React.useRef(null);
  React.useEffect(() => {
    cluster.current = createGlobalCluster(host.current,
      { midi, densityTarget: document.body, onThemeChange });
    return () => cluster.current.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mounts once
  }, []);
  React.useEffect(() => { cluster.current?.update({ midi }); }, [midi]);
  return <div ref={host} style={{ display: 'inline-flex' }} />;
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
