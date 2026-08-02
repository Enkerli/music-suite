# Reprioritization — 2026-08-02

Supersedes the sequencing table in `NEXT_SESSION_2026-08.md` (its A1–A3 and B1
are done; A4 and the C/D/E tracks are folded in below).

Alex added twelve items on 2026-08-02. Merging them with what was open changes
the order substantially, because three of the new items turn out to be the same
problem wearing different hats, and one of them is much cheaper than it looked.

---

## What the new notes changed

**1. Articulation blocks the drum work — but it is mostly a wiring job, not a new notation.**

`--gate` and the duration arcs landed today, so patterns can already *carry*
articulation — but only as a CLI flag, not in the notation. Alex: *"This might
mean yet another addition to the UPI notations. Maybe even something similar to
accents which would distinguish between long and short."*

That is not a nice-to-have sitting beside the drum arc. **Open hat versus closed
hat IS the long/short distinction.** A drum pattern language without it cannot
express the most basic hi-hat part, and a `E(8,16)` of hats with no way to say
which ones ring is not usable. If the drum work starts first, it will invent its
own ad-hoc answer and we will have two.

So it moves ahead of the drum synth. And it is smaller than it looked: `LS(…)`
already states a durational layer and already computes it — it just never
reaches the MIDI renderer (measured; see Tier 1). Much of this item is
connecting what exists rather than inventing syntax.

**2. "Workspace can't hear its own Vane" is a default, not a bug.**

Diagnosed 2026-08-02. Routing works end to end: with the Vane Synth module added
and powered, `noteOn` / `noteOff` / `cc` all reach the worklet, and the Pattern
Player publishes `note [external→vane]` which `applyVaneNote` accepts.

**Vane Synth is simply not in the default layout** — a fresh Workspace opens with
Control Surface, Pattern (UPI), Bindings, Bus Monitor. So the suite's own
workbench appears mute out of the box, and every demo of everything else needs a
second tab.

Not fully closed: this verified that messages reach the worklet, not that sound
leaves the speakers. If it is still silent for Alex with the module powered on,
the next suspect is the AudioContext failing to resume, and that is a different
(also small) fix.

**3. PCS-as-histogram and drum-corpus learning are one representation.**

Alex describes a PCS where *"a pitchclass set includes likelihoods that different
pitchclasses would be present"*. That is the same shape as a learned drum pattern:
per-slot probability rather than a boolean. Serpe already draws arc *length* for
duration; Alex proposes arc *thickness* for likelihood.

Worth building once, as a weighted-set type with two renderings, rather than
twice. It also gives the corpus learning something to output that is not a wall
of numbers — which is the explainability requirement (INTENT B5).

---

## The order

### Tier 0 — make the workbench usable (small, unblocks demos of everything else)

| | | why now |
|---|---|---|
| ~~**W1**~~ | ~~Vane Synth in the default Workspace layout~~ | **done** `3074129` — default is Pattern → Player → Vane Synth |
| ~~**W2**~~ | ~~Multilane UPI in the Pattern **Player**~~ | **done** `3074129` — `PatternLane` on the bus, per-lane timers, cycle/step lock, per-lane accents |
| ~~**W3**~~ | ~~Advance progressive patterns from Workspace~~ | **done** `3074129` — ↻ advance / ⤺ base / Enter, via the shared `polyLaneAt` |

Done 2026-08-02. Three things surfaced on the way and are worth carrying
forward:

- ~~**`polyLaneAt` is not pure in the trigger index.**~~ **Resolved** `2b6523f`
  — Alex: seed it. `*N` material now comes from a stream seeded by the base
  pattern, so a trigger names a pattern, and each trigger EXTENDS the last
  rather than re-rolling the whole tail. mulberry32 was extracted to
  `packages/upi/src/rng.js` on the way; it had been inlined twice and the copies
  had already drifted (`Math.imul` vs `*`).
  **Still open:** the C++ engine grows `*N` with its own RNG, so a plugin
  session and a standalone one produce different material for the same
  notation. D3 means the engine wins where it is present, so nothing is broken
  — but if the two should agree, the seed has to cross over. Worth a decision
  during the audit.
- Workspace had **no cache-bust on `bundle.js`**. A rebuild kept serving the
  old bundle, so a landed fix looked like it had not landed — the hard-refresh
  papercut, again. Stamped with a build id the way Vane already does. Worth
  checking the other apps for the same gap during the audit.
- The lcm readout was computed from typed lane lengths, so it went stale the
  moment a lane grew. Now derived from the sounding lanes.

### Tier 1 — the articulation notation (mostly already exists)

**Checked before planning any syntax, and the answer changed the item.**

`LS(…)` is a real, working part of the language today:

```
$ msuite pattern "E(3,8)LS(2)"
durate  fixed 2:1  →  [2.00 2.00 1.00]
```

The durational layer is parsed, and the long/short reading of the inter-onset
intervals is computed. But:

```
$ msuite upi "E(3,8)LS(2)" --midi out.mid
wrote out.mid — 3 notes …
ticks   0 360 720
```

**The MIDI renderer silently drops it.** No error, no warning, no long notes —
the suffix is accepted-looking and does nothing. That is a dead-end, which the
suite's own rule calls a bug (absence is expected, a dead-end is a bug).

So Tier 1 is, in order:

| | |
|---|---|
| ~~**N1a**~~ | ~~Make `LS(…)` reach `upi --midi`~~ | **done** — LS redistributes, `--gate` scales, totals preserved so the two stay independent |
| **N1b** | **Decision needed from Alex** — see below | prototyped and audible |

**N1a, as built.** `LS` now reaches the renderer. It redistributes time between
long and short notes while PRESERVING the total, so `--gate` still means the
same thing whatever the ratio is:

```
E(3,8)         dur 180 120     (the spans themselves, × gate 0.5)
E(3,8)LS(1)    dur 160         (flattened — equal notes over an uneven rhythm)
E(3,8)LS(2)    dur 192 96
E(3,8)LS(4)    dur 213 53      totals all 480
```

One consequence worth knowing: with `LS`, `--gate legato` connects *on average*
but not note-by-note. `LS(1)` on an uneven rhythm gives equal durations, which
cannot also each reach the next onset. That is arithmetic, not a bug.

**N1b — the gap is real, and confirmed by test.** `E(8,16)LS(4)` renders
identically to `E(8,16)`: LS reads the pattern's own inter-onset intervals, and
an even grid has none. That is exactly the hi-hat case.

**Proposed and prototyped: `LS(r){mask}`** — the mask names which onsets are
long. `E(8,16)LS(4){1000}` gives one ringing hit in four, overlapping the next.
Audible in `examples/articulation/hat-*.wav`.

Why this spelling rather than a new one:

- it extends the durational notation that already exists, so there is one way to
  say "long" rather than two (L5 is at four incidents)
- `LS(r)` derives long/short from the rhythm; `LS(r){mask}` states it. Same
  concept, two sources
- no new bracket is free anyway: `{…}` is accents, `[…]` is the array form,
  `>` is progressive

**Settled 2026-08-02.** Alex: the mask is fine, and it should index onsets —
"which is actually the same thing for accents!"

He was right, and checking it was worth it. Accents were ALREADY onset-indexed:
`{10010}E(5,8)` has onsets at 0,2,3,5,6 and accents land on steps 0 and 5, i.e.
onsets 0 and 3. The parser cycles the mask over onsets and projects onto steps
for consumers. The durational mask now does exactly the same, ships the same
pair of layers (`longs` to `longShort.longMask` as `accents` is to
`accentPattern`), and four tests pin the equivalence.

That comparison found a real bug in passing: **the file renderer did not precess
either mask across cycles.** A mask that does not divide the onset count keeps
counting — `{10}` over five onsets starts cycle 2 on bit 1 — and the C++ engine
has always done this while `upi --midi` restarted every cycle. So a capture of
`{10}E(5,8)` could never have matched its own baseline. Same class as the
lock-mode mismatch A1 was filed for, and it would have surfaced as an
unexplainable DAW anomaly. Fixed and pinned.

Still worth re-doing after Tier 2: the hat `.wav`s are rendered through a
**sax**, so the long notes ring convincingly and the 50 ms choked hits barely
speak. Alex: "Tier 2 will help us make some decisions, including about hats."

### Tier 2 — the drum arc (the biggest new capability)

| | | notes |
|---|---|---|
| ~~**D1**~~ | ~~Minimal drum synth~~ | **done** — `@enkerli/drumsynth`, eight sounds on eight pitch classes, `msuite upi --wav` |
| **D2** | Drum MIDI → pattern, meter-aware | the hard part is not misreading triplets as swung sixteenths: score candidate grids, pick by fit, and **report the grid and the confidence** |
| **D3** | Drop-a-folder learning, CLI first then a Workspace module | Alex's suggested entry point. Corpus stays local; only derived statistics ship (D7) |

**D1, as built.** Eight sounds on eight distinct pitch classes — the standard
GM kit does not guarantee that (high tom 48 % 12 == 0 == kick), so there is no
high tom. GM note numbers throughout, so somebody else's drum MIDI maps in with
no translation table, which is what D2 needs.

Synthesised, not sampled: "public domain drum samples" is a claim someone has
to verify per file forever, and synthesis has no provenance to audit (D7). It
also makes the sounds PARAMETERS, so a learned groove can vary its snare rather
than replay one recording.

`msuite upi --wav` shares the ENTIRE note-building path with `--midi` — lane
lock, accent precession, `LS(…)` — so a `.wav` and a `.mid` of the same notation
cannot disagree. A lane labelled `kick=` or `hh=` gets that drum's GM note
rather than the positional base+index.

It closes N1b's loose end: the hat examples are re-rendered through the kit, and
`LS(4){1000}` audibly rings one hat in four. Closed and open are the same voice
at different decays, so the durational mask is a real instruction to the synth.

Also a **Drum Kit Workspace module**, so the workbench plays drums with no
second tab and no samples. One-shots rendered into an AudioBuffer per hit rather
than an AudioWorklet: a drum has no held state and a 400 ms hat is microseconds
of work, so a worklet would buy nothing. Vane needs one because a breath-driven
reed is continuous; this is not.

Two things had to reach the bus for it to play what the notation says, and both
are now in `PatternLane`: a labelled lane states its drum's GM note (so `kick=`
is a kick rather than whatever position it sits in), and the durational layer
travels as `longs` + `lsRatio` (so an open hat rings in the Workspace exactly as
it does in `--wav`). A receiver that only got onsets played every hit the same
length, which on drums is precisely the distinction that matters.

**Next: D2**, which starts when Alex's curated MIDI arrives. D3 follows it.

### Tier 3 — representation

| | |
|---|---|
| **P1** | Weighted pitch-class sets — likelihood, not membership |

Arc thickness on the chromatic wheel and the circle of fifths. Build the weighted
type once; D3's output is its first real consumer.

### Tier 4 — parallel, or waiting on someone

| | | who |
|---|---|---|
| **A4/F5** | Two Serpe instances in Bitwig on the current build | needs Alex at a DAW |
| **A5** | `.dawproject` capture→assert protocol | can be written now; conducting needs Alex |
| **E2** | Vane patch lab — diverse patches, breath curves | tools are in place; bore damping is the known hazard (it can cut the sound until a long rest) |
| **C3** | GloriArp learning: quantize then re-add variability, nested analysis | wants D2/D3's findings first |
| **Design #2** | Accumulate, do not spend now | Serpe's polygon and polymeter/polyrhythm controls read as inconsistent with the Rows/Circle segmented control beside them. Collect more before booking a pass |
| **Bells** | key/bell pattern catalogue | Alex's content agent |

### Tier 5 — the audit

Alex: *"we should do another audit. Even find other features or modules to add."*

Known debts to fold in, spotted in passing rather than searched for:

- **`msuite jam` is promised in three documents and does not exist.** Either
  define it or stop promising it — and with Workspace becoming self-contained
  (Tier 0), it may now be redundant. A dead-end is a bug.
- Serpe `main.jsx` ×3 and `accompaniment/pipeline.ts:144` unreviewed against the
  layering rule (user input → `parsePolyUPI`; internals only → `parseUPI`).
- The manual accessibility plan has never been run; `workspace` has never been
  audited at all.
- `parseUPI` deprecation: the case for it got stronger when Workspace and
  `--midi` moved to `parsePolyUPI`. Decide it rather than leaving it half-done.

Run the audit **after Tier 0–1**, not before: the workbench being usable changes
what is worth auditing, and the notation decision changes what the docs should
say.

---

## What this de-prioritizes, and why

- **Workspace piano-roll and further viz modules** slip behind the drum arc.
  `packages/ui/components/` already has `piano-roll.js`, `pcs-ring.js` and
  `pitch-grid.js`, so this is mostly hosting — but a piano roll is most useful
  once there is drum material to look at, and P1 changes what a PCS view should
  draw. Doing it now means drawing it twice.
- **Timing-analysis test campaign** stays in Tier 4 rather than leading, as it
  did in the previous plan. The tools landed; the remaining work is conducting
  runs in a DAW, which is Alex's hands and not blocking anything else.
- **Polygon mode** is done — per-lane toggles shipped 08-01. Removed from the
  backlog.

---

## Verification, unchanged

`npx vitest run` (1717 now) plus the Serpe conformance targets; the wasm
regression suite after any `vane-dsp.cpp` change; **load the webapp** for
anything touching a UI — the diagnosis at the top of this page came from opening
Workspace, not from reading it. Respect D1 (leftmost = LSB), D3
(engine-authoritative), D6 (trigger 1 is the base), D7 (corpus never published),
D8 (accents per lane), and the `soundingPattern` invariant.
