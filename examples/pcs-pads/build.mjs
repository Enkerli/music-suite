#!/usr/bin/env node
/**
 * Build PCS Pads into ONE self-contained file, examples/pcs-pads/index.html:
 * the TypeScript bundled with esbuild (pcsSelect.ts and the protocol come in
 * from source), plus @enkerli/ui's tokens.css, inlined into the template.
 *
 *   node examples/pcs-pads/build.mjs
 *
 * Fonts are not inlined; the token stacks fall back to system faces.
 */
import { build } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");

const result = await build({
  entryPoints: [join(HERE, "src/main.ts")],
  bundle: true,
  format: "esm",
  target: "es2022",
  minify: true,
  write: false,
  logLevel: "warning",
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const tokens = readFileSync(join(ROOT, "packages/ui/tokens/tokens.css"), "utf8");
const html = readFileSync(join(HERE, "src/template.html"), "utf8")
  .replace("/*__TOKENS__*/", () => tokens)
  .replace("/*__SCRIPT__*/", () => js);
writeFileSync(join(HERE, "index.html"), html);
console.log(`wrote examples/pcs-pads/index.html (${(html.length / 1024).toFixed(1)} KB)`);
