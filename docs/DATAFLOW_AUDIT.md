# Dataflow audit — observing what actually moves

*Design, 2026-07-30. Supersedes `tools/bridge-audit.mjs` as the authority while
keeping it as a cheap pre-check. Written after a session in which four separate
"the UI is broken" reports were all something else, and grep found none of them.*

## Why not grep

`tools/bridge-audit.mjs` cross-references `emit` against `subscribe` by name. It
earned its keep — it found DrawnQurve's redundant `setDirection` and confirmed
MIDIcurator's unread `state` — but the honest record of building it is:

| | |
|---|---|
| First run | 49 "dropped" events |
| Real | 3 |
| False positives | 46 |
| Blind spots found afterwards | 2 (TypeScript apps unread; `.html`-inline UIs unread) |

Two of those blind spots meant a whole plugin was silently unscanned while the
report looked plausible. And the bug that started it all — `polyState` emitted,
handled, never subscribed — was found by **writing a trace to a file and seeing
correct pushes arrive nowhere**, not by grep.

The pattern held all session. `SceneCompare` settled a migration that reading the
code had twice got wrong. `SceneTrace` disproved a theory I had built two rounds
of work on. The C++-side push log located a missing wire in one run.

**So: names are a hypothesis, traces are evidence.** This tool records what moves.

## What it covers

Four scopes, in the order they hurt:

1. **UI ↔ binary** — the WebView bridge. Where every bug this session lived.
2. **Within the binary** — engine → processor → editor. `SceneManager`'s frozen
   twin and the transform race were both here, and both invisible.
3. **Within the UI** — bridge → state → render. The lane panel drew from the
   wrong source for hours.
4. **Between apps** — Workspace driving Vane, Serpe feeding GloriArp. The
   integration work makes this the next place to be surprised.

## The shape

```
   declared contract          observed trace              verdicts
   apps/<app>/dataflow.json ──┐
                              ├──►  tools/dataflow/audit.mjs  ──► report + exit code
   scratch/dataflow/*.jsonl ──┘
        ▲
        └── probes: C++ side and UI side, both writing the same JSONL
```

### 1. A declared contract, per app

Human-authored, reviewed, and the thing a newcomer reads to learn the app's
plumbing. One entry per channel:

```json
{
  "app": "serpe",
  "channels": [
    { "id": "polyState", "scope": "ui<->binary", "direction": "binary->ui",
      "from": "SerpeEditor::sendPolyState", "to": "juce-bridge.js juceOn",
      "payload": { "active": "bool", "steps": "int[]", "patterns": "string[]" },
      "cadence": "on change, ~30Hz ceiling",
      "expect": "lane rows and playheads follow the engine",
      "userVisible": true }
  ]
}
```

`expect` and `userVisible` are not decoration — they generate the user-testing
sheet (below) from the same source of truth.

### 2. Probes that write one trace format

JSONL, one event per line, appended by both sides to the same file:

```json
{"t":1690000000123,"side":"cpp","scope":"ui<->binary","dir":"out","ch":"polyState","seq":41,"bytes":312,"hash":"a1b2c3","summary":"lane1=10010010 scene 0/2"}
{"t":1690000000125,"side":"ui","scope":"ui<->binary","dir":"in","ch":"polyState","seq":41,"bytes":312,"hash":"a1b2c3"}
```

- `seq` is per-channel and monotonic, assigned by the sender. A gap on the
  receiving side is a **dropped message**, provably.
- `hash` over the payload lets the analyser prove the receiver saw *the same*
  payload — which name-matching can never do.
- `summary` is short and human-readable, for reading the trace directly. It is
  what made the poly-push log immediately legible.
- Cost: the C++ side must not do file I/O on the audio thread. Probes append
  from the message thread only, exactly as `SceneCompare` and `SceneTrace` did,
  with an in-memory ring buffer for anything the audio thread records.

Probes are **opt-in** at runtime (`ENKERLI_DATAFLOW_TRACE=<path>`), so a shipped
plugin has no tracing cost and no behaviour change.

### 3. Verdicts the analyser produces

Each is either **proved by the trace** or **not observed** — never inferred:

| Verdict | Means | Evidence |
|---|---|---|
| `DROPPED` | sender emitted, receiver never saw that `seq` | both sides traced |
| `CORRUPTED` | receiver saw the `seq` with a different `hash` | both sides traced |
| `UNDECLARED` | a channel in the trace that the contract omits | trace only |
| `NEVER_EXERCISED` | declared, and absent from a session that should have used it | contract + trace |
| `REORDERED` | receiver saw `seq` out of order | both sides traced |
| `SILENT` | declared `cadence` says periodic, trace shows a gap | contract + trace |

`NEVER_EXERCISED` is deliberately distinct from `DROPPED`. Conflating "nothing
happened" with "it worked" is the failure mode that hid `polyState` for weeks and
that `SceneCompare` was built specifically to avoid.

### 4. Artifacts, as scratch files

Following the PhysMod render-probe pattern — drive the real thing headlessly,
capture something measurable, analyse it into numbers:

```
scratch/dataflow/
  serpe-2026-07-30T10-15.jsonl     the trace
  serpe-2026-07-30T10-15.report.md the verdicts, readable
  serpe-2026-07-30T10-15.mid       MIDI the run actually produced
  serpe-2026-07-30T10-15.wav       audio, for apps that make it
```

All gitignored. The MIDI/audio matter because a dataflow verdict of "delivered"
is still not proof the *music* is right — `E(3,8)%2|E(3,8)*3/E(3,7)` advanced
correctly for hours while sounding wrong to a person. The artifact is what lets
a claim about behaviour be checked later, by ear or by analysis.

## User testing, from the same contract

Every channel with `userVisible: true` and an `expect` string generates a row.
Deliberately **not** a full protocol — those get abandoned. A flexible sheet:

```markdown
| # | Try this | Expected | Observed | Notes |
|---|---|---|---|---|
| 1 | Type `E(3,8)%2\|E(3,8)*3/E(3,7)`, press Enter a few times | lane 1 alternates 8 steps / growing; lane 2 stays 7 | | |
| 2 | Same, but send MIDI notes instead of Enter | identical behaviour | | |
```

Rules that keep it usable by "diverse people":
- **Expected is written before testing**, from the contract — not after, from
  what happened.
- **Observed is free text.** "Weird flicker bottom left" is a better bug report
  than a forced pass/fail, and it is what actually located two bugs this session
  ("brief glimpses of the other scenes" identified a race; "it stuck to the first
  scene" identified a display source).
- **Any row can be skipped.** A sheet that must be completed gets completed
  carelessly.
- Rows are ordered by what breaks most, not by feature tour order.

## Staging

| Stage | Deliverable | State |
|---|---|---|
| 0 | This design | ✅ |
| 1 | Trace format + schema + analyser + tests | ✅ see `tools/dataflow/` |
| 2 | Serpe contract, and the test sheet generated from it | ✅ |
| 3 | UI-side probe (`@enkerli/dataflow` helper the bridges call) | next |
| 4 | C++-side probe — `DataflowTrace.h`, ring buffer + message-thread flush | ✅ |
| 5 | Headless driver — `serpe_dataflow_probe`, trace + MIDI per session | ✅ |
| 6 | Within-binary and within-UI scopes | after 5 |
| 7 | Between-apps scope (Workspace ↔ Vane) | last, needs 5 |

Stages 1–2, 4 and 5 are built. `serpe_dataflow_probe` instantiates the real
processor, runs scripted sessions offline, and writes a trace plus the MIDI each
one produced — no UI, no host, no audio device, so it runs in a sandbox and in CI.

**Stage 3, the UI-side probe, is not built.** Until it is, `ui<->binary` channels
are `NEVER_EXERCISED` in every report, which is the correct thing for the tool to
say and worth reading twice: those eight lines are not eight passes.

### What the first real runs found

Two things, from the first three sessions:

- **`queuedPatternUpdate` is exercised by mono and never by poly.** Poly sets each
  lane's engine directly on the message thread, so the queue's phase-sync
  discipline applies to mono only. Not known to be wrong — recorded because it was
  invisible until a trace showed the channel unexercised in every poly session.
- **A `DROPPED` that was mine.** The mono session reported 1 of 9 updates lost.
  It was the harness: the last trigger enqueues an update that only the *next*
  `processBlock` consumes, and the probe stopped without one. A DAW keeps calling.
  Two drain blocks removed the finding.

That second one is the tool working exactly as intended, and the discipline it
demands. A verdict is a lead to confirm. The previous tool's problem was not that
it was static — it was that its output read like proof.
