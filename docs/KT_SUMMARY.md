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
Mono Merge and a standalone Time-engine port for PitchFold. The other
open item — Serpe's real JUCE plugin only ever playing polyrhythm, with
polymeter (step lock) existing in the webapp alone — was found and
closed the same day, once it was named the top priority: both lock modes
are now real in the plugin's own C++ scheduler, not just the webapp's.

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
  `@enkerli/ui/rhythm-views`, a Rows/Circle toggle in `PolyLanesPanel`. v1 shipped
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
| PitchFold Mono Merge | ❌ still theater (UI + param, no engine logic, both engines) | ❌ same | n/a | n/a | ✅ real, but NOT PitchFold's own engine — a separate `mono-merge` Workspace module (`@enkerli/voice-routing`'s `MonoMerge` class, priority note-stealing) delivers the actual value at the bus level instead (2026-07-21, see `docs/PITCHFOLD_AUDIT.md`'s "Reprioritized" note) |
| PitchFold Swing | ❌ still theater (plugin engine never reads it) | ❌ same | n/a | n/a | n/a |
| PitchFold Time engine (grid/humanize) | ❌ no JS twin exists at all | ✅ real | n/a | n/a | n/a |
| Serpe concentric rings | ✅ | ✅ reaches automatically — the plugin's CMakeLists esbuilds `apps/serpe` directly, no vendoring step | — (no visual surface) | — | — |
| Serpe step lock (polymeter) | ✅ real, proven with coprime step counts (`engine/poly-clock.js`, 7-vs-11 tests) | ✅ real now — `computePolyLaneStepPolymeter` + `polyLock` param, same 7-vs-11 conformance proof ported to C++; **not build-verified**, no JUCE/Xcode here — see Limitations | n/a (poly playback is a UI/scheduling concern, not a CLI concept) | — | — |

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

**2. Polymetric/polyrhythmic patterns: was complete in the webapp,
absent in the real plugin — now closed, same day, once named the top
priority.** Found while building the coprime-step-count tests an earlier
pass of this doc's request specifically asked for.
`apps/serpe/engine/poly-clock.js` (webapp) genuinely implements both
lock modes — proven, not assumed, with tests using 7-vs-11 (coprime, lcm
77) rather than the multiples-of-8 examples every prior test/screenshot
happened to use (which realign so fast they don't prove anything about
drift). `rhythm_pattern_explorer`'s `Source/Core/PolyClock.h` — the real
plugin's audio-thread scheduler — used to implement only cycle-lock, with
the Cycle/Step toggle in `PolyLanesPanel` rendering and clickable inside
the real plugin (not gated by `isHost` the way `polyLagMs` is) while
doing nothing there — the PitchFold audit's "looks real, does nothing"
pattern, found again in Serpe's own plugin.

Closed: `PolyClock.h` gained `computePolyLaneStepPolymeter` as a fully
separate function (not a refactor of the existing hand-verified
`computePolyLaneStep` — no JUCE/Xcode toolchain here to re-verify a
refactor against, so additive was the lower-risk move), a new `polyLock`
`AudioParameterChoice` APVTS param, `processPolyLanes()` now branches on
lock mode, and `apps/serpe/main.jsx`'s `setPolyLock` calls
`sendParamActual('polyLock', ...)` when hosted — the toggle now actually
reaches the audio and the displayed playhead in the plugin, not just the
webapp. New coprime-step-count conformance tests (7 vs 11, lcm 77) added
to `PolyConformanceTests.cpp`, mirroring the JS-side proof. **Not
build-verified** — same caveat as every C++ change made in this
environment: no JUCE/Xcode toolchain here, so this needs a real compile
and a DAW pass before it ships. Documented in `docs/SERPE_POLY.md` §3b.

**3. PitchFold: Mono Merge and Swing are still theater; the Time engine
still doesn't exist in the webapp.** Carried over from the audit,
unchanged by this session's follow-through (which fixed the *cheap*
findings, not these). Sizing and the reasoning for why these specifically
resisted a quick fix are in `docs/PITCHFOLD_AUDIT.md`'s "Follow-up"
section. **Update, 2026-07-21**: Mono Merge's actual VALUE (priority
note-stealing) now exists for real, just not inside PitchFold's own two
engines — a Workspace-level `mono-merge` module delivers it at the bus
level instead, per the reprioritization this doc's own item 8 already
flagged as the likelier home. PitchFold's `voiceMode`/`monoSelect`
params are exactly as theater as before; nothing here changes that.
Swing and the Time engine remain fully untouched.

**4. ProgGenie → chord pads: checked, was a clean no, now shipped for the
Workspace pad bank.** Originally traced and reported as a no: ProgGenie
(`apps/progression-studio`) only ever sends `type: "progression"` (a full
chord-progression object); PitchFold's pad system and the new Workspace
PCS Pads module both only listened for `type: "scale"`. Corrected on
review: this isn't "extract the currently-sounding chord" (which would
need transport/playhead tracking, real complexity) — a progression
already IS a sequence of chords, so populating a sequence of pads from
it is direct. `pcsPadsModule` now also listens for `progression`
messages and loads pad 1 = first chord, pad 2 = second, in order,
truncating/leaving the rest untouched as needed — verified live over
the real cross-tab bus. **Still not connected**: PitchFold's own,
separate pad bank (its C++ `ChordPadBank`) has no such listener; this
shipped for the Workspace pad bank only, which is the newer, JS-native,
bus-connected one.

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
