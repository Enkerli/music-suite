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
import { identify, longShort, durations, dynamicDurations, parseNamedPatterns, describeNamedPattern, parseLongShortSuffix } from "@enkerli/upi";
import { wrapPattern } from "@enkerli/library";
import type { TraceLevel } from "@enkerli/accompaniment";
import type { AppId, Destination, ParamMode } from "@enkerli/protocol";

const USAGE = `msuite <command> …
  chord <values…> [--pcs|--notes]
  pattern <spec>                        E(3,8) · 0x94:8 · o111:8 · d73:8 · 10010010
                                        add LS(3) for a fixed long:short, or
                                        LS(1.4..1.8, 70%) to make it breathe
          --import <file|-> [--json]    named patterns → library items
  upi "<notation>" [--steps N]          the full Serpe UPI language: P(3,0)+P(5,0), E(3,8);12, {100}E(3,8), Morse…
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

async function main(): Promise<number> {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd || cmd === "--help" || cmd === "help") { console.log(USAGE); return 0; }
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
      if (isPolyUpi(notation)) {
        const p = polyUpiInfo(notation, nSteps);
        if (!p.ok) { console.log(`no pattern (${p.error ?? "unparsed"})`); return 1; }
        console.log(`lanes   ${p.poly!.lanes.length} · display grid lcm ${p.poly!.lcm}`);
        p.poly!.lanes.forEach((lane, i) => {
          const a = p.analyses[i]!;
          const off = lane.offset == null ? ""
            : lane.offset.kind === "ms" ? `  @${lane.offset.ms >= 0 ? "+" : ""}${lane.offset.ms}ms`
            : `  @${lane.offset.num >= 0 ? "+" : ""}${lane.offset.num}/${lane.offset.den}`;
          console.log(`${lane.label.padEnd(10)} ${lane.parsedLabel}${off}`);
          console.log(`           ${a.binary}  onsets [${a.onsets.join(" ")}] (${a.k}/${a.n}, evenness ${a.evenness.toFixed(3)})`);
        });
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
