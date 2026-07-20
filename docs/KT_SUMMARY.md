# State since KNOWLEDGE_TRANSFER.md — summary, 2026-07-20

*Everything below shipped in the sessions following `docs/KNOWLEDGE_TRANSFER.md`'s
9-item ranked plan. Per-item detail lives in that doc and its linked
write-ups (`docs/GLORIARP_NEXT.md`, `docs/PITCHFOLD_AUDIT.md`,
`docs/SERPE_POLY.md`) — this is the cross-cutting view: what shipped,
where each feature actually reaches, and — explicitly, because it was
asked for — what's still limited or missing.*

## TL;DR

Items 2, 4, 5, 8, and 9 of the KT plan are done. Two of them (5 and 9)
got a same-day v2 after review caught real gaps — a color-contrast bug
in Serpe's new rings, and an over-cautious "cycle lock only" restriction
that turned out unnecessary. Item 8 (PitchFold) went further than an
audit: the cheap findings got implemented (pad-override bug, Snap
Strength, dead-code cleanup), a shared `@enkerli/voice-routing` package
came out of it and is now used in **three** JS/TS surfaces (PitchFold's
own engine, a Workspace module, the CLI) — plus PitchFold's C++ engine
has its own equivalent implementation, since a JS package can't cross
into C++ — and two Workspace modules turned the audit into working
cross-app plumbing. What's still open is honestly scoped, not hidden:
Mono Merge and a standalone Time-engine port for PitchFold, and — newly
discovered while addressing the request that prompted this doc —
**Serpe's real JUCE plugin only ever plays polyrhythm; polymeter (step
lock) exists in the webapp alone.**

## What shipped, by KT item

- **Item 2 — one build script.** `enkerli-juce/tools/suite-build`, wraps
  `validate.sh` for macOS, has its own Linux path. Not run-verified on a
  real Linux box.
- **Item 4 — MIDIcurator variants × GloriArp.** `clipFamily`/
  `learnStyleModelFromFamily`/`generateDensityFamily` in
  `gloriarp-clip.ts`; click-tested in a real browser via Playwright (which
  is how a real "1 clips" grammar bug got caught and fixed).
- **Item 5 — continuous morphing accompaniment.** All four named
  dimensions now real: `morphNotes`/`morphPocket`/`morphRests` (independent
  per-pass re-roll) and `morphAccents`/`slide`+`glideMs` (accent wandering;
  legato→portamento promotion). Vane's `glide-time` param turned out to
  already auto-glide on connected note-changes — the whole slide feature
  was "post a nonzero value," not new DSP. Full writeup:
  `docs/GLORIARP_NEXT.md` §3e/§3f.
- **Item 8 — PitchFold audit + follow-through.** Full audit in
  `docs/PITCHFOLD_AUDIT.md`; the cheap findings got fixed same-day (see
  matrix below), `@enkerli/voice-routing` was extracted and adopted in
  four places, two new Workspace modules shipped. Mono Merge and a
  standalone Time-engine port stayed roadmapped — both need genuinely new
  logic, not a port (detailed sizing in the audit doc's "Follow-up"
  section).
- **Item 9 — Serpe concentric circles.** `createPolyCircleView` in
  `engine/render.js`, a Rows/Circle toggle in `PolyLanesPanel`. v1 shipped
  cycle-lock-only with a 4-color rotation; v2 (same day, on review) fixed
  a real contrast bug and dropped an unnecessary restriction — both below.

Items 1 (centralize checkouts), 3 (naming), 6 (shared library), 7
(Exquisite Fingerings plugin) are untouched — 1 is Alex's own machine's
filesystem move, 3 needs Alex's call, 6/7 weren't requested this round.

## Feature availability matrix

| Feature | Webapp | JUCE plugin | CLI | MIDIcurator | Workspace |
|---|---|---|---|---|---|
| GloriArp morph: notes/pocket/rests | — | — | ✅ `--morph-notes/-pocket/-rests` | ✅ data layer, no UI | ✅ via blanket `morph` knob only (aliases all three, not independently controllable) |
| GloriArp morph: accents/slide | — | — | ✅ `--morph-accents/--slide/--glide-ms` | ✅ data layer, no UI | ⚠️ wiring is live (`glideMs` threads to the note stream) but **no knob ever sets it** — dormant, not broken |
| Voice Split (`@enkerli/voice-routing`) | ✅ PitchFold's own JS engine now imports it (dogfooded, not just extracted) | ✅ has its own C++ implementation (`VoiceProcessor::processSplit`) — can't literally share JS across languages, but it's the same algorithm, parity-confirmed in the original audit | ✅ `msuite voice-split` | — (no voice concept in MIDIcurator) | ✅ `voice-split` module (cross-tab bus, verified live) |
| PCS Pads (learn-from-bus) | — (PitchFold's own pad bank is separate, see below) | — | — (composable via `msuite send --note...`/manual `scale` messages, no dedicated pad command) | — | ✅ new module, broadcasts `scale` — interoperates with PitchFold's own listener today, no changes needed there |
| PitchFold pad-override (selected pad wins over main scale) | ✅ fixed this session (`engine/pads.js`) | ✅ already worked (this was always plugin-only-correct) | n/a | n/a | n/a |
| PitchFold Snap Strength (`quantStrength`) | ✅ fixed — real slider now | ✅ fixed, pushed to `Enkerli/PitchFold` — **not build-verified** (no JUCE/Xcode here) | n/a | n/a | n/a |
| PitchFold Mono Merge | ❌ still theater (UI + param, no engine logic, both engines) | ❌ same | n/a | n/a | n/a |
| PitchFold Swing | ❌ still theater (plugin engine never reads it) | ❌ same | n/a | n/a | n/a |
| PitchFold Time engine (grid/humanize) | ❌ no JS twin exists at all | ✅ real | n/a | n/a | n/a |
| Serpe concentric rings | ✅ | ✅ reaches automatically — the plugin's CMakeLists esbuilds `apps/serpe` directly, no vendoring step | — (no visual surface) | — | — |
| Serpe step lock (polymeter) | ✅ real, now proven with coprime step counts (`engine/poly-clock.js`, 7-vs-11 tests) | ❌ **engine only implements cycle lock** — see Limitations | n/a (poly playback is a UI/scheduling concern, not a CLI concept) | — | — |

**Vane, named explicitly in the original KT item 8 note as a reasonable
Voice Split adopter alongside Workspace, has not adopted it.** Nothing
in `apps/vane` was touched this session. It's a real, still-open gap,
not an oversight in this summary — naming it here so it isn't quietly
dropped.

## Limitations — explicit, per the request that prompted this doc

**1. The Serpe rings' color-contrast bug was real, and it's fixed — but
it shipped once.** v1's per-lane color rotation cycled all 4 suite lane
tokens including `rose`, which IS the accent-amber highlight color
(`--es-dim-pressure`) — a lane on that slot had its accented onsets
rendering in the same color as its unaccented ones, with only the halo
ring left to disambiguate. Fixed same day: the automatic rotation now
uses a 3-color subset that can never collide with the accent token.
2 regression tests lock this in. Worth remembering as a pattern, not
just a one-off: **any new per-lane/per-series color rotation in this
codebase needs to explicitly exclude whatever token means "accented" or
"active" elsewhere**, since the suite's palette reuses `--es-dim-pressure`
for both a lane identity and a state signal.

**2. Polymetric/polyrhythmic patterns: complete in the webapp, absent
in the real plugin.** This is the headline limitation, found while
building the coprime-step-count tests this doc's request specifically
asked for. `apps/serpe/engine/poly-clock.js` (webapp) genuinely
implements both lock modes — proven, not assumed, with tests using 7-vs-11
(coprime, lcm 77) rather than the multiples-of-8 examples every prior
test/screenshot happened to use (which realign so fast they don't prove
anything about drift). But `rhythm_pattern_explorer`'s
`Source/Core/PolyClock.h` — the real plugin's audio-thread scheduler —
implements **only** cycle-lock; its own doc comment says so ("the
field-tested webapp default, ported as-is"), and there is no
`polyLock`/step-lock concept anywhere in that C++ source (grepped the
whole repo, zero hits). The webapp's `setPolyLock` never sends anything
across the JUCE bridge in any runtime — pure local state. Worse: the
Cycle/Step toggle in `PolyLanesPanel` isn't gated by `isHost` the way
`polyLagMs` is, so **it renders and is clickable inside the real plugin,
and does nothing there** — not to the audio, not even to the displayed
playhead (which arrives via a `polyState` bridge event computed by the
same cycle-lock-only engine). Same "looks real, does nothing" pattern
the PitchFold audit found repeatedly, this time in Serpe's own plugin.
Documented in `docs/SERPE_POLY.md` §3b. Not fixed here — porting
`PolyClock.h` to support both modes is real C++ engine work in a
different repo, its own slice.

**3. PitchFold: Mono Merge and Swing are still theater; the Time engine
still doesn't exist in the webapp.** Carried over from the audit,
unchanged by this session's follow-through (which fixed the *cheap*
findings, not these). Sizing and the reasoning for why these specifically
resisted a quick fix are in `docs/PITCHFOLD_AUDIT.md`'s "Follow-up"
section.

**4. ProgGenie does not populate PitchFold's chord pads — checked, and
the answer is a clean no, not a maybe.** Traced the actual message
types: ProgGenie (`apps/progression-studio`) only ever sends
`type: "progression"` (a full chord-progression object) on the bus.
PitchFold's pad system, and the new Workspace PCS Pads module, both only
listen for `type: "scale"` (a single pitch-class set) — and even a heard
`scale` message only updates PitchFold's *main* scale, never a specific
pad (pads are UI-edited only). Different vocabularies, no adapter exists
anywhere in the codebase (grepped for any `progression`→`scale`/`chord`
bridge — none). Not a bug: nothing ever claimed this worked. A real
adapter — "extract the currently-sounding chord from a progression
message and re-broadcast it as `scale`/`chord`" — is a legitimate future
slice, not attempted here.

**5. Concentric circles are exactly as portable as a UI feature can
be — which is to say, not very, and that's fine.** They reach the Serpe
webapp and (confirmed via the plugin's own CMakeLists, which esbuilds
`apps/serpe` directly) the real plugin — both share one bundle, no
vendoring step. They will never reach the CLI (no visual surface to put
them on), MIDIcurator, or the Workspace (neither renders Serpe's own
views). This is the deliberate contrast with Voice Split: one is backend
logic with no UI dependency, so it composes anywhere a `note` message
flows (CLI, Workspace, any engine); the other is presentation code bound
to one app's own canvas. "Which version" is the wrong question for a
view — it only ever had one home.

## Where the "shouldn't be too difficult" instinct held, and where it didn't

Held: wiring an existing, unambiguous engine value through to where it's
already read (PitchFold's pad-override, Snap Strength), promoting an
already-correct algorithm to a shared package (Voice Split — now reused
in 4 places, not just theorized about), removing dead code, fixing stale
comments, and — this round's version of the same instinct — the belief
that step lock's math was probably fine and just needed a better proof
(it was; the coprime tests confirm it cleanly).

Didn't hold, cleanly, twice: PitchFold's Mono Merge and Time engine both
needed genuinely new logic or a new scheduling model, not a port — sized
honestly rather than rushed. And the discovery in this doc: nobody had
actually checked whether the *plugin's* engine supported step lock at
all. It doesn't. That's not a "should have been easy and wasn't" — it's
a gap nobody had looked for yet, closed by looking.
