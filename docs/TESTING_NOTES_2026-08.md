# What changed, and what needs a human — 2026-07-27 → 08-01

*For anyone about to test the plugins. Covers monorepo `07962a3..03e8023` (44
commits), Serpe `7515d16..852ec88` (31), plus the six other plugin repos and
`enkerli-juce`.*

Everything below is verified by automated tests **or** flagged as untested.
Nothing in this window has been through a DAW or a pair of ears, which is
exactly what is being asked for.

---

## 1. Read these two first

### 1.1 Progressive patterns start one trigger earlier than they used to
**This changes existing patterns.** Since 2026-07-30, trigger 1 of any
progressive pattern is the bare base — what you typed:

| you type | trigger 1 | trigger 2 | trigger 3 |
|---|---|---|---|
| `E(3,8)%2` | `E(3,8)` unrotated | rotated 2 | rotated 4 |
| `E(3,8)*3` | 8 steps | 11 steps | 14 steps |
| `E(1,8)>8` | `E(1,8)` | +1 onset | +2 onsets |

Previously `%N` and `*N` skipped the base and only `>N` showed it. If a saved
session or a remembered pattern sounds one step "late", that is this change and
it is intended. See [PROGRESSIVE_PHASE](PROGRESSIVE_PHASE.md).

**Worth an opinion:** does starting on the un-moved pattern feel right when the
point of `%N` is movement? The decision was made on principle, not by listening.
You are the listening test.

### 1.2 If you tested DrawnQurve before 2026-07-29, you tested an old binary
`COPY_PLUGIN_AFTER_BUILD` was hardcoded `FALSE`, so **DrawnQurve builds never
installed** — for about three weeks. Every build reported success. Any DrawnQurve
finding older than 07-29 should be re-checked before you trust it.

The general defence is now built in: **every plugin shows its build stamp.** See
§3.

---

## 2. What changed, by tool

### Serpe — most of the work in this window

| What | State |
|---|---|
| **Poly lanes** `E(3,8)/E(3,7)` — parallel lanes, independent lengths | new, untested by ear |
| Per-lane progressive `E(3,8)%2/E(3,7)`, `E(3,8)*3/E(3,7)` | new |
| Per-lane scenes `E(3,8)\|E(5,8)/E(3,7)` | new |
| `/` binds loosest — scenes and progressive belong to a *lane* | decided, INTENT D4 |
| Lanes advance independently (2 scenes vs 3 realign every 6) | decided, INTENT D5 |
| Poly advances on MIDI note-in and on Tick | fixed 07-29 |
| Poly panel draws **what the engine is sounding**, not the typed text | fixed 07-29 |
| Progressive transform inside a lane, `E(7,16)>16/E(1,17)>17` | fixed 07-29 |
| Scene progressive transforms losing a race with the pattern queue | fixed 07-28 |
| SceneManager migration finished; legacy frozen scene state deleted | 07-28 |
| Mono `%N`/`+N`/`*N` advancing on Tick and MIDI | **fixed 07-31** — was broken from both; only the editor worked |
| 6,256 lines of uncompiled C++ deleted | 07-29 |

### Every plugin — build stamps
Serpe, Vane, DrawnQurve, PitchFold, MIDIcurator, Progression Studio, Workspace
now show **two** stamps: the WebUI bundle's and the C++ binary's. A mismatch is
the point — it means the UI and the engine came from different builds, which
caused four separate "the UI is broken" reports that were nothing of the kind.

### Smaller
- **DrawnQurve** — redundant `setDirection` bridge emit removed. The direction
  control worked before via the parameter; nothing user-visible should change,
  which is itself worth confirming.
- **MIDIcurator, Workspace** — stopped emitting a `runtime` event nothing
  received.
- **Vane, DrawnQurve, PitchFold** — build now probes `$JUCE_PATH` and
  `$CLAP_JUCE_PATH` instead of fetching private copies.
- **`suite-build`** — reports what actually passed per repo, and no longer
  claims `--ladder` ran on Linux (it is macOS-only; it had been reporting OK for
  seven repos having validated nothing).

---

## 3. The test list

Reusing [A11Y_TEST_PLAN](A11Y_TEST_PLAN.md)'s reporting shape: **expected is
written before testing**, observed is free text, any row may be skipped. "Weird
flicker bottom left" is a better report than a forced pass/fail — two bugs this
month were found exactly that way.

**In a DAW** (and in Standalone, which is not the same thing — the standalone
has no host transport).

### Serpe — poly, the big one

| # | Try | Expected | Observed |
|---|---|---|---|
| 1 | `E(3,8)/E(3,7)`, play | two lanes, 8 and 7 steps, drifting apart, realigning every 56 | |
| 2 | `E(3,8)%2/E(3,7)` | lane 1 rotates each trigger; lane 2 never moves | |
| 3 | `E(3,8)*3/E(3,7)` | lane 1 grows 8→11→14; lane 2 fixed | |
| 4 | `E(3,8)\|E(5,8)/E(3,7)` | lane 1 alternates two scenes; lane 2 fixed | |
| 5 | Same, trigger by **MIDI note** instead of Tick | identical behaviour | |
| 6 | Same, trigger by **Tick** | identical behaviour | |
| 7 | Watch the lane panel while playing | rows and playheads follow what you *hear* | |
| 8 | `E(7,16)>16/E(1,17)>17` | both lanes accepted and transforming | |

Row 7 matters more than it looks: the panel used to draw the typed text, so it
could look right while sounding wrong, or vice versa.

### Serpe — progressive phase (the change in §1.1)

| # | Try | Expected | Observed |
|---|---|---|---|
| 9 | `E(3,8)%2`, trigger 5× by MIDI | base, rot2, rot4, rot6, back to base | |
| 10 | Same by Tick | identical | |
| 11 | `E(3,8)*3`, trigger 4× | 8, 11, 14, 17 steps | |
| 12 | `E(1,8)>8`, trigger until full | fills one onset at a time, then returns to base | |
| 13 | **Does base-first feel right?** | no expected answer — an opinion is the deliverable | |

### Every plugin — stamps and staleness

| # | Try | Expected | Observed |
|---|---|---|---|
| 14 | Open each plugin, find the build stamp | two stamps, and they agree | |
| 15 | If they disagree | that is a real finding; report the two values | |

### DrawnQurve — because of §1.2

| # | Try | Expected | Observed |
|---|---|---|---|
| 16 | Confirm the installed build is today's (stamp) | current | |
| 17 | Direction control | works exactly as before the emit was removed | |

### Host-specific, untested anywhere

| # | Try | Expected | Observed |
|---|---|---|---|
| 18 | Save a session with a poly pattern, close, reopen | pattern and lane state restored | |
| 19 | Poly under host transport, start/stop mid-pattern | lanes resume coherently | |
| 20 | Automate/record the Tick parameter | advances once per edge, not repeatedly | |
| 21 | Two instances in one project | independent state | |
| 22 | AUv3 on iPadOS | loads and plays | |

Rows 18–22 are the ones I would expect to break. Nothing in this window tested
session persistence, transport interaction, or multi-instance, and the poly
runtime state is new.

---

## 4. Known, already filed — please don't spend time re-finding

> **First DAW session done 2026-08-01 — read
> [SERPE_DAW_FINDINGS](SERPE_DAW_FINDINGS_2026-08.md) before testing further.**
> Five findings. The one that made every progressive result non-reproducible
> (process-wide progressive state, F1/F1a) is **fixed as of 2026-08-01** —
> progressive state is now per instance and per lane, and it is saved with the
> project. If you tested a progressive pattern before that and it behaved
> erratically, that result says nothing about the current build: please re-test
> rather than trusting the old note.

- **~~Accents are dropped entirely in poly lanes.~~ Fixed 2026-08-01 — and an
  accent belongs to ONE lane.** Poly lanes played flat until this fix (deliberate
  v1 scope, which this document should have said before Alex found it in Logic).
  They now accent like mono. **What to expect when you retest:** a brace binds to
  the lane it is written in, because `/` binds loosest — so
  `{1001010}E(5,8)/E(1,17)>17` accents **lane 1 only**, not both lanes. Write
  `{101}E(3,8)/{11}E(3,7)` to accent each. That is a decision, not an oversight
  (INTENT §D8); if it reads wrong in practice, that is worth telling us, but
  "lane 2 has no accents" on the string above is correct behaviour.
  Each lane's accents land on **that lane's own note** (its `Lane N Note`),
  transposed by `accentPitchOffset` — see the next item.
  In the **browser**, poly accents are drawn and played but do not yet precess
  across cycles the way the plugin's do, so a layer like `{10}` on a 5-onset lane
  will disagree with the plugin from the second cycle on. The plugin is right.
- **An accent is a different note number**, not only a louder one:
  `accentPitchOffset` defaults to **+5**, so an accented onset on note 36
  arrives as **note 41**. If your drum kit has nothing at 41, accents go silent
  while the MIDI is correct.
- **Polymeter is the `Poly Lock` parameter set to `Step`.** The default,
  `Cycle`, is polyrhythm — every lane spans the same cycle. Both work; the
  default is just the less interesting one.

- **Mono `%N` on an older build sits frozen.** Fixed 07-31 (`852ec88`). If you
  are on an earlier binary you will see it; check your stamp first.
- **`--ladder` does nothing on Linux.** macOS-only (auval, xcodebuild). It now
  says so instead of reporting OK.
- **`msuite jam` does not exist**, though three docs mention it.
- **`workspace` has never had an accessibility audit** — it postdates both a11y
  documents. It is also the most likely app to have a keyboard problem: a
  document-level listener binds bare `]`, `[` and `m`, guarded only against text
  fields. **If you use a screen reader, please try this early** — whether it
  steals keystrokes is unknown.

---

## 5. Roadmap, where testing would move it

Ordered by how much a tester's answer would unblock.

1. **Is poly's representation right?** Lanes currently draw as stacked rows.
   `polyView: 'circle'` (concentric rings) exists and renders, and nobody has
   decided which suits lanes of different lengths. A tester's reaction decides
   INTENT H4 — no code needed to have an opinion.
2. **Should the trigger index be visible?** Neither the phase question nor the
   frozen-`%N` bug would have survived ten minutes if the panel showed
   *"trigger 3 · rotated 6"*. Currently the most valuable small UI addition.
3. **`msuite jam`** — everything it needs exists (`generate`, `render`, `bind`,
   the control bus, per-lane poly). It is composition, not new capability. What
   is missing is a decision about what it *does*.
4. **Accessibility, for real.** The automated sweep is clean; the manual plan —
   screen reader, keyboard-only, magnification, cognitive load — has never run.
5. **The UI-side dataflow probe** (stage 3). Until it exists, every
   `ui<->binary` channel reports `NEVER_EXERCISED`. Those lines are **not**
   passes, and the report says so deliberately.
6. **Linux validation ladder** — `pluginval` and `lv2lint` both build there.
   Linux plugins have never been through one.

---

## 6. Decisions wanted soon

Each of these is currently blocking on judgement, not work.

| # | Decision | Why now |
|---|---|---|
| D1 | **Does base-first sound right?** | Shipped on principle without a listening test. Reversible cheaply *now*; expensive once sessions are saved against it. |
| D2 | **Stacked rows or concentric circles for poly lanes?** | Both exist. Choosing lets the other be removed instead of maintained. |
| D3 | **What does `msuite jam` do?** | The name has outlived several answers. Three docs promise it. |
| D4 | **Should `>N` cycle back to the base after reaching the target?** | It does, for live use. Nobody has said whether that is right or merely incumbent. |
| D5 | **Is the queue-full fallback allowed to bypass transforms?** | Open from the census. Rare, but silently wrong when it happens. |
| D6 | **Does MIDIcurator's `state` channel earn its keep?** | Emitted, unread. Either wire it or delete it. |
| D7 | **Exquisite Fingerings as a plugin?** | The archetype makes it cheap. Nobody has said what it is *for* inside a DAW — that is the blocker, not the build. |

D1 is the one with a deadline attached, and it is the one a tester settles.

---

## 7. What I would not trust yet

Stated plainly, because a test plan that implies confidence it does not have is
worse than none:

- **Nothing here has been heard.** All verification is automated: 1,664 JS tests,
  134 conformance vectors, 11 poly vectors + scheduling, 134 microtiming checks,
  a precedence harness and two headless probes. Every one of those can pass while
  the result sounds wrong to a person — and did, for hours, on 07-28.
- **No session-persistence, transport or multi-instance testing** exists for the
  poly runtime state, which is the newest and most stateful thing in the window.
- **`USE_CASES` U1–U7** have not been re-verified since 2026-07-15.
- **The training plan's musician ladder** has never been walked by someone who
  did not already know the suite.
