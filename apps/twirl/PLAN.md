# Twirl — the plan

*Made 2026-10-25 from Alex's [triage](https://claude.ai/artifact/9cRP9c3bvqSRQG7NzPYXYA)
and the [roadmap](ROADMAP.md): what gets done, in what order, how, where, and
by whom. Tick boxes as things land. The roadmap keeps the reasons and the
full catalogue of ideas; this file keeps the work.*

**Who.** **Alex** = on a device (playing, listening, reporting). **Claude** =
in a session (code, tests, docs, PRs). Most phases need both.

**Where.** Code in `apps/twirl/` on a `twirl/<topic>` branch, merged with
CI green; Pages serves `main` at <https://enkerli.github.io/music-suite/apps/twirl/>.
Reports come back as **⇧Q** (copies a JSON report: frame rate, errors, and
now the pen and MIDI too) pasted into the conversation, plus what you heard.

**Order.**

| Phase | What | Why this order |
|---|---|---|
| 1 | **Linux desktop**: Chromium, a synth over Web MIDI, a graphics tablet | Next, while the Mac is in the shop; the plugin's first step needs no C++ |
| 2 | **Languages: French**, as one package | "Coming soon": table, glossary, reviewable French, the interface, the docs |
| 3 | **More templates** | Small; can slot between other phases |
| 4 | **Health**: an off-thread clock; the iPad measured when it's back | A stall spoils any playtest |
| 5 | **Design pass**, and aligned with the suite | The brief is ready; best after French (longer labels) |
| 6 | **Playtests, round 1**, bilingual | With the new design and both languages |
| W | **Workshops**: six conversations, any time | Decisions for the 41 Workshop ideas |

Phases 5 and 6 could swap: playtests first would show what the design pass
should fix, design first means people meet the version we keep. *Decide
before phase 5.*

---

## Phase 1 — Linux desktop

**Where**: the Ubuntu desktop (or the miniPC), Chromium (or Chrome), the
Pages URL. Twirl needs nothing installed; the synth does.

### 1a. Twirl itself in Chromium on Linux

- [x] Open Pages, tap, draw: sound on the first touch, a loop after release.
- [ ] Draw for a minute, open the drawer (☰), switch to Everything, fold and
      unfold a section; Start over (two taps).
- [x] A busy sheet: Toybox several times, or `?template=tadpoles`; leave it two
      minutes. **Q** shows fps, slowest frame and ticks late; **⇧Q** copies it.
      (Brave on Linux, 2026-10-25: 60 fps, slowest frame 17 ms, no errors;
      "some hiccups" when adding short loops quickly, about 59 notes a
      second. ⇧Q now also reports `ticksLateMs` and `audioDevice`, to tell a
      late scheduler from an audio buffer running dry.)
- [ ] Full screen (F) and leaving it; keyboard: Space, Tab, digits, H.
- [ ] Report: ⇧Q, plus anything that sounded or looked wrong.

### 1b. A synth over Web MIDI (the plugin's first test, no C++)

What Twirl sends today (`sendMidi` in `index.html`): **pluck → channel 1,
bell → 2, blip → 3, drums and shaker → 10** (General MIDI: kick 36, snare 38,
hat 42, shaker 70). Pitched notes: the note as heard (bell and blip an octave
up); fixed lengths (drum 80 ms, pluck and blip 220, bell 600); velocity from
loudness. No CCs, no pitch bend yet.

Setup, one of:
- **FluidSynth** with a General MIDI soundfont (plays all four channels at
  once, drums on 10): `fluidsynth -a pipewire -m alsa_seq /usr/share/sounds/sf2/FluidR3_GM.sf2`
  (or `-a jack`, or `-a pulseaudio`; the soundfont path varies by distro).
- **Vane** as LV2 in `jalv`, as in [docs/JAM.md](../../docs/JAM.md) (one
  channel's worth of sound, but it's the suite's own synth).
- **Surge XT** standalone, or anything in Carla, listening on its MIDI input.

Then (as found on Alex's Linux machine, 2026-10-25: Brave lists *Midi
Through Port-0* and four *VirMIDI* ports; synths running as their own apps,
such as Surge XT or Bitwig, don't appear as outputs, so Twirl goes through
**Midi Through** and the synth listens to it):
- [x] Brave (or Chromium) lists MIDI outputs: ⇧Q's `midi.outputs`.
- [ ] In Twirl: Everything → Sound and room → **Out: MIDI · Midi Through
      Port-0** (or **sound + MIDI**, to hear both). ⇧Q's `midi.out` should
      no longer say `sound`, and `midi.sent` climbs as notes play.
- [ ] Check it leaves the browser: `aseqdump -p "Midi Through"` in a terminal
      prints note-ons as Twirl plays.
- [ ] The synth listens to Midi Through: **Surge XT** standalone, its menu →
      Audio/MIDI settings → tick *Midi Through Port-0*; **Bitwig**, Settings →
      Controllers → add a generic MIDI keyboard on *Midi Through Port-0*, then
      arm an instrument track (input: all channels). Or wire it by hand:
      `aconnect -l`, then `aconnect "Midi Through":0 <synth>:0`.
- [ ] (VirMIDI ports carry MIDI between a raw-MIDI app and the sequencer; for
      browser → synth, Midi Through is the simpler road.)
- [x] It works (Alex, 2026-10-25, through Midi Through).
- [ ] **One instrument per voice, in Carla**:
      [`tools/twirl-carla.py`](tools/twirl-carla.py) builds a Carla project
      with a Surge XT for pluck, bell and blip (channels 1–3), each behind a
      MIDI channel filter, and the General MIDI soundfont for drums on 10
      (`sudo apt install fluid-soundfont-gm`; or `--drums surge`). Run
      `python3 apps/twirl/tools/twirl-carla.py` (through `pw-jack` with
      PipeWire), open `~/twirl-surge.carxp` in Carla, choose a patch in each
      Surge XT, save. Then connect Midi Through to Carla's MIDI input.
      (Built and checked against Carla 2.5.8 on a JACK server: the filters
      pass only their channel, the wiring holds, channel 10 plays a kit.
      Surge XT itself couldn't be installed for the check, so its loading is
      the part to confirm on your machine.)
- [x] Surge XT loads (VST3, `/usr/lib/vst3`), the GM kit plays (Alex,
      2026-10-25), but Carla opened the project as *multiple clients* (its
      default on JACK), so the script's single-client connections had to be
      made by hand. Fixed: the script now builds multi-client projects and
      saves the connections in the system graph, Midi Through
      (`Midi-Bridge:…` on PipeWire, `a2j:…` with a2jmidid) and the sound card
      included; `--mode patchbay` keeps the old way.
- [x] The multi-client version failed on Alex's machine (2 of 16
      connections: Carla's connect-by-id on a busy PipeWire graph). Now the
      script reads the port names from JACK and writes the connections, by
      name, into the project; Carla restores them when it opens it (checked:
      reloaded in Carla, every connection live).
- [x] Timing under load on Linux (Brave, 14 loops, 37 notes/s, MIDI out):
      ticks at most 19 ms late (nothing past 50), audio buffer 10.7 ms with
      56 ms output latency. The scheduler keeps up; any hiccup is the audio
      device's side.
- [ ] Each voice on its channel: draw right (pluck), up (bell), left (blip),
      down (drums), scribble (shaker). ⇧Q shows `midi.last` (channel, note,
      velocity) and `midi.sent`.
- [ ] Timing: with sound + MIDI, do the two line up? Any drift over a few
      minutes? A busy sheet: any notes late or missing on the synth only?
- [ ] Lock on and off, Walk on (chords move), a Spinner, a tadpole sea.
- [ ] Note what's missing to play it as an instrument (lengths? channels per
      loop? CCs?): that's the input for the plugin workshop (W6).

**Claude, after the reports**: fix what's wrong in the MIDI path; if timing
is uneven under load, it's an argument for phase 4's clock first.

### 1c. A graphics tablet

What Twirl uses today: with `pointerType === "pen"`, **pressure sets each
note's loudness** (and the dot's size); without a pen, drawing speed does.
Tilt and the barrel buttons aren't used. The line itself doesn't thicken yet
("Pressure you can see" is Later).

- [ ] Draw with the pen: ⇧Q's `pen` says `type: "pen"` and a `maxPressure`
      above 0. If it says `mouse`, the browser isn't seeing a pen: try the
      other session (X11 vs Wayland) and note which works.
- [ ] Light vs firm strokes: are the dots smaller and the notes softer? Is
      the range comfortable, or does it need a curve?
- [ ] Hovering doesn't draw; a press does. The side buttons and eraser: does
      anything odd happen (a right-click menu, a stroke)?
- [ ] `coalesced` vs `events` in ⇧Q: a high ratio means the tablet sends more
      points than frames, which is fine (Twirl already reads them).
- [ ] Report: ⇧Q, the tablet's make, X11 or Wayland, and how it felt.

**Claude, after the reports**: a pressure curve if it's needed; fixes for
buttons or hover; then "Pressure you can see" can move up if it's wanted.

### 1d. A Linux plugin and standalone, without JUCE

Alex, after 1b worked: "Which all makes me want 1d: Linux plugin and
standalone. Now, is there any JUCE-free path for this?" Yes. What was found
(sources read 2026-10-25, see below):

- **DPF**, the DISTRHO Plugin Framework (ISC license, by falkTX, who also
  makes Carla), builds **LV2, CLAP, VST3 and VST2** from one source, plus a
  **JACK standalone**. It now has a **web view of its own**
  (`DISTRHO_UI_USE_WEB_VIEW`; example `examples/WebMeters`; on Linux a child
  process hosting the browser engine, over X11). The page gets
  `sendNote(channel, note, velocity)`, `setParameterValue`, `setState`
  injected, so Twirl's `sendMidi` has somewhere to go.
- **clap-wrapper** (MIT) turns one CLAP into VST3, AUv2, **AUv3 (macOS and
  iOS)**, AAX and a simple standalone. The AUv3 part is new since the suite's
  [JUCE assessment](../../docs/JUCE_INDEPENDENCE.md) (July), which had iPadOS
  as the part JUCE couldn't be dropped from.
- **choc** (ISC) has a single-header WebView (WKWebView, WebView2,
  WebKitGTK), the suite's July pick for a CLAP shell.

**The route, in stages, each usable on its own:**

| Stage | What | JUCE | Who/where |
|---|---|---|---|
| A | Browser + Midi Through + Carla/Surge XT (working now) | none | Alex's Linux machine |
| B | **An installable app**: Twirl as a PWA (a manifest and a service worker): Brave or Chromium's "Install", its own window, works offline, Web MIDI as now | none | Claude, in this repo; ~a day |
| C | **A DPF plugin**, MIDI out: LV2 (Carla, Ardour), CLAP (Bitwig, Reaper), VST3; and the JACK standalone, wired in the graph like any synth. The UI is Twirl's `index.html` in DPF's web view | none (ISC) | Claude: a new repo (e.g. `Enkerli/twirl-dpf`); Alex: tests in Bitwig and Carla |
| D | macOS and iPad: either DPF (CLAP, VST3, AUv2) or a CLAP through clap-wrapper (AUv3 too), the suite-wide choice in `docs/JUCE_INDEPENDENCE.md` | none | later, with the Mac back |

**Stage C, how it works:**
- Twirl keeps its own clock (it already does) and, in the plugin, stops
  making sound itself (the host's instruments do); `sendMidi` detects the
  plugin and sends notes over the bridge instead of Web MIDI (WebKitGTK has
  no Web MIDI).
- Notes cross **in batches with their time ahead** ("in 74 ms": ⇧Q's
  `midi.last.inMs` already measures it), through `setState`; the plugin puts
  them in a lock-free queue and `process()` writes each at its sample offset
  (`writeMidiEvent`). That is the suite's `LiveNoteScheduler` pattern from the
  Workspace plugin. `sendNote` alone would work too, but lands whenever the UI
  thread gets there: fine for a first light, not for timing.
- Note-offs with the same lengths as today; channels as today (1, 2, 3, 10),
  later per loop.
- State: the sheet saved with the host's project (`setState` of a share
  code), so a song reopens with its Twirl.

**Checked here, 2026-10-25** (Alex: "That framework hasn't been updated in a
year and the WebUI in two years"): that's DPF's *release* branch (`main`,
last merged 2025-10-23). Work happens on **`develop`**: 94 commits this year,
the last one today; the web view last changed in August 2026 (GTK3
background, Qt WebEngine drag, devtools). Built from `develop` in a Linux
container: DPF with `USE_WEB_VIEW=true`, then `examples/WebMeters` gives a
JACK standalone, LV2, CLAP, VST2 and VST3. The standalone opened its web view
(WebKitGTK) and ran the page; with Twirl's `index.html` in its place,
**Twirl rendered and ran inside DPF's web view** (in the example's small
window). First light for stage C's UI.

To build it on Alex's machine:

```sh
sudo apt install build-essential pkg-config libgl1-mesa-dev libx11-dev libxext-dev \
  libxrandr-dev libxcursor-dev libdbus-1-dev libjack-jackd2-dev libgtk-3-dev libwebkit2gtk-4.1-dev
git clone --branch develop --recursive https://github.com/DISTRHO/DPF
cd DPF
make -C dgl USE_WEB_VIEW=true          # without it, the example fails to link
make -C examples/WebMeters
pw-jack ./bin/d_webmeters              # the standalone (pw-jack with PipeWire)
cp -r bin/d_webmeters.lv2 ~/.lv2/ ; mkdir -p ~/.clap && cp -r bin/d_webmeters.clap ~/.clap/
```

**Stage C, checklist:**
- [x] Build DPF's `WebMeters` example (here, in a container), run the
      standalone: the web view appears and runs a page; Twirl runs in it.
- [x] The same on Alex's machine, then the LV2 in Carla and the CLAP in
      Bitwig (2026-10-25, with the patch below): both load properly, no
      delay on a cold start. Still to watch with Twirl itself: keyboard
      focus inside a host window, smoothness.
      First try (2026-10-25): the LV2 didn't appear in Carla, and Bitwig
      showed "ERR_FILE_NOT_FOUND" in the CLAP's window. Two things in DPF,
      found and patched here:
      1. `make gen` writes the LV2's `.ttl` files (without them hosts don't
         see the plugin), and the example's `all:` rule never copies
         `index.html` into the LV2 bundle (every other format gets it).
      2. On Linux, DPF installs a CLAP as a folder `X.clap/` holding the file
         `X.clap` and `resources/`; Bitwig passes the *file's* path, so DPF
         looked for `X.clap/X.clap/resources/`. Patched to use the file's
         folder when given a file.
      With the patch, the LV2 opens in Carla here and its web view runs the
      page (the first attempt timed out: the web view gets 5 seconds to
      start, which a cold container can miss). The CLAP fix is untested in
      Bitwig until Alex tries it (it worked: see above). On Alex's machine DPF uses Qt WebEngine
      (Chromium; it tries Qt 5, then 6, then WebKitGTK); here, WebKitGTK.
      Both DPF fixes are worth reporting upstream.
- [x] A first plugin (2026-10-25): **[Enkerli/twirl-dpf](https://github.com/Enkerli/twirl-dpf)**,
      LV2, CLAP, VST3 and a JACK standalone, a MIDI generator (no audio);
      `make` copies this `index.html` in (from a checkout beside it, else
      from `main`) and applies the CLAP fix as a patch to DPF `develop`.
      In Twirl, `IN_HOST` (DPF's injected `setState` and `sendNote` are
      there) sends notes to the host instead of Web MIDI, and the page makes
      no sound (the Drone included); the browser is unchanged (tests).
- [x] The timed path: each scheduler tick's notes go as one
      `setState("notes", "t,status,note,velocity;…")`, `t` the wall-clock
      time to sound (ms since the epoch); the plugin queues them lock-free
      and writes each at its sample offset. Note-offs at Twirl's lengths;
      "panic" on Start over and when the page goes. **Measured** (Claude,
      Alex's machine: PipeWire, 48 kHz, 1024 frames), driving the page over
      Qt WebEngine's DevTools port and recording with `jack_midi_dump`: the
      standalone and the LV2 (in `jalv.gtk3`) put every event within
      **0.1 ms** of Twirl's own timing, sent 56–140 ms ahead. (By ear
      against Twirl's sound: Alex.)
- [ ] By ear, Alex: `pw-jack ~/Coding/twirl-dpf/bin/twirl`, connect
      *Twirl:midi-out* to the Carla rig (`~/twirl-surge.carxp`) instead of
      Midi Through: four voices on their channels?
- [ ] Hosts, Alex: the LV2 in Carla (and Ardour), the CLAP in Bitwig (and
      Reaper), the VST3 in Bitwig or Reaper. (Built and installed in
      `~/.lv2`, `~/.clap`, `~/.vst3`. Carla 2.5.8's `carla-single` can't
      take a CLAP, and its VST3 UI fails with an X error for DPF's own
      WebMeters too, so neither was checked here.) Things to watch: the
      window's size, keyboard focus, MIDI routing (in Bitwig it's a note
      effect: put it before an instrument).
- [x] **Plays with its window closed** (Alex, in Bitwig: "it only plays when
      the UI is open and reinitializes when the UI is closed!"). The plugin
      now owns the page (twirl-dpf `TwirlPage.hpp`): it starts DPF's web view
      in a hidden window when activated; the UI is an empty window the page
      moves into and back out of. Checked in Carla's engine: playing before
      the window opens, while it's open, after it closes; the same page on
      reopening. (On the way: with GL, an off-screen Qt web view hangs in
      its buffer swap; it now draws without GL, at 60 fps.)
- [x] Bitwig, first try (Alex, 2026-10-25: "quite fun"), and what came of it:
      - closing the window crashed DPF's web-view process (SIGSEGV): fixed
        (DPF patch 0002), checked in the standalone and the LV2;
      - "stops playing as soon as another UI is focused": Bitwig *hides* the
        window, and DPF's CLAP stopped the timer that collects the page's
        messages. Fixed (patch 0004), to confirm in Bitwig;
      - "doesn't respond to keyboard controls, even when focused": a click
        left X's keyboard focus on the host's window. Fixed (patch 0003: a
        press in the page gives the web view the focus), checked in the
        standalone, to confirm in Bitwig;
      - drums needed a remapper (Bitwig's drum machine isn't General MIDI),
        and the voices an Instrument Layer with channel filters: "Could be
        nice to integrate everything in a single plugin." Twirl's own sound
        out of the plugin (next item) is that; a drum map is still to do.
- [x] **Twirl's own sound out of the plugin** (Alex: "no reason the plugin
      should be MIDI-only"; route B now, C after). The page's Web Audio,
      exactly as in a browser, captured by an AudioWorklet and sent in
      512-frame chunks (`setState("audio", …)`); the plugin buffers 100 ms
      and corrects drift. Out picker in the plugin: sound (default), MIDI,
      sound + MIDI. Measured in the standalone: no gaps or clicks; stalls of
      300 ms recover without clicks. The sound lags the MIDI by ~100 ms.
- [ ] **C**: the voices in C++ inside the plugin, played by the timed notes,
      sample-accurate and in step with the MIDI; a pack at a time, paper first.
- [x] **Follow host transport**, a toggle as in the suite's other plugins
      (Serpe's), saved with the project: the host's tempo, its transport (the
      loops and the Drone hold while it's stopped; strokes still sound), its
      beat. Allows for the audio lag; in sound + MIDI, the MIDI waits as
      long. (The first measure, "within 0.3–2 ms", read single, noisy
      samples; see the fix below for what holds.) **In Bitwig** (Alex,
      2026-10-26): "it does work across saves and it does catch up with the
      host"; ⇧Q from inside it: 60 fps, 13 loops, 42 notes/s, ticks at most
      24 ms late, no errors. ⇧Q now also reports Follow host transport, the
      host's tempo and transport, and the audio's delay.
- [x] Two things from Bitwig (Alex, 2026-10-26), fixed:
      - "while the host is paused, the scene's playheads keep moving… from
        the host's pace to their internal tempo": stopping held the loops
        but not Twirl's clock; and a host giving no transport (or no longer
        calling the plugin) let Twirl run free. Now Twirl's clock stands
        still while the host is stopped (except while you draw, since a
        stroke is timed by it), and no transport, or none for 300 ms,
        counts as stopped. Checked in Carla: the beat stays put for 3 s.
      - "it sounds like playheads have their own clocks and aren't
        quantized anymore": following corrected each report's noisy
        error (±10 ms), moving every note by 2.6 ms on average, 20 times
        a second (up to 8 ms; 15 ms over 6 s). Now averaged over a second
        and corrected only past 2 ms: 0.03–0.08 ms on average, 1.6 ms at
        most, and on the host's beat within 2 ms on average (measured
        against Carla's transport, 120 BPM).
      ⇧Q now shows the jumps and the recent offsets.
- [x] Out defaults to **sound + MIDI** in the plugin (Alex: "it defaults to
      sound only… I need to go to Everything").
- [ ] A drum map: General MIDI, or Bitwig's drum machine (pads from C1).
- [x] Save and restore the sheet with the host's project (2026-10-25): the
      page's state ("page": the sheet, Out, Follow host transport) is the
      plugin's one state. Checked in Carla: saved, loaded into a fresh
      instance, back.

**Questions for W6** (some now answered): is stage B (an installable app)
worth doing first, as the cheap standalone? Which host matters most:
Bitwig (CLAP) or Carla/Ardour (LV2)? Should the plugin also make sound
(Twirl's own Web Audio as an instrument), or stay a MIDI generator?

Sources: [DPF](https://github.com/DISTRHO/DPF) (README; in its repo, distrho/DistrhoInfo.hpp for
`DISTRHO_UI_WEB_VIEW` and distrho/src/DistrhoUI.cpp for the injected
`sendNote`), [clap-wrapper](https://github.com/free-audio/clap-wrapper)
(README: VST3, AUv2, AUv3, AAX, standalone),
[choc](https://github.com/Tracktion/choc) (choc/gui/choc_WebView.h in its repo).

### 1d-C. Route C: Twirl's sound made in the plugin (with synth mode and parameters)

*Design, 2026-10-26, for Alex to read before any code. Alex: "Then we can
work on Route C. Doesn't need to be urgent to be worthwhile."*

**Why.** Today the page makes the sound (Web Audio) and the plugin receives
it as a stream: exact, but it arrives ~100–120 ms late (a jitter buffer),
costs a browser's audio rendering, and only exists while a page runs. Made
in the plugin, the sound is sample-accurate, in step with the MIDI and the
host with no allowance for a lag, and can be played by MIDI coming in
(synth mode), so one Twirl can play another, or a sequencer can play Twirl.

**What stays where.**
- **The page stays the brain**: drawing, loops, the scheduler, Life, Meets,
  Walk, Lock, Vary… It already sends every note, timed, for MIDI; it will
  send the same notes with what the sound needs: voice, pack, exact pitch
  (fractional: microtonal tunings keep their pitches, which MIDI rounds),
  velocity, pan, height (drum kind, shaker size), Vary's nuance, the delay
  send. Same channel, same wall-clock timing, written at sample offsets.
- **The plugin makes the sound**: the voices, the Drone, the delay, the
  room (Warmth), the compressor, the master volume. The page sends the
  continuous things as state changes (Drone on, its notes as Walk moves,
  level, voicing, space; Warmth; volume; tempo for the delay).

**The engine (C++, in twirl-dpf).** What Twirl's recipes use, and no more:
oscillators (sine, triangle, saw, square; band-limited), Web Audio's biquad
filters (the same formulas, so the same curves), its envelope ramps
(setValueAtTime, exponentialRamp, setTarget), noise, frequency modulation,
its equal-power panner, the feedback delay with its darkening lowpass, a
compressor close to Web Audio's, and the room (pink-noise and crackle loops,
wow and flutter). The 34 recipes (7 packs; Paper's 5 voices are the base)
become a table where they are partials and envelopes, code where they're
more (the bell's FM, the chip arpeggio, the shaker's grains). A voice pool,
voices freed when silent.

**Fidelity.** A render test: each voice, at a few pitches and velocities,
rendered by the page (OfflineAudioContext in headless Chromium) and by the
engine (offline), compared on envelope and spectrum, with a tolerance
(randomness aside: noise, Vary). Then Alex's ears: A/B in the plugin (the
Out picker keeps "sound (from the page)" until the engine matches).

**Synth mode.** MIDI coming in plays the engine: channel 1 pluck, 2 bell,
3 blip, 10 drums and shaker (notes as Twirl sends them: 36 kick, 38 snare,
42 hat, 70 shaker; others by height), the pack from a parameter, centre
pan. Works with the window closed and needs no page at all. One Twirl's MIDI
out into another's MIDI in: the second plays the first's notes in its own
pack. (Note-offs: Twirl's voices are one-shots; they ring out.)

**Parameters (automatable; Bitwig shows them).** First set: Volume, Tempo
(when not following), Follow host transport, Swing, Warmth, Air, Drone (on,
level, voicing, space), Lock, Walk (on, way, pace), Pack, Scale, Root, Vary,
Evolve, Morph; then more. Choices as lists (Bitwig shows names), switches
as on/off.
- Host → page: the plugin passes each change to the page, which applies it
  as if its own control moved.
- Page → host: when you move a control in Twirl, the plugin tells the host
  through DPF's UI (setParameterValue, with begin/end of the gesture), the
  way that works in CLAP, VST3 and LV2. (DPF's other route, from the plugin
  itself, is an empty stub in its CLAP code.) The page can only be touched
  while the window is open, which is when that route exists.
- With the project: the parameters are saved by the host; the page's saved
  state keeps the rest (the sheet). On loading, the parameters win.

**Order** (each step usable on its own; nothing removed until replaced):
1. Engine and Paper's five voices, the delay, volume; Out gets "sound (in
   the plugin)"; the render test.
2. The other six packs.
3. The Drone, the room, the compressor. Then "sound (in the plugin)"
   becomes the default; the page's stream stays as an option or goes
   (Alex's call).
4. Synth mode.
5. Parameters, the first set, then more.

**Size.** The sound is ~300 lines of recipes plus the Drone (~80) and the
room (~60) in the page; the engine perhaps 1,500–2,500 lines of C++. Steps 1
and 3 are the largest.

**Answered** (Alex, 2026-10-26):
- [x] Fidelity: "Doesn't even need to sound that close to the current one,
      as long as it sounds ok." The render test guards against breakage
      (silence, clipping, runaway), not likeness.
- [x] The page's stream: "The option should leave the plugin (kept in the
      web versions)." It goes at step 3.
- [x] Synth mode: "We will add features to synth mode later on, based on
      exploration and experimentation."
- [x] Parameters: "That set is fine for now."

### 1e. Twirl's voices as Surge XT patches

Alex: "As Surge XT is Free Software, it should be possible to build
Twirl-like patches, at least for non-drum voices (and, even then, drums are
likely to work)." Twirl's voices are small recipes (in `index.html`, section
3): the pluck a few decaying partials, the bell FM-like with an inharmonic
ratio near 3.5, the blip a short bright square, the drums a pitched sine
kick, a noise snare and a hat.

Alex: "I'm convinced there's a way to generate these patches. Each Twirl
sound is just a few lines of code and I'm sure Surge makes the same
parameters available in its patch format." Confirmed from Surge's source
(src/common/SurgePatch.cpp in its repo) and its factory patches: a `.fxp` is a 60-byte
FXP header (`CcnK`, `FPCh`, id `cjs3`, the chunk's size), then Surge's own
header (`sub3`, the XML's length, six wavetable sizes, zero without
wavetables), then plain XML: one element per parameter (558 in *Init FM2*),
e.g. `<a_osc1_type type="0" value="6" />`. The factory templates (*Init
Sine*, *Init FM2*, *Init Square*, *Init Karplus-Strong*…, CC0) are starting
points.

- [ ] A generator (Claude): start from a template, set the parameters that
      make each Twirl voice (oscillator type and pitch, FM ratio and depth,
      amp envelope, filter), write the `.fxp` with the right sizes. The
      mapping, voice by voice, from `index.html` section 3 (the pluck's
      partials and decays, the bell's ratio near 3.5, the blip's square and
      length, the kick's pitch drop, the snare's noise band, the hat).
- [ ] Alex loads each in Surge XT and A/Bs against Twirl's own sound (sound
      + MIDI on); corrections go back into the mapping, not by hand into the
      patch.
- [ ] Kept in this repo (`apps/twirl/surge/`), CC0 like Twirl.
- [ ] The Carla script loads them when present (a patch per instance).
- [ ] Later, the same for Twirl's other packs (mallets, felt, steel…).

---

## Phase 2 — Languages: French, as one package

Alex: "Mechanically building the table, identifying glossary entries, making
something reviewable in French, building the French interface and
documentation. That's a package."

Size (counted 2026-10-25): about **500 strings** in `index.html` (≈ 110
messages, many with numbers or names in them; ≈ 80 tooltips; ≈ 50 accessible
labels; ≈ 85 menu options; buttons and the key list), and the **guide**,
about 2,600 words in `docs/site.md`.

### 2a. The table (Claude, mechanical)

- [ ] A script (to write: tools/twirl-strings.mjs) that lists every user-facing
      string in `index.html` (text, `title`, `aria-label`, `placeholder`,
      options, `toast()` messages) with its place in the file.
- [ ] Strings move into one table (to create: apps/twirl/i18n/en.js, an object keyed by
      id, inlined into the page, since Twirl has no build step; or kept
      inside `index.html` as a `<script type="application/json">`).
      Decide which with Alex: one file stays the rule (ROADMAP principle).
- [ ] A `t(id, values)` helper; messages with numbers use `Intl.PluralRules`
      and `Intl.NumberFormat` ("1 beat" / "2 beats", "Loop 3").
- [ ] A test that fails if visible English appears outside the table (so new
      features keep using it), and one that every key exists in every
      language.
- [ ] Nothing changes for players in English.

### 2b. Glossary entries (Claude drafts, Alex decides)

- [ ] The terms Twirl names (loop, pass, sheet, stroke, playhead, voice,
      pack, Meets and its answers, Life and its kinds, Influence, Walk and its
      ways and parts, Arc, Drone, Warmth, Spacing, Lock, Morph, Surprise,
      Vary, Evolve, template, toy, scene, take…) added to
      [docs/GLOSSARY.md](../../docs/GLOSSARY.md) under a Twirl heading, each
      with a plain definition and a French term to review.
- [ ] Words other apps already use (scale, root, grid, division, swing,
      MIDI…) reuse their existing entries.

### 2c. French, reviewable (Claude drafts, Alex reviews)

- [ ] `fr` filled from the table and the glossary.
- [ ] A review page (an artifact, like the triage form): each string with its
      English, its French, where it appears, a field for Alex's correction and
      a done tick; corrections saved, then read back into the table.
- [ ] Questions to settle first (see below).

### 2d. The French interface (Claude)

- [ ] Language from the browser (`navigator.language`), overridable by
      `?lang=fr` (works with templates: `?template=tadpoles&lang=fr`) and a
      choice in Everything → View; remembered in this browser.
- [ ] `<html lang>` follows; screen readers get French.
- [ ] Layout checks at phone width: French runs ~15–25 % longer (the bar, the
      drawer's two-column buttons, the settings rows).
- [ ] Tests: first contact in French; axe in French; every key present.

### 2e. The French documentation (Claude drafts, Alex reviews)

- [ ] The site builder (`docs/build-site.mjs`) writes `<html lang="en">` for
      every page: it learns a page language (a `lang=fr` on `<!-- page -->`).
- [ ] A `twirl-guide-fr` page (the guide in French), linked both ways; the
      drawer's guide link follows the language.
- [ ] README, roadmap and plan stay English (they're for contributors).

**Decided** (Alex, 2026-10-25):
- **Vous.**
- **Normative Québec French**: Radio-Canada and Government of Canada usage;
  **Termium Plus** (and the OQLF's *Grand dictionnaire terminologique*) for
  terms; **inclusive writing through épicène terms** first, after
  *Inclusionnaire* (*les personnes qui jouent*, *l'équipe*, *chaque
  personne*), rather than contracted doublets (*joueur·euse*).
- **Every name translated** except *Twirl* (so *bourdon*, not *Drone*; a
  French name for Walk, Lock, Morph, Arc…).
- **Review by Alex**; perhaps a public test with feedback later (the review
  page could take others' suggestions then).

Still to settle in the glossary review (2b), with sources cited for each:
- Key terms: *loop* (*boucle*), *pass* (*tour*, *passage*?), *sheet*
  (*feuille*), *playhead* (*tête de lecture*), *stroke* (*trait*, *tracé*?),
  *pack* (*jeu de sons*?), *take* (*prise*), *toy* (*jouet*), *scene*
  (*scène*), *template* (*modèle*), *drawer* (*tiroir*).
- Names for the features: Walk, Lock, Morph, Arc, Surprise, Vary, Evolve,
  Warmth (*chaleur*), Spacing, Smooth, Beats.
- Meets' answers, kept playful: *sound, bump, trade, breed, infect, merge*.
- Keyboard names in the key list (⇧, ⌘, Tab, Esc…): as Québec keyboards and
  Apple's French documentation name them.

---

## Phase 3 — More templates

How a template is made: an entry in `TEMPLATES` (`index.html`, section 12
area, next to `startingSheet`): settings, a mode, and a `make(W, H)` that
drops toys or loops. Opened by `?template=<name>`; your own sheet is kept
aside; reloading keeps what you've done since. One test each.

- [x] `tadpoles`: two schools and a current, Drone on.
- [ ] `ambient`: chimes, a slow call, Drone on (drifting or rotating),
      Warmth up a little, Walk on (fits), Spacing by register.
- [ ] `session` (Alex's usual): a four-on-the-floor kick, a bell line, two
      crossing lines, Lock on.
- [ ] `grid`: Lock on, Beats shown, a beat toy, at Everything.
- [ ] `micro`: 7-EDO or slendro, Spacing by register, chimes and a ring.
- [ ] A list of templates in the guide, with their links.
- [ ] Later (Workshop): playtest conditions as templates; "copy a template
      link" from any sheet.

---

## Phase 4 — Health

### 4a. An off-thread clock (Claude)

Today the scheduler ticks on the main thread (`setInterval`, 25 ms) and
looks ahead 120–400 ms; a long frame delays the tick.

- [x] A Worker that posts a tick every 25 ms; the scheduler runs on each
      message. Shipped as the default on 2026-10-25, earlier than planned:
      on Linux, "switching from Brave to Carla causes hiccups" with no xruns
      in Carla, i.e. the page's own timer was throttled in the background.
      `?clock=main` keeps the old timer to compare; it takes over by itself
      if the Worker can't start. ⇧Q reports `clock` and
      `ticksLateMs.maxInBackground`.
- [ ] Alex: the Brave → Carla switch again, then ⇧Q back in Brave.
- [ ] Measure both on a busy sheet (CPU slowed in Chromium, and on Linux):
      ticks late, notes dropped, lookahead.
- [ ] If the Worker is better, make it the default; keep the old one as the
      fallback where Workers aren't available.
- [ ] An AudioWorklet clock only if the Worker isn't enough.

### 4b. Measured on the iPad (Alex, when it's back)

- [ ] A busy sheet for two minutes, Q then ⇧Q; the same with recording on.
- [ ] Safari's 60 fps cap is expected; slowest frame and ticks late are the
      numbers to watch.

---

## Phase 5 — Design pass, aligned with the suite

- [ ] Hand [DESIGN_BRIEF.md](DESIGN_BRIEF.md) and `design/` to the design
      agent (a Claude Design canvas). Ask for: a loop's settings, the
      Everything drawer, a symbol set, palettes.
- [ ] Update the brief first if French has landed (longer labels; the symbol
      set matters more).
- [ ] Alex picks; Claude implements in `index.html`, keeping every id.
- [ ] Align with `packages/ui` tokens and components for controls and
      dialogs; the sheet keeps its paper and hand.
- [ ] Refresh the guide's screenshot and `design/`.

## Phase 6 — Playtests, round 1

[PLAYTESTING.md](PLAYTESTING.md) has the protocol.

- [ ] Participant sheet in English and French (what Twirl is, consent, how to
      reach us).
- [ ] Conditions as links (templates and `?start=macro`), so nothing needs
      setting up during a session.
- [ ] 5–8 sessions across the groups; observation sheets; ⇧Q at the end of
      each.
- [ ] Affinity map; findings written back to the roadmap and A11Y.md.

---

## The workshops (W)

Six conversations, one at a time, whenever Alex has the time (and isn't
eating). Claude brings the context and takes the notes; decisions go into
the roadmap and, when they turn into work, into this plan.

### W1. Time

Ideas: distance and time made visible (5) · a loop's own tempo (5) · groove
templates (5) · tempo curves (5) · DrawnQurve-style quantize (5) · its own
grid (4) · polyrhythm per loop (4).

1. When you look at a loop, what do you want to *see* about its time: beats
   along it, the bar as the sheet's width, its length in beats, where it is
   in its pass?
2. Is a loop's own tempo a *ratio* to the sheet (3:4, 5:4), a free tempo, or
   drawn speed kept as is? How does it come back into step?
3. Grooves: per loop, or per sheet? Taken from where: presets, a drawn
   accent shape, a recording?
4. Tempo curves: the whole sheet (with Arc), or one loop at a time?
5. DrawnQurve's quantize: which parts carry over (time and pitch apart,
   strength, interval width), and which of Twirl's existing controls (Snap,
   Lock, division, Spacing) would they replace?
6. Polyrhythm: a division per loop next to Snap, or a property of a toy?

### W2. Harmony

Ideas: a progression loops adapt to (5) · chords as roles (5) · voicings
(5) · progressions from the suite (5).

1. Where does a progression come from: Walk's ways extended, typed (I–vi–IV–V),
   picked from presets, or another app (Progression Studio, MIDIcurator)?
2. Roles: which matter most to you (bass, chord tones, pedal, melody,
   counter-line)? Set per loop, or by height (low = bass)?
3. Voicings: who decides, the loop, the sheet, or the height on the sheet?
   Is voice leading (fits) enough as the default?
4. How should a chord *show*: the readout at the top, a symbol, colour on the
   lines, the Drone?
5. Should Walk and Arc become two presets of one progression mechanism?
6. What must the naïve player never meet (a chord symbol, a wrong note)?

### W3. Places

Ideas: zones (5) · terrain (5) · traces (5).

1. Zones: a drum zone by direction, a melodic strip; what's the first one you
   want? Drawn by you, or from a palette?
2. Does a loop passing through a zone *play* it (performer and instrument), or
   *change* (louder, filtered, another voice)?
3. Terrain: painted, generated, from traces only, or a photo? Visible always,
   or only when asked?
4. Which sound qualities does the ground change (inharmonicity, length,
   brightness, grain), and which never (pitch)?
5. Traces: which loops leave them (a Life, a Meets answer, a toy), how fast do
   they fade, and do they keep the loop's colour?
6. How do places travel in codes and takes?

### W4. Change over time

Ideas: ecology controls (5) · shapeshifting (5) · scale- and grid-aware
mutation (5) · seeded mutation (5) · seasons (4) · lifetimes in cycles or
beats (4) · mutation strength and targets (4) · tides (3).

1. Ecology: what should a player be able to set: how crowded a sheet may get,
   how often contacts happen, who may breed with whom? As one "climate"
   control, or several?
2. Shapeshifting: toward what: another loop, a toy shape, a smoothed version
   of itself? Over how long?
3. Seasons: a slow cycle of what: density, loudness, brightness, tempo? Tied
   to Arc?
4. Tides: a loop that fades and comes back: same loop, or a slightly mutated
   one (a generation)?
5. Mutation: subtle / playful / wild as one control, or targets (contour,
   rhythm, harmony, voice, motion) to tick?
6. Seeds: do you want to replay a family exactly, or is surprise the point?

### W5. The suite

Ideas: a Suite glossary (5) · readouts (5) · typed input (5) · round trips
(5) · one table of strings (4) · a small symbol set (3) · the SuiteBus (3).

1. Readouts: where (a loop's settings, a hover, the chips)? UPI, PCS, both?
2. Typed input: a field in the Toybox, or a toy that asks? What happens to
   pitch (where you drop it, a scale degree)?
3. Round trips: which first: a rhythm to Serpe, a grid to PickPCS or
   PitchFold, a progression in from Progression Studio?
4. The SuiteBus: Twirl as a Workspace module, or its own tab on the bus?
   Who's the clock?
5. Symbols: drawn in the suite's line style by the design agent, or Twirl's
   own hand?

### W6. Out of the page

Ideas: the plugin shell (5) · generative accompaniment (5) · CCs set loops
(5) · multi-out in the plugin (4) · performance animation (4) · MIDI learn
(3) · a voice pool (3) · pitch geometries (3).

1. After phase 1b: is the browser plus a synth enough on Linux, or is the
   plugin next? Which host first (Reaper, Bitwig, Ardour, Carla)?
2. MIDI out: a channel per voice (today), per loop, or per group? Note
   lengths: fixed, or held until the next note?
3. CCs set loops depends on *notes pick loops* (Later): move that up, or
   control the selected loop only?
4. Generative accompaniment: GloriArp under Twirl (it accompanies the sheet),
   or Twirl's loops read through GloriArp's patterns?
5. Performance animation: what would you edit in a take: a move, a timing, a
   setting?
6. Pitch geometries: which first: circular (angle = pitch class), Tonnetz,
   a ratio lattice? As a Spacing option, or a new sheet?

---

## Later

Wanted, not now (see the roadmap's Decisions): more toys with their own
sounds, tools and palettes, sustained voices, master FX, channels per loop,
momentum, silent zones, and the rest. When a phase or workshop pulls one
forward, it moves into this file.
