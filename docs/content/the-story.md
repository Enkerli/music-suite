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
