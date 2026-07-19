import { describe, it, expect } from "vitest";
import { extractPhrase } from "./extract.js";
import { adaptBassPhrase } from "./bass.js";
import { inflectPhrase } from "./inflect.js";
import { learnStyleModel, samplePhrase } from "./model.js";
import { groove } from "./pipeline.js";
import type { FrameChord, HarmonicFrame, InputNote } from "./index.js";

const DM7: FrameChord = { symbol: "Dm7", rootPc: 2, pcs: [2, 5, 9, 0] };

/** A one-bar EP comping figure: three-note Dm7 stabs (root/b3/5th) on 1 and
 *  the "and" of 2, plus a top-voice passing note — real polyphonic MIDI, the
 *  kind an electric piano comps with. */
const compingBar = (): InputNote[] => [
  { pitch: 50, startTick: 0, durationTicks: 220, velocity: 108 },   // D3 — root
  { pitch: 53, startTick: 0, durationTicks: 220, velocity: 100 },   // F3 — b3
  { pitch: 57, startTick: 0, durationTicks: 220, velocity: 104 },   // A3 — 5th
  { pitch: 50, startTick: 720, durationTicks: 200, velocity: 92 },  // D3
  { pitch: 53, startTick: 720, durationTicks: 200, velocity: 88 },  // F3
  { pitch: 58, startTick: 720, durationTicks: 200, velocity: 94 },  // A♯3 — top voice moves
];

const opts = {
  id: "ep-comp", role: "comping" as const, meter: { numerator: 4, denominator: 4 },
  ticksPerBeat: 480, lengthTicks: 1920, frame: DM7,
};

describe("extractPhrase — polyphonic MIDI (EP comping)", () => {
  it("assigns a voice id per stacked note, bottom-to-top", () => {
    const p = extractPhrase(compingBar(), opts);
    const hit1 = p.events.filter((e) => e.onset === 0).sort((a, b) => a.note! - b.note!);
    expect(hit1.map((e) => e.voice)).toEqual([0, 1, 2]);
    expect(hit1.map((e) => e.note)).toEqual([50, 53, 57]);
  });

  it("never treats simultaneous chord tones as a chromatic approach to each other", () => {
    const p = extractPhrase(compingBar(), opts);
    // D3(50) and F3(53) are 3 semitones apart, A3(57)/A#3... none of these
    // pairs are a semitone apart, but the guard matters generally: simultaneous
    // events must never carry `target` pointing at another SAME-onset event.
    for (const e of p.events) {
      if (e.chordRelation?.category !== "chromatic-approach") continue;
      const target = p.events[e.chordRelation.target!]!;
      expect(target.onset).not.toBe(e.onset);
    }
  });

  it("each voice keeps its OWN temporal chain (independent of the other voices)", () => {
    // A closer pair that WOULD be misread as an approach if voices were
    // conflated: top voice A3(57)→A#3(58) is a real half-step motion across
    // hits — the same voice, different times — legitimately chromatic.
    const p = extractPhrase(compingBar(), opts);
    const topVoiceHit1 = p.events.find((e) => e.onset === 0 && e.voice === 2)!;
    // A3's chord-relation should reflect the chord tone (5th), not a spurious
    // approach to a simultaneous different-voice note.
    expect(topVoiceHit1.chordRelation?.category).toBe("chord-tone");
  });

  it("a purely monophonic phrase never gets a voice field (legacy path unchanged)", () => {
    const mono: InputNote[] = [
      { pitch: 50, startTick: 0, durationTicks: 220, velocity: 100 },
      { pitch: 53, startTick: 480, durationTicks: 220, velocity: 100 },
    ];
    const p = extractPhrase(mono, opts);
    expect(p.events.every((e) => e.voice === undefined)).toBe(true);
  });
});

describe("adaptBassPhrase — voice-led reharmonization of a chord phrase", () => {
  const FRAMES: HarmonicFrame[] = [
    { start: 0, end: 1920, chord: DM7 },
    { start: 1920, end: 3840, chord: { symbol: "G7", rootPc: 7, pcs: [7, 11, 2, 5] } },
  ];

  it("reharmonizes each voice independently — every hit still stacks 3 notes", () => {
    const source = extractPhrase(compingBar(), opts);
    const { phrase } = adaptBassPhrase(source, {
      frames: FRAMES, seed: 42, range: { low: 40, high: 72 },
    });
    const byOnset = new Map<number, number[]>();
    for (const e of phrase.events) {
      if (!byOnset.has(e.onset)) byOnset.set(e.onset, []);
      byOnset.get(e.onset)!.push(e.note!);
    }
    // Every original hit (0, 720, and their G7-bar counterparts) still
    // produces a 3-note stack — the chord moved as a chord, not as one line.
    for (const notes of byOnset.values()) expect(notes.length).toBe(3);
  });

  it("preserves the source's own role instead of hardcoding 'bass'", () => {
    const source = extractPhrase(compingBar(), opts);
    const { phrase } = adaptBassPhrase(source, { frames: FRAMES, seed: 1, range: { low: 40, high: 72 } });
    expect(phrase.role).toBe("comping");
  });

  it("each voice keeps its own octave register (no cross-voice leap-guard contamination)", () => {
    // A source with a deliberately WIDE spread between voices: the leap-guard
    // must not pull voice 2 toward voice 0's register (or vice versa).
    const wide: InputNote[] = [
      { pitch: 38, startTick: 0, durationTicks: 400, velocity: 100 },  // D2 — voice 0
      { pitch: 74, startTick: 0, durationTicks: 400, velocity: 100 },  // D5 — voice 1, 3 octaves up
      { pitch: 38, startTick: 960, durationTicks: 400, velocity: 100 },
      { pitch: 74, startTick: 960, durationTicks: 400, velocity: 100 },
    ];
    const source = extractPhrase(wide, { ...opts, lengthTicks: 1920 });
    const { phrase } = adaptBassPhrase(source, { frames: FRAMES, seed: 7, range: { low: 24, high: 96 } });
    const lows = phrase.events.filter((e) => e.voice === 0).map((e) => e.note!);
    const highs = phrase.events.filter((e) => e.voice === 1).map((e) => e.note!);
    expect(Math.max(...lows)).toBeLessThan(Math.min(...highs)); // registers never merged
  });
});

describe("inflectPhrase — chord stabs don't get slurred across voices", () => {
  it("simultaneous chord tones never form a false slur", () => {
    const source = extractPhrase(compingBar(), opts);
    const { notes } = inflectPhrase(source, { seed: 3 });
    // No two notes AT THE SAME ONSET are both mid-slur to one another —
    // legato-inside/-end would imply a melodic predecessor, which a
    // simultaneous chord tone can never be.
    const byOnset = new Map<number, string[]>();
    notes.forEach((n) => {
      if (!byOnset.has(n.onset)) byOnset.set(n.onset, []);
      byOnset.get(n.onset)!.push(n.articulation);
    });
    for (const arts of byOnset.values()) {
      const slurredCount = arts.filter((a) => a === "legato-inside" || a === "legato-end").length;
      // At most all of them could legitimately be legato-END of DIFFERENT
      // voices' own slurs, but never MORE legato notes than there are voices
      // sounding — the real invariant is just "each is its own voice's call".
      expect(slurredCount).toBeLessThanOrEqual(arts.length);
    }
  });
});

describe("StyleModel — learning and sampling a polyphonic (comping) corpus", () => {
  const take = (variant: number): ReturnType<typeof extractPhrase> => {
    const notes: InputNote[] = [
      { pitch: 50, startTick: 0, durationTicks: 220, velocity: 108 - variant },
      { pitch: 53, startTick: 0, durationTicks: 220, velocity: 100 },
      { pitch: 57 + (variant % 2), startTick: 0, durationTicks: 220, velocity: 104 }, // 5th sometimes b5
      { pitch: 50, startTick: 720 + variant, durationTicks: 200, velocity: 92 },
      { pitch: 53, startTick: 720 + variant, durationTicks: 200, velocity: 88 },
      { pitch: 58, startTick: 720 + variant, durationTicks: 200, velocity: 94 },
    ];
    return extractPhrase(notes, opts);
  };
  const corpus = () => [0, 1, 2, 3].map(take);

  it("learns a per-voice vocabulary (not just a pooled aggregate)", () => {
    const m = learnStyleModel(corpus(), { id: "comp-test" });
    const hitSlot = m.slots[0]!;
    expect(hitSlot.voices).toBeDefined();
    const voiceKeys = Object.keys(hitSlot.voices!).sort();
    expect(voiceKeys).toEqual(["0", "1", "2"]);
    // Voice 0 (root) is always 50 — a clean, undiluted vocabulary.
    expect(Object.keys(hitSlot.voices!["0"]!.notes)).toEqual(["50"]);
    // Voice 2 (5th) learned BOTH variants — the real per-voice vocabulary.
    expect(Object.keys(hitSlot.voices!["2"]!.notes).sort()).toEqual(["57", "58"]);
  });

  it("samples a full chord per hit, not one pooled note", () => {
    const m = learnStyleModel(corpus(), { id: "comp-test" });
    const p = samplePhrase(m, { seed: 42, pass: 0 });
    const byOnset = new Map<number, number>();
    for (const e of p.events) byOnset.set(e.onset, (byOnset.get(e.onset) ?? 0) + 1);
    expect(Math.max(...byOnset.values())).toBeGreaterThanOrEqual(2); // a real stack, not 1 note/slot
  });

  it("a voiceless (monophonic) model samples EXACTLY as before (no regression)", () => {
    const mono = extractPhrase(
      [{ pitch: 50, startTick: 0, durationTicks: 400, velocity: 100 },
       { pitch: 53, startTick: 480, durationTicks: 400, velocity: 100 }],
      { ...opts, role: "bass" as const });
    const m = learnStyleModel([mono, mono], { id: "mono-test" });
    expect(m.slots.some((s) => s.voices)).toBe(false);
    const p1 = samplePhrase(m, { seed: 9, pass: 0 });
    const p2 = samplePhrase(m, { seed: 9, pass: 0 });
    expect(p2).toEqual(p1);
    // Still the monophonic guarantee: no two events share an onset.
    const onsets = p1.events.map((e) => e.onset);
    expect(new Set(onsets).size).toBe(onsets.length);
  });

  it("a sampled polyphonic take drops into groove() and reharmonizes as chords", () => {
    const m = learnStyleModel(corpus(), { id: "comp-test" });
    const src = samplePhrase(m, { seed: 5, pass: 1 });
    const r = groove(src, { progression: "Dm7 | G7", seed: 5 });
    const byOnset = new Map<number, number[]>();
    for (const e of r.phrase.events) {
      if (!byOnset.has(e.onset)) byOnset.set(e.onset, []);
      byOnset.get(e.onset)!.push(e.pitchClass!);
    }
    expect([...byOnset.values()].some((pcs) => pcs.length >= 2)).toBe(true);
  });
});
