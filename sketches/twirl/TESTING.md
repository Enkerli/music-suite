# Twirl: testing strategy

*Public Domain (CC0-1.0).*

Twirl's first quality is that it's immediately satisfying. Tests protect
that first, then correctness, then the plumbing. Four layers, added as the
code grows up (see [ROADMAP.md](ROADMAP.md)).

## 1. Now: a smoke test of the real page

`test/smoke.mjs` drives `index.html` in headless Chromium and checks what
has broken, or been reported, before:

```bash
node sketches/twirl/test/smoke.mjs     # exits 1 on any failure
```

Needs Playwright with a Chromium (`npm i -D playwright`, or a global
install; the script finds either).

What it covers:

| Area | Checks |
|---|---|
| First contact | opens with example loops; opens at Simple; Simple hides the advanced controls; sound starts on the first tap |
| Drawing | a stroke becomes a loop; a Lock stroke becomes a locked loop that strikes on grid steps |
| Live quantizing | Division 1/4 puts every existing note on a beat; 1/16 lets them back between; toggling Lock changes existing loops at once |
| A loop's settings | holding opens them; zone and movement apply; a "low" loop glides into the low zone; its Volume scales its notes |
| Sounds | every voice of every pack plays without errors; Notes density changes note spacing |
| Saving | Clear takes two taps and never touches saved scenes |
| Codes | *Copy everything* in one browser, paste in another: scenes and toys arrive |
| Keyboard | Space plays; digits select loops, arrows move the selected one, X mutes it, ⇧2 picks a pen, V shows the palette and the palette sets the pen; ⌫ undoes and ⇧⌘Z redoes; toggles, cycling pickers (and ⇧ backwards), tempo, levels, shelf, Esc, the ? list; ⇧⌫ twice clears |
| Rhythm, harmony, sound | even and euclidean rhythms land where they should; sevenths stack four notes; swing delays every other step; drone voicings rebuild; every pack plays every voice, chords included |
| Recording | ⇧Space records a take, and it shows in Takes |
| Selection | open settings follow the selected loop (1, Enter, 2); Enter after pressing Play opens settings instead of pausing |
| Direction, breathing, arcs | ping-pong alternates; reverse plays a note drawn at t at L − t; *every other* rests on odd passes; Air thins a busy stretch; a 4-bar Arc runs home, away, pull, resolve and resolving lands on the home chord's steps; D duplicates |
| Keys, numbers, recording | ? typed as ⇧6 opens the list without touching the pen; H opens it; numbers hidden by default, shown by a digit, hidden by the drawer button; ● Rec shows stopped once stopped; Space after ● Rec doesn't start another take; a recorder the browser stops ends the take |
| Waits, offsets, Barlow | Barlow weights for 16ths and triplets; Air keeps the most indispensable steps and plays weak ones softer; a wait lengthens the pass and stays silent; Starts moves a step; a duplicate is half a cycle behind; scenes keep wait and phase; the Call toy waits |
| Playflows | ● Rec keeps a flow; Replay clears the sheet, rebuilds it, and ends where you left off (drawn, moved, muted, erased, tempo changed); touching the sheet takes over; a take's code pastes into another browser's Takes |
| Field links | the three links in `test/fixtures/`, exactly as received (stray `!`, line breaks, a 3,300-character Safari link), all open by pasting |
| Phone | no sideways scrolling at 375px; the drawer opens; levels reveal controls |
| Everywhere | no page errors |

**Fixtures are field reports.** When a shared link or code fails for
someone, save it in `test/fixtures/` as received, junk included, and add
a line to the field-links loop. That's how the `!` + line-break mangling
was caught and pinned.

## 2. Each change: by hand, on devices

Headless Chromium can't tell whether something feels good, or whether
iOS Safari behaves. Before publishing a change that touches gestures,
layout or sound:

- **iPad** (Safari, the published page): draw a spiral; shake; two-finger
  resize; hold a loop; open the drawer at each level; open a pasted code.
- **iPhone mini** (Safari): the same, plus check nothing important is
  under the bar or the shelf.
- **Immediacy check**: from a fresh browser, the first touch makes sound,
  and the first minute needs no reading. If a change adds anything to
  Simple, it has to earn its place there.
- **Ears**: each sound pack at each Notes density, with Lock on and off.
  Lock should sound like a pulse; Free like a gesture.

Gesture thresholds (shake speed, double-tap time, grab radius) are tuned
by hand here and nowhere else.

## 3. When the engine is extracted: unit tests and vectors

Following CONVENTIONS.md ("test vectors are the cross-language
contract"), the engine gets JSON vectors *before* any port:

- **Tracer**: point streams → note events (stride, turning, shake
  detection and its hand-off back to drawing).
- **Lock reading**: path + transform + grid + division → strike/hold per
  step.
- **Scheduler window**: loops + `[cursor, horizon)` → events, including
  retiming mid-loop and tab-sleep catch-up (no double-firing, no bursts).
- **Grids and tunings**: degree → cents for every grid × tuning × root
  (shared with `@enkerli/theory` where the scales come from DrawnQurve's
  masks).
- **Codes**: scene → token → scene round-trips; the field fixtures decode;
  junk-tolerant parsing.

Run with Vitest like the rest of the monorepo (`npm test`). The C++ port
(plugin) and any Lua port (PdLua) run the same vectors.

## 4. When it's a plugin: the validation ladder

The enkerli-juce `TESTING.md` ladder applies as for the other plugins:
build matrix → `auval` → pluginval (strictness 10) → WKWebView smoke →
iOS cross-compile → real hosts on physical iPads (AUM). Twirl-specific
additions:

- host tempo and transport drive the clock (start, stop, tempo ramps,
  loop points);
- MIDI out timing against the host's sample position;
- incoming MIDI draws strokes;
- MTS-ESP: the host's tuning client follows Twirl's grid, tuning and root.

## Not tested (yet), on purpose

- Exact audio output. The voices are simple and change often; rendering
  them offline and comparing hashes would mostly test the noise source.
  Worth adding once sound packs settle (OfflineAudioContext, fixed seed).
- Visual snapshots. The drawing animates by design.
