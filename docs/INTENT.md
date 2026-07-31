# Intent — decisions, and the ideas picked up along the way

*Started 2026-07-30, at Alex's asking: documentation should be about **intent**,
not only "roadmap as a project pathway" — the decisions made along the way, and
"things we pick up like hitchhikers".*

A roadmap says where we are going. A changelog says what changed. Neither says
**why this and not the obvious alternative**, and that is the thing that gets
lost first and costs the most to rediscover. Three times this month someone
(usually me) "fixed" a deliberate decision because nothing recorded that it was
one.

## How this differs from the neighbouring docs

| Doc | Answers |
|---|---|
| [MASTER_PLAN](MASTER_PLAN.md) | what we are doing, in what order |
| [PRIORITIES](PRIORITIES.md) | what is worth doing next, and at what cost |
| [USE_CASES](USE_CASES.md) | who it is for, and what they can actually do |
| **INTENT** (this) | why it is like this, and what we are still chewing on |

Read in four parts: **B** is the brief the whole thing serves, **D** are
settled decisions, **H** are ideas parked mid-flight, **L** are lessons about
method. B is the part that cannot be recovered from the code.

Entries are not tickets. They close only when the question stops being live,
and several will stay open for years — which is fine, and worth seeing.

---

## B — The brief

*Added 2026-07-30, from Alex. The D-entries below are choices; this is what
they are choices **in service of**. It is easy to keep the decisions and lose
this, and then the suite still works and is no longer the same thing.*

### B1 — Smidgen: semi-generative musicking
**Smidgen** is the name for the whole practice. Alex, 2026-07-30:

> Smidgen is my nickname for **semi-generative musicking**.

It is a portmanteau — se**m**i-**gen**erative — and it carries both halves of
the brief in one word:

- **semi-**generative: the machine goes partway and stops. Not automatic music
  (B3); a proposal that a person answers.
- **musick*ing***: a verb, not a noun. The thing being supported is the
  *activity* — playing, trying, listening, deciding — not an output file. This
  is the same claim as theory-through-practice (B4), from the other side.

The word arrived on its own in two places before anyone defined it: as a
candidate name for what shipped as `@enkerli/accompaniment`
([GLORIARP_BRIEF](GLORIARP_BRIEF.md), a *"semi-generative accompaniment
system"*), and as MIDIcurator's name for its wishlist tier — *"Tier 4 —
Wishlist / Future (smidgen territory)"* ([PLAN](../apps/MIDIcurator/PLAN.md)).

That second use is the interesting one. "Smidgen territory" for the wishlist
means the speculative pile is not junk — it is where the semi-generative ideas
wait. The word does double duty, and both duties are this brief.

**Corrected twice on 2026-07-30**, which is why it is spelled out here: I first
wrote smidgen as *"a control whose unit is a smidgen"*, then as *"a small
speculative amount"* — reading the ordinary English word off the page and
guessing. It is a coinage. Alex had to say so.

### B2 — Playfulness is a requirement, not a garnish
Exploration, experimentation, lucky mistakes, "what if". Going away from what
is generic, expected, common. This is how smidgen (B1) is actually practised.

**What this rules out:** the sensible-default reflex. When a choice is between
"the thing everyone does" and "the thing that might surprise someone", the
brief says the second is at least as valid, and needs no further defence.

**What it does not license:** breaking things, or hiding what a control does.
Playful is not careless. A surprising *result* is the goal; a surprising
*failure* is still a bug.

### B3 — Not to generate what you would have heard anyway
The point is not automatic music. It is inspiration, curation, and hearing
something unexpected — then choosing. The suite proposes; a person disposes.

**Why it matters for design:** it moves the quality bar off "is the output
good" and onto "is the output *worth listening to and deciding about*". A tool
that reliably produced pleasant, ordinary results would have failed this brief.

### B4 — Theory through practice
The concepts are learned by hearing and doing them, not by reading them first.
A pitch-class set is a thing you rotate and listen to. Euclidean rhythm is a
thing you watch land on the beat.

### B5 — Explainability, *especially* for the weird parts
Much of what is under the hood is unfamiliar — Euclidean/Bjorklund, pitch-class
set theory, corpus statistics, Morse, binary/hex pattern encodings. That is a
reason to explain more, not to hide it behind a preset. Nobody should have to
already know the maths to use the thing, and nobody should be prevented from
finding out what it is doing.

The test: can a user get an answer to "why did it do that?" without reading the
source? Where they cannot, that is a gap, whatever else is finished.

### B6 — Accessibility as welcome, not as compliance
The commitment is a real analysis with practical tests — screen reader,
keyboard-only, magnification — and explicit attention to **cognitive** barriers,
which no automated tool reports.

Documentation carries the same double duty: it should work as onboarding for
someone arriving cold **and** leave room for unplanned exploration. Those pull
against each other, and the resolution is not to pick one.

Status, honestly: [A11Y_AUDIT](A11Y_AUDIT.md) is automated and was clean on the
ten apps of 2026-07-11. [A11Y_TEST_PLAN](A11Y_TEST_PLAN.md) is the manual
counterpart and **has not been run**. `workspace` has been through neither.

### B7 — "Workspace", not "playground"
*Playground* is overused, and it undersells this by implying nothing is at
stake. What the suite actually offers is closer to a **workspace** — a place
with your materials out, where work happens and play is how the work gets done.
That the app named Workspace is a cross-app control surface is an accident of
naming; the word is doing the more important job elsewhere.

---

## D — Decisions that are settled, and must not be "fixed"

These have all been re-litigated at least once by someone who did not know
they were decisions. Each says what it is, why, and what breaks if reversed.

### D1 — Leftmost bit is the LSB
`0x94` is tresillo: `10010010` reading left to right, with the **first** step in
the least significant bit. Hex and octal digits are little-endian too, so
`0x1:4` is `1000`, not `0001`.

**Why:** *consistency of direction*, held strictly. A rhythm is read left to
right in time, so the first step is the first digit — and then that same rule is
carried all the way down, through hex and octal digits too, without an exception
anywhere.

Alex's own framing (2026-07-30), worth keeping in his words rather than mine:

> There's an analogy to date formats and even address formats. Go in a single
> direction: stick to it. Small to big or big to small doesn't matter.
> Consistency does.

Left-to-right specifically, because that is the reading direction in French and
English — **left is the first step, in a scale or in a beat**.

The honest part: the notation systems this carries through are themselves rarely
used elsewhere, and where they *are* used, they never apply this principle, at
least not as strictly. That inconsistency in the wider world is precisely what
bothered Alex enough to make this a rule here.

**If reversed:** every hex/octal/decimal pattern in every doc, test vector and
saved session silently means something else. Reverted once already (2026-06-22,
`ee70bef`/`b09dec1`) — the revert is what made it a decision rather than a bug.

### D2 — Structural (enharmonic-correct) note spelling
D♯ and E♭ are different notes and stay different.

**Why:** the suite is about theory literacy. Collapsing them is the single
change that would make every chord name subtly wrong for the people most likely
to notice.

**If reversed:** chord symbols stop agreeing with the leadsheets they came from.

### D3 — The engine is authoritative; the UI is a view
For anything the C++ can parse, the raw text goes to the engine and the engine's
answer is what the display shows. The JS parser is a subset and always will be.

**Why:** two parsers cannot be kept in step, and the one that makes sound should
win.

**Consequence, and it bit hard:** the UI can reject a string the engine plays
perfectly. That cost hours on 2026-07-29 with `E(7,16)>16/E(1,17)>17`. The fix
is never to gate the engine on the JS parse — it is to make the UI stop
claiming authority it does not have.

### D4 — `/` binds loosest in UPI
A top-level `/` means parallel lanes. Scenes `|` and progressive `%N *N >N` all
belong to a *lane*.

**Why:** it is the only reading under which a chain on a lane means anything
different from a chain on the whole string — and lane independence is the reason
to write poly at all. Decided 2026-07-28 after the two engines had quietly
disagreed for months (SERPE_POLY §2.5).

### D5 — Lanes advance their chains independently
Two scenes against three realign every six triggers, not every one.

**Why:** same as D4. Lockstep would collapse poly into mono with extra syntax.

### D6 — Progressive `%N` and `*N` start one step in
The first trigger of `E(3,8)%2` is already rotated by 2; `E(3,8)*3` is already
11 steps. The un-transformed base is never heard.

**Why:** it is what the engine has always done, and the engine is authoritative
(D3). The JS reference disagreed until 2026-07-30 and was moved to match.

**Open question underneath it:** is that the *right* behaviour, or just the
incumbent one? Showing the base first would be defensible. Nobody has argued
for it out loud, so it stands.

### D7 — The jazz corpus is never published
Only derived statistics ship. The corpus stays local and gitignored.

---

## H — Hitchhikers: ideas picked up along the way, not yet homed

Things noticed while doing something else, worth keeping, not yet worth a plan.

### H1 — `msuite jam` *(picked up 2026-07; still wanted, 2026-07-30)*
A CLI verb for the playflow-presets lens: one command that starts a musical
situation rather than producing one artifact. Described twice in
[PRIORITIES](PRIORITIES.md) §0/§5 and never implemented — the doc audit found
it as a command that does not exist.

Alex, 2026-07-30: *"an idea we should pick up again."* The interesting part is
that everything it would need now exists — `generate`, `render`, `bind`, the
control bus, per-lane poly. It is composition, not new capability.

**Open:** what does `jam` *do* when it lands — start a bus session, or print a
starting pattern set, or open the workspace with a preset loaded? The name has
outlived several answers.

### H2 — Continuous morphing between accompaniment patterns
Raised in the 2026-07-19 bulk triage. Not started. Would use the same
"derive state from a trigger index" trick that made progressive notation pure
(`progressive.js`), which is a hint that it is smaller than it looks.

### H3 — MIDIcurator variants × GloriArp
Two systems that both produce alternates of a phrase, unaware of each other.
Nobody has yet written down what the combination *is*, which is why it keeps
being deferred.

### H4 — Serpe concentric circles
A visual idea from 2026-07-19: poly lanes as nested rings rather than stacked
rows. `polyView: 'circle'` exists in the app and renders; whether it is the
*right* representation for lanes of different lengths is untested with anyone.

### H5 — Exquisite Fingerings as a plugin
Currently webapp-only. The archetype makes it cheap. Nobody has said what it
would be *for* inside a DAW, which is the missing piece, not the build.

### H6 — A Linux validation ladder
`--ladder` is macOS-only (auval, xcodebuild). Linux plugins have never been
through one. `pluginval` builds on Linux and `lv2lint` exists, so the rungs are
available; found 2026-07-30 when a Linux `--ladder` run reported OK for seven
repos having validated nothing.

### H8 — The draft blogpost, becoming a series *(2026-07-30)*
Alex has an incomplete draft post covering most of the suite in one pass —
DrawnQurve, ProgGenie, the Chord Dictionary, MIDIcurator/GloriArp, Vane
(expression, tuning, MTS-ESP, Robby Kilgore chording), the `msuite` CLI, Serpe,
PitchFold, Exquisite Fingerings, Workspace — plus two sections that are not
about the tools at all: *The Vibes* (vibecoding, and what it costs) and *The
Project* (MTILT).

Likely to become a series rather than one post. It is listed here because it is
currently the only place several framings exist in Alex's own words, and because
a series would need the same thing this file needs: the *why*, not the feature
tour. Whatever it becomes, the ideas in it should land in B above rather than
living only in a draft.

**Open:** one post per tool, or one per idea? The draft is organised by tool,
and the interesting material is not.

### H7 — Splitting the processor from the plugin target, properly
Done narrowly on 2026-07-30 (`createEditor` moved out) so a headless probe
could link the engine without the UI. The broader version — a real engine
library every target consumes — was deliberately not attempted then.

---

## L — Lessons that changed how we work

Not decisions about the product; decisions about method, each bought with time.

### L1 — Names are a hypothesis; traces are evidence
Every bridge bug this month was found by recording what moved, and none by
reading code. The grep-based audit needed 46 false positives beaten out of it
before its 3 real findings were trustworthy. See
[DATAFLOW_AUDIT](DATAFLOW_AUDIT.md).

### L2 — "Never exercised" must never read as "works"
`polyState` was emitted, handled, and unsubscribed for weeks. A count of zero
and a pass look identical unless a tool insists on the difference. Both the
dataflow audit and `SceneCompare` were built specifically around this.

### L3 — When the UI and the engine disagree, suspect the UI's build
Four "the UI is broken" reports in two days: a race, a stale bundle, a panel
reading the wrong source, and a missing subscription. **None** was the parser.

### L4 — A build step that silently does nothing does not fail a build
DrawnQurve installed no plugin for three weeks; `--ladder` validated nothing on
Linux; a WebUI bundle went two days stale. All three reported success.

### L5 — Two copies of a rule will drift
The `*N` numeric guard existed three times and one copy lacked it. The queue
race was fixed for mono and not for scenes. Vane and DrawnQurve answered the
same install question in opposite directions.

### L6 — A verdict is a lead, not a proof
The audit's first real finding — DrawnQurve's `setDirection` — was correctly
detected and wrongly interpreted by me: the feature worked, via a parameter.
Confirm what a name carries before concluding anything about behaviour.

---

## How to add to this

Add an entry when you notice yourself explaining *why* something is the way it
is, or when you park an idea you do not want to lose. Say what it is, why, and
what would break if it changed. If it is still open, say what the open question
is — an entry that pretends to be settled is worse than none.
