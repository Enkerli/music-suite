import type { MidiOutUi } from '../hooks/usePlayback';

/**
 * Standalone MIDI-output selector — the shared `.es-device-select` chrome the
 * other suite webapps use (Serpe/PitchFold). "Internal" = the Web Audio
 * preview; choosing a port routes clip playback to an external synth (or
 * another suite app over an IAC bus). Output only; plain MIDI (no SysEx).
 */

const MIDI_OUT_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">' +
  '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="7" r="1.1" fill="currentColor" stroke="none"/>' +
  '<circle cx="7.6" cy="9.6" r="1.1" fill="currentColor" stroke="none"/>' +
  '<circle cx="16.4" cy="9.6" r="1.1" fill="currentColor" stroke="none"/>' +
  '<circle cx="9" cy="15" r="1.1" fill="currentColor" stroke="none"/>' +
  '<circle cx="15" cy="15" r="1.1" fill="currentColor" stroke="none"/></svg>';

export function MidiOutBar({ midi }: { midi: MidiOutUi }) {
  const { outputs, selectedId, error, select } = midi;
  const connected = !!selectedId && outputs.some((p) => p.id === selectedId);
  const state = error || outputs.length === 0 ? 'empty' : connected ? 'connected' : 'available';
  return (
    <div className="es-device-bar mc-midi-out">
      <div className="es-device-select" data-state={state}>
        <div className="es-device-select-head">
          <span className="es-device-icon" aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: MIDI_OUT_ICON }} />
          <span className="es-device-name">MIDI Out</span>
          <span className="es-device-status">
            <span className="es-device-led" />
            {error ? 'unavailable' : connected ? 'connected' : outputs.length ? 'internal' : 'none'}
          </span>
        </div>
        {error
          ? <div className="es-device-empty">{error}</div>
          : (
            <select className="es-control" value={selectedId || ''} aria-label="MIDI output"
              onChange={(e) => select(e.target.value || null)}>
              <option value="">Internal (Web Audio)</option>
              {outputs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
      </div>
    </div>
  );
}
