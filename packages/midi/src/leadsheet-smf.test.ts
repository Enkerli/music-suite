import { describe, expect, it } from "vitest";
import { parseLeadsheet, type KeyContext } from "@enkerli/theory";
import { progressionFromSMF, progressionToSMF, readMetaTextEvents } from "./index.js";

const C: KeyContext = { tonic: "C", mode: "major" };

describe("leadsheet ↔ SMF round-trip", () => {
  it("recovers the exact progression from the SMF it wrote", () => {
    const text = "C7(∆7,9) A13♯9/D | F6(♯9)/D C∆13sus4/D | F∆9♯11/C A13♭9(add♭13) | C∆11 F∆11/C";
    const prog = parseLeadsheet(text, C);
    const back = progressionFromSMF(progressionToSMF(prog));
    expect(back).toEqual(prog); // JSON-exact: the embedded payload round-trips
  });

  it("preserves degree-authored chords (key + numerals survive)", () => {
    const prog = parseLeadsheet("IIm7 V7 | Imaj7", { tonic: "F♯", mode: "major" });
    const back = progressionFromSMF(progressionToSMF(prog))!;
    expect(back.key).toEqual({ tonic: "F♯", mode: "major" });
    expect(back.sections[0]!.bars[0]!.chords[0]).toMatchObject({
      source: "degree",
      degree: { numeral: "II", suffix: "m7" },
    });
  });

  it("writes DAW-visible chord-symbol markers and a playable clip", () => {
    const prog = parseLeadsheet("Dm7 G7 | Cmaj7", C);
    const bytes = progressionToSMF(prog, { bpm: 100 });
    const metas = readMetaTextEvents(bytes);
    const markers = metas.filter((m) => m.metaType === 0x06).map((m) => m.text);
    expect(markers).toEqual(["Dm7", "G7", "Cmaj7"]);
    // the marker for the 3rd chord lands a bar in (2 chords × 2 beats × 480)
    const cmaj7 = metas.find((m) => m.metaType === 0x06 && m.text === "Cmaj7");
    expect(cmaj7!.tick).toBe(2 * 2 * 480);
    // and there are actual note-on bytes (a real, auditionable file)
    expect(bytes.some((_, i) => (bytes[i]! & 0xf0) === 0x90)).toBe(true);
  });

  it("returns null for an SMF with no progression payload", () => {
    // a header-only stub carries no MTrk payload
    const stub = new Uint8Array([0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 1, 0xe0]);
    expect(progressionFromSMF(stub)).toBeNull();
  });
});
