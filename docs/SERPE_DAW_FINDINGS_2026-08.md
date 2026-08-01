# Serpe in a DAW — findings from the first real session

*2026-08-01. From Alex's Bitwig 6.1b4 and Logic Pro testing, plus
`Suitest.dawproject` decoded and the engine re-probed headlessly. Five findings,
four of them real, one a control nobody could find.*

**The headline: one root cause probably explains most of the confusing results.**
Serpe keeps progressive state in **process-wide statics**, so what a pattern does
depends on what other instances and other projects did earlier in the same DAW
session. Until that is fixed, any test of a progressive pattern is
non-reproducible by construction, and results should be read with that in mind.

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

### F1a — it reaches poly lanes too

`PolyParser.cpp:306` calls the same `UPIParser::parse()` **per lane**, so every
lane's `>N` state goes through the same global map, keyed by pattern text.

**Prediction, from reading the code — not yet measured.** For
`E(1,8)>8/E(1,8)>8`, both lanes hit one key, so each trigger advances the shared
counter *twice* and the lanes come apart immediately:

| | trigger 1 | trigger 2 |
|---|---|---|
| JS reference (pure, stateless) | `10000000` / `10000000` | `10000001` / `10000001` |
| C++ predicted | `10000000` / `10000001` | `10001001` / `10101001` |

The JS row is measured (`polyLaneAt`, 2026-08-01) and is what *should* happen:
identical lanes stay identical and advance one step per trigger. If the C++ row
is confirmed, it is the same bug in its most visible form and makes a good
regression test.

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

`MAX_PROGRESSIVE_STATES = 100` can drop a lot once the map is per-instance, but
eviction semantics should not change silently — if the cap changes, say so.

---

## F2 — Accents are dropped in poly. Deliberately, and undocumented outside the code

`PluginProcessor.cpp:1494` — the parameter is commented out at the signature:

```cpp
void SerpeAudioProcessor::triggerPolyNote(..., bool /*isAccented*/)
{
    ...
    float velocity = unaccentedVelocityParam ? unaccentedVelocityParam->get() : 0.8f;
```

Confirmed headlessly. `{1001010}E(5,8)/E(1,17)>17` emits **one** note/velocity
pair, `note 36 vel 102` — flat, unaccented. Mono is fine (F3).

The intent is recorded at `PluginProcessor.cpp:1256`: *"v1 scope, deliberately:
unaccented (flat velocity) — accent parity is separate roadmap work."*

So Alex's Logic finding is a known limitation behaving exactly as built. **The
failure is that nobody could have known.** It is in a code comment and in no
document a tester reads — including the testing notes written the day before,
which walked through poly at length and never mentioned accents. Now listed in
[TESTING_NOTES_2026-08](TESTING_NOTES_2026-08.md) §4.

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

## F5 — `S1` is not a pattern; it is one note per audio buffer

57 notes in 8 beats, with inter-onset gaps clustering at **0.0195 and 0.039
beats** — at the project's 120 BPM that is **9.75 ms and 19.5 ms**, or ~468 and
~936 samples at 48 kHz. Those are audio-buffer multiples, not musical
subdivisions. The rest of the clip is irregular (0.509, 0.744, 0.256) with two
near-simultaneous notes at the very start (0.000011 and 0.000623).

So Serpe fired **once per processBlock** for stretches of that clip. Not a
mis-timed pattern — a runaway trigger.

Not yet reproduced. Alex could not export the `.mid` from this clip either, which
may be a Bitwig 6.1b4 issue on top. Worth noting the beta: 6.1b4 is itself a
moving target, and this is the only finding here that might not be ours.

**What would settle it:** the trigger paths run on the audio thread and re-enter
`parseAndApplyUPI` on every note-on and every tick edge. A stuck tick parameter,
or MIDI feeding back into the same track, would produce exactly this. The tick
edge is level-triggered against `lastTickState`; if a host writes that parameter
every block, every block is an edge.

---

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
