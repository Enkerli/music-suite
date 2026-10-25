# Twirl — the plan

*Made 2026-10-25 from Alex's [triage](https://claude.ai/artifact/9cRP9c3bvqSRQG7NzPYXYA)
and the [roadmap](ROADMAP.md): what gets done, in what order, how, where, and
by whom. Tick boxes as things land. The roadmap keeps the reasons and the
full catalogue of ideas; this file keeps the work.*

**Who.** **Alex** = on a device (playing, listening, reporting). **Claude** =
in a session (code, tests, docs, PRs). Most phases need both.

**Where.** Code in `apps/twirl/` on a `twirl/<topic>` branch, merged with
CI green; Pages serves `main` at <https://enkerli.github.io/music-suite/apps/twirl/>.
Reports come back as **⇧Q** (copies a JSON report: frame rate, errors, and
now the pen and MIDI too) pasted into the conversation, plus what you heard.

**Order.**

| Phase | What | Why this order |
|---|---|---|
| 1 | **Linux desktop**: Chromium, a synth over Web MIDI, a graphics tablet | Next, while the Mac is in the shop; the plugin's first step needs no C++ |
| 2 | **Languages: French**, as one package | "Coming soon": table, glossary, reviewable French, the interface, the docs |
| 3 | **More templates** | Small; can slot between other phases |
| 4 | **Health**: an off-thread clock; the iPad measured when it's back | A stall spoils any playtest |
| 5 | **Design pass**, and aligned with the suite | The brief is ready; best after French (longer labels) |
| 6 | **Playtests, round 1**, bilingual | With the new design and both languages |
| W | **Workshops**: six conversations, any time | Decisions for the 41 Workshop ideas |

Phases 5 and 6 could swap: playtests first would show what the design pass
should fix, design first means people meet the version we keep. *Decide
before phase 5.*

---

## Phase 1 — Linux desktop

**Where**: the Ubuntu desktop (or the miniPC), Chromium (or Chrome), the
Pages URL. Twirl needs nothing installed; the synth does.

### 1a. Twirl itself in Chromium on Linux

- [x] Open Pages, tap, draw: sound on the first touch, a loop after release.
- [ ] Draw for a minute, open the drawer (☰), switch to Everything, fold and
      unfold a section; Start over (two taps).
- [x] A busy sheet: Toybox several times, or `?template=tadpoles`; leave it two
      minutes. **Q** shows fps, slowest frame and ticks late; **⇧Q** copies it.
      (Brave on Linux, 2026-10-25: 60 fps, slowest frame 17 ms, no errors;
      "some hiccups" when adding short loops quickly, about 59 notes a
      second. ⇧Q now also reports `ticksLateMs` and `audioDevice`, to tell a
      late scheduler from an audio buffer running dry.)
- [ ] Full screen (F) and leaving it; keyboard: Space, Tab, digits, H.
- [ ] Report: ⇧Q, plus anything that sounded or looked wrong.

### 1b. A synth over Web MIDI (the plugin's first test, no C++)

What Twirl sends today (`sendMidi` in `index.html`): **pluck → channel 1,
bell → 2, blip → 3, drums and shaker → 10** (General MIDI: kick 36, snare 38,
hat 42, shaker 70). Pitched notes: the note as heard (bell and blip an octave
up); fixed lengths (drum 80 ms, pluck and blip 220, bell 600); velocity from
loudness. No CCs, no pitch bend yet.

Setup, one of:
- **FluidSynth** with a General MIDI soundfont (plays all four channels at
  once, drums on 10): `fluidsynth -a pipewire -m alsa_seq /usr/share/sounds/sf2/FluidR3_GM.sf2`
  (or `-a jack`, or `-a pulseaudio`; the soundfont path varies by distro).
- **Vane** as LV2 in `jalv`, as in [docs/JAM.md](../../docs/JAM.md) (one
  channel's worth of sound, but it's the suite's own synth).
- **Surge XT** standalone, or anything in Carla, listening on its MIDI input.

Then (as found on Alex's Linux machine, 2026-10-25: Brave lists *Midi
Through Port-0* and four *VirMIDI* ports; synths running as their own apps,
such as Surge XT or Bitwig, don't appear as outputs, so Twirl goes through
**Midi Through** and the synth listens to it):
- [x] Brave (or Chromium) lists MIDI outputs: ⇧Q's `midi.outputs`.
- [ ] In Twirl: Everything → Sound and room → **Out: MIDI · Midi Through
      Port-0** (or **sound + MIDI**, to hear both). ⇧Q's `midi.out` should
      no longer say `sound`, and `midi.sent` climbs as notes play.
- [ ] Check it leaves the browser: `aseqdump -p "Midi Through"` in a terminal
      prints note-ons as Twirl plays.
- [ ] The synth listens to Midi Through: **Surge XT** standalone, its menu →
      Audio/MIDI settings → tick *Midi Through Port-0*; **Bitwig**, Settings →
      Controllers → add a generic MIDI keyboard on *Midi Through Port-0*, then
      arm an instrument track (input: all channels). Or wire it by hand:
      `aconnect -l`, then `aconnect "Midi Through":0 <synth>:0`.
- [ ] (VirMIDI ports carry MIDI between a raw-MIDI app and the sequencer; for
      browser → synth, Midi Through is the simpler road.)
- [x] It works (Alex, 2026-10-25, through Midi Through).
- [ ] **One instrument per voice, in Carla**:
      [`tools/twirl-carla.py`](tools/twirl-carla.py) builds a Carla project
      with a Surge XT for pluck, bell and blip (channels 1–3), each behind a
      MIDI channel filter, and the General MIDI soundfont for drums on 10
      (`sudo apt install fluid-soundfont-gm`; or `--drums surge`). Run
      `python3 apps/twirl/tools/twirl-carla.py` (through `pw-jack` with
      PipeWire), open `~/twirl-surge.carxp` in Carla, choose a patch in each
      Surge XT, save. Then connect Midi Through to Carla's MIDI input.
      (Built and checked against Carla 2.5.8 on a JACK server: the filters
      pass only their channel, the wiring holds, channel 10 plays a kit.
      Surge XT itself couldn't be installed for the check, so its loading is
      the part to confirm on your machine.)
- [x] Surge XT loads (VST3, `/usr/lib/vst3`), the GM kit plays (Alex,
      2026-10-25), but Carla opened the project as *multiple clients* (its
      default on JACK), so the script's single-client connections had to be
      made by hand. Fixed: the script now builds multi-client projects and
      saves the connections in the system graph, Midi Through
      (`Midi-Bridge:…` on PipeWire, `a2j:…` with a2jmidid) and the sound card
      included; `--mode patchbay` keeps the old way.
- [x] Timing under load on Linux (Brave, 14 loops, 37 notes/s, MIDI out):
      ticks at most 19 ms late (nothing past 50), audio buffer 10.7 ms with
      56 ms output latency. The scheduler keeps up; any hiccup is the audio
      device's side.
- [ ] Each voice on its channel: draw right (pluck), up (bell), left (blip),
      down (drums), scribble (shaker). ⇧Q shows `midi.last` (channel, note,
      velocity) and `midi.sent`.
- [ ] Timing: with sound + MIDI, do the two line up? Any drift over a few
      minutes? A busy sheet: any notes late or missing on the synth only?
- [ ] Lock on and off, Walk on (chords move), a Spinner, a tadpole sea.
- [ ] Note what's missing to play it as an instrument (lengths? channels per
      loop? CCs?): that's the input for the plugin workshop (W6).

**Claude, after the reports**: fix what's wrong in the MIDI path; if timing
is uneven under load, it's an argument for phase 4's clock first.

### 1c. A graphics tablet

What Twirl uses today: with `pointerType === "pen"`, **pressure sets each
note's loudness** (and the dot's size); without a pen, drawing speed does.
Tilt and the barrel buttons aren't used. The line itself doesn't thicken yet
("Pressure you can see" is Later).

- [ ] Draw with the pen: ⇧Q's `pen` says `type: "pen"` and a `maxPressure`
      above 0. If it says `mouse`, the browser isn't seeing a pen: try the
      other session (X11 vs Wayland) and note which works.
- [ ] Light vs firm strokes: are the dots smaller and the notes softer? Is
      the range comfortable, or does it need a curve?
- [ ] Hovering doesn't draw; a press does. The side buttons and eraser: does
      anything odd happen (a right-click menu, a stroke)?
- [ ] `coalesced` vs `events` in ⇧Q: a high ratio means the tablet sends more
      points than frames, which is fine (Twirl already reads them).
- [ ] Report: ⇧Q, the tablet's make, X11 or Wayland, and how it felt.

**Claude, after the reports**: a pressure curve if it's needed; fixes for
buttons or hover; then "Pressure you can see" can move up if it's wanted.

### 1d. Then, if 1b went well

Questions for W6 (the plugin): is the browser plus a synth enough on Linux
for now, or is an LV2/standalone worth building next? See
[ROADMAP § 13](ROADMAP.md#13-the-plugin-and-standalone-path) and `BUILD.md`
(Linux: LV2 · VST3 · CLAP · Standalone).

---

## Phase 2 — Languages: French, as one package

Alex: "Mechanically building the table, identifying glossary entries, making
something reviewable in French, building the French interface and
documentation. That's a package."

Size (counted 2026-10-25): about **500 strings** in `index.html` (≈ 110
messages, many with numbers or names in them; ≈ 80 tooltips; ≈ 50 accessible
labels; ≈ 85 menu options; buttons and the key list), and the **guide**,
about 2,600 words in `docs/site.md`.

### 2a. The table (Claude, mechanical)

- [ ] A script (to write: tools/twirl-strings.mjs) that lists every user-facing
      string in `index.html` (text, `title`, `aria-label`, `placeholder`,
      options, `toast()` messages) with its place in the file.
- [ ] Strings move into one table (to create: apps/twirl/i18n/en.js, an object keyed by
      id, inlined into the page, since Twirl has no build step; or kept
      inside `index.html` as a `<script type="application/json">`).
      Decide which with Alex: one file stays the rule (ROADMAP principle).
- [ ] A `t(id, values)` helper; messages with numbers use `Intl.PluralRules`
      and `Intl.NumberFormat` ("1 beat" / "2 beats", "Loop 3").
- [ ] A test that fails if visible English appears outside the table (so new
      features keep using it), and one that every key exists in every
      language.
- [ ] Nothing changes for players in English.

### 2b. Glossary entries (Claude drafts, Alex decides)

- [ ] The terms Twirl names (loop, pass, sheet, stroke, playhead, voice,
      pack, Meets and its answers, Life and its kinds, Influence, Walk and its
      ways and parts, Arc, Drone, Warmth, Spacing, Lock, Morph, Surprise,
      Vary, Evolve, template, toy, scene, take…) added to
      [docs/GLOSSARY.md](../../docs/GLOSSARY.md) under a Twirl heading, each
      with a plain definition and a French term to review.
- [ ] Words other apps already use (scale, root, grid, division, swing,
      MIDI…) reuse their existing entries.

### 2c. French, reviewable (Claude drafts, Alex reviews)

- [ ] `fr` filled from the table and the glossary.
- [ ] A review page (an artifact, like the triage form): each string with its
      English, its French, where it appears, a field for Alex's correction and
      a done tick; corrections saved, then read back into the table.
- [ ] Questions to settle first (see below).

### 2d. The French interface (Claude)

- [ ] Language from the browser (`navigator.language`), overridable by
      `?lang=fr` (works with templates: `?template=tadpoles&lang=fr`) and a
      choice in Everything → View; remembered in this browser.
- [ ] `<html lang>` follows; screen readers get French.
- [ ] Layout checks at phone width: French runs ~15–25 % longer (the bar, the
      drawer's two-column buttons, the settings rows).
- [ ] Tests: first contact in French; axe in French; every key present.

### 2e. The French documentation (Claude drafts, Alex reviews)

- [ ] The site builder (`docs/build-site.mjs`) writes `<html lang="en">` for
      every page: it learns a page language (a `lang=fr` on `<!-- page -->`).
- [ ] A `twirl-guide-fr` page (the guide in French), linked both ways; the
      drawer's guide link follows the language.
- [ ] README, roadmap and plan stay English (they're for contributors).

**Decided** (Alex, 2026-10-25):
- **Vous.**
- **Normative Québec French**: Radio-Canada and Government of Canada usage;
  **Termium Plus** (and the OQLF's *Grand dictionnaire terminologique*) for
  terms; **inclusive writing through épicène terms** first, after
  *Inclusionnaire* (*les personnes qui jouent*, *l'équipe*, *chaque
  personne*), rather than contracted doublets (*joueur·euse*).
- **Every name translated** except *Twirl* (so *bourdon*, not *Drone*; a
  French name for Walk, Lock, Morph, Arc…).
- **Review by Alex**; perhaps a public test with feedback later (the review
  page could take others' suggestions then).

Still to settle in the glossary review (2b), with sources cited for each:
- Key terms: *loop* (*boucle*), *pass* (*tour*, *passage*?), *sheet*
  (*feuille*), *playhead* (*tête de lecture*), *stroke* (*trait*, *tracé*?),
  *pack* (*jeu de sons*?), *take* (*prise*), *toy* (*jouet*), *scene*
  (*scène*), *template* (*modèle*), *drawer* (*tiroir*).
- Names for the features: Walk, Lock, Morph, Arc, Surprise, Vary, Evolve,
  Warmth (*chaleur*), Spacing, Smooth, Beats.
- Meets' answers, kept playful: *sound, bump, trade, breed, infect, merge*.
- Keyboard names in the key list (⇧, ⌘, Tab, Esc…): as Québec keyboards and
  Apple's French documentation name them.

---

## Phase 3 — More templates

How a template is made: an entry in `TEMPLATES` (`index.html`, section 12
area, next to `startingSheet`): settings, a mode, and a `make(W, H)` that
drops toys or loops. Opened by `?template=<name>`; your own sheet is kept
aside; reloading keeps what you've done since. One test each.

- [x] `tadpoles`: two schools and a current, Drone on.
- [ ] `ambient`: chimes, a slow call, Drone on (drifting or rotating),
      Warmth up a little, Walk on (fits), Spacing by register.
- [ ] `session` (Alex's usual): a four-on-the-floor kick, a bell line, two
      crossing lines, Lock on.
- [ ] `grid`: Lock on, Beats shown, a beat toy, at Everything.
- [ ] `micro`: 7-EDO or slendro, Spacing by register, chimes and a ring.
- [ ] A list of templates in the guide, with their links.
- [ ] Later (Workshop): playtest conditions as templates; "copy a template
      link" from any sheet.

---

## Phase 4 — Health

### 4a. An off-thread clock (Claude)

Today the scheduler ticks on the main thread (`setInterval`, 25 ms) and
looks ahead 120–400 ms; a long frame delays the tick.

- [ ] A Worker that posts a tick every 25 ms (Workers' timers aren't held up
      by painting); the scheduler runs on each message. Behind `?clock=worker`
      first, to compare.
- [ ] Measure both on a busy sheet (CPU slowed in Chromium, and on Linux):
      ticks late, notes dropped, lookahead.
- [ ] If the Worker is better, make it the default; keep the old one as the
      fallback where Workers aren't available.
- [ ] An AudioWorklet clock only if the Worker isn't enough.

### 4b. Measured on the iPad (Alex, when it's back)

- [ ] A busy sheet for two minutes, Q then ⇧Q; the same with recording on.
- [ ] Safari's 60 fps cap is expected; slowest frame and ticks late are the
      numbers to watch.

---

## Phase 5 — Design pass, aligned with the suite

- [ ] Hand [DESIGN_BRIEF.md](DESIGN_BRIEF.md) and `design/` to the design
      agent (a Claude Design canvas). Ask for: a loop's settings, the
      Everything drawer, a symbol set, palettes.
- [ ] Update the brief first if French has landed (longer labels; the symbol
      set matters more).
- [ ] Alex picks; Claude implements in `index.html`, keeping every id.
- [ ] Align with `packages/ui` tokens and components for controls and
      dialogs; the sheet keeps its paper and hand.
- [ ] Refresh the guide's screenshot and `design/`.

## Phase 6 — Playtests, round 1

[PLAYTESTING.md](PLAYTESTING.md) has the protocol.

- [ ] Participant sheet in English and French (what Twirl is, consent, how to
      reach us).
- [ ] Conditions as links (templates and `?start=macro`), so nothing needs
      setting up during a session.
- [ ] 5–8 sessions across the groups; observation sheets; ⇧Q at the end of
      each.
- [ ] Affinity map; findings written back to the roadmap and A11Y.md.

---

## The workshops (W)

Six conversations, one at a time, whenever Alex has the time (and isn't
eating). Claude brings the context and takes the notes; decisions go into
the roadmap and, when they turn into work, into this plan.

### W1. Time

Ideas: distance and time made visible (5) · a loop's own tempo (5) · groove
templates (5) · tempo curves (5) · DrawnQurve-style quantize (5) · its own
grid (4) · polyrhythm per loop (4).

1. When you look at a loop, what do you want to *see* about its time: beats
   along it, the bar as the sheet's width, its length in beats, where it is
   in its pass?
2. Is a loop's own tempo a *ratio* to the sheet (3:4, 5:4), a free tempo, or
   drawn speed kept as is? How does it come back into step?
3. Grooves: per loop, or per sheet? Taken from where: presets, a drawn
   accent shape, a recording?
4. Tempo curves: the whole sheet (with Arc), or one loop at a time?
5. DrawnQurve's quantize: which parts carry over (time and pitch apart,
   strength, interval width), and which of Twirl's existing controls (Snap,
   Lock, division, Spacing) would they replace?
6. Polyrhythm: a division per loop next to Snap, or a property of a toy?

### W2. Harmony

Ideas: a progression loops adapt to (5) · chords as roles (5) · voicings
(5) · progressions from the suite (5).

1. Where does a progression come from: Walk's ways extended, typed (I–vi–IV–V),
   picked from presets, or another app (Progression Studio, MIDIcurator)?
2. Roles: which matter most to you (bass, chord tones, pedal, melody,
   counter-line)? Set per loop, or by height (low = bass)?
3. Voicings: who decides, the loop, the sheet, or the height on the sheet?
   Is voice leading (fits) enough as the default?
4. How should a chord *show*: the readout at the top, a symbol, colour on the
   lines, the Drone?
5. Should Walk and Arc become two presets of one progression mechanism?
6. What must the naïve player never meet (a chord symbol, a wrong note)?

### W3. Places

Ideas: zones (5) · terrain (5) · traces (5).

1. Zones: a drum zone by direction, a melodic strip; what's the first one you
   want? Drawn by you, or from a palette?
2. Does a loop passing through a zone *play* it (performer and instrument), or
   *change* (louder, filtered, another voice)?
3. Terrain: painted, generated, from traces only, or a photo? Visible always,
   or only when asked?
4. Which sound qualities does the ground change (inharmonicity, length,
   brightness, grain), and which never (pitch)?
5. Traces: which loops leave them (a Life, a Meets answer, a toy), how fast do
   they fade, and do they keep the loop's colour?
6. How do places travel in codes and takes?

### W4. Change over time

Ideas: ecology controls (5) · shapeshifting (5) · scale- and grid-aware
mutation (5) · seeded mutation (5) · seasons (4) · lifetimes in cycles or
beats (4) · mutation strength and targets (4) · tides (3).

1. Ecology: what should a player be able to set: how crowded a sheet may get,
   how often contacts happen, who may breed with whom? As one "climate"
   control, or several?
2. Shapeshifting: toward what: another loop, a toy shape, a smoothed version
   of itself? Over how long?
3. Seasons: a slow cycle of what: density, loudness, brightness, tempo? Tied
   to Arc?
4. Tides: a loop that fades and comes back: same loop, or a slightly mutated
   one (a generation)?
5. Mutation: subtle / playful / wild as one control, or targets (contour,
   rhythm, harmony, voice, motion) to tick?
6. Seeds: do you want to replay a family exactly, or is surprise the point?

### W5. The suite

Ideas: a Suite glossary (5) · readouts (5) · typed input (5) · round trips
(5) · one table of strings (4) · a small symbol set (3) · the SuiteBus (3).

1. Readouts: where (a loop's settings, a hover, the chips)? UPI, PCS, both?
2. Typed input: a field in the Toybox, or a toy that asks? What happens to
   pitch (where you drop it, a scale degree)?
3. Round trips: which first: a rhythm to Serpe, a grid to PickPCS or
   PitchFold, a progression in from Progression Studio?
4. The SuiteBus: Twirl as a Workspace module, or its own tab on the bus?
   Who's the clock?
5. Symbols: drawn in the suite's line style by the design agent, or Twirl's
   own hand?

### W6. Out of the page

Ideas: the plugin shell (5) · generative accompaniment (5) · CCs set loops
(5) · multi-out in the plugin (4) · performance animation (4) · MIDI learn
(3) · a voice pool (3) · pitch geometries (3).

1. After phase 1b: is the browser plus a synth enough on Linux, or is the
   plugin next? Which host first (Reaper, Bitwig, Ardour, Carla)?
2. MIDI out: a channel per voice (today), per loop, or per group? Note
   lengths: fixed, or held until the next note?
3. CCs set loops depends on *notes pick loops* (Later): move that up, or
   control the selected loop only?
4. Generative accompaniment: GloriArp under Twirl (it accompanies the sheet),
   or Twirl's loops read through GloriArp's patterns?
5. Performance animation: what would you edit in a take: a move, a timing, a
   setting?
6. Pitch geometries: which first: circular (angle = pitch class), Tonnetz,
   a ratio lattice? As a Spacing option, or a new sheet?

---

## Later

Wanted, not now (see the roadmap's Decisions): more toys with their own
sounds, tools and palettes, sustained voices, master FX, channels per loop,
momentum, silent zones, and the rest. When a phase or workshop pulls one
forward, it moves into this file.
