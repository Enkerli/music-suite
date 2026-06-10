# MIDIcurator — Harmony Engine

This document specifies the **harmonic analysis system**, including:
- chord detection,
- chord-tone vs observed-tone handling,
- and enharmonic spelling.

It also documents known edge cases and required fixes.

---

## 1. Harmonic analysis overview

For each harmonic scope (bar or segment):

1. Collect all active notes in the scope.
2. Reduce notes to pitch classes (0–11).
3. Attempt chord recognition using a dictionary.
4. Preserve *all observed tones*, even if not in the chord template.
5. Spell notes using a context-aware system.

---

## 2. Chord dictionary matching

### 2.1 Chord templates

Each chord quality defines:
- a root-relative pitch-class set
- interval degrees (for spelling)

Example:
```
Minor triad: [0, 3, 7]
```

---

## 3. The ChordMatch model (required)

```ts
ChordMatch {
  symbol: string
  rootPc: number
  templatePcs: number[]
  observedPcs: number[]
  extras: number[]
  missing: number[]
  score: number
}
```

### Design rule (critical)

**Observed pitch classes must never be discarded.**

The UI may highlight a template,
but analysis must preserve the full observed set.

---

## 4. Edge case: {D, F, G, A}

Observed pitch classes:
```
{2, 5, 7, 9}
```

Naïve match:
```
Dm → {2, 5, 9}
```

Correct interpretation:
- Base chord: Dm
- Extra tone: G (11 / add4)

### Required behavior

- Chord symbol reflects extension:
  - `Dm(add4)` or `Dm(+11)`
- UI shows **extras explicitly**
- G is not silently dropped

---

## 5. Scoring strategy (recommended)

When matching templates:

- Favor coverage of observed tones
- Penalize unexplained extras softly
- Avoid preferring larger chords unless they explain more

---

## 6. Enharmonic spelling system

### 6.1 Problem statement

Pitch-class names must be **musically correct**, not just convenient.

Example:
- In E♭ minor, the minor third is **G♭**, not F♯.

---

## 7. SpellingContext

```ts
SpellingContext {
  tonicPc?: number
  mode?: 'major' | 'minor' | 'other'
  chordRootPc?: number
  preferSharps?: boolean
}
```

Resolution priority:
1. User-defined context (future)
2. Detected chord
3. Global preference
4. Fallback chromatic map

---

## 8. Diatonic anchoring algorithm

1. Determine chord root letter.
2. Infer diatonic letter for each chord degree.
3. Apply accidentals to match pitch class.

---

## 9. Required tests

Add unit tests for:

- `{D,F,G,A}` → `Dm(add4)`
- `{D,G,A}` → `Dsus4`
- `{C,E,G,A}` → `C6` vs `Am7/C`
- E♭ minor contexts spelling G♭

---

## 10. Output requirements

- Use Unicode accidentals internally (`♭`, `♯`)
- Provide ASCII fallback (`b`, `#`) for export
- Never mix enharmonic systems in one scope

---

## 11. Design principle

> Correct spelling is not cosmetic.
> It is part of musical trust.
