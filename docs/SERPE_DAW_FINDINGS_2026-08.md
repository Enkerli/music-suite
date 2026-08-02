# Serpe in a DAW — findings from the first real session

*2026-08-01. From Alex's Bitwig 6.1b4 and Logic Pro testing, plus
`Suitest.dawproject` decoded and the engine re-probed headlessly. Five findings,
four of them real, one a control nobody could find.*

**The headline: one root cause probably explains most of the confusing results.**
Serpe kept progressive state in **process-wide statics**, so what a pattern did
depended on what other instances and other projects had done earlier in the same
DAW session. Any test of a progressive pattern was non-reproducible by
construction.

> **Fixed 2026-08-01 (F1, F1a).** The state is now owned — one per processor for
> mono, one per lane for poly — and it travels in the project file. Progressive
> results are reproducible from this build on, so **re-test anything you
> previously wrote off as flaky**; the earlier notes on those runs are not
> evidence about the current build.

---

## F1 — Progressive state is process-wide, not per-instance *(root cause)*

`Source/Core/UPIParser.cpp:1911-1913`:

```cpp
static std::map<juce::String, std::vector<bool>> progressivePatterns;
static std::map<juce::String, int> progressiveAccessCount;
static std::map<juce::String, int> progressiveStepCount;
```

File-scope statics, keyed **only by the pattern string**. Consequences, all of
which match what Alex reported:

- Every Serpe instance in the DAW process **shares one step counter per pattern
  text**. Two tracks running `E(1,8)>8` fight over the same state.
- The maps are **never cleared on project load**, so a new project inherits
  whatever the last one left behind — *"settings are bypassed by playing with the
  same plugin, even in a new project."*
- `getStateInformation` saves `currentProgressivePatternKey` — the **key**, not
  the step. On reload the key is restored and the step is whatever the process
  happens to hold. That is precisely *"if I save a project with a given pattern
  and then enter another pattern, this will be what Serpe uses even if I don't
  save."*
- Capped at 100 entries with LRU-ish eviction, so state can also vanish
  mid-session.

**This is not a state-saving gap.** Save/restore is thorough — accents,
`originalUPIInput`, scenes and `baseLengthPattern` are all persisted and read
back. The problem is that the authoritative copy of progressive state lives
somewhere the project file cannot reach.

### Fixed 2026-08-01 — and what the measurements said

Built as decided below: a `ProgressiveTransformState` passed in by reference,
with **no default argument**, owned by the processor for mono and by each
`PolyLaneRuntime` for poly. The statics are gone.

The prediction in F1a was **confirmed first, then fixed**, because a bug this
old deserves a failing test before a patch. What the probe measured on the
unfixed build:

| | before | after |
|---|---|---|
| two instances, triggers interleaved (`E(1,8)>8`) | `10000001 10101001 11101011 …` against `10001001 10101011 11111011 …` — each took alternate steps of ONE sequence | both `10000001 10001001 10101001 10101011` |
| `E(1,8)>8/E(1,8)>8` (F1a) | `11000100+11010100` on trigger 1 — already apart, and already several steps in | `11000000+11000000`, `01100010+01100010`, … identical, one onset per trigger |

Two details the measurement added that reading the code had not:

- **The lanes did not merely diverge, they started mid-progression.** Trigger 1
  of that poly session inherited state from an *earlier session in the same
  probe run* that happened to use the same pattern text. One process, one map —
  the probe was contaminating itself, which is the bug in miniature.
- **Persistence needed a second fix.** Making the map per-instance is not enough
  if a reopened project resumes from the wrong step: `setStateInformation` calls
  `setUPIInput`, that re-parses, and a `>N` parse ADVANCES. Restoring before it
  left a reloaded project one step late (saved on `11101011`, restored on
  `11111011`). The state now goes back *after* that parse, along with the
  pattern it describes. Also saved now: `lastProgressiveTransformUPI`, without
  which a reload looks like freshly typed text and clears what it just restored.

Three probe sessions pin all of it — `serpe-two-instances`,
`serpe-poly-shared-key`, `serpe-state-roundtrip`. The first is the test whose
absence let this survive: every earlier session built ONE processor, and
process-wide state is invisible to a single instance by construction.

**Still open:** a poly lane's progressive state is not persisted (mono is). A
lane's state is rebuilt by the parse that `setStateInformation` itself triggers,
so restoring into lanes needs a defined point after that — a separate change,
noted rather than half-done.

### F1a — it reaches poly lanes too *(fixed with F1; measured, no longer predicted)*

`PolyParser.cpp:306` calls the same `UPIParser::parse()` **per lane**, so every
lane's `>N` state goes through the same global map, keyed by pattern text.

**Was a prediction from reading the code; MEASURED 2026-08-01 before the fix,
and it held.** For `E(1,8)>8/E(1,8)>8` both lanes hit one key, so each trigger
advanced the shared counter *twice* and the lanes came apart immediately:

| | trigger 1 | trigger 2 |
|---|---|---|
| JS reference (pure, stateless) | `10000000` / `10000000` | `10000001` / `10000001` |
| C++ predicted | `10000000` / `10000001` | `10001001` / `10101001` |
| **C++ measured, unfixed** | `11000100` / `11010100` | `11101010` / `11111010` |
| **C++ measured, fixed** | `11000000` / `11000000` | `01100010` / `01100010` |

The JS row is measured (`polyLaneAt`, 2026-08-01) and is what *should* happen:
identical lanes stay identical and advance one step per trigger. The C++ row was
confirmed on the unfixed build and is now the `serpe-poly-shared-key` probe
session — it fails loudly if the lanes ever diverge again.

One difference from the JS numbering, and it is not this bug: the C++ column
starts a step further on, because `setUPIInput` parses once itself before any
trigger. The *sequence* matches; the offset is where the two engines count
from.

### Fix direction — decided 2026-08-01

The coupling is far smaller than it looks. **Four call sites, total:**

| symbol | callers |
|---|---|
| `UPIParser::parse()` | 2 — `PolyParser.cpp:306`, `PluginProcessor.cpp:2200` |
| `applyProgressiveTransformation()` | 1 — inside `parse()`, `UPIParser.cpp:600` |
| `getProgressiveStepCount()` | 1 — `PluginProcessor.cpp:2787` |

So **pass the state in** rather than hiding it in a singleton or threading it
through `PatternEngine`:

```cpp
struct ProgressiveTransformState {
    std::map<juce::String, std::vector<bool>> patterns;
    std::map<juce::String, int> stepCount;
    std::map<juce::String, int> accessCount;
    void saveTo (juce::ValueTree&) const;
    void restoreFrom (const juce::ValueTree&);
};

static ParseResult parse (const juce::String& input, ProgressiveTransformState& progressive);
```

Why this shape:

- **No default argument.** A defaulted parameter would let a future call site
  silently fall back to shared state — which is exactly how the two trigger
  sites drifted from `setUPIInput` (INTENT L5). Make the compiler visit all two.
- **Parsing stays static and pure.** The state is the *transform bookkeeping*,
  not the parse, and this keeps that boundary visible instead of dissolving it.
- **Ownership falls out for free.** The processor owns one for mono;
  `PolyLaneRuntime` owns one per lane, which fixes F1a in the same change rather
  than needing a second pass.
- **Persistence is then obvious** — `saveTo`/`restoreFrom` join the existing
  `sceneManager->saveStateTo(state)` call in `getStateInformation`, alongside
  the `currentProgressivePatternKey` that is already saved.

**One correction from building it.** The table above lists `parse()` and
`applyProgressiveTransformation()`, but the `>N` branch actually lives in
`parsePattern()`, which also recurses into itself for the named patterns
(`tresillo`, `hex`, …). So the state threads through `parse` → `parseAfterFeel`
→ `parsePattern`, and the internal call sites are ~15 rather than 4. All
mechanical, none of it changes the shape — but "four call sites" undersold it,
and the next person reading this should not be surprised.

`MAX_PROGRESSIVE_STATES = 100` can drop a lot once the map is per-instance, but
eviction semantics should not change silently — if the cap changes, say so.

---

## F2 — Accents were dropped in poly. **Fixed 2026-08-01**

`PluginProcessor.cpp:1494` — the parameter was commented out at the signature:

```cpp
void SerpeAudioProcessor::triggerPolyNote(..., bool /*isAccented*/)
{
    ...
    float velocity = unaccentedVelocityParam ? unaccentedVelocityParam->get() : 0.8f;
```

Confirmed headlessly. `{1001010}E(5,8)/E(1,17)>17` emitted **one** note/velocity
pair, `note 36 vel 102` — flat, unaccented. Mono was fine (F3).

The intent was recorded at `PluginProcessor.cpp:1256`: *"v1 scope, deliberately:
unaccented (flat velocity) — accent parity is separate roadmap work."*

So Alex's Logic finding was a known limitation behaving exactly as built. **The
failure was that nobody could have known.** It was in a code comment and in no
document a tester reads — including the testing notes written the day before,
which walked through poly at length and never mentioned accents.

### The fix, and the decision it needed first

Every lane already parsed its own accent layer; `PolyParser` simply had no field
to put it in, so it was dropped between the parser and the runtime. Restoring it
is three small pieces — the parser carries `accentPattern` per lane, the lane
runtime keeps it, and `triggerPolyNote` applies the same
`accentVelocity`/`accentPitchOffset` mono uses, to **that lane's own**
`laneNote` rather than a hardcoded 36.

What had to be settled before any of that was **whose accent a leading brace
is**. `{1001010}E(5,8)/E(1,17)>17` looks like it puts the brace outside the
lanes, but `/` binds loosest (INTENT §D4), so both splitters split on it before
reading anything else and the brace is already inside lane 1's body. Now written
down as **INTENT §D8**: an accent layer belongs to a lane. That string accents
lane 1 alone; `{101}E(3,8)/{11}E(3,7)` accents both. So what Alex heard as "no
accents at all" will now be "accents on the first lane" — the semantics were
never the bug, but they were never stated either.

The index is per-lane and cumulative over **onsets** (mono's rule), derived from
the lane clock rather than counted, so a 7-long layer on a 5-onset lane
precesses instead of repeating and cannot drift.

**Verified:** `serpe_dataflow_probe`'s new `serpe-accent-poly` session runs the
transport for ~2 cycles and now reports **two** distinct pairs — `note 41 vel
127` alongside `note 36 vel 102` — with `serpe-accent-mono` as the control.
`serpe_poly_precedence` pins §D8 itself (lane 1 accented, lane 2 not) and the
onset arithmetic; `packages/upi/src/poly.accents.test.js` pins the same reading
on the JS side, which had it right all along.

**Still open, found while checking the JS side.** The webapp already *draws* and
*plays* per-lane accents (`main.jsx` — `lane.accents`), but it uses the
first-cycle projection and never advances it: mono precesses its accent phase at
each cycle boundary, poly lanes do not. So on a lane where the layer's length
does not divide the onsets per cycle — `{10}E(5,8)`, the usual test case — the
webapp's second cycle repeats while the engine's precesses. Not a regression
from this fix, and D3 says the engine is the authority, but it is a visible
disagreement in the browser and it is now the only piece of poly accents left.

---

## F3 — Mono accents work; an accent is a *different note number*

Probed: `{10010}E(5,8)` emits `note 41 vel 127`.

Worth stating because it surprises: Serpe marks an accent **two ways at once** —
velocity (`accentVelocity` 1.0 vs `unaccentedVelocity` 0.8) **and pitch**
(`accentPitchOffset`, default **+5 semitones**). With the default note 36, an
accented onset arrives as **note 41**.

If a drum instrument has nothing mapped at 41, accented onsets are silent, which
would read as "accents don't work" while the MIDI is correct.

---

## F4 — Neither clip in `Suitest.dawproject` contains any accent

Decoded from the project file:

| clip | notes | key(s) | velocity(s) |
|---|---|---|---|
| `accentpat` (4 beats) | 10 | 36 only | 100 only |
| `S1` (8 beats) | 57 | 36 only | 102 only |

Both were `{10010}E(5,8)`, both mono, and **neither has a single note 41 or a
second velocity**. Given F3, the engine can emit accents — so no accent was
active in the plugin when these were captured. F1 is the most likely reason.

`accentpat`'s *timing* is perfect: onsets at 0, 0.5, 0.75, 1.25, 1.5 and again at
+2.0. That is exactly `E(5,8)` = `10110110` at 2 beats per cycle, twice. So the
rhythm is right and only the accent is missing.

---

## F5 — `S1`'s burst is a three-block period, seen at half spacing

57 notes in 8 beats. The clip is not uniformly bursty: it opens with musically
spaced onsets and then a burst starts partway in.

```
  0.000011   0.000623  (+0.000612 — a double-fire, 0.3 ms apart)
  0.509678  (+0.509055)
  1.018734  (+0.509056)
  1.762835  (+0.744101)
  2.252421  (+0.489586)
  2.271918  (+0.019497)   <- the burst begins
  2.291387  (+0.019469)
  2.310855  (+0.019468)
```

**The burst quantum is 0.0194685 beats = 9.734 ms**, and it is remarkably
stable: 0.019468 appears 12 times, 0.019469 seven times — a spread under one
microsecond across 27 occurrences.

### Corrected TWICE. It IS the buffer — 624 samples at 96 kHz

First I said "audio-buffer multiples, ~468/936 samples", from rounding the delta
and reading 468 as a buffer size. Then I "corrected" that to *not a buffer*,
having checked 44.1/48/88.2/96 kHz against 64/128/256/512/1024 and found no fit.

**That second conclusion was wrong, and wrong for an instructive reason: I only
tested POWER-OF-TWO block sizes.** Bitwig allows any size. Alex's session ran
**624 samples**, which he reports as 6.50 ms — and 624 / 0.0065 s is exactly
**96 kHz**, so the rate is settled too.

Against that clock the numbers land:

| | measured | in blocks | error |
|---|---|---|---|
| the quantum, 0.0194685 beats | 9.7342 ms | **1.4976** | 0.16% |
| its double, 0.038966 beats | 19.483 ms | **2.9974** | 0.09% |

So the burst period is **three blocks (19.5 ms)**, and it appears in the capture
at **half that spacing**. A three-block period showing up every one-and-a-half
blocks is what two sources interleaved looks like — which is Alex's own reading:
*"it likely was an issue with the interaction between instances."*

That fits the project (two Serpe instances, both CLAP) and it fits the mechanism
already found and fixed: `processBlock` kept `lastProcessedStep` and four
siblings in **function-local statics**, so each instance saw "the step changed"
whenever the *other* one moved (Serpe `1eb66a5`).

**Still not formally closed** — the headless two-instance probe did not multiply
the note rate, so the reproduction is not in hand. But the arithmetic now
supports the mechanism rather than ruling it out, and the fix is already in.
**Re-testing in Bitwig with two instances on the current build is the check
that would close it.**

### The other clip is the control, and it is perfect

`accentpat`, from the same plugin in the same project, sits **exactly** on the
1/16 grid — worst deviation 0.000 milli-beats. `S1` is off-grid by up to 30.6.
So one capture is quantised or generated and the other is raw. That difference
is in the *recording path*, not the plugin, and it means the two clips are not
directly comparable evidence.

### Still needed to close it

The one fact that would settle the buffer question is **Alex's actual Bitwig
audio settings** — sample rate and block size at the time. If the block is 512
at 48 kHz, the buffer explanation is dead on arrival and the ~102.7 Hz source
has to be found elsewhere.

### A4, 2026-08-02 — narrowed, not solved

**Still open.** What the investigation established:

- **Alex's project runs TWO Serpe instances**, both CLAP
  (`Suitest.dawproject` names `com.enkerli.serpe` twice). That matters because
  the next finding needs more than one.
- **`processBlock` kept five per-instance values in function-local statics** —
  `lastBPM`, `lastProcessedStep`, `processedFirstStepThisBuffer`, and the two
  pattern-length trackers. Function-local statics have static *storage*, so
  every Serpe in the process shared one copy: instance A's step boundary was
  also B's. Fixed (Serpe `1eb66a5`), because per-instance state in a
  process-wide place is wrong regardless — the third instance of that shape in
  this file, after F1's maps and the offset-engine pointer.
- **It is NOT demonstrated to cause F5.** Two reproduction attempts failed: two
  instances over 240 blocks gave 3 note-ons alone and 4 with a neighbour, with
  and without a host transport. It fits the symptom and it did not reproduce
  it, and those are different claims.

**Tooling that came out of it, and will outlast this hunt:**

- `tools/midi-timing.mjs` reads any `.mid` in ticks and compares two of them.
- The probe grew a **`FakePlayHead`**. Without one, a headless probe silently
  exercises the internal-timing path, so the DAW-synchronised branch — where
  the step bookkeeping lives — never runs at all. Worth remembering the next
  time something "cannot be reproduced outside the DAW": it may never have been
  asked to.
- `serpe-two-instance-rate` stays as a guard: it fails if a neighbouring
  instance ever multiplies an instance's note rate.

**Where I would look next**, in order: whether the capture's ~468/936-sample
gaps match Bitwig's actual buffer at that session's sample rate (they are close
to 512 at 48k but not equal, and the difference may name the real clock);
whether MIDI was routed back into the same track; and the `tickResetCounter`
loop, which re-asserts the tick parameter every 20 blocks and is the one place
that deliberately writes a parameter from the audio thread.

## F6 — Polymeter exists. It is a parameter, and it is not the default

Alex: *"`E(3,8)/E(3,7)` syncs every bar when that should depend on the pattern
duration... it doesn't sound like we can get polymeter, only polyrhythm."*

Correct observation, wrong conclusion — both modes are implemented, as
`PluginProcessor.cpp:115`:

```cpp
juce::AudioParameterChoice("polyLock", "Poly Lock", {"Cycle", "Step"}, 0)
```

| setting | behaviour |
|---|---|
| **Cycle** (default, index 0) | every lane spans the same cycle — **polyrhythm** |
| **Step** (index 1) | all lanes share one step size, drift, realign at the LCM — **polymeter** |

Set **Poly Lock → Step** and `E(3,8)/E(3,7)` will drift and realign every 56
steps instead of locking each bar. It is a host-automatable parameter, so it is
in the DAW's parameter list.

Not a bug. **A discoverability failure** — the default is the less interesting
mode, the name says nothing about polymeter, and `SERPE_POLY.md` §3b documents it
where no tester would look. Candidate for the design pass.

---

## What Alex confirmed working

Recorded because a testing note that only lists faults gives a false picture:

- **Progressive patterns starting from the base** — *"exactly what's needed."*
  That settles the open question in [PROGRESSIVE_PHASE](PROGRESSIVE_PHASE.md);
  base-first stays.
- **`>N` looping back to the base after reaching the target** — *"great! Expected
  behaviour."* Settles INTENT D-question 4. It was undocumented; now stated.
- **`@N` not behaving like the progressive operators** — correct, it is not
  progressive.
- **DrawnQurve, Vane, ProgGenie** — all sound fine.

Tested on macOS with **CLAP and AU**. VST3 untested; iPad untested.

---

## Order to fix

1. **F1**, because it makes every other progressive result untrustworthy and
   silently corrupts multi-instance projects.
2. **F5**, because a runaway note stream is the worst thing a MIDI effect can do
   in someone's session.
3. **F2**, accent parity in poly — now a known gap with a user waiting.
4. **F6**, a naming/defaults question for the design pass, not an engine change.

F3 and F4 need no fix; they are explained by F1 and by the accent-pitch-offset
behaviour, which should be surfaced in the UI rather than changed.

---

## F7 — Parity check: `msuite upi` and Workspace against the library

*2026-08-01, from Alex: "my expectation is that everything can parse everything
in the same way, including [accents, scenes, progressive transforms in poly
lanes]."*

**The expectation is nearly right, and the gap is not where it looks.** The
library parses all of it. Two consumers were not using it.

| | `parsePolyUPI` | `msuite upi` before | after | Workspace |
|---|---|---|---|---|
| poly `/` | ✅ | ✅ | ✅ | ❌ |
| accents `{}` mono | ✅ | ✅ | ✅ | ✅ |
| accents per lane | ✅ | ❌ silently dropped | ✅ | ❌ |
| scenes `\|` mono | ✅ | ❌ **rejected** | ✅ | ❌ **rejected** |
| scenes per lane | ✅ | ❌ silently dropped | ✅ | ❌ |
| progressive mono | ✅ | ✅ | ✅ | ❌ |
| progressive per lane | ✅ | ❌ silently dropped | ✅ | ❌ |

**Root cause, one line, in both consumers:** anything without a top-level `/`
went to the *mono* parser `parseUPI`, which rejects `|` outright —
`E(3,8)|E(5,8)` returned *"Unrecognised pattern"* for notation the plugin plays
perfectly. `parsePolyUPI` handles the one-lane case and returns `sceneCount: 2`,
so routing scene-bearing strings through it fixes mono scenes for free.

The per-lane accents/scenes/progressive were never dropped at all — the parse
had them (`accents`, `accentPattern`, `scenes`, `sceneCount`, `progressive`) and
the renderer printed only `parsedLabel` and the binary. A display gap reading as
a parser gap, which is why it looked worse than it was.

**Fixed in the CLI.** `E(3,8)|E(5,8)` now prints its scenes; poly lanes print
their accent layer, scene chain and progressive kind.

**Workspace is NOT fixed.** `apps/workspace/modules.js:96` calls
`parseUPI(input.value, { n: 16 })`, so its pattern module cannot take poly,
scenes, or any progressive form. Same one-line root cause, same fix —
`parsePolyUPI` — but the module also renders a single pattern, so it needs a
lane-aware view rather than a swapped call.

### Related, and it matters for the timing work

`msuite upi --midi` also uses `parseUPI` (`cli.ts:308`). So the CLI can render
**mono only** to a MIDI file — no poly, no scenes, no per-lane accents. Any
timing baseline built on `--midi` therefore covers the mono path alone until
that is widened, which is worth knowing before it becomes the reference the DAW
captures are compared against.

### F7a — `--midi` is poly-aware; `parseUPI` is a layer, not a rival

`msuite upi --midi` now renders through `parsePolyUPI`: lanes on their own note
numbers, per-lane accents (louder **and** transposed +5, matching the plugin),
per-lane `@` offsets as tick shifts, per-lane PD. Mono callers see no change
because `parsePolyUPI` handles the one-lane case identically.

It renders **step lock** (polymeter — equal steps, lanes drifting to the lcm).
Stated loudly because the plugin's `Poly Lock` parameter **defaults to Cycle**,
so a capture taken with the default will not match this file. Set Poly Lock to
Step when capturing against the baseline, or render-side cycle lock has to be
added first.

Verified: `E(3,8)/E(3,7)` at 120bpm, 480tpb, 2 cycles gives
`0 0 240 360 480 720 840 960 1080 1320 1320 1680` — lane 2 begins its second
cycle at 840 while lane 1 begins at 960, which is the drift a baseline has to be
able to express.

**On deprecating `parseUPI`** (Alex's suggestion): it cannot be, and the reason
is structural — `parsePolyUPI` is *built on it* (`poly.js:143` parses each lane
body with it). It is the single-body parser under the notation parser, not a
rival to it.

The useful version of the instinct is a **layering rule**:

> Anything taking user input calls `parsePolyUPI`. Only library internals call
> `parseUPI`.

By that rule, of 14 call sites: `poly.js`, `named.js` and `upi.js`'s own
recursion are correct; `cli.ts --midi` (fixed here) and `apps/workspace/modules.js:96`
were wrong. `apps/serpe/main.jsx` (three sites) and
`packages/accompaniment/src/pipeline.ts:144` are unreviewed and should be
checked against the rule.
