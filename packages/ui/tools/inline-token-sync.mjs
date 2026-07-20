#!/usr/bin/env node
/**
 * Inline token-sync check (design audit 2026-07-19, D4/F5 — generalized).
 *
 * Vane inlines its --vn-* literals on purpose (the file ships at three
 * relative depths, so a <link> to tokens.css breaks silently — see the
 * comment block in apps/vane/index.html). The convergence pass synced those
 * literals byte-for-byte to the es tokens and left a comment contract
 * ("if tokens.css changes, re-sync"). This script turns that comment into a
 * machine check: it fails when any mapped literal drifts from tokens.css.
 *
 * Vane inlines --vn-* literals in its single-file HTML; PitchFold and
 * DrawnQurve inline PAPER/PAPER_DARK objects in design/tokens.jsx (SVG
 * attrs need raw hex). All three carried "re-sync by hand" comment
 * contracts; this checks every one against tokens.css.
 *
 * Run:  node packages/ui/tools/inline-token-sync.mjs
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

/** Split CSS into flat { selector, body, media } rules (comments stripped;
 *  @media bodies recursed with the media condition attached to ONLY the
 *  rules inside it — an earlier version stamped it on every accumulated
 *  rule, silently emptying the light map and making the check vacuous). */
function rules(css) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out = [];
  const walk = (chunk, media) => {
    const re = /([^{}]+)\{/g;
    let m;
    while ((m = re.exec(chunk))) {
      const sel = m[1].trim();
      let depth = 1, i = re.lastIndex;
      for (; i < chunk.length && depth; i++) {
        if (chunk[i] === "{") depth++;
        else if (chunk[i] === "}") depth--;
      }
      const body = chunk.slice(re.lastIndex, i - 1);
      if (sel.startsWith("@media")) walk(body, sel);
      else out.push({ selector: sel, body, media });
      re.lastIndex = i;
    }
  };
  walk(clean, null);
  return out;
}

/** Merge declarations from every rule matching a theme scope. */
function themePairs(css, theme) {
  const merged = new Map();
  for (const r of rules(css)) {
    const dark = /data-theme="dark"/.test(r.selector) ||
                 (r.media != null && /prefers-color-scheme:\s*dark/.test(r.media));
    const light = !dark && (/:root/.test(r.selector) || /data-theme="light"/.test(r.selector));
    if (r.media != null && !dark) continue; // touch-target / reduced-motion blocks
    if ((theme === "dark" && dark) || (theme === "light" && light))
      for (const [k, v] of pairs(r.body)) merged.set(k, v);
  }
  return merged;
}

// Guard against the vacuous-pass failure mode: if a side of the comparison
// parsed to nothing, that is a FAILURE of this script, not a pass.
function assertNonEmpty(name, map) {
  if (map.size === 0) { console.error(`?? ${name} parsed to 0 declarations — parser bug or file moved`); process.exit(2); }
}

const esLight = themePairs(tokensCss, "light");
const esDark = themePairs(tokensCss, "dark");
assertNonEmpty("tokens.css light", esLight);
assertNonEmpty("tokens.css dark", esDark);
// Vane: only its <style> blocks (skip scripts/markup); dark restates a subset.
const vaneCss = [...vaneHtml.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n");
const vnLight = themePairs(vaneCss, "light");
const vnDark = themePairs(vaneCss, "dark");
assertNonEmpty("Vane light", vnLight);
assertNonEmpty("Vane dark", vnDark);

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

// ── PitchFold + DrawnQurve: PAPER/PAPER_DARK object literals ────────────────
const PAPER_MAP = {
  bg: "--es-bg", card: "--es-bg-raised", bgDeep: "--es-bg-sunken",
  rule: "--es-border", ruleFaint: "--es-border-soft",
  ink: "--es-fg", ink70: "--es-fg-2", ink50: "--es-fg-muted", ink30: "--es-fg-faint",
};
function objLiteral(src, name) {
  const m = src.match(new RegExp(name + "\\s*=\\s*\\{"));
  if (!m) return null;
  const start = src.indexOf("{", m.index);
  const end = src.indexOf("};", start);
  const body = src.slice(start + 1, end);
  return new Map([...body.matchAll(/(\w+)\s*:\s*'(#[0-9a-fA-F]{3,6})'/g)].map((x) => [x[1], x[2]]));
}
for (const app of ["pitchfold", "drawnqurve"]) {
  const src = readFileSync(join(here, "..", "..", "..", "apps", app, "design", "tokens.jsx"), "utf8");
  for (const [objName, es, theme] of [["const PAPER", esLight, "light"], ["const PAPER_DARK", esDark, "dark"]]) {
    const obj = objLiteral(src, objName);
    if (!obj) { console.log(`?? ${app} ${objName} not found`); fail++; continue; }
    for (const [key, esName] of Object.entries(PAPER_MAP)) {
      const v = obj.get(key);
      if (v === undefined) continue;
      const e = es.get(esName) ?? esLight.get(esName);
      const same = v.toLowerCase() === (e ?? "").toLowerCase();
      console.log(`${same ? "ok " : "DRIFT"} ${app.padEnd(10)} ${theme.padEnd(5)} ${key} = ${v} ${same ? "==" : "!="} ${esName} = ${e}`);
      if (!same) fail++;
    }
  }
}

if (fail) {
  console.error(`\n${fail} drifted value(s). Re-sync the app's inlined literals (Vane index.html / <app>/design/tokens.jsx) to packages/ui/tokens/tokens.css (see its comment block for the mapping).`);
  process.exit(1);
}
console.log("\nAll inlined token copies (Vane · PitchFold · DrawnQurve) in sync with tokens.css.");
