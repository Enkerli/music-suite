# Accessibility test plan — Enkerli Music Suite

*Prepared 2026-07-01 for testing carried out through specialized means
(external testers, assistive-technology users, and/or audit tooling).
This document is intended to be self-sufficient: no prior knowledge of
the suite is assumed. Written statements about component behavior were
verified against the source on the preparation date.*

## 1. What you are testing

A suite of ten music web applications sharing one design system
(`@enkerli/ui`: design tokens, CSS components, and a small set of
framework-agnostic interactive components). The same UI code also runs
inside audio-plugin windows (JUCE WebViews) on macOS and iPadOS — §6
explains how that context differs.

**Conformance target: WCAG 2.1 AA.** Beyond that, the suite makes four
explicit commitments of its own (from `packages/ui/DESIGN.md`):

1. **Never color-only encoding** — color always pairs with shape,
   texture, position, or label (e.g. pad grids encode roles as
   fill + edge texture + glyph).
2. **Touch targets ≥ 44 pt** in touch contexts.
3. **`prefers-reduced-motion` honored** — motion tokens carry
   reduced-motion variants (verify actual behavior per app; this is a
   commitment, not yet an audited fact).
4. **Full keyboard operability** of interactive components.

Themes: warm-paper **light** (default) and warm-**dark**, via a one-tap
persisted toggle with OS-preference fallback. Test both themes; the
toggle itself is part of the scope.

## 2. Where

Live apps (GitHub Pages): `https://enkerli.github.io/music-suite/apps/<name>/`

| App (`<name>`) | What it is | Primary interactions |
|---|---|---|
| `proggenie` | Chord-progression generator/editor (the most interaction-dense app) | Leadsheet editor (chips, carets, press-and-hold move, inspector), generator controls, collapsible sections, transport/playback, file save/load |
| `midicurator` | MIDI pattern library & curation (React) | Lists/tables, search/filter, batch ops, import/export |
| `serpe` | Rhythm-pattern explorer (React) | Text notation input, canvas pattern displays, transforms, transport, MIDI device bar |
| `chord-dictionary` | Chord reference | Spelled root selector, quality browsing, PCS ring, pad grid, JSON export |
| `pickpcs` | Pitch-class-set picker | Interactive PCS ring, set list, Euclidean/named-collection suggestions |
| `exquisite` | Grid-controller fingering explorer | Isomorphic pad grid (hex/square), key/scale selectors, MIDI out (Chromium only) |
| `pitchfold` | PCS quantizer UI | PCS controls, range sliders, collapsible sections |
| `drawnqurve` | Gesture/automation curve editor | Canvas curve drawing (pointer-heavy), MIDI out |
| `vane` | Synth UI + browser-playable voice | Tabbed panels, knobs/sliders, WebAudio playback, MIDI in (Chromium only) |
| `style-gallery` | **Design-system reference page** | Every token, control style, and shared component in one place — the best first stop to test components in isolation |

Notes for testers:
- **WebMIDI works only in desktop Chromium.** In Safari/Firefox the apps
  must degrade gracefully (MIDI as progressive enhancement) — absence of
  MIDI is expected there, broken layout or dead-end UI is a finding.
- `drawnqurve` and `serpe` render heavily to `<canvas>`; these are the
  highest-risk apps for screen-reader users and deserve extra attention.

## 3. Test lenses — the five personas

Full text in [personas.md](personas.md); use them as lenses, not scripts:

1. **Wind-controller performer** — eyes-free, one hand, on stage: large
   targets, glanceable state, no modal dialogs during play.
2. **Grid-instrument learner** — spatial reasoning: faithful grid
   geometry, label modes, left/right-hand parity.
3. **Theory explorer / educator** — correctness and nomenclature:
   synchronized representations, precise labels, **screen-reader-
   meaningful structure** (this persona anchors the SR pass).
4. **Producer in a DAW** — speed: keyboard shortcuts, batch operations,
   never losing work.
5. **Accessibility-first performer** — switch access, limited fine
   motor, low vision: full keyboard operability, generous targets,
   density modes, reduced motion. *The suite's collapsible-density
   layout grammar exists chiefly for this persona.*

## 4. What automation already covers (do not re-test by hand)

**Color contrast of the token palette is machine-verified**:
`packages/ui/tools/contrast-audit.mjs` checks **51 contracts** across
both themes — body/muted text on all surfaces, button text, focus rings
(≥3:1), control borders (`--es-border-strong` ≥3:1), danger, and ink on
all 12 per-theme pitch-class pad colors.

- **Fresh run 2026-07-01: ALL 51 PASS.**
- Re-run: `node packages/ui/tools/contrast-audit.mjs packages/ui/tokens/tokens.css`
- What it does **not** cover: contrast of content rendered to canvas,
  app-local hardcoded colors (should not exist; any found is a finding),
  and non-text contrast of icons/glyphs.

## 5. Shared components — intended semantics (and known thin spots)

These appear across apps; `style-gallery` shows most in isolation.
Statements below reflect the actual source as of 2026-07-01 — including
where support is thin. A gap between intention and behavior is a finding;
a listed thin spot is *known* and should be confirmed and prioritized.

| Component | Intended behavior | Verified state / thin spots |
|---|---|---|
| `range-slider` | ARIA slider pattern | Has `aria-label`, `aria-valuemin/max/now/valuetext`; keyboard arrows expected — verify step granularity and focus visibility |
| `leadsheet-editor` (ProgGenie) | Editable chord sheet: chips, insertion carets, inspector; press-and-hold to move (touch), tap-a-caret to drop — the caret drop is the designed a11y/precision fallback | Richest ARIA labeling of the set (8 `aria-label` uses). Complex interaction model — the priority target for both keyboard-only and SR passes |
| `pcs-ring` | Keyboard-operable pitch-class ring (tab, Enter/Space toggle) | Has keyboard handling + `aria-label`s; verify roving focus and announced state |
| `pitch-grid` | Isomorphic pad grid (hex/square); roles encoded as fill + edge texture + glyph, never color alone | **Thin**: minimal ARIA (3 refs). Visual role encoding is strong; programmatic equivalence likely missing — expect findings here |
| `piano-roll` | Read-only progression display with playhead | **Display-only; effectively no ARIA.** Needs a text alternative (the leadsheet itself may serve as one — assess whether that relationship is programmatically discoverable) |
| `section` | Collapsible sections + density toggle | No ARIA of its own **by design** — built on native `<details>/<summary>`; verify the density toggle is reachable and announced |
| Theme toggle | One-tap light/dark, persisted | Verify it is keyboard-reachable and its state is announced |

## 6. The plugin-WebView context (second environment)

The same bundles run inside plugin windows (AU/VST3/Standalone on macOS,
AUv3 on iPadOS) via WKWebView. Differences that affect testing:

- **No browser chrome**: no URL bar, no browser zoom, no extensions —
  AT support comes from VoiceOver over the embedded WKWebView.
- `window.confirm`/`prompt` are no-ops (the apps use inline two-tap
  confirms instead — their keyboard/SR behavior is in scope).
- File open/save goes through native pickers/share sheets (document
  picker on iPadOS) — the *native* side follows platform a11y; the
  triggering controls are in scope.
- Window sizes are small and host-fixed (AUv3 especially): the
  collapsible-density grammar is the mitigation; test at plugin-typical
  sizes (try ~700×500 and smaller).
- On-device testing (iPad, AUM or GarageBand as host) requires a signed
  build — coordinate with the maintainer; the signing account lapses
  periodically (known, not a regression).

Priority split: **web apps first** (URLs above, no build needed); the
plugin context can follow once web findings are fixed, since it runs the
same bundles.

## 7. Known untested areas (expect findings)

Stated plainly so effort goes where the risk is:

1. **No screen-reader pass has ever been performed** on any app.
2. **Reduced-motion behavior** is committed but unaudited.
3. **Touch-target sizes** unaudited on real devices (iPad foremost).
4. **Focus order on composite pages** (ProgGenie above all) unaudited.
5. **Canvas-rendered content** (Serpe, DrawnQurve, piano-roll) has no
   programmatic equivalent.
6. **Localization is not implemented** (English-only; no string
   extraction yet) — out of scope for this pass, listed for context.

## 8. Reporting findings

File as GitHub issues on `Enkerli/music-suite` (or, if issues are
impractical, a single Markdown report following the same fields), one
finding per issue:

- **Where**: app + URL/view + component; theme (light/dark); environment
  (browser+version / plugin host).
- **What**: observed vs expected, WCAG 2.1 success criterion if
  applicable, or the suite commitment violated (§1).
- **Severity**: blocker (task impossible for the affected persona) /
  major (workaround exists but hostile) / minor.
- **Persona lens** (§3) most affected.
- Repro steps + screenshot/recording where useful.

Suggested first session: `style-gallery` (components in isolation, both
themes, keyboard-only) → `proggenie` (the dense case) → `chord-dictionary`
+ `pickpcs` (ring + grid semantics) → the canvas apps with a screen
reader (expect structural findings, file them as such).
