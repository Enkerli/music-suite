// voice-panel.jsx — voice mode controls (mono/poly/split/chordize).

const VOICE_MODES = ['Through', 'Mono Merge', 'Poly Spread', 'Voice Split', 'Chordize'];
const MONO_MODES  = ['Last', 'Lowest', 'Highest', 'First'];

export function VoicePanel({ state, sendParam, paper = window.PAPER }) {
  const {
    voiceMode    = 0,
    monoSelect   = 0,
    splitVoices  = 2,
    splitChannel = 1,
  } = state;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Voice mode */}
      <div>
        <Label paper={paper}>Voice mode</Label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
          {VOICE_MODES.map((m, i) => (
            <button key={i} onClick={() => sendParam('voiceMode', i)}
              style={chipStyle(i === voiceMode, paper)}>
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Mono Merge options */}
      {voiceMode === 1 && (
        <div>
          <Label paper={paper}>Voice select</Label>
          <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
            {MONO_MODES.map((m, i) => (
              <button key={i} onClick={() => sendParam('monoSelect', i)}
                style={chipStyle(i === monoSelect, paper)}>
                {m}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Voice Split options */}
      {voiceMode === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>
            <Label paper={paper}>Voices</Label>
            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
              {[1, 2, 3, 4].map(n => (
                <button key={n} onClick={() => sendParam('splitVoices', n)}
                  style={chipStyle(n === splitVoices, paper)}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label paper={paper}>Base channel</Label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
              {Array.from({ length: 13 }, (_, i) => i + 1).map(ch => (
                <button key={ch} onClick={() => sendParam('splitChannel', ch)}
                  style={{ ...chipStyle(ch === splitChannel, paper), padding: '3px 7px', fontSize: 10 }}>
                  {ch}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 9, color: paper?.ink50 || '#6B5E55',
              marginTop: 4, fontFamily: 'InterTight, system-ui' }}>
              Voices → ch {splitChannel} – {splitChannel + splitVoices - 1}
            </div>
          </div>
        </div>
      )}

      {/* Poly Spread / Chordize: uses active PCS from the scale panel */}
      {(voiceMode === 2 || voiceMode === 4) && (
        <div style={{
          padding: '6px 10px', borderRadius: 6,
          background: paper?.bgDeep || '#EDE6D8',
          fontSize: 10, color: paper?.ink50 || '#6B5E55',
          fontFamily: 'InterTight, system-ui',
        }}>
          {voiceMode === 2 && 'Chord shape taken from the active PCS (scale panel or pad).'}
          {voiceMode === 4 && 'Harmonizes each note using active PCS intervals above it.'}
        </div>
      )}
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
