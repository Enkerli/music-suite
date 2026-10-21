# sketches/

Playable experiments that live **outside** the suite's integration work.

HANDOFF.md says *no new features until integration is robust*. These aren't
features: nothing in `packages/` or `apps/` imports them, nothing in CI builds
or deploys them, and `check-inventory` doesn't count them. Each sketch is one
self-contained file you can open in a browser (iPad Safari included) with no
build step. If a sketch earns its keep, it gets promoted into `apps/` with
the usual ceremony. Until then it's allowed to be scrappy.

Public Domain (CC0-1.0), like everything else in this repo.

| Sketch | What | Status |
|---|---|---|
| [twirl/](twirl/) | Gesture toy: draw or shake, hear it, it loops on its own clock. Simple → More → Everything: lock to the beat grid, per-loop voices, zones and speeds, sound packs, tunings, toys and scenes shared as codes, MIDI out where available | v5, playable on iPad and phone; heading toward a Workspace module, plugin and standalone ([guide](twirl/GUIDE.md) · [roadmap](twirl/ROADMAP.md) · [testing](twirl/TESTING.md)) |

Parked threads that came up alongside the sketches (deliberately *not*
mixed in) are in [THREADS.md](THREADS.md).
