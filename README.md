# music-suite

Monorepo for the shared foundations of the Enkerli music suite
(Vane · Serpe · DrawnQurve · PitchFold · MIDIcurator · PickPCS ·
exquisite-fingerings · Progression Studio). See `SUITE_AUDIT_AND_PLAN.md`
in the jazz-progressions workspace for the full architecture.

## Packages

| Package | Purpose |
|---|---|
| [`@enkerli/theory`](packages/theory) | Zero-dependency TypeScript music-theory core: pitch classes, taxicab voice leading (Tymoczko L1), the 167-quality chord dictionary (decimal-fingerprint lookup) and chord detector (exact + subset matching, slash chords) ported from MIDIcurator/MIDIsplainer, and — incoming — PCS classification, Roman-numeral analysis, rhythm algorithms. The **reference implementation**; Lua and C++ ports must match `packages/theory/vectors/*.json`. |
| [`@enkerli/codegen`](packages/codegen) | Emits Lua tables (for PdLua/PlugData) and C++ headers from theory data, so no consumer hand-maintains copies. |
| [`@enkerli/ui`](packages/ui) | Design tokens (CSS custom properties) and, later, shared components (PCS ring, hex grid, piano roll, collapsible-density shell) for webapps **and** JUCE WebView plugin UIs. |
| [`@enkerli/upi`](packages/upi) | Serpe's UPI (Universal Pattern Input) rhythm engine, promoted from `apps/serpe`: notation parser, Euclidean/polygon/Barlow generators, transforms, and analysis — framework-agnostic, leftmost = LSB. Powers `enkerli upi`; the DOM SVG views stay app-side. |
| [`@enkerli/control`](packages/control) | The binding layer: keyboard / MIDI-CC / MIDI-note → control-plane `param`/`command`, resolved against tool manifests (CC-normalization honors each param's scale). Framework-agnostic; a control-map is the saveable library-item shape. Powers `enkerli bind`. |

`apps/` will host the webapps as they migrate in (MIDIcurator, PickPCS,
exquisite-fingerings, Chord Dictionary, Progression Studio).

## Conventions

- **npm workspaces** (no extra tooling), TypeScript strict, Vitest.
- **Test vectors are the cross-language contract.** Any algorithm ported to
  Lua or C++ gets a JSON vector file here first; every implementation runs
  the same cases.
- **MIDI is progressive enhancement in webapps** (WebKit has no WebMIDI);
  the JUCE WebView bridge is the portable MIDI path.
- Licensing: CC0-1.0 throughout this repo.

## Develop

```bash
npm install
npm test            # all workspaces
npm run typecheck
```
