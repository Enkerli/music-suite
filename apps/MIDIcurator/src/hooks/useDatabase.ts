import { useState, useEffect, useCallback } from 'react';
import { MidiDB } from '../lib/db';
import { BridgeDB, type ClipStore } from '../lib/bridge-db';
import { IN_PLUGIN } from '../lib/juce-bridge';
import type { Clip } from '../types/clip';

export function useDatabase() {
  const [db, setDb] = useState<ClipStore | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  /** Map of clipId → tag strings, refreshed alongside clips. */
  const [tagIndex, setTagIndex] = useState<Map<string, string[]>>(new Map());

  const loadClips = useCallback(async (database: ClipStore) => {
    const [allClips, allTags] = await Promise.all([
      database.getAllClips(),
      database.getAllTagsByClip(),
    ]);
    setClips(allClips.sort((a, b) => b.imported_at - a.imported_at));
    setTagIndex(allTags);
  }, []);

  useEffect(() => {
    const initDb = async () => {
      // In the plugin, IndexedDB is unreliable under the juce:// scheme —
      // the library lives in a C++-owned file instead (see bridge-db.ts).
      const database: ClipStore = IN_PLUGIN ? new BridgeDB() : new MidiDB();
      // A late library reply (cold WebView) re-reads the store into state.
      if (database instanceof BridgeDB) database.onHydrate = () => loadClips(database);
      await database.init();
      setDb(database);
      loadClips(database);
    };
    initDb();
  }, [loadClips]);

  const refreshClips = useCallback(() => {
    if (db) loadClips(db);
  }, [db, loadClips]);

  return { db, clips, tagIndex, refreshClips };
}
