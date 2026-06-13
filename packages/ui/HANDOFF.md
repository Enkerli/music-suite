# Design handoff — the Enkerli suite's "paper & ink" system

*For design sessions (Claude Design, Figma work, or any designer picking
this up). Everything here is source-of-truth code in this repo; the
"Claude Code hooks" sections give the exact commands a Claude Code
session runs to verify or propagate a change.*

## What this is

One design language across ~8 music apps and 3+ audio plugins (JUCE
WebViews on iPadOS/macOS — same web code as the browser apps). Warm
cream "paper" light theme is the **default design target** (Alex's
stated preference); warm dark is a first-class one-tap variant.

| Piece | File | Notes |
|---|---|---|
| Tokens | `packages/ui/tokens/tokens.css` | surfaces, ink, type, spacing, radii, motion, dimension accents, per-theme pitch-class palette |
| Components CSS | `packages/ui/tokens/components.css` | `.es-panel/.es-btn/.es-control/.es-badge/.es-section/.es-dense` … |
| Theme machinery | `packages/ui/theme.js` (+ `theme.d.ts`) | `data-theme` on `<html>`; OS pref until chosen; persisted |
| Shared components | `packages/ui/components/*.js` | `pcs-ring`, `pitch-grid`, `piano-roll`, `section` — framework-agnostic `create*(el, opts)` |
| Icons | `packages/ui/icons/*.svg` + `tools/make-icons.mjs` | one grammar: paper tile, ink glyph, ONE dimension accent per app |
| Living spec | `apps/style-gallery/index.html` | renders everything above, live theme toggle — **if it looks wrong, the tokens are wrong** |
| Requirements | `packages/ui/DESIGN.md` | a11y/personas/localization checklist per release |

## Invariants (do not break)

1. **WCAG AA on both themes, machine-checked.** Text ≥4.5:1; accent
   buttons, focus rings, `--es-border-strong`, `--es-danger`, and all 12
   pc colors ≥3:1 against `bg` AND `bg-raised`. Any token change must
   re-run the audit (hook below). The pc palette is **per-theme** for
   this reason — don't unify it back.
2. **Color is never the only channel.** Dimension hues pair with labels
   or dots; pc hues pair with note names/numbers.
3. **Border discipline**: `--es-border`/`--es-border-soft` are
   decorative; anything a user must *identify as a control* uses
   `--es-border-strong`.
4. **Touch targets ≥44px** on coarse pointers (`--es-ctl-h` scales);
   plugin UIs are stacks of `.es-section` collapsibles (AUv3 windows are
   small and fixed) with `.es-dense` for stage use.
5. **One accent per app** in icons; the family must read as a set.
6. Music-notation conventions (MSB-first bit strings, structural note
   spelling) live in `~/Desktop/music-suite/CONVENTIONS.md` — design
   artifacts that show masks or note names must follow them.

## Claude Code hooks

Run from `~/Desktop/music-suite` unless noted:

| Task | Command |
|---|---|
| Preview the system | open `apps/style-gallery/index.html` (or `npx vite apps/style-gallery`) |
| Verify contrast after ANY token change | `node packages/ui/tools/contrast-audit.mjs packages/ui/tokens/tokens.css` → must end `ALL PASS` |
| Run component tests | `npx vitest run packages/ui/components/components.test.js` |
| Regenerate icon SVGs after grammar edits | `node packages/ui/tools/make-icons.mjs` |
| Render a plugin icon PNG | `swift packages/ui/tools/render-icon.swift packages/ui/icons/<app>.svg <dest>/icon_1024.png 1024` |
| Propagate UI changes into a plugin | `node WebUI/build.mjs` in the plugin repo (`~/Desktop/progression-studio-plugin`, `~/Desktop/midicurator-plugin`) — includes a WKWebView smoke gate that must print `smoke OK` |
| Full suite test | `npx vitest run` (monorepo root) |

Plugin repos consume this package by building the webapp into a
single-file bundle; **a CSS change is not on-device until the plugin's
`build.mjs` ran and the plugin was rebuilt/reinstalled.**

## Current adopters

Migrated: ProgGenie (progression-studio), chord-dictionary, MIDIcurator,
PickPCS, exquisite-fingerings, style-gallery, all three plugin bundles.
Pending: Vane and DrawnQurve token adoption (when their UIs are next
touched — they are the palette's source, so drift is low), Serpe after
PitchFold validates the WebView pattern.

## Open design work (good Claude Design targets)

- PitchFold pad editor: entry into edit mode is unclear on iPad; PCS
  building wants a suggestions list + the shared `pcs-ring`. Output-range
  control needs DrawnQurve-style slideable touch targets.
- Arming affordance in plugins: "armed vs playing" needs more than the
  transport-bar text (pulsing play button? clip-card state?).
- Free/sync mode toggle UI (suite-wide; scheduler work lands separately).
- Icon refinement: the generated set (see `icons/`) is v1 — geometry is
  in `tools/make-icons.mjs`, regenerate cheaply.
- Manual VoiceOver/keyboard sweep (the one remaining Phase-2 a11y item).
