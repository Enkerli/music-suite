# Twirl — roadmap

*Rewritten 2026-10-24, when Twirl joined the monorepo, and reassessed the
same evening after a day of play (next section). The first order of work
came from a prioritization exercise done with another agent; its criterion,
how much new musical behaviour a feature brings relative to how hard it is
to build, still holds. The rules section is the part that does not change.*

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

## Where we are (reassessed 2026-10-24, evening)

**What a day of play changed.** Mutation shipped as a prototype; collisions
grew into three kinds of contact (crossings, lines touching, playheads
meeting) with sound, bump, trade, breed and infect; Surprise, Vary, chimes
with their own sound, Start over and a sturdier full screen followed. The
one complaint that kept coming back is not about any feature: *"as fun as
this is, it does get quite repetitive pretty easily."* Loops replay the same
notes each pass, and a sheet settles into a groove and stays there. Most of
Alex's ideas since (terrain, shapeshifting, density that swells and fades,
loops that die away, loops that strengthen or weaken each other) are answers
to that one problem: **things should change over time**.

**So the next theme is the evolving patch** (section below): a sheet you can
leave running that keeps developing, slowly, legibly, reversibly. It pulls
together pieces that were scattered across the old list (ecology controls
from collisions, relationships from personalities, Vary's next steps, the
ideas from play).

**Before building much more: targeted playtests** ([PLAYTESTING.md](PLAYTESTING.md)).
Twirl's surface has grown fast: Meets alone has six answers, and the drawer
has Meet, Surprise and Vary side by side. Whether first contact still holds,
whether people can say *why* a note happened, and when it gets repetitive
for them (not only for us) are questions a few sessions answer better than
more features. Evolving-patch v1 is small enough to build alongside.

**The reassessed order**

| # | Track | Effort | Value | Why now |
|---|---|---|---|---|
| 0 | **Playtests** (5–8 people, targeted) | 2/5 | 5/5 | Validate first contact and legibility before the surface grows further |
| 1 | **Evolving patch v1**: life cycles, influence | 3/5 | 5/5 | The repetition problem; builds on contacts, Vary and Morph. *Life and Evolve shipped; influence next.* |
| 2 | **Sound variety**: toys with their own sounds, per-pack nuance, accents from the beat, pressure as thickness | 2/5 | 4/5 | Cheap variety with no new concepts; chimes showed the way |
| 3 | **Mutation v2** (musical, seeded) | 3/5 | 4/5 | Breeding and evolution sound only as good as the mutations |
| 4 | **Terrain** (workshop first) | 4/5 | 4/5 | Movement as development; wants the evolving patch's legibility rules first |
| 4b | **Harmony** (workshop first) | 4/5 | 4/5 | Chord types, voicings, a progression loops adapt to; never in the naïve path |
| 5 | **Hands-on tools**: lasso, silent zone | 3/5 | 3/5 | Steering a busy, evolving sheet |
| 6 | **Plugin and standalone** | 4/5 | 4/5 | A parallel track (Linux first), not blocked by any of the above |
| 6b | **Workspace, MIDI in, design pass** | 3/5 | 4/5 | Twirl among the Suite's modules; controllers for performance; one look |
| 7 | Later: pitch geometries, performance animation, generative accompaniment | 4–5/5 | 4/5 | Still wanted; each is a project of its own |

Personalities (old #4) are folded into the evolving patch's *influence*:
the same idea, made of the contact rules Twirl already has.

## The evolving patch (next)

Alex, 2026-10-24: "Other things which can change over time: a loop can get
denser or sparser (fluctuate in density, maybe over a significant number of
repetitions, build up then fade away), a loop can disappear with time, a
loop can weaken or strengthen another… All in the service of an 'evolving
patch'."

Rules for anything that evolves (from the rules above, sharpened):
- **Slow.** Changes happen over many passes (8, 16, 32), not every note, so
  a groove has time to be a groove before it moves on.
- **Visible.** What a loop is going through shows on the sheet: a line that
  thickens as it fills, fades as it dies away, a glow when it's fed.
- **Legible.** A loop's settings say what it's doing ("swelling: 6 of 16
  passes"), and a toast names anything that happens to it.
- **Reversible and stoppable.** One switch (like Meet) freezes all
  evolution; Start over and undo still work; nothing evolving is lost
  without a trace (a loop that dies away can be brought back, like undo).
- **Opt-in by default for each loop** at first; Surprise may hand it out
  later, like it hands out bump and trade, once playtests say it's welcome.

**v1, shipped 2026-10-24: Life and Evolve** (items 1 and 3 below; item 2,
influence, is next). As built: age counts passes a loop actually plays (not
muted, not held, Evolve on); a swell picks its notes by Barlow
indispensability (the downbeat always plays), so its drawn notes never
change and *steady* gives the loop back exactly; a loop whose life ends goes
into undo (⌘Z brings it back, steady); the line thickens as it fills and
fades as it fades, and resting notes are faint; a loop's settings say where
it is ("filling in · pass 5 of 16 · 60% of its notes"); `life` and `age`
travel in codes; a child starts its own life at age 0. Tests: *Twirl ·
Life*.

**Life v1.1 (same evening).** Alex: "Brief is fine and could be
semi-frequent in new loops. Swell sounds like it should be about increasing
in volume, which is separate from this relative densification (which should
probably go over the initial density)." So: **bloom** (new) adds notes
*beyond* the drawn ones, traced from the same path at a finer stride,
strongest first, and takes them away again; **swell** is now loudness
(soft → full → soft); **brief** unchanged. `LIFE_ORDER` index 1 (v1's
thinning swell) reads as bloom, the nearest behaviour. **Surprise** hands out
lives once the sheet has four loops or more (brief .2, bloom .04, swell .04,
otherwise steady), never on a quiet sheet, so a first stroke always stays.

**v1, as proposed:**
1. **Life** (a loop setting): *steady* (as now) · *swell* (its notes fill
   in over N passes, then thin out again, using `retrace` toward many and
   back toward few: density that breathes) · *fade* (a little quieter each
   pass, then gone, into undo) · *short-lived* (fades after one swell).
2. **Influence** (two new contact answers, on lines touching and
   meetings): *feed* (the other loop gets louder or denser) and *drain*
   (quieter or sparser). With fade, a sheet gets an ecology: loops that
   others keep alive, and loops that die when left alone.
3. **Evolve** switch in the drawer (More), on by default only if playtests
   agree; a loop's settings show its life stage.

**Next:** influence (*feed* and *drain* at contact); Surprise handing out
lives, once playtests say lives are welcome; a sheet-wide "season" that
shades every loop. Later: shapeshifting (shape over time, from Morph and Mutation), terrain,
seasons (a slow sheet-wide cycle that shades every loop's density and
loudness), and Surprise handing out lives.

## The original priorities (2026-10-24, morning)

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

### Shipped (v3, 2026-10-24): lines touching, infect

Alex: "There's the other kind of contact: any point of contact between
loops. That could work for sound, bump… and even trade. Breed is the only
'dangerous' one, as it increases density. Still, it could happen when an
especially 'infectious' loop runs into another loop."

- **Lines touching**: every 4th tick (100 ms), each pair of lines (≤ 48
  segments each, bounding boxes first) is checked for contact. Only the
  *onset* counts: a pair seen for the first time is just noted, so a loop
  drawn over another, or a child born on its parent, isn't a contact.
  Answers: sound (each loop, at the contact), bump (pushes the other loop
  away, centre from centre), trade. About 6 ms for 14 overlapping spirals
  on a desktop, worst case.
- **infect** (appended to `MEET_ORDER`): has a child at any contact:
  crossings, lines touching, playheads meeting, with breed's wait and the
  14-loop cap.

### Breeding made deliberate (2026-10-24)

Alex: "Breeding is a bit too frequent. Maybe it needs to be a deliberate
choice to switch a loop to be a breeder. Or make breeding work only once in
a while." Both:
- the cause was compounding: a child inherited Meets, so children of
  breeders bred too. Now **a child never inherits breed or infect** (it
  sounds), whether born of a meeting or of Mutate;
- **Surprise never gives breed or infect** (sound .55, bump .25, trade .2);
- the wait between children doubles: **16 bars**.

**At the 14-loop cap** (Alex, 2026-10-24: breeding "can still happen when
we reach the limit, and it replaces previous loops"). By design, breeding
and contacts never remove a loop: `breedWith` and `mutateLoop({quiet})`
stop at 14. What does take the oldest loop at the cap is drawing a stroke,
dropping a toy, pressing Mutate, and a take's replay adding loops, which may
be what showed up. Worth deciding on purpose: should breeding at the cap
replace the oldest loop (or the oldest of its own family, or a faded one),
so a sheet at the cap keeps evolving? That fits the evolving patch, with
Life's undo as the safety net.

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

**Vary (shipped 2026-10-24): round-robin against the typewriter effect.**
Alex: "roundrobin. Reducing the typewriter/machinegun effect." Each note gets
small random loudness (±16 %), timing (±7 ms, never into the past) and
tuning (±6 cents), plus a `nuance` (−1..1) that voices read as colour: the
pluck's brightness and length, the bell's inharmonicity (modulator ratio
3.5 ± 0.08), the blip's length, the hat's size. MIDI gets loudness and
timing, whole notes. Drawer → Vary (More), on by default. Next:
- per-pack nuance (Mallets, Felt, Chip… read only loudness so far);
- accents from the beat: Barlow weights already thin notes (Air); they
  could also shade loudness, so a fast run has a shape, not just variety;
- feed `nuance` from pressure and, later, terrain, as one per-note input;
- true sampled round-robin, if a sample pack ever arrives.

**Longer, sustained sounds** (Alex, 2026-10-24): "Except for the drone,
all sounds are short, though some resonate a bit longer. Longer sounds,
legato passages, pads… those could be fun as well. Though they might
require a bit of forethought in terms of not triggering too quickly."
- **What to add:** a sustained voice per pack (a bowed or blown sound, a
  pad, a held organ tone), and **legato**: one loop played as a line whose
  pitch glides from note to note instead of restriking.
- **The forethought:** a sustained voice can't restrike at every note of a
  busy loop, or it turns to mush. Options: a note holds until the loop's
  next note (monophonic per loop, retriggered only when the pitch changes,
  as Lock already "holds" a repeated band); a minimum length per note
  (an eighth, a beat) that merges anything faster into the held note; and a
  voice budget per sheet (the oldest held note lets go).
- **How it's chosen:** a direction (a fifth heading?) or the Pen; a loop's
  Voice; a toy that brings it (a "bow" stroke, a pad toy). Pressure (or
  speed) could set the swell inside a held note, which ties in with Vary's
  nuance and the Pencil.
- **MIDI:** note-on/off with real lengths, and pitch bend for legato glides
  (per-loop channels, or MPE).

**Sounds across banks (shipped 2026-10-24).** Alex: "toys could come with
their own sounds… across banks. As much as I love the simplicity of the 5
voices per bank, bringing sounds over could add an element of variety."
A loop can play another pack's sounds (`lp.pack`; its settings → Voice →
Sounds; saved in scenes, toys and codes, appended to the packed row), and a
toy can bring its own. The first is **Chimes** (Alex: "bells remind me of
windchimes"): a new pack (free-bar partials 1 : 2.76 : 5.40 : 8.93, long
shimmering tails), and a Toybox toy whose clapper sways over a long, odd
cycle (11, 13 or 15 beats), striking in gusts off the grid. It replaced the
spiral on the starting sheet; redrawn the same evening as a bar with five
tubes of graded lengths, struck at their ends (longer is lower, five
distinct notes). **Chimes that behave like chimes** (Alex): today the path
walks along the bar and down and up each tube; real chimes are struck by a
clapper the wind swings, and hit one another now and then. A later version
could model that: a clapper that sways (Morph-like), striking whichever tube
it reaches, tubes that touch and ring each other (lines touching, already a
contact), and the wind's gusts as the only clock. Next: more toys with their own sounds (a music
box, a gong, a rain stick, a thumb piano run), each one a small,
recognizable instrument, and per-pack nuance.

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

### Ideas from play (Alex, 2026-10-24), now part of the evolving patch and hands-on tools

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

### Terrain: a background that colours the sound (to workshop)

Alex, 2026-10-24: "a colourful background which affects the sound or other
parameters. So, the bell sound may get more inharmonicity on darker
background or less on a lighter one. A blip may get longer on a continuous
background… This way, movement has an impact on the musical development and
things get less repetitive. (Maybe associated with round-robin and
expressiveness.) As fun as this is, it does get quite repetitive pretty
easily."

The problem it answers is real: a loop replays the same notes each pass, so
a sheet settles into a groove and stays there. Moving loops (drift, spin,
bump, Morph) already change *where* notes land; terrain would make where
they land change *how they sound*, so movement becomes musical development.

The idea, as a starting point:
- **The sheet gets a painted ground**: soft regions of colour under the
  lines, generated or painted by hand (a "paint" pen beside the lasso?).
- **Each note reads the ground where it sounds**, and a few qualities of
  the ground map to a few qualities of the voice. Alex's examples:
  - **lightness → inharmonicity** for the bell: darker, more clangorous;
    lighter, purer;
  - **continuity → length** for the blip: on an even field it sustains;
    on a broken, textured one it stays short.
  - Others to try: hue → timbre or filter, saturation → brightness or
    drive, texture → grain or jitter of timing.
- **Same loop, different place, different sound**: a drifting loop changes
  colour as it crosses the ground, and a bump can send it somewhere new.

**Traces: loops that paint the ground** (Alex, 2026-10-24, after a canvas
bug left smears where loops had moved: "we have background/terrain… some
loops could leave traces!"). A loop that moves (drift, bump, Morph) could
leave a fading trail, and the trails *are* the terrain: where loops have
been changes how later notes sound there. That answers "who makes the
ground" without a paint tool, and ties terrain to the evolving patch: a
sheet's history becomes its landscape. To settle: which loops leave traces
(a Life or Meets choice, or a toy), how fast trails fade, whether they keep
the loop's colour or voice, and how traces travel in codes (they would be
the sheet's history, so takes already carry them by replaying).

Questions for the workshop:
- **Legibility.** Each voice gets one or two mappings, named in the guide
  and in a loop's settings, so it's never a mystery why a note changed.
  Is the ground always visible, or only when asked?
- **Who makes the ground**: generated (with a seed, for codes), painted, a
  photo, or several presets (dusk, tiles, marble)?
- **How it relates to pitch.** Height already sets pitch; the ground must
  not fight that. It changes *timbre and articulation*, never the note.
- **Round-robin and expressiveness** (Alex's link): round-robin varies each
  repeat of the same note slightly, as samplers do; terrain varies it by
  place. They could share one per-note "variation" input, which also takes
  pressure (section 3) and, later, a silent zone (the ground's zero).
- **Immediate satisfaction.** A plain sheet stays the default; terrain is
  something you turn on or pick, and the first stroke still sounds at once.
- **Codes and takes**: the ground has to travel (a seed or a small grid),
  and takes have to replay the same colours.

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

## An optimization pass (Alex, 2026-10-24)

A pause while recording turned out to be a stall, not a stop ("the
recording doesn't pause"): the main thread was busy enough for the sound
to break up. Twirl has grown a lot of per-tick and per-frame work: contacts
(three kinds, every tick), Life (`lifePlays` ranks notes on each call),
bloom tracing, Morph, drawing every loop with Bézier paths, the MediaRecorder
on top. To do, measured on the iPad first (Safari's timeline):
- profile a busy sheet (14 loops, contacts on, recording) and find the top
  costs before changing anything;
- cache per-loop work that only changes with the loop (screen points for
  contacts per frame, note ranks for Life, bloom notes, already cached);
- draw less: skip unchanged loops, or draw still loops to an offscreen layer;
- move the scheduler's timing off `setInterval` jitter (a worklet clock or a
  Worker tick), so a busy frame never delays a note;
- a performance budget test: a busy sheet's frame and tick times, in CI.

## Harmony: to brainstorm and workshop (Alex, 2026-10-24)

"How harmony is handled. Chords from each loop (what voicing and chord
type?). Adapting to a chord progression? (All the while making sure that the
'naïve' experience isn't disrupted.)"

Where it stands: every note is a scale step (the grid); a loop's **Chord**
stacks scale steps on each note (fifths `[0, n·4/7]`, triads `[0, 2, 4]`,
sevenths `[0, 2, 4, 6]`, sus `[0, 1, 4]`), so chords are always diatonic to
the grid, in close position, from the note up. **Walk** drifts the whole
sheet along four degree shifts; **Arc** shapes 4 or 8 bars as home → away →
pull → resolve, snapping notes to the home chord at the end; the **Drone**
voices the current harmony underneath.

Questions to work through:
- **Chord type per loop.** Is a loop's chord a *quality* (triad, seventh,
  sus, quartal, cluster) stacked from each note, or a *role* (the loop plays
  the chord tones of the current harmony, the bass, a pedal)? The second is
  closer to how a band thinks, and fits loops as players.
- **Voicing.** Close, open (drop-2), spread over the sheet's range, shell
  (root, 3rd, 7th), and voice leading between successive chords (each voice
  moves to the nearest tone). Who decides: the loop, the sheet, or height
  (higher on the sheet = higher inversion)?
- **A progression.** A sheet-level progression (I–vi–IV–V, ii–V–I, a modal
  vamp, a 12-bar blues) that every loop adapts to: notes snap to chord tones
  on strong beats and pass freely on weak ones (Barlow weights again), so
  drawings stay drawings but sit in the harmony. Walk and Arc become two
  presets of this one mechanism.
- **From the Suite.** Progression Studio already makes progressions,
  MIDIcurator curates them, GloriArp voices and arpeggiates; Twirl could take
  a progression from them over the bus (Workspace) or as a code, rather than
  growing its own editor.
- **Harmonic loops.** A loop could *be* the harmony: its notes set the
  current chord for the others (a bass line that steers), which is a
  personality (Harmonizer, Anchor) made literal.

Guard-rails: the naïve experience stays as it is. Single notes, in the scale,
from height; anything harmonic is at More or Everything, off by default, and
named in words ("follows the chords", "plays the bass"), never in theory
first. Chord symbols and Roman numerals can appear as readouts (the
notations brainstorm), not as requirements.

## MIDI in, for control (Alex, 2026-10-24)

"MIDI input for controls. Select a loop by notes (1–14, perhaps organized
differently to make things easier to find). Use CC to change parameters.
Some controls can be grouped by family or all loops on a sheet. Some global
controls."

- **Notes select loops.** Fourteen notes, laid out so they're easy to find
  on a keyboard: e.g. the white keys from C3 (C = loop 1 … B = 7, then the
  next octave for 8–14), with the black keys as *families* (C♯ = the first
  loop's whole family…). One octave lower: **all loops** and the sheet. The
  layout is one table, shown under Keyboard shortcuts, and can be learned
  (below).
- **CCs change the selected target**: volume, speed (snapping to ratios),
  notes (few/some/many), chord, direction, Meets; on a family or on all
  loops, the same CC moves them together (relative, so they keep their
  differences).
- **Global CCs**: tempo, swing, Air, Arc, drone level, Morph, Lock, Vary,
  Surprise; transport on notes or MMC (play/pause, Rec).
- **MIDI learn** at Everything: touch a control, move a knob. Mappings saved
  per device, like settings.
- Same rules as the keyboard: everything a controller does is also one tap
  or one key away, and toasts say what changed. Web MIDI input works in
  Chromium (Linux first, as for output); on iPad it waits for the plugin.

## A design pass, and Twirl in Workspace (Alex, 2026-10-24)

- **Design pass** with the design agent, aligning Twirl with the rest of
  the Suite: tokens and type from `packages/ui` (Twirl already shares its
  theme key, `enkerli.theme`), the drawer and panels as the Suite's
  components, iconography, and the guide's screenshots refreshed after.
  Twirl keeps its paper and hand-drawn feel where it's the point (the
  sheet), and matches the Suite everywhere else (controls, dialogs).
- **Twirl in [Workspace](https://enkerli.github.io/music-suite/apps/workspace/).**
  Workspace is modules on one SuiteBus (`@enkerli/protocol` messages,
  bridged across tabs by BroadcastChannel). Twirl joins it the same way:
  - as a module (a tile hosting the sheet) or as its own tab on the bus;
  - **out**: its notes as note events (the same seam as `sendMidi`), and
    on request a loop's rhythm (UPI) or the grid (PCS), so Serpe, PickPCS
    or GloriArp can pick them up;
  - **in**: tempo and transport from the bus, scale and grid from PickPCS
    or PitchFold, and the MIDI-in control map above, as bus commands;
  - one clock: Twirl follows Workspace's tempo when it's on the bus.
  This is also the step where Twirl joins `APPS` in `@enkerli/library`
  (the notations brainstorm above needs it too).

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
