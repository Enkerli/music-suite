# Interaction Patterns Library

**Last updated:** 2026-02-12

## Overview

This document catalogs reusable UI interaction patterns used in MIDIcurator. Each pattern includes implementation details, accessibility notes, when to use, and code examples from the codebase.

**Purpose**:
- Ensure consistency across features
- Provide implementation templates for contributors
- Document accessibility best practices for each pattern
- Guide design decisions with proven solutions

**How to Use**:
- When designing a new feature, check if an existing pattern applies
- When implementing, copy pattern structure and adapt to context
- Always include accessibility attributes from the pattern template

---

## Pattern 1: Two-Layer Visualization (ChordBar + LeadsheetBar)

### Description

A stacked, aligned visualization showing two related data layers: underlying leadsheet chords (user-defined or imported) on top, detected chords from MIDI notes below. Both layers use identical width calculations to maintain bar alignment with the piano roll.

### Visual Structure

```
┌────────────────────────────────────────┐
│ LeadsheetBar: [Dm7][Am7 D7][Gmaj7][—] │  ← User-defined (green)
├────────────────────────────────────────┤
│ ChordBar:     [Dm7][Dm7   ][Gmaj7][—] │  ← Detected (blue)
└────────────────────────────────────────┘
```

### Implementation

**File Locations**:
- `/src/components/LeadsheetBar.tsx` (lines 1-250)
- `/src/components/ChordBar.tsx` (lines 1-400)
- `/src/components/ClipDetail.tsx` (renders both)

**Code Example**:

```tsx
// ClipDetail.tsx (simplified)
<div className="mc-visualization-stack">
  {/* Leadsheet layer (optional, user-provided) */}
  {leadsheetChords.length > 0 && (
    <LeadsheetBar
      chords={leadsheetChords}
      ticksPerBar={ticksPerBar}
      totalTicks={totalTicks}  // Critical: same as ChordBar
      drawWidth={drawWidth}     // For zoom alignment
    />
  )}

  {/* Detected chord layer (always present) */}
  <ChordBar
    barChords={barChords}
    ticksPerBar={ticksPerBar}
    totalTicks={totalTicks}     // Critical: same as LeadsheetBar
    drawWidth={drawWidth}       // For zoom alignment
    selectionRange={selectionRange}
    onSegmentClick={handleSegmentClick}
    onChordEdit={handleChordEdit}
  />
</div>

// CSS (App.css, lines 1055-1154)
.mc-leadsheet-bar {
  border-radius: 4px 4px 0 0;  /* Top corners rounded */
  border-bottom: none;          /* Visually connects to ChordBar */
}

.mc-leadsheet-bar + .mc-chord-bar {
  border-top: none;             /* No gap between layers */
  border-radius: 0 0 4px 4px;   /* Bottom corners rounded */
}
```

**Layout Calculation** (critical for alignment):

```tsx
// Both components must use identical width calculation
const cellWidth = drawWidth
  ? (drawWidth / totalBars) + 'px'
  : (100 / totalBars) + '%';

// Example: 4 bars, drawWidth=800px → each cell = 200px
```

### Accessibility Notes

**WCAG Compliance**:
- **1.1.1 Text Alternatives (A)**: Each cell has `aria-label` with bar number and chord name
- **1.3.1 Info and Relationships (A)**: Use `role="list"` on container, `role="listitem"` on cells
- **1.4.1 Use of Color (A)**: Color differences (green vs. blue) supplemented by position (top vs. bottom)

**Implementation Checklist**:
- [ ] Add `role="list"` to LeadsheetBar and ChordBar containers
- [ ] Add `role="listitem"` to each cell/segment
- [ ] Add `aria-label` with context: "Bar 2: Am7, A minor seventh chord"
- [ ] Ensure color contrast meets WCAG AA (green text on dark bg, blue text on dark bg)
- [ ] Test with screen reader: NVDA should announce "List with 4 items" on focus

**Code Example**:

```tsx
// LeadsheetBar cell (with accessibility)
<div
  className="mc-leadsheet-cell"
  style={{ width: cellWidth }}
  role="listitem"
  aria-label={`Bar ${barIndex + 1}: ${chord || 'no chord'}`}
>
  <span className="mc-leadsheet-chord">{chord}</span>
</div>
```

### When to Use

**Use This Pattern When**:
- You need to compare two related data layers (detected vs. ground truth, original vs. transformed)
- Alignment with another visualization (piano roll) is critical
- Users need to see correspondences across layers (e.g., "leadsheet says Dm7, detector says Dm6")

**Avoid When**:
- Only one data layer exists (use single ChordBar)
- Layers are unrelated or independent (use separate sections)
- Vertical space is constrained (stacking increases height)

### Variants

**Variant 1: Single-Layer (ChordBar only)**
- No leadsheet data present
- ChordBar stands alone with full rounded corners

**Variant 2: Segmented Sub-Bar Chords**
- ChordBar cells use absolute positioning for intra-bar segments
- See `mc-chord-bar-segment` CSS (App.css, lines 973-1014)

**Variant 3: Zoomed Alignment**
- When `zoomLevel > 1`, pass `drawWidth` prop (computed as `(containerWidth - labelWidth) * zoomLevel`)
- Cells use pixel widths instead of percentages
- Maintains alignment with piano roll as canvas expands

### Design Rationale

**Why Two Layers?**
- **Pedagogical Value**: Show students/users what "should" be there vs. what was detected
- **Override Transparency**: Users see when they've overridden detection with leadsheet input
- **Validation**: Quickly spot mismatches (detector wrong? or leadsheet wrong?)

**Why Identical Width Calculations?**
- **Perceptual Alignment**: Human eye expects vertical alignment (bar 1 above bar 1)
- **Cognitive Load**: Misaligned bars force mental translation (which bar is which?)
- **Technical Constraint**: Piano roll uses ticks-based layout; chord bars must match exactly

**Related Principles**:
- **Preserve Meaning Before Optimizing Mechanism** (11-principles.md): Alignment preserves spatial relationship, even if pixel-perfect CSS is harder
- **Analysis is Assistive, Not Authoritative**: Two-layer design emphasizes detection is suggestion, leadsheet is authoritative

---

## Pattern 2: Inline Edit with Validation (BPM / Chord Input)

### Description

A display-then-edit pattern where users click a value to activate an inline text input, type new value with real-time validation, and press Enter to save or Escape to cancel. Used for BPM editing and chord symbol editing.

### Visual States

**State 1: Display Mode** (default)
```
BPM: 120 ✏️  ← Clickable, shows edit icon on hover
```

**State 2: Edit Mode** (after click)
```
BPM: [120] ✓  ← Input focused, checkmark button to save
```

**State 3: Validation Feedback**
```
BPM: [abc] ✗  ← Red border, error icon (invalid input)
```

### Implementation

**File Locations**:
- BPM editing: `/src/components/StatsGrid.tsx` (lines 90-150)
- Chord editing: `/src/components/ChordBar.tsx` (lines 41-84, inline `ChordEditInput`)

**Code Example (BPM)**:

```tsx
// StatsGrid.tsx (simplified)
const [editingBpm, setEditingBpm] = useState(false);
const [bpmValue, setBpmValue] = useState(clip.bpm.toString());

const handleBpmSave = () => {
  const parsed = parseInt(bpmValue, 10);
  if (parsed > 0 && parsed <= 500) {
    onBpmChange(parsed); // Update clip BPM
    setEditingBpm(false);
  } else {
    // Show error (invalid BPM)
  }
};

return (
  <div className="mc-stat-box">
    <div className="mc-stat-label">BPM</div>
    {editingBpm ? (
      <div className="mc-bpm-edit">
        <input
          type="number"
          className="mc-bpm-input"
          value={bpmValue}
          onChange={e => setBpmValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleBpmSave();
            if (e.key === 'Escape') setEditingBpm(false);
          }}
          aria-label="Edit BPM, press Enter to save, Escape to cancel"
          autoFocus
        />
        <button
          className="mc-bpm-save"
          onClick={handleBpmSave}
          aria-label="Save BPM"
        >
          ✓
        </button>
      </div>
    ) : (
      <div
        className="mc-stat-value--editable"
        onClick={() => setEditingBpm(true)}
        role="button"
        tabIndex={0}
        aria-label={`BPM ${clip.bpm}, click to edit`}
      >
        {clip.bpm} <span className="mc-stat-edit-icon">✏️</span>
      </div>
    )}
  </div>
);
```

**Code Example (Chord)**:

```tsx
// ChordBar.tsx (ChordEditInput component, lines 41-84)
function ChordEditInput({ initialValue, onSubmit, onCancel }) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus and select all text when mounted
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (value.trim()) {
        onSubmit(value.trim());
      } else {
        onCancel(); // Empty = cancel
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      className="mc-chord-edit-input"
      value={value}
      onChange={e => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={onCancel}  // Cancel on focus loss
      aria-label="Edit chord symbol, press Enter to save, Escape to cancel"
    />
  );
}
```

### Accessibility Notes

**WCAG Compliance**:
- **2.1.1 Keyboard (A)**: Click to edit, Enter to save, Escape to cancel — all keyboard-accessible
- **3.2.2 On Input (A)**: Input changes don't auto-submit (requires explicit Enter)
- **3.3.1 Error Identification (A)**: Invalid input shows red border AND error message (not color alone)
- **3.3.3 Error Suggestion (AA)**: Provide examples ("Valid BPM: 60-180", "Try: Cmaj7, Dm7")

**Implementation Checklist**:
- [ ] Display mode has `role="button"` and `tabIndex={0}` (keyboard focusable)
- [ ] Display mode has `aria-label` describing current value and action ("BPM 120, click to edit")
- [ ] Input has `aria-label` with instructions ("Edit BPM, press Enter to save, Escape to cancel")
- [ ] Input auto-focuses on mount (`autoFocus` or `inputRef.current.focus()`)
- [ ] Input selects existing text on focus (`.select()`) for easy replacement
- [ ] Invalid state shows visible error message (not just red border)
- [ ] Error message has `role="alert"` for screen reader announcement

**Code Example (Error Handling)**:

```tsx
// StatsGrid.tsx (add error state)
const [bpmError, setBpmError] = useState('');

const handleBpmChange = (value: string) => {
  setBpmValue(value);
  const parsed = parseInt(value, 10);
  if (!value || isNaN(parsed) || parsed <= 0 || parsed > 500) {
    setBpmError('BPM must be between 1 and 500');
  } else {
    setBpmError('');
  }
};

return (
  <>
    <input
      className={bpmError ? 'mc-bpm-input--invalid' : 'mc-bpm-input'}
      aria-invalid={!!bpmError}
      aria-describedby={bpmError ? 'bpm-error' : undefined}
      // ...
    />
    {bpmError && (
      <span id="bpm-error" role="alert" className="mc-error-message">
        {bpmError}
      </span>
    )}
  </>
);
```

### When to Use

**Use This Pattern When**:
- Editing a single value in-place (no need for full form)
- Validation can be done synchronously (no server round-trip)
- User needs immediate feedback on validity
- Context switching to separate form would disrupt workflow

**Avoid When**:
- Editing complex multi-field data (use modal or dedicated form)
- Validation requires async operations (loading state needed)
- Multiple related values must be edited together (batch edit form)

### Variants

**Variant 1: Auto-Save on Blur**
- Save immediately when input loses focus (no explicit Enter needed)
- Use when undo/redo history is available

**Variant 2: Live Preview**
- Update UI in real-time as user types (e.g., BPM changes playback speed)
- Commit value on Enter, revert on Escape

**Variant 3: Suggestions / Autocomplete**
- Show dropdown with valid chord symbols (Cm7, Cmaj7, C7) as user types
- Select with arrow keys + Enter

### Design Rationale

**Why Inline Instead of Modal?**
- **Context Preservation**: User sees related data (piano roll, chord bar) while editing
- **Lower Friction**: One click to edit, not "click → modal opens → find field → edit → close modal"
- **Progressive Disclosure**: Advanced users edit in-place, beginners can use explicit forms

**Why Enter to Save (Not Auto-Save)?**
- **Explicit Confirmation**: Users know when change is committed (avoid accidental saves)
- **Predictable Behavior**: Matches text editor conventions (Enter = confirm)
- **Reversibility**: Escape provides obvious undo mechanism

**Related Principles**:
- **Explicit Over Implicit** (11-principles.md): Enter to save is explicit, blur-to-save is implicit
- **Reversible Actions Build Trust**: Escape cancels edit, restores original value

---

## Pattern 3: Mode Toggle with Explicit Exit (Scissors Mode)

### Description

A toggle button that activates a temporary mode with visible state indicators (button highlight, cursor change, keyboard shortcut reminder). Mode persists until user explicitly exits (same key toggles off, or Escape key). Used for scissors tool (segmentation mode).

### Visual States

**State 1: Inactive** (default)
```
[✂] Scissors (S)  ← Grayed out, normal cursor
```

**State 2: Active** (after pressing S)
```
[✂] Scissors (S)  ← Orange background, scissors cursor
     ↑
  highlighted
```

**State 3: In Use**
```
Piano roll with scissors cursor, click to place boundary
```

### Implementation

**File Locations**:
- `/src/components/ClipDetail.tsx` (mode state management, lines 100-200)
- `/src/components/PianoRoll.tsx` (cursor change, boundary placement, lines 88-300)
- `/src/App.css` (visual styling, lines 762-793)

**Code Example**:

```tsx
// ClipDetail.tsx (simplified)
const [scissorsMode, setScissorsMode] = useState(false);

// Keyboard shortcut handler
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 's' || e.key === 'S') {
      e.preventDefault();
      setScissorsMode(prev => !prev); // Toggle
    }
    if (e.key === 'Escape' && scissorsMode) {
      setScissorsMode(false); // Explicit exit
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [scissorsMode]);

return (
  <div className="mc-piano-roll-toolbar">
    <button
      className={scissorsMode ? 'mc-btn--tool-active' : 'mc-btn--tool'}
      onClick={() => setScissorsMode(prev => !prev)}
      aria-pressed={scissorsMode}
      aria-label="Scissors tool: place segmentation boundaries (S to toggle, Escape to exit)"
      title="Scissors (S)"
    >
      ✂️
    </button>

    <PianoRoll
      scissorsMode={scissorsMode}
      onBoundaryAdd={handleBoundaryAdd}
      // ...
    />
  </div>
);
```

**CSS Styling** (App.css, lines 762-793):

```css
/* Inactive state */
.mc-btn--tool {
  background: var(--mc-bg);
  border: 1px solid var(--mc-border);
  color: var(--mc-text-muted);
  cursor: pointer;
}

/* Active state (mode enabled) */
.mc-btn--tool-active {
  background: #e8872a;      /* Distinct orange (not accent blue) */
  border-color: #e8872a;
  color: #fff;
  font-weight: 600;         /* Extra emphasis */
}

/* Piano roll cursor change */
.mc-piano-roll-canvas--scissors {
  cursor: url("data:image/svg+xml,<svg>...</svg>") 12 12, crosshair;
}
```

### Accessibility Notes

**WCAG Compliance**:
- **3.2.1 On Focus (A)**: Button doesn't activate mode on focus, only on click/press (predictable)
- **4.1.2 Name, Role, Value (A)**: `aria-pressed` announces state ("pressed" or "not pressed")
- **3.2.4 Consistent Identification (AA)**: Scissors icon always means segmentation mode

**Implementation Checklist**:
- [ ] Button has `aria-pressed={scissorsMode}` (screen readers announce state)
- [ ] Button has `aria-label` with full instructions ("Scissors tool: place boundaries, press S to toggle, Escape to exit")
- [ ] Add ARIA live region to announce mode changes:
  ```tsx
  <div role="status" aria-live="polite" className="sr-only">
    {scissorsMode ? 'Scissors mode active' : 'Scissors mode inactive'}
  </div>
  ```
- [ ] Visual indicator CLEAR (orange background, not subtle)
- [ ] Cursor change supplements visual indicator (but not sole indicator)
- [ ] Escape key exits mode (keyboard-accessible exit)
- [ ] Test with screen reader: NVDA should announce "Scissors tool, toggle button, pressed" when active

**Code Example (Live Region)**:

```tsx
// ClipDetail.tsx (add live region)
return (
  <>
    <button
      className={scissorsMode ? 'mc-btn--tool-active' : 'mc-btn--tool'}
      aria-pressed={scissorsMode}
      // ...
    >
      ✂️
    </button>

    {/* Screen reader announcement */}
    <div role="status" aria-live="polite" className="sr-only">
      {scissorsMode && 'Scissors mode active. Use arrow keys to navigate, Enter to place boundary, Escape to exit.'}
    </div>
  </>
);
```

### When to Use

**Use This Pattern When**:
- User needs to enter temporary mode for specialized interaction (draw, select, measure)
- Mode changes cursor, click behavior, or available actions
- Mode should be visually obvious (no hidden modes)
- User should explicitly exit mode (not time-based or context-based auto-exit)

**Avoid When**:
- Mode is permanent setting (use checkbox or radio buttons)
- Mode changes page layout or navigation (use tabs or routing)
- Multiple modes can be active simultaneously (use checkboxes, not toggle)

### Variants

**Variant 1: Selection Mode**
- Similar to scissors, but for range selection
- Cursor changes to crosshair, drag to select range
- Exit with Escape or by completing selection

**Variant 2: Drawing Mode**
- Paint/draw notes on piano roll (future feature)
- Cursor changes to pencil icon
- Toggle with D key, exit with Escape

**Variant 3: Modal Tools (Photoshop-style)**
- Multiple tool buttons in toolbar (scissors, pencil, eraser)
- Radio button behavior (only one active at a time)
- Clicking another tool deactivates current tool

### Design Rationale

**Why Orange (Not Accent Blue)?**
- **Distinctiveness**: Orange stands out from primary accent (blue) — signals "caution, you're in a mode"
- **Accessibility**: High contrast with both dark and light themes
- **Convention**: Many design tools (Figma, Sketch) use orange for active tool state

**Why Explicit Exit (Not Auto-Exit on Action)?**
- **Predictability**: Mode stays active until user chooses to exit (neurodivergent users appreciate this)
- **Efficiency**: Place multiple boundaries without re-entering mode
- **Error Prevention**: Accidental clicks don't exit mode unexpectedly

**Related Principles**:
- **Explicit Over Implicit** (11-principles.md): Mode state always visible, never hidden
- **Reversible Actions Build Trust**: Escape key provides clear exit path

---

## Pattern 4: Range Selection for Contextual Actions (Piano Roll)

### Description

Click-and-drag on canvas to select tick range, highlighted visually. Selection enables contextual actions (re-detect chord in range, adapt notes to new chord, delete notes). Click outside selection to clear.

### Visual States

**State 1: No Selection**
```
Piano roll with normal cursor, no highlight
```

**State 2: Dragging**
```
Piano roll with semi-transparent overlay from dragStart to current mouse position
```

**State 3: Selection Complete**
```
Piano roll with opaque highlight over bars 2-3 (ticks 1920-3840)
Actions: [Re-detect] [Adapt] [Delete]
```

### Implementation

**File Locations**:
- Selection logic: `/src/components/PianoRoll.tsx` (lines 98-240)
- Range state: `/src/components/ClipDetail.tsx` (manages `selectionRange` state)
- Layout helpers: `/src/lib/piano-roll.ts` (`xToTick`, `snapToNearestBoundary`)

**Code Example**:

```tsx
// PianoRoll.tsx (simplified)
const isDragging = useRef(false);
const dragStartX = useRef(0);

const handleMouseDown = (e: React.MouseEvent) => {
  const x = e.nativeEvent.offsetX - labelWidth;
  if (x < 0) return; // Clicked in label area, ignore

  isDragging.current = true;
  dragStartX.current = x;
  setTempDragEndX(x); // Start with zero-width selection
};

const handleMouseMove = (e: React.MouseEvent) => {
  if (!isDragging.current) return;
  const x = e.nativeEvent.offsetX - labelWidth;
  setTempDragEndX(x); // Update drag preview
};

const handleMouseUp = (e: React.MouseEvent) => {
  if (!isDragging.current) return;
  isDragging.current = false;

  const endX = e.nativeEvent.offsetX - labelWidth;
  const minDragPx = 10; // Ignore tiny drags (likely accidental)

  if (Math.abs(endX - dragStartX.current) < minDragPx) {
    onRangeSelect(null); // Clear selection (click, not drag)
    return;
  }

  // Convert pixel coordinates to tick range
  const startTick = xToTick(Math.min(dragStartX.current, endX), layout);
  const endTick = xToTick(Math.max(dragStartX.current, endX), layout);

  // Snap to nearest bar or beat boundaries
  const snappedStart = snapToNearestBoundary(startTick, boundaries);
  const snappedEnd = snapToNearestBoundary(endTick, boundaries);

  onRangeSelect({ start: snappedStart, end: snappedEnd });
};

// Render selection overlay
const selectionOverlay = selectionRange && (
  <rect
    x={timeToX(selectionRange.start, layout) + labelWidth}
    y={0}
    width={timeToX(selectionRange.end, layout) - timeToX(selectionRange.start, layout)}
    height={layout.height}
    fill="rgba(74, 122, 154, 0.3)"  // Semi-transparent accent color
    stroke="var(--mc-accent)"
    strokeWidth={2}
  />
);
```

**Contextual Actions** (ClipDetail.tsx):

```tsx
// Show actions only when selection exists
{selectionRange && (
  <div className="mc-selection-actions">
    <button onClick={handleReDetectInRange}>
      Re-detect Chord in Selection
    </button>
    <button onClick={handleAdaptNotesToChord}>
      Adapt Notes to...
    </button>
    <button onClick={handleDeleteNotesInRange}>
      Delete Notes in Range
    </button>
  </div>
)}
```

### Accessibility Notes

**WCAG Compliance**:
- **2.1.1 Keyboard (A)**: CRITICAL FAILURE — range selection is currently mouse-only
- **1.4.1 Use of Color (A)**: Selection uses color (blue overlay) but also position (spatial highlight)

**Implementation Checklist (TIER 1 REMEDIATION REQUIRED)**:
- [ ] Add keyboard alternative for range selection:
  - **Option A**: Shift+Arrow keys extend selection (like text selection)
  - **Option B**: Enter "selection mode" with R key, arrow keys move start/end markers
  - **Option C**: Prompt dialog: "Enter range (bar:beat to bar:beat)"
- [ ] Add `aria-describedby` to canvas describing selected range:
  ```tsx
  <div id="piano-roll-selection" className="sr-only">
    {selectionRange
      ? `Selected: bars ${startBar} to ${endBar}, ${noteCount} notes`
      : 'No selection. Drag to select range.'}
  </div>
  ```
- [ ] Add live region to announce selection changes:
  ```tsx
  <div role="status" aria-live="polite" className="sr-only">
    {selectionRange && `Selected bars ${startBar} to ${endBar}`}
  </div>
  ```
- [ ] Ensure selection overlay has min contrast 3:1 against piano roll background
- [ ] Test with keyboard-only users: Sam and Riley personas must complete workflow

**Proposed Keyboard Alternative** (10-accessibility-plan.md, Tier 1.5):

```tsx
// Add keyboard selection mode
const [selectionMode, setSelectionMode] = useState(false);
const [selectionMarkers, setSelectionMarkers] = useState({ start: 0, end: 0 });

useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'r' || e.key === 'R') {
      setSelectionMode(prev => !prev); // Toggle selection mode
    }

    if (selectionMode) {
      if (e.key === 'ArrowRight') {
        // Move end marker right
        setSelectionMarkers(prev => ({
          ...prev,
          end: Math.min(prev.end + ticksPerBeat, totalTicks),
        }));
      }
      if (e.key === 'ArrowLeft') {
        // Move end marker left
        setSelectionMarkers(prev => ({
          ...prev,
          end: Math.max(prev.end - ticksPerBeat, prev.start),
        }));
      }
      if (e.key === 'Enter') {
        // Confirm selection
        onRangeSelect(selectionMarkers);
        setSelectionMode(false);
      }
      if (e.key === 'Escape') {
        // Cancel selection mode
        setSelectionMode(false);
      }
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [selectionMode, selectionMarkers]);
```

### When to Use

**Use This Pattern When**:
- User needs to perform action on subset of data (not entire dataset)
- Selection scope affects available actions (contextual operations)
- Visual feedback of selection is critical (user needs to see what's selected)

**Avoid When**:
- Only one action is available (no need for selection, just click-to-action)
- Selection is multi-discontinuous (separate pattern needed, e.g., Ctrl+Click)
- Canvas is not primary interaction surface (use table row selection instead)

### Variants

**Variant 1: Multi-Selection (Ctrl+Click)**
- Hold Ctrl/Cmd to add disjoint ranges to selection
- Render multiple overlay rectangles

**Variant 2: Selection with Handles**
- After selection, show drag handles at start/end to adjust boundaries
- Used in video editors (trim handles)

**Variant 3: Lasso Selection (Freeform)**
- Drag to draw arbitrary shape around notes
- Select all notes inside polygon (complex collision detection)

### Design Rationale

**Why Snap to Boundaries?**
- **Musical Context**: Bar and beat boundaries are musically meaningful (not arbitrary pixel positions)
- **Precision**: Easier to select "bar 2" than "ticks 1920-1925.3" (pixel-perfect dragging is hard)
- **Feedback**: Snapping provides tactile feedback (user feels selection "lock" to boundary)

**Why Clear on Click Outside?**
- **Discoverability**: Users naturally click empty space to deselect (matches text editors, design tools)
- **Low Friction**: No need to find "Deselect" button or remember keyboard shortcut

**Related Principles**:
- **Accessibility is Foundational** (11-principles.md): Keyboard alternative is CRITICAL (currently failing WCAG A)
- **Explicit Over Implicit**: Selection state visible (highlight + contextual actions appear)

---

## Pattern 5: Batch Preview Before Commit (Variant Generation)

### Description

User adjusts parameters (density slider), sees preview of effect (note count estimate), presses keyboard shortcut to generate batch, reviews results, and commits or discards. Used for variant generation (5 variants at different densities).

### User Flow

**Step 1: Parameter Adjustment**
```
Density: [████░░░░░░] 0.60
Preview: ~25 notes (original: 42)
```

**Step 2: Batch Generation**
```
Press G → Generate 5 variants
[Loading... 2 of 5 complete]
```

**Step 3: Review Results**
```
Sidebar:
  ├─ original.mid (42 notes)
  ├─ original_d0.30.mid (13 notes)
  ├─ original_d0.50.mid (21 notes)
  ├─ original_d0.70.mid (29 notes)  ← Currently selected
  ├─ original_d0.90.mid (38 notes)
  └─ original_d1.00.mid (42 notes)
```

**Step 4: Keep or Delete**
```
User plays each variant, deletes unwanted ones
```

### Implementation

**File Locations**:
- Density UI: `/src/components/TransformControls.tsx` (lines 1-150)
- Variant generation: `/src/components/MidiCurator.tsx` (`handleGenerateVariants`, lines 300-450)
- Transform logic: `/src/lib/transform.ts` (`transformGesture`)

**Code Example**:

```tsx
// TransformControls.tsx (simplified)
const [density, setDensity] = useState(1.0);
const originalNoteCount = clip.gesture.notes.length;
const previewNoteCount = Math.round(originalNoteCount * density);

return (
  <div className="mc-transform-panel">
    <label className="mc-density-label">
      Density: <span className="mc-density-value">{density.toFixed(2)}</span>
    </label>

    <div className="mc-density-slider-row">
      <span>0</span>
      <input
        type="range"
        min="0.1"
        max="1.0"
        step="0.1"
        value={density}
        onChange={e => setDensity(parseFloat(e.target.value))}
        aria-label={`Density: ${density}, preview ${previewNoteCount} notes`}
      />
      <span>1</span>
    </div>

    <div className="mc-note-count-preview">
      Preview: ~{previewNoteCount} notes (original: {originalNoteCount})
    </div>

    <div className="mc-density-presets">
      <button
        className={density === 0.3 ? 'mc-preset-btn--active' : 'mc-preset-btn'}
        onClick={() => setDensity(0.3)}
      >
        0.3
      </button>
      <button onClick={() => setDensity(0.5)}>0.5</button>
      <button onClick={() => setDensity(0.7)}>0.7</button>
      <button onClick={() => setDensity(1.0)}>1.0</button>
    </div>
  </div>
);
```

**Batch Generation** (MidiCurator.tsx):

```tsx
// Generate 5 variants at predefined densities
const handleGenerateVariants = useCallback(() => {
  if (!selectedClip) return;

  const densities = [0.3, 0.5, 0.7, 0.9, 1.0];
  const variants: Clip[] = [];

  densities.forEach(d => {
    const variantGesture = transformGesture(
      selectedClip.gesture,
      { densityMultiplier: d, quantizeLevel: 16 }
    );

    const variantClip: Clip = {
      ...selectedClip,
      id: `${selectedClip.id}_d${d.toFixed(2)}`,
      name: `${selectedClip.name}_d${d.toFixed(2)}`,
      gesture: variantGesture,
      variantMetadata: {
        originalId: selectedClip.id,
        density: d,
        isVariant: true,
      },
    };

    variants.push(variantClip);
  });

  // Add all variants to library
  variants.forEach(v => saveClip(v));

  // Announce completion
  setFeedbackMessage(`Generated ${variants.length} variants`);
}, [selectedClip]);

// Keyboard shortcut
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'g' || e.key === 'G') {
      e.preventDefault();
      handleGenerateVariants(); // Generate 5
    }
    if (e.key === 'v' || e.key === 'V') {
      e.preventDefault();
      handleGenerateOneVariant(); // Generate 1 at current density
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [handleGenerateVariants, handleGenerateOneVariant]);
```

### Accessibility Notes

**WCAG Compliance**:
- **1.4.1 Use of Color (A)**: Preview note count uses text, not color alone
- **3.3.4 Error Prevention (AA)**: Preview before commit reduces accidental generation
- **4.1.3 Status Messages (AA)**: Announce completion via live region

**Implementation Checklist**:
- [ ] Slider has `aria-label` with current value and preview ("Density 0.6, preview 25 notes")
- [ ] Slider updates `aria-valuenow` and `aria-valuetext` as user drags
- [ ] Preview text is part of label (visible to all users)
- [ ] Add live region to announce generation completion:
  ```tsx
  <div role="status" aria-live="polite" className="sr-only">
    {generationComplete && `Generated 5 variants. Total clips: ${clips.length}`}
  </div>
  ```
- [ ] Keyboard shortcut (G) works regardless of focus position
- [ ] Preset buttons have `aria-label` with density value ("Density 0.3, sparse")

**Code Example (Live Region)**:

```tsx
// MidiCurator.tsx (add live region)
const [feedbackMessage, setFeedbackMessage] = useState('');

useEffect(() => {
  if (feedbackMessage) {
    // Clear message after 3 seconds
    const timer = setTimeout(() => setFeedbackMessage(''), 3000);
    return () => clearTimeout(timer);
  }
}, [feedbackMessage]);

return (
  <>
    {/* Screen reader announcement */}
    <div role="status" aria-live="polite" className="sr-only">
      {feedbackMessage}
    </div>

    <button onClick={handleGenerateVariants}>
      Generate 5 Variants (G)
    </button>
  </>
);
```

### When to Use

**Use This Pattern When**:
- Operation creates multiple results (batch processing)
- Results are non-trivial to recreate (high cost to undo)
- User needs to preview effect before committing (risk mitigation)
- Parameters affect output in non-obvious ways (density → note count is complex)

**Avoid When**:
- Operation is instantly reversible (no preview needed, just undo)
- Only one result is generated (single variant → no batch)
- Preview is impossible (e.g., audio effect can't be previewed without playing)

### Variants

**Variant 1: Generate Single (V key)**
- Generate one variant at current density setting
- Faster for power users who know exact parameters they want

**Variant 2: Stepped Preview**
- As user drags slider, automatically generate and play preview variant (real-time)
- Higher complexity, but better feedback (hear effect, not just see number)

**Variant 3: Batch Export**
- Generate variants on-the-fly during export (don't store in library)
- Use for one-off batch processing (e.g., "Export this pattern in 5 keys")

### Design Rationale

**Why Batch Instead of One-at-a-Time?**
- **Exploration**: Users want to compare multiple densities side-by-side (0.3 vs 0.7 vs 1.0)
- **Efficiency**: Generating 5 variants at once is faster than 5 separate operations
- **Convention**: Music production tools (Ableton, Logic) batch-generate variations for comparison

**Why Preview Note Count?**
- **Transparency**: Users understand effect of density parameter (not just abstract 0.0-1.0 number)
- **Risk Reduction**: Avoid generating useless variants (density 0.1 → 4 notes → unplayable)

**Related Principles**:
- **Progressive Disclosure** (11-principles.md): Single variant (V) for experts, batch (G) for exploration
- **Reversible Actions Build Trust**: Variants are separate clips (original untouched), can delete unwanted ones

---

## Pattern Comparison Matrix

| Pattern | Primary Use | Keyboard Access | Screen Reader Support | Complexity |
|---------|-------------|-----------------|----------------------|------------|
| Two-Layer Visualization | Compare detected vs. ground truth | N/A (display only) | ✅ With ARIA labels | Medium |
| Inline Edit | Quick value changes | ✅ Click, Enter, Escape | ✅ With aria-label | Low |
| Mode Toggle | Temporary tool activation | ✅ Toggle key, Escape | ⚠️ Needs aria-pressed + live region | Low |
| Range Selection | Contextual actions on subset | ❌ Mouse-only (CRITICAL) | ❌ No keyboard alternative | High |
| Batch Preview | Explore parameter space | ✅ Keyboard shortcuts | ⚠️ Needs live region for completion | Medium |

**Priority Order for Accessibility Remediation**:
1. **Range Selection** (Tier 1) — Critical failure, blocks core workflow
2. **Mode Toggle** (Tier 1) — Partial, needs live region announcements
3. **Batch Preview** (Tier 1) — Partial, needs completion announcements
4. **Inline Edit** (Tier 2) — Working, but error handling incomplete
5. **Two-Layer Visualization** (Tier 2) — Working, but ARIA labels missing

---

## Related Documents

- [09-accessibility-audit.md](09-accessibility-audit.md) — Identifies pattern accessibility issues
- [10-accessibility-plan.md](10-accessibility-plan.md) — Remediation roadmap for patterns
- [11-principles.md](11-principles.md) — Design principles guiding pattern selection
- [01-personas.md](01-personas.md) — User needs addressed by patterns
- [04-journey-maps.md](04-journey-maps.md) — Patterns in context of user workflows

---

## Contributing New Patterns

When adding a new interaction pattern to MIDIcurator:

1. **Document the pattern** using this template:
   - Description (what it does)
   - Visual structure (ASCII diagram or image)
   - Implementation (file locations, code examples)
   - Accessibility notes (WCAG compliance, checklist)
   - When to use / avoid
   - Variants
   - Design rationale

2. **Test accessibility** before merging:
   - [ ] Keyboard-only navigation (Tab, Arrow, Enter, Escape)
   - [ ] Screen reader announcement (NVDA, JAWS, VoiceOver)
   - [ ] Focus indicators visible
   - [ ] ARIA attributes correct (`role`, `aria-label`, `aria-pressed`, etc.)

3. **Link to personas**: Which personas benefit from this pattern? Which are harmed if accessibility fails?

4. **Align with principles**: Which design principles does this pattern support? (reference 11-principles.md)

---

## Revision History

- **2026-02-12**: Initial patterns library created (Phase 6 of Design Thinking foundation)
- Future: Add new patterns as features are implemented (progression generator, transpose control, etc.)
