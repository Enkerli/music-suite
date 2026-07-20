# Design audit 2026-07-19 — implementation report

*The audit (Claude Design handoff, archived here as
[UX_AUDIT_2026-07-19.html](UX_AUDIT_2026-07-19.html)) was implemented
2026-07-20 under one rule: only changes with zero functionality loss and
zero regression, verified — everything else recorded, not attempted.
Reference commit at audit time: `ab3d3df`.*

## Implemented (all verified)

| Item | What was done | Verification |
|---|---|---|
| **F2/D2 — Workspace wears the frame** | `apps/workspace`: `initTheme()` + global cluster (theme + density) mounted in the topbar; hardcoded `data-theme="light"` removed from index.html. MIDI/Library cluster slots deliberately omitted — the bus and the Library *module* own those here (noted in code). | Browser: toggle round-trips light↔dark across all modules (workspace.css was already all-token fallbacks), density toggles `es-dense`, zero console errors. 44 app tests. Plugin ladder: auval SUCCEEDED, pluginval PASS. |
| **D2 — checklist line** | `packages/ui/DESIGN.md` requirements checklist gains "Shared frame mounted" (cluster + `enkerli.theme` + density target; never a hardcoded `data-theme`). | Doc change. |
| **D1 — one destructive idiom, recorded** | DESIGN.md now states the split the audit recommends: undo-toast for recoverable item deletes; two-tap armed confirm only for unrecoverable acts. | Doc change (the code migration is queued — see below). |
| **D4/F5 — Vane token-sync check** | New `packages/ui/tools/vane-token-sync.mjs`: parses Vane's inlined `--vn-*` literals (both themes) and compares them to `tokens.css` through the documented mapping; exits non-zero on drift. Wired as `npm run audit-ui` together with the contrast audit. | Runs green against today's Vane (22 mapped pairs × themes); the failure path (DRIFT + exit 1) was exercised live during development. |
| **D3/F7 — build-id cluster slot** | `global-cluster.js` gains `opts.build`: a rightmost, non-interactive `#build-chip` (span, not button). Adopters opt in by passing their stamped id. | Component test (renders, rightmost, clears on `update({build:null})`); 83 UI tests green. |
| **Audit archived** | The audit HTML is preserved as `docs/UX_AUDIT_2026-07-19.html` (tokens link repointed so its theme toggle works on Pages); `docs/UX_AUDIT.md` marked superseded. | — |

## Already satisfied before implementation (audit rows found stale)

Verified against the repo at the audit's own reference commit:

- **F3 — PickPCS**: the audit says "no theme control at all"; in fact
  PickPCS mounted `initTheme()` + the full cluster (theme · MIDI ·
  Library) on **2026-07-10** ("Adopt the shared frame in the five
  remaining web apps") and gained the scale-push bus pair on 07-16. No
  change needed.
- **Adoption-matrix row "chord-dictionary · cluster unverified"**:
  verified — `apps/chord-dictionary/src/App.jsx` mounts the cluster.
- **F6's doc correction** (DrawnQurve platform claim): already fixed
  2026-07-19 in BUILD.md + INVENTORY.md (macOS build proven the same
  day); a sweep of site.md/GLOSSARY/HANDOFF found no remaining claim.

## Recorded, deliberately not implemented (regression risk / scope)

- **F1/F8 medium step — MIDIcurator delete migration** (`confirm.js` →
  undo toast) and the sidebar **vocabulary pass**: behavior change in the
  suite's most data-carrying app; needs its own pass with browser +
  plugin verification. The D1 rule it will follow is now in DESIGN.md.
- **F4/F10 — PitchFold chrome** (cluster, device popover, `theme.js`
  import, `.es-tabs` recipe, pad banks → library): a real UI rework,
  audit-rated Medium; queued.
- **F6 steps 2–3 — DrawnQurve** PAPER sync + qurves as Library content:
  step 1 is mechanical but touches an app with no test harness for its
  webapp; the qurve piece is design-gated (LIBRARY_SPEC finding stands).
- **F9 — i18n**: unchanged by design; the audit itself marks it "restated
  so it doesn't fall off the queue". The `opts.strings` pass-through idea
  is noted for when i18n work starts.
- **Build-id adopters**: the cluster slot exists (D3); per-app
  `__BUILD_ID__` stamping is each app's build-step change and rides the
  next touch of each app.

## Net state

Monorepo tests after implementation: **1348/1348** (+1 build-chip test).
Workspace plugin: full ladder green with the framed UI. The audit's
"sequenced handoff" cheap tier is complete; the medium tier is queued
with its findings preserved above and in the archived audit.

## Medium tier — implemented 2026-07-20 (second pass)

| Item | Outcome |
|---|---|
| **F1/F8 — MIDIcurator delete migration** | The browser-list path already used undo-toast; the detail-pane Delete's confirm carve-out is retired — both paths share `deleteClipFromLibrary`. "Clear all" keeps its confirm (D1's reserved case, re-verified live). Browser round-trip verified (delete → toast+Undo → restored, no dialog); 358 tests; plugin rebundled, ladder green. F8's vocabulary ask was already satisfied (the clip list rides `createLibraryBrowser` since 07-10/07-19). |
| **F4/F10 — PitchFold chrome** | `theme.js` replaces the third private resolvedTheme copy; the global cluster (theme · MIDI popover · density) replaces the hand toggle and the DeviceSel bar (plugin shows "MIDI · native"); scale-received flash became a toast; new `.es-tabs` recipe in components.css adopted for the five tabs (visually identical — PAPER was already es-verbatim). CSS loaders added to both esbuild invocations. Browser-verified end to end; ladder green. **Deferred:** pad banks as library items — APVTS-owned state needs bridge plumbing designed first (audit step 8's arc). |
| **F6 step 1 — DrawnQurve** | **Verified already satisfied** (stale audit row): PAPER/PAPER_DARK are es-verbatim and `enkerli.theme` (with `dq-theme` migration) already shipped. |
| **D4 generalized** | The sync check now covers all three inlined copies (Vane · PitchFold · DrawnQurve; 67 comparisons) as `inline-token-sync.mjs`. Its first version passed **vacuously** (a parser bug emptied the light map, skipping every light comparison) — rewritten with a zero-declarations guard (exit 2) and negative-tested (one perturbed token → three DRIFTs, exit 1). A useful reminder that a green check is only as good as its failure path. |

Still queued from the audit: step 8 (design-gated — qurves as Library
`payloadRef` content; Vane Presets tab onto the browser API), per-app
build-id stamping (slot exists), and the F9 i18n arc.
