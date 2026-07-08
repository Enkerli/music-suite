import { useEffect, useRef } from 'react';
import { createLibraryBrowser } from '@enkerli/ui/library-browser';
import type { Clip } from '../types/clip';

type BrowserHandle = ReturnType<typeof createLibraryBrowser>;

interface ClipBrowserProps {
  clips: Clip[];
  selectedClipId: string | null;
  onSelectClip: (clip: Clip) => void;
  onDeleteClip: (clip: Clip) => void;
  /** Hands the browser handle up so the app can drive ↑/↓ nav through it. */
  registerHandle: (h: BrowserHandle | null) => void;
}

const bpmBucket = (bpm: number): string =>
  bpm <= 80 ? '≤80' : bpm <= 100 ? '81–100' : bpm <= 120 ? '101–120' : bpm <= 140 ? '121–140' : '>140';

/**
 * The clip library as the shared @enkerli/ui LibraryBrowser (Design pass · Q2),
 * compact for MIDIcurator's sidebar. Adds faceted browsing the old flat list
 * lacked — Flagged · Rating · Tempo · Chord — while keeping the card's info
 * (BPM · density · chord) as the row's secondary line and preserving arrow-key
 * navigation through the browser's own filtered order.
 */
export function ClipBrowser({ clips, selectedClipId, onSelectClip, onDeleteClip, registerHandle }: ClipBrowserProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const brRef = useRef<BrowserHandle | null>(null);
  const cb = useRef({ onSelectClip, onDeleteClip });
  cb.current = { onSelectClip, onDeleteClip };

  useEffect(() => {
    const chordOf = (c: Clip) => c.harmonic?.detectedChord?.symbol ?? null;
    const br = createLibraryBrowser(hostRef.current!, {
      items: clips,
      title: 'Clips',
      compact: true,
      favorites: false,
      openOnRowClick: true,
      // The Flagged bool facet reads the clip's `flagged`; rating/date map too.
      keys: { name: 'filename', rating: 'rating', date: 'imported_at', favorite: 'flagged' },
      sorts: [
        { value: 'recent', label: 'Added' },
        { value: 'name', label: 'Name A–Z' },
        { value: 'rating', label: 'Rating' },
      ],
      facets: [
        { key: 'flagged', label: '⚑ Flagged', kind: 'bool' },
        { key: 'rating', label: 'Rating', kind: 'min' },
        { key: 'tempo', label: 'Tempo', kind: 'multi',
          values: ['≤80', '81–100', '101–120', '121–140', '>140'], accessor: (c: Clip) => bpmBucket(c.bpm) },
        { key: 'chord', label: 'Chord', kind: 'multi', badge: true, defaultOpen: false, limit: 16, accessor: chordOf },
      ],
      rowMeta: (c: Clip) =>
        `${c.flagged ? '⚑ ' : ''}${c.bpm ?? '?'} BPM · ${c.gesture?.density?.toFixed(1) ?? '?'} density`,
      rowActions: ['delete'],
      emptyHint: 'Drop MIDI files or load samples to start your library.',
      onSelect: (c: Clip) => cb.current.onSelectClip(c),
      onOpen: (c: Clip) => cb.current.onSelectClip(c),
      // Undo is handled by the DB-owning parent (deleteClipFromLibrary shows
      // the toast); no `toast` here or the delete would double-toast.
      onDelete: (c: Clip) => cb.current.onDeleteClip(c),
    });
    brRef.current = br;
    registerHandle(br);
    return () => { registerHandle(null); br.destroy(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { brRef.current?.setItems(clips); }, [clips]);
  useEffect(() => {
    if (brRef.current && selectedClipId && brRef.current.getSelectedId() !== selectedClipId) {
      brRef.current.setSelectedId(selectedClipId);
    }
  }, [selectedClipId]);

  return <div ref={hostRef} className="mc-clip-browser" />;
}
