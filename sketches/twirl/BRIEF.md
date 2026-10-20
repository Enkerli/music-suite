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

## What it does (v2)

Open `index.html` (or the published link). The first time, a spiral, a
dropped line and a shaker are on the page; after that, **your last sheet
comes back**. Touch anywhere to start the sound.

| You do | It does |
|---|---|
| Touch down | A drum hit |
| Move | A note every grid column's width of distance **or** every ~50° of turning. **A spiral is an arpeggio.** |
| Move → right / ↑ up / ← left / ↓ down | pluck / bell / blip / drum. Direction picks the voice, Playground-style |
| **Scribble fast back and forth** (two quick short reversals) | Shaker mode: every reversal is a shaker hit, accents from how hard you shake. The wiggles that led into it are dropped. A long move goes back to drawing |
| Height | Pitch on the grid's horizontal lines. **Drums are pitched too**: hats at the top, tuned snare in the middle, tuned kick/tom at the bottom |
| Left ↔ right | Stereo position |
| Speed | Loudness |
| Lift | The stroke becomes a loop. Length = duration rounded **up to whole beats** → polymeter |
| **Drag a loop** | Moves it. Up/down transposes it |
| **Two fingers on a loop** | Turn it and resize it. **Bigger = slower, smaller = faster**: ½, ⅔, ¾, 1, 4⁄3, 1½, 2 (free-running if the division is Free) |
| Tap a loop | Mute / unmute |
| **Double-tap a loop** | Change how it moves on its own: still → drift → spin → jitter |
| Hold a loop | Erase it |
| **Edit on**: tap a path / tap a note / drag a note | Add a note there / remove it / reshape the path around it (soft falloff) |

Controls:
- **Grid** (horizontal lines): DrawnQurve's scale families plus microtonal
  grids (5-, 7-, 19-EDO, harmonics 8–15, Bohlen–Pierce). **Root**
  transposes. **Range** sets how many octaves (periods) the sheet covers,
  so the line count follows the note range, as in DrawnQurve.
- **Division** (vertical lines): Free, 1/4, 1/8, 1/8T, 1/16, 1/16T, 1/32.
  One bar spans the sheet. The division is the snap, and a column's width
  is the distance between notes, so finer division = finer timing *and*
  denser notes.
- **Loop** off is the rhythmic MVP: play live, nothing repeats.
- **Morph**: each loop moves according to its own temperament (still,
  drift, spin, jitter; random at birth, changed by double-tap). Off =
  freeze where they are. Held loops don't move.
- **Revoice** (off by default): off, a loop keeps the voices you drew
  however it turns, so a dropped line stays drums and its turning walks
  the drums through pitches. On, turning re-orchestrates it (v1 behaviour).
- **Walk**, **Drone**: as before.
- **Toybox**: Spiral, Ring, Star, Figure 8, Zigzag, Drop (a straight line
  down: all drums, set to spin), Shaker, Dice.
- **Scenes**: six slots. Empty slot: tap to save. Full slot: tap to recall,
  hold to overwrite. Thumbnails show the shapes. The current sheet also
  autosaves every few seconds and comes back on reload. All stored in
  this browser only (`localStorage`).

All sound is synthesised in Web Audio (no samples to load, same stance as
`@enkerli/drumsynth`), with a dotted-eighth feedback delay on a send.

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
6. **Size = time, not pitch range.** Resizing still spreads a loop over
   more pitch lines (height is height), but the main thing it changes is
   speed. An open question: should resizing *only* change time and keep
   the pitch spread?

## Known limits

- No MIDI out (WebKit). Sound is in-page only. See "bridges" below.
- Scenes live in this browser only; no export/import yet.
- No audio recording yet.
- Max 14 loops; oldest goes first.
- Shake, pinch and double-tap are tested with synthetic touches in
  Chromium, not yet on the iPad. Thresholds will likely need tuning.
- The toolbar wraps to two rows below ~1300px wide.
- iOS Safari needs the first touch to unlock audio; if it stays silent,
  tap "Start sound".

## Next, roughly in order of fun per hour

- **Widgets on the sheet.** Playground's real trick: a few fixed shapes
  (rings, pads, lanes) that a stroke can *cross*, each crossing a sound.
  Then DRUW-style "generate a map" = scatter widgets.
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
