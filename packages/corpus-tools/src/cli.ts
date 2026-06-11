#!/usr/bin/env node
/**
 * Regenerate transition tables from a local lead-sheet corpus directory.
 *
 *   regenerate-transitions <corpusDir> <outPrefix> [--respell]
 *
 * Writes <outPrefix>.json (the tables) and <outPrefix>.audit.json.
 * The corpus itself never leaves the machine — only derived statistics.
 */

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { looksLikeLeadSheet, parseLeadSheet } from "./leadsheet.js";
import { extractTransitions } from "./transitions.js";

const args = process.argv.slice(2);
const respell = args.includes("--respell");
const positional = args.filter((a) => !a.startsWith("--"));
const [corpusDir, outPrefix] = positional;

if (!corpusDir || !outPrefix) {
  console.error("usage: regenerate-transitions <corpusDir> <outPrefix> [--respell]");
  process.exit(2);
}

const sheets = [];
let nonSheets = 0;
for (const name of readdirSync(corpusDir).sort()) {
  if (!name.endsWith(".txt")) continue;
  const text = readFileSync(join(corpusDir, name), "utf8");
  if (!looksLikeLeadSheet(text)) {
    nonSheets += 1;
    continue;
  }
  sheets.push(parseLeadSheet(text));
}

const { major, minor, audit } = extractTransitions(sheets, { respell });

writeFileSync(`${outPrefix}.json`, JSON.stringify({ major, minor }, null, 2) + "\n");
writeFileSync(`${outPrefix}.audit.json`, JSON.stringify({ nonSheetTxtFiles: nonSheets, respell, ...audit }, null, 2) + "\n");

console.log(`sheets: ${audit.sheetsUsed}/${audit.sheetsTotal} used (${nonSheets} non-sheet .txt skipped)`);
console.log(`modes: ${audit.modes.major} major, ${audit.modes.minor} minor`);
console.log(`tokens: ${audit.chordTokens}, transitions: ${audit.transitions}, repeats collapsed: ${audit.repeatsCollapsed}`);
console.log(`parse failures: ${Object.values(audit.parseFailures).reduce((a, b) => a + b, 0)} (${Object.keys(audit.parseFailures).length} distinct)`);
console.log(`unknown quality suffixes: ${Object.keys(audit.unknownQualitySuffixes).length} distinct`);
console.log(`respelled roots: ${Object.values(audit.respelled).reduce((a, b) => a + b, 0)}`);
console.log(`wrote ${outPrefix}.json and ${outPrefix}.audit.json`);
