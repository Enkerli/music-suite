# Twirl — roadmap

*Rewritten 2026-10-24, when Twirl joined the monorepo. The order of work
comes from a prioritization exercise done with another agent. Its criterion:
how much new musical behaviour a feature brings, relative to how hard it is
to build. The first section is the part that does not change: the rules
every step has to keep.*

## The rules every change keeps

These are held by tests where they can be (`test/`), and by review where
they can't:

1. **Immediate satisfaction.** Touch the sheet, hear something. A stroke
   sounds *while* it is drawn and keeps looping after. No setup, no menu,
   no theory needed first. Test: *Twirl · first contact*.
2. **Simple / More / Everything.** Each level only adds; nothing moves.
   New features arrive at More or Everything unless they're as basic as
   drawing.
3. **Surprises are audible, reversible and attributable** to a gesture or
   a rule you can find. No opaque generation. Small transformations by
   default; complexity is opt-in.
4. **Old work keeps opening.** Scenes, toys, share codes and takes from
   earlier versions still load. New fields go at the end of a packed row.
   Test: *codes made before generations existed still open*.
5. **The accessibility floor holds.** axe stays clean on every state in
   both schemes. Every gesture keeps a single-pointer or keyboard
   alternative. The keyboard never gets stranded: from the page, Tab steps
   through loops (Safari would otherwise send it to the address bar), and
   stated keys take focus into each panel; every panel closes without an
   Esc key. Tests: `test/twirl.a11y.test.js`;
   record in [A11Y.md](A11Y.md).
6. **Shared contracts stay shared.** Rhythm weights match
   `packages/theory/vectors/`, and masks are leftmost-LSB. If Twirl needs
   something the suite already has, it matches the suite's vectors (or
   imports the package, once Twirl has a build step).

## Priorities

| # | Feature | Effort | Value | What it adds |
|---|---|---|---|---|
| 1 | **Mutation and inheritance** | 2/5 | — | Duplicate loops with controlled pitch, timing and geometry changes. *Prototype shipped; v2 below.* |
| 2 | **Musical collisions** | 3/5 | — | Intersection detection, event generation, configurable interaction rules. *Crossings, meetings, bump, trade, breed shipped; next below.* |
| 3 | **Expressive gesture mapping** | 3/5 | — | Curvature, speed and pressure → articulation and synthesis |
| 4 | **Loop personalities** | 4/5 | — | Agent-like behaviours and relationships between loops |
| 5 | **Generative accompaniment** | 5/5 | — | Drawn contours read through musical grammars and curated patterns |
| 6 | **Performance animation** | 3/5 | 4/5 | Visualize and edit recorded gesture transformations over time |
| 7 | **Alternative pitch geometries** | 4/5 | 4/5 | Tonnetz, circular and ratio-lattice readings of the same drawing |

Effort and value are qualitative estimates of creative potential and relative
effort, not engineering estimates. Value was recorded for the last two only;
the "—" cells are blanks, not zeros.

The source exercise's own framing, worth keeping: the drawing can be read at
three levels. **Literal**: the drawing *is* the notes and their timing, as
now. **Interpretive**: the drawing gives a contour, rhythmic profile or
harmonic role, and a grammar realizes it. **Generative**: the drawing
defines a family of phrases, which Twirl evolves while keeping them
recognizable. Items 1–3 stay literal, 4–5 move toward interpretive, and
generative is what the whole list leans toward, through transparent rules
and curated patterns, never an opaque model.

## 1. Mutation and inheritance

### Shipped (prototype)

- Loop settings → **Mutate** (at More and Everything). Creates a new loop
  through the existing serialization path; the parent is untouched.
- The child inherits voice, chord, rhythm mode, speed, motion, timing,
  zone, volume and every other loop setting.
- Subtle spatial warp, occasional pitch and onset offsets, small velocity
  variation. The child is offset in space and half a cycle in phase, so it
  answers its parent.
- `lineage` (the first ancestor's id) and `generation` are stored in
  scenes, toys, share codes and takes, shown in the chips (`g1`, `g2`…) and
  in the loop's settings. *Fixed 2026-10-24: share codes, takes and kept
  toys used to drop them.*
- Respects the 14-loop cap; a removed parent never stays selected.

**Known limits.** `lineage` is a session-local id, not a durable family id,
so merging scenes from different sessions can collide (generation is
portable). Pitch and onset nudges are fractions of the sheet and of a beat,
not scale steps or grid steps: 0.035 of the sheet's height is about half a
band at 3 octaves of pentatonic, so some nudges change nothing and some jump
a step, and on microtonal grids it's arbitrary. Event headings are inherited
and not recomputed after the warp, so a direction-dependent voice can drift
from its path. Strength is fixed; there's no seed, preview, history or
family-aware undo.

### Next: Mutation v2 — musical, not just geometric

1. **Strength and targets.** Subtle / Playful / Wild, with independent
   toggles for contour, rhythm, harmony, voice and motion. Conservative
   default.
2. **Scale-aware pitch.** Shift by *degrees* of the current grid, not by
   height. Options to preserve intervals or consonance, and to allow octave
   displacement.
3. **Grid-aware rhythm.** Rotate onsets, subdivide, displace accents,
   insert or remove events, redistribute Euclidean-style, always keeping
   the bar length. (`@enkerli/upi` already has rotation, Euclid and Barlow
   dilution; match its vectors.)
4. **Seeded and replayable.** A seed per mutation, so the same seed gives
   the same child. Takes record the *operation*, not just its result.
5. **Family view.** A thin line from each child to its parent, family
   colour or shape, A/B audition, revert, prune, save a family as a toy.
   Durable family ids, independent of runtime ids.

Suggested milestone: 1, 2 and 4, plus the parent–child line from 5. Musical
control comes before collisions start spawning things on their own.

## 2. Musical collisions: contacts

### Shipped (v1, 2026-10-24)

Decided with Alex: **playheads only**, not paths (lines cross constantly;
two playheads meeting is an event you can hear and aim for); **sound** for
every new loop; **breeding built on Mutation**.

- A meeting is two playheads within 26 px at the same moment, found by
  closest approach between scheduler ticks (fast playheads can pass between
  two ticks). Both loops take part unless one says **Meets: no**.
- Per loop (its settings, More): **no · sound · trade · breed**. Sound plays
  the loop's voice where it is, so a meeting is an interval. Trade borrows
  one thing from the other loop: voice, chords, rhythm, direction, in turn,
  the next one that differs. Breed has a child: `mutateLoop` plus one trait
  borrowed from the mate.
- Cooldowns: a pair once a beat, trading once per 2 bars, breeding once per
  8. Breeding never evicts a loop at the 14-loop cap (Mutate does).
- **Meet** in the drawer (More) turns it all off. A replayed take only
  sounds its meetings, because what they changed is already in the take.
- Saved in scenes, toys and codes (`meets`, appended to the packed row);
  older codes meet with "sound". Tests: *Twirl · contacts*.

### Shipped (v2, 2026-10-24): crossings, bump, Surprise

Alex, after playing with v1: playheads meeting turns out frequent enough for
breeding, but sound wants the more frequent contact, **a playhead crossing
another loop's line**. So there are two kinds of contact:

- **Crossing** (playhead → line, found by segment distance ≤ 9 px between
  the playhead's path since the last tick and the other loop's line, with a
  bounding-box cull): drives **sound** and the new **bump**. At most once a
  beat per crosser and line. The crosser plays its voice at the crossing.
- **Meeting** (playhead ↔ playhead, as in v1): drives **trade** and
  **breed** (and sound, as before).
- **Bump** nudges the crossed line along the playhead's way on screen
  (`push`, eased in the frame loop, clamped to the sheet), never a loop
  that's being held. A replayed take doesn't bump.
- `bump` is **appended** to `MEET_ORDER`, so earlier codes keep their values.
- **Surprise** (drawer, More; on by default; `state.dice`): new loops draw
  `meets` (sound .5, bump .2, trade .15, breed .15), `dir` (fwd .7, rev .15,
  ping-pong .15) and `rhythm` (as drawn .7, even .15, Euclidean .15), like
  their temperament already is. Beat and shaker toys, and hand-drawn shakes,
  stay forward and as drawn. A toast names anything unusual a new loop got,
  so it's never a mystery. Off: forward, as drawn, sound.

### Next

- **Distribute more** the same way, as Alex suggested: timing (Lock /
  free), chords, speed, maybe the Euclidean pulse count. Keep the usual the
  most likely, and always say what a loop got.
- **Seeded breeding.** With Mutation v2's seeds, a family could be replayed.
  Not decided yet.
- **More to trade:** a rhythmic fragment, an interval, a piece of shape.
- **Ecology controls:** a per-sheet density budget so trading and breeding
  can't crowd a sheet; meeting probability; who may breed with whom.

## 3. Expressive gesture mapping

Curvature, speed, acceleration and pencil pressure → articulation and
synthesis. Pressure already sets velocity, and speed does when there's no
pen. Add sustained gestures alongside discrete notes: one path as a
continuously changing voice, not only as note events. On the MIDI side:
configurable channels, then MPE-style per-note expression. The current
fixed voice-to-channel map (pluck 1, bell 2, blip 3, drums 10) would need
channel allocation. A natural partner is **Vane** (breath CC2, MPE).

**Pressure you can see as well as hear** (Alex, 2026-10-24). With an Apple
Pencil or a graphics tablet, pressing harder should draw a **thicker line**
as well as play louder. Today it only plays louder (the dot sizes show it;
the line doesn't).
- Store pressure per point (a 4th field in `pts`, quantized to 16 levels so
  codes stay small; old codes have none, so the line stays uniform).
- Draw the stroke with varying width (a filled outline along the path, or
  short segments at their point's width), on the live stroke and the loop.
- Keep loudness and width from the same number, so what you see is what
  you hear. That also gives `retrace` real per-point pressure instead of
  borrowing the nearest note's loudness.
- **For plain touch,** something to stand in for pressure:
  - the contact size, where the browser reports it (`PointerEvent.width` /
    `height`; iPad Safari may not);
  - or drawing speed, inverted like ink: slower is heavier;
  - or a slow press-and-hold that swells.
  Worth trying each on the iPad; the first is free where it exists.

### Ideas from play (Alex, 2026-10-24), not yet placed

- **Shapeshifting.** Morph moves a loop across the sheet; a loop could also
  change its *shape* over time: breathe, stretch, untwist, drift toward
  another shape. A natural extension of Morph and of Mutation (a child
  could be a step along the way). The notes would follow the new shape, so
  it's heard as well as seen.
- **A silent zone.** An area of the sheet where loops don't sound (or sound
  softer, or only their playheads move): drag a loop in to rest it, out to
  bring it back. A spatial mute, and a place for bumps to send loops to.
- **Lasso.** A tool that replaces the pen for a moment to select several
  loops at once: then move, turn, mute, mutate or set Meets for all of them.
  Needs a clear way in and out of the mode, so drawing stays the default.

## 4. Loop personalities

Extend still / drift / spin / jitter into opt-in relationships: Listener,
Imitator, Contrarian, Harmonizer, Wanderer, Anchor, Disruptor. Each is a
small, inspectable rule, and you can see which loop is following which.

## 5. Generative accompaniment

Interpret contours through grammars and curated pattern vocabularies:
transparent, rule-based, never an opaque model. This is where **GloriArp**
(`packages/accompaniment`), **MIDIcurator** and **Serpe** connect, through
explicit event and MIDI interfaces, not shared internals.

## 6. Performance animation

The Takes system already records what you *did* (playflows). Extend it
into editable visual replay: scrub a performance, change a move, re-render.
A performance becomes an editable animation of musical decisions, not just
a MIDI file.

## 7. Alternative pitch geometries

Circular pitch-class space (angle → pitch class, radius → register, so
spirals naturally climb), Tonnetz, and just-intonation ratio lattices.
Separate screen geometry from pitch mapping so existing toys keep working.
Make readings switchable and, where meaningful, interpolable: one drawing
heard through several spaces. Label tuning assumptions; connect to the
pitch-ontology work through practice, not terminology.

## Brainstorm: the suite's notations, semi-hidden

*Open, not planned (2026-10-24). Possibly for forks.* Twirl already stands on
two of the suite's notations without showing them: its scale grids are
pitch-class sets (leftmost-LSB masks, CONVENTIONS.md), and Lock and Air read
loops as rhythm patterns (Barlow weights, Euclidean spacing). The idea is to
let people *find* them, through progressive disclosure, without them ever
standing between a first touch and a first sound.

Places they could surface, from quietest to most exposed:

- **Readouts.** A loop's settings (at Everything) show its rhythm as
  **UPI**, e.g. `10010010` / `0x94:8` / `E(3,8)` when it is one, and the
  grid shows its **PCS** as a decimal mask and a small ring (`2741`, Ionian).
  Read-only and copyable; nothing changes by looking.
- **Typed input as a toy.** Type a UPI pattern (`E(5,8)`, `0x94:8`) and drop
  it as a loop: a rhythm toy, its pitches from where you drop it. Type a PCS
  (`2741`, or `{0,2,4,7,9}`) and get a custom grid. This turns notation into
  another way to *make* things, which is the playful use of it.
- **Round trips with the suite.** A loop's rhythm out to **Serpe**, the grid
  out to **PitchFold** or **PickPCS**, over the suite's protocol, and back in.
  (Twirl would join `APPS` in `@enkerli/library` at that point.)
- **Codes as notation.** Twirl's share codes are opaque; a "readable" view of
  a sheet (UPI per loop, PCS for the grid) could sit beside them.

Guard-rails, from the rules above: never at Simple; never required to play;
always the suite's own conventions (match `packages/upi/vectors` and
`packages/theory/vectors`, or import the packages once Twirl has a build);
and every readout labels its convention (leftmost = LSB), because the
reversed reading is a different real thing (2741 vs 2773).

## The plugin and standalone path

Twirl should also become a plugin and a standalone, as most of the suite
already is. Done the suite's way, that's a thin shell, not a port:

- **The shape.** An **aumi MIDI-effect** on the enkerli-juce archetype
  (AU · VST3 · AUv3 · Standalone; LV2 · VST3 · CLAP · Standalone on
  Linux). This is the [Workspace plugin](../../docs/WORKSPACE_PLUGIN.md)
  pattern, the closest precedent: its WebUI is its own clock, as Twirl's
  loops are, so notes cross as `noteOut` and a lock-free `LiveNoteScheduler`
  plays them into the host (not `MidiClipScheduler`, which is for
  host-synced clips). Shell in its own repo (e.g. `Enkerli/twirl-plugin`);
  the WebUI stays here.
- **The seam is already there.** Every note goes through `sound()`, and
  every MIDI note through `sendMidi()`. In the plugin, `sendMidi` posts to
  the bridge instead of Web MIDI, which WKWebView doesn't have, so this is
  also what makes MIDI work on iPad. Web Audio can stay as the "sound"
  output in the standalone.
- **What the WebView changes.** Google Fonts → bundled fonts (as
  `rnd-companion` does from `packages/ui/fonts`). Blob downloads (Save sound)
  → the native-save bridge event (`enkerliSaveFile`), since blob downloads
  kill WKWebView. `localStorage` → mirrored to the DAW session
  (`enkerliState`). Host tempo → Twirl's clock (`t0`/`bps`).
- **Identity is forever.** Choose the plugin code and bundle id once
  (BUILD.md: `plugin-codes-are-forever`).
- **Starting on Linux.** Web MIDI already works in Chromium there, so the
  first useful test needs no plugin at all: open the Pages URL, pick a MIDI
  output under Everything, and play a synth. That checks the voice-to-channel
  map and the timing before any C++ exists. Then the LV2 and Standalone
  builds follow BUILD.md (its Quickstart and §4 carry the Linux notes).

## How experiments branch

`main` is what Pages serves at `…/apps/twirl/`. It is the stable,
everyone-can-play version, and every test passes there. Roadmap work
happens on branches (`twirl/<topic>`, e.g. `twirl/mutation-v2`), each one
merged only with the tests green, rule 1 above first among them.

GitHub Pages serves one build of the site, from `main`, so a branch isn't
playable at a URL by itself. Three ways to try a branch, cheapest first:

1. **Locally.** `npm run serve -w twirl`, then open
   `http://localhost:8000/` (Twirl is one file; nothing to build).
2. **As a claude.ai artifact.** Publish the branch's `index.html`; its
   share links already point at the artifact when they run there.
3. **A lab slug on Pages.** A second `sync-apps` entry (e.g. `twirl-lab` →
   `…/apps/twirl-lab/`) fed from a file on `main` that holds the current
   experiment. Not set up: it puts experimental code on `main`, which is
   a decision to make on purpose.
