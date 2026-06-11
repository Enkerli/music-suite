# The suite's design system — "paper & ink"

Codified (2026-06-12) from the language that emerged in **Vane** and
**DrawnQurve**, not invented: warm cream paper surfaces, warm ink text,
a matching warm-dark counterpart, soft generous radii, quiet shadows,
Inter for UI and JetBrains Mono for anything numeric-musical. DrawnQurve's
`--paper-bg` is literally one of Vane's panel colors — the two converged
on their own; this package makes the convergence official.

## Principles

1. **Paper first.** Light mode is the default design target (and Alex's
   working preference); dark is a first-class variant, never an
   afterthought. The OS preference is respected until the person chooses
   (`theme.js`: persisted light/dark with auto fallback).
2. **Expressive dimensions have stable colors** (Vane's vocabulary,
   aligned with manifold's controller model): breath ▪ blue, expression ▪
   teal, pressure ▪ orange, slide ▪ purple, bend ▪ gold, velocity ▪
   violet — each with a tint. The same dimension looks the same in every
   suite app. Color always pairs with a label or dot, never alone.
3. **Eyebrows, tabular numbers, mono for music data.** Section labels are
   small-caps eyebrows; chord symbols, masks, and counts use the mono
   stack with tabular numerals.
4. **Density is a setting, not a redesign.** Controls are 32px with a
   pointer, 44px on touch (`--es-ctl-h` scales via `pointer: coarse`);
   the PitchFold collapsible-section grammar (28px headers) is the layout
   model for plugin windows.
5. **One language, per-app voice.** Apps may add an accent (DrawnQurve's
   amber, serif and hand display faces are available as opt-in tokens)
   but surfaces, ink, spacing, and controls come from here.

## Requirements checklist (every app, every release)

- **Accessibility**: WCAG 2.1 AA contrast on both themes; full keyboard
  operability; visible focus rings (`--es-focus-ring`); 44px touch
  targets; `prefers-reduced-motion` zeroes the motion tokens; no
  color-only encoding (the pitch-class palette and dimension colors are
  always paired with text/shape).
- **Personas** (docs/personas.md): every screen names which of the five
  it serves; the stage-performer persona gets a density toggle, the
  educator persona gets precise labels and screen-reader-meaningful
  structure.
- **Localization-readiness**: no user-facing strings concatenated from
  fragments; no text baked into canvas/SVG without an accessible
  equivalent; layouts tolerate +35% string growth; MIDIcurator's i18next
  setup is the reference pattern when an app localizes.
- **Theming**: tokens only — no hardcoded colors in app code; both themes
  exercised before release (the WKWebView smoke can run twice with
  `data-theme` forced).

## Using it

```js
import "@enkerli/ui/tokens.css";
import "@enkerli/ui/components.css";
import { initTheme, toggleTheme, resolvedTheme } from "@enkerli/ui/theme";
initTheme();
```

Classes: `es-app`, `es-panel`, `es-btn` (+`es-primary`, `es-small`),
`es-control`, `es-eyebrow`, `es-num`, `es-badge` (+`es-up`), `es-bar`,
`es-dot.<dimension>`.

## Adoption status

| App | Status |
|---|---|
| Progression Studio | ✅ tokens + components + theme toggle (reference adopter) |
| chord-dictionary | ✅ tokens + components + theme toggle |
| MIDIcurator | tokens partially (own theming predates); migration pending |
| PickPCS / exquisite-fingerings | pending |
| Vane / DrawnQurve (C++ WebViews) | source of the language; token adoption when their UIs next get touched |
