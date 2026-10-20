# Parked threads

Ideas that surfaced next to a sketch and were deliberately kept apart from
it, so they don't blur its brief. Each has enough context to restart cold.

## Augmented audio, after RjDj

*Noted 2026-10-20, alongside Twirl. A separate project; do not merge.*

**What I miss.** RjDj (2008–2013ish): "reactive music" scenes, Pd patches
running on the phone, transforming the microphone and the phone's sensors
into music in real time. Walking down a street and the street becomes the
track. Augmented audio rather than an instrument you play.

**Why it's separate from Twirl.** Twirl is about *gesture as intent*: I do
something, it answers. RjDj is about *environment as input*: the world
does something, the scene answers. Different relationship to agency,
different design questions (consent and privacy of what's being heard,
headphones-only use, walking vs. sitting).

**Where it could connect to the suite.** Pd/PlugData is already a home
(PdLua work). The PCS / PitchFold quantiser is an obvious scene component:
pitch-track the environment, fold it into a pitch-class set.

**Constraints to remember.**
- Mic access in iPad Safari works (`getUserMedia`) but only in a foreground
  tab, with the screen on. A real RjDj successor is a native app (or AUv3
  in AUM with a mic input), so it waits for the Mac.
- A webapp proto is still possible for one scene, headphones on, screen on.

**First question if it's ever picked up.** What's one scene that would make
a 10-minute walk better? Start there, not with a framework.

## Control surface for the Diosynth (and the RND)

*Noted 2026-10-20, as a passing note.*

The recurring fiddly things on the **Diosynth**:
- turning **local control off** (so the windsynth drives external gear
  without also sounding its own engine);
- riding the **feedback level** of a patch's loopy delay.

Same surface could cover the **Cyma Forma RND** (its SysEx is already
documented in rnd-companion `docs/PROTOCOL.md`, with `packages/rnd` as the
TypeScript codec).

**Shape.** A few big touch controls on the iPad, MIDI out from the Linux
box: bridge option 1 or 2 in `twirl/BRIEF.md`. `@enkerli/control`
already models params/commands and CC normalisation, so the surface is
mostly a manifest per device, not new code. The Diosynth's exact CC/NRPN
numbers for local control and delay feedback need to be confirmed against
its manual before anything is built.
