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

// ── Durational layer. LS(…) says how much longer a LONG note is than a SHORT
//    one; the {mask} form says WHICH onsets are long, which is the only way to
//    reach an EVEN grid — LS alone reads the pattern's own intervals, and
//    E(8,16) has none to read. This is the open-hat/closed-hat case, and it is
//    a PROPOSED spelling (docs/PRIORITIES_2026-08.md N1b), not settled.
const durational = [
  ["hat-flat.mid",   "E(8,16)",           "every hit the same — LS has nothing to say here"],
  ["hat-alternate.mid", "E(8,16)LS(4){10}",  "every other hit rings"],
  ["hat-backbeat.mid",  "E(8,16)LS(4){1000}", "one ringing hit in four — it overlaps the next"],
];

// Rendered through the synthesised kit as well as to MIDI. Until 2026-08-02
// these were played by a SAX, because there was no drum synth — the long notes
// rang convincingly and the 50 ms choked hits barely spoke, since a reed needs
// time. A hat does not, which is the point of D1.
for (const [file, notation] of durational)
  execFileSync("node", [cli, "upi", `hh=${notation}`, "--midi", out(file),
    "--wav", out(file.replace(/\.mid$/, ".wav")),
    "--bpm", String(BPM), "--bars", "2"],
    { stdio: "ignore" });

for (const [file, gate] of rhythmic)
  execFileSync("node", [cli, "upi", "E(4,8)", "--midi", out(file),
    "--bpm", String(BPM), "--bars", "2", "--note", "60", "--gate", gate],
    { stdio: "ignore" });

for (const [file, gate] of melodic)
  execFileSync("node", [cli, "accompany", "--progression", PROG, "-o", out(file),
    "--gate", gate, "--bpm", String(BPM), "--seed", String(SEED),
    "--range", RANGE],
    { stdio: "ignore" });

for (const [file, , why] of [...rhythmic, ...melodic, ...durational])
  console.log(`  ${file.padEnd(22)} ${why}`);
