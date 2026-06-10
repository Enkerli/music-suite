import { useRef, useEffect } from 'react';
import type { Clip } from '../types/clip';

interface ClipCardProps {
  clip: Clip;
  isSelected: boolean;
  onClick: () => void;
}

export function ClipCard({ clip, isSelected, onClick }: ClipCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const densityMatch = clip.notes?.match(/density: ([\d.]+)x/);

  // Scroll into view when selected (e.g. via arrow key navigation)
  useEffect(() => {
    if (isSelected && ref.current) {
      ref.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [isSelected]);

  // Format chord or pitch class set for display
  const chordDisplay = clip.harmonic.detectedChord
    ? clip.harmonic.detectedChord.symbol
    : clip.harmonic.pitchClasses && clip.harmonic.pitchClasses.length > 0
      ? `?? [${[...new Set(clip.harmonic.pitchClasses)].sort((a, b) => a - b).join(',')}]`
      : null;

  // Keyboard handler for Enter/Space
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  // Build accessible label
  const variantInfo = clip.source ? ', variant of another clip' : '';
  const densityInfo = densityMatch ? `, density multiplier ${densityMatch[1]}x` : '';
  const chordInfo = chordDisplay ? `, chord: ${chordDisplay}` : '';
  const ariaLabel = `${clip.filename}${variantInfo}, ${clip.bpm} BPM, density ${clip.gesture.density.toFixed(1)}${densityInfo}${chordInfo}${isSelected ? ', selected' : ''}`;

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-pressed={isSelected}
      className={`mc-clip-card ${isSelected ? 'mc-clip-card--selected' : ''} ${clip.flagged ? 'mc-clip-card--flagged' : ''}`}
      onClick={onClick}
      onKeyDown={handleKeyDown}
    >
      <div className="mc-clip-card-name">
        {clip.flagged && <span className="mc-clip-card-flag" aria-label="flagged" title="Flagged for triage (x to toggle)">⚑</span>}
        {clip.filename}
        {clip.source && <span className="mc-clip-card-variant-dot" aria-hidden="true">&#x25CF;</span>}
      </div>
      <div className="mc-clip-card-meta">
        {clip.bpm} BPM &bull; {clip.gesture.density.toFixed(1)} density
        {densityMatch && (
          <span className="mc-clip-card-density-tag">
            ({densityMatch[1]}x)
          </span>
        )}
        {chordDisplay && (
          <span className="mc-clip-card-chord">
            &bull; {chordDisplay}
          </span>
        )}
      </div>
    </div>
  );
}
