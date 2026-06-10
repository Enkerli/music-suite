interface ActionBarProps {
  onGenerateSingle: () => void;
  onGenerateVariants: () => void;
  onDownload: () => void;
  onDelete: () => void;
}

export function ActionBar({
  onGenerateSingle,
  onGenerateVariants,
  onDownload,
  onDelete,
}: ActionBarProps) {
  return (
    <div className="mc-action-bar">
      <button
        className="mc-btn mc-btn--primary"
        onClick={onGenerateSingle}
        aria-label="Generate 1 variant with different density"
      >
        Generate 1 Variant
      </button>
      <button
        className="mc-btn mc-btn--secondary"
        onClick={onGenerateVariants}
        aria-label="Generate 5 variants with different densities"
      >
        Generate 5 Variants
      </button>
      <button
        className="mc-btn mc-btn--success"
        onClick={onDownload}
        aria-label="Download current clip as MIDI file"
      >
        Download MIDI
      </button>
      <button
        className="mc-btn mc-btn--danger"
        onClick={onDelete}
        aria-label="Delete current clip from library"
      >
        Delete
      </button>
    </div>
  );
}
