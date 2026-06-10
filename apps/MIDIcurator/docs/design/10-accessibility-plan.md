# Accessibility Remediation Plan

**Last updated:** 2026-02-12

## Executive Summary

This document provides a prioritized roadmap for remediating the accessibility barriers identified in [09-accessibility-audit.md](09-accessibility-audit.md). The plan is organized into **three tiers** based on WCAG compliance level and user impact:

- **Tier 1 (Critical)**: WCAG A violations that block basic use for users with disabilities
- **Tier 2 (Important)**: WCAG AA requirements and significant usability improvements
- **Tier 3 (Enhanced)**: WCAG AAA best practices and advanced features

Each remediation item includes **implementation guidance**, **effort estimates**, and **testing criteria**.

---

## Tier 1: Critical Remediations (WCAG A Violations)

**Goal**: Make MIDIcurator **basically usable** for screen reader users, keyboard-only users, and users with visual impairments.

**Total Effort**: ~20-28 hours

**Priority**: Complete before any new feature development.

---

### 1.1 Add ARIA Labels to All Interactive Elements

**Issue**: Buttons, inputs, and custom widgets lack accessible names.

**Impact**: Screen readers cannot identify controls or their purpose.

**Files to Modify**:
- `src/components/MidiCurator.tsx` (transport buttons, scissors toggle)
- `src/components/ThemeToggle.tsx` (theme toggle button)
- `src/components/DropZone.tsx` (file input)
- `src/components/Sidebar.tsx` (clip cards)
- `src/components/TransportBar.tsx` (play/pause/stop buttons)

**Implementation**:

```tsx
// Before:
<button className="mc-transport-btn" onClick={onPlayPause}>
  {isPlaying ? '⏸' : '▶'}
</button>

// After:
<button
  className="mc-transport-btn"
  onClick={onPlayPause}
  aria-label={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
>
  {isPlaying ? '⏸' : '▶'}
</button>
```

```tsx
// Scissors toggle:
<button
  className={scissorsMode ? 'mc-btn--tool-active' : 'mc-btn--tool'}
  onClick={() => setScissorsMode(!scissorsMode)}
  aria-pressed={scissorsMode}
  aria-label="Scissors tool: place segmentation boundaries (S)"
  title={scissorsMode ? 'Exit scissors mode (S or Esc)' : 'Scissors tool — click to place boundaries (S)'}
>
  ✂
</button>
```

```tsx
// Theme toggle:
<button
  className="mc-theme-toggle"
  onClick={toggleTheme}
  aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
>
  {theme === 'dark' ? '☀' : '🌙'}
</button>
```

```tsx
// Clip card:
<div
  className={`mc-clip-card ${selected ? 'mc-clip-card--selected' : ''}`}
  onClick={() => onSelect(clip.id)}
  role="button"
  tabIndex={0}
  aria-label={`${clip.name}, ${clip.harmonic.detectedChord?.symbol || 'Unknown chord'}, ${clip.gesture.notes.length} notes`}
  aria-pressed={selected}
>
  ...
</div>
```

**Effort**: 4-6 hours (review all components, add labels, test with screen reader)

**Testing Criteria**:
- ✅ All interactive elements have `aria-label` or visible text
- ✅ NVDA/JAWS announces button purpose when focused
- ✅ Toggle buttons have `aria-pressed` state
- ✅ No generic "button" or "clickable" announcements

---

### 1.2 Implement Visible Focus Indicators

**Issue**: No visible outline when navigating with keyboard.

**Impact**: Keyboard users cannot see where they are in the interface.

**Files to Modify**:
- `src/App.css` (add global focus styles)

**Implementation**:

```css
/* Global focus indicator (skip if already using :focus-visible) */
*:focus {
  outline: 2px solid transparent;
  outline-offset: 2px;
}

*:focus-visible {
  outline: 2px solid var(--mc-accent);
  outline-offset: 2px;
}

/* Specific component overrides */
.mc-btn:focus-visible,
.mc-transport-btn:focus-visible,
.mc-btn--tool:focus-visible {
  outline: 2px solid var(--mc-accent-light);
  outline-offset: 2px;
  box-shadow: 0 0 0 4px rgba(106, 154, 186, 0.2);
}

.mc-clip-card:focus-visible {
  outline: 2px solid var(--mc-accent);
  box-shadow: 0 0 0 4px rgba(106, 154, 186, 0.3);
}

.mc-chord-input:focus-visible,
.mc-tag-input:focus-visible,
.mc-filter-input:focus-visible {
  outline: 2px solid var(--mc-accent);
  border-color: var(--mc-accent);
}

/* High contrast focus for dark backgrounds */
:root[data-theme="dark"] *:focus-visible {
  outline-color: var(--mc-accent-light);
}

/* Ensure focus is visible in piano roll container */
.mc-piano-roll-container:focus-within {
  outline: 2px solid var(--mc-accent);
  outline-offset: -2px;
}
```

**Effort**: 2-3 hours (define styles, test across all components, adjust for visual consistency)

**Testing Criteria**:
- ✅ Tab through entire app — focus always visible
- ✅ Focus indicator has 3:1 contrast ratio with background (WCAG 2.1 AA)
- ✅ Focus doesn't obscure element content
- ✅ Focus order is logical (sidebar → main content → actions)

---

### 1.3 Add Text Alternative for Piano Roll Canvas

**Issue**: Canvas is completely inaccessible to screen readers.

**Impact**: Blind users cannot access note information.

**Files to Modify**:
- `src/components/PianoRoll.tsx`

**Implementation**:

**Phase 1 (Minimum)**: Add `aria-label` with summary

```tsx
<canvas
  ref={canvasRef}
  className={/* ... */}
  role="img"
  aria-label={`Piano roll: ${clip.gesture.notes.length} notes spanning ${minPitch} to ${maxPitch}, ${numBars} bars, ${clip.bpm} BPM`}
  tabIndex={0}
/>
```

**Phase 2 (Better)**: Add `aria-describedby` with detailed note list

```tsx
// Generate accessible note description
const noteDescriptions = useMemo(() => {
  return clip.gesture.notes.slice(0, 50).map((note, i) => {
    const pitchName = noteName(note.pitch);
    const bar = Math.floor(note.tick / clip.gesture.ticks_per_bar) + 1;
    const beat = Math.floor((note.tick % clip.gesture.ticks_per_bar) / clip.gesture.ticks_per_beat) + 1;
    return `Note ${i + 1}: ${pitchName}, bar ${bar} beat ${beat}, velocity ${note.velocity}`;
  }).join('. ');
}, [clip]);

return (
  <>
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={`Piano roll with ${clip.gesture.notes.length} notes`}
      aria-describedby="piano-roll-notes"
      tabIndex={0}
    />
    <div id="piano-roll-notes" className="sr-only">
      {noteDescriptions}
      {clip.gesture.notes.length > 50 && ` (showing first 50 of ${clip.gesture.notes.length} notes)`}
    </div>
  </>
);
```

**Add to App.css**:
```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

.sr-only-focusable:focus {
  position: static;
  width: auto;
  height: auto;
  padding: initial;
  margin: initial;
  overflow: visible;
  clip: auto;
  white-space: normal;
}
```

**Effort**: 4-5 hours (generate descriptions, test with large clips, optimize performance)

**Testing Criteria**:
- ✅ Screen reader announces piano roll summary on focus
- ✅ Detailed note list available (first 50 notes minimum)
- ✅ Performance acceptable (note list generation < 100ms)
- ✅ Updates when clip changes

---

### 1.4 Add ARIA Live Regions for Dynamic Content

**Issue**: Playback state changes and chord detection results are not announced.

**Impact**: Screen reader users don't know when playback starts/stops or when chords are detected.

**Files to Modify**:
- `src/components/TransportBar.tsx` (playback state)
- `src/components/StatsGrid.tsx` (chord detection)
- `src/components/MidiCurator.tsx` (variant generation)

**Implementation**:

```tsx
// TransportBar.tsx
export function TransportBar({ isPlaying, time, onPlayPause, onStop }) {
  return (
    <div className="mc-transport">
      {/* Visual controls */}
      <button onClick={onPlayPause} aria-label={/* ... */}>...</button>

      {/* Live region for playback state */}
      <div role="status" aria-live="polite" className="sr-only">
        {isPlaying ? 'Playing' : 'Paused'}
      </div>

      {/* Time display (visible) */}
      <div className="mc-transport-time">{formatTime(time)}</div>
    </div>
  );
}
```

```tsx
// StatsGrid.tsx - Announce chord when it changes
const [lastAnnouncedChord, setLastAnnouncedChord] = useState<string | null>(null);

useEffect(() => {
  const currentChord = effectiveChordInfo.chord?.symbol || null;
  if (currentChord !== lastAnnouncedChord) {
    setLastAnnouncedChord(currentChord);
  }
}, [effectiveChordInfo.chord]);

return (
  <div className="mc-stats-grid">
    {/* Visual stats */}
    ...

    {/* Live region for chord announcements */}
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {lastAnnouncedChord && `Chord detected: ${lastAnnouncedChord}`}
    </div>
  </div>
);
```

```tsx
// MidiCurator.tsx - Announce variant generation completion
const [variantAnnouncement, setVariantAnnouncement] = useState<string | null>(null);

const handleGenerateVariants = async (count: number) => {
  // ... generation logic ...
  setVariantAnnouncement(`Generated ${count} variant${count > 1 ? 's' : ''}`);
  setTimeout(() => setVariantAnnouncement(null), 3000); // Clear after 3s
};

return (
  <>
    {/* UI */}
    ...

    {/* Live region for announcements */}
    {variantAnnouncement && (
      <div role="status" aria-live="polite" className="sr-only">
        {variantAnnouncement}
      </div>
    )}
  </>
);
```

**Effort**: 3-4 hours (add live regions, test announcement timing, avoid spam)

**Testing Criteria**:
- ✅ Screen reader announces "Playing" / "Paused" on state change
- ✅ Chord changes announced during playback (not too frequent)
- ✅ Variant generation completion announced
- ✅ No redundant announcements (debounce rapid changes)

---

### 1.5 Add Keyboard Alternatives for Mouse-Only Interactions

**Issue 1**: Piano roll range selection requires mouse drag.

**Files to Modify**:
- `src/components/PianoRoll.tsx`

**Implementation** (Option A: Shift+Arrow selection):

```tsx
const [keyboardSelectionStart, setKeyboardSelectionStart] = useState<number | null>(null);
const [selectionMode, setSelectionMode] = useState(false);

const handleKeyDown = (e: React.KeyboardEvent) => {
  if (!layout) return;

  // Enter/exit selection mode with Shift+S
  if (e.key === 'S' && e.shiftKey) {
    setSelectionMode(!selectionMode);
    if (!selectionMode) {
      setKeyboardSelectionStart(0); // Start at beginning
    }
    return;
  }

  if (selectionMode) {
    const currentPos = keyboardSelectionStart ?? 0;
    const step = layout.totalTicks / 32; // Grid snap

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const newPos = Math.min(currentPos + step, layout.totalTicks);
      setKeyboardSelectionStart(newPos);

      if (e.shiftKey) {
        // Extend selection
        onRangeSelect({ start: keyboardSelectionStart ?? 0, end: newPos });
      }
    }

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const newPos = Math.max(currentPos - step, 0);
      setKeyboardSelectionStart(newPos);

      if (e.shiftKey) {
        onRangeSelect({ start: newPos, end: keyboardSelectionStart ?? 0 });
      }
    }

    if (e.key === 'Enter') {
      // Confirm selection
      setSelectionMode(false);
    }

    if (e.key === 'Escape') {
      // Cancel selection
      setSelectionMode(false);
      setKeyboardSelectionStart(null);
      onRangeSelect(null);
    }
  }
};

<canvas
  ref={canvasRef}
  onKeyDown={handleKeyDown}
  tabIndex={0}
  aria-label={`Piano roll. ${selectionMode ? 'Selection mode active. Use arrow keys to move, Shift+arrow to select, Enter to confirm.' : 'Press Shift+S to enter selection mode.'}`}
/>
```

**Issue 2**: Scissors boundary placement requires mouse click.

**Implementation**:

```tsx
const [scissorsCursor, setScissorsCursor] = useState<number>(0);

const handleScissorsKeyboard = (e: React.KeyboardEvent) => {
  if (!scissorsMode || !layout) return;

  const gridStep = layout.totalTicks / 32; // Snap to grid

  if (e.key === 'ArrowRight') {
    e.preventDefault();
    setScissorsCursor(prev => Math.min(prev + gridStep, layout.totalTicks));
  }

  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    setScissorsCursor(prev => Math.max(prev - gridStep, 0));
  }

  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    const snappedTick = snapForScissors(scissorsCursor, /* ... */);
    onBoundaryAdd?.(snappedTick);
  }

  if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    // Find closest boundary and remove
    const closest = boundaries.reduce((prev, curr) =>
      Math.abs(curr - scissorsCursor) < Math.abs(prev - scissorsCursor) ? curr : prev
    );
    if (Math.abs(closest - scissorsCursor) < gridStep) {
      onBoundaryRemove?.(closest);
    }
  }
};

// Draw scissors cursor on canvas when active
useEffect(() => {
  if (scissorsMode && layout) {
    // Draw vertical line at scissorsCursor position
    // (Add to existing draw loop)
  }
}, [scissorsMode, scissorsCursor, layout]);
```

**Effort**: 6-8 hours (implement keyboard alternatives, test interactions, document in UI)

**Testing Criteria**:
- ✅ Keyboard-only users can select piano roll range (no mouse)
- ✅ Keyboard-only users can place/remove scissors boundaries
- ✅ Visual cursor feedback during keyboard navigation
- ✅ Instructions announced via aria-label

---

### 1.6 Add Error Text for Chord Input Validation

**Issue**: Chord input shows red border but no error message.

**Files to Modify**:
- `src/components/StatsGrid.tsx`

**Implementation**:

```tsx
<div className="mc-chord-adapt">
  <input
    type="text"
    className={`mc-chord-input ${
      chordInput && (isInputValid ? 'mc-chord-input--valid' : 'mc-chord-input--invalid')
    }`}
    value={chordInput}
    onChange={(e) => setChordInput(e.target.value)}
    onKeyDown={handleInputKeyDown}
    placeholder="Enter chord (e.g., Cm7)"
    aria-label="Chord substitution input"
    aria-invalid={chordInput && !isInputValid}
    aria-describedby={chordInput && !isInputValid ? 'chord-error' : undefined}
  />

  {chordInput && !isInputValid && (
    <span id="chord-error" role="alert" className="mc-error-message">
      Invalid chord symbol. Try: C, Dm7, Gmaj7, F#dim7
    </span>
  )}

  <button
    className="mc-btn--adapt-chord"
    onClick={handleAdaptClick}
    disabled={!isInputValid}
    aria-label="Apply chord substitution"
  >
    Adapt
  </button>
</div>
```

**Add to App.css**:
```css
.mc-error-message {
  font-size: 11px;
  color: var(--mc-danger);
  margin-top: 4px;
  display: block;
}
```

**Effort**: 1-2 hours

**Testing Criteria**:
- ✅ Error message appears below invalid input
- ✅ Screen reader announces error when input becomes invalid
- ✅ `aria-invalid` and `aria-describedby` correctly linked
- ✅ Error text provides actionable guidance

---

## Tier 2: Important Remediations (WCAG AA)

**Goal**: Meet WCAG 2.1 Level AA and significantly improve usability.

**Total Effort**: ~16-22 hours

**Priority**: Complete within 2-3 months after Tier 1.

---

### 2.1 Fix iPadOS Touch Handling

**Issue**: Touch events don't work reliably on iPad (documented in OPEN_NOTES.md).

**Files to Modify**:
- `src/components/PianoRoll.tsx`

**Implementation**:

```tsx
// Add touch event handlers alongside mouse handlers
const handleTouchStart = (e: React.TouchEvent) => {
  if (e.touches.length !== 1) return;
  const touch = e.touches[0];
  const rect = canvasRef.current?.getBoundingClientRect();
  if (!rect) return;

  const x = touch.clientX - rect.left - labelWidth;
  if (x < 0) return;

  isDragging.current = true;
  dragStartX.current = x;
  // ... same logic as handleMouseDown
};

const handleTouchMove = (e: React.TouchEvent) => {
  if (!isDragging.current || e.touches.length !== 1) return;
  e.preventDefault(); // Prevent scrolling

  const touch = e.touches[0];
  // ... same logic as handleMouseMove
};

const handleTouchEnd = () => {
  if (!isDragging.current) return;
  // ... same logic as handleMouseUp
  isDragging.current = false;
};

<canvas
  ref={canvasRef}
  onMouseDown={handleMouseDown}
  onTouchStart={handleTouchStart}
  onTouchMove={handleTouchMove}
  onTouchEnd={handleTouchEnd}
  style={{ touchAction: 'none' }} // Disable browser touch handling
/>
```

**Effort**: 4-5 hours (implement touch handlers, test on iPad, handle edge cases)

**Testing Criteria**:
- ✅ Range selection works with touch drag on iPad
- ✅ Scissors mode works with tap on iPad
- ✅ No accidental scrolling during interaction
- ✅ Multi-touch doesn't break interactions

---

### 2.2 Add Skip Links

**Issue**: No way to bypass sidebar and jump to main content.

**Files to Modify**:
- `src/components/MidiCurator.tsx`

**Implementation**:

```tsx
export function MidiCurator() {
  return (
    <div className="mc-app">
      {/* Skip links (hidden until focused) */}
      <a href="#main-content" className="mc-skip-link">
        Skip to clip details
      </a>
      <a href="#clip-list" className="mc-skip-link">
        Skip to clip library
      </a>

      <div className="mc-layout">
        <Sidebar id="clip-list" /* ... */ />
        <main id="main-content" className="mc-main">
          <ClipDetail /* ... */ />
        </main>
      </div>
    </div>
  );
}
```

**Add to App.css**:
```css
.mc-skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: var(--mc-accent);
  color: white;
  padding: 8px 16px;
  text-decoration: none;
  border-radius: 0 0 4px 0;
  z-index: 1000;
}

.mc-skip-link:focus {
  top: 0;
}
```

**Effort**: 1-2 hours

**Testing Criteria**:
- ✅ Tab on page load shows skip links
- ✅ Clicking skip link moves focus to target
- ✅ Skip links hidden until focused (don't clutter UI)

---

### 2.3 Add Semantic Headings and ARIA Landmarks

**Issue**: No `<h1>`-`<h6>` headings or `<main>`/`<aside>` landmarks.

**Files to Modify**:
- `src/components/MidiCurator.tsx`
- `src/components/Sidebar.tsx`
- `src/components/ClipDetail.tsx`

**Implementation**:

```tsx
// MidiCurator.tsx
<aside className="mc-sidebar" role="complementary" aria-label="Clip library">
  <div className="mc-sidebar-header">
    <h1 className="mc-sidebar-title">MIDI Curator</h1>
    <ThemeToggle />
  </div>
  ...
</aside>

<main className="mc-main" role="main" aria-label="Clip details">
  {selectedClip ? (
    <>
      <h2 className="mc-clip-title">{selectedClip.name}</h2>
      <ClipDetail clip={selectedClip} />
    </>
  ) : (
    <div className="mc-welcome">
      <h2>Welcome to MIDI Curator</h2>
      ...
    </div>
  )}
</main>
```

```tsx
// ClipDetail.tsx sections
<section aria-labelledby="stats-heading">
  <h3 id="stats-heading" className="sr-only">Clip Statistics</h3>
  <StatsGrid /* ... */ />
</section>

<section aria-labelledby="visualization-heading">
  <h3 id="visualization-heading" className="sr-only">Piano Roll Visualization</h3>
  <PianoRoll /* ... */ />
</section>

<section aria-labelledby="transform-heading">
  <h3 id="transform-heading">Transform</h3>
  <TransformControls /* ... */ />
</section>
```

**Effort**: 3-4 hours (add headings, test hierarchy, ensure styles don't break)

**Testing Criteria**:
- ✅ Screen reader "navigate by headings" works (H key in NVDA/JAWS)
- ✅ Heading hierarchy is logical (h1 → h2 → h3, no skips)
- ✅ ARIA landmarks announced ("complementary", "main")
- ✅ Visual appearance unchanged (headings styled correctly)

---

### 2.4 Improve Color Contrast

**Issue**: Some text/background combinations may not meet 4.5:1 ratio.

**Files to Modify**:
- `src/App.css`

**Implementation**:

Run automated audit (axe DevTools) and fix failures. Common fixes:

```css
/* Increase contrast for muted text */
:root {
  --mc-text-muted: #999; /* Was #888, now 6.5:1 on dark bg */
  --mc-text-dim: #777; /* Was #666, now 5.2:1 */
}

:root[data-theme="light"] {
  --mc-text-muted: #555; /* Was #666, now 7.1:1 on light bg */
}

/* Ensure piano roll labels meet contrast */
--mc-piano-label: #888; /* 5.8:1 on #181818 bg */
```

**Effort**: 2-3 hours (audit, adjust colors, re-test)

**Testing Criteria**:
- ✅ All text ≥4.5:1 contrast (WCAG AA for normal text)
- ✅ Large text (≥18pt) ≥3:1 contrast
- ✅ UI components (borders, icons) ≥3:1 contrast
- ✅ Automated audit (axe/Lighthouse) passes

---

### 2.5 Add Confirmation Dialogs for Destructive Actions

**Issue**: "Clear All Clips" has no confirmation.

**Files to Modify**:
- `src/components/Sidebar.tsx`

**Implementation**:

```tsx
const handleClearAll = () => {
  if (!window.confirm(
    'Delete all clips from library?\n\nThis will remove all clips from IndexedDB storage. This action cannot be undone.'
  )) {
    return;
  }

  onClearAll();
};

<button
  className="mc-btn--clear-all"
  onClick={handleClearAll}
  aria-label="Clear all clips (requires confirmation)"
>
  Clear All
</button>
```

**Better**: Custom modal for better UX:

```tsx
const [showClearConfirm, setShowClearConfirm] = useState(false);

{showClearConfirm && (
  <div className="mc-modal-overlay" onClick={() => setShowClearConfirm(false)}>
    <div
      className="mc-modal"
      onClick={(e) => e.stopPropagation()}
      role="alertdialog"
      aria-labelledby="clear-title"
      aria-describedby="clear-desc"
    >
      <h2 id="clear-title">Delete All Clips?</h2>
      <p id="clear-desc">
        This will remove all {clipCount} clips from your library.
        This action cannot be undone.
      </p>
      <div className="mc-modal-actions">
        <button
          className="mc-btn--danger"
          onClick={() => {
            onClearAll();
            setShowClearConfirm(false);
          }}
          autoFocus
        >
          Delete All
        </button>
        <button
          className="mc-btn--secondary"
          onClick={() => setShowClearConfirm(false)}
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
)}
```

**Effort**: 3-4 hours (create modal component, add to all destructive actions)

**Testing Criteria**:
- ✅ Confirmation shown before deletion
- ✅ Escape key cancels dialog
- ✅ Focus trapped in modal
- ✅ Screen reader announces as alertdialog

---

### 2.6 Increase Button Target Sizes

**Issue**: Some buttons are <28×28px (too small for touch).

**Files to Modify**:
- `src/App.css`

**Implementation**:

```css
/* Ensure minimum 28×28px touch target */
.mc-btn--small {
  min-width: 28px;
  min-height: 28px;
  padding: 6px 12px; /* Increased from 4px 10px */
}

.mc-btn--clear-all {
  min-width: 28px;
  min-height: 28px;
  padding: 6px 12px;
}

.mc-zoom-controls .mc-btn--tool {
  width: 28px;  /* Increased from 24px */
  height: 28px;
  font-size: 14px;
}

/* Add transparent padding for smaller visual elements */
.mc-btn--tag-chord::before {
  content: '';
  position: absolute;
  inset: -6px; /* Expand clickable area */
}
```

**Effort**: 2-3 hours (adjust sizes, test layout impact, verify no overflow)

**Testing Criteria**:
- ✅ All buttons ≥28×28px (iOS Human Interface Guidelines)
- ✅ Layout doesn't break with larger buttons
- ✅ Touch targets don't overlap
- ✅ Visual appearance still acceptable

---

## Tier 3: Enhanced Features (WCAG AAA + Best Practices)

**Goal**: Exceed standards and provide exceptional accessibility.

**Total Effort**: ~12-16 hours

**Priority**: Opportunistic (implement during feature development or polish phases).

---

### 3.1 Add High-Contrast Theme Option

**Implementation**: Add third theme (`data-theme="high-contrast"`) with maximum contrast colors.

**Effort**: 3-4 hours

---

### 3.2 Add Audio Cues for Segmentation and Chord Changes

**Implementation**: Use Web Audio API to play beep/click sounds when boundaries are placed or chords change.

**Effort**: 4-5 hours

---

### 3.3 Add User Preference for Reduced Motion

**Implementation**: Respect `prefers-reduced-motion` media query, disable smooth scrolling and transitions.

**Effort**: 2-3 hours

---

### 3.4 Create Screencast Tutorial with Captions

**Implementation**: Record 3-5 minute walkthrough video, add captions, embed on GitHub Pages.

**Effort**: 4-6 hours (recording, editing, captioning)

---

### 3.5 Implement Undo History Panel

**Implementation**: Visual list of recent actions with ability to undo/redo (more complex than Tier 2 confirmation dialogs).

**Effort**: 8-10 hours (state management, UI, testing)

---

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)
- Tier 1.1: ARIA labels
- Tier 1.2: Focus indicators
- Tier 1.4: Live regions

**Milestone**: Basic screen reader support ✅

### Phase 2: Interaction (Weeks 3-4)
- Tier 1.5: Keyboard alternatives (range selection, scissors)
- Tier 1.3: Piano roll text alternative
- Tier 1.6: Error messages

**Milestone**: Keyboard-only users can use core features ✅

### Phase 3: Polish (Weeks 5-6)
- Tier 2.1: iPad touch handling
- Tier 2.2: Skip links
- Tier 2.3: Semantic HTML
- Tier 2.4: Color contrast

**Milestone**: WCAG 2.1 AA compliance ✅

### Phase 4: Enhancements (Ongoing)
- Tier 2.5: Confirmation dialogs
- Tier 2.6: Touch target sizes
- Tier 3: Enhanced features (opportunistic)

**Milestone**: Best-in-class accessibility 🎯

---

## Testing Strategy

### Automated Testing (Every Sprint)
1. **axe DevTools** (Chrome extension) — Run on both themes
2. **Lighthouse Accessibility Audit** — Target score: 95+
3. **WAVE** (WebAIM) — Visual verification

### Manual Testing (After Each Phase)
1. **Keyboard-only navigation** — Disconnect mouse, test all features
2. **NVDA screen reader** (Windows) — Full workflow test
3. **VoiceOver screen reader** (Mac/iOS) — Full workflow test
4. **iPad/Android touch testing** — After Tier 2.1

### User Testing (After Phase 3)
- Recruit 2-3 users with disabilities (see [15-testing-plan.md](15-testing-plan.md))
- Compensate participants ($50-100 for 1-hour session)
- Iterate based on feedback

---

## Success Metrics

**Tier 1 Complete When**:
- ✅ Lighthouse Accessibility score ≥85
- ✅ Zero WCAG A violations (axe audit)
- ✅ Screen reader user can complete onboarding workflow independently
- ✅ Keyboard-only user can place scissors boundaries

**Tier 2 Complete When**:
- ✅ Lighthouse Accessibility score ≥95
- ✅ Zero WCAG AA violations (axe audit)
- ✅ iPad touch interactions work reliably
- ✅ User testing with assistive tech users: 80%+ task completion rate

**Tier 3 Complete When**:
- ✅ Lighthouse Accessibility score = 100
- ✅ Feature parity with best-in-class accessible music tools (REAPER, MuseScore)
- ✅ User testimonials from community (accessibility advocates, educators)

---

## Budget Estimates

**Tier 1 (Critical)**: 20-28 hours @ $100/hr = **$2,000-2,800**
**Tier 2 (Important)**: 16-22 hours @ $100/hr = **$1,600-2,200**
**Tier 3 (Enhanced)**: 12-16 hours @ $100/hr = **$1,200-1,600**

**Total**: 48-66 hours = **$4,800-6,600**

*Note: For open-source project, this is volunteer effort or grant-funded work.*

---

## Related Documents

- [09-accessibility-audit.md](09-accessibility-audit.md) — Detailed findings and WCAG criteria
- [01-personas.md](01-personas.md) — Accessibility-First Learner persona
- [04-journey-maps.md](04-journey-maps.md) — Screen reader and keyboard-only journeys
- [11-principles.md](11-principles.md) — "Accessibility is Foundational" design principle
- [15-testing-plan.md](15-testing-plan.md) — User testing protocols

---

## Revision History

- **2026-02-12**: Initial remediation plan (Phase 4 of Design Thinking foundation)
- Future: Update progress as tiers are completed
