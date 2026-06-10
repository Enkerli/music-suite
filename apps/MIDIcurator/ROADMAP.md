# MIDI Curator Roadmap

## Strategy

Stay in the webapp for algorithm development. Every feature built here transfers
to the eventual JUCE plugin. The webapp is also independently distributable.

Electron is skipped — it adds packaging complexity without enough value over
the webapp. WebMIDI (Chrome-only) handles the cases where we need hardware
output; Safari testing is deferred to the plugin phase.

## Decision Rules

- **150% rule**: If a phase takes 150% of estimated sessions, pause and decide:
  simplify the approach, split the feature, or drop it.
- **Branch per phase**: Each phase gets a feature branch. Merge to `main` when
  tests pass and user testing confirms the feature works.
- **Atomic commits**: One logical change per commit. Tests before merge.
- **User testing gates**: Before merging each phase, ask specific questions
  about the UX and wait for feedback.

## Phases

### Phase B: Piano Roll + Playback
**Estimate**: 1–2 sessions | **Status**: ✅ Complete (v0.2.0)

- ✅ Canvas piano roll (grid + note rectangles + velocity coloring)
- ✅ WebAudio playback (schedule notes, triangle oscillators)
- ✅ Transport controls (play/pause/stop, Space key)
- ✅ Playhead synced to playback
- A/B comparison view (original vs variant) — deferred

**Value**: Unlocks visual + auditory evaluation of every subsequent feature.
**Tests**: 18 piano-roll tests (rendering helpers, tick-to-pixel, pitch-to-y, velocity coloring).

**Backlog**:
- Playback transpose (by steps and octaves) for low-register clips
- Piano roll fold mode (hide unused pitches, show only notes present in clip)

---

### Phase A: Harmonic Awareness
**Estimate**: 2–3 sessions | **Status**: In Progress (core done, UX refinements next)

**Done**:
- ✅ Port MIDIsplainer chord dictionary (104 qualities, decimal fingerprint lookup)
- ✅ `detectChord(pitches)` with 12-rotation brute-force + subset matching
- ✅ Enrich `Harmonic` type: `detectedChord`, `barChords[]`
- ✅ Per-bar segmentation and detection
- ✅ Display: ChordBar above piano roll, Chord stat box, sidebar chord labels
- ✅ 69 new tests (29 dictionary, 38 detection, 2 integration), 111 total

**Remaining (this session)**:
- "Clear all clips" button for re-import with chord data
- ChordBar labels left-aligned, anchored to chord onset position
- Chord stat box becomes dynamic: shows chord at playhead during playback
- Light mode (CSS custom properties theme toggle)

**Phase A+ (next session)**:
- Range selection on piano roll → detect chord for selected region
  (solves: 2-bar chords split in two, multiple chords per bar, cross-barline chords)
- User-marked non-chord tones (NCTs) excluded from detection
- Chord sidecar MIDI files (block chords synced to timeline) for export
- Chord data DB export (filename/ID + chord info, simple format)

**Value**: Foundation for everything harmonic. Unblocks C1, C2, C3, E.
**Tests**: Chord detection for known triads/sevenths/extensions, edge cases
(enharmonic, ambiguous voicings).
**Risk**: Segmentation of mixed MIDI files needs manual override UX (→ range selection).

---

### Phase A-V: Chord Validation
**Estimate**: 1–2 sessions
**Depends on**: Phase A complete

- Independent bulk chord validation against third-party source
  (API service, JS/Python library, or comparison dataset)
- Quick-label workflow: correct / different notation / third-party likely wrong /
  first-party likely wrong
- Report on systematic detection errors → improve algorithm
- Also: syncopation measurement spot-checking via user subjective testing

**Value**: Confidence in detection accuracy before building on top of it.
**Risk**: Finding a reliable third-party source; syncopation has no ground truth.

---

### Phase C1: Single-Chord Realization
**Estimate**: 2–3 sessions

- Simple version first: "transpose + quantize to chord" using detected chord info
- `realizeOnChord(gesture, harmonic, targetChord)` function
- Voice-leading: minimize pitch movement, preserve contour
- UI: chord selector per clip
- Export re-voiced MIDI + chord sidecar

Later enhancements (C1+):
- Chord-degree-aware realization (distinguish chord tones from NCTs)
- User NCT annotations feed into smarter realization
- Full voicing notation (register, spread, voice-leading quality metrics)

**Value**: First real musical transformation beyond density.
**Tests**: Voice-leading distance metrics, round-trip (realize then detect).

---

### Phase C2: Progression Application
**Estimate**: 2–3 sessions

- Port BunksLua Roman numeral format to TypeScript
- Bar-by-bar chord progression editor UI
- Apply progression to pattern (re-realize per bar)
- Passing tones / approach notes within chord context
- Progression naming and relationships between progressions

**Value**: Patterns become musically adaptive.
**Tests**: Progression parsing, per-bar realization, passing tone generation.

---

### Phase D: Serpe Integration
**Estimate**: 3–4 sessions

- Bidirectional conversion: `Gesture` ↔ UPI boolean array
- Recognize nearest Euclidean/Barlow equivalent for imported patterns
- UPI notation display in clip detail
- Barlow dilution/concentration as alternative density transforms

**Value**: Mathematical rhythm framework integrated with MIDI workflows.
**Tests**: Euclidean pattern generation, round-trip conversion, recognition.

---

### Phase C3: Markov Progression Generation
**Estimate**: 2 sessions

- Port `proggen.lua` transition table + generator to TypeScript
- Load major/minor transition tables (~2,000 from-states)
- Controllable "conventionality" parameter
- Feed generated progressions directly into C2

**Value**: Infinite jazz-informed chord progressions.
**Tests**: Transition probability validation, START/END handling, mode selection.

---

### Phase G: Curation + Taxonomy
**Estimate**: 3–4 sessions

- Folksonomy tagging with autocomplete (block chords, arp, bassline, drums…)
- "Vibe" tags (mood, ambiance, genre, suggested instruments)
- Bulk operations: filter DB → select → apply tags/categories
- Deduplication detection (identical PCS patterns, near-duplicates)
- Pattern compression: block chord → harmonic rhythm, arp → shape + harmony
  (analysis/resynthesis: store abstract representation, recreate full clip)
- BPM as approximate range; double/half-speed transforms with simplification

**Value**: The "curator" in MIDI Curator — organizing a growing library.
**Tests**: Tag CRUD, deduplication metrics, compression round-trip.

---

### Phase E: Feedback + Live Learning
**Estimate**: 5–6 sessions

- E1 (2 sessions): Rating system → generation weights, "more/less like this"
- E2 (3–4 sessions): Web MIDI API stream capture, segment every N bars,
  route to instrument-specific models (bass, comping, drums)

**Value**: The tool learns from your workflow.
**Tests**: Rating persistence, model weight updates, MIDI stream segmentation.
**Risk**: Live capture requires Chrome + MIDI hardware; may hit timing issues.

---

### Phase F: JUCE Plugin
**Estimate**: 8–12 sessions

- MIDI effect plugin (AUv3, VST3, AU, Standalone)
- Port core algorithms (TypeScript → C++)
- Pattern storage via ValueTree or SQLite
- JUCE UI for clip list, piano roll, transform controls, chord detection
- DAW host delegates: playback, audio, MIDI routing, transport

**Value**: DAW-integrated workflow — the end goal.
**Tests**: JUCE unit tests, plugin validation (auval, pluginval), DAW testing.
**Depends on**: All algorithm phases (A through G) being stable in the webapp.

---

## Edge Cases & Testing Concerns

- **Black MIDI / extremely dense patterns**: Chord detection may produce noise;
  need graceful degradation or "too dense to analyze" indicator.
- **Sparse clips**: Few notes may not form recognizable chords; single-note or
  two-note clips should degrade to interval display rather than chord guess.
- **BPM sensitivity**: Clips at extreme tempi; double/half-speed ambiguity.
- **Syncopation measurement**: No objective ground truth; validate through
  user subjective experience and comparative ranking.

## External Resources

| Resource | Location | Used in |
|----------|----------|---------|
| Chord Dictionary | MIDIsplainer (Chord-Dictionary branch) | Phase A |
| Jazz Standards Corpus | BunksLua/roman_numeral_titles.lua (local) | Phase C2, C3 |
| Transition Table | BunksLua/transitionTable.lua (local) | Phase C3 |
| Rhythm Pattern Explorer | github.com/Enkerli/rhythm_pattern_explorer | Phase D |
| Chord validation API/lib | TBD (research in Phase A-V) | Phase A-V |

## Versioning

- `0.1.x` — Scaffolding + density transforms
- `0.2.x` — Phase B (piano roll + playback)
- `0.3.x` — Phase A (harmonic awareness)
- `0.4.x` — Phase C1 (chord realization)
- `0.5.x` — Phase C2 (progressions)
- `0.6.x` — Phase D (Serpe)
- `0.7.x` — Phase C3 (Markov)
- `0.8.x` — Phase G (curation + taxonomy)
- `0.9.x` — Phase E (learning)
- `1.0.0` — Phase F (plugin)

## Design Ideas Backlog

These are captured for future consideration. Not yet scheduled.

- Full voicing notation (register, spread, intervals, voice-leading metrics)
- "Slash chord" awareness in detection and display
- Arp shape library (blooming, cascade, etc.) for pattern compression
- "Quantize + humanize" as dual transforms (abstract pattern + microtiming)
- Suggested instruments per tag/vibe for playback timbres
- Chord progression database (name progressions, find relatives, ii-V-I detection)
