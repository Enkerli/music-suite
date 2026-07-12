# Suite accessibility audit — 2026-07-11

> **STATUS: FIXED, same day.** Every P1–P3 finding below (and the sub-24px
> P4 targets) shipped in the follow-up commit; the re-run of this exact
> audit is **axe-clean on all eleven pages in BOTH themes**, keyboard is
> clean, and no interactive target measures under the 24px WCAG floor on
> coarse pointers. What shipped, beyond the per-finding fixes:
> `--es-fg-muted` deepened to clear AA on the sunken surface too;
> `--es-accent` deepened so it's small-text-safe on every light surface;
> `--es-pc-pad-ink-10` to true black (4.48→4.8:1); feat-badge text split
> from the graphic dims (darkened light / lightened dark); `es-small`,
> carets, checkboxes/radios/ranges and the bespoke PitchFold/DrawnQurve/
> Vane controls all get coarse-pointer target sizing; zoom re-enabled in
> the three plugin UIs. Remaining advisories: ~10-19 controls per app sit
> in the 24–43px band on touch (above the WCAG floor, below the house
> 44px bar — mostly 32-38px selects/segments), and the range-slider-thumb
> "no focus indicator" flag is a tooling false positive (its ring lives on
> a `::after`). The original findings are preserved below as the record.

*Automated sweep of all ten apps + the showcase index, at the production
`docs/` layout (rebuilt via `sync-apps --monorepo`, served locally, driven
headless). Method: axe-core 4.x, WCAG 2.0/2.1 A+AA rulesets, run in **both
themes** (persisted `enkerli.theme` per run); a 30-stop keyboard tab-through
checking focus-indicator visibility; touch-target measurement under an iPad
device profile (`pointer: coarse`, so `--es-ctl-h` scales); console/page
errors; plus the token-level `contrast-audit.mjs` and a grep for
reduced-motion-unguarded animations. This is a findings report — no fixes
applied.*

## Headline

- **Token level: ALL PASS.** `contrast-audit.mjs` is green — every `--es-*`
  ink, accent, border-strong, danger, and all 24 pc entries meet their bars
  in both themes. Every AA failure below is an app-local color or a bespoke
  (non-token) style.
- **Keyboard: strong across the board.** Every page tabs through its
  controls with a visible focus indicator. (One tool flag — the range-slider
  thumb — is a false positive: its indicator lives on a `::after`
  pseudo-element the heuristic can't read.)
- **Three apps are axe-clean in both themes:** ProgGenie, PickPCS,
  Exquisite Fingerings. Chord Dictionary is clean in dark, 2 nodes off in
  light.
- The real work clusters in **four buckets**: two theme-application
  regressions, a batch of **critical** name/ARIA gaps (Serpe, Vane,
  PitchFold), zoom-disabled viewports in the three esbuild plugin UIs, and
  systematic sub-24 px touch targets (native checkboxes + bespoke buttons).

## P1 — Critical (blockers for AT users)

| App | Rule | Nodes | What it is |
|---|---|---|---|
| Serpe | `select-name` | 3 | The `Field` helper renders `<label>text</label><select>` as *siblings* — no `for`/wrapping, so the Generators/Timing selects have **no accessible name**. Systemic to the `Field` pattern (`main.jsx`). |
| Serpe | `label` | 4 | Same root cause in the `Slider` helper: `<input type=range>` never associated with its label text (Onsets/Steps/Rotation/…). |
| Vane | `aria-required-attr` | 17 | Every custom drag `[role="slider"]` (`.track`, Morph/Pulse Width/Wavefold/…) lacks `aria-valuenow` (and `valuemin/max`) — screen readers can't read or operate any synth parameter. |
| Vane | `select-name` | 1 | The standalone MIDI-in `<select>` (injected by `synth-main.js`) has no accessible name. |
| PitchFold | `label` | 1 | An unlabeled `<input>` (scale-editor). |

**Theme-application regressions** (functional, found via `data-theme=null`
under a persisted dark preference):

- **MIDIcurator no longer calls `initTheme()`** — it was lost when
  `ThemeToggle.tsx` was retired for the shared cluster (the old component
  carried the init). The cluster toggle *works*, but a persisted choice is
  ignored on load: a dark-mode user gets light on every launch until they
  re-toggle. One-line fix in `src/main.tsx`.
- **Exquisite Fingerings never calls `initTheme()`** (pre-existing — the old
  G4 toggle read `resolvedTheme()` only for its label). Same symptom.
- The **showcase index** doesn't participate in theming at all (static
  generated page, no toggle) — acceptable by design, but see its AA fails
  below.

## P2 — Serious (WCAG AA failures)

**Color contrast** (all app-local styles; tokens are clean):

| Page | Theme | Nodes | Culprits |
|---|---|---|---|
| site index | both | 10 (+1 `link-in-text-block`) | `.eyebrow`, `.sub` grays in `build-site` styles; footer link distinguishable only by color |
| Vane | light 17 / dark 6 | header `.chip` spans, `label > span` — `--vn-muted` on tinted chip backgrounds (the alias fixed body-on-paper, not text-on-tint) |
| MIDIcurator | both, 7 | `h2 > span` build tag, `.mc-btn--gen-toggle`, `.es-eyebrow` on `--mc-*` surfaces (bespoke `mc-` palette drifts from token bars) |
| Serpe | light 10 / dark 2 | `.ok` parse-status green, `.upi-chip b` ink, `feat-badge.web` tint in dark |
| DrawnQurve | 3–4 | transport/beat labels (ink50-on-bgDeep combinations) |
| Chord Dictionary | light 2 | `.es-link`, one table cell |
| PitchFold | light 1 | active scale-bank tab ("Ionian") |
| Style Gallery | both 1 | `#pcs-pad` chip 11 — the **exact Exquis LED red** with per-pad ink at 4.48:1; intentional device-accurate swatch, passes the ≥3:1 large-text/pad bar but not 4.5 small-text. Advisory: bump chip text size or annotate as decorative swatch. |

**Structure:**

- DrawnQurve `nested-interactive` ×4 — lane rows are `div[role=button]`
  wrapping real `<button>`s (visibility eye, clear) — inner controls are
  unreachable/ambiguous to AT. Needs the row to stop being a button or the
  inner buttons to move out.
- Style Gallery `aria-prohibited-attr` ×1 — pcs-ring root-marker `<circle>`
  carries `aria-label` with no role (shared `pcs-ring.js`, so it repeats in
  every adopter; fix once in the component with `role="img"` or drop).

## P3 — Moderate

- **Zoom disabled** (`meta-viewport`, WCAG 1.4.4): Serpe, PitchFold,
  DrawnQurve ship `user-scalable=no`/`maximum-scale=1`. Understandable for
  plugin WebViews (pinch is a performance gesture there), but the same file
  serves the public web build. Recommend dropping the restriction on web
  (or gating the meta by runtime).
- **Reduced-motion gaps:** shared `components.css` animations are guarded or
  token-zeroed, but two bespoke ones aren't: Serpe's `.tbtn.play.on` pulse
  (infinite — exactly what `prefers-reduced-motion` exists for) and
  MIDIcurator's `slideIn` (one-shot, minor).

## P4 — Touch targets (iPad / coarse pointer)

WCAG 2.5.8 minimum is 24×24; the house rule (DESIGN.md) is **44 px on
coarse pointers**.

- **Below 24 px (hard fails):** native checkboxes render 13×13 everywhere
  they survive (Exquisite ×4, Serpe ×1, Vane ×1, gallery demos ×2);
  DrawnQurve's rail-collapse arrows (6×36, 10×36) and two icon buttons
  (16×16, 18×14); PitchFold's bespoke `PAPER` buttons/selects (19–23 px
  tall — they don't consume `--es-ctl-h`, so coarse-pointer scaling never
  reaches them); site-index nav/footer links (15–22 px tall); Exquisite's
  native range sliders (16 px tall); Vane's preset-menu select (20×16);
  Chord Dictionary's `.es-link` (16 px tall).
- **The leadsheet caret** (`.es-ls-caret`, ProgGenie + gallery) measures
  16 px wide — the design doc promises "44 px hit zones on touch" for
  carets; the widening never shipped.
- **House-rule tension, suite-wide:** `.es-btn.es-small` pins 32 px even on
  coarse pointers (20+ instances per app in the cluster/toolbars). Meets
  WCAG 24 px, misses the house 44 px bar. Decide: scale `es-small` under
  `pointer: coarse`, or amend DESIGN.md to bless 32 px for secondary chrome.

## Clean bills

- ProgGenie, PickPCS, Exquisite Fingerings: axe-clean, both themes.
- Focus visibility: no genuine failures anywhere.
- No console/page errors in any app under audit (site-index 404/cert noise
  was audit-sandbox artifacts; all referenced assets exist).

## Suggested fix order

1. `initTheme()` in MIDIcurator `main.tsx` + Exquisite `app.js` (two lines,
   user-visible bug).
2. Serpe `Field`/`Slider` label association + Vane slider `aria-valuenow` +
   the two unnamed selects (unblocks AT operation of both instruments).
3. Contrast batch: site-index grays, Vane chip inks, MIDIcurator `mc-`
   surfaces, Serpe status greens, DrawnQurve labels, Chord Dictionary
   `.es-link` (tokens already provide passing values — mostly re-pointing).
4. Viewport zoom + reduced-motion guards (three files, one rule each).
5. Touch-target pass: style native checkboxes (or swap for the es control),
   widen carets per spec, PitchFold button heights on coarse, and the
   `es-small`-on-coarse decision.
