#!/usr/bin/env node
/**
 * msuite — the suite's headless CLI (thin argv wrapper over index.ts).
 *
 *   msuite chord 60 64 67 71          identify a chord (MIDI notes)
 *   msuite chord 0 4 7 --pcs          …or bare pitch classes
 *   msuite pattern "E(3,8)"           rhythm codecs (binary/hex/octal/decimal/onsets)
 *   msuite pattern 0x94:8             …tresillo, suite little-endian digits
 *   msuite smf "Dm7 G7 | Cmaj7" -o out.mid [--tonic C] [--mode major] [--bpm 120]
 *   msuite render 60 64 67 -o out.wav [--seconds 2] [--breath 0.9] [--sr 48000]
 *                                      [--param 12=0.8]  (Vane wasm param id=value)
 *   msuite send --to serpe --command mutate --arg amount=0.3   control-plane message → NDJSON
 *   msuite send --to serpe --param density=0.7                 …a param set
 *   msuite … | msuite recv                                    read NDJSON messages from a pipe
 *   msuite describe <manifest.json>                            validate + print a tool's surface
 *
 * Everything runs from the repo with no GUI, no DAW, no plugin host — render
 * goes through the SAME vane-dsp.wasm the browser standalone plays; send/recv
 * carry the @enkerli/protocol message model over an ordinary Unix pipe
 * (docs/CONTROL_PLANE.md — the headless half of the control & interop plane).
 */
import { readFileSync, writeFileSync, createWriteStream, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import {
  chordInfo, patternInfo, upiInfo, isPolyUpi, polyUpiInfo, generateInfo, smfFromBars, renderVane,
  accompany, learnStyle, noteNameToMidi, notesFromPhrase, performPhrase, startBridge,
  listMidiPorts, resolveMidiPort, createMidiPlayer,
  sendMessage, toNdjson, parseNdjson, summarizeMessage, describeManifest,
  bundledManifestPath, MANIFEST_APPS, paramsFromStream, vaneParamIdMap,
  resolveEvent, validateControlMap, manifestsForControlMap, applyVoiceSplit,
  type SendOptions, type ControlMap, type InputEvent,
} from "./index.js";
import { VoiceSplitter } from "@enkerli/voice-routing";
import { parsePolyUPI, identify, longShort, durations, dynamicDurations, parseNamedPatterns, describeNamedPattern, parseLongShortSuffix, parseUPI, microtiming, timingScales, parseProgressive, progressiveAt, interOnsetSteps } from "@enkerli/upi";
import { createSMF } from "@enkerli/midi";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const PKG_VERSION: string = (() => {
  try { return createRequire(import.meta.url)("../package.json").version ?? "0.0.0"; }
  catch { return "0.0.0"; }
})();
import { wrapPattern } from "@enkerli/library";
import type { TraceLevel } from "@enkerli/accompaniment";
import { GATES } from "@enkerli/accompaniment";
import { renderHits, wavMono16, resolveDrum, drumForLabel, KIT } from "@enkerli/drumsynth";
import type { AppId, Destination, ParamMode } from "@enkerli/protocol";

const USAGE = `msuite <command> …\n  --version                      which build, and which checkout it runs from
  chord <values…> [--pcs|--notes]
  pattern <spec>                        E(3,8) · 0x94:8 · o111:8 · d73:8 · 10010010
                                        PD(20%) = push/pull microtiming (timing);
                                        LS(3) / LS(1.4..1.8, 70%) = note length
          --import <file|-> [--json]    named patterns → library items
  upi "<notation>" [--steps N] [--midi out.mid | --wav out.wav [--bpm N] [--bars N] [--note N] [--lock cycle|step]
                                        [--gate 0..1+|staccato|tenuto|legato]]
                                        --gate is how much of its step a note sounds (default 0.5,
                                        detached); >1 overlaps into the next — legato/melisma
                                        --wav renders through the synthesised kit (@enkerli/drumsynth):
                                        notes map to drums by GM number, note length drives the decay,
                                        so LS(4){1000} really does ring one hat in four
                                        the full Serpe UPI language: P(3,0)+P(5,0), E(3,8);12, {100}E(3,8), Morse…
                                        additive/aksak meters: A(2,2,2,3) or D:2,3 ...-
                                        (both = short-short-short-long, the Balkan 9/8)
                                        POLY lanes (docs/SERPE_POLY.md): "kick=E(4,16) / snare=E(2,4)@+12ms"
                                        / separates lanes; @±Nms or @±1/32 is per-lane micro-timing (Keil)
  generate [--mode major|minor] [--length N] [--seed N] [--method markov|markov-cadence|circle] [--tonic C] [-o out.mid] [--bars-only]
                                        a progression from the corpus statistics → Roman bars (or realized SMF with -o)
                                        piped (or --bars-only): bare bar notation, ready for | msuite accompany
  smf "<bars>" -o <file.mid> [--tonic C] [--mode major|minor] [--bpm N] [--beats-per-chord N]
  style learn <files-or-dir…> --chord <sym> --id <name> -o model.json [--role bass] [--grid 4]
                                        learn a STYLE MODEL from your own MIDI clips, all played
                                        against one chord: per-slot onset/velocity/duration/
                                        micro-timing distributions + note vocabulary. Statistics
                                        only — the clips never leave your machine. The model then
                                        feeds accompany --source; every --pass is a fresh take
  accompany [--progression "<bars>"] [-o bass.mid] [--role bass] [--bars N]
            [--source walking-bass|funk-ghost|bossa|two-feel|phrase.json] [--rhythm "<UPI>"] [--seed N]
            [--gate staccato|tenuto|legato|mixed|0..1+] [--dynamics 0..1] [--rests 0..1] [--anticipation 0..1]
            [--variety 0..1] [--pocket 0..1] [--morph 0..1] [--morph-notes 0..1] [--morph-pocket 0..1]
            [--morph-rests 0..1] [--inflect 0..1] [--morph-accents 0..1] [--slide 0..1] [--glide-ms N] [--pass N]
            [--range C2:C4] [--chromaticism 0..1] [--rhythm-preservation 0..1] [--tonic C] [--mode major|minor]
            [--bpm N] [--trace trace.json] [--phrase-out phrase.json] [--explain]
            [--play [--to app|*] [--loop | --loop-count N] [--midi-out port [--channel N] [--breath-cc N|off]]]
                                        GloriArp slice 1: adapt a curated bass phrase across a progression
                                        (deterministic by seed; trace explains every note); no --progression
                                        reads bar notation from stdin (msuite generate | msuite accompany);
                                        --play streams real-time note messages (NDJSON) — | msuite recv;
                                        --loop repeats until Ctrl-C (a continuous groove); --loop-count N
                                        repeats N times; --midi-out performs as REAL MIDI (ALSA rawmidi —
                                        a port name substring, "virtual" for snd-virmidi, or a /dev path);
                                        --rhythm performs the source's pitch material on a UPI grid
                                        (E(3,8) under a bass = instant tresillo; accents {100}E(3,8) boost);
                                        --source picks a bundled style or your own extracted phrase;
                                        --gate shapes note lengths, --dynamics follows the metric contour,
                                        --rests drops weak beats (never downbeats), --anticipation pushes
                                        downbeats half a beat early — all seeded, all in the trace;
                                        --variety adds passing tones / octave pops / chord-tone reselection,
                                        --pocket adds correlated push-pull micro-timing (the Keil walk),
                                        --gate mixed articulates per note (legato into steps, detached repeats),
                                        --pass N renders loop-pass N, --morph 0..1 re-rolls that much per pass
                                        (continuous mutation, Troublemaker/Rozeta-style: --morph-notes,
                                        --morph-pocket, --morph-rests re-roll variety/timing/skip-step
                                        INDEPENDENTLY — hold the rhythm steady while notes wander, or the
                                        reverse; --morph sets all three at once when given alone);
                                        --inflect gives EVERY note its own wind articulation + breath envelope
                                        (sforzando, staccato, legato slurs, marcato…) — CC2 curves in the .mid,
                                        live breath curves over --midi-out, per-note envelopes into Vane;
                                        --morph-accents re-rolls inflect's own discretionary choices per pass
                                        (sforzando/marcato, staccato/tenuto, AND slide promotion — needs
                                        --inflect); --slide 0..1 promotes that fraction of eligible legato
                                        transitions to an audible portamento glide (--glide-ms sets the time,
                                        default 120) — standard MIDI CC5/CC65 in the .mid and live, Vane
                                        glides natively via its own legato detection once glide-time > 0
  render <notes…> -o <file.wav> [--seconds N] [--breath 0..1] [--sr N] [--param id=value]… [--stream]
                                        --stream: apply a control-plane param NDJSON stream from stdin (message → sound)
  send [--from app] [--to app|*] (--param id=value… [--mode …] | --command name [--arg k=v]… | --note 60,64,67 [--velocity V] [--duration ms] [--gate on|off])
  voice-split [--base-channel N] [--span N] [--to app|*]
                                        NDJSON pipe filter: round-robins each note message across
                                        base-channel..base-channel+span-1 (default 1..4) — @enkerli/voice-routing,
                                        the same primitive PitchFold's Voice Split mode and the Workspace
                                        voice-split module use. Non-note messages pass through unchanged.
                                        '… --play | msuite voice-split --span 4 | msuite play --midi-out virtual'
  play (--midi-out port [--channel N] [--breath-cc N|off] | --list)
                                        NDJSON note stream from stdin → REAL MIDI out (Linux ALSA rawmidi):
                                        '… --play | msuite play --midi-out virtual', then aconnect the
                                        VirMIDI port into jalv (Vane LV2) / fluidsynth / hardware — the
                                        Plug & Jam path (docs/JAM.md). --list enumerates ports; breath
                                        (CC2 = velocity) precedes notes for Vane's wind-model envelope
  recv                                  read NDJSON SuiteMessages from stdin, validate + summarize
  bridge [--port 8765]                  FULL DUPLEX stdin ↔ browsers: stdin's NDJSON → SSE (localhost);
                                        POST /send (a browser's own actions, curl, Shortcuts) → this
                                        process's STDOUT — so 'msuite A | msuite bridge | msuite B' runs
                                        both directions live. workspace Bridge module is the browser side
  describe <app|manifest.json>          print a tool's parameter/command surface (app id e.g. vane, or a manifest file)
  bind <control-map.json> (--cc N=V [--channel C] | --note N [--velocity V] [--channel C] | --key "combo" | --validate)
                                        resolve an input through a control-map → the param/command message(s) (NDJSON)`;

interface Args { positional: string[]; flags: Map<string, string[]> }

function parseArgs(argv: string[]): Args {
  const positional: string[] = [];
  const flags = new Map<string, string[]>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith("--")) {
      const name = a.slice(2);
      const boolean = ["pcs", "notes", "help", "stream", "validate", "explain", "play", "bars-only", "loop", "list", "json"].includes(name);
      const value = boolean ? "true" : argv[++i];
      if (value === undefined) throw new Error(`--${name} needs a value`);
      if (!flags.has(name)) flags.set(name, []);
      flags.get(name)!.push(value);
    } else if (a === "-o") {
      const value = argv[++i];
      if (value === undefined) throw new Error("-o needs a file path");
      flags.set("out", [value]);
    } else {
      positional.push(a);
    }
  }
  return { positional, flags };
}

const one = (a: Args, n: string): string | undefined => a.flags.get(n)?.[0];

/** Read all of stdin. Async (not readFileSync(0)): a pipe from a slow writer
 *  is non-blocking and readFileSync can throw EAGAIN before data arrives. */
async function readStdin(): Promise<string> {
  let text = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) text += chunk;
  return text;
}

/**
 * Open a MIDI player from --midi-out / --channel / --breath-cc flags, or null
 * when --midi-out is absent. `finish()` drains scheduled note-offs (briefly),
 * silences anything still sounding (an external synth REMEMBERS hanging
 * notes), and closes the device.
 */
function openMidiFromFlags(args: Args, log: (s: string) => void): { player: ReturnType<typeof createMidiPlayer>; finish: () => Promise<void> } | null {
  const spec = one(args, "midi-out");
  if (spec === undefined) return null;
  const path = resolveMidiPort(spec);
  const stream = createWriteStream(path);
  const breathRaw = one(args, "breath-cc");
  const player = createMidiPlayer({
    write: (bytes) => { stream.write(Buffer.from(bytes)); },
    ...(one(args, "channel") !== undefined && { channel: Number(one(args, "channel")) }),
    ...(breathRaw !== undefined && { breathCc: breathRaw === "off" ? null : Number(breathRaw) }),
  });
  log(`midi-out: ${path}`);
  const finish = async () => {
    // Give self-releasing note-offs a moment to fire on their own schedule…
    for (let i = 0; i < 20 && player.activeCount() > 0; i++) await new Promise((res) => setTimeout(res, 100));
    // …then silence whatever remains, unconditionally.
    player.allOff();
    await new Promise<void>((res) => stream.end(() => res()));
  };
  process.once("exit", () => player.allOff());
  return { player, finish };
}

/**
 * Which msuite is this, and where is it running from?
 *
 * The last question is the one that matters in practice. On 2026-07-27 a global
 * `msuite` link pointed at a stale second checkout and reported a pattern as
 * unrecognised that the current tree parsed fine; the only way to find out was
 * `readlink -f $(which msuite)`. The plugins gained build stamps for the same
 * reason — knowing WHICH build you are running should not require detective work.
 */
function versionReport(): string {
  const here = fileURLToPath(new URL(".", import.meta.url));
  const lines = [`@enkerli/cli ${PKG_VERSION}`, `running from  ${here}`];
  // Commit and working-tree state, when this is a git checkout rather than an
  // installed copy. Best-effort: a tarball install has no git, and that is fine.
  try {
    const opts = { cwd: here, encoding: "utf8" as const,
                   stdio: ["ignore", "pipe", "ignore"] as ("ignore" | "pipe")[] };
    const sha = execFileSync("git", ["rev-parse", "--short", "HEAD"], opts).trim();
    const dirty = execFileSync("git", ["status", "--porcelain"], opts).trim().length > 0;
    const when = execFileSync("git", ["log", "-1", "--format=%cd", "--date=format:%Y-%m-%d %H:%M"], opts).trim();
    lines.push(`commit        ${sha}${dirty ? " (dirty)" : ""}  ${when}`);
  } catch {
    lines.push("commit        unknown (not a git checkout)");
  }
  lines.push(`node          ${process.version}`);
  return lines.join("\n");
}

async function main(): Promise<number> {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd || cmd === "--help" || cmd === "help") { console.log(USAGE); return 0; }
  if (cmd === "--version" || cmd === "-v" || cmd === "version") { console.log(versionReport()); return 0; }
  const args = parseArgs(rest);
  if (args.flags.has("help")) { console.log(USAGE); return 0; }

  switch (cmd) {
    case "chord": {
      const values = args.positional.map(Number);
      if (!values.length || values.some(Number.isNaN))
        throw new Error("chord: numeric MIDI notes (or pcs) required");
      const info = chordInfo(values, { asNotes: args.flags.has("notes") });
      if (!info.match) { console.log(`no match (${info.interpretation})`); return 1; }
      const m = info.match;
      console.log(`${m.symbol}   (${info.interpretation})`);
      console.log(`root ${m.rootName} (pc ${m.root}) · quality ${String((m.quality as { key?: string }).key ?? m.quality)}`);
      console.log(`observed pcs [${m.observedPcs.join(" ")}]` +
        (m.extras.length ? ` · extras [${m.extras.join(" ")}]` : ""));
      return 0;
    }
    case "pattern": {
      // --import: a named-pattern block (file, or "-" for stdin) becomes
      // library items. One line per pattern: "Fume-Fume: [0,2,4,7,9]/12".
      const importFrom = one(args, "import");
      if (importFrom !== undefined) {
        const text = importFrom === "-" ? readFileSync(0, "utf8") : readFileSync(String(importFrom), "utf8");
        const { patterns, errors } = parseNamedPatterns(text);
        for (const e of errors) console.error(`line ${e.line}: ${e.error}`);
        const asJson = args.flags.has("json");
        for (const p of patterns) {
          const d = describeNamedPattern(p);
          if (asJson) { console.log(JSON.stringify(wrapPattern(d))); continue; }
          const bits = [d.name.padEnd(16), d.binary.padEnd(17), `${d.onsetCount}/${d.stepCount}`.padStart(6)];
          if (d.reading) bits.push(` ${d.reading}`);
          if (d.foot && d.foot !== "none") bits.push(` · ${d.longShort} (${d.foot})`);
          console.log(bits.join(" "));
        }
        console.error(`\n${patterns.length} pattern(s)${errors.length ? `, ${errors.length} error(s)` : ""}` +
          (asJson ? "" : " — add --json for library items"));
        return errors.length ? 1 : 0;
      }
      const rawSpec = args.positional.join(" ");
      // An LS(…) suffix states the durational layer in the notation itself.
      const { rest: spec, longShort: lsSpec } = parseLongShortSuffix(rawSpec);
      const p = patternInfo(spec);
      console.log(`steps   ${p.steps}`);
      console.log(`binary  ${p.binary}`);
      console.log(`hex     0x${p.hex}:${p.steps}`);
      console.log(`octal   o${p.octal}:${p.steps}`);
      console.log(`decimal d${p.decimal}:${p.steps}`);
      console.log(`onsets  [${p.onsets.join(" ")}] (${p.onsetCount})`);
      const steps = [...p.binary].map((c) => c === "1");
      const id = identify(steps);
      if (id.euclidean) console.log(`euclid  ${id.euclidean.formula}`);
      if (id.barlow) console.log(`barlow  ${id.barlow.formula}`);
      const others = id.readings.filter((r: { terms: string[] }) => r.terms.length > 1).slice(0, 3);
      if (others.length) console.log(`decomp  ${others.map((r: { formula: string }) => r.formula).join("  ·  ")}`);
      else if (!id.euclidean && !id.barlow) console.log(`decomp  (no exact Euclidean/Barlow reading)`);
      const ls = longShort(steps);
      if (ls.intervals.length) {
        console.log(`ioi     [${ls.intervals.join(" ")}]  ${ls.pattern}  ${ls.morse}`);
        if (lsSpec) {
          const d = dynamicDurations(steps, { ratio: [lsSpec.min, lsSpec.max], depth: lsSpec.depth, seed: 1 });
          const how = lsSpec.max > lsSpec.min
            ? `${lsSpec.min}–${lsSpec.max} at ${Math.round(lsSpec.depth * 100)}% push/pull`
            : `fixed ${lsSpec.min}:1`;
          console.log(`durate  ${how}  →  [${d.map((x) => x.toFixed(2)).join(" ")}]`);
        } else {
          console.log(`durate  ${ls.description}${ls.isochronous ? "" : `  →  [${durations(steps).join(" ")}]`}`);
        }
      }
      return 0;
    }
    case "upi": {
      const notation = args.positional.join(" ");
      if (!notation) throw new Error('upi: a UPI notation is required, e.g. "E(3,8)" or "kick=E(4,16) / snare=E(2,4)@+12ms"');
      const nSteps = one(args, "steps") !== undefined ? Number(one(args, "steps")) : 16;

      // --midi: render the pattern to an SMF, APPLYING any PD(…) microtiming,
      // so push/pull can be checked against real note ticks instead of by ear.
      const midiOut = one(args, "midi");
      // --wav renders the SAME notes through the synthesised kit. Sharing the
      // whole note-building path is the point: lane lock, accent precession and
      // LS(…) get decided once, so a .wav and a .mid of the same notation
      // cannot disagree. A second sequencer in the drum package would have been
      // a second set of opinions about all three.
      const wavOut = one(args, "wav");
      if (midiOut !== undefined || wavOut !== undefined) {
        // Poly-aware since 2026-08-01. This used parseUPI, so it rendered MONO
        // ONLY — no lanes, no per-lane accents, and `E(3,8)|E(5,8)` was refused
        // outright. That mattered more than it looked: this file is meant to be
        // the reference a DAW capture gets compared against, and a reference
        // that cannot express poly cannot speak to the lane clock, per-lane
        // offsets, or accents, which is where the timing questions actually are.
        //
        // parsePolyUPI handles the one-lane case identically, so mono callers
        // see no change.
        const poly = parsePolyUPI(notation, { n: nSteps });
        if (!poly.ok) { console.error(`no pattern (${poly.error ?? "unparsed"})`); return 1; }
        const bpm = one(args, "bpm") !== undefined ? Number(one(args, "bpm")) : 120;
        const bars = one(args, "bars") !== undefined ? Number(one(args, "bars")) : 2;
        const note = one(args, "note") !== undefined ? Number(one(args, "note")) : 36;
        const tpb = 480;
        const stepTicks = tpb / 4;               // one step = a 16th

        // LANE ALIGNMENT, matching the plugin's `Poly Lock` parameter:
        //
        //   cycle (default)  every lane spans the SAME cycle — polyrhythm. A
        //                    7-step lane and an 8-step lane both take one
        //                    cycle, so the 7-step lane's steps are longer.
        //   step             every lane's step is the same length — polymeter.
        //                    Lanes of different lengths drift and realign at
        //                    their lcm.
        //
        // The default matches the PLUGIN's default deliberately. This renderer
        // was step-only until 2026-08-02, which meant a capture taken with the
        // plugin's own default could never match the file it was compared
        // against — the baseline and the thing under test disagreed by
        // construction, which is the least useful kind of test.
        const lockArg = one(args, "lock") ?? "cycle";
        if (lockArg !== "cycle" && lockArg !== "step") {
          console.error(`upi --lock: expected "cycle" or "step", got "${lockArg}"`);
          return 1;
        }
        const cycleLock = lockArg === "cycle";

        // --gate: how much of its step each note actually sounds. Until
        // 2026-08-02 this was hardcoded to 0.5, so every file this renderer
        // produced was detached and there was no way to write a LEGATO one —
        // which made it useless for the articulation half of what a wind
        // instrument does. Vane's synthetic breath, its mono bore handoff and
        // its melisma all hinge on whether one note is still sounding when the
        // next begins, and none of it could be driven from a file.
        //
        // Named values come from @enkerli/accompaniment's GATES, not a second
        // copy — `accompany --gate legato` and `upi --gate legato` must mean the
        // same thing. Above 1.0 the notes OVERLAP, which is the unambiguous
        // legato: at exactly 1.0 the note-off and the next note-on land on the
        // same tick and a host is free to order them either way.
        const gateArg = one(args, "gate") ?? "0.5";
        const gateReq = gateArg in GATES ? GATES[gateArg as keyof typeof GATES] : Number(gateArg);
        if (!Number.isFinite(gateReq) || gateReq <= 0) {
          console.error(`upi --gate: expected a positive number or one of ${Object.keys(GATES).join("|")}, got "${gateArg}"`);
          return 1;
        }
        // Clamped at 1.0 HERE, unlike `accompany --gate`, and the difference is
        // not an oversight: this renderer puts a whole lane on ONE note number.
        // Overlapping two instances of the same pitch is not something MIDI can
        // express — the first note's note-off silences the second — so a gate
        // above 1.0 does not produce a longer note, it produces a hole. Caught
        // by playing the file through Vane and hearing the gap, not by reading
        // the ticks, which looked entirely reasonable.
        //
        // Overlap IS meaningful for melodic material, where consecutive notes
        // differ in pitch. That is `msuite accompany --gate 1.3`.
        const gate = Math.min(gateReq, 1.0);
        if (gateReq > 1.0)
          console.error(`upi --gate ${gateArg}: clamped to 1.0 — a lane is one note number, and`
            + ` overlapping the same pitch cuts the note short instead of slurring it.`
            + ` For overlapping legato use a melodic source (msuite accompany --gate ${gateArg}).`);
        // Under cycle lock every lane shares one cycle, lengthed by the FIRST
        // lane — which is what the engine does (refSteps = lane 1's length).
        const cycleSteps = poly.lanes[0]?.steps.length || nSteps;
        const cycleTicks = cycleSteps * stepTicks;
        const notes: Array<{ pitch: number; velocity: number; startTick: number; durationTicks: number }> = [];
        const laneLines: string[] = [];

        // A lane LABELLED with a drum name gets that drum's GM note, instead of
        // the positional base+index. `kick=E(4,16) / hat=E(8,16)` already reads
        // like a drum pattern; making someone also state note numbers for it
        // would be busywork, and getting Kick/Crash/Snare out of lanes called
        // kick/snare/hat is just wrong. Applies to --midi as well as --wav, so
        // the two cannot disagree — and a .mid with real GM numbers is what any
        // DAW drum instrument expects anyway.
        const laneNote = (lane: { label?: string }, li: number) => {
          const d = drumForLabel(lane.label ?? "");
          return d ? KIT[d]!.note : note + li;
        };
        // Is this lane a DRUM? It changes what an accent means.
        //
        // An accent is normally louder AND transposed +5, matching the plugin's
        // accentPitchOffset. On a drum kit that is wrong in a way that destroys
        // the take: the note IS the instrument, so an accented ride (59) became
        // 64 and resolved to nothing — silently dropped — and an accented snare
        // (38) became 43 and played as a FLOOR TOM. Found by generating a
        // pattern from a learned style and reading the render log.
        //
        // Applies to --midi as much as --wav: a drum .mid with transposed
        // accents is wrong in any DAW, not just here. Unlabelled lanes are
        // unaffected, so the timing baseline does not move.
        const laneIsDrum = (lane: { label?: string }) => drumForLabel(lane.label ?? "") !== null;
        poly.lanes.forEach((lane, li) => {
          const stepsArr = lane.steps.map(Boolean);
          if (!stepsArr.length) return;
          const L = lane as unknown as { accents?: number[] | null; microtiming?: { depth: number; seed?: number } | null };
          const acc = L.accents ?? null;
          const pd = L.microtiming ?? null;

          // Per-lane offset, exactly as the notation spells it: `@+20ms` or a
          // beat fraction. Applied as a tick shift on every onset in the lane.
          let offTicks = 0;
          if (lane.offset != null) {
            offTicks = lane.offset.kind === "ms"
              ? Math.round((lane.offset.ms / 1000) * (bpm / 60) * tpb)
              : Math.round((lane.offset.num / lane.offset.den) * tpb);
          }

          // This lane's own step length. Under cycle lock it is the shared
          // cycle divided by THIS lane's step count; under step lock every lane
          // uses the same 16th. Kept fractional — positions round once at the
          // note rather than accumulating a rounding error every step.
          const laneStepTicks = cycleLock ? cycleTicks / stepsArr.length : stepTicks;

          // LS(…) — the DURATIONAL layer, finally reaching the renderer.
          //
          // It parsed and computed here all along (`msuite pattern "E(3,8)LS(2)"`
          // prints `durate fixed 2:1 → [2 2 1]`) and this renderer dropped it
          // silently: no error, no long notes. Accepted-looking and inert, which
          // is the dead-end the suite's own rule calls a bug.
          //
          // How it combines with --gate. LS says how much longer a LONG note is
          // than a SHORT one; --gate says how much of the available time the
          // notes take overall. So LS redistributes and gate scales, and they
          // stay independent: the LS durations are normalised to the same total
          // the plain inter-onset spans would have had, then gate scales that
          // total. `--gate legato` still means "the line is connected" whatever
          // LS is doing, and LS(1) flattens an uneven rhythm to equal note
          // lengths without also making it quieter or shorter.
          const lsSpec = (lane as unknown as {
            longShort?: { min: number; max: number; depth: number; longMask?: number[] } | null;
          }).longShort;
          let lsScale: number[] | null = null;
          if (lsSpec) {
            const spans = stepsArr.map((_, i) => (stepsArr[i] ? interOnsetSteps(stepsArr, i) : 0));
            const onsetCount = stepsArr.filter(Boolean).length;
            // `LS(r){mask}` states WHICH onsets are long, for the even-grid case
            // where the pattern's own intervals cannot say. Indexed over onsets
            // and cycling, so `{10}` alternates however many hits there are.
            const rel = lsSpec.depth > 0 || lsSpec.max > lsSpec.min
              ? dynamicDurations(stepsArr, { ratio: [lsSpec.min, lsSpec.max], depth: lsSpec.depth })
              : durations(stepsArr, { ratio: lsSpec.min });
            const onsetIdx = stepsArr.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
            const totalSpan = spans.reduce((a, b) => a + b, 0);
            const totalRel = rel.reduce((a, b) => a + b, 0);
            if (totalRel > 0 && rel.length === onsetIdx.length) {
              lsScale = stepsArr.map(() => 0);
              onsetIdx.forEach((si, k) => { lsScale![si] = (rel[k]! * totalSpan) / totalRel; });
            }
          }
          // The mask form is resolved per CYCLE, below, because it precesses.
          const lsMask = lsSpec?.longMask ?? null;
          const onsetsPerCycle = stepsArr.filter(Boolean).length;
          const spanTotal = stepsArr.reduce((a, _v, i) => a + (stepsArr[i] ? interOnsetSteps(stepsArr, i) : 0), 0);
          /** Sum of the relative lengths for the cycle containing this ordinal. */
          const maskCycleTotal = (ord: number) => {
            if (!lsMask || !onsetsPerCycle) return 1;
            const first = Math.floor(ord / onsetsPerCycle) * onsetsPerCycle;
            let t = 0;
            for (let k = 0; k < onsetsPerCycle; k++)
              t += lsMask[(first + k) % lsMask.length] ? lsSpec!.min : 1;
            return t || 1;
          };

          // Onset ordinal ACROSS cycles, so both masks precess.
          //
          // `{10}` over a 5-onset cycle does not divide evenly, so cycle 2 must
          // start at onset 5 — mask bit 1, not bit 0. The C++ engine has always
          // done this (upi.js: "the onset counter keeps going, so accents
          // precess"); this renderer restarted the count every cycle, so a
          // capture of `{10}E(5,8)` could never match the baseline it is
          // supposed to be compared against. Found 2026-08-02 while checking
          // that the durational mask matched the accent mask — it did, and both
          // were wrong here in the same way.
          let onsetOrdinal = 0;
          let cursor = 0;
          for (let cycle = 0; cycle < bars; cycle++) {
            const scales = pd && pd.depth > 0
              ? timingScales(microtiming(stepsArr, { depth: pd.depth, ...(pd.seed !== undefined && { seed: pd.seed }), pass: cycle }))
              : stepsArr.map(() => 1);
            for (let i = 0; i < stepsArr.length; i++) {
              if (stepsArr[i]) {
                // An accent is LOUDER AND TRANSPOSED, matching the plugin
                // (accentVelocity / accentPitchOffset, +5 by default). A file
                // that only raised velocity would not match a capture.
                const accPat = (lane as unknown as { accentPattern?: number[] | null }).accentPattern;
                const accented = accPat && accPat.length
                  ? !!accPat[onsetOrdinal % accPat.length]
                  : !!(acc && acc[i]);
                const isLong = lsMask ? !!lsMask[onsetOrdinal % lsMask.length] : false;
                onsetOrdinal++;
                notes.push({
                  pitch: laneNote(lane, li) + (accented && !laneIsDrum(lane) ? 5 : 0),
                  velocity: accented ? 127 : 100,
                  startTick: Math.max(0, Math.round(cursor) + offTicks),
                  // Measured against the span to the NEXT onset, not the grid
                  // step — that span is what the note actually owns, and it is
                  // the same interOnsetSteps Serpe's duration arcs draw. Gating
                  // the step instead left `--gate legato` with a silent gap on
                  // any pattern whose onsets are not adjacent (E(4,8) is two
                  // steps apart, so "legato" sounded for half the distance).
                  // The mask form scales this onset directly: a long is
                  // `min` times a short, normalised so a cycle still fills the
                  // same total the plain spans would have.
                  durationTicks: Math.max(10, Math.round(laneStepTicks * gate * (
                    lsMask
                      ? (isLong ? lsSpec!.min : 1) * (spanTotal / maskCycleTotal(onsetOrdinal - 1))
                      : lsScale ? lsScale[i]! : interOnsetSteps(stepsArr, i)))),
                });
              }
              cursor += laneStepTicks * (scales[i] ?? 1);
            }
          }
          const accN = acc ? acc.filter(Boolean).length : 0;
          const drumName = resolveDrum(laneNote(lane, li));
          laneLines.push(`${(poly.lanes.length > 1 ? lane.label : "pattern").padEnd(8)} note ${laneNote(lane, li)}`
            + (wavOut !== undefined ? ` (${drumName ? (KIT[drumName]?.label ?? drumName) : "no kit sound"})` : "")
            + `  ${stepsArr.length} steps` + (accN ? (laneIsDrum(lane) ? `  ${accN} accented (louder; a drum keeps its note)` : `  ${accN} accented (→ note ${laneNote(lane, li) + 5})`) : "")
            + (offTicks ? `  offset ${offTicks > 0 ? "+" : ""}${offTicks} ticks` : "")
            + (pd && pd.depth > 0 ? `  PD ${Math.round(pd.depth * 100)}%` : "")
            + (lsSpec ? `  LS ${lsSpec.min === lsSpec.max ? `${lsSpec.min}:1` : `${lsSpec.min}..${lsSpec.max}:1`}`
                        + (lsSpec.depth > 0 ? ` ${Math.round(lsSpec.depth * 100)}%` : "")
                        + (lsSpec.longMask ? ` {${lsSpec.longMask.join("")}}` : "") : ""));
        });

        notes.sort((a, b) => a.startTick - b.startTick);
        if (midiOut !== undefined)
          writeFileSync(String(midiOut), createSMF(notes, { bpm, ticksPerBeat: tpb, trackName: notation }));
        if (wavOut !== undefined) {
          const secPerTick = 60 / bpm / tpb;
          const hits = notes.map((n) => ({
            drum: n.pitch,
            timeSec: n.startTick * secPerTick,
            velocity: n.velocity / 127,
            // An open hat is a LONG hat: the note's own duration drives the
            // decay, so `LS(4){1000}` chokes and rings exactly where the ticks
            // say it does. That is the whole reason the durational layer
            // mattered for drums.
            params: { decayMs: Math.max(20, n.durationTicks * secPerTick * 1000) },
          })).filter((h) => resolveDrum(h.drum) !== null);
          const buf = renderHits(hits, { sampleRate: 48000 });
          // One gain over the whole render, chosen for headroom rather than
          // normalised per file — comparing two renders is the usual reason to
          // make them.
          let pk = 0; for (const v of buf) pk = Math.max(pk, Math.abs(v));
          const g = pk > 0.891 ? 0.891 / pk : 1;
          if (g !== 1) for (let i = 0; i < buf.length; i++) buf[i]! *= g;
          writeFileSync(String(wavOut), Buffer.from(wavMono16(buf, 48000)));
        }
        const wrote = [midiOut, wavOut].filter(Boolean).join(" + ");
        console.log(`wrote ${wrote} — ${notes.length} notes, ${bars} cycle(s) @ ${bpm}bpm, `
          + `${cycleLock ? `cycle lock · polyrhythm, cycle = ${cycleSteps} steps of lane 1` : "step lock · polymeter"}`);
        laneLines.forEach((l) => console.log(l));
        console.log(`ticks   ${notes.slice(0, 12).map((n) => n.startTick).join(" ")}${notes.length > 12 ? " …" : ""}`);
        return 0;
      }
      // Scenes ('|') go through the POLY parser even without a top-level '/'.
      // parsePolyUPI handles the one-lane case and returns sceneCount/scenes,
      // while the mono parser below rejects '|' outright — so `E(3,8)|E(5,8)`
      // used to print "no pattern (Unrecognised pattern)" for notation the
      // plugin plays perfectly. Found 2026-08-01 checking CLI/Workspace parity.
      if (isPolyUpi(notation) || notation.includes("|")) {
        const p = polyUpiInfo(notation, nSteps);
        if (!p.ok) { console.log(`no pattern (${p.error ?? "unparsed"})`); return 1; }
        const lanes = p.poly!.lanes;
        if (lanes.length > 1) console.log(`lanes   ${lanes.length} · display grid lcm ${p.poly!.lcm}`);
        lanes.forEach((lane, i) => {
          const a = p.analyses[i]!;
          const off = lane.offset == null ? ""
            : lane.offset.kind === "ms" ? `  @${lane.offset.ms >= 0 ? "+" : ""}${lane.offset.ms}ms`
            : `  @${lane.offset.num >= 0 ? "+" : ""}${lane.offset.num}/${lane.offset.den}`;
          const head = lanes.length > 1 ? lane.label.padEnd(10) : "pattern   ";
          console.log(`${head} ${lane.parsedLabel}${off}`);
          console.log(`           ${a.binary}  onsets [${a.onsets.join(" ")}] (${a.k}/${a.n}, evenness ${a.evenness.toFixed(3)})`);

          // Everything below was PARSED and silently not shown, which read as
          // "poly drops accents/scenes/progressive" when the library had them
          // all along. Only the display was missing.
          const L = lane as unknown as {
            accents?: number[] | null; accentPattern?: number[] | null;
            sceneCount?: number; sceneIndex?: number; scenes?: string[];
            progressive?: { kind: string; type?: string; target?: number; step?: number } | null;
          };
          if (L.accentPattern && L.accentPattern.length)
            console.log(`           accents {${L.accentPattern.join("")}} → ${(L.accents ?? []).join("")}`);
          if (L.sceneCount && L.sceneCount > 1)
            console.log(`           scenes  ${L.sceneCount}: ${(L.scenes ?? []).join("  |  ")}  (showing ${(L.sceneIndex ?? 0) + 1})`);
          if (L.progressive) {
            const g = L.progressive;
            const how = g.kind === "transform" ? `${g.type ?? "b"} → ${g.target} onsets`
                      : g.kind === "offset"    ? `rotate ${g.step} per trigger`
                      : `grow ${g.step} steps per trigger`;
            console.log(`           progressive  ${g.kind} (${how}) — one pattern per trigger`);
          }
        });
        return 0;
      }
      // Progressive notation (`pat>N`, `pat%N`, `pat+N`, `pat*N`) denotes a
      // DIFFERENT pattern per trigger, so there is no single pattern to print
      // — show the sequence instead. Before 2026-07-27 this whole family just
      // came back "Unrecognised pattern", which read as "unsupported" when the
      // truth was "stateful, and the state lived only in the C++ plugin".
      const prog = parseProgressive(notation);
      if (prog) {
        const triggers = one(args, "triggers") !== undefined ? Number(one(args, "triggers")) : 8;
        const parseBase = (str: string) => {
          const r = parseUPI(str, { n: nSteps });
          return r.ok ? { steps: r.steps } : null;
        };
        const first = progressiveAt(prog, 1, { parseBase });
        if (first.error) { console.log(`no pattern (${first.error})`); return 1; }
        console.log(`label   ${prog.source}`);
        console.log(`kind    progressive ${prog.kind}${prog.kind === "transform" ? ` (${prog.type} → ${prog.target} onsets)` : ` (step ${prog.step})`}`);
        console.log(`note    stateful: one pattern per trigger${prog.kind === "lengthen" ? "; lengthening appends RANDOM steps, so runs differ" : ""}`);
        for (let i = 1; i <= triggers; i++) {
          const r = progressiveAt(prog, i, { parseBase });
          const bits = r.steps.map((x: number) => (x ? "1" : "0")).join("");
          const onsets = r.steps.reduce((acc: number, x: number) => acc + (x ? 1 : 0), 0);
          console.log(`  ${String(i).padStart(2)}    ${bits}  ${onsets} onsets`);
        }
        return 0;
      }

      const info = upiInfo(notation, nSteps);
      if (!info.ok) { console.log(`no pattern (${info.error ?? "unparsed"})`); return 1; }
      const a = info.analysis!;
      console.log(`label   ${info.label}`);
      console.log(`steps   ${a.n}`);
      console.log(`binary  ${a.binary}`);
      console.log(`hex     ${a.hex}:${a.n}`);
      console.log(`decimal d${a.decimal}:${a.n}`);
      console.log(`onsets  [${a.onsets.join(" ")}] (${a.k}, density ${a.density.toFixed(3)})`);
      if (info.accents.some((x) => x)) console.log(`accents [${info.accents.join("")}]`);
      console.log(`balanced ${a.balanced} · evenness ${a.evenness.toFixed(3)}`);
      return 0;
    }
    case "generate": {
      const mode = one(args, "mode");
      if (mode !== undefined && mode !== "major" && mode !== "minor")
        throw new Error("generate: --mode must be major or minor");
      const method = one(args, "method");
      const info = generateInfo({
        ...(mode !== undefined && { mode }),
        ...(one(args, "length") !== undefined && { length: Number(one(args, "length")) }),
        ...(one(args, "seed") !== undefined && { seed: Number(one(args, "seed")) }),
        ...(method !== undefined && { method: method as "markov" | "markov-cadence" | "circle" }),
        ...(one(args, "variety") !== undefined && { variety: one(args, "variety")! }),
        ...(one(args, "tonic") !== undefined && { tonic: one(args, "tonic")! }),
      });
      const out = one(args, "out");
      if (out) {
        // realize headless straight to SMF: Roman bars → the same embedded-Progression file `smf` writes
        const r = smfFromBars(info.bars, { mode: info.mode, ...(one(args, "tonic") !== undefined && { tonic: one(args, "tonic")! }) });
        writeFileSync(out, r.bytes);
        console.log(`wrote ${out}: ${r.chordCount} chords from a generated ${info.mode} progression (embedded Progression included)`);
        return 0;
      }
      if (args.flags.has("bars-only") || !process.stdout.isTTY) {
        // Piped (or asked): bare bar notation only, so `generate | accompany`
        // composes like ordinary Unix tools.
        console.log(info.bars);
        return 0;
      }
      console.log(`bars    ${info.bars}`);
      if (info.symbols) console.log(`symbols ${info.symbols.join(" | ")}`);
      console.log(`(${info.labels.length} chords · ${info.mode}${one(args, "seed") !== undefined ? ` · seed ${one(args, "seed")}` : ""}) — pipe the bars into 'msuite smf' or add -o`);
      return 0;
    }
    case "smf": {
      const text = args.positional.join(" ");
      const out = one(args, "out");
      if (!out) throw new Error("smf: -o <file.mid> required");
      const mode = one(args, "mode");
      if (mode !== undefined && mode !== "major" && mode !== "minor")
        throw new Error("smf: --mode must be major or minor");
      const r = smfFromBars(text, {
        ...(one(args, "tonic") !== undefined && { tonic: one(args, "tonic")! }),
        ...(mode !== undefined && { mode }),
        ...(one(args, "bpm") !== undefined && { bpm: Number(one(args, "bpm")) }),
        ...(one(args, "beats-per-chord") !== undefined && { beatsPerChord: Number(one(args, "beats-per-chord")) }),
      });
      writeFileSync(out, r.bytes);
      console.log(`wrote ${out}: ${r.chordCount} chords, ${r.bytes.length} bytes (embedded Progression included)`);
      return 0;
    }
    case "style": {
      // msuite style learn <files-or-dir…> --chord Bb7 --id name -o model.json
      const sub = args.positional[0];
      if (sub !== "learn")
        throw new Error('style: the verb is `style learn <files-or-dir…> --chord <sym> --id <name> -o model.json`');
      const inputs = args.positional.slice(1);
      if (!inputs.length) throw new Error("style learn: give it .mid files or a directory of them");
      const files: string[] = [];
      for (const inp of inputs) {
        if (statSync(inp).isDirectory())
          files.push(...readdirSync(inp).filter((f) => f.toLowerCase().endsWith(".mid")).sort().map((f) => join(inp, f)));
        else files.push(inp);
      }
      const chord = one(args, "chord");
      if (!chord) throw new Error('style learn: --chord is required (the one chord the clips were played against, e.g. --chord "Bb7")');
      const id = one(args, "id") ?? "learned-style";
      const r = learnStyle({
        files, chord, id,
        ...(one(args, "role") !== undefined && { role: one(args, "role") as "bass" }),
        ...(one(args, "grid") !== undefined && { grid: Number(one(args, "grid")) }),
        ...(one(args, "tonic") !== undefined && { tonic: one(args, "tonic")! }),
        ...(one(args, "mode") !== undefined && { mode: one(args, "mode") as "major" | "minor" }),
      });
      for (const t of r.takes)
        console.log(`  ${t.file}: ${t.events} notes over ${t.bars} bar(s)${t.events ? "" : " — skipped"}`);
      const covered = r.model.slots.filter((s) => s.count > 0).length;
      console.log(`style learn: ${r.model.takes} takes against ${r.model.frame.symbol} → ${r.model.slots.length} slots (${covered} played), ${r.model.bars} bar(s)`);
      const out = one(args, "out");
      if (out) {
        writeFileSync(out, r.modelJson);
        console.log(`wrote ${out} — statistics only, the clips stay on this machine.`);
        console.log(`try: msuite accompany --source ${out} --progression "Dm7 | G7 | C7 | Bb7" --pass 0 (then --pass 1, 2… — every pass a fresh take)`);
      }
      return 0;
    }
    case "accompany": {
      let progression = one(args, "progression") ?? args.positional.join(" ");
      if (!progression && !process.stdin.isTTY) {
        // The brief's pipeline: `msuite generate … | msuite accompany …` —
        // read bar notation (Roman or symbols) from the pipe; lines become bars.
        progression = (await readStdin()).split("\n").map((l) => l.trim()).filter(Boolean).join(" | ");
      }
      if (!progression) throw new Error('accompany: --progression "<bars>" required (or pipe bar notation in)');
      const playing = args.flags.has("play");
      // With --play, stdout is the NDJSON note stream — human chatter → stderr.
      const log = playing ? console.error : console.log;
      const role = one(args, "role") ?? "bass";
      if (role !== "bass") throw new Error(`accompany: role "${role}" not implemented yet — slice 1 is bass`);
      const mode = one(args, "mode");
      if (mode !== undefined && mode !== "major" && mode !== "minor")
        throw new Error("accompany: --mode must be major or minor");
      const rangeSpec = one(args, "range");
      let range: { low: number; high: number } | undefined;
      if (rangeSpec !== undefined) {
        const [lo, hi] = rangeSpec.split(":");
        if (!lo || !hi) throw new Error("accompany: --range wants low:high, e.g. C2:C4");
        range = { low: noteNameToMidi(lo), high: noteNameToMidi(hi) };
        if (range.low > range.high) throw new Error("accompany: --range low is above high");
      }
      const r = accompany({
        progression,
        ...(one(args, "tonic") !== undefined && { tonic: one(args, "tonic")! }),
        ...(mode !== undefined && { mode }),
        ...(one(args, "source") !== undefined && { source: one(args, "source")! }),
        ...(one(args, "rhythm") !== undefined && { rhythm: one(args, "rhythm")! }),
        ...(one(args, "gate") !== undefined && { gate: one(args, "gate")! }),
        ...(one(args, "dynamics") !== undefined && { dynamics: Number(one(args, "dynamics")) }),
        ...(one(args, "rests") !== undefined && { rests: Number(one(args, "rests")) }),
        ...(one(args, "anticipation") !== undefined && { anticipation: Number(one(args, "anticipation")) }),
        ...(one(args, "variety") !== undefined && { variety: Number(one(args, "variety")) }),
        ...(one(args, "pocket") !== undefined && { pocket: Number(one(args, "pocket")) }),
        ...(one(args, "morph") !== undefined && { morph: Number(one(args, "morph")) }),
        ...(one(args, "morph-notes") !== undefined && { morphNotes: Number(one(args, "morph-notes")) }),
        ...(one(args, "morph-pocket") !== undefined && { morphPocket: Number(one(args, "morph-pocket")) }),
        ...(one(args, "morph-rests") !== undefined && { morphRests: Number(one(args, "morph-rests")) }),
        ...(one(args, "morph-accents") !== undefined && { morphAccents: Number(one(args, "morph-accents")) }),
        ...(one(args, "slide") !== undefined && { slide: Number(one(args, "slide")) }),
        ...(one(args, "glide-ms") !== undefined && { glideMs: Number(one(args, "glide-ms")) }),
        ...(one(args, "inflect") !== undefined && { inflect: Number(one(args, "inflect")) }),
        ...(one(args, "pass") !== undefined && { pass: Number(one(args, "pass")) }),
        ...(one(args, "bars") !== undefined && { bars: Number(one(args, "bars")) }),
        ...(one(args, "seed") !== undefined && { seed: Number(one(args, "seed")) }),
        ...(range !== undefined && { range }),
        ...(one(args, "chromaticism") !== undefined && { chromaticism: Number(one(args, "chromaticism")) }),
        ...(one(args, "rhythm-preservation") !== undefined && { rhythmPreservation: Number(one(args, "rhythm-preservation")) }),
        ...(one(args, "bpm") !== undefined && { bpm: Number(one(args, "bpm")) }),
        traceLevel: (one(args, "trace-level") as TraceLevel | undefined) ?? "events",
      });
      const out = one(args, "out");
      if (out) {
        writeFileSync(out, r.smf);
        log(`wrote ${out}: ${r.phrase.events.length} notes over ${r.frames.length} frames (trace header embedded)`);
      }
      // Anything the pipeline wanted to say but that is not an error — e.g. a
      // multi-lane --rhythm. The library returns these rather than printing;
      // the CLI is where they become visible.
      for (const n of r.notices ?? []) log(n);
      const traceOut = one(args, "trace");
      if (traceOut) {
        writeFileSync(traceOut, JSON.stringify(r.trace, null, 2) + "\n");
        log(`wrote ${traceOut}`);
      }
      const phraseOut = one(args, "phrase-out");
      if (phraseOut) {
        writeFileSync(phraseOut, r.phraseJson);
        log(`wrote ${phraseOut}`);
      }
      if (args.flags.has("explain") && r.trace.events) {
        for (const t of r.trace.events) {
          const move = t.sourceNote !== undefined && t.chosen !== undefined ? ` ${t.sourceNote}→${t.chosen}` : "";
          log(`bar ${t.bar + 1} @${t.onset}${move}  ${t.reason}${t.repairs ? `  [${t.repairs.join(", ")}]` : ""}`);
        }
        for (const c of r.articulation) log(`articulation @${c.onset}  ${c.kind}: ${c.detail}`);
        for (const c of r.expression) log(`expression @${c.onset}  ${c.kind}: ${c.detail}`);
        for (const n of r.inflections)
          log(`inflect @${n.onset}  ${n.articulation}${n.attack ? ` (attack ${n.attack.toFixed(2)})` : " (slurred)"}`);
      }
      const s = r.trace.summary;
      log(`accompany: ${r.phrase.events.length} notes · ${r.frames.map((f) => f.chord.symbol).join(" | ")} · seed ${r.trace.header.seed}`
        + (s ? ` · ${s.chordTones} chord tones, ${s.approachesKept} approaches, ${s.repairs} repairs` : ""));
      if (playing) {
        // Perform: real-time note messages, paced by the phrase's ticks at
        // the bpm. Default output is NDJSON on stdout (pipe into recv / a
        // bridge); --midi-out <port> performs as REAL MIDI instead — into a
        // virmidi port, jalv (Vane LV2), fluidsynth, or hardware (P1).
        // --loop repeats forever (Ctrl-C to stop, gracefully — the current
        // note finishes); --loop-count N repeats a fixed number of times.
        const loopCount = one(args, "loop-count") !== undefined
          ? Math.max(1, Number(one(args, "loop-count")))
          : args.flags.has("loop") ? Infinity : 1;
        const midi = openMidiFromFlags(args, log);
        let stopped = false;
        if (loopCount !== 1 || midi) {
          process.once("SIGINT", () => { stopped = true; log("\naccompany: stopping after the current note…"); });
        }
        let n = 0;
        for await (const msg of performPhrase(r.phrase, {
          ...(one(args, "bpm") !== undefined && { bpm: Number(one(args, "bpm")) }),
          ...(one(args, "to") !== undefined && { to: one(args, "to") as Destination }),
          ...(r.inflections.length && { inflections: r.inflections }),
          loopCount,
          isStopped: () => stopped,
        })) {
          if (midi) midi.player.handleMessage(msg);
          else process.stdout.write(toNdjson(msg));
          n++;
        }
        if (midi) await midi.finish();
        log(`played ${n} note${n === 1 ? "" : "s"} in real time` + (loopCount !== 1 ? ` (looped)` : "") + (midi ? ` → MIDI` : ""));
        return 0;
      }
      if (!out && !traceOut && !phraseOut && !args.flags.has("explain"))
        log("(add -o bass.mid, --trace trace.json, --phrase-out phrase.json, --play, or --explain)");
      return 0;
    }
    case "render": {
      const notes = args.positional.map(Number);
      if (!notes.length || notes.some(Number.isNaN))
        throw new Error("render: numeric MIDI notes required");
      const out = one(args, "out");
      if (!out) throw new Error("render: -o <file.wav> required");
      const params: Record<number, number> = {};
      for (const pv of args.flags.get("param") ?? []) {
        const m = /^(\d+)=(-?[\d.]+)$/.exec(pv);
        if (!m) throw new Error(`render: --param expects id=value, got "${pv}"`);
        params[Number(m[1])] = Number(m[2]);
      }
      // --stream: consume a control-plane `param` NDJSON stream from stdin,
      // resolve manifest ids → Vane wasm ids, and merge (stream over --param).
      // This is the message → sound path: `msuite send … | msuite render --stream`.
      if (args.flags.has("stream")) {
        const s = paramsFromStream(await readStdin(), vaneParamIdMap(), "vane");
        Object.assign(params, s.params);
        console.error(`render: applied ${s.applied.length} param(s) from stream` +
          `${s.messages ? ` (${s.messages} message${s.messages === 1 ? "" : "s"})` : ""}` +
          `${s.unresolved.length ? `; unresolved: ${s.unresolved.join(", ")}` : ""}` +
          `${s.ignored ? `; ${s.ignored} line(s) ignored` : ""}`);
      }
      const r = await renderVane({
        notes,
        ...(one(args, "seconds") !== undefined && { seconds: Number(one(args, "seconds")) }),
        ...(one(args, "breath") !== undefined && { breath: Number(one(args, "breath")) }),
        ...(one(args, "sr") !== undefined && { sampleRate: Number(one(args, "sr")) }),
        ...(one(args, "wasm") !== undefined && { wasmPath: one(args, "wasm")! }),
        params,
      });
      writeFileSync(out, r.wav);
      const secs = (r.samples.length / r.sampleRate).toFixed(2);
      console.log(`wrote ${out}: ${secs}s @ ${r.sampleRate}Hz, peak ${r.peak.toFixed(3)} — rendered by Vane's real DSP (WASM)`);
      if (r.peak < 0.001) console.log("note: near-silence — Vane's envelope is breath-driven; try --breath 0.9");
      return 0;
    }
    case "send": {
      const parsePairs = (vals: string[], what: string): Array<{ id: string; value: number }> =>
        vals.map((pv) => {
          const eq = pv.indexOf("=");
          if (eq < 1) throw new Error(`send: ${what} expects id=value, got "${pv}"`);
          const value = Number(pv.slice(eq + 1));
          if (Number.isNaN(value)) throw new Error(`send: ${what} value must be numeric, got "${pv}"`);
          return { id: pv.slice(0, eq), value };
        });
      const opts: SendOptions = {
        ...(one(args, "from") !== undefined && { from: one(args, "from") as AppId }),
        ...(one(args, "to") !== undefined && { to: one(args, "to") as Destination }),
        ...(one(args, "mode") !== undefined && { mode: one(args, "mode") as ParamMode }),
      };
      const params = parsePairs(args.flags.get("param") ?? [], "--param");
      const commandName = one(args, "command");
      if (params.length > 1) opts.params = params;
      else if (params.length === 1) opts.param = params[0]!;
      if (commandName !== undefined) {
        const argEntries = parsePairs(args.flags.get("arg") ?? [], "--arg");
        opts.command = {
          name: commandName,
          ...(argEntries.length && { args: Object.fromEntries(argEntries.map((a) => [a.id, a.value])) }),
        };
      }
      const noteSpec = one(args, "note");
      if (noteSpec !== undefined) {
        const notes = noteSpec.split(",").map((s) => Number(s.trim()));
        if (!notes.length || notes.some(Number.isNaN)) throw new Error(`send: --note expects comma-separated MIDI notes, got "${noteSpec}"`);
        opts.note = {
          notes,
          ...(one(args, "velocity") !== undefined && { velocity: Number(one(args, "velocity")) }),
          ...(one(args, "channel") !== undefined && { channel: Number(one(args, "channel")) }),
          ...(one(args, "gate") !== undefined && { gate: one(args, "gate") as "on" | "off" }),
          ...(one(args, "duration") !== undefined && { durationMs: Number(one(args, "duration")) }),
        };
      }
      const msg = sendMessage(opts);
      process.stdout.write(toNdjson(msg));
      return 0;
    }
    case "voice-split": {
      const splitter = new VoiceSplitter();
      const splitOpts = {
        ...(one(args, "base-channel") !== undefined && { baseChannel: Number(one(args, "base-channel")) }),
        ...(one(args, "span") !== undefined && { span: Number(one(args, "span")) }),
        ...(one(args, "to") !== undefined && { to: one(args, "to") as Destination }),
      };
      let split = 0, passed = 0, skipped = 0;
      const rl = createInterface({ input: process.stdin });
      for await (const line of rl) {
        const m = parseNdjson(line);
        if (!m) { if (line.trim()) skipped++; continue; }
        const out = applyVoiceSplit(m, splitter, splitOpts);
        if (out !== m) split++; else passed++;
        process.stdout.write(toNdjson(out));
      }
      console.error(`voice-split: ${split} note message(s) split, ${passed} passed through${skipped ? `, ${skipped} skipped` : ""}`);
      return 0;
    }
    case "bridge": {
      const bridge = await startBridge({
        ...(one(args, "port") !== undefined && { port: Number(one(args, "port")) }),
        input: process.stdin.isTTY ? null : process.stdin,
      });
      console.error(`bridge: listening on http://localhost:${bridge.port}` +
        ` — SSE at /events, POST /send; workspace Bridge module connects here`);
      if (process.stdin.isTTY)
        console.error("bridge: no pipe on stdin — HTTP-only (POST /send still works)");
      await new Promise(() => {}); // serve until Ctrl-C
      return 0;
    }
    case "play": {
      // NDJSON note stream (stdin, arriving in real time) → real MIDI out.
      // The generic half of P1: ANY producer (`accompany --play`, `send`,
      // a bridge's stdout, a future Serpe player) reaches jalv / fluidsynth /
      // hardware through one adapter: `… | msuite play --midi-out virtual`.
      if (args.flags.has("list")) {
        const ports = listMidiPorts();
        if (!ports.length) { console.log("no rawmidi ports (try: sudo modprobe snd-virmidi)"); return 1; }
        for (const p of ports) console.log(`${p.id}\tcard ${p.card} device ${p.device}\t${p.path}`);
        return 0;
      }
      const args2 = args; // for the closure below
      const midi = openMidiFromFlags(args2, (s) => console.error(s));
      if (!midi) throw new Error("play: --midi-out <port|/dev/...|virtual> required (or --list to enumerate)");
      let played = 0, skipped = 0;
      let sigint = false;
      process.once("SIGINT", async () => { sigint = true; await midi.finish(); process.exit(0); });
      const rl = createInterface({ input: process.stdin });
      for await (const line of rl) {
        const m = parseNdjson(line);
        if (!m) { if (line.trim()) skipped++; continue; }
        if (midi.player.handleMessage(m)) played++;
      }
      if (!sigint) await midi.finish();
      console.error(`play: ${played} note message(s) → MIDI${skipped ? `, ${skipped} skipped` : ""}`);
      return 0;
    }
    case "recv": {
      const text = await readStdin();
      let seen = 0, bad = 0;
      for (const line of text.split("\n")) {
        if (!line.trim()) continue;
        const m = parseNdjson(line);
        if (m) { console.log(summarizeMessage(m)); seen++; }
        else { console.error(`skipped a line (blank / foreign / invalid): ${line.slice(0, 60)}`); bad++; }
      }
      console.error(`recv: ${seen} message(s)${bad ? `, ${bad} skipped` : ""}`);
      return bad && !seen ? 1 : 0;
    }
    case "bind": {
      const path = args.positional[0];
      if (!path) throw new Error("bind: a control-map JSON file path is required");
      const map = JSON.parse(readFileSync(path, "utf8")) as ControlMap;
      const manifests = manifestsForControlMap(map);
      if (args.flags.has("validate")) {
        const r = validateControlMap(map, manifests);
        if (r.ok) { console.log(`valid: ${map.bindings.length} binding(s) over ${manifests.length} manifest(s)`); return 0; }
        for (const e of r.errors) console.error(`  ${e}`);
        return 1;
      }
      // Build one input event from --cc / --note / --key.
      let event: InputEvent;
      const ch = one(args, "channel") !== undefined ? Number(one(args, "channel")) : 1;
      const cc = one(args, "cc"), note = one(args, "note"), key = one(args, "key");
      if (cc !== undefined) {
        const mm = /^(\d+)=(\d+)$/.exec(cc);
        if (!mm) throw new Error(`bind: --cc expects N=V (e.g. 74=127), got "${cc}"`);
        event = { kind: "midi-cc", cc: Number(mm[1]), channel: ch, value: Number(mm[2]) };
      } else if (note !== undefined) {
        event = { kind: "midi-note", note: Number(note), channel: ch, velocity: one(args, "velocity") !== undefined ? Number(one(args, "velocity")) : 100 };
      } else if (key !== undefined) {
        event = { kind: "key", combo: key };
      } else {
        throw new Error("bind: an input is required — --cc N=V, --note N, or --key \"combo\" (or --validate)");
      }
      const msgs = resolveEvent(map, event, manifests);
      for (const m of msgs) process.stdout.write(toNdjson(m));
      console.error(`bind: ${msgs.length} message(s) from ${map.bindings.length} binding(s)`);
      return msgs.length ? 0 : 1;
    }
    case "describe": {
      const arg = args.positional[0];
      if (!arg) throw new Error(`describe: an app id (${Object.keys(MANIFEST_APPS).join(", ")}) or a manifest JSON path is required`);
      const path = bundledManifestPath(arg) ?? arg;   // app id → bundled manifest, else a file path
      const { lines } = describeManifest(JSON.parse(readFileSync(path, "utf8")));
      for (const l of lines) console.log(l);
      return 0;
    }
    default:
      throw new Error(`unknown command "${cmd}"\n${USAGE}`);
  }
}

// A downstream pipe closing early (`| head`, a bridge that never started
// because its port was taken, Ctrl-C on the reader) makes the next
// process.stdout.write() throw EPIPE. Node's default is an unhandled 'error'
// event — a raw stack trace for something that isn't a bug. Exit quietly
// instead, the way well-behaved Unix tools do; anything else still throws.
process.stdout.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EPIPE") process.exit(0);
  throw err;
});

main().then(
  (code) => process.exit(code),
  (err) => { console.error(String((err as Error).message ?? err)); process.exit(2); },
);
