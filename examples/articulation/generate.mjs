#!/usr/bin/env node
// Regenerate the articulation example files.
//
//   node examples/articulation/generate.mjs
//
// The .mid files are committed, so this is not needed to USE them — it is here
// so they are reproducible and so a change in the renderer shows up as a diff
// rather than as a set of stale binaries nobody can re-derive.
//
// Every file is written by the shipped CLI, not by a private helper: if these
// sound wrong in a DAW, the bug is in something a user can also reach.

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const cli = resolve(here, "../../packages/cli/dist/cli.js");
const out = (f) => join(here, f);

const BPM = 100;
const PROG = "Dm7 | G7 | Cmaj7 | Cmaj7";
const SEED = 7;
const RANGE = "C4:C5";        // sax register, not the default bass range

// ── Rhythmic, one pitch. Isolates the ENVELOPE: same note, same onsets, only
//    the note lengths differ, so anything you hear change is articulation.
const rhythmic = [
  ["rhythm-detached.mid", "0.5",  "the sequencer default — every note re-attacks"],
  ["rhythm-legato.mid",   "legato", "each note lasts until the next begins"],
  // No overlapping variant here, deliberately. A lane is ONE note number, and
  // MIDI cannot overlap two instances of the same pitch — the first note's
  // note-off silences the second, so `--gate 1.25` produced a hole rather than
  // a slur. The renderer now clamps at 1.0 and says so. Overlap needs different
  // pitches, which is what line-overlap.mid below is for.
];

// ── Melodic. Melisma only exists here: several PITCHES inside one breath.
//    In SAX REGISTER deliberately. accompany defaults to a bass range, and a
//    line around D2 is not what this instrument plays: the bore is long enough
//    there that re-entraining at a new pitch takes tens of milliseconds, which
//    swamps the articulation the file is meant to demonstrate. Measured — a
//    legato line at C2 reads no better than a detached one over any window
//    short enough to be about articulation at all.
const melodic = [
  ["line-detached.mid", "staccato", "separate breaths"],
  ["line-legato.mid",   "legato",   "one breath, several notes"],
  ["line-overlap.mid",  "1.3",      "overlapping pitches — the strongest melisma case"],
  ["line-mixed.mid",    "mixed",    "some slurred, some tongued"],
];

for (const [file, gate] of rhythmic)
  execFileSync("node", [cli, "upi", "E(4,8)", "--midi", out(file),
    "--bpm", String(BPM), "--bars", "2", "--note", "60", "--gate", gate],
    { stdio: "ignore" });

for (const [file, gate] of melodic)
  execFileSync("node", [cli, "accompany", "--progression", PROG, "-o", out(file),
    "--gate", gate, "--bpm", String(BPM), "--seed", String(SEED),
    "--range", RANGE],
    { stdio: "ignore" });

for (const [file, , why] of [...rhythmic, ...melodic])
  console.log(`  ${file.padEnd(22)} ${why}`);
