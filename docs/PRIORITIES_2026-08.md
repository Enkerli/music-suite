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
| **N1a** | Make `LS(…)` reach `upi --midi`, interacting sanely with `--gate` (`LS` shapes the *relative* lengths, `--gate` scales them) — and refuse rather than ignore what it cannot honour |
| **N1b** | Then, and only then, ask what is still unsayable |

The open-hat case is the test for N1b: `LS` says *this onset is longer than that
one* in a repeating long/short foot. It does not obviously say *this particular
hit rings and that one chokes*, which is per-onset and irregular — closer to how
accents work (`{10010}`) than to a foot. If that gap is real after N1a, a
mask-style spelling is the candidate, and it should be **simulated and listened
to** before it is adopted. Alex's own condition: *"If we can simulate some of
these options, it'd be easy to decide."* The gate → MIDI → wasm → audio rig built
today is exactly that simulator, and `examples/articulation/` is the format for
the answer.

INTENT L5 is at four incidents. A second way to say "long" alongside `LS` would
be the fifth, so N1a exhausting the existing notation comes first on purpose.

### Tier 2 — the drum arc (the biggest new capability)

| | | notes |
|---|---|---|
| **D1** | Minimal drum synth — kick, snare, hats, cymbal, clap, toms | x0x-style synthesis avoids the sample-licensing question entirely (D7 discipline: nothing published that we cannot publish). Each sound on a pitch class, per Alex's "a MIDI note is a lane" |
| **D2** | Drum MIDI → pattern, meter-aware | the hard part is not misreading triplets as swung sixteenths: score candidate grids, pick by fit, and **report the grid and the confidence** |
| **D3** | Drop-a-folder learning, CLI first then a Workspace module | Alex's suggested entry point. Corpus stays local; only derived statistics ship (D7) |

D1 first even though D2 is the foundation: it is self-contained, it makes every
later result audible, and it does not wait on the MIDI files Alex is curating
elsewhere. D2 starts when those arrive.

D1 also needs N1 decided, per the open-hat argument above.

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
