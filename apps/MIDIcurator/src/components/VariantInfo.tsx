import type { Clip } from '../types/clip';

interface VariantInfoProps {
  clip: Clip;
  sourceClip: Clip | undefined;
}

export function VariantInfo({ clip, sourceClip }: VariantInfoProps) {
  // Show variant info if we have a session-local source UUID or a persisted sourceFilename
  if (!clip.source && !clip.sourceFilename) return null;

  const densityMatch = clip.notes?.match(/density: ([\d.]+)x/);

  // Resolve display name: prefer live source clip's filename, fall back to persisted sourceFilename
  const sourceName = sourceClip?.filename ?? clip.sourceFilename ?? 'unknown';

  return (
    <div className="mc-variant-info">
      <div style={{ marginBottom: 10 }}>
        <strong>Variant of:</strong> {sourceName}
      </div>
      {densityMatch && (
        <div className="mc-variant-density">
          Density multiplier:{' '}
          <span className="mc-variant-density-value">{densityMatch[1]}x</span>
        </div>
      )}
      {sourceClip && (() => {
        const noteDiff = clip.gesture.onsets.length - sourceClip.gesture.onsets.length;
        return (
          <div className="mc-variant-note-diff">
            Note count: {sourceClip.gesture.onsets.length} &rarr; {clip.gesture.onsets.length}
            <span className={noteDiff > 0 ? 'mc-variant-note-diff--positive' : 'mc-variant-note-diff--negative'}>
              ({noteDiff > 0 ? '+' : ''}{noteDiff})
            </span>
          </div>
        );
      })()}
    </div>
  );
}
