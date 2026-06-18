# Exquisite Fingerings — design handoff

*For the planned Claude Design pass. Prepared 2026-06-17. No code has been
changed; this is a brief.*

## TL;DR

Exquisite Fingerings is the suite's **Exquis-controller fingering explorer**.
It works, and it already pulls the suite's colour tokens — but it's the app
that has drifted furthest from the rest of the family: its own ~490-line
component CSS, a bespoke hex SVG renderer (not the shared grid), a dense
collapsible-sidebar layout unlike any sibling, no theme toggle, and **no
square-grid view** even though every other grid in the suite now has one. The
trigger for this brief: a user went looking for the **▦ square / ⬡ hex** switch
they expected (it exists in ProgGenie and Chord Dictionary) and there's nothing
to find here.

## What the app does

A tool for working out **hand fingerings** on the Intuitive Instruments
**Exquis** hex controller. You pick a chord (root + quality), see it on an
accurate Exquis hex grid, assign finger numbers (1–5, left/right), score the
ergonomics, save fingering patterns, and drive a real Exquis over MIDI (SysEx).
Controls live in a left sidebar of collapsible sections:

- **Chord Fingering Capture** — root, quality, hand, "Start Capture"
- **Advanced: Geometric Analysis** — suggestion engine, hand size
- **Fingering Patterns** — save / load named patterns
- **Advanced: Manual Fingering & Scales** — finger buttons, key, scale/chord
  type, custom pitch classes, hand-size preset, fingering type
- **Display Options** — base MIDI, **Portrait / Landscape** orientation
  (both hex), label mode (pitch-class / note / MIDI)
- **MIDI I/O** — device select, hold-notes toggle

Screenshots: [`design-handoff/light.png`](docs-md/design-handoff/light.png) ·
[`design-handoff/dark.png`](docs-md/design-handoff/dark.png).

## What's already consistent with the suite

Worth knowing so the designer doesn't re-solve solved problems:

- It imports **`@enkerli/ui/tokens.css`** and aliases the paper-&-ink tokens
  (`--bg: var(--es-bg)`, `--ink: var(--es-fg)`, `--primary: var(--es-accent)`,
  …). So colours, surfaces, and borders already track the suite.
- The pads use the suite's canonical **`pitch-class-colors`** (`padColor` /
  `padInk`) — the same chromatic colours as PickPCS and the Style Gallery.
- Because the tokens carry a dark palette, **dark mode largely works for free**
  (see `dark.png` — the sidebar and canvas adapt; pads keep their fixed
  rainbow). The `/* Dark mode (future) */` comment in `styles.css` is stale.

## Where it has drifted (the gaps)

1. **No square-grid layout.** The renderer (`src/ui/svg-grid.js`) is a bespoke
   hex-only SVG. ProgGenie's chord inspector and the Chord Dictionary use the
   shared **`@enkerli/ui` `createPitchGrid`**, which offers both **square
   (chromatic rows in fourths, 5×5)** and **hex (Exquis thirds)** and a toggle
   between them. This app predates that component and never adopted it — hence
   no square view and no layout parity.
2. **Bespoke component CSS (~490 lines).** Sidebar, collapsible sections,
   info/warning/success/error boxes, score display, pattern list, issue list —
   all hand-rolled here rather than using the shared `components.css` classes
   (`.es-panel`, `.es-btn`, `.es-control`, `.es-eyebrow`, …). Visual drift and
   duplicated maintenance.
3. **Information architecture differs.** A tall left sidebar of stacked
   collapsibles with two separate **"Advanced:"** panels. No sibling app looks
   like this; ProgGenie groups controls into labelled cards, the Chord
   Dictionary is a single inspector + table. The capture / manual / geometric
   flows overlap confusingly (two places to set chord/scale).
4. **No theme toggle.** Every other app has a `● Dark / ☀︎ Light` control;
   this one relies on OS preference only, and dark mode was never deliberately
   designed or QA'd (contrast on the info boxes, the disabled finger buttons,
   and the "Saved Chord Fingerings" empty state are untested in dark).
5. **Orientation vs layout naming.** "Portrait / Landscape" (a hex rotation) is
   easy to confuse with the square/hex *layout* choice users now expect from
   the rest of the suite.

## Goals for the design pass

- **Layout parity:** add the **square ⇄ hex** choice, ideally by moving onto
  the shared `createPitchGrid` so it matches ProgGenie and the Chord
  Dictionary exactly (same geometry, same square=fourths / hex=Exquis spec).
- **Adopt the shared component system:** replace the bespoke sidebar/box/score
  styles with `components.css` primitives; keep only what's genuinely unique
  (the Exquis grid, the fingering overlay).
- **Rework the control IA:** collapse the overlapping capture / manual /
  geometric panels into one coherent flow; reconsider the two "Advanced:"
  sections; align grouping with ProgGenie's labelled-card pattern.
- **Finish dark mode intentionally** and add the standard theme toggle.
- **Keep intact:** the Exquis pad geometry and colours, fingering capture &
  scoring, pattern save/load, and the MIDI/SysEx path to hardware — these are
  the app's reason to exist and must survive any redesign.

## Pointers for the designer

- Design system, live: the **Style Gallery** app (`apps/style-gallery`) and the
  Style Gallery card on the suite site.
- Parity targets: **ProgGenie's** chord-scale inspector (square/hex pad grid)
  and the **Chord Dictionary's** display options (`◯ circle ▦ square ⬡ hex`).
- Shared grid component: `packages/ui/components/pitch-grid.js`
  (`createPitchGrid`, `layoutCells`).
- This app's code: `src/app.js`, `src/ui/svg-grid.js`, `src/core/grid.js`,
  `src/assets/css/styles.css`.
