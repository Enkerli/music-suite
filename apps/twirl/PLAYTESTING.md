# Twirl — playtesting plan

*Drafted 2026-10-24, with the roadmap's reassessment. A starting protocol
for a small round of targeted sessions, to adapt in the field. The automated
tests (`test/`) check that Twirl does what we built; these sessions check
whether that is what people experience.*

## What we want to learn

Each question is tied to a roadmap decision it could change.

1. **Does first contact still hold?** With no instructions: how long until
   the first sound, the first loop, the realization that it keeps playing?
   Does anything since the morning (Surprise toasts, chimes, more settings)
   get in the way? → *Rule 1; the starting sheet; the splash.*
2. **Are contacts legible?** Do people notice crossings, bumps, trades? Can
   they say *why* a note happened, or why a loop moved? → *Contacts; Meets'
   six answers; whether Surprise should hand out bump and trade.*
3. **When does it get repetitive, and what do people do then?** Time until
   the first sign of boredom; what they try next (draw more, move loops,
   open settings, leave). → *The evolving patch: is it the answer, and how
   fast should things evolve?*
4. **Do the levels work?** Who finds More and Everything, what they use
   there, what they never touch. → *What stays at Simple; what Surprise and
   Vary default to.*
5. **Does it work on their own devices and in their own ways?** iPad with
   Pencil and Magic Keyboard (full screen, Tab, no Esc key), phones,
   keyboard only, screen reader, Linux with MIDI. → *A11Y.md; the plugin
   path.*
6. **Would they leave it running?** As background, as a practice
   companion, in a classroom. → *The evolving patch; Start over; takes.*

## Who

Five to eight sessions, one or two people from each group, chosen for
contrast rather than for numbers:

| Group | Why them | Look for |
|---|---|---|
| **Newcomers** (no music training; a child with a guardian, if possible) | Rule 1 lives or dies here | Time to first sound and loop; what they think it *is* |
| **Musicians and producers** (DAW, MIDI) | They'll push it, and want it in their setup | Repetition, control, MIDI, the plugin |
| **Educators** (MTILT network) | Classroom use; inclusive teaching | What they'd do with a group; what's a barrier |
| **Assistive-tech users** (keyboard only, VoiceOver, low vision, switch) | The accessibility floor, from the inside | Getting stranded; announcements; contrast |
| **iPad + Pencil** | Pressure, full screen, the hardware Twirl is tuned on | Pull-down, Tab, the missing Esc |

## Session shape (30–40 minutes)

1. **Consent and setup (3 min).** What's recorded, how it's used, that they
   can stop at any time; no personal data goes into share codes. Twirl
   opened fresh (Start over, or a private window), sound on.
2. **Cold open (5 min).** "Here's something to play with." Nothing more.
   Think aloud. The observer notes the time of the first sound, the first
   loop, the first "oh, it keeps going".
3. **Light tasks (10 min),** each phrased as a goal, not as a feature:
   - "Make something that keeps playing."
   - "Make two of them affect each other."
   - "Make it so it doesn't sound the same all the time."
   - "Send what you made to someone."
   Note what they reach for, and every "why did that happen?".
4. **Leave it running (5 min).** "Let it play while we talk." Watch whether
   they intervene, and when.
5. **Debrief (10 min).** What surprised you? What was a mystery? When did it
   start to feel the same? What would you want it to do on its own? Where
   would you use it? For educators: with whom, and how?

## What to collect

- **Screen and audio**, with consent (iPad screen recording; ● Rec in Twirl
  also keeps a take of what they *did*, which replays the session exactly).
- **An observation sheet** per session: timestamps for the moments above,
  quotes, workarounds, every point where they got stuck.
- **A few numbers**, as context rather than scores: seconds to first sound
  and first loop; count of "why?" moments; minutes until the first sign of
  repetition; levels visited.
- **Device and setup**: browser, input (finger, Pencil, keyboard, AT).

## After

- Affinity-map the notes across sessions; look for patterns across groups,
  and for anything one person hit hard (accessibility issues count even once).
- For each question above: what we saw, and what it changes on the roadmap.
  Write that back into [ROADMAP.md](ROADMAP.md) and, for accessibility,
  [A11Y.md](A11Y.md).
- Keep raw recordings out of the repo; keep only anonymized notes and quotes.

## Logistics to settle

- Which build: Pages (`main`) for everyone, so a session never meets an
  unfinished branch.
- Remote or in person: in person for iPad and AT sessions if possible;
  remote (screen share, Twirl on Pages) works for musicians and educators.
- A short participant sheet (what Twirl is, consent, how to reach us),
  bilingual EN/FR.
