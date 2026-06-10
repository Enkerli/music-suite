# MIDIcurator — Roadmap & Prioritized Next Steps

*Updated 2026-02-10. Previous segmentation plan (Phases A–D) is complete.*

---

## Done (Segmentation)

All phases shipped in commit `ad2f711`:
- **Phase A**: Clip-level `Segmentation` type, MCURATOR v1 MIDI metadata
  (marker + JSON text events), round-trip import/export
- **Phase B**: Scissors tool (S key), boundary snapping, click-to-cut,
  Shift+click/right-click to remove
- **Phase C**: `detectChordsForSegments()` with sustained-note inclusion,
  segment-aware ChordBar rendering, reanalysis on every boundary change
- **Phase D**: Draggable boundaries (click-drag in scissors mode),
  sustained notes attributed to segments where they're sounding

---

## Prioritized Next Steps

### Tier 1 — Quick Wins ✅ Done

All shipped in commits `e1c6e70`, `d41a2bc`, `641fbe6`:
- **1.1** Empty segments display "–" — removed resonance from
  `detectChordsForSegments()` for explicitly segmented clips
- **1.2** Keyboard navigation — Up/Down for clips, Left/Right for segments
- **1.3** Auto-tag single-chord clips — clips with ≤5 PCs get
  "single-chord" + chord symbol tags on import
- **1.4** Clickable tags — click a tag to filter the clip list
- **1.5** Tag-aware search — filter searches both filenames and tags

---

### Tier 2 — Medium Effort, High Value

#### 2.1 Dual ChordBar: "realized" + "underlying" (competence/performance)
**Status**: Spec complete → ready to implement
**Effort**: ~4.5h
**Spec**: [`docs/SPEC-LEADSHEET-BAR.md`](docs/SPEC-LEADSHEET-BAR.md)
**Files**: New `src/lib/leadsheet-parser.ts`,
  `src/components/LeadsheetBar.tsx`, `src/types/clip.ts`,
  `src/components/ClipDetail.tsx`, `src/lib/midi-export.ts`,
  `src/lib/midi-parser.ts`

Two layers of harmonic annotation:

1. **Realized** (current ChordBar): what's actually played, MIDI-time
   proportional. Already implemented.

2. **Underlying** (new LeadsheetBar): bar-quantized chord symbols
   entered manually via pipe-delimited text:
   `Fm7 | Am7 D7 | Abm7 Db7 | Bbm7 Eb7`

   Conventions (iReal Pro–inspired):
   - `|` bar delimiter, space-separated chords (equal time division)
   - `%` or `-` repeat previous bar, `NC` no chord
   - All 104 chord qualities supported via existing `parseChordSymbol()`
   - Slash bass (`Am7/G`) deferred to v2

Implementation order: types → parser + tests → component → integration
→ CSS → MIDI round-trip. See spec for full details.

#### 2.2 Enharmonic spelling by chord role
**Status**: Known issue / research
**Effort**: ~4–8h (potentially complex)
**Files**: `src/lib/chord-dictionary.ts`, `src/lib/chord-detect.ts`,
  new `src/lib/spelling.ts`

Current problem: "E♭° diminished triad" is spelled "E♭ F♯ A" — the F♯
should be G♭ (minor third, not augmented second).

This requires a spelling engine that:
- assigns note names based on **interval function within the chord**
  (root, third, fifth, seventh, etc.)
- uses flats/sharps consistently per chord context
- handles edge cases (augmented sixths, enharmonic pivot chords)

Approach:
- Each chord quality defines a **spelling template** (intervals from root
  as letter-name offsets, not just semitones)
- Root name + template → spelled note names
- Extras/NCTs spelled by nearest diatonic interpretation

**Flag**: This has been complicated in prior work. Consider phasing it
alongside the dual ChordBar (§2.1) and an external validation/testing
phase. The underlying chord layer would provide context for correct
spelling of realized notes.

---

### Tier 3 — Larger Features (high value, higher effort)

#### 3.1 Auto-segmentation hints
**Effort**: ~3–4h
Detect likely chord changes by pitch-class transitions. Display as
dimmed guide lines on the piano roll. User can accept/reject.

#### 3.2 Segment info in StatsGrid
**Effort**: ~1h
Show segment count and chord progression summary in the stats panel.

#### 3.3 Timeline zoom
**Effort**: ~3–4h
Zoom the piano roll timeline. Essential for segmentation precision with
dense patterns. See `docs/OPEN_NOTES.md §7.1`.

---

### Tier 4 — Wishlist / Future ("smidgen" territory)

#### 4.1 Chord paint tool (arp shape)
Create melodic patterns that follow chord tones: user draws a shape
(up/down, note durations quantized to grid), tool fills in pitches from
the current segment's chord. Exists in some DAWs but could be done
better.

#### 4.2 Chord roller tool (pads)
"Paint roller" that fills a segment with the full chord as a pad (all
notes sounding together for the segment duration). Opposite of
arpeggiation. Useful for quickly hearing the harmonic content.

#### 4.3 Functional harmony layer
Roman numeral analysis, T/PD/D classification, cross-key concordance.
Depends on §2.1 (underlying chord layer) and §2.2 (correct spelling).
See `docs/OPEN_NOTES.md §2`.

#### 4.4 Concordance analysis of melodic patterns
Intervallic, functional, and pitch-class concordance.
See `docs/OPEN_NOTES.md §1`.

#### 4.5 iPadOS touch support
Selection and segmentation don't work reliably on iPadOS.
See `docs/OPEN_NOTES.md §7.2`.

---

## Research Notes

### Apple Loops chord metadata
**Finding**: Apple Loops (.caf/.aiff) store **key + scale type** (Major,
Minor, Neither, Both) in the `basc` AIFF chunk (2 bytes each at offsets
0x08–0x0B), plus tempo, time signature, and beat count. There is **no
per-bar chord progression metadata** in the Apple Loops format. Logic
Pro's chord display for Apple Loops appears to be derived from real-time
analysis, not from embedded tags.

The `trns` chunk stores transient markers (sample-frame positions), and
`cate` stores categorization. None of these carry chord-level data.

Sources:
- [Reverse Engineering Apple Loops](https://apmatthews.tumblr.com/post/73069916661/reverse-engineering-apple-loops)
- [Notes for Apple Loops Developers](https://developer.apple.com/library/archive/documentation/AppleApplications/Conceptual/ALU_Notes/ALU%20Notes/ALU%20Notes.html)

**Implication**: MCURATOR's MIDI metadata approach (marker + JSON text
events) is already more expressive than Apple's format for chord
annotation. No need to emulate Apple Loops' metadata scheme.

### Leadsheet chord input formats
**Finding**: Surveyed iReal Pro, ChordPro, MusicXML, Band-in-a-Box, and
Nashville Number System. The consensus format for compact chord charts
is pipe-delimited bars with space-separated chords (equal time division),
`%` for repeat, `NC` for no-chord. This matches iReal Pro conventions
and is widely understood by musicians.

The existing `parseChordSymbol()` handles root + quality for all 104
dictionary entries. Only `/Bass` notation (slash chords) is missing
and deferred.

Full spec: [`docs/SPEC-LEADSHEET-BAR.md`](docs/SPEC-LEADSHEET-BAR.md)

---

## Design Principles (reminders)

- **Curation over production** — not a DAW
- **Analysis is assistive, not authoritative** — users override
- **Accuracy matters** — correct spellings and labels are what distinguish
  useful learning tools from offhand demos
- **Preserve meaning before optimizing mechanism**
