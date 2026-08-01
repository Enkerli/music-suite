# Design pass — brief

*Prepared 2026-08-01 for a Claude Design pass. Written to be read cold: no
prior knowledge of the suite assumed, and every claim either checked or marked
unverified.*

---

## 1. What this is

Eleven small music web apps sharing one design system (`@enkerli/ui`), seven of
which also run **inside audio-plugin windows** (JUCE WebViews) on macOS and
iPadOS, plus a CLI. Public domain, no accounts, no uploads; work stays in the
user's browser.

**Read [INTENT.md §B](INTENT.md) before designing anything.** It is short and it
is the part that cannot be recovered from the code. The headline:

- **Smidgen** — Alex's coinage for *semi-generative musicking*. The machine goes
  partway and stops; a person answers. The unit of value is the **activity**,
  not an output file.
- **Playfulness is a requirement, not a garnish.** Lucky mistakes are results.
  When the choice is between "what everyone does" and "what might surprise
  someone", the second needs no further defence.
- **Not generating what you'd have heard anyway.** The quality bar is not "is
  the output good" but "is it worth listening to and deciding about".
- **Theory through practice.** Concepts are learned by hearing and doing, not by
  reading first.
- **Explainability, especially for the weird maths.** Euclidean rhythms,
  pitch-class sets, Barlow indispensability, binary/hex pattern encodings. The
  test: can a user answer *"why did it do that?"* without reading source?
- **"Workspace", not "playground".** Playground undersells it — this is a place
  with your materials out, where play is how the work gets done.

**Copy tone is a hard constraint**: plain and humble, no hype, no overpromising,
never framed around "songs". All site copy lives in [site.md](site.md).

---

## 2. What must not be redesigned away

These are settled decisions, each re-litigated at least once by someone who did
not know they were decisions. Full list in [INTENT.md §D](INTENT.md).

| | |
|---|---|
| **D1** | **Leftmost = first step = LSB.** Tresillo is `0x94`, not what other software shows. Held strictly through hex and octal. It is a rule about *direction consistency*, analogous to date formats — the analogy is Alex's. |
| **D2** | **Structural note spelling.** D♯ and E♭ stay different. |
| **D3** | **The engine is authoritative; the UI is a view.** In a plugin, raw text goes to C++ and the engine's answer is what displays. The JS parser is a subset. |
| **D6** | **Trigger 1 is the bare base** for every progressive operator. |
| **D8** | **An accent layer belongs to a lane**, not to the whole string. |

Also: **the jazz corpus is never published** — only derived statistics ship.

---

## 3. The open design questions

These are genuinely undecided and are the reason for this pass. Listed with what
is known, not with a preferred answer.

### 3.1 How should poly lanes be drawn?
Serpe can run parallel rhythm lanes of different lengths (`E(3,8)/E(3,7)` — 8
steps against 7, realigning every 56). Today they draw as **stacked rows**.
A **concentric-circle** view exists (`polyView: 'circle'`) and renders.

Alex likes both steps and circles for single patterns. **Nobody has decided
whether circles work for lanes of different lengths** — that is INTENT H4 and
the most valuable thing this pass could settle. Choosing lets the other be
deleted rather than maintained.

### 3.2 The trigger index is invisible, and it costs
Progressive patterns produce a different pattern per trigger. Nothing in any UI
shows *which* trigger you are on. Two separate bugs this week would have been
obvious in minutes if a panel had read **"trigger 3 · rotated 6"**:
a phase inconsistency, and a pattern silently not advancing at all.

Agreed as wanted. Where it belongs — inside the steps view, or as separate
chrome — is a design question. It is also the clearest single instance of the
explainability commitment (§1) not being met.

### 3.3 `Poly Lock` — a good feature nobody can find
A parameter chooses between:

- **Cycle** (the default): every lane spans the same cycle — *polyrhythm*.
- **Step**: lanes share a step size, drift, and realign at their LCM —
  *polymeter*.

Alex, testing in a DAW, concluded polymeter was **not implemented**. It is; the
default is the less interesting mode and the name says neither word. Naming,
defaulting and surfacing are all open.

### 3.4 Visualization modules for Workspace
Wanted (Alex): steps **and** circle for UPI output, pitch-class sets as circles,
piano-roll for MIDI clips and progressions.

Cheaper than it sounds — `packages/ui/components/` already has `pcs-ring.js`,
`piano-roll.js`, `pitch-grid.js`, `knob.js`, `range-slider.js`. This is mostly
**hosting existing components in Workspace modules**, not building renderers.

Open: piano-roll for a *progression* (harmonic blocks) and for a *clip* (notes
over time) are different problems wearing one name.

### 3.5 How is an accent shown?
An accent in Serpe is **louder and transposed** (velocity, plus a default +5
semitones — so an accented note 36 arrives as 41). Users have read "accents
don't work" when a drum kit simply had nothing mapped at 41. The two-channel
nature of an accent is currently invisible.

---

## 4. Accessibility — the honest state

A commitment, not a compliance exercise (INTENT B6): the documentation should
work as a welcome **and** leave room for unplanned exploration.

- [A11Y_AUDIT](A11Y_AUDIT.md) — automated (axe), clean on the ten apps that
  existed 2026-07-11, both themes, keyboard, 24px targets.
- [A11Y_TEST_PLAN](A11Y_TEST_PLAN.md) — the manual counterpart (screen reader,
  keyboard-only, magnification, **cognitive** barriers). **Never run.**
- **`workspace` has been through neither** — it shipped after both.

Two specific hazards worth designing around:

1. **Workspace installs a document-level key listener** binding bare `]`, `[`
   and `m`, guarded only against text fields. Whether that steals keystrokes
   from a screen reader is **unknown**.
2. **`drawnqurve` and `serpe` render heavily to `<canvas>`** — highest risk for
   screen-reader users. Any new visualization (§3.4) inherits this problem, so
   deciding the non-visual route *while* designing the visual one is the ask,
   not afterwards.

The suite's own four commitments (from `packages/ui/DESIGN.md`) start with
**never colour-only encoding** — colour always pairs with shape.

---

## 5. Technical constraints that shape design

| | |
|---|---|
| **Plugin windows** | Seven apps also render inside a JUCE WebView. Small, resizable, no browser chrome. |
| **WKWebView traps** | No `window.confirm` / `prompt`. IndexedDB unreliable under the custom scheme. |
| **Theme** | Light and dark both required; a viewer toggle stamps `data-theme` and must win. |
| **WebMIDI** | Desktop Chromium only. Safari/Firefox must degrade gracefully — absence is expected, a dead-end UI is a bug. |
| **iPadOS** | AUv3. Touch targets, and the 24px WCAG floor (house bar is 44px; ~10–19 controls per app currently sit in the 24–43px band). |
| **Offline** | No network calls. Everything ships in the bundle. |

---

## 6. Known bugs the designer will meet

So they are not reported as design problems:

- ~~Serpe standalone rejects scene notation~~ — **fixed 2026-08-01**. It now
  routes `|` through the poly parser. **A scene chain with no `/` therefore
  renders in the POLY panel as a single lane** — correct, but not obviously
  right, and a presentation call for this pass (§3.1).
- ~~The webapp does not precess poly lane accents~~ — **fixed 2026-08-01**.
  Lanes now advance their accent phase every cycle, as mono always did.
- **Workspace's pattern module takes no poly, no scenes, no progressive**
  (`apps/workspace/modules.js:96` uses the mono parser). Any Workspace
  visualization work depends on fixing this first.
- **`msuite jam`** is described in three docs and does not exist.
- Poly lane progressive state is not persisted across a session save.

---

## 7. Where things are

```
packages/ui/            the design system — DESIGN.md, tokens, components/
apps/style-gallery/     every token and component in one page — best first stop
apps/                   the eleven apps
docs/INTENT.md          §B the brief, §D settled decisions, §H parked ideas
docs/UX_AUDIT.md        the previous UX pass
docs/TRAINING_PLAN.md   how a newcomer is meant to arrive (Part A)
docs/site.md            all site copy
```

Live: `https://enkerli.github.io/music-suite/apps/<name>/`

---

## 8. What would make this pass most valuable

In order:

1. **Settle the poly representation** (§3.1). It unblocks Workspace
   visualization and lets one of two implementations be deleted.
2. **Design the trigger index in** (§3.2). Highest explainability-per-pixel in
   the suite.
3. **Make `Poly Lock` findable** (§3.3) — naming and default, no engine change.
4. **Decide the non-visual route for canvas views** (§4) *alongside* the visual
   one, not after.

And one request about method, from the suite's own lessons: **a claim about
behaviour needs a trace, not a reading.** If something looks broken, it may be a
stale bundle or a known bug in §6 — every plugin now shows two build stamps (UI
and binary), and a mismatch is the first thing to check.
