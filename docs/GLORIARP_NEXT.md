# GloriArp next arc — from proof-of-concept to living grooves

*2026-07-20, from the user's field verdict: "The funk groove is quite decent
and I want to get more of these." The proof-of-concept holds; this note
captures the whole requested direction, decides what each piece means
concretely, and fences the slices. The engine-first rule stands: every
musical behavior lands in `@enkerli/accompaniment` so CLI, Workspace,
MIDIcurator, and (via SMF or WebView) the plugins get it identically.*

## 1. The asks, verbatim → concretely

| Ask | Concrete form | Slice |
|---|---|---|
| More variety | `variety` knob: octave displacement, chord-tone reselection, **passing tones** on weak beats (the schema's `passing-tone` category, until now unused by generation) | A |
| Morphs over loop repeats | `pass` + `morph`: the pipeline takes a loop-pass index; `morph` (0..1) is the fraction of variety/pocket decisions re-rolled per pass. Same (seed, pass) → identical take, always | A |
| Mix of legato & separate notes | `gate: "mixed"` — per-note, data-driven: legato into stepwise motion, detached on repeated notes, ghosty on the cracks. Not a global factor | A |
| More dynamics | pocket-coupled micro-dynamics (push slightly softer, lay-back slightly heavier) on top of the existing metric-contour `dynamics` | A |
| Passing tones | see variety — they reuse the adapter's neighbor machinery and are labeled `passing-tone` in the trace | A |
| **Microrhythm à la Keil** | See §2 — the design correction this note exists to record | A (v1) |
| Expression via Vane | Velocity already drives Vane's CC2 breath on every path; pocket+dynamics now shape velocity per-note and per-pass, so Vane breathes with the take. CC ramps *during* held notes = follow-on (player-side) | A / later |
| Real-time tweaks (end of loop) | Players regenerate EVERY pass from current knob state: turn a knob mid-loop, the next pass plays it. No stop/regenerate | B |
| ProgGenie → GloriArp directly | ProgGenie publishes the canonical `progression` message on the suite bus; the Workspace GloriArp module listens and adopts it at the next pass (`formatLeadsheet` already converts) | B |
| More styles, incl. via local models | The source-phrase JSON contract is documented (§4) and validated (`validatePhrase` / loading errors are honest); `msuite accompany --source path.json` and the MIDIcurator style list accept external files. Data-only, as observed | C/docs |
| **Learn from grooves I feed it** | v1 = *curated capture*, not statistics: MIDIcurator's "learn this clip as a style" runs `extractPhrase` (which has existed since slice 1 — this was always the plan) over a clip + its leadsheet chord, and the result joins the style list. Honest inference: chord tones/approaches get confidence, the rest stays `unclassified` | C |
| All patterns in a library | Learned styles persist (MIDIcurator local store, exportable as phrase JSON = the same contract external tools write). `@enkerli/library`'s `phrase` kind is the envelope | C |

On the name: "source" is the brief's term for the *curated phrase a groove is
generated from* (vs. the generated take). "Style" is what the UIs call it.
Both stay; the UIs' word is the human one.

## 2. The Keil correction — recorded as a design decision

The `@±ms` / `@±1/64` notation (Serpe Poly) is a **capture format** for a
feel that already exists — good for writing down a discrepancy, wrong as the
*model* of where discrepancies come from. Keil's point is that participatory
discrepancies arise from **interaction**: push and pull between parts, being
in the pocket *with* something. A fixed offset from the grid is exactly what
groove is not.

So the engine's `pocket` stage models timing as interaction, at the depth
currently possible:

- a **correlated walk**, not i.i.d. jitter: each onset's lean carries into
  the next and resolves — push accumulates, then gives (tension/release in
  time, the push/pull);
- **anchoring at strong beats**: the walk decays hard toward the grid at
  downbeats (the pocket is *held* against the pulse, not floated);
- **accent coupling**: dug-in (high-velocity) notes lean late and heavy;
  light notes ride ahead — timing and dynamics are one gesture, so the walk
  drives small velocity deltas too;
- per-pass re-roll under `morph`, so the feel *lives* across repeats instead
  of looping a frozen take.

**Limit, stated honestly:** with one part playing, the only things to
interact with are the pulse and the phrase's own accent structure. True
inter-part discrepancy (bass dragging against a pushing kick) becomes
possible when the groove/drum role lands (PRIORITIES §2.7, Serpe Poly
lanes) — the pocket stage's walk is deliberately shaped so a second part's
walk can be *coupled* to it then (shared drift term). That is the road to
"in the pocket" as a relation, not a number.

## 3. Slices

- **A — engine (`express.ts`)**: variety · passing tones · mixed gate ·
  pocket · pass/morph, as one seeded post-articulation stage. New committed
  vector + tests; all defaults off → existing vectors byte-identical.
- **B — live players**: Workspace groove player regenerates per pass
  (knob changes and bus-received progressions apply at the loop boundary);
  ProgGenie gains "→ suite bus" publish of the current progression.
- **C — MIDIcurator capture & library**: "learn this clip as a style"
  (extractPhrase), persistent local style list in the GloriArp panel,
  export/import as phrase JSON.
- **Later (recorded, not started)**: statistical learning over a corpus of
  captured phrases (the brief's phase 4+ — distributions, morphing between
  styles); CC-ramp expression during held notes for Vane; coupled-walk
  multi-part pocket; MIDIcurator realtime MIDI-in → accompany.

## 4. Source-phrase JSON, for humans and local models

A style is one JSON file: an `AccompanimentPhrase`
(`packages/accompaniment/src/phrase.ts`, schema v1, validated by
`validatePhrase`). The committed CC0 styles
(`packages/accompaniment/vectors/source-*.json`) are the reference examples.
Essentials for a generator (human or local model):

- `v: 1`, unique `id`, `role` (`"bass"` today), `ticksPerBeat` (use 480),
  `meter`, `lengthTicks` (bars × meter.numerator × ticksPerBeat);
- `events[]`: `onset`/`duration` in ticks, `velocity` 1–127, `note` (MIDI),
  and — the part that makes adaptation musical — `chordRelation` per event:
  `category` (`chord-tone` with 1-based `degree`, or `chromatic-approach`
  with `target` = the event index it resolves to, cyclic), against
  `harmonicFrames` declaring the chord the phrase was played over;
- what you don't annotate, mark `unclassified` — the adapter treats honesty
  better than guesses.

Check a file: `msuite accompany --source my-style.json --progression
"Dm7 | G7" -o /tmp/check.mid` — loading errors name the offending field.
