# Twirl — the plan

*Revised 2026-10-30. First made 2026-10-25 from Alex's
[triage](https://claude.ai/artifact/9cRP9c3bvqSRQG7NzPYXYA); since then,
Linux, a plugin, French and much else happened (now in
[HISTORY.md](HISTORY.md)), and Alex turned toward "widgets within the
space", which led to a frame for everything on the sheet:
[LAYERS.md](LAYERS.md). This file keeps the work: what, in what order, how,
where, by whom. The [roadmap](ROADMAP.md) keeps the reasons and every idea.*

**Who.** **Alex** = on a device (playing, listening, reporting). **Claude** =
in a session (code, tests, docs, PRs). Most items need both.

**Where.** The page: `apps/twirl/` in music-suite, on a `twirl/<topic>`
branch, merged with CI green; Pages serves `main`. The plugin:
[Enkerli/twirl-dpf](https://github.com/Enkerli/twirl-dpf), which copies the
page in at build time. Reports come back as **⇧Q** pasted into the
conversation, plus what you heard.

## Where things stand (2026-10-30)

Working: Twirl on the web (any browser; Web MIDI in and out in Chromium) and
as a plugin on Linux without JUCE (LV2, CLAP, VST3, JACK standalone; tested
in Bitwig and Carla): its own sound made in the plugin, timed MIDI out,
synth mode and Incoming MIDI only, following the host, 30 host parameters,
files shared between instances. Nine sound packs (with Music box and Foley),
Surge XT patches for all of them, accents, groups A to D, named scenes, a
Worker clock, French as a draft under review. Details in
[HISTORY.md](HISTORY.md).

## Order

| | What | Why now |
|---|---|---|
| **L** | **Layers, and the first places** ([LAYERS.md](LAYERS.md)) | Alex's pull ("widgets within the space"); it frames terrain, traces, zones and tools before any of them is built |
| **F** | **The French review**, terms first | Under way at Alex's pace; runs alongside L |
| **P** | **Plugin loose ends** | Small items left from the plugin's week; confirm, report upstream, a drum map |
| **T** | **Templates** | Cheap; places make them richer (a template with a drum pad and a nest) |
| **H** | **Health**: measure; the iPad when it's back | Before sheets get busier with places |
| **D** | **Design pass** | The brief needs places, the plugin window and French first |
| **X** | **Playtests, round 1**, bilingual | With layers, the design and both languages |
| **W** | **Workshops** | Five conversations, any time (Places became phase L) |

D and X could swap (playtests first show what design should fix). *Decide
before D.*

---

## Phase L — Layers, and the first places

The concept is in [LAYERS.md](LAYERS.md): a stack of seven layers (room,
ground, staff, places, loops, hand, glass), the difference between the
**ground** (a field, passive, read by notes: terrain, traces) and **places**
(objects with edges and behaviours: zones, widgets), kinds of place, rules
for every layer, and seven questions.

### L0. Settle the concept (Alex, then Claude)

- [ ] Alex reads LAYERS.md and answers its seven questions (the stack, the
      first places, who plays them, fixed or drifting, ground or places
      first, controllers in or out, names).
- [ ] Claude writes the answers back into LAYERS.md (it becomes the
      reference) and the roadmap (theme 9 becomes "Layers").

### L1. The frame in code (Claude), before any place

- [ ] Rename the per-loop `zone` (code for "Lives: high/middle/low") in the
      code, keeping its stored field for old codes, so "zone" is free.
- [ ] `places`: a list beside `loops`, each `{ id, kind, shape, x, y, w, h,
      rot, settings }`; saved in scenes, codes (appended), toys, takes and
      files; undo.
- [ ] `checkPlaces()` per tick from the playhead positions contacts already
      compute (enter, stay, leave); a hook where a note is about to sound
      ("which places am I in?"); a hook for fingers.
- [ ] Drawing: places on their own cached layer under the loops (filled,
      translucent, an icon, lit when triggered).
- [ ] Handling: drop from a **Places** tray (beside the Toybox, Everything),
      drag to move, pinch to resize and turn, hold for settings, flick off
      to remove; keyboard alternatives (Tab reaches places too).
- [ ] **View → Layers**: show or hide each layer (glass, places, staff
      lines; ground once it exists).
- [ ] Tests: saved and reopened, old codes open, the first minute unchanged
      (no places on a fresh sheet), axe on the tray and a place's settings.

### L2. The first places (as decided in L0; proposed below)

Each with its rule, its settings (few), its icon, French, a test, the guide.

- [ ] **Rest** (the silent zone): notes inside don't sound.
      *Test*: a loop through it is silent while inside, plays again outside.
- [ ] **Drum pad**: a playhead or a finger entering strikes it; the direction
      picks the kit piece; once per entry. *Test*: entering from each side
      plays its piece; a finger tap plays.
- [ ] **Strip**: a playhead sliding along it, or a finger, plays notes by
      position along it, in the sheet's scale. *Test*: positions map to steps.
- [ ] In the plugin: they sound through the engine and MIDI like any note
      (nothing new needed); Alex tries them in Bitwig.

### L3. Next layers (after L2, in the order L0 decides)

- [ ] More places: tint, shift, slow/fast, current, nest, sensor
      (LAYERS.md lists them by kind).
- [ ] **Ground**: a field from a seed, read by each note (one or two
      mappings per voice), shown faintly; then **traces** written by loops.
- [ ] **Controllers**: a sensor's value out as MIDI CC (page and plugin) and
      as a plugin output parameter.
- [ ] **Brushes** (the hand layer): paint a rest or a tint; then the lasso.

---

## Phase F — The French review

Done (as a draft): the interface and the guide in French, opt-in by
`?lang=fr` or View → Language; terms in `i18n/terms.tbx`; the terms page.
How it works: [HISTORY.md](HISTORY.md), and `tools/i18n/README.md`.
Decided: *vous*; normative Québec French (Radio-Canada, Government of
Canada, Termium Plus, the GDT); épicène writing after *Inclusionnaire*;
every name translated but *Twirl*; Alex reviews.

- [ ] Alex settles the terms on the terms page (most-used first).
- [ ] Claude writes settled terms into terms.tbx, then into the strings that
      use them (`concord.mjs` shows which stray).
- [ ] The strings as XLIFF, each a whole message with an id, a note and a
      screenshot (no more fragments cut by the code); the 258 already
      approved go in a TMX.
- [ ] Alex reviews by screen; corrections back into fr.json.
- [ ] Places' new strings (phase L) go through the same path.
- [ ] When reviewed: the browser's language chooses (no more opt-in);
      "(ébauche)" goes.

---

## Phase P — Plugin loose ends

- [ ] **Confirm in Bitwig** (Alex): keyboard focus after a click (DPF patch
      0003) and playing while the window is hidden behind another plugin's
      (patch 0004).
- [ ] **A drum map** (Claude): channel 10 as General MIDI (today) or as
      Bitwig's drum machine (pads from C1), a choice in Out.
- [ ] **Other hosts** (Alex, when convenient): the LV2 in Ardour, the CLAP
      in Reaper, the VST3 somewhere.
- [ ] **Report the DPF patches upstream** (Claude drafts, Alex posts): the
      four in twirl-dpf `patches/`, plus the WebMeters LV2 resources rule.
- [ ] **By ear** (Alex): the Surge XT patches against Twirl's own sound;
      corrections go into the mapping (`surge/fit.py`), not by hand.
- [ ] **A graphics tablet** (Alex; was 1c): ⇧Q's `pen` shows `type: "pen"`
      and pressure; light vs firm strokes; hover and side buttons; X11 or
      Wayland.
- [ ] **Stage B, an installable web app** (a PWA): still worth it now that
      the JACK standalone exists? *Decide.*
- [ ] **Stage D, macOS and iPad**: when the Mac is back. DPF (CLAP, VST3,
      AUv2) or a CLAP through clap-wrapper (AUv3 too); see
      `docs/JUCE_INDEPENDENCE.md`.

---

## Phase T — Templates

A template is an entry in `TEMPLATES` (`index.html`, beside
`startingSheet`): settings, a mode, a `make(W, H)`; opened by
`?template=<name>`; your sheet kept aside; one test each.

- [x] `tadpoles`: two schools and a current, Drone on.
- [ ] `ambient`: chimes, a slow call, Drone (drifting or rotating), Warmth
      up a little, Walk (fits), Spacing by register.
- [ ] `session` (Alex's usual): a four-on-the-floor kick, a bell line, two
      crossing lines, Lock on.
- [ ] `grid`: Lock on, Beats shown, a beat toy.
- [ ] `micro`: 7-EDO or slendro, chimes and a ring.
- [ ] With places (after L2): a drum-pad sheet; tadpoles with a nest instead
      of a current.
- [ ] The templates listed in the guide, with links; "copy a template link"
      from any sheet.

---

## Phase H — Health

- [ ] Alex: switch from Brave to Carla and back, then ⇧Q (`clock` should say
      `worker`; `ticksLateMs.maxInBackground` small).
- [ ] Claude: a busy sheet with places, CPU slowed: ticks late, notes
      dropped; the per-tick cost of `checkPlaces()`.
- [ ] Alex, with the iPad back: a busy sheet two minutes, Q then ⇧Q, with
      recording on too.
- [ ] An AudioWorklet clock only if the Worker isn't enough.

---

## Phase D — Design pass

- [ ] Update [DESIGN_BRIEF.md](DESIGN_BRIEF.md) first: the Places tray and a
      place's settings, View → Layers, the plugin's window, French's longer
      labels; refresh `design/` screenshots.
- [ ] Hand it to the design agent: a loop's settings, the Everything drawer,
      a symbol set (voices, lives, Meets, place kinds), palettes.
- [ ] Alex picks; Claude implements, keeping every id; aligned with
      `packages/ui` tokens for controls and dialogs.

## Phase X — Playtests, round 1

[PLAYTESTING.md](PLAYTESTING.md) has the protocol.

- [ ] Participant sheet in English and French.
- [ ] Conditions as links (templates, `?start=macro`, `?lang=fr`).
- [ ] New questions for places: do people find the tray; do they read a
      place's rule from how it looks; do they play places with fingers?
- [ ] 5–8 sessions; observation sheets; ⇧Q at the end of each.
- [ ] Affinity map; findings into the roadmap and A11Y.md.

---

## The workshops (W)

Five conversations, any time. Claude brings the context and takes the notes;
decisions go into the roadmap, and into this plan when they turn into work.
(W3, Places, became phase L.)

### W1. Time

Ideas: distance and time made visible (5) · a loop's own tempo (5) · groove
templates (5) · tempo curves (5) · DrawnQurve-style quantize (5) · its own
grid (4) · polyrhythm per loop (4). (Accents shipped: a groove's first half.)

1. When you look at a loop, what do you want to *see* about its time?
2. A loop's own tempo: a ratio to the sheet (3:4, 5:4), a free tempo, or
   drawn speed kept as is? How does it come back into step?
3. Grooves: per loop or per sheet; from presets, a drawn shape, a recording,
   a UPI pattern (as accents now are)?
4. Tempo curves: the sheet (with Arc), or one loop?
5. DrawnQurve's quantize: what carries over, and what of Snap, Lock,
   division, Spacing would it replace?
6. Polyrhythm: a division per loop, a toy, or a place (slow/fast)?

### W2. Harmony

Ideas: a progression loops adapt to (5) · chords as roles (5) · voicings (5)
· progressions from the suite (5).

1. Where does a progression come from: Walk extended, typed, presets,
   another app?
2. Roles: bass, chord tones, pedal, melody, counter-line; set per loop, by
   height, or by a place (a "bass" strip)?
3. Voicings: who decides; is *fits* enough as the default?
4. How a chord shows: the readout, a symbol, colour on the lines, the Drone.
5. Walk and Arc as two presets of one mechanism?
6. What must the naïve player never meet?

### W4. Change over time

Ideas: ecology controls (5) · shapeshifting (5) · scale- and grid-aware
mutation (5) · seeded mutation (5) · seasons (4) · lifetimes in cycles or
beats (4) · mutation strength and targets (4) · tides (3).

1. Ecology: one "climate" control or several? (Nests and rests, as places,
   may answer part of it.)
2. Shapeshifting: toward what, over how long?
3. Seasons: a slow cycle of what; tied to Arc?
4. Tides: the same loop back, or a mutated one?
5. Mutation: one strength control, or targets to tick?
6. Seeds: replay a family exactly, or is surprise the point?

### W5. The suite

Ideas: a Suite glossary (5) · readouts (5) · typed input (5) · round trips
(5) · one table of strings (4) · a small symbol set (3) · the SuiteBus (3).

1. Readouts (UPI, PCS): where?
2. Typed input: a field in the Toybox, or a toy that asks? (UPI already
   drives accents.)
3. Round trips: which first: a rhythm to Serpe, a grid to PickPCS, a
   progression from Progression Studio?
4. The SuiteBus: a Workspace module or its own tab; who's the clock?
5. Symbols: the design agent's line style, or Twirl's own hand?

### W6. Out of the page

Answered since: the plugin exists (DPF, no JUCE), makes its own sound, Bitwig
is the main host. Ideas left: generative accompaniment (5) · CCs set loops
(5) · multi-out (4) · performance animation (4) · pitch geometries (3).

1. MIDI out per voice (today), per group, or per loop? Audio out per group
   (stems), now that groups exist?
2. CCs in: select a group, a loop, a place? (MIDI learn covers the 30
   controls today.)
3. Generative accompaniment: GloriArp under Twirl, or Twirl's loops through
   GloriArp's patterns?
4. Performance animation: what would you edit in a take?
5. Pitch geometries: a Spacing option, a new sheet, or a place (a Tonnetz
   pad)?
6. Audio in (the roadmap's "much later"): a layer of its own, or a place
   that listens?

---

## Later

Wanted, not now (see the roadmap's Decisions): more toys with their own
sounds, sustained voices, master FX, momentum, a path to travel, palettes per
family, a family view, and the rest. When a phase or workshop pulls one
forward, it moves into this file.
