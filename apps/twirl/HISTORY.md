# Twirl — what shipped, and why

*The record of what was built, in order, with the details worth keeping
(radii, cooldowns, measurements, decisions). Moved out of the roadmap on
2026-10-25, so the [roadmap](ROADMAP.md) can look forward. Quotes are Alex's.*

## Before the repo

A single-file claude.ai artifact, through several versions up to the
Mutation prototype. It joined Enkerli/music-suite on 2026-10-24 with tests
and an accessibility pass.

The first priorities (from a prioritization exercise with another agent;
criterion: new musical behaviour relative to effort) were: mutation and
inheritance, musical collisions, expressive gesture mapping, loop
personalities, generative accompaniment, performance animation, alternative
pitch geometries. Its framing still holds: a drawing can be read
**literally** (the drawing is the notes), **interpretively** (a contour a
grammar realizes) or **generatively** (a family of phrases that evolves while
staying recognizable), always through transparent rules, never an opaque
model.

## 2026-10-24

**Mutation (prototype).** Loop settings → Mutate: a child through the
serialization path, the parent untouched; it inherits every setting, gets a
subtle spatial warp, pitch and onset nudges, small velocity changes, starts
half a cycle behind. `lineage` and `generation` travel in scenes, toys, codes
and takes (chips show `g1`, `g2`). Known limits: `lineage` is session-local;
nudges are fractions of the sheet, not scale steps; headings aren't
recomputed after the warp; no seed or family view (all in Mutation v2).

**Contacts, v1 to v3.** Decided with Alex: playheads, not paths, for
meetings; sound for every new loop; breeding built on Mutation.
- *Meetings*: two playheads within 26 px, by closest approach between ticks.
- *Crossings* (v2, "sound wants the more frequent contact"): a playhead's path
  since the last tick within 9 px of another loop's line, box-culled; drives
  sound and bump; once a beat per crosser and line.
- *Lines touching* (v3, "any point of contact between loops"): every 4th
  tick, ≤ 48 segments a line; only the onset counts (a loop drawn over
  another, or a child on its parent, isn't a contact). About 6 ms for 14
  overlapping spirals, worst case.
- Answers (`MEET_ORDER`, append-only): no, sound, trade (voice, chords,
  rhythm, direction, in turn), breed, bump (nudges along the playhead's way;
  never a held loop), infect (a child at any contact).
- **Meet** switch turns it all off; a replayed take only sounds its contacts.
- **Breeding made deliberate** ("a bit too frequent"): children don't inherit
  breed or infect; Surprise never gives them; 16 bars between children. At
  the 14-loop cap, breeding replaces the oldest loop (never a parent or a
  held one), into undo.

**Surprise** (`state.dice`): new loops draw Meets (sound .55, bump .25, trade
.2), direction (fwd .7, rev .15, ping-pong .15), rhythm (as drawn .7, even
.15, Euclidean .15); a toast names anything unusual. Shakers and beats stay
plain.

**Vary** ("round-robin. Reducing the typewriter/machine-gun effect"): each
note ±16 % loudness, ±7 ms (never early into the past), ±6 cents, and a
`nuance` voices read as colour (pluck brightness, bell inharmonicity, blip
length, hat size). MIDI gets loudness and timing.

**Sounds across banks** ("toys could come with their own sounds"): a loop can
play another pack (`lp.pack`); **Chimes**, a pack (free-bar partials
1 : 2.76 : 5.40 : 8.93) and a toy: a bar and five tubes, longer is lower,
struck in gusts over 11, 13 or 15 beats, off the grid. It replaced the
spiral on the starting sheet.

**Life and Evolve (the evolving patch, v1).** "A loop can get denser or
sparser… disappear with time… weaken or strengthen another… an evolving
patch." Rules: slow, visible, legible, reversible, opt-in. Lives: steady,
bloom (adds notes beyond the drawn ones, finer stride, strongest first),
swell (loudness), fade, brief; ages count passes actually played; a life that
ends goes into undo. Lengths 8 · 16 · 32 · 64 passes. Surprise hands out
lives only on sheets of four loops or more.

**Influence**: feeds / drains, at any contact, once a beat per pair; strength
0.4–1.6 (gain × s^0.7; denser above 1, sparser below); feeding keeps a mortal
loop young, draining ages it; settles back 15 % a pass.

**Timing freedom** ("the quantizing can get in the way… hidden from naïve
view"): per loop Snap (division · 1/64 · none), Feel (±40 ms), Clock (in step
· ±1 % drift); 1/64 as a division.

**Spinner** ("an ostinato which spins around"): a beat-long flick, a drum then
rising bells, spinning, so the arpeggio folds, opens and flips.

**Walk's ways and pace** ("the drone is mostly interesting when it moves"): a
progression, sway, fifths, climb, wander; every 1, 2, 4 or 8 bars.

**Messages** quiet (a dot) or shown (stacked), key I. **Replays** draw each
loop as it was drawn.

**Optimization pass, v1.** Measured on headless Chromium, CPU ×4, a busy sheet:
~30 fps, 70 ms frames, ticks up to 217 ms late against a 120 ms lookahead
(the "pause" Alex heard). Done: adaptive lookahead (to 0.4 s), the grid on its
own layer, adaptive sharpness, box culling, cached Life ranks, memoized
offsets, the Q readout, a budget test in CI.

**Start over** (two taps, undoable for 10 s); a sturdier full screen.

## 2026-10-25

**Morning.** Download everything as JSON, Open a file; Tab wraps inside
panels, Escape keys for dropdowns (the address-bar escapes); diagnostics (Q,
⇧Q copies a report) after unresponsive buttons nobody could explain; lives in
bars as well as passes; **Copy** to a family, all loops or chosen loops;
**Walk parts** per loop (moves / stays / fits); `?start=macro` (5-EDO,
slendro or 7-EDO) as a playtest condition; Surprise sometimes gives a fade of
16 or 32 passes; double-tap a note in Edit to change its sound.

**Keyboard and Walk.** Moving between loops' settings (PageDown/PageUp, ◀ ▶,
Tab past the end); loops 10–14 by two digits; new loops **fit** by default
(voice leading: "I really enjoy a bit of voiceleading… parallel motion…
might be jarring"); a fix for Safari's "RangeError: value cannot be 0" (an
exponential ramp to a zero peak, a fade's last note). Guide and README
rewritten.

**A calmer, more colourful sheet** ("auto-smooth new curves. Not show the
beat lines by default. And strokes can have their voice's colour"): paths in
their notes' colours, stretch by stretch; Beats (ticks across loops and lines
down the sheet) off by default, the lines always with Lock; new strokes
**settle** when lifted, by a Gaussian of ~8 px along the line (the first
version, two passes by points, was too light to see); scribbles stay
scribbles. The selected loop gets an ink halo (the accent was too close to
the pluck's blue).

**Spacing by register** ("wider gaps between bass notes, tighter between top
notes. Following loosely an acoustic principle about dissonance"): a scale
step gets its own row only if it's a quarter of a critical band (Zwicker)
above the last; octaves always; every octave equal height. The default
sheet's lowest octave plays the home chord. Chords under G3 open up. Fresh
sheets only; saved sheets open even.

**Warmth** ("an almost inaudible amount of pink noise… crackles… a tiny bit of
wobble… a tiny little sensation of presence and warmth"): pink noise near
−58 dB, a 17-second crackle loop, wow and flutter under 2 cents, all under the
master and scaled by Warmth (0.5). Alex: "Unnoticeable to the naïve ear."

**The Drone's space**: still, drifting, binaural (left and right 3 Hz apart),
rotating (a slow Leslie); a few cents of wobble.

**Tadpoles**: five one-note drifting figures with long rests that infect and
fade; **mortal breeders** (fade or brief) pass breeding on, so a population
keeps itself going and in check. "Really enjoy this integration of generative
with performing." Recorded in [INTENT.md](../../docs/INTENT.md) B1.

**Merge** (a loop swallows the loops it runs into, path and notes as they
are; up to 16 beats, once every 4 bars), **a quieter Drone** (measured at four
times a loop's loudness; brought to one loop, then half), its space drawn per
fresh sheet, **the drawer in two modes** with seven labelled sections, the
design brief, and the roadmap consolidated (this file split from it). A loop's
settings once grew wider than a phone (Meets' seventh answer): rows wrap now.

**Undo what happened**: each event the sheet makes on its own carries its own
Undo in the log. **The current chord** on the sheet under Walk. Tadpoles
without the current; the current in `?template=tadpoles`, the first template.

**After the triage** (Alex's decisions in the roadmap): tadpoles three at a
time and closer together; the Drone back to its old range, starting soft (a
level² slider from 0.3); a fix for notes one step below the sheet's bottom row
("The provided value is non-finite", twenty in one diagnostic): `%` on a
negative step read past the scale, now `mod`, and a note without a pitch is
skipped and counted (Q: skippedNotes) rather than throwing.

## 2026-10-25 to 27: Linux, the plugin, French

*Moved here from PLAN.md on 2026-10-30, when the plan was revised; the
plan's checklists for this work are closed.*

**Linux in the browser.** Brave on Ubuntu (PipeWire): 60 fps, ticks at most
19–22 ms late with 14 loops and 37–86 notes a second. MIDI out through Midi
Through; `tools/twirl-carla.py` builds a Carla rig (a Surge XT per voice
behind channel filters, GM drums on 10), its connections written by port
name after Carla's connect-by-id failed on a busy PipeWire graph. Hiccups
when switching windows were the page's own timer, throttled in the
background: the scheduler now ticks from a Worker (`?clock=main` keeps the
old timer). ⇧Q gained the pen, MIDI, late ticks, the audio device's latency.

**The plugin, [Enkerli/twirl-dpf](https://github.com/Enkerli/twirl-dpf).**
Without JUCE: DPF's `develop` branch (active; `main` is releases only) and
its web view (Qt WebEngine on Alex's machine, WebKitGTK elsewhere). LV2,
CLAP, VST3 and a JACK standalone; `make` copies this `index.html` in. Four
patches to DPF (twirl-dpf `patches/`): the CLAP bundle path on Linux
(Bitwig's ERR_FILE_NOT_FOUND), the web view's child exiting on SIGTERM
(closing the window crashed it), keyboard focus on click, the CLAP's timer
kept while the window is hidden ("stops playing as soon as another UI is
focused").
- *Timed MIDI*: each scheduler tick's notes as one `setState("notes", …)`
  with wall-clock times; the plugin queues them lock-free and writes each at
  its sample offset. Measured on Alex's machine: within 0.1 ms of Twirl's
  own timing, sent 56–140 ms ahead.
- *The page belongs to the plugin*: it runs in a hidden window from
  activation, so Twirl plays with its window closed; the UI is a window the
  page moves into. Saved with the host's project.
- *Following the host*: tempo, transport, beat; on by default; the clock
  stands still while the host is stopped (or gives no transport for 300 ms);
  corrections averaged over a second and applied only past 2 ms (on Carla's
  beat within 2 ms on average, 1.6 ms at most).
- *Route C, Twirl's sound made in the plugin*: a C++ engine
  (`TwirlEngine.hpp`: band-limited oscillators, Web Audio's biquads and
  ramps, panner, delay, compressor, the Drone, Warmth, a pool of 384
  voices) playing every pack; the page's audio stream removed from the
  plugin (kept on the web). A busy Chimes sheet: ~11 % of one core. Out:
  sound + MIDI (default), sound, MIDI. `make test` renders every voice;
  `tools/compare-engine.mjs` compares the engine with the page (all alike).
- *Synth mode*: MIDI coming in plays the voices (channels 1–3, 10 by note,
  4 a Drone of the notes held); **Incoming MIDI only** silences the sheet,
  so a Twirl is an instrument or a drum kit.
- *Host parameters*: 30, append-only (volume, tempo, follow, swing, Warmth,
  Air, Drone, Lock, Walk, sounds, scale, root, Vary, Evolve, Morph, groups'
  levels and mutes, Accents…), both ways, saved, parameters win on load.
- *Files*: scenes, named scenes, My toys and the look as files every
  instance shares (`~/.local/share/twirl`).
- Alex in Bitwig: "quite fun"; "it does work across saves and it does catch
  up with the host".

**The web, caught up with the plugin** (2026-10-27): MIDI in (synth mode in
the browser, Incoming MIDI only), Follow MIDI clock, MIDI learn for the 30
controls, Open a file with the plugin's files, Use a folder (shared with the
plugin), the Drone as MIDI on channel 4.

**Sounds.** Surge XT patches for every voice of every pack
(`apps/twirl/surge/`: generated from Surge's CC0 templates by
`make_patches.py`, numbers fitted against Twirl's own renders by `fit.py`;
scores 1.1–3.7), and a hand-made Drone patch; `twirl-carla.py --pack`
loads them. New packs: **Music box** (and a toy playing a public-domain
tune) and **Foley**; five **shakers** per loop. **Accents**: each note
weighted by its place (Barlow over the loop or the bar, or a UPI pattern),
louder, brighter and longer on strong places.

**Many loops at once.** **Groups A to D**, each with a level and a mute
(host parameters 22–29), kept by children and merges. **Named scenes**, as
many as wanted, each a file.

**French, as a draft for review.** English is the key (`i18n/fr.json`, 773
entries, plurals by `Intl.PluralRules`); translated where words land (a
pass at start, then a MutationObserver), so the code keeps its English;
opt-in (`?lang=fr`, or View → Language) until reviewed. Tests: every string
has French, nothing left in English through the page's states, axe in
French, no sideways scroll at 390 px. The guide in French
(`twirl-guide-fr`). After Alex ticked 258 of 773 strings, the review went
**terms first**: `i18n/terms.tbx` (TBX-Basic, 99 concepts), checked against
the strings by `tools/i18n/concord.mjs` (914 uses, 40 straying), a terms
page with Termium, Vitrine linguistique and Wiktionnaire links.
