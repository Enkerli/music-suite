# Dual ChordBar Spec: Leadsheet Layer (Tier 2.1)

*Spec prepared 2026-02-09. Companion to PLAN.md §2.1.*

---

## 1. Concept

MIDIcurator currently shows a single **realized ChordBar** — chords
detected from MIDI note data, proportional to MIDI time. This spec adds
a second **leadsheet bar** showing the _intended_ harmony: manually
entered, bar-quantized chord symbols, like a lead sheet.

### Why two layers?

| Layer | Shows | Source | Timing |
|-------|-------|--------|--------|
| **Realized** (existing ChordBar) | What's actually played | Auto-detected from MIDI | MIDI-time proportional |
| **Underlying** (new LeadsheetBar) | What the harmony _is_ | User-entered text | Bar-quantized (equal division) |

The underlying layer enables:
- **NCT identification**: notes outside the underlying chord are non-chord
  tones (passing, neighbour, approach, etc.)
- **Extension analysis**: compare realized pitch classes against the
  underlying chord template to identify extensions vs. NCTs
- **Functional analysis** (future §4.3): Roman numerals, T/PD/D, key
  relationships — all require knowing the _intended_ harmony
- **Comparison workflow**: "what was meant" vs. "what was played"

---

## 2. Text Input Format

### 2.1 Syntax (iReal Pro–inspired)

```
Fm7 | Am7 D7 | Abm7 Db7 | Bbm7 Eb7 |
```

**Bar delimiter**: `|` (pipe)
**Chords within a bar**: space-separated, equal time division
**Trailing `|`**: optional (ignored if present)

### 2.2 Special tokens

| Token | Meaning | Example |
|-------|---------|---------|
| `%` | Repeat previous bar | `Fm7 \| % \| Bbm7 \| %` |
| `-` | Synonym for `%` (hold previous) | `Fm7 \| - \| Bbm7 \| -` |
| `NC` | No chord (silence/rest) | `Cm7 \| NC \| Fm7 \| G7` |
| *(empty)* | Empty bar = NC | `Cm7 \| \| Fm7 \| G7` |

### 2.3 Chord symbols

All symbols parseable by the existing `parseChordSymbol()` in
`src/lib/chord-parser.ts`:

- Roots: `A`–`G` with `#`, `b`, `♯`, `♭`
- Qualities: all 104 entries in chord-dictionary.ts + aliases
  (`m`, `min`, `-`, `7`, `maj7`, `∆`, `dim`, `°`, `aug`, `+`,
   `m7`, `-7`, `m7b5`, `ø`, `sus4`, `9`, `13`, `add9`, `6`, etc.)

### 2.4 Slash bass chords (future enhancement)

Format: `Am7/G`, `C/E`. The `/Bass` suffix is **not yet supported** by
`parseChordSymbol()`. The parser will need a minor extension:
1. Split on `/` after quality extraction
2. Parse the bass note as a root (letter + accidental)
3. Store as `bassNote` field on the parsed result

For v1, slash bass is **deferred** — the parser strips `/…` and logs a
warning. The underlying chord is still identified correctly by root +
quality.

---

## 3. Data Model

### 3.1 New types (`src/types/clip.ts`)

```typescript
/** A single chord in the leadsheet layer, bar-quantized. */
export interface LeadsheetChord {
  /** Parsed chord, or null for NC */
  chord: DetectedChord | null;
  /** Original input text (preserved for round-trip fidelity) */
  inputText: string;
  /** Position within bar: 0 = first chord, 1 = second, etc. */
  position: number;
  /** Total chords in this bar (determines time fraction: 1/total) */
  totalInBar: number;
}

/** Per-bar leadsheet annotation. */
export interface LeadsheetBar {
  /** Bar index (0-based, matching BarChordInfo.bar) */
  bar: number;
  /** Chords in this bar (1–4 entries, equal time division) */
  chords: LeadsheetChord[];
  /** True if this bar is a repeat of the previous bar (from '%' or '-') */
  isRepeat: boolean;
}

/** Full leadsheet annotation for a clip. */
export interface Leadsheet {
  /** Raw input text (for editing round-trip) */
  inputText: string;
  /** Parsed per-bar data */
  bars: LeadsheetBar[];
}
```

### 3.2 Clip extension

```typescript
export interface Clip {
  // ... existing fields ...
  /** Leadsheet (underlying chord) annotation, manually entered. */
  leadsheet?: Leadsheet;
}
```

### 3.3 Relationship to existing types

- `LeadsheetChord.chord` reuses `DetectedChord` (same type as bar
  chords, segment chords, etc.)
- `LeadsheetBar.bar` aligns with `BarChordInfo.bar` by index
- The leadsheet is **independent** of segmentation boundaries — it's
  bar-quantized, not tick-quantized

---

## 4. Parser: `parseLeadsheet()`

New file: `src/lib/leadsheet-parser.ts`

```typescript
import { parseChordSymbol } from './chord-parser';
import type { DetectedChord } from '../types/clip';
import type { Leadsheet, LeadsheetBar, LeadsheetChord } from '../types/clip';

/**
 * Parse a leadsheet text input into structured bar data.
 *
 * Format: "Fm7 | Am7 D7 | Abm7 Db7 | Bbm7 Eb7"
 *
 * @param input  Pipe-delimited leadsheet text
 * @param numBars  Expected number of bars (from clip). Bars beyond this
 *                 are truncated; missing bars are filled with NC.
 */
export function parseLeadsheet(input: string, numBars: number): Leadsheet {
  const rawBars = input.split('|').map(s => s.trim());

  // Remove empty trailing entry from trailing pipe
  if (rawBars.length > 0 && rawBars[rawBars.length - 1] === '') {
    rawBars.pop();
  }
  // Remove empty leading entry from leading pipe
  if (rawBars.length > 0 && rawBars[0] === '') {
    rawBars.shift();
  }

  const bars: LeadsheetBar[] = [];
  let prevBar: LeadsheetBar | null = null;

  for (let i = 0; i < Math.max(rawBars.length, numBars); i++) {
    const raw = i < rawBars.length ? rawBars[i]!.trim() : '';

    // Repeat token
    if (raw === '%' || raw === '-') {
      const repeated = prevBar
        ? { ...prevBar, bar: i, isRepeat: true }
        : { bar: i, chords: [], isRepeat: true };
      bars.push(repeated);
      prevBar = repeated;
      continue;
    }

    // NC or empty
    if (raw === '' || raw.toUpperCase() === 'NC') {
      const ncBar: LeadsheetBar = {
        bar: i,
        chords: [{
          chord: null,
          inputText: raw || 'NC',
          position: 0,
          totalInBar: 1,
        }],
        isRepeat: false,
      };
      bars.push(ncBar);
      prevBar = ncBar;
      continue;
    }

    // Split on whitespace for multiple chords per bar
    const tokens = raw.split(/\s+/).filter(Boolean);
    const chords: LeadsheetChord[] = tokens.map((token, j) => {
      const parsed = parseChordSymbol(token);
      return {
        chord: parsed,
        inputText: token,
        position: j,
        totalInBar: tokens.length,
      };
    });

    const bar: LeadsheetBar = { bar: i, chords, isRepeat: false };
    bars.push(bar);
    prevBar = bar;
  }

  // Truncate to numBars
  const truncated = bars.slice(0, numBars);

  return { inputText: input, bars: truncated };
}

/**
 * Serialize a Leadsheet back to pipe-delimited text.
 * Inverse of parseLeadsheet().
 */
export function serializeLeadsheet(leadsheet: Leadsheet): string {
  return leadsheet.bars.map(bar => {
    if (bar.isRepeat) return '%';
    if (bar.chords.length === 0) return 'NC';
    if (bar.chords.length === 1 && !bar.chords[0]!.chord) return 'NC';
    return bar.chords.map(c => c.inputText).join(' ');
  }).join(' | ');
}
```

### 4.1 Validation

- Unparseable chord tokens → `LeadsheetChord.chord = null` but
  `inputText` preserved (shown with error styling)
- Bar count mismatch warning if `rawBars.length !== numBars`
- No hard failure — partial input is always accepted

---

## 5. Component: `LeadsheetBar`

New file: `src/components/LeadsheetBar.tsx`

### 5.1 Layout

Rendered **above** the existing ChordBar (realized), creating a
two-row chord display:

```
┌──────────────────────────────────────────────────────────┐
│  Fm7       │  Am7    D7  │  Abm7  Db7  │  Bbm7  Eb7   │  ← Leadsheet (underlying)
├──────────────────────────────────────────────────────────┤
│  F-7       │  A-7  D7    │  A♭-7  D♭7  │  B♭-7  E♭7   │  ← Realized (existing ChordBar)
├──────────────────────────────────────────────────────────┤
│  ░░░░░░░░░ piano roll ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
```

### 5.2 Props

```typescript
interface LeadsheetBarProps {
  leadsheet: Leadsheet;
  ticksPerBar: number;
  totalTicks: number;
  numBars: number;
  /** Callback when user clicks a bar cell to edit it */
  onBarClick?: (barIndex: number) => void;
}
```

### 5.3 Rendering rules

- Each bar occupies `(ticksPerBar / totalTicks) * 100%` width
  (same formula as existing ChordBar)
- Within a bar: chords equally split the bar width
- NC bars: show "NC" in dimmed text
- Repeat bars: show `%` symbol
- Invalid (unparseable) chords: show input text with error class
  (`.mc-leadsheet-chord--invalid`)
- Empty leadsheet: show nothing (component returns null)

### 5.4 Inline editing

- **Single text input** below the LeadsheetBar (full progression)
- On focus: show the current `inputText` in an editable field
- On Enter/blur: parse and update
- Alternative: click a bar cell → edit just that bar (v2)

### 5.5 CSS classes

```
.mc-leadsheet-bar             — container (same width as .mc-chord-bar)
.mc-leadsheet-cell            — single bar cell
.mc-leadsheet-cell--nc        — no-chord cell
.mc-leadsheet-cell--repeat    — repeat (%) cell
.mc-leadsheet-cell--invalid   — contains unparseable chord
.mc-leadsheet-chord           — individual chord symbol within cell
.mc-leadsheet-input           — text input for the full progression
```

---

## 6. Integration Points

### 6.1 `ClipDetail.tsx`

Add LeadsheetBar between the toolbar and the realized ChordBar:

```tsx
{/* Leadsheet (underlying) — above realized chords */}
{clip.leadsheet && (
  <LeadsheetBar
    leadsheet={clip.leadsheet}
    ticksPerBar={clip.gesture.ticks_per_bar}
    totalTicks={totalTicks}
    numBars={clip.gesture.num_bars}
    onBarClick={...}
  />
)}

{/* Leadsheet text input */}
<LeadsheetInput
  value={clip.leadsheet?.inputText ?? ''}
  numBars={clip.gesture.num_bars}
  onSubmit={handleLeadsheetChange}
/>

{/* Realized chords (existing) */}
<ChordBar ... />
```

### 6.2 `MidiCurator.tsx`

New handler for leadsheet changes:

```typescript
const handleLeadsheetChange = useCallback(async (inputText: string) => {
  if (!selectedClip || !db) return;
  const leadsheet = parseLeadsheet(inputText, selectedClip.gesture.num_bars);
  const updated: Clip = { ...selectedClip, leadsheet };
  await db.updateClip(updated);
  setSelectedClip(updated);
  refreshClips();
}, [selectedClip, db, refreshClips]);
```

### 6.3 MIDI export round-trip

Add leadsheet data to the MCURATOR metadata in `midi-export.ts`:

**Export** (in `buildMetadataEvents`):
```typescript
// After file-level JSON, emit leadsheet text event at tick 0
if (leadsheet) {
  const lsJson = JSON.stringify({
    type: 'leadsheet',
    text: leadsheet.inputText,
    bars: leadsheet.bars.length,
  });
  metaEvents.push({
    tick: 0,
    data: encodeTextMeta(0x01, `MCURATOR:v1 ${lsJson}`),
  });
}
```

**Import** (in `extractMcuratorSegments` / new function):
- Parse text events at tick 0 looking for `type: 'leadsheet'`
- Extract `text` field, call `parseLeadsheet()` to reconstruct

### 6.4 IndexedDB

No schema change needed — `leadsheet` is stored as part of the `Clip`
object in the existing `clips` object store. IndexedDB stores
structured clones, so `Leadsheet` (plain object with arrays) is
naturally serializable.

---

## 7. NCT Analysis (future leverage)

With both layers available, a future function can compare them:

```typescript
interface NctAnalysis {
  /** Notes that are chord tones of the underlying chord */
  chordTones: number[];   // indices into gesture.onsets
  /** Notes outside the underlying chord (non-chord tones) */
  nonChordTones: number[];
  /** For each NCT: classification (passing, neighbour, approach, etc.) */
  nctTypes?: Array<{ index: number; type: 'passing' | 'neighbour' | 'approach' | 'suspension' | 'appoggiatura' | 'unknown' }>;
}

function analyzeNcts(
  clip: Clip,
  barIndex: number,
): NctAnalysis { ... }
```

This is **not implemented in v1** but is the primary motivator for the
leadsheet layer.

---

## 8. Test Plan

### 8.1 Parser tests (`leadsheet-parser.test.ts`)

1. **Basic parsing**: `"Cm7 | Fm7 | G7 | Cm7"` → 4 bars, 1 chord each
2. **Multi-chord bars**: `"Am7 D7 | Gmaj7"` → bar 0 has 2 chords
3. **Repeat**: `"Fm7 | % | Bbm7 | %"` → bars 1,3 are repeats of bars 0,2
4. **NC**: `"Cm7 | NC | Fm7"` → bar 1 has null chord
5. **Empty bars**: `"Cm7 | | Fm7"` → bar 1 treated as NC
6. **Trailing pipe**: `"Cm7 | Fm7 |"` → 2 bars (not 3)
7. **Leading pipe**: `"| Cm7 | Fm7"` → 2 bars (not 3)
8. **Truncation**: input with 6 bars, numBars=4 → 4 bars
9. **Padding**: input with 2 bars, numBars=4 → 4 bars (last 2 = NC)
10. **Invalid chord**: `"Cm7 | Xyz | Fm7"` → bar 1 has null chord but
    `inputText: "Xyz"` preserved
11. **Round-trip**: `serializeLeadsheet(parseLeadsheet(x, n))` ≈ x
12. **Dash as repeat**: `"Cm7 | -"` same as `"Cm7 | %"`

### 8.2 Component tests

- LeadsheetBar renders correct number of bar cells
- Bar widths sum to expected percentage
- NC/repeat cells get correct CSS classes
- Invalid chords shown with error class

### 8.3 Integration tests

- Leadsheet saved to clip, persists across re-selection
- MIDI export includes leadsheet metadata
- MIDI reimport restores leadsheet text

---

## 9. Implementation Order

1. **Types** — add `LeadsheetChord`, `LeadsheetBar`, `Leadsheet` to
   `src/types/clip.ts`, add `leadsheet?` to `Clip`
2. **Parser** — create `src/lib/leadsheet-parser.ts` with
   `parseLeadsheet()` and `serializeLeadsheet()`
3. **Tests** — write parser tests (8.1 above)
4. **Component** — create `src/components/LeadsheetBar.tsx`
5. **Input component** — create `LeadsheetInput` (text field + submit)
6. **Wire up** — add to `ClipDetail.tsx` and `MidiCurator.tsx`
7. **CSS** — add leadsheet styles to `App.css`
8. **MIDI round-trip** — extend `midi-export.ts` and `midi-parser.ts`
9. **Keyboard shortcut** — consider `L` key to focus leadsheet input

---

## 10. Estimated Effort

| Step | Time |
|------|------|
| Types + parser | 30 min |
| Parser tests | 30 min |
| LeadsheetBar component | 1h |
| LeadsheetInput component | 30 min |
| Integration (ClipDetail + MidiCurator) | 45 min |
| CSS | 20 min |
| MIDI round-trip | 45 min |
| Testing + polish | 30 min |
| **Total** | **~4.5h** |

---

## 11. Open Questions

1. **Bar-click editing**: Should clicking a LeadsheetBar cell let you
   edit just that bar (vs. always editing the full text)? Recommendation:
   start with full-text-only (simpler), add per-bar in v2.

2. **Auto-population**: Should the detected (realized) chords be offered
   as a starting point for the leadsheet? E.g., a "Copy from detected"
   button that pre-fills the text input. Recommendation: yes, good UX.

3. **Visual alignment**: The leadsheet bar is bar-quantized while the
   realized ChordBar may be segment-based (from scissors). They won't
   always align visually. This is intentional — the visual mismatch
   _is_ the analysis.

4. **Max chords per bar**: iReal Pro allows up to 4 per bar. We should
   support at least 4 (equal division). More than 4 is unusual and can
   be deferred.

---

## Appendix A: Format Comparison (Research Summary)

Surveyed: iReal Pro, ChordPro, MusicXML, Band-in-a-Box, Nashville
Number System.

**Consensus**: pipe-delimited bars, space-separated chords within bars,
`%` for repeat. This is the most widely understood compact notation.

| Feature | iReal Pro | ChordPro | BIAB | NNS | **Ours** |
|---------|-----------|----------|------|-----|----------|
| Bar delimiter | `\|` | (none) | Grid | `\|` | `\|` |
| Multi-chord bar | Positional | N/A | Comma | Underline | Space (equal) |
| Repeat bar | `%` | Directive | Re-enter | `%` | `%` |
| No chord | `n` | `[N.C.]` | empty | `NC` | `NC` |
| Slash bass | `Am7/G` | `[Am7/G]` | `Am7/G` | N/A | Future |

The existing `parseChordSymbol()` already handles root extraction and
quality lookup for the 104 dictionary entries + all common aliases.
Only `/Bass` notation is missing (deferred to v2).
