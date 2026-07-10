# UX consistency audit — the divergence matrix (Track E4)

*Written 2026-07-06, verified against the repos (grep + firsthand from the
integration work). This is an AUDIT for the planned Claude Design pass —
it names what diverges and what already exists to converge on. It makes no
design decisions: those belong to the pass ([[design-pass-coming]]); the
convergence backlog at the end is Track B work, sequenced after it.*

## 1. Design-system adoption

| App | System | Shared components used | Notes |
|---|---|---|---|
| ProgGenie (progression-studio) | `@enkerli/ui` (es-tokens) | leadsheet-editor, piano-roll, pitch-grid, naming | the deepest adopter; the Q1–Q6 design arc landed here |
| MIDIcurator | `@enkerli/ui` | confirm, naming | **the only app with i18n** (i18next) |
| Serpe | `@enkerli/ui` | tokens+components CSS; **the only `.es-device-bar` adopter** | de-vendored 2026-06-28 |
| chord-dictionary | `@enkerli/ui` | pitch-grid | |
| exquisite-fingerings | `@enkerli/ui` | pitch-grid, pitch-class-colors | Exquis pad palette **not yet** adopted (Track B item) |
| PickPCS | `@enkerli/ui` tokens only | — (inline styles on `--es-*` vars) | |
| style-gallery | `@enkerli/ui` | — | the showcase itself |
| **Vane** | **own**: `--vn-*` vars in a self-contained 2,500-line index.html | — | **doubles as the plugin UI** (embedded via BinaryData) — any convergence must survive the WKWebView/AUv3 path |
| **PitchFold** | **own**: `design/tokens.jsx` (`PAPER`/`PAPER_DARK` JS objects, inline styles) | — | was the "gold standard sibling" the Serpe redesign emulated — its look converged, its *mechanism* didn't |
| **DrawnQurve** | **own** (esbuild `design/juce-ipad.jsx`) | — | native-JUCE UI is still the shipping plugin editor; the webapp is its future |

**Headline: three parallel design systems** (es-tokens CSS · PAPER JS
objects · vn CSS vars) that *look* related — all "paper & ink" — but share
no code. And even inside the es-tokens family, component adoption is thin:
`pcs-ring`, `range-slider`, and `section` have almost no adopters
(range-slider→PitchFold is a named Track B item).

## 2. Interaction-pattern divergence

### Presets / user library (the loudest inconsistency)

| App | What exists | Storage | Envelope (E1)? |
|---|---|---|---|
| ProgGenie | document library + generator patches + curation profiles; four front doors (New·Generate·Open·Import) | localStorage + native-picker files | ✅ progressions (07-05); patches/profiles wrap-ready |
| MIDIcurator | clip library w/ tags, ratings, flags | C++-owned `library.json` over the bridge | ✅ envelope index (07-05) |
| Vane | full Presets tab (search/filters/favorites/rename/duplicate/delete) — standalone; `PresetManager` files — plugin | localStorage (standalone) / app-data (plugin) | standalone entries carry envelopes-like data; plugin files = future `payloadRef` wrap |
| Serpe | presets + scenes | localStorage `serpe.*` (webapp) / ValueTree XML (plugin) | not yet |
| exquisite-fingerings | saved fingering patterns | localStorage (own keys) | not yet |
| PitchFold | chord-pad banks, APVTS state | plugin state / tokens defaults | not yet |
| DrawnQurve | **qurves live only inside plugin state chunks** | — | blocked: not first-class content (LIBRARY_SPEC finding) |
| chord-dictionary / PickPCS / style-gallery | none | — | n/a |

Eight different browse/save/name/organize experiences. The **model** is now
shared (`@enkerli/library`: identity, facets, autocomplete, suggestions) —
**the browser UI is not**. This is the single highest-leverage design-pass
deliverable: one library-browser pattern (list + facet filters + search +
item actions) every app instantiates.

### MIDI device chrome

Three hand-rolled device bars (PitchFold `DeviceSel`, Vane header chips,
Serpe's `.es-device-bar`) plus PickPCS's new push-button-without-a-bar —
all over the same `@enkerli/webmidi` layer. The CSS for a canonical bar
exists (`.es-device-bar/-select/-led/-status`, from the Serpe design pass)
with exactly one adopter. Candidate: promote to a real shared component
(framework-agnostic like the others) and adopt in all four.

### Everything else

| Pattern | Where | Divergence |
|---|---|---|
| Tabs | Vane (Stage·Patch·Matrix·Presets), PitchFold, exquisite-fingerings | three different implementations/looks |
| Theme toggle | 7 apps | `theme.js` (es family) vs hand-rolled (`dq-theme` key, Vane's ◐ chip, PAPER_DARK swap) — three persistence keys, three mechanisms |
| Transport/arming | MIDIcurator, DrawnQurve (+ProgGenie transport) | arming chrome shipped in the design pieces; adoption partial (Track B) |
| Save/export affordance | all content apps | native picker (`FileExport`) vs browser download vs bridge `exportBytes` — mechanism rightly varies by runtime, but *wording and placement* differ per app ("Send to MIDIcurator" naming-the-destination is the best pattern; nothing else follows it) |
| Confirm/undo | ProgGenie two-tap confirm, Serpe delete-undo toast, Vane toast | three idioms for destructive actions (WKWebView killed `window.confirm` — each app solved it separately) |
| i18n | MIDIcurator only | no string extraction anywhere else (DESIGN.md carries the requirement) |
| Status/version chrome | Vane build-id chip + ⧉ MIDI capture | proto-diagnostics only in Vane; worth a suite-wide convention (each app knowing/wearing its build) |

## 3. What already exists to converge on

`@enkerli/ui`: `tokens/tokens.css` + `tokens/components.css` (incl. the
device-bar family, badges, buttons, standalone-chrome gating), `theme.js`,
`confirm.js`, `naming.js`, `icons/`, six framework-agnostic components
(pcs-ring · pitch-grid · piano-roll · section · range-slider ·
leadsheet-editor), the pc-color identity (`pitch-class-colors.js`,
hardware-validated Exquis palette), 51-contract contrast audit, DESIGN.md
checklist, five personas. Plus `@enkerli/library`'s query layer as the
substrate for any library-browser UI.

## 4. Questions for the Design pass (the brief)

1. **One system or three?** Recommend: es-tokens as canonical; PAPER and
   `--vn-*` become *mappings* onto it (PitchFold's PAPER→CSS-var bridge is
   mechanical; Vane needs care — its index.html is also the plugin UI).
2. **The library browser** — one pattern over `@enkerli/library` facets/
   autocomplete/suggestions; what does it look like, and how does it scale
   from 3 items to 300? — **✅ SHIPPED 2026-07-07: `@enkerli/ui`
   `createLibraryBrowser` (config-driven, framework-agnostic) + the
   count-based scaling (rail hides < facetMin). Demoed in the style gallery.
   Adoption in the apps is the remaining rollout.**
3. **Device bar as a shared component** — bless `.es-device-bar` as the
   canonical chrome and spec the component API (ports, remember-by-name,
   status LED, permission states incl. SysEx).
4. **Destructive-action idiom** — pick one of the three confirm/undo
   patterns suite-wide. — **✅ SHIPPED 2026-07-07: `@enkerli/ui` `toast(text,
   { undo })` — optimistic act + undo toast, confirm.js's successor. The
   LibraryBrowser's delete uses it.**
5. **Vane strategy** — restyle in place (vn→es var mapping) vs the fuller
   rework already queued in Vane's own backlog ("preset browser / UX
   rework — revisit with Design").
6. **Suite-wide chrome conventions** — build-id visibility, theme toggle
   placement/persistence key, tab idiom.

## 5. Convergence backlog (Track B homes, post-Design)

Cheap and unblocked regardless of the pass: range-slider→PitchFold output
range (named item) · Exquis pad palette→exquisite-fingerings (named item) ·
one localStorage theme key via `theme.js` everywhere · device-bar component
extraction + 4 adoptions. Medium: PAPER→es-var mapping in PitchFold ·
PickPCS onto real components · arming chrome adoptions. Large (design-
gated): the library browser · Vane convergence · Serpe/Vane/PitchFold
preset UIs onto the browser pattern · i18n string extraction suite-wide.
