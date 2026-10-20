# Twirl — brief and notes

*Started 2026-10-20, on an iPad, primary Mac at the shop. Public Domain
(CC0-1.0), like the rest of the suite. Where this is heading:
[ROADMAP.md](ROADMAP.md).*

## The brief, in one line

**Visceral playfulness: I make arbitrary gestures and it makes fun little
things, some of which keep going on their own.** No setup before the first
sound. No plugging.

## Where it comes from

Inspirations, loosely held: Twirl has long since gone its own way.


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

## What it does (v3)

Open `index.html` (or the published link). The first time, a spiral, a
dropped line and a shaker are on the page; after that, **your last sheet
comes back**. Touch anywhere to start the sound.

### Two ways a stroke makes notes

| | **Free** (Lock off, default) | **Lock** (Lock on) |
|---|---|---|
| A note fires… | every grid column's width of distance, or every ~50° of turning | **wherever the line crosses a grid line**, DrawnQurve-style |
| Pitch | the band the note sits in | crossing a horizontal line plays *that line's* note; crossing a vertical line plays the band you're in |
| Accents | drawing speed | vertical lines on the beat are accented |
| Touch-down | a drum hit | nothing (only crossings play) |
| When the loop moves | its notes ride along: same rhythm, new pitches | **crossings are recomputed live**: moving, turning or resizing a locked loop changes its rhythm *and* its pitches, because it crosses different lines |
| What you see | a glyph per stored note | a small glyph at every crossing, flashing as it plays |

Lock is chosen per stroke (it's whatever Lock was when you drew it), so
free and locked loops can play together. The loop list marks locked ones.

### Everything else

| You do | It does |
|---|---|
| Move → right / ↑ up / ← left / ↓ down | pluck / bell / blip / drum, **unless the Pen says otherwise** |
| **Pen** picker | By direction (default), or force drums / pluck / bell / blip / shaker for new strokes. Pen: drums + Lock is the quickest drum-beat flow |
| **Scribble fast back and forth** | Shaker mode (works in both modes) |
| Height | Pitch on the grid; drums are pitched too (hats top, tuned snare middle, tuned kick bottom) |
| Lift | The stroke becomes a loop: duration rounded **up to whole beats** → polymeter |
| Drag a loop | Moves it |
| **Two fingers on a loop**, or **two fingers landing together around a small loop** | Turn and resize. **Bigger = slower** (½ … 2); resizing also spreads it over more pitch lines |
| Tap / double-tap / hold a loop | Mute / change how it moves (still, drift, spin, jitter) / erase |
| **Edit on** | Square handles on every path: **drag to bend** it (soft falloff, notes ride along). Tap a path to add a note (free loops), tap a note to remove it, **hold a loop to smooth it** |

Controls: **Grid** (12-note scale families from DrawnQurve, plus
microtonal grids), **Tuning** (Equal, Just 5-limit, Pythagorean, ¼-comma
meantone, Werckmeister III; applies to 12-note grids, disabled for
microtonal ones), **Root**, **Range** (Y lines), **Division** (X lines:
snap + free-mode note spacing + lock-mode lines), **Pen**, **Lock**,
**Loop**, **Morph**, **Revoice** (off: voices stay as drawn however a loop
turns), **Walk**, **Drone**, **Edit**, **Toybox**, **Scenes**, and
**Output** (only where the browser has Web MIDI: sound, MIDI, or both).

**My toys**: a second toybox for loops you keep. Tap *Keep a loop*, then
tap any loop on the sheet: it's saved with its current turn and size baked
into its shape, relative to its own centre, so it drops anywhere at the
same proportions. In the tray, *Drop / Share / Delete* sets what tapping a
toy does. A shared toy is a short link (a few hundred characters); opening
it drops the toy onto the recipient's sheet and adds it to their My toys.

**More** (in the toolbar) holds the less-used toggles: Revoice, Walk,
Drone. It shows a dot when any of them is on.

**Share this sheet** (in the Scenes tray): the whole sheet (loops,
transforms, temperaments, grid, tuning, tempo, toggles) is packed into the
link's `#fragment`, so nothing is uploaded and the link *is* the scene.
Paths are simplified first (keeping both shape and timing), numbers become
small integers, then it's deflated and base64url-encoded: a busy 14-loop
sheet is about 4 KB of link. Opening a link with a sheet in it loads that
sheet instead of your last one. Links from the published page point at the
published page; links from a copy on GitHub Pages, a LAN server or a local
file point at that copy.

Microtonal grids: 5-, 7-, 19-, 24-EDO; slendro, pelog and maqam Rast
(approximations: real gamelan tunings vary by ensemble, and maqam
intonation is context-dependent); harmonics 8–15; Bohlen–Pierce.

Toybox: Spiral, Ring, Hexagon, Star, Rose, Figure 8, Lissajous (3:2),
Wave, Zigzag, Drop, **Beat** (a drum pattern drawn as a staircase over
kick/snare/hat heights), Shaker (now a 60 × 40 px target), Dice.

MIDI out: pluck ch 1, bell ch 2, blip ch 3, drums and shaker ch 10 (GM
36/38/42, maracas 70). Microtonal pitches are rounded to the nearest
semitone for now. Works in Chromium (e.g. on the Linux box, with the Huion
as the pen); WebKit has no Web MIDI, and embedded frames usually block it.

### What changed, and why

**v1** (after v0): v0's Drift nudged pitches invisibly, so loops felt
static. v1 moved the *shape*, with the sound following. Loops became
movable and turnable; a toybox replaced Surprise; shaking became a gesture;
grids arrived.

**v2** (after v1):
- *"Shakers are hard to pick up."* Two reversals now trigger it (was
  three), with looser thresholds, and pre-shake wiggles no longer leave
  stray notes behind. Toys can't accidentally become shakers.
- *"Size could be associated with timing."* Resizing now retimes, snapped
  to musical ratios, phase-continuous. Morph no longer changes size, so
  size only changes when you change it.
- *"The grid could be similar to DrawnQurve."* Range = Y subdivisions,
  Division = X subdivisions, and the X lines mean something (snap + note
  density) rather than decorating.
- *"Sounds stay the same as the figure rotates."* Revoice toggle, off by
  default.
- *"Other ways to modify elements."* Edit mode: add, remove, reshape.
- *"Movements apply differently to different objects."* Temperaments.
- *"Recording and recalling."* Scenes + autosave. Audio recording to a
  file is not in yet (an embedded page can't download files; it would work
  from the standalone file).

The scheduler was rewritten to be stateless per lookahead window (it
derives every event in `[cursor, horizon)` from start, length and
time-scale), which is what makes retiming and recalling safe.

**v3** (after v2):
- *"Unclear why something triggers or not."* Lock mode: notes only where
  a line is crossed, visible as glyphs on the crossings, and recomputed
  live as the loop moves.
- *"The shaker toy is too small a touch target."* Small loops can now be
  grabbed anywhere in a padded box around them, two fingers landing
  together around a loop pick it up, and the shaker toy is bigger.
- *"An obvious flow for drum beats."* The Pen picker, and the Beat toy.
- *"Bézier curves."* Paths are drawn as smooth curves through every point;
  Edit has bend handles and hold-to-smooth.
- *"More objects. And tuning systems."* Five new toys; a Tuning picker
  and four new microtonal grids.
- *"Sound out and MIDI out."* Web MIDI output as progressive enhancement:
  the first piece of the plugin path (see ROADMAP).

## Design choices worth arguing with

1. **Notes come from distance *and* turning.** This is the one idea the toy
   rests on. Turning-triggered notes make curvature audible, which is what
   makes 2D gestures different from a qurve.
2. **Direction → voice uses the heading since the previous note**, not the
   last few pixels, so finger jitter doesn't flip voices.
3. **Loops replay the *recorded* timing** (snapped or not), and the playhead
   rides along the drawn path. The loop is your gesture, not an abstraction
   of it. Resizing scales that timing; it never re-quantises it.
4. **Pitch is stored as height, not as a note**, and read after the loop's
   transform. Changing grid remaps every loop instantly; moving, stretching
   and Morph are all just geometry.
5. **Loop length rounds up to whole beats.** Bars would be tidier; beats
   give polymeter, which is the fun part. Resize ratios then add
   polyrhythm on top (a 3-beat loop at ⅔ is 2 beats of triplet feel).
6. **Size = time *and* pitch spread.** Resizing retimes a loop and spreads
   it over more pitch lines (height is height). Settled: keep both.
7. **Lock is per loop, not global.** Changing the toggle affects new
   strokes only, so a sheet can mix free melodies and locked grooves.

## Known limits

- MIDI out only where Web MIDI exists (not on the iPad). See ROADMAP and
  "bridges" below.
- Scenes live in this browser only, but any sheet can travel as a share
  link. No audio recording yet.
- Max 14 loops; oldest goes first.
- Gestures are tested with synthetic touches in Chromium, not yet on the
  iPad. Thresholds will likely need tuning.
- The toolbar is two rows on an iPad (sound and grid above; drawing and
  trays below).
- iOS Safari needs the first touch to unlock audio; if it stays silent,
  tap "Start sound".

## Next, roughly in order of fun per hour

- **Widgets on the sheet.** Playground's real trick: a few fixed shapes
  (rings, pads, lanes) that a stroke can *cross*, each crossing a sound.
  Lock mode is the first half of this (the grid lines are the widgets).
  Then DRUW-style "generate a map" = scatter widgets.
- **Sandboxes on a zoomable map.** See ROADMAP.
- **Loops that collide.** When a loop's playhead crosses another loop's
  path, trigger that point. Rube Goldberg, but out of your own scribbles.
- **Reverse a loop** (flip it? a mirror gesture would be natural).
- **Scene export/import** as a file or a copyable string, then audio
  recording from the standalone page.
- **Shaker as performance**: the shake's own timing unquantised, or a
  "swing" amount, so a shaker loop can lope instead of tick.
- **Life-like evolution** beyond temperaments: loops that breed (splice two paths),
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
