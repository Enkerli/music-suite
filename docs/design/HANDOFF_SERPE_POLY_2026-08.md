# Handoff: Serpe Poly Views & Explainability

## Overview
Implements the four priority items from `docs/DESIGN_BRIEF.md` §3–4 for Serpe (and its Workspace module):
- **§3.1** Poly representation — concentric rings as the single primary view for *both* polyrhythm and polymeter; stacked rows demoted to an optional linear view.
- **§3.2** A live per-lane trigger readout inside the view header.
- **§3.3** Rename "Poly Lock" → **Lane alignment** (Polyrhythm / Polymeter), with one-line consequences and a proposed default flip.
- **§3.5** Two-channel accent display (velocity + transpose).
- **§4** A non-visual (screen-reader) route authored alongside every visual.

## About the Design Files
The bundled file is a **design reference created in HTML** — a live, theme-aware prototype showing intended look and behavior, **not production code to copy directly**. The task is to **recreate these designs in the Serpe codebase's existing environment** (framework-agnostic SVG/DOM helpers, since 2026-08-02 shared from `@enkerli/ui/rhythm-views` — the handoff was written when they lived in `serpe/render.js`) using its established patterns. The renderer logic in the prototype is directly portable — it reuses the repo's own `ang(i,n)` / `pol(cx,cy,r,a)` geometry and the `@enkerli/ui` tokens — but it should be reworked into `createCircleView` rather than pasted.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, geometry, and interactions, all drawn from the live `tokens.css` / `components.css`. Recreate pixel-close using the suite's existing token variables — do not introduce new colors or type.

## Screens / Views

### 1. Ring view (primary) — `createCircleView` replacement
- **Purpose:** show one or more rhythm lanes as concentric rings; the identity view of Serpe.
- **Layout:** 320×320 SVG viewBox, centre (160,160). Outer ring radius 128, each inner lane steps inward by 34px. Arc stroke-width 11 (accented +4).
- **Onset node:** a **solid filled dot** (radius 7.5, accented 9) in the lane hue, with a 2.5px `--es-bg-raised` stroke and a small `--es-bg-raised` centre dot — sits *proud* of the arc so every attack is unmistakable. **This is the fix for the "continuous ring" regression — onsets must always read as discrete events.**
- **Duration arc:** from each onset node, swept clockwise along the ring for its inter-onset interval, **stopping ~40% of one step short of the next onset** (`gap = 0.4 * TAU / n`) so arcs never merge. `stroke-linecap: round`, `fill: none`.
- **Downbeat:** step 0 pinned at 12 o'clock on every ring (tick at `--es-fg-muted`, width 2); other step ticks `--es-border-soft`, width 1.
- **Guide track:** faint full circle per ring, `--es-border`, width 1.
- **Playhead — the mode mechanism:**
  - *Polyrhythm:* one shared central sweep line from centre across all rings (`--es-fg`, width 1.5, opacity 0.5) — all lanes share one cycle/phase.
  - *Polymeter:* **per-lane playhead** — a short radial marker riding each ring at its own phase (`t/8` vs `t/7`). Heads drift apart after the downbeat and re-coincide at the LCM (56 for E(3,8)/E(3,7)). No central sweep.
- **Lane hue:** `--es-pc-8` (lane 0), `--es-dim-pressure` (lane 1). Colour never identifies alone — always paired with a label.

### 2. Rows view (optional linear)
- Demoted from co-equal to **optional**. Same per-lane-phase playhead logic (outline on the active cell). Kept for users who prefer an unrolled ruler; not required to tell the polymeter story.

### 3. Trigger readout chip (§3.2)
- Pill inside the view header. Left segment `--es-accent` bg / `--es-accent-fg`: `⟳ trigger N`. Right segment: operator-specific consequence (`rotated 4`, `step 10`, `+3 onsets`). Trigger 1 always reads `base · …` and stops (D6). Fed from **engine state**, never recomputed (avoids parser drift, L5). Per-lane in poly.

### 4. Lane alignment control (§3.3)
- Replaces the "Poly Lock On/Off" boolean. Two-option segmented control, each with a subtitle: **Polyrhythm** — "one shared cycle"; **Polymeter** — "shared step · drifts". The selected mode also drives the ring playhead (§3.1). **Proposed default for fresh patterns: Polymeter** — needs product sign-off.

### 5. Accent display (§3.5)
- Two channels, never colour alone: **velocity** → heavier arc / taller cell; **transpose** → a radial spoke in `--es-dim-slide` tagged with the live offset (`+5`). Legend states the arithmetic once: `accent = louder + up 5 semitones (36 → 41)`.

## Interactions & Behavior
- Mode toggle re-renders Figure 1 live; polyrhythm shows one sweep, polymeter shows two drifting heads.
- Trigger prev/next steps the ordinal and re-renders the ring + chip.
- Animation loop advances ~480ms/step; respects `prefers-reduced-motion` (static frame when reduced/off).
- All figures are SVG/DOM (not `<canvas>`) so they are inspectable.

## Non-visual route (§4) — required, ships with each viz
1. **Semantic SVG:** ring is `role="img"` with an `aria-label` stating the pattern in words (onsets, mode, trigger).
2. **Live region:** `aria-live="polite"` announces trigger/mode/accent changes — the trigger readout text is the same string shown and spoken.
3. **DOM table alternative:** a keyboard-reachable table-view toggle rendering lanes × steps as a real `<table>` (onset/rest/accent per cell). This survives where canvas can't.
4. **Workspace hazard:** scope Workspace's document-level `] [ m` key listener to the focused pane; drop bindings while an AT virtual cursor / role-menu is active; give bare single-key shortcuts a visible equivalent.

## Design Tokens (all from `tokens.css` / `components.css` — use the vars, not hexes)
- Colour: `--es-bg`, `--es-bg-raised`, `--es-bg-sunken`, `--es-fg`, `--es-fg-2`, `--es-fg-muted`, `--es-accent`, `--es-accent-fg`, `--es-border`, `--es-border-soft`, `--es-border-strong`, lane hues `--es-pc-8` / `--es-dim-pressure`, accent transpose `--es-dim-slide`.
- Type: `--es-font-serif` (Domine, headings), `--es-font-sans` (Inter Tight, body), `--es-font-mono` (JetBrains Mono, values/labels).
- Radius/shadow/motion/touch: `--es-radius-sm/md`, `--es-shadow`, `--es-motion-fast`, `--es-touch-target`, `--es-focus-ring`.

## Geometry (reuse the repo's own helpers)
```
ang(i, n) = TAU*i/n - PI/2      // step 0 at 12 o'clock, clockwise
pol(cx,cy,r,a) = [cx + r*cos(a), cy + r*sin(a)]
gap = 0.4 * TAU / n             // arc trim so onsets stay discrete
```

## Files
- `Poly & Explainability - Design Pass · August 2026.html` — the live prototype (this bundle). Drives Figures 1–5.
- Reference: `@enkerli/ui/rhythm-views` (`ang`/`pol`, `createCircleView`; was `serpe/render.js` when this was written), `tokens.css`, `components.css` in the repo root.
- Companion doc: `docs/DESIGN_AGENT_ANSWERS.md` (Serpe arcs, MIDIcurator knobs, PitchFold hold pad, MTILT wordmark).

## Handoff sequence (cheap-first)
1. Rename Poly Lock → Lane alignment (strings only, no engine).
2. Trigger readout chip from engine state (small, highest value).
3. Duration-arc + onset-node renderer replacing the onset polygon in `createCircleView`.
4. Rings become the single primary view; mode drives the playhead; rows demoted (after 1+3).
5. Accent two-channel marks in both renderers.
6. SVG `aria-label` sentences + live region + table-view toggle.
7. Scope Workspace's document key listener to the focused pane (a11y-blocking).

## Open sign-off
Flip the default Lane alignment to **Polymeter** for fresh patterns? UI default only, no engine change.
