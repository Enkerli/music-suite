import { useState, useRef, useEffect, useCallback } from 'react';
import type { Harmonic } from '../types/clip';
import { serializeLeadsheet, parseLeadsheet } from '../lib/leadsheet-parser';

interface LeadsheetInputProps {
  value: string;
  numBars: number;
  onSubmit: (inputText: string) => void;
  /** Realized harmonic data — used to pre-fill from detected chords. */
  harmonic?: Harmonic;
}

/**
 * Text input for entering a leadsheet chord progression.
 * Shows a collapsed label when not editing, expands to a text input on click.
 */
export function LeadsheetInput({
  value,
  numBars,
  onSubmit,
  harmonic,
}: LeadsheetInputProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync draft when value changes externally
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleSubmit = useCallback(() => {
    const trimmed = draft.trim();
    setEditing(false);
    if (trimmed === '') {
      // Clear leadsheet
      onSubmit('');
    } else {
      onSubmit(trimmed);
    }
  }, [draft, onSubmit]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setDraft(value);
      setEditing(false);
    }
  };

  const handleCopyFromDetected = useCallback(() => {
    if (!harmonic?.barChords) return;
    // Build a leadsheet from detected bar chords
    const barTexts = harmonic.barChords.map(bc => {
      const chord = bc.segments?.[0]?.chord ?? bc.chord;
      return chord?.symbol ?? 'NC';
    });
    const text = barTexts.join(' | ');
    // Parse and serialize to normalize
    const ls = parseLeadsheet(text, numBars);
    const normalized = serializeLeadsheet(ls);
    setDraft(normalized);
    setEditing(true);
  }, [harmonic, numBars]);

  if (editing) {
    return (
      <div className="mc-leadsheet-input-row">
        <label className="mc-leadsheet-input-label">Chords:</label>
        <input
          ref={inputRef}
          type="text"
          className="mc-leadsheet-input"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSubmit}
          placeholder="Fm7 | Am7 D7 | Abm7 Db7 | Bbm7 Eb7"
        />
      </div>
    );
  }

  return (
    <div className="mc-leadsheet-input-row">
      <button
        className="mc-btn--small mc-leadsheet-edit-btn"
        onClick={() => setEditing(true)}
        title="Enter underlying chord progression (leadsheet)"
      >
        {value ? 'Edit chords' : 'Add chords'}
      </button>
      {!value && harmonic?.barChords && harmonic.barChords.length > 0 && (
        <button
          className="mc-btn--small mc-leadsheet-copy-btn"
          onClick={handleCopyFromDetected}
          title="Pre-fill leadsheet from detected chords"
        >
          Copy from detected
        </button>
      )}
    </div>
  );
}
