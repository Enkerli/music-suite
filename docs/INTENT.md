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

Entries are not tickets. They close only when the question stops being live,
and several will stay open for years — which is fine, and worth seeing.

---

## D — Decisions that are settled, and must not be "fixed"

These have all been re-litigated at least once by someone who did not know
they were decisions. Each says what it is, why, and what breaks if reversed.

### D1 — Leftmost bit is the LSB
`0x94` is tresillo: `10010010` reading left to right, with the **first** step in
the least significant bit. Hex and octal digits are little-endian too, so
`0x1:4` is `1000`, not `0001`.

**Why:** a rhythm is read left to right in time, and a pattern's first step
should be its first digit. The alternative puts the downbeat at the far end of
the number.

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
