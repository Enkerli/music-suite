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
