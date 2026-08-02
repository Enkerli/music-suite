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
| view | `Both / Circle / Step` — 3-way | `Rows / Circle` — 2-way |
| step numbers | `☐ step numbers` | *(absent)* |
| accents | `✦ accent` — a pill | *(per-lane, in the rows below)* |
| lane lock | *(n/a)* | `Polyrhythm / Polymeter` — 2-way, two-line |
| kit | *(absent)* | `kit [GM ▾]` |

"Both" and "Rows" name the same idea. Polygon is a checkbox on one side and a
pill on the other. A reader learning the app learns it twice.

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

`ch` lands on its own line with its label clipped at the panel edge. Three of
the controls (`●`, `☐`, `△`) carry no label at all — one is solo/mute, one is a
per-lane toggle, one is the polygon toggle, and nothing on screen says so.

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

## Cross-references

- First pass: `DESIGN_BRIEF.md`
- Deliberate decisions the pass must NOT undo: `INTENT.md` D1 (leftmost = LSB
  in every readout), D6 (trigger 1 is the bare base), D8 (accents are per lane),
  and B7 — this is a workspace, not a playground; density is acceptable where it
  buys clarity.
- Duration arcs are the identity view; the polygon is a **didactic overlay, off
  by default** (`packages/ui/components/rhythm-views.js`). Item 1's polygon
  inconsistency should be resolved toward that framing, not away from it.
