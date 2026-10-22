# Twirl: how to play

*Public Domain (CC0-1.0). For what Twirl is for and why it works the way
it does, see [BRIEF.md](BRIEF.md); for where it's going,
[ROADMAP.md](ROADMAP.md); for how it's checked, [TESTING.md](TESTING.md).*

Twirl is meant to be played before it's understood. This guide follows the
same order as the app: **Simple** (what you can do without reading
anything), **More** (shaping what you hear), **Everything** (the tool
underneath). The level switch is at the top of the ☰ drawer, and Twirl
remembers your choice in this browser.

## How a note is fired

This is the one thing worth knowing, and the sheet shows it:

- **A loop replays your gesture at the speed you drew it.** The blue dot
  is the playhead, travelling along the path.
- **The other dots are notes.** While you draw, a note is made every so
  often: after some distance, or when the line turns. A note **sounds
  when the playhead reaches it**, at the pitch of its height (and its
  left-right position) at that moment.
- **Ticks across the path mark the beats**: where the playhead will be on
  each beat (a longer tick starts each bar). Ticks close together: you
  drew slowly there, so that stretch takes time. Far apart: you drew
  fast, so it flies by. *Distance on the path is not time; ticks are.*
- **Snapping**: with a beat division chosen (More level), each note is
  moved to the nearest step **as it plays**, and drawn where it now
  sounds. Change the division and every loop follows at once: at 1/4 the
  dots gather onto the beat ticks; at 1/16 they spread back out.
- **Lock** reads loops differently: instead of your notes, every step of
  the division plays whatever pitch line the playhead is on (a held pitch
  isn't struck again). Turn it on and every loop changes at once.

**Loud and soft**: a dot's size is its loudness. Drawing faster makes
louder notes; with a pen (Apple Pencil, a Huion tablet), pressing harder
does. Each loop has its own **Volume** (hold it), and the drawer has a
master **Volume**. On the grid (Lock), notes on the beat are accented.

## Simple: just play

Touch anywhere. Sound starts on the first touch (or press **Play**).

| Do this | And this happens |
|---|---|
| Draw | It plays as you draw, then loops on its own clock. Each loop's length is your gesture's duration, rounded up to whole beats, so loops of different lengths drift in and out of phase. |
| Draw a spiral | An arpeggio: notes come from distance travelled *and* from turning, so curls are busy and straight lines are sparse. |
| Draw in different directions | Different sounds: → pluck, ↑ bell, ← blip, ↓ drum. |
| Draw higher or lower | Higher or lower notes. Drums too: hats near the top, snare in the middle, kick at the bottom. |
| Scribble fast back and forth | A shaker. How hard you shake sets the accents. |
| Tap a loop | Mute it (tap again to unmute). |
| Drag a loop | Move it. Moving it up or down changes its notes. |
| Flick a loop off the edge | Throw it away. |
| Two fingers on a loop | Turn it, and resize it: **bigger plays slower**, smaller plays faster. A label shows the speed while you do it. |
| Hold a loop | Its own settings (below). |
| **Toybox** | Ready-made shapes to drop on the sheet, plus tabs for **My toys**, **Scenes** and **Takes**. |
| The chips along the bottom | One per loop, numbered. Tap one to pick that loop and open its settings: the sure way to reach a loop that's small, crowded or moving. (The sheet shows the same numbers if you want them: drawer → **Numbers** at More, or press a digit key.) |
| **● Rec** (top bar) | Record what you play; press again to stop. A take keeps what you **did** (every stroke, move, mute, erase and setting) and, where the browser can, its **sound**. Toybox → **Takes**: **▶ Replay** plays it back on the sheet (below), **Save sound** saves the audio as a file, **Copy code** sends the take to someone. |

**A loop's own settings** (hold it, or tap its chip). While they're open,
picking another loop (a chip, or 1–9) switches them to that loop: the
quick way to mute loops one at a time.
- **Volume**: this loop only.
- **Moves**: still, drift, spin or jitter. Each loop wanders in its own way.
- **Lives**: anywhere, high, middle or low. A loop told to live low stays
  a bass however it wanders; one living high stays a topline.
- **Mute**, **Keep as a toy**, **Erase**.

**In the drawer (☰)** at this level: tempo, **Volume**, **Sounds** (paper,
mallets, felt, steel, kalimba, chip), **Notes** (sparse, medium, dense: how many notes a stroke makes),

**Loop** (off = nothing repeats: play it live), and **Clear** (two taps;
your saved scenes and toys are never touched).

## More: shape it

Adds to the drawer:

- **Grid**: the scale the horizontal lines stand for. **Root**, and
  **Range** (how many octaves the sheet covers).
- **Division**: the vertical lines. One bar spans the sheet. Every loop's
  notes snap to it as they play (Free: no snapping), and it's the pulse of
  Lock. Changing it changes every loop at once.
- **Pen**: which voice new strokes play. *Direction* (the default) or
  always drums, pluck, bell, blip, shaker. Pen: drums is the quickest way
  to make beats. The **Pen** button in the top bar opens a small
  **palette** you can drag anywhere on screen; ⇧1–⇧6 pick from it.
- **Lock** (also in the top bar): every loop is read like DrawnQurve.
  On every step of the division, Twirl looks at where the loop's playhead
  is and snaps its height to the nearest pitch line. A new pitch strikes;
  the same pitch is held, not re-struck. Without Lock, loops have the
  rhythm of your gesture; with it, a steady pulse with rests where the
  line stays level. It applies at once, to every loop that follows it.
- **Morph**: off freezes every loop where it is.
- **Edit notes**: square handles appear on every path. Tap a path to add a
  note, tap a note to remove it, drag a square to bend the path, hold a
  loop to smooth it. (Also from a loop's settings: *Edit notes*.)
- **Swing**: every other step of the division comes late. 0 is straight.
- **Air**: breathing room. When the sheet gets busy, the notes that
  matter least to the bar rest, and weaker positions play a little
  softer (with a touch of variation). "Matter least" is Barlow's
  *indispensability*, the version the Suite uses (Serpe, @enkerli/theory),
  which ranks every step of the bar, triplets included: the downbeat
  first, then the half bar, the quarters, the eighths, the pickup just
  before the next bar. Downbeats always play; what you're drawing is never
  thinned.
- **Numbers**: show each loop's number on the sheet. Off by default; the
  selected loop always shows its own, and pressing a digit key turns them
  on.
- **Arc**: tension and release over 4 or 8 bars. *Home*, then *away*
  (everything shifts up the scale), then *pull* (a step further, leaning
  back), then *resolve*: on the last bar every note settles onto the home
  chord (the scale's 1st, 3rd and 5th steps). The phase names show at the
  top of the sheet, the current one coloured. Arc replaces Walk while
  it's on.

And a loop's settings add:

- **Voice** (direction, or one fixed voice), and **Speed** (½ to 2, the
  same ratios as resizing).
- **Rhythm**: *as drawn* (when you drew each note), *even* (the same
  notes, evenly spaced around the loop), or *euclidean* (spread over the
  beat steps as evenly as they allow, as in Serpe). Pitch still follows
  the playhead, so re-timing a loop also re-shapes its tune.
- **Chord**: *single*, *fifths*, *triads*, *sevenths* or *sus*. Each note
  becomes a stack built from every other step of the current scale, so
  chords stay in key and in tuning. Drums and the shaker stay single.
- **Direction**: *forward*, *reverse* (the playhead runs the path
  backwards, so a rising line falls), or *ping-pong* (forward, then back).
- **Plays**: every pass, every other pass, or one pass in three. A loop
  that rests now and then leaves room for the others.
- **Waits**: a rest after each pass (none, 1 beat, 2 beats, a bar), so the
  loop comes round less often. The same as drawing a gesture and holding
  still at the end, as a setting. It scales with the loop's speed.
- **Starts**: *earlier* / *later* moves the loop one step against all the
  others (an offset). Scenes keep each loop's place in its cycle.
- **Duplicate** (or press **D**): a copy, nudged aside, half its cycle
  behind the original, so even a one-beat loop answers itself. Set the
  copy to *reverse* for a mirror canon.
- **Timing**: *follow Lock* (the default), *as drawn* (never locked: a
  shaker or a melody you want to keep loose), or *on the grid* (always
  locked).

## Everything: the tool

Adds:

- **Tuning** for 12-note grids: equal, just (5-limit), Pythagorean,
  ¼-comma meantone, Werckmeister III. Microtonal grids (5-, 7-, 19-,
  24-EDO, slendro, pelog, maqam Rast, harmonics, Bohlen–Pierce) bring
  their own tuning.
- **Revoice**: whether *new* loops change voice when they turn. Each loop
  can be switched on its own (hold it → *Turning changes voices*), so a
  drum line can stay drums while a melody re-orchestrates itself.
- **Walk**: every two bars, everything shifts along a little progression.
- **Drone**: a slow pad underneath (detuned saws through a breathing
  filter), following the grid, tuning, root and Walk. **Voicing**: low
  fifth, fifth, triad or open; and its own **Level**.
- **Output** (only where the browser has Web MIDI, e.g. Chromium on
  Linux): sound, MIDI, or both. Pluck on channel 1, bell 2, blip 3, drums
  and shaker 10.

## Keyboard

Every touch on the sheet draws, so with a keyboard you can steer without
leaving marks. Press **?** in Twirl for this list (also at the bottom of
the drawer).

| Key | Does |
|---|---|
| Space · ⇧Space | Play / pause · record / stop |
| 1 … 9 | Select a loop (Tab steps through them; 0 or Esc deselects) |
| Enter | The selected loop's settings |
| ← ↑ ↓ → · , . | Move the selected loop (⇧: further) · turn it |
| < > · X · D | Selected loop slower / faster · mute it · duplicate it |
| ⌫ or ⌘Z (Ctrl+Z) | Erase the selected loop, or the newest one (undo) |
| ⇧⌘Z (Ctrl+Shift+Z, Ctrl+Y) | Bring it back (redo) |
| ⇧⌫ | Clear the sheet (press twice) |
| ⇧1 … ⇧6 · V | Pen: direction · drums · pluck · bell · blip · shaker · show the palette (by key position, so on any layout; a key that types ? < or > does that instead) |
| L · M · E | Lock · Morph · Edit notes |
| P · N · B · G | Next pen · notes density · sound pack · grid (⇧ goes back) |
| [ · ] · - · = | Tempo down / up (⇧ for 10) · volume down / up |
| T · Y · S | Toybox · My toys · Scenes |
| C · \ | Controls drawer · Simple → More → Everything |
| R · W · O | Revoice (new loops) · Walk · Drone |
| Esc | Close whatever is open |
| ? · H | This list (H for layouts where ? needs ⇧6 or similar) |

## Keeping and sharing

Nothing goes to a server. Everything lives in this browser, and moves as
**codes** you copy and paste.

- **Scenes** (Toybox → Scenes tab): six slots. Empty: tap to save. Full:
  tap to recall, hold to overwrite. Your current sheet also saves itself
  and comes back when you return.
- **My toys** (Toybox → My toys tab): tap *Keep a loop*, then tap a loop.
  *Drop / Share / Delete* sets what tapping a toy does.
- **Share this sheet** gives a code like `twirl:s1.eJx…`. Send it any way
  you like. The other person opens Twirl, goes to Scenes → **Paste a
  code**, and pastes it. Junk that apps add on the way (line breaks,
  stray characters, a message around it) doesn't matter.
- **Copy everything** puts all your scenes and toys in one code. Paste it
  on another device (Apple's Universal Clipboard carries it from iPad to
  iPhone) and your empty scene slots fill up and the toys arrive.
- **Copy as a link** works for short things (a toy, a small sheet).
  Longer links may not open on claude.ai, which only passes short, clean
  link endings to the page; codes always work.
- Opening someone's sheet replaces yours on screen, but yours is kept:
  Scenes → **Back to my sheet**.

### Takes: replaying a playflow

A take is a **playflow**: what you did, in beats, rather than a recording
of the sound. The newest dozen are kept in this browser, even after a
reload.

- **▶ Replay** clears the sheet (yours is kept: Scenes → Back to my
  sheet) and plays your session back as it happened: strokes appear where
  and when you drew them, loops move, mute, change and vanish, settings
  and tempo change on cue. A bar at the top shows the time; **Stop** ends
  it.
- **Touch the sheet to take over.** The replay stops right there and the
  sheet is yours, so a take is also a way back into a moment you liked.
- Morph's wandering isn't recorded, only what you did: replayed loops
  wander afresh (a loop set to *still* replays exactly).
- **Copy code** gives `twirl:f1.…`; it pastes like any other code (Scenes
  → Paste a code) and lands in the other person's Takes.
- The **sound** of a take stays only until you close the page: *Save
  sound* if you want it as a file.

## Tips

- Lost? Clear (two taps), and draw one slow spiral.
- For a groove: Pen: drums, Lock on, Division 1/8, draw a few short
  zigzags low on the sheet; then a free melody up high, told to live high.
- Notes: sparse gives loops room to breathe. So does **Air**, and so
  does telling a busy loop to play every other pass.
- For a canon: select a loop, press D, set the copy to *reverse*.
- For something that comes round now and then: the **Call** toy, or any
  loop told to *wait* a bar.
