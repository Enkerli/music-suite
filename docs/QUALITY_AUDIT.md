# Quality audit — security · bugs · usability · accessibility · consistency

*Started 2026-07-22. Lens set distinct from `SUITE_AUDIT.md` (which covered
functional-reality / build / identity). The throughline here is the one
that prompted it: **do the current tools actually behave the way the docs
describe?** Assessment is **behaviour-based** wherever the environment
allows — the CLI, the packages, and the bridge were actually run, not just
read. What needs a running app or a device is marked for a later phase, not
guessed at.*

## Coverage & method (honest)

**Phase 1 (this pass) — behaviour-verified from this container:** the
`msuite` CLI, the `@enkerli/*` packages (full test suite), and the
`msuite bridge` server were executed and their behaviour compared to the
docs. Security focused on the one network surface that actually exists (the
bridge) plus a static scan of code-execution / HTML-injection sinks.

**Not yet covered (needs a later phase):** usability and accessibility of
the eleven webapps need the apps *running* (Playwright + axe for a11y,
manual heuristic passes for usability) — reading source can't substitute
for that, and this container has no live app/device/DAW. The plugin repos'
C++ was out of scope here (see `SUITE_AUDIT.md` finding 2 for their
"not build-verified" risk). Treat the a11y/usability sections below as
*pointers*, not verdicts.

Severity: **HIGH** / **MED** / **LOW** / **OK** (verified sound).

---

## Security

| Finding | Sev | Behaviour observed | Note / fix |
|---|---|---|---|
| **The bridge is cross-origin-drivable while it runs.** `msuite bridge` serves `Access-Control-Allow-Origin: *` **and** `Access-Control-Allow-Private-Network: true` — confirmed live, even for `Origin: https://evil.example`. So while the bridge is running, *any* web page the user has open can `POST /send` a control message and drive their workspace (play notes, set params). | MED | Live: `OPTIONS /send` from a hostile Origin returns `ACAO: *` + PNA `true`. | **Not RCE** — every message is schema-validated (below), so the blast radius is "valid control-plane traffic": sound/param changes in the user's tabs, not code execution or file access. It's localhost-bound (not network-exposed) and the wide-open CORS is deliberate (the "any HTTP client" design goal, documented in `bridge.ts`). But the threat model — *any* open tab, not just the user's own workspace page — deserves an explicit line in `CONTROL_PLANE.md`, and an optional shared-secret/Origin-allowlist mode is worth considering for anyone who leaves the bridge running. |
| **The bridge strictly validates every message** — bad input is rejected, not processed. Confirmed live: a partial `{"type":"note",…}` and garbage both returned **HTTP 400 "not a valid SuiteMessage"**; only a full validated envelope (`protocol`/`v`/`id`/`from`/`to`/`sentAt`/`type`/`body`) is fanned out. | OK | Live POST tests. | No change — this is the mitigation that keeps the finding above at MED not HIGH. |
| **Bind address is localhost only** (`127.0.0.1`), not `0.0.0.0`. | OK | `bridge.ts:150`; startup log "listening on http://localhost:8799". | Correct — the bridge is not reachable from the network. |
| **No runtime `eval`/`exec`/child-process in app or package source.** The only `execSync` calls are in build scripts (`WebUI/build.mjs`, now macOS-guarded) and `db.exec` is sql.js SQL, not shell. | OK | source scan (dist bundles excluded). | No injection surface found in runtime code. |

### The `innerHTML` sinks — reviewed and cleared (Phase 3)

Every `innerHTML` / `insertAdjacentHTML` / `dangerouslySetInnerHTML` in app
and package **source** was read (built bundles excluded). Result: **one real
sink, fixed; everything else clean.**

| Site | Verdict |
|---|---|
| **`apps/vane/synth-main.js` — MIDI device list** | **REAL SINK, FIXED.** Port names went into `innerHTML` raw: `` `<option value="${p.id}">${p.name}</option>` ``. A MIDI port name is external input — the OS supplies it, and *any local software can register a virtual port under a name it chooses*, so a crafted name was an injection vector. Rebuilt with DOM APIs (`createElement` + `textContent`), which never parse markup. [MED → fixed] |
| `packages/ui/components/library-browser.js` | **Clean, deliberately.** `esc()` covers `&<>"`, and `highlight()` escapes *every* segment around the `<mark>` (its docstring says "HTML-escaped"). User-controlled library item names are escaped on both the display and rename paths. |
| `apps/exquisite-fingerings/src/app.js` (~25 sites) | **Clean.** Interpolates only engine-computed values — ergonomic scores, finger numbers, pitch classes, internal recommendation strings. No external or user-authored text reaches these templates. |
| `apps/serpe/main.jsx`, `apps/chord-dictionary/src/App.jsx` | **Clean.** `dangerouslySetInnerHTML` carries locally-generated SVG (an icon constant; a chord-circle built from numbers), not external text. |

Not covered: the plugin WebViews' C++-side message handling (needs the JUCE
side, out of scope for this container).

---

## Consistency / doc-sync — the throughline

**Behaviour-verified counts vs. what the docs claim:**

| Doc claim (`INVENTORY.md`) | Reality (measured) | Verdict |
|---|---|---|
| "Packages (**13**)" | **14** dirs under `packages/` — `voice-routing` missing from the list | **STALE** → fixed this pass |
| "Workspace modules (**15**)" | **18** keys in `modules.js` `MODULES` — `pcs-pads`, `voice-split`, `mono-merge` missing | **STALE** → fixed this pass |
| "`msuite` CLI (**14 commands**)" | **14** dispatch cases, names all match | **OK** — in sync |

The pattern is specific and telling: `INVENTORY.md` — the doc that
explicitly says *"if it isn't listed here it won't get documented … update
this file in the same commit that adds a deliverable"* — was **not** updated
when the KT-item-8 work added the `voice-routing` package and the three new
Workspace modules. So the drift is exactly the recent additions, and the
suite's own stated documentation discipline is the thing that lapsed. Both
counts/lists are **corrected in this pass**; the deeper lesson is that the
"update INVENTORY in the same commit" rule needs enforcing (a CI check that
counts `packages/*`, `MODULES` keys, and CLI cases against the doc would
catch this mechanically).

**Behaviour spot-checks where docs make a concrete claim — all matched:**

- `msuite pattern "E(3,8)"` → `binary 10010010` (docs' documented tresillo). ✅
- `msuite chord 60 64 67 --notes` → `root C · quality maj · pcs [0 4 7]`. ✅
- Full test suite: **1528 passed**. ✅

---

## Bugs

No defect found in this pass. The behaviour spot-checks matched their
documented output, the bridge validated correctly, and 1528 tests pass. The
largest *latent* bug risk in the suite is unchanged and lives elsewhere:
`SUITE_AUDIT.md` finding 2 — the plugin C++ committed "not build-verified"
(never compiled/DAW-tested). That needs a Mac, not this container.

---

## Usability (pointers — needs a running-app phase)

- **`chord` help under-specifies its input.** `msuite chord <values…>` accepts
  only *numeric* MIDI/pcs values, but the help doesn't say so, and a natural
  `msuite chord C E G` returns a terse `numeric MIDI notes (or pcs) required`.
  [LOW] Fix: say `<midi-notes…|--pcs mask>` in the usage line, or accept note
  names. Verified live.
- The eleven webapps' task flows (empty states, error surfacing, first-run
  clarity) need a heuristic pass with the apps actually running — see the
  existing `UX_AUDIT.md` / `UX_AUDIT_2026-07-19.html`; this pass did not
  re-verify them against current code.

## Accessibility (pointers — needs axe + keyboard passes on live apps)

- Recent primitives were built to the a11y contract and are worth
  *confirming* live: `.es-knob` (keyboard + `aria` value semantics), the
  Serpe rings (a real contrast bug was caught and fixed — `KT_SUMMARY.md`
  limitation 1), the Workspace hold-pad (`prefers-reduced-motion` honoured).
- The standing plan/record is `A11Y_TEST_PLAN.md` + `A11Y_AUDIT.md`; this
  pass did not re-run axe against the current builds. A behaviour-based a11y
  phase = Playwright + `@axe-core` on each deployed app + a keyboard-only
  walkthrough.

---

## Phase 2 — the apps, run for real (2026-07-22, same day)

*Method: this container's egress policy blocks `enkerli.github.io` (403
CONNECT), so the pass ran against the **same artifacts Pages serves** —
`docs/` from this repo at current `main`, served locally, driven by real
Chromium (Playwright) with axe-core injected. Identical bytes; only
GitHub's CDN layer is out of the loop.*

**All 11 apps, loaded and probed** (workspace · proggenie · midicurator ·
serpe · pitchfold · vane · drawnqurve · pickpcs · chord-dictionary ·
exquisite · style-gallery):

| Check | Result |
|---|---|
| Loads + UI actually mounts | **11/11** — real DOM (95–6754 elements), real text, no blank shells |
| Console/page errors | **0 real errors.** One benign 404 (browser's automatic `/favicon.ico` probe — no app ships one; cosmetic) |
| axe-core, critical/serious | **0 across all 11 apps** [OK] |
| axe-core, moderate | 1–3 per app, and it's the *same* structural trio everywhere: `landmark-one-main`, `page-has-heading-one`, `region` — a shared-shell pattern (wrap the app root in `<main>`, one `<h1>`, landmark the panels). One sweep through the shared frame fixes most of it. [LOW] |
| Keyboard: focus after 3 Tabs | **11/11** land on a real control (`.es-btn`/`.es-control`/`.es-tab`/`.icon-btn`) — the tab order enters actual UI, not a focus trap or void |

**The flagship documented workflow, end-to-end and full duplex** (BUILD.md
§3 / CONTROL_PLANE / the bridge docstring) — a real `msuite bridge`
process, the real Workspace app in Chromium, the real UI controls:

1. Add-module select → Bridge module → **connect** → status
   `"connected · in 0 · out 0"`. ✅
2. CLI→browser: a `makeNote("external", …)` POSTed to `/send` → HTTP 204 →
   module status `"in 1"` — the message crossed into the tab. ✅
3. Browser→CLI (**full duplex**, the specific documented claim): clicking a
   key in the Keys module produced a validated NDJSON `note` message on the
   bridge process's **stdout** — exactly what `… | msuite bridge | msuite
   recv` promises. ✅

**One footgun noted, not a bug:** the protocol's `make*` helpers will
happily *construct* an envelope with a sender that `validateMessage` then
rejects ("from: not in the app vocabulary") — e.g. `"workspace"`, which is
deliberately not an app id (the Workspace sends as `"external"`; documented
in `modules.js`). TypeScript's `AppId` type protects compiled callers;
plain-JS callers get a runtime rejection with a clear error. Worth one line
in `CONTROL_PLANE.md`'s vocabulary section. [LOW]

## Phase 3 — the fixes, measured (2026-07-22)

### Accessibility: 11/11 apps now report **zero** axe violations

Not "zero serious" — **zero at any impact level**, verified by re-running
the same axe-core pass that produced the Phase-2 numbers.

| App | moderate violations before → after |
|---|---|
| proggenie · midicurator · serpe · pitchfold · vane · drawnqurve · pickpcs | 3 → **0** |
| chord-dictionary · style-gallery · workspace | 2 → **0** |
| exquisite | 1 → **0** |

The fix was found empirically rather than assumed — variants were tested
against axe and the winner kept:

1. **Promote the mount root to `<main>`** (`<div id="root">` →
   `<main id="root">`). Because these apps style `#root` *by id*, the CSS is
   untouched and there is no wrapper element — **zero layout risk**. This one
   change cleared `landmark-one-main` **and every `region` violation** (8 of
   them on PitchFold alone): once all content sits inside a landmark, the
   rule is satisfied wholesale.
2. **Add the missing `<h1>`.** Where the design has no visible heading, a
   `.es-sr-only` one inside a `<header>` landmark (visually hidden, still
   announced). Where a visible title already existed, **promote it** — the
   Workspace's "Suite Workspace" brand `<span>` became a real `<h1>`, which
   is the honest fix; its CSS gained `font-size:inherit;margin:0` so the h1
   defaults (2em, .67em margins) can't break the flex topbar.

**Verified against regressions, not assumed:** PitchFold before/after
screenshots are **byte-identical** (59435 bytes both) with +2 hidden
elements; the Workspace was screenshotted after its visible-h1 change and
renders correctly; the full suite still passes **1528 tests**.

Two findings worth keeping, both discovered by measuring:

- **`<header class="es-sr-only">` backfires on a page that already has a
  banner.** Adding it to the Workspace produced *new* violations
  (`landmark-no-duplicate-banner`, `landmark-unique`). But a bare
  `<h1 class="es-sr-only">` then failed `region` — it sits outside every
  landmark. The resolution is the rule above: **prefer promoting a real
  visible heading**; reach for the hidden one only where no landmark exists
  to collide with.
- `.es-sr-only` now lives in `@enkerli/ui`'s tokens as a suite primitive —
  but it is **also inlined** in each app's `<style>`, deliberately: the
  heading must be hidden from the *first paint*, before any bundle's CSS
  loads, or the title flashes visibly.

### Consistency: the drift can no longer recur silently

`scripts/check-inventory.mjs` (also `npm run check-inventory`) counts the
real `packages/*` directories, the `MODULES` registry keys, and the CLI's
dispatch cases, and fails if `INVENTORY.md` disagrees — on **counts and on
names**, since a swap keeps the number and still drifts. It runs in CI
(`deploy-pages.yml`) ahead of the site build. Currently green: 14 packages ·
18 modules · 14 commands. The file's own stated rule — *"update this file in
the same commit"* — is now enforced by something other than good intentions.

## Still open — and honestly, not closable from here

1. **Plugin C++ build-verify** (`SUITE_AUDIT.md` finding 2) — code committed
   without ever being compiled. Needs a Mac + DAW. **This remains the
   suite's largest single quality risk.**
2. **Deployed-site spot check from a normal network** — this container's
   egress policy blocks `enkerli.github.io`, so every app result above came
   from the identical `docs/` artifacts served locally. A one-minute look at
   the live URLs closes the CDN gap.
3. **PitchFold's dead params** (Mono Merge / Swing) — a keep/cut/build
   decision, not a defect (`SUITE_AUDIT.md` finding 5).
4. **Usability beyond the CLI nit** — first-run clarity, empty states, and
   error surfacing across 11 apps is a heuristic review with a human in the
   loop, not something axe or a script can score.
