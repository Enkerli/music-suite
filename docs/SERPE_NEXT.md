# Serpe — where it stands, 2026-08-01 evening

*A baton, not a design doc. Written to be picked up by someone with no access to
the conversations that produced the two commits below. Everything here was
measured on the dates given, not inferred.*

Companion docs, in the order you probably want them:
[SERPE_DAW_FINDINGS_2026-08](SERPE_DAW_FINDINGS_2026-08.md) (what broke and
why), [INTENT](INTENT.md) §D (decisions that must not be "fixed"),
[TESTING_NOTES_2026-08](TESTING_NOTES_2026-08.md) (what to tell testers).

---

## 1. What landed today, after the DAW session

Two commits in `rhythm_pattern_explorer`, both on `main`:

| commit | what |
|---|---|
| `baaed0a` | **Poly lanes accent** — and INTENT **D8**: an accent layer belongs to a lane |
| `03b0bbc` | **Progressive state belongs to an instance, and to a lane** — F1/F1a |

Alex's own `26a6680` sits between them (the probe's `.mid` artifacts had never
had real timing — seconds written as ticks since the probe's first commit).

### F2 → fixed: poly lanes accent

`triggerPolyNote` took `bool /*isAccented*/` and always sent
`unaccentedVelocity`. Each lane already parsed its own `{…}`; `PolyParser` had
nowhere to put it. Now the lane carries it, and an accent is what mono makes:
louder **and** transposed, off the same `accentVelocity` / `accentPitchOffset`,
applied to **that lane's own** `laneNote`.

**The decision that had to come first — INTENT D8.** `/` binds loosest, so both
splitters split on it before reading anything else: a leading brace is already
inside lane 1's body. `{1001010}E(5,8)/E(1,17)>17` accents **lane 1 only**;
`{101}E(3,8)/{11}E(3,7)` accents both. What Alex heard as "no accents at all" is
now "accents on the first lane" — expect that to surprise someone, and D8 says
why rather than carving an exception into D4.

Accent index is cumulative over **onsets** (mono's rule), derived from the lane
clock, reconciled across the PD wrap.

### F1/F1a → fixed: progressive state is owned

Three file-scope statics in `UPIParser.cpp`, keyed only by pattern text, one map
per **process**. Now `ProgressiveTransformState`, passed by reference, **no
default argument** — the processor owns one for mono, each `PolyLaneRuntime`
owns one for its lane.

Measured on the unfixed build before touching it:

- Two instances triggered alternately took **strict alternate steps of one
  sequence**.
- `E(1,8)>8/E(1,8)>8` lanes were not merely apart on trigger 1
  (`11000100`/`11010100`) — they were **several steps in**, inheriting state
  from an earlier session in the same probe run that used the same pattern
  text. The probe was contaminating itself.
- Persistence needed a second fix the new test found: `setStateInformation`
  calls `setUPIInput`, that re-parses, and a `>N` parse **advances** — so
  restoring before it left a reopened project one step late. State now goes back
  *after* that parse, with the pattern it describes.

---

## 2. Open, in the order I would take them

1. ~~**Poly lane progressive state is not persisted.**~~ **FIXED 2026-08-01** (`defffc7`). Mono is. A lane's state is
   rebuilt by the parse `setStateInformation` itself triggers, so restoring into
   lanes needs a defined point after that parse. Same shape as the mono fix in
   `03b0bbc` — read that hunk first, it is the template.
2. ~~**The webapp does not precess poly lane accents.**~~ **FIXED 2026-08-01.** It draws and plays them
   (`apps/serpe/main.jsx`, `lane.accents`), but from the first-cycle projection
   with no per-cycle advance — mono precesses, poly does not. So `{10}E(5,8)` on
   a lane disagrees with the plugin from cycle 2. D3 says the engine wins; this
   is the last piece of poly accents.
3. ~~**`setProgressiveOffsetEngine` is still a process-wide static.**~~ **FIXED
   2026-08-01** (`55c3047`) — it was a process-wide *pointer* to a per-instance
   object with an empty destructor, so it was a dangling-pointer risk as well
   as a sharing one. Now `ProgressiveTransformState::offsetEngine`. Re-bound
   before every lane parse, so it does not accumulate state the way the maps
   did — but it is the same shape of thing, and it is what `beforeLaneParse`
   exists to work around. Worth folding into the lane-state accessor.
4. **`MAX_PROGRESSIVE_STATES = 100`** is now per instance and could drop a lot.
   Left at 100 deliberately: eviction is observable (a dropped key restarts at
   its base), so changing it is a decision to make out loud.

---

## 3. Traps — things that will bite

- **No default argument on `UPIParser::parse`.** Deliberate (INTENT L5, four
  incidents). If you find yourself adding one to make a call site compile, you
  are re-creating F1. Give that call site its own state.
- **D6 (base-first) and D8 (per-lane accents) are settled.** Neither commit
  touched them; do not "fix" either.
- **The `>N` branch is in `parsePattern`, not `parseAfterFeel`,** and
  `parsePattern` recurses into itself for the named patterns (`tresillo`,
  `hex`, …). The findings doc's "four call sites" undersold it — ~15 internal
  sites thread the state. Mechanical, but budget for it.
- **The probe needs `idleBlocks` to hear anything.** One trigger is a 512-sample
  block, ~11ms — a fraction of a step. Any question about what a pattern
  *sounds* like needs the transport actually running.
- **Two instances, or you cannot see process-wide state at all.** Every probe
  session before today built one processor. That is why F1 survived this long.

---

## 4. Re-running the verification

From `rhythm_pattern_explorer`, with the monorepo as a sibling checkout:

```
cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --target serpe_conformance serpe_poly_conformance \
      serpe_poly_precedence serpe_microtiming_conformance \
      serpe_dataflow_probe Serpe_AU -j 8
```

Then run each binary from `build/<name>_artefacts/Release/`. The probe exits
non-zero on failure and prints what it measured; the sessions that matter here
are `serpe-accent-poly`, `serpe-poly-shared-key`, `serpe-two-instances` and
`serpe-state-roundtrip`. In the monorepo: `npx vitest run` (1668 tests).

All of the above passed at `03b0bbc`. `Serpe_Standalone` builds too — build it
when you touch `PluginProcessor.h`, because no test target links the editor —
but delete the resulting `.app`: this project ships plugins only.

---

## 5. One loose end outside the code

`git stash list` in the `rhythm_pattern_explorer` main checkout holds
**`stash@{0}` — Alex's WIP accent probe sessions**, stashed 2026-08-01 to
unblock a fast-forward. It is superseded by `baaed0a` (same two sessions, plus
`idleBlocks` and a pass/fail assertion; its per-pair counts were kept). Safe to
drop, but that is Alex's call, not an agent's.
