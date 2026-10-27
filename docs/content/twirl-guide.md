# Twirl — Guide

Twirl is a toy for drawing music. Draw a stroke and you hear it as you
draw it. Let go and it keeps going round, as a **loop**, on its own clock.
Draw another and the two play together. Loops drift, spin, can be moved,
turned, stretched, muted, and can have children.

**Play it:** <https://enkerli.github.io/music-suite/apps/twirl/>. It works
with a finger, a pencil or a mouse, in any current browser, iPad Safari
included. Nothing to install, no account; your work stays in your browser.

## The first minute

Tap anywhere: that starts the sound (browsers wait for a touch). Three
loops are already on the sheet: a spiral, a dropped line and a shaker.
Draw something of your own. Then drag one of the loops somewhere else and
listen to what changes.

## How a drawing becomes music

- **Higher on the sheet is higher in pitch.** The horizontal lines are the
  notes of the scale you're in (pentatonic, to begin with). The lines
  labelled C4, C5… are the octaves.
- **Distance along the path is time.** The sheet's width is one bar of four
  beats; the vertical lines are the beat divided. The little ticks across a
  loop show where each beat falls on it.
- **The direction you move picks the sound.** Right plucks, up rings a
  bell, left blips, down drums. Scribble back and forth quickly and you get
  a shaker. Each sound has its own colour *and* shape (● ○ ▲ ■ ◆), so you
  never need the colour to tell them apart.
- **Size is speed.** Make a loop bigger and it plays slower; smaller,
  faster. Sizes snap to musical ratios (½, ⅔, ¾, 1, 4⁄3, 1½, 2), so loops
  of different sizes still meet up.
- **Loud is fast (or firm).** Drawing faster makes louder notes; with a
  pencil, pressing harder does. Bigger dots are louder.
- **Where the notes land.** As you draw, a note lands each time the line
  has gone a set distance, and wherever it turns sharply, so corners and
  curls get notes and long straight runs get them evenly spaced. **Notes:
  few / some / many** sets that distance (few, the default, is about two
  grid columns). Any loop can change its own later: hold it → **Notes**.
  Choosing the same setting again re-rolls: the notes land a little
  differently each time.

A blue dot, the **playhead**, travels each loop; a note sounds when the
playhead reaches it.

## Touching loops

| Gesture | What it does |
|---|---|
| Drag a loop | Move it (its pitches and timing change with where it is) |
| Flick it off the edge | Throw it away |
| Two fingers on a loop | Turn it and resize it (resize = speed) |
| Tap | Mute / unmute |
| Double-tap | Change how it moves on its own: still, drift, spin, jitter |
| Hold | Its settings |

Every one of these also has a one-tap or keyboard way to do it: the
loop's settings have **Place** buttons (move and turn), **Mute** and
**Erase**, and the keys are listed below. Each loop also has a numbered
chip along the bottom; tapping a chip opens that loop's settings, which
is the easy way to reach a small or busy loop.

## Simple, More, Everything

Twirl opens at **Simple**: draw, hear, toys, scenes. **More** adds the
musical controls: the scale (*grid*) and its root, the range in octaves,
how the beat is divided, the pen, **Lock**, **Morph**, swing, **Air** and
**Arc**. **Everything** adds tunings, **Revoice**, **Walk** and **Drone**.
Each level only adds; nothing moves. Switch levels in the controls drawer
(☰) or right in a loop's settings.

The ones worth knowing:

- **Lock** reads every loop on the beat grid instead of as you drew it: a
  steady pulse, with the pitch snapped to the lines. Move a locked loop and
  its rhythm changes, because it crosses different lines.
- **Morph** lets loops move on their own. Off, they stay where you put
  them. (If your device asks for reduced motion, Twirl starts with it off.)
- **Air** gives a busy sheet room to breathe: the notes that matter least
  in the bar rest, and weaker beats play softer. Downbeats always play.
- **Arc** shapes 4 or 8 bars as tension and release: home, away, pull, and
  home again, where melodies resolve.
- **Tunings** (Everything): equal, just, Pythagorean, meantone and
  Werckmeister III for 12-note scales; microtonal scales (5-, 7-, 19-,
  24-EDO, slendro, pelog, maqam Rast, harmonics, Bohlen–Pierce) bring their
  own.

## A loop's settings

Hold a loop (or tap its chip, or press its number then Enter). From top to
bottom: how it **moves** on its own and where it **lives** (high, middle,
low: it wanders but comes home), **Place** (move and turn), and its
**volume**. From More up: its **notes** (few, some, many, or ↻ again),
what it does when it **meets** another loop (below), its **voice**, **speed**, **rhythm** (as drawn,
evenly spaced, or Euclidean), **direction** (forward, reverse,
ping-pong), how often it **plays** and **waits**, when it **starts**,
**chords** (fifths, triads, sevenths, sus, always in the scale you're in),
and its **timing** (follow Lock, always as drawn, or always on the grid).

**Edit notes** (More and up) changes a loop by hand: tap anywhere on its
path to add a note, tap a note to remove it, drag a square to bend the
path, hold to smooth it.

**Mutate** (More and up) gives the loop a child: a close variation with
the same voice, rhythm and timing, a slightly different shape, and a few
notes nudged. It starts half a cycle behind its parent, so it answers it.
Children can have children; the chips show the generation (`g1`, `g2`…).

## When loops meet

When two loops' playheads (the blue dots) reach the same place at the same
moment, they **meet**: a ring flashes there, and each loop answers in its
own way (its settings → **Meets**):

- **sound** (every new loop): it plays a note where it is, so a meeting
  is an interval, two voices at once;
- **trade**: it also borrows one thing from the other loop: its voice, its
  chords, its rhythm or its direction, one per meeting, in turn;
- **breed**: it also has a child, a variation of itself (like Mutate) that
  borrows one thing from the other loop;
- **no**: it passes other loops by.

Only the playheads count, not the lines: paths cross all the time, but
playheads meet only when two loops are in the same place *together*, which
you can aim for by moving loops around. A pair meets at most once a beat; a
loop trades at most once every two bars and breeds at most once every eight,
and never when the sheet is full (14 loops). **Meet** in the controls (More)
turns meetings off altogether.

## Toys, scenes, takes and codes

- **Toybox**: ready-made shapes (spiral, ring, rose, Lissajous, a drum
  beat, a shaker, dice for a surprise). Tap one to drop it.
- **My toys**: "Keep a loop", then tap a loop on the sheet, and it becomes
  a toy you can drop again anywhere.
- **Groups** (Everything): hold a loop → **Group** puts it in A, B, C or D;
  Loops together has each group's level and mute (A to D: pressed is
  muted), to bring some loops forward and others back. Breed's children
  and Merge keep their parent's group. In the plugin they're host
  parameters, for automation.
- **Scenes**: six slots for whole sheets. Tap an empty slot to save, a
  full one to recall; hold it (or Shift-tap, Shift-Enter) to overwrite. Your
  last sheet also comes back by itself. In a browser they're kept in that
  browser; in the plugin, as files every Twirl plugin shares
  (`~/.local/share/twirl/scenes`), and a scene file's text pastes into
  Scenes → Paste a code, in the plugin or a browser.
- **Takes**: press **● Rec**, play, press it again. A take keeps what you
  *did* (strokes, moves, settings) and replays it on the sheet, even after
  a reload; its sound stays until you close the page, unless you save it.
- **Codes**: a sheet, a toy, a take, or everything you have, as a line of
  text (`twirl:s1.…`). Send it any way you like; paste it into Scenes →
  Paste a code, on any device. Nothing is uploaded anywhere: the music is
  inside the code.

## Keyboard

Every touch on the sheet draws, so the keyboard is how to steer without
leaving marks. **H** lists every key inside Twirl.

| Keys | What they do |
|---|---|
| Space | Play / pause (⇧ Space: record) |
| 1–9, or Tab / ⇧ Tab | Pick a loop |
| Enter | Its settings (Enter again closes them) |
| Arrows · `,` `.` | Move it · turn it |
| `<` `>` · X · D | Slower / faster · mute · duplicate |
| ⇧1 … ⇧6 | Pen: by direction, drums, pluck, bell, blip, shaker |
| T · Y · S | Toybox · My toys · Scenes |
| C | Controls (Tab then moves through them) |
| L · M · E | Lock · Morph · Edit notes |
| F | Full screen |
| ⌘Z · ⇧⌘Z | Remove the newest loop · bring it back |
| Esc (or `` ` ``, or ⌘ .) | Close whatever is open |

**On an iPad with a keyboard:** tap the page once after it loads, so it
hears the keys (Safari keeps the keyboard in the address bar until then).
The Magic Keyboard has no Esc key: use `` ` `` (where Esc would be) or
⌘ . instead, or turn Caps Lock into Escape in Settings → General →
Keyboard → Hardware Keyboard → Modifier Keys. Safari's Tab usually skips
buttons (⌥ Tab reaches them), which sent focus off to the address bar; that
is why Tab steps through loops in Twirl, and C, Enter and T take you into
the controls.

## Full screen

**F**, or **Full screen** in the controls drawer: a bigger sheet, and a
clean frame for screen recordings. F again (or Esc) to leave. Full screen
isn't available everywhere: browsers inside other apps often don't allow
it, and the button only appears where it works.

## MIDI out

In browsers with Web MIDI (Chrome, Edge and other Chromium browsers,
including on Linux), an **Out** picker appears at the Everything level:
send Twirl's notes to a synth, a DAW or hardware, with or without Twirl's
own sound. Plucks go out on channel 1, bells on 2, blips on 3, drums and
the shaker on 10 (General MIDI drum notes), and the Drone on 4: its notes
held while it plays, changing as Walk moves them, louder with its level.
Microtonal pitches are rounded to the nearest semitone for now. Safari has no Web MIDI; a plugin version
is on the [roadmap](https://github.com/Enkerli/music-suite/blob/main/apps/twirl/ROADMAP.md).

## Behind it

Twirl is Public Domain (CC0), one HTML file you can read, copy and change:
[source on GitHub](https://github.com/Enkerli/music-suite/tree/main/apps/twirl).
Its [README](https://github.com/Enkerli/music-suite/blob/main/apps/twirl/README.md)
explains how it works inside, the
[roadmap](https://github.com/Enkerli/music-suite/blob/main/apps/twirl/ROADMAP.md)
where it's going (loops that meet and exchange something are next), and
the [accessibility record](https://github.com/Enkerli/music-suite/blob/main/apps/twirl/A11Y.md)
what has and hasn't been tested.
