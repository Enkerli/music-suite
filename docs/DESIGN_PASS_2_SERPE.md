# Serpe — design pass 2, accumulated items

Collected 2026-08-02, from things noticed in passing since the first pass plus
a deliberate walk through the app. Every item below was observed on the running
webapp, not recalled.

The first pass (Q2, the shared `LibraryBrowser` and the cluster work) did what
it set out to do. What has accumulated since is mostly the cost of **features
landing faster than the vocabulary they need** — poly, progression, accents,
duration arcs, and a drum kit all arrived after the layout was drawn.

Same standing rule as last time: **this is a brief, not a spec.** Functionality
should not change during the pass.

---

## 1. Mono and poly speak different languages *(the big one)*

The same two views use different words AND different control types for the same
concepts. Switching a pattern from `E(5,8)` to `E(5,8)/E(3,4)` silently changes
what the controls are called and how they look.

| | mono header | poly header |
|---|---|---|
| section label | `PATTERN` | `LANES` |
| polygon | `☑ polygon` — a checkbox | `△ all` — a pill |
| view | `Both / Circle / Step` — 3-way | `Both / Circle / Rows` — 3-way *(Both added 2026-08-02)* |
| step numbers | `☐ step numbers` | *(absent)* |
| accents | `✦ accent` — a pill | *(per-lane, in the rows below)* |
| lane lock | *(n/a)* | `Polyrhythm / Polymeter` — 2-way, two-line |
| kit | *(absent)* | `kit [GM ▾]` |

**Decided 2026-08-02 (Alex): poly gets "Both" too.** Done — the rings and the
per-lane cells now show together, as mono has always allowed. The two answer
different questions (how lanes interlock vs which step is which) and having to
choose was the odd part.

What remains for the pass: the third option is called `Step` in mono and `Rows`
in poly for the same thing, polygon is a checkbox on one side and a pill on the
other, and the section is `PATTERN` or `LANES` depending. A reader still learns
the app twice.

**Worth deciding:** one header vocabulary that degrades gracefully, with the
poly-only controls appearing rather than the whole row changing shape.

## 2. Three control shapes in one row

In the poly header, left to right: an **oval pill** (`△ all`), a **segmented
control** (`Rows | Circle`), and above them a **larger segmented control with
two-line labels** (`Polyrhythm / Polymeter`, with "one shared cycle" and
"shared step · drifts" as subtitles).

The lock control is visually the heaviest thing in the panel, which reads as
"this is the most important choice here". It probably is not — it is set once
and rarely revisited, while the view toggles get used constantly.

## 3. The pattern field is the smallest thing on screen

`kick=E(3,8) / snare={0…` — truncated at about 20 characters, in a ~340px rail,
while the right-hand column has room for full-width sliders and a 60-character
help paragraph.

It is the primary input of the whole application. Poly, scenes and progressive
notation are all long by nature, and none of them fit.

## 4. Progressive state lives away from the pattern it changes

The `Progressive` accordion (Offset/cycle, `Advance cycle`, `Reset`, "Cycle 1 —
rotate the base by the offset each cycle") is in the **right** column, while the
pattern and its ring are on the **left**. The trigger number — the one piece of
state that says which cycle you are hearing — is inside a collapsible section,
several hundred pixels from the thing it describes.

Workspace put `↻ advance` / `⤺ base` directly under the notation and showed
`trigger N (base)` in the readout beside it. Worth comparing; the placement is
the question, not the wording.

## 5. Lane rows do not fit the rail

Each lane row wraps mid-control:

```
 ●  snare   E(4,8)   ☐  △   note [38]
 ch [10]
```

`ch` lands on its own line with its label clipped at the panel edge.

The three glyph controls (`●`, `☐`, `△`) show no VISIBLE label — but this is a
visual problem only, not a screen-reader one: an accessibility pass on
2026-08-02 found they are properly named ("Mute kick", "kick polygon overlay",
"kick MIDI channel"). Corrected here because the first draft of this brief said
they "carry no label at all", which was wrong and would have sent the designer
looking for a bug that does not exist.

## 6. The library rows got dense — and that is my doing

Saved patterns now carry every layer as a facet, which was the right fix
functionally (poly patterns could not be saved at all before), but it lands as
seven tags across two lines per row:

```
E(3,8)/E(4,8)@+20ms
[Euclidean]  #3/8 · 4/8  #E(3,8)  #E(4,8)  #antibacchic  #isochronous
             #poly 2  #offset                                  SAVED  ⋯
```

Two tag vocabularies are also mixed: the family is a filled pill, everything
else is `#hash` text.

**Worth deciding:** which facets earn a row by default and which belong behind
the existing FILTERS disclosure, and one tag treatment rather than two.

## 7. Nested scrolling in the Patterns panel

The library list has its own scrollbar inside the page's scrollbar, so a
trackpad gesture over that area does something different from the same gesture
two pixels away.

## 8. Empty left column below the lanes

With three lanes, the left column ends around 40% of the viewport and the rest
is blank, while the right column continues for another screen and a half. The
ring — the thing people actually look at — is the element most constrained by
this.

---

## Not for the designer — engineering notes that came out of the same walk

- **A false alarm, recorded so nobody re-raises it.** `{10010}E(5,8)>7` looked
  like it reported "6 onsets" on arrival — a D6 violation, since trigger 1 must
  be the bare base. It does not: my probe dispatched Enter to commit the text,
  and Enter IS the re-trigger, so it had advanced to trigger 2. Entering the
  same notation without Enter gives `5 onsets in 8 steps · 10110110` = E(5,8).
  Correct.
- The filled-accent-means-nothing problem that made Workspace's power button
  read as already-on applies to any button using `.ws-btn`'s default. Serpe's
  buttons are a different set, but the lesson generalises: **filled should mean
  state, not just "this is a button"**.

---

---

## Accessibility — audited 2026-08-02, mostly good

Run with `mgifford/accessibility-skills` (`cli-audit`, Playwright + Axe) plus a
manual accessibility-tree pass. **Zero automated violations, 38 passes**, and
all 139 interactive elements have accessible names. The one "incomplete" is
colour-contrast on decorative `aria-hidden` glyphs and on `<select>` elements
whose text the OS renders — measured at 13.6:1, so nothing actionable.

Fixed in the same pass (small, and none of it visual):

- three decorative icons (play, stop, library search) were neither exposed nor
  hidden; they sit inside buttons that already carry names, so they are now
  `aria-hidden` + `focusable="false"` — the latter because SVG is focusable by
  default in some engines and was adding empty tab stops
- the Serpe logo had `aria-label` with no `role`, which is unreliable across
  engines and duplicated the adjacent word "Serpe" where it did work; now
  decorative
- the play button now reports `aria-pressed` and its label follows state
  (Play/Pause) rather than always saying "Play"
- **the rings' description now includes duration.** It listed onsets and
  accents only, and duration arcs are the identity view — with `LS(r){mask}` in
  the notation, that omission was the difference between an open hat and a
  closed one for anyone not looking at the screen. It also uses lane names now:

  > 2 lanes. Lane 1 (kick): 3 of 8 steps, on 1, 4, 7. Lane 2 (hh): 8 of 16
  > steps, on 1, 3, 5, 7, 9, 11, 13, 15; sustained on 1, 9.

**Not yet done, and not automatable:** keyboard-only operation, real screen
reader testing, and plain-language review. Alex is arranging those. The skills
repo has `keyboard`, `manual-testing` and `plain-language` for exactly this, and
they are the parts that decide whether the app is actually usable — the clean
Axe run says only that nothing obvious is broken.

## Cross-references

- First pass: `DESIGN_BRIEF.md`
- Deliberate decisions the pass must NOT undo: `INTENT.md` D1 (leftmost = LSB
  in every readout), D6 (trigger 1 is the bare base), D8 (accents are per lane),
  and B7 — this is a workspace, not a playground; density is acceptable where it
  buys clarity.
- Duration arcs are the identity view; the polygon is a **didactic overlay, off
  by default** (`packages/ui/components/rhythm-views.js`). Item 1's polygon
  inconsistency should be resolved toward that framing, not away from it.
