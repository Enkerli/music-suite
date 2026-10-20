# Twirl — roadmap

*2026-10-20. Public Domain (CC0-1.0). Companion to [BRIEF.md](BRIEF.md),
which covers what the sketch does and why.*

Twirl started as a one-file toy and is turning into a small project. The
target, once the Mac is back: **a Suite module, and a plugin with both
sound out and MIDI out.** This page lays out the path so each step can
happen on its own, in any order the mood allows.

## Where it stands (v3)

One self-contained `index.html`: canvas UI, Web Audio voices, optional Web
MIDI out, scenes in `localStorage`. Everything is in one file on purpose.
The code is already organised along the seam that matters next:

| Layer | What's in it today | Pure? |
|---|---|---|
| **Engine** | pitch grids and tunings, `place` / transforms, `Tracer` (free triggers), `crossings` (lock triggers), the stateless scheduler window, temperaments, scene (de)serialisation | Nearly: it reads the sheet size and the audio clock |
| **Voices** | `VOICES` (pluck, bell, blip, pitched drums, shaker), delay, drone | No: Web Audio |
| **Outputs** | `sound()` → voices and/or `sendMidi()` | No |
| **Surface** | pointer handling, drawing, trays, toasts | No: DOM + canvas |

## Step 1: pull the engine out (no Mac needed)

Make the engine a plain module with no DOM and no audio:

- input: gestures as `{x, y, t}` points in a unit square, plus edit
  operations (move, turn, resize, bend, mute…);
- output: **note events** `{beat, voice, pitch (cents above root),
  velocity, pan, loopId}` for a window of beats.

Then the canvas page, a Workspace module and a plugin are just three
surfaces over the same engine. Per CONVENTIONS.md, the parts a C++ or Lua
port would need (`crossings`, the Tracer, the scheduler window, tunings)
get **JSON test vectors** first, so any port has to match them.

Where it lives is a decision for later: `packages/twirl` (engine) +
`apps/twirl` (page), following the pattern of `packages/upi` and
`apps/serpe`. HANDOFF.md's "no new features until integration is robust"
still stands; promoting Twirl out of `sketches/` is a deliberate step,
not a drift.

## Step 2: a Suite module

- **Workspace module**: Twirl's note events go onto the Workspace bus, so
  other modules (Vane, the drum kit, PitchFold's quantiser) can sound or
  transform them. The Workspace already has the module registry and the
  bridge.
- **Shared pieces it should reuse rather than duplicate**: `@enkerli/theory`
  for scales (the grid list is DrawnQurve's masks, so these line up), and
  `@enkerli/drumsynth` for drums once its voices can be pitched.

## Step 3: the plugin (Mac)

Use the enkerli-juce WebView archetype, as PitchFold and DrawnQurve do:
the page becomes the plugin UI; the bridge carries note events out.

1. **MIDI-out first** (AUv3 MIDI processor + AU/VST3 MIDI effect +
   standalone). On the iPad this is the big win: Twirl in AUM driving
   anything, including the Diosynth and the RND. Host tempo replaces the
   internal clock (the scheduler is already beat-based, so this is a
   clock swap, not a rewrite).
2. **Then sound out.** Two options, not exclusive:
   - port the five voices to C++ (they're small: a few oscillators,
     filters and envelopes each);
   - or the Vane route: compile DSP to WASM for the browser and use the
     same C++ in the plugin.
3. **Microtonal MIDI**: MPE (a channel per note, pitch bend per note) or
   MTS-ESP. Until then, microtonal grids round to semitones on MIDI out.

## Step 4: sandboxes on a zoomable map

The idea: each **sandbox** is a sheet (its own loops, grid, tuning,
division, maybe tempo ratio); sandboxes sit on a large **map** you pan and
zoom through.

- **Data**: a sandbox *is* a scene (already serialisable); a map is a list
  of `{scene, x, y, scale}`. Saved scenes, and share links, can be dropped
  onto the map as-is. A whole map could travel as a link the same way, if
  it stays small enough.
- **Gesture**: two fingers on empty paper pan and zoom the map (two
  fingers on a loop still turn and resize the loop).
- **Listening**: what you hear depends on where you are. Sandboxes in
  view play, louder towards the centre, fading with distance. Zooming out
  becomes a mix of the whole map; zooming in is soloing one sandbox.
  Walking through it is the "sound forest" idea, with the grid as ground.
- **Level of detail**: zoomed out, sandboxes draw as their thumbnails
  (already rendered for the Scenes tray) and stop drawing crossings.

This can be built as v4 of the sketch, before or after Step 1. Building
it after Step 1 means one engine instance per sandbox, which is cleaner.

## Smaller next things (any time)

- Audio recording from the standalone page. (Scene sharing landed as
  links: the scene travels in the `#fragment`.)
- Group the less-used toggles (Walk, Drone, Revoice) so the toolbar fits
  one row on an 11" iPad.
- Tune the gesture thresholds on the real iPad (shake, double-tap, grab
  radius).
- Reverse / mirror a loop.

## Open questions

- Should a sandbox have its own tempo, or a ratio of a shared one? A ratio
  keeps everything phase-related; its own tempo is more like a forest.
- In the plugin, is a "stroke" also recordable from incoming MIDI (a
  played line becomes a drawn one)? It would close the loop with the
  Diosynth.
- Name: "Twirl" for now.
