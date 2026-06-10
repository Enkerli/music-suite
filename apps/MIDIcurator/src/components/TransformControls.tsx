interface TransformControlsProps {
  densityMultiplier: number;
  onDensityChange: (value: number) => void;
  noteCount: number;
}

const DENSITY_PRESETS = [0.5, 0.75, 1.0, 1.25, 1.5];

export function TransformControls({
  densityMultiplier,
  onDensityChange,
  noteCount,
}: TransformControlsProps) {
  return (
    <div className="mc-transform-section">
      <h3>Transform</h3>
      <div className="mc-transform-panel">
        <label className="mc-density-label">
          Density Multiplier:{' '}
          <span className="mc-density-value">{densityMultiplier.toFixed(2)}x</span>
        </label>
        <div className="mc-density-slider-row">
          <span>0.25x</span>
          <input
            type="range"
            min="0.25"
            max="2.0"
            step="0.05"
            value={densityMultiplier}
            onChange={(e) => onDensityChange(parseFloat(e.target.value))}
          />
          <span>2.0x</span>
        </div>
        <div className="mc-density-presets">
          {DENSITY_PRESETS.map(preset => (
            <button
              key={preset}
              className={`mc-preset-btn ${densityMultiplier === preset ? 'mc-preset-btn--active' : ''}`}
              onClick={() => onDensityChange(preset)}
            >
              {preset}x
            </button>
          ))}
        </div>
        <div className="mc-note-count-preview">
          Will create {Math.round(noteCount * densityMultiplier)} notes (from {noteCount})
        </div>
      </div>
    </div>
  );
}
