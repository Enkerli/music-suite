import { useEffect } from 'react';

interface ShortcutHandlers {
  onDownload?: () => void;
  onGenerateVariants?: () => void;
  onGenerateSingle?: () => void;
  onDelete?: () => void;
  onTogglePlayback?: () => void;
  /** Toggle the triage flag on the current clip ('x' key). */
  onFlag?: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.matches('input')) return;

      if (e.key === 'd' && handlers.onDownload) {
        e.preventDefault();
        handlers.onDownload();
      }

      if (e.key === 'g' && handlers.onGenerateVariants) {
        e.preventDefault();
        handlers.onGenerateVariants();
      }

      if (e.key === 'v' && handlers.onGenerateSingle) {
        e.preventDefault();
        handlers.onGenerateSingle();
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && handlers.onDelete) {
        e.preventDefault();
        handlers.onDelete();
      }

      if (e.key === ' ' && handlers.onTogglePlayback) {
        e.preventDefault();
        handlers.onTogglePlayback();
      }

      if (e.key === 'x' && handlers.onFlag) {
        e.preventDefault();
        handlers.onFlag();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers.onDownload, handlers.onGenerateVariants, handlers.onGenerateSingle, handlers.onDelete, handlers.onTogglePlayback, handlers.onFlag]);
}
