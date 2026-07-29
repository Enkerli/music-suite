# Code census — dead code and migrations stopped halfway

*Taken 2026-07-27 across all nine repos. **Nothing was changed or retired.**
This is a map, made after `ProgressiveManager` turned out to be a
half-finished migration rather than dead code — the distinction that decides
whether removing something is cleanup or breakage.*

## What the census is actually looking for

Three different things get called "dead code", and they want opposite
treatment:

| Kind | Signature | Treatment |
|---|---|---|
| **Orphan** | not compiled / not imported at all | safe to delete once you've confirmed nothing references it, but check git history first — it may be the only copy of a decision |
| **Stopped migration** | new thing runs "in parallel with legacy for safety"; part of it stubbed | **finish or revert deliberately.** Deleting the visible stub can take live responsibilities with it |
| **Uncalled function** | defined, never called | tells you a *feature* is inert, not just a symbol. Ask whether the feature is wanted before removing its remains |

Method, and its limits: this is grep plus build-system reading plus targeted
call-site counts. It cannot see runtime dispatch, JUCE macro-generated calls,
or reflection, and "no caller" for a `->` probe is wrong for a value member (I
made that exact error on `presetManager` mid-census and corrected it). Treat
every row as a lead to confirm, not a verdict.

---

## A. Orphans — 6,256 lines of uncompiled C++ in Serpe

None of these appear in `rhythm_pattern_explorer/CMakeLists.txt`, so nothing
in any build touches them:

| File | Lines |
|---|---|
| `Source/Platform/PluginProcessor_Original.cpp` | 2,278 |
| `Source/Platform/PluginEditor_Original.cpp` | 2,197 |
| `Source/Core/UPIParser.cpp.bak` | 1,422 |
| `Source/Platform/PluginProcessor_Original.h` | 359 |

**Mining verdict, measured 2026-07-27 — there is almost nothing in them.**
Comparing declared methods against the live files:

- `PluginProcessor_Original.cpp`: **39** methods vs the live processor's **66**,
  and the only name unique to the orphan is its pre-rename class
  (`RhythmPatternExplorerAudioProcessor`). Nothing to mine.
- `PluginEditor_Original.cpp`: **no** unique methods. Nothing to mine.
- `UPIParser.cpp.bak`: four names absent from the live parser, of which two
  merely moved — `combinePatterns` now lives in `PatternUtils`, `hasAccentPattern`
  is still in `UPIParser`. Only **`extractAccentPattern`** and
  **`removeAccentPattern`** exist nowhere else. Accents demonstrably work
  (`{10}E(5,8)` parses; ledger row ✓), so these look superseded by inline
  handling rather than lost — worth a ten-minute read before deletion, not a
  salvage operation.

Method names do not prove body equivalence, so this is "nothing worth mining"
rather than "provably identical". But it removes the main reason to keep 6,256
lines: they are not the last record of anything.

## B. The stopped migration — Serpe's manager extraction (the big one)

Managers were extracted from `PluginProcessor` and then left **running in
parallel with the code they were meant to replace**. The processor says so in
its own comments: `TRANSITION: Running parallel with legacy for safety`,
`TRANSITION: Use SceneManager if available, with legacy fallback for safety`,
and twice `TEMPORARY: Disable ProgressiveManager to isolate legacy system`.

| Manager | Lines | Wiring | State |
|---|---|---|---|
| ~~`SceneManager`~~ | ~~233~~ | — | ✅ **FINISHED 2026-07-28** (Serpe `7284a17`, branch `serpe/finish-scene-manager`): the legacy scene arrays are gone, 302 lines deleted, and the manager owns its own persistence. Reasoning kept below |
| ~~`ProgressiveManager`~~ | ~~682~~ | — | ✅ **REVERTED and merged 2026-07-28** (Serpe `f01dafc`): 682 lines and 4 call sites gone, play-tested in the standalone first (progressive advances from Enter and MIDI, unchanged). Kept below for the reasoning. **inert — corrected 2026-07-27.** The census first said it "owns state persistence". It *implements* persistence, but is never fed: `initializeProgressiveState()` is the only writer of `progressiveStates` and has **no external caller**, so the map is always empty — save writes an empty tree, load restores nothing, clear clears nothing. Its `applyProgressiveTransformation()` is also a stub returning the base pattern; the real transform lives in `UPIParser` (with its own static state maps and LRU cleanup — a parser holding session state is the smell finishing this would fix) |
| `PresetManager` | 444 | 1 in the processor, 15 in the editor | genuinely in use — the editor drives it. Not part of the problem |

Why this is the highest-value item: two code paths for the same behaviour is
how you get bugs that only appear in one of them, and the `TEMPORARY` disables
mean the intended path is *off*. It also explains §C.

**Half of it is now resolved.** ProgressiveManager was reverted on a branch,
verified three ways (byte-identical parser-probe output against a pre-revert
baseline, full ladder, then played in the standalone), and merged 2026-07-28.
The `TEMPORARY: Disable ProgressiveManager…` comments went with it.
**SceneManager is the remaining decision** — and it is the harder one, because
unlike ProgressiveManager it is genuinely fed, so "revert" and "finish" both
change which implementation runs.

**Instrumented 2026-07-28**, branch `serpe/scene-manager-compare`
(`398832d`, `e4a678c`). `Source/Platform/SceneCompare.h` makes every read site
compute both values and record whether they matched; behaviour is unchanged,
each site still returns exactly what it returned before. Six things are
watched: scene index, scene count, base pattern, progressive offset,
progressive lengthening, base-length pattern.

Three design points worth keeping even if the file is deleted:

- **The report separates "agreed" from "never ran".** A site that never
  executed is silent in a log, and silence is indistinguishable from success —
  which is the failure mode this whole technique exists to avoid. Counts are
  per site, and unexercised sites say so.
- **`printf`/`DBG` is unreliable inside a plugin host** (Alex, 2026-07-27), so
  it writes a file, rewritten whole so it is always valid to read:
  `~/Library/Serpe/scene-compare.log`. Note JUCE's
  `userApplicationDataDirectory` is `~/Library` on macOS, *not*
  `~/Library/Application Support` — a self-test pinned that down rather than a
  play session discovering it the slow way.
- **`applyCurrentScenePattern()` runs on the audio thread**, so that side only
  bumps atomics and copies one short example under a try-lock. The file is
  written from the message thread: destructor, `releaseResources`,
  `getStateInformation`, and the editor timer.

One site is weaker than the others and is labelled as such in the code: the
base-length pattern is written by whichever branch runs, so after first use the
legacy copy is empty *by construction*. Only the first use is comparable.

Verify in the **Standalone**. The AU/VST3 targets here still copy themselves
into the shared plug-in folders (this branch's `enkerli-juce` pin predates
`ENKERLI_INSTALL_PLUGINS`), so building them would overwrite the real installed
Serpe — the same trap that bit the ProgressiveManager pass.

**Result, 2026-07-28.** A real session gave:

```
currentSceneIndex       checks=74  disagreements=0   agree
sceneCount              checks=0   disagreements=0   (never ran)
basePattern             checks=74  disagreements=0   agree
progressiveOffset       checks=74  disagreements=7   manager=[4] legacy=[2]
progressiveLengthening  checks=74  disagreements=6   manager=[6] legacy=[3]
baseLengthPattern       checks=1   disagreements=0   agree
```

Every difference is exactly **one advance** — step 2 giving 4 vs 2, step 3
giving 6 vs 3. That is not two implementations disagreeing. `advanceScene`'s
"Keep legacy system in sync" block was an empty `if` containing only comments,
so the legacy counters sat at their initial values forever while the manager
moved. And `SceneManager::advanceScene` is a verbatim copy of the legacy code
("EXACTLY the original", in its own comments). Same algorithm, one copy frozen:
the fallback was stale data wearing a safety label, and reverting to it would
have been the regression.

`sceneManager` is built in the constructor and never released, so the legacy
branches only ran when `hasScenes()` was false — when there is nothing to
advance. Unreachable whenever it mattered.

So: **finished, not reverted.** Deleted seven members, the duplicated
scene-syntax parser in `parseAndApplyUPI` (`initializeScenes` did the same work
on the next line), both legacy branches, and the scene half of
get/setStateInformation. Persistence moved into SceneManager with the property
names and CSV format unchanged, so older sessions still load. Parser-probe
output byte-identical to main; microtiming 134/134.

`sceneCount checks=0` is its own small finding: nothing calls `getSceneCount()`.

### Open: scene advance fires more than once per trigger

Surfaced by the same session, **not caused by the migration and not fixed by
it** — it lives in the trigger paths, which were not touched. Symptom (Alex,
2026-07-28): with `E(1,8)>8|E(3,8)%2|E(3,8)*3` the display sticks on the first
scene, flicking through the others, "like one scene advance is worth 3". Three
scenes, so three advances per trigger lands back where it started.

There are exactly three `advanceScene()` call sites: the tick-parameter edge,
MIDI note input, and resubmitting an unchanged chain inside `parseAndApplyUPI`
(which is the path the WebUI's Enter takes). Each fires once, so reaching 3
requires more than one to run per user action. **That is a hypothesis, not
evidence** — settle it the same way §B was settled, by counting calls per site
rather than reading. The `SceneCompare` pattern on `serpe/scene-manager-compare`
is the template.

## C. Uncalled functions — features that are inert, not just symbols

- **`PatternEngine::triggerProgressiveOffset()`** (Serpe) — defined and
  declared, **no caller anywhere**. So progressive offset is configured and
  never advanced, which matches the probe: `E(3,8)%2` returns the same pattern
  on every trigger while `E(1,8)>8` marches. Progressive offset appears inert
  in the engine today. Detail in the Serpe repo's `FEATURE_PARITY.md`
  ("Engine archaeology"). Not confirmed in a running host — that needs ears.
- **PitchFold's `ChordPadBank::setTriggerNote` / `padForNote`** — already
  catalogued as dead in `docs/PITCHFOLD_AUDIT.md`, with a latent
  uninitialized-array read noted beside it, and the recommendation "drop, or
  finish it". Still present. That audit is worth re-reading before any
  PitchFold work rather than re-deriving it.
- **Vane, `SynthVoice.cpp`** — one self-assignment identified in a comment as
  "pure dead code", already explained and left deliberately. Harmless; listed
  so a future census doesn't treat it as a find.

## D. Deliberate pre-migration copies (music-suite) — decide, don't drift

Kept on purpose during the theory/UI consolidation, each referenced only by a
comment saying so:

- `apps/PickPCS/src/App.local.jsx` — pre-migration copy; `App.jsx:10` points
  at it "until the migration is finalized".
- `apps/MIDIcurator/src/lib/midi-export.local.ts` — same shape;
  `midi-export.ts:9` points at it. Its siblings (`chord-*.local.ts`, 1,334
  lines) were deleted 2026-06-14 once the migration was trusted, so this pair
  is the tail of a finished job rather than an open question.

The monorepo is otherwise clean: the other `TRANSITION` hits are
`TRANSITION_STEP`, a curation constant, and the rest are docs *discussing*
dead code. enkerli-juce, workspace-plugin, midicurator-plugin,
progression-studio-plugin and DrawnQurve came back with **no markers at all**.

## E. Suggested order, if and when this gets acted on

1. ~~**Finish or revert §B**~~ — **done 2026-07-28.** ProgressiveManager
   reverted and merged; SceneManager finished on `serpe/finish-scene-manager`,
   awaiting a play-test before merge. Both decided by measurement, and they
   went opposite ways — which is the argument for measuring rather than
   reading. What remains from that session is the separate scene-advance bug
   recorded at the end of §B.
2. **Answer §C's progressive-offset question in a host** (type `E(3,8)%2`,
   trigger, watch). If the feature is wanted, wiring
   `triggerProgressiveOffset` is small; if not, its remains go with §B.
3. **Then delete §A**, having mined `_Original` for whatever §B needed.
4. **Close §D** whenever PickPCS/MIDIcurator are next touched — a two-file
   deletion, no risk, just tidiness.

Nothing here blocks anything. The reason to keep the map is that each of these
costs a few minutes of confusion every time someone greps the codebase, and
§B costs more than that.
