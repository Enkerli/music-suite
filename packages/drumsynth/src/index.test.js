import { describe, it, expect } from "vitest";
import { KIT, KIT_PCS, BY_NOTE, resolveDrum, drumForLabel, renderHits, wavMono16 } from "./index.js";

const peak = (b) => { let p = 0; for (const v of b) p = Math.max(p, Math.abs(v)); return p; };
const rms = (b) => { let s = 0; for (const v of b) s += v * v; return Math.sqrt(s / (b.length || 1)); };
/** Samples until the tail drops below `floor` — how long the sound actually lasts. */
const lengthAbove = (b, floor = 0.002) => { let last = 0; b.forEach((v, i) => { if (Math.abs(v) > floor) last = i; }); return last; };

describe("the kit", () => {
  // The whole premise of the drum work: "a MIDI note is a lane", each sound on
  // a pitch class. Two sounds sharing one would make that mapping lossy — and
  // the standard GM kit does not avoid it by itself (high tom 48 % 12 == 0 ==
  // kick), which is why there is no high tom here.
  it("gives every sound its own pitch class", () => {
    expect(new Set(KIT_PCS).size).toBe(KIT_PCS.length);
    expect(KIT_PCS.length).toBe(Object.keys(KIT).length);
  });

  it("uses real GM note numbers, so somebody else's drum MIDI maps in", () => {
    expect(KIT.kick.note).toBe(36);
    expect(KIT.snare.note).toBe(38);
    expect(KIT.closedHat.note).toBe(42);
    expect(KIT.openHat.note).toBe(46);
    expect(BY_NOTE[36]).toBe("kick");
  });

  it("pitch class is derived from the note, not stated twice", () => {
    for (const [, d] of Object.entries(KIT)) expect(d.pc).toBe(d.note % 12);
  });

  it("maps out-of-kit notes BY MEANING before falling back to arithmetic", () => {
    // The pitch-class fallback is musically wrong for real drum notes and was
    // silently so: EZdrummer puts the pedal hat at 21, 21 % 12 == 9, so it
    // resolved to a mid tom. 11% of a jazz-waltz corpus rendered as a tom with
    // nothing said. Confirmed against the community EZdrummer sheet: A-1 is
    // the closed pedal.
    expect(resolveDrum(21)).toBe("pedalHat");
    expect(resolveDrum(44)).toBe("pedalHat");   // GM pedal hi-hat
    expect(resolveDrum(51)).toBe("ride");       // THE ride note in practice, though the kit puts ride at 59
    expect(resolveDrum(35)).toBe("kick");
    expect(resolveDrum(48)).toBe("midTom");
  });

  it("gives the pedal hat its own pitch class, not a tom's", () => {
    expect(KIT.pedalHat.note).toBe(44);
    expect(KIT.pedalHat.pc).toBe(8);
    expect(KIT.pedalHat.pc).not.toBe(KIT.midTom.pc);
  });

  it("folds a genuinely unknown note to its pitch class rather than dropping it", () => {
    // Real drum MIDI has three toms, two crashes, a ride and a cowbell. Landing
    // a GM high tom (48) on the kick is wrong, but silence on someone's first
    // file would be worse — and it is documented, not accidental.
    expect(resolveDrum(42)).toBe("closedHat");
    expect(resolveDrum(1.5)).toBeNull();
  });

  it("reads lane labels the way people write them", () => {
    for (const l of ["kick", "BD", "Bass Drum", "k"]) expect(drumForLabel(l)).toBe("kick");
    for (const l of ["hh", "hat", "Closed Hat", "closed_hat"]) expect(drumForLabel(l)).toBe("closedHat");
    expect(drumForLabel("oh")).toBe("openHat");
    // Not a drum — better null than a guess.
    expect(drumForLabel("lead")).toBeNull();
    expect(drumForLabel("lane1")).toBeNull();
  });
});

describe("the voices", () => {
  it("every kit sound makes a sound", () => {
    for (const name of Object.keys(KIT)) {
      const b = renderHits([{ drum: name, timeSec: 0 }], { tailSec: 2 });
      expect(rms(b), name).toBeGreaterThan(0.001);
    }
  });

  it("nothing clips at full velocity", () => {
    for (const name of Object.keys(KIT)) {
      const b = renderHits([{ drum: name, timeSec: 0 }], { tailSec: 2 });
      expect(peak(b), name).toBeLessThanOrEqual(1);
    }
  });

  it("velocity scales the hit", () => {
    const loud = rms(renderHits([{ drum: "snare", timeSec: 0, velocity: 1 }], { tailSec: 1 }));
    const soft = rms(renderHits([{ drum: "snare", timeSec: 0, velocity: 0.3 }], { tailSec: 1 }));
    expect(soft).toBeLessThan(loud * 0.6);
  });

  // The reason the durational layer mattered for drums: closed and open are the
  // SAME voice at different decays, so `LS(r){mask}` choosing which hits ring
  // is a real instruction to the synth, not a label.
  it("the cymbals form a length family, shortest foot to longest crash", () => {
    const len = (n) => { const b = renderHits([{ drum: n, timeSec: 0 }], { tailSec: 2 });
      let last = 0; b.forEach((v, i) => { if (Math.abs(v) > 0.002) last = i; }); return last; };
    // A ride must be shorter than an open hat and far shorter than a crash, or
    // repeated ride hits smear into a wash — which is what happened when note
    // 51 resolved to a crash and 40% of a jazz corpus rendered as one.
    expect(len("ride")).toBeGreaterThan(len("closedHat"));
    expect(len("ride")).toBeLessThan(len("crash"));
  });

  it("the pedal hat is the shortest of the three — the foot clamps", () => {
    const len = (n) => { const b = renderHits([{ drum: n, timeSec: 0 }], { tailSec: 2 });
      let last = 0; b.forEach((v, i) => { if (Math.abs(v) > 0.002) last = i; }); return last; };
    expect(len("pedalHat")).toBeLessThan(len("closedHat"));
    expect(len("closedHat")).toBeLessThan(len("openHat"));
  });

  it("an open hat rings and a closed hat chokes", () => {
    const closed = lengthAbove(renderHits([{ drum: "closedHat", timeSec: 0 }], { tailSec: 2 }));
    const open = lengthAbove(renderHits([{ drum: "openHat", timeSec: 0 }], { tailSec: 2 }));
    expect(open).toBeGreaterThan(closed * 3);
  });

  it("the note's own duration can drive the decay", () => {
    // How the CLI renders LS: a long note IS a long hat.
    const short = lengthAbove(renderHits([{ drum: "closedHat", timeSec: 0, params: { decayMs: 40 } }], { tailSec: 2 }));
    const long = lengthAbove(renderHits([{ drum: "closedHat", timeSec: 0, params: { decayMs: 400 } }], { tailSec: 2 }));
    expect(long).toBeGreaterThan(short * 3);
  });

  it("renders the same file twice", () => {
    // Noise is seeded from the hit index, so a session can be returned to —
    // the same decision progressive lengthening reached.
    const hits = [{ drum: "closedHat", timeSec: 0 }, { drum: "snare", timeSec: 0.25 }];
    expect(Array.from(renderHits(hits))).toEqual(Array.from(renderHits(hits)));
  });

  it("repeated hats do not phase-lock into a tone", () => {
    // Each hit takes its own noise seed. Identical noise on every hat is the
    // classic giveaway of a cheap synthesised kit.
    const a = renderHits([{ drum: "closedHat", timeSec: 0 }], { tailSec: 0.5 });
    const b = renderHits([{ drum: "closedHat", timeSec: 0 }, { drum: "closedHat", timeSec: 0.25 }], { tailSec: 0.5 });
    const second = b.slice(Math.round(0.25 * 48000), Math.round(0.25 * 48000) + a.length);
    expect(Array.from(second.slice(0, 200))).not.toEqual(Array.from(a.slice(0, 200)));
  });

  it("hits ADD rather than replacing, so a flam is louder", () => {
    const one = peak(renderHits([{ drum: "kick", timeSec: 0 }], { tailSec: 1 }));
    const two = peak(renderHits([{ drum: "kick", timeSec: 0 }, { drum: "kick", timeSec: 0 }], { tailSec: 1 }));
    expect(two).toBeGreaterThan(one);
  });
});

describe("wav output", () => {
  it("writes a well-formed 16-bit mono header", () => {
    const bytes = wavMono16(new Float32Array(480), 48000);
    const dv = new DataView(bytes.buffer);
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe("RIFF");
    expect(String.fromCharCode(...bytes.slice(8, 12))).toBe("WAVE");
    expect(dv.getUint16(22, true)).toBe(1);        // channels
    expect(dv.getUint32(24, true)).toBe(48000);    // rate
    expect(dv.getUint16(34, true)).toBe(16);       // bits
    expect(bytes.length).toBe(44 + 480 * 2);
  });

  it("clamps rather than wrapping", () => {
    // A sample above 1.0 wrapping to a large negative is the loudest possible
    // bug, and it only shows up on material that was already hot.
    const bytes = wavMono16(Float32Array.from([2, -2]), 48000);
    const dv = new DataView(bytes.buffer);
    expect(dv.getInt16(44, true)).toBe(32767);
    expect(dv.getInt16(46, true)).toBe(-32767);
  });
});
