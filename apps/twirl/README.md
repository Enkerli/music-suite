# Twirl

A gesture toy. Draw a stroke and you hear it as you draw. Lift your finger
and it keeps going round as a loop; loops drift and spin, touch each other,
have children and change over time. The first touch makes a sound; everything
else is disclosed as you go.

**Play it:** <https://enkerli.github.io/music-suite/apps/twirl/>, with a
finger, a pencil or a mouse, in any current browser, iPad Safari included.
MIDI out appears where the browser has Web MIDI (Chromium, Linux included).
The player's guide: <https://enkerli.github.io/music-suite/doc.html?p=twirl-guide>
(its source is the `twirl-guide` page in [docs/site.md](../../docs/site.md)).

It is semi-generative play at its plainest ("smidgen", Alex's jokey word for
the semi-generative approach running through his explorations; see
[INTENT B1](../../docs/INTENT.md)): what you draw is performed, then handed
over to a life of its own, and you can step back in at any time.

Public Domain (CC0-1.0), like the rest of the suite.

## What's in this folder

| File | What it is |
|---|---|
| `index.html` | **The whole app.** One self-contained file: markup, styles and one script. No build step, no dependencies. `scripts/sync-apps.mjs` copies it to `docs/apps/twirl/` for Pages. |
| `test/` | Browser tests (Vitest + Playwright). See [Tests](#tests). |
| `ROADMAP.md` | Where Twirl goes next, in what order, and the rules every change keeps. |
| `PLAYTESTING.md` | Targeted sessions with people: what to learn, who, how, conditions to compare. |
| `A11Y.md` | The accessibility record: what was found, fixed, and still untested. |

## How it works

A stroke and a loop are the same object: a loop is a stroke that finished.
Its points are stored as drawn (normalized to the sheet); what moves is a
transform (position, turn, size) plus Morph's wandering. **Height is pitch**,
**distance along the path is time** (the sheet's width is one bar),
**direction picks the voice** (→ pluck, ↑ bell, ← blip, ↓ drum, a scribble is
a shaker) and **size is speed**. Every loop runs on the sheet's one clock; the
scheduler decides each note at playback (free or on the grid, snapped to the
division as it is *now*), so changing Lock, the division or the scale is heard
on the next note.

The script is in numbered sections, each with a comment block that states its
rules. Where to find things:

| Idea | Section | Names to look for |
|---|---|---|
| Scales, tunings, divisions | 1 | `GRIDS`, `TUNINGS`, `DIVS` |
| The clock; timing freedom (Snap, Feel, Clock) | 2, 2b | `nowBeat`, `snapLoop`, `feelOf`, `clockFactor` |
| Voices, packs, Vary, MIDI | 3, 3a, 3b | `sound`, `VOICES`, `PACKS`, `varied`, `sendMidi` |
| Loops, temperaments, Walk and Arc; spacing by register | 4, 5 | `newStroke`, `TEMPERS`, `harmonyAt`, `walkShift`, `walkFor`, `sheetRows`, `bandAt` |
| Where notes land; Lock | 6a, 6b | `Tracer`, `DENSITY`, `retrace`, `lockStep`, `airKeep` |
| Life and Influence | 6c | `lifeState`, `bloomNotes`, `ageLoop`, `influence`, `settle` |
| The scheduler | 7 | `schedule`, `lookahead` (adapts to late ticks) |
| Contacts: crossings, lines touching, meetings | 7b | `checkMeetings`, `touch`, `linesTouch`, `meet`, `breedWith` |
| Drone and its space; Warmth (hiss, crackle, wobble) | 8, 8b | `setDrone`, `DRONE_SPACES`, `updateDrone`, `buildRoom`, `setWarmth` |
| Toybox (chimes, spinner, tadpoles…) | 9 | `TOYS`, `dropToy`, `dropTadpoles`, `startingSheet`, `freshKey` |
| Touch: draw, drag, pinch, Edit, smoothing | 10 | `endStroke`, `settleStroke`, `smoothLoop`, `pointerEnd`, `addNoteAt`, `NOTE_SOUNDS` |
| Drawing; colours by voice; the grid layer; sharpness | 11 | `frame`, `voiceColours`, `strokePath`, `drawGridCached`, `adaptQuality`, `diagReport` |
| Scenes, codes, toys, files | 12–12c | `serialize`, `packScene`, `encodeScene`, `collection` |
| Controls, settings, Copy, takes, keys, messages | 13 | `syncInspector`, `copySettings`, `toggleRecording`, `KEYS`, `toast` |
| First frame | 14 | `boot` |

## Saving and sharing

Everything is stored in the browser (`localStorage`), never on a server:
scene slots, the last sheet, My toys, and takes (what you *did*; their sound
lasts until the page closes unless saved as WAV). **Codes** carry any of these
as text (`twirl:s1.…` a sheet, `t1` a toy, `a1` everything, `f1` a take):
deflated JSON in base64url. **Download everything** saves the same data as
readable JSON; **Open a file** brings it back.

Old work keeps opening: new fields go at the *end* of a loop's packed row, so
older codes simply lack them, and the tests check that they still open.

## Tests

```bash
npm install                        # from the repo root, once
npx playwright install chromium    # Playwright's browser, once per machine
npx vitest run apps/twirl          # just Twirl (a couple of minutes)
npm test                           # the whole suite, Twirl included
```

What they hold in place, in `test/twirl.test.js` and `test/twirl.a11y.test.js`:

- **First contact.** A stroke sounds *while* it's drawn, within one grid step
  of the touch, and loops after release; also with Lock on, from a tap, and
  from the Toybox. Every experiment keeps these green.
- **Contacts.** Crossings, lines touching (at the moment they touch),
  meetings; sound, bump, trade, breed and infect, their cooldowns, and the
  14-loop cap (a child takes the oldest loop's place, never a parent's).
- **Change over time.** Life (bloom adds notes beyond the drawn ones, swell
  is loudness, fade and brief end into undo, lengths in passes or bars),
  Influence (feed and drain, settling back), Evolve, and what Surprise may
  give (lives and influence only on a busy sheet).
- **Harmony and time.** Walk's ways and pace; each loop's part (moves, stays,
  fits); Snap, Feel and Clock; a fresh sheet's key and tempo; `?start=macro`.
- **Editing and copying.** Notes re-spaced, added, removed, given their own
  sound; Mutate; Copy to a family, all loops or chosen loops.
- **Saving.** Codes, toys, scenes, takes and JSON files round-trip; older
  codes open.
- **The look.** Beats (ticks and lines) hidden unless asked for (the lines
  show with Lock); a trembling stroke visibly smoothed, notes still on the
  line; paths in their voices' colours.
- **Spacing, warmth, tadpoles.** Rows by register (the bass thinned, octaves
  equal, older sheets even), chords opened low down; Warmth's hiss, crackle
  and wobble scaled and silenced; the Drone's spaces (binaural sets left and
  right apart); tadpoles, and which children inherit breeding.
- **Sound and performance.** Vary, pause without a buzz, no zero-loudness
  errors; a busy sheet inside a frame budget, the adaptive lookahead and
  sharpness, the grid layer.
- **Shared contracts.** Air's Barlow weights match
  `packages/theory/vectors/rhythm.json`; masks are leftmost-LSB
  ([CONVENTIONS.md](../../CONVENTIONS.md)): Ionian 2741, Lydian 2773.
- **Accessibility and keyboard.** axe on every reachable state in both colour
  schemes; Space is Play/Pause outside panels; Tab wraps inside panels and
  steps through loops' settings; Escape keys without an Esc key; focus
  returns; single-pointer alternatives. Details in [A11Y.md](A11Y.md).

Without Chromium the browser tests skip locally, with a note; in CI they fail
instead (`tests.yml` installs the browser).

## Where it runs

| Where | Status |
|---|---|
| Pages: `…/music-suite/apps/twirl/` | Deployed from `main` by `deploy-pages.yml` |
| claude.ai artifacts | The pages it started as, kept in step with this file; there, the drawer says Twirl lives on Pages, and share links point there |
| Plugin / standalone (AUv3, LV2…) | Not yet: see [ROADMAP.md](ROADMAP.md#the-plugin-and-standalone-path) |

## History

Twirl started as a single-file claude.ai artifact, developed there through
several versions up to the Mutation prototype, and joined this repo on
2026-10-24 with tests and an accessibility pass. Since then: contacts, Life
and Influence (the "evolving patch"), sounds across banks, timing freedom, an
optimization pass, and a lot of keyboard work for the iPad.
