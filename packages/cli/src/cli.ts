#!/usr/bin/env node
/**
 * enkerli — the suite's headless CLI (thin argv wrapper over index.ts).
 *
 *   enkerli chord 60 64 67 71          identify a chord (MIDI notes)
 *   enkerli chord 0 4 7 --pcs          …or bare pitch classes
 *   enkerli pattern "E(3,8)"           rhythm codecs (binary/hex/octal/decimal/onsets)
 *   enkerli pattern 0x94:8             …tresillo, suite little-endian digits
 *   enkerli smf "Dm7 G7 | Cmaj7" -o out.mid [--tonic C] [--mode major] [--bpm 120]
 *   enkerli render 60 64 67 -o out.wav [--seconds 2] [--breath 0.9] [--sr 48000]
 *                                      [--param 12=0.8]  (Vane wasm param id=value)
 *   enkerli send --to serpe --command mutate --arg amount=0.3   control-plane message → NDJSON
 *   enkerli send --to serpe --param density=0.7                 …a param set
 *   enkerli … | enkerli recv                                    read NDJSON messages from a pipe
 *   enkerli describe <manifest.json>                            validate + print a tool's surface
 *
 * Everything runs from the repo with no GUI, no DAW, no plugin host — render
 * goes through the SAME vane-dsp.wasm the browser standalone plays; send/recv
 * carry the @enkerli/protocol message model over an ordinary Unix pipe
 * (docs/CONTROL_PLANE.md — the headless half of the control & interop plane).
 */
import { readFileSync, writeFileSync } from "node:fs";
import {
  chordInfo, patternInfo, smfFromBars, renderVane,
  sendMessage, toNdjson, parseNdjson, summarizeMessage, describeManifest,
  bundledManifestPath, MANIFEST_APPS,
  type SendOptions,
} from "./index.js";
import type { AppId, Destination, ParamMode } from "@enkerli/protocol";

const USAGE = `enkerli <command> …
  chord <values…> [--pcs|--notes]
  pattern <spec>                        E(3,8) · 0x94:8 · o111:8 · d73:8 · 10010010
  smf "<bars>" -o <file.mid> [--tonic C] [--mode major|minor] [--bpm N] [--beats-per-chord N]
  render <notes…> -o <file.wav> [--seconds N] [--breath 0..1] [--sr N] [--param id=value]…
  send [--from app] [--to app|*] (--param id=value… [--mode set|report|observe] | --command name [--arg k=v]…)
  recv                                  read NDJSON SuiteMessages from stdin, validate + summarize
  describe <app|manifest.json>          print a tool's parameter/command surface (app id e.g. vane, or a manifest file)`;

interface Args { positional: string[]; flags: Map<string, string[]> }

function parseArgs(argv: string[]): Args {
  const positional: string[] = [];
  const flags = new Map<string, string[]>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith("--")) {
      const name = a.slice(2);
      const boolean = ["pcs", "notes", "help"].includes(name);
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
      const spec = args.positional.join(" ");
      const p = patternInfo(spec);
      console.log(`steps   ${p.steps}`);
      console.log(`binary  ${p.binary}`);
      console.log(`hex     0x${p.hex}:${p.steps}`);
      console.log(`octal   o${p.octal}:${p.steps}`);
      console.log(`decimal d${p.decimal}:${p.steps}`);
      console.log(`onsets  [${p.onsets.join(" ")}] (${p.onsetCount})`);
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
      const msg = sendMessage(opts);
      process.stdout.write(toNdjson(msg));
      return 0;
    }
    case "recv": {
      const text = readFileSync(0, "utf8");
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

main().then(
  (code) => process.exit(code),
  (err) => { console.error(String((err as Error).message ?? err)); process.exit(2); },
);
