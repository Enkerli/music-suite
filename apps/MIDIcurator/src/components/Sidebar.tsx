import { type RefObject, useState, useMemo } from 'react';
import type { Clip } from '../types/clip';
import type { VoicingShape } from '../lib/progressions';
import { getEffectiveBarChords } from '../lib/gesture';
import { parseChordSymbol } from '../lib/chord-parser';
import { DropZone } from './DropZone';
import { ClipCard } from './ClipCard';
import { ThemeToggle } from './ThemeToggle';
import { ProgressionGenerator } from './ProgressionGenerator';

interface SidebarProps {
  clips: Clip[];
  /** All clips (unfiltered), used for cross-library panels. */
  allClips: Clip[];
  selectedClipId: string | null;
  filterTag: string;
  onFilterChange: (value: string) => void;
  onSelectClip: (clip: Clip) => void;
  onDownloadAll: () => void;
  onDownloadFlagged?: () => void;
  onClearAll: () => void;
  onFilesDropped: (files: File[]) => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onLoadSamples?: () => void;
  loadingSamples?: boolean;
  onGenerateProgression?: (progressionIndex: number, keyOffset: number, voicing: VoicingShape) => void;
  /** Called when the user picks a loop DB file (.db). */
  onLoadLoopDb?: (file: File) => void;
  /** Filename of the currently-loaded loop DB, or null. */
  loopDbFileName?: string | null;
  /** Loading / result status of the DB operation. */
  loopDbStatus?: 'idle' | 'loading' | 'ok' | 'error';
  /** Number of existing clips that were enriched with loop metadata. */
  loopDbEnriched?: number;
  /**
   * Apply a chord symbol as the leadsheet for all currently-filtered clips.
   * Shown when provided and there are filtered clips in the list.
   */
  onBulkLeadsheetUpdate?: (symbol: string) => void;
}

export function Sidebar({
  clips,
  allClips,
  selectedClipId,
  filterTag,
  onFilterChange,
  onSelectClip,
  onDownloadAll,
  onDownloadFlagged,
  onClearAll,
  onFilesDropped,
  fileInputRef,
  onLoadSamples,
  loadingSamples,
  onGenerateProgression,
  onLoadLoopDb,
  loopDbFileName,
  loopDbStatus = 'idle',
  loopDbEnriched = 0,
  onBulkLeadsheetUpdate,
}: SidebarProps) {
  const loopDbInputRef = { current: null as HTMLInputElement | null };
  const [unknownOpen, setUnknownOpen] = useState(false);
  const [bulkChordInput, setBulkChordInput] = useState('');
  const parsedBulkChord = useMemo(
    () => (bulkChordInput.trim() ? parseChordSymbol(bulkChordInput.trim()) : null),
    [bulkChordInput],
  );

  /**
   * Collect unrecognized chord symbols from allClips.
   * Returns two views:
   *   bySymbol: symbol → set of filenames (for the panel display, sorted by frequency)
   *   byClip:   filename → sorted list of bar+symbol pairs (for export)
   */
  const unknownChordData = useMemo(() => {
    const hasUnknown = (sym: string) => sym.includes('?') || sym.includes('[');
    const bySymbol = new Map<string, Set<string>>();
    const byClip = new Map<string, Array<{ bar: number; symbol: string }>>();

    for (const clip of allClips) {
      const seen = new Set<string>(); // deduplicate bar+sym within a clip

      // Check leadsheet inputText — covers Apple Loop null-chord unknowns
      if (clip.leadsheet) {
        for (const bar of clip.leadsheet.bars) {
          for (const lc of bar.chords) {
            // Use the chord symbol if matched, otherwise fall back to inputText
            const sym = lc.chord ? lc.chord.symbol : (lc.inputText ?? '');
            if (!sym || !hasUnknown(sym)) continue;
            const key = `${bar.bar}:${sym}`;
            if (seen.has(key)) continue;
            seen.add(key);
            if (!bySymbol.has(sym)) bySymbol.set(sym, new Set());
            bySymbol.get(sym)!.add(clip.filename);
            if (!byClip.has(clip.filename)) byClip.set(clip.filename, []);
            byClip.get(clip.filename)!.push({ bar: bar.bar, symbol: sym });
          }
        }
      }

      // Check barChords — covers MIDI-detected unknowns (chord is non-null)
      const bars = getEffectiveBarChords(clip) ?? [];
      for (const b of bars) {
        const sym = b.chord?.symbol ?? '';
        if (!sym || !hasUnknown(sym)) continue;
        const key = `${b.bar}:${sym}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (!bySymbol.has(sym)) bySymbol.set(sym, new Set());
        bySymbol.get(sym)!.add(clip.filename);
        if (!byClip.has(clip.filename)) byClip.set(clip.filename, []);
        byClip.get(clip.filename)!.push({ bar: b.bar, symbol: sym });
      }
    }

    return {
      bySymbol: [...bySymbol.entries()].sort((a, b) => b[1].size - a[1].size),
      byClip: [...byClip.entries()].sort((a, b) => a[0].localeCompare(b[0])),
    };
  }, [allClips]);

  const unknownChords = unknownChordData.bySymbol;

  function handleExportUnknownChords() {
    const lines: string[] = ['Unknown Chords Report', '='.repeat(60), ''];
    for (const [filename, entries] of unknownChordData.byClip) {
      const name = filename.replace(/\.mid$/i, '');
      lines.push(`Clip: ${name}`);
      // Sort by bar index, then deduplicate same bar+sym
      const sorted = [...entries].sort((a, b) => a.bar - b.bar);
      for (const { bar, symbol } of sorted) {
        lines.push(`  Bar ${bar + 1}: ${symbol}`);
      }
      lines.push('');
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'unknown-chords.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  const flaggedCount = useMemo(() => allClips.filter(c => c.flagged).length, [allClips]);

  const loopDbLabel = loopDbStatus === 'loading'
    ? '🗄 Loading…'
    : loopDbStatus === 'error'
    ? '🗄 DB Error'
    : loopDbFileName
    ? '🗄 DB ✓'
    : '🗄 Loop DB';

  const loopDbTitle = loopDbStatus === 'error'
    ? 'Failed to load. Select LogicLoopsDatabaseV11.db from ~/Music/Audio Music Apps/Databases/'
    : loopDbStatus === 'loading'
    ? 'Loading loop database…'
    : loopDbFileName
    ? `Loop DB loaded: ${loopDbFileName}. Click to reload.`
    : 'Load LogicLoopsDatabaseV11.db from ~/Music/Audio Music Apps/Databases/';

  return (
    <div className="mc-sidebar">
      <div className="mc-sidebar-header">
        <h2>MIDI Curator</h2>
        <ThemeToggle />
      </div>

      <DropZone onFilesDropped={onFilesDropped} fileInputRef={fileInputRef} />

      {onLoadLoopDb && (
        <div className="mc-loop-db-row">
          <button
            className={[
              'mc-btn--loop-db',
              loopDbStatus === 'ok' ? 'is-loaded' : '',
              loopDbStatus === 'error' ? 'is-error' : '',
              loopDbStatus === 'loading' ? 'is-loading' : '',
            ].filter(Boolean).join(' ')}
            title={loopDbTitle}
            disabled={loopDbStatus === 'loading'}
            onClick={() => loopDbInputRef.current?.click()}
          >
            {loopDbLabel}
          </button>
          {loopDbStatus === 'ok' && loopDbFileName && (
            <span className="mc-loop-db-name" title={loopDbFileName}>
              {loopDbFileName}
              {loopDbEnriched > 0 && (
                <span className="mc-loop-db-enriched" title={`${loopDbEnriched} existing clip(s) enriched with loop metadata`}>
                  {' '}+{loopDbEnriched}
                </span>
              )}
            </span>
          )}
          {loopDbStatus === 'ok' && loopDbEnriched === 0 && loopDbFileName && (
            <span className="mc-loop-db-name mc-loop-db-name--hint">
              no matches
            </span>
          )}
          <input
            ref={el => { loopDbInputRef.current = el; }}
            type="file"
            accept=".db,.sqlite"
            style={{ display: 'none' }}
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) onLoadLoopDb(f);
              e.target.value = '';
            }}
          />
        </div>
      )}

      {onGenerateProgression && (
        <ProgressionGenerator onGenerate={onGenerateProgression} />
      )}

      {onLoadSamples && clips.length === 0 && (
        <button
          className="mc-btn--load-samples"
          onClick={onLoadSamples}
          disabled={loadingSamples}
        >
          {loadingSamples ? 'Loading samples...' : 'Load sample progressions'}
        </button>
      )}

      <input
        type="text"
        className="mc-filter-input"
        placeholder="Filter clips..."
        aria-label="Filter clips by tag or name"
        value={filterTag}
        onChange={(e) => onFilterChange(e.target.value)}
      />

      {clips.length > 0 && (
        <div className="mc-quick-filters">
          <button
            className={`mc-quick-filter${filterTag === 'problem:metadata' ? ' is-active' : ''}`}
            title="Show clips missing loop metadata (no instrument, genre, or location info)"
            onClick={() => onFilterChange(filterTag === 'problem:metadata' ? '' : 'problem:metadata')}
          >
            ⚠ No metadata
          </button>
          <button
            className={`mc-quick-filter${filterTag === 'problem:chord' ? ' is-active' : ''}`}
            title="Show clips with unrecognised chords (marked with ? in chord bar)"
            onClick={() => onFilterChange(filterTag === 'problem:chord' ? '' : 'problem:chord')}
          >
            ⚠ Unknown chords
          </button>
          <button
            className={`mc-quick-filter${filterTag === 'problem:flagged' ? ' is-active' : ''}`}
            title="Show flagged clips (press x on any clip to flag/unflag)"
            onClick={() => onFilterChange(filterTag === 'problem:flagged' ? '' : 'problem:flagged')}
          >
            ⚑ Flagged
          </button>
        </div>
      )}

      {/* Bulk leadsheet panel */}
      {onBulkLeadsheetUpdate && clips.length > 0 && (
        <div className="mc-bulk-leadsheet">
          <div className="mc-bulk-leadsheet-row">
            <label htmlFor="mc-bulk-chord" className="mc-bulk-leadsheet-label">Leadsheet</label>
            <input
              id="mc-bulk-chord"
              type="text"
              className={[
                'mc-chord-input mc-bulk-chord-input',
                bulkChordInput.trim()
                  ? (parsedBulkChord ? 'mc-chord-input--valid' : 'mc-chord-input--invalid')
                  : '',
              ].filter(Boolean).join(' ')}
              value={bulkChordInput}
              placeholder="e.g. C, Fm7"
              onChange={e => setBulkChordInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && parsedBulkChord) {
                  onBulkLeadsheetUpdate(parsedBulkChord.symbol);
                  setBulkChordInput('');
                }
              }}
              autoComplete="off"
              spellCheck={false}
            />
            <button
              className="mc-bulk-leadsheet-btn"
              disabled={!parsedBulkChord}
              title={`Set leadsheet to "${parsedBulkChord?.symbol ?? ''}" for all ${clips.length} visible clip${clips.length !== 1 ? 's' : ''}`}
              onClick={() => {
                if (parsedBulkChord) {
                  onBulkLeadsheetUpdate(parsedBulkChord.symbol);
                  setBulkChordInput('');
                }
              }}
            >
              Apply to {clips.length}
            </button>
          </div>
        </div>
      )}

      {/* Unknown chords panel */}
      {unknownChords.length > 0 && (
        <div className="mc-unknown-chords">
          <div className="mc-unknown-chords-header">
            <button
              className="mc-unknown-chords-toggle"
              onClick={() => setUnknownOpen(o => !o)}
              aria-expanded={unknownOpen}
            >
              <span>{unknownOpen ? '▾' : '▸'}</span>
              {' '}{unknownChords.length} unknown chord{unknownChords.length !== 1 ? 's' : ''}
            </button>
            <button
              className="mc-btn--export-unknown"
              title="Download a text listing of all clips with unknown chords"
              onClick={handleExportUnknownChords}
            >
              ⬇ Export
            </button>
          </div>
          {unknownOpen && (
            <ul className="mc-unknown-chords-list">
              {unknownChords.map(([sym, files]) => (
                <li key={sym} className="mc-unknown-chord-row">
                  <span
                    className="mc-unknown-chord-sym"
                    title={`Click to filter clips containing ${sym}`}
                    onClick={() => onFilterChange(`problem:chord`)}
                  >
                    {sym}
                  </span>
                  <span className="mc-unknown-chord-files">
                    {[...files].sort().map((fn, i) => (
                      <span key={fn} className="mc-unknown-chord-file"
                        title={fn}
                        onClick={() => onFilterChange(fn.replace(/\.mid$/i, ''))}
                      >
                        {i > 0 && ', '}{fn.replace(/\.mid$/i, '')}
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mc-clip-count">
        <span>{clips.length} clips{flaggedCount > 0 ? ` · ⚑ ${flaggedCount}` : ''}</span>
        <span className="mc-clip-count-actions">
          {clips.length > 0 && (
            <>
              <button
                className="mc-btn--download-all"
                onClick={onDownloadAll}
                aria-label={`Download all ${clips.length} clips as ZIP file`}
              >
                Download All
              </button>
              {onDownloadFlagged && flaggedCount > 0 && (
                <button
                  className="mc-btn--download-flagged"
                  onClick={onDownloadFlagged}
                  aria-label={`Download ${flaggedCount} flagged clips as ZIP file`}
                  title={`Download ${flaggedCount} flagged clip${flaggedCount !== 1 ? 's' : ''} as ZIP`}
                >
                  ⚑ ZIP
                </button>
              )}
              <button
                className="mc-btn--clear-all"
                onClick={onClearAll}
                aria-label={`Clear all ${clips.length} clips from library`}
              >
                Clear All
              </button>
            </>
          )}
        </span>
      </div>

      <div className="mc-clip-list">
        {clips.map(clip => (
          <ClipCard
            key={clip.id}
            clip={clip}
            isSelected={selectedClipId === clip.id}
            onClick={() => onSelectClip(clip)}
          />
        ))}
      </div>
    </div>
  );
}
