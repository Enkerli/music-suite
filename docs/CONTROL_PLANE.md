# The control & interop plane

*Started 2026-07-14. The design spec for the backbone that
[MASTER_PLAN.md](MASTER_PLAN.md) §1.1 named: the one system whose existence
makes headless-MIDI playback, tool-to-tool piping, keyboard/MIDI shortcuts,
and parameter modulation all fall out together. It **extends**
[`@enkerli/protocol`](../packages/protocol) — it does not replace it — and
inherits every suite convention (leftmost = LSB, structural spelling,
`@enkerli/library`'s app vocabulary as the one addressing authority).*

*Status: **steps 1–3 shipped 2026-07-15** (see §6) — the `manifest`/`param`/
`command` types live in `@enkerli/protocol` with committed vectors, and the
stdio-NDJSON transport (`enkerli send`/`recv`/`describe`) runs headless. Two
real manifests exist — **Vane** (the pilot, 36 params) and **Serpe** (proving
the pattern generalizes from an instrument to a pattern engine) — and
`enkerli render --stream` closes the message → sound loop. The rest (the
manifest-per-app rollout, the binding layer) is still design; genuinely open
decisions are marked **[OPEN]**. Nothing ships without committed vectors,
like every other cross-language contract here.*

---

## 1. The one idea

`@enkerli/protocol` already defines a transport-agnostic `SuiteMessage`
(envelope: `protocol` · `v` · `id` · `from` · `to` · `sentAt` · `type` ·
`body`) and today carries it over **SysEx**. The whole plane is one
realization:

> **One message model, several transports, two new verbs.**

- **The message model** is the existing `SuiteMessage`. Unchanged shape.
- **The transports** are interchangeable carriers of that same message:
  1. **SysEx** — shipped (`encodeMessage`/`Reassembler`); web↔web over an
     IAC bus, web↔plugin and plugin↔plugin via host MIDI routing.
  2. **stdio NDJSON** — *new, trivial*: one JSON `SuiteMessage` per line on
     stdin/stdout. This **is** headless piping — `enkerli A | enkerli B`.
  3. later: App-Group inbox (gated on the Apple account, per HANDOFF),
     WebSocket/BroadcastChannel (the single-page workspace bus).
- **The two new verbs** turn a data-sharing protocol into a control
  protocol: **`param`** (set/observe a named value) and **`command`**
  (invoke a named action). Plus **`manifest`** (a tool declares what it can
  be told), which is what makes the other two addressable uniformly.

Everything the roadmap wants is a projection of this:

| Wish | Falls out as |
|---|---|
| Run every tool headless over MIDI | any tool ↔ SysEx transport (most already do) |
| Pipe one tool into another | the stdio NDJSON transport + existing CLI |
| Keyboard / MIDI shortcuts change patterns | a **binding** (key/CC → `command` or `param`) |
| Expose parameters for modulation/automation | the **`param`** verb + the **manifest** |
| Single-page movable modules | modules on the BroadcastChannel transport |
| Apple Shortcuts / widgets | a Shortcut is just another `command`/`param` sender |

The payoff is the leverage claim from the master plan, made concrete: build
these three verbs + two transports once, and six roadmap items become
adapters.

---

## 2. The manifest — a tool's addressable surface

The keystone. Each tool declares, in one place, what can be read, set, or
invoked. This is the schema the modulation UI reads, the CLI enumerates,
the binding layer targets, and the workspace introspects.

```jsonc
{
  "app": "serpe",              // @enkerli/library AppId — the one authority
  "v": 1,
  "params": [
    {
      "id": "density",         // stable, kebab-case, unique per app (LIS identity:
                               //   the id survives label/i18n changes)
      "label": "Density",      // display; localizable, never used for addressing
      "min": 0, "max": 1,      // native range in the param's own unit
      "unit": "ratio",         // controlled vocab: ratio | semitone | pc | bpm | ms | db | bool | enum | ...
      "default": 0.5,
      "step": 0.01             // optional; absent = continuous
    },
    { "id": "steps", "label": "Steps", "min": 1, "max": 128, "unit": "count", "default": 16, "step": 1 }
  ],
  "commands": [
    { "name": "next-pattern", "label": "Next pattern" },
    { "name": "mutate", "label": "Mutate", "args": [ { "id": "amount", "unit": "ratio", "min": 0, "max": 1, "default": 0.2 } ] }
  ]
}
```

Rules:

- **`id` is the contract.** Stable, unique within an app, never localized.
  Renames break bindings the way renaming a file breaks a link — so ids
  don't get renamed (LIS identity principle, same as `@enkerli/library`).
- **Native units, declared range.** A param carries its value in its own
  unit (a `bpm` param sends `120`, not `0.5`). The manifest's `min`/`max`
  let any binder normalize to/from 0..1 for MIDI CC or an LFO. This keeps
  musically-meaningful values legible on the wire (a suite value, not an
  opaque float) while still supporting normalized modulation. **[OPEN]**
  the alternative — normalized-on-the-wire everywhere — is simpler for
  modulators but loses that legibility; recommendation is native-with-range
  unless the vector work says otherwise.
- **Masks stay leftmost = LSB.** A param whose `unit` is `pc-mask` or
  `rhythm-mask` is an integer under the suite convention, exactly as in the
  existing `scale`/`pattern` bodies.
- **The manifest is itself a `SuiteMessage`** (`type: "manifest"`), so a
  tool can broadcast it on start and answer a `command: "describe"` — that
  is how the workspace and the CLI discover a tool without hard-coding it.

Where it lives: a `manifest.json` (or a typed export) per app, and a new
`@enkerli/protocol` `ManifestBody` type with validation + vectors. **[OPEN]**
hand-authored vs. derived from an existing param table (Vane already has
wasm param ids; PitchFold has APVTS) — prefer deriving where a table
already exists so the manifest can't drift from the engine.

---

## 3. The two new message types

Added to `MESSAGE_TYPES` alongside `scale`/`chord`/`progression`/`pattern`,
with the same `validateMessage` discipline and committed vectors.

### 3.1 `param`

```jsonc
{ "type": "param",
  "body": {
    "id": "density",          // must exist in the target's manifest
    "value": 0.7,             // in the param's native unit
    "mode": "set"             // set (default) | observe | report
  } }
```

- **`set`** — instruct the target to adopt the value. Modulation and
  automation are a stream of `set`s.
- **`report`** — the target announces its own current value. **The tool is
  the authority for its own state**: on any change (user knob, automation,
  preset recall) it broadcasts a `report`, so every mirror UI, the
  workspace, and a recording automation lane stay in sync. (This is the
  MIDIcurator "C++ owns the library, UI renders it" pattern, generalized.)
- **`observe`** — request the target start `report`ing a param (subscribe).
  **[OPEN]** whether observe is needed in v1 or whether tools just always
  `report` on change (simpler; chattier).
- Batching: `body.params: [{id,value}, ...]` for a coherent multi-param
  snapshot (preset recall, one automation frame). **[OPEN]** batch vs.
  one-param-per-message; recommend allow both, validate both.

### 3.2 `command`

```jsonc
{ "type": "command",
  "body": {
    "name": "mutate",         // must exist in the target's manifest
    "args": { "amount": 0.3 } // named, validated against the manifest arg specs
  } }
```

Commands are the discrete actions bindings fire ("next pattern", "arm",
"regenerate"). Args are named (not positional) and range-checked against the
manifest, so a malformed command never reaches an engine — the same
"never put a malformed message on the wire" rule `encodeMessage` already
enforces.

---

## 4. Bindings — keyboard & MIDI shortcuts

*✅ **shipped 2026-07-15** as `@enkerli/control` (18 tests) + `enkerli bind`.
A **binding** maps an input event to a `param` or `command` on some target —
the mechanism behind "keyboard and MIDI shortcuts… sending messages to tools
to change patterns." The whole plane now runs from an input to sound:
`enkerli bind stage.json --cc 74=40 | enkerli render 69 -o out.wav --stream`
turns a MIDI knob into Vane audio, headless, through the control-map.*

```jsonc
{ "trigger": { "kind": "midi-cc", "cc": 74, "channel": 1 },
  "action":  { "app": "serpe", "param": "density" },   // CC value → normalized → native
  "curve":   "linear" }

{ "trigger": { "kind": "key", "combo": "mod+shift+m" },
  "action":  { "app": "serpe", "command": "mutate", "args": { "amount": 0.3 } } }

{ "trigger": { "kind": "midi-note", "note": 36, "channel": 10 },
  "action":  { "app": "serpe", "command": "next-pattern" } }
```

Design commitments:

- **Bindings read the manifest.** A binding editor can only target ids the
  manifest declares — no free-typing an id that doesn't exist. The manifest
  supplies the range for CC-normalization automatically.
- **A binding set is a library item.** A "control map" (Sylphyo layout,
  Launchpad map, laptop-keyboard set) is content with identity, provenance,
  and facets under [LIBRARY_SPEC.md](LIBRARY_SPEC.md) — a new `kind`. This
  is what lets a performer *save and recall* their control surface, and it
  is where the accessibility-first persona's switch/key layout lives as a
  first-class, shareable object.
- **The binding layer is shared, framework-agnostic** — shipped as
  **`@enkerli/control`** (stateless `resolveEvent` + a live
  `createBindingEngine`), one implementation reading each app's manifest.
  The browser wires DOM `keydown`/WebMIDI to it; the CLI feeds simulated
  events; both get the same messages. Not re-solved per app (the UX_AUDIT
  lesson).
- **CC-normalization** is done: `ccToNative`/`nativeToCc` honor the param's
  own manifest `scale` by default (a log Vane cutoff auto-maps without the
  binding restating it), overridable per-binding (`linear`/`log`/`toggle`),
  with 7- or 14-bit resolution and `step` quantization. A CC bound to a
  *command* fires above a switch threshold.
- **[OPEN]** remaining: chords/long-press/switch-hold modeling for the
  accessibility persona (needs input *state*, which the stateless resolver
  doesn't track); MPE-vs-CC precedence; the control-map **editor UI** and
  its adoption in the apps (the logic is shipped; the in-app surface is
  Track B).

---

## 5. Headless & piping — what changes in `@enkerli/cli`

The stdio-NDJSON transport is the headless half. Concretely:

- `enkerli send serpe --param density=0.7` — emit one `param` `SuiteMessage`
  (to stdout as NDJSON, or to a MIDI port with `--midi <port>`).
- `enkerli A | enkerli B` — A writes `SuiteMessage` lines; B reads them from
  stdin, acts, and (if it's a source) writes its own. **Piping is just Unix
  pipes carrying the message model.** No new IPC to invent.
- `enkerli describe serpe` — print the manifest (drives docs, shell
  completion, the binding editor's target list).
- ✅ **`enkerli render --stream`** *(shipped 2026-07-15)* — the message →
  sound path: render reads a `param` NDJSON stream from stdin, resolves
  manifest ids → Vane wasm ids (`vaneParamIdMap`, from the pilot manifest's
  `wasmId` fields), and renders with them. `enkerli send --to vane --param
  morph=1.0 | enkerli render 69 -o out.wav --stream` turns a control-plane
  message into real audio, headless. Consumes only `param` messages for vane
  (or `*`); unresolved ids and foreign/other-app lines are surfaced on
  stderr, not dropped silently. This is a **static snapshot** (last value per
  id wins, applied before the render). **[OPEN]** the *time-varying* form —
  a `param` stream as an automation track applied across render blocks —
  remains open decision #6: `sentAt` is the clock; needs `renderVane` to
  accept a schedule + a `--rate`/realtime flag.

This also closes the two HEADLESS.md gaps from the same lever: promoting
`apps/serpe/engine` → `@enkerli/upi` and ProgGenie generation → a package
gives those tools a manifest and a `command`/`param` surface at the moment
they become importable — do the extraction and the manifest together.

---

## 6. Sequencing (what to build, in order)

1. ✅ **`ManifestBody` + `manifest` type** in `@enkerli/protocol` — schema,
   validation, vectors, `makeManifest`. The keystone; nothing else is
   addressable without it. *(shipped 2026-07-15)*
2. ✅ **`param` + `command` types** — schema, validation, vectors,
   `makeParam`/`makeCommand` mirroring `makeMessage`. Structural validation
   only; manifest-conformance is the receiver's job (§3.1). *(shipped)*
3. ✅ **stdio-NDJSON transport + `enkerli send`/`recv`/`describe`** — the
   smallest end-to-end proof: `enkerli send --to serpe --param density=0.7 |
   enkerli recv` carries the message model over an ordinary Unix pipe;
   `describe <manifest.json>` validates and prints a tool's surface.
   *(shipped; `--midi <port>` output deferred — needs a node MIDI dep)*
4. ✅ **First real manifest on one app — Vane** *(shipped 2026-07-15)*.
   `apps/vane/manifest.json` declares Vane's 36 continuous (RANGE-table)
   parameters — the surface that matters for modulation/automation —
   generated from the app's own RANGE/PARAM_MAP/defaults by
   `apps/vane/gen-manifest.mjs` (kept in sync until a derivation extracts
   them directly). `enkerli describe vane` prints it; `enkerli send --to vane
   --param filter-cutoff=800 | enkerli recv` routes to it. **Pilot finding:**
   faithful representation needed a `scale: "linear"|"log"` field on
   `ParamSpec` (Vane's Cutoff/TrDecay are log) — added to the protocol with
   vectors, resolving open decision #1's cousin. Discrete mode-switches
   (enum value vocabularies) are Vane manifest v2.
5. **The shared binding layer** — key + MIDI-CC → action, reading the
   manifest; control-map as a library `kind`.
6. Then, and only then, the projections: workspace bus (BroadcastChannel
   transport), Apple Shortcuts (a `command` sender). Both are adapters at
   that point, per the master plan.

Steps 1–3 are pure `@enkerli/protocol` + `@enkerli/cli` work — inside the
moratorium, no app-feature surface touched — and they are enough to
*demonstrate* the whole idea headless before any app UI changes.

---

## 7. Open decisions, collected

Marked **[OPEN]** above, gathered for the crafting pass:

1. Wire values: native-unit-with-range (recommended) vs. normalized 0..1.
2. Manifest: hand-authored vs. derived from existing param tables (Vane
   wasm ids, PitchFold APVTS). **Partly resolved by the Vane pilot:** a
   committed generator (`gen-manifest.mjs`) transcribes the app's RANGE
   table — controlled duplication with a "keep in sync" note — because
   Vane's `index.html` is also the plugin UI and must not be restructured
   now. A true single-source derivation stays the goal.
3. `observe`/subscribe in v1, or always-`report`-on-change.
4. `param` batching shape (single vs. array vs. both).
5. **Mostly resolved** by `@enkerli/control`: CC-normalization curves
   (linear/log/toggle, 7/14-bit, step quantization, manifest-scale default)
   are shipped. Still open: the accessibility persona's stateful inputs
   (hold/switch/chord) and MPE-vs-CC precedence.
6. Headless param-stream timing. **Static snapshot shipped** (`render
   --stream`, §5); the *time-varying* automation-track form (schedule across
   render blocks, `sentAt` as clock, `--rate`/realtime flag) is still open.
7. ~~The pilot app for the first manifest (Serpe vs. Vane).~~ **Resolved:
   Vane** (§6.4). Serpe/`@enkerli/upi` follows.
8. Multi-instance addressing (two of the same tool in the workspace) —
   almost certainly **not** v1, but the `to` field may need an instance
   suffix later; note it so v1 doesn't foreclose it.

*Resolve these with vectors, not prose: the moment a decision is made it
becomes a case in `packages/protocol/vectors/protocol.json`, which is what
keeps the eventual C++/Lua sides honest.*
