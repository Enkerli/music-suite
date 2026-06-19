# Suite scripts

## `sync-apps.mjs` — publish every app's web build into the showcase

The GitHub Pages site (`docs/`) shows all ten suite apps, each opening a live
build under `docs/apps/<slug>/`. Those apps are developed in **different
places**:

- **Six live in this monorepo** (`apps/*`), built via npm workspaces.
- **Four are JUCE plugins in separate repos** — PitchFold, DrawnQurve, Vane,
  Serpe — whose WebView UIs are built (or copied, for the build-free ones) into
  the showcase.

`sync-apps` is the one command that reconciles the showcase with whatever each
app currently is, so independent work on any app can flow into the shared repo.

```bash
node scripts/sync-apps.mjs            # rebuild & copy ALL apps
npm run sync-apps                     # same, via package.json
node scripts/sync-apps.mjs --monorepo # only the in-repo workspace apps
node scripts/sync-apps.mjs --external # only the separate-repo plugin UIs
node scripts/sync-apps.mjs serpe pickpcs   # just these slugs
```

Each app builds with a **relative base** (`--base=./`) so it serves correctly
from its `…/apps/<slug>/` subpath. After running, commit `docs/apps/` to
publish (Pages redeploys on push to `main`).

### Pointing at the external repos

The four plugin repos can live anywhere. Defaults in the manifest are the
maintainer's layout; override per machine with **`scripts/apps.local.json`**
(gitignored) — copy `apps.local.json.example` and edit the paths. Apps whose
source isn't found are skipped with a warning, so the script still runs for
someone who only has this repo.

### How an independently-developed app contributes

1. Develop the app in its own repo as usual (it stays the source of truth).
2. Make sure it has a buildable/standalone web UI (a workspace app, a Vite or
   esbuild WebUI, or a self-contained `index.html`).
3. Add or confirm its entry in the `MANIFEST` in `sync-apps.mjs` (slug, `kind`,
   and source `dir`/`file`/`workspace`).
4. Run `node scripts/sync-apps.mjs <slug>`, refresh its screenshot
   (`docs/assets/screenshots/<slug>.png`), and commit `docs/`.

That's the whole contract: build relative, land in `docs/apps/<slug>/`.

### What it does *not* do

- It doesn't capture screenshots (`docs/assets/screenshots/<slug>.png` are
  refreshed manually — they're 16:10 PNGs).
- It doesn't edit `docs/index.html` cards — adding a brand-new app to the grid
  is a one-time manual card + icon.
