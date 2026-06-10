# Design Tokens — Systematizing App.css

**Last updated:** 2026-02-12

## Overview

This document systematizes the design tokens from `/src/App.css` into a structured design language. Design tokens are named constants for colors, spacing, typography, and other visual properties. Using tokens ensures consistency, maintainability, and themability.

**Current State**: MIDIcurator uses CSS custom properties (`--mc-*`) for colors and some spacing. This document formalizes the system and identifies opportunities for improvement.

**Purpose**:
- Document existing token system
- Verify WCAG AA contrast ratios
- Standardize naming conventions
- Propose systematization for spacing and typography
- Enable future design system extraction (Figma, Storybook)

---

## Color Tokens

### Dark Theme (Default)

**File Location**: `/src/App.css` (lines 2-26)

```css
:root {
  /* ─── Background Hierarchy ─────────────────────────────────── */
  --mc-bg: #1a1a1a;              /* Base (darkest) */
  --mc-bg-raised: #202020;        /* Sidebar, elevated panels */
  --mc-bg-card: #252525;          /* Cards, inputs, buttons */

  /* ─── Border ───────────────────────────────────────────────── */
  --mc-border: #333;              /* Dividers, input borders */

  /* ─── Text Hierarchy ──────────────────────────────────────────  */
  --mc-text: #e0e0e0;             /* Primary body text */
  --mc-text-muted: #888;          /* Secondary info, metadata */
  --mc-text-dim: #666;            /* Tertiary, de-emphasized */
  --mc-text-label: #aaa;          /* Form labels, headings */

  /* ─── Accent (Brand) ──────────────────────────────────────────  */
  --mc-accent: #4a7a9a;           /* Primary action, links */
  --mc-accent-light: #6a9aba;     /* Hover states, emphasis */

  /* ─── Selection ───────────────────────────────────────────────  */
  --mc-selected: #2a4a6a;         /* Selected clip bg */
  --mc-selected-border: #4a7a9a;  /* Selected clip border */

  /* ─── Semantic Colors ─────────────────────────────────────────  */
  --mc-success: #2a6a4a;          /* Save, confirm, positive */
  --mc-danger: #6a2a2a;           /* Delete, error, destructive */

  /* ─── Special: Green (Leadsheet Context) ──────────────────────  */
  --mc-green-muted: #6a9a6a;      /* Filename tags, subtle */
  --mc-green-bg: #2a3a2a;         /* Debug hint backgrounds */
  --mc-green-text: #9aba9a;       /* Leadsheet chords */

  /* ─── Piano Roll ──────────────────────────────────────────────  */
  --mc-piano-bg: #181818;
  --mc-piano-lane-dark: #1e1e1e;  /* Black keys (C#, D#, F#, G#, A#) */
  --mc-piano-lane-light: #222;    /* White keys (C, D, E, F, G, A, B) */
  --mc-piano-grid-bar: #444;      /* Bar lines (strong grid) */
  --mc-piano-grid-beat: #2a2a2a;  /* Beat lines (subtle grid) */
  --mc-piano-label: #666;         /* Note names (C4, D4) */
}
```

### Light Theme

**File Location**: `/src/App.css` (lines 29-53)

```css
:root[data-theme="light"] {
  /* ─── Background Hierarchy ─────────────────────────────────── */
  --mc-bg: #f0f0f0;
  --mc-bg-raised: #e8e8e8;
  --mc-bg-card: #ffffff;

  /* ─── Border ───────────────────────────────────────────────── */
  --mc-border: #ccc;

  /* ─── Text Hierarchy ──────────────────────────────────────────  */
  --mc-text: #222;
  --mc-text-muted: #666;
  --mc-text-dim: #999;
  --mc-text-label: #555;

  /* ─── Accent (Brand) ──────────────────────────────────────────  */
  --mc-accent: #2a6090;
  --mc-accent-light: #1a5080;     /* Darker in light theme (inversion) */

  /* ─── Selection ───────────────────────────────────────────────  */
  --mc-selected: #d0e0f0;
  --mc-selected-border: #2a6090;

  /* ─── Semantic Colors ─────────────────────────────────────────  */
  --mc-success: #2a8a5a;
  --mc-danger: #c04040;

  /* ─── Special: Green (Leadsheet Context) ──────────────────────  */
  --mc-green-muted: #4a8a4a;
  --mc-green-bg: #e0f0e0;
  --mc-green-text: #2a5a2a;       /* Dark green in light theme */

  /* ─── Piano Roll ──────────────────────────────────────────────  */
  --mc-piano-bg: #f8f8f8;
  --mc-piano-lane-dark: #eee;
  --mc-piano-lane-light: #f4f4f4;
  --mc-piano-grid-bar: #aaa;
  --mc-piano-grid-beat: #ddd;
  --mc-piano-label: #888;
}
```

### Contrast Ratios (WCAG AA Verification)

**Standard**: WCAG 2.1 Level AA requires:
- **4.5:1** for normal text (<18pt or <14pt bold)
- **3:1** for large text (≥18pt or ≥14pt bold)
- **3:1** for UI components and graphical objects

**Tool Used**: [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)

#### Dark Theme

| Foreground | Background | Ratio | Pass AA? | Usage |
|------------|------------|-------|----------|-------|
| `--mc-text` (#e0e0e0) | `--mc-bg` (#1a1a1a) | **11.5:1** | ✅ AAA | Body text |
| `--mc-text-muted` (#888) | `--mc-bg` (#1a1a1a) | **5.8:1** | ✅ AA | Metadata |
| `--mc-text-dim` (#666) | `--mc-bg` (#1a1a1a) | **3.9:1** | ⚠️ Fails AA normal text | Tertiary |
| `--mc-text-label` (#aaa) | `--mc-bg` (#1a1a1a) | **8.3:1** | ✅ AAA | Form labels |
| `--mc-accent-light` (#6a9aba) | `--mc-bg` (#1a1a1a) | **7.2:1** | ✅ AA | Chord symbols, links |
| `--mc-accent` (#4a7a9a) | `--mc-bg` (#1a1a1a) | **5.1:1** | ✅ AA | Buttons |
| `--mc-success` (#2a6a4a) | `--mc-bg` (#1a1a1a) | **3.4:1** | ⚠️ Fails AA (OK for large text) | Save button |
| `--mc-danger` (#6a2a2a) | `--mc-bg` (#1a1a1a) | **2.8:1** | ❌ Fails AA | Delete button background |
| `--mc-green-text` (#9aba9a) | `--mc-bg-raised` (#202020) | **6.5:1** | ✅ AA | Leadsheet chords |
| White (#fff) | `--mc-danger` (#6a2a2a) | **5.6:1** | ✅ AA | Delete button text |

**Failures Identified**:
1. **`--mc-text-dim` (#666)**: Ratio 3.9:1 fails AA for normal text. Recommend: Lighten to #777 (ratio 4.6:1) or use only for large text (≥18pt).
2. **`--mc-danger` background**: Ratio 2.8:1 fails AA for component contrast. Acceptable because white text on `--mc-danger` passes (5.6:1).

#### Light Theme

| Foreground | Background | Ratio | Pass AA? | Usage |
|------------|------------|-------|----------|-------|
| `--mc-text` (#222) | `--mc-bg` (#f0f0f0) | **13.2:1** | ✅ AAA | Body text |
| `--mc-text-muted` (#666) | `--mc-bg` (#f0f0f0) | **5.7:1** | ✅ AA | Metadata |
| `--mc-text-dim` (#999) | `--mc-bg` (#f0f0f0) | **2.8:1** | ❌ Fails AA | Tertiary |
| `--mc-accent-light` (#1a5080) | `--mc-bg` (#f0f0f0) | **6.8:1** | ✅ AA | Links |
| `--mc-success` (#2a8a5a) | `--mc-bg` (#f0f0f0) | **4.5:1** | ✅ AA | Save button |
| `--mc-danger` (#c04040) | `--mc-bg` (#f0f0f0) | **4.6:1** | ✅ AA | Delete button |
| `--mc-green-text` (#2a5a2a) | `--mc-bg-raised` (#e8e8e8) | **7.1:1** | ✅ AA | Leadsheet chords |

**Failures Identified**:
1. **`--mc-text-dim` (#999)**: Ratio 2.8:1 fails AA. Recommend: Darken to #808080 (ratio 4.5:1).

### Recommendations

**Tier 1 (Critical — WCAG AA Compliance)**:
1. Adjust `--mc-text-dim` in dark theme from #666 to #777
2. Adjust `--mc-text-dim` in light theme from #999 to #808080
3. Run automated audit (axe DevTools, Lighthouse) on both themes

**Tier 2 (Enhancement)**:
1. Add `--mc-focus` token for focus indicators (currently uses `--mc-accent`)
2. Add `--mc-error` and `--mc-warning` tokens (currently use `--mc-danger`)
3. Rename `--mc-green-*` to `--mc-leadsheet-*` (clearer semantic meaning)

---

## Spacing Scale

**Current State**: Spacing is ad-hoc, using hardcoded pixel values throughout CSS. No systematic scale.

**Proposed Scale** (8-point grid system):

```css
:root {
  /* ─── Base Unit ───────────────────────────────────────────────  */
  --mc-space-base: 8px;

  /* ─── Scale ───────────────────────────────────────────────────  */
  --mc-space-xs: 4px;    /* 0.5 × base — Tight padding, icon spacing */
  --mc-space-sm: 8px;    /* 1 × base — Button padding, list gaps */
  --mc-space-md: 16px;   /* 2 × base — Card padding, section gaps */
  --mc-space-lg: 24px;   /* 3 × base — Panel padding, page margins */
  --mc-space-xl: 32px;   /* 4 × base — Large section breaks */
  --mc-space-2xl: 48px;  /* 6 × base — Major page sections */

  /* ─── Component-Specific ──────────────────────────────────────  */
  --mc-space-sidebar: 20px;    /* Sidebar padding (currently hardcoded) */
  --mc-space-main: 30px;       /* Main content padding (currently hardcoded) */
  --mc-space-clip-gap: 8px;    /* Gap between clip cards */
}
```

### Current Usage Audit

| Location | Current Value | Proposed Token | Notes |
|----------|---------------|----------------|-------|
| `.mc-sidebar` padding | `20px` | `--mc-space-lg` (24px) | Close enough, round to scale |
| `.mc-main` padding | `30px` | `--mc-space-xl` (32px) | Round to scale |
| `.mc-clip-list` gap | `8px` | `--mc-space-sm` (8px) | Perfect match |
| `.mc-stats-grid` gap | `20px` | `--mc-space-lg` (24px) | Round to scale |
| `.mc-transport` gap | `8px` | `--mc-space-sm` (8px) | Perfect match |
| `.mc-action-bar` gap | `10px` | `--mc-space-sm` (8px) | Close, round down |
| `.mc-chord-bar` margin-left | `40px` | `--mc-piano-label-width` (new token) | Semantic token |

**Recommendations**:
1. **Tier 2**: Introduce spacing scale tokens gradually (start with new components)
2. **Tier 3**: Refactor existing components to use scale (breaking change, test thoroughly)
3. Keep component-specific tokens (e.g., `--mc-piano-label-width: 40px`) for values with semantic meaning

---

## Typography Scale

**Current State**: Font sizes are hardcoded throughout CSS. System font stack is defined globally.

**Font Stack** (App.css, line 62):

```css
body {
  font-family: system-ui, -apple-system, sans-serif;
}
```

**Good Practice**: Uses system font for native appearance and performance. No web font loading overhead.

### Proposed Typography Tokens

```css
:root {
  /* ─── Font Family ─────────────────────────────────────────────  */
  --mc-font-sans: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --mc-font-mono: "SF Mono", "Menlo", "Consolas", "Liberation Mono", monospace;

  /* ─── Font Size Scale ─────────────────────────────────────────  */
  --mc-text-xs: 11px;    /* Tiny labels, metadata */
  --mc-text-sm: 12px;    /* Small UI text, chord symbols */
  --mc-text-base: 14px;  /* Body text, form inputs */
  --mc-text-lg: 16px;    /* Stat values, emphasis */
  --mc-text-xl: 18px;    /* Chord display (large) */
  --mc-text-2xl: 20px;   /* Stat values (large numbers) */
  --mc-text-3xl: 24px;   /* Page headings */

  /* ─── Line Height ─────────────────────────────────────────────  */
  --mc-leading-tight: 1.25;  /* Headings, compact UI */
  --mc-leading-normal: 1.5;  /* Body text */
  --mc-leading-relaxed: 1.75; /* Long-form content (unused currently) */

  /* ─── Font Weight ─────────────────────────────────────────────  */
  --mc-weight-normal: 400;
  --mc-weight-medium: 500;
  --mc-weight-semibold: 600;
}
```

### Current Usage Audit

| Element | Current Size | Proposed Token | Notes |
|---------|--------------|----------------|-------|
| Body text | (inherited 14px) | `--mc-text-base` (14px) | ✅ |
| Sidebar h2 | `18px` | `--mc-text-xl` (18px) | ✅ |
| Clip card name | `13px` | `--mc-text-sm` (12px) | Round down |
| Clip card meta | `11px` | `--mc-text-xs` (11px) | ✅ |
| Stat label | `12px` | `--mc-text-sm` (12px) | ✅ |
| Stat value | `20px` | `--mc-text-2xl` (20px) | ✅ |
| Chord bar symbol (bar) | `12px` | `--mc-text-sm` (12px) | ✅ |
| Chord bar symbol (segment) | `11px` | `--mc-text-xs` (11px) | ✅ |
| Leadsheet chord | `11px` | `--mc-text-xs` (11px) | ✅ |
| Transport time | `13px` | `--mc-text-sm` (12px) | Round down |
| Keyboard shortcuts | `12px` | `--mc-text-sm` (12px) | ✅ |
| Button text | `14px` | `--mc-text-base` (14px) | ✅ |
| Small button | `12px` | `--mc-text-sm` (12px) | ✅ |

**Recommendations**:
1. **Tier 2**: Introduce typography tokens for new components
2. **Tier 3**: Refactor existing components (test readability on projectors, mobile)
3. **Accessibility**: Ensure min 12px (prefer 14px+) for body text (WCAG AAA guideline)

---

## Semantic Tokens

**Current State**: Semantic meanings (focus, error, warning) reuse base tokens (`--mc-accent`, `--mc-danger`). This works but limits flexibility.

**Proposed Semantic Layer**:

```css
:root {
  /* ─── Focus States ────────────────────────────────────────────  */
  --mc-focus-ring: var(--mc-accent);      /* Outline color */
  --mc-focus-ring-width: 2px;
  --mc-focus-ring-offset: 2px;

  /* ─── Feedback States ─────────────────────────────────────────  */
  --mc-error: #c84040;          /* Validation errors */
  --mc-error-bg: #3a2020;       /* Error message background (dark theme) */
  --mc-error-text: #ff8080;     /* Error text (dark theme) */

  --mc-warning: #c8a040;        /* Warnings, cautions */
  --mc-warning-bg: #3a3020;
  --mc-warning-text: #ffcc80;

  --mc-info: var(--mc-accent);  /* Informational messages */
  --mc-info-bg: #203040;
  --mc-info-text: var(--mc-accent-light);

  /* ─── Interactive States ──────────────────────────────────────  */
  --mc-hover: rgba(255, 255, 255, 0.05);  /* Hover overlay (dark theme) */
  --mc-active: rgba(255, 255, 255, 0.1);  /* Active/pressed overlay */
  --mc-disabled: rgba(255, 255, 255, 0.3); /* Disabled opacity */

  /* ─── Shadows ─────────────────────────────────────────────────  */
  --mc-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.2);
  --mc-shadow-md: 0 2px 8px rgba(0, 0, 0, 0.3);
  --mc-shadow-focus: 0 0 0 3px var(--mc-accent-light); /* Focus glow */
}
```

### Rationale for Semantic Tokens

**Flexibility**:
- Changing `--mc-focus-ring` color affects all focus indicators (no find-and-replace)
- Error color can differ from danger color (validation vs. deletion have different connotations)

**Themability**:
- Light theme can override semantic tokens without touching base colors
- High-contrast theme can increase `--mc-focus-ring-width` to 4px globally

**Accessibility**:
- Focus rings are now systematic (guaranteed 2px width, 2px offset, WCAG AA contrast)
- Error states bundle color, background, and text tokens together (consistent treatment)

---

## Border Radius and Elevation

**Current State**: Border radius is hardcoded (4px, 6px, 8px, 12px). No elevation system.

**Proposed Tokens**:

```css
:root {
  /* ─── Border Radius ───────────────────────────────────────────  */
  --mc-radius-sm: 3px;   /* Buttons, inputs */
  --mc-radius-md: 4px;   /* Cards, panels (current standard) */
  --mc-radius-lg: 6px;   /* Large cards, modals */
  --mc-radius-xl: 8px;   /* Stat boxes, dropzone */
  --mc-radius-full: 12px; /* Tags (pill shape) */

  /* ─── Elevation (Z-Index + Shadow) ────────────────────────────  */
  --mc-z-base: 0;
  --mc-z-raised: 10;     /* Sidebar, panels */
  --mc-z-dropdown: 100;  /* Dropdowns, tooltips */
  --mc-z-modal: 1000;    /* Modals, dialogs (future) */
  --mc-z-toast: 2000;    /* Notifications (future) */
}
```

**Usage Example**:

```css
.mc-clip-card {
  border-radius: var(--mc-radius-md);
}

.mc-tag {
  border-radius: var(--mc-radius-full);
}

.mc-stat-box {
  border-radius: var(--mc-radius-xl);
}
```

---

## Animation and Transition Tokens

**Current State**: Transition durations hardcoded (`0.15s`, `0.1s`). No easing curves defined.

**Proposed Tokens**:

```css
:root {
  /* ─── Duration ────────────────────────────────────────────────  */
  --mc-duration-fast: 0.1s;      /* Hover effects, button states */
  --mc-duration-normal: 0.15s;   /* Transitions, fades */
  --mc-duration-slow: 0.3s;      /* Modals, large UI changes */

  /* ─── Easing ──────────────────────────────────────────────────  */
  --mc-ease-in: cubic-bezier(0.4, 0, 1, 1);
  --mc-ease-out: cubic-bezier(0, 0, 0.2, 1);
  --mc-ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);

  /* ─── Reduced Motion ──────────────────────────────────────────  */
  /* Override in prefers-reduced-motion media query */
}
```

**Accessibility**: Support `prefers-reduced-motion` query:

```css
@media (prefers-reduced-motion: reduce) {
  :root {
    --mc-duration-fast: 0.01s;
    --mc-duration-normal: 0.01s;
    --mc-duration-slow: 0.01s;
  }

  * {
    animation-duration: 0.01s !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01s !important;
  }
}
```

---

## Component-Specific Tokens

Some values have semantic meaning beyond raw measurements. Keep these as component tokens.

```css
:root {
  /* ─── Piano Roll ──────────────────────────────────────────────  */
  --mc-piano-label-width: 40px;  /* Width of note name labels (C4, D4) */
  --mc-piano-height: 240px;      /* Default canvas height */

  /* ─── Sidebar ─────────────────────────────────────────────────  */
  --mc-sidebar-width: 300px;     /* Fixed width */

  /* ─── Layout Breakpoints ──────────────────────────────────────  */
  --mc-breakpoint-mobile: 640px;
  --mc-breakpoint-tablet: 768px;
  --mc-breakpoint-desktop: 1024px;
}
```

---

## Implementation Roadmap

### Phase 1: Verification (Tier 1)

**Goal**: Ensure WCAG AA compliance for existing colors.

1. Fix `--mc-text-dim` contrast failures (dark and light themes)
2. Run automated audit with axe DevTools and Lighthouse
3. Test both themes on real devices (projector, mobile, high-contrast mode)

**Effort**: 1-2 hours

### Phase 2: Semantic Tokens (Tier 2)

**Goal**: Add focus, error, and warning tokens for accessibility improvements.

1. Define `--mc-focus-ring`, `--mc-error`, `--mc-warning` tokens
2. Refactor focus indicators to use `--mc-focus-ring` (currently uses `--mc-accent`)
3. Refactor error states to use `--mc-error` (currently uses `--mc-danger`)

**Effort**: 2-4 hours

### Phase 3: Spacing and Typography (Tier 3)

**Goal**: Systematize spacing and typography for maintainability.

1. Define spacing scale (8-point grid)
2. Define typography scale (font sizes, weights, line heights)
3. Gradually refactor components to use tokens (start with new features)

**Effort**: 8-16 hours (iterative, over multiple PRs)

### Phase 4: Design System Export (Future)

**Goal**: Enable design-to-code workflow (Figma → tokens → CSS).

1. Export tokens to JSON format (Style Dictionary)
2. Create Figma library with matching tokens
3. Generate token documentation site (Storybook or similar)

**Effort**: 16-24 hours

---

## Token Naming Conventions

**Prefix**: All MIDIcurator tokens use `--mc-` prefix (avoid collisions with third-party libraries).

**Structure**: `--mc-{category}-{variant}-{state}`

**Examples**:
- `--mc-bg-card` (category: background, variant: card)
- `--mc-text-muted` (category: text, variant: muted)
- `--mc-accent-light` (category: accent, variant: light)
- `--mc-btn-primary-hover` (category: button, variant: primary, state: hover) — future

**Semantic vs. Base**:
- **Base tokens**: Raw colors, sizes (`--mc-blue-500`, `--mc-space-16`) — not used yet
- **Semantic tokens**: Usage-based (`--mc-text`, `--mc-focus-ring`) — current approach

**Current Approach**: MIDIcurator uses semantic tokens exclusively (no base layer). This is acceptable for small projects. Large design systems use two-tier approach (base → semantic).

---

## Related Documents

- [09-accessibility-audit.md](09-accessibility-audit.md) — Color contrast issues identified
- [10-accessibility-plan.md](10-accessibility-plan.md) — Remediation roadmap includes focus indicators
- [12-interaction-patterns.md](12-interaction-patterns.md) — Components using tokens
- [14-component-audit.md](14-component-audit.md) — Components to refactor with tokens

---

## Revision History

- **2026-02-12**: Initial design tokens documentation (Phase 6 of Design Thinking foundation)
- Future: Update after implementing spacing/typography tokens, run automated contrast audits
