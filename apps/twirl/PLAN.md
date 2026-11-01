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
synth mode and Incoming MIDI only, following the host, 20 host parameters
(a core of twelve and eight knobs, since 2026-10-31),
files shared between instances. Nine sound packs (with Music box and Foley),
Surge XT patches for all of them, accents, groups A to D, named scenes, a
Worker clock, French as a draft under review. Details in
[HISTORY.md](HISTORY.md).

## Order

| | What | Why now |
|---|---|---|
| **L** | **Layers: the ground, then places** ([LAYERS.md](LAYERS.md)) | Alex's pull ("widgets within the space"); decided 2026-10-31, ground first |
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

## Phase L — Layers: the ground, then places

The concept is in [LAYERS.md](LAYERS.md): a stack of layers (room, ground, staff,
places, loops, hand, glass); the **ground** a field read by notes, **places**
objects with edges and behaviours. **Decided 2026-10-31**: ground first;
then the strip, drum pad and rest, played by playheads and fingers, never
moving by themselves; controllers both inside and out. Work in this repo
(the page) unless marked twirl-dpf.

### L0. Settle the concept

- [x] Alex answered LAYERS.md's seven questions (2026-10-31).
- [x] The answers written into LAYERS.md ("Decisions") and the ground's v1
      design; roadmap theme 9 points there.

### L1. The frame (Claude)

- [x] Rename the per-loop `zone` in code (it means "Lives: high/middle/low")
      to `range`, keeping the stored field name for old codes, so "zone" is
      free for places.
- [x] One **"what's here" hook**: where a note is about to sound (`sound()`
      has its position), ask the layers at that point; the ground answers
      first, places later. No change in sound while every layer is empty.
- [x] **View → Layers**: show or hide the glass (readouts), the staff's
      lines, and each new layer as it arrives; hiding never changes sound.
- [x] Tests: a fresh sheet sounds exactly as before (every note's nuance and
      lift unchanged); old codes open.

### L2. The ground (Claude, then Alex's ears)

- [x] A field: a coarse grid (~32 × 20), interpolated; one value, dark to
      light; made from a **seed** and a **preset** (dunes, patches,
      gradient); saved as a few numbers in scenes, codes (appended), toys and
      files. *Done 2026-10-31, in the sheet's settings (scenes, codes, takes,
      files); not toys: a toy is one loop, and dropping one shouldn't change
      the sheet's ground.*
- [x] **Read** per note: the ground shifts the note's **nuance** (dark one
      way, light the other) and, optionally, its accent **lift**; scaled by
      a **Ground** control (0–1; 0 on a fresh sheet; a host parameter in the
      plugin, appended to `HOST_PARAMS`, and in twirl-dpf `TwirlParams.hpp`).
      Pitch and timing never change. *After Alex's first listen (nothing
      heard; most packs don't read nuance): light rings up to 2×, dark up to
      45 % softer (MIDI too), the ground over Vary's colour. Still inaudible,
      so a tone: a lowpass by each note's pitch, in the page and the engine
      (the 11th field of "voices"); softer now 20 %.*
- [x] **Shown** faintly on the cached grid layer, under the lines.
- [x] Controls: in Everything, a **Ground** section (or under Sound and
      room): preset, a new seed, Ground amount, show.
- [ ] The plugin: nothing to change (nuance and lift already go to its
      engine); check a sheet with ground in the standalone.
- [x] Tests: the same seed gives the same field; nuance moves with the
      ground at Ground > 0 and not at 0; saved and reopened; French for the
      new strings; axe; the first minute unchanged.
- [x] A template, `?template=ground`: a ground, chimes, a drifting loop, a
      few tadpoles (the toys that move are what make a ground heard).
- [ ] Alex: listen to toys crossing it; are the mappings audible, too much,
      which voices want more?

### L3. Traces and painting (after Alex's ears on L2)

- [ ] **Traces**: a loop setting (like Life): its playhead darkens or
      lightens the ground as it passes, fading slowly; the sheet's history.
- [ ] **A brush** (the hand layer): paint dark or light by hand.
- [ ] Later values: texture, hue (each with one or two named mappings).

### L4. The first places (Claude)

- [ ] The frame: `places`, a list beside `loops` (`{ id, kind, shape, x, y,
      w, h, rot, settings }`); saved (scenes, codes appended, toys, files);
      undo; drawn on their own cached layer under the loops (translucent, an
      icon, lit when triggered); a **Places** tray beside the Toybox
      (Everything); drag, pinch, hold for settings, flick off to remove;
      keyboard alternatives. **Still**: Morph, bumps, currents never move
      them.
- [ ] `checkPlaces()` per tick from the playhead positions contacts already
      compute (enter, stay, leave); fingers through the same events.
- [ ] **Rest**: notes inside don't sound.
- [ ] **Drum pad**: entering strikes it, once per entry; the direction picks
      the kit piece; a finger tap plays it.
- [ ] **Strip**: a playhead or a finger along it plays notes by position, in
      the sheet's scale.
- [ ] Tests for each rule; saved; axe; French; the guide.
- [ ] Alex in Bitwig: places sound through the engine and MIDI like any note.

### L5. Controllers (both ways)

- [ ] A **sensor** place: counts playheads inside, or reads one's position.
- [ ] Inside: a sensor drives another place's setting, or a Twirl control.
- [ ] Out: MIDI CC from the page (Web MIDI) and the plugin (the timed
      batch); output parameters in twirl-dpf (DPF supports them), which
      hosts can map.

### L6. More places, by kind (LAYERS.md)

- [ ] Tint, shift, slow/fast, current, nest, mirror, echo…: one at a time,
      each a rule, a test and a line in the guide.

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
- [ ] With places (after L4): a drum-pad sheet; tadpoles with a nest instead
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
