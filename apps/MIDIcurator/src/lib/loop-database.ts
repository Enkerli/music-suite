/**
 * loop-database.ts
 *
 * Read-only access to the Logic Pro / GarageBand loop browser SQLite database:
 *   ~/Music/Audio Music Apps/Databases/LogicLoopsDatabaseV11.db
 *
 * Uses sql.js (SQLite compiled to WebAssembly) so this works entirely in the
 * browser without any native bindings. The user opens the DB file once via the
 * File System Access API (or a plain <input type="file">); the result is cached
 * for the lifetime of the session.
 *
 * Limitations (documented):
 *   - macOS only — the DB path is macOS-specific.
 *   - Requires the user to manually point to the DB file on first use.
 *   - The DB is read-only; we never write to it.
 */

import type { LoopMeta } from '../types/clip';

// ─── sql.js lazy-load ────────────────────────────────────────────────────────

// sql.js is loaded on demand so it doesn't bloat the initial bundle.
// We use the WASM variant for performance.
import type { SqlJsStatic, Database } from 'sql.js';

let _sqlPromise: Promise<SqlJsStatic> | null = null;

async function getSqlJs(): Promise<SqlJsStatic> {
  if (!_sqlPromise) {
    _sqlPromise = import('sql.js').then(mod => {
      // mod.default is the initSqlJs factory; calling it returns Promise<SqlJsStatic>
      return (mod.default as unknown as (config?: object) => Promise<SqlJsStatic>)({
        // Vite exposes import.meta.env.BASE_URL (e.g. '/MIDIcurator/' in production,
        // '/' in dev).  sql.js requests 'sql-wasm.wasm', so we resolve it relative
        // to the app's base so the file is found whether deployed at / or at a sub-path.
        locateFile: (file: string) => `${import.meta.env.BASE_URL}${file}`,
      });
    });
  }
  return _sqlPromise;
}

// ─── Session-level cache ─────────────────────────────────────────────────────

/** Map from .caf filename (lower-cased) → LoopMeta */
let _cache: Map<string, LoopMeta> | null = null;

/** The DB file handle, kept so users can see which file is loaded */
let _loadedFileName: string | null = null;

export function getLoadedDbFileName(): string | null {
  return _loadedFileName;
}

export function isLoopDbLoaded(): boolean {
  return _cache !== null;
}

/** Discard the cached DB (e.g. if the user wants to load a different file). */
export function clearLoopDb(): void {
  _cache = null;
  _loadedFileName = null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extract a human-readable folder path from an Apple Loops fileURL.
 * e.g. "file:///Users/alex/Music/Logic%20Pro%20Library.bundle/Apple%20Loops/Modular%20Melodies/Foo.caf"
 * → "Apple Loops / Modular Melodies"
 *
 * We strip the host, the leading user home segment, drop the filename,
 * and return the remaining path segments joined with " / ".
 * If the path contains "Apple Loops", we show from that segment onward.
 */
function extractFolderPath(fileURL: string): string {
  if (!fileURL) return '';
  try {
    // URL-decode the path
    const decoded = decodeURIComponent(fileURL.replace(/^file:\/\//, ''));
    // Remove filename (last segment)
    const parts = decoded.split('/').filter(Boolean);
    parts.pop(); // drop filename
    // Find "Apple Loops" anchor (case-insensitive) and show from there
    const anchorIdx = parts.findIndex(p => p.toLowerCase().includes('apple loops') || p.toLowerCase().includes('apple_loops'));
    if (anchorIdx >= 0) {
      return parts.slice(anchorIdx).join(' / ');
    }
    // Fallback: last 2 directory segments
    return parts.slice(-2).join(' / ');
  } catch {
    return '';
  }
}

// ─── DB loading ──────────────────────────────────────────────────────────────

// Strategy: select .aif rows (user-created Apple Loops with Sequ chord data),
// join to their .caf sibling to get LoopsKeywords — keywords only live on .caf rows.
// Use the .caf row's key/keyType (more reliably curated than the .aif copy).
//
// IMPORTANT: the browser build of sql.js (sql-wasm-browser.js) does not populate
// QueryExecResult.columns — it returns undefined.  We therefore use strictly
// positional indexing; the constants below MUST match the SELECT order exactly.
// Primary query: .aif rows joined to their .caf sibling for keyword data.
// Always-present columns (positions 0–13, matching C_* constants below).
const LOOP_DB_QUERY_BASE = `
  SELECT
    a.fileName,
    COALESCE(c.key,     a.key),
    COALESCE(c.keyType, a.keyType),
    a.tempo,
    a.numberOfBeats,
    a.timeSignatureTop,
    a.timeSignatureBottom,
    COALESCE(lk.instrumentType,    ''),
    COALESCE(lk.instrumentSubType, ''),
    COALESCE(lk.genre,             ''),
    COALESCE(lk.descriptors,       ''),
    COALESCE(a.collection,         ''),
    COALESCE(a.author,             ''),
    COALESCE(c.gbLoopType, a.gbLoopType, 0),
    COALESCE(c.hasMidi,   a.hasMidi,   0)
  FROM Loops a
  LEFT JOIN Loops c
         ON c.fileName = REPLACE(a.fileName, '.aif', '.caf')
  LEFT JOIN LoopsKeywords lk ON lk.loopId = c.id
  WHERE a.fileName LIKE '%.aif'
`;

// Secondary query: .caf-only loops (no .aif sibling) — same column layout.
// Used to fill metadata for loops that have never been exported to GarageBand .aif.
// The NOT EXISTS subquery filters out .caf rows that already have an .aif counterpart
// (those are covered by the primary query above).
const LOOP_DB_QUERY_CAF_BASE = `
  SELECT
    c.fileName,
    c.key,
    c.keyType,
    c.tempo,
    c.numberOfBeats,
    c.timeSignatureTop,
    c.timeSignatureBottom,
    COALESCE(lk.instrumentType,    ''),
    COALESCE(lk.instrumentSubType, ''),
    COALESCE(lk.genre,             ''),
    COALESCE(lk.descriptors,       ''),
    COALESCE(c.collection,         ''),
    COALESCE(c.author,             ''),
    COALESCE(c.gbLoopType, 0),
    COALESCE(c.hasMidi,   0)
  FROM Loops c
  LEFT JOIN LoopsKeywords lk ON lk.loopId = c.id
  WHERE c.fileName LIKE '%.caf'
    AND NOT EXISTS (
      SELECT 1 FROM Loops a
       WHERE a.fileName = REPLACE(c.fileName, '.caf', '.aif')
    )
`;

// Optional columns — probed at load time against the actual schema.
// col: bare column name used for schema probing; expr: full SELECT expression using aliases a/c.
const OPTIONAL_COLS: Array<{ col: string; expr: string; fallback: string }> = [
  { col: 'jamPack',   expr: "COALESCE(a.jamPack,   c.jamPack,   '')", fallback: "''" },
  { col: 'comment',   expr: "COALESCE(a.comment,   c.comment,   '')", fallback: "''" },
  { col: 'copyright', expr: "COALESCE(a.copyright, c.copyright, '')", fallback: "''" },
  { col: 'fileURL',   expr: "COALESCE(c.fileURL,   a.fileURL,   '')", fallback: "''" },
];

// Column positions (must match SELECT order above)
const C_FILENAME   = 0;
const C_KEY        = 1;
const C_KEYTYPE    = 2;
const C_TEMPO      = 3;
const C_BEATS      = 4;
const C_TIMESIG_N  = 5;
const C_TIMESIG_D  = 6;
const C_INST_TYPE  = 7;
const C_INST_SUB   = 8;
const C_GENRE      = 9;
const C_DESC       = 10;
const C_COLLECTION = 11;
const C_AUTHOR     = 12;
const C_GBLOOPTYPE = 13;
const C_HASMIDI    = 14;
const C_JAMPAK    = 15;
const C_COMMENT   = 16;
const C_COPYRIGHT = 17;
const C_FILEURL   = 18;

/**
 * Load a loop database file (ArrayBuffer) into the in-memory cache.
 * Typically called after the user picks the file via a file picker.
 */
export async function loadLoopDb(buffer: ArrayBuffer, fileName: string): Promise<void> {
  const SQL = await getSqlJs();
  // sql.js Database constructor accepts Uint8Array
  const db: Database = new SQL.Database(new Uint8Array(buffer));

  // Verify this is the expected DB before running the full query
  const tableCheck = db.exec(
    "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('Loops','LoopsKeywords')"
  );
  const foundTables = (tableCheck[0]?.values ?? []).map(r => String(r[0]));
  if (!foundTables.includes('Loops') || !foundTables.includes('LoopsKeywords')) {
    db.close();
    throw new Error(
      `Not a Logic loop database — expected tables 'Loops' and 'LoopsKeywords', ` +
      `found: ${foundTables.join(', ') || 'none'}. ` +
      `Please select LogicLoopsDatabaseV11.db from ~/Music/Audio Music Apps/Databases/`
    );
  }

  // Introspect the Loops table to find which optional columns exist.
  // Probe each column name directly on the Loops table (LIMIT 0 — no data read).
  const optionalExprs = OPTIONAL_COLS.map(({ col, expr, fallback }) => {
    try {
      db.exec(`SELECT ${col} FROM Loops LIMIT 0`);
      return expr;
    } catch {
      console.log(`[loop-database] optional column '${col}' not present in this DB version`);
      return fallback;
    }
  });

  // Build the optional-column suffix for both queries.
  // The .aif query uses COALESCE(a.col, c.col, '') — prefers .caf for fileURL.
  // The .caf-only query uses COALESCE(c.col, '') with the alias rewritten.
  const aifOptionalExprs = optionalExprs; // already resolved above
  const cafOptionalExprs = optionalExprs.map(expr =>
    // Replace "a.<col>" references with "c.<col>" for the .caf-only query
    expr.replace(/\ba\.(jamPack|comment|copyright|fileURL)\b/g, 'c.$1')
        .replace(/,\s*a\.(jamPack|comment|copyright|fileURL)/g, '')
  );

  // Primary query: .aif rows joined to their .caf sibling.
  // Insert optional columns AFTER hasMidi (the last fixed column, position 14)
  // so C_HASMIDI=14 remains accurate and optional cols land at 15–18 as expected.
  const queryAif = LOOP_DB_QUERY_BASE.replace(
    /COALESCE\(c\.hasMidi,\s+a\.hasMidi,\s+0\)/,
    `COALESCE(c.hasMidi,   a.hasMidi,   0),\n    ${aifOptionalExprs.join(',\n    ')}`
  );

  // Secondary query: .caf-only loops (no .aif counterpart).
  const queryCaf = LOOP_DB_QUERY_CAF_BASE.replace(
    /COALESCE\(c\.hasMidi,\s+0\)/,
    `COALESCE(c.hasMidi,   0),\n    ${cafOptionalExprs.join(',\n    ')}`
  );

  const resultAif = db.exec(queryAif);
  const resultCaf = db.exec(queryCaf);
  db.close();

  // Note: sql-wasm-browser.js does not populate .columns — only .values is reliable.
  const aifRows = resultAif[0]?.values?.length ?? 0;
  const cafRows = resultCaf[0]?.values?.length ?? 0;
  console.log(`[loop-database] .aif rows: ${aifRows}, .caf-only rows: ${cafRows}`);

  const map = new Map<string, LoopMeta>();

  /** Parse one result row into a LoopMeta and register it in the map. */
  const addRow = (row: (string | number | null)[]) => {
    const filename = String(row[C_FILENAME] ?? '');
    if (!filename) return;

    const midiRoot   = Number(row[C_KEY]     ?? 0);
    const keyTypeVal = Math.min(3, Math.max(0, Number(row[C_KEYTYPE] ?? 0)));
    const rootPc: number = keyTypeVal === 0 ? -1 : midiRoot % 12;

    const fileURL    = String(row[C_FILEURL]  ?? '');
    const folderPath = extractFolderPath(fileURL);

    const meta: LoopMeta = {
      cafFilename:         filename,
      rootPc,
      keyType:             keyTypeVal as LoopMeta['keyType'],
      tempo:               Number(row[C_TEMPO]      ?? 0),
      numberOfBeats:       Number(row[C_BEATS]      ?? 0),
      timeSignatureTop:    Number(row[C_TIMESIG_N]  ?? 4),
      timeSignatureBottom: Number(row[C_TIMESIG_D]  ?? 4),
      instrumentType:      String(row[C_INST_TYPE]  ?? ''),
      instrumentSubType:   String(row[C_INST_SUB]   ?? ''),
      genre:               String(row[C_GENRE]       ?? ''),
      descriptors:         String(row[C_DESC]        ?? ''),
      collection:          String(row[C_COLLECTION]  ?? ''),
      author:              String(row[C_AUTHOR]      ?? ''),
      gbLoopType:          Number(row[C_GBLOOPTYPE]  ?? 0),
      hasMidi:             Number(row[C_HASMIDI]     ?? 0),
      jamPack:             String(row[C_JAMPAK]      ?? '') || undefined,
      comment:             String(row[C_COMMENT]     ?? '') || undefined,
      copyright:           String(row[C_COPYRIGHT]   ?? '') || undefined,
      folderPath:          folderPath || undefined,
    };

    const lower = filename.toLowerCase();
    // Register under the filename as-is
    map.set(lower, meta);
    // Also register under the sibling extension so lookups work regardless of
    // whether the user imported the .aif or the .caf variant.
    const sibling = lower.endsWith('.caf')
      ? lower.replace(/\.caf$/, '.aif')
      : lower.replace(/\.aif{1,2}$/, '.caf');
    if (sibling !== lower && !map.has(sibling)) map.set(sibling, meta);

    // Some DB entries have no file extension in fileName (e.g. "Rising Up Keys 01").
    // Register the bare stem so lookups for "Rising Up Keys 01.aif" can strip and match.
    const stem = lower.replace(/\.(caf|aif{1,2})$/, '');
    if (stem !== lower && !map.has(stem)) map.set(stem, meta);

    // Also register by the URL-decoded basename from fileURL — handles cases where
    // fileName has typos/double-spaces that don't match the imported .aif name
    // (e.g. "Fluttering Darkness  Pattern 01.caf" in fileURL vs single-space in .aif).
    if (fileURL) {
      try {
        const urlDecoded = decodeURIComponent(fileURL.replace(/^file:\/\//, ''));
        const urlBase = urlDecoded.split('/').pop()!.toLowerCase();
        if (urlBase && urlBase !== lower && !map.has(urlBase)) map.set(urlBase, meta);
        // And the sibling of that
        const urlSibling = urlBase.endsWith('.caf')
          ? urlBase.replace(/\.caf$/, '.aif')
          : urlBase.replace(/\.aif{1,2}$/, '.caf');
        if (urlSibling !== urlBase && !map.has(urlSibling)) map.set(urlSibling, meta);
        // And the bare stem
        const urlStem = urlBase.replace(/\.(caf|aif{1,2})$/, '');
        if (urlStem !== urlBase && !map.has(urlStem)) map.set(urlStem, meta);
      } catch { /* ignore malformed URLs */ }
    }
  };

  for (const row of (resultAif[0]?.values ?? [])) addRow(row as (string | number | null)[]);
  // Secondary pass — only adds entries not already covered by the primary query
  for (const row of (resultCaf[0]?.values ?? [])) addRow(row as (string | number | null)[]);

  if (map.size === 0) {
    console.warn('[loop-database] Query returned no rows. Check DB schema compatibility.');
  } else {
    console.log(`[loop-database] Loaded ${map.size} loop entries from DB.`);
  }

  _cache = map;
  _loadedFileName = fileName;
}

// ─── Lookup ──────────────────────────────────────────────────────────────────

/**
 * Look up loop metadata by the imported file's name.
 *
 * The import filename is typically `Something.aif` or `Something.aiff`;
 * the DB stores the same loop as `Something.caf`. We try both forms.
 *
 * Returns undefined if the DB is not loaded or the loop is not found.
 */
export function lookupLoopMeta(importedFilename: string): LoopMeta | undefined {
  if (!_cache) return undefined;

  // Strip path component, lower-case for case-insensitive match
  const base = importedFilename.split('/').pop()!.split('\\').pop()!.toLowerCase();

  // Try exact match first (e.g. .caf files dragged in directly)
  if (_cache.has(base)) return _cache.get(base);

  // Strip any known extension and try .caf — covers:
  //   "Something.aif" / "Something.aiff" → "Something.caf"  (direct import)
  //   "Something.mid"                     → "Something.caf"  (back-fill after conversion)
  const cafName = base.replace(/\.(aif|aiff|mid|midi)$/, '.caf');
  if (_cache.has(cafName)) return _cache.get(cafName);

  // Try bare stem — handles DB entries whose fileName has no extension
  // (e.g. "Rising Up Keys 01" stored without ".caf").
  const stem = base.replace(/\.(caf|aif{1,2}|midi?)$/, '');
  if (stem !== base && _cache.has(stem)) return _cache.get(stem);

  return undefined;
}

// ─── Human-readable helpers ──────────────────────────────────────────────────

// Logic Pro keyType values (from observed DB data):
//   0 = Any key, 1 = Major, 2 = Minor, 3 = Neither (atonal/FX)
const KEY_TYPE_LABELS: Record<number, string> = {
  0: 'Any',
  1: 'Major',
  2: 'Minor',
  3: 'Neither',
};

export function keyTypeLabel(keyType: number): string {
  return KEY_TYPE_LABELS[keyType] ?? String(keyType);
}

// Logic Pro loop type, determined by gbLoopType + hasMidi:
//   gbLoopType=0            → Audio (blue in Logic Loop Browser)
//   gbLoopType=1, hasMidi=1 → MIDI  (green; standard embedded SMF, directly extractable)
//   gbLoopType=1, hasMidi=6 → Pattern (green but step-sequencer/uuid chunk, not plain SMF)
//   gbLoopType=2            → Session Player (purple; dynamically generated by Logic)
//
// hasMidi is a storage-format enum, not a boolean:
//   0 = none, 1 = plain SMF midi chunk, 2 = session-player, 6 = uuid/step-seq chunk

/**
 * Return the human-readable Logic Pro loop type label.
 * Both gbLoopType and hasMidi are needed for accurate labelling within gbLoopType=1.
 */
export function gbLoopTypeLabel(gbLoopType: number, hasMidi = 0): string {
  if (gbLoopType === 0) return 'Audio';
  if (gbLoopType === 1) return hasMidi === 6 ? 'Pattern' : 'MIDI';
  if (gbLoopType === 2) return 'Session Player';
  return String(gbLoopType);
}

const NOTE_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

export function rootPcName(rootPc: number): string {
  if (rootPc < 0) return 'Any';
  return NOTE_NAMES[rootPc % 12] ?? '?';
}
