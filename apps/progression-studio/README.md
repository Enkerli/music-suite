# Progression Studio (ProgGenie)

A jazz chord-progression studio: generate progressions from a corpus of 2,611
lead sheets, edit them on a leadsheet, hear them, analyze their harmony, and
hand them to the rest of the suite. Runs as a web app, a JUCE **standalone**,
and an **AUv3 MIDI processor** plugin — one web codebase across all three.

> The corpus lead sheets are **never published** — only derived statistics
> (transition counts, n-grams) ship. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#the-corpus-and-its-statistics).

## Documentation

| Doc | What it covers |
| --- | --- |
| [**The Story**](docs/THE_STORY.md) | Plain-language tour — what it is and what it does, for anyone (no music or code needed). |
| [**User Guide**](docs/USER_GUIDE.md) | How to use ProgGenie — generating, editing, MIDI, modulation, curation, export, playback. |
| [**Architecture**](docs/ARCHITECTURE.md) | The code — the data contract, theory modules, generation pipeline, the shared editor, the three runtimes, testing. |
| [**History & Roadmap**](docs/HISTORY.md) | How it got here, as a narrative — and where it's going. |
| [`DESIGN_BRIEF.md`](DESIGN_BRIEF.md) · [`DESIGN_QUESTIONS.md`](DESIGN_QUESTIONS.md) | The design source material and open questions for the design pass. |

## Quick start

```bash
# from the monorepo root (workspaces: @enkerli/theory, @enkerli/ui, …)
npm install
npm run build -w @enkerli/theory      # the theory core compiles to dist/
npm run dev   -w progression-studio   # vite dev server (web)
npm test                              # 838 vitest specs across the suite
```

The plugin lives in a **separate repo**, `progression-studio-plugin`, which
embeds this app's built bundle in a JUCE WebView. See
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#the-three-runtimes) and the
plugin repo's README for the build/validation ladder.

## At a glance

- **One document, two assistants.** The leadsheet is the permanent center; the
  generator proposes into it, live MIDI writes into it, the profile colours
  what both offer, and the library stores and recalls it.
- **Generate** a seeded Markov walk over the corpus, with controls for length,
  adventurousness, source engine, voice, and depth (variable-order context,
  substitution reharm, mechanical modulation).
- **Edit** directly: tap a chord for the inspector, tap a caret (or type) to
  insert, press-and-hold to move, with live-MIDI input writing at a cursor.
- **Analyze**: per-chord chord-scale on an isomorphic pad grid, implied
  key-area detection, transition-character motion overlay, functional/absolute
  reading toggle.
- **Hear it** (web/standalone) and watch the **now-playing** card follow the
  playhead; **export** a Standard MIDI File that carries the canonical
  progression, or **Send to MIDIcurator**.
