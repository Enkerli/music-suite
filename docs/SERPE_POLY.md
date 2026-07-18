# Serpe Poly — design note (DRAFT for reaction)

*2026-07-18, PRIORITIES row 5. The notation is a **one-way door** — patterns
people save today must parse forever — so this note exists to settle it
before any code. Everything below is marked **DECIDE** (needs your call),
**PROPOSED** (my recommendation, argued), or **OPEN** (safe to defer).
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

### 2.1 Lane separator — **DECIDE**

**PROPOSED: `&`** — "and", the parallel operator:

```
E(4,16) & E(3,8) & {10}E(2,3)
```

Why `&` over the alternatives:

- **It pairs semantically with `+`.** `A + B` = union INTO one lane;
  `A & B` = keep as SEPARATE lanes. One character teaches the whole
  poly/mono distinction.
- **`,` is already three things** in the grammar — `E(3,8,rot)` arguments,
  `[0,3,6]:8` onset lists — so a top-level comma split must be doubly
  depth-aware, and every error message gets murkier ("did you mean a lane or
  a rotation?").
- **`:` is taken** by the codecs (`0x94:8`), **`;` by quantization, `|` by
  bar notation** in the leadsheet language next door — reusing it here would
  overload the suite's most familiar symbol with a perpendicular meaning.
- `&` is unused anywhere in UPI (and in Morse letters), so it's unambiguous
  at any nesting depth, forever.

Alternative if `&` feels wrong under the fingers: top-level `,` with
paren/bracket-aware splitting. Workable; my second choice.

### 2.2 Lane labels — **PROPOSED**

Optional `name=` prefix per lane (`=` is unused in the grammar; `:` is not):

```
kick=E(4,16) & snare=[4,12]:16 & hat={10}E(8,16)
```

Labels are for humans, the mixer UI, and the bus (`pattern` messages can
carry them in `name`); unlabeled lanes get `lane1`, `lane2`, …

### 2.3 Micro-timing — the Keil suffix — **PROPOSED**

Per-lane offset in milliseconds, `@` suffix (`@` is unused):

```
kick=E(4,16) & snare=E(2,4)@+12 & hat=E(8,16)@-6
```

`+` = lay back (late), `−` = push (early). This puts participatory
discrepancies **in the saved, shareable text** — a groove's feel survives
copy-paste, which is exactly the argument for having a notation at all.
Range clamp ±50ms (beyond that it's a different rhythm, not a feel).

### 2.4 What stays OUT of the notation — **PROPOSED**

Sound routing (MIDI note, channel, voice) and mute state live in **UI/app
state**, not the string. Principle: **the notation says WHEN; the instrument
rack says WHAT.** A pattern pasted from a friend should drop onto *your*
drum mapping, not carry theirs. (Same reason a leadsheet doesn't name the
pianist.)

### 2.5 Interactions with the existing grammar — settled by construction

- Each lane is a complete UPI expression: `{100}E(3,8);12@+5` is legal —
  accents, quantization, and offset per lane.
- `+`/`-` still merge *within* a lane: `kick=E(4,16)+[2]:16 & snare=…`.
- A single lane with no `&` parses exactly as today — **zero breaking
  change**; `parseUPI` untouched, `parsePolyUPI` added beside it.

## 3. Data model

```ts
interface PolyLane {
  label: string;            // "kick" or "lane1"
  steps: number[];          // leftmost = LSB, as everywhere
  accents: number[];
  offsetMs: number;         // the Keil number; 0 default
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

## 4. The webapp slice (M) — scope fence

**In:** `parsePolyUPI`/`formatPolyUPI` in `@enkerli/upi` (pure, vectored,
node-tested) · a lanes view in the Serpe webapp (stacked step-lanes on the
shared LCM grid, per-lane mute + MIDI note/channel selectors + an offset
slider wired to `@±ms`) · per-lane playback scheduling in the webapp
(WebMIDI out and the existing internal preview both honor offsets) ·
`msuite upi` printing per-lane analysis for poly input.

**Out (explicitly):** C++ plugin parity (the engine stays mono until this
notation survives real use — the webapp is the lab) · progressive/scenes
per lane · transforms (rotate/mutate) targeting a single lane via the bus ·
DAW-sync. Each is a follow-on with its own slice.

**Docs rule honored:** mono notation docs stay light until `&` lands
(the standing concern about documenting a surface about to change).

## 5. Bus & protocol — **OPEN** (audit rule applies)

A poly pattern on the bus: either (a) N ordinary `pattern` messages, one per
lane, `name` carrying `"kick@+12"` — zero protocol change, works today; or
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

- `parsePolyUPI("kick=E(4,16) & snare=E(2,4)@+12")` → 2 lanes, labels,
  offsets; single-lane input identical to `parseUPI` output (pinned).
- Round-trip: `formatPolyUPI(parsePolyUPI(s))` normalizes stably.
- Webapp: two lanes visibly interlocked on the LCM grid; muting one leaves
  the other sounding; dragging the offset slider audibly drags the snare
  against the kick (the Keil moment — by ear, BROWSER_TEST §9 to be added).
- Committed vectors for the parser; zero change to any existing UPI test.

---
*React to §2.1 (the `&`), §2.3 (the `@ms` suffix), and §2.4 (routing stays
out). Everything else follows from those three.*
