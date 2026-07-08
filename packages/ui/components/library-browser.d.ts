/** Config-driven library browser (Design pass · Q2). See library-browser.js. */

export interface LibraryFacetValue { value: string; label?: string; dot?: string }

export interface LibraryFacet<T = any> {
  key: string;
  label: string;
  kind: "multi" | "min" | "bool";
  accessor?: (item: T) => unknown;
  values?: Array<string | LibraryFacetValue>;
  /** Item value is an array; selecting requires ALL chosen values (AND). */
  multi?: boolean;
  dot?: boolean;
  badge?: boolean;
  pip?: boolean;
  tag?: boolean;
  defaultOpen?: boolean;
  limit?: number;
}

export interface LibrarySort { value: string; label: string }

export interface LibraryBrowserOptions<T = any> {
  items: T[];
  facets?: LibraryFacet<T>[];
  title?: string;
  facetMin?: number;
  compact?: boolean;
  favorites?: boolean;
  frontDoors?: boolean;
  openOnRowClick?: boolean;
  keys?: { name?: string; favorite?: string; rating?: string; date?: string; source?: string };
  sorts?: LibrarySort[];
  rowActions?: string[];
  rowActionsFor?: (item: T) => string[];
  rowMeta?: (item: T) => string;
  emptyHint?: string;
  suggestLabel?: string;
  sendLabel?: string;
  formatDate?: (ts: unknown) => string;
  onOpen?: (item: T) => void;
  onSelect?: (item: T) => void;
  onRename?: (item: T, name: string) => void;
  onDuplicate?: (item: T, original?: T) => void;
  onSend?: (item: T) => void;
  onDelete?: (item: T) => void;
  onNew?: () => void;
  onImport?: () => void;
  onFavorite?: (item: T) => void;
  toast?: (opts: { text: unknown; undo?: () => void; undoLabel?: string }) => void;
}

export interface LibraryBrowserHandle<T = any> {
  setItems(items: T[]): void;
  getItems(): T[];
  update(next?: { items?: T[] }): void;
  getSelectedId(): string | null;
  setSelectedId(id: string | null): void;
  /** Move selection by delta rows within the visible list (±1); fires onSelect. */
  moveSelection(delta: number): void;
  destroy(): void;
}

export function createLibraryBrowser<T = any>(
  host: HTMLElement,
  options: LibraryBrowserOptions<T>,
): LibraryBrowserHandle<T>;
