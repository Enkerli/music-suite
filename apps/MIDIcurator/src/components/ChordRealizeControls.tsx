import { useState, useMemo } from 'react';
import type { Clip, DetectedChord } from '../types/clip';
import { parseChordSymbol } from '../lib/chord-parser';

interface ChordRealizeControlsProps {
  clip: Clip;
  /**
   * Called when the user confirms a target chord.
   * `sourceChord` is the resolved source (leadsheet-preferred) so the handler
   * doesn't need to repeat the resolution logic.
   */
  onRealize: (sourceChord: DetectedChord, targetChord: DetectedChord) => void;
}

export function ChordRealizeControls({ clip, onRealize }: ChordRealizeControlsProps) {
  const [targetInput, setTargetInput] = useState('');

  // Prefer the leadsheet's first explicit chord (user-authoritative) over the
  // auto-detected aggregate chord, which can reflect notes from many chord
  // sections and may not match the intended source.
  const sourceChord = useMemo(() => {
    const fromLeadsheet = clip.leadsheet?.bars
      .flatMap(b => b.chords)
      .find(c => c.chord?.qualityKey != null)
      ?.chord ?? null;
    return fromLeadsheet ?? clip.harmonic.detectedChord;
  }, [clip]);

  // Parse the target input
  const parsedTarget = useMemo(
    () => (targetInput.trim() ? parseChordSymbol(targetInput.trim()) : null),
    [targetInput],
  );

  // Requires a known source chord with a quality key to map degrees from
  if (!sourceChord?.qualityKey) return null;

  const hasInput   = targetInput.trim().length > 0;
  const inputClass = [
    'mc-chord-input',
    hasInput ? (parsedTarget ? 'mc-chord-input--valid' : 'mc-chord-input--invalid') : '',
  ].filter(Boolean).join(' ');

  function commit() {
    if (parsedTarget) {
      onRealize(sourceChord!, parsedTarget);
      setTargetInput('');
    }
  }

  return (
    <div className="mc-transform-section">
      <h3>Chord Realization</h3>
      <div className="mc-transform-panel">
        <p className="mc-realize-source">
          Source: <span className="mc-realize-source-chord">{sourceChord.symbol}</span>
        </p>
        <div className="mc-realize-target-row">
          <label htmlFor="mc-realize-target">Target</label>
          <input
            id="mc-realize-target"
            type="text"
            className={inputClass}
            value={targetInput}
            placeholder="e.g. Fm7, Bb7, Abmaj7"
            onChange={e => setTargetInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commit(); }}
            autoComplete="off"
            spellCheck={false}
          />
          <button
            className="mc-realize-btn"
            disabled={!parsedTarget}
            onClick={commit}
          >
            Realize
          </button>
        </div>
      </div>
    </div>
  );
}
