# Suite scripts

There are two halves to the showcase site. **`sync-apps`** rebuilds the *apps*
(the code under `docs/apps/<slug>/`). **`build-site`** rebuilds the *words* (the
frontpage and doc pages) from a single editable file. They're independent: edit
copy without touching builds, or vice versa.

## `docs/build-site.mjs` — all the site's words live in `docs/site.md`

Every piece of text on the site — hero, app-card blurbs, section headings, the
hosting note, the footer, and the full body of each documentation page — lives
in **`docs/site.md`**. Edit prose there, then:

```bash
npm run build-site        # = node docs/build-site.mjs
```

…which regenerates `docs/index.html` and `docs/content/<slug>.md`. The HTML
*structure* stays in the generator template; only the *words* come from
`site.md`. So `index.html` and `content/*.md` are **generated artifacts** — don't
hand-edit them; edit `site.md` and rebuild.

`site.md` is plain Markdown split by `<!-- kind … -->` marker lines (one per
block: hero, card, doclink, page, …). Rewrite any block's text freely; just
keep the marker lines. Re-ordering app cards = moving a whole `card` block.
Adding a brand-new doc page also needs a `doclink` block and an entry in
`doc.html`'s page whitelist.

## `sync-apps.mjs` — publish every app's web build into the showcase

The GitHub Pages site (`docs/`) shows twelve suite apps, each opening a live
build under `docs/apps/<slug>/`. **All twelve have their source in this repo**
(`apps/*`): the six original webapps, the four plugin WebUIs that were
consolidated here (Serpe, PitchFold, Vane, DrawnQurve), the Workspace, and
Twirl. The plugin repos read their WebUI from here at CMake time.

`sync-apps` is the one command that rebuilds those web builds into `docs/apps/`.
CI runs it on every deploy (`deploy-pages.yml`), so pushing source is enough to
update the site; run it locally to commit matching builds or to check one.

```bash
node scripts/sync-apps.mjs            # rebuild & copy ALL apps
npm run sync-apps                     # same, via package.json
node scripts/sync-apps.mjs twirl serpe     # just these slugs
node scripts/sync-apps.mjs --monorepo # the apps NOT marked `external` (today: all of them; what CI runs)
node scripts/sync-apps.mjs --external # the apps marked `external` (today: none)
```

`kind` in the `MANIFEST` decides how each app is built: `workspace` (an npm
workspace's own build), `vite`, `esbuild` (built in place, `dist/` copied),
`static-dir`, or `static-file` (one self-contained HTML file copied as
`index.html`, which is Twirl). Each app builds with a **relative base** so it
serves correctly from its `…/apps/<slug>/` subpath.

### Building from somewhere else

`scripts/apps.local.json` (gitignored; copy `apps.local.json.example`) maps a
slug to source elsewhere on your machine, for example to try a WebUI from a
plugin repo's own checkout. An entry marked `external: true` whose source isn't
found is skipped with a warning, so the script still runs for someone who only
has this repo. No entry is marked external today.

### Adding an app to the site

1. Give it a buildable web UI under `apps/<name>/` (a workspace app, a Vite or
   esbuild UI, or a self-contained `index.html`).
2. Add its entry to the `MANIFEST` in `sync-apps.mjs` (slug, `kind`, and
   source `dir`/`file`/`workspace`).
3. Add a `card` block to `docs/site.md` and an icon at
   `docs/assets/icons/<slug>.svg`, then `npm run build-site`.
4. Run `node scripts/sync-apps.mjs <slug>`, add its screenshot
   (`docs/assets/screenshots/<slug>.png`, a 16:10 PNG at 2560×1600), and
   commit `docs/`.

That's the whole contract: build relative, land in `docs/apps/<slug>/`.

### What it does *not* do

- It doesn't capture screenshots: `docs/assets/screenshots/` and
  `docs/assets/guide/` are refreshed by hand.
- It doesn't add cards: the frontpage grid comes from `card` blocks in
  `docs/site.md` (see above).
