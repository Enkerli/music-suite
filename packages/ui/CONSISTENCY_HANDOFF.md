# Suite consistency — design handoff brief

*Input brief for a Claude Design pass. Prepared 2026-07-10 from a live audit of
all ten apps at `apps/*`. No code changed yet — this tells the designer what to
design. Companion to `packages/ui/HANDOFF.md` (the design system) and
`DESIGN.md` (the requirements/invariants); read those first, they still hold.*

## The ask in one sentence

The suite's **features** have matured but its **frame** has drifted: every app
solves the same three chrome problems — the theme toggle, MIDI I/O, and the
save/recall library — in its own vocabulary and its own corner of the screen, so
a musician who learns one app can't find the same control in the next. **Design
one shared frame** (shell + three recurring chrome patterns) that every app
drops into the same slots, without disturbing each app's actual working surface.

This is a *consistency* pass, not a feature pass. The wins are: a musician always
knows where the theme switch, the MIDI picker, and their saved things live —
because they never move.

## What already exists (don't re-solve)

- **`@enkerli/ui`** — the paper-&-ink system: `tokens.css`, `components.css`
  (`.es-app/.es-panel/.es-section/.es-btn/.es-control/.es-eyebrow/.es-badge/…`),
  `theme.js` (`initTheme/toggleTheme/resolvedTheme`, `[data-theme]` on `<html>`,
  persisted to `localStorage["enkerli.theme"]`).
- **`.es-device-select` / `.es-device-bar`** chrome already exists in
  `components.css` (icon · name · status LED + word · `<select>` · empty state,
  driven by `[data-state]`). Three apps use it; it is the MIDI reference.
- **`@enkerli/library`** (`packages/library`) — "the suite content model:
  LIS-informed envelope for presets/patches/progressions/profiles." It already
  exports `wrapProgression / wrapClip / wrapPatch / wrapCurationProfile` +
  `validateEnvelope`. It is the save/recall reference — but is barely adopted.
- **Live spec:** `apps/style-gallery` renders the whole system with a theme
  toggle. New shared chrome should land there first.

The design language is settled and must not change. What's missing is **shared
placement and shared naming** for the recurring chrome — and, in three cases,
**shared components** where apps currently hand-roll.

---

## The current state, from the audit

### Layout archetypes (10 apps → 4 skeletons, no shared shell)

| Archetype | Apps | Shape |
|---|---|---|
| **A · Sidebar + canvas** | exquisite-fingerings, MIDIcurator | 300px control rail left, big canvas right; title lives *inside* the rail |
| **B · Top bar + body** | serpe, vane, pitchfold, drawnqurve | full-width top bar (brand + transport + global controls); stage + rail/tabbed body (the JUCE-plugin shape) |
| **C · Centered column** | chord-dictionary, progression-studio, style-gallery | `.es-app`, centered header + stacked panels (the most system-native) |
| **D · Chrome-less canvas** | PickPCS | centered radial canvas, no header, no global chrome |

There is **no shared shell component**, headers appear/disappear/relocate, and
even `maxWidth` disagrees (900 / 1080 / 1100 / 1200). Design-system adoption
splits three ways: native `.es-*` structure (chord-dictionary, progression-studio,
style-gallery, exquisite-fingerings, serpe-partial); tokens-only bespoke
(MIDIcurator `mc-`, PickPCS inline); **entirely separate token systems** in the
three JUCE prototypes (vane `vn-*`, pitchfold + drawnqurve `PAPER`).

### 1. Theme toggle — 7 of 10 have one, no two alike

- **Missing:** PickPCS (no theme code at all), drawnqurve (shipped build; a
  bespoke toggle exists only in a design mock).
- **Label is all over the map:** `● Dark / ☀︎ Light` (chord-dictionary,
  exquisite-fingerings, progression-studio — the de-facto standard) · icon-only
  `☾/☀` (MIDIcurator), `◑/☀` (pitchfold), `◐` (vane) · `☾ Dark / ☀ Light`
  (serpe) · `◐ theme`, which never names the mode (style-gallery).
- **Position varies five ways:** top-bar right (pitchfold, serpe, vane,
  style-gallery), sidebar-header top (MIDIcurator, exquisite-fingerings), or
  buried at the far-right end of a generic controls row (chord-dictionary,
  progression-studio).
- **Four apps bypass the shared module:** serpe, vane, and pitchfold are fully
  bespoke — **pitchfold never sets `[data-theme]` at all**, so its dark mode is
  disconnected from the token system and won't persist; style-gallery uses the
  shared functions but imports them by relative path, not the package alias.
- **Element identity is inconsistent:** only exquisite-fingerings (`#themeToggle`)
  and style-gallery (`#theme-toggle`) expose a stable id, and they disagree on
  spelling; the rest are class-only or inline (`es-btn`, `iconbtn`, `icon-btn`,
  `mc-theme-toggle`).

### 2. MIDI I/O (web) — shared chrome exists but half the apps ignore it

- **Uses shared `.es-device-select`:** progression-studio (`MidiOutSelect`, the
  reference), MIDIcurator (`MidiOutBar`), serpe (`DeviceSelect`, the only app
  showing a stacked In+Out pair).
- **Rolls its own:** pitchfold (`DeviceSel`, inline "paper" styles — *and its
  code comment falsely claims it uses the shared chrome*), exquisite-fingerings
  (`#midiDevice` select + an "Enable MIDI" gating button no other app has), vane
  (a `<select>` chip injected into the header), PickPCS (no selector at all —
  just a "Push scale ⇢" SysEx broadcast button).
- **No MIDI:** chord-dictionary, style-gallery (exclude from this pattern).
- **Naming diverges** even among shared-chrome users: name label is
  `MIDI Out`/`MIDI In` vs terse `In`/`Out` vs just `MIDI` vs `MIDI Device`;
  status words are `internal/none/unavailable` vs `select…/none`; empty states
  are `Internal (Web Audio)` vs `No MIDI devices found` vs `-- No devices --` vs
  `MIDI not available (use Chrome/Brave/Edge)`.
- **Structural gaps:** the shared component only has an *output* precedent
  (serpe's stacked In+Out is the sole two-endpoint case); the DIN-5 MIDI icon is
  copy-pasted inline in every adopter (drift risk); SysEx capability
  (PickPCS, exquisite-fingerings request it) is never surfaced in any selector.

### 3. Presets / patterns / library — the same idea under a dozen names

The user's exact complaint: these are "much better now yet difficult to identify
in each app." The audit confirms it — the save/recall concept appears under
**at least ten different nouns**, in **seven different screen locations**, with
**mostly bespoke persistence**:

| App | The savable thing(s) | Called | Where it lives | Persistence | Shared `@enkerli/library`? |
|---|---|---|---|---|---|
| progression-studio | progressions · generator params · curation | **Library** · **Patch** · **Your profile** | doc strip · actions-row segment · dedicated panel | `localStorage` (progressions, curation) + file (patch, profile) | **Progressions only** (patch/profile use bespoke JSON) |
| MIDIcurator | clips + tags + flagged | *(never labeled — just the clip list)* | left sidebar, always-visible list | IndexedDB (browser) / envelope JSON (plugin) | **Plugin backend only** |
| exquisite-fingerings | patterns · handprints · chord fingerings | **Patterns** · **Saved handprints** · **Saved chord fingerings** | one card + two disclosures **3 levels deep** | `localStorage` (bespoke `storage.js`) | No — *and an orphan-key bug: suggestion-saves write `fingeringPatterns`, the list reads `exquisPatterns`, so they never show up* |
| serpe | saved patterns · history · scenes | **Presets/Library/History** tabs · **Scenes** | right rail, **collapsed** disclosure | `localStorage` (`serpe.*`); scenes not persisted | No |
| drawnqurve | saved curves | **Qurve Library** — *but the trigger button says "SHELF"* | bottom slide-up drawer | `localStorage` (`dq-library`) | No |
| pitchfold | chord pads, scale bank | *"Save" on pad editor* | Pads tab, inline popover | **none in browser** (host-side only) | No |
| PickPCS · chord-dictionary · style-gallery | — | none | — | — | — |
| vane | presets · rig/controller profiles · chord shapes | **Presets** · **Rig** · **Chord library** | header preset-nav + a Presets tab · a modal · a conditional inline shelf | plugin: C++/APVTS via bridge; standalone: `localStorage` (presets only; profiles/shapes not web-persisted) | No |

`@enkerli/library` was *built* to be the one envelope for
presets/patches/progressions/profiles, and even exports the wrap helpers for each
— yet only two apps touch it, each partially. This is the biggest single
consistency lever in the suite. Vane alone illustrates the problem in miniature:
**three** user-savable collections ("Presets", "Rig", "Chord library") in three
different placements (header nav + tab, a modal, and a mode-gated inline shelf),
none of them using the shared package.

---

## What we need designed

Four deliverables. Each should be shown in **both themes** and at **web and
small-plugin widths**, using only `@enkerli/ui` tokens.

### D1 · A shared app shell with fixed chrome slots

Not one rigid layout — the bodies genuinely differ (a radial picker, a hex grid,
a leadsheet, a clip list). Instead design **a shell with named, always-in-the-
same-place slots** that every archetype fills identically:

- A consistent **top chrome bar** (or its sidebar-header equivalent for
  archetype A) with fixed regions: **brand/title** (left) · optional
  **transport** (center, host-owned in plugins) · **global-controls cluster**
  (right).
- The **global-controls cluster** is the constant: theme toggle, MIDI status,
  density toggle, and the library entry point all live here, in this order,
  in every app. A musician's eye goes to the same corner every time.
- Show how the shell maps onto all four archetypes (A/B/C/D) — including how
  PickPCS and drawnqurve gain a minimal chrome bar without losing their canvas.
- Pick one canonical `maxWidth` for the centered family.
- **All ten apps target `@enkerli/ui`.** For vane, pitchfold, and drawnqurve,
  show the shell in their migrated (`--es-*`) form, and include a token-mapping
  note (`vn-*`/`PAPER` → `--es-*`) so the C++ WebView builds can follow.

### D2 · The one theme toggle

- **One control, one spec:** settle the label (recommend the de-facto
  `● Dark / ☀︎ Light` — it names the target mode, which the icon-only and
  `◐ theme` variants don't), one glyph set, one stable id/class, always in the
  global-controls cluster (D1).
- It must be the shared `toggleTheme()` from `@enkerli/ui/theme` — show the
  target state for the four apps that currently bypass it (serpe, vane,
  pitchfold, style-gallery) and the two that lack it (PickPCS, drawnqurve).

### D3 · The one MIDI I/O pattern (web apps)

- Extend the existing `.es-device-select` into the **canonical MIDI panel**:
  a settled **In/Out** labeling, one status vocabulary (connected / none /
  unavailable), one empty state, the DIN-5 icon promoted to a **shared** asset
  (stop copy-pasting it), and a **two-endpoint (In + Out) layout** as a
  first-class case (serpe is the only precedent — generalize it).
- Define its **home in the shell** (recommend a collapsible `MIDI` section in
  the control rail / a slot in the global cluster — pick one and hold it).
- Show the **"no Web MIDI" / SysEx-capable** states as part of the component,
  so exquisite-fingerings' "Enable MIDI" gate and PickPCS's SysEx broadcast fold
  into one vocabulary instead of bespoke strings.
- Web apps only, per the brief; the JUCE hosts own their own MIDI routing.

### D4 · The one save/recall "Library" pattern

The headline win. Design a **single recognizable Library surface** and a
**shared naming rule** so every saved-thing reads as the same kind of object:

- **One entry point, one icon, one place** in the shell's global cluster —
  labeled with a consistent noun. Recommend **"Library"** as the umbrella, with
  the app's content type as the subtitle (Progressions / Clips / Patterns /
  Curves / Rhythms). Kill the synonyms that hide the feature: drawnqurve's
  "SHELF" vs "Qurve Library" split, MIDIcurator's unlabeled clip list,
  exquisite-fingerings' feature buried 3 disclosures deep.
- **One card/list treatment** for saved items (name · meta · source badge ·
  recall on tap · delete), reused across all six apps that persist something.
- Distinguish the **three sub-kinds** the suite actually has, consistently:
  **documents** (progressions, clips, curves, fingering patterns),
  **patches** (generator/parameter snapshots), and **profiles** (taste/curation).
  Same visual family, clearly typed — this maps 1:1 onto `@enkerli/library`'s
  existing `wrapProgression / wrapClip / wrapPatch / wrapCurationProfile`.
- Show the **empty state** and the **save affordance** ("Save current …") in the
  same place every time.

---

## Constraints (inherited — the designer must honor)

- **Paper-first.** Warm cream light is the default target; dark is a first-class
  one-tap variant. Tokens only — no hardcoded colors.
- **WCAG AA on both themes** (machine-checked): text ≥4.5:1; accents, focus
  rings, `--es-border-strong`, and all 12 pitch-class colors ≥3:1 on `bg` and
  `bg-raised`. Never color-only — every hue pairs with a label/dot.
- **Touch ≥44px** on coarse pointers (`--es-ctl-h` scales); **plugin windows are
  small and fixed** → chrome must survive as a `.es-section` stack with `.es-dense`.
- **Border discipline:** `--es-border`/`-soft` decorative; anything a user
  identifies as a control uses `--es-border-strong`.
- **No modal `confirm/prompt/alert`** — destructive actions use the two-tap
  inline confirm (the "Reset armed" pattern already in the suite).
- **No blob/data downloads in WebView** — saves route through the native
  file/bridge path, with the browser `<input type=file>` / anchor as fallback.
- **Host-owned transport** in plugins — no play button competes with the DAW.
- **Localization-ready:** no concatenated strings; layouts tolerate +35% growth.

## Decisions (resolved 2026-07-10)

1. **Scope — ALL TEN apps, full migration.** vane, pitchfold, and drawnqurve run
   on *separate token systems* (`vn-*`, `PAPER`), not `@enkerli/ui`. This pass
   opts them fully in: the shared frame covers all ten, and the three JUCE
   prototypes **migrate off their bespoke tokens onto `@enkerli/ui`** as part of
   the work. This is the larger lift — it touches the C++ WebView bundle builds
   (`build.mjs` in each plugin repo, with the WKWebView smoke gate) and both
   themes must be re-QA'd on-device — but the target is total consistency, no
   two-tier suite. The designer should treat `vn-*`/`PAPER` surfaces as
   translation targets: map each bespoke token to its `--es-*` equivalent and
   flag any that have no clean mapping.
2. **Umbrella noun — "Library."** One word, suite-wide, with the app's content
   type as subtitle (Progressions / Clips / Patterns / Curves / Rhythms). Retire
   the synonyms (SHELF, Qurve Library, the unlabeled clip list, Patches-as-its-
   own-thing) into this one surface, sub-typed by kind (document / patch /
   profile).
3. **Theme label.** Ratify `● Dark / ☀︎ Light` as canonical (recommended), or
   pick another single spec — open, designer's call within the pass.
4. **MIDI home.** Global-cluster status chip vs a dedicated rail section — pick
   one so it never moves — open, designer's call within the pass.

## Deliverables we want back from the Design agent

An HTML/CSS prototype set (the usual Claude Design medium), covering:

1. The **shared shell** (D1) shown across all four archetypes, both themes, web
   + plugin widths.
2. The **theme toggle** (D2), **MIDI panel** (D3), and **Library surface** (D4)
   as standalone component specs *and* shown in-context in 2–3 representative
   apps each (e.g. Library in progression-studio + MIDIcurator +
   exquisite-fingerings; MIDI in serpe (In+Out) + progression-studio (Out)).
3. A short **naming + placement table**: for each recurring control, the one
   canonical label, glyph, id/class, and slot.
4. A **before → after** for at least the worst offenders (theme toggle buried in
   a controls row; the 3-levels-deep exquisite-fingerings library; drawnqurve's
   "SHELF"/"Qurve Library" split).
5. A **token-mapping table** for the three JUCE prototypes (`vn-*`/`PAPER` →
   `--es-*`), flagging any bespoke token with no clean `@enkerli/ui` equivalent —
   the input the plugin `build.mjs` migration will follow.

## Explicitly out of scope

The pitch-class palette and dimension hues (fixed), per-app working surfaces (the
leadsheet editor, the hex grid, the radial picker, the curve canvas — leave them
alone), new features, and the scheduler/free-sync work. This pass moves and
renames chrome; it does not add capability.
