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

# drive Vane's sound from a control message (see §5)
msuite bind stage.json --cc 74=40 | msuite render 69 -o knob.wav --stream
```

That second line is the whole idea in miniature: a message goes in one end and
sound comes out the other, with no app open.

---

## 3. Sending messages between tools

The tools share a small common "note" they can pass around — a **scale**, a
**chord**, a **progression**, a **rhythm pattern**, a **parameter** change, or
a **command**. Each message is addressed *from* one tool *to* another (or
broadcast to all).

- `msuite send --to serpe --param density=0.7` — set a parameter on a tool.
- `msuite send --to serpe --command mutate --arg amount=0.3` — tell a tool to
  do something.
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

The **Suite Workspace** puts tools side by side as **modules on a single page**
that you drag to arrange, all sharing one message bus:

- a **Control Surface** — sliders and buttons built automatically from a tool's
  parameter list (Vane or Serpe), sending changes onto the bus;
- a **Pattern** module — type Serpe notation (`E(3,8)`) to draw a rhythm and put
  it on the bus; it also shows any pattern another module sends;
- a **Bus Monitor** — the live stream of messages, so you can watch the tools
  talk.

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
