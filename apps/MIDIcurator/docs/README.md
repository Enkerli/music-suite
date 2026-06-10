# MIDIcurator Documentation

This directory contains **developer- and design-facing documentation** for MIDIcurator.
Together, these documents describe the system’s **conceptual model**, **implementation architecture**, and **planned evolution**.

They are intended to:

- help contributors understand *why* the system works the way it does,
- guide implementation of roadmap features,
- and make it possible to re-implement MIDIcurator in another language or platform (e.g. a plugin).

---

## 📐 Architecture & System Design

### [`ARCHITECTURE.md`](./ARCHITECTURE.md)
**High-level system architecture and invariants**

Start here if you want to understand:

- what MIDIcurator *is* and *is not*,
- how the system is decomposed (core logic vs UI),
- how bar-based analysis evolves into explicit segmentation,
- and how the design avoids “DAW creep”.

This document defines the **non-negotiable principles** that guide all development.

---

## 🎼 Harmonic Analysis & Spelling

### [`HARMONY_ENGINE.md`](./HARMONY_ENGINE.md)
**Chord detection, edge cases, and enharmonic spelling**

Read this if you are working on:

- chord recognition logic,
- fixing or extending the harmony engine,
- correct handling of “extra” tones (e.g. add4, sus),
- or proper enharmonic spelling (e.g. G♭ vs F♯).

This document includes:
- required data structures,
- scoring strategies,
- and concrete acceptance tests.

---

## ✂️ Segmentation & Harmonic Scopes

### [`SEGMENTATION.md`](./SEGMENTATION.md)
**Explicit segmentation and the planned “scissors” tool**

Read this if you are implementing:

- manual harmonic segmentation,
- the scissors-style interaction,
- or scope-based reanalysis.

It explains:
- how segmentation differs from DAW regions,
- how segments override bar-based analysis,
- and how this feature supports reuse and reharmonization.

---

## 🧾 Embedded MIDI Metadata

### [`METADATA_MIDI.md`](./METADATA_MIDI.md)
**How MIDIcurator encodes segments, chords, and provenance inside MIDI files**

Read this if you are working on:

- exporting MIDI with embedded harmonic information,
- importing MIDI while preserving segmentation and chord context,
- interoperability with DAWs and other MIDI tools,
- or preparing for plugin-based workflows.

This document defines:
- the `MCURATOR` metadata namespace,
- marker-based segmentation persistence,
- JSON-based text meta events for full fidelity,
- and versioning rules for forward compatibility.

---

## 🧭 Research, Open Questions & Known Issues

### [`OPEN_NOTES.md`](./OPEN_NOTES.md)
**Exploratory ideas, design debt, and unresolved questions**

Read this if you want context on:

- melodic concordance and similarity (intervallic, functional, pitch-class),
- functional-harmony reinterpretation of chord progressions,
- slash chords, bass awareness, and instrumental roles,
- automation strategies (heuristics → Markov → traditional ML),
- UX principles (concentric clarity, double-diamond workflows),
- known interaction issues (zooming, iPadOS selection),
- and identified correctness bugs (e.g. chord-bar alignment).

This document intentionally contains **incomplete or provisional material**.
Items here may later graduate into formal specs, roadmap items, or tests.

---

## Suggested reading order

If you’re new to the codebase:

1. **ARCHITECTURE.md** — conceptual grounding
2. **HARMONY_ENGINE.md** — musical correctness & trust
3. **SEGMENTATION.md** — structural evolution
4. **METADATA_MIDI.md** — persistence & interoperability
5. **OPEN_NOTES.md** — research context & open ends

---

## Relationship to the User Guide

These documents are **developer-facing**.

For musician-facing explanations and usability framing, see:

- the User Guide on GitHub Pages  
  https://enkerli.github.io/MIDIcurator/

The User Guide and these docs are designed to complement each other:
- the guide surfaces usability issues,
- this documentation explains how to fix them *without breaking the system’s identity*.

---

## Design principle (summary)

> MIDIcurator is a system for **curating musical meaning**,  
> not merely manipulating MIDI data.

Keep that principle intact, and the rest follows.
