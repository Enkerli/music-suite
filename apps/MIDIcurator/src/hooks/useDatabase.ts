import { useState, useEffect, useCallback } from 'react';
import { MidiDB } from '../lib/db';
import type { Clip } from '../types/clip';

export function useDatabase() {
  const [db, setDb] = useState<MidiDB | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  /** Map of clipId → tag strings, refreshed alongside clips. */
  const [tagIndex, setTagIndex] = useState<Map<string, string[]>>(new Map());

  const loadClips = useCallback(async (database: MidiDB) => {
    const [allClips, allTags] = await Promise.all([
      database.getAllClips(),
      database.getAllTagsByClip(),
    ]);
    setClips(allClips.sort((a, b) => b.imported_at - a.imported_at));
    setTagIndex(allTags);
  }, []);

  useEffect(() => {
    const initDb = async () => {
      const database = new MidiDB();
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
