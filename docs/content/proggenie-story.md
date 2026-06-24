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
