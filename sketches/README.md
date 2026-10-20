# sketches/

Playable experiments that live **outside** the suite's integration work.

HANDOFF.md says *no new features until integration is robust*. These aren't
features: nothing in `packages/` or `apps/` imports them, nothing in CI builds
or deploys them, and `check-inventory` doesn't count them. Each sketch is one
self-contained file you can open in a browser (iPad Safari included) with no
build step. If a sketch earns its keep, it gets promoted into `apps/` with
the usual ceremony. Until then it's allowed to be scrappy.

| Sketch | What | Status |
|---|---|---|
| [twirl/](twirl/) | DRUW/Playground-ish gesture toy: draw, hear it, it loops on its own clock | v0, playable on iPad |

Parked threads that came up alongside the sketches (deliberately *not*
mixed in) are in [THREADS.md](THREADS.md).
