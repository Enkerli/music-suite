# ProgGenie — open design questions

Companion to `DESIGN_BRIEF.md` and the "UX Critique & Recommendations" build
sequence (steps 01–06, all shipped). These are the decisions deliberately left
for the design pass — each was flagged in code as a *design-form
interpretation* and shipped with a pragmatic interim so the engine could land
without pre-empting the designer.

For each: the **decision** needed, **why it came up**, what **ships today**,
and the **coding output** once it's decided (with a rough size). Nothing here
blocks current use; these refine surfaces that already work.

---

## Q1 · The write cursor & ghost chip (step 04)

**Decision.** Where does live MIDI land in the document, and how does the held
chord appear before it's committed? Should the write cursor be **movable** (tap
a slot to aim the next played chord) and should the ghost chip render **inline
at that slot** between cells, rather than below the sheet?

**Why.** Step 04 says "the leadsheet grows a write cursor; the held chord shows
as a ghost chip *at the cursor, inside the document*." We shipped the honest
minimum without reworking the editor's cell layout.

**Ships today.** The write cursor = the end of the sheet (where appends land).
The ghost chip renders in the document panel *just below* the leadsheet, with
Add / Clear / an inline options disclosure. Functionally complete, just not
positioned between cells.

**Coding output if movable + inline.** The editor gains a persistent cursor
position (caret-index state); renders a ghost cell at that index; MIDI-confirm
inserts there and advances the cursor. ~Medium (editor render + state). If the
answer is "append is fine," no change.

---

## Q2 · Modulation: per-section keys & labels (Track C — key changes)

**Decision.** When the progression modulates, should the sheet show **the new
key's own Roman labels** under a visible key-change marker (a ii–V–I in G reads
`IIm7 V7 Imaj7` beneath a "→ G" divider), or keep the current home-frame
spelling? This is the big one — it implies a **multi-section editor**, each
section with its own key, a key-change affordance, and (for free) named
sections (A / B / bridge).

**Why.** The brief's phrasing is "realization re-anchors `resolveDegree` per
section." True per-section labels need the editor to stop being single-section
/ single-key — the largest structural change in the backlog, and exactly the
kind of editor rework the design pass should own.

**Ships today.** Modulation is **real in the chords** (a section is transposed
to a corpus-common related key — dominant / subdominant / relative / up-a-step
— and sounds + exports as a genuine key change), but the labels are spelled in
the **home key** and the editor stays single-section. The data model's
`Section` type already carries an optional `key`.

**Coding output if per-section.** Editor reworked to iterate sections, realize
each against its own key, render a key-change marker/divider and a per-section
key control; generation keeps the new key's labels instead of re-spelling home.
~Large. Unlocks named sections and is the basis for fuller form editing.

---

## Q3 · Generator control organization

**Decision.** The generator has grown to four groups (Tune / Adventurousness /
Source / Sound) and **Source** now holds five controls (Engine, Context,
Start-from, Reharm, Modulation). Which of the "generation-depth" knobs
(Context, Reharm, Modulation, Variety/Freshness, Surprise) are **primary** vs
**advanced/disclosed**, and how should they be grouped and labelled?

**Why.** Each Track C feature added a control; placement has been pragmatic, not
designed. This is an information-architecture call.

**Ships today.** Flat placement; Source is crowded; "Sound" is the only group
behind an advanced disclosure.

**Coding output.** Re-grouping the `GenGroup` structure + which sit behind the
advanced disclosure — pure layout/labels, **low** coding cost. The value here
is the taxonomy decision, not the implementation.

---

## Q4 · Transition character marking (Track C — not yet built)

**Decision.** The exact visual encoding for diatonic vs circle-of-fifths
motion between chords. The brief says **colour + texture** — "underline
diatonic, arrow glyph for fifths, *never colour alone*." Need: the glyph set,
placement (between cells? under the chord?), dark-mode treatment, and density
(every transition, or only notable ones?).

**Why.** This is the one remaining Track C item, and it's purely visual — its
value is entirely in how it reads, so it needs the designer (and an on-device
look) before building.

**Ships today.** Not built — held for this decision.

**Coding output.** A per-transition classifier (diatonic vs fifths motion is
cheap theory) + render the markers per the spec. The classifier is **small**;
the render is **small–medium** once the encoding is pinned. No blockers.

---

## Q5 · Chord-scale surfacing in the inspector

**Decision.** How much of the chord-scale relationship should the inspector
show, and how? Today it's a single line ("Mixolydian · avoid F"). The theory
layer already returns the **scale, alternates, tensions, and avoid notes** — so
the question is presentation: text list, chips, or a small scale visualization
(the `@enkerli/ui` pcs-ring / pitch-row already exists). Pairs with the agreed
refinement to **prefer avoid-note-free scales** (Lydian over "Ionian, avoid 4").

**Why.** "Feeds tooltips here and PitchFold / exquisite-fingerings later" — the
inspector is the first surface, and how it reads sets the pattern.

**Ships today.** One-line text: primary scale + avoid notes.

**Coding output.** The data is already there; the inspector renders whatever
the design specifies (text, chips, or an embedded ring/row component).
**Cheap** once the layout is chosen.

---

## Q6 · Curation profile — filter-by-degree (step 05 leftover)

**Decision.** Profile-as-shape shipped (strongest boosts/suppressions + count,
full ledger one disclosure away). Is the power-user **filter-by-degree** surface
worth building — "everything into V7", "everything out of IIm7" — or is the
"All weights" disclosure enough?

**Why.** Flagged during step 05; the flat ledger gets unwieldy as weights
accumulate, but the summary may have already solved the common case.

**Ships today.** Profile summary + an "All weights (N)" disclosure listing every
tuned transition.

**Coding output.** A filter combo over the ledger (narrow by origin/destination
degree). **Small** if wanted.

---

## Appendix · Coding follow-ups (no design needed)

Tracked here so they're not lost; these are engineering, not design:

- **Passing-dim insertion in ProgGenie.** The substitution engine supports the
  passing-diminished rule (and it's vector-tested), but inserting a chord
  changes the slot count, so the rhythm plan must re-derive. Currently off in
  the app (count-preserving subs only). Medium.
- **MIDIcurator App Group inbox** (the live ProgGenie→MIDIcurator handoff).
  Scoped separately in `SUITE_AUDIT_AND_PLAN.md` §6 — provisioning + entitlement
  + shared inbox + ingest. Gated on the Apple developer account.
- **iOS signed build** keeps lapsing at provisioning (re-add the Apple dev
  account in Xcode → Accounts). Not a code issue.
