#!/usr/bin/env node
/**
 * check-inventory — keep docs/INVENTORY.md honest about what actually exists.
 *
 * INVENTORY.md says of itself: "if it isn't listed here, it won't get
 * documented — update this file in the same commit that adds or removes a
 * deliverable." That rule lapsed anyway (the 2026-07-22 quality audit found it
 * claiming 13 packages / 15 Workspace modules when the real counts were 14 and
 * 18 — exactly the KT-item-8 additions). A rule nothing enforces is a wish, so
 * this counts the real things and fails if the doc disagrees.
 *
 *   node scripts/check-inventory.mjs        # exits 1 on drift, prints a diff
 *
 * Deliberately counts only what can be counted UNAMBIGUOUSLY from source:
 * package directories, `MODULES` keys, and the CLI's dispatch cases. Prose is
 * left to humans; numbers are not.
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

const problems = [];
const check = (label, actual, claimed, hint) => {
  if (actual === claimed) { console.log(`  ✓ ${label}: ${actual}`); return; }
  problems.push(`${label}: INVENTORY.md says ${claimed}, reality is ${actual}${hint ? ` — ${hint}` : ""}`);
  console.log(`  ✗ ${label}: doc says ${claimed}, actual ${actual}`);
};

const inventory = read("docs/INVENTORY.md");
const claimed = (re, what) => {
  const m = inventory.match(re);
  if (!m) { problems.push(`could not find the ${what} count line in INVENTORY.md (heading reworded?)`); return null; }
  return Number(m[1]);
};

console.log("check-inventory — docs/INVENTORY.md vs the tree\n");

// 1. Packages: every directory under packages/ that is a real workspace member.
const packages = readdirSync(join(ROOT, "packages"), { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(ROOT, "packages", d.name, "package.json")))
  .map((d) => d.name);
check("packages", packages.length, claimed(/## Packages \((\d+),/, "packages"),
  `packages/: ${packages.join(", ")}`);

// 2. Workspace modules: keys of the MODULES registry in apps/workspace/modules.js.
const modulesSrc = read("apps/workspace/modules.js");
const registry = modulesSrc.slice(modulesSrc.indexOf("export const MODULES"));
const moduleKeys = [...registry.matchAll(/^\s{2}"([a-z0-9-]+)":\s*\{/gm)].map((m) => m[1]);
check("workspace modules", moduleKeys.length, claimed(/## Workspace modules \((\d+),/, "module"),
  `MODULES keys: ${moduleKeys.join(", ")}`);
// INVENTORY lists modules by their human titles, not their registry keys.
const moduleTitles = [...registry.matchAll(/title:\s*"([^"]+)"/g)].map((m) => m[1]);

// 3. CLI commands: the dispatch cases in packages/cli/src/cli.ts.
const cliSrc = read("packages/cli/src/cli.ts");
const commands = [...new Set([...cliSrc.matchAll(/^\s*case "([a-z]+)":/gm)].map((m) => m[1]))];
check("cli commands", commands.length, claimed(/## `msuite` CLI \((\d+) commands\)/, "CLI command"),
  `cases: ${commands.join(", ")}`);

// Names, not just counts — a swap keeps the number and still drifts.
for (const [label, names] of [["package", packages], ["module", moduleTitles], ["command", commands]]) {
  const missing = names.filter((n) => !inventory.includes(n));
  if (missing.length) problems.push(`${label}(s) missing from INVENTORY.md by name: ${missing.join(", ")}`);
}

if (problems.length) {
  console.error("\nINVENTORY.md is out of sync:\n" + problems.map((p) => `  • ${p}`).join("\n"));
  console.error("\nUpdate docs/INVENTORY.md in this commit — that's the rule the file states for itself.");
  process.exit(1);
}
console.log("\nINVENTORY.md matches the tree.");
