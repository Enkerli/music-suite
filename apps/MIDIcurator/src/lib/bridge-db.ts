/**
 * BridgeDB — the clip library persisted through the plugin bridge instead
 * of IndexedDB. Under the juce:// custom scheme WKWebView treats the page
 * as an opaque origin where IndexedDB is unreliable/ephemeral, so inside
 * the plugin the library lives in a JSON file owned by the C++ side
 * (enkerliLoadLibrary / enkerliStoreLibrary round trip); in browsers the
 * original MidiDB keeps using IndexedDB.
 *
 * Same public surface as MidiDB (lib/db.ts) — useDatabase picks one.
 *
 * File format: an `@enkerli/library` envelope index (docs/LIBRARY_SPEC.md
 * §5 — "the file becomes a library-index.json"). Each clip is a described
 * item (kind "clip", identity, provenance, bpm/rating/flagged facets, tag
 * strings) carrying the Clip verbatim as its payload. The legacy
 * `{ clips, tags }` object is still ingested and upgrades on the next
 * persist. Never-lose-data rules: array entries this build doesn't
 * recognize are carried through persist verbatim (a newer build's items
 * survive a round-trip through an older one), and a clip that somehow
 * cannot form a valid envelope is stored bare — load recognizes bare
 * clips too, so it stays visible rather than vanishing into the
 * carried-through pile.
 */

import {
  wrapClip, unwrapClip, validateEnvelope, type LibraryItem, type ClipLike,
} from '@enkerli/library';
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

function isEnvelope(x: unknown): x is LibraryItem {
  return !!x && typeof x === 'object' &&
    (x as { envelope?: unknown }).envelope === 'enkerli-library-item';
}

function isBareClip(x: unknown): x is Clip {
  const c = x as Partial<Clip> | null;
  return !!c && typeof c === 'object' &&
    typeof c.id === 'string' && typeof c.filename === 'string' && !!c.gesture;
}

export class BridgeDB implements ClipStore {
  private clips = new Map<string, Clip>();
  private tags: TagRecord[] = [];
  /** Index entries this build can't read — preserved verbatim across persists. */
  private carried: unknown[] = [];
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
      if (!json) return;
      const parsed: unknown = JSON.parse(json);

      if (Array.isArray(parsed)) {
        // Envelope index (current format).
        const clips = new Map<string, Clip>();
        const tags: TagRecord[] = [];
        const carried: unknown[] = [];
        for (const entry of parsed) {
          if (isEnvelope(entry) && entry.kind === 'clip' && entry.payload &&
              validateEnvelope(entry).ok) {
            const clip = unwrapClip(entry) as unknown as Clip;
            clips.set(clip.id, clip);
            const at = Date.parse(entry.savedAt) || Date.now();
            for (const tag of entry.tags ?? [])
              tags.push({ clipId: clip.id, tag, added_at: at });
          } else if (isBareClip(entry)) {
            clips.set(entry.id, entry); // stored bare by a failed wrap — still a clip
          } else {
            carried.push(entry); // unknown (newer build?) — survives the round-trip
          }
        }
        this.clips = clips;
        this.tags = tags;
        this.carried = carried;
      } else if (parsed && typeof parsed === 'object') {
        // Legacy { clips, tags } file — upgraded to envelopes on next persist.
        const lib = parsed as LibraryFile;
        this.clips = new Map((lib.clips ?? []).map((c) => [c.id, c]));
        this.tags = lib.tags ?? [];
        this.carried = [];
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
      const tagsByClip = new Map<string, string[]>();
      for (const t of this.tags) {
        if (!tagsByClip.has(t.clipId)) tagsByClip.set(t.clipId, []);
        tagsByClip.get(t.clipId)!.push(t.tag);
      }
      const index: unknown[] = [...this.clips.values()].map((clip) => {
        try {
          const tags = tagsByClip.get(clip.id);
          const item = wrapClip(clip as unknown as ClipLike,
            tags !== undefined ? { tags } : undefined);
          // Data preservation first: a clip whose envelope would be invalid is
          // stored bare (ingest recognizes bare clips) rather than persisted
          // as a malformed item or dropped.
          return validateEnvelope(item).ok ? item : clip;
        } catch {
          return clip;
        }
      });
      index.push(...this.carried);
      bridge.send('enkerliStoreLibrary', { json: JSON.stringify(index) });
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
