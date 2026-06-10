import { useMemo } from 'react';
import type { Clip } from '../types/clip';
import { computeIntensityStats } from '../lib/intensity-synthesis';

interface VpIntensityControlsProps {
  clip: Clip;
  /** All sibling clips: same vpMeta.source + pattern, any intensity. */
  siblings: Clip[];
  onSynthesize: (targetIntensity: string) => void;
  /** Called to synthesize all pending variants at once. */
  onSynthesizeAll?: (targets: string[]) => void;
}

/** All known intensities in ascending order. */
const ALL_INTENSITIES = ['1', '3', '5', '6', '8', '10'] as const;
type KnownIntensity = typeof ALL_INTENSITIES[number];

/** Human-readable label for a metric value. */
function fmtStat(key: string, val: number): string {
  if (key === 'velMean') return val.toFixed(1);
  if (key === 'onsetDensity') return val.toFixed(2);
  return String(val);
}

/** Signed delta string, e.g. "+12" or "−5". */
function fmtDelta(delta: number): string {
  if (delta === 0) return '—';
  return (delta > 0 ? '+' : '') + delta.toFixed(delta % 1 === 0 ? 0 : 1);
}

const METRIC_LABELS: Record<string, string> = {
  noteCount:    'Notes',
  velMean:      'Vel mean',
  onsetDensity: 'Onset/bar',
  pitchRange:   'Pitch range',
};

/** Renders a row of synthesis buttons for one direction. */
function IntensityButtonRow({
  label,
  targets,
  synthByIntensity,
  onSynthesize,
}: {
  label: string;
  targets: readonly KnownIntensity[];
  synthByIntensity: Map<string, Clip>;
  onSynthesize: (t: string) => void;
}) {
  if (targets.length === 0) return null;
  return (
    <div className="mc-intensity-direction">
      <span className="mc-intensity-direction-label">{label}</span>
      <div className="mc-density-presets">
        {targets.map(target => {
          const already = synthByIntensity.has(target);
          return (
            <button
              key={target}
              className={`mc-preset-btn${already ? ' mc-preset-btn--active' : ''}`}
              title={already ? `Re-synthesize intensity ${target}` : `Synthesize intensity ${target}`}
              onClick={() => onSynthesize(target)}
            >
              {target}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function VpIntensityControls({ clip, siblings, onSynthesize, onSynthesizeAll }: VpIntensityControlsProps) {
  // Always call hooks — conditional rendering happens after.
  const sourceStats = useMemo(
    () => computeIntensityStats(clip.gesture, clip.harmonic),
    [clip],
  );

  // Map: intensity string → original sibling (imported, non-synth)
  const siblingByIntensity = useMemo(() => {
    const map = new Map<string, Clip>();
    for (const s of siblings) {
      if (s.vpMeta?.intensity && !s.vpMeta.intensity.endsWith('-synth')) {
        map.set(s.vpMeta.intensity, s);
      }
    }
    return map;
  }, [siblings]);

  // Map: intensity string → synthesized sibling (tagged as X-synth)
  const synthByIntensity = useMemo(() => {
    const map = new Map<string, Clip>();
    for (const s of siblings) {
      const intens = s.vpMeta?.intensity;
      if (intens?.endsWith('-synth')) {
        map.set(intens.replace('-synth', ''), s);
      }
    }
    return map;
  }, [siblings]);

  // Only render for VP clips that have other intensities to synthesize.
  // Synth clips (e.g. '3-synth') are allowed; we strip the suffix for comparisons.
  const sourceIntensity = clip.vpMeta?.intensity;
  if (!sourceIntensity) return null;

  // Base intensity number without '-synth' suffix
  const baseIntensity = sourceIntensity.replace(/-synth$/, '');
  const baseInt = parseInt(baseIntensity);
  const isSynth = sourceIntensity !== baseIntensity;

  const lowerTargets = ALL_INTENSITIES.filter(
    (i): i is KnownIntensity => parseInt(i) < baseInt,
  );
  const higherTargets = ALL_INTENSITIES.filter(
    (i): i is KnownIntensity => parseInt(i) > baseInt,
  );
  if (lowerTargets.length === 0 && higherTargets.length === 0) return null;

  // All synth variants across both directions, sorted by intensity number
  const allSynthTargets = ALL_INTENSITIES.filter(i => synthByIntensity.has(i));

  return (
    <div className="mc-transform-section">
      <h3>Intensity Variants</h3>
      <div className="mc-transform-panel">
        <p className="mc-note-count-preview">
          Source: intensity {baseIntensity}{isSynth ? ' (synth)' : ''} — {sourceStats.noteCount} notes,
          {' '}vel {sourceStats.velMean.toFixed(1)},
          {' '}{sourceStats.onsetDensity.toFixed(2)} onset/bar
        </p>

        <IntensityButtonRow
          label="↑"
          targets={higherTargets}
          synthByIntensity={synthByIntensity}
          onSynthesize={onSynthesize}
        />
        <IntensityButtonRow
          label="↓"
          targets={lowerTargets}
          synthByIntensity={synthByIntensity}
          onSynthesize={onSynthesize}
        />

        {/* Generate-all button: only pending (non-existing) variants */}
        {onSynthesizeAll && (() => {
          const pending = ALL_INTENSITIES.filter(
            (i): i is KnownIntensity =>
              i !== baseIntensity && !synthByIntensity.has(i),
          );
          return pending.length > 0 ? (
            <div style={{ marginTop: 8 }}>
              <button
                className="mc-preset-btn"
                onClick={() => onSynthesizeAll(pending)}
                title={`Synthesize all ${pending.length} missing intensity variant(s)`}
              >
                Generate all ({pending.length})
              </button>
            </div>
          ) : null;
        })()}

        {/* Comparison table: one row per synthesized variant (either direction) */}
        {allSynthTargets.length > 0 && (
          <table className="mc-intensity-compare">
            <thead>
              <tr>
                <th>Intensity</th>
                {Object.values(METRIC_LABELS).map(label => (
                  <th key={label}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allSynthTargets.map(target => {
                const synth      = synthByIntensity.get(target)!;
                const orig       = siblingByIntensity.get(target);
                const synthStats = computeIntensityStats(synth.gesture, synth.harmonic);
                const origStats  = orig ? computeIntensityStats(orig.gesture, orig.harmonic) : null;

                return (
                  <tr key={target}>
                    <td>{target}</td>
                    {(Object.keys(METRIC_LABELS) as (keyof typeof METRIC_LABELS)[]).map(metric => {
                      const sVal  = synthStats[metric as keyof typeof synthStats] as number;
                      const oVal  = origStats?.[metric as keyof typeof origStats] as number | undefined;
                      const delta = oVal !== undefined ? sVal - oVal : null;
                      return (
                        <td
                          key={metric}
                          className={delta !== null && Math.abs(delta) > 0 ? 'mc-intensity-delta' : ''}
                        >
                          {fmtStat(metric, sVal)}
                          {oVal !== undefined && (
                            <span
                              className="mc-intensity-orig"
                              title={`Original intensity ${target}: ${fmtStat(metric, oVal)}`}
                            >
                              {' '}({fmtDelta(delta!)})
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
