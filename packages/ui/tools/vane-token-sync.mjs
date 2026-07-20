#!/usr/bin/env node
/**
 * Vane token-sync check (design audit 2026-07-19, D4/F5).
 *
 * Vane inlines its --vn-* literals on purpose (the file ships at three
 * relative depths, so a <link> to tokens.css breaks silently — see the
 * comment block in apps/vane/index.html). The convergence pass synced those
 * literals byte-for-byte to the es tokens and left a comment contract
 * ("if tokens.css changes, re-sync"). This script turns that comment into a
 * machine check: it fails when any mapped literal drifts from tokens.css.
 *
 * Run:  node packages/ui/tools/vane-token-sync.mjs
 * (alongside the contrast audit — both are wired as `npm run audit-ui`).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const tokensCss = readFileSync(join(here, "..", "tokens", "tokens.css"), "utf8");
const vaneHtml = readFileSync(join(here, "..", "..", "..", "apps", "vane", "index.html"), "utf8");

// The documented mapping (apps/vane/index.html comment block):
// vn-panel2 and vn-field both fold into es-bg-sunken; muted-2 is fg-faint.
const MAP = {
  "--vn-bg": "--es-bg",
  "--vn-panel": "--es-bg-raised",
  "--vn-panel2": "--es-bg-sunken",
  "--vn-field": "--es-bg-sunken",
  "--vn-line": "--es-border",
  "--vn-line-soft": "--es-border-soft",
  "--vn-text": "--es-fg",
  "--vn-text-2": "--es-fg-2",
  "--vn-muted": "--es-fg-muted",
  "--vn-muted-2": "--es-fg-faint",
  "--vn-breath": "--es-dim-breath",
  "--vn-breath-tint": "--es-dim-breath-tint",
  "--vn-expr": "--es-dim-expr",
  "--vn-expr-tint": "--es-dim-expr-tint",
  "--vn-pressure": "--es-dim-pressure",
  "--vn-pressure-tint": "--es-dim-pressure-tint",
  "--vn-slide": "--es-dim-slide",
  "--vn-slide-tint": "--es-dim-slide-tint",
  "--vn-bend": "--es-dim-bend",
  "--vn-bend-tint": "--es-dim-bend-tint",
  "--vn-vel": "--es-dim-vel",
};

/** All `--name: value` pairs in a CSS string → Map (later wins). */
const pairs = (css) =>
  new Map([...css.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)[;}]/g)]
    .map((m) => [m[1], m[2].trim()]));

/** Split CSS into { selector, body } rules (flat; @media bodies recursed). */
function rules(css, out = []) {
  const re = /([^{}]+)\{/g;
  let m, depth, start;
  while ((m = re.exec(css))) {
    const sel = m[1].trim();
    start = re.lastIndex; depth = 1;
    let i = start;
    for (; i < css.length && depth; i++) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}") depth--;
    }
    const body = css.slice(start, i - 1);
    if (sel.startsWith("@media")) rules(body, out).forEach((r) => { r.media = sel; });
    else out.push({ selector: sel, body, media: null });
    re.lastIndex = i;
  }
  return out;
}

/** Merge declarations from every rule matching a theme scope. */
function themePairs(css, theme) {
  const merged = new Map();
  for (const r of rules(css)) {
    const dark = /data-theme="dark"/.test(r.selector) ||
                 (r.media && /prefers-color-scheme:\s*dark/.test(r.media));
    const light = !dark && (/:root/.test(r.selector) || /data-theme="light"/.test(r.selector));
    if (r.media && !dark) continue; // e.g. touch-target media blocks
    if ((theme === "dark" && dark) || (theme === "light" && light))
      for (const [k, v] of pairs(r.body)) merged.set(k, v);
  }
  return merged;
}

const esLight = themePairs(tokensCss, "light");
const esDark = themePairs(tokensCss, "dark");
// Vane: only its <style> blocks (skip scripts/markup); dark restates a subset.
const vaneCss = [...vaneHtml.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n");
const vnLight = themePairs(vaneCss, "light");
const vnDark = themePairs(vaneCss, "dark");

let fail = 0;
const check = (theme, vn, es) => {
  for (const [vnName, esName] of Object.entries(MAP)) {
    const v = vn.get(vnName);
    if (v === undefined) continue; // dark restates only a subset — fine
    const e = es.get(esName) ?? esLight.get(esName); // dark falls back to light for invariants
    if (e === undefined) { console.log(`?? ${theme} ${esName} missing from tokens.css`); fail++; continue; }
    const same = v.toLowerCase() === e.toLowerCase();
    console.log(`${same ? "ok " : "DRIFT"} ${theme.padEnd(5)} ${vnName} = ${v} ${same ? "==" : "!="} ${esName} = ${e}`);
    if (!same) fail++;
  }
};
check("light", vnLight, esLight);
check("dark", vnDark, esDark);

if (fail) {
  console.error(`\n${fail} drifted value(s). Re-sync apps/vane/index.html's literals to packages/ui/tokens/tokens.css (see its comment block for the mapping).`);
  process.exit(1);
}
console.log("\nVane literals in sync with tokens.css.");
