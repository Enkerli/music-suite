# Twirl — layers

*Drafted 2026-10-30 for Alex to react to. Alex: "my sudden desire to work
more on 'widgets' within the space: zones in the scene which do specific
things. That's combined with the notion of terrain, yet it's somewhat
different. So maybe we should establish the overall concept with layers."
A proposal, not a decision: the questions at the end are what to settle
first. The work it leads to is in [PLAN.md](PLAN.md), phase L.*

## Why layers

Twirl's sheet already holds several kinds of thing, each with its own rules,
without saying so: the paper and its lines (pitch and time), the loops
(drawn, moving, meeting), the room (Drone, Warmth, the delay), and what
floats on top (the chord, numbers, messages). The ideas waiting on the
roadmap, terrain, traces, zones, a silent zone, controllers, add more kinds.
Without a frame, each would invent its own way of being drawn, hidden, saved
and explained, and the sheet would turn into a heap (the "carcinogenesis"
principle 8 guards against).

Layers give each kind of thing **one place in a stack**, with the same
questions answered for all of them: what it is, who makes it, what it reads,
what it changes, whether it sounds, how it's shown or hidden, how it's
saved. A new idea then has to say which layer it joins, and a layer that
would need a new kind of rule is a signal to stop and think.

## The stack

From the bottom up. Lower layers are more *environment*, upper layers more
*actor*; information flows upward (a note reads what's under it), and
nothing on top changes what's underneath except where a row says so.

| # | Layer | What it is | Made by | Changes | Sounds itself | Exists today |
|---|---|---|---|---|---|---|
| 0 | **Room** | The air everything sounds in: the Drone, Warmth, the delay, space and pan | settings | every note alike (pan: by x) | the Drone, the room's noise | yes |
| 1 | **Ground** | A *field*: a value at every point, soft, without edges. Terrain; traces | painted, generated (a seed), or written by loops (traces) | how a note sounds where it sounds: timbre and articulation, never pitch or timing | no | no |
| 2 | **Staff** | The rules of pitch and time: rows (scale, root, range, Spacing) and columns (division, Beats, Lock) | settings | which pitch and which moment a note gets | no | yes |
| 3 | **Places** | *Objects* with edges, fixed on the sheet, each with a behaviour: zones, widgets | dropped from a tray, by a template | what enters them: notes, playheads, lines, fingers | some do (instrument places) | no (a loop's "Lives: high/middle/low" is a hidden cousin) |
| 4 | **Loops** | The performers: strokes that play, move, meet, live and die | the hand, toys, breeding | each other (Meets, Influence) | yes | yes |
| 5 | **Hand** | What's happening now under fingers and the pen: drawing, dragging, tools, brushes, the lasso | the person playing | anything, through the gesture | while drawing | yes (drawing, dragging) |
| 6 | **Glass** | Readouts on top: the chord, Arc, numbers, beat ticks, messages, a selected loop's halo | Twirl | nothing: information only | no | yes |

### Ground and places: the difference

This is the distinction Alex pointed at ("combined with the notion of
terrain, yet it's somewhat different"):

| | Ground (terrain, traces) | Places (zones, widgets) |
|---|---|---|
| Shape | a field: every point has a value; no edges | an object: an area with an edge, an identity, a name |
| Behaviour | passive: read by each note where it sounds | active: reacts to things *entering, staying, leaving*; may have its own state, its own sound, its own controls |
| Effect | gradual, continuous (darker → more inharmonic) | discrete, rule-like (inside: silent; enter: strike the drum) |
| Legibility | "this part of the sheet sounds rounder" | "this pad is a drum; this box is a rest" |
| Who changes it | slowly: painting, traces accumulating | at once: drop, move, resize, set |
| Closest today | Warmth, Vary (sound varies, nothing to see) | contacts (a crossing is an event at a place) |

A place can *sit on* the ground and read it too (a drum pad on a dark patch
rings darker), but the two stay separate layers: you can hide or clear one
without touching the other.

## Places in detail

### What enters a place

Four kinds of thing, each an event Twirl already computes for contacts:

- **a note**, at the moment it sounds inside (the place changes that note);
- **a playhead**, entering, staying, leaving (the place is triggered; an
  instrument place plays);
- **a line**, a loop whose path lies partly inside (the place changes the
  whole loop while it's there);
- **a finger** or the pen, on the place itself (the place is played live: a
  controller, Alex's HLO inspiration).

Each kind of place says which it listens to. That's the "loops as
performers, places as instruments, hands play both" idea from the roadmap,
made precise (principle 7: both halves in reach).

### Kinds of place

Grouped by what they do. First candidates marked ★.

**Instruments** (they sound)
- ★ **Drum pad**: a playhead or a finger entering strikes it; the direction
  it comes from picks the kit piece (Alex: "different kit pieces in different
  directions"). Sounds in the sheet's pack or its own.
- ★ **Strip**: a line segment; a playhead sliding along it, or a finger, plays
  melodic notes by position (Alex: "melodic notes as you slide a ball"). Its
  own scale or the sheet's.
- **Bell / gong**: rings once when anything first enters, then rests a while.

**Changers** (they change what's inside)
- ★ **Rest** (the roadmap's silent zone): notes inside don't sound; a place to
  park a loop.
- **Tint**: brighter or darker, louder or softer, drier or wetter inside; a
  uniform version of what terrain does by degrees.
- **Shift**: inside, notes move by a scale step, an octave, or into another
  scale (a scale island).
- **Slow / fast**: inside, a playhead runs at half or double speed.
- **Mirror**: inside, a loop plays backwards.

**Movers** (they move loops)
- **Current / wind**: loops inside drift in one direction (the tadpole
  template's steady line, as a place instead of a loop).
- **Well**: loops are drawn toward its centre; **bumper**: pushed away.
- **Portal pair**: a loop entering one comes out of the other.

**Makers** (they add loops)
- **Nest**: now and then, releases a tadpole or a small toy; with the
  tadpoles' mortality, a sea that keeps itself going without a template.
- **Echo**: a loop passing through leaves a fading copy of itself.

**Controllers** (they report)
- **Sensor**: counts the playheads inside, or reads the position of one, and
  sends it out: a MIDI CC, a host parameter in the plugin, or another
  place's setting. Twirl as a controller for other instruments, and places
  that drive each other.

### How places behave as objects

- **Fixed**: Morph, bumps and currents never move them; only a hand does
  (drag, pinch to resize and turn), or a mover place if one is ever allowed.
- **Shapes**: a rectangle, a circle, a strip (a thick segment); later a drawn
  outline. Simple shapes keep "what's inside" fast and obvious.
- **Settings**: held like a loop's (hold it, or Enter when selected), with
  the same Simple/Everything split; each kind has a few settings, not many.
- **Seen, distinctly from loops**: filled, translucent, with an icon and a
  name, under the loops; they light up when something triggers them.
- **Numbered or named** so groups, MIDI and host parameters can address them.
- **Undo** like loops; listed in the log when they act on their own (a nest
  releasing a tadpole).

### Where places come from

- A **Places** tray beside the Toybox (at Everything), with the kinds as
  icons. Drop one, and it's there.
- **Templates** bring them (Simple too: a template can open with a drum pad
  and a nest; the first-minute rule holds because nothing needs setting).
- Later, a **brush** paints a rest or a tint by hand (the roadmap's tools).

## The ground in detail

- A field over the whole sheet: one or a few values per point (lightness,
  hue, texture), at a coarse resolution (a grid of cells), so reading it per
  note is cheap.
- **Made** by a seed (generated: smooth noise, a few presets), by painting,
  or by **traces**: loops that leave fading marks as they move, so the
  ground is the sheet's history. Traces are a Life-like setting on a loop.
- **Read** by each note where it sounds: one or two named mappings per voice
  (lightness → the bell's inharmonicity, continuity → the blip's length;
  others to try). Never pitch or timing: those are the staff's.
- **Shown** faintly, under the staff's lines; can be hidden; a plain sheet
  stays the default.

## Rules that hold for every layer

1. **Each layer can be shown or hidden** (Everything → View → Layers), and
   hiding a layer never changes what it does; a separate switch turns a
   layer's effect off (as Meet does for contacts).
2. **One question, one layer**: pitch and timing are the staff's; timbre by
   place is the ground's; behaviour by place is a place's; nothing else
   decides them.
3. **The first minute is untouched**: a fresh sheet has no ground and no
   places. They come by choice: a tray, a template, a brush.
4. **Saved like everything else**: scenes, codes, toys and takes carry the
   ground (a seed, or a small grid) and places (a list), appended so older
   codes still open.
5. **The plugin gets them for free**: places and ground live in the page,
   which already sends every note, timed, to the plugin's engine and MIDI.
   Only controllers need something new from the plugin (CC out, output
   parameters).
6. **Explained in place**: each place says what it does in its settings and
   on hover; a message names any place that acts on its own.

## How it would be built (for orientation)

- **Code**: a new section in `index.html` beside contacts (7b): `places`, a
  list like `loops`, each `{ kind, shape, x, y, w, h, rot, settings }`;
  `checkPlaces()` per tick from the playhead positions contacts already
  compute; a hook in `play()`/`sound()` where a note asks "which places am I
  in, what's the ground here" before it sounds. The existing per-loop `zone`
  (code for "Lives: high/middle/low") gets another name in code, so "zone"
  can mean places (its stored field name stays, for old codes).
- **Drawing**: the ground on the cached grid layer (it changes rarely);
  places on their own cached layer, redrawn when one moves or lights up.
- **Tests**: each place kind's rule (a rest silences what's inside, a pad
  strikes on entry and picks by direction…), saving, the first minute
  unchanged, axe on the tray and a place's settings, French for every new
  string.

## Questions for Alex

1. **The stack**: do these seven layers and their names sit right? Anything
   missing (sound coming in, audio in, as its own layer?) or merged?
2. **The first places**: which two or three first? Proposed: the drum pad,
   the strip, and the rest. Or a nest, to go with the tadpoles?
3. **Who plays a place**: playheads, fingers, or both from the start?
4. **Fixed or drifting**: should places ever move by themselves (a slowly
   wandering pad), or are they the still points of the sheet?
5. **Ground or places first**: places first (discrete, legible, the HLO pull),
   with terrain reusing the same "what's here" hook after?
6. **Controllers**: should a sensor's output leave Twirl (MIDI CC, host
   parameters) in the first round, or stay inside (driving other places)?
7. **Names**: "places", "zones" or "widgets" for the layer and its objects,
   in English and in French (*lieux*, *zones*, *gadgets*?).
