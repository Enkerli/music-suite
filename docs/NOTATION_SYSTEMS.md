# Notation systems

*Started 2026-07-15. A catalogue of the ways the suite writes down musical
objects — rhythms, pitch-class sets, chords, scales, fingerings, voicings —
with the **authoritative representation** for each and the file that owns it.
The point of gathering them: a value has one canonical form and several
display forms, and confusing the two is the commonest source of bugs and of
user confusion. This is a living inventory; where a form is aspirational
rather than implemented it is marked **(planned)**.*

## The two conventions that bind everything

Every notation below inherits [CONVENTIONS.md](../CONVENTIONS.md):

1. **Leftmost = LSB.** In any bitmask — pitch-class or rhythm — element *i*
   is bit *i* (value 2^*i*). Hex/octal/decimal digits read little-endian.
   C major = `0xAB5` = 2741; the tresillo over 8 steps = `0x94` = d73 = 73.
   The reference codecs and cross-language vectors live in
   [`@enkerli/theory`](../packages/theory). External formats (SMF, Apple
   Loops) keep their native order — the boundary is where they enter/leave
   the suite.
2. **Structural spelling.** Interval degree fixes the letter, semitone size
   fixes the alteration: from G♯ the major third is B♯, never C. Bare
   pitch-class sets carry no context and stay chromatic (unspelled).
   Authority: `spelling.ts`, vectors pinned.

---

## 1. Rhythm patterns

Authority: [`packages/theory/src/rhythm.ts`](../packages/theory/src/rhythm.ts);
headless via `msuite pattern`; the full notation language is Serpe's **UPI**
(`apps/serpe/engine/upi.js`, the `@enkerli/upi` promotion candidate).

| Form | Example (tresillo, 8 steps) | Notes |
|---|---|---|
| **Onset list** | `[0, 3, 6]` | the positions that sound; the human-legible ground truth |
| **Binary** | `10010010` | leftmost = LSB, so read left→right = step 0→7 |
| **Decimal mask** | `d73:8` | the integer 73; `:8` pins the step count (bits past it are meaningless) |
| **Hexadecimal** | `0x94:8` | little-endian digits |
| **Octal** | `o111:8` | little-endian digits |
| **Euclidean (UPI)** | `E(3,8)` · `E(3,8,1)` | beats, steps, optional rotation |
| **Complement** | — | `euclideanComplement` — the un-struck positions as their own pattern |

Analytic layers (not storage forms, but notations users see): **Barlow
indispensability** (`positionIndispensability`, `barlowIndispensabilityTable`)
ranks metric positions; **Barlow syncopation** scores a pattern; the Barlow
transform adds/removes onsets by that ranking. Polyrhythm (Serpe's shelved
feature, [MASTER_PLAN.md](MASTER_PLAN.md) §1.3) will need a **multi-cycle**
notation — a list of `{steps, mask}` cycles — decided together with the
`@enkerli/upi` data shape.

## 2. Pitch-class sets (PCS)

Authority: [`packages/theory/src/pcs.ts`](../packages/theory/src/pcs.ts);
apps PickPCS and PitchFold; the `scale`/`chord` protocol bodies carry masks.

| Form | Example (C major) | Notes |
|---|---|---|
| **12-bit mask** | `2741` (`0xAB5`) | the canonical form; leftmost = LSB (pc *i* = bit *i*) |
| **PC integer list** | `[0,2,4,5,7,9,11]` | 0–11; `pcsToBitmask` is the bridge |
| **Root + mask** | `root 0, mask 2741` | when a tonic matters (the `scale` message body) |
| **Fifths index** | `fifthsIndexToChromatic` | circle-of-fifths ordering, for ring display |
| **Scale-family label** | `SCALE_FAMILY_INTERVALS`, `scaleFamily` | named interval sets |
| **Forte number / prime form** | *(planned)* | standard in the literature; the suite treats the **mask** as canonical and does **not** currently emit Forte/prime form — add as a derived display if wanted, never as the identity |

## 3. Chords

Authority: [`packages/theory/src/chordDetect.ts`](../packages/theory/src/chordDetect.ts),
`chords.ts`, `chordSymbol.ts` (the 167-quality dictionary,
decimal-fingerprint lookup); headless via `msuite chord`.

| Form | Example | Notes |
|---|---|---|
| **Chord symbol** | `Cmaj7`, `Dm7`, `G7♭9` | structural spelling applies to the root/quality |
| **Slash chord** | `C/E` | detector handles inversions + slash bass |
| **MIDI-note voicing** | `[60, 64, 67, 71]` | concrete notes when voicing/register matters (`chord` body `notes`) |
| **PCS fingerprint** | `pcs: 2193` | the 12-bit mask the dictionary looks up (leftmost = LSB) |
| **Observed pcs + extras** | detector output | what was matched vs. what was left over (tensions/extensions) |
| **Roman numeral** | `ii`, `V7`, `♭VII` | key-relative; `analysis.ts` (`RomanDegree`) + `pcs.ts` `romanNumeral`; case = quality (upper major / lower minor) |

## 4. Scales

Authority: `pcs.ts` (`SCALE_FAMILY_INTERVALS`, `scaleFamily`,
`degreeChords`, `classifyDegreeChord`).

- A scale is a **PCS** (§2) — same mask notation — plus, when tonicized, a
  **root**. Its diatonic chords are enumerated by `degreeChords`
  (triads / sus / sevenths) and labelled with Roman numerals.
- Mode/family names are display labels over the mask; the mask is identity.

## 5. Fingerings

Authority: `apps/exquisite-fingerings` (grid engine + tests); the shared
`pitch-grid` component and the hardware-validated Exquis pad palette
(`@enkerli/ui` `pitch-class-colors.js`).

- A fingering is a set of **grid positions** on an isomorphic layout
  (Exquis / Launchpad-style), each carrying a pitch.
- **Label modes** are the notations a learner switches between over the same
  positions: **note name** · **pitch class** · **MIDI number** (persona 2,
  the grid-instrument learner). Left/right-hand parity is part of the model.
- A saved fingering is content ([LIBRARY_SPEC.md](LIBRARY_SPEC.md)); its
  canonical form is the position set + layout identity, not a picture.

## 6. Voicings *(emerging)*

The user flagged this as "possibly even voicings" — it is the least
settled. Today a voicing is expressed as a **MIDI-note list** (§3), and
voice-to-voice motion is measured by **taxicab / L1 voice leading**
(`voiceLeading.ts`, Tymoczko) and the motion vocabulary in `motion.ts`. A
first-class voicing notation — register, doubling, spacing, voice count,
independent of the specific pitches — is **(planned)**; DrawnQurve's
per-lane polyphony and the chord voicings in ProgGenie are the two places it
would first pay off.

---

## How this maps onto the control plane

The control-plane manifest ([CONTROL_PLANE.md](CONTROL_PLANE.md) §2) reaches
these notations through its `unit` vocabulary: `pc-mask` and `rhythm-mask`
name the §1/§2 masks (leftmost = LSB, integers on the wire); `pc`, `semitone`,
`count`, `bpm` name the scalar quantities. A parameter whose unit is
`rhythm-mask` **is** a §1 pattern, addressable from a knob, a CC, a keystroke,
or another tool — which is the whole reason the notation catalogue and the
manifest belong in the same plan.

*Open editorial question for the crafting pass: which of these get a
**worked "Rosetta" example** (one object shown in every one of its forms
side by side)? The tresillo (§1) and C major (§2) already recur as the
canonical examples across the repo's vectors — extending that discipline to
chords, scales, and fingerings would make this file a teaching document, not
just a reference.*
