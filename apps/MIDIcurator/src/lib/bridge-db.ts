/**
 * BridgeDB — the clip library persisted through the plugin bridge instead
 * of IndexedDB. Under the juce:// custom scheme WKWebView treats the page
 * as an opaque origin where IndexedDB is unreliable/ephemeral, so inside
 * the plugin the library lives in a JSON file owned by the C++ side
 * (enkerliLoadLibrary / enkerliStoreLibrary round trip); in browsers the
 * original MidiDB keeps using IndexedDB.
 *
 * Same public surface as MidiDB (lib/db.ts) — useDatabase picks one.
 */

import type { Clip, TagRecord } from '../types/clip';
import { bridge } from './juce-bridge';

/** What both MidiDB and BridgeDB offer the app. */
export interface ClipStore {
  init(): Promise<unknown>;
  addClip(clip: Clip): Promise<void>;
  getAllClips(): Promise<Clip[]>;
  getClip(id: string): Promise<Clip | undefined>;
  updateClip(clip: Clip): Promise<void>;
  deleteClip(id: string): Promise<void>;
  addTag(clipId: string, tag: string): Promise<void>;
  clearAllClips(): Promise<void>;
  getClipTags(clipId: string): Promise<string[]>;
  getAllTagsByClip(): Promise<Map<string, string[]>>;
}

interface LibraryFile {
  clips: Clip[];
  tags: TagRecord[];
}

const PERSIST_DEBOUNCE_MS = 300;

export class BridgeDB implements ClipStore {
  private clips = new Map<string, Clip>();
  private tags: TagRecord[] = [];
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  /**
   * Called whenever the library arrives — including LATE, after init's
   * timeout already resolved. On a cold WebView the C++ reply can take
   * several seconds (longer than the init timeout), so the hook re-reads
   * the store when this fires (otherwise the list shows empty until the
   * next add). useDatabase wires this to reload clips.
   */
  onHydrate?: () => void;

  private ingest(data: unknown): void {
    try {
      const json = (data as { json?: string })?.json;
      if (json) {
        const lib = JSON.parse(json) as LibraryFile;
        this.clips = new Map((lib.clips ?? []).map((c) => [c.id, c]));
        this.tags = lib.tags ?? [];
      }
    } catch {
      // Corrupt library file: keep current state rather than brick the UI.
    }
  }

  /** Hydrate from the C++-owned library file (empty when none yet). */
  async init(): Promise<void> {
    // Persistent listener (not one-shot): a late reply still refreshes the UI.
    bridge.on('library', (data) => {
      this.ingest(data);
      this.onHydrate?.();
    });
    await new Promise<void>((resolve) => {
      // Generous timeout — cold AUv3 WebViews can take ~4s to first paint;
      // onHydrate covers any reply that lands after this resolves.
      const timeout = setTimeout(resolve, 4000);
      const off = bridge.on('library', () => {
        clearTimeout(timeout);
        off();
        resolve();
      });
      bridge.send('enkerliLoadLibrary');
    });
  }

  private persist(): void {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      const lib: LibraryFile = { clips: [...this.clips.values()], tags: this.tags };
      bridge.send('enkerliStoreLibrary', { json: JSON.stringify(lib) });
    }, PERSIST_DEBOUNCE_MS);
  }

  async addClip(clip: Clip): Promise<void> {
    if (this.clips.has(clip.id)) throw new Error(`clip ${clip.id} already exists`);
    this.clips.set(clip.id, clip);
    this.persist();
  }

  async getAllClips(): Promise<Clip[]> {
    return [...this.clips.values()];
  }

  async getClip(id: string): Promise<Clip | undefined> {
    return this.clips.get(id);
  }

  async updateClip(clip: Clip): Promise<void> {
    this.clips.set(clip.id, clip);
    this.persist();
  }

  async deleteClip(id: string): Promise<void> {
    this.clips.delete(id);
    this.tags = this.tags.filter((t) => t.clipId !== id);
    this.persist();
  }

  async addTag(clipId: string, tag: string): Promise<void> {
    if (!this.tags.some((t) => t.clipId === clipId && t.tag === tag)) {
      this.tags.push({ clipId, tag, added_at: Date.now() });
      this.persist();
    }
  }

  async clearAllClips(): Promise<void> {
    this.clips.clear();
    this.tags = [];
    this.persist();
  }

  async getClipTags(clipId: string): Promise<string[]> {
    return this.tags.filter((t) => t.clipId === clipId).map((t) => t.tag);
  }

  async getAllTagsByClip(): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>();
    for (const rec of this.tags) {
      if (!map.has(rec.clipId)) map.set(rec.clipId, []);
      map.get(rec.clipId)!.push(rec.tag);
    }
    return map;
  }
}
