# Twirl — roadmap

*Consolidated 2026-10-25: everything gathered from two days of play and
ideas, brought together by theme and prioritized, instead of added in the
order it came. What already shipped, with its details, is in
[HISTORY.md](HISTORY.md). **The work itself, in order with checklists and
the workshops' questions, is in [PLAN.md](PLAN.md).** Quotes are Alex's.*

## Principles

Held by tests where they can be (`test/`), by review where they can't. Two of
them changed on 2026-10-25 ("some immutable principles need to mutate"); they
are marked.

1. **Immediate satisfaction.** Touch the sheet, hear something. A stroke
   sounds *while* it's drawn and keeps looping after. No setup, no menu, no
   theory first. Test: *Twirl · first contact*.
2. **Two modes** *(changed: was Simple / More / Everything, each only adding,
   nothing moving)*. **Simple** is the minimum: Play, Volume, Sounds, Full
   screen, Keyboard shortcuts, Sheets and toys. A control joins Simple only
   when playtests ask for it. **Everything** is Simple plus labelled sections
   ("a kitchen drawer for utensils"). What's in Simple never moves; inside
   Everything, controls may move between sections as Twirl grows: the
   sections are the stable part, not positions. Rich setups come by **URL
   templates** rather than by crowding Simple.
3. **Surprises are audible, reversible and attributable** to a gesture or a
   rule you can find. No opaque generation. Small changes by default.
4. **Old work keeps opening.** Scenes, toys, codes and takes from earlier
   versions still load and sound as they did (new defaults apply to fresh
   sheets). New fields go at the end of a packed row; orders like
   `MEET_ORDER` are append-only.
5. **The accessibility floor holds.** axe-clean in both schemes; every
   gesture has a single-pointer or keyboard alternative; the keyboard never
   gets stranded (no Esc key on the iPad's keyboard). [A11Y.md](A11Y.md).
6. **Shared contracts stay shared.** Rhythm weights match
   `packages/theory/vectors/`; masks are leftmost-LSB.
7. **Both halves in reach** *(new)*. Twirl is semi-generative play ("smidgen",
   Alex's jokey word; [INTENT.md B1](../../docs/INTENT.md)): what you draw is
   performed, then handed over to a life of its own, and you can step back in
   at any time. A feature should keep both the generative and the performing
   half in reach, not pick one.
8. **No carcinogenesis** *(new)*. A new feature joins an existing idea
   (contacts, lives, tools, zones, templates) rather than adding a new kind of
   thing; the decisions below are the brake.

## Shipped lately (2026-10-25)

Undo what happened (each event in the log carries its own Undo); the current
chord on the sheet under Walk or Arc; Merge; tadpoles ephemeral and three at
a time, close together ("they crowd the sheet quickly instead of populating
it"), with the current moved to the first template, `?template=tadpoles`; the
Drone with its old range but starting soft (a little under one loop); the
Drone's space drawn per fresh sheet; the drawer in two modes with seven
sections. Fixed: a note one step below the sheet's bottom row had no pitch
(Walk's *fits* can move a low note there), which threw an error per note.
Everything else is in [HISTORY.md](HISTORY.md).

## Decisions (Alex's triage, 2026-10-25)

Made in the [triage form](https://claude.ai/artifact/9cRP9c3bvqSRQG7NzPYXYA):
76 ideas, each **Next**, **Workshop** or **Later** (nothing set to Now, and
nothing ruled out), with Alex's value (1–5). E is Claude's effort estimate.
Within a group: value first, then less effort.

### Next

Turned into phases in [PLAN.md](PLAN.md): Linux first (the Mac is in the
shop), then French as one package ("That's a package. Coming soon"), then
templates, the clock, the design pass, playtests.

| | Idea | Value | E | Theme | Note |
|---|---|---|---|---|---|
| 1 | **A synth from the Pages URL on Linux** | 5 | 1 | 13 | The first plugin step, no C++: Web MIDI in Chromium checks the channel map and timing |
| 2 | **Measured on the iPad** | 5 | 1 | 15 | Q and ⇧Q on the device (one diagnostic already found a bug) |
| 3 | **An off-thread clock** | 5 | 3 | 15 | A Worker or AudioWorklet tick, so a busy frame can't delay a note |
| 4 | **More templates** | 4 | 1 | 3 | An ambient room, a drum-and-bells starter, a Lock grid, a microtonal sheet |
| 5 | **Playtests, round 1** | 4 | 2 | 1 | [PLAYTESTING.md](PLAYTESTING.md) |
| 6 | **Aligned with the suite** | 4 | 2 | 2 | Tokens and components from `packages/ui`; after or with the design pass |
| 7 | **French** | 4 | 2 | 4 | Needs the string table (Workshop): the table comes first, as part of this |
| 8 | **Design pass with the design agent** | 4 | 3 | 2 | [DESIGN_BRIEF.md](DESIGN_BRIEF.md) |

One dependency to settle: French waits on *one table of strings*, which is
in Workshop. Building the table is mostly mechanical; the workshop part is
the glossary and the words themselves.

### Workshop: each needs a conversation first

Alex: "Most of the 'Workshop' ideas require notes." These are wanted, and
want thinking before building. Value 5 first:

- **Value 5.** Distance and time made visible · Readouts (UPI, PCS) · A
  Suite glossary · Seeded, replayable mutation · CCs set loops · Groove
  templates · Tempo curves · Typed input as a toy · Round trips with the
  suite · Ecology controls · Scale- and grid-aware mutation · Traces ·
  Chords as roles · Voicings · Progressions from the suite · DrawnQurve-style
  quantize · A loop's own tempo · Shapeshifting · Zones · Terrain · A
  progression loops adapt to · The plugin shell · Generative accompaniment.
- **Value 4.** Playtest conditions as templates · Lifetimes in cycles or beats
  · Seasons · Mutation strength and targets · A loop's own grid · Polyrhythm
  per loop · One table of strings · Multi-out in the plugin · Performance
  animation.
- **Value 3.** A small symbol set · Copy a template link from any sheet · MIDI
  learn · A voice pool · Twirl on the SuiteBus · Alternative pitch geometries ·
  Loops that come back (tides).
- **Value 2.** Conditions to compare · A loop's settings, redesigned.

They cluster into a few conversations, which is how to run them (one at a
time, notes taken by Claude, decisions written back here):
1. **Time**: distance and time made visible, a loop's own tempo and grid,
   polyrhythm, grooves, tempo curves, DrawnQurve-style quantize.
2. **Harmony**: a progression, chords as roles, voicings, progressions from
   the suite.
3. **Places**: zones, terrain, traces.
4. **Change over time**: ecology, shapeshifting, seasons, lifetimes, tides,
   mutation (strength, scale-aware, seeds).
5. **The suite**: readouts, typed input, round trips, the SuiteBus, the
   glossary and string table, symbols.
6. **Out of the page**: the plugin shell, multi-out, CCs and MIDI learn, a
   voice pool, generative accompaniment, performance animation, pitch
   geometries.

### Later

Wanted, not now (value 5 first): more toys with their own sounds · loops that
speed up or slow down · notes pick loops (MIDI) · personalities · learning
from shared data · Surprise hands out more · a silent zone · momentum · master
FX · pressure you can see · arpeggio objects · Vary, next · space for loops ·
more to trade · brushes · lasso and tap-to-select · groups · a path to travel
· sustained voices and legato · a channel per loop · chimes that behave like
chimes · merge, next · guide screenshots refreshed · Edit shows where a note
can go · palettes per family · a family view · Alex's own long runs.

Worth noticing: *CCs set loops* (Workshop) depends on *notes pick loops*
(Later), and *multi-out in the plugin* on *a channel per loop* (Later). The
workshops on MIDI and on the plugin can decide whether those move up.

## The themes

Every idea gathered so far, filed under the theme it belongs to.

### 1. Playtests

[PLAYTESTING.md](PLAYTESTING.md) has the plan: newcomers, musicians,
educators, assistive-tech users, iPad players; the cold open, light tasks,
"leave it running". Conditions to compare: the usual start vs `?start=macro`;
Warmth 0 vs 0.5, unannounced; parallel Walk vs *fits*. Things to watch: do
shortcuts get in the way of people who only touch; can people find the
rhythm without beat lines; does colour help guess a sound; do tadpole seas
die out, settle or fill up. Alex's own long runs come first.

### 2. Design: the drawer, a loop's settings, symbols

The brief is [DESIGN_BRIEF.md](DESIGN_BRIEF.md). A first run is done in code
(two modes, seven sections); the pass decides the rest: a loop's settings
(the long column people meet when they hold a loop), the bar, palettes, a
small symbol set in the suite's line style, and Twirl's look aligned with
the suite (`packages/ui` tokens; the sheet keeps its paper and hand). The
guide's screenshots get refreshed after.

### 3. Templates by URL

"Preserving the simple immediate experience could go through the existence of
more elaborate templates, loaded through the URL." `?start=macro` came first;
`?template=tadpoles` (two schools and a current, Drone on, at Everything; your
sheet kept aside) is the first of the general kind. Next: each a stored scene with its settings
and the mode to open at: a tadpole sea, an ambient room (Drone, Warmth, Walk),
a drum-and-bells starter (Alex's usual session: a kick, bells, crossing
lines), a Lock grid, a microtonal sheet, a playtest condition. The plain URL
stays the first minute. Later: a "Copy template link" for any sheet (it is a
share code with a mode), so teachers make their own.

### 4. Languages, a glossary, symbols

"There's a lot of text in here. Could even contribute to a glossary for the
Suite. Some things could be more graphic than textual."
- Every string the player reads (buttons, titles, toasts, the key list, aria
  labels) gathered into one table keyed by id; English first, French next;
  plurals and numbers by `Intl`. Count the strings first.
- A **Suite glossary** fed from it: Twirl's words (loop, pass, Meets, Life,
  Walk, fits, Warmth, Spacing, merge…) next to the other apps', one name per
  idea, in both languages.
- **Symbols before words** where a shape says it (voices, lives, Meets, Walk
  ways), the word kept as the accessible name: less to translate, kinder to
  newcomers and to people who read less easily.

### 5. Tools, palettes, many loops at once

"I really enjoy those [tool palettes]. And there could be tools to affect
loops on touch or selection." The Pen palette is the model.
- **Brushes** that change whatever loop they touch: fade, mute, freeze
  (Evolve off for one loop), feed, a Walk part, a Meets answer.
- **Selection**: a lasso, tap to add to the selection, then one Copy or one
  setting for all; a **silent zone** (drag a loop in to rest it).
- **Groups**: move, mute, turn and set as one; nested; saved as a toy; MIDI
  in addresses groups.
- **Palettes per family**: Life, Meets, Influence, so a loop's settings are
  for one loop and a palette for many.
- **Edit, clearer**: show where a note can go (the path brightens under the
  finger, a faint + where a tap adds one).
- **Motion by hand**: spin a loop and it keeps spinning (momentum), or slows
  to a stop; a flick throws it; draw a **path** for a loop to travel instead
  of Morph's drift.
- Rules: the pen stays the default; a tool is always visibly on; one tap or
  Esc goes back.

### 6. Sound

- **Sustained voices and legato** ("longer sounds, legato passages, pads…
  might require a bit of forethought in terms of not triggering too
  quickly"): a held voice per pack; legato as a glide between notes; a note
  holds until the loop's next one (restruck only when the pitch changes), a
  minimum length that merges faster notes, a voice budget per sheet; chosen
  by the Pen, a loop's Voice or a toy (a bow stroke, a pad); pressure or speed
  shaping the swell; MIDI with real lengths and pitch bend.
- **Master FX**: a shared reverb and the delay's controls, with a send per
  loop (Warmth's wobble is already on the whole mix).
- **A channel per loop** ("each loop could have its own audio channel. Still
  summed to stereo… to process things independently… the collision support"
  keeps them in one instance): in the page, a strip per loop (gain, pan,
  sends), solo; out of the page, more outputs where the browser allows; in
  the plugin, up to 14 stereo outs; MIDI a channel per loop.
- **Pressure you can see**: a thicker line where you pressed harder (a
  pressure per point, 16 levels); for plain touch, contact size, or speed as
  ink, or press-and-hold.
- **More toys with their own sounds**: a music box, a gong, a rain stick, a
  thumb-piano run; **arpeggio objects** after the Spinner (up, down,
  up-down, as played); **chimes that behave like chimes** (a swaying
  clapper, tubes that touch and ring each other).
- **Vary, next**: per-pack nuance; accents from the beat (Barlow weights
  shading loudness); nuance fed by pressure and terrain.
- **Spatial**: binaural and rotation live in the Drone; worth trying on loops
  too (a slow rotation per loop, distance as level and darkness).

### 7. The evolving patch, next

The problem it answers keeps coming back: "as fun as this is, it does get
quite repetitive pretty easily." Rules: slow, visible, legible, reversible,
opt-in at first.
- **Lifetimes** in cycles or beats (3 cycles, 17 beats), odd lengths so lives
  don't line up; **loops that come back** from a fade (a tide; a seed left
  behind that grows again); **loops that speed up or slow down** over many
  passes, through their size.
- **Seasons**: a slow sheet-wide cycle that shades every loop's density and
  loudness.
- **Shapeshifting**: a loop's shape changing over time (breathe, stretch,
  untwist, drift toward another shape), notes following.
- **Ecology**: a density budget per sheet; how likely contacts are (the
  tadpole runs showed the sea lives or dies by it); who may breed with whom;
  merging as the counterweight (shipped); distributing more at random
  (Lock or free, chords, speed), always said in a toast.
- **More to trade**: a rhythmic fragment, an interval, a piece of shape.
- **Merge, next**: join at the point of contact rather than end to end;
  choose which loop keeps its settings; a merged loop that splits again
  later (a tide for shapes).

### 8. Mutation v2

Strength (subtle, playful, wild) and targets (contour, rhythm, harmony,
voice, motion); pitch nudges in scale steps, not heights; rhythm by the grid
(rotate, subdivide, displace accents, Euclidean redistribution, matching
`@enkerli/upi`); **seeded** and replayable, takes recording the operation;
a **family view** (a thin line to the parent, audition, revert, prune, save a
family as a toy; durable family ids). Milestone: strength, scale-aware pitch,
seeds, the parent line.

### 9. Zones, terrain, traces (workshop)

Three ideas that give the sheet *places*.
- **Zones: controllers** ("bring back more HLO inspo… you move through an
  area and it plays a drum (different kit pieces in different directions?);
  another area plays melodic notes as you slide a ball… Not completely sure if
  the two ideas mesh"). They mesh through contacts: a zone is a fixed area
  with an instrument and a rule; a finger in it plays it live; a loop's
  playhead in it plays it too, so loops become performers and zones their
  instruments, and hands play both (principle 7).
- **Terrain** ("a colourful background which affects the sound… more
  inharmonicity on darker background… a blip may get longer on a continuous
  background"): a painted or generated ground; each note reads the ground
  where it sounds (lightness → inharmonicity, continuity → length; hue,
  saturation, texture to try); timbre and articulation only, never the note.
- **Traces** ("some loops could leave traces!"): moving loops leave fading
  trails, and the trails are the terrain: a sheet's history as its landscape.
- Workshop questions: legibility (one or two mappings per voice, named); who
  makes the ground (generated with a seed, painted, presets); how it travels
  in codes and takes; a plain sheet stays the default.

### 10. Harmony (workshop)

"Chords from each loop (what voicing and chord type?). Adapting to a chord
progression? (All the while making sure that the 'naïve' experience isn't
disrupted.)" Today: chords are diatonic stacks from each note (opened up low
down with spacing by register); Walk moves the sheet's key; Arc shapes 4 or 8
bars; *fits* gives voice leading. To work through: a chord as quality or as
role (the loop plays the bass, the chord tones, a pedal); voicings (close,
drop-2, shell, spread) and who chooses; a **sheet-level progression** loops
adapt to (chord tones on strong beats, Barlow again), with Walk and Arc as
presets of it; progressions from Progression Studio, MIDIcurator or GloriArp
over the bus; a loop that *is* the harmony (a bass line that steers);
**DrawnQurve-style quantize** (time and pitch apart, a strength, wider or
narrower intervals). Guard-rails: at Everything, off by default, named in
words; symbols and numerals only as readouts.

### 11. MIDI in

"Select a loop by notes (1–14…). Use CC to change parameters. Some controls
can be grouped by family or all loops." Notes pick loops (white keys from C3
for 1–14, black keys for families, an octave down for all and the sheet);
CCs set the selection's volume, speed, notes, chord, direction, Meets
(relative on groups); global CCs (tempo, swing, Air, Arc, Drone, Morph, Lock,
Vary, Surprise); transport; MIDI learn at Everything. Everything a controller
does is also a tap or a key away. Chromium first; the iPad waits for the
plugin.

### 12. Workspace and the suite

Twirl as a module (or a tab) on the SuiteBus: out, its notes, a loop's rhythm
(UPI) or the grid (PCS); in, tempo and transport, a scale from PickPCS or
PitchFold, the MIDI-in map as commands; one clock. Twirl joins `APPS` in
`@enkerli/library` at that point.

### 13. The plugin and standalone path

An **aumi MIDI-effect** on the enkerli-juce archetype (AU · VST3 · AUv3 ·
Standalone; LV2 · VST3 · CLAP · Standalone on Linux), the
[Workspace plugin](../../docs/WORKSPACE_PLUGIN.md) pattern: Twirl's loops are
their own clock, so notes cross as `noteOut` into a `LiveNoteScheduler`. The
seam exists: every note goes through `sound()`, every MIDI note through
`sendMidi()`, which in the plugin posts to the bridge (WKWebView has no Web
MIDI, so this is also MIDI on iPad). The WebView changes: bundled fonts,
native saves instead of blob downloads, `localStorage` mirrored to the
session, host tempo to Twirl's clock. Plugin codes are forever (BUILD.md).
Linux first: Web MIDI in Chromium already plays a synth from the Pages URL,
which checks the channel map and timing before any C++.

### 14. Timing, next

A loop's own tempo (polytempo, a free tempo from drawing speed, with "land on
the next bar"); its own grid (a drifting loop snapped to its own division);
**polyrhythm** as a per-loop division (triplets against sixteenths); groove
templates; tempo curves with Arc; rubato from the hand; a clearer link
between distance and time (a ruler along a loop; the bar as the sheet's
width, made visible).

### 15. Health

Measure on the iPad (Q, ⇧Q); Safari caps a page at 60 fps even on ProMotion.
Move the scheduler's tick off the main thread (a Worker or an AudioWorklet
clock) so a busy frame can't delay a note; a small voice pool for very dense
sheets.

### 16. Notations, semi-hidden

Twirl stands on the suite's notations without showing them: grids are
pitch-class sets, Lock and Air read loops as rhythm patterns. Let people find
them: readouts at Everything (a loop's rhythm as UPI, the grid as PCS),
typed input as a toy (`E(5,8)`, `2741`), round trips with Serpe, PitchFold,
PickPCS, a readable view of a share code. Never at Simple; always the
suite's conventions, labelled.

### 17. Later projects

- **Alternative pitch geometries**: circular pitch-class space, Tonnetz, JI
  lattices; screen geometry separated from pitch mapping; one drawing heard
  through several spaces.
- **Performance animation**: takes as editable replays (scrub, change a move,
  re-render).
- **Generative accompaniment**: contours through grammars and curated
  patterns (GloriArp, MIDIcurator, Serpe), never an opaque model.
- **Personalities**: Listener, Imitator, Contrarian, Harmonizer, Anchor…,
  each a small, inspectable rule (influence is the first piece).
- **Learning from shared data**: what people keep and share could tune
  Surprise and the starting sheet; only with consent, aggregated, from what
  people choose to share. A research question as much as a feature.

## What Twirl is becoming

"It's becoming relatively close to the 'Ambient Music' apps out there, from
Brian Eno and Jean-Michel Jarre to casual devs. It wasn't my original
intention. And there's a bit of 'carcinogenesis' involved." The evolving
patch pulls toward a sheet that plays itself; zones, tools and controllers
pull back toward the hand. Principle 7 says keep both within reach; principle
8 says grow by joining what's there. Playtests say which pull people feel.

## How experiments branch

`main` is what Pages serves at `…/apps/twirl/`: the stable version, every
test passing. Work happens on branches (`twirl/<topic>`), merged with the
tests green, first contact first among them. To try a branch: locally (`npm
run serve -w twirl`, then `http://localhost:8000/`); as a claude.ai artifact
(publish the branch's `index.html`); or, not set up, a lab slug on Pages fed
from `main` (a decision to make on purpose, since it puts experiments on
`main`).
