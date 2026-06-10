# Apple Loops Testing Guide

This guide covers testing the Apple Loops import functionality with real Apple Loop files.

## Test Files

### First-Party Loops
- **Modern Mystic FX.caf** — Apple-provided loop from GarageBand/Logic

### User-Generated Test Loops
The `LpTm*.aif` series tests chord transition timing accuracy:

- **LpTmA1.aif, A2** — Test set A (chord timing case 1)
- **LpTmB1.aif, B2** — Test set B (chord timing case 2)
- **LpTmC1.aif, C2** — Test set C (chord timing case 3)
- **LpTmD1.aif, D2, D3, D4** — Test set D (chord timing case 4)
- **LpTmE1.aif, E2, E3, E4, E5, E6, E7** — Test set E (chord timing case 5)

## Analysis Tools

### 1. Analyze Apple Loop Files

Extract all metadata from Apple Loop files:

```bash
# Single file
node scripts/analyze-apple-loops.mjs "Modern Mystic FX.caf"

# Multiple files
node scripts/analyze-apple-loops.mjs LpTm*.aif

# All loops
node scripts/analyze-apple-loops.mjs *.aif *.caf
```

**Output includes:**
- Container format (AIFF/AIFC/CAF)
- File size
- Embedded MIDI presence and size
- All chunk types found in the container
- Chord events with timing and interval data
- MIDI track count and PPQ

### 2. Explore Logic Loops Database

The Logic Loops Database (`LogicLoopsDatabaseV11.db`) contains metadata for all Apple Loops:

```bash
# Use default path (~Music/Audio Music Apps/Databases/LogicLoopsDatabaseV11.db)
bash scripts/explore-logic-db.sh

# Or specify path
bash scripts/explore-logic-db.sh ./LogicLoopsDatabaseV11.db
```

**Output includes:**
- Database schema (all tables and columns)
- Chord-related fields across all tables
- Sample data from metadata tables
- Lookup results for test files

## Testing Workflow

### Step 1: Analyze Raw Files

First, analyze the raw Apple Loop files to see what metadata we can extract directly:

```bash
# Analyze all test loops
node scripts/analyze-apple-loops.mjs LpTm*.aif "Modern Mystic FX.caf" > apple-loops-analysis.txt

# Review the output
less apple-loops-analysis.txt
```

**What to look for:**
- Are chord events present?
- How many chord events per file?
- What are the beat positions (do they match expected bar positions)?
- What intervals are encoded (do they match the chords you hear)?
- Are the `b8`/`b9` fields consistent (potential root encoding)?

### Step 2: Cross-Reference with Logic Database

Compare the extracted data with what's in the Logic database:

```bash
# Explore the database structure
bash scripts/explore-logic-db.sh > logic-db-schema.txt

# Review the schema
less logic-db-schema.txt
```

**What to look for:**
- Tables containing file references (filename, path, UUID)
- Tables containing chord/key/scale metadata
- Tables containing timing/tempo/beat metadata
- Any binary blob fields that might contain Sequ data

### Step 3: Import into MIDIcurator

Test the full import pipeline:

1. Start the MIDIcurator web app:
   ```bash
   npm run dev
   ```

2. Open http://localhost:5173

3. Drag and drop one or more Apple Loop files (.aif/.caf)

4. Verify:
   - Clip appears in sidebar
   - Tagged with "apple-loop"
   - Notes field contains chord timeline (if chord events present)
   - MIDI data extracted correctly (check piano roll)
   - Playback works

### Step 4: Compare Detected Chords

MIDIcurator's chord detection engine will analyze the extracted MIDI notes. Compare:

- **Apple Loop chord events** (interval sets from Sequ payload) — shown in clip notes
- **MIDIcurator detected chords** (from MIDI note analysis) — shown in ChordBar

**Questions:**
- Do the detected chords match the interval sets?
- Can we use the interval sets to improve detection?
- Do the timing positions align?

## Expected Results

### Modern Mystic FX.caf
- **Format:** CAF
- **Embedded MIDI:** Likely present (most Apple Loops have MIDI)
- **Chord events:** May or may not be present (depends on loop type)
- **Use case:** Validates CAF parsing, real-world first-party loop

### LpTm Series
- **Format:** AIFF
- **Embedded MIDI:** Present (user-generated)
- **Chord events:** Present with precise timing
- **Use case:**
  - Validates chord timing extraction accuracy
  - Tests edge cases (multiple chords per bar, syncopation, etc.)
  - Helps reverse-engineer `b8`/`b9` root encoding

## Debugging Chord Timing

The `LpTm` series is specifically designed to test chord transition timing. When analyzing these files:

1. **Check beat positions:** Do the `positionBeats` values align with expected bar positions (0.0, 1.0, 2.0, 3.0 for 4/4)?

2. **Check be22 values:** Are there patterns in the raw `be22` field that correlate with known positions?

3. **Check b8/b9 fields:** Do these values correlate with:
   - The root note of the chord?
   - The key of the loop?
   - The position index?

4. **Compare across series:**
   - Do A1 and A2 share similar patterns?
   - How do D1, D2, D3, D4 differ (if they're variations)?

## Root Detection Strategy

Since absolute chord roots are not yet decoded from `b8`/`b9`, we currently:

1. Extract interval sets (which are reliable)
2. Use MIDIcurator's chord detection on the MIDI notes
3. Store both in the clip notes for future analysis

**To help crack root encoding:**

```bash
# Analyze all test loops and save output
node scripts/analyze-apple-loops.mjs LpTm*.aif > lptm-analysis.txt

# Look for patterns in b8/b9 fields
grep "b8=" lptm-analysis.txt | sort | uniq -c
grep "b9=" lptm-analysis.txt | sort | uniq -c
```

If you know the expected roots for these test loops, correlate the `b8`/`b9` values with the known roots to find the encoding scheme.

## Integration with Local Database

Once you understand the Logic database schema, you can:

1. Query the database for metadata by filename
2. Cross-reference UUIDs or file paths
3. Extract additional metadata (tags, categories, BPM, key signature)
4. Augment MIDIcurator clips with Logic metadata on import

Example query (assuming table structure):

```sql
-- Find all loops with chord metadata
SELECT filename, key_signature, root_note, scale_type
FROM loops
WHERE chord_data IS NOT NULL;
```

## Next Steps

1. **Analyze test files** using the scripts above
2. **Document findings** (especially `b8`/`b9` patterns)
3. **Compare with Logic database** to validate metadata
4. **Update parser** if root encoding is cracked
5. **Add automated tests** for known test loops

## Troubleshooting

### "Database not found"
- Copy `LogicLoopsDatabaseV11.db` to repo root, or
- Run `explore-logic-db.sh` with full path to database

### "No chord events found"
- Not all Apple Loops have chord metadata
- Try the `LpTm` series (guaranteed to have chord events)

### "No embedded MIDI"
- Some audio-only loops don't have MIDI
- Check the file in GarageBand/Logic to confirm

### Chord timing seems off
- Apple Loop timing is in "beats within bar" (0.0–4.0 for 4/4)
- MIDIcurator timing is in absolute ticks
- The conversion uses `beatsPerBar` (currently hardcoded to 4)

## References

- [Apple Loops Reverse Engineering](./APPLE_LOOPS_REVERSE_ENGINEERING.md) — Format spec
- [Logic Pro Loop Browser](https://support.apple.com/guide/logicpro/loop-browser-lgcp7fe02a08/mac) — Official docs
- [MIDIcurator Import Flow](../src/components/MidiCurator.tsx#L242) — Source code
