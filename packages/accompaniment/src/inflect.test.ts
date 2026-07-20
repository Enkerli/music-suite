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

describe("inflectPhrase — accents (morphAccents/pass) and slides", () => {
  // Two bars, notes only on downbeat/half-bar positions (metric weight
  // >=0.75) so EVERY note actually reaches the sforzando-vs-marcato branch
  // — and none is the phrase's very last event (which always forces
  // marcato outright, bypassing the draw entirely).
  const loudBar = () => mk([
    { onset: 0, duration: 400, velocity: 118, note: 46 },     // bar 1 downbeat
    { onset: 960, duration: 400, velocity: 116, note: 50 },   // bar 1 half-bar
    { onset: 1920, duration: 400, velocity: 112, note: 53 },  // bar 2 downbeat
    { onset: 2880, duration: 400, velocity: 114, note: 57 },  // bar 2 half-bar (isLast → always marcato)
  ]);

  it("morphAccents=0 or no pass reproduces today's fixed per-seed choices exactly", () => {
    const noPass = inflectPhrase(loudBar(), { seed: 7 });
    const withPassNoMorph = inflectPhrase(loudBar(), { seed: 7, pass: 4 });
    expect(withPassNoMorph.notes.map((n) => n.articulation)).toEqual(noPass.notes.map((n) => n.articulation));
    const p0 = inflectPhrase(loudBar(), { seed: 7, pass: 0, morphAccents: 0 });
    const p5 = inflectPhrase(loudBar(), { seed: 7, pass: 5, morphAccents: 0 });
    expect(p5.notes.map((n) => n.articulation)).toEqual(p0.notes.map((n) => n.articulation));
  });

  it("morphAccents makes WHICH notes get sforzando vs marcato wander across passes", () => {
    const at = (pass: number) => inflectPhrase(loudBar(), { seed: 7, pass, morphAccents: 1 }).notes.map((n) => n.articulation);
    const p0 = at(0);
    let anyDiffer = false;
    for (let pass = 1; pass < 8; pass++) if (JSON.stringify(at(pass)) !== JSON.stringify(p0)) { anyDiffer = true; break; }
    expect(anyDiffer).toBe(true);
    // The choice stays within the same legal SET for each note the whole time
    // (accents don't turn a downbeat into a ghost — only sforzando<->marcato,
    // staccato<->tenuto wander).
    for (let pass = 0; pass < 8; pass++) {
      for (const n of at(pass)) expect(["sforzando", "marcato"]).toContain(n);
    }
  });

  it("is deterministic per (seed, pass, morphAccents)", () => {
    const a = inflectPhrase(loudBar(), { seed: 3, pass: 2, morphAccents: 0.6 });
    const b = inflectPhrase(loudBar(), { seed: 3, pass: 2, morphAccents: 0.6 });
    expect(a).toEqual(b);
  });

  it("slide=0 (default): no note ever carries glideMs — byte-identical to before slides existed", () => {
    const { notes } = inflectPhrase(windBar(), { seed: 7 });
    for (const n of notes) expect(n.glideMs).toBeUndefined();
  });

  it("slide=1 promotes EVERY eligible legato transition (legato-inside/-end) to a glide, never legato-start", () => {
    const { notes } = inflectPhrase(windBar(), { seed: 7, slide: 1 });
    const bySlur = notes.filter((n) => n.articulation.startsWith("legato"));
    expect(bySlur.some((n) => n.articulation === "legato-start")).toBe(true);
    for (const n of bySlur) {
      if (n.articulation === "legato-start") expect(n.glideMs).toBeUndefined();
      else expect(n.glideMs).toBe(120); // the default
    }
    // Non-legato notes never glide, no matter how high `slide` is.
    for (const n of notes) if (!n.articulation.startsWith("legato")) expect(n.glideMs).toBeUndefined();
  });

  it("glideMs option sets the promoted portamento time", () => {
    const { notes } = inflectPhrase(windBar(), { seed: 7, slide: 1, glideMs: 250 });
    const promoted = notes.find((n) => n.articulation === "legato-inside")!;
    expect(promoted.glideMs).toBe(250);
  });

  it("a fractional slide probability promotes SOME but not all eligible transitions, deterministically", () => {
    // A longer slurred passage to have several eligible transitions to split.
    const longSlur = mk([
      { onset: 0, duration: 200, velocity: 90, note: 48 },
      { onset: 240, duration: 200, velocity: 90, note: 50 },
      { onset: 480, duration: 200, velocity: 90, note: 52 },
      { onset: 720, duration: 200, velocity: 90, note: 53 },
      { onset: 960, duration: 200, velocity: 90, note: 55 },
      { onset: 1200, duration: 200, velocity: 90, note: 57 },
    ]);
    const { notes } = inflectPhrase(longSlur, { seed: 11, slide: 0.5 });
    const eligible = notes.filter((n) => n.articulation === "legato-inside" || n.articulation === "legato-end");
    expect(eligible.length).toBeGreaterThan(1);
    const promoted = eligible.filter((n) => n.glideMs !== undefined);
    expect(promoted.length).toBeGreaterThan(0);
    expect(promoted.length).toBeLessThan(eligible.length);
    // Deterministic: same seed → same specific notes promoted.
    const again = inflectPhrase(longSlur, { seed: 11, slide: 0.5 }).notes;
    expect(again.map((n) => n.glideMs)).toEqual(notes.map((n) => n.glideMs));
  });

  it("slide promotion is independent of morphAccents' stream (consuming one never shifts the other)", () => {
    const withoutSlide = inflectPhrase(loudBar(), { seed: 9, morphAccents: 1, pass: 3 }).notes.map((n) => n.articulation);
    const withSlide = inflectPhrase(loudBar(), { seed: 9, morphAccents: 1, pass: 3, slide: 0.7 }).notes.map((n) => n.articulation);
    expect(withSlide).toEqual(withoutSlide);
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

  // A stepwise-ascending source: after reharmonization against a static
  // chord, conjunct connected runs survive (unlike `src` above, whose big
  // repeated-note jumps and rest-gaps never slur) — reliable across seeds,
  // empirically confirmed.
  const stepwise = mk([
    { onset: 0, duration: 240, velocity: 100, note: 50 },
    { onset: 240, duration: 240, velocity: 100, note: 52 },
    { onset: 480, duration: 240, velocity: 100, note: 53 },
    { onset: 720, duration: 240, velocity: 100, note: 55 },
    { onset: 960, duration: 240, velocity: 100, note: 57 },
    { onset: 1200, duration: 240, velocity: 100, note: 58 },
    { onset: 1440, duration: 240, velocity: 100, note: 60 },
    { onset: 1680, duration: 240, velocity: 100, note: 62 },
  ]);

  it("slide writes CC5 (portamento time) + CC65 (portamento on) into the SMF, off again after", () => {
    const r = groove(stepwise, { progression: "Dm7", seed: 1, inflect: 1, slide: 1, glideMs: 300 });
    expect(r.inflections.some((n) => n.glideMs !== undefined)).toBe(true);
    const bytes = [...r.smf];
    const hasCC = (cc: number) => bytes.some((_, i) => bytes[i] === 0xb0 && bytes[i + 1] === cc);
    expect(hasCC(65)).toBe(true); // portamento on/off
    expect(hasCC(5)).toBe(true);  // portamento time
    // The scaled time from glideMs=300 (of a 0..2000 range) is present.
    const expectedTimeByte = Math.round((300 / 2000) * 127);
    expect(bytes.some((_, i) => bytes[i] === 0xb0 && bytes[i + 1] === 5 && bytes[i + 2] === expectedTimeByte)).toBe(true);
    // An explicit off follows a promoted slide before the next non-glide note.
    const onOffPairs = bytes.reduce((n, b, i) => n + (b === 0xb0 && bytes[i + 1] === 65 && bytes[i + 2] === 0 ? 1 : 0), 0);
    expect(onOffPairs).toBeGreaterThan(0);
  });

  it("slide off (default) → no portamento CCs at all, even with inflect on", () => {
    const r = groove(stepwise, { progression: "Dm7", seed: 1, inflect: 1 });
    const bytes = [...r.smf];
    expect(bytes.some((_, i) => bytes[i] === 0xb0 && (bytes[i + 1] === 65 || bytes[i + 1] === 5))).toBe(false);
  });
});
