import { describe, it, expect } from "vitest";
import { VoiceSplitter, splitChannel, MonoMerge } from "./index.js";

describe("VoiceSplitter", () => {
  it("round-robins across the span, wrapping back to the base channel", () => {
    const s = new VoiceSplitter();
    expect(s.next(3, 3)).toBe(3);
    expect(s.next(3, 3)).toBe(4);
    expect(s.next(3, 3)).toBe(5);
    expect(s.next(3, 3)).toBe(3); // wraps
  });

  it("clamps the result to MIDI channels 1..16", () => {
    const s = new VoiceSplitter();
    expect(s.next(15, 4)).toBe(15);
    expect(s.next(15, 4)).toBe(16);
    expect(s.next(15, 4)).toBe(16); // base+2=17, clamped
    expect(s.next(15, 4)).toBe(16); // base+3=18, clamped
    const s2 = new VoiceSplitter();
    expect(s2.next(0, 1)).toBe(1); // base below range clamps up
  });

  it("span=1 always returns the base channel (degenerate case, not an error)", () => {
    const s = new VoiceSplitter();
    expect(s.next(7, 1)).toBe(7);
    expect(s.next(7, 1)).toBe(7);
    expect(s.next(7, 1)).toBe(7);
  });

  it("reset() restarts the rotation from the first channel", () => {
    const s = new VoiceSplitter();
    s.next(1, 3); s.next(1, 3); // index now at 2
    s.reset();
    expect(s.next(1, 3)).toBe(1);
  });

  it("treats a fractional/zero span as at-least-1 (matches PitchFold's Math.max(1, splitVoices))", () => {
    const s = new VoiceSplitter();
    expect(s.next(5, 0)).toBe(5);
    expect(s.next(5, 0)).toBe(5);
    const s2 = new VoiceSplitter();
    expect(s2.next(5, 2.9)).toBe(5); // floors to 2
    expect(s2.next(5, 2.9)).toBe(6);
    expect(s2.next(5, 2.9)).toBe(5);
  });
});

describe("splitChannel — stateless equivalent", () => {
  it("agrees with an equivalently-advanced VoiceSplitter at every step", () => {
    const s = new VoiceSplitter();
    for (let i = 0; i < 10; i++) {
      expect(splitChannel(4, 3, i)).toBe(s.next(4, 3));
    }
  });

  it("clamps and floors the same way the stateful form does", () => {
    expect(splitChannel(15, 4, 2)).toBe(16); // 15+2=17, clamped
    expect(splitChannel(0, 1, 5)).toBe(1);
  });

  it("a negative priorCount still resolves to a valid in-rotation channel", () => {
    expect(splitChannel(1, 4, -1)).toBe(4); // -1 mod 4 == 3 (last slot)
  });
});

describe("MonoMerge — priority-based note stealing", () => {
  it("the first note attacks with nothing to release", () => {
    const m = new MonoMerge("last");
    expect(m.noteOn(60)).toEqual({ attack: 60, release: null });
  });

  it("'last' priority: a new note steals from whatever was sounding", () => {
    const m = new MonoMerge("last");
    m.noteOn(60);
    expect(m.noteOn(64)).toEqual({ attack: 64, release: 60 });
    expect(m.noteOn(67)).toEqual({ attack: 67, release: 64 });
  });

  it("releasing the sounding note falls back to the next-priority held note", () => {
    const m = new MonoMerge("last");
    m.noteOn(60); m.noteOn(64); m.noteOn(67); // 67 sounding, 60/64 held-but-silent
    expect(m.noteOff(67)).toEqual({ attack: 64, release: 67 }); // falls back to 64 (still "last" of what remains)
    expect(m.noteOff(64)).toEqual({ attack: 60, release: 64 });
    expect(m.noteOff(60)).toEqual({ attack: null, release: 60 }); // nothing left
  });

  it("releasing a held-but-silent note changes nothing audible", () => {
    const m = new MonoMerge("last");
    m.noteOn(60); m.noteOn(64); // 64 sounding
    expect(m.noteOff(60)).toEqual({ attack: null, release: null }); // 60 was never sounding
    expect(m.heldNotes).toEqual([64]);
  });

  it("'lowest' priority: a lower note always steals, a higher one never does", () => {
    const m = new MonoMerge("lowest");
    m.noteOn(60);
    expect(m.noteOn(72)).toEqual({ attack: null, release: null }); // higher — doesn't win, silently held
    expect(m.noteOn(48)).toEqual({ attack: 48, release: 60 }); // lower — steals
    expect(m.noteOff(48)).toEqual({ attack: 60, release: 48 }); // falls back to the next-lowest of what remains (60, not 72)
  });

  it("'highest' priority: mirrors 'lowest'", () => {
    const m = new MonoMerge("highest");
    m.noteOn(60);
    expect(m.noteOn(48)).toEqual({ attack: null, release: null });
    expect(m.noteOn(72)).toEqual({ attack: 72, release: 60 });
  });

  it("'first' priority: the earliest-held note always wins until it releases", () => {
    const m = new MonoMerge("first");
    m.noteOn(60);
    expect(m.noteOn(64)).toEqual({ attack: null, release: null });
    expect(m.noteOn(67)).toEqual({ attack: null, release: null });
    expect(m.noteOff(60)).toEqual({ attack: 64, release: 60 }); // 64 was held first among what remains
  });

  it("a duplicate note-on (already held, no intervening off) is a no-op — doesn't retrigger or reorder", () => {
    const m = new MonoMerge("last");
    m.noteOn(60); m.noteOn(64); // 64 sounding
    expect(m.noteOn(60)).toEqual({ attack: null, release: null }); // 60 already held; still not "last"
    expect(m.heldNotes).toEqual([60, 64]); // arrival order unchanged, not [64, 60]
  });

  it("setMode() re-evaluates the CURRENT held notes under the new rule, same decision shape as a note event", () => {
    const m = new MonoMerge("last");
    m.noteOn(60); m.noteOn(72); m.noteOn(48); // 48 sounding ("last")
    expect(m.setMode("lowest")).toEqual({ attack: null, release: null }); // 48 already both last AND lowest — no change
    expect(m.setMode("highest")).toEqual({ attack: 72, release: 48 }); // now 72 wins
    expect(m.mode).toBe("highest");
  });

  it("setMode() to the same effective winner is a genuine no-op", () => {
    const m = new MonoMerge("last");
    m.noteOn(60);
    expect(m.setMode("first")).toEqual({ attack: null, release: null }); // only one note held — same either way
  });

  it("releaseAll() clears everything and reports what was sounding, if anything", () => {
    const m = new MonoMerge("last");
    expect(m.releaseAll()).toBeNull(); // nothing held yet
    m.noteOn(60); m.noteOn(64);
    expect(m.releaseAll()).toBe(64);
    expect(m.heldNotes).toEqual([]);
    expect(m.noteOn(72)).toEqual({ attack: 72, release: null }); // starts fresh, not stuck
  });

  it("heldNotes is a defensive copy — mutating it never affects internal state", () => {
    const m = new MonoMerge("last");
    m.noteOn(60);
    const held = m.heldNotes;
    held.push(999);
    expect(m.heldNotes).toEqual([60]);
  });
});
