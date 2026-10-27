# Twirl — Guide

*[Lire ce guide en français](doc.html?p=twirl-guide-fr) (ébauche).*

Twirl is a toy for drawing music. Draw a stroke and you hear it as you draw
it. Let go and it keeps going round, as a **loop**. Draw another and the two
play together. Loops can be moved, turned, stretched and muted; they drift
and spin, touch each other, and can change over time.

**Play it:** <https://enkerli.github.io/music-suite/apps/twirl/>, with a
finger, a pencil or a mouse, in any current browser, iPad Safari included.
Nothing to install, no account; your work stays in your browser.

## The first minute

Tap anywhere to start the sound (browsers wait for a touch). Three loops
are already there: wind chimes, a dropped line and a shaker, in a key and a
tempo of their own. Draw something. Then drag a loop somewhere else and
listen to what changes.

That is all Twirl asks. Everything below is there when you want it: the
controls (☰) open at **Simple** (Play, volume, sounds, sheets and toys);
**Everything** adds labelled sections below (Drawing, Time, Pitch, Loops
together, Harmony, Sound and room, View), each one folding, and nothing from
Simple moves. **Start over**, in the controls,
brings back this first visit (two taps; for ten seconds the same button
brings back what you had).

## How a drawing becomes music

- **Higher is higher in pitch.** The horizontal lines are the notes of the
  scale (pentatonic, to begin with); the labelled ones are octaves. Low down
  the notes are further apart (the lowest octave plays the home chord), as
  close notes sound muddy in the bass; up high every note of the scale has a
  row. **Spacing: even** (Everything) gives every note its own row.
- **Distance along the path is time.** The sheet's width is one bar of four
  beats. **Beats** (Everything → View) shows where they fall: ticks across each loop,
  and lines down the sheet (those are always there with **Lock**, where
  they're what plays).
- **Direction picks the sound.** Right plucks, up rings a bell, left blips,
  down drums; a quick scribble is a shaker. Each sound has its own colour
  *and* shape (● ○ ▲ ■ ◆), and the line takes the colour of its notes, so a
  loop that changes sound changes colour along the way.
- **Lines settle when you lift.** A new stroke smooths into a curve (a
  scribble stays a scribble); **Smooth** (Everything → Drawing) turns that off.
- **Size is speed.** Bigger plays slower, smaller faster, snapping to
  musical ratios (½ … 2), so loops of different sizes still line up.
- **Faster (or firmer, with a pencil) is louder.** Bigger dots are louder.
- **Where the notes land:** each time the line has gone a set distance, and
  wherever it turns sharply. **Notes: few / some / many** sets the distance
  (few to begin with); each loop can change its own later.

A blue dot, the **playhead**, travels each loop; a note sounds when it gets
there.

## Handling loops

| Gesture | What it does |
|---|---|
| Drag | Move it (its pitches and timing change with where it is) |
| Flick off the edge | Throw it away |
| Two fingers | Turn it and resize it (resize = speed) |
| Tap · double-tap | Mute · change how it moves (still, drift, spin, jitter) |
| Hold | Its settings |

Every gesture has a button or a key too. Each loop has a numbered **chip**
along the bottom: tap it for that loop's settings, the easy way to reach a
small or busy loop.

## A loop's settings

Hold a loop, tap its chip, or press its number then Enter. At Simple: how it
**moves** on its own, where it **lives** (high, middle, low), **Place**
(move, turn), **volume**, **Mute** and **Erase**. At **Everything**:

- **Notes** (few, some, many, ↻ again) · **Voice** and **Sounds** (by
  direction or one voice; the sheet's sound pack or another one) · **Speed**
  · **Rhythm** (as drawn, even, Euclidean) · **Direction** (forward,
  reverse, ping-pong) · **Plays**, **Waits**, **Starts** · **Chord** (fifths,
  triads, sevenths, sus, in the scale) · **Timing** (follow Lock, as drawn,
  on the grid);
- **Meets**, **Life** and **Influence**, below;
- **Copy**: give this loop's life, influence, way of meeting, sound, part in
  Walk or timing to its **family**, **all loops**, or **loops you choose**
  (tap *to loops I choose…*, tap their chips, then **Apply**);
- **Edit notes**: tap a path to add a note, tap a note to remove it,
  double-tap a note to change its sound, drag a square to bend the path,
  hold to smooth it;
- **Mutate**: a child, a close variation that starts half a cycle behind and
  answers its parent. Children can have children (`g1`, `g2` on the chips).

At **Everything**: its part in **Walk**, and its **Snap**, **Feel** and
**Clock** (all below). **◀ ▶** at the top go to the previous or next loop.

## When loops touch

Loops touch in three ways, and a small ring flashes where they do: a
**playhead crosses another loop's line** (all the time), two **lines come
into contact** as loops move (the moment they touch), and two **playheads
meet** (rarer: aim for it by moving loops). Each loop answers in its own way
(**Meets**):

- **sound** (most loops): a note where it touches, so a meeting is an
  interval;
- **bump**: and it pushes the other loop out of its way;
- **trade**: and, on contact or a meeting, it borrows one thing from the
  other loop (its voice, chords, rhythm or direction, in turn);
- **breed**: and, when playheads meet, it has a child with the other loop;
  **infect** has one at any contact. Breeding is your choice: Surprise never
  gives it, it waits sixteen bars between children, and a child inherits it
  only from a parent that fades or comes and goes (so a population of them
  keeps itself in check, as the Tadpoles do). On a full sheet (14 loops) a
  child takes the oldest loop's place (⌘Z brings it back);
- **merge**: when its line touches another, or playheads meet, the two become
  one loop, its path and then the other's, notes and all (up to 16 beats);
  the other goes where undo keeps loops. Breeding adds loops, merging takes
  them away;
- **no**: it stays out of it.

**Meet** (Everything → Loops together) turns all contact off.

## Loops that change over time

Twirl's loops don't have to repeat the same way for good.

**Life** (a loop's settings): **steady** (as drawn); **bloom** (more notes
come in beyond yours, then leave, again and again); **swell** (louder, then
softer); **fade** (a little quieter each pass, then gone); **brief** (fills
in, fades, gone). Its length: 8 to 64 **passes** of the loop, or 1 to 32
**bars** (so loops of different sizes can fade over the same time). A loop
only ages while it plays; one whose life ends goes where undo puts loops
(⌘Z brings it back, steady). Its own notes never change: **steady** gives it
back exactly.

**Influence**: a loop can **feed** the loops it touches (louder, denser; a
fading one is kept young) or **drain** them (quieter, sparser; a fading one
runs out sooner). Strength settles back each pass, so it lasts as long as
the touching does: put a fading loop where a feeder keeps crossing it and it
stays.

You can see it all: a filling or fed line is thicker, a fading or drained
one paler, resting notes are faint, and the settings say where a loop is
("fading · pass 5 of 16"). **Evolve** (Everything → Loops together) holds every life where it is.
To fade several loops together, give one a fade, **Copy** its life to the
others (they all start together), then change each one's length.

**Surprise** (Everything → Drawing, on at first) gives new loops a little variety: a
different direction, rhythm or way of meeting now and then; and, once the
sheet is busy (four loops or more), sometimes a life (brief, or a fade of
16 or 32 passes) or an influence. The usual stays the most likely, a
message says what a loop got, and a first stroke on a quiet sheet is always
plain.

## Harmony and time

- **Lock** reads every loop on the beat grid instead of as drawn: a steady
  pulse, pitches snapped to the lines.
- **Morph** lets loops move on their own (off if your device asks for
  reduced motion).
- **Air** gives a busy sheet room: the notes that matter least to the bar
  rest. **Arc** shapes 4 or 8 bars as home, away, pull and home again.
- **Accents** (Everything → Time) let a note's place in its loop shape it:
  the strong places a little louder, brighter and longer, the weak ones
  softer. Gentle on a new sheet; 0 plays every note as drawn. Each loop
  chooses where its accents fall, in its settings: on **its cycle**
  (Barlow's weights over its own length, the default, so a 3-beat loop
  leans on its own downbeat against the bar), on **the bar**, as **a
  pattern** over its notes (*every other note*, *3 in 8*…, or any UPI, as in
  Serpe: `{10010}`, `E(5,16)`), or **none**. A pattern that doesn't fit the
  loop's notes moves along a note each pass.
- **Walk** (Everything) moves the harmony every few bars: *a progression*,
  *sway*, *by fifths*, *climb* or *wander*, every 1, 2, 4 or 8 bars (**W**
  cycles through them), and shows the chord it's on at the top of the sheet
  ("chord: Am/C", or the scale step on a microtonal grid). The **Drone**
  follows it; it starts soft (a little under one loop) and its Level goes up from there. Each loop has a part:
  **fits** (new loops: it stays where it is and lands each note on the
  nearest tone of the new chord, so lines move by small steps, voice
  leading), **moves** (every note shifts by the same number of scale steps:
  parallel motion, a melody keeping its shape, chords following the scale),
  or **stays** (ignores Walk: a pedal, a riff).
- **Scales and tunings** (Everything → Pitch): the grid and its root; at Everything,
  tunings for 12-note scales (just, Pythagorean, meantone, Werckmeister III)
  and microtonal scales (5-, 7-, 19-, 24-EDO, slendro, pelog, maqam Rast,
  harmonics, Bohlen–Pierce).
- **Timing, more freely** (a loop's settings, Everything): **Snap** to the
  division, to 1/64, or not at all; **Feel**, up to 40 ms ahead of the beat
  or behind it; **Clock** in step, or drifting 1 % ahead or behind so it
  phases against the others. The sheet's division goes from 1/4 to 1/64, or
  **Free**. A new loop is always in step, snapped and on the beat.

## Sounds

Seven **packs** (paper, mallets, felt, steel, kalimba, chip, chimes) give the
five voices different instruments; a loop can bring its own pack, whatever
the sheet's. **Vary** (Everything → Sound and room, on at first) makes no two notes quite alike, a
little louder or softer, earlier or later, brighter or duller, as a sampler
plays a different take of the same note.

**Warmth** (Everything) is the room the playground is in: a breath of hiss,
the odd vinyl crackle, a hint of tape wobble, meant to be felt more than
heard (0 turns it off). The **Drone** can sit still, drift (to begin with),
go **binaural** (left and right a few hertz apart, so headphones hear a slow
beat) or **rotate** like a Leslie speaker.

## Toys, scenes, takes, files and codes

- **Toybox**: ready-made shapes (spiral, ring, rose, Lissajous, a drum beat,
  a shaker, wind chimes, a spinner, dice). **Chimes** look like chimes (the
  longer the tube, the lower the note) and ring in gusts, off the beat, in
  their own sound. A **Spinner** is a beat-long arpeggio that folds, opens
  and flips as it spins. **Tadpoles** are three small figures, close together, with one note
  each and a long rest: they drift, have a child or two when they touch, and
  fade away. For a sea that lasts, open Twirl with `?template=tadpoles`:
  two schools and a long steady current across them to run into (your own
  sheet is kept aside, under Scenes).
- **My toys**: keep any loop as a toy, to drop again anywhere.
- **Groups** (Everything): hold a loop → **Group** puts it in A, B, C or D;
  Loops together has each group's level and mute (pressed is muted), to
  bring some loops forward and others back. Breed's children and Merge keep
  their parent's group. In the plugin they're host parameters.
- **Scenes**: six slots for whole sheets; your last sheet comes back by
  itself. In the plugin, they're files every Twirl plugin shares
  (`~/.local/share/twirl/scenes`); a scene file's text pastes into Scenes →
  Paste a code, in the plugin or a browser.
- **Takes**: **● Rec**, play, **● Rec** again. A take keeps what you did and
  replays it on the sheet, each loop appearing as it was drawn (the timer
  shrinks to a dot, out of the picture for a screen recording). **Save
  sound** gives a WAV file.
- **Download everything** (Scenes): a readable JSON file of your sheet,
  scenes, toys and takes; **Open a file** brings it back.
- **Codes**: a sheet, a toy, a take or everything, as a line of text
  (`twirl:s1.…`) to send any way you like and paste into Scenes → Paste a
  code. Nothing is uploaded: the music is inside the code.

## Messages

Twirl keeps quiet about what it does: when something happens, a dot in the
footer lights up; tap it for **What just happened**. **Show messages** (in
the controls, or **I**) shows every message on the sheet as it happens.
Quiet makes a clean screen recording, shown explains one. A problem that
needs you always shows; screen readers hear every message either way.
Whatever the sheet did on its own (a child born, a loop swallowed, a trade, a
life ending, a loop thrown away) has an **Undo** beside it in the log, for as
long as it's listed, not only the latest.

## Keyboard

The sheet answers every touch by drawing, so the keyboard steers without
leaving marks. **H** lists every key in Twirl.

| Keys | What they do |
|---|---|
| Space · ⇧ Space | Play / pause, wherever the focus is · record. Inside an open panel, Space presses the focused button instead |
| 1–9 · 1 then 0–4 · Tab | Pick a loop (two digits quickly for 10–14; Tab steps through them) |
| Enter | Its settings; there, PageDown / PageUp (fn ↓ / fn ↑) or Tab past the end go to the next loop |
| Arrows · `,` `.` · `<` `>` | Move · turn · slower / faster |
| X · D · ⌘Z · ⇧⌘Z | Mute · duplicate · remove the newest loop · bring it back |
| ⇧1 … ⇧6 | Pen: by direction, drums, pluck, bell, blip, shaker |
| T · Y · S · C | Toybox · My toys · Scenes · controls |
| L · M · E · W | Lock · Morph · Edit notes · Walk (⇧W back) |
| F · I · Q | Full screen · messages · diagnostics (⇧Q copies a report) |
| Esc, `` ` ``, ⌘ . | Close whatever is open |

In any open panel, Tab moves through its controls and wraps around, never
out to the address bar. **On an iPad with a keyboard**, tap the page once
after it loads so it hears the keys; the Magic Keyboard has no Esc, so use
`` ` `` or ⌘ . (or make Caps Lock an Escape key in Settings → General →
Keyboard → Hardware Keyboard → Modifier Keys).

## Full screen, iPad and performance

**F** (or Full screen in the controls) gives a bigger sheet and a clean
frame for recordings; if drawing downward knocks the page out of it, it
comes back when you lift your finger. If the system interrupts the sound,
Twirl says so and the next touch brings it back. On a busy sheet Twirl
schedules further ahead so notes don't drop, and may draw a little less
sharply until things calm down; **Q** shows how it's keeping up.

## MIDI out

Where the browser has Web MIDI (Chrome, Edge and other Chromium browsers,
Linux included), an **Out** picker appears at Everything: Twirl's notes to a
synth, a DAW or hardware, with or without its own sound (plucks on channel
1, bells 2, blips 3, drums and shaker 10, and the Drone on 4: its notes held
while it plays, changing as Walk moves them). Safari has no Web MIDI; a plugin
is on the [roadmap](https://github.com/Enkerli/music-suite/blob/main/apps/twirl/ROADMAP.md).

## MIDI in

With MIDI inputs, an **In** picker joins Out (none to begin with, every
input, or one). Once an input is chosen, Twirl in a browser does what its
plugin does:
- **Notes** play in the sheet's sounds when Out includes sound: channel 1
  plucks, 2 bells, 3 blips, 10 drums and shaker, any other a pluck, and
  channel 4 a Drone of the notes held there. One Twirl's MIDI into another
  plays in the second's sounds.
- **Incoming MIDI only** keeps the sheet silent: Twirl as an instrument.
- **Follow MIDI clock** takes the tempo, Start, Stop and Song Position
  coming in, as the plugin follows its host.
- **MIDI learn**: touch a control, then move a knob or fader; Delete forgets
  it. The controls are the ones a host can automate in the plugin.

Scenes, My toys and settings can live in a **folder** too (Scenes → Use a
folder, in Chrome and Edge): the plugin's files. Pick `~/.local/share/twirl`
and a browser and the plugin share them. **Open a file** takes any of them,
several at once.

## Behind it

Twirl is Public Domain (CC0), one HTML file you can read, copy and change:
[source](https://github.com/Enkerli/music-suite/tree/main/apps/twirl), with
a [README](https://github.com/Enkerli/music-suite/blob/main/apps/twirl/README.md)
on how it works inside, a
[roadmap](https://github.com/Enkerli/music-suite/blob/main/apps/twirl/ROADMAP.md),
a [playtesting plan](https://github.com/Enkerli/music-suite/blob/main/apps/twirl/PLAYTESTING.md)
and an [accessibility record](https://github.com/Enkerli/music-suite/blob/main/apps/twirl/A11Y.md).
