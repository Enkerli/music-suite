# Apple Loops (AIFF/CAF) reverse‑engineering notes

This document summarizes what we know about **Apple Loops musical metadata**
embedded in loop audio files, focusing on **chord sequences** in the `Sequ` chunk.

Written for other reverse‑engineers: enough structure to reproduce results, with clear "known vs inferred/uncertain".

---

## Scope

- Containers:
  - **AIFF/AIFC** (`.aif`, `.aiff`) for user‑generated loops and GarageBand exports
  - **CAF** (`.caf`) for first‑party Apple Loops — typically **no Sequ/chord data**
- Embedded musical metadata:
  - Embedded **SMF MIDI** (when present — `.aif` exports from GarageBand)
  - **Chord timeline** (the `Sequ` payload and "chord events" of type `103`)
- Out of scope:
  - Pattern loops / Session Player loops (different formats/encodings)
  - Full Logic loop database schema (covered in loop-database.ts)

---
## 0) What’s the point?
1. There’s no obligation for anyone to get what the point is. It won’t be on the exam. Feel free to move along.
2. My interest in chord-aware MIDI clips comes from a bigger portion of this MIDI pattern curation project.
3. The extraction isn’t just meant for first-party Apple Loops. It applies to any MIDI content added to the Loop Library. {waits for realization to kick in… /}
4. Some first-party Apple Loops do carry rich harmonic information, especially when you pay attention to harmonic rhythm, automated voice-leading, use of shell chords, “comping tricks”, and the diversity of chord spellings.
5. Though proprietary and copyrighted, first-party Apple Loops are shared assets, available for free to a large number of users including many classrooms at diverse levels. Even harmonically-simple ones can lead to valuable learning experiences. There’s research value in their use in the musical development of people from diverse backgrounds.
6. Using metadata embedded in Apple Loops (custom or first-party) is an efficient way to kickstart a database curation process.
7. High-quality datasets help build and test a variety of tools. For instance, this process has already helped me augment my chord dictionary.
8. Chords retrieved may not necessarily be heard in their realization. For instance, you can’t actually hear a chord progression in a monophonic lead line. Trying to guess what the “implied harmonic structure” might be is quite different from getting the intended structure from the source (including cases where the user is the source of both the harmonic structure and the melodic line). After all, [the same melody can fit a variety of harmonic contexts](https://www.ethanhein.com/wp/2026/twelve-remixes-of-dreams-by-fleetwood-mac/).
9. While the process currently focuses on chords which were identified in the MIDI content, it also works for any “leadsheet”, including those created through LP12’s ChordID (which often need to be tweaked).
10. There aren’t common ways to share chord information in MIDI format, even though it’s easy and potentially convenient to do so.
11. It’s notoriously difficult to even just copy the chord information present in Logic Pro.

## 1) High‑level structure

### 1.1 AIFF is an IFF container

An `.aif/.aiff` file is an IFF/RIFF‑like container:

- `FORM` header
- Repeated **chunks**:
  - `chunk_id` (4 bytes ASCII)
  - `chunk_size` (u32 big‑endian)
  - `chunk_data` (`chunk_size` bytes)
  - Optional pad byte to align to even sizes

Common audio chunks (`COMM`, `SSND`, etc.) exist as usual.

Apple Loops metadata appears in one or more `APPL` chunks.

### 1.2 Apple Loops metadata is nested inside `APPL`

Inside `APPL` chunk payloads there is a second IFF‑like subchunk layer:

- `subchunk_id` (4 bytes ASCII)
- `subchunk_size` (u32 big‑endian)
- `subchunk_data`
- Optional pad byte

Among these, a `Sequ` subchunk contains chord sequences.

> **Practical takeaway:** Parse top‑level AIFF chunks, recursively parse IFF‑style
> subchunks inside each `APPL` payload, and look for `Sequ`.

---

## 2) The `Sequ` payload and chord events

### 2.1 "Chord events" are found by scanning for event type `103`

A `Sequ` payload contains a stream of fixed‑size 32-byte "events".
We locate chord events by scanning the payload **at every 2-byte boundary** for records where:

- bytes at `+0x00..+0x01` read as u16‑LE equal `103` (0x67 0x00)

This scan approach is robust enough for reliable extraction.

### 2.2 Event record layout (32 bytes)

For an event starting at offset `off` within the `Sequ` payload:

| Field   | Offset | Size | Notes |
|---------|-------:|-----:|-------|
| `type`  | `+0x00` | 2 | u16 LE — chord events = 103 |
| (pad)   | `+0x02` | 2 | unknown |
| `mask`  | `+0x04` | 2 | u16 LE — 12-bit pitch-class interval bitmask |
| (pad)   | `+0x06` | 2 | unknown (often `0x0f07`) |
| `b8`    | `+0x08` | 1 | accidental scheme (1=flat, 2=natural, 3=sharp) |
| `b9`    | `+0x09` | 1 | pitch class mod 12 (absolute chromatic position) |
| (pad)   | `+0x0a` | 14 | unknown fields |
| `b18`   | `+0x18` | 1 | fractional tick addition: adds `b18/2` ticks |
| `b19`   | `+0x19` | 1 | low byte of integer position unit (u16LE with b1a) |
| `b1a`   | `+0x1a` | 1 | high byte of integer position unit |
| (pad)   | `+0x1b` | 5 | unknown |

**Total: 32 bytes.**

### 2.3 `mask` + `b8`/`b9` → chord identity

#### From the bitmask to intervals

`mask` is a 12-bit integer where **each bit position represents one semitone step above the chord root**:

```
bit 0  = root (unison, 0 semitones above root)
bit 1  = minor 2nd / ♭9 (1 semitone)
bit 2  = major 2nd / 9 (2 semitones)
bit 3  = minor 3rd (3 semitones)
bit 4  = major 3rd (4 semitones)
bit 5  = perfect 4th / 11 (5 semitones)
bit 6  = tritone / ♯11 (6 semitones)
bit 7  = perfect 5th (7 semitones)
bit 8  = minor 6th / ♭13 (8 semitones)
bit 9  = major 6th / 13 (9 semitones)
bit 10 = minor 7th / ♭7 (10 semitones)
bit 11 = major 7th (11 semitones)
```

To extract the interval list: iterate bits 0–11, collect every position where the bit is `1`.

**Example:** `mask = 0x891` = binary `100010010001`
→ bits 0, 4, 7, 11 are set → intervals `[0, 4, 7, 11]` → root, major 3rd, perfect 5th, major 7th.

**Special cases:**
- `mask = 0` (no bits set) → "No Chord" event — Logic Pro's explicit "NC" annotation.
- `mask = 1` (only bit 0) → root only — also treated as "No Chord" (a root alone is not a chord).

#### From intervals to chord name

The interval list `[0, 4, 7, 11]` describes a **chord quality** — the internal structure of the chord independent of which note is the root. In music theory this is sometimes called a "pitch-class set" (pc-set), though here the set is always relative to a root at 0 rather than an absolute pitch.

To name the chord:
1. Look up the interval set against a dictionary of known chord templates.
   - `[0, 4, 7]` → major triad
   - `[0, 3, 7]` → minor triad
   - `[0, 4, 7, 10]` → dominant 7th
   - `[0, 4, 7, 11]` → major 7th (∆7)
   - …and so on (MIDIcurator has 127 templates covering jazz, classical, modal, and
     extended harmony).
2. Combine the quality name with the root from `b8`/`b9`:
   - root `E♭` + quality `∆7` → **E♭∆7**
   - root `F♯` + quality `m7` → **F♯m7**

If no template matches, the interval set is shown literally in brackets (e.g. `A[0,2,3,6]`),
making it easy to cross-reference against a DAW's chord label.

`b8` and `b9` encode the **absolute chord root**:

| `b8` value | meaning |
|:----------:|---------|
| 1 | flat accidental (`b9` mod 12 = root PC, spelled with ♭) |
| 2 | natural (no accidental) |
| 3 | sharp accidental (`b9` mod 12 = root PC, spelled with ♯) |

So `b8=1, b9=10` → B♭ (PC 10, flat spelling); `b8=3, b9=6` → F♯ (PC 6, sharp spelling).

> **Note:** All test files in the MIDIcurator corpus use scheme 1 (b8 ∈ {1,2,3}).
> Older documentation claimed a "scheme 2" (b8=0x0f) for some files — this was incorrect
> and no such files were found in empirical testing.

### 2.4 `b18`/`b19`/`b1a` → event absolute tick position

The three bytes at record offsets `0x18`, `0x19`, `0x1a` encode the event's **absolute tick position**
within the MIDI timeline (at 480 ticks per beat / PPQ):

```
main = b19 | (b1a << 8)          // u16 LE integer position unit
tick = (main − 0x96) × 128 + (b18 >> 1)
```

- **Origin:** `main = 0x96` → tick 0 (loop start).
- **Scale:** 128 ticks per integer unit at 480 PPQ → 1 bar (4/4) = 1920 ticks = 15 units.
- **Fractional:** `b18 / 2` ticks added for sub-integer precision.
  - `b18 = 0x00` → whole-unit boundary (beat boundary).
  - `b18 = 0x80` → +64 ticks → ⅓ beat (480/3 = 160 ticks? no — 64 ticks = 1/7.5 beat ≈ 0.13 beat).
- **Overflow:** `b1a` handles loops longer than ~31 beats (`main > 0x96 + 255` requires `b1a > 0`).

**Empirical verification:**

| File | b18 | b19 | b1a | Computed tick | MIDI note onset | Match? |
|------|-----|-----|-----|:-------------:|:---------------:|:------:|
| LpTmB1 record 1 | 0x80 | 0x9d | 0x00 | 960 | 960 (beat 2.0) | ✓ |
| Waves of Nostalgia (chord 1) | 0x40 | 0xa2 | 0x00 | 1440 | 1440 (beat 3.0) | ✓ |
| Waves of Nostalgia (chord 2) | 0xc0 | 0xb1 | 0x00 | 6240 | 6240 (beat 13.0) | ✓ |
| 8-Track Tape EP | 0xa7 | 0x9d | 0x00 | 980 | ~980 (beat ~2.04) | ✓ |

> **Historical note:** An earlier formula used `(main − 0x96) × 128 − b18 × 8`
> (b18 subtracted, scaled by 8). This produced negative values for many real-world
> files (e.g. b18=0x80 → −1024 → clamped to 0), causing all events to pile up at
> beat 0. The correct formula was determined by cross-referencing decoded positions
> with MIDI note group onsets in the embedded SMF data.

---

## 3) What we can extract reliably

From a compatible `.aif` (user-generated Apple Loop with `Sequ`):

- One or more `Sequ` payloads (nested inside `APPL`)
- A list of chord events (`type=103`)
- For each event:
  - `mask` → interval set (pitch-class set relative to root)
  - `b8`/`b9` → absolute chord root + accidental spelling
  - `b18`/`b19`/`b1a` → absolute tick position within the MIDI timeline
  - Combined: full chord symbol with timing

This is sufficient to build a complete **leadsheet** from Apple Loop files.

---

## 4) Open questions / unknowns

- Unknown bytes at `+0x0a`–`+0x17` (14 bytes): purpose not established.
  - `+0x0e` (4 bytes BE): stable around `0x000080xx` in many files.
  - `+0x12` (4 bytes BE): larger values; possibly a secondary timing/duration field.
- Multiple `Sequ` payloads in one file: are they separate tracks, layers, or redundant?
- `.caf` files: first-party Apple Loops have no `Sequ` data (chord annotations only appear
  after round-tripping through GarageBand → loop export → `.aif`).
- Duration of each chord event: not currently decoded. We infer duration from the
  next event's position (or end of loop).

---

## 5) Reference implementation

A practical extractor:

1. Parse top‑level AIFF chunks; collect `APPL` payloads.
2. Parse nested IFF‑style subchunks inside each `APPL` payload.
3. Collect `Sequ` subchunk payloads.
4. Scan each `Sequ` payload at every 2-byte boundary for records where `u16 LE at +0x00 == 103`.
5. For each record:
   - Decode `mask` → intervals.
   - Decode `b8`/`b9` → root pitch class + accidental.
   - Compute `tick = (b19|(b1a<<8) − 0x96) × 128 + (b18 >> 1)`.
6. Sort by tick and match to MIDI note groups for validation.

**Diagnostic tool:** `scripts/dump-sequ.py` — dumps all type-103 records from a `.aif`
alongside MIDI note groups for cross-referencing.

**Production implementation:** `src/lib/apple-loops-parser.ts` —
`extractChordEventsFromSequ()` and `appleLoopEventsToLeadsheet()`.

---

## License / attribution

This is reverse‑engineering documentation produced from empirical tests on files generated
by GarageBand and Logic Pro. It does not contain Apple proprietary code.
If you publish derivatives, keep the "known vs inferred" separation clear to avoid
propagating incorrect assumptions.
