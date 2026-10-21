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

## What it does

How to play, level by level, is in **[GUIDE.md](GUIDE.md)**. In short:
draw, and it plays and loops; direction picks the voice, height the
pitch; hold a loop for its own settings; Toybox holds shapes, your kept
toys, and scenes; codes move anything between browsers and people.

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

**v4** (after v3, sharing and layout): a phone layout in the Suite's
drawer pattern; Toybox / My toys / Scenes as one shelf with tabs instead
of panels that toggle; two-tap Clear; live speed label while resizing;
junk-tolerant links and a paste box after field links arrived mangled.

**v5** (after v4):
- *"Sharing still not working; the slots don't come along."* Links that
  long don't reach the page on claude.ai, and scenes lived in one browser
  only. Now everything moves as **codes**: a sheet, a toy, or *Copy
  everything* (all scenes and toys), pasted into Scenes → Paste a code.
  No servers, no files.
- *"Revoicing could be toy by toy."* Each loop has its own pen and its own
  "turning changes voices" switch, in its settings (hold the loop).
- *"Unclear when notes trigger; Lock barely changes anything."* Lock now
  reads a loop the way DrawnQurve does: every division step, height
  snapped to the pitch lines, repeated pitches held. A steady pulse,
  clearly different from Free.
- *"Breathing room."* Notes: sparse / medium / dense. Medium is sparser
  than before.
- *"The More section is cut off."* Gone: replaced by levels.
- *"Change the sounds: packs."* Paper, mallets, chip.
- *"Limit the zone a toy moves in: a bass, a topline."* Zones: anywhere,
  high, middle, low.
- *"Progressive disclosure."* Simple / More / Everything. Twirl opens at
  Simple; the slim bar + drawer is now the layout at every size.
- Hold a loop opens its settings (it used to erase); flick a loop off the
  edge to throw it away.

**v6** (after v5):
- *"Not hearing differences from subdivisions or Lock."* They really
  didn't touch existing loops: snapping was baked in while drawing, and
  Lock only applied to new strokes. Now both happen **at playback**:
  notes keep the moment you drew them, and are snapped to the division as
  they play; Lock reads every loop that follows it, at once. Each loop can
  opt out (Timing: as drawn / on the grid).
- *"Not clear how a shot is fired; distance on the path vs rhythm."* One
  rule, made visible: a note sounds when the playhead reaches it, at the
  playhead's place at that moment. **Beat ticks** across every path show
  where the playhead is on each beat (close ticks = drawn slowly), and
  snapped notes are drawn where they now sound.
- *"Dynamics."* Dot size = loudness. Faster drawing, or pen pressure, is
  louder; each loop has a Volume; the drawer has a master Volume (- / =).

## Design choices worth arguing with

1. **Notes come from distance *and* turning.** This is the one idea the toy
   rests on. Turning-triggered notes make curvature audible, which is what
   makes 2D gestures different from a qurve.
2. **Direction → voice uses the heading since the previous note**, not the
   last few pixels, so finger jitter doesn't flip voices.
3. **Loops replay the *recorded* timing**, and the playhead rides along the
   drawn path. The loop is your gesture, not an abstraction of it.
   Snapping is applied at playback (never baked in), so the division can
   change under a loop and back again without loss. Resizing scales the
   timing.
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
8. **Lock holds repeated pitches.** A locked loop strikes when its pitch
   (or voice) changes and rests otherwise, so a level line is one long
   note, not a machine gun. Notes: dense brings back the re-strikes.
9. **Simple first.** Nothing is added to the Simple level unless the
   first minute is better for it.

## Known limits

- MIDI out only where Web MIDI exists (not on iPad or iPhone). See
  ROADMAP and "bridges" below.
- Long *links* may open empty on claude.ai; *codes* always work.
- Max 14 loops; oldest goes first.
- Gestures are tested with synthetic touches in Chromium; thresholds are
  tuned by hand on devices (see TESTING.md).
- iOS Safari needs the first touch to unlock audio; if it stays silent,
  tap Play.

## Next, roughly in order of fun per hour

- **Widgets on the sheet.** Playground's real trick: a few fixed shapes
  (rings, pads, lanes) that a stroke can *cross*, each crossing a sound.
  Lock mode is the first half of this (the grid lines are the widgets).
  Then DRUW-style "generate a map" = scatter widgets.
- **Sandboxes on a zoomable map.** See ROADMAP.
- **Loops that collide.** When a loop's playhead crosses another loop's
  path, trigger that point. Rube Goldberg, but out of your own scribbles.
- **Reverse a loop** (flip it? a mirror gesture would be natural).
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
