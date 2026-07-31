# Progressive phase — where a chain starts, and the options

*2026-07-30. Written because Alex said starting `%N` one step in "sounds fine
though it makes me a bit nervous" and asked to hear the options.*

> **DECIDED, same day: option B — base first, everywhere.** Alex: *"I'd be more
> comfortable with bare base. Can it be consistent across all versions, for all
> notations?"* It can, and it now is. Shipped in Serpe `430413e` (engine, probe
> and precedence harness) and the monorepo commit alongside it (JS reference and
> vectors), deliberately together — a one-sided change reopens the divergence
> closed on 2026-07-30.
>
> `%N`, `+N` and `*N` moved; `>N` already behaved this way. Six edit points, and
> the full conformance suite plus 146 JS tests pass. The options below are kept
> as the record of what was weighed, not as live choices.
>
> **Found on the way, and not fixed here:** mono `%N` and `*N` never advance on
> MIDI note-in. Pre-existing — proven by stashing the phase change and watching
> the old code sit equally frozen one step in. Filed separately.

## The nervousness is well placed, but slightly off-target

The question sounds like *"should `%N` start one step in?"* Having read both
implementations, the sharper question is **why the three progressive operators
disagree with each other**:

| Operator | Trigger 1 gives you | Base heard? |
|---|---|---|
| `%N` offset | already rotated by `N` | **no** |
| `*N` lengthen | already `base + N` steps | **no** |
| `>N` transform | the bare base | **yes** |

Verified 2026-07-30 on both sides, not inferred:

- **Engine** — `PluginProcessor.cpp:1864`, `progressiveOffset = newStep;` with
  the comment *"Start with first offset"*.
- **JS** — `packages/upi/src/progressive.js`: offset returns
  `rotate(base, step * idx)` with `idx` clamped to a minimum of 1; lengthening
  loops `for (i = 0; i < idx; i++)`; transform loops `for (i = 1; i < idx; i++)`.
  One of these is not like the others, and the difference is a single character.

Nobody chose this. It is the residue of three code paths written at different
times, and it survived because each is self-consistent and no doc put them in a
table next to each other. The module's own docstring asserted that trigger 1 is
always the base — true of one branch, false of the two directly beneath it.
Corrected 2026-07-30.

**So the real risk is not the convention. It is that there isn't one.**

---

## The options

### A — Leave it exactly as it is
Document the split (done, above and in INTENT D6) and move on.

- **For:** zero risk. Every saved session, doc example, test vector and habit
  keeps meaning what it meant. The behaviour has shipped for months and nobody
  has reported it as a bug — including Alex, whose reaction was "sounds fine".
- **Against:** the suite now has a documented inconsistency it chose to keep.
  Every future reader spends the same ten minutes I did. It is also awkward
  against explainability (INTENT B5): "why did it do that?" has no answer here
  beyond "history".

### B — Base first, everywhere (`%N` and `*N` move to match `>N`)
Trigger 1 is always what you typed; the transform starts at trigger 2.

- **For:** the strongest single principle available — **what you typed is what
  you hear first**. It is the explainable rule, it needs no table, and it makes
  the notation self-describing: `E(3,8)%2` starts at `E(3,8)`.
- **Against:** it is a real behaviour change to the engine, and every pattern in
  every doc, test and saved session shifts by one trigger. The `%N` family is
  also where the *motion* is the point — a user who types `%2` wants movement,
  and B spends the first trigger not moving.
- **Cost:** engine change + JS change + regenerate conformance vectors. The
  differential tests (`serpe_conformance`, `serpe_poly_conformance`) are what
  make this tractable rather than terrifying — they will show every difference.

### C — Base never, everywhere (`>N` moves to match `%N`/`*N`)
The opposite consistency: the transform always starts one step in.

- **For:** consistent, and cheaper than B — it changes one operator instead of
  two, and it is the convention the majority already follow.
- **Against:** it is consistency achieved by making the *least* explainable
  option universal. `E(1,8)>8` no longer starts at `E(1,8)`. Hard to defend to a
  newcomer except by pointing at the other two operators.

### D — Make it explicit in the notation
Keep both behaviours, let the pattern say which — a leading marker for "start at
the base", so `E(3,8)%2` is unchanged and (say) `E(3,8)@%2` starts at the base.

- **For:** nothing breaks, and it turns an accident into a feature. Fits the
  suite's habit of putting the choice in the text rather than in a preferences
  pane.
- **Against:** **more notation to learn for a problem the user did not have.**
  UPI's surface is already the steepest thing about Serpe, and this adds a
  sigil to serve an edge case. It also does not resolve the inconsistency — it
  makes it configurable, which is the classic way of not deciding.

### E — A setting
A global "progressive chains start at the base" toggle.

- Listed for completeness, and **recommended against**. It makes every pattern's
  meaning depend on hidden state, which breaks the thing that makes UPI worth
  having: a pattern string means one thing, anywhere, including in a doc. It
  would also make the conformance tests ambiguous.

---

## Recommendation

**A now, B if it survives listening.**

Not because A is right — because the honest state is that nobody has *heard*
the difference, and this is a musical question wearing a software question's
clothes. The arguments above are all arguments from principle, and the suite's
own brief (INTENT B1: semi-generative musicking, B3: theory through practice)
says that is the wrong way to settle it.

There is a cheap way to actually decide, and it already exists.
`serpe_dataflow_probe` instantiates the real processor, runs a scripted session
offline, and writes **the MIDI it produced**. Point it at the same patterns
under both conventions and listen to the two files:

```bash
~/Documents/Coding/rhythm_pattern_explorer/build/serpe_dataflow_probe_artefacts/Release/serpe_dataflow_probe
```

Patterns worth putting through it, chosen to make the difference audible rather
than theoretical:

| Pattern | Why this one |
|---|---|
| `E(3,8)%2` | the plain case; does starting on the downbeat matter? |
| `E(3,8)%8` | rotation equal to length — under B, triggers 1 and 2 are identical |
| `E(1,8)>8` \| `E(3,8)%2` | the two conventions inside one scene chain |
| `E(3,8)%2/E(3,7)` | two lanes, different lengths, drifting |

The third row is where I would expect a decision to arrive on its own. A chain
that switches convention mid-sequence is the case the current split makes
genuinely hard to reason about, and it is the one a person will hit while
playing rather than while reading.

**If B wins the listening test**, do it as one change across engine and JS
together, with the conformance vectors regenerated in the same commit — the
2026-07-30 work closed a JS/C++ divergence, and this is exactly the shape of
change that reopens one if it lands on one side only.

## What would make this decidable sooner

The trigger index is not currently visible anywhere in the UI. If the lane panel
showed *"trigger 3 · rotated 6"*, the phase question would have answered itself
long ago, and it is worth doing regardless of which option wins — it is the
explainability commitment (B5) applied to the exact place it is missing.
