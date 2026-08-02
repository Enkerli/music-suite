import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSMF, onsetTicks, byNote, lineArticulation } from "./midi-timing.mjs";

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

function render(vec, out, extra = []) {
  const args = ["upi", vec.notation, "--midi", out, "--bars", String(vec.bars)];
  if (vec.lock) args.push("--lock", vec.lock);
  execFileSync("node", [CLI, ...args, ...extra], { stdio: "pipe" });
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

/**
 * --gate writes ARTICULATION into the file. Until 2026-08-02 the note length
 * was hardcoded at half a step, so every file this renderer produced was
 * detached and a legato example could not be written at all — which made it
 * useless for driving a wind instrument, where the difference between a slur
 * and a re-articulation is most of the performance.
 */
describe("upi --midi --gate — articulation", () => {
  const dir = mkdtempSync(join(tmpdir(), "gate-"));
  const vec = { notation: "E(4,8)", bars: 2 };
  const line = (extra) => lineArticulation(...(() => {
    const smf = render(vec, join(dir, "g.mid"), extra);
    return [smf.notes, smf.offs];
  })());

  it("defaults to detached — a sequencer's plain note", () => {
    expect(line([]).verdict).toBe("detached");
  });

  it("--gate legato lasts exactly until the next onset", () => {
    expect(line(["--gate", "legato"]).verdict).toBe("legato (abutting)");
  });

  it("takes the named gates from @enkerli/accompaniment, not a second copy", () => {
    // staccato 0.4 and tenuto 0.85 must both still be detached, and tenuto the
    // longer of the two — if these ever diverge from `accompany --gate`, the
    // same word means two things across the CLI.
    const st = line(["--gate", "staccato"]);
    const te = line(["--gate", "tenuto"]);
    expect(st.verdict).toBe("detached");
    expect(te.verdict).toBe("detached");
    expect(te.durations[0]).toBeGreaterThan(st.durations[0]);
  });

  /**
   * A lane is ONE note number, and MIDI cannot sound two instances of the same
   * pitch at once: the first note's note-off silences the second, so a gate
   * above 1.0 makes a HOLE, not a slur. Found by playing the file through Vane
   * and hearing the gap — the tick dump looked perfectly reasonable.
   */
  it("clamps above 1.0 rather than overlapping a pitch with itself", () => {
    expect(line(["--gate", "1.5"]).verdict).toBe("legato (abutting)");
  });

  it("measures the gate against the next ONSET, not the grid step", () => {
    // E(4,8) has onsets two steps apart, so a gate measured against the step
    // would leave `legato` half as long as it should be and audibly detached.
    const l = line(["--gate", "legato"]);
    const ioi = 240;                    // 8 steps of 120 ticks, onsets at 0 2 4 6
    expect(l.durations[0]).toBe(ioi);
  });

  it("rejects a gate it cannot read instead of silently using a default", () => {
    expect(() => render(vec, join(dir, "g.mid"), ["--gate", "molto"])).toThrow();
  });
});
