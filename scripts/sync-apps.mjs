#!/usr/bin/env node
/**
 * sync-apps — rebuild every suite app's web UI into docs/apps/<slug>/ so the
 * GitHub Pages showcase stays in step with the apps, wherever they're developed.
 *
 * Six apps live in this monorepo (built via npm workspaces). Four are JUCE
 * plugins in *separate* repos (PitchFold, DrawnQurve, Vane, Serpe) whose
 * WebView UIs are built/copied in. Each app keeps being developed independently;
 * running this brings its latest web build into the shared repo with one command.
 *
 *   node scripts/sync-apps.mjs              # all apps
 *   node scripts/sync-apps.mjs pitchfold serpe   # a subset by slug
 *   node scripts/sync-apps.mjs --monorepo  # only the in-repo workspace apps
 *   node scripts/sync-apps.mjs --external   # only the separate-repo plugin UIs
 *
 * External repo locations: defaults below are the maintainer's layout. Override
 * per machine with scripts/apps.local.json (gitignored), mapping slug → source
 * path, e.g. { "pitchfold": "/Users/you/code/PitchFold/Source/WebUI" }. Apps
 * whose source can't be found are skipped with a warning, so the script still
 * works for someone who only has this repo checked out.
 */
import { execFileSync } from "node:child_process";
import { existsSync, rmSync, mkdirSync, cpSync, copyFileSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const APPS_DIR = join(ROOT, "docs", "apps");
const home = (p) => (typeof p === "string" ? p.replace(/^~(?=\/|$)/, homedir()) : p);

/** The showcase manifest. `kind` decides how each app is built/copied. */
const MANIFEST = [
  // ── In this monorepo (npm workspaces) ──
  { slug: "proggenie",        title: "Progression Studio",   kind: "workspace", workspace: "progression-studio" },
  { slug: "midicurator",      title: "MIDIcurator",          kind: "workspace", workspace: "midi-curator" },
  { slug: "pickpcs",          title: "PickPCS",              kind: "workspace", workspace: "concentric-pcs-picker" },
  { slug: "chord-dictionary", title: "Chord Dictionary",     kind: "workspace", workspace: "chord-dictionary" },
  { slug: "exquisite",        title: "Exquisite Fingerings", kind: "workspace", workspace: "exquisite-fingerings" },
  { slug: "style-gallery",    title: "Style Gallery",        kind: "vite",      dir: join(ROOT, "apps", "style-gallery") },
  // Consolidated plugin WebUIs: source lives here; each JUCE plugin (separate
  // repo) reads the same source via a configurable CMake path. esbuild emits
  // stable bundle.js/index.html the plugin embeds by name.
  { slug: "serpe",            title: "Serpe",                kind: "esbuild",   dir: join(ROOT, "apps", "serpe"), dist: "dist" },
  { slug: "pitchfold",        title: "PitchFold",            kind: "esbuild",   dir: join(ROOT, "apps", "pitchfold"), dist: "dist" },
  // ── Separate repos (JUCE plugins; we deploy their WebView UIs) ──
  { slug: "drawnqurve", title: "DrawnQurve", kind: "vite",    dir: "~/DrawnQurve/webapp", external: true },
  { slug: "vane",       title: "Vane",       kind: "static-file", file: "~/Vane/Source/WebUI/index.html", external: true },
];

// Per-machine source overrides for the external apps.
let overrides = {};
const localCfg = join(ROOT, "scripts", "apps.local.json");
if (existsSync(localCfg)) {
  try { overrides = JSON.parse(readFileSync(localCfg, "utf8")); }
  catch (e) { console.warn(`! could not parse ${localCfg}: ${e.message}`); }
}
const sourcePath = (app) => home(overrides[app.slug] ?? app.file ?? app.dir);

function run(cmd, args, cwd) {
  execFileSync(cmd, args, { cwd, stdio: "inherit" });
}

function build(app) {
  const dest = join(APPS_DIR, app.slug);
  const src = sourcePath(app);

  if (app.external && !existsSync(src)) {
    console.warn(`⤬ ${app.slug}: source not found at ${src} — skipping (set scripts/apps.local.json)`);
    return false;
  }

  switch (app.kind) {
    case "workspace":
      run("npm", ["run", "build", "-w", app.workspace, "--", "--base=./", "--outDir", dest, "--emptyOutDir"], ROOT);
      break;
    case "vite":
      run("npx", ["vite", "build", "--base=./", "--outDir", dest, "--emptyOutDir"], src);
      break;
    case "esbuild": // build in place, then copy the dist dir
      run("npm", ["run", "build"], src);
      rmSync(dest, { recursive: true, force: true });
      mkdirSync(dest, { recursive: true });
      cpSync(join(src, app.dist), dest, { recursive: true });
      break;
    case "static-dir":
      rmSync(dest, { recursive: true, force: true });
      mkdirSync(dest, { recursive: true });
      cpSync(src, dest, { recursive: true });
      break;
    case "static-file":
      rmSync(dest, { recursive: true, force: true });
      mkdirSync(dest, { recursive: true });
      copyFileSync(src, join(dest, "index.html"));
      break;
    default:
      throw new Error(`unknown kind: ${app.kind}`);
  }
  console.log(`✓ ${app.slug} → docs/apps/${app.slug}/`);
  return true;
}

// ── CLI ──
const args = process.argv.slice(2);
let apps = MANIFEST;
if (args.includes("--monorepo")) apps = apps.filter((a) => !a.external);
else if (args.includes("--external")) apps = apps.filter((a) => a.external);
const slugs = args.filter((a) => !a.startsWith("--"));
if (slugs.length) apps = apps.filter((a) => slugs.includes(a.slug));

if (!apps.length) { console.error("No apps matched."); process.exit(1); }
console.log(`Syncing ${apps.length} app(s) into docs/apps/ …\n`);
let ok = 0, skipped = 0;
for (const app of apps) {
  try { build(app) ? ok++ : skipped++; }
  catch (e) { console.error(`✗ ${app.slug} failed: ${e.message}`); process.exitCode = 1; }
}
console.log(`\nDone: ${ok} built, ${skipped} skipped. Commit docs/apps/ to publish.`);
console.log("Screenshots (docs/assets/screenshots/<slug>.png) are refreshed manually.");
