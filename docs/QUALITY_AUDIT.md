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

**Static sinks still to review in a deeper pass:** `innerHTML`/
`insertAdjacentHTML` usage in the webapps (present; needs a check that none
interpolate un-escaped bus/leadsheet/user text), and the plugin WebViews'
message handling. Flagged, not yet cleared.

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

## What Phase 2 should do (behaviour-based, as asked)

1. **Run each webapp** (Playwright) and drive its core flow — catch broken
   states and doc-vs-behaviour gaps the source can't show.
2. **axe-core per app** + a keyboard-only pass — turn the a11y section from
   pointers into verdicts.
3. **Clear the `innerHTML` sinks** — confirm none interpolate un-escaped
   external text.
4. **A CI doc-sync check** — count `packages/*`, `MODULES` keys, and CLI
   cases against `INVENTORY.md` so this drift can't recur.
5. **Plugin C++ build-verify** (from `SUITE_AUDIT.md` finding 2) — the one
   thing that fundamentally needs a Mac + DAW.
