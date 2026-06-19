# The Music Suite — the story

*A plain-language tour of the whole family, for anyone — no music theory or
coding required.*

## One idea, several tools

Most music software does one of two things: it makes **sound**, or it helps you
**arrange notes**. This suite has a third goal running through all of it — to
help you *understand* the music you're working on, not just produce it. Name a
chord, see which notes sing over it, watch a progression tip into a new key,
lay a shape out the way your hands actually play it.

It isn't one big program. It's a small **family of tools**, each doing one job
well, that look and feel the same and hand their work to one another.

## The shared foundation

Underneath every app sits a single **music-theory core** — one carefully
tested library that knows notes, chords, scales, and how they relate. Every
app draws on the same brain, so a chord named in one place means exactly the
same thing everywhere. (That core is also the *reference*: its answers are
pinned down by test cases other versions — in other programming languages —
must match, so the suite can grow without drifting.)

They also share a look: a calm **"paper & ink"** style, the same colours and
type throughout, so moving between tools feels like staying in one room.

## The apps

- **Progression Studio** *(nickname: ProgGenie)* — the most developed member,
  and the suite's front door to harmony. It writes jazz chord progressions
  drawn from the habits of 2,611 lead sheets, lets you edit them on a song
  sheet, plays them back, and quietly explains what's going on. It runs in a
  browser, as its own app, and as a plug-in inside studio software.
- **MIDIcurator** — the next stop. Drop in MIDI clips, see them on a piano
  roll, hear them, and have their chords named for you; tag, rate, and search a
  growing library, and spin off denser or sparser variants of any pattern. It's
  where a progression becomes a collection of usable parts.
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

The throughline is a workflow you can walk end to end, with each tool taking
the hand-off from the last over plain **MIDI**:

> **harmony → curation → rhythm → expression → sound**

Write a progression in **Progression Studio**, send it to **MIDIcurator** to
audition and collect, set its **rhythm** with **Serpe** (Euclidean and
balance-based patterns), shape its **expression** with **DrawnQurve** (draw a
curve, it loops as MIDI), and give it a **sound** with **Vane** (an expressive
wavetable synth). **PitchFold**, the pitch-and-tuning explorer, rounds out the
family. Those four are really studio plug-ins; what you can open here are their
browser versions — so the whole chain is now walkable, end to end.

## A standing promise

Progression Studio learned from **2,611 real jazz lead sheets**, but it only
ever keeps their *habits* — which chords tend to follow which — never the songs
themselves. The original charts never leave the machine and are **never
published**. The suggestions carry the collective instinct of thousands of
tunes without copying any single one.

## Where they run

In a web browser, on an iPad, and — for Progression Studio — right inside the
studio software you already work in. Same tools, wherever you are.

---

Want to go deeper on the flagship? Read **[Progression Studio's own
story](doc.html?p=proggenie-story)**, its **[user guide](doc.html?p=user-guide)**,
the **[architecture](doc.html?p=architecture)**, or the
**[history & roadmap](doc.html?p=history)**.
