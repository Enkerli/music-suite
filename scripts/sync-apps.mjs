#!/usr/bin/env node
/**
 * sync-apps — rebuild every suite app's web UI into docs/apps/<slug>/ so the
 * GitHub Pages showcase stays in step with the apps, wherever they're developed.
 *
 * Every app's source lives in this monorepo under apps/ (the four plugin
 * WebUIs — PitchFold, DrawnQurve, Vane, Serpe — were consolidated here; their
 * JUCE repos read them at CMake time). CI runs this with --monorepo on every
 * deploy, so pushing source is enough; run it locally to commit matching builds.
 * An entry marked `external: true` (none today) is source kept outside the repo,
 * skipped when not found.
 *
 *   node scripts/sync-apps.mjs              # all apps
 *   node scripts/sync-apps.mjs pitchfold serpe   # a subset by slug
 *   node scripts/sync-apps.mjs --monorepo  # only the in-repo workspace apps
 *   node scripts/sync-apps.mjs --external   # only the separate-repo plugin UIs
 *
 * Per-machine overrides: scripts/apps.local.json (gitignored) maps slug →
 * source path, e.g. { "pitchfold": "/Users/you/code/PitchFold/Source/WebUI" },
 * to build a slug from somewhere else.
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
  // DrawnQurve: consolidated the plugin's maintained Source/WebUI (esbuild). The
  // older top-level webapp/ (a vite port) was parked upstream, so the site now
  // tracks the real app instead.
  { slug: "drawnqurve",       title: "DrawnQurve",           kind: "esbuild",   dir: join(ROOT, "apps", "drawnqurve"), dist: "dist" },
  // Vane: UI in-repo (apps/vane). esbuild bundles the standalone Web Audio synth
  // (synth.js host + worklet.js + committed vane-dsp.wasm) alongside index.html;
  // the plugin (separate repo) reads index.html via a configurable CMake path and
  // ignores synth.js (it makes sound in C++).
  { slug: "vane",             title: "Vane",                 kind: "esbuild",   dir: join(ROOT, "apps", "vane"), dist: "dist" },
  // Suite Workspace: the single-page, movable-module projection of the control
  // & interop plane (docs/CONTROL_PLANE.md). In-repo only (no plugin twin).
  { slug: "workspace",        title: "Suite Workspace",      kind: "esbuild",   dir: join(ROOT, "apps", "workspace"), dist: "dist" },
  // Twirl: a gesture toy, one self-contained HTML file (no build step, no
  // dependencies). In-repo only for now; a plugin/standalone twin is on its
  // roadmap (apps/twirl/ROADMAP.md).
  { slug: "twirl",            title: "Twirl",                kind: "static-file", file: join(ROOT, "apps", "twirl", "index.html") },
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
