# Serpe Poly — design note (v1 — separator & offset DECIDED)

*2026-07-18, PRIORITIES row 5. The notation is a **one-way door** — patterns
people save today must parse forever — so this note settled it before code.
§2.1/§2.3 are **DECIDED** (2026-07-18: `/` lanes, `@` offsets in ms or
note-value fractions); remaining items are **PROPOSED** (argued defaults,
standing unless challenged) or **OPEN** (safe to defer). We document and
iterate — backtracking costs a migration note, not a rewrite.
Charlie Keil is the reason this matters: groove lives in the interaction
BETWEEN parts — participatory discrepancies, the push and drag between
lanes — not inside any single lane.*

## 1. What "poly" means here

Multiple **lanes**, each a full UPI pattern (its own length, accents,
quantization), sounding **simultaneously** — not merged. Today's `+` already
combines patterns, but it *unions them into one lane* (LCM projection).
Poly keeps them apart: separate voices, separate sounds, separate
micro-timing — and the interplay is the music.

## 2. The notation — the one-way door

### 2.1 Lane separator — **DECIDED: `/`** *(2026-07-18)*

```
E(4,16) / E(3,8) / {10}E(2,3)
```

The slash reads as a lane separator on sight (drum-notation instinct:
kick/snare/hat). Verified free in the UPI grammar — no production uses it;
Morse and the shorthand names are letters-only. Known adjacency, accepted:
the LEADSHEET language uses `/` for slash chords (`C/G`), but the two
languages never share a string. One parsing subtlety, handled in §2.3: a
tempo-synced offset fraction (`@+1/32`) contains a slash, so the lane
splitter consumes `@…` offset tokens atomically before splitting.

*(The earlier `&` proposal is preserved in git history; we document and
iterate — this door swings back at the cost of a migration note.)*

### 2.2 Lane labels — **PROPOSED**

Optional `name=` prefix per lane (`=` is unused in the grammar; `:` is not):

```
kick=E(4,16) / snare=[4,12]:16 / hat={10}E(8,16)
```

Labels are for humans, the mixer UI, and the bus (`pattern` messages can
carry them in `name`); unlabeled lanes get `lane1`, `lane2`, …

### 2.3 Micro-timing — the Keil suffix — **DECIDED: `@`, two units** *(2026-07-18)*

Per-lane offset, `@` suffix (`@` is unused in the grammar), at the END of a
lane. `+` = lay back (late), `−` = push (early). **Two units**, because feel
and notation are different regimes:

```
kick=E(4,16) / snare=E(2,4)@+12ms / hat=E(8,16)@-1/64
```

- **`@±Nms`** (bare `@±N` also = ms) — absolute milliseconds,
  tempo-independent: how participatory discrepancies are actually measured
  (typically 10–40ms). Clamped ±50ms.
- **`@±num/den`** — a NOTE-VALUE fraction of a whole note, tempo-synced:
  `@+1/32` is "a thirty-second late" at any bpm (ticks =
  wholeNoteTicks × num/den). The music-notation equivalent for when the
  groove must scale with tempo. Clamped ±1/8.

The splitter consumes the whole `@` token atomically, so the fraction's
slash never reads as a lane break. This puts participatory discrepancies
**in the saved, shareable text** — a groove's feel survives copy-paste,
which is exactly the argument for having a notation at all.

### 2.4 What stays OUT of the notation — **PROPOSED**

Sound routing (MIDI note, channel, voice) and mute state live in **UI/app
state**, not the string. Principle: **the notation says WHEN; the instrument
rack says WHAT.** A pattern pasted from a friend should drop onto *your*
drum mapping, not carry theirs. (Same reason a leadsheet doesn't name the
pianist.) The rack side grew a **drumkit selector** (GM · Volca Beats ·
Chromatic-from-C2): a kit sets label→note DEFAULTS, a lane's own note input
always wins, and kit choice persists per browser.

### 2.5 Interactions with the existing grammar — settled by construction

- Each lane is a complete UPI expression: `{100}E(3,8);12@+5` is legal —
  accents, quantization, and offset per lane.
- `+`/`-` still merge *within* a lane: `kick=E(4,16)+[2]:16 / snare=…`.
- A single lane with no `/` parses exactly as today — **zero breaking
  change**; `parseUPI` untouched, `parsePolyUPI` added beside it.

## 3. Data model

```ts
interface PolyLane {
  label: string;            // "kick" or "lane1"
  steps: number[];          // leftmost = LSB, as everywhere
  accents: number[];
  offset:                   // the Keil number; absent = dead on the grid
    | { kind: "ms"; ms: number }            // @+12ms — absolute feel
    | { kind: "frac"; num: number; den: number } // @-1/64 — tempo-synced
    | null;
  source: string;           // the lane's own UPI text, round-trippable
}
interface PolyPattern {
  lanes: PolyLane[];
  lcm: number;              // display alignment grid (reuses the + machinery)
}
```

Serialization = the notation itself (2.1–2.3); `formatPolyUPI(poly)`
round-trips. Lanes keep their own lengths — a 3-step clave against a 16-step
hat is the point — and the LCM is only for *drawing* them aligned.

## 3b. Playback semantics — **DECIDED: cycle lock default** *(2026-07-18, field-tested)*

First build shipped POLYMETER (equal step sizes, lanes drifting to the lcm);
field listening said no: 15 against 16 clustered into near-flams around the
realignment points — "trying to match the sync points" — instead of a steady
cross-rhythm. Revised, per the user's call:

- **Cycle lock (default) = POLYRHYTHM.** Every lane spans the SAME cycle
  (the first lane's natural length at the base step rate defines it); a
  lane's step duration = cycleMs / its length. 15:16 is a true cross-rhythm;
  the display shows one cycle per row, stretched — different step SIZES,
  which is exactly the timing.
- **Step lock (toggle) = POLYMETER.** All steps equal; lanes drift and
  realign at the lcm. The phasing feel, when you want it.

Implementation: per-lane clocks (not one global tick); each lane reschedules
from the live lock, so flipping the toggle takes effect within a step.

## 4. The webapp slice (M) — scope fence

**In:** `parsePolyUPI`/`formatPolyUPI` in `@enkerli/upi` (pure, vectored,
node-tested) · a lanes view in the Serpe webapp (stacked step-lanes on the
shared LCM grid, per-lane mute + MIDI note/channel selectors + an offset
slider wired to `@±ms`) · per-lane playback scheduling in the webapp
(WebMIDI out and the existing internal preview both honor offsets) ·
`msuite upi` printing per-lane analysis for poly input.

**Out (explicitly, at slice 1):** C++ plugin parity · progressive/scenes
per lane · transforms (rotate/mutate) targeting a single lane via the bus ·
DAW-sync. Each is a follow-on with its own slice — parity is now planned,
see §8.

**Docs rule honored:** mono notation docs stay light until `/` lands
(the standing concern about documenting a surface about to change).

## 5. Bus & protocol — **OPEN** (audit rule applies)

A poly pattern on the bus: either (a) N ordinary `pattern` messages, one per
lane, `name` carrying `"kick@+12ms"` — zero protocol change, works today; or
(b) a `lanes: [{steps, mask, offsetMs}]` extension to PatternBody — cleaner,
but a protocol addition needs the GLORIARP_BRIEF §12 justification ritual.
**Start with (a)**; adopt (b) only when a consumer actually needs atomic
multi-lane delivery (the workspace Pattern module is the likely forcing
case).

## 6. Where this meets GloriArp

The groove role (PRIORITIES §2.7) is this data model wearing drum sounds:
lanes → GM notes, per-lane `articulate()` for ghosts and pushes, per-lane
seeds. Getting `PolyLane` right here means the drum generator inherits it
for free — one more reason the notation decision comes first.

## 7. Acceptance for the first slice

- `parsePolyUPI("kick=E(4,16) / snare=E(2,4)@+12ms")` → 2 lanes, labels,
  offsets; single-lane input identical to `parseUPI` output (pinned);
  `@+1/32` parses as a note-value offset, not a lane break.
- Round-trip: `formatPolyUPI(parsePolyUPI(s))` normalizes stably.
- Webapp: two lanes visibly interlocked on the LCM grid; muting one leaves
  the other sounding; dragging the offset slider audibly drags the snare
  against the kick (the Keil moment — by ear, BROWSER_TEST §9 to be added).
- Committed vectors for the parser; zero change to any existing UPI test.

---
*§2.1 and §2.3 decided 2026-07-18 (user call: `/` and `@` with a
tempo-synced fraction unit); §2.4 stands unchallenged. Implementation began
the same day: parser/formatter first (node-verifiable), the webapp lanes
view next (needs the browser).*

## 8. Parity milestone (plugin · standalone · webapp) — IN PROGRESS

Field testing confirmed the notation and semantics hold; full parity is now
on the roadmap (PRIORITIES follow-on, L). **User report 2026-07-20**: poly
lanes had been requested before and were still absent from the actual
plugin — re-flagged as a **blocker**, not a nice-to-have, since a feature
that only exists in one of four runtimes (webapp/plugin/standalone/AUv3) is
a parity gap, not a preview. The webapp stays the reference implementation;
the order of work:

1. ✅ **C++ `UPIParser` lanes** *(shipped 2026-07-20,
   `rhythm_pattern_explorer` commit f572d9e)* — `Source/Core/PolyParser.h/
   .cpp`, ported term-for-term from `packages/upi/src/poly.js`
   (`splitLanes`/`parseOffset`/`parsePolyUPI`): top-level `/` splitting
   (depth-aware), atomic `@` offset-token consumption, `name=` labels,
   both offset units with their clamps, lcm. Each lane's body still goes
   through the existing `UPIParser::parse`, so the whole mono grammar is
   available per lane for free. Conformance-locked the same way as the
   rhythm codecs: `packages/upi/vectors/poly.json` (this repo, generated
   from `parsePolyUPI`) → vendored as `WebApp/tests/poly-vectors.json` →
   embedded `PolyConformanceVectors.h` → the `serpe_poly_conformance`
   console app + `ctest` target. 11/11 vectors matched byte-for-byte on
   the first local build. **Parsing only — no audible change yet**: the
   plugin doesn't schedule multiple lanes, so a poly UPI string sets up
   correctly-parsed lanes that the engine still can't play back as more
   than one voice.
2. **Engine voices — NOT STARTED, scoped below for the next session.**
3. **Plugin UI** — the shared `index.html` grows the lanes panel (same DOM,
   same CSS — the WebView is the same file the webapp bundles). Largely
   free once the app source is rebuilt into the plugin's WebUI bundle,
   since the React lanes panel already exists in `apps/serpe`; needs
   verification once step 2 gives it something real to talk to.
4. **Per-lane analysis** — the mono Analysis pane (hidden in poly mode
   today) returns as per-lane meters + a cross-rhythm view (interference
   pattern of lane pairs — the Keil visual).

Known behaviors to carry over from webapp field fixes (2026-07-18):
advance-on-note-in is OPT-IN everywhere (the IAC-loop swirl); outgoing hits
register in the echo guard on every path; mid-edit parse errors keep the
last good pattern playing.

### 8.1 Milestone 2 draft — engine voices (scope for the next session)

Read from `rhythm_pattern_explorer/Source/Platform/PluginProcessor.h` on
2026-07-20: today there is exactly **one** `PatternEngine patternEngine`
member, one `midiNoteParam` (`AudioParameterInt`), and one APVTS layout —
genuinely single-voice throughout. Making this poly means:

- **Fixed-slot lanes, not a dynamic vector.** JUCE plugin parameters must be
  declared once in `createParameterLayout()` for host automation/session
  recall to work at all — so the design is a **fixed maximum lane count**
  (propose **4**, matching the webapp's practical lane counts so far) with
  per-slot `AudioParameterInt` note + channel + a `AudioParameterBool` mute,
  always present; a poly UPI with fewer lanes than the max just leaves the
  extra slots unused (silently, not erroring). `PatternEngine` becomes
  `std::array<PatternEngine, kMaxLanes>` (or a small owning struct per
  slot), populated from `PolyParser::parse()`'s lane list on `setUPIInput`.
- **Per-lane clocks in `processBlock`**, porting the webapp's cycle-lock
  model (§3b): cycle lock (default) makes every lane span the SAME cycle
  (lane 1's natural length defines it; a lane's step duration =
  cycleSamples / itsLength) — POLYRHYTHM. Step lock (fewer steps drift to
  the lcm) is the toggle. `PolyOffset` (ms or note-value fraction) applies
  as a **sample offset added at schedule time**, with the same
  `POLY_LAG_MS`-style base lag the webapp uses (60ms) so a negative offset
  has room to push early without going before the previous scheduled
  sample — this needs to become a **plugin parameter or a fixed constant
  decided up front**, since "how much lag" changes the audible feel.
  AudioPlayHead-driven transport sync (host tempo/position) replaces the
  webapp's own clock — the harder, JUCE-specific part; no existing suite
  precedent to lean on directly (the mono engine already does this for one
  lane, so the pattern is proven, just needs replicating N times with
  independent per-lane phase).
- **Bridge/UI additions**: `SerpeEditor`'s JS↔C++ contract needs a poly
  variant of `setUPI` (or the existing one just also carries per-lane
  target params) and a way for the WebView lanes panel to read/write the
  new per-slot note/channel/mute parameters — mirrors the mono
  `sendParamActual`/`paramChange` pattern already in place.
- **Open questions to settle before coding** (one-way-door risk — same
  discipline as the notation decision): (a) 4 lanes enough, or does the
  webapp's practical use suggest more/fewer? (b) is the lag constant fixed
  suite-wide or a new automatable parameter? (c) do unused lane slots need
  to be hideable in the plugin UI, or is "shows 4 always, blank if unused"
  acceptable for v1? (d) scenes/progressive-manager: do they need to
  understand multiple lanes immediately, or can poly patterns be scene-
  incompatible for v1 (documented limitation) while mono keeps working?
- **Estimate**: still **L** — this is a real processBlock/parameter-layout
  redesign, not a port. Milestone 1 (this session) was the tractable,
  low-risk slice; milestone 2 is where the schedule actually gets spent.
