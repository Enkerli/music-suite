# Use cases

*Started 2026-07-15 (MASTER_PLAN §2.2). One worked use case per reconciled
persona ([personas.md](personas.md)). Each is written to do **two jobs at
once**: it is a **requirements check** on the control & interop plane (does
what we built actually serve this person?), and it is a **user-testing
script** (§2.3 draws its tasks straight from here). So each names the exact
tools and steps, says what success looks like in observable terms, and —
critically — separates **what works today** from **what it surfaces as a
gap**. The gaps are not failures of the use case; surfacing them is the point.*

**How to read a use case:** persona(s) · trigger · tools · flow · success ·
what it exercises · what it surfaces. "Reality today" is called out wherever
a step is aspirational, so a tester knows what they can actually drive.

*Refreshed 2026-07-30: every `msuite` command named across U1–U8 was checked
against the CLI's own dispatch and all seven exist. U8 was added for Serpe's
poly work, which post-dates the original set. The "reality today" notes in
U1–U7 are as written on 2026-07-15 and have NOT been re-verified — treat them
as claims of that date, not of this one. Verifying them is the next pass, and
the honest place to start is a session with the generated test sheet
(`node tools/dataflow/testsheet.mjs`).*

---

## U1 — Hands-free sound control
**Personas:** Wind-controller performer (primary) · Accessibility-first performer (secondary)
**Trigger:** Standing with a breath controller mid-set, wanting to shape the
timbre without touching the screen.
**Tools:** Vane · a control-map · an expression pedal / foot-switch (MIDI).

**Flow**
1. Author or recall a control-map that binds the expression pedal (a MIDI CC)
   to a Vane sound parameter — say the filter cutoff.
2. Check it before the set: `msuite bind stage.json --validate` confirms the
   binding points at a real Vane parameter.
3. In performance, the pedal sweeps the cutoff. The sweep follows the
   parameter's **own** range (the cutoff is logarithmic), so it feels musical
   end to end — no dead half of the pedal.
4. A foot-switch mapped to a note fires a discrete action.

**Success (observable):** the pedal moves the sound with zero screen contact;
the sweep has no dead zone; nothing modal interrupts play.
**Exercises:** `@enkerli/control` bindings · Vane's manifest · scale-aware
CC-normalization (the log cutoff maps correctly without the binding restating
it).
**Surfaces:** *reality today:* **Vane now receives `param` messages live** —
its standalone host listens on the workspace bus (`apps/vane/control.js`), so
the workspace's Vane control surface (or a pedal routed through `bind`) drives
the **real voice's sound**. Still open: Vane's UI knobs don't yet *reflect* an
incoming value (engine moves, knob doesn't — an `index.html` hook, deferred to
avoid the plugin file); the foot-switch in step 4 needs Vane **discrete
commands** (manifest v2 — today 36 continuous params, no commands).

---

## U2 — Fingering to pitch collection
**Personas:** Grid-instrument learner (primary) · Theory explorer/educator (secondary)
**Trigger:** Found a comfortable shape on the grid; wants to know *what
collection* it is and quantize other material to it.
**Tools:** exquisite-fingerings → PickPCS / PitchFold · the `scale` message.

**Flow**
1. Build a fingering on the grid; its notes form a pitch-class set.
2. Push that set as a `scale` message.
3. PitchFold folds incoming pitch onto the collection; PickPCS shows its
   names and Roman degrees.

**Success (observable):** the same collection appears in all three tools,
spelled consistently (leftmost = LSB mask throughout); the quantizer audibly
folds to it.
**Exercises:** the `scale` message type · the canonical PickPCS→PitchFold pair
· consistent structural spelling across tools.
**Surfaces:** *reality today:* **fully wired end to end.** exquisite-fingerings
broadcasts the highlighted fingering as a `scale` live on the bus
(`apps/exquisite-fingerings/src/control.js`); PitchFold quantizes to it and
PickPCS names it — all over the in-browser bus (no MIDI) *and* MIDI SysEx. The
fingering → collection hop that was the open gap is now one continuous flow.

---

## U3 — One chord, many views
**Personas:** Theory explorer/educator (primary) · Curious newcomer (secondary)
**Trigger:** Teaching (or grasping) how a chord functions; wants every
representation to agree.
**Tools:** Chord Dictionary · PickPCS · Progression Studio · `msuite chord` ·
the `chord` message.

**Flow**
1. Identify a chord from notes — in the Chord Dictionary, or headless with
   `msuite chord 60 64 67 71` → `Cmaj7`.
2. Read it three ways at once: pitch-class set, chord symbol, Roman numeral.
3. Drop it into a progression in Progression Studio and hear it in context.

**Success (observable):** pc-set ↔ symbol ↔ Roman stay consistent as you move
between tools; a screen reader voices the chord's structure meaningfully.
**Exercises:** chord detection (167-quality dictionary) · Roman analysis ·
the cross-tool `chord` message · screen-reader structure.
**Surfaces:** *reality today:* the Chord Dictionary now **broadcasts the
displayed chord** as a `chord` message on the bus
(`apps/chord-dictionary/src/control.js`), so the cross-tool hop is wired. The
open item is the **VoiceOver pass** on the live pages (A11Y plan gap) — so the
"screen reader voices it" success criterion is still a *test target*.

---

## U4 — Curate and hand off
**Personas:** Producer curating material (primary) · Systematic maker (secondary)
**Trigger:** A DAW session's worth of clips and patterns; wants them tagged,
findable, exported, and never lost.
**Tools:** MIDIcurator (library, tags, ratings) · Serpe (patterns) · SMF export ·
`@enkerli/library` · `msuite smf` / `generate -o`.

**Flow**
1. Import clips into MIDIcurator; tag and rate them.
2. Find material by facet (kind × key × mood × status), not by folder.
3. Export a Serpe pattern and a progression to Standard MIDI (`enkerli
   generate … -o out.mid`, or in-app), each carrying its embedded Progression.
4. Drop the files into the DAW.

**Success (observable):** search and batch-tag are fast; export is reliable
and re-openable (the embedded Progression round-trips); undo never loses work;
the library stays usable past a few hundred items.
**Exercises:** the `@enkerli/library` model + `createLibraryBrowser` · SMF
export with embedded Progression · curation/rating.
**Surfaces:** LibraryBrowser adoption across the apps is a **partial rollout**
(the pattern shipped; not every app instantiates it yet). The "Send to
MIDIcurator" destination-naming idiom is the model the other export affordances
should follow (UX_AUDIT).

---

## U5 — A keyboard/switch-only session
**Personas:** Accessibility-first performer (primary)
**Trigger:** Performs and works with switch access or keyboard only — needs a
whole session with no mouse and no precise pointing.
**Tools:** any app · a saved personal control-map · keyboard bindings · density modes.

**Flow**
1. Load a personal control-map: keystrokes and switch inputs mapped to the
   tool's commands and parameters.
2. Drive the tool end to end from the keyboard/switch; a screen reader voices
   state changes.
3. Set density to a comfortable level; motion is reduced.

**Success (observable):** every action is reachable without a pointer; nothing
is encoded by color alone; reduced motion is honored; the control-map is saved
and recalled as *this performer's* layout — a first-class object, not settings
buried in one app.
**Exercises:** the binding layer (key triggers) · control-map as a library
item · keyboard operability · the collapsible-density a11y foundation.
**Surfaces:** *reality today:* **Serpe is the first app with live in-app
control** — its keyboard shortcuts and incoming `command`/`param` messages
work (`apps/serpe/control.js`), so a keyboard-only Serpe session is real now.
Still Track B: an in-app control-map **editor** (Serpe uses a fixed default
map — you can't yet *rebind* keys in the app), the same wiring in the other
apps, and a screen-reader pass on real pages.

---

## U6 — Hear it, then understand it
**Personas:** Curious newcomer (primary) · Theory explorer/educator (secondary)
**Trigger:** "I want cool progressions without having to know what a seventh
chord is."
**Tools:** Progression Studio (generate + playback) · `msuite generate`.

**Flow**
1. Generate a progression — no vocabulary required (`msuite generate --mode
   major --length 8`, or the app's *Generate*).
2. Hear it immediately.
3. *Optionally*, and at their own pace, reveal **why** it works — the names,
   the function — with the display toggles; never forced.
4. Save the ones that sound good; find them again later.

**Success (observable):** reaches something they like **sound-first, in
minutes, with no theory vocabulary**; can re-find it (reproducible by seed /
saved to library); explanation is available on demand but never a wall.
**Exercises:** `generate` (seed-reproducible) · playback · progressive
disclosure (chord-name/Roman toggles) · library save.
**Surfaces:** ProgGenie's guide and toggles mostly meet the "hear first,
explain on demand" commitment; the measurable claims here — *minutes to first
liked result*, *no vocabulary needed* — are exactly the **quantitative test
targets** to borrow from MIDIcurator's testing plan (time-to-first-success, SUS).

---

## U7 — Script a batch, inspect every step
**Personas:** Systematic maker (primary) · Producer curating material (secondary)
**Trigger:** Wants to produce and transform material in bulk, headless, with
every step predictable and inspectable — no hidden state, no surprises.
**Tools:** the `enkerli` CLI, end to end.

**Flow**
1. Generate reproducibly: `msuite generate --mode major --length 8 --seed 42`
   — the same seed always gives the same progression.
2. Inspect before acting: `msuite describe vane` / `serpe` shows exactly what
   each tool exposes; `msuite bind map.json --validate` rejects a bad mapping
   with a **specific** reason.
3. Build rhythms (`msuite upi "P(3,0)+P(5,0)"`), write MIDI (`… -o out.mid`),
   or make audio (`… | msuite render --stream`).
4. Pipe tools together with ordinary shell pipes; every intermediate is a
   plain file or line of text.

**Success (observable):** identical seed → identical output (predictable);
every tool self-describes; malformed input is refused with a message that says
what's wrong *and* implies the fix; the whole pipeline runs and scripts with no
GUI and no guessing.
**Exercises:** the entire headless CLI (`chord` · `pattern` · `upi` ·
`generate` · `smf` · `render` · `send`/`recv` · `describe` · `bind`) ·
reproducibility · validation-with-clear-errors · self-describing manifests.
**Reality today: fully real** — every step above was built and verified this
cycle. This is the use case the plane's headless work satisfies most directly;
it is also the readiest to run as an actual test session.

## U8 — Two rhythms at once, each moving at its own rate
**Personas:** Rhythm explorer (primary) · Theory explorer/educator (secondary)
**Trigger:** Wanting two patterns of different lengths running together, with
one of them *changing* while the other holds — the thing a single pattern
cannot express.
**Tools:** Serpe (plugin or webapp) · a DAW or the standalone · optionally
`msuite upi` to preview a lane's sequence before playing it.

**Flow**
1. Type a poly pattern — lanes separated by `/`:
   `E(3,8)%2/E(3,7)`. Two lanes, eight steps against seven, and the first one
   rotates by two steps on every trigger.
2. Trigger it: press Enter, send a MIDI note, or automate the Tick parameter.
   All three advance it, and identically.
3. Watch the lane rows. Lane 1's pattern rotates and its label follows; lane 2
   holds. The grid they share is their lcm — 56 steps for 8 against 7.
4. Give a lane a scene chain of its own: `E(3,8)|E(3,8)*3/E(3,7)`. Now lane 1
   alternates between two scenes, one of which grows by three steps each time
   it comes round, while lane 2 stays put.
5. To see a lane's sequence without playing it, `msuite upi "E(3,8)%2"` prints
   the pattern per trigger.

**Success (observable):** you hear two cycles of different lengths phasing
against each other; the changing lane visibly changes on every trigger while
the other does not; and the same string typed twice does the same thing twice.

**Exercises:** `PolyParser` lane splitting · per-lane progressive state
(`%N` offset, `*N` lengthening, `>N` transform) · per-lane scene chains ·
the poly clock's cycle lock · the `polyState` bridge channel that carries each
lane's real pattern to the UI.

**Surfaces:** *reality today:* **all of the above works, verified 2026-07-30**
— per-lane `%N`, `*N`, `>N` and `|` chains, on Enter and on MIDI, with the
lane rows following the engine. Notation is settled: `/` binds loosest, so
everything else belongs to a lane (docs/SERPE_POLY.md §2.5). Two caveats
worth knowing before a session:

- **Which side of the slash carries the `*` changes the music.** In the
  default cycle lock, lane 0 defines the cycle, so `E(3,8)*3/E(3,7)` stretches
  the whole cycle as lane 0 grows, while `E(3,7)/E(3,8)*3` grows one lane
  inside a fixed cycle.
- **A `*N` lane grows without bound** — 11, 14, 17, 20 steps and onward. That
  is the notation working as defined, not a fault, but a long session on one
  ends up with a very long pattern.

Still open: the webapp's own scheduler drives lanes locally, so a browser
session and a plugin session are not yet proven to agree beyond the parser
(the dataflow probe covers the plugin side only —
[DATAFLOW_AUDIT.md](DATAFLOW_AUDIT.md)).

---

## What the set reveals (for the plane's backlog)

Reading the eight together, the recurring gaps are consistent — and small:

- **In-app adoption — every web app is now wired.** Serpe (keyboard + bus,
  both ways), Vane (bus → real sound), the PickPCS → PitchFold `scale` pair,
  exquisite-fingerings (→ `scale`), and Chord Dictionary (→ `chord`). The
  `control.js` pattern is proven across every architecture and message kind in
  the suite. Remaining in-app work is now *refinement*, not reach: Vane UI-knob
  *reflection* of incoming values, and an in-app control-map *editor*
  (rebinding, not just a default map). The plugins adopt the same shape over
  MIDI SysEx when their turn comes.
- **Vane needs discrete commands** (manifest v2) for U1's foot-switch.
- **The screen-reader pass on live pages** (U3/U5) is the one a11y task still
  outstanding.
- **U6 and U7 are the readiest test sessions** — U7 is fully real now; U6 runs
  against shipped `generate` + playback. Start user testing there.

These are the same items already tracked in MASTER_PLAN — the use cases just
show *which real person each one is for*.
