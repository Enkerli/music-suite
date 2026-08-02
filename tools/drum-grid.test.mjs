import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { analyseFile } from "./drum-grid.mjs";

/**
 * Synthetic files, deliberately — NOT the corpus.
 *
 * The material this was written against is licensed EZdrummer MIDI that cannot
 * live in the repo (INTENT D7). A test that needed it would pass on one machine
 * and fail in CI, so these build the cases by hand and the corpus is used only
 * to check that the tool agrees with reality.
 */
const varlen = (n) => { const o = [n & 0x7f]; n >>= 7; while (n > 0) { o.unshift((n & 0x7f) | 0x80); n >>= 7; } return o; };
const be32 = (n) => [(n >> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255];
const be16 = (n) => [(n >> 8) & 255, n & 255];

/**
 * @param hits {tick, note, vel}[]
 *
 * Note-ons and note-offs go into ONE list sorted by time, with deltas taken
 * between consecutive events. The obvious version — emit on, then off at
 * tick+10, then delta from there — produces NEGATIVE deltas the moment two
 * drums hit together or a jittered onset lands earlier than the last note-off,
 * and a negative varlen silently corrupts the rest of the stream. Both of those
 * happen constantly in drum material; it cost three failing tests to notice.
 */
function writeMidi(hits, division = 960) {
  const events = [];
  for (const h of hits) {
    events.push({ t: Math.max(0, h.tick), b: [0x99, h.note, h.vel ?? 100] });
    events.push({ t: Math.max(0, h.tick) + 10, b: [0x89, h.note, 0] });
  }
  events.sort((a, b) => a.t - b.t);
  const evts = [];
  let prev = 0;
  for (const e of events) { evts.push(...varlen(e.t - prev), ...e.b); prev = e.t; }
  const track = [...evts, ...varlen(0), 0xff, 0x2f, 0x00];
  const bytes = [...[0x4d, 0x54, 0x68, 0x64], ...be32(6), ...be16(0), ...be16(1), ...be16(division),
    ...[0x4d, 0x54, 0x72, 0x6b], ...be32(track.length), ...track];
  const dir = mkdtempSync(join(tmpdir(), "dg-"));
  const p = join(dir, "t.mid");
  writeFileSync(p, Buffer.from(bytes));
  return p;
}

const B = 960;   // one beat

describe("drum-grid — the grid", () => {
  it("calls straight eighths 2 per beat, not 4", () => {
    // A finer grid always fits at least as well, so "lowest error" alone
    // over-subdivides. The tool prefers the coarsest grid that fits as well.
    const hits = [];
    for (let i = 0; i < 16; i++) hits.push({ tick: i * B / 2, note: 42 });
    expect(analyseFile(writeMidi(hits)).grid.perBeat).toBe(2);
  });

  it("calls eighth-note TRIPLETS 3 per beat, not 4", () => {
    // The distinction the whole tool exists for: a triplet upbeat sits at 0.67
    // of a beat, a swung sixteenth nearer 0.5-0.6. Snapping to 4 here would
    // corrupt everything downstream, silently.
    const hits = [];
    for (let i = 0; i < 24; i++) hits.push({ tick: Math.round(i * B / 3), note: 51 });
    const a = analyseFile(writeMidi(hits));
    expect(a.grid.perBeat).toBe(3);
    expect(a.grid.meanErrSlots).toBeLessThan(0.01);
  });

  it("survives humanised timing without changing its mind", () => {
    // Real playing is never exact. 0-24 ticks at 960/beat is up to 2.5% of a
    // beat, comfortably wider than the corpus median of 0.06 slots.
    const hits = [];
    for (let i = 0; i < 24; i++) hits.push({ tick: Math.round(i * B / 3) + (i % 5) * 6, note: 51 });
    expect(analyseFile(writeMidi(hits)).grid.perBeat).toBe(3);
  });

  it("reports the fit, so a caller can disbelieve it", () => {
    const hits = [];
    for (let i = 0; i < 12; i++) hits.push({ tick: Math.round(i * B * 0.37), note: 38 });   // on no grid
    const a = analyseFile(writeMidi(hits));
    expect(a.grid.meanErrSlots).toBeGreaterThan(0.05);
    expect(a.alternatives.length).toBeGreaterThan(1);
  });
});

describe("drum-grid — the meter", () => {
  it("takes the bar from the TIMEKEEPER voice", () => {
    // A drum that plays once per bar and nothing else names the bar. In the
    // jazz waltzes this was the hi-hat pedal (note 21), and it was the only
    // signal of three tried that produced no wrong answers.
    const hits = [];
    for (let bar = 0; bar < 8; bar++) {
      hits.push({ tick: bar * 3 * B + B, note: 21, vel: 90 });          // pedal on beat 2
      for (let i = 0; i < 9; i++) hits.push({ tick: bar * 3 * B + Math.round(i * B / 3), note: 51 });
    }
    const a = analyseFile(writeMidi(hits));
    expect(a.meter.beatsPerBar).toBe(3);
    expect(a.meter.fromNote).toBe(21);
  });

  it("says UNDETERMINED rather than guessing", () => {
    // 40 of 104 corpus files land here. Declining is the point: two earlier
    // heuristics answered every file and were wrong most of the time.
    const hits = [];
    for (let i = 0; i < 24; i++) hits.push({ tick: Math.round(i * B / 3), note: 51 });   // ride only
    expect(analyseFile(writeMidi(hits)).meter).toBeNull();
  });

  it("prefers the sparsest regular voice, since dense ones name the beat", () => {
    const hits = [];
    for (let bar = 0; bar < 8; bar++) {
      hits.push({ tick: bar * 4 * B, note: 49 });                        // once a bar → 4
      for (let b = 0; b < 4; b++) hits.push({ tick: bar * 4 * B + b * B, note: 42 });  // every beat → 1
    }
    expect(analyseFile(writeMidi(hits)).meter.beatsPerBar).toBe(4);
  });
});

describe("drum-grid — swing", () => {
  it("measures where the upbeat actually lands, and does not correct it", () => {
    // The corpus plays the second triplet slot at 0.679 where exact is 0.667.
    // That 1.2% is the feel; a tool that quantised it away would be discarding
    // the most interesting thing in the file.
    const hits = [];
    for (let b = 0; b < 8; b++) {
      hits.push({ tick: b * B, note: 51 });
      hits.push({ tick: Math.round(b * B + B * 0.68), note: 51 });
    }
    const a = analyseFile(writeMidi(hits));
    const late = a.swing.find((s) => Math.abs(s.nominal - 0.667) < 0.01);
    expect(late).toBeTruthy();
    expect(late.actual).toBeGreaterThan(0.67);
    expect(late.actual).toBeLessThan(0.69);
  });
});
