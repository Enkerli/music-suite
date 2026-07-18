import { useState } from 'react';
import { GROOVE_STYLE_NAMES } from '../lib/gloriarp-clip';
import type { GrooveClipRequest, GrooveStyleName } from '../lib/gloriarp-clip';

interface GrooveGeneratorProps {
  onGenerate: (req: GrooveClipRequest) => void;
  /** Leadsheet text of the currently selected clip, for one-tap reuse. */
  selectedLeadsheet?: string;
}

/**
 * The GloriArp panel: a prog goes in, an accompaniment comes out — as a
 * regular clip, so the plugin's host-synced playback (and the iPad share
 * sheet) apply to it like any other. Sits beside the progression generator.
 */
export function GrooveGenerator({ onGenerate, selectedLeadsheet }: GrooveGeneratorProps) {
  const [expanded, setExpanded] = useState(false);
  const [progression, setProgression] = useState('Dm7 | G7 | Cmaj7 | A7');
  const [style, setStyle] = useState<GrooveStyleName>('walking-bass');
  const [rhythm, setRhythm] = useState('');
  const [seed, setSeed] = useState(42);
  const [bpm, setBpm] = useState(120);
  const [gate, setGate] = useState('');
  const [dynamics, setDynamics] = useState(0);
  const [rests, setRests] = useState(0);
  const [anticipation, setAnticipation] = useState(0);

  if (!expanded) {
    return (
      <button className="mc-btn--gen-toggle" onClick={() => setExpanded(true)}>
        + GloriArp groove
      </button>
    );
  }

  const feelNum = (label: string, value: number, set: (v: number) => void) => (
    <label className="mc-groove-gen__feel">
      {label}
      <input
        type="number" min={0} max={1} step={0.1} value={value}
        onChange={e => set(Math.min(1, Math.max(0, Number(e.target.value) || 0)))}
        className="mc-groove-gen__num"
      />
    </label>
  );

  return (
    <div className="mc-progression-gen mc-groove-gen">
      <div className="mc-progression-gen__row">
        <input
          type="text"
          value={progression}
          onChange={e => setProgression(e.target.value)}
          placeholder="Dm7 | G7 | Cmaj7 | A7"
          aria-label="Progression (bar notation)"
          className="mc-groove-gen__text"
        />
      </div>
      {selectedLeadsheet && selectedLeadsheet.trim() && selectedLeadsheet !== progression && (
        <div className="mc-progression-gen__row">
          <button
            className="mc-groove-gen__from-clip"
            onClick={() => setProgression(selectedLeadsheet)}
            title="Use the selected clip's leadsheet as the progression"
          >
            ⤷ from selected clip
          </button>
        </div>
      )}
      <div className="mc-progression-gen__row">
        <select
          value={style}
          onChange={e => setStyle(e.target.value as GrooveStyleName)}
          aria-label="Style"
          className="mc-progression-gen__select"
        >
          {GROOVE_STYLE_NAMES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={gate}
          onChange={e => setGate(e.target.value)}
          aria-label="Gate"
          className="mc-progression-gen__select"
        >
          <option value="">gate: default</option>
          <option value="staccato">staccato</option>
          <option value="tenuto">tenuto</option>
          <option value="legato">legato</option>
        </select>
      </div>
      <div className="mc-progression-gen__row">
        <input
          type="text"
          value={rhythm}
          onChange={e => setRhythm(e.target.value)}
          placeholder="rhythm UPI, e.g. E(3,8) — optional"
          aria-label="Rhythm (UPI, optional)"
          className="mc-groove-gen__text"
        />
      </div>
      <div className="mc-progression-gen__row">
        <label className="mc-groove-gen__feel">
          seed
          <input
            type="number" min={0} step={1} value={seed}
            onChange={e => setSeed(Math.max(0, Math.round(Number(e.target.value) || 0)))}
            className="mc-groove-gen__num"
          />
        </label>
        <label className="mc-groove-gen__feel">
          bpm
          <input
            type="number" min={20} max={300} step={1} value={bpm}
            onChange={e => setBpm(Math.min(300, Math.max(20, Math.round(Number(e.target.value) || 120))))}
            className="mc-groove-gen__num"
          />
        </label>
      </div>
      <div className="mc-progression-gen__row">
        {feelNum('dyn', dynamics, setDynamics)}
        {feelNum('rests', rests, setRests)}
        {feelNum('push', anticipation, setAnticipation)}
      </div>
      <div className="mc-progression-gen__row mc-progression-gen__actions">
        <button
          className="mc-btn--generate"
          onClick={() => onGenerate({
            progression,
            style,
            seed,
            bpm,
            ...(rhythm.trim() ? { rhythm: rhythm.trim() } : {}),
            ...(gate ? { gate } : {}),
            ...(dynamics ? { dynamics } : {}),
            ...(rests ? { rests } : {}),
            ...(anticipation ? { anticipation } : {}),
          })}
        >
          Generate
        </button>
        <button className="mc-btn--gen-cancel" onClick={() => setExpanded(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}
