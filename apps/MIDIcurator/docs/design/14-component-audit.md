# Component Audit — UI Inventory

**Last updated:** 2026-02-12

## Overview

This document catalogs all UI components in MIDIcurator, documenting current usage, accessibility status, and recommendations for systematization. Use this as a reference for maintaining consistency and planning refactoring efforts.

**Purpose**:
- Inventory existing components
- Assess accessibility compliance per component
- Identify inconsistencies and duplication
- Guide component library extraction (future Storybook)

---

## Component Summary

| Component | File Location | Complexity | Accessibility Status | Priority |
|-----------|---------------|------------|---------------------|----------|
| **Buttons** (6 variants) | App.css lines 466-516 | Low | ⚠️ Focus indicators missing | Tier 1 |
| **Inputs** (3 types) | App.css lines 143-153, 880-945 | Low | ⚠️ Error handling incomplete | Tier 1 |
| **Cards** (Clip Card) | ClipCard.tsx, App.css lines 187-227 | Medium | ❌ ARIA labels missing | Tier 1 |
| **Visualizations** (3 types) | PianoRoll, ChordBar, LeadsheetBar | High | ❌ Critical failures | Tier 1 |
| **Transport Controls** | TransportBar.tsx, App.css lines 795-842 | Medium | ⚠️ ARIA incomplete | Tier 1 |
| **Mode Toggle** | App.css lines 762-793 | Low | ⚠️ aria-pressed needed | Tier 1 |
| **Tags** | TagEditor.tsx, App.css lines 342-389 | Low | ✅ Mostly accessible | Tier 2 |
| **Dropzone** | DropZone.tsx, App.css lines 121-141 | Low | ⚠️ ARIA label needed | Tier 2 |
| **Stats Grid** | StatsGrid.tsx, App.css lines 241-263 | Medium | ⚠️ Semantic HTML needed | Tier 2 |

---

## Buttons

### Variants

**1. Primary Button** (`mc-btn--primary`)
- **File**: App.css lines 476-478
- **Usage**: Main actions (Generate, Download)
- **Color**: `#5a7a9a` (medium blue)
- **Example**: "Generate 5 Variants" button

**2. Secondary Button** (`mc-btn--secondary`)
- **File**: App.css lines 480-482
- **Usage**: Secondary actions
- **Color**: `#4a6a9a` (darker blue)

**3. Success Button** (`mc-btn--success`)
- **File**: App.css lines 484-486
- **Usage**: Save, confirm, add actions
- **Color**: `var(--mc-success)` (#2a6a4a, green)
- **Example**: "Save BPM" button, "Add Tag" button

**4. Danger Button** (`mc-btn--danger`)
- **File**: App.css lines 488-492
- **Usage**: Destructive actions (delete, clear)
- **Color**: `var(--mc-danger)` (#6a2a2a, dark red)
- **Example**: "Clear All Clips" button

**5. Small Button** (`mc-btn--small`)
- **File**: App.css lines 494-506
- **Usage**: Inline actions, secondary buttons in compact spaces
- **Size**: `padding: 4px 10px`, `font-size: 12px`
- **Example**: "Tag Chord" button in StatsGrid

**6. Tool Button** (`mc-btn--tool`, `mc-btn--tool-active`)
- **File**: App.css lines 762-793
- **Usage**: Toggle tools (scissors mode)
- **Size**: `width: 32px, height: 28px`
- **Active State**: Orange background (#e8872a)

### Accessibility Status

**Current State**: ⚠️ **Partial**

**What Works**:
- ✅ All buttons use semantic `<button>` element
- ✅ Button text is visible (not icon-only without label)
- ✅ Buttons are keyboard focusable (Tab key)

**What's Missing** (09-accessibility-audit.md):
- ❌ No visible focus indicators (`:focus-visible` not defined)
- ❌ No `aria-label` on icon buttons (scissors button just shows ✂️)
- ⚠️ Small buttons (<28px height) fail WCAG touch target size (Level AAA)

**Recommendations** (10-accessibility-plan.md):

**Tier 1 (Critical)**:
```css
/* Add global focus indicator */
.mc-btn:focus-visible {
  outline: 2px solid var(--mc-accent);
  outline-offset: 2px;
}

.mc-btn--tool:focus-visible {
  box-shadow: 0 0 0 3px var(--mc-accent-light);
}
```

**Tier 2 (Important)**:
- Add `aria-label` to all icon-only buttons:
  ```tsx
  <button
    className="mc-btn--tool"
    aria-label="Scissors tool: place segmentation boundaries (S to toggle)"
  >
    ✂️
  </button>
  ```
- Increase small button size to min 28×28px (or 44×44px for AAA)

---

## Inputs

### Types

**1. Text Input** (`mc-filter-input`, `mc-tag-input`, `mc-leadsheet-input`)
- **File**: App.css lines 143-153, 377-389, 1124-1143
- **Usage**: Filter sidebar, add tags, leadsheet entry
- **Style**: Dark background, light border, rounded corners

**2. Number Input** (`mc-bpm-input`)
- **File**: App.css lines 285-292
- **Usage**: BPM editing (inline edit pattern)
- **Width**: Fixed 60px (narrow for 3-digit numbers)

**3. Range Slider** (density control)
- **File**: TransformControls.tsx (uses native `<input type="range">`)
- **Usage**: Adjust density multiplier (0.1-1.0)

### Accessibility Status

**Current State**: ⚠️ **Partial**

**What Works**:
- ✅ All inputs have associated labels (visible or `aria-label`)
- ✅ Focus styles defined for `.mc-chord-input` (border color change)

**What's Missing** (09-accessibility-audit.md):
- ❌ Error messages use color only (red border, no text)
- ❌ No `aria-invalid` or `aria-describedby` for validation errors
- ❌ No error text for chord input validation (StatsGrid.tsx, lines 880-928)

**Recommendations** (10-accessibility-plan.md):

**Tier 1 (Critical)**:
```tsx
// Add error text to chord input (StatsGrid.tsx)
const [chordError, setChordError] = useState('');

return (
  <>
    <input
      className={chordError ? 'mc-chord-input--invalid' : 'mc-chord-input'}
      aria-invalid={!!chordError}
      aria-describedby={chordError ? 'chord-error' : undefined}
      // ...
    />
    {chordError && (
      <span id="chord-error" role="alert" className="mc-error-message">
        {chordError}
      </span>
    )}
  </>
);
```

**Tier 2**:
- Add focus indicators for all inputs (not just chord input)
- Add suggestions dropdown for chord input (autocomplete pattern)

---

## Cards

### Clip Card

**File**: `/src/components/ClipCard.tsx`, App.css lines 187-227

**Structure**:
```tsx
<div className={selected ? 'mc-clip-card--selected' : 'mc-clip-card'}>
  <div className="mc-clip-card-name">
    {name} {isVariant && <span className="mc-clip-card-variant-dot">●</span>}
  </div>
  <div className="mc-clip-card-meta">
    {noteCount} notes • {barCount} bars
    {density && <span className="mc-clip-card-density-tag">d{density}</span>}
    {firstChord && <span className="mc-clip-card-chord">{firstChord}</span>}
  </div>
</div>
```

**Visual States**:
- **Default**: Gray background, subtle border
- **Selected**: Blue background (`var(--mc-selected)`), blue border (`var(--mc-selected-border)`)
- **Hover**: (not currently styled)

### Accessibility Status

**Current State**: ❌ **Critical Failure**

**What Works**:
- ✅ Clickable (uses `onClick` handler)
- ✅ Text content is readable

**What's Missing** (09-accessibility-audit.md):
- ❌ No `role="button"` or `tabIndex={0}` (not keyboard focusable)
- ❌ No `aria-label` with full context ("II-V-I in C, 42 notes, detected chord Dm7")
- ❌ No `aria-selected` or `aria-current` to indicate selected state

**Recommendations** (10-accessibility-plan.md):

**Tier 1 (Critical)**:
```tsx
<div
  className={selected ? 'mc-clip-card--selected' : 'mc-clip-card'}
  role="button"
  tabIndex={0}
  aria-label={`${name}, ${noteCount} notes, ${barCount} bars${firstChord ? `, detected chord ${firstChord}` : ''}`}
  aria-selected={selected}
  onClick={onClick}
  onKeyDown={e => e.key === 'Enter' && onClick()}
>
  {/* ... */}
</div>
```

**Tier 2**:
- Add hover state (subtle background change)
- Add focus indicator (border glow on keyboard focus)

---

## Visualizations

### 1. Piano Roll

**File**: `/src/components/PianoRoll.tsx`, piano-roll.ts (rendering logic)

**Description**: Canvas-based visualization of MIDI notes over time. Vertical axis = pitch (C3-C6), horizontal axis = time (ticks). Notes are colored rectangles with velocity-based brightness.

**Features**:
- Grid lines (bar lines, beat lines)
- Note names labels (C4, D4, etc.)
- Range selection (drag to select)
- Playhead indicator (during playback)
- Segmentation boundaries (scissors mode)
- Timeline zoom (Ctrl+wheel)

**Accessibility Status**: ❌ **Critical Failure** (09-accessibility-audit.md, Section 1.1)

**What's Missing**:
- ❌ No `aria-label` or `aria-describedby` (canvas is silent to screen readers)
- ❌ No text alternative for note list
- ❌ Range selection is mouse-only (no keyboard alternative)
- ❌ Scissors mode is mouse-only (no keyboard alternative)

**Recommendations** (10-accessibility-plan.md, Tier 1.3, 1.5):
1. Add `aria-label`: "Piano roll: 42 notes spanning C3 to G5, 8 bars"
2. Add `aria-describedby` with hidden note list (first 50 notes)
3. Add keyboard alternative for range selection (Shift+Arrow keys)
4. Add keyboard alternative for scissors placement (Arrow keys + Enter)

### 2. Chord Bar

**File**: `/src/components/ChordBar.tsx`, App.css lines 929-1054

**Description**: Horizontal strip showing detected chord per bar or segment. Cells are aligned with piano roll bars.

**Features**:
- Click cell to edit chord symbol (inline edit)
- Segmented cells for intra-bar chord changes
- Visual indicator for chords with extra notes (dotted underline)

**Accessibility Status**: ⚠️ **Partial** (09-accessibility-audit.md, Section 1.1)

**What Works**:
- ✅ Chord symbols are text (accessible to screen readers)
- ✅ Inline editing is keyboard-accessible (Enter to save, Escape to cancel)

**What's Missing**:
- ❌ No `role="list"` and `role="listitem"` (missing semantic structure)
- ❌ No `aria-label` with bar context ("Bar 1: Dm7, Dorian minor seventh")
- ⚠️ No `aria-current` to indicate playhead position

**Recommendations** (10-accessibility-plan.md, Tier 1.1):
```tsx
<div className="mc-chord-bar" role="list" aria-label="Chord progression per bar">
  {barChords.map((bar, i) => (
    <div
      key={i}
      className="mc-chord-bar-cell"
      role="listitem"
      aria-label={`Bar ${i + 1}: ${bar.chord?.symbol || 'no chord'}`}
    >
      <span className="mc-chord-bar-symbol">{bar.chord?.symbol || '—'}</span>
    </div>
  ))}
</div>
```

### 3. Leadsheet Bar

**File**: `/src/components/LeadsheetBar.tsx`, App.css lines 1055-1154

**Description**: Similar to ChordBar but shows user-defined leadsheet chords (ground truth). Green-colored to distinguish from detected chords.

**Features**:
- Copy detected chords to leadsheet (button)
- Edit leadsheet input (text field with bar format: "Dm7 | Am7 D7 | Gmaj7")

**Accessibility Status**: ⚠️ **Partial**

**What Works**:
- ✅ Chord symbols are text
- ✅ Input field is accessible

**What's Missing**:
- Same as ChordBar (no `role="list"`, no `aria-label`)

**Recommendations**: Same as ChordBar (Tier 1.1)

---

## Transport Controls

**File**: `/src/components/TransportBar.tsx`, App.css lines 795-842

**Buttons**:
- Play/Pause (▶/⏸)
- Stop (■)
- Loop toggle

**Display**:
- Current time (MM:SS format)
- Playback state ("Playing", "Stopped")

**Accessibility Status**: ⚠️ **Partial** (09-accessibility-audit.md, Section 4.1)

**What Works**:
- ✅ Buttons are keyboard-accessible (Tab, Space/Enter)
- ✅ Space key global shortcut for play/pause

**What's Missing**:
- ❌ No `aria-label` on buttons ("Play (Space)", "Stop", "Loop")
- ❌ No `aria-pressed` on loop button
- ❌ No live region to announce playback state changes

**Recommendations** (10-accessibility-plan.md, Tier 1.1, 1.4):
```tsx
<button
  className={isPlaying ? 'mc-transport-btn--active' : 'mc-transport-btn'}
  onClick={onPlayPause}
  aria-label={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
>
  {isPlaying ? '⏸' : '▶'}
</button>

{/* Live region for screen reader */}
<div role="status" aria-live="polite" className="sr-only">
  {isPlaying ? 'Playing' : 'Paused'}
</div>
```

---

## Mode Toggle (Scissors Tool)

**File**: App.css lines 762-793 (styling), ClipDetail.tsx (state management)

**Visual States**:
- **Inactive**: Gray icon, subtle border
- **Active**: Orange background (#e8872a), white icon

**Accessibility Status**: ⚠️ **Partial** (09-accessibility-audit.md, Section 4.1)

**What Works**:
- ✅ Keyboard shortcut (S key) toggles mode
- ✅ Visual indicator is clear (orange background)

**What's Missing**:
- ❌ No `aria-pressed` attribute (screen readers don't know state)
- ❌ No live region to announce mode change

**Recommendations** (10-accessibility-plan.md, Tier 1.1, 1.4):
```tsx
<button
  className={scissorsMode ? 'mc-btn--tool-active' : 'mc-btn--tool'}
  onClick={() => setScissorsMode(!scissorsMode)}
  aria-pressed={scissorsMode}
  aria-label="Scissors tool: place segmentation boundaries (S to toggle, Escape to exit)"
>
  ✂️
</button>
```

---

## Tags

**File**: `/src/components/TagEditor.tsx`, App.css lines 342-389

**Components**:
- Tag display (pill-shaped, clickable to filter)
- Tag input (text field + "Add Tag" button)

**Accessibility Status**: ✅ **Mostly Accessible**

**What Works**:
- ✅ Tags are text (readable)
- ✅ Input has label
- ✅ Add button is semantic `<button>`

**Recommendations** (Tier 2):
- Add `role="list"` to tag container, `role="listitem"` to each tag
- Add `aria-label` to tag buttons ("Filter by 'groovy-jazz'")

---

## Dropzone

**File**: `/src/components/DropZone.tsx`, App.css lines 121-141

**Description**: Drag-and-drop area for MIDI file upload. Dashed border, centered text.

**Accessibility Status**: ⚠️ **Partial**

**What Works**:
- ✅ Click to browse (file input fallback)
- ✅ Visible instructions

**What's Missing**:
- ⚠️ No `aria-label` on dropzone div
- ⚠️ Hidden file input may not have label

**Recommendations** (Tier 2):
```tsx
<div
  className="mc-dropzone"
  onDrop={handleDrop}
  onClick={() => fileInputRef.current?.click()}
  role="button"
  tabIndex={0}
  aria-label="Drag and drop MIDI files here, or click to browse"
>
  <div className="mc-dropzone-main">Drop MIDI files here or click to browse</div>
</div>

<input
  type="file"
  ref={fileInputRef}
  onChange={handleFileChange}
  accept=".mid,.midi"
  multiple
  aria-label="Choose MIDI files"
  style={{ display: 'none' }}
/>
```

---

## Stats Grid

**File**: `/src/components/StatsGrid.tsx`, App.css lines 241-263

**Description**: Grid of stat boxes (BPM, notes, bars, time signature, detected chord).

**Structure** (current):
```tsx
<div className="mc-stats-grid">
  <div className="mc-stat-box">
    <div className="mc-stat-label">BPM</div>
    <div className="mc-stat-value">120</div>
  </div>
  {/* ... 4 more boxes */}
</div>
```

**Accessibility Status**: ⚠️ **Partial** (09-accessibility-audit.md, Section 1.3)

**What Works**:
- ✅ Labels and values are visible text
- ✅ Content linearizes correctly for screen readers

**What's Missing**:
- ⚠️ No semantic HTML (`<dl>`, `<dt>`, `<dd>` would be clearer)

**Recommendations** (Tier 2):
```tsx
<dl className="mc-stats-grid">
  <div className="mc-stat-box">
    <dt className="mc-stat-label">BPM</dt>
    <dd className="mc-stat-value">120</dd>
  </div>
  {/* ... */}
</dl>
```

---

## Component Refactoring Priority

### Tier 1 (Critical — WCAG A Violations)
1. **Buttons**: Add focus indicators (all variants)
2. **Clip Card**: Add role="button", aria-label, tabIndex
3. **Piano Roll**: Add aria-label, aria-describedby
4. **Chord Bar / Leadsheet Bar**: Add role="list", aria-label per cell
5. **Transport Controls**: Add aria-label, live region
6. **Mode Toggle**: Add aria-pressed, live region
7. **Inputs**: Add error text (not just color)

### Tier 2 (Important — WCAG AA, Usability)
8. **Buttons**: Increase small button size to 28×28px
9. **Dropzone**: Add aria-label
10. **Stats Grid**: Convert to semantic HTML (`<dl>`)
11. **Tags**: Add role="list", aria-label per tag

### Tier 3 (Enhanced — Systematization)
12. Extract reusable Button component (React component, not just CSS classes)
13. Extract reusable Input component (with built-in error handling)
14. Create Storybook documentation for all components

---

## Related Documents

- [09-accessibility-audit.md](09-accessibility-audit.md) — Detailed accessibility issues per component
- [10-accessibility-plan.md](10-accessibility-plan.md) — Remediation roadmap
- [12-interaction-patterns.md](12-interaction-patterns.md) — Patterns using these components
- [13-design-tokens.md](13-design-tokens.md) — Tokens used by components

---

## Revision History

- **2026-02-12**: Initial component audit (Phase 6 of Design Thinking foundation)
- Future: Update after implementing Tier 1 fixes, extract to component library
