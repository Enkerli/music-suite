# ProgGenie — Design Brief for Claude Design

*Draft 2026-06-14. Purpose: ProgGenie has grown feature-rich but its UX has
**accreted, not been designed** — controls were added where there was room,
the leadsheet editor became a pile of tool-modes, and recent additions (the
insertion tool, chip density) feel messy. We want Claude Design to shape the
**overall experience**, not adjudicate yes/no choices. "Design is how it
works." This brief frames the problem around how people actually use ProgGenie
— five playflows — and the cross-cutting tensions underneath them.*

---

## What ProgGenie is

A jazz chord-progression **generator and leadsheet editor**. It runs as one
codebase in two shells: an **AUv3 plugin** (macOS + iPadOS, transport-synced
to a DAW) and a **web app**. It walks a Markov model over a corpus of **2,611
jazz lead sheets** (degree-labelled transitions), realizes the result into a
key, voices it (taxicab voice leading), plays it back, and exports it as a
Standard MIDI File carrying the shared `Leadsheet`/`Progression` object so
**MIDIcurator** and the rest of the suite can read it. It also takes **live
MIDI chord input**, identifies chords, and proposes voiceled continuations;
and it has an **ear-driven curation** layer that nudges the generator.

The user is a musician/teacher thinking *functionally* (Roman-numeral degrees)
as much as in absolute chords.

---

## The surfaces today (inventory)

**Generate row** (one long wrapping row of controls):
Key · Mode · Start-from · Engine (corpus walk / +cadence / circle-of-fifths) ·
Temperature (slider) · Channels · Voicing shape (close/open/drop-2/drop-3/
spread/rootless/shell) · Voice leading (none/loose/strict) · Bars · Harmonic
rhythm (1 beat … 4 bars / varied) · Variety (faithful/fresh/bold) ·
**Generate** · **+ Extend** · **Blank** · Copy chords · Export MIDI · theme ·
(Tempo, web only).

**Leadsheet panel** (the primary surface):
- A **tool palette**: ✏️ Edit · ⤵ Insert · 👍 · 👎. The active tool decides
  what a tap on a chord does.
- A **spreadsheet-style grid** of chord cells. Each cell shows the **functional
  degree on top, the named chord dimmed below**, plus a small **consonance
  dot**. A bar spans one column per chord (so bars align vertically); a chord
  held past a bar shows as a `%` repeat bar. One append **+** at the end, and
  **+ bar**.
- **Reset to generated** (when hand-edited).
- Curation: **👍 More like this / 👎 Bit meh**, and a profile bar
  (Copy / Save… / Load… / Reset all, with Replace/Merge on load).

**Other panels:** Progression shape (a piano-roll of the voiced output) ·
MIDI chord input (plugin) · Transitions in this progression · Corpus
statistics.

---

## The five playflows

For each: the user's **goal**, the **path today**, the **friction**, and the
**questions for Design**. The friction is the real input.

### 1. Use an existing progression
**Goal.** Recall or reuse a progression I already have (mine, or a standard).

**Today.** Barely supported. There's no progression library and no
"load a leadsheet" path yet. The closest things: the plugin restores the last
*parameters* with the DAW session (so it regenerates the same output), or you
retype the chords by hand. Curation *profiles* save/load, but a **progression**
does not.

**Friction.** The most common real-world entry point — "I have a tune, get it
in" — is essentially a dead end.

**For Design.** Where does a progression *library* live and how is it browsed?
How do you bring in a leadsheet (file? paste? single-line bar notation? MIDI)?
What's the relationship between "the library", "the current progression", and
"the generator"? Naming/metadata (title, composer, key, tags)?

### 2. Generate purely from parameters
**Goal.** Dial in knobs, generate, audition, iterate toward something I like.

**Today.** Set up to ~11 controls in the generate row → the leadsheet, shape,
and (in the plugin) the host clip update **live** as params change; **Generate**
bumps the seed for a fresh walk; **+ Extend** appends a continuation; play via
the host transport (plugin) or a Play button (web).

**Friction.**
- The generate row is **crowded and flat** — 11 controls with no grouping or
  hierarchy; no sense of which matter most or how they relate.
- **Conceptual overlap the user flagged:** Temperature and Variety do
  overlapping things (both increase surprise/variety). Two knobs, unclear
  division of labour.
- **"Generate" is ambiguous:** params already apply live, so what does the
  button *do*? (It re-seeds.) Is "generate" an action or a state?
- No way to **save/recall a parameter set** (a "patch").

**For Design.** Grouping/progressive-disclosure of generation controls; the
Temperature↔Variety relationship (merge? rename? one "adventurousness" axis?);
what "Generate" should mean when everything is live; presets/patches; how
audition fits (plugin transport vs web).

### 3. Build via MIDI chord input + suggestions
**Goal.** Play chords on a MIDI keyboard, have them identified, and grow a
progression by accepting voiceled suggestions.

**Today (plugin).** A **MIDI chord input** panel: play a chord → it's
identified and **latched** (held after release) → **Add chord** (locks the
voicing as played) · **completions** (a near-miss → the common chord) · **other
voicings**. Separately, the leadsheet's **+ picker** offers the held MIDI chord,
plus next-chord suggestions and a typed token, with autocomplete.

**Friction.**
- The flow spans **two places** (the MIDI panel *and* the leadsheet picker),
  with suggestions appearing in both — unclear where to look or act.
- "Play → it latches → find the button → add" has several beats; the
  relationship between *what I'm playing*, *what's identified*, and *the
  growing leadsheet* isn't visually connected.

**For Design.** Should live MIDI drive the leadsheet directly (a cursor that
"writes" chords as you play and confirm)? Unify where suggestions live. The
latch/hold model. How identification, completion, and voicing-choice present
without a wall of options.

### 4. Edit a leadsheet  *(the messiest — the trigger for this brief)*
**Goal.** Retype a chord, insert one mid-progression, reorder, control
duration, set a voicing.

**Today.** The **tool palette** model: pick a tool, then tap chords. Edit =
tap-to-retype. **Insert = tap a chord to splice a new one _before_ it** (cue: a
dashed left barline). 👍/👎 = rate the move into the chord. Append **+** at the
end; **+ bar**. Durations are **derived from each bar's chord count** (3 chords
→ half + quarter + quarter); the display stays count-based. Delete = retype to
empty. Voicings get locked via MIDI/suggestion adds.

**Friction (user's words: "it's all messy now").**
- **The insertion tool is confusing:** the dashed cue reads as a marker
  *between* chords/bars, but the action inserts *before* the tapped chord —
  the visual (a gap/insertion point) and the model (a chord-relative "before")
  don't match.
- **No reorder/move.** You can't move a chord; insertion was added as a
  partial substitute.
- **Mode-switching as the paradigm:** is "pick a tool, then tap" the right
  model for a leadsheet, or should editing be **direct manipulation** (tap a
  chord to edit; explicit between-chord insertion points; drag to move)?
- **Durations are implicit** — correct by convention, but there's no direct way
  to say "make this chord a whole bar" beyond changing how many chords share
  the bar.
- **Delete is hidden** (retype empty).
- **Voicing editing is indirect.**

**For Design.** The editing paradigm itself (tool-modes vs direct
manipulation vs inline affordances). A coherent **insert / move / delete**
model and its affordances (before/after, between-chord insertion points,
drag). How duration and voicing are shown and edited. All of it on **touch
(iPad)** as well as desktop.

### 5. Exchange data with MIDIcurator
**Goal.** Move a progression between ProgGenie and MIDIcurator.

**Today.** **Export MIDI** writes an SMF whose notes play in any DAW, with
per-chord markers, and the canonical `Progression` embedded as a text-meta
event; MIDIcurator **imports** it and recovers the leadsheet, re-anchored to
its key. It's a real round-trip, but **file-by-hand** and one-directional in
practice.

**Friction.** Interchange is invisible in the UI ("Export MIDI" doesn't say
"hand this to MIDIcurator"); no live link; the round-trip is a manual file
shuffle.

**For Design.** How is suite interchange *surfaced* (a "send to MIDIcurator"
affordance? a shared library? eventual live messaging)? How to make the
shared-object round-trip legible rather than a `.mid` on disk.

---

## Cross-cutting tensions (the system-level questions)

1. **Chip information density.** A chord cell already carries: functional
   label, named chord, consonance dot, rating tint, and (in modes) an insert
   target. With **suggestion rationale** (ii–V–I, tritone sub…) still to come,
   the cell is overloaded. What belongs in the cell vs. on demand?
2. **The tool-mode paradigm.** Edit / Insert / 👍 / 👎 as modes — clean, or a
   crutch that hides direct manipulation the surface should afford?
3. **Layout model.** We landed on a **spreadsheet grid** (uniform legible cells,
   count-based, bars align vertically) after rejecting both forced-equal and
   fully-proportional layouts. Does Design bless this, or is there a better
   notation-aware middle (durations are real but currently invisible in the
   layout)?
4. **Control placement & density.** The generate row is one flat crowded line.
   What's global vs per-progression vs per-chord? What gets progressive
   disclosure?
5. **Two shells.** AUv3 plugin (host-owned transport, no native
   dialogs/downloads, WKWebView font quirks, iPad touch) and web. The design
   must work in both, touch-first.
6. **Functional vs absolute.** Degrees and named chords are both first-class
   (the user thinks functionally). The current "functional on top / named
   below" is one answer; is it the right hierarchy everywhere?

---

## Constraints (so design works within reality)

- **AUv3 / WKWebView:** no `window.confirm/prompt/alert` (they're no-ops); no
  blob/data: downloads (they crash the page) — file save/open go through a
  native bridge; some glyph fonts are limited; transport is **host-owned**
  (the DAW's play button is the play button).
- **Touch + desktop:** iPad is a primary target.
- **Design system:** build on the shared `@enkerli/ui` components and `es-*`
  tokens (paper/ink palette, light + dark); don't invent a parallel system.
- **Data model:** the shared `Leadsheet`/`Progression` type — every chord has a
  **degree and/or absolute** view; **durations are derived from each bar's
  chord count** (metric division); multi-bar holds are **repeat (`%`) bars**;
  voicings can be **locked** per chord.
- **Privacy:** the corpus lead sheets are **never published** — only derived
  statistics. Nothing in the UI should expose or export source sheets.

---

## What we're asking for

Not a skin. A **coherent experience** across these five flows: how a leadsheet
is built, edited, generated, recalled, and exchanged — what the primary surface
is, how editing actually works (insert/move/delete/duration/voicing), how the
generation controls are organized, and how live MIDI and suggestions fold in —
designed for touch and desktop, within the constraints above.
