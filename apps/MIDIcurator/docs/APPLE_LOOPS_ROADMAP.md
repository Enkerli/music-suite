# Apple Loops Integration Roadmap

## Overview
This document outlines the next steps for enhancing Apple Loops integration in MIDIcurator, focusing on timing adjustments, chord recognition, database metadata, and MIDI export.

## Current Status ✅

- [x] Parse AIFF/CAF containers
- [x] Extract chord events from Sequ chunks
- [x] Decode intervals correctly (little-endian masks)
- [x] Format chord symbols consistently (104 qualities)
- [x] Preserve correct chord order
- [x] Display chords in ChordBar UI
- [x] Convert events to Leadsheet structure

## Phase 1: Chord Timing Adjustments 🎯

### Current Behavior
All chords from Apple Loop metadata display at beat 0.00 (first position in bar), regardless of their actual timing. For example:
- `Waves of Nostalgia Pattern.aif` shows: `F-B♭-7F-B♭-7F-B♭-7F-B♭-7|NC|NC|...`
- Editing reveals: `F- | B♭-7 | F- | B♭-7 | F- | B♭-7 | F- | B♭-7`
- After pressing Enter: distributes one chord per bar (close to original, but needs shifting)

### Goal
Enable users to adjust chord timing (harmonic rhythm) to match the actual loop structure.

### Implementation Strategy

**1. UI for Chord Timing Adjustment**
- Add "Adjust Chord Timing" mode to LeadsheetInput
- Display draggable dividers between chords
- Visual feedback showing beat positions (0, 1, 2, 3 for 4/4)
- Snap to common divisions: whole, half, quarter, eighth notes

**2. Data Structure**
```typescript
interface LeadsheetChord {
  chord: DetectedChord | null;
  inputText: string;
  position: number;      // Index within bar (0, 1, 2, 3...)
  totalInBar: number;    // Total chords in this bar
  beatPosition?: number; // NEW: Exact beat position (0.0-4.0)
  duration?: number;     // NEW: Duration in beats
}
```

**3. Timing Editor Features**
- Click-and-drag dividers to adjust chord boundaries
- Keyboard shortcuts: `,` and `.` to nudge left/right
- "Quantize" button to snap to common divisions
- "Even Distribution" button to space chords equally
- Display timing in both beats and bars

**4. Persistence**
- Store timing in MCURATOR metadata
- Round-trip: export to MIDI, import preserves timing
- Compare with original be22 values for learning

### User Personas
- **Jordan**: Rarely needs this (algorithmic workflows)
- **Aïcha**: Frequently uses this (Pattern loops, harmonic rhythm matters)
- **Sam**: Occasionally uses this (Session Player loops)
- **Riley**: Should be able to use this (accessible UI)

### Success Criteria
- User can adjust chord timing by dragging dividers
- Timing persists through export/import
- UI is accessible and intuitive
- Works for both Apple Loop metadata and manual entry

---

## Phase 2: Expanded Chord Recognition 🎼

### Current Limitation
Some chord structures aren't recognized by the 104-quality dictionary. Example:
- `[0,4,7,8,11]` = maj7(♭13) - **NOT RECOGNIZED**
- Logic Pro labels this as "(maj7,♭13)"

### Strategy

**1. Accumulate Unrecognized Structures**
Create a database/file to track unrecognized chord patterns:

```typescript
// unrecognized-chords.json
{
  "patterns": [
    {
      "intervals": [0, 4, 7, 8, 11],
      "occurrences": 15,
      "files": ["Waves.aif", "Pattern.aif", ...],
      "logicProLabel": "maj7,♭13",
      "proposedSymbol": "∆(♭13)"
    },
    // ... more patterns
  ]
}
```

**2. Auto-log Unrecognized Patterns**
```typescript
function logUnrecognizedChord(intervals: number[], filename: string) {
  // Append to unrecognized-chords.json
  // Track frequency and source files
}
```

**3. Generate Extended Dictionary**
Use Logic Pro's chord editor labels as a reference:
- maj, min, sus2, sus4, 5, aug, dim
- ♭5, ♯5, 6, 7, maj7
- ♭9, 9, ♯9, 11, ♯11, ♭13, 13

Build all combinations programmatically:
```typescript
const baseQualities = ['maj', 'min', '7', 'maj7', 'dim', 'aug'];
const extensions = ['♭9', '9', '♯9', '11', '♯11', '♭13', '13'];
const alterations = ['♭5', '♯5'];

// Generate: maj(♭13), maj7(♭13), 7(♭9,♭13), etc.
```

**4. Chord Equivalencies**
Handle alternate spellings:
- 6 ↔ min7 (inversions)
- 9 ↔ add9 (vs. full stack)
- ♯11 ↔ ♭5 (context-dependent)

### Success Criteria
- Recognize 200+ chord qualities (up from 104)
- Log unrecognized patterns automatically
- Provide fallback to "Root[intervals]" when needed
- Match Logic Pro labeling where possible

---

## Phase 3: Local Database Integration 💾

### Goal
Import metadata from `LogicLoopsDatabaseV11.db` to enrich Apple Loop clips.

### Database Schema (SQLite)
```sql
-- Key fields from LogicLoopsDatabaseV11.db
SELECT
  id,
  title,
  fileName,          -- Unique identifier (mostly)
  fileURL,
  fileType,
  gbLoopType,
  hasMidi,
  hasChords,
  tempo,
  key,
  keyType,           -- Major/Minor
  numberOfBeats,
  timeSignatureTop,
  timeSignatureBottom,
  lengthInSeconds,
  instrumentType,
  instrumentSubType,
  genre,
  descriptors,       -- Tags/categories
  author,
  copyright,
  comment,
  jamPack
FROM loops;
```

### Implementation Options

**Option A: One-time Export**
User runs a query to export metadata:
```bash
sqlite3 ~/Library/Audio/Apple\ Loops/Index/LogicLoopsDatabaseV11.db \
  ".mode json" \
  "SELECT * FROM loops WHERE hasMidi=1" \
  > apple-loops-metadata.json
```

Then import into MIDIcurator's IndexedDB.

**Option B: File-by-File Lookup**
After importing an Apple Loop file:
1. Extract filename from `.aif` file
2. Look up in metadata JSON by `fileName`
3. Populate clip metadata

**Option C: Batch Processing**
UI feature: "Import Apple Loops Metadata"
- User selects `apple-loops-metadata.json`
- App matches imported clips by filename
- Updates all matching clips with metadata

### Metadata Storage in Clip
```typescript
interface Clip {
  // ... existing fields
  appleLoopMetadata?: {
    id: string;
    title: string;
    tempo: number;
    key: string;
    keyType: 'major' | 'minor';
    timeSignature: [number, number];
    instrumentType: string;
    instrumentSubType: string;
    genre: string;
    descriptors: string[];
    author: string;
    copyright: string;
    jamPack?: string;
  };
}
```

### UI Display
Add metadata section to ClipDetail:
```
📀 Apple Loop Info
Title: Waves of Nostalgia
Instrument: Piano / Grand Piano
Genre: Pop
Key: F minor
BPM: 120
Tags: Atmospheric, Nostalgic, Pattern

⚠️ Copyright: © Apple Inc.
Warning: This is a first-party Apple Loop. Do not share publicly.
```

### Success Criteria
- Metadata enriches imported Apple Loop clips
- Copyright info displayed prominently
- User can filter/search by metadata
- Works for both first-party and user-generated loops

---

## Phase 4: MIDI Metadata Export 💿

### Goal
Ensure all Apple Loop metadata persists through MIDI export/import cycles.

### MCURATOR Metadata Format
Already supports:
- `clipNotes` (text field)
- `leadsheetText` (chord symbols)
- `variantOf` (source filename)
- `boundaries` (segmentation)

Need to add:
```
MCURATOR_APPLE_LOOP_ID: <unique-id>
MCURATOR_APPLE_LOOP_TITLE: <title>
MCURATOR_APPLE_LOOP_COPYRIGHT: <copyright>
MCURATOR_APPLE_LOOP_INSTRUMENT: <type/subtype>
MCURATOR_APPLE_LOOP_GENRE: <genre>
MCURATOR_APPLE_LOOP_DESCRIPTORS: <tag1,tag2,tag3>
MCURATOR_APPLE_LOOP_KEY: <key>
MCURATOR_APPLE_LOOP_KEY_TYPE: <major/minor>
```

### Copyright Warning
When exporting Apple Loop-derived clips:
```
┌─────────────────────────────────────────┐
│ ⚠️  Copyright Notice                    │
├─────────────────────────────────────────┤
│ This clip is derived from a first-party │
│ Apple Loop (© Apple Inc.).              │
│                                         │
│ Sharing this file publicly may violate │
│ copyright restrictions.                 │
│                                         │
│ [ Export Anyway ]  [ Cancel ]          │
└─────────────────────────────────────────┘
```

### Round-trip Test
1. Import `Pattern.aif` (Apple Loop)
2. Metadata populated from DB
3. Edit leadsheet/timing
4. Export to `.mid`
5. Re-import `.mid`
6. ✅ All metadata preserved

### Success Criteria
- All Apple Loop metadata survives export/import
- Copyright warnings prevent accidental sharing
- MIDI files are self-contained (no external DB needed)
- User-generated loops treated separately from first-party

---

## Implementation Priority

### Sprint 1: Timing Adjustment (High Priority)
Most impactful for Pattern loops and Session Players. Required before Phase 2/3/4 become useful.

**Tasks:**
1. Add `beatPosition` and `duration` to LeadsheetChord
2. Build timing editor UI (draggable dividers)
3. Store timing in MCURATOR metadata
4. Test with representative Apple Loops

**User Stories:**
- As Aïcha, I want to adjust chord timing to match my Pattern loops
- As Sam, I want harmonic rhythm to reflect my Session Player loops
- As Riley, I want an accessible UI for timing adjustment

### Sprint 2: Chord Recognition (Medium Priority)
Expands coverage and reduces "Root[intervals]" fallbacks.

**Tasks:**
1. Implement auto-logging of unrecognized chords
2. Generate extended dictionary (200+ qualities)
3. Add maj7(♭13) and other Logic Pro combinations
4. Handle chord equivalencies

### Sprint 3: Database Integration (Medium Priority)
Enriches clips with production metadata.

**Tasks:**
1. Export query for LogicLoopsDatabaseV11.db
2. Build filename-based lookup
3. Add appleLoopMetadata to Clip type
4. Display metadata in ClipDetail
5. Add copyright warnings

### Sprint 4: MIDI Export (Low Priority)
Ensures metadata persistence.

**Tasks:**
1. Extend MCURATOR format with Apple Loop fields
2. Add copyright warning dialog
3. Round-trip testing

---

## Future Enhancements

### Batch Apple Loop Conversion
Convert all first-party MIDI-compatible Apple Loops to user `.aif` format:
- Preserves Sequ chunks
- Adds metadata
- Enables curation at scale

### Key Context for Chord Spelling
Use `appleLoopMetadata.key` to improve enharmonic spelling:
- F♯ in F♯ major (not G♭)
- B♭ in B♭ major (not A♯)

### Auto-Tagging
Use descriptors from database for auto-tagging:
- "atmospheric" → tag
- "nostalgic" → tag
- "pattern" → tag

### Chord Progression Templates
Extract common progressions from Apple Loops:
- ii-V-I in various keys
- I-vi-IV-V patterns
- Modal progressions

---

## Notes

**On Timing:**
> "The leadsheet-style chordbar is like an intention. So it'd be perfectly fine to have just a few bass notes in an Apple Loop with a full chord progression. There might even be chords without corresponding notes in the clip."

This is a key insight. The leadsheet is the **harmonic map**, while the MIDI is the **realization**. They're related but independent.

**On Personas:**
- Jordan: Algorithm-focused, rarely adjusts timing
- Aïcha: Pattern loops, harmonic rhythm matters
- Sam: Session Players, occasional timing adjustments
- Riley: Needs accessible UI

**On Chord Equivalencies:**
> "Had a whole thing, with that chord dictionary, about chord equivalencies, such as 6 chords being inversions of 7 chords."

This is important for chord recognition. We may need a "chord normalization" step that treats equivalent structures as the same chord.

---

## Open Questions

1. **Timing precision**: Should we support sixteenth-note divisions, or stick to eighth notes?
2. **Chord conflicts**: What if user timing conflicts with Apple Loop metadata?
3. **Database location**: Is the DB path always `~/Library/Audio/Apple Loops/Index/`?
4. **Copyright scope**: Do user-generated loops need copyright warnings?
5. **Export format**: Should we support exporting Apple Loop metadata back to `.aif`?
