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
 *
 * Everything runs from the repo with no GUI, no DAW, no plugin host — render
 * goes through the SAME vane-dsp.wasm the browser standalone plays.
 */
import { writeFileSync } from "node:fs";
import {
  chordInfo, patternInfo, smfFromBars, renderVane,
} from "./index.js";

const USAGE = `enkerli <command> …
  chord <values…> [--pcs|--notes]
  pattern <spec>                        E(3,8) · 0x94:8 · o111:8 · d73:8 · 10010010
  smf "<bars>" -o <file.mid> [--tonic C] [--mode major|minor] [--bpm N] [--beats-per-chord N]
  render <notes…> -o <file.wav> [--seconds N] [--breath 0..1] [--sr N] [--param id=value]…`;

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
    default:
      throw new Error(`unknown command "${cmd}"\n${USAGE}`);
  }
}

main().then(
  (code) => process.exit(code),
  (err) => { console.error(String((err as Error).message ?? err)); process.exit(2); },
);
