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

/**
 * LS(…) — the durational layer, reaching the renderer since 2026-08-02.
 *
 * It parsed and computed all along (`msuite pattern "E(3,8)LS(2)"` prints
 * `durate fixed 2:1 → [2 2 1]`); this renderer dropped it silently. These pin
 * both that it arrives and how it divides responsibility with --gate.
 */
describe("upi --midi with LS(…) — the durational layer", () => {
  const dir = mkdtempSync(join(tmpdir(), "ls-"));
  const durs = (notation, extra = []) => {
    const smf = render({ notation, bars: 1 }, join(dir, "ls.mid"), extra);
    const l = lineArticulation(smf.notes, smf.offs);
    return l.durations;
  };

  it("arrives at all — LS changes the note lengths", () => {
    // The regression that matters: this used to be identical to no-LS output.
    expect(durs("E(3,8)LS(4)")).not.toEqual(durs("E(3,8)"));
  });

  it("LS(1) flattens an uneven rhythm to equal note lengths", () => {
    // E(3,8) has inter-onset spans 3,3,2 — unequal by construction. LS(1) says
    // a long is exactly as long as a short, so the DURATIONS even out while the
    // onsets stay where they are. That is the whole point of a durational layer
    // being separate from the rhythm.
    const d = durs("E(3,8)LS(1)");
    expect(new Set(d).size).toBe(1);
  });

  it("a bigger ratio widens the long/short contrast", () => {
    const spread = (n) => { const d = durs(n); return Math.max(...d) / Math.min(...d); };
    expect(spread("E(3,8)LS(4)")).toBeGreaterThan(spread("E(3,8)LS(2)"));
  });

  it("PRESERVES the total, which is what keeps --gate independent", () => {
    // LS redistributes time between long and short notes; --gate scales the
    // whole. If LS also changed the total, `--gate legato` would mean something
    // different depending on the ratio, and the two could not be reasoned about
    // separately.
    const total = (n) => durs(n).reduce((a, b) => a + b, 0);
    const plain = total("E(3,8)");
    for (const n of ["E(3,8)LS(1)", "E(3,8)LS(2)", "E(3,8)LS(4)"])
      expect(Math.abs(total(n) - plain)).toBeLessThanOrEqual(3);   // integer ticks
  });

  it("--gate scales LS output without changing its proportions", () => {
    const ratio = (extra) => { const d = durs("E(3,8)LS(3)", extra); return Math.max(...d) / Math.min(...d); };
    expect(ratio([])).toBeCloseTo(ratio(["--gate", "legato"]), 1);
  });

  it("the dynamic form reproduces exactly", () => {
    // Seeded, like progressive lengthening: a notation names a file.
    expect(durs("E(5,16)LS(1.4..1.8,70%)")).toEqual(durs("E(5,16)LS(1.4..1.8,70%)"));
  });

  /**
   * The limit, stated so it is not rediscovered as a bug.
   *
   * LS reads the pattern's own inter-onset intervals. On an EVEN grid every
   * interval is the same, so there is no long and no short and LS has nothing
   * to say — `E(8,16)LS(4)` is `E(8,16)`. That matters because the drum case
   * that wants long/short most is exactly an even one: which hi-hats ring and
   * which choke. See docs/PRIORITIES_2026-08.md N1b.
   */
  it("has NOTHING to say about an even grid — the open-hat gap", () => {
    expect(durs("E(8,16)LS(4)")).toEqual(durs("E(8,16)"));
  });
});

/**
 * Accents PRECESS across cycles, and so does the durational mask.
 *
 * A mask that does not divide the onset count keeps counting: `{10}` over five
 * onsets starts cycle 2 on bit 1, not bit 0. The C++ engine has always done
 * this — upi.js says so in as many words — and this renderer restarted the
 * count every cycle, so a capture of `{10}E(5,8)` could never match the
 * baseline it exists to be compared against. Same class as the lock-mode
 * mismatch A1 was filed for.
 */
describe("upi --midi — masks precess across cycles", () => {
  const dir = mkdtempSync(join(tmpdir(), "prec-"));
  const accentedTicks = (notation, bars) => {
    const smf = render({ notation, bars }, join(dir, "p.mid"));
    // An accent is note+5 at velocity 127, matching the plugin.
    return smf.notes.filter((n) => n.vel === 127).map((n) => n.tick);
  };

  it("{10} over five onsets carries the count into the next cycle", () => {
    // Cycle 1 onsets 0..4 → bits 1,0,1,0,1 → accents at 0, 360, 720.
    // Cycle 2 starts at onset 5 → bits 0,1,0,1,0 → accents at 1200, 1560.
    // Restarting the count would accent 960, 1320, 1680 instead.
    expect(accentedTicks("{10}E(5,8)", 3))
      .toEqual([0, 360, 720, 1200, 1560, 1920, 2280, 2640]);
  });

  it("a mask that DOES divide evenly is unaffected", () => {
    // 5 bits over 5 onsets: every cycle starts on bit 0 either way. This is
    // why {10010}E(5,8) never showed the bug.
    const one = accentedTicks("{10010}E(5,8)", 1);
    const two = accentedTicks("{10010}E(5,8)", 2);
    expect(two.slice(0, one.length)).toEqual(one);
    expect(two.slice(one.length)).toEqual(one.map((t) => t + 960));
  });
});
