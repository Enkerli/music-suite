import type { Clip } from '../types/clip';

export class MidiDB {
  private dbName = 'MidiCurator';
  private version = 1;
  private db: IDBDatabase | null = null;

  async init(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('clips')) {
          const clipStore = db.createObjectStore('clips', { keyPath: 'id' });
          clipStore.createIndex('filename', 'filename', { unique: false });
          clipStore.createIndex('imported_at', 'imported_at', { unique: false });
        }

        if (!db.objectStoreNames.contains('tags')) {
          const tagStore = db.createObjectStore('tags', { keyPath: ['clipId', 'tag'] });
          tagStore.createIndex('clipId', 'clipId', { unique: false });
          tagStore.createIndex('tag', 'tag', { unique: false });
        }

        if (!db.objectStoreNames.contains('buckets')) {
          db.createObjectStore('buckets', { keyPath: 'id' });
        }
      };
    });
  }

  async addClip(clip: Clip): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['clips'], 'readwrite');
      const store = tx.objectStore('clips');
      store.add(clip);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAllClips(): Promise<Clip[]> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['clips'], 'readonly');
      const store = tx.objectStore('clips');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result as Clip[]);
      request.onerror = () => reject(request.error);
    });
  }

  async getClip(id: string): Promise<Clip | undefined> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['clips'], 'readonly');
      const store = tx.objectStore('clips');
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result as Clip | undefined);
      request.onerror = () => reject(request.error);
    });
  }

  async updateClip(clip: Clip): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['clips'], 'readwrite');
      const store = tx.objectStore('clips');
      store.put(clip);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async deleteClip(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['clips', 'tags'], 'readwrite');
      tx.objectStore('clips').delete(id);

      // Delete associated tags
      const tagStore = tx.objectStore('tags');
      const index = tagStore.index('clipId');
      const cursorRequest = index.openCursor(IDBKeyRange.only(id));

      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async addTag(clipId: string, tag: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['tags'], 'readwrite');
      const store = tx.objectStore('tags');
      store.put({ clipId, tag, added_at: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async clearAllClips(): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['clips', 'tags'], 'readwrite');
      tx.objectStore('clips').clear();
      tx.objectStore('tags').clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getClipTags(clipId: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['tags'], 'readonly');
      const store = tx.objectStore('tags');
      const index = store.index('clipId');
      const request = index.getAll(IDBKeyRange.only(clipId));
      request.onsuccess = () =>
        resolve((request.result as Array<{ tag: string }>).map(t => t.tag));
      request.onerror = () => reject(request.error);
    });
  }

  /** Get all tags grouped by clip ID. */
  async getAllTagsByClip(): Promise<Map<string, string[]>> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['tags'], 'readonly');
      const store = tx.objectStore('tags');
      const request = store.getAll();
      request.onsuccess = () => {
        const map = new Map<string, string[]>();
        for (const rec of request.result as Array<{ clipId: string; tag: string }>) {
          if (!map.has(rec.clipId)) map.set(rec.clipId, []);
          map.get(rec.clipId)!.push(rec.tag);
        }
        resolve(map);
      };
      request.onerror = () => reject(request.error);
    });
  }
}
