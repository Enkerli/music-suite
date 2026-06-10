import type { PlaybackState } from '../lib/playback';

interface TransportBarProps {
  state: PlaybackState;
  currentTime: number;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${m}:${s.toString().padStart(2, '0')}.${ms}`;
}

export function TransportBar({
  state,
  currentTime,
  onPlay,
  onPause,
  onStop,
}: TransportBarProps) {
  const stateText = state === 'playing' ? 'Playing' : state === 'paused' ? 'Paused' : '';

  return (
    <div className="mc-transport">
      <button
        className={`mc-transport-btn ${state === 'playing' ? 'mc-transport-btn--active' : ''}`}
        onClick={state === 'playing' ? onPause : onPlay}
        title={state === 'playing' ? 'Pause (Space)' : 'Play (Space)'}
        aria-label={state === 'playing' ? 'Pause playback (Space)' : 'Play pattern (Space)'}
      >
        {state === 'playing' ? '\u275A\u275A' : '\u25B6'}
      </button>
      <button
        className="mc-transport-btn"
        onClick={onStop}
        title="Stop"
        aria-label="Stop playback and return to beginning"
        disabled={state === 'stopped'}
      >
        &#x25A0;
      </button>
      <span className="mc-transport-time" aria-label={`Current time: ${formatTime(currentTime)}`}>
        {formatTime(currentTime)}
      </span>
      <span
        className="mc-transport-state"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {stateText}
      </span>
    </div>
  );
}
