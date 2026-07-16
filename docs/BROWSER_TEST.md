# Browser test protocol

*Written 2026-07-15. The manual, real-browser verification the automated tests
can't do. Unit tests (vitest + happy-dom) prove the **logic** — message
shapes, routing, reducers, DOM wiring in isolation. This protocol proves the
**live behaviour**: that a slider in one tab actually changes sound in another,
that a keystroke really rotates a pattern on screen, that audio is audible.
Anything this document marks "deferred pending browser" (chiefly Vane UI-knob
reflection and the VoiceOver pass) is verified **here**, not in CI.*

Each scenario is **steps → expected**. Where a step's outcome is a message,
the **Bus Monitor** module (in the workspace) is your oracle — it prints every
message on the bus.

---

## 0. Setup (do this once)

The cross-app tests depend on one fact: **the in-page bus (`BroadcastChannel`)
only connects tabs on the same origin.** So every app must be served from **one
local server**, not opened as `file://` (file URLs don't share the channel).

**Build the apps and serve them from one origin:**

```bash
# from the repo root — build the web apps into docs/apps/<slug>/
node scripts/sync-apps.mjs workspace serpe vane pitchfold pickpcs chord-dictionary exquisite

# serve the whole docs/ tree on one origin (any static server works)
cd docs && python3 -m http.server 8000
```

Now every app is at `http://localhost:8000/apps/<slug>/`:

| App | URL |
|---|---|
| Workspace | `http://localhost:8000/apps/workspace/` |
| Serpe | `http://localhost:8000/apps/serpe/` |
| Vane | `http://localhost:8000/apps/vane/` |
| PitchFold | `http://localhost:8000/apps/pitchfold/` |
| PickPCS | `http://localhost:8000/apps/pickpcs/` |
| Chord Dictionary | `http://localhost:8000/apps/chord-dictionary/` |
| exquisite-fingerings | `http://localhost:8000/apps/exquisite/` |

*(Alternative: once the branch is deployed to GitHub Pages, the live site is
also one origin — use `…/music-suite/apps/<slug>/` and skip the local build.)*

**Environment notes / gotchas**

- **Same origin is mandatory for the bus.** Two tabs on `localhost:8000`
  share it; a `file://` tab or a different port does **not**.
- **Browser:** use **Chrome or Edge**. WebMIDI/SysEx (the MIDI transport, §7)
  is Chromium-only — Safari and Firefox will skip those; the **bus** tests
  (§1–§6) work in any modern browser.
- **Audio needs a gesture:** Vane is silent until you click its **Start audio**
  (or play a note) — browsers block audio until the user interacts.
- **Reset between runs:** the workspace remembers its layout in
  `localStorage`; its **reset** button (top bar) clears it.

---

## 1. Workspace basics (one tab)

Open the **Workspace**. It seeds four modules: Control Surface, Pattern,
Bindings, Bus Monitor.

1. **Drag** a module by its title bar. → It moves; on reload it stays where you
   left it (layout persists).
2. **+ add module** (top bar) → pick one. → A new module appears. Its **✕**
   removes it.
3. **reset** (top bar). → Layout clears and the default four return.

---

## 2. Control Surface → the bus (one tab)

In the Workspace's **Control Surface** module:

1. Tool select = **vane**. Drag the **Filter Cutoff** slider fully right.
   → Bus Monitor prints `param set [external→vane] filter-cutoff=20000`.
   Drag to the middle → the value is **geometric** (~600–700 Hz, not ~10000),
   because the cutoff is log-scaled.
2. Tool select = **serpe**. Click **Mutate**.
   → Monitor prints `command [external→serpe] mutate(amount=0.5)`.

*Expected: every knob move / button click prints exactly one message with the
right target and value.*

## 3. Pattern module → the bus (one tab)

In the **Pattern (UPI)** module:

1. Type `E(3,8)`, press **▶ send**. → The step lane shows the tresillo
   (8 cells, 3 lit at positions 0/3/6); Monitor prints
   `pattern [external→*] 8 steps, mask 73 (E(3,8))`.
2. Try `P(3,0)+P(5,0)`. → 15 cells; Monitor shows `15 steps`.

## 4. Bindings module — the control-map editor (one tab)

In the **Bindings** module (it seeds `]`/`[` → serpe rotate, `m` → serpe
mutate):

1. Click once on empty canvas (so focus isn't in a field), press **`]`**.
   → Monitor prints `command [external→serpe] rotate(by=1)`.
2. **Add a binding:** click the *press a key…* field, press **`i`**; set app =
   **serpe**, action = **⚡ Complement**; click **+ add**. → A new row appears.
   Now press **`i`** on the canvas → Monitor prints
   `command [external→serpe] complement`.
3. **Remove** the `m` row (its ✕). Press **`m`**. → Nothing prints (unbound).
4. Typing in the editor's own fields never fires a binding.

---

## 5. Cross-tab app loops — the real payoff (two tabs, same origin)

*This is what only a browser can show: the workspace driving a **real, separate
app** over the bus.*

### 5a. Workspace → Serpe (a command changes a pattern)
1. Open **Workspace** and **Serpe** in two tabs.
2. In Serpe, note the current pattern on the ring/lane.
3. In the Workspace **Bindings** module (or Control Surface → serpe → Rotate),
   trigger **rotate** (press `]` with the workspace focused, or click the
   Control Surface **Rotate** button).
   → **Serpe's pattern visibly rotates** (the onsets shift by one step).
   Trigger **mutate** → Serpe's pattern visibly changes, same onset count.

### 5b. Workspace → Vane (a param changes the sound)
1. Open **Workspace** and **Vane**. In Vane, click **Start audio** and play/hold
   a note so you hear a tone.
2. In the Workspace Control Surface (tool = vane), sweep **Filter Cutoff** or
   **Morph**.
   → **Vane's sound changes** in real time (brighter/darker, richer/plainer).
   ⚠️ **Known gap:** Vane's on-screen **knob does not move** — only the sound
   changes. See §8 for what "fixed" will look like.

### 5c. PickPCS → PitchFold (a scale, over the bus, no MIDI)
1. Open **PickPCS** and **PitchFold**.
2. In PickPCS, change the selected scale (root or note-count).
   → PitchFold shows a **"↧ … · from pickpcs"** flash and its quantizer target
   (the pitch-class ring / pads) updates to the new collection. No MIDI needed.

### 5d. exquisite-fingerings → PitchFold (a fingering becomes a scale)
1. Open **exquisite-fingerings** and **PitchFold**.
2. In exquisite, highlight some notes (build a fingering).
   → PitchFold receives a scale (the **"↧ …"** flash) matching the highlighted
   pitch classes. *This is use case U2 end-to-end.*

### 5e. Chord Dictionary → the bus
1. Open **Chord Dictionary** and the **Workspace** (for its Bus Monitor).
2. In Chord Dictionary, change the root or pick a different quality.
   → Bus Monitor prints `chord [chord-dictionary→*]` on each change.

---

## 6. Headless → sound (terminal + a player)

The CLI's audio path can only be *heard*, not asserted:

```bash
# a bright morph vs. a default render — the two files should sound different
enkerli send --to vane --param morph=1.0 | enkerli render 69 -o bright.wav --stream
enkerli render 69 -o plain.wav
# generate a progression to MIDI and open it in a DAW/player
enkerli generate --mode major --length 8 --seed 42 --tonic C -o gen.mid
```

→ `bright.wav` is audibly richer than `plain.wav`; `gen.mid` opens as a real
8-chord progression.

---

## 7. MIDI SysEx transport (optional — Chromium + an IAC/loopback bus)

The pair also works over MIDI, the *other* transport. On macOS enable an **IAC
Driver** bus (Audio MIDI Setup); on Linux use an ALSA virtual port.

1. In PickPCS, grant MIDI (SysEx) permission and click **Push scale**.
2. In PitchFold (MIDI enabled, same bus), → the **"↧ … · from pickpcs"** flash,
   exactly like §5c but over MIDI instead of the in-page bus.

---

## 8. Deferred pending browser — Vane UI-knob reflection

Currently (§5b) a bus `param` message changes Vane's **sound** but not its
**knob** — the engine is driven directly, the UI isn't told. Closing this needs
a small setter hook inside Vane's `index.html` (shared with the plugin), which
must be checked in a real browser — hence it waits for this protocol.

**What "fixed" will look like:** after the change, sweeping the Workspace's Vane
cutoff slider makes **Vane's on-screen knob move in step** with the sound (no
desync). The acceptance test is exactly §5b with that added expectation.

*Related deferred item: the **VoiceOver / screen-reader pass** (A11Y_TEST_PLAN
§3, use cases U3/U5) — a real AT session on the live pages, likewise only
verifiable here.*

---

## Reporting

Log results in the [A11Y_TEST_PLAN.md](A11Y_TEST_PLAN.md) reporting format so
usability, accessibility, and this live-behaviour pass share one ledger: per
scenario — **pass / fail / note**, browser + OS, and for any fail the observed
vs. expected. File failures against the specific §ID (e.g. "§5b: sound changed
but a new console error appeared").
