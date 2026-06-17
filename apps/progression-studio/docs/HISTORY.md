# Progression Studio — History & Roadmap

The story of how ProgGenie became what it is, and where it's headed. The
suite-wide plan of record is `SUITE_AUDIT_AND_PLAN.md` (a local-only repo); this
is the narrative.

---

## 1. A generator looking for a home

ProgGenie began as a **seeded Markov generator**: walk the transition statistics
of 2,611 imaginary-book jazz lead sheets, realize the resulting degree labels in
any of 17 keys with proper structural spelling, voice them with taxicab voice
leading, and play them back. Early additions made it musical rather than
mechanical — a **temperature** knob (how far down each transition's probability
list to reach), **channel-split** voices, **chord-follow** highlighting, and
**SMF export**. The hard rule from day one: the corpus lead sheets are never
published — only the derived statistics.

Then came **ear-driven curation**: per-transition weight multipliers over the
immutable corpus counts. You could say "this change sounds good" or "this whole
progression's a bit meh," and the generator would lean accordingly —
deterministic per (seed, profile), exportable as a JSON profile. Curation
quickly became the strongest, and messiest, use case.

## 2. Joining the suite

ProgGenie stopped being a standalone toy and became one app in a **monorepo**
("music-suite") with a shared **"paper & ink"** design system and shared,
framework-agnostic packages. The keystone was a single **`Leadsheet` /
`Progression` type** in `@enkerli/theory` — suddenly the generator's output,
MIDIcurator's clips, and MIDI files were all the same object. A **shared
leadsheet editor** followed, plus a **ChordID** MIDI-input path (play a chord,
it's identified and added) and **voice-led voicing suggestions**. The app also
became a real **AUv3 MIDI processor** and **standalone**, the same web bundle in
a JUCE WebView, validated through auval / pluginval / signed iOS.

## 3. The leadsheet-first redesign (UX critique, steps 01–06)

A Claude Design critique reframed everything around one diagnosis: ProgGenie
flattened **three different objects** — the progression (the artifact), the
generator (a patch), and the profile (curated taste) — into one toolbar, so the
most important thing had no home. The fix, built as a six-step sequence:

1. **Editing coherence** — between-chord insertion carets, a chord inspector,
   direct-manipulation move/delete; tool-modes survive only for rating.
2. **Generator grouped** — the flat row became labelled groups; "Generate" →
   *New take*; **Patches** save/recall a settings set.
3. **Library & import** — the progression became a **document** with four front
   doors (New · Generate · Open · Import), backed by a localStorage library.
4. **MIDI input unified** — live MIDI writes into the document; the two-place
   flow collapsed to one.
5. **Curation summarized** — the profile shown as a *shape*, not a ledger, tied
   into the inspector's "why this chord."
6. **Send to MIDIcurator** — name the destination, not the file format.

## 4. Track C — generation depth

In parallel, the generator grew **theory-led depth**, each piece a pure,
vectored module:

- **Chord-scale relationships & avoid notes** — a structural classifier mapping
  each chord to its scale (maj7→Lydian, 7→Mixolydian, m7♭5→Locrian, …), with
  **avoid notes** computed structurally, **preferring the avoid-note-free
  scale**.
- **Substitution engine** — probabilistic tritone, backdoor, and passing-dim
  reharmonization over the label stream.
- **Key changes** — modulate to corpus-common related keys.
- **"Smart" generation** — a real **second-order (variable-order) Markov** model
  built from corpus **trigrams**, with back-off to the first-order table.

## 5. The design decisions (Q1–Q6) and beyond

A second design pass answered six open questions, and the build that followed
went well past them through tight iteration:

- **Q2 — multi-section keys.** Modulation became *real sections*, each
  re-anchoring `resolveDegree` to its own key, with a quiet seam divider.
- **Q3 — generator taxonomy.** Five groups by intent; "Sound" → **Voice**;
  depth knobs behind *advanced*.
- **Q5 — chord-scale pad grid.** The inspector's hero: an isomorphic pad grid
  (square = fourths, hex = Exquis) with roles by **shape + glyph, not colour**.
- **Q6 — filter-by-degree curation**, surfacing one functional ledger.
- **Q4 — transition-character overlay** (↝ fifths / underline steps, *notable*).
- **Q1 — the write cursor + inline MIDI ghost + press-and-hold move gesture.**

Then the most interesting thread: **implied modulation**. Rather than chopping
mechanically every N bars, *read the harmony* — detect ii–V–I / secondary-
dominant tonicizations and **re-spell** those spans in their own key, quietly,
inline, **mid-bar capable**, on generated **and pasted/imported** tunes alike.
Finally, **live playback**: a **now-playing card** follows the playhead, the
current chord's scale grid lighting in real time, with a "next up" preview — and
the standalone got its **Play button** back (it has no host transport).

The through-line never changed: **one document, everything else assists it.**

---

## Roadmap

Near-term, mostly captured in `SUITE_AUDIT_AND_PLAN.md` and
`DESIGN_QUESTIONS.md`:

- **MIDIcurator App Group inbox** — the *live* ProgGenie → MIDIcurator handoff
  (today it's a leadsheet-bearing `.mid` you open there). Needs a shared App
  Group container, entitlement wiring, an inbox dir, and a MIDIcurator ingest
  path. Gated on the Apple developer account; also fixes the standalone↔AUv3
  library split.
- **Implied modulation on imported tunes, surfaced.** Detection now runs on any
  displayed progression; the natural next step is a clearer entry point ("find
  the keys in this tune") and tuning the density on busy charts.
- **Passing-dim substitution in ProgGenie.** The engine supports it; inserting a
  chord changes the slot count, so the rhythm plan must re-derive.
- **Design round-2 UX bits** (`DESIGN_QUESTIONS.md`): first-class text entry,
  the functional/absolute toggle's placement/default, the now-playing card's
  always-on vs playback-gated behaviour and its position.

Longer-term, the suite's signature workflow — Progression Studio (harmony) →
MIDIcurator (curation) → Serpe (rhythm) → DrawnQurve (expression) → Vane (sound),
connected by MIDI in a host — plus the chord-scale grid paying forward into
PitchFold and exquisite-fingerings, and variable-order generation maturing off
the accumulating gesture-curation data.
