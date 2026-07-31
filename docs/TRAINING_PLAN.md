# Training plan — how someone learns this suite

*Written 2026-07-31, filling the `MASTER_PLAN` §2.4 stub. Two audiences, kept
apart on purpose: a person who wants to make something, and a person (or agent)
who wants to change the code.*

## What this is not

Not a feature tour. A feature tour teaches the menu, and the menu is not the
point — [INTENT](INTENT.md) B3 says the concepts here are learned by hearing and
doing them, not by reading them first. Every rung below is therefore **a thing
you do that makes a sound**, followed by what to notice.

Not a course to complete, either. B2 is playfulness as a requirement, and a
ladder you must finish in order is the opposite of that. Rungs are ordered by
what they assume, not by obligation — skip freely, and the "go off-road" rung is
deliberately reachable from anywhere.

The existing docs are reference. This says **in what order they become useful.**

---

## Part A — the musician's ladder

Each rung: what you do · what to notice · where it goes wrong.

### A0 — Make one sound, having installed nothing
Open any app at `https://enkerli.github.io/music-suite/apps/<name>/`. Nothing to
install, no account, and your work stays in your own browser
([suite-guide](content/suite-guide.md) opens with exactly this, and it is the
right opening).

**Notice:** the tools are separate small things, not one big thing.
**Goes wrong:** WebMIDI is desktop-Chromium-only. In Safari or Firefox the apps
should still work without MIDI — if one dead-ends instead, that is a bug worth
reporting, not your setup.

### A1 — One idea, heard before it is explained
Type `E(3,8)` in Serpe and play it. That is a Euclidean rhythm — three onsets
spread as evenly as eight steps allow — and it is the tresillo you have heard a
thousand times.

**Notice:** you were not told the maths first. You heard a familiar rhythm and
*then* learned it had a name and a formula. That order is the whole brief (B3),
and it is why this is rung one.
**Then:** change 3 and 8 and keep playing. `E(5,8)`, `E(7,16)`, `E(2,5)`.

### A2 — The same thing written several ways
`E(3,8)` is also `10010010`, also `0x94`, also a ring of eight dots with three
lit. [NOTATION_SYSTEMS](NOTATION_SYSTEMS.md) is the map; the editorial goal
there is one value shown in all its forms.

**Notice:** the leftmost digit is the *first* step, and that holds all the way
down into the hex digits — which is why tresillo is `0x94` and not what you
might expect from other software. It is a deliberate rule about direction
(INTENT D1), not a quirk.
**Goes wrong:** if you have used pattern software that puts the first step in
the low bit at the right-hand end, your instinct will fight this. The rule is
consistent; the instinct is the thing to retrain.

### A3 — Something that changes as you play it
Type `E(3,8)%2` and trigger it repeatedly. Trigger 1 is `E(3,8)` exactly as you
typed it; each trigger after that rotates by two steps. `E(3,8)*3` grows
instead. `E(1,8)>8` fills in.

**Notice:** the pattern is no longer *a* pattern — it is a pattern per trigger,
and you are now playing a process rather than a loop. This is the first properly
smidgen-ish rung (INTENT B1): the machine goes partway, you decide when it moves.
**Goes wrong:** nothing known, as of 2026-07-31. Until that day mono `%N` and
`*N` did not advance on MIDI note-in *or* on Tick — only from the editor — so if
you are running an older build and a rotating pattern sits frozen while you
play, that is the bug and not your typing. Fixed in Serpe `852ec88`.

### A4 — Two things at once, each on its own clock
`E(3,8)/E(3,7)` — two lanes, eight steps against seven, realigning every 56.
Add `|` for a scene chain inside a lane.

**Notice:** the lanes do not lock to each other, and that is the reason to write
poly at all (INTENT D4/D5). Two scenes against three realign every six triggers,
not every one.
**Then:** `E(3,8)%2/E(3,7)` — one lane drifting under a fixed one.

### A5 — Not generating what you would have heard anyway
Deliberately break your own habits: a prime number of steps, a Morse pattern
(`M:CQ`), a rhythm you would never choose. Keep what surprises you.

**Notice:** the tools propose; you dispose (INTENT B2). The goal was never
plausible output — it is output worth deciding about. **A lucky mistake is a
result, not a failure**, and this rung exists to give you permission before you
need it.

### A6 — Where it goes next
Two directions, either order:
- **Into an instrument** — the plugins (Serpe, Vane, DrawnQurve, PitchFold,
  MIDIcurator, Progression Studio, Workspace) run inside a DAW.
- **Into a pipeline** — the `msuite` CLI: `chord`, `pattern`, `upi`, `generate`,
  `smf`, `style`, `accompany`, `render`, `send`, `voice-split`, `bridge`,
  `play`, `recv`, `bind`, `describe`. Verified against the CLI's own dispatch,
  2026-07-31.

### A7 — Cross-tool, once the pieces are familiar
[USE_CASES](USE_CASES.md) U1–U8 are the worked examples. They assume the
individual tools, which is why they are last and not first.

**Honest note:** U1–U7's "reality today" claims have not been re-verified since
2026-07-15. U8 (two rhythms at once) is current.

---

## Part B — the contributor's ladder

Also for agents. The gap the stub named was "a single index that says start here
for X" — this is it.

| Rung | Do | Doc |
|---|---|---|
| B0 | Read what the suite is *for* before what it does | [INTENT](INTENT.md) §B |
| B1 | Pick up in-flight work | [HANDOFF](../HANDOFF.md) |
| B2 | Build everything once | [BUILD.md](../BUILD.md) |
| B3 | Learn the house rules | [CONVENTIONS](../CONVENTIONS.md), per-package docs |
| B4 | Change one thing, prove it | the differential tests, below |
| B5 | Learn what is decided and must not be "fixed" | [INTENT](INTENT.md) §D |
| B6 | Learn how we know things | [DATAFLOW_AUDIT](DATAFLOW_AUDIT.md), §L |

**B4 in detail**, because it is the rung that carries the others. A change to
pattern behaviour is not done until both engines agree:

```bash
npx vitest run packages/upi
```

and, in the Serpe repo, `serpe_conformance`, `serpe_poly_conformance`,
`serpe_microtiming_conformance`, `serpe_poly_precedence`, `serpe_dataflow_probe`.

The engine is authoritative (D3) and the JS is a subset, so **a fix that lands
on one side only reopens a divergence.** That is not hypothetical: it happened,
it took a session to close, and it is why the vectors are taken from the C++
rather than hand-written.

### The three lessons worth teaching directly

Compressed from [INTENT](INTENT.md) §L, because a newcomer will otherwise learn
each one the expensive way:

1. **Names are a hypothesis; traces are evidence.** Every bridge bug found this
   month was found by recording what moved. None by reading code.
2. **"Never exercised" must never read as "works."** A count of zero and a pass
   look identical unless a tool insists on the difference.
3. **When the UI and the engine disagree, suspect the UI's build.** Four "the UI
   is broken" reports in two days; none was the parser.

---

## Part C — accessibility is part of onboarding, not a separate track

INTENT B6: the documentation should work as a welcome *and* leave room for
unplanned exploration. Concretely, for this plan:

- **A0 must be reachable keyboard-only.** If it is not, that is a training-plan
  bug, not a user problem.
- **A1's "hear it first" assumes hearing.** The same rung needs a seeing/reading
  path — the pattern as bits, as a ring, as a count — which A2 already provides
  and should be presented as an equal route, not a consolation.
- **A5 asks people to make deliberate mistakes**, which needs a visible undo and
  a safe sense that nothing breaks. That is a cognitive-accessibility property,
  and it is untested.

**Status, plainly:** [A11Y_AUDIT](A11Y_AUDIT.md) is automated (axe) and was
clean on the ten apps of 2026-07-11. [A11Y_TEST_PLAN](A11Y_TEST_PLAN.md) is the
manual counterpart — screen reader, keyboard-only, magnification, cognitive
barriers — and **has not been run**. `workspace` has been through neither and is
the most likely to have a keyboard problem.

Until that testing happens, Part C is a statement of intent. It is written here
anyway so the gap is visible in the plan rather than absent from it.

---

## What is missing, named rather than implied

- **A0–A2 have no screenshots or audio.** A ladder about hearing things that
  ships as text is only half a ladder. Nine site screenshots are already
  outstanding in the doc-audit findings.
- **`msuite jam`** is described in PRIORITIES and does not exist ([INTENT](INTENT.md) H1).
  A5 is where it would belong, and its absence is felt exactly there.
- **No rung teaches the corpus work**, because the corpus is never published
  (D7) and only derived statistics ship. What a learner *can* do with
  MIDIcurator's curation side is unwritten.
- **Part A has never been walked by a person who did not already know the
  suite.** Everything above is reasoned from the docs and the code. That is the
  same evidentiary weakness §L warns about, and the fix is one session with one
  newcomer, taking notes.
