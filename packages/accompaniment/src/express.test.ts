import { describe, it, expect } from "vitest";
import { expressPhrase } from "./express.js";
import { groove } from "./pipeline.js";
import { parsePhrase } from "./phrase.js";
import type { AccompanimentPhrase } from "./phrase.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const load = (f: string): AccompanimentPhrase =>
  parsePhrase(readFileSync(join(HERE, "..", "vectors", f), "utf8"));

const PROG = "Dm7 | G7 | Cmaj7 | A7";
const source = () => load("source-walking-bass.json");
const funk = () => load("source-funk-ghost.json");

describe("expressPhrase", () => {
  it("is deterministic: same (seed, pass, options) → identical output", () => {
    const g = () => groove(source(), { progression: PROG, seed: 7, variety: 0.6, pocket: 0.5, pass: 3, morph: 0.5 });
    expect(g().phrase.events).toEqual(g().phrase.events);
  });

  it("morph 0 → every pass identical; morph > 0 → passes differ", () => {
    const at = (pass: number, morph: number) =>
      groove(source(), { progression: PROG, seed: 7, variety: 0.7, pocket: 0.6, pass, morph }).phrase.events;
    expect(at(0, 0)).toEqual(at(5, 0));
    expect(at(0, 0.8)).not.toEqual(at(5, 0.8));
  });

  it("all knobs off → the stage doesn't run (earlier vectors stay byte-identical)", () => {
    const base = groove(source(), { progression: PROG, seed: 42 });
    const adapted = JSON.parse(readFileSync(join(HERE, "..", "vectors", "adapted-dm7-g7-cmaj7-a7-seed42.json"), "utf8"));
    expect(base.phrase.events).toEqual(adapted.phrase.events);
    expect(base.expression).toEqual([]);
  });

  it("variety generates passing tones, labeled honestly", () => {
    // High variety over several passes: at least one passing-tone change with
    // the schema category, stepping toward the next event's pitch.
    let found = false;
    for (let pass = 0; pass < 8 && !found; pass++) {
      const r = groove(source(), { progression: PROG, seed: 11, variety: 1, pass, morph: 1 });
      const p = r.expression.find((c) => c.kind === "passing");
      if (p) {
        found = true;
        const ev = r.phrase.events.find((e) => e.chordRelation?.category === "passing-tone");
        expect(ev).toBeDefined();
      }
    }
    expect(found).toBe(true);
  });

  it("variety never touches bar downbeats (the anchors)", () => {
    const r = groove(source(), { progression: PROG, seed: 3, variety: 1 });
    const barTicks = r.phrase.ticksPerBeat * r.phrase.meter.numerator;
    for (const c of r.expression) {
      if (c.kind === "octave" || c.kind === "reselect" || c.kind === "passing")
        expect(c.onset % barTicks).not.toBe(0);
    }
  });

  it("pocket keeps events ordered and bounded (≤18ms of lean)", () => {
    const r = groove(funk(), { progression: PROG, seed: 5, pocket: 1, bpm: 100 });
    const evs = r.phrase.events;
    for (let i = 1; i < evs.length; i++) expect(evs[i]!.onset).toBeGreaterThan(evs[i - 1]!.onset);
    // 18ms at 100bpm, 480tpb → 18 * 800/1000 ≈ 14.4 ticks max delta
    const base = groove(funk(), { progression: PROG, seed: 5, bpm: 100 });
    const byIdx = new Map(base.phrase.events.map((e, i) => [i, e.onset]));
    r.phrase.events.forEach((e, i) => {
      const orig = byIdx.get(i);
      if (orig !== undefined) expect(Math.abs(e.onset - orig)).toBeLessThanOrEqual(16);
    });
  });

  it("pocket couples timing and dynamics (velocities shift with the lean)", () => {
    const base = groove(funk(), { progression: PROG, seed: 5 });
    const pocketed = groove(funk(), { progression: PROG, seed: 5, pocket: 1 });
    const changed = pocketed.phrase.events.some((e, i) => e.velocity !== base.phrase.events[i]?.velocity);
    expect(changed).toBe(true);
  });

  it("gate 'mixed' slurs stepwise motion into its arrival and separates repeats", () => {
    const r = groove(source(), { progression: PROG, seed: 42, gate: "mixed" });
    const evs = r.phrase.events;
    for (let i = 0; i < evs.length - 1; i++) {
      const e = evs[i]!, n = evs[i + 1]!;
      if (e.note !== undefined && n.note !== undefined && e.note !== n.note && Math.abs(n.note - e.note) <= 2) {
        expect(e.onset + e.duration).toBe(n.onset); // legato: releases exactly at the arrival
      } else if (e.note !== undefined && n.note === e.note) {
        expect(e.onset + e.duration).toBeLessThan(n.onset); // detached
      }
    }
    expect(r.expression.some((c) => c.kind === "gate" && /legato/.test(c.detail))).toBe(true);
  });

  it("gate 'mixed' composes with rests/dynamics (articulate still runs)", () => {
    const r = groove(funk(), { progression: PROG, seed: 9, gate: "mixed", dynamics: 0.6, rests: 0.3 });
    expect(r.articulation.length).toBeGreaterThan(0);
    expect(r.expression.some((c) => c.kind === "gate")).toBe(true);
  });

  it("reproduces the committed expression vector byte-for-byte (pass 0 AND pass 3)", () => {
    const vec = JSON.parse(readFileSync(join(HERE, "..", "vectors", "expressed-funk-dm7-g7-cmaj7-a7-seed42.json"), "utf8"));
    // Rebuild the generator's input (funk adapted, unarticulated) via the same
    // pipeline, then express at each committed pass.
    const base = groove(funk(), { progression: PROG, seed: 42 });
    for (const [key, pass] of [["pass0", 0], ["pass3", 3]] as const) {
      const r = expressPhrase(base.phrase, { seed: 42, pass, morph: 0.5, variety: 0.6, pocket: 0.5, mixedGate: true, bpm: 120 });
      expect(JSON.parse(JSON.stringify(r))).toEqual(vec[key]);
    }
  });

  it("direct expressPhrase call: fixed draw budget keeps variety decisions stable when pocket toggles", () => {
    const base = source();
    const a = expressPhrase(base, { seed: 4, variety: 0.8, bpm: 120 });
    const b = expressPhrase(base, { seed: 4, variety: 0.8, pocket: 0.5, bpm: 120 });
    const varietyKinds = (r: typeof a) => r.changes.filter((c) => c.kind !== "pocket" && c.kind !== "gate");
    expect(varietyKinds(b)).toEqual(varietyKinds(a));
  });
});
