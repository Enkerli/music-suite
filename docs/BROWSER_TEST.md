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
- **Audio needs a gesture:** Vane has **no start button** — audio arms on the
  first **click/tap anywhere on its page** (browser autoplay policy; a MIDI
  note does NOT count as a gesture). Watch its status line: *"click/tap the
  page to enable audio"* → **"audio ready · play your controller"** is the
  green light.
- **Vane breathes:** it's a wind-model voice — the amp envelope follows
  **breath (CC2) / pressure**, not noteOn. From a MIDI keyboard with no
  breath/pressure stream it stays silent unless something supplies breath
  (bus `note` messages supply it from velocity as of 2026-07-17; a wind/MPE
  controller supplies it for real).
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
4. In the Workspace **Pattern (UPI)** module, type `E(3,8)` and press
   **▶ send**. → **Serpe adopts the pattern**: its ring/lane and UPI field
   show the 8-step tresillo (the broadcast `pattern` message lands in Serpe,
   which rebuilds the steps from the mask, leftmost = LSB). Requires apps
   synced after 2026-07-17.

### 5b. Workspace → Vane (a param changes the sound)
1. Open **Workspace** and **Vane**. **Click anywhere on the Vane page** until
   its status reads *audio ready*, then get a tone sounding: easiest is a bus
   note from the workspace side —
   `msuite send --to vane --note 48 --duration 4000 | msuite bridge` with the
   Bridge module connected (see §6b), or a breath/MPE controller. (A plain
   keyboard noteOn alone is silent — Vane's envelope is breath-driven.)
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

**The CLI never plays through your speakers itself** — `render` writes a WAV
(with breath baked in: default `--breath 0.9`, so it IS audible) and you play
the file:

```bash
# a bright morph vs. a default render — the two files should sound different
msuite send --to vane --param morph=1.0 | msuite render 69 -o bright.wav --stream
msuite render 69 -o plain.wav
afplay bright.wav && afplay plain.wav     # macOS (Linux: aplay / pw-play; or open in any player)
# generate a progression to MIDI and open it in a DAW/player
msuite generate --mode major --length 8 --seed 42 --tonic C -o gen.mid
```

→ `bright.wav` is audibly richer than `plain.wav`; `gen.mid` opens as a real
8-chord progression. (If a WAV seems silent, check `--breath` wasn't set to 0
— Vane's envelope IS breath, headless too.) For *live* CLI sound, the speaker
is a browser tab: §6b.

### 6b. The shell plays the browser — accompany → bridge → Vane 🎉

*The pipe crossing into the browser: a bassline composed in the terminal
sounds through the Vane tab, live.*

1. In **Vane** (browser tab): **click/tap anywhere on the page** until the
   status line reads **"audio ready"** (there is no start button; a MIDI note
   does not satisfy the browser's gesture requirement). Don't worry about
   confirming sound by keyboard — a keyboard noteOn without breath is silent
   by design; the bridge's note messages carry their own breath.
2. In the **Workspace** tab: add the **Bridge (CLI)** module from the top bar.
   Leave the URL at `http://localhost:8765`, click **connect**.
   → status shows *retrying… (is the bridge running?)* — expected, nothing is
   listening yet.
3. In a terminal:
   ```bash
   msuite accompany --progression "Dm7 | G7 | Cmaj7 | A7" --seed 42 --bpm 100 --play | msuite bridge
   ```
   → the bridge logs `browser connected (1 listening)`; the Bridge module
   flips to *connected · N msgs* counting up **on the beat**; the **Bus
   Monitor** prints each `note [external → vane] …ms [38] v96` as it lands;
   and the **Vane tab plays the walking bassline out loud**, one note per
   beat, changing chords each bar.
4. Re-run the same command → the identical bassline (seed 42). Change
   `--seed` → same rhythm, different optional choices.
5. One-shot without a pipe: leave `msuite bridge` running and
   ```bash
   curl -s -X POST -H 'Content-Type: application/json' \
     -d "$(msuite send --to vane --note 48,55,60 --duration 800)" http://localhost:8765/send
   ```
   → the chord sounds in Vane. (Anything that can POST — including an Apple
   Shortcut — can now play the suite.)
6. **Loop it** — end the step-3 command (Ctrl-C) and run instead:
   ```bash
   msuite accompany --progression "Dm7 | G7 | Cmaj7 | A7" --seed 42 --bpm 100 --play --loop | msuite bridge
   ```
   → the bassline repeats seamlessly, bar 4 flowing straight back into bar 1
   with no gap or glitch (each pass is scheduled off one absolute clock, not
   chained waits, so passes never drift apart). Let it go around at least
   twice, then press **Ctrl-C** → the terminal prints *"stopping after the
   current note…"* and the process exits cleanly within a beat — not a hard
   kill, not a hang.
7. **Full duplex** — re-run the exact command from step 6 (its own stdout
   isn't piped anywhere, so it prints straight to this terminal):
   ```bash
   msuite accompany --progression "Dm7 | G7" --seed 42 --bpm 100 --play --loop | msuite bridge
   ```
   While it's looping, in the **Workspace** tab (still connected) sweep a
   **Control Surface** slider (tool = serpe or vane) or click a command
   button.
   → an NDJSON line for that action appears **in this same terminal**,
   interleaved with the bridge's own connection logging — the browser's own
   knob turn arrived back on the shell, live, while the bassline keeps
   looping. Confirm the round trip doesn't echo: the knob move appears
   **once**, not repeatedly. Ctrl-C to finish.

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

## 9. Serpe Poly lanes — the Keil moment (one tab, by ear)

*docs/SERPE_POLY.md §7 acceptance, semantics revised after first field test.
Requires apps synced after 2026-07-18 (second sync — with the polyrhythm
default and the IAC fixes).*

1. Open **Serpe**. In the UPI field type:
   ```
   kick=E(4,16) / snare=E(2,4)@+12ms / hat={10}E(8,16)
   ```
   → status reads **“✓ poly · 3 lanes · lcm 16 · kick / snare / hat”**; the
   Pattern view becomes the **Lanes** panel: a **Cycle/Step** lock toggle and
   a **kit** menu in the header, then one row per lane — mute (●), note/
   channel (GM defaults: kick 36 / snare 38 / hat 42, ch 10), and ONE cycle
   of cells stretched to full width. The hat row shows accent-colored cells.
2. Press **play** (enable the internal click if no MIDI device).
   → three distinct pitches interlock; **each row’s playhead sweeps at its
   own rate** but all rows complete a cycle together (cycle lock).
3. **Polyrhythm check (the default):** change the field to
   `E(4,15) / E(4,16)`.
   → the 15-cell row has slightly WIDER cells than the 16-cell row (that
   width difference IS the timing); playing, you hear a steady 15-against-16
   cross-rhythm — downbeats together every cycle, interiors weaving. No
   flamming clusters, no “trying to catch up.”
4. **Polymeter (the toggle):** flip the lock to **Step**.
   → now steps are equal-duration; the two lanes drift apart and realign
   (the meta line says how often). Flip back to **Cycle** — the change takes
   effect within a step, mid-play.
5. **Mute:** click the snare row’s ● → the row dims and falls silent; the
   others keep going. Click again to restore.
6. **The Keil moment (by ear):** with
   `kick=E(4,16) / snare=[4,12]:16@+30ms` playing, edit `+30` → `+0` → `-30`
   (Enter re-parses live).
   → the backbeat lays back, sits center, then pushes — same grid, three
   different feels. That difference IS participatory discrepancy.
7. **Tempo-synced offset:** switch the snare suffix to `@+1/32`, move the
   tempo slider. → the lag scales with tempo, where `@+30ms` stays constant.
8. **Edit-while-playing:** with the groove running, type a deliberately
   broken lane (e.g. add ` / xx(((`).
   → the status shows the ✗ error but **the groove keeps playing the last
   good pattern** — nothing blanks. Fix the text → the new shape takes over.
9. **IAC loop check (the swirl fix):** set MIDI In and Out to the SAME IAC
   bus, play a poly groove.
   → the pattern does NOT rotate itself (outgoing hits are echo-guarded on
   every path). Also verify in mono: incoming notes no longer advance the
   pattern unless **Timing & output → “advance on note-in”** is checked —
   advancing is now the special case, off by default.
10. **Drumkits:** switch the **kit** menu (GM → Volca Beats → Chromatic C2).
    → label-matched lanes retarget their default notes; any note you typed
    by hand stays put (explicit wins).
11. **Mono round-trip:** reduce to a single lane (`E(4,16)`). → the classic
    Pattern view and Analysis section return (Analysis is hidden in poly
    mode on purpose — it describes the mono pattern).
12. **Plugin guard:** poly text in the plugin build shows *“poly lanes are
    webapp-only for now”* (parity is planned — SERPE_POLY §8).

---

## 10. GloriArp module — the standalone accompaniment surface (two tabs)

*The same engine the CLI runs, in the browser: workspace composes, Vane
sounds. Requires apps synced after 2026-07-19.*

1. Open **Workspace** and **Vane** (click the Vane page until *audio ready*).
2. In the Workspace, **+ add module → GloriArp**. Defaults: progression
   `Dm7 | G7 | Cmaj7 | A7`, style `walking-bass`, seed 42, bpm 100, loop on.
3. Press **▶ play**.
   → the status shows `▶ pass 1 · 16 notes · Dm7 | G7 | Cmaj7 | A7 ·
   looping (tweaks land next pass)`; the **Bus Monitor** prints
   `note [external → vane]` messages on the beat; the **Vane tab walks the
   bassline out loud**, repeating seamlessly, the pass count climbing.
4. **Steer it live — WITHOUT pressing play again:** while it loops, switch
   style to `funk-ghost`, set rhythm `{100}E(3,8)`, gate `mixed`,
   rests `0.3`, push `0.5`.
   → at the next pass boundary the band changes under your hands: tresillo
   funk, per-note articulation (legato runs, detached repeats, ghosty
   cracks). Editing never stops the groove; a mid-edit garbage progression
   keeps the last good take (status says so) until you fix it.
5. **The living take:** set `variety 0.6`, `pocket 0.4`, `morph 0.5`.
   → passing tones and octave pops appear on weak beats (downbeats stay
   anchored); the line leans against the grid — push and pull, heavier when
   it digs in — and each pass re-rolls half its decisions, so the groove
   EVOLVES over repeats without losing its identity. `morph 0` freezes it;
   the same seed still reproduces everything.
6. **ProgGenie handoff:** open the **Progression Studio** app in a third
   tab, generate a progression, press **→ Workspace**.
   → the GloriArp module's progression field adopts it (status:
   `♪ progression from proggenie — lands at the next pass`) and the looping
   bassline follows the new changes one pass later. Compose in one tab,
   hear the accompaniment track it in the other.
7. **■ stop** → silence within a note (self-releasing messages, nothing hangs).
8. **⬇ .mid** → a `gloriarp-<style>-s<seed>.mid` downloads. Open it in a DAW
   (or import into a plugin): identical bytes to what `msuite accompany`
   writes for the same options — chord markers per bar, the `GLORIARP:v1
   TRACE` reproducibility header embedded. **This is the plugin handoff.**
9. Error honesty: type a garbage progression before pressing play → the
   status shows `✗ …` and nothing plays; fix it and play again.

---

## 11. GloriArp in MIDIcurator — prog in, accompaniment out (one tab)

*The native-host surface: the same `groove()` call, inside MIDIcurator —
which is also the JUCE plugin's WebView, so passing here is the browser half
of the iPad AUv3 / standalone verification.*

1. Open **MIDIcurator**. In the sidebar, click **+ GloriArp groove**.
2. Keep the defaults (`Dm7 | G7 | Cmaj7 | A7`, walking-bass, seed 42,
   bpm 120) and press **Generate**.
   → a new clip `gloriarp-walking-bass-s42.mid` appears in the library,
   selected, with the progression as its leadsheet and the bassline on the
   piano roll. **Space** plays it (WebAudio, or a Web MIDI port if selected).
3. **Feel pass:** set style `funk-ghost`, rhythm `E(3,8)`, gate `staccato`,
   rests `0.3`, push `0.5` → Generate. A distinct, tighter take lands as a
   second clip. Same options + seed → the identical clip, every time.
4. **From a curated clip:** select any clip that has a leadsheet, reopen the
   panel, click **⤷ from selected clip** → the progression field fills with
   that clip's changes; Generate builds an accompaniment *for that clip*.
5. **Takes:** set `vary 0.6`, `pocket 0.4`, then bump **take** 0 → 1 → 2,
   Generate each time. Three siblings land (`…-p1.mid`, `…-p2.mid`): same
   groove, different decisions — passing tones move, the lean shifts. This
   is the cheap variant axis; the density-variant machinery still applies
   on top of any of them.
6. **Learn a style:** import (or pick) a bass clip with a chord — a
   leadsheet entry or a detected chord both work. Select it, type a name in
   the panel's "new style name…" field, press **☆ learn clip as style**.
   → `☆ learned "<name>"` and the style dropdown now offers it. Generate
   with it over any progression: the accompaniment carries the source
   clip's rhythm and contour, reharmonized. A clip with no chord refuses
   with a message naming the fix (that's honesty, not failure). Learned
   styles survive reload (local storage).
7. Error honesty: progression `???` → a dismissible warning banner
   (`GloriArp: accompany: no chords parsed…`), no clip added.
8. The generated clip is a first-class citizen: tag it, rate it, export it
   (**D**), transform it. *In the plugin build, pressing play arms it into
   the host-synced C++ scheduler — that step is the on-device (iPad/standalone)
   half of this scenario.*

---

## Reporting

Log results in the [A11Y_TEST_PLAN.md](A11Y_TEST_PLAN.md) reporting format so
usability, accessibility, and this live-behaviour pass share one ledger: per
scenario — **pass / fail / note**, browser + OS, and for any fail the observed
vs. expected. File failures against the specific §ID (e.g. "§5b: sound changed
but a new console error appeared").
