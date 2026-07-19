<!-- =====================================================================
     THE SITE, IN ONE FILE.

     This is the single source of all text on the Music Suite site. Edit the
     prose freely. Then run:  npm run build-site
     …which repopulates docs/index.html and docs/content/*.md from this file.

     The only rule: keep the `<!-- kind ... -->` marker lines intact — they
     tell the generator where each block starts. Everything between markers is
     plain Markdown you can rewrite however you like. (Re-ordering app cards is
     fine; just move a whole `card` block.)
     ===================================================================== -->

<!-- meta -->
title: Music Suite — a family of tools for playing with music
description: A family of tools for musical exploration: generate and shape chord progressions, curate MIDI patterns, explore chords and pitch. Webapps with standalone apps and plugins for macOS and iPadOS.

<!-- nav -->
brand: Music Suite
link: Apps -> #apps
link: The story -> doc.html?p=the-story
link: Guide -> doc.html?p=user-guide
link: Architecture -> doc.html?p=architecture
link: GitHub -> https://github.com/Enkerli/music-suite

<!-- hero -->
eyebrow: A family of Public Domain tools for musical exploration
heading: Play **with** music using Public Domain tools. Explore chords, rhythms, tunings, and expressive sounds
cta: [Read the story →](doc.html?p=the-story) primary
cta: [Browse the apps](#apps)

Playing *with* music is a unique experience. It’s about trying things, listening in new ways, noticing what you can’t really describe.
This suite provides a few Public Domain tools to explore different aspects of music. Chords, rhythms, tunings, expressive sounds…
Since all of these tools are in the Public Domain, you’re free to do **whatever you want** with them.

<!-- apps -->
The apps
Each app focuses on something specific and some can pass information to the other apps. Please note that some browsers don’t support the technology behind these apps. For instance, these apps don’t work on iPad. There are separate versions of most of these apps which do work on iPad and Mac.

<!-- card proggenie link=apps/proggenie/ docs=proggenie-story -->
ProgGenie (aka “Progression Studio”)
Generate jazz chord progressions, edit them on a leadsheet, play (with) them, understand some harmony.

<!-- card midicurator link=apps/midicurator/ -->
MIDIcurator
Collect MIDI clips and generate some variations.

<!-- card exquisite-fingerings link=apps/exquisite/ app=exquisite -->
Exquisite Fingerings
See chords and scales laid out on pad grids. Square pads (as on the Novation Launchpad or Ableton Push) or “hex” pads (as on the Intuitive Instruments Exquis).

<!-- card pickpcs link=apps/pickpcs/ -->
PickPCS
Explore sets of notes on an interactive ring, including chords and scales.

<!-- card chord-dictionary link=apps/chord-dictionary/ -->
Chord Dictionary
Look up chords and display them in a circle or on a grid (square or hex).

<!-- card style-gallery link=apps/style-gallery/ -->
Style Gallery
The suite's "paper & ink" design system, live — the colours, type, and components every app is built from.

<!-- card pitchfold link=apps/pitchfold/ -->
PitchFold
A scale and pitch quantizer. Build sets of pitches on the ring, snap incoming notes to them.

<!-- card drawnqurve link=apps/drawnqurve/ -->
DrawnQurve
Draw a “qurve” for notes, pitch, or modulation. You can quantize those by scale or rhythm.

<!-- card vane link=apps/vane/ -->
Vane
An expressive wavetable synth with support for breath, pressure, and slide. 

<!-- card serpe link=apps/serpe/ -->
Serpe
Explore rhythmic patterns and morph them.

<!-- docs -->
Documentation
Start with the suite story; the deeper docs cover ProgGenie.

<!-- doclink the-story page=the-story -->
The Suite
A plain-language tour of the whole family — what it is and how the apps fit together.

<!-- doclink proggenie-story page=proggenie-story -->
ProgGenie — Story
What’s behind these chord progressions, anyway?

<!-- doclink user-guide page=user-guide -->
ProgGenie User Guide
How to use the ProgGenie chord progression generator, step by step.

<!-- doclink control-plane page=control-plane -->
Connecting & Automating the Tools
The command line, tool-to-tool messages, keyboard & MIDI shortcuts, and the workspace.

<!-- doclink architecture page=architecture -->
Architecture
The code: data model, theory modules, the three runtimes.

<!-- doclink history page=history -->
History & Roadmap
How it got here, and where it's going.

<!-- note -->
**Hosting note.** Every card opens a live build served from this same GitHub Pages site (`docs/apps/<slug>/`). The six monorepo apps build with `npm run build -w <workspace> -- --base=./ --outDir docs/apps/<slug> --emptyOutDir`. **PitchFold, DrawnQurve, and Vane are JUCE plugins in separate repos** — what's deployed here is each plugin's WebView UI, built from its own repo and copied in, so it runs standalone in the browser (without the plugin's audio/host).

<!-- footer -->
Music Suite · All these tools are Public Domain. ProgGenie uses transition statistics derived from the Impro-Visor imaginary-book corpus (GPL) without publishing the leadsheets. · [github.com/Enkerli/music-suite](https://github.com/Enkerli/music-suite)

<!-- page the-story -->

# The Music Suite — the story

*A plain-language tour of the whole set of tools, no music theory or coding required.*

## Several tools to play **with** music

This suite lets you explore different dimensions of music. You can use these tools to **play with** musical ideas. There are aspects you can see or read. Mostly, though, you should be able to listen to things in a different way.

You can learn about harmony by exploring chords and chord progressions. You can learn about rhythm by exploring patterns. You can also draw music and change it in unusual ways.

Each of these tools is the result of a separate [vibecoding](https://en.wikipedia.org/wiki/Vibe_coding) process. Each time, I started with an idea and interacted with Generative AI tools like Claude Code to make that idea into a usable tool. In other words, designing and developing these tools, like using them, is a form of open exploration.

At the same time, I’m making these tools look and feel similar to one another. Plus there’s some interaction between them. For instance, a chord progression from ProgGenie can be used in MIDIcurator and you can create an expressive “qurve” in DrawnQurve and play with it in the Vane synth.
 
## The shared foundation

Underneath every app sits a single **music-theory core** — a  library for knowledge about notes, chords, scales, rhythms, and how they relate. Every app draws on the same brain, so a chord named in one place means exactly the same thing everywhere. (That core is also the *reference*: its answers match regardless of version. In this way, the suite can grow without drifting.)

Most of these apps also share a look and feel: a calm **"paper & ink"** style, using the same colours and typography throughout. At some point, moving between tools should feel like staying in the same room.

## The apps

- **ProgGenie** *(aka Progression Studio)* — a front door to harmony. It writes jazz chord progressions
  drawn from the habits of 2,611 Jazz standards, lets you edit them on a leadsheet, plays them back, and quietly explains what's going on. It runs in a
  browser, as its own app, and as a plug-in inside studio software.
- **MIDIcurator** — a tool for musical pattern. Drop in MIDI clips, display them, play (with) them, and have their chords named for you. You can tag, rate, and search patterns in your library. You can also create variants of any pattern.
- **PickPCS** — a playground for **sets of notes**. Build a chord or scale on
  concentric rings laid out by the circle of fifths, and see how the bigger
  scale families and the smaller chords nested inside them relate.
- **Chord Dictionary** — the shared reference the others lean on: look up any
  chord by name or by its notes, with its spelling, its fingerprint, and its
  aliases. Plain, fast, and authoritative.
- **Exquisite Fingerings** — chords and scales laid out on **isomorphic pad
  grids** (square, like a Launchpad; hex, like the Exquis controller) — the way
  you actually reach for them. Highlight a scale, work out a fingering, save the
  shape.
- **Style Gallery** — the "paper & ink" design system itself, on a page: the
  colours, type, and building blocks every app is made of. If something looks
  wrong across the suite, this is where you'd see it first.

## How they fit together

I’m working a playflow for several of these tools. At this point, you can bring material from one tool to the other and play with it. In most cases, the transfer is about MIDI, an old protocol to get musical instruments and tools to communicate with one another. What’s brought over is musical information, not sound. Except in the case of the Vane expressive synth which produces sound.

Here’s a possible playflow:

> **harmony → curation → rhythm → expression → sound**

Write a progression in **ProgGenie**, send it to **MIDIcurator** to play with it and generate some variants, explore **rhythm** with **Serpe**, shape its **expression** with **DrawnQurve**, and give it a **sound** with **Vane**. 

There are plugin versions for most of these tools, for use in a plugin host or Digital Audio Workstation (DAW). These work on both Mac and iPad. Some even work on the Raspberry Pi.

## A standing promise

ProgGenie uses information derived from the leadsheets of 2,611 Jazz standards. It only
ever keeps the “habits” from these chord progressions: which chords tend to follow which. It doesn’t keep the songs
themselves. The original charts never left the machine and will never get published. The suggestions carry the collective data from thousands of tunes without copying any single one.

## Where they run

In a web browser, on a Mac, on an iPad, or inside studio software. They’re the same tools in different environments.

---

Want to go deeper on chord progressions? Read **[ProgGenie's own
story](doc.html?p=proggenie-story)**, its **[user guide](doc.html?p=user-guide)**,
the **[architecture](doc.html?p=architecture)**, or the
**[history & roadmap](doc.html?p=history)**.

<!-- page proggenie-story -->

# ProgGenie — the story

*A plain-language tour, for anyone — no music theory or coding required.*

## What it is

Many pieces of music are built around chords, sets of notes played together. Moving from one chord to another is an important part of musical structure in many genres. In Jazz, for instance, chords are the basis of improvisation as players will choose notes which fit a chord context.
The order of moves between chords is the “chord progression”.  ProgGenie (aka *Progression Studio*) is
a tool for generating, modifying, and understanding those progressions. It can serve as a chord progression sketchpad with some smarts built in.

## Where its ideas come from

Using a database of 2,611 Jazz standards, we’ve extracted the transitions between chords. What are the most likely options after a given chord? These transitions are set in a simple table that ProgGenie uses to generate chord progressions.
So its suggestions draw on
data from thousands of tunes.

## What you can do with it

- **Ask for an idea.** One button writes a fresh progression, any key, any
  length. Simple dials make it safer or more adventurous.
- **Make it yours.** Tap a chord to change it, move chords around, type a
  progression in by hand, or play chords on a music keyboard and have them
  written down for you.
- **Teach it your taste.** Give the moves you like a thumbs-up (and the ones you
  don't a thumbs-down); it remembers and leans your way next time. Your taste
  becomes a little profile you can save and reuse.
- **Hear it.** Play back the progression using an electronic instrument (such as a synth or sampler). While the progression plays, a *now-playing* card follows along, showing the
  current chord and what's coming next.
- **Pass it on.** Hand the result to the other tools in the family, or save it
  as a standard music file.

## It reads the music back to you

Beyond creating chord progressions, ProgGenie helps you understand them. It names each chord, shows
which notes are likely to work well over that chord and which to handle with care. The tool also points out
some important moments, such as a key change or a "coming-home" pattern. One tap flips
between chord names and a shorthand based on chords’ relationship to a key.

## The story so far

It began as a small experiment that could spit out plausible chord sequences. It grew into a more elaborate tool that we’re integrating into one member of a suite of music tools, some of which pass information to other tools. Along the way it was redesigned around a single
clear idea:

> The leadsheet is always the centre of the screen, and everything else is there to help it.

The generator proposes chords into the leadsheet, your playing writes into it, your taste colours it, the library remembers it.

From there it got a few more features around harmony, the relationships between chords, scales, and notes. The simple idea of holding things together in a leadsheet keeps the tool focused.

## Where it runs

The same program runs three ways: as a webapp, as a standalone app, and as a plugin inside music software. The webapp can be used on a variety of platforms, though not all browsers support it. The standalone and plugin work on both iPadOS and macOS.

<!-- page user-guide -->

# ProgGenie — User Guide

ProgGenie is built around a “leadsheet” as a series of chord names split across bars. By default, the tool generates a leadsheet. You can also type or paste a text version. Or add chords by playing them through MIDI. You can also rate a whole leadsheet or some parts of it. You can play it back using an electronic instrument. You can also send this leadsheet to another tool.

This guide walks through each of these possibilities.

---

## 1. Starting a progression — the four front doors

The **document strip** at the top names the current progression (title,
composer, a source badge) and offers four ways to begin:

- **New** — blank the sheet and start from scratch.
- **Generate** — *New take* re-rolls the generator (see §2). The sheet also
  updates live as you change generator settings.
- **Open…** — recall a progression from your **library** (the ones you've
  saved; the corpus itself is never browsable).
- **Type / paste a leadsheet…** (under *Import…*) — paste **bar notation** on
  one or more lines: bars split on `|`, a held bar repeats with `%`, chords
  within a bar are space-separated. Example: `Dm7 G7 | Cmaj7 | A7 | Dm7`. You
  can also **open a `.mid` file** (it reads the embedded progression).

A **blank sheet** shows a prompt with these options, so the text-entry path is
visible exactly when you'd reach for it.

> **Tip — chord names vs degrees.** When you paste chord names (`Cmaj7 Am7 …`)
> the editor switches to showing **chord names**. Flip any time with the
> **`I ⇄ Cmaj7`** button by the sheet (see §4).

---

## 2. Generating

The generator settings sit in labelled groups; the sheet regenerates live, and
**New take** re-rolls the random walk.

| Group | Control | What it does |
| --- | --- | --- |
| **Key** | Key, Mode | The home key (major/minor). |
| **Length & pacing** | Bars, Harmonic rhythm | How many bars, and the default chord length (1 beat … 4 bars, or *varied*). |
| **Source** | Engine, Start from | Corpus walk / corpus walk + cadence / circle of fifths; and an optional seed chord. |
| **Adventurousness** | Surprise, Freshness | *Surprise* reaches further down each transition's probability list; *Freshness* (faithful / fresh / bold) avoids clichés (repeats, quick returns, rote V→I). |
| **Voice** | Voicing, Voice-leading, Channels | Chord voicing shape; voice-leading mode (none / loose / strict); MIDI channel split (channels divide the output *by voice*). |
| **Depth** *(advanced ▸)* | Context, Reharm, Modulation | Generation depth — see below. |

**Depth** controls (occasionally set):

- **Context** — *variable-order Markov*. "2 chords" leans on what the corpus
  knows tends to follow a **two-chord** context (longer-range phrasing);
  "1 chord" is the plain first-order walk.
- **Reharm** — probabilistic **substitutions**: tritone (♭II7 for V7) and
  backdoor (♭VII7) dominants, *subtle* or *bold*.
- **Modulation** — **mechanical** key changes: a new corpus-common related key
  (dominant / subdominant / relative / up-a-step) every N bars, shown as real
  **sections** with a bold seam divider. (For *harmony-driven* key reading, use
  **implied keys** in §4.)

Everything is **seeded and deterministic**: the same settings give the same
progression. Save a whole settings set as a **Patch** (the *patch · Save…/Load…*
buttons) to recall a generator configuration later.

---

## 3. Editing the leadsheet

The leadsheet is a grid of bars; tap a tool, then work directly.

- **✏️ Edit** (default):
  - **Insert** — tap a **caret** (the `+` between cells, or the trailing `+`)
    to type a chord or pick a voice-led suggestion.
  - **Open a chord** — tap the cell to open the **inspector** (retype,
    consonance, duration, voicing lock/unlock, rate, why, the chord-scale grid,
    move, delete).
  - **Move a chord** — **press and hold** the cell to lift it (on desktop the
    cell shows a grab cursor; the `⠿` grip is the hint), then **tap a caret**
    to drop it. (Tap-the-grip → tap-a-caret also works, and is the
    keyboard-/precision-friendly path.)
  - **Duration** — in the inspector, a sole-in-bar chord can be held 1–4 bars
    (`%` repeat bars); a chord sharing a bar can be split to its own whole bar.
- **👍 / 👎** — *rating tools*: tap chords to reinforce or weaken the move
  *into* each one. This is **curation** (see §6); the cell tints to show it.

The **write cursor** is the blinking caret marking where the next inserted or
**played** chord lands; tap any caret to re-aim it (see §5).

---

## 4. Reading the harmony — display toggles (by the sheet)

These change how the sheet *reads*; none of them change the chords, the sound,
or the export.

- **`I ⇄ Cmaj7`** — show every chord as a **Roman degree** (composer view) or a
  **chord name** (reading/entering a known tune). Pasting chord names selects
  the name view automatically.
- **◇ implied keys** — **read the harmony** for local key areas: secondary
  dominants and ii–V–Is that tonicize a non-home chord (e.g. `A7 Dm7` → a brief
  D-minor area) are **re-spelled in their own key** with a **quiet tag** on the
  span (no divider, can start mid-bar). Works on generated, edited, **and
  pasted/imported** progressions — it's a re-reading, the chords don't move.
- **Motion** (off / notable / all) — the **transition-character overlay**: a
  **↝ arrow** marks root motion by a fifth (cadences: V→I, ii→V, secondary
  dominants), a **quiet underline** marks a step. *notable* hides ordinary
  diatonic steps so a busy tune isn't painted solid.

### The chord-scale (the inspector's hero)

Tap a chord to open its inspector and see its **chord-scale** on an
**isomorphic pad grid**:

- Geometry toggle — **▦ square** (chromatic rows in fourths; 5×5 ≈ two octaves)
  or **⬡ hex** (Exquis: major-3rd NE, minor-3rd NW).
- Roles read by **shape + glyph, never colour alone**: chord tone = solid pad,
  scale tone = outline, **tension** = dotted edge + `•`, **avoid** = dashed
  edge + `⊘`.
- A line names the scale and calls out avoid notes — **preferring the
  avoid-note-free scale** when one exists (e.g. Cmaj7 → *Lydian · or Ionian
  (avoid F)*).

---

## 5. Playing chords in by MIDI (plugin / standalone)

Route a MIDI keyboard into the plugin and play a chord. It's **identified and
held** (so you can release both hands), then shown as a **ghost cell at the
write cursor** inside the sheet:

- **✓** writes it, locking the **voicing as played**, and advances the cursor.
- **▸** opens *completions* ("one tone shy of a common chord") and *alternate
  voicings* (smoothest from the last chord), each one-tap.
- **✕** dismisses the held chord.
- Tap a caret to **re-aim** the cursor and write mid-progression.

The status line below the sheet shows MIDI routing and what's currently held.

---

## 6. Curation — shaping the generator's taste

Rating transitions builds a **profile** that biases what the generator
proposes (and what the MIDI picker suggests). Rate from three places — they all
feed **one functional, key-independent ledger**:

- per-chord **👍 / 👎** in the sheet (the move *into* a chord),
- **More like this / Bit meh** on a whole progression,
- the corpus stats view.

The curation panel shows **Your profile** as a *shape* — the strongest few
boosts and suppressions, with a count. The full ledger is one disclosure away
(**All weights**), with a **filter** (`from … into …` degree) — handy as the
list grows: "everything into V7". Because weights are functional, a V→I you
favoured in a C verse applies in a G bridge too. The inspector's **"why this
chord"** line closes the loop ("you favour V7→I").

Profiles **save/load** as JSON (Replace or Merge an incoming one).

---

## 7. Hearing it & the now-playing card

In the **web app and the JUCE standalone**, a **Play** button (with Tempo)
auditions the progression through WebAudio. In the **AUv3 plugin**, the **host
transport** drives playback (use your DAW's play button).

During playback a **now-playing card** follows the playhead: the **sounding
chord** big, its **chord-scale pad grid lit** (the tones pulse), and a **next
up** preview. The leadsheet's chord-follow highlight tracks the same playhead.

---

## 8. Sending it on — export & MIDIcurator

The progression travels as a **Standard MIDI File** that **embeds the canonical
progression** (so the suite can read it back):

- **Send to MIDIcurator** — the named destination; saves a leadsheet-bearing
  `.mid` you open in MIDIcurator.
- **Export MIDI file** — the same SMF as a plain file.
- **Copy chords** — the chord symbols to the clipboard.

Both routes write the same bytes through the native save/share path (no blob
downloads in the plugin's WebView). The filename uses the document title.

---

## 9. Library

**Save to library** snapshots the current progression (title · composer · key ·
bars · source) into local storage — the canonical Progression object, so locked
voicings and durations survive. **Open…** recalls one. The library holds **only
your own** progressions; the corpus is never browsable or exported.

---

## Keyboard & accessibility notes

- The leadsheet is operable by tap/click and keyboard; the move gesture has a
  no-drag fallback (tap to pick up → tap a caret to drop).
- Motion / role cues use **shape + glyph**, legible in greyscale and for
  colour-blind readers; colour only reinforces.
- Animations (cursor blink, the now-playing pulse) respect
  `prefers-reduced-motion`.
- Light "paper" theme is the default; **● Dark** is one tap away.

<!-- page control-plane -->

# Connecting & automating the tools

Every tool in the suite works on its own — you never need any of this to play
with chords, rhythms, or sound. But the tools can also **talk to each other,
run without a window, and be driven from a keyboard or a MIDI controller.**
This guide covers those features: the command line, tool-to-tool messages,
shortcuts, and the single-page workspace. Reach for them when you want to
automate a step, wire two tools together, or build a hands-free setup.

> **Two conventions worth knowing.** Rhythm and pitch-class numbers read
> **leftmost = smallest** (the first step is the *ones* place), so the tresillo
> over 8 steps is `0x94` / `73`. Chord progressions are written as **bar
> notation** — bars split on `|`, chords space-separated (`Dm7 G7 | Cmaj7`) —
> the same notation ProgGenie uses.

---

## 1. The command line — running tools without a window

The suite ships a small command, **`msuite`**, that runs the tools' engines
with no GUI, no DAW, and no plugin host. After `npm install`, run it from the
project folder — the root script works without any global install:

```
npm run msuite -- <command> …
```

(Prefer a bare `msuite`? `npm link -w @enkerli/cli` puts it on your PATH. The
examples below write just `msuite <command>` for brevity.)

The commands fall into three groups.

**Ask about music** — analysis, printed to the screen:

| Command | What it does | Example |
| --- | --- | --- |
| `chord` | name a chord from notes or pitch classes | `msuite chord 60 64 67 71` → `Cmaj7` |
| `pattern` | show a rhythm in every notation | `msuite pattern "E(3,8)"` → onsets `[0 3 6]`, `0x94`, `d73` |
| `upi` | the full Serpe pattern language | `msuite upi "P(3,0)+P(5,0)"` → a 15-step polygon pattern |

**Make something** — writes a file or audio:

| Command | What it does | Example |
| --- | --- | --- |
| `generate` | a chord progression from the corpus statistics | `msuite generate --mode major --length 8 --seed 42` |
| `smf` | bar notation → a Standard MIDI File | `msuite smf "Dm7 G7 \| Cmaj7" -o out.mid` |
| `accompany` | walk a bassline through a progression (GloriArp) — pick a style (`--source funk-ghost`, `bossa`, `two-feel`) or put the notes on any Serpe rhythm (`--rhythm "E(3,8)"`) | `msuite accompany --progression "Dm7 \| G7 \| Cmaj7" --rhythm "E(3,8)" -o bass.mid` |
| `render` | notes → audio through Vane's real sound engine | `msuite render 60 64 67 -o out.wav --breath 0.9` |

**Connect tools** — the messaging commands (`send`, `recv`, `describe`,
`bind`) get their own sections below.

> **Reproducible by seed.** `generate` takes a `--seed`; the same seed always
> gives the same progression, so you can re-find one you liked. Add `--tonic C`
> to see the chords spelled out (`Cmaj7 | Dm7 | G7 …`), or `-o out.mid` to write
> it straight to a MIDI file.

---

## 2. Piping one tool into another

Because each command reads and writes plain text, you can **pipe** one into the
next with the ordinary `|` your shell already has — one tool's output becomes
the next one's input:

```
# generate a progression, then hear it through Vane
msuite generate --length 4 --seed 3 --tonic C -o take.mid

# generate a progression and walk a bassline through it (GloriArp)
msuite generate --mode minor --length 8 --seed 7 | msuite accompany --seed 9 --tonic A --mode minor -o bass.mid

# perform that bassline as a live message stream…
msuite accompany --progression "Dm7 | G7 | Cmaj7 | A7" --play | msuite recv

# …or straight into the browser, looping as a continuous groove
msuite accompany --progression "Dm7 | G7 | Cmaj7 | A7" --play --loop | msuite bridge

# full duplex: the SAME command also lets the browser talk back — a knob
# turned in the Workspace tab lands on this shell's stdout
msuite accompany --play --loop | msuite bridge | msuite recv

# drive Vane's sound from a control message (see §5)
msuite bind stage.json --cc 74=40 | msuite render 69 -o knob.wav --stream
```

The middle lines are new: one tool *composes* the harmony, another *plays*
through it — and `--play` streams the result as real-time messages any suite
tool can listen to. The last line is the whole idea in miniature: a message
goes in one end and sound comes out the other, with no app open.

---

## 3. Sending messages between tools

The tools share a small common "note" they can pass around — a **scale**, a
**chord**, a **progression**, a **rhythm pattern**, a **parameter** change, a
**command**, or a **note to play**. Each message is addressed *from* one tool
*to* another (or broadcast to all).

- `msuite send --to serpe --param density=0.7` — set a parameter on a tool.
- `msuite send --to serpe --command mutate --arg amount=0.3` — tell a tool to
  do something.
- `msuite send --to vane --note 60,64,67 --duration 500` — play a chord on a
  voice: this is what lets ProgGenie, DrawnQurve, or MIDIcurator actually
  *sound* through Vane.
- `msuite recv` — read messages coming in and print them in plain language.

Put together, `msuite send … | msuite recv` shows a message making the trip.
Inside an app or plugin the same messages ride ordinary MIDI, so a web tool and
a plugin can talk the same way.

---

## 4. Seeing what a tool can be told — `describe`

Before you automate a tool, you can ask what it exposes:

```
msuite describe vane      # Vane's 36 sound parameters, with ranges and units
msuite describe serpe     # Serpe's steps/tempo/swing + its commands
```

Each **parameter** has a name, a range, and a unit (Hz, ms, cents, a 0–1 ratio…);
each **command** is a named action. This list is what shortcuts and the
workspace read, so anything `describe` shows, you can drive.

---

## 5. Keyboard & MIDI shortcuts — control-maps

A **control-map** connects an input — a keystroke, a MIDI knob (CC), or a pad
(note) — to a parameter or command on a tool. It's a small text file:

```json
{ "id": "cm-stage-01", "kind": "control-map", "label": "Stage layout",
  "bindings": [
    { "trigger": { "kind": "midi-cc", "cc": 74 }, "action": { "app": "vane", "param": "filter-cutoff" } },
    { "trigger": { "kind": "key", "combo": "mod+shift+m" }, "action": { "app": "serpe", "command": "mutate", "args": { "amount": 0.3 } } },
    { "trigger": { "kind": "midi-note", "note": 36 }, "action": { "app": "serpe", "command": "next-pattern" } }
  ] }
```

- **Check it** against the tools' parameters: `msuite bind stage.json --validate`.
  It tells you if a binding points at something that doesn't exist.
- **Try one**: `msuite bind stage.json --cc 74=127` turns knob 74 to full and
  prints the resulting message; pipe it onward to hear or log it.

A knob's position is mapped into the parameter's own range for you, following
how that parameter naturally moves — so a knob on Vane's filter, which sweeps
by ear rather than evenly, feels right end to end without any extra setup. A
saved control-map is yours to keep, recall, and share — a performer's layout,
including a keyboard- or switch-only layout, is a first-class thing you save,
not settings buried in one app.

---

## 6. The Workspace — several tools on one page

The **Suite Workspace** puts tools side by side as **modules in a bento
grid** — aligned tiles, no overlap: **◀ ▶** reorder a module, **⤢** cycles
its size (1×1, wide, tall, large), and the grid packs itself. All modules
share one message bus:

- a **Control Surface** — sliders and buttons built automatically from a tool's
  parameter list (Vane or Serpe), sending changes onto the bus;
- a **Pattern** module — type Serpe notation (`E(3,8)`) to draw a rhythm and put
  it on the bus; it also shows any pattern another module sends;
- a **Pattern Player** — makes whatever pattern is on the bus *audible*: a
  looping voice at your bpm and MIDI note. Send `E(3,8)` from the Pattern
  module, press play, and the tresillo ticks through the Vane tab;
- **Rhythm Analysis** — the same pattern, read instead of played: onsets,
  evenness, balance, syncopation, and every notation, updated live as
  patterns cross the bus;
- a **Progression** module — type changes in bar notation or generate them
  from the corpus statistics (same seed, same changes), then put them on
  the bus — where GloriArp picks them up. The compose-then-accompany loop,
  closed inside one page;
- a **GloriArp** module — the accompaniment engine itself, in the page: pick
  a style and a progression, shape the feel (rhythm, gate, dynamics, rests,
  push, variety, pocket, morph), press play — the bassline sounds through
  the Vane tab, and **⬇ .mid** downloads the identical take. One engine,
  everywhere;
- a **Keys** module — a tappable octave (with velocity, length, and octave
  controls) that plays notes onto the bus: audition Vane, feed the Chord
  Namer, or just noodle;
- a **Chord Namer** — names whatever chord flows by, using the suite's
  167-quality dictionary. Tap C-E-G-B on the Keys module and it says `C∆`;
- a **Recorder** — a message looper: record everything that crosses the bus
  (notes, knob rides, whole scenes) with its timing, then replay or loop it;
- a **Bindings** module — the control-map editor: a key (or, in the plugin,
  a hardware MIDI knob or pad) drives any module's parameters and commands;
- a **Bus Monitor** — the live stream of messages, so you can watch the tools
  talk;
- a **Bridge (CLI)** module — connects the page to a local `msuite bridge`, so
  a terminal pipeline (say, a GloriArp bassline played with `--play`) streams
  straight onto the page's bus — and out loud through the Vane tab. It's a
  two-way door: this tab's own knob turns and clicks travel back through the
  same bridge, so a terminal on the other end of the pipe can see them too.

Add or remove modules from the top bar; your arrangement is remembered. Open the
workspace in two browser windows and they share the same bus, so one window can
drive another.

---

## 7. Going deeper

This guide is the friendly tour. The technical reference — every command, the
message format, and the design behind it — lives in the project's
`docs/HEADLESS.md` (what runs without a GUI) and `docs/CONTROL_PLANE.md` (the
messaging and shortcut system). Those are written for people working on the
code; you don't need them to use anything above.

<!-- page architecture -->

# Progression Studio — Architecture

How the code is organized and why. ProgGenie is one React app
(`apps/progression-studio`) that leans on shared, framework-agnostic suite
packages (`@enkerli/theory`, `@enkerli/ui`, `@enkerli/midi`) and runs unchanged
in three environments (web, JUCE standalone, AUv3 plugin).

```
music-suite/                      (monorepo; npm workspaces)
├── apps/progression-studio/      ← this app (React + Vite)
│   └── src/
│       ├── App.jsx               the whole UI + the generation/analysis pipeline
│       ├── generate.js           Markov walk, voicing, rhythm, variable-order blend
│       ├── curation.js           the taste layer (transition multipliers, profiles)
│       ├── exportMidi.js         SMF export (embeds the canonical Progression)
│       ├── chordInput.js         held-note tracker → detected chord (MIDI in)
│       ├── library.js            localStorage progression library
│       ├── juceBridge.js         browser ⇄ JUCE bridge shim (copied from foundation)
│       └── data/
│           ├── transitions.json  first-order corpus table (derived stats)
│           └── trigrams.json     second-order corpus table (derived stats)
├── packages/theory/              ← @enkerli/theory (pure, TypeScript, vectored)
├── packages/ui/                  ← @enkerli/ui (framework-agnostic create*(el,opts))
└── packages/midi/                ← @enkerli/midi (SMF core + leadsheet round-trip)
```

The JUCE plugin is a **separate repo** (`progression-studio-plugin`) that
embeds this app's built bundle in a WebView — see [The three runtimes](#the-three-runtimes).

---

## The data contract: `Leadsheet` / `Progression`

The keystone type lives in `@enkerli/theory` (`leadsheet.ts`). Everything — the
generator, the editor, MIDI import/export — is an instance of it.

```ts
interface Progression { key: KeyContext; meta?: {…}; sections: Section[]; }
interface Section     { label?: string; key?: KeyContext; bars: Bar[]; }   // key → modulation
interface Bar         { chords: ProgChord[]; repeat?: boolean; }           // repeat = "%" held bar
interface ProgChord   { source: "degree"|"absolute"; degree?: RomanDegree;
                        symbol?: {root,suffix,bass}; voicing?: number[]; inputText?: string; }
```

Key points:

- A chord holds a **degree** (key-relative Roman) and/or an **absolute** symbol;
  `realizeChord(chord, key)` fills the other from the key. Degree chords
  re-realize per key; absolute chords are key-invariant.
- A **Section** carries an optional `key` — that's how **modulation** works:
  `realizeLeadsheet` realizes each section against `section.key ?? prog.key`.
- **Durations aren't stored.** A bar's chords divide its beats by the leadsheet
  convention (`divideBar`: 3 → ½+¼+¼); a chord held past a bar becomes a
  whole-bar chord + `%` repeat bars. Inserting/removing re-divides — no
  overflow.

`parseLeadsheet(text, key)` and `formatLeadsheet(prog)` round-trip bar notation.

---

## The corpus and its statistics

The source is Carey Bunks's Jazz-Chord-Progressions corpus, derived from
Impro-Visor's imaginary-book lead sheets (GPL). **The lead sheets are never
published** — only **derived statistics** ship:

- `data/transitions.json` — first-order **pair** counts per degree transition
  (`"IIm7": {"V7": …}`), per mode.
- `data/trigrams.json` — second-order **context** counts (`"prev2 → prev1":
  {next: …}`), pruned to count ≥ 3 and ≥2-option contexts.

Both are regenerated by `@enkerli/corpus-tools` (`regenerate-transitions
<corpusDir> <outPrefix> --respell`) over the local corpus; the CLI never copies
the corpus, only the counts. `--respell` matches the canonical published table.

---

## The generation → display pipeline (App.jsx)

A single `useMemo` chain turns settings into the displayed progression. Each
stage is pure and seeded:

```
rhythm   = rhythmPlan(bars, harmonicRhythm, seed)           // a per-bar plan
labels   = generateSections(table[mode], mode, { …, trigrams, smart })
           → a seeded Markov walk of degree labels (IIm7 V7 Imaj7 …)
           · variable-order: blendTrigram folds the second-order distribution in
           · curation multipliers + gesture triples + variety re-weight the walk
reharmed = applySubstitutions(labels, { tritone, backdoor })   // count-preserving
baseProg = modulate==="off" ? buildProgression(reharmed, rhythm, key)
                            : buildProgressionSectioned(…, keyForBar)  // mechanical
effectiveProg = (edited && edited.genId === genId) ? edited.prog : baseProg
chords   = chordsFromProgression(effectiveProg, key)   // realized per section key
voicings = voiceProgression(chords, { voiceLeadMode, voicingShape })
```

### `genId` — generated vs edited

`genId` is a string of every **generation** parameter (key, seed, bars, rhythm,
surprise, freshness, engine, start, reharm, modulate, context, opCount). An
**edit** is stamped with the `genId` it was made under; while that matches,
`effectiveProg` is the edit, otherwise it falls back to the fresh generation.
This makes "generate vs hand-edit" a synchronous, single-source decision — no
post-render reconciliation. The React editor is **remounted** (via `key={genId}`)
on a generation op so internal edits aren't clobbered.

### Display analyses (don't touch the chords)

- **Implied modulation** (`showImplied`) — `analyzeKeyAreas` over the displayed
  chords' home-key functional degrees → flat-index `keyAreas` spans, passed to
  the editor, which **re-spells per chord** (via the real root, so a degree
  chord re-spells without transposing) and shows a quiet tag. Curation reads the
  area key too (functional ledger stays correct).
- **Motion overlay** (`showMotion`) — `transitionMotion(fromPc, toPc, key)` →
  `motionOf(i)` → the editor draws ↝ / underline in the gap before each chord.
- **Chord-scale grid** — `scaleGridOf(i)` builds a per-pc role map from
  `chordScaleFor`; the editor (inspector) and the now-playing card render it via
  the shared `pitch-grid`.

---

## `@enkerli/theory` modules (pure, vectored)

| Module | Responsibility |
| --- | --- |
| `leadsheet.ts` | The `Progression` type, `parseLeadsheet`/`formatLeadsheet`, `realizeChord`/`realizeLeadsheet`. |
| `analysis.ts` | `assertDegree` (note → Roman degree in a key), `resolveDegree` (Roman → spelled note), degree frames. |
| `chords.ts` · `chordSymbol.ts` · `chordDetect.ts` | Chord quality dictionary, symbol parsing, pcs-based detection. |
| `spelling.ts` · `pitch.ts` · `pcs.ts` | Structural note spelling, pitch helpers, PCS codecs (LSB-first). |
| `voiceLeading.ts` | Taxicab (L1) voice leading — the suite's reference implementation. |
| `chordScale.ts` | Chord → scale (structural classifier) + tensions + **avoid notes**, **preferring the avoid-note-free scale**; returns alternates with their own avoid notes. |
| `substitutions.ts` | Reharmonization over a label stream: tritone / backdoor / passing-dim, mode-aware, seeded. |
| `modulation.ts` | Corpus-common related keys + `planModulation` (mechanical, every-N-bars). |
| `keyAreas.ts` | **Implied modulation** detection — ii–V–I / secondary-dominant tonicizations → local key areas. |
| `motion.ts` | **Transition character** — root-interval classification (fifth / step / …) + `notable`. |
| `rhythm.ts` | Bar-plan / harmonic-rhythm primitives. |

All ship with pinned **vectors** (`*.test.ts`); the Lua/C++ ports of the codecs
must match the same vectors.

---

## The shared editor (`@enkerli/ui/leadsheet-editor.js`)

`createLeadsheetEditor(el, opts) → handle`. Framework-agnostic (plain DOM),
driven by the `Progression` type. The same editor serves ProgGenie
(degree-authored) and MIDIcurator (absolute).

It owns its `Progression` after mount and emits `onChange(prog)`; the React
wrapper (`LeadsheetEdit` in App.jsx) reads callbacks through refs so the picker,
ratings, and analyses always see current app state. Key opts/callbacks:

- structure: `suggest(ctx)`, `onChange`, `tool` (edit / rate-up / rate-down).
- analyses: `ratingOf` / `onRate`, `rationaleOf` (why), `scaleOf` (text),
  `scaleGridOf` (the pad-grid roles), `motionOf` (motion overlay), `keyAreas`
  (implied modulation spans, flat-indexed).
- input: `ghost` (the held live-MIDI chord → an inline cell at the **cursor**;
  the editor does the insertion via `writeAtCursor`).
- display: `display` (functional/absolute), `gridLayout` (square/hex, shared).

Addressing is `(si, bi, ci)` — section, bar, chord — with a flat chord index for
chord-follow and ratings. Structural editing is **direct manipulation** (carets,
press-and-hold move, the inspector) — no modes except the two rating tools.

Other `@enkerli/ui` pieces used here: `pitch-grid` (isomorphic pad grid with the
chord-scale role overlay + `now` playback pulse), `piano-roll` (the Progression
shape), the design tokens (`tokens.css` / `components.css`, "paper & ink").

---

## The three runtimes

`juceBridge.js` exposes `bridge.kind` (`"juce"` in plugin/standalone, else
browser) → `IN_PLUGIN`. The same bundle adapts:

| | Web | JUCE standalone | AUv3 plugin (in a DAW) |
| --- | --- | --- | --- |
| Playback | WebAudio **Play** button | WebAudio **Play** button | **host transport** drives it |
| Detection | `!IN_PLUGIN` | `IN_PLUGIN` + `runtime.wrapper ~ "Standalone"` | `IN_PLUGIN`, host-driven |
| MIDI in | — | bridge `midiNotes` | bridge `midiNotes` |
| File I/O | `<input>`/anchor | native picker via bridge | native picker via bridge |
| Chord-follow | local playhead | local playhead | host beat → chord |

WebView constraints shape the I/O: **no** `window.confirm/prompt/alert`, **no**
blob/data downloads (they kill the page), files go through
`bridge.saveFile(name, bytes)` / `bridge.openFile(patterns)` → `fileOpened`.

The plugin embeds the app as a **single-file bundle** (`WebUI/index.html`,
regenerated by `node WebUI/build.mjs` after app changes).

---

## Building, testing, and the validation ladder

Web: `vite build`. Tests: `vitest` (838 specs across the suite — theory vectors,
generation, curation, the editor, the components).

The plugin runs a **validation ladder** on every change (from the plugin repo):

1. `node WebUI/build.mjs` — rebuild + embed the bundle; WKWebView smoke.
2. `cmake --build build` — macOS AU/VST3/Standalone.
3. `auval -v aumi Prst Enke` — expect "AU VALIDATION SUCCEEDED".
4. `pluginval --strictness-level 8 --validate "…/Progression Studio.component"`.
5. signed iOS (`xcodebuild … -allowProvisioningUpdates`).

> The iOS rung periodically fails at **provisioning** ("No Accounts…") when the
> Xcode signing account lapses — not a code regression. Fix it by re-adding the
> Apple developer account in Xcode → Accounts.

<!-- page history -->

# Progression Studio — History & Roadmap

The story of how ProgGenie became what it is, and where it's headed. The
suite-wide plan of record is `SUITE_AUDIT_AND_PLAN.md` (a local-only repo); this
is the narrative.

---

## 1. A generator looking for a home

ProgGenie began as a **seeded Markov generator**: walk the transition statistics
of 2,611 imaginary-book jazz lead sheets, realize the resulting degree labels in
any of 17 keys with proper structural spelling, voice them with taxicab voice
leading, and play them back. Early additions made it musical rather than
mechanical — a **temperature** knob (how far down each transition's probability
list to reach), **channel-split** voices, **chord-follow** highlighting, and
**SMF export**. The hard rule from day one: the corpus lead sheets are never
published — only the derived statistics.

Then came **ear-driven curation**: per-transition weight multipliers over the
immutable corpus counts. You could say "this change sounds good" or "this whole
progression's a bit meh," and the generator would lean accordingly —
deterministic per (seed, profile), exportable as a JSON profile. Curation
quickly became the strongest, and messiest, use case.

## 2. Joining the suite

ProgGenie stopped being a standalone toy and became one app in a **monorepo**
("music-suite") with a shared **"paper & ink"** design system and shared,
framework-agnostic packages. The keystone was a single **`Leadsheet` /
`Progression` type** in `@enkerli/theory` — suddenly the generator's output,
MIDIcurator's clips, and MIDI files were all the same object. A **shared
leadsheet editor** followed, plus a **ChordID** MIDI-input path (play a chord,
it's identified and added) and **voice-led voicing suggestions**. The app also
became a real **AUv3 MIDI processor** and **standalone**, the same web bundle in
a JUCE WebView, validated through auval / pluginval / signed iOS.

## 3. The leadsheet-first redesign (UX critique, steps 01–06)

A Claude Design critique reframed everything around one diagnosis: ProgGenie
flattened **three different objects** — the progression (the artifact), the
generator (a patch), and the profile (curated taste) — into one toolbar, so the
most important thing had no home. The fix, built as a six-step sequence:

1. **Editing coherence** — between-chord insertion carets, a chord inspector,
   direct-manipulation move/delete; tool-modes survive only for rating.
2. **Generator grouped** — the flat row became labelled groups; "Generate" →
   *New take*; **Patches** save/recall a settings set.
3. **Library & import** — the progression became a **document** with four front
   doors (New · Generate · Open · Import), backed by a localStorage library.
4. **MIDI input unified** — live MIDI writes into the document; the two-place
   flow collapsed to one.
5. **Curation summarized** — the profile shown as a *shape*, not a ledger, tied
   into the inspector's "why this chord."
6. **Send to MIDIcurator** — name the destination, not the file format.

## 4. Track C — generation depth

In parallel, the generator grew **theory-led depth**, each piece a pure,
vectored module:

- **Chord-scale relationships & avoid notes** — a structural classifier mapping
  each chord to its scale (maj7→Lydian, 7→Mixolydian, m7♭5→Locrian, …), with
  **avoid notes** computed structurally, **preferring the avoid-note-free
  scale**.
- **Substitution engine** — probabilistic tritone, backdoor, and passing-dim
  reharmonization over the label stream.
- **Key changes** — modulate to corpus-common related keys.
- **"Smart" generation** — a real **second-order (variable-order) Markov** model
  built from corpus **trigrams**, with back-off to the first-order table.

## 5. The design decisions (Q1–Q6) and beyond

A second design pass answered six open questions, and the build that followed
went well past them through tight iteration:

- **Q2 — multi-section keys.** Modulation became *real sections*, each
  re-anchoring `resolveDegree` to its own key, with a quiet seam divider.
- **Q3 — generator taxonomy.** Five groups by intent; "Sound" → **Voice**;
  depth knobs behind *advanced*.
- **Q5 — chord-scale pad grid.** The inspector's hero: an isomorphic pad grid
  (square = fourths, hex = Exquis) with roles by **shape + glyph, not colour**.
- **Q6 — filter-by-degree curation**, surfacing one functional ledger.
- **Q4 — transition-character overlay** (↝ fifths / underline steps, *notable*).
- **Q1 — the write cursor + inline MIDI ghost + press-and-hold move gesture.**

Then the most interesting thread: **implied modulation**. Rather than chopping
mechanically every N bars, *read the harmony* — detect ii–V–I / secondary-
dominant tonicizations and **re-spell** those spans in their own key, quietly,
inline, **mid-bar capable**, on generated **and pasted/imported** tunes alike.
Finally, **live playback**: a **now-playing card** follows the playhead, the
current chord's scale grid lighting in real time, with a "next up" preview — and
the standalone got its **Play button** back (it has no host transport).

The through-line never changed: **one document, everything else assists it.**

---

## Roadmap

Near-term, mostly captured in `SUITE_AUDIT_AND_PLAN.md` and
`DESIGN_QUESTIONS.md`:

- **MIDIcurator App Group inbox** — the *live* ProgGenie → MIDIcurator handoff
  (today it's a leadsheet-bearing `.mid` you open there). Needs a shared App
  Group container, entitlement wiring, an inbox dir, and a MIDIcurator ingest
  path. Gated on the Apple developer account; also fixes the standalone↔AUv3
  library split.
- **Implied modulation on imported tunes, surfaced.** Detection now runs on any
  displayed progression; the natural next step is a clearer entry point ("find
  the keys in this tune") and tuning the density on busy charts.
- **Passing-dim substitution in ProgGenie.** The engine supports it; inserting a
  chord changes the slot count, so the rhythm plan must re-derive.
- **Design round-2 UX bits** (`DESIGN_QUESTIONS.md`): first-class text entry,
  the functional/absolute toggle's placement/default, the now-playing card's
  always-on vs playback-gated behaviour and its position.

Longer-term, the suite's signature workflow — Progression Studio (harmony) →
MIDIcurator (curation) → Serpe (rhythm) → DrawnQurve (expression) → Vane (sound),
connected by MIDI in a host — plus the chord-scale grid paying forward into
PitchFold and exquisite-fingerings, and variable-order generation maturing off
the accumulating gesture-curation data.
