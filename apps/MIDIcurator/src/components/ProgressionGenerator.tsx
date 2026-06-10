import { useState } from 'react';
import {
  PROGRESSIONS,
  VOICING_SHAPES,
  VOICING_LABELS,
  KEY_NAMES,
} from '../lib/progressions';
import type { VoicingShape } from '../lib/progressions';

interface ProgressionGeneratorProps {
  onGenerate: (progressionIndex: number, keyOffset: number, voicing: VoicingShape) => void;
}

export function ProgressionGenerator({ onGenerate }: ProgressionGeneratorProps) {
  const [expanded, setExpanded] = useState(false);
  const [progIdx, setProgIdx] = useState(0);
  const [keyOffset, setKeyOffset] = useState(0);
  const [voicing, setVoicing] = useState<VoicingShape>('block');

  if (!expanded) {
    return (
      <button
        className="mc-btn--gen-toggle"
        onClick={() => setExpanded(true)}
      >
        + Generate progression
      </button>
    );
  }

  return (
    <div className="mc-progression-gen">
      <div className="mc-progression-gen__row">
        <select
          value={progIdx}
          onChange={e => setProgIdx(Number(e.target.value))}
          className="mc-progression-gen__select"
        >
          {PROGRESSIONS.map((p, i) => (
            <option key={p.name} value={i}>{p.name}</option>
          ))}
        </select>
      </div>

      <div className="mc-progression-gen__row">
        <select
          value={keyOffset}
          onChange={e => setKeyOffset(Number(e.target.value))}
          className="mc-progression-gen__select mc-progression-gen__select--key"
        >
          {KEY_NAMES.map((name, i) => (
            <option key={name} value={i}>{name}</option>
          ))}
        </select>

        <select
          value={voicing}
          onChange={e => setVoicing(e.target.value as VoicingShape)}
          className="mc-progression-gen__select mc-progression-gen__select--voicing"
        >
          {VOICING_SHAPES.map(v => (
            <option key={v} value={v}>{VOICING_LABELS[v]}</option>
          ))}
        </select>
      </div>

      <div className="mc-progression-gen__row mc-progression-gen__actions">
        <button
          className="mc-btn--generate"
          onClick={() => onGenerate(progIdx, keyOffset, voicing)}
        >
          Generate
        </button>
        <button
          className="mc-btn--gen-cancel"
          onClick={() => setExpanded(false)}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
