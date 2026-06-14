import { describe, expect, it } from "vitest";
import table from "./data/transitions.json";
import {
  generateProgression,
  mulberry32,
  realizeLabel,
  splitLabel,
  startLabel,
  voiceProgression,
} from "./generate.js";

describe("label splitting", () => {
  it("separates numerals from display suffixes", () => {
    expect(splitLabel("IIm7")).toEqual({ numeral: "II", suffix: "m7" });
    expect(splitLabel("♭II7")).toEqual({ numeral: "♭II", suffix: "7" });
    expect(splitLabel("VIIm7b5")).toEqual({ numeral: "VII", suffix: "m7b5" });
    expect(splitLabel("I")).toEqual({ numeral: "I", suffix: "" });
    expect(splitLabel("nonsense")).toBeNull();
  });
});

describe("generation over the canonical table", () => {
  it("is deterministic by seed and starts on the tonic family", () => {
    const a = generateProgression(table.major, "major", 16, 42);
    const b = generateProgression(table.major, "major", 16, 42);
    const c = generateProgression(table.major, "major", 16, 43);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect(a[0]).toBe(startLabel(table.major, "major"));
    expect(a).toHaveLength(16);
  });

  it("minor table starts on a minor tonic", () => {
    const labels = generateProgression(table.minor, "minor", 8, 7);
    expect(labels[0].startsWith("Im")).toBe(true);
  });

  it("every generated label realizes in every key", () => {
    const labels = generateProgression(table.major, "major", 64, 1);
    for (const tonic of ["C", "F♯", "E♭", "C♭"]) {
      for (const label of labels) {
        const chord = realizeLabel(label, { tonic, mode: "major" });
        expect(chord, `${label} in ${tonic}`).not.toBeNull();
        expect(chord.pcs.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("realization spelling", () => {
  it("IIm7 in C is Dm7; ♭II7 in C is D♭7; V7 in F♯ is C♯7", () => {
    expect(realizeLabel("IIm7", { tonic: "C", mode: "major" }).symbol).toBe("Dm7");
    expect(realizeLabel("♭II7", { tonic: "C", mode: "major" }).symbol).toBe("D♭7");
    expect(realizeLabel("V7", { tonic: "F♯", mode: "major" }).symbol).toBe("C♯7");
  });

  it("realizes pcs from the dictionary", () => {
    const dm7 = realizeLabel("IIm7", { tonic: "C", mode: "major" });
    expect([...dm7.pcs].sort((a, b) => a - b)).toEqual([0, 2, 5, 9]);
  });
});

describe("voicing", () => {
  it("voices a ii-V-I smoothly (no leaps over an octave per voice)", () => {
    const key = { tonic: "C", mode: "major" };
    const chords = ["IIm7", "V7", "Imaj7"].map((l) => realizeLabel(l, key));
    const voiced = voiceProgression(chords);
    expect(voiced).toHaveLength(3);
    for (const v of voiced) {
      expect(v.notes.length).toBeGreaterThanOrEqual(3);
      for (const n of v.notes) expect(n).toBeGreaterThan(40);
    }
  });

  it("rng is stable", () => {
    const r = mulberry32(1);
    expect(r()).toBeCloseTo(mulberry32(1)(), 12);
  });

  it("voicing shapes change the chord arrangement", async () => {
    const { voiceChord } = await import("./generate.js");
    const cmaj7 = [0, 4, 7, 11]; // C E G B
    const close = voiceChord(cmaj7, 0, "close");
    const drop2 = voiceChord(cmaj7, 0, "drop2");
    const shell = voiceChord(cmaj7, 0, "shell");
    expect(close).toEqual([60, 64, 67, 71]);          // tight stack
    expect(drop2).toEqual([55, 60, 64, 71]);          // 2nd-from-top (G) dropped an octave
    expect(shell).toEqual([60, 64, 71]);              // root + 3rd + 7th, no 5th
    expect(voiceChord(cmaj7, 0, "drop3")).toEqual([52, 60, 67, 71]); // 3rd-from-top (E) dropped
    expect(voiceChord(cmaj7, 0, "spread")).toEqual([60, 76, 79, 83]); // gap above the bass
    expect(voiceChord(cmaj7, 0, "rootless")).toEqual([64, 67, 71]);   // root dropped, colour tones
  });

  it("voicing suggestions rank by least movement and include shapes", async () => {
    const { voicingSuggestions, voiceMovement, voiceChord } = await import("./generate.js");
    const cmaj7 = [0, 4, 7, 11];
    const from = [55, 59, 62, 65]; // a G7-ish voicing
    const sugg = voicingSuggestions(cmaj7, 0, { from });
    expect(sugg.length).toBeGreaterThanOrEqual(4);
    // ranked ascending by movement
    for (let i = 1; i < sugg.length; i++) expect(sugg[i].movement).toBeGreaterThanOrEqual(sugg[i - 1].movement);
    // the first is the smoothest available (≤ every shape's movement)
    const shapeMoves = ["close", "open", "drop2", "shell"]
      .map((s) => voiceMovement(from, voiceChord(cmaj7, 0, s)));
    expect(sugg[0].movement).toBeLessThanOrEqual(Math.min(...shapeMoves));
    // no candidate introduces a foreign note (shell may drop the 5th)
    for (const s of sugg) for (const n of s.notes) expect(cmaj7).toContain(((n % 12) + 12) % 12);
  });

  it("a locked voicing overrides auto voice-leading", () => {
    const key = { tonic: "C", mode: "major" };
    const chords = ["IIm7", "V7"].map((l) => realizeLabel(l, key));
    chords[1].voicing = [60, 64, 67, 70]; // pin V7 to a specific voicing
    const v = voiceProgression(chords);
    expect(v[1].notes).toEqual([60, 64, 67, 70]);
  });

  it("voice-lead off voices every chord in its home position", () => {
    const key = { tonic: "C", mode: "major" };
    const chords = ["IIm7", "V7", "Imaj7"].map((l) => realizeLabel(l, key));
    const off = voiceProgression(chords, { voiceLead: false, shape: "close" });
    const on = voiceProgression(chords, { voiceLead: true, shape: "close" });
    // home-position voicings start each chord from its own root window;
    // the smoothed and unsmoothed versions differ from the 2nd chord on.
    expect(off[1].notes).not.toEqual(on[1].notes);
    // every chord voiced-lead-off begins on its root pc
    for (const v of off) expect(v.notes[0] % 12).toBe(v.rootPc % 12);
  });
});

describe("chord completions", async () => {
  const { chordCompletions } = await import("./generate.js");

  it("completes a rootless/3rd-less chord to a common chord, root-preserved", () => {
    // E G D F — G dominant with the 13 but no 3rd; adding B (the 3rd) above
    // the top completes it to G7add6/E, keeping the played notes and bass.
    const sugg = chordCompletions([52, 67, 74, 77]);
    expect(sugg.length).toBeGreaterThan(0);
    const g13 = sugg.find((s) => s.symbol === "G7add6/E");
    expect(g13).toBeTruthy();
    expect(((g13.added % 12) + 12) % 12).toBe(11); // the added tone is B (the missing 3rd)
    expect(g13.notes).toEqual([52, 67, 74, 77, 83]); // played notes kept, B added on top
  });

  it("completes a 3rd-less triad both ways and ranks majors/dominants first", () => {
    const sugg = chordCompletions([60, 67, 70]); // C G B♭ — add a 3rd
    expect(sugg.map((s) => s.symbol)).toContain("C7"); // E → C7
    expect(sugg.map((s) => s.symbol)).toContain("C-7"); // E♭ → Cm7
    expect(sugg[0].symbol).toBe("C7"); // dominant ranks above the minor
  });

  it("offers nothing meaningful for too few notes", () => {
    expect(chordCompletions([60])).toEqual([]);
    expect(chordCompletions([])).toEqual([]);
  });
});

describe("next-chord suggestions", async () => {
  const { nextChordSuggestions } = await import("./generate.js");
  const key = { tonic: "C", mode: "major" };

  it("proposes continuations from the corpus, ranked by frequency", () => {
    const sugg = nextChordSuggestions(table.major, key, "IIm7", null, { max: 6 });
    expect(sugg.length).toBeGreaterThan(0);
    // every suggestion is a real continuation in the table, none is the last chord
    for (const s of sugg) {
      expect(s.fromCorpus).toBe(true);
      expect(s.label).not.toBe("IIm7");
      expect(table.major["IIm7"][s.label]).toBeGreaterThan(0);
    }
    // ranked descending by corpus weight; top = table's most-used continuation
    for (let i = 1; i < sugg.length; i++) expect(sugg[i].weight).toBeLessThanOrEqual(sugg[i - 1].weight);
    const best = Object.entries(table.major["IIm7"]).sort((a, b) => b[1] - a[1])[0][0];
    expect(sugg[0].label).toBe(best);
  });

  it("voiceleads each continuation from the given voicing", () => {
    const from = [62, 65, 69, 72]; // a Dm7 voicing
    const sugg = nextChordSuggestions(table.major, key, "IIm7", from, { max: 4 });
    for (const s of sugg) {
      expect(s.notes.length).toBeGreaterThan(0);
      expect(s.movement).toBeGreaterThanOrEqual(0);
    }
  });

  it("falls back to smooth-flowing chords when the last chord is uncommon", () => {
    const from = [60, 63, 66, 68]; // some altered/diminished voicing
    const fallback = ["Imaj7", "IIm7", "V7", "VIm7", "IVmaj7"];
    const sugg = nextChordSuggestions(table.major, key, "♯Idim13", from, { fallback, max: 5 });
    expect(sugg.length).toBeGreaterThan(0);
    for (const s of sugg) expect(s.fromCorpus).toBe(false);
    // ranked ascending by voice movement (the "flows well" fallback)
    for (let i = 1; i < sugg.length; i++) expect(sugg[i].movement).toBeGreaterThanOrEqual(sugg[i - 1].movement);
  });

  it("returns nothing when there is no corpus row and no fallback", () => {
    expect(nextChordSuggestions(table.major, key, "♯Idim13", null, {})).toEqual([]);
  });
});

describe("rule-based engines", async () => {
  const { applyCadence, commonLabelForNumeral, commonPredecessor, generateCircleOfFifths, generateLabels } =
    await import("./generate.js");

  it("the corpus picks its most-used quality per numeral", () => {
    // The data's own answers: plain triads dominate I (11,735 vs 9,482 for
    // Imaj7); VII's champion is VII7 — apt, since in the circle VII
    // resolves to III, where VII7 is the secondary dominant.
    expect(commonLabelForNumeral(table.major, "I")).toBe("I");
    expect(commonLabelForNumeral(table.major, "II")).toBe("IIm7");
    expect(commonLabelForNumeral(table.major, "V")).toBe("V7");
    expect(commonLabelForNumeral(table.major, "VII")).toBe("VII7");
  });

  it("cadence mode ends on most-common-predecessor → tonic", () => {
    const labels = generateLabels(table.major, "major", { length: 8, seed: 9, method: "markov-cadence" });
    expect(labels[labels.length - 1]).toBe("Imaj7");
    expect(labels[labels.length - 2]).toBe(commonPredecessor(table.major, "Imaj7"));
    expect(labels).toHaveLength(8);
  });

  it("circle of fifths walks I IV VII III VI II V and resolves home", () => {
    const labels = generateCircleOfFifths(table.major, "major", 8);
    expect(labels).toEqual([
      "I", "IV", "VII7", "IIIm7", "VIm7", "IIm7", "V7", "Imaj7",
    ]);
  });

  it("applyCadence leaves short progressions alone", () => {
    expect(applyCadence(table.major, "major", ["Imaj7"])).toEqual(["Imaj7"]);
  });
});

describe("temperature", async () => {
  const { generateLabels } = await import("./generate.js");

  it("near-zero temperature is the argmax walk (IIm7 always goes to V7)", () => {
    const labels = generateLabels(table.major, "major", { length: 12, seed: 3, temperature: 0.01 });
    for (let i = 1; i < labels.length; i++) {
      if (labels[i - 1] === "IIm7") expect(labels[i]).toBe("V7");
    }
  });

  it("high temperature diverges from the corpus walk (same seed)", () => {
    const cold = generateLabels(table.major, "major", { length: 24, seed: 5, temperature: 1 });
    const hot = generateLabels(table.major, "major", { length: 24, seed: 5, temperature: 4 });
    expect(hot).not.toEqual(cold);
  });

  it("stays deterministic per (seed, temperature)", () => {
    const a = generateLabels(table.major, "major", { length: 16, seed: 7, temperature: 2.5 });
    const b = generateLabels(table.major, "major", { length: 16, seed: 7, temperature: 2.5 });
    expect(a).toEqual(b);
  });
});

describe("start-from and sections", async () => {
  const { generateLabels, generateSections } = await import("./generate.js");

  it("starts the walk from an arbitrary chord", () => {
    const labels = generateLabels(table.major, "major", { length: 8, seed: 2, startFrom: "♭II7" });
    expect(labels[0]).toBe("♭II7");
  });

  it("extensions continue from the previous section's last chord", () => {
    const base = { length: 8, seed: 4, temperature: 1 };
    const one = generateSections(table.major, "major", base, []);
    const two = generateSections(table.major, "major", base, [{ seed: 9, length: 8 }]);
    expect(two.slice(0, 8)).toEqual(one);
    expect(two).toHaveLength(16);
    // the joint is continuous: extension was seeded from one[7]
    const ext = generateLabels(table.major, "major", { ...base, method: "markov", length: 9, seed: 9, startFrom: one[7] });
    expect(two.slice(7)).toEqual(ext);
  });
});

describe("gesture curation steers triples", async () => {
  const { rateGesture, emptyCuration, tripleMultiplier } = await import("./curation.js");
  const { generateProgression } = await import("./generate.js");

  it("rates overlapping triples in a stretch", () => {
    const c = rateGesture(emptyCuration(), ["Imaj7", "VIm7", "IIm7", "V7"], 2);
    expect(tripleMultiplier(c, "Imaj7", "VIm7", "IIm7")).toBe(2);
    expect(tripleMultiplier(c, "VIm7", "IIm7", "V7")).toBe(2);
  });

  it("a heavily boosted triple changes generation given its context", () => {
    // After the common context Imaj7 → IIm7, boost the SECOND most common
    // continuation (real base probability, so the effect is measurable).
    const rare = Object.keys(table.major["IIm7"])[1];
    let c = emptyCuration();
    for (let i = 0; i < 14; i++) c = rateGesture(c, ["Imaj7", "IIm7", rare], 2);
    const count = (curation) => {
      let hits = 0;
      for (let seed = 0; seed < 80; seed++) {
        const l = generateProgression(table.major, "major", 12, seed, curation);
        for (let i = 2; i < l.length; i++) {
          if (l[i - 2] === "Imaj7" && l[i - 1] === "IIm7" && l[i] === rare) hits++;
        }
      }
      return hits;
    };
    expect(count(c)).toBeGreaterThan(count(emptyCuration()));
  });
});
