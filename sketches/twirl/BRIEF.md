# Twirl — brief and v0 notes

*2026-10-20. Written on an iPad, primary Mac at the shop.*

## The brief, in one line

**Visceral playfulness: I make arbitrary gestures and it makes fun little
things, some of which keep going on their own.** No setup before the first
sound. No plugging.

## Where it comes from

- **Helmut Lobby line** (Beatsurfing → Playground → DRUW). Playground is the
  one that stuck: immediacy, readily-playable maps, the hope of something
  melodic or harmonic, widgets that sound different depending on the
  *direction* of a gesture. DRUW adds auto-generated maps.
- **The counter-examples**: KRFT and the physics-MIDI toys. Fun ideas,
  too much setup before flow. Physics bounces get old on their own; they'd
  make more sense as one stage of a Rube Goldberg machine.
- **What stays fresh**: ZOA, OODA, Game of Life: things that *evolve*.
  Patterning (loops of different lengths). Ribbons (the line itself as
  instrument).
- **A "sound forest"/"audio forest"** someone demoed at an event in
  Montreal years ago (name not confirmed). Twirl adds one dimension to it:
  the background *is* the note grid.
- **Mario Nieto's Harmony Bloom**: generative, harmonic, things that grow.
- **Klevgrand's shaker-style plugins**: a simple gesture becomes a loop
  with a simple yet expressive accent pattern.
- **DrawnQurve**, but 2D. A qurve is a function of time (1D). Twirl wants
  spirals and loops-the-loop, and those aren't functions.

## What it does (v1)

Open `index.html` (or the published link). A spiral, a star and a shaker
are already on the page. Touch anywhere to start the sound.

| You do | It does |
|---|---|
| Touch down | A drum hit (height picks kick / snare / hat) |
| Move | A note every *stride* of distance **or** every ~50° of turning. Straight lines are sparse; curls are dense. **A spiral is an arpeggio.** |
| Move → right / ↑ up / ← left / ↓ down | pluck / bell / blip / drum. Direction picks the voice, Playground-style |
| **Shake a finger** (three quick short back-and-forths) | Shaker mode: every reversal is a shaker hit, and how hard you shake sets the accents. A longer move goes back to drawing |
| Height | Pitch, on the chosen grid (faint lines = grid steps, labelled at each period) |
| Left ↔ right | Stereo position |
| Speed | Loudness |
| Lift | The stroke becomes a loop. Length = the gesture's duration rounded **up to whole beats** → polymeter |
| **Drag a loop** | Moves it. Up/down transposes it |
| **Two fingers on a loop** | Turn and stretch it. **Turning re-voices it** (direction picks the voice, after rotation); stretching widens its pitch range |
| Tap a loop | Mute / unmute |
| Hold a loop | Erase it |

Controls:
- **Grid**: DrawnQurve's scale families (pentatonic, diatonic modes,
  colour scales, chord arps) plus microtonal grids (5-, 7-, 19-EDO,
  harmonics 8–15, Bohlen–Pierce over the 3:1 tritave). **Root** transposes.
- **Loop** off is the rhythmic MVP: play live, nothing repeats.
- **Snap** quantises to 16ths, HLO-style.
- **Morph** (on by default): every pass, each loop takes a small random
  step in rotation, size and position, and eases toward it. Since pitch is
  height and voice is direction, its melody and orchestration drift *as you
  watch*. Off = freeze where they are. Held loops don't morph.
- **Walk** shifts everything along a four-step progression every two bars.
- **Drone** adds a root + fifth bed that follows Walk.
- **Toybox**: Spiral, Ring, Star, Figure 8, Zigzag, Shaker (one of a few
  accent "feels", 1–3 beats long), Dice. Toys run through the same tracer as
  fingers, so they obey the same rules, and you can drag and turn them too.

All sound is synthesised in Web Audio (no samples to load, same stance as
`@enkerli/drumsynth`), with a dotted-eighth feedback delay on a send
(a loopy delay, because of course).

### What changed from v0, and why

- v0's Drift nudged pitches invisibly, so loops felt static ("the paths
  don't morph much"). v1 moves the **shape**, and the sound follows from
  the shape. Cause and effect are visible.
- You expected to move and stretch figures. Now you can, and because
  every mapping is computed *after* the transform, handling a loop is
  playing it.
- The toybox replaces Surprise, which was a single random spiral.
- Shaking is a gesture, not a button, as in the toyboxes and shakers that
  inspired it.

## Design choices worth arguing with

1. **Notes come from distance *and* turning.** This is the one idea the toy
   rests on. Turning-triggered notes make curvature audible, which is what
   makes 2D gestures different from a qurve.
2. **Direction → voice uses the heading since the previous note**, not the
   last few pixels, so finger jitter doesn't flip voices.
3. **Loops replay the *recorded* timing** (snapped or not), and the playhead
   rides along the drawn path. The loop is your gesture, not an abstraction
   of it.
4. **Pitch is stored as height, not as a note**, and read after the loop's
   transform. Changing grid remaps every loop instantly; moving, stretching
   and Morph are all just geometry.
5. **Loop length rounds up to whole beats.** Bars would be tidier; beats
   give polymeter, which is the fun part.

## Known limits

- No MIDI out (WebKit). Sound is in-page only. See "bridges" below.
- No save / recall. Close the tab, lose the loops.
- Max 14 loops; oldest goes first.
- Pinch is tested with synthetic touches in Chromium, not yet on the iPad.
- Drum voice by height thirds is blunt.
- Tested in headless Chromium, not yet on the iPad itself. iOS Safari
  needs the first touch to unlock audio; if it stays silent, tap
  "Start sound".

## Next, roughly in order of fun per hour

- **Widgets on the sheet.** Playground's real trick: a few fixed shapes
  (rings, pads, lanes) that a stroke can *cross*, each crossing a sound.
  Then DRUW-style "generate a map" = scatter widgets.
- **Loops that collide.** When a loop's playhead crosses another loop's
  path, trigger that point. Rube Goldberg, but out of your own scribbles.
- **Time transforms per loop**: halve/double speed, reverse. (Spatial
  move/turn/stretch landed in v1.)
- **Shaker as performance**: the shake's own timing unquantised, or a
  "swing" amount, so a shaker loop can lope instead of tick.
- **Grid on the x axis too**: vertical lines as durations, so the sheet is
  a full note/duration grid (DrawnQurve's x divisions).
- **Life-like evolution** beyond Drift: loops that breed (splice two paths),
  or fade unless touched.
- **Texture mode**: a voice that's continuous rather than per-event (a
  granular smear following the finger, Ribbons-like).
- **Save as a library item** once it's worth keeping (`docs/LIBRARY_SPEC.md`).

## Bridges: getting this to real synths before the Mac is back

The constraint: WebKit has no Web MIDI, and BUILD.md §3 already documents
that Safari can't reach `http://localhost` from an `https://` page. So:

1. **Serve the page *from* the Linux box** (plain `http://` on the LAN,
   e.g. `http://linuxbox.local:8080`), and have the same server take a
   WebSocket from the page and emit ALSA MIDI (Node: `ws` + `@julusian/midi`
   or `easymidi`). Same origin, so no mixed-content problem; the iPad is
   the playing surface; the Linux box talks to the Diosynth / RND. This is
   the most direct path and reuses everything here (swap `play()` for a
   `send()`).
2. **Open Stage Control** on Linux: browser-based OSC/MIDI control
   surfaces, iPad as client over the LAN. Good for the control-surface
   sidequest; less good for a toy like this (it's a widget builder).
3. **OSC from the iPad** via an app (TouchOSC, Lemur-likes) into Pd/PlugData
   on Linux. Flexible, but it's the "quite a bit of setting up" path.
4. **Huion tablet on Linux** with this page in Chromium (which *does* have
   Web MIDI on Linux). Single pointer, but pressure is available on Pointer
   Events: a pen version of Twirl could map pressure to timbre.

Option 1 is the one that keeps "plug and *play*". Worth building only if
v0 turns out to be fun on the iPad first.
