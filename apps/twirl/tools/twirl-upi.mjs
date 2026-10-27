#!/usr/bin/env node
// Inlines @enkerli/upi's parseUPI into Twirl's page (accent patterns, section
// 6b): Twirl is one file, and the plugin copies only that file, so the parser
// rides inside it as <script id="twirl-upi">, a minified bundle defining the
// global UPI. Run after changing packages/upi; a test fails if the page's copy
// differs from a fresh build.
//
//   node apps/twirl/tools/twirl-upi.mjs           (writes the page)
//   node apps/twirl/tools/twirl-upi.mjs --check   (exit 1 if it would change it)
import { readFileSync, writeFileSync } from "node:fs";
import { buildSync } from "esbuild";

const PAGE = new URL("../index.html", import.meta.url);
const ENTRY = new URL("../../../packages/upi/src/upi.js", import.meta.url).pathname;

/** The bundle as the page holds it. */
export function bundle() {
  const out = buildSync({
    stdin: { contents: `export { parseUPI } from ${JSON.stringify(ENTRY)};`, resolveDir: "/", loader: "js" },
    bundle: true, minify: true, format: "iife", globalName: "UPI", legalComments: "none", write: false, target: "es2020",
  });
  return out.outputFiles[0].text.trim().replace(/<\//g, "<\\/");
}

const RE = /(<script id="twirl-upi">)[\s\S]*?(<\/script>)/;
export function inlined(src = readFileSync(PAGE, "utf8")) {
  const m = RE.exec(src);
  if (!m) throw new Error("no twirl-upi block in the page");
  return m[0].slice(m[1].length, -m[2].length);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const src = readFileSync(PAGE, "utf8"), js = bundle();
  if (process.argv.includes("--check")) process.exit(inlined(src) === js ? 0 : 1);
  writeFileSync(PAGE, src.replace(RE, (_, a, b) => a + js + b));
  console.log(`parseUPI inlined: ${js.length} bytes`);
}
