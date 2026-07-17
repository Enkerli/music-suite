# GloriArp / Smidgen Accompaniment
## Coding-agent and designer-agent brief

**Status:** exploratory architecture brief  
**Target repository:** `Enkerli/music-suite`  
**Working name:** **GloriArp**  
**Product framing:** a chord-aware, corpus-informed accompaniment capability within the Music Suite—not necessarily a separate application.

---

## 1. Assignment

Design and implement the smallest coherent foundation for a semi-generative accompaniment system that can:

- learn useful musical tendencies from a curated collection of MIDI phrases;
- generate grooves, basslines, comping patterns, and related accompaniment;
- remain inspectable, reproducible, and steerable;
- work headlessly through the existing `enkerli` CLI;
- participate in the Music Suite control and interop plane;
- preserve the identity of curated source material without merely replaying it;
- evolve patterns over time rather than producing disconnected random clips;
- optionally provide chord-aware expression and dynamic tuning.

Do **not** begin by building a large new application. First determine which capabilities belong in shared packages, which belong in MIDIcurator, and which are best exposed through existing tools and the workspace.

The initial implementation should be useful before any machine-learning model is introduced.

---

## 2. Product intent

The desired system is not a replacement for Band-in-a-Box, iReal Pro, Logic Session Players, EZkeys, MODO Bass, Scaler, Riffer, Piano Motifs, Tonalics, Funkastic, or Strum GS-2.

It is a Music Suite interpretation of several overlapping ideas:

- automatic accompaniment;
- a “glorified arpeggiator”;
- chord-aware rhythmic generation;
- curated pattern recombination;
- probabilistic continuation and extrapolation;
- gradual morphing between phrases;
- style learning from a small, deliberately selected corpus;
- performance-oriented control;
- transparent musical rules rather than opaque “AI magic.”

The distinctive value is the combination of:

1. **curation** rather than indiscriminate training;
2. **symbolic musical understanding** rather than raw-note imitation;
3. **continuity through time** rather than one-shot generation;
4. **interoperability** among the existing suite tools;
5. **reproducibility and inspectability**;
6. **expression and tuning informed by harmonic context**.

---

## 3. Architectural position

Treat GloriArp initially as a capability spanning existing tools.

### MIDIcurator

MIDIcurator should remain the principal place to:

- import and segment phrases;
- identify musical roles;
- correct inferred harmony and metric structure;
- tag, rate, reject, and group patterns;
- define source provenance;
- compare related phrases;
- inspect extracted features;
- audition generated variants beside their source material;
- promote useful generated results back into the curated library.

MIDIcurator is therefore the **corpus workbench and evaluation surface**.

### ProgGenie

ProgGenie provides:

- chord progressions;
- harmonic rhythm;
- Roman-numeral/function context;
- key and mode;
- voicing-related constraints;
- reproducible harmonic timelines.

ProgGenie is the initial **harmonic-context provider**.

### Serpe / `@enkerli/upi`

Serpe provides:

- rhythm representations;
- Euclidean and polygonal constructions;
- transforms;
- mutation;
- syncopation and pattern analysis;
- compact textual pattern input.

Serpe is a **rhythm source and rhythm-transform engine**, not necessarily the only rhythm representation used internally.

### PitchFold

PitchFold may provide:

- scale and pitch-collection constraints;
- live quantization;
- pitch-class folding;
- alternative harmonic permissiveness policies.

PitchFold is an optional **pitch-policy stage**, especially for live MIDI flows.

### Vane and other instruments

Vane can receive:

- note events;
- breath/expression curves;
- timbral control;
- tuning information.

It is an initial **expressive rendering target**, not part of the accompaniment engine itself.

### Control and interop plane

Use the existing suite protocol and transports for:

- progression input;
- chord updates;
- scale updates;
- pattern input/output;
- parameters;
- commands;
- CLI pipes;
- workspace communication;
- later cross-device or plugin-host routing.

Avoid inventing a second orchestration protocol.

---

## 4. Recommended package boundary

Create a shared, headless TypeScript package only when the model is clear enough to name.

Provisional package name:

```text
@enkerli/accompaniment
```

Alternative names worth considering:

```text
@enkerli/smidgen
@enkerli/pattern-model
@enkerli/phrase
```

Prefer `@enkerli/accompaniment` if the first public contract centers on producing role-specific accompaniment against harmonic context. Keep “GloriArp” as the feature/playflow name.

The package must be:

- framework-agnostic;
- deterministic when supplied a seed;
- importable from applications and CLI code;
- free of browser, DOM, WebMIDI, JUCE, and storage dependencies;
- backed by committed test vectors;
- able to serialize every meaningful intermediate representation.

---

## 5. Core data model

Do not train or generate directly from unstructured MIDI note arrays. Introduce a canonical symbolic phrase representation.

### 5.1 `AccompanimentPhrase`

Suggested shape:

```ts
interface AccompanimentPhrase {
  id: string;
  role: AccompanimentRole;
  lengthTicks: number;
  meter: Meter;
  source?: ProvenanceRef;

  events: PhraseEvent[];
  harmonicFrames?: HarmonicFrame[];
  features?: PhraseFeatures;
  annotations?: PhraseAnnotations;
}
```

### 5.2 Roles

Begin with:

```ts
type AccompanimentRole =
  | "bass"
  | "comping"
  | "groove"
  | "arp"
  | "melodic-fill"
  | "unknown";
```

Do not assume these roles use identical models. A bassline and a comping texture have different musical grammars.

### 5.3 `PhraseEvent`

Represent musical function explicitly:

```ts
interface PhraseEvent {
  onset: number;
  duration: number;
  velocity: number;

  note?: number;
  pitchClass?: number;

  chordRelation?: ChordRelation;
  scaleRelation?: ScaleRelation;
  voice?: number;

  articulation?: Articulation;
  expression?: ExpressionPoint[];

  sourceEventId?: string;
}
```

### 5.4 Chord-relative pitch representation

A generated phrase should be able to survive reharmonization and transposition. Store more than absolute MIDI pitch.

Candidate relation:

```ts
interface ChordRelation {
  degree: number;          // structural chord degree where applicable
  alteration: number;      // semitone alteration
  octave: number;
  category:
    | "chord-tone"
    | "extension"
    | "scale-tone"
    | "chromatic-approach"
    | "passing-tone"
    | "neighbor-tone"
    | "enclosure"
    | "suspension"
    | "anticipation"
    | "pedal"
    | "unclassified";
}
```

The first implementation need not infer every category perfectly. It must preserve uncertainty rather than invent certainty.

### 5.5 Harmonic timeline

```ts
interface HarmonicFrame {
  start: number;
  end: number;
  chord: CanonicalChord;
  key?: KeyContext;
  scale?: PitchCollection;
}
```

Use existing canonical chord, progression, spelling, and PCS types wherever possible. Do not duplicate theory primitives.

### 5.6 Feature vector

Features should be musically legible:

- onset pattern;
- duration pattern;
- accent pattern;
- density;
- syncopation;
- register;
- pitch histogram;
- chord-degree histogram;
- interval histogram;
- direction-change rate;
- repeated-note rate;
- leap distribution;
- rest distribution;
- note-to-chord-boundary offsets;
- phrase pickup and release behavior;
- voice count;
- voicing span;
- top-note and bass-note contours;
- harmonic tension categories;
- articulation profile.

The feature representation is not only for modelling. It powers search, comparison, explanations, tests, and morphing.

---

## 6. “Learning” strategy

Use staged statistical learning. Do not start with a neural model.

### Stage 0 — deterministic transforms

Before learning:

- transpose;
- chord-relative remap;
- rotate;
- truncate/extend;
- rhythmic displacement;
- density adjustment;
- duration substitution;
- octave/register adaptation;
- voice-leading optimization;
- controlled insertion/removal;
- passing-tone and enclosure insertion;
- suspension and anticipation rules;
- accent and velocity transforms.

These provide immediate value and establish contracts.

### Stage 1 — empirical distributions

Learn transparent distributions from curated phrases:

- onset probability by metrical position;
- duration probability conditioned on onset class;
- rest probability;
- chord-degree histogram;
- transition probabilities among chord-relative categories;
- interval-direction probabilities;
- register probabilities;
- approach behavior near chord changes;
- voicing-size and spacing distributions;
- articulation and velocity distributions.

Every learned table should be exportable as JSON and attributable to the source subset used to derive it.

### Stage 2 — n-gram / variable-order symbolic model

Add role-specific conditional models:

```text
next event
  conditioned on:
    recent event history
    metrical position
    chord function
    local chord relation
    phrase position
    target role
    style/profile
```

Use smoothing and backoff. A small curated corpus makes transparent variable-order models more appropriate than an opaque high-capacity model.

### Stage 3 — retrieval plus recombination

Retrieve phrases or fragments by feature similarity, then:

- adapt to the current harmony;
- splice only at musically valid boundaries;
- preserve or deliberately transform contour;
- reconcile register and voice leading;
- track provenance of every borrowed fragment.

### Stage 4 — optional advanced models

Only after the symbolic baseline is strong, evaluate:

- probabilistic suffix trees;
- factor oracles;
- constrained Markov models;
- probabilistic grammars;
- lightweight sequence models;
- latent embeddings for similarity retrieval.

Any advanced model must be compared against the transparent baseline using the same evaluation corpus and seeds.

---

## 7. Generation model

Generation should be hierarchical.

### 7.1 Plan

Choose or derive:

- role;
- phrase length;
- density contour;
- rhythmic archetype;
- register;
- tension contour;
- repetition policy;
- variation amount;
- continuity amount.

### 7.2 Rhythm

Produce an onset/accent/duration skeleton using:

- a curated source pattern;
- a learned role-specific distribution;
- a Serpe/UPI expression;
- or a blend of these.

### 7.3 Harmonic function

Assign event categories:

- chord tone;
- extension;
- scale tone;
- chromatic approach;
- suspension;
- enclosure;
- passing/neighbor tone.

### 7.4 Pitch realization

Resolve categories against the harmonic timeline, register, contour, and voice-leading constraints.

### 7.5 Articulation and expression

Apply:

- velocity;
- gate/overlap;
- accents;
- timing offsets;
- CC/expression curves;
- optional breath-like phrasing;
- per-voice behavior.

### 7.6 Validation

Reject or repair outputs that violate hard constraints:

- impossible range;
- collisions;
- excessive leaps;
- unresolved required suspensions;
- forbidden pitch policy;
- density ceiling;
- voice crossing;
- invalid note-off ordering;
- tuning-channel exhaustion, where relevant.

---

## 8. Non-chord tones

Non-chord tones are not random “wrong notes.” Model them as functions with entry and exit conditions.

Implement a small first vocabulary:

### Passing tone

- fills a stepwise gap;
- weak or contextually appropriate metrical placement;
- resolves in the established direction.

### Neighbor tone

- departs by step;
- returns to the same structural tone.

### Chromatic approach

- one semitone above or below a target;
- short duration;
- resolves directly.

### Enclosure

- two approaches surrounding a target;
- configurable order;
- resolves to a structurally important tone.

### Suspension

- prepared or repeated from the prior harmony;
- becomes dissonant against the new chord;
- resolves according to a declared policy.

### Anticipation

- introduces a tone from the next harmony before its boundary.

Every inserted note should carry its category and target so the UI can explain and edit it.

---

## 9. Temporal morphing

“Generate a variant” is insufficient. The system must support a trajectory through phrase space.

Introduce:

```ts
interface MorphPlan {
  startPhrase: AccompanimentPhrase;
  targetPhrase?: AccompanimentPhrase;
  bars: number;
  dimensions: MorphDimension[];
  curve: "linear" | "ease-in" | "ease-out" | "step" | "random-walk";
  seed: number;
}
```

Candidate dimensions:

- density;
- syncopation;
- rhythmic similarity;
- pitch diversity;
- chord-tone probability;
- chromaticism;
- register;
- leap size;
- repetition;
- articulation;
- voicing width;
- activity near chord changes.

Important: morphing should not merely interpolate MIDI numbers. It should perform discrete, musically valid edits while moving measurable features toward targets.

The engine should expose both:

- the target feature trajectory;
- the actual measured trajectory of generated bars.

This makes the process inspectable and testable.

---

## 10. Continuity and state

Automatic accompaniment is stateful.

Define an `AccompanimentSession` that tracks:

- current progression position;
- previous generated phrase;
- active notes;
- voice assignments;
- recent motifs;
- repetition budget;
- current morph state;
- tension trajectory;
- random generator state;
- tuning state;
- pending suspensions/anticipations;
- performer control values.

The session must support:

- render next bar;
- render next phrase;
- seek/reset;
- snapshot and restore;
- deterministic replay;
- progression update;
- live chord update;
- parameter update.

---

## 11. Proposed CLI

Do not overload `enkerli generate`, which currently means progression generation.

Add a role-oriented command, provisional syntax:

```bash
enkerli accompany \
  --progression "Dm7 G7 | Cmaj7 A7" \
  --role bass \
  --bars 8 \
  --seed 42 \
  -o bass.mid
```

Useful early options:

```text
--role bass|comping|groove|arp
--source <phrase-or-library-item>
--profile <profile.json>
--rhythm <UPI>
--density <0..1>
--variation <0..1>
--continuity <0..1>
--chromaticism <0..1>
--range C2:C4
--seed <integer>
--explain
--trace <trace.json>
-o <file.mid>
```

Pipeline examples:

```bash
enkerli generate --mode minor --length 16 --seed 7 \
  | enkerli accompany --role bass --seed 9 -o bass.mid
```

```bash
enkerli upi "P(3,0)+P(5,0)" \
  | enkerli accompany --role comping \
      --progression "Dm7 G7 | Cmaj7" \
      -o comp.mid
```

```bash
enkerli accompany --session session.json --stream \
  | enkerli send --to vane
```

The exact stream contracts must use existing `SuiteMessage` envelopes or explicitly versioned serializable domain objects.

---

## 12. Protocol additions

Prefer existing message types whenever they are semantically adequate.

Likely additions or refinements:

```text
phrase
accompaniment-request
accompaniment-state
expression
tuning
```

Before adding any type:

1. audit `@enkerli/protocol`;
2. show why `pattern`, `progression`, `chord`, `scale`, `param`, and `command` are insufficient;
3. define JSON schema/types;
4. add committed vectors;
5. add round-trip and malformed-input tests;
6. document transport-neutral semantics.

Potential commands:

```text
generate-next
mutate
morph-toward
freeze-rhythm
freeze-pitches
freeze-voicing
increase-density
decrease-density
more-chromatic
less-chromatic
new-fill
reset-session
```

Potential parameters:

```text
density
variation
continuity
syncopation
chromaticism
register
rangeLow
rangeHigh
repetition
tension
humanization
expression
```

---

## 13. Dynamic Just Intonation

Treat tuning as a downstream realization concern informed by the harmonic timeline.

Initial path:

1. Generate symbolic notes with chord/function metadata.
2. Compute a tuning assignment per harmonic frame.
3. Preserve sustained-note policy across chord changes.
4. Emit one of:
   - MTS-ESP updates;
   - MIDI Tuning Standard messages;
   - per-note pitch bend / MPE;
   - renderer-specific tuning controls.
5. Keep 12-TET MIDI export available and deterministic.

Open design decisions:

- retune sustained notes or preserve their original tuning;
- prime-limit policy;
- handling of ambiguous extensions and non-chord tones;
- interpolation/slew time;
- channel allocation for per-note bends;
- enharmonic spelling as tuning evidence;
- conflict policy when the receiver already applies tuning.

Do not put MTS-ESP-specific behavior inside the phrase generator. Define a tuning adapter.

---

## 14. Expression model

Expression should be role-aware and independently controllable.

Examples:

### Bass

- note length relative to groove;
- ghost notes;
- pickup emphasis;
- velocity contour;
- slides or approach gestures;
- breath/CC-style macro expression where the target supports it.

### Comping

- per-voice velocity;
- rolled or staggered attacks;
- voicing release policy;
- accents;
- pedal/hold semantics;
- density response to performer activity.

### Arp/groove

- accent pattern;
- ratchets;
- gate variation;
- probability;
- phrase-level crescendo/decrescendo.

Store expression as explicit data, not hidden random perturbation.

---

## 15. MIDIcurator changes

Do not redesign MIDIcurator wholesale. Add the smallest vertical slice.

### Corpus annotation

Allow a segment to declare:

- role;
- harmonic context confidence;
- bar/beat alignment;
- source chord-relative interpretation;
- style/profile tags;
- “include in model” status;
- quality/rating;
- preferred transformability;
- phrase family.

### Feature inspection

Provide a panel that shows:

- rhythm;
- note and chord-degree histograms;
- interval profile;
- register;
- density;
- syncopation;
- non-chord-tone classifications;
- chord-boundary behavior.

Every inferred field should be correctable.

### Compare

Allow side-by-side comparison of:

- source phrase;
- transformed phrase;
- generated phrase;
- feature deltas;
- provenance/trace.

### Promote

A generated result can become a normal curated library item with:

- parent/source links;
- seed;
- engine version;
- profile;
- transformation trace;
- human rating;
- accepted/rejected status.

This creates a curation loop instead of a one-way generator.

---

## 16. Designer-agent assignment

The designer agent should not begin with polished screens. It should model the playflow and information architecture.

### Deliverable A — journey map

Map these scenarios:

1. Curate a bass phrase from imported MIDI.
2. Correct its harmonic interpretation.
3. Add it to a style/profile.
4. Generate eight bars against a ProgGenie progression.
5. Inspect why specific notes were chosen.
6. Reduce chromaticism while preserving rhythm.
7. Morph toward a second phrase over sixteen bars.
8. promote one result into the library.
9. perform live, changing density and fills without touching the screen.

For each step identify:

- user intent;
- visible state;
- action;
- feedback;
- failure/recovery;
- keyboard/MIDI alternative;
- what must remain available in compact plugin UI.

### Deliverable B — object model

Create a map of user-facing objects:

- source clip;
- segment;
- phrase;
- phrase family;
- profile;
- accompaniment session;
- generated take;
- morph plan;
- trace;
- progression;
- role;
- tuning policy;
- control map.

The names should be plain and consistent with the suite glossary.

### Deliverable C — low-fidelity surfaces

Explore only these surfaces:

1. **Curate** — source segmentation and annotation.
2. **Model** — profile composition and learned tendencies.
3. **Generate** — progression, role, constraints, and take generation.
4. **Evolve** — morph trajectory through time.
5. **Inspect** — event-level explanation and feature comparison.
6. **Perform** — large, immediate controls for live variation.

Determine whether these are:

- MIDIcurator modes;
- workspace modules;
- progressive-disclosure panels;
- or separate views sharing one engine.

### Deliverable D — interaction principles

The interface must:

- reveal complexity gradually;
- support sound-first use without requiring theory vocabulary;
- make harmonic function available on demand;
- clearly distinguish source, inferred data, and generated data;
- expose uncertainty;
- make seeds and repeatability understandable;
- allow freeze/lock operations;
- keep destructive corpus actions explicit and undoable;
- remain usable with keyboard/switch access;
- avoid relying on color alone;
- survive compact plugin and iPad contexts.

### Designer non-goals

Do not:

- invent a skeuomorphic backing-band interface;
- mimic a DAW arrangement view unnecessarily;
- present a chatbot as the primary interaction;
- hide generation behind a single “AI” button;
- collapse corpus editing and performance into one crowded screen;
- create a new visual language disconnected from `@enkerli/ui`.

---

## 17. First vertical slice

Implement one constrained end-to-end use case:

> Generate a reproducible monophonic bassline for a canonical progression using one curated source phrase, a chord-relative pitch model, and a selectable rhythm-preservation amount.

### Inputs

- canonical progression;
- one-bar or two-bar monophonic bass phrase;
- meter;
- target range;
- seed;
- variation;
- chromaticism;
- rhythm preservation.

### Outputs

- `AccompanimentPhrase`;
- SMF;
- trace JSON;
- feature comparison;
- provenance link to source;
- optional suite message.

### Required behavior

- adapts the phrase to each chord;
- preserves structural spelling metadata;
- supports chord tones plus controlled chromatic approaches;
- avoids impossible register jumps;
- is deterministic by seed;
- round-trips serialization;
- can run entirely in Node;
- is callable from a unit test and CLI;
- does not require MIDIcurator UI changes to prove the engine.

### Acceptance test example

Given:

```text
Progression: Dm7 | G7 | Cmaj7 | A7
Source: a one-bar walking-bass phrase annotated relative to Dm7
Range: C2–C4
Seed: 42
Chromaticism: 0.25
Rhythm preservation: 1.0
```

Verify:

- output contains four bars;
- rhythm matches the source phrase in each bar;
- strong-beat targets obey the selected chord-tone policy;
- chromatic notes resolve to declared targets;
- all notes remain in range;
- trace explains each event;
- repeated runs are byte-for-byte identical;
- changing only the seed changes optional choices but not hard constraints.

---

## 18. Work sequence

### Phase 1 — audit and contracts

1. Audit reusable MIDIcurator analysis and segmentation code.
2. Audit canonical progression/chord/SMF types.
3. Audit Serpe rhythm representations.
4. Propose the minimum phrase schema.
5. Add vectors and serialization tests.
6. Write an architecture decision record.

### Phase 2 — extraction

1. Convert a MIDIcurator segment into `AccompanimentPhrase`.
2. Infer chord-relative event relations.
3. Compute transparent features.
4. Preserve uncertainty and provenance.
5. Provide JSON inspection.

### Phase 3 — deterministic bass adapter

1. Reharmonize the source phrase.
2. Enforce range and contour constraints.
3. Insert optional chromatic approaches.
4. Export SMF and trace.
5. Add CLI verb.

### Phase 4 — empirical model

1. Build distributions from selected phrases.
2. Serialize a profile.
3. Generate from distributions.
4. Compare against deterministic transforms.
5. Add corpus-subset provenance.

### Phase 5 — temporal evolution

1. Add stateful sessions.
2. Add continuity and motif-memory policies.
3. Add morph plans.
4. Add streaming/control-plane support.

### Phase 6 — more roles

Add comping only after the bassline contracts hold. Comping requires polyphonic voice identity, voicing policy, sustain behavior, and collision handling.

### Phase 7 — tuning and expression adapters

Add explicit expression and tuning output without coupling them to generation internals.

---

## 19. Testing strategy

### Unit tests

- serialization;
- chord-relative mapping;
- feature extraction;
- deterministic RNG;
- range adaptation;
- non-chord-tone resolution;
- voice-leading costs;
- morph feature trajectory;
- malformed input.

### Vector tests

Commit JSON vectors for every cross-language or protocol-relevant contract.

### Property tests

Examples:

- generated notes always fall within declared range;
- every note-off follows its note-on;
- every classified approach resolves to its target;
- deterministic seed produces identical output;
- transposition preserves relative structure;
- serialization round-trips;
- no NaN/Infinity values;
- probabilities normalize or have defined backoff.

### Musical regression fixtures

Keep a small CC0 test corpus covering:

- straight eighth bass;
- walking quarter notes;
- syncopated funk bass;
- sparse comping;
- anticipations;
- suspensions;
- chromatic enclosures;
- two-chord-per-bar changes;
- odd meter later.

### Evaluation

Use both objective and human-curation metrics:

- constraint violations;
- feature distance to target;
- novelty versus source;
- repetition;
- harmonic fit;
- contour continuity;
- acceptance rate;
- rating;
- time to a usable take;
- number of manual repairs.

Do not define “musicality” as a single automated score.

---

## 20. Traceability requirements

Every generated output should be able to answer:

- Which engine version produced this?
- Which seed?
- Which profile?
- Which source phrases or fragments contributed?
- Which progression and tuning policy?
- Which constraints were active?
- Why was each non-chord tone chosen?
- Which repairs were applied?
- What changed during morphing?
- Can the result be reproduced?

Suggested trace levels:

```text
none
summary
events
full
```

---

## 21. Guardrails

- Preserve the suite’s leftmost-LSB convention.
- Reuse structural note spelling.
- Keep corpus material and derived data licensing boundaries explicit.
- Do not publish restricted source corpora.
- Do not duplicate theory implementations.
- Do not make the UI the only way to access the engine.
- Do not make the CLI a second implementation.
- Do not add unseeded randomness.
- Do not silently overwrite human annotations.
- Do not claim learned categories are certain when they are inferred.
- Do not optimize for maximal novelty.
- Do not introduce a heavyweight ML dependency in the first slice.
- Do not add a new app before proving that the workflow cannot live coherently in MIDIcurator/workspace surfaces.

---

## 22. Questions the coding agent must answer before implementation

1. Which MIDIcurator modules are already Node-clean and reusable?
2. Which existing types can represent progression, chord, meter, note spelling, and SMF metadata?
3. Is `pattern` in `@enkerli/protocol` adequate for a phrase, or is a separate versioned type required?
4. Where should phrase/library schemas live?
5. How should phrase provenance use the existing library envelope?
6. What is the minimum annotation needed to generate the first bassline?
7. Which rhythm features should reuse `@enkerli/upi` and which remain MIDI-derived?
8. How will deterministic RNG be shared with `@enkerli/proggen`?
9. How will a generation trace be embedded or linked from SMF?
10. What exact files and tests will comprise the first PR?

The agent should return a short audit report and proposed file-level change list before changing architecture.

---

## 23. Definition of done for the first PR series

The first series is complete when:

- a canonical `AccompanimentPhrase` contract exists;
- a MIDI phrase can be converted into it;
- one source bass phrase can be adapted across a progression;
- the result is deterministic and explainable;
- SMF and trace files are emitted;
- CLI invocation works;
- tests and vectors pass;
- no browser dependency exists in the engine;
- the architecture leaves room for MIDIcurator, workspace, plugin, and live-MIDI surfaces;
- documentation clearly distinguishes what is implemented from what remains aspirational.

---

## 24. Suggested coding-agent prompt

You are working in `Enkerli/music-suite`.

Read, in order:

1. `HANDOFF.md`
2. `CONVENTIONS.md`
3. `docs/MASTER_PLAN.md`
4. `docs/CONTROL_PLANE.md`
5. `docs/HEADLESS.md`
6. `docs/USE_CASES.md`
7. `docs/LIBRARY_SPEC.md`
8. the GloriArp brief

Your first task is **not** to implement a full accompaniment generator.

Audit the repository for reusable code related to:

- MIDIcurator segmentation and phrase analysis;
- canonical progression/chord types;
- SMF import/export and embedded metadata;
- Serpe/UPI rhythm analysis;
- deterministic randomness;
- library provenance;
- protocol message types.

Then propose:

1. the smallest canonical symbolic phrase schema;
2. the correct package boundary;
3. a file-by-file plan for the first monophonic bassline vertical slice;
4. test vectors and acceptance tests;
5. any protocol/schema changes, with justification;
6. risks of duplicating or coupling existing engines.

Respect these constraints:

- integration before features;
- headless engine first;
- deterministic by seed;
- transparent symbolic baseline before ML;
- no corpus publication;
- structural spelling;
- leftmost = LSB;
- committed vectors for cross-language contracts;
- UI and CLI must call the same engine.

After the audit, implement only the approved minimal vertical slice: adapt one curated monophonic bass phrase across a canonical chord progression, with controlled chromatic approaches, range constraints, trace output, SMF export, and a CLI entry point.

Do not create a new application unless the audit demonstrates a concrete need.
