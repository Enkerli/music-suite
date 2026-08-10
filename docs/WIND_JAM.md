# Wind jam — interactive accompaniment for improvisation

*2026-08-07. Alex has moved his playing attention to the **Diosynth**, a
windsynth that also works as a wind controller. It speaks MIDI much like the
Sylphyo, and it arrives over **USB-audio** as well — so both its control data
and its actual sound are available to a laptop at once. He tried it with Vane;
the result was not convincing. Automated backing tracks are a large part of
what he wants.*

*This is the direction brief. Everything below about the current state was
checked against the tree, not remembered.*

---

## What the suite already does, and what it does not

The generative half is in good shape. `msuite accompany` adapts a curated bass
phrase across a progression with seeded variety, morph-per-pass, per-note wind
articulation (`--inflect` writes CC2 breath curves), gate/dynamics/rests/
anticipation, live streaming (`--play`), real MIDI out, and `--loop` for a
continuous groove. `msuite generate` supplies progressions, `style comp` learns
comping from loops, `drums gen` plays a learned kit, `--wav` renders it.

**The loop is open at one end.** Nothing in the suite listens to a player.

| | state |
|---|---|
| Live MIDI **out**, Node/CLI | yes — ALSA rawmidi, Linux only *by design* (`midiout.ts`: "macOS's live path stays the browser bridge; the miniPC target IS Linux") |
| Live MIDI **in**, Node/CLI | **none.** `packages/midi` is SMF read/write; `midiout.ts` only writes. `msuite bind` resolves a CC you type on the command line — it does not listen |
| Live MIDI **in**, browser | **yes**, since 2026-08-03 — `apps/workspace/webmidi-bridge.js` over `@enkerli/webmidi`, with note/CC/expression normalisation |
| **Audio** in, anywhere | **none.** Zero hits for `getUserMedia`, `createMediaStreamSource`, `AnalyserNode`, `getFloatTimeDomainData` across `apps/` and `packages/` |
| A full backing track (bass + comp + drums together) | **none.** `accompany --role` accepts `bass` and nothing else; the other parts are separate commands with no assembler |

Two consequences worth stating plainly, because they set the shape of the work:

1. **The browser is the host for anything interactive on a Mac.** The CLI's
   live path is deliberately Linux-only. Workspace already has MIDI in *and*
   out in a tab, so it is where the Dio can actually be heard and answered.
2. **"Interactive" is blocked on input, not on musicianship.** The generator
   already does more than a first interactive version will ask of it.

---

## The Vane result — diagnosable, but not currently diagnosable *here*

Vane's wind model is tuned around the Sylphyo, and `Vane Design/playing_tests.md`
records the assumptions:

- breath is **CC2**, and breath — not velocity — drives the VCA;
- Sylphyo **velocity is fixed**, so "anything velocity-driven must instead ride
  breath"; a fixed-velocity controller silently disables velocity-driven
  features.

"Similar MIDI messages" is exactly the level at which two wind controllers can
differ enough to feel dead: breath on CC2 vs CC11 vs channel pressure, real
velocity vs fixed, MPE member-channel rotation vs single channel, a different
bend range. Any one of those makes a breath-first patch unresponsive without
making anything look broken.

**There is no instrument to tell us which.** Vane has a `MidiProbe`, and it
counts only *events* and *which channels* — no controller numbers, no values,
no ranges. It is also wired at one end: `requestMidiProbe` is a C++
`withEventListener` that the JS never calls (the bridge audit reports it as a
dead listener). So today the honest answer to "why was the Dio unconvincing" is
that nobody can see what the Dio sends.

This session spent its length on the principle that an unverified instrument is
worse than none. Guessing at a controller from the outside is the same mistake
as guessing at a parser from the outside — which is why `ParserProbe` exists.

---

## The direction

Two tracks. They share the input work but deliver independently, so neither
blocks the other.

### Track A — backing tracks (near-term, mostly assembly)

The pieces all exist and have never been put in one place. A single command
that takes a progression and produces **bass + comping + drums** as one `.mid`
and one `.wav` is largely wiring: `generate` → `accompany` (bass) → a comping
model → `drums gen` → the existing note-building path that `--midi` and `--wav`
already share.

This is the thing Alex can use the same evening: something to play over while
noodling, with a seed to name a take and `--pass` to keep it moving. It needs
no input from the controller at all, which is why it goes first.

The one real design question is **role arbitration** — three parts generated
independently will collide in register and in the pocket. The suite already has
the vocabulary for this (`--range`, per-lane micro-timing, the Keil walk); what
it lacks is anything that decides between parts.

### Track B — closing the loop (the groundwork)

**B0. A CC-level MIDI monitor.** Before anything reacts to the Dio, make the
Dio legible: every channel-voice message, by CC number, with observed range and
rate. As a Workspace module it serves any controller anyone ever plugs in, and
it answers the Vane question with data. Cheap, reusable, and the precondition
for honest work on everything below.

*Also fix Vane's `requestMidiProbe` while here — a diagnostic wired at one end
is the bridge audit's own finding, and this is the moment it matters.*

**B1. Breath onto the bus.** Normalise breath (whatever CC the monitor says it
is) into a control-plane message, the way notes already travel. This is the
single primitive the rest of Track B stands on.

**B2. The first genuinely interactive behaviour: breath → intensity.** The
accompaniment follows the player's dynamic level — density, velocity, register,
maybe drum busyness. Recommended first because breath is **continuous**: it
needs no detection heuristic, no onset classifier, no guess about intent. Play
softer, the band drops; lean in, it answers. That is immediately legible as
"interactive" in a way a correct-but-subtle harmonic feature is not.

**B3. Phrase awareness** — rests, held notes, cadence points → fills and
punctuation. Genuinely harder: it needs a notion of "the player has stopped",
which is a heuristic, and heuristics need the monitor's data to tune.

### Deliberately deferred: audio in

USB-audio is the interesting long game — real intonation, timbre, breath noise,
things MIDI cannot describe. But pitch/onset detection is a substantial build
with its own failure modes, and **the Dio gives us the same notes over MIDI for
free**. Audio earns its place when we want something MIDI cannot supply, not
before. Worth an experiment, not a roadmap slot.

---

## Sequencing

| | | why here |
|---|---|---|
| **B0** | CC-level MIDI monitor (+ wire `requestMidiProbe`) | Cheapest, and every other item is guessing without it. Answers the Vane question this week |
| **A1** | `msuite backing` — bass + comp + drums, one command | Usable immediately, no input needed, mostly assembly |
| **B1** | Breath → control-plane message | The primitive Track B stands on |
| **B2** | Breath → accompaniment intensity | The first thing that feels interactive |
| **A2** | Role arbitration (register + pocket between parts) | Once three parts play together, this is what "a band" means |
| **B3** | Phrase awareness → fills | Wants B0's data to tune the heuristics |

**B0 first is not throat-clearing.** It is the difference between fixing the
Vane/Dio problem and speculating about it, and it costs a fraction of what
speculating has already cost.

---

## What this does not change

`INTENT`'s standing rules still hold: the corpus never leaves the machine (D7),
the engine is authoritative where present (D3), leftmost = LSB (D1). Nothing
here proposes a second accompaniment engine — Track A assembles what GloriArp
already generates, and Track B feeds it.
