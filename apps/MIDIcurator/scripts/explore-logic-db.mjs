#!/usr/bin/env node
/**
 * Explore the Logic Loops Database (LogicLoopsDatabaseV11.db).
 *
 * Usage:
 *   node scripts/explore-logic-db.mjs [path-to-db]
 *
 * Defaults to looking for LogicLoopsDatabaseV11.db in:
 *   - Current directory
 *   - ~/Music/Audio Music Apps/Databases/
 */

import Database from 'better-sqlite3';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

// ─── Locate database ────────────────────────────────────────────────

let dbPath = process.argv[2];

if (!dbPath || !existsSync(dbPath)) {
  const candidates = [
    './LogicLoopsDatabaseV11.db',
    join(homedir(), 'Music/Audio Music Apps/Databases/LogicLoopsDatabaseV11.db'),
  ];

  for (const path of candidates) {
    if (existsSync(path)) {
      dbPath = path;
      break;
    }
  }
}

if (!dbPath || !existsSync(dbPath)) {
  console.error('Database not found. Tried:');
  console.error('  ./LogicLoopsDatabaseV11.db');
  console.error('  ~/Music/Audio Music Apps/Databases/LogicLoopsDatabaseV11.db');
  console.error('\nUsage: node explore-logic-db.mjs <path-to-db>');
  process.exit(1);
}

console.log(`Using database: ${dbPath}\n`);

// ─── Open database ──────────────────────────────────────────────────

const db = new Database(dbPath, { readonly: true });

// ─── Schema exploration ─────────────────────────────────────────────

console.log('='.repeat(70));
console.log('DATABASE SCHEMA');
console.log('='.repeat(70));

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();

console.log(`\nTables (${tables.length}):`);
for (const { name } of tables) {
  console.log(`  ${name}`);
}

// ─── Detailed schema ────────────────────────────────────────────────

console.log('\n' + '='.repeat(70));
console.log('TABLE SCHEMAS');
console.log('='.repeat(70));

for (const { name } of tables) {
  const schema = db.prepare(`PRAGMA table_info(${name})`).all();
  const rowCount = db.prepare(`SELECT COUNT(*) as count FROM ${name}`).get();

  console.log(`\n${name} (${rowCount.count} rows)`);
  console.log('-'.repeat(70));

  if (schema.length === 0) {
    console.log('  (no columns)');
  } else {
    for (const col of schema) {
      const pk = col.pk ? ' [PK]' : '';
      const notNull = col.notnull ? ' NOT NULL' : '';
      console.log(`  ${col.name}: ${col.type}${notNull}${pk}`);
    }
  }
}

// ─── Sample data from key tables ───────────────────────────────────

console.log('\n' + '='.repeat(70));
console.log('SAMPLE DATA');
console.log('='.repeat(70));

// Try to find a table with loop metadata
const metadataTables = tables.filter(t =>
  t.name.toLowerCase().includes('loop') ||
  t.name.toLowerCase().includes('file') ||
  t.name.toLowerCase().includes('asset')
);

for (const { name } of metadataTables.slice(0, 3)) {
  console.log(`\n${name} (first 5 rows):`);
  console.log('-'.repeat(70));

  try {
    const rows = db.prepare(`SELECT * FROM ${name} LIMIT 5`).all();

    if (rows.length === 0) {
      console.log('  (empty table)');
    } else {
      for (const row of rows) {
        console.log(JSON.stringify(row, null, 2));
      }
    }
  } catch (error) {
    console.log(`  Error reading table: ${error.message}`);
  }
}

// ─── Search for chord-related fields ────────────────────────────────

console.log('\n' + '='.repeat(70));
console.log('CHORD-RELATED FIELDS');
console.log('='.repeat(70));

for (const { name } of tables) {
  const schema = db.prepare(`PRAGMA table_info(${name})`).all();
  const chordFields = schema.filter(col =>
    col.name.toLowerCase().includes('chord') ||
    col.name.toLowerCase().includes('key') ||
    col.name.toLowerCase().includes('scale') ||
    col.name.toLowerCase().includes('note') ||
    col.name.toLowerCase().includes('root')
  );

  if (chordFields.length > 0) {
    console.log(`\n${name}:`);
    for (const col of chordFields) {
      console.log(`  ${col.name} (${col.type})`);
    }
  }
}

// ─── Search for files matching our test loops ──────────────────────

console.log('\n' + '='.repeat(70));
console.log('TEST FILES IN DATABASE');
console.log('='.repeat(70));

const testFiles = [
  'Modern Mystic FX',
  'LpTmA1',
  'LpTmA2',
  'LpTmB1',
  'LpTmB2',
  'LpTmC1',
  'LpTmC2',
  'LpTmD1',
  'LpTmD2',
  'LpTmD3',
  'LpTmD4',
  'LpTmE1',
  'LpTmE2',
  'LpTmE3',
  'LpTmE4',
  'LpTmE5',
  'LpTmE6',
  'LpTmE7',
];

// Try to find a filename or path column
for (const { name } of tables) {
  const schema = db.prepare(`PRAGMA table_info(${name})`).all();
  const filenameCol = schema.find(col =>
    col.name.toLowerCase().includes('file') ||
    col.name.toLowerCase().includes('path') ||
    col.name.toLowerCase().includes('name')
  );

  if (!filenameCol) continue;

  for (const testFile of testFiles) {
    try {
      const query = `SELECT * FROM ${name} WHERE ${filenameCol.name} LIKE ? LIMIT 1`;
      const result = db.prepare(query).get(`%${testFile}%`);

      if (result) {
        console.log(`\nFound "${testFile}" in ${name}:`);
        console.log(JSON.stringify(result, null, 2));
      }
    } catch (error) {
      // Skip errors from invalid queries
    }
  }
}

db.close();
console.log('\n' + '='.repeat(70));
