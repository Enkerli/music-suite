interface DropZoneProps {
  onFilesDropped: (files: File[]) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

// React 18 ref typing workaround: cast to satisfy LegacyRef
type InputRef = React.LegacyRef<HTMLInputElement>;

export function DropZone({ onFilesDropped, fileInputRef }: DropZoneProps) {
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    onFilesDropped(files);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    onFilesDropped(files);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  };

  return (
    <div
      className="mc-dropzone"
      role="button"
      tabIndex={0}
      aria-label="Drop MIDI or Apple Loop files, or click to browse"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      onClick={() => fileInputRef.current?.click()}
      onKeyDown={handleKeyDown}
    >
      <div className="mc-dropzone-main">Drop MIDI / Apple Loop files here</div>
      <div className="mc-dropzone-sub">or click to browse</div>
      <input
        ref={fileInputRef as InputRef}
        type="file"
        multiple
        accept=".mid,.midi,.aif,.aiff,.caf"
        onChange={handleFileInputChange}
        style={{ display: 'none' }}
      />
    </div>
  );
}
