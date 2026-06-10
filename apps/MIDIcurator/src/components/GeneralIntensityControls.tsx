import { useMemo } from 'react';
import type { Clip } from '../types/clip';
import {
  computeIntensityStats,
  INTENSITY_PRESETS,
  type IntensityPreset,
} from '../lib/intensity-synthesis';

interface GeneralIntensityControlsProps {
  clip: Clip;
  onSynthesize: (preset: IntensityPreset) => void;
}

export function GeneralIntensityControls({ clip, onSynthesize }: GeneralIntensityControlsProps) {
  const stats = useMemo(
    () => computeIntensityStats(clip.gesture, clip.harmonic),
    [clip],
  );

  const reducePresets  = INTENSITY_PRESETS.filter(p => p.noteRatio < 1);
  const amplifyPresets = INTENSITY_PRESETS.filter(p => p.noteRatio > 1);

  return (
    <div className="mc-transform-section">
      <h3>Intensity Variants</h3>
      <div className="mc-transform-panel">
        <p className="mc-note-count-preview">
          Source: {stats.noteCount} notes, vel {stats.velMean.toFixed(1)},
          {' '}{stats.onsetDensity.toFixed(2)} onset/bar
        </p>

        {amplifyPresets.length > 0 && (
          <div className="mc-intensity-direction">
            <span className="mc-intensity-direction-label">↑</span>
            <div className="mc-density-presets">
              {amplifyPresets.map(p => (
                <button
                  key={p.label}
                  className="mc-preset-btn"
                  title={`${Math.round(p.noteRatio * 100)}% notes, ${Math.round(p.velRatio * 100)}% velocity`}
                  onClick={() => onSynthesize(p)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mc-intensity-direction">
          <span className="mc-intensity-direction-label">↓</span>
          <div className="mc-density-presets">
            {reducePresets.map(p => (
              <button
                key={p.label}
                className="mc-preset-btn"
                title={`${Math.round(p.noteRatio * 100)}% notes, ${Math.round(p.velRatio * 100)}% velocity`}
                onClick={() => onSynthesize(p)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
