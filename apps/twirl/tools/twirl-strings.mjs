#!/usr/bin/env node
// Lists every user-facing string in Twirl's index.html (PLAN.md, phase 2a):
// the page's text, its title, aria-label, placeholder and alt attributes,
// and the script's string and template literals that read as words. A
// template literal's ${…} become {0}, {1}… (or {name} for a plain name), as
// the translation table keys them. Prints JSON: [{ key, kind, line }].
//
//   node apps/twirl/tools/twirl-strings.mjs [--keys]   (--keys: the keys only, one a line)
//   node apps/twirl/tools/twirl-strings.mjs --inline   (copies i18n/fr.json into the page)
//
// Blocks marked data-i18n="html" are one key each: their markup, whitespace
// folded (the page translates them whole: French puts words in its own order).
//
// It casts a wide net; what isn't for people (CSS, selectors, storage keys,
// URLs, code) is filtered out below. What the page actually shows is
// checked by the test that renders it in French and looks for English left.
import { readFileSync, writeFileSync } from "node:fs";

const PAGE = new URL("../index.html", import.meta.url);
let src = readFileSync(PAGE, "utf8");
if (process.argv.includes("--inline")) {
  const fr = JSON.parse(readFileSync(new URL("../i18n/fr.json", import.meta.url), "utf8"));
  const json = JSON.stringify(fr).replace(/<\//g, "<\\/");
  const re = /(<script type="application\/json" id="twirl-fr">)[\s\S]*?(<\/script>)/;
  if (!re.test(src)) throw new Error("no twirl-fr block in the page");
  src = src.replace(re, (_, a, b) => a + json + b);
  writeFileSync(PAGE, src);
  console.log(`${Object.keys(fr).length} French strings in the page`);
  process.exit(0);
}
const lineOf = (i) => src.slice(0, i).split("\n").length;
const out = new Map();
const decode = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
const add = (key, kind, at) => {
  key = key.replace(/\s+/g, " ").trim();
  if (kind !== "html" && kind !== "js" && kind !== "template") key = decode(key);   // as the page shows it
  if (!(kind === "text" ? /[A-Za-z]{2}/.test(key) && !/^&\w+;$/.test(key) : isWords(key))) return;   // the page's own text: every word
  if (!out.has(key)) out.set(key, { key, kind, line: lineOf(at) });
};

/** Reads as words for people: letters and (a space, or a capital), not code. */
function isWords(s) {
  if (!/[A-Za-z]{2}/.test(s)) return false;
  if (/^[a-z][a-zA-Z0-9]*$/.test(s)) return false;                         // an identifier
  if (/^[a-z0-9:_.\-/#*[\]="' ]+$/.test(s) && !/ [a-z]+ /.test(` ${s} `.replace(/^\s*\S+\s*$/, ""))) {
    if (!/\s/.test(s)) return false;                                        // a key, a selector, a class list
  }
  if (/^(https?:|\.\/|#|\.|--|var\(|rgba?\(|url\(|data:|@media|::)/.test(s)) return false;
  if (/(^|[;{]\s*)(display|color|margin|padding|width|height|font|background|border|position|top|left|right|bottom|opacity|transform|z-index|gap|flex|grid|cursor|transition|animation|stroke|fill)(-[a-z]+)*\s*:/.test(s)) return false;   // CSS
  if (/^[\w-]+(\s+[\w-]+)*$/.test(s) && !/[A-Z]/.test(s) && s.split(" ").every((w) => /^[a-z0-9-]+$/.test(w)) && s.split(" ").length > 1 && s.includes("-")) return false; // class lists
  if (/=>|\bfunction\b|\breturn\b|\.\w+\(|===|&&/.test(s)) return false;     // code
  if (/^twirl:|^enkerli\.|^aria-|^data-/.test(s)) return false;
  return true;
}

// The page: everything before the first <script> that isn't the head's.
const bodyStart = src.indexOf("<body");
const scriptAt = src.indexOf("<script>", bodyStart) >= 0 ? src.indexOf("<script>", bodyStart) : src.length;
let html = src.slice(0, scriptAt).replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, (m) => " ".repeat(m.length));   // the translations, the inlined UPI parser
for (const m of html.matchAll(/<(\w+)[^>]*data-i18n="html"[^>]*>([\s\S]*?)<\/\1>/g)) {
  const key = m[2].replace(/\s+/g, " ").trim();
  if (!out.has(key)) out.set(key, { key, kind: "html", line: lineOf(m.index) });
  html = html.slice(0, m.index) + m[0].replace(m[2], " ".repeat(m[2].length)) + html.slice(m.index + m[0].length);
}
add(/<title>([^<]*)<\/title>/.exec(src)[1], "title", src.indexOf("<title>"));
for (const m of html.slice(bodyStart).matchAll(/>([^<>]+)</g)) add(m[1], "text", bodyStart + m.index);
for (const m of html.matchAll(/\b(title|aria-label|placeholder|alt|content)="([^"]*)"/g)) {
  if (m[1] === "content" && !/name="description"/.test(html.slice(Math.max(0, m.index - 60), m.index))) continue;
  add(m[2], m[1], m.index);
}

// The script: string literals ("…", '…') and template literals (`…${x}…`).
const js = src.slice(scriptAt);
const base = scriptAt;
let i = 0;
while (i < js.length) {
  const c = js[i];
  if (c === "/" && js[i + 1] === "/") { i = js.indexOf("\n", i); if (i < 0) break; continue; }
  if (c === "/" && js[i + 1] === "*") { i = js.indexOf("*/", i + 2) + 2; continue; }
  if (c === '"' || c === "'") {
    let j = i + 1, s = "";
    while (j < js.length && js[j] !== c) { if (js[j] === "\\") { s += js[j + 1] === "n" ? "\n" : js[j + 1]; j += 2; } else s += js[j++]; }
    if (!/^\s*(querySelector|getElementById|matches|closest)/.test(js.slice(Math.max(0, i - 20), i).split("(").pop())) add(s, "js", base + i);
    i = j + 1; continue;
  }
  if (c === "`") {
    let j = i + 1, s = "", n = 0;
    while (j < js.length && js[j] !== "`") {
      if (js[j] === "\\") { s += js[j + 1]; j += 2; continue; }
      if (js[j] === "$" && js[j + 1] === "{") {
        let depth = 1, k = j + 2;
        while (k < js.length && depth) { if (js[k] === "{") depth++; else if (js[k] === "}") depth--; k++; }
        const expr = js.slice(j + 2, k - 1).trim();
        s += /^[A-Za-z_$][\w$]*$/.test(expr) ? `{${expr}}` : `{${n}}`;
        n++; j = k; continue;
      }
      s += js[j++];
    }
    add(s, "template", base + i);
    i = j + 1; continue;
  }
  i++;
}

const list = [...out.values()];
if (process.argv.includes("--keys")) console.log(list.map((e) => e.key).join("\n"));
else console.log(JSON.stringify(list, null, 1));
