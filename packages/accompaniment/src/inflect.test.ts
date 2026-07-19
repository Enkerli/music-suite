import { describe, it, expect } from "vitest";
import { inflectPhrase } from "./inflect.js";
import { groove } from "./pipeline.js";
import type { AccompanimentPhrase, PhraseEvent } from "./phrase.js";

const mk = (events: PhraseEvent[]): AccompanimentPhrase => ({
  v: 1, id: "t", role: "bass", meter: { numerator: 4, denominator: 4 },
  ticksPerBeat: 480, lengthTicks: 1920, events,
  provenance: { kind: "generated" }, annotations: {},
});

/** The user's own scenario: a sforzando, then staccato, then a legato slur,
 *  ending on marcato — one bar of wind phrasing. */
const windBar = () => mk([
  { onset: 0, duration: 400, velocity: 118, note: 46 },      // loud downbeat
  { onset: 480, duration: 120, velocity: 80, note: 53 },     // short weak → staccato
  { onset: 960, duration: 230, velocity: 96, note: 50 },     // slur: 50→52→53 conjunct+connected
  { onset: 1200, duration: 230, velocity: 96, note: 52 },
  { onset: 1440, duration: 220, velocity: 96, note: 53 },
  { onset: 1680, duration: 230, velocity: 110, note: 58 },   // strong-ish final → marcato
]);

describe("inflectPhrase — the wind player's grammar", () => {
  it("sforzando/marcato on the loud downbeat, staccato on the weak short, slurs joined, marcato last", () => {
    const { notes } = inflectPhrase(windBar(), { seed: 7 });
    expect(["sforzando", "marcato"]).toContain(notes[0]!.articulation);
    expect(notes[1]!.articulation).toBe("staccato");
    expect(notes[2]!.articulation).toBe("legato-start");
    expect(notes[3]!.articulation).toBe("legato-inside");
    expect(notes[4]!.articulation).toBe("legato-end");
    expect(notes[5]!.articulation).toBe("marcato");
  });

  it("slur mechanics: joined durations, no re-tonguing inside", () => {
    const r = inflectPhrase(windBar(), { seed: 7 });
    const e2 = r.phrase.events[2]!, e3 = r.phrase.events[3]!;
    // legato-start reaches (a hair past) the next onset — the notes touch.
    expect(e2.onset + e2.duration).toBeGreaterThanOrEqual(1200);
    expect(e3.onset + e3.duration).toBeGreaterThanOrEqual(1440);
    expect(r.notes[3]!.attack).toBe(0); // inside a slur: no transient
    expect(r.notes[4]!.attack).toBe(0);
    expect(r.notes[0]!.attack).toBeGreaterThan(1); // the sfz/marcato tongue bites
  });

  it("every note gets its own envelope: valid breakpoints, velocity carried in", () => {
    const { notes } = inflectPhrase(windBar(), { seed: 7 });
    for (const n of notes) {
      expect(n.envelope.length).toBeGreaterThanOrEqual(2);
      expect(n.envelope[0]!.at).toBe(0);
      expect(n.envelope[n.envelope.length - 1]!.at).toBe(1);
      for (const p of n.envelope) expect(p.value).toBeGreaterThanOrEqual(0);
      for (const p of n.envelope) expect(p.value).toBeLessThanOrEqual(1);
    }
    // A sforzando falls after the bite then swells back.
    const sfz = notes.find((n) => n.articulation === "sforzando");
    if (sfz) {
      expect(sfz.envelope[1]!.value).toBeLessThan(sfz.envelope[0]!.value);
      expect(sfz.envelope[2]!.value).toBeGreaterThan(sfz.envelope[1]!.value);
    }
    // A marcato releases clean: last point well under its peak.
    const marc = notes.find((n) => n.articulation === "marcato")!;
    expect(marc.envelope[marc.envelope.length - 1]!.value).toBeLessThan(marc.envelope[0]!.value * 0.5);
  });

  it("ghosts stay ghosts: quiet notes get the low puff", () => {
    const { notes } = inflectPhrase(mk([
      { onset: 0, duration: 400, velocity: 110, note: 46 },
      { onset: 720, duration: 90, velocity: 40, note: 46 }, // the funk ghost
    ]), { seed: 1 });
    expect(notes[1]!.articulation).toBe("ghost");
    expect(Math.max(...notes[1]!.envelope.map((p) => p.value))).toBeLessThan(0.25);
  });

  it("deterministic by seed; intensity 0 is inert (flat envelopes, no gate change)", () => {
    const a = inflectPhrase(windBar(), { seed: 5 });
    const b = inflectPhrase(windBar(), { seed: 5 });
    expect(b).toEqual(a);
    const flat = inflectPhrase(windBar(), { seed: 5, intensity: 0 });
    for (const n of flat.notes) {
      const breath = windBar().events[n.index]!.velocity / 127;
      for (const p of n.envelope) expect(p.value).toBeCloseTo(breath, 10);
      expect(n.attack).toBe(0);
    }
    // Non-legato durations untouched at intensity 0.
    expect(flat.phrase.events[0]!.duration).toBe(400);
    expect(flat.phrase.events[1]!.duration).toBe(120);
  });
});

describe("inflect through groove()", () => {
  const src = mk([
    { onset: 0, duration: 400, velocity: 112, note: 45 },
    { onset: 480, duration: 200, velocity: 84, note: 45 },
    { onset: 960, duration: 400, velocity: 100, note: 52 },
    { onset: 1440, duration: 400, velocity: 108, note: 45 },
  ]);

  it("opts.inflect populates inflections and writes CC2 curves into the SMF", () => {
    const r = groove(src, { progression: "Dm7 | G7", seed: 42, inflect: 1 });
    expect(r.inflections.length).toBe(r.phrase.events.length);
    const bytes = [...r.smf];
    // CC2 events present (0xB0, controller 2), and breath precedes note-on at tick 0.
    const ccIdx = bytes.findIndex((_, i) => bytes[i] === 0xb0 && bytes[i + 1] === 2);
    const onIdx = bytes.findIndex((_, i) => bytes[i] === 0x90);
    expect(ccIdx).toBeGreaterThan(-1);
    expect(ccIdx).toBeLessThan(onIdx);
  });

  it("inflect off → byte-identical to before (a frozen-vector guarantee)", () => {
    const a = groove(src, { progression: "Dm7 | G7", seed: 42 });
    const b = groove(src, { progression: "Dm7 | G7", seed: 42, inflect: 0 });
    expect(b.smf).toEqual(a.smf);
    expect(a.inflections).toEqual([]);
  });
});
