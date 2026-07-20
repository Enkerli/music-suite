# Questions for a design agent — 2026-07-20

*Short and sweet, per Alex. Each one has a reversible placeholder already
shipped — nothing here is blocking, but none of these should be decided
by an engineering pass either.*

1. **Serpe's concentric rings read too close to Lascabettes's Rhythmic
   Circle.** Same idea (nested rings, one per lane/voice, radial step
   dots) close enough that it's worth a distinct visual language rather
   than a coincidence we ship anyway. What differentiates ours — a
   different geometry entirely, or the same bones with a treatment
   (color, tick style, motion) that's clearly Serpe's own?

2. **Given #1, sanity-check the geometry calls already made** (all
   reversible, none tested with a designer): rings nest outer→inner in
   lane order, downbeat anchored at 12 o'clock across all rings, no
   per-ring onset polygon. Keep, or rethink from scratch alongside #1?

3. **MIDIcurator's morph controls shipped as plain range sliders**
   (notes/pocket/rests/accents + a slide toggle). Alex's ask allowed
   sliders *or* knobs — is a slider grid the right call for 4-5
   simultaneous mutation dials, or does this want knob-style widgets
   (more compact, reads as "mixing board" rather than "form")?

4. **PitchFold's Mono Merge/Swing are moving from PitchFold-internal
   theater to a likely Workspace-level module** (a "hold to mono"
   note-router, in the PageFail Cality spirit). Workspace's existing
   modules are utilitarian (bus wiring, pad banks); does a
   performance-feel feature like this need its own visual identity
   there, or does it inherit Workspace's plain module chrome?

5. **MTILT is now the suite's name.** No wordmark, no lockup, no place
   it appears yet beyond this decision. Worth a design pass before it
   shows up in READMEs/app chrome, or is a plain wordmark fine to start?
