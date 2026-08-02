import { describe, it, expect } from "vitest";
import { parseSMF, onsetTicks, deltas, byNote } from "./midi-timing.mjs";

// Build SMF bytes by hand so these tests depend on nothing that can be
// rebuilt — a fixture .mid would make a parser bug and a renderer bug look the
// same, which is the opposite of what a measurement tool needs.
const varlen = (n) => {
  const out = [n & 0x7f];
  n >>= 7;
  while (n > 0) { out.unshift((n & 0x7f) | 0x80); n >>= 7; }
  return out;
};
const be32 = (n) => [(n >> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255];
const be16 = (n) => [(n >> 8) & 255, n & 255];

/** @param events [deltaTicks, ...bytes][] */
function smf(events, division = 480) {
  const track = events.flatMap(([dt, ...bytes]) => [...varlen(dt), ...bytes]);
  const body = [...track, ...varlen(0), 0xff, 0x2f, 0x00];   // end of track
  return Buffer.from([
    ...Buffer.from("MThd", "latin1"), ...be32(6), ...be16(0), ...be16(1), ...be16(division),
    ...Buffer.from("MTrk", "latin1"), ...be32(body.length), ...body,
  ]);
}

const noteOn = (n, v = 100) => [0x90, n, v];
const noteOff = (n) => [0x80, n, 0];

describe("parseSMF", () => {
  it("reads division and absolute onset ticks", () => {
    const r = parseSMF(smf([[0, ...noteOn(36)], [480, ...noteOn(36)], [480, ...noteOn(36)]]));
    expect(r.division).toBe(480);
    expect(onsetTicks(r.notes)).toEqual([0, 480, 960]);
  });

  it("treats note-on velocity 0 as a note-OFF, not an onset", () => {
    // Files that use this convention would otherwise report double the notes,
    // and a doubled count reads as a stuck-note bug that is not there.
    const r = parseSMF(smf([[0, ...noteOn(36)], [240, 0x90, 36, 0], [240, ...noteOn(36)]]));
    expect(onsetTicks(r.notes)).toEqual([0, 480]);
  });

  it("handles RUNNING STATUS — a parser that ignores it loses notes silently", () => {
    // Second and third events omit the status byte. JUCE writes files this way.
    const r = parseSMF(smf([[0, ...noteOn(36)], [240, 38, 100], [240, 40, 100]]));
    expect(r.notes.map((n) => [n.tick, n.note])).toEqual([[0, 36], [240, 38], [480, 40]]);
  });

  it("reads the tempo meta event", () => {
    const t = [0xff, 0x51, 0x03, 0x07, 0xa1, 0x20];        // 500000 us = 120bpm
    const r = parseSMF(smf([[0, ...t], [0, ...noteOn(36)]]));
    expect(r.tempos[0].usPerQuarter).toBe(500000);
  });

  it("rejects a non-SMF and SMPTE division rather than reporting nonsense", () => {
    expect(() => parseSMF(Buffer.from("not a midi file"))).toThrow(/not a Standard MIDI File/);
    const s = smf([[0, ...noteOn(36)]]);
    s.writeUInt16BE(0xe728, 12);                            // SMPTE flag set
    expect(() => parseSMF(s)).toThrow(/SMPTE/);
  });
});

describe("measurements", () => {
  it("collapses simultaneous notes into ONE onset", () => {
    // Two poly lanes hitting together is one moment in time, not two.
    const r = parseSMF(smf([[0, ...noteOn(36)], [0, ...noteOn(37)], [480, ...noteOn(36)]]));
    expect(r.notes.length).toBe(3);
    expect(onsetTicks(r.notes)).toEqual([0, 480]);
  });

  it("deltas describe the rhythm independent of where it starts", () => {
    expect(deltas([0, 480, 720, 1200])).toEqual([480, 240, 480]);
    expect(deltas([100, 580, 820, 1300])).toEqual([480, 240, 480]);
  });

  it("byNote recovers each lane's own timeline from the mixed stream", () => {
    // E(3,8)/E(3,7)-shaped: two lanes on their own note numbers. Without this
    // the file is just interleaved onsets and says nothing about either lane.
    const r = parseSMF(smf([
      [0, ...noteOn(36)], [0, ...noteOn(37)],
      [240, ...noteOn(37)], [120, ...noteOn(36)],
    ]));
    const lanes = byNote(r.notes);
    expect(lanes.map((l) => l.note)).toEqual([36, 37]);
    expect(lanes[0].ticks).toEqual([0, 360]);
    expect(lanes[1].ticks).toEqual([0, 240]);
  });

  it("reports the distinct velocities per lane — how an accent shows up", () => {
    const r = parseSMF(smf([[0, ...noteOn(36, 102)], [240, ...noteOn(41, 127)], [240, ...noteOn(36, 102)]]));
    const lanes = byNote(r.notes);
    expect(lanes.find((l) => l.note === 36).velocities).toEqual([102]);
    expect(lanes.find((l) => l.note === 41).velocities).toEqual([127]);
  });

  it("survives a note-off stream without counting it", () => {
    const r = parseSMF(smf([[0, ...noteOn(36)], [120, ...noteOff(36)], [120, ...noteOn(36)]]));
    expect(onsetTicks(r.notes)).toEqual([0, 240]);
  });
});
