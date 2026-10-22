# Twirl: roadmap

*Updated 2026-10-21. Public Domain (CC0-1.0). Companions:
[BRIEF.md](BRIEF.md) (what and why), [GUIDE.md](GUIDE.md) (how to play),
[TESTING.md](TESTING.md) (how it's checked).*

Twirl started as a one-file toy and has become a small project. The
targets, once the Mac is back: **a Workspace module, a plugin (sound out
and MIDI out), and a standalone app**, all from one engine. This page lays
out the path so each step can happen on its own.

One rule above the others: **people find Twirl immediately satisfying;
nothing on this roadmap is allowed to cost that.** Every surface opens at
*Simple* (draw, hear, loop), and depth arrives by progressive disclosure,
from "I don't know what's happening, I'm discovering" to something close
to a tool.

## Where it stands (sketch v8)

One self-contained `index.html` (no build), published as a claude.ai
artifact and kept in `sketches/twirl/`. Organised along the seams that
matter next:

| Layer | What's in it | Pure? |
|---|---|---|
| **Engine** | grids and tunings; loop transforms (`place`); `Tracer` (free triggers, shake); Lock reading (`sampleLoop`, `lockStep`); the stateless scheduler window; temperaments and zones; scene / toy / everything (de)serialisation and codes | Nearly: it reads the sheet size and the audio clock |
| **Voices** | three sound packs (paper, mallets, chip) × five voices; delay; drone | No: Web Audio |
| **Outputs** | `sound()` → a pack's voice and/or `sendMidi()` | No |
| **Surface** | gestures, drawing, the slim bar, the drawer with levels, the shelf (Toybox / My toys / Scenes), the loop inspector | No: DOM + canvas |

## Step 1: extract the engine (no Mac needed)

Make the engine a plain module with no DOM and no audio, in sheet
coordinates (unit square) and beats:

```ts
type Gesture = { x: number; y: number; t: number }[];          // a stroke
type NoteEvent = {
  beat: number;           // when, on the shared beat clock
  voice: "pluck" | "bell" | "blip" | "drum" | "shake";
  cents: number;          // above the root (grid + tuning + walk applied)
  drum?: "kick" | "snare" | "hat";
  velocity: number; pan: number; loopId: string;
};
interface Engine {
  addStroke(g: Gesture, opts): LoopId;  // free or locked, pen, density
  edit(id, op): void;                   // move, turn, resize, bend, zone, temper…
  window(from: number, to: number): NoteEvent[];   // the scheduler
  frame(dt: number): void;              // morph easing, zones
  serialize(): Scene; load(s: Scene): void;
}
```

Then the canvas page, the Workspace module and the plugin are three
surfaces over one engine. Test vectors first, per CONVENTIONS.md (see
TESTING.md, layer 3).

Proposed home: `packages/twirl` (engine) + `apps/twirl` (page), like
`packages/upi` + `apps/serpe`. HANDOFF.md's "no new features until
integration is robust" still stands: promoting Twirl out of `sketches/`
is a deliberate decision, not drift.

## Step 2: a Workspace module

- Twirl's note events go onto the Workspace bus, so other modules (Vane,
  the drum kit, PitchFold's quantiser) can sound or transform them, and
  incoming bus notes can draw strokes (see Decided).
- Reuse rather than duplicate: `@enkerli/theory` for scales (Twirl's grid
  list is DrawnQurve's masks), `@enkerli/drumsynth` once its voices can be
  pitched, `@enkerli/ui` tokens (already the palette here).
- Scenes and toys become **library items** (docs/LIBRARY_SPEC.md), so they
  show up in the shared Library drawer next to other apps' patterns.

## Step 3: the plugin and the standalone (Mac)

The enkerli-juce WebView archetype, as for PitchFold and DrawnQurve: the
page is the UI; the bridge carries note events out and host events in.

1. **MIDI effect first** (AUv3 MIDI processor for AUM on iPad; AU/VST3
   MIDI effect on desktop). Biggest win per hour: Twirl driving anything,
   including the Diosynth and the RND.
   - **Host sync**: host tempo and transport drive the beat clock.
     The scheduler is beat-based, so this is a clock swap.
   - **Incoming MIDI draws strokes**.
2. **Instrument** (sound out). Either port the voices to C++ (each is a
   few oscillators, filters and envelopes), or the Vane route (DSP in C++,
   compiled to WASM for the browser, native in the plugin). Sound packs
   map to presets.
3. **Standalone app** (macOS, iPadOS): the same build in the JUCE
   standalone wrapper, with real MIDI out (which WebKit can't do) and
   file export.
4. **Tuning over MIDI**: MTS-ESP first (Twirl as tuning master,
   broadcasting grid + tuning + root), MPE as the fallback, rounding last.

## Step 4: sandboxes on a zoomable map

Each **sandbox** is a sheet (its own loops, grid, tuning, division,
tempo); sandboxes sit on a large **map** you pan and zoom through.

- **Data**: a sandbox *is* a scene; a map is `{scene, x, y, scale}[]`.
  Saved scenes and pasted codes drop onto the map as-is.
- **Gesture**: two fingers on empty paper pan and zoom the map.
- **Listening**: sandboxes in view play, fading with distance: zoomed out
  is a mix, zoomed in is a solo. The "sound forest", with the grid as
  ground.
- **Level of detail**: zoomed out, sandboxes draw as their thumbnails.

Cleaner after Step 1 (one engine per sandbox), possible before.

## Sharing: no servers, no files

Decided and built: everything moves as **codes** (deflated, base64url,
labelled `twirl:`): a sheet, a toy, or *everything* (all scenes and toys).
Codes survive messaging apps, and Universal Clipboard carries them between
Apple devices. Links carry the same token after `#` but claude.ai only
passes short, clean link endings to the page, so links are a convenience
for small things.

Possible later, only if wanted: a claude.ai per-user storage capability
would sync scenes across a person's devices automatically. It would mean
relying on a central store, which so far is exactly what we're avoiding.

## Decided

- **Tempo**: each sandbox can have its **own tempo**; the plugin syncs to
  the **host** (a sandbox's tempo becomes a ratio of the host's while
  synced).
- **Incoming MIDI draws strokes**: time runs along the stroke, pitch sets
  height, velocity sets speed; the result loops like any other stroke.
- **Tuning over MIDI**: MTS-ESP, then MPE, then rounding.
- **Voices per loop**: each loop has its own pen and its own "turning
  changes voices" switch (built in v5).
- **Zones**: a loop can be told where it lives (built in v5).
- **Sound packs**: different instruments, same five voices (built in v5;
  more to come).
- **Sharing a whole collection**: *Copy everything* (built in v5).

## Recording a playflow

Built (v8): ● Rec keeps a **playflow**, an event log in beats (loops
added, reshaped, posed, erased; settings changed), sampled four times a
second and replayable on the sheet; it travels as a `twirl:f1.` code.
Next steps:

- **Editing** a take: trim, and splice two takes together.
- **Morph** isn't recorded (replayed loops wander afresh); a seeded random
  per loop would make replays exact without growing the code.
- With the engine extracted (Step 1), every edit becomes an explicit
  operation, so the log can record operations instead of sampling state.
- In the plugin, a take could export as a MIDI file.

## Smaller next things

- Tune gesture thresholds on the real iPad and iPhone.
- More sound packs; let a loop pick its own pack.
- Audio recording from the standalone page.
- Mirror a loop (flip it left-right or up-down). Reverse and ping-pong
  are in (v8).
- Zones on the X axis too (left/right = pan regions)?

## Open questions

- Name: "Twirl" for now.
- Should Lock read "every step" (now) or "every grid cell entered" (both
  axes)? The current one is closer to DrawnQurve; worth A/B-ing by ear.
