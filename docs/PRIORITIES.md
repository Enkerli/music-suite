# Priorities — cost/benefit for the next arc

*2026-07-17, after the first full proof-of-concept (a shell-composed bassline
sounding through a browser tab, full-duplex bridge). This is the
prioritization exercise: what each candidate costs, what it unlocks, and the
recommended order. A living document — re-rank as slices land.*

## 0. The lens: playflow presets

Individual features are hard to rank; **playflows** are not. Value = which of
these four end-to-end experiences a slice unlocks or improves:

| Preset | The experience | Blocked on |
|---|---|---|
| **P1 · Plug & Jam** | Walk to the Ubuntu Studio miniPC, plug in a controller, play — with automated accompaniment underneath. No browser, no DAW, no laptop. | headless *live* MIDI (see §1) |
| **P2 · Funkastic** | Ask for a funky bassline / jazzy comping / a drum groove over a progression; steer it live (density, chromaticism, fills); keep the takes you like. The commercial-inspo lane (Funkastic, EZkeys, Scaler). | GloriArp musicality (§2) |
| **P3 · Groove Lab** | Multiple interlocking rhythm lanes — the Keil point that groove lives in the *interaction between* parts, not any one lane. Serpe as the loom. | Serpe Poly (§3) |
| **P4 · The Legible Suite** | A newcomer (or future-us) reads the site and understands the system: what talks to what, in what vocabulary, why. | docs systems pass (§4) |

P1 is the stated blocker. P2 is where the distinctive product value
concentrates. P3 deepens P2 (grooves need lanes). P4 compounds everything but
rots fastest when written ahead of moving code — this session proved it
twice (the invented "Start audio" button; the never-synced workspace app).

## 1. Headless LIVE sound — un-blocking P1

**The reframe that makes this cheap:** the miniPC synth already exists.
Vane's default Linux build is a **headless LV2** (no WebView), made for
MODEP/Patchbox-style hosts — the controller plugs into ALSA, `jalv` (or
mod-host) runs Vane, and you play it today. What's missing is not audio from
Node; it's **the suite's messages becoming real MIDI** so the accompaniment
can reach that plugin (or any synth — fluidsynth, hardware) alongside you.

**Slice A — `--midi-out` (S):** teach `--play` (and a general
`msuite play` that forwards any NDJSON note stream) to emit actual MIDI
bytes. On Linux this is dependency-free file I/O: `modprobe snd-virmidi`
gives virtual rawmidi devices bridged to the ALSA sequencer; we write 3-byte
note-on/offs (+CC2 breath, as the bus path already does) to
`/dev/snd/midiC*D*`, and `aconnect` routes it into jalv/fluidsynth/hardware.
A SuiteMessage note is already one small step from MIDI bytes — the SysEx
transport work laid all the framing conventions. macOS keeps using the
browser bridge (its live path already works); Linux-first is correct because
P1 *is* Linux.

**Slice B — `docs/JAM.md` (S):** the one-page miniPC recipe: jalv + Vane
LV2, `aconnect` controller → synth, `msuite accompany --play --loop
--midi-out …` underneath, optional PitchFold-style quantization later.
Setup-once, jam-forever.

**Slice C — `msuite jam` (M, optional later):** a single self-contained
process: read `/dev/midi*` (raw MIDI in, plain file reads), drive the WASM
voice in a real-time block loop, pipe PCM to `aplay`/`pw-play`. Zero
external synth, one command. Defer until A+B prove insufficient — A+B reuse
the *plugin* voice (full-featured), while C is capped by the WASM voice's
parity queue.

**Cost S+S · unlocks P1 outright · risk low** (worst case: virmidi quirks on
a given kernel; fallback is writing to a hardware synth's rawmidi directly).

## 2. GloriArp musicality — the value center of P2

The user's instinct is right: the distance from "quarter-note chord tones"
to "engaging" is mostly **Stage-0 transforms over machinery that already
exists** (seeded RNG, trace, features, chord-relative events, the UPI
engine). In rough order of value-per-cost:

1. **`--rhythm <UPI>` (S):** replace the source phrase's onset grid with any
   UPI pattern — `E(3,8)` under a bass instantly speaks funk; `P(3,0)+P(5,0)`
   comping figures. This is the *interop dividend*: Serpe's entire rhythm
   language becomes GloriArp's rhythm section for the cost of a grid-mapping
   function. Highest leverage single item in this document.
2. **More curated source phrases (S, pure data):** a ghost-note funk bass, a
   bossa ostinato, walking-with-skips, a two-feel — each committed vector
   phrase is a new "style" for free, and exercises the adapter harder.
3. **Articulation & dynamics pack (S):** velocity/accent shaping (accent
   pattern from the UPI `{bits}` layer), gate policy (staccato/legato/
   overlap), metric-position velocity contour, ghost-note insertion at low
   velocity. Explicit data per the brief §14, not hidden randomness.
4. **Silence & syncopation (S/M):** accent-aware rest insertion (drop weak
   onsets, never downbeat targets), anticipation push (steal an eighth from
   the next bar — the walking-bass move the cyclic approach targets already
   set up for).
5. **Note-choice variety (M):** activate the `variation` knob (octave
   displacement, chord-tone re-selection, enclosure insertion using the
   already-modeled approach machinery), register contour targets.
6. **Comping role (M):** first polyphonic role — voicing spans, rolled
   attacks, hold/release policy. Needs voice identity; do after 1–5 harden
   the monophonic contracts (the brief's own phase ordering).
7. **Groove role (M):** drum-lane output = pitch-free phrases on GM drum
   notes with the same rhythm/accent engine — pairs perfectly with §1's
   MIDI out (any drum module) and previews §3's multi-lane thinking.

**Cost mostly S · P2 is the product's distinctive value · risk low** — each
transform is unit-testable against the trace, and every one also improves P1
(better music under your hands at the miniPC). Items 1–4 together are
roughly one of our working sessions.

## 3. Serpe Poly — P3, honestly costed

The most expensive item here, and the one with a real architectural tail:
the engine, the React app, the progressive/scenes machinery, and the C++
plugin are all single-lane by construction. Full parity poly is **L**.

But there's a bounded first slice (**M**): a **lanes model in the webapp +
`@enkerli/upi`** — parse `E(3,8) , E(2,3) , E(4,16)` as *parallel lanes*
(the `+` combinator already computes LCM projection; lanes reuse that math
without merging), per-lane MIDI note/channel + accent layer + mute, and —
the ethnomusicological heart, and genuinely cheap — **per-lane micro-timing
offset** (push/pull in ms: Keil's participatory discrepancies as a slider).
Web-only first; the C++ plugin keeps mono until the notation stabilizes.
The strategic point stands: **don't deep-document mono notation before
poly lands**, because poly changes the notation surface (§4 sequencing).

**Cost M (slice) / L (parity) · unlocks P3, feeds §2's groove role · risk
medium** (notation design is a one-way door — worth a short design note
before code).

## 4. Documentation systems pass — P4, woven not batched

Real lesson from this session: docs written ahead of verification *lied*
three times (Start audio button, stale synced apps, serve-from-`docs/`).
So: **no standalone docs megaproject now.** Instead:

- **Standing rule (free):** every slice's definition of done includes its
  doc + BROWSER_TEST/HEADLESS delta + `sync-apps` for touched apps. (This
  arc already practices it; write it into CONVENTIONS.)
- **One systems iteration (M), scheduled after §1+§2 land:** the suite
  glossary + object model (the GloriArp designer brief's Deliverables A/B
  double here), a "how the plane fits together" diagram, personas/use-case
  refresh against what now actually works. This is the Fable-style systems
  pass — but pointed at a system that will have just stopped moving under it.

## 5. The recommended sequence

| # | Slice | Cost | Unlocks |
|---|---|---|---|
| 1 | ✅ `--midi-out` + `msuite play` (Linux virmidi) *(shipped 2026-07-17)* | S | **P1 unblocked** |
| 2 | ✅ `docs/JAM.md` miniPC recipe *(shipped 2026-07-17 — awaiting on-device verification)* | S | P1 usable by a human |
| 3 | ✅ GloriArp: `--rhythm <UPI>` + source-phrase pack *(shipped 2026-07-18)* | S | P2 ignition, P1 better |
| 4 | ✅ GloriArp: articulation/dynamics/silence pack *(shipped 2026-07-18)* | S/M | P2 |
| 5 | ✅ Serpe Poly: notation DECIDED (`/` lanes, `@` ms\|note-value offsets) + parser + `msuite upi` poly + **webapp lanes view** (mute/note/chan per lane, offset-aware playback with the base-lag trick) *(shipped 2026-07-18 — by-ear verification pending, BROWSER_TEST §9)* | M | P3, P2 groove role |
| 6 | GloriArp: note variety → comping → groove roles | M each | P2 depth |
| 7 | Docs systems iteration (glossary/object model/diagram) | M | P4 |
| — | `msuite jam` single-process | M | only if 1–2 prove insufficient |

Rationale in one line each: **1–2** remove the stated blocker at the lowest
cost by reusing the plugin voice instead of building Node audio; **3–4** are
the best value-per-cost in the whole portfolio and compound with 1; **5**
starts Poly's one-way notation decision early (design note) while deferring
the expensive tail; **6** deepens the product; **7** documents a system
that's briefly stable. Everything stays incremental — each row is
independently shippable and independently reversible.

## 6. Standing hygiene notes (from this week's friction)

- `docs/apps/**` is tracked build output: a local `sync-apps` run before
  pulling can collide with upstream syncs (`error: untracked working tree
  files would be overwritten`). Fix: `git checkout -- docs/apps && git clean
  -fd docs/apps` (or stash) before `git pull`; never hand-edit under
  `docs/apps/`.
- After every pull: `npm run build-packages` (don't trust `npm install`'s
  prepare alone), and re-run `sync-apps` for apps you serve locally.
- `npm audit fix --force` is a trap here (vite/vitest majors); the reported
  vulnerabilities are dev-server-only.
