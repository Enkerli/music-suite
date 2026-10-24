# Twirl

A gesture toy. Draw a stroke and you hear it as you draw. When you lift
your finger, it keeps looping on its own clock. Then it drifts, spins, can be
moved, turned, stretched, and can have children.

**Play it:** <https://enkerli.github.io/music-suite/apps/twirl/>. It works
with a finger, a pencil or a mouse, in any current browser, iPad Safari
included. MIDI out appears where the browser has Web MIDI (Chromium,
including on Linux).

Public Domain (CC0-1.0), like the rest of the suite.

## What's in this folder

| File | What it is |
|---|---|
| `index.html` | **The whole app.** One self-contained file: markup, styles and one script. No build step, no dependencies. `scripts/sync-apps.mjs` copies it to `docs/apps/twirl/` for Pages. |
| `test/` | Browser tests (Vitest + Playwright): draw-and-hear, mutation, saving and sharing, the suite's shared contracts, and accessibility. See [Tests](#tests). |
| `ROADMAP.md` | Where Twirl goes next, in what order, and the rules every change has to keep. |
| `A11Y.md` | The accessibility audit record: what was found, what was fixed, what's still untested. |

## How it works, in one paragraph

A stroke and a loop are the same object; a loop is a stroke that finished.
Its points are stored as drawn (normalized to the sheet); what moves is a
transform (position, turn, size) plus Morph's wandering. **Height is pitch**
(the horizontal lines are the pitch grid, in the chosen scale and tuning).
**Distance along the path is time** (one bar spans the sheet's width; the
vertical lines are the beat division). **Direction picks the voice**: → pluck,
↑ bell, ← blip, ↓ drum, a fast scribble is a shaker. **Size is speed**: bigger
plays slower, snapping to musical ratios. A loop plays either as drawn
(Free) or read on the beat grid (Lock); the scheduler decides at playback, so
changing Lock, the division or the scale is heard on the next note. The
comment block at the top of the script maps each rule to the one place it
lives in the code.

## Disclosure levels

Twirl opens at **Simple**: draw, hear, toys, scenes. **More** adds the
musical controls (grid, root, range, division, pen, Lock, Morph, Arc, swing,
Air) and most per-loop settings, including **Mutate**. **Everything** adds
tuning, Revoice, Walk, Drone and the rest. Each level only adds; nothing
moves. The choice is remembered in this browser.

## Keyboard

Every touch on the sheet draws, so the keyboard is how to steer without
leaving marks. `?` in the app lists every key. The essentials: `Space`
play/pause, `T` the Toybox (ready-made shapes, no drawing needed), `1`–`9` pick a loop and `Enter`
opens its settings (Enter again closes them), `Tab` / `⇧ Tab` step through
the loops, arrows move the selected one, `,` `.` turn it, `F` is full screen,
`Esc` closes whatever is open. `C` takes you into the controls, where `Tab`
moves through them. On an iPad keyboard without `Esc`, `` ` `` or `⌘ .`
does the same. ⇧ + a digit always picks a pen; help is `H`.

The full player's guide is on the site:
<https://enkerli.github.io/music-suite/doc.html?p=twirl-guide> (its source is
the `twirl-guide` page in [docs/site.md](../../docs/site.md)).

## Saving and sharing

Everything is stored in the browser (`localStorage`), never on a server:

- **Scenes**: six slots for whole sheets. The last sheet also comes back
  by itself.
- **My toys**: single loops you kept, to drop again anywhere.
- **Takes**: what you *did* (strokes, moves, settings), recorded with ● Rec
  and replayable. The sound of a take lasts until the page closes, unless
  you save it as a file.
- **Codes**: any of the above as text (`twirl:s1.…` a sheet, `t1` a toy,
  `a1` everything, `f1` a take). Paste a code into Scenes → Paste a code,
  or put one after `#` in the page's address. Codes are deflated JSON in
  base64url, so a busy sheet is a few kilobytes.

Codes stay readable across versions. New fields go at the *end* of a loop's
packed row, so older codes simply lack them. The tests hold this in place:
a code without `generation` and `lineage` still opens.

## Tests

```bash
npm install                        # from the repo root, once
npx playwright install chromium    # Playwright's browser, once per machine
npx vitest run apps/twirl          # just Twirl (about a minute)
npm test                           # the whole suite, Twirl included
```

What they hold in place:

- **Draw and hear.** A stroke sounds *while* it's drawn, each note within
  one grid step of the touch; after release it loops and plays again on its
  own. Also with Lock on, from a tap, and from the keyboard via the Toybox.
  Every roadmap experiment has to keep these green.
- **Mutation.** A child inherits the parent's voice, chord, rhythm, timing and
  motion, and leaves the parent untouched. Generations count up within one
  family. The 14-loop cap holds and the selection never points at a removed
  loop.
- **Saving and sharing.** Share codes, kept toys, scenes and takes
  round-trip, including generation and family. Older codes still open.
- **Shared contracts.** Air's Barlow indispensability matches
  `packages/theory/vectors/rhythm.json`, like every other port. Scale grids
  are leftmost-LSB masks ([CONVENTIONS.md](../../CONVENTIONS.md)): Ionian
  is 2741, Lydian 2773. Every grid and tuning rises.
- **Accessibility.** axe on eleven states × two colour schemes, plus
  keyboard, focus, single-pointer and preference checks. Details are in
  [A11Y.md](A11Y.md).

Without Chromium the browser tests skip locally, with a note. In CI they
fail instead: `tests.yml` installs the browser.

## Where it runs

| Where | Status |
|---|---|
| Pages: `…/music-suite/apps/twirl/` | Deployed from `main` by `deploy-pages.yml` (an in-repo app, so CI rebuilds it) |
| claude.ai artifacts | The pages it started as, kept in step with this file. There, a note in the drawer says Twirl lives on Pages now, and share links point to Pages. On Pages (or a local copy), a quiet "Fork me on GitHub" sits in the footer instead. |
| Plugin / standalone (AUv3, LV2…) | Not yet: see [ROADMAP.md](ROADMAP.md#the-plugin-and-standalone-path) |

## History

Twirl started as a single-file claude.ai artifact and was developed there
through several versions, ending with the Mutation prototype (a loop spawns a
related answering part). It joined this repo on 2026-10-24. The
accessibility pass and the tests (see A11Y.md) came with it.
