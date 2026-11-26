# PCS Pads: an eight-pad prototype of pitch-class-set selection

A test bench for **how PCS selection feels on eight pads and one centre
button**, the shape of an Orba, a Lightpad or a Control Block. The music
theory is not done here. Every set, digit, mode and move comes from
`@enkerli/theory`'s [`pcsSelect.ts`](../../packages/theory/src/pcsSelect.ts),
the same functions (pinned by `vectors/pcs-select.json`) that a device port
will run. Plan: [HARDWARE_REPURPOSING.md](../../docs/HARDWARE_REPURPOSING.md)
§5.1 and §12.

Open `index.html` in a browser. It's one self-contained file, with no
server needed.

## The interaction

**Hold the centre**, then tap a pad, to change mode. **Tap the centre** for
the mode's own secondary action.

| Mode | Pads | Centre tap |
|---|---|---|
| Play | the current set's degrees, from the root | arpeggio |
| Octal | digits 0–7; four taps make a set (C Ionian = 5 6 2 5) | backspace |
| Two-page | toggle C–G, then A♭–B | flip page |
| Intervals | add a step of 1–8 semitones; reaching the octave commits | clear |
| Moves | lighter · darker · relative · ±5th · P · L · R | next one-semitone neighbour |
| Favourites | recall one of eight sets | store (then tap a slot) |

**When changes apply:** Now, or at the next beat, bar or loop (4 bars of
4/4) of the built-in transport. Every change is *proposed*. With a
quantum set it is cued (shown dashed on the ring), and further changes
build on the cued set. That lets you line up the next set silently while
the current one plays, then it lands on the boundary.

Keyboard: `1`–`8` pads (in Octal, `0`–`7` type the digits), `C` or
`Space` centre (hold for modes), `Esc` cancel the cue, `Enter`
start/stop.

The ring also edits: click to add or remove a note, Shift-click to set the
root. The side lists show the set's parallel modes from light to dark and
its one-semitone neighbours.

**MIDI out (optional):** played notes, plus each *applied* set as the
suite's own `scale` message (`@enkerli/protocol`, SysEx 0x7D). Needs
a browser with Web MIDI and SysEx permission (Chrome, Edge).

## Build

```sh
node examples/pcs-pads/build.mjs   # → examples/pcs-pads/index.html
```

esbuild bundles `src/main.ts` together with the theory and protocol
sources, and inlines `@enkerli/ui`'s tokens into `src/template.html`.
Commit the rebuilt `index.html` with any source change.

## Status

A prototype under `examples/`, deliberately outside the app inventory
and the integration moratorium (HANDOFF.md §1). It isn't on the site and
has no plugin. Questions it should help answer before any firmware is
written:

- Is four-tap octal entry quick enough to use live, and memorable?
- Which moves deserve a pad of their own on a real device?
- Is "cue for the next bar or loop" the right default during performance?
