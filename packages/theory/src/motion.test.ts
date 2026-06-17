import { describe, expect, it } from "vitest";
import { transitionMotion } from "./motion.js";

// Pitch classes in C: C=0 D=2 E=4 F=5 G=7 A=9 B=11.
const C = 0;

describe("transitionMotion — root-motion character (Q4)", () => {
  it("G→C (V→I) is a notable fifth", () => {
    expect(transitionMotion(7, 0, C, "major")).toEqual({ motion: "fifth", notable: true });
  });

  it("D→G (ii→V) is a notable fifth", () => {
    expect(transitionMotion(2, 7, C, "major")).toEqual({ motion: "fifth", notable: true });
  });

  it("C→D (a diatonic whole step) is a step, NOT notable", () => {
    expect(transitionMotion(0, 2, C, "major")).toEqual({ motion: "step", notable: false });
  });

  it("C→D♭ (a chromatic half step) is a notable step", () => {
    expect(transitionMotion(0, 1, C, "major")).toEqual({ motion: "step", notable: true });
  });

  it("C→E (a diatonic third) is a third, not notable", () => {
    expect(transitionMotion(0, 4, C, "major")).toEqual({ motion: "third", notable: false });
  });

  it("a tritone root move is marked notable when chromatic", () => {
    // C→F♯: F♯ is off the C-major scale → notable.
    expect(transitionMotion(0, 6, C, "major")).toEqual({ motion: "tritone", notable: true });
  });

  it("a repeated root is neither motion nor notable", () => {
    expect(transitionMotion(7, 7, C, "major")).toEqual({ motion: "repeat", notable: false });
  });
});
