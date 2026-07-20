# A Guide to the Suite

This is a set of small music tools that work together. They run in your
web browser, free, with nothing to install and no account to make. Some
also exist as plugins — versions that live inside music-making programs —
and as command-line tools, but the browser is the easiest way in, and
nothing here assumes you know music theory. If a musical word shows up,
it's explained right where it appears (and collected in the
[glossary](https://github.com/Enkerli/music-suite/blob/main/docs/GLOSSARY.md)).

Two things worth knowing before you start:

- **Your stuff stays yours, on your device.** These tools don't have
  accounts, don't upload anything, and save your work in your own
  browser. Anything you export is a file on your computer, in an open
  format.
- **There is no right order.** The doors below are starting points, not
  steps. Start wherever your curiosity points; every tool links to the
  others.

*One technical note, once: a few features send or receive **MIDI** — the
common language musical devices use to say "play this note now" (it
carries instructions, not sound). Browsers based on Chrome (Chrome, Edge,
Brave) can talk MIDI to your hardware; Safari and Firefox can't — in
those, everything still works except talking to external gear, and the
tools say so with a "No Web MIDI" label rather than failing silently.*

---

## Door 1 · "I want to hear something now"

Open **ProgGenie**: <https://enkerli.github.io/music-suite/apps/proggenie/>

Press **Play**. That's it — you're hearing a **chord progression**: a
sequence of chords (groups of notes played together), the harmonic
skeleton that most songs hang on. ProgGenie makes new ones by walking
through statistics gathered from thousands of jazz lead sheets — not by
copying any tune, but by learning which chord tends to follow which.

![ProgGenie: generator controls on top, the progression laid out as tappable chord cells below](assets/guide/proggenie.png)

Things to try, in any order:

- **New take** — a different progression from the same settings. The
  **Surprise** slider decides how adventurous the walk is.
- **Tap any chord** to open it: what's in it, which scale fits over it,
  and a pad-grid picture of it. The 👍/👎 tools teach the generator your
  taste — future takes lean toward what you liked.
- **Key** and **Bars** do what they say. "Harmonic rhythm" is how often
  the chord changes — every beat, every bar, and so on.
- **Save to library** keeps a progression in your browser;
  **Export MIDI file** writes it as a `.mid` file — a small standard
  file of playing instructions that any music program can open.

If you'd rather hear a **groove** — a bassline or a comping pattern with
rhythm to it — walk through Door 6 to the Workspace and add its
**GloriArp** module, or see MIDIcurator's groove panel (Door 4).

---

## Door 2 · "I like rhythm"

Open **Serpe**: <https://enkerli.github.io/music-suite/apps/serpe/>

Serpe is a rhythm laboratory. A rhythm here is a **pattern**: a circle of
steps, some of which sound (onsets) and some of which are silent. You can
type patterns in a compact notation — `E(3,8)` means "spread 3 hits as
evenly as possible across 8 steps," which happens to be a rhythm heard in
music all over the world.

![Serpe: a pattern typed in notation, shown as a step lane and a circle, with transforms and analysis alongside](assets/guide/serpe.png)

Things to try:

- Type `E(3,8)`, then `E(5,8)`, then `E(5,13)` into the input and press
  play. Tap steps on the lane or the circle to edit them directly.
- The **generators** (Euclidean, polygon, random, and friends) invent
  patterns; the **transforms** (rotate, reverse, mutate…) reshape the
  one you have.
- **Analysis** tells you *about* your pattern — how even it is, how
  syncopated (how much it plays against the expected beat).
- With a MIDI-capable browser, Serpe can drive real hardware or other
  apps from the MIDI section.

The same pattern language runs everywhere in the suite — the Workspace's
Pattern module, the command line (`msuite upi "E(3,8)"`), and the Serpe
plugin are all the same engine.

---

## Door 3 · "I have a MIDI keyboard (or pads)"

Plug it in and open one of these in Chrome/Edge/Brave:

- **ProgGenie** (Door 1) hears the chord you're holding, names it, and
  offers to add it to your progression — a nice way to build harmony by
  ear.
- **PitchFold**: <https://enkerli.github.io/music-suite/apps/pitchfold/>
  — choose a scale (a set of notes that sound good together), and
  PitchFold *folds* everything you play into it. Wrong notes stop being
  possible; mash the keyboard and it still comes out musical. Pick your
  keyboard under the MIDI chip (top right), pick a scale, play.

  ![PitchFold: a scale chosen on the note ring, snap direction and output range beside it](assets/guide/pitchfold.png)

- **Exquisite Fingerings**:
  <https://enkerli.github.io/music-suite/apps/exquisite/> — for grid
  controllers (Exquis, Launchpad and similar), where notes are laid out
  in a honeycomb or square. It shows where chords and scales fall under
  your fingers, with the same colors the hardware uses.

  ![Exquisite Fingerings: a hex grid with a scale lit up, key and scale selectors above](assets/guide/exquisite.png)

No controller? Everything above also works with the mouse — you just
lose the "play it in" part.

---

## Door 4 · "I have MIDI files / I want to collect material"

Open **MIDIcurator**: <https://enkerli.github.io/music-suite/apps/midicurator/>

MIDIcurator is a library for short musical ideas — **clips**. Drop MIDI
files onto it (or generate clips right there) and it analyzes each one:
what chords it implies, how it moves, what's inside. You can tag, filter,
search, audition, and export.

![MIDIcurator: the clip library on the left, a selected clip's piano-roll and analysis on the right](assets/guide/midicurator.png)

Things to try:

- **+ Generate progression** or **+ GloriArp groove** if you have no
  files handy — the library fills itself.
- **GloriArp** is the suite's accompaniment maker: it learns a *style*
  from a clip you like ("☆ learn clip as style") and can then play that
  style over any chord progression — a walking bass, a comping pattern —
  with knobs for how busy, how loose, how surprising. Styles travel as
  small `.json` files you can share between the webapp, the plugin, and
  the command line.
- **Variants** makes controlled variations of a clip — same idea,
  different density or feel.
- Deleting is safe: things delete immediately with an **Undo** offer,
  and only "Clear All" asks first.

ProgGenie's **Send to MIDIcurator** button writes a MIDI file that
carries the whole progression inside it — MIDIcurator reads it back with
the chords intact, not just the notes.

---

## Door 5 · "I want to understand what I'm hearing"

Three reference tools, best kept open in a tab while you work:

- **Chord Dictionary**:
  <https://enkerli.github.io/music-suite/apps/chord-dictionary/> —
  167 chord types, each shown as notes, as a ring, and on a pad grid.
  The spelling is careful on purpose: the suite always names notes by
  their role (from G♯, the third is B♯ — not C), because the *function*
  of a note matters, not just its sound.

  ![Chord Dictionary: a chord spelled out with its ring and pad-grid pictures](assets/guide/chord-dictionary.png)

- **PickPCS**: <https://enkerli.github.io/music-suite/apps/pickpcs/> —
  a playground for **note sets**: pick any combination of the twelve
  notes and see what shape it makes, what it's called, and what it's
  close to. PickPCS can *push* a set you like straight into PitchFold
  as a scale — the two are designed as a pair.

  ![PickPCS: the twelve-note ring with a set selected and named collections suggested](assets/guide/pickpcs.png)

- **DrawnQurve**: <https://enkerli.github.io/music-suite/apps/drawnqurve/>
  — less about notes than about *motion*: draw a curve with your finger
  or mouse and it becomes a control movement — a filter opening, a
  vibrato deepening — sent as MIDI. Runs on macOS, iPad, and Linux as a
  plugin too.

  ![DrawnQurve: hand-drawn curves in colored lanes over a timeline](assets/guide/drawnqurve.png)

---

## Door 6 · "I want several tools at once"

Open the **Workspace**: <https://enkerli.github.io/music-suite/apps/workspace/>

The Workspace is a bulletin board of small modules — a pattern box, a
chord namer, a groove maker, a recorder, a synthesizer — that all listen
to one shared **bus** (a message channel: when one module makes a chord
or a pattern, the others hear it and can react).

![Workspace: several modules arranged in a grid — control surface, pattern, bindings, bus monitor](assets/guide/workspace.png)

Things to try:

- **+ add module** → **GloriArp**, generate a groove, and **+ add
  module** → **Vane Synth** — the groove plays out loud through a real
  synthesizer voice, right in the browser.
- **Recorder** captures what crossed the bus; **Library** keeps things
  you save; **Bindings** maps your computer keyboard (or MIDI knobs) to
  module controls; **Bus Monitor** shows the messages flying by, which
  is the honest way to learn how the suite talks to itself.
- The **Bridge (CLI)** module connects the page to command-line tools
  running on your computer (Door 7) — a terminal pipeline can play into
  your browser tab.

---

## Door 7 · "I prefer the command line"

Everything above also runs headless — no window, no browser — via the
`msuite` command. From a copy of the
[music-suite repository](https://github.com/Enkerli/music-suite):

```bash
npm install                      # one-time setup; builds everything
npm run msuite -- chord 60 64 67 # "what chord is C·E·G?"
```

(`npm run msuite --` is the no-setup launcher; `npm link -w @enkerli/cli`
gives you a bare `msuite` if you prefer.) The fourteen commands, one
line each:

| Command | What it does |
|---|---|
| `chord 60 64 67` | names the chord those MIDI notes make |
| `pattern "E(3,8)"` | rhythm codecs — binary, hex, onsets, all views of one pattern |
| `upi "P(3,0)+P(5,0)"` | the full Serpe pattern language, with analysis |
| `describe vane` | list a tool's controllable parameters |
| `generate --mode major --length 8 --seed 42` | a progression from the corpus statistics (same seed = same result) |
| `smf "Dm7 G7 \| Cmaj7" -o out.mid` | chord names → a MIDI file other suite tools can read back |
| `accompany --progression "Dm7 \| G7" --seed 42 -o bass.mid` | GloriArp: a bassline over your chords, with a trace explaining every note |
| `style learn in.mid --chord Dm7 --id mine -o model.json` | learn an accompaniment style from MIDI files |
| `render 60 64 67 -o out.wav --breath 0.9` | actual audio through Vane's real synthesizer voice |
| `… --play \| play --midi-out <port>` | sends a pipeline's notes to a real MIDI port (Linux-first; `play --list` shows ports) |
| `send --to serpe --param density=0.7` | a control message, printed as one line of JSON |
| `recv` | read/validate those messages from a pipe |
| `bind stage.json --cc 74=40` | resolve a hardware knob through a control map |
| `bridge` | serve a pipeline to the browser (the Workspace's Bridge module) |

The commands pipe into each other Unix-style — `msuite accompany
--progression "Dm7 | G7" --play --loop | msuite bridge` runs a groove in
your terminal and hands it to a browser tab. The full matrix of what
runs where: [HEADLESS.md](https://github.com/Enkerli/music-suite/blob/main/docs/HEADLESS.md).

---

## Door 8 · "I make music in a DAW"

A **DAW** (digital audio workstation — GarageBand, Logic, Ableton Live,
Reaper, AUM on iPad…) can host suite tools as **plugins**: the same
interfaces you've seen above, docked inside your project, synced to its
tempo and transport. Seven exist:

| Plugin | The same tool as… | Notes |
|---|---|---|
| ProgGenie | Door 1 | progressions follow the DAW's tempo; hears your MIDI keyboard |
| MIDIcurator | Door 4 | clip auditioning rides the DAW's play button |
| Serpe | Door 2 | the pattern engine drives your instruments |
| PitchFold | Door 3 | folds any track's notes into a scale |
| Suite Workspace | Door 6 | grooves leave as real MIDI; your hardware plays in |
| Vane | — | the suite's own instrument: a breath-first synthesizer, happiest with a wind controller or any source of expressive, continuous control |
| DrawnQurve | Door 5 | curves become automation for anything |

They're free, like everything here. Formats: AU, VST3, and standalone
apps on macOS; AUv3 on iPad; VST3/LV2 on Linux (plus CLAP for Vane and
the Workspace). Building them from source is spelled out, per platform,
in [BUILD.md](https://github.com/Enkerli/music-suite/blob/main/BUILD.md) — and on iPad, run a plugin's standalone app
once so the DAW notices it.

---

## How the pieces talk to each other

No magic, four mechanisms, all inspectable:

1. **MIDI files** (`.mid`) — the paper mail. ProgGenie exports one,
   MIDIcurator imports it; the suite tucks the full chord information
   inside the file, so meaning survives the trip.
2. **The bus** — the Workspace's shared message channel. Modules (and
   suite web apps in other tabs) publish chords, patterns, and scales as
   small readable messages; the Bus Monitor module shows them raw.
3. **MIDI itself** — live note and control messages, to and from
   hardware (Chromium browsers) and inside a DAW (plugins).
4. **The bridge** — a tiny local server (`msuite bridge`) that lets a
   command-line pipeline feed a browser tab on the same machine.
   Chrome is the reliable browser for this one; the details and rough
   edges are honestly listed in [BUILD.md](https://github.com/Enkerli/music-suite/blob/main/BUILD.md#3-connecting-the-deployed-workspace-to-your-local-machine-the-bridge).

## Where your things live

Saved progressions, styles, patterns, and settings stay in your
browser's local storage, on your machine — clearing the browser's site
data clears them, and exporting (MIDI or JSON files) is the durable copy.
The **Library** button in each app browses what you've saved. In plugins,
your work saves with the DAW project. The chord statistics ProgGenie
draws on are *derived numbers* (which chord follows which, how often) —
the underlying songbooks are not included, browsable, or reproducible
from them.

## Comfort

Every app shares the same top-right controls: **theme** (light/dark —
your choice sticks across all suite apps), **MIDI** status, and
**density** ("Cozy" spreads things out; compact fits more on screen).
Controls are keyboard-reachable, color never carries a meaning by
itself, and touch targets are sized for fingers. If something here falls
short for you, that's a bug worth reporting, not a fact of life.

---

*Words this guide introduced — chord, chord progression, MIDI, MIDI
file, DAW, plugin, standalone, bus, groove, pattern/onset, scale — live
in the [glossary](https://github.com/Enkerli/music-suite/blob/main/docs/GLOSSARY.md) with the suite's more technical
vocabulary. Everything in the suite is Public Domain: use it, change it,
share it, no permission needed.*
