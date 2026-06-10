# MIDIcurator — MIDI Metadata Scheme (v1)

This document defines the **MIDIcurator metadata scheme** for embedding
harmonic, segmentation, and provenance information directly inside
Standard MIDI Files (SMF).

The scheme is used by:
- the MIDIcurator web application,
- and the eventual MIDIcurator plugin.

Its primary goals are **round‑trip fidelity**, **DAW survivability**, and
**forward compatibility**.

---

## 1. Design goals

1. Preserve **segment boundaries** and **chord information** when exporting MIDI.
2. Allow re‑import into MIDIcurator with minimal information loss.
3. Survive round‑trips through common DAWs.
4. Remain human‑readable when possible.
5. Allow future extensions without breaking older files.

---

## 2. Core strategy

MIDIcurator uses a **hybrid metadata strategy**:

| Purpose | MIDI Meta Event | Reason |
|------|---------------|-------|
| Segment boundaries | Marker (`0x06`) | Visible in many DAWs |
| Human‑readable labels | Marker (`0x06`) | Easy inspection |
| Structured metadata | Text (`0x01`) | Extensible, machine‑readable |
| File‑level info | Text (`0x01`) | Stable carrier |

Markers provide **minimum viable persistence**.  
Text meta events provide **full fidelity**.

---

## 3. Namespacing & versioning

All MIDIcurator metadata MUST use:

- **Namespace**: `MCURATOR`
- **Schema version**: `v1`

This allows:
- coexistence with other tools’ metadata,
- safe ignoring by unaware software,
- future version upgrades.

Examples:
```
MCURATOR v1 SEG 1 CHORD Dm(add4)
MCURATOR:v1 {"seg":1,"chord":"Dm(add4)"}
```

---

## 4. File‑level metadata

A file‑level declaration SHOULD be written near tick 0
(usually in track 0).

### 4.1 Text meta event (recommended)

```
MCURATOR:v1 {
  "type": "file",
  "schema": "mcurator-midi",
  "version": 1,
  "createdBy": "MIDIcurator",
  "createdAt": "YYYY-MM-DD",
  "ppq": 480
}
```

### Optional fields
- `source`: `"generated" | "imported" | "curated"`
- `patternId`: UUID or stable identifier
- `variantOf`: parent pattern ID
- `density`: numeric variant factor
- `license`: SPDX identifier (e.g. `"CC0-1.0"`)

---

## 5. Segment metadata

A **segment** is defined by:
- its **start tick** (the position of the meta event),
- its **end tick** (next segment start or end of clip).

Segments are ordered implicitly by time.

### 5.1 Required fields
- `seg` — integer segment index
- `chord` — chord label (MIDIcurator grammar)

### 5.2 Optional fields
- `scope`: `"segment"` | `"bar"`
- `key`: `"Eb:min"`, `"F#:maj"`, etc.
- `rootPc`: integer 0–11
- `pcsObs`: observed pitch classes
- `pcsTpl`: template pitch classes
- `extras`: pitch classes outside template
- `confidence`: 0–1
- `qualityId`: internal chord dictionary ID

---

## 6. Marker meta events (0x06)

Markers are placed **at the start tick of each segment**.

### 6.1 Marker format

```
MCURATOR v1 SEG <n> CHORD <symbol> [KEY <key>] [FLAGS <flags>]
```

Examples:
```
MCURATOR v1 SEG 1 CHORD Dm(add4)
MCURATOR v1 SEG 2 CHORD Ebm KEY Eb:min
```

Markers should remain **short** to avoid DAW truncation.

---

## 7. Text meta events (0x01)

Text events carry **structured metadata**.

### 7.1 Format

```
MCURATOR:v1 <JSON>
```

Example:
```json
MCURATOR:v1 {
  "seg": 1,
  "scope": "segment",
  "chord": "Dm(add4)",
  "rootPc": 2,
  "pcsObs": [2,5,7,9],
  "pcsTpl": [2,5,9],
  "extras": [7],
  "confidence": 0.78,
  "key": "D:min"
}
```

Text events SHOULD be written at the same tick as the marker.

---

## 8. Parsing rules

### 8.1 Marker parsing
- Accept markers starting with `MCURATOR v1`.
- Unknown tokens are ignored.
- Missing chord labels still define a segment boundary.

### 8.2 Text parsing
- Lines starting with `MCURATOR:v1` are parsed as JSON.
- Unknown JSON fields are preserved if possible.

### 8.3 Merge precedence
At a given tick:
1. JSON fields override marker fields.
2. Marker fields override defaults.
3. Later events override earlier ones at the same tick.

---

## 9. Relationship to bar‑based analysis

If **no MCURATOR markers exist**:
- MIDIcurator falls back to bar‑based harmonic scopes.

If markers exist:
- they override bars for harmonic analysis,
- bars may still be shown for visual orientation.

---

## 10. Export rules

When exporting MIDI from MIDIcurator:

1. Write file‑level JSON at tick 0.
2. For each segment:
   - write marker (`0x06`),
   - write text JSON (`0x01`).
3. Place all MCURATOR events in **track 0** when possible.

---

## 11. Compatibility notes

- Most DAWs preserve markers reliably.
- Some DAWs strip or ignore text events — this is acceptable.
- MIDIcurator must treat markers as the minimum viable signal.

---

## 12. Testing requirements

- Export → import round‑trip preserves segments and chords.
- Marker‑only files still restore segmentation.
- JSON‑only files still restore segmentation.
- Unknown MCURATOR fields do not break parsing.

---

## 13. Design principle

> MIDI metadata should carry **musical meaning**,  
> not just technical annotations.
