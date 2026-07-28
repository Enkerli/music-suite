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
| `SceneManager` | 233 | 12 call sites from the processor | **genuinely live**, and genuinely duplicated: `initializeScenes` populates it, `advanceScene` advances it, getters are read — all alongside the processor's own legacy scene arrays, with an `if manager else legacy` fallback on each read. Two working implementations of one behaviour |
| `ProgressiveManager` | 682 | 4 call sites | **inert — corrected 2026-07-27.** The census first said it "owns state persistence". It *implements* persistence, but is never fed: `initializeProgressiveState()` is the only writer of `progressiveStates` and has **no external caller**, so the map is always empty — save writes an empty tree, load restores nothing, clear clears nothing. Its `applyProgressiveTransformation()` is also a stub returning the base pattern; the real transform lives in `UPIParser` (with its own static state maps and LRU cleanup — a parser holding session state is the smell finishing this would fix) |
| `PresetManager` | 444 | 1 in the processor, 15 in the editor | genuinely in use — the editor drives it. Not part of the problem |

Why this is the highest-value item: two code paths for the same behaviour is
how you get bugs that only appear in one of them, and the `TEMPORARY` disables
mean the intended path is *off*. It also explains §C.

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

1. **Finish or revert §B** — it is the only item where doing nothing carries
   ongoing risk (two live paths, intended one disabled). Decide per manager:
   complete the extraction and delete the legacy path, or revert the manager
   and delete it. Both are better than parallel.
2. **Answer §C's progressive-offset question in a host** (type `E(3,8)%2`,
   trigger, watch). If the feature is wanted, wiring
   `triggerProgressiveOffset` is small; if not, its remains go with §B.
3. **Then delete §A**, having mined `_Original` for whatever §B needed.
4. **Close §D** whenever PickPCS/MIDIcurator are next touched — a two-file
   deletion, no risk, just tidiness.

Nothing here blocks anything. The reason to keep the map is that each of these
costs a few minutes of confusion every time someone greps the codebase, and
§B costs more than that.
