#!/usr/bin/env node
/**
 * Regenerate the tick values in tools/timing-vectors.json from the renderer.
 *
 * Only the VALUES. `name`, `notation`, `bars`, `lock` and `why` are
 * hand-authored and left alone — the prose says what each vector is guarding,
 * and a generator that rewrote it would erase the reason the vector exists.
 *
 * WHEN TO RUN THIS: after a deliberate change to the renderer. Read the diff
 * before committing it. Every moved tick is either something you meant to do,
 * or the bug the file exists to catch — and this script cannot tell you which,
 * so the commit message has to.
 *
 *   node tools/gen-timing-vectors.mjs           # rewrite in place
 *   node tools/gen-timing-vectors.mjs --check   # exit 1 if stale, change nothing
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSMF, onsetTicks, byNote } from "./midi-timing.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = join(ROOT, "packages/cli/dist/cli.js");
const FILE = join(ROOT, "tools/timing-vectors.json");

const doc = JSON.parse(readFileSync(FILE, "utf8"));
const dir = mkdtempSync(join(tmpdir(), "genvec-"));
let changed = 0;

for (const vec of doc.vectors) {
  const out = join(dir, "v.mid");
  const args = ["upi", vec.notation, "--midi", out, "--bars", String(vec.bars)];
  if (vec.lock) args.push("--lock", vec.lock);
  execFileSync("node", [CLI, ...args], { stdio: "pipe" });

  const smf = parseSMF(readFileSync(out));
  const onsets = onsetTicks(smf.notes);
  const lanes = Object.fromEntries(byNote(smf.notes).map((l) => [String(l.note), l.ticks]));

  const before = JSON.stringify([vec.onsets, vec.lanes]);
  const after = JSON.stringify([onsets, lanes]);
  if (before !== after) {
    changed++;
    console.log(`CHANGED  ${vec.name}`);
    console.log(`  onsets was ${JSON.stringify(vec.onsets)}`);
    console.log(`         now ${JSON.stringify(onsets)}`);
    if (JSON.stringify(vec.lanes) !== JSON.stringify(lanes)) {
      console.log(`  lanes  was ${JSON.stringify(vec.lanes)}`);
      console.log(`         now ${JSON.stringify(lanes)}`);
    }
  }
  vec.onsets = onsets;
  vec.lanes = lanes;
}

if (process.argv.includes("--check")) {
  console.log(changed ? `\n${changed} vector(s) are STALE — run without --check to update.`
                      : "vectors are current.");
  process.exit(changed ? 1 : 0);
}

writeFileSync(FILE, JSON.stringify(doc, null, 2) + "\n");
console.log(changed ? `\nrewrote ${FILE} — ${changed} vector(s) changed. Read the diff.`
                    : `${FILE} already current — nothing changed.`);
