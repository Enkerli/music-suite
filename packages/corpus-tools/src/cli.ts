#!/usr/bin/env node
/**
 * Regenerate transition tables from a local lead-sheet corpus directory.
 *
 *   regenerate-transitions <corpusDir> <outPrefix> [--respell]
 *
 * Writes <outPrefix>.json (the pair tables), <outPrefix>.trigrams.json (the
 * second-order tables, pruned), and <outPrefix>.audit.json.
 * The corpus itself never leaves the machine — only derived statistics.
 */

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { looksLikeLeadSheet, parseLeadSheet } from "./leadsheet.js";
import { looksLikeImproVisor, parseImproVisorLeadSheet } from "./improvisor.js";
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
  const isTxt = name.endsWith(".txt");
  const isLs = name.endsWith(".ls");
  if (!isTxt && !isLs) continue;
  const text = readFileSync(join(corpusDir, name), "utf8");
  if (isLs && looksLikeImproVisor(text)) {
    sheets.push(parseImproVisorLeadSheet(text));
  } else if (isTxt && looksLikeLeadSheet(text)) {
    sheets.push(parseLeadSheet(text));
  } else {
    nonSheets += 1;
  }
}

const { major, minor, majorTrigrams, minorTrigrams, audit } = extractTransitions(sheets, { respell });

writeFileSync(`${outPrefix}.json`, JSON.stringify({ major, minor }, null, 2) + "\n");
writeFileSync(`${outPrefix}.trigrams.json`, JSON.stringify({ major: majorTrigrams, minor: minorTrigrams }) + "\n");
writeFileSync(`${outPrefix}.audit.json`, JSON.stringify({ nonSheetTxtFiles: nonSheets, respell, ...audit }, null, 2) + "\n");

console.log(`sheets: ${audit.sheetsUsed}/${audit.sheetsTotal} used (${nonSheets} non-sheet .txt skipped)`);
console.log(`modes: ${audit.modes.major} major, ${audit.modes.minor} minor`);
console.log(`tokens: ${audit.chordTokens}, transitions: ${audit.transitions}, repeats collapsed: ${audit.repeatsCollapsed}`);
console.log(`parse failures: ${Object.values(audit.parseFailures).reduce((a, b) => a + b, 0)} (${Object.keys(audit.parseFailures).length} distinct)`);
console.log(`unknown quality suffixes: ${Object.keys(audit.unknownQualitySuffixes).length} distinct`);
console.log(`respelled roots: ${Object.values(audit.respelled).reduce((a, b) => a + b, 0)}`);
console.log(`wrote ${outPrefix}.json and ${outPrefix}.audit.json`);
