/**
 * The shared frame's chrome as a React island — the framework-agnostic
 * @enkerli/ui global cluster (theme · MIDI · density). Same slots, ids
 * and behaviour as every suite app. The Library slot lives with
 * @enkerli/ui/library-browser now (Design pass · Q2) — MIDIcurator's
 * ClipBrowser mounts directly in the sidebar (see Sidebar.tsx), so
 * there's no separate drawer target for the cluster to toggle here.
 */
import { useEffect, useRef } from 'react';
import { createGlobalCluster } from '@enkerli/ui/global-cluster';

export interface ClusterMidi {
  unavailable?: boolean;
  outputs?: { id: string; name: string }[];
  selectedOutId?: string | null;
  noneOption?: string;
  onSelectOut?: (id: string | null) => void;
  sysex?: boolean;
  badge?: string;
}

export function GlobalClusterMount({ midi }: { midi: ClusterMidi | null }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const clusterRef = useRef<ReturnType<typeof createGlobalCluster> | null>(null);
  useEffect(() => {
    clusterRef.current = createGlobalCluster(hostRef.current!, { midi, densityTarget: document.body });
    return () => clusterRef.current?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mounts once
  }, []);
  useEffect(() => {
    clusterRef.current?.update({ midi });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [midi]);
  return <div ref={hostRef} />;
}
