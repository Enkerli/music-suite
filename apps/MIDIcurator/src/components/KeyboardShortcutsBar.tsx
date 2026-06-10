export function KeyboardShortcutsBar() {
  return (
    <div className="mc-shortcuts-bar">
      <span><kbd className="mc-kbd">&uarr;&darr;</kbd> Clips</span>
      <span><kbd className="mc-kbd">&larr;&rarr;</kbd> Segments</span>
      <span><kbd className="mc-kbd">Space</kbd> Play/Pause</span>
      <span><kbd className="mc-kbd">S</kbd> Scissors</span>
      <span><kbd className="mc-kbd">D</kbd> Download</span>
      <span><kbd className="mc-kbd">Enter</kbd> Set chord</span>
      <span><kbd className="mc-kbd">G</kbd> Generate 5</span>
      <span><kbd className="mc-kbd">V</kbd> Generate 1</span>
      <span className="mc-storage-note">All data stored locally in your browser</span>
    </div>
  );
}
