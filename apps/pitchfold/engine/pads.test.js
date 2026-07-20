import { describe, it, expect } from "vitest";
import { activePcs } from "./pads.js";

const IONIAN = 0x0AB5;
const DORIAN = 0x06AD;

describe("activePcs — pad override (docs/PITCHFOLD_AUDIT.md)", () => {
  it("falls back to the main scale when no pad is selected", () => {
    const state = { pcsMask: IONIAN, pcsRoot: 0, pads: [
      { index: 0, mask: DORIAN, root: 2, selected: false },
    ] };
    expect(activePcs(state)).toEqual({ mask: IONIAN, root: 0 });
  });

  it("falls back to the main scale when pads is missing entirely", () => {
    expect(activePcs({ pcsMask: IONIAN, pcsRoot: 0 })).toEqual({ mask: IONIAN, root: 0 });
  });

  it("a selected pad's own mask/root wins over the main scale — the bug this fixes", () => {
    const state = { pcsMask: IONIAN, pcsRoot: 0, pads: [
      { index: 0, mask: DORIAN, root: 2, selected: true },
      { index: 1, mask: IONIAN, root: 0, selected: false },
    ] };
    expect(activePcs(state)).toEqual({ mask: DORIAN, root: 2 });
  });

  it("respects radio selection: only the first matching pad wins if state is ever inconsistent", () => {
    const state = { pcsMask: IONIAN, pcsRoot: 0, pads: [
      { index: 0, mask: DORIAN, root: 2, selected: true },
      { index: 1, mask: 0x0555, root: 5, selected: true }, // shouldn't happen, but don't crash
    ] };
    expect(activePcs(state)).toEqual({ mask: DORIAN, root: 2 });
  });

  it("deselecting (no pad.selected true) reverts to the main scale live", () => {
    const state = { pcsMask: IONIAN, pcsRoot: 0, pads: [
      { index: 0, mask: DORIAN, root: 2, selected: false },
    ] };
    expect(activePcs(state)).toEqual({ mask: IONIAN, root: 0 });
  });
});
