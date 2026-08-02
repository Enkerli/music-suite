import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSMF, onsetTicks, byNote } from "./midi-timing.mjs";

/**
 * The timing baseline: what `msuite upi --midi` must produce, in ticks.
 *
 * This is the reference a DAW capture gets compared against, so it has to be
 * pinned the way the Serpe conformance vectors are — a change that moves a note
 * should fail here and be explained, not be discovered later by ear.
 *
 * Runs the BUILT CLI rather than importing its internals: the thing under test
 * is the command a person actually types, and the render path lives inside the
 * command. Requires `npm run build -w @enkerli/cli` first, which the repo's
 * pretest already does.
 */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = join(ROOT, "packages/cli/dist/cli.js");
const VECTORS = JSON.parse(readFileSync(join(ROOT, "tools/timing-vectors.json"), "utf8"));

function render(vec, out) {
  const args = ["upi", vec.notation, "--midi", out, "--bars", String(vec.bars)];
  if (vec.lock) args.push("--lock", vec.lock);
  execFileSync("node", [CLI, ...args], { stdio: "pipe" });
  return parseSMF(readFileSync(out));
}

describe("timing baseline — msuite upi --midi", () => {
  const dir = mkdtempSync(join(tmpdir(), "timing-"));

  for (const vec of VECTORS.vectors) {
    it(`${vec.name}`, () => {
      const smf = render(vec, join(dir, "v.mid"));

      // The file's own clock must be what the vectors are expressed in, or
      // every tick below means something different.
      expect(smf.division).toBe(VECTORS.division);
      expect(Math.round(60_000_000 / smf.tempos[0].usPerQuarter)).toBe(VECTORS.bpm);

      expect(onsetTicks(smf.notes)).toEqual(vec.onsets);

      // Per-lane, because the combined onset list cannot tell a two-lane
      // pattern from a busy one-lane pattern — and for accents, the second
      // note number IS the accent (louder AND transposed +5).
      const lanes = Object.fromEntries(byNote(smf.notes).map((l) => [String(l.note), l.ticks]));
      expect(lanes).toEqual(vec.lanes);
    });
  }

  it("the two locks genuinely differ — otherwise --lock proves nothing", () => {
    // Guard against both modes silently collapsing to the same renderer path.
    // This is the one assertion that would still catch it if every vector above
    // were regenerated from a broken build.
    const cyc = VECTORS.vectors.find((v) => v.lock === "cycle" && v.notation === "E(3,8)/E(3,7)");
    const stp = VECTORS.vectors.find((v) => v.lock === "step" && v.notation === "E(3,8)/E(3,7)");
    expect(cyc.onsets).not.toEqual(stp.onsets);
    // The telling one: lane 2 begins its second cycle with lane 1 under cycle
    // lock, and early under step lock.
    expect(cyc.lanes["37"][3]).toBe(960);
    expect(stp.lanes["37"][3]).toBe(840);
  });
});
