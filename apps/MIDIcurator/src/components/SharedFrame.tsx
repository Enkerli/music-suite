/**
 * The shared frame's chrome as React islands — the framework-agnostic
 * @enkerli/ui cluster (theme · MIDI · density · Library) and the one
 * Library drawer. Same slots, ids and behaviour as every suite app.
 */
import { useEffect, useRef } from 'react';
import { createGlobalCluster } from '@enkerli/ui/global-cluster';
import { createLibraryDrawer } from '@enkerli/ui/library-drawer';

export interface ClusterMidi {
  unavailable?: boolean;
  outputs?: { id: string; name: string }[];
  selectedOutId?: string | null;
  noneOption?: string;
  onSelectOut?: (id: string | null) => void;
  sysex?: boolean;
  badge?: string;
}

export function GlobalClusterMount({ midi, libCount, onLibToggle }: {
  midi: ClusterMidi | null;
  libCount: number;
  onLibToggle: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const clusterRef = useRef<ReturnType<typeof createGlobalCluster> | null>(null);
  const onLibRef = useRef(onLibToggle); onLibRef.current = onLibToggle;
  const lib = (count: number) => ({ count, onToggle: () => onLibRef.current() });
  useEffect(() => {
    clusterRef.current = createGlobalCluster(hostRef.current!, {
      midi, densityTarget: document.body, library: lib(libCount),
    });
    return () => clusterRef.current?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mounts once
  }, []);
  useEffect(() => {
    clusterRef.current?.update({ midi, library: lib(libCount) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [midi, libCount]);
  return <div ref={hostRef} />;
}

export interface DrawerItem {
  id: string;
  name: string;
  kind: 'document' | 'patch' | 'profile';
  meta?: string;
  source?: string;
}

export function LibraryDrawerMount({ noun, items, onRecall, onDelete, onClose }: {
  noun: string;
  items: DrawerItem[];
  onRecall: (item: DrawerItem) => void;
  onDelete: (item: DrawerItem) => void;
  onClose: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<ReturnType<typeof createLibraryDrawer> | null>(null);
  const cbs = useRef({ onRecall, onDelete, onClose });
  cbs.current = { onRecall, onDelete, onClose };
  useEffect(() => {
    drawerRef.current = createLibraryDrawer(hostRef.current!, {
      noun, items, // no `thing`/onSave: clips arrive by import, not save
      onRecall: (it: DrawerItem) => cbs.current.onRecall(it),
      onDelete: (it: DrawerItem) => cbs.current.onDelete(it),
      onClose: () => cbs.current.onClose(),
    });
    return () => drawerRef.current?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mounts once
  }, []);
  useEffect(() => { drawerRef.current?.update({ items }); }, [items]);
  return <div ref={hostRef} />;
}
