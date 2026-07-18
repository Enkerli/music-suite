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

## 8. Parity milestone (plugin · standalone · webapp) — PLANNED

Field testing confirmed the notation and semantics hold; full parity is now
on the roadmap (PRIORITIES follow-on, L). The webapp stays the reference
implementation; the order of work:

1. **C++ `UPIParser` lanes** — port `splitLanes`/offset tokens (the grammar
   is small and regular); conformance-locked against the JS vectors, the
   same cross-language ritual as the rhythm codecs (134-vector precedent).
2. **Engine voices** — the C++ sequencer grows per-lane clocks with the
   cycle/step lock and the POLY_LAG + offset scheduling model; per-lane
   note/channel as plugin parameters (automatable).
3. **Plugin UI** — the shared index.html grows the lanes panel (same DOM,
   same CSS — the WebView is the same file the webapp bundles).
4. **Per-lane analysis** — the mono Analysis pane (hidden in poly mode
   today) returns as per-lane meters + a cross-rhythm view (interference
   pattern of lane pairs — the Keil visual).

Known behaviors to carry over from webapp field fixes (2026-07-18):
advance-on-note-in is OPT-IN everywhere (the IAC-loop swirl); outgoing hits
register in the echo guard on every path; mid-edit parse errors keep the
last good pattern playing.
