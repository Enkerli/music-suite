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

- ✅ **A — engine (`express.ts`)** *(shipped 2026-07-20)*: variety · passing
  tones · mixed gate · pocket · pass/morph, as one seeded post-articulation
  stage; `groove()` and `msuite accompany` grew the matching options/flags.
  Committed vector pins pass 0 AND pass 3 under morph. All defaults off →
  every prior vector regenerates byte-identically (verified).
- ✅ **B — live players** *(shipped 2026-07-20)*: the Workspace groove
  player takes a pass→phrase function, rebuilt from live knob state at
  every loop boundary (a throwing rebuild keeps the last good take);
  ProgGenie's "→ Workspace" button publishes the canonical `progression`
  message on the cross-tab bus, and the GloriArp module adopts it —
  mid-loop, next pass.
- ✅ **C — MIDIcurator capture & library** *(shipped 2026-07-20)*: "☆ learn
  clip as style" (extractPhrase over the clip + its leadsheet/detected
  chord), persistent local style list resolved alongside the bundled four,
  the expression knobs + a "take" (pass) number in the panel. Import of
  external phrase JSON: `msuite accompany --source path.json` today;
  file-drop into the panel is queued below.
- **Later (recorded, not started)**: statistical learning over a corpus of
  captured phrases (the brief's phase 4+ — distributions, morphing between
  styles); CC-ramp expression during held notes for Vane; coupled-walk
  multi-part pocket; MIDIcurator realtime MIDI-in → accompany.

## 3c. Shipped 2026-07-19 — learning + wind articulation

- **StyleModel** (`model.ts`): per-slot statistics learned from any number
  of takes against one chord — incremental (`addTake` is O(events), the
  co-learning path: keep playing, keep teaching), sampled per (seed, pass),
  statistics-only serialization (source clips never leave the machine).
  `msuite style learn <clips…> --chord Bb7 -o model.json`; `accompany
  --source model.json` samples a fresh take per `--pass`. `readSmfNotes`
  (midi pkg) ingests real clips from any DAW. Verified against the
  14-clip Funkastic B♭7 corpus.
- **Inflect stage** (`inflect.ts`, `--inflect 0..1`, workspace knob): every
  note gets its own articulation + breath envelope — sforzando bite/swell,
  staccato puff, legato slurs (conjunct+connected joins; attack 0 inside =
  no re-tonguing via Vane transient-gain), phrase-final marcato, ghosts.
  Envelopes travel as CC2 curves in the .mid, timed CC over --midi-out,
  and `env`/`attack` fields on bus note messages that `applyVaneNote`
  renders into the worklet (this supersedes queue item 5 below).
- MIDIcurator "learn clip as style" bug fixed (leadsheet chords carry no
  pcs arrays; now derived from the quality dictionary).

Next after this: per-articulation Vane COLOR (bite/growl/embouchure nudges
per note, not just breath + transient); StyleModel capture of articulation
statistics (learn the corpus's slur/ghost habits, not just velocity);
MIDIcurator UI for style-model learning (currently CLI-only).

## 3d. Shipped 2026-07-20 — polyphonic MIDI (EP comping), JSON import, parity

- **Polyphony through the whole engine**: `extract.ts` clusters simultaneous
  notes into "hits" and tags each with a `voice` id (bottom-to-top,
  positional — honest about its limit: a voicing that adds/drops a note can
  relabel which line is "voice 1"); chromatic-approach detection follows
  each voice's OWN temporal chain, so simultaneous chord tones are never
  misread as approaching each other. `bass.ts`'s leap-guard continuity is
  now keyed PER VOICE (a `Map`, not one scalar), so a comping phrase's
  stack reharmonizes and voice-leads as independent lines — root stays
  root, 3rd stays 3rd, register never merges — and the adapter preserves
  the source's own `role` instead of hardcoding "bass". `inflect.ts`'s slur
  detection now requires real forward motion AND same-voice continuity
  (the old check trivially "joined" simultaneous notes since their gap is
  negative) — chord stabs never get a false legato across voices.
  `model.ts`'s StyleModel learns a PER-VOICE vocabulary per slot (`SlotStats
  .voices`) and samples a full chord per hit, not one pooled note. Every
  change is purely additive: a voiceless (monophonic) phrase/model takes
  the exact legacy code path, confirmed byte-identical against the
  committed vectors (regenerated, zero diff) — comping cost nothing for
  bass. New `packages/accompaniment/src/comping.test.ts` (12 tests) covers
  extraction, adaptation, inflect, and StyleModel learn/sample over a
  synthetic EP-comping corpus; verified again end-to-end via the CLI
  against two real polyphonic .mid clips (three-note Dm7 stabs) — the
  sampled/adapted take holds a 3-note chord at every hit, voice-led
  correctly across Dm7 | G7 | Cmaj7 | A7, with per-note articulation and
  zero false slurs.
- **JSON import**, closing the last one-way door: the workspace GloriArp
  module and MIDIcurator's GrooveGenerator panel both gained "⬆ import
  .json" — a phrase.json or style-model.json (CLI output, another
  surface's export) drops straight into the style list and samples/plays
  like anything bundled (`looksLikeModel` dispatch, same as the CLI's
  `accompany --source`). MIDIcurator's import is durable (localStorage,
  alongside learned styles) and paired with `exportStyleJson` for the
  round trip; the workspace's is session-local (documented tradeoff).
  MIDIcurator also gained `learnStyleModelFromClips` (several clips → one
  StyleModel, refusing a chord mismatch by name) and `importStyleFromJson`
  /`exportStyleJson`, and `learnStyleFromClip` now tags a polyphonic clip's
  role "comping" outright (polyphony beats the register heuristic).
- **Parity confirmed**: `--inflect` and StyleModel sampling now reach
  MIDIcurator's `generateGrooveClip` (previously CLI/workspace-only gaps).
  Vane's breath envelope doesn't ride MIDIcurator's `Note[]` clip format
  yet (no CC/envelope field) — `inflect`'s duration/gate shaping does
  (audible via plain note durations), noted honestly rather than silently
  dropped. Plugin shells (workspace-plugin) need no changes at all: they
  esbuild `apps/workspace` at build time, so this arc reaches them on the
  next rebuild — confirmed nothing in `plugin-shells/` hardcodes a feature
  list.

## 3e. Shipped 2026-07-20 — per-dimension morph (continuous mutation, item 5)

The Troublemaker/Rozeta Bassline ask (docs/KNOWLEDGE_TRANSFER.md item 5):
a loop that mutates continuously along INDEPENDENT dimensions instead of
regenerating wholesale. Two real gaps closed:

- **`morph` was one blanket rate** for both variety (note choice) and
  pocket (timing/dynamics) — no way to hold one steady while the other
  wanders. `express.ts`'s `draw()` now takes the rate PER CALL SITE;
  `morphNotes`/`morphPocket` set it independently, `morph` remains a
  blanket alias (sets both when the specific ones aren't given) — byte-
  identical to the old behavior whenever only `morph` is used (a dedicated
  test pins `morphNotes=morphPocket=morph` against `morph` alone).
- **`rests` (skip-step) was completely pass-invariant** — `articulate()`
  never received `pass` at all, so the SAME steps dropped on every single
  loop repeat regardless of anything else morphing. New `morphRests` (+
  `pass`) makes WHICH steps drop wander across passes, using the exact
  three-stream discipline (stable/per-pass/gate) express.ts already
  established, sharing its `passSeed` helper (now exported). `morphRests`
  0/undefined reproduces today's stable rests exactly — purely additive,
  confirmed against the committed vectors (zero diff) and by explicit
  byte-identity tests.

Both reach `groove()` (`GrooveOptions` gained `morphNotes`/`morphPocket`/
`morphRests`, `pass` now actually flows into `articulate()` — it didn't
before), `msuite accompany` (`--morph-notes`/`--morph-pocket`/
`--morph-rests`, smoke-tested against the real CLI), and MIDIcurator's
`GrooveClipRequest`/`generateGrooveClip` (data layer only). 6 new engine
tests (express.test.ts, index.test.ts) + 2 MIDIcurator integration tests —
1373/1373 monorepo.

**Deliberately NOT done** (at the time): no new UI knobs in the workspace
module or MIDIcurator's GrooveGenerator — this item's own KT entry says
"design-pass involvement for the UI," so the existing single `morph` knob
stays as the UI surface (now correctly an alias for all three dimensions)
rather than me inventing a three-knob layout unreviewed. "accents" and
"slides", the KT doc's other two named dimensions, were deferred to a
separate slice — see §3f, now shipped.

## 3f. Shipped 2026-07-20 — accents + slides (item 5, the last two dimensions)

The remaining two Troublemaker/Rozeta-style dimensions from item 5.
Neither needed a new concept from scratch — both reuse machinery
`inflect.ts` already had:

- **Accents** = pass-aware wandering of inflect's own EXISTING discretionary
  articulation choices (sforzando-vs-marcato above metric weight 0.75,
  staccato-vs-tenuto below it), not a separate "accent" model. New
  `morphAccents` (0..1) re-rolls those choices — and slide promotion (below)
  — per pass, using the same three-stream (stable/per-pass/gate) discipline
  as `morphNotes`/`morphPocket`/`morphRests`, keyed off the same exported
  `passSeed`. `morphAccents` 0/undefined reproduces the exact stable choices
  — byte-identical, confirmed against the committed vectors (zero diff).
- **Slides** turned out not to need pitch-bend curve math at all: reading
  Vane's actual DSP (`vane-dsp.cpp`) showed it already glides automatically
  on any note-change that arrives while the previous note's breath is still
  flowing (a connected/legato transition) — the ONLY missing piece was ever
  posting a nonzero `glide-time` (wasmId 10, 0..2000ms). So the whole feature
  is: mark which legato transitions get promoted (new `slide` 0..1 = the
  probability an eligible `legato-inside`/`legato-end` transition carries a
  `glideMs`, default 120ms), then post that value through every consumer:
  Vane's bus params (`apps/vane/control.js`), the `.mid` writer via standard
  MIDI portamento CC5 (time)/CC65 (on/off) (`pipeline.ts`), and CLI rawmidi
  the same way (`midiout.ts`). `NoteInflection` gained `glideMs?`,
  `NoteBody` (protocol) gained validated `glideMs?`.
- **Stateless-per-note discipline**, applied everywhere glide is posted:
  never trust a receiver's persistent portamento state to carry over
  correctly between notes — always explicitly (re)set it per note,
  including an explicit OFF/0 for non-slide notes, so a slide never leaks
  into an unrelated later transition. Vane's `glide-time` is a persistent
  synth param, so `control.js` posts it even when 0; the `.mid`/rawmidi
  writers emit CC65=0 explicitly whenever a slide note is followed by a
  non-slide note.

Reaches `groove()` (`GrooveOptions` gained `morphAccents`/`slide`/
`glideMs`), `msuite accompany` (`--morph-accents`/`--slide`/`--glide-ms`,
smoke-tested against the real built CLI: generated a take with `--slide 0.7`
and confirmed real CC5/CC65 bytes in the `.mid`; generated the same take at
`--pass 0` vs `--pass 1` with `--morph-accents 1` and confirmed the MIDI
differs; confirmed `--pass` alone with no `morphAccents` still reproduces
byte-identical output — backward compat holds), and MIDIcurator's
`GrooveClipRequest`/`generateGrooveClip` (data layer only, same boundary as
`inflect` itself — glide time doesn't ride the `Note[]` clip format yet).
11 new engine tests (inflect.test.ts, incl. 2 groove()-level CC5/CC65
tests), 3 new `apps/vane/control.test.js` tests, 3 new `midiout.test.ts`
tests — 1391/1391 monorepo, zero vector diff.

**Deliberately NOT done**: no new UI knobs (same design-pass deferral as
§3e — `morphAccents`/`slide`/`glideMs` are data-layer only). Vane's actual
glide behavior is untested by ear/real audio — this container has no audio
device; the CC5/CC65/glide-time wiring is verified structurally (bytes
posted, correct order, correct values) but never heard.

## 3g. Planned — progression-learned styles (voice leading across chord changes)

**The ask (Alex, 2026-07-21):** style-learning was Alex's original reason
to start curating MIDI files, and every path to it today — CLI
`msuite style learn` AND MIDIcurator's own "Learn" button
(`learnStyleFromClip`/`learnStyleModelFromFamily`, wired into
`MidiCurator.tsx`) — only ever learns from clips all played against ONE
chord. Learning from a realized chord *progression* instead would also
capture the transitions between chords — voice leading and passing notes
being the most audible part of that — which single-chord learning can
never see by construction.

**Correcting the premise first: this was never CLI-only.** Both learning
paths already share one engine (`@enkerli/accompaniment`), and MIDIcurator
has had its own "Learn" UI since `learnStyleFromClip`/
`learnStyleModelFromFamily` shipped (§3c) — the CLI verb is a second,
scriptable front end onto the same code, not the primary one. What's
actually true is narrower and more specific than "CLI-only": **every
model is locked to one `FrameChord`.**

Where that lock actually lives, traced end to end:
- `StyleModel.frame: FrameChord` (`model.ts`) — one chord, not a sequence.
- `ExtractOptions.frame: FrameChord` (`extract.ts`) — extraction takes one
  frame; `relate()` computes each note's chord-relation against it alone.
- `learnStyleModelFromClips` (`gloriarp-clip.ts:245`) hard-throws if two
  clips in a batch don't share the same chord symbol — the gate that
  makes "one chord per corpus" a rule, not just today's usage pattern.

**The good news: the raw material for the multi-chord version already
exists, just not wired together.**
- Clips already carry a real chord *sequence*, not just one symbol —
  `clip.leadsheet.bars` (`types/clip.ts`), populated from Apple Loops
  import or MIDIcurator's own progression-clip generator
  (`generate-clip.ts`'s `generateProgressionClip`). The "MIDI file +
  its leadsheet" pairing Alex described is already how clips work.
- `phrase.ts` already defines `HarmonicFrame { start, end, chord }` — a
  timeline of chord-spans — but nothing constructs an array of them from
  a clip today; every real call site still builds exactly one `FrameChord`
  and hands it to `extractPhrase` as a scalar.
- `relate()`'s per-note logic is already local to one span (chord-tone /
  extension / scale-tone / chromatic-approach against whichever frame
  it's given) — slicing a clip's notes per `HarmonicFrame` and calling the
  existing single-chord path once per span is close to free. **What's
  genuinely new is the boundary:** today "next" for approach-tone
  detection is cyclic *within* one frame; nothing classifies a note's
  relation to the *upcoming* chord at a change point. That boundary
  relation — common tone retained, stepwise resolution up/down, leap,
  suspension carried over the barline — is the actual voice-leading
  signal Alex is after, and it doesn't exist anywhere in the schema yet.

**Shape of the work, sized honestly, additive over refactor (same
discipline as this session's other schema-adjacent changes — old
single-chord phrases/models must keep working, byte-identical, not get
migrated):**

1. **Schema**: give `AccompanimentPhrase`/`StyleModel` a `frames:
   HarmonicFrame[]` timeline as an alternative to today's singular
   `frame` (schema v2, additive — a v1 phrase is just a v2 phrase with a
   one-element timeline, no data migration needed, exactly the discipline
   `MODEL_SCHEMA_V`/`PHRASE_SCHEMA_V` already exist to support).
2. **Extraction**: `extractPhrase` slices notes per span from the clip's
   own `leadsheet`, runs the existing `relate()` once per span (no change
   to that function), then adds a new boundary pass: for notes within N
   ticks of a chord change, compute a second relation against the
   INCOMING chord and classify the transition (retained / step / leap /
   suspension). New field, additive to `ChordRelation` or a sibling
   `transition?` on `PhraseEvent` — never overwrites the existing
   single-frame relation.
3. **StyleModel slots**: today a slot is keyed by raw `(bar, beat,
   grid-position)` against one recurring chord shape. For a progression,
   slots need to key by `(chordSpanIndex, grid-position-within-span)`
   instead, so sampling can walk the SAME progression back out — plus a
   small transition table (keyed by chord-quality-pair or scale-degree
   movement, same accumulable-counts shape as `SlotStats`) capturing
   voice-leading tendencies specifically at boundaries.
4. **`learnStyleModelFromClips`'s gate** changes from "every clip must
   share one chord" to "every clip must share one progression" — checked
   against each clip's own `leadsheet`, which already exists; no new
   input format needed.
5. **Surfaces**: MIDIcurator's existing "Learn" button already operates
   on `clipFamily` — when the selected clip's leadsheet has more than one
   distinct chord, that's the natural trigger to learn a progression style
   instead of demanding one `--chord`. CLI gets the mirror:
   `style learn ... --leadsheet file.txt` alongside today's `--chord`.
6. **Sampling**: `samplePhrase` needs to walk a target progression's own
   span sequence when regenerating (today it samples against the one
   frame it was built from) — this is where the existing chord-relative
   encoding pays off, since each span's relation already survives
   reharmonization; the new part is sequencing spans correctly and
   pulling boundary-transition stats in near chord changes.

**Not started.** This is a real schema extension plus a genuinely new
inference category (voice leading has no existing analog to lean on the
way accents/slides reused `inflect.ts`), not a small slice — closer in
size to §3d (polyphonic comping) than to §3e/§3f. Worth its own session
rather than folding into the next-session queue below.

## 3b. Next session queue (prep, 2026-07-20)

By-ear verification first — everything below shipped agent-verified only
(tests + vectors + builds; no ears here):

1. **BROWSER_TEST §10/§11 re-run** with the new knobs: does `pocket` 0.4
   actually feel like push/pull rather than sloppiness? Does `morph` 0.5
   over a looping funk-ghost evolve without losing the plot? Does the
   ProgGenie "→ Workspace" handoff land mid-loop? Does a learned clip
   style generate something that sounds like its source's feel?
2. **Tune the pocket constants by ear** — walk step (±7ms·pocket), anchor
   decay (0.7/0.4/0.15), accent-lean gain, the ±18ms cap: all chosen by
   reasoning, all in one place (`express.ts`), all awaiting a listener.
   Same for variety's probability split (0.4 passing / 0.25 octave / 0.3
   reselect).
3. **Style-pack growth**: generate candidate source phrases with local
   models against §4's contract; validate via `msuite accompany --source`;
   the keepers join `vectors/` (CC0) or the local library. A file-drop
   import in MIDIcurator's panel would smooth this (small slice).
4. **Comping role next** (PRIORITIES §2.6): the first polyphonic role —
   the EP-comping ask lands here; `voice` is already in the event schema.
5. **Vane CC-ramp expression**: swells during held notes (player-side CC2
   ramps in the workspace player + `--play`'s MIDI path).
6. **Coupled pocket**: when the groove/drum role or Serpe poly lanes join,
   share the walk term across parts — the real Keil interaction.

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
