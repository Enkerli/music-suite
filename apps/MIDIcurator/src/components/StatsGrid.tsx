import { useMemo, useState, useCallback } from 'react';
import type { Clip, DetectedChord } from '../types/clip';
import { rootName, spellInChordContext, buildChordToneSpellingMap, findQualityByKey } from '../lib/chord-dictionary';
import { keyTypeLabel, rootPcName, gbLoopTypeLabel } from '../lib/loop-database';
import { parseChordSymbol } from '../lib/chord-parser';
import { getEffectiveBarChords } from '../lib/gesture';

interface StatsGridProps {
  clip: Clip;
  editingBpm: boolean;
  bpmValue: string;
  onBpmChange: (value: string) => void;
  onBpmSave: () => void;
  onStartEditBpm: () => void;
  /** Current playback time in seconds (for dynamic chord display) */
  playbackTime: number;
  /** Whether playback is active */
  isPlaying: boolean;
  /** Chord info from range selection (takes priority over playhead/overall) */
  rangeChordInfo?: {
    chord: DetectedChord | null;
    pitchClasses: number[];
    noteCount: number;
  } | null;
  /** Called to override bar chord(s) with the current detected chord */
  onOverrideChord?: () => void;
  /** Called to adapt notes to a new chord (chord substitution) */
  onAdaptChord?: (newChord: DetectedChord) => void;
  /** Called when a metadata chip is clicked to set it as a search filter */
  onFilterByTag?: (tag: string) => void;
}

/**
 * Get the chord and pitch classes at the current playhead position.
 * Falls back to overall detected chord when stopped.
 * Supports sub-bar segments for bars with multiple chords.
 */
function getChordInfoAtTime(
  clip: Clip,
  time: number,
  isPlaying: boolean,
): { chord: DetectedChord | null | undefined; pitchClasses: number[] } {
  const effectiveBarChords = getEffectiveBarChords(clip);
  if (!isPlaying || time <= 0 || !effectiveBarChords || effectiveBarChords.length === 0) {
    return {
      chord: clip.harmonic.detectedChord,
      pitchClasses: clip.harmonic.pitchClasses || [],
    };
  }

  // Convert time (seconds) to ticks
  const ticksPerSecond = (clip.bpm / 60) * clip.gesture.ticks_per_beat;
  const currentTick = time * ticksPerSecond;
  const currentBar = Math.floor(currentTick / clip.gesture.ticks_per_bar);

  // Find the bar chord
  if (currentBar >= 0 && currentBar < effectiveBarChords.length) {
    const barInfo = effectiveBarChords[currentBar];

    // Check for sub-bar segments
    if (barInfo.segments && barInfo.segments.length > 1) {
      const localTick = currentTick - (currentBar * clip.gesture.ticks_per_bar);
      const segmentIndex = barInfo.segments.findIndex(
        s => localTick >= s.startTick && localTick < s.endTick
      );
      if (segmentIndex >= 0) {
        const segment = barInfo.segments[segmentIndex];
        // Inherit from previous segment if this one is empty (resonance principle)
        let chord = segment.chord;
        if (!chord) {
          for (let i = segmentIndex - 1; i >= 0; i--) {
            if (barInfo.segments[i].chord) {
              chord = barInfo.segments[i].chord;
              break;
            }
          }
        }
        return {
          chord,
          pitchClasses: barInfo.pitchClasses || [],
        };
      }
    }

    return {
      chord: barInfo.chord,
      pitchClasses: barInfo.pitchClasses || [],
    };
  }

  return {
    chord: clip.harmonic.detectedChord,
    pitchClasses: clip.harmonic.pitchClasses || [],
  };
}

export function StatsGrid({
  clip,
  editingBpm,
  bpmValue,
  onBpmChange,
  onBpmSave,
  onStartEditBpm,
  playbackTime,
  isPlaying,
  rangeChordInfo,
  onOverrideChord,
  onAdaptChord,
  onFilterByTag,
}: StatsGridProps) {
  // Chord input state for substitution
  const [chordInput, setChordInput] = useState('');

  // Parse the input to check validity
  const parsedInputChord = useMemo(
    () => chordInput.trim() ? parseChordSymbol(chordInput) : null,
    [chordInput]
  );

  const isInputValid = parsedInputChord !== null;

  const handleAdaptClick = useCallback(() => {
    if (parsedInputChord && onAdaptChord) {
      onAdaptChord(parsedInputChord);
      setChordInput(''); // Clear input after adapting
    }
  }, [parsedInputChord, onAdaptChord]);

  const handleInputKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && parsedInputChord && onAdaptChord) {
      e.preventDefault();
      handleAdaptClick();
    }
    if (e.key === 'Escape') {
      setChordInput('');
      (e.target as HTMLInputElement).blur();
    }
  }, [parsedInputChord, onAdaptChord, handleAdaptClick]);
  const playbackChordInfo = useMemo(
    () => getChordInfoAtTime(clip, playbackTime, isPlaying),
    [clip, playbackTime, isPlaying],
  );

  // Priority: range selection > playhead > overall
  const effectiveChordInfo = rangeChordInfo ?? playbackChordInfo;

  const chordLabel = rangeChordInfo
    ? `Chord (${rangeChordInfo.noteCount} notes selected)`
    : isPlaying && playbackTime > 0
      ? 'Chord (at playhead)'
      : 'Chord';

  // Format pitch class set for display
  const pcsStr = effectiveChordInfo.pitchClasses.length > 0
    ? `[${[...new Set(effectiveChordInfo.pitchClasses)].sort((a, b) => a - b).join(',')}]`
    : '';

  // Format note names for display, spelled using interval direction from the quality
  // (e.g. A♭ not G♯ for the ♭5 of Dm7♭5), falling back to root-context spelling for NCTs.
  const chordRoot = effectiveChordInfo.chord;
  const chordToneSpelling = useMemo(() => {
    if (!chordRoot) return null;
    const quality = findQualityByKey(chordRoot.qualityKey ?? '');
    if (!quality) return null;
    return buildChordToneSpellingMap(chordRoot.root, quality);
  }, [chordRoot]);
  const noteNamesStr = effectiveChordInfo.pitchClasses.length > 0
    ? [...new Set(effectiveChordInfo.pitchClasses)]
        .sort((a, b) => a - b)
        .map(pc => {
          const normalPc = ((pc % 12) + 12) % 12;
          if (chordToneSpelling?.has(normalPc)) return chordToneSpelling.get(normalPc)!;
          return chordRoot
            ? spellInChordContext(normalPc, chordRoot.root, chordRoot.rootName)
            : rootName(normalPc);
        })
        .join(' ')
    : '';

  const chordDisplayText = effectiveChordInfo.chord
    ? effectiveChordInfo.chord.symbol
    : effectiveChordInfo.pitchClasses.length > 0
      ? `?? ${pcsStr}`
      : '—';

  return (
    <div className="mc-stats-grid">
      <div className="mc-stat-box">
        <div className="mc-stat-label">BPM</div>
        {editingBpm ? (
          <div className="mc-bpm-edit">
            <input
              type="number"
              className="mc-bpm-input"
              aria-label="Edit tempo in beats per minute"
              value={bpmValue}
              onChange={(e) => onBpmChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onBpmSave()}
              autoFocus
            />
            <button
              className="mc-bpm-save"
              onClick={onBpmSave}
              aria-label="Save tempo"
            >
              &#x2713;
            </button>
          </div>
        ) : (
          <div
            className="mc-stat-value mc-stat-value--editable"
            onClick={onStartEditBpm}
            role="button"
            tabIndex={0}
            aria-label={`Tempo: ${clip.bpm} BPM. Click to edit.`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onStartEditBpm();
              }
            }}
          >
            {clip.bpm}
            <span className="mc-stat-edit-icon" aria-hidden="true">&#x270E;</span>
          </div>
        )}
      </div>
      <div className="mc-stat-box">
        <div className="mc-stat-label">{chordLabel}</div>
        <div
          className="mc-stat-value mc-stat-value--chord"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {chordDisplayText}
        </div>
        {effectiveChordInfo.chord ? (
          <div className="mc-stat-sub">
            {effectiveChordInfo.chord.qualityName}
            {noteNamesStr && <span className="mc-stat-notes">{noteNamesStr}</span>}
            {onOverrideChord && rangeChordInfo && (
              <button
                className="mc-btn--tag-chord"
                onClick={onOverrideChord}
                aria-label={`Set bar chord to ${effectiveChordInfo.chord.symbol}`}
                title={`Set bar chord to "${effectiveChordInfo.chord.symbol}"`}
              >
                Set
              </button>
            )}
          </div>
        ) : effectiveChordInfo.pitchClasses.length > 0 ? (
          <div className="mc-stat-sub">
            unrecognized structure
            {noteNamesStr && <span className="mc-stat-notes">{noteNamesStr}</span>}
          </div>
        ) : null}
        {/* Chord substitution input - only show when range is selected */}
        {rangeChordInfo && onAdaptChord && (
          <div className="mc-chord-adapt">
            <input
              type="text"
              className={`mc-chord-input ${chordInput && !isInputValid ? 'mc-chord-input--invalid' : ''} ${chordInput && isInputValid ? 'mc-chord-input--valid' : ''}`}
              placeholder="New chord (e.g., Am)"
              aria-label="Enter chord symbol for substitution"
              aria-invalid={chordInput.trim() !== '' && !isInputValid}
              value={chordInput}
              onChange={(e) => setChordInput(e.target.value)}
              onKeyDown={handleInputKeyDown}
            />
            <button
              className="mc-btn--adapt-chord"
              onClick={handleAdaptClick}
              disabled={!isInputValid}
              aria-label={isInputValid && parsedInputChord ? `Adapt notes to ${parsedInputChord.symbol}` : 'Enter a valid chord symbol'}
              title={isInputValid && parsedInputChord ? `Adapt notes to ${parsedInputChord.symbol}` : 'Enter a valid chord symbol'}
            >
              Adapt
            </button>
            {chordInput.trim() !== '' && !isInputValid && (
              <span className="mc-error-message" role="alert">
                Invalid chord symbol. Try: C, Am, Dm7, G7, etc.
              </span>
            )}
          </div>
        )}
      </div>
      <div className="mc-stat-box">
        <div className="mc-stat-label">Notes</div>
        <div className="mc-stat-value">{clip.gesture.onsets.length}</div>
      </div>
      <div className="mc-stat-box">
        <div className="mc-stat-label">Density</div>
        <div className="mc-stat-value">{clip.gesture.density.toFixed(2)}</div>
      </div>
      <div className="mc-stat-box">
        <div className="mc-stat-label">Syncopation</div>
        <div className="mc-stat-value">{clip.gesture.syncopation_score.toFixed(2)}</div>
      </div>

      {clip.vpMeta && (
        <div className="mc-loop-meta">
          <div className="mc-loop-meta-section">
            <span className="mc-loop-meta-label">Source</span>
            <div className="mc-loop-meta-chips">
              {onFilterByTag ? (
                <button className="mc-loop-meta-chip mc-loop-meta-chip--provenance mc-loop-meta-chip--clickable"
                        title={`Filter by source "${clip.vpMeta.source}"`}
                        onClick={() => onFilterByTag(`${clip.vpMeta!.source.toLowerCase()}`)}>
                  {clip.vpMeta.source}
                </button>
              ) : (
                <span className="mc-loop-meta-chip mc-loop-meta-chip--provenance">{clip.vpMeta.source}</span>
              )}
            </div>
          </div>
          <div className="mc-loop-meta-section">
            <span className="mc-loop-meta-label">Pattern</span>
            <div className="mc-loop-meta-chips">
              {onFilterByTag ? (
                <button className="mc-loop-meta-chip mc-loop-meta-chip--genre mc-loop-meta-chip--clickable"
                        title={`Filter by pattern "${clip.vpMeta.pattern}"`}
                        onClick={() => onFilterByTag(`vp-pattern:${clip.vpMeta!.pattern}`)}>
                  {clip.vpMeta.pattern}
                </button>
              ) : (
                <span className="mc-loop-meta-chip mc-loop-meta-chip--genre">{clip.vpMeta.pattern}</span>
              )}
            </div>
          </div>
          <div className="mc-loop-meta-section">
            <span className="mc-loop-meta-label">Intensity</span>
            <div className="mc-loop-meta-chips">
              {onFilterByTag ? (
                <button className="mc-loop-meta-chip mc-loop-meta-chip--instrument mc-loop-meta-chip--clickable"
                        title={`Filter by intensity "${clip.vpMeta.intensity}"`}
                        onClick={() => onFilterByTag(`vp-intensity:${clip.vpMeta!.intensity}`)}>
                  {clip.vpMeta.intensity}
                </button>
              ) : (
                <span className="mc-loop-meta-chip mc-loop-meta-chip--instrument">{clip.vpMeta.intensity}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {clip.loopMeta && (
        <div className="mc-loop-meta">
          {/* Instrument row */}
          {clip.loopMeta.instrumentType && (() => {
            const sub = clip.loopMeta!.instrumentSubType;
            const main = clip.loopMeta!.instrumentType;
            return (
              <div className="mc-loop-meta-section">
                <span className="mc-loop-meta-label">Instrument</span>
                <div className="mc-loop-meta-chips">
                  {sub && sub !== main && onFilterByTag ? (
                    <button className="mc-loop-meta-chip mc-loop-meta-chip--instrument mc-loop-meta-chip--clickable"
                            title={`Filter by instrument type "${main}"`}
                            onClick={() => onFilterByTag(`instrument:${main}`)}>
                      {main}
                    </button>
                  ) : sub && sub !== main ? (
                    <span className="mc-loop-meta-chip mc-loop-meta-chip--instrument">{main}</span>
                  ) : null}
                  {onFilterByTag ? (
                    <button className="mc-loop-meta-chip mc-loop-meta-chip--instrument mc-loop-meta-chip--clickable"
                            title={`Filter by instrument "${sub || main}"`}
                            onClick={() => onFilterByTag(`instrument:${sub || main}`)}>
                      {sub || main}
                    </button>
                  ) : (
                    <span className="mc-loop-meta-chip mc-loop-meta-chip--instrument">{sub || main}</span>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Genre row */}
          {clip.loopMeta.genre && (
            <div className="mc-loop-meta-section">
              <span className="mc-loop-meta-label">Genre</span>
              <div className="mc-loop-meta-chips">
                {onFilterByTag ? (
                  <button className="mc-loop-meta-chip mc-loop-meta-chip--genre mc-loop-meta-chip--clickable"
                          title={`Filter by genre "${clip.loopMeta.genre}"`}
                          onClick={() => onFilterByTag(`genre:${clip.loopMeta!.genre}`)}>
                    {clip.loopMeta.genre}
                  </button>
                ) : (
                  <span className="mc-loop-meta-chip mc-loop-meta-chip--genre">{clip.loopMeta.genre}</span>
                )}
              </div>
            </div>
          )}

          {/* Key row */}
          {clip.loopMeta.rootPc >= 0 && (() => {
            const keyLabel = `${rootPcName(clip.loopMeta!.rootPc)} ${keyTypeLabel(clip.loopMeta!.keyType)}`;
            return (
              <div className="mc-loop-meta-section">
                <span className="mc-loop-meta-label">Key</span>
                <div className="mc-loop-meta-chips">
                  {onFilterByTag ? (
                    <button className="mc-loop-meta-chip mc-loop-meta-chip--key mc-loop-meta-chip--clickable"
                            title={`Filter by key "${keyLabel}"`}
                            onClick={() => onFilterByTag(`key:${keyLabel}`)}>
                      {keyLabel}
                    </button>
                  ) : (
                    <span className="mc-loop-meta-chip mc-loop-meta-chip--key">{keyLabel}</span>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Loop type row */}
          {clip.loopMeta.gbLoopType > 0 && (() => {
            const loopLabel = gbLoopTypeLabel(clip.loopMeta!.gbLoopType, clip.loopMeta!.hasMidi);
            return (
              <div className="mc-loop-meta-section">
                <span className="mc-loop-meta-label">Loop type</span>
                <div className="mc-loop-meta-chips">
                  {onFilterByTag ? (
                    <button className="mc-loop-meta-chip mc-loop-meta-chip--looptype mc-loop-meta-chip--clickable"
                            title={`Filter by loop type "${loopLabel}"`}
                            onClick={() => onFilterByTag(`looptype:${loopLabel.toLowerCase()}`)}>
                      {loopLabel}
                    </button>
                  ) : (
                    <span className="mc-loop-meta-chip mc-loop-meta-chip--looptype">{loopLabel}</span>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Descriptors row */}
          {clip.loopMeta.descriptors && (() => {
            const tags = clip.loopMeta!.descriptors.split(',').map(d => d.trim()).filter(Boolean);
            return tags.length > 0 ? (
              <div className="mc-loop-meta-section">
                <span className="mc-loop-meta-label">Mood</span>
                <div className="mc-loop-meta-chips">
                  {tags.map(d => (
                    onFilterByTag ? (
                      <button key={d} className="mc-loop-meta-chip mc-loop-meta-chip--descriptor mc-loop-meta-chip--clickable"
                              title={`Filter by descriptor "${d}"`}
                              onClick={() => onFilterByTag(`descriptor:${d}`)}>
                        {d}
                      </button>
                    ) : (
                      <span key={d} className="mc-loop-meta-chip mc-loop-meta-chip--descriptor">{d}</span>
                    )
                  ))}
                </div>
              </div>
            ) : null;
          })()}

          {/* Provenance row: collection, jamPack, author */}
          {(clip.loopMeta.collection || clip.loopMeta.jamPack || clip.loopMeta.author) && (
            <div className="mc-loop-meta-section">
              <span className="mc-loop-meta-label">Pack</span>
              <div className="mc-loop-meta-chips">
                {clip.loopMeta.jamPack && (
                  onFilterByTag ? (
                    <button className="mc-loop-meta-chip mc-loop-meta-chip--provenance mc-loop-meta-chip--clickable"
                            title={`Filter by JamPack "${clip.loopMeta.jamPack}"`}
                            onClick={() => onFilterByTag(`jampak:${clip.loopMeta!.jamPack}`)}>
                      {clip.loopMeta.jamPack}
                    </button>
                  ) : (
                    <span className="mc-loop-meta-chip mc-loop-meta-chip--provenance">{clip.loopMeta.jamPack}</span>
                  )
                )}
                {clip.loopMeta.collection && (
                  onFilterByTag ? (
                    <button className="mc-loop-meta-chip mc-loop-meta-chip--provenance mc-loop-meta-chip--clickable"
                            title={`Filter by collection "${clip.loopMeta.collection}"`}
                            onClick={() => onFilterByTag(`collection:${clip.loopMeta!.collection}`)}>
                      {clip.loopMeta.collection}
                    </button>
                  ) : (
                    <span className="mc-loop-meta-chip mc-loop-meta-chip--provenance">{clip.loopMeta.collection}</span>
                  )
                )}
                {clip.loopMeta.author && (
                  <span className="mc-loop-meta-chip mc-loop-meta-chip--provenance mc-loop-meta-chip--author">
                    {clip.loopMeta.author}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Folder path */}
          {clip.loopMeta.folderPath && (
            <div className="mc-loop-meta-section">
              <span className="mc-loop-meta-label">Location</span>
              <div className="mc-loop-meta-chips">
                <span className="mc-loop-meta-folder" title={clip.loopMeta.folderPath}>
                  {clip.loopMeta.folderPath}
                </span>
              </div>
            </div>
          )}

          {/* Comment */}
          {clip.loopMeta.comment && (
            <div className="mc-loop-meta-section">
              <span className="mc-loop-meta-label">Comment</span>
              <div className="mc-loop-meta-chips">
                <span className="mc-loop-meta-text">{clip.loopMeta.comment}</span>
              </div>
            </div>
          )}

          {/* Copyright */}
          {clip.loopMeta.copyright && (
            <div className="mc-loop-meta-section">
              <span className="mc-loop-meta-label">Copyright</span>
              <div className="mc-loop-meta-chips">
                <span className="mc-loop-meta-text mc-loop-meta-text--dim">{clip.loopMeta.copyright}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
