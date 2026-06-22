// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { createPcsRing, maskToPcs, pcsToMask } from "./pcs-ring.js";
import { createPitchGrid, layoutCells } from "./pitch-grid.js";
import { layoutNotes } from "./piano-roll.js";
import { createSection } from "./section.js";
import { createRangeSlider, midiName } from "./range-slider.js";
import { PITCH_CLASS_COLORS, padColor, padInk } from "./pitch-class-colors.js";

describe("pcs mask codec (leftmost = LSB, CONVENTIONS.md)", () => {
  it("C ionian 2741 decodes pc i = bit i", () => {
    expect([...maskToPcs(2741)].sort((a, b) => a - b)).toEqual([0, 2, 4, 5, 7, 9, 11]);
  });
  it("round-trips", () => {
    expect(pcsToMask(maskToPcs(0x92 << 4))).toBe(0x92 << 4);
    expect(pcsToMask([0])).toBe(0b000000000001);
    expect(pcsToMask([11])).toBe(0b100000000000);
  });
});

describe("pcs ring", () => {
  it("renders 12 segments and marks active ones", () => {
    const el = document.createElement("div");
    const ring = createPcsRing(el, { pcs: 2773, root: 0 });
    const paths = el.querySelectorAll("path");
    expect(paths).toHaveLength(12);
    expect(paths[0].getAttribute("fill")).toBe("var(--es-accent)");
    expect(paths[1].getAttribute("fill")).toBe("var(--es-bg-sunken)");
    expect(ring.mask).toBe(2773);
    expect(el.querySelectorAll("circle")).toHaveLength(1); // root marker
  });

  it("toggle callback fires with the next state", () => {
    const el = document.createElement("div");
    const onToggle = vi.fn();
    createPcsRing(el, { pcs: [0], onToggle });
    el.querySelector('path[data-pc="0"]').dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onToggle).toHaveBeenCalledWith(0, false);
    el.querySelector('path[data-pc="3"]').dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onToggle).toHaveBeenCalledWith(3, true);
  });

  it("update() re-renders", () => {
    const el = document.createElement("div");
    const ring = createPcsRing(el, { pcs: [] });
    ring.update({ pcs: [5], colorByPc: true });
    expect(el.querySelector('path[data-pc="5"]').getAttribute("fill")).toBe("var(--es-pc-5)");
  });
});

describe("pitch grid", () => {
  it("hex layout alternates row lengths and pitches isomorphically", () => {
    const cells = layoutCells({ layout: "hex", rows: 3, cols: 4, baseMidi: 48, rowStep: 5, colStep: 2 });
    expect(cells.filter((c) => c.row === 0)).toHaveLength(4);
    expect(cells.filter((c) => c.row === 1)).toHaveLength(3);
    const bottomLeft = cells.find((c) => c.row === 2 && c.col === 0);
    expect(bottomLeft.midi).toBe(48);
    expect(cells.find((c) => c.row === 1 && c.col === 0).midi).toBe(53); // +rowStep
    expect(cells.find((c) => c.row === 2 && c.col === 1).midi).toBe(50); // +colStep
  });

  it("square layout keeps full rows and highlights pcs", () => {
    const el = document.createElement("div");
    const grid = createPitchGrid(el, { layout: "square", rows: 2, cols: 3, highlight: [0] });
    expect(el.querySelectorAll("rect")).toHaveLength(6);
    const c48 = el.querySelector('rect[data-midi="48"]');
    expect(c48.getAttribute("fill")).toBe("var(--es-dim-breath)");
    grid.update({ highlight: [] });
    expect(el.querySelector('rect[data-midi="48"]').getAttribute("fill")).toBe("var(--es-bg-raised)");
  });

  it("hex Exquis geometry: NE = +4 (major 3rd), NW = +3 (minor 3rd), E = +1 (Q5)", () => {
    const cells = layoutCells({ layout: "hex", rows: 5, cols: 5, baseMidi: 48, rowStep: 4, colStep: 1 });
    const at = (r, c) => cells.find((x) => x.row === r && x.col === c);
    const base = at(2, 2);
    expect(at(1, 2).midi - base.midi).toBe(4); // NE major third
    expect(at(1, 1).midi - base.midi).toBe(3); // NW minor third
    expect(at(2, 3).midi - base.midi).toBe(1); // East semitone
  });

  it("square Q5 geometry: chromatic rows in fourths, 5×5 spans two octaves", () => {
    const cells = layoutCells({ layout: "square", rows: 5, cols: 5, baseMidi: 48, rowStep: 5, colStep: 1 });
    const at = (r, c) => cells.find((x) => x.row === r && x.col === c);
    expect(at(2, 0).midi - at(3, 0).midi).toBe(5); // a row up = a fourth
    expect(at(2, 1).midi - at(2, 0).midi).toBe(1); // a column right = a semitone
    const span = Math.max(...cells.map((c) => c.midi)) - Math.min(...cells.map((c) => c.midi));
    expect(span).toBe(24); // two octaves
  });

  it("chord-scale role overlay styles cells by role + glyph, not colour alone (Q5)", () => {
    const el = document.createElement("div");
    const roles = new Map([[0, "chord"], [2, "scale"], [4, "tension"], [5, "avoid"]]);
    createPitchGrid(el, { layout: "square", rows: 1, cols: 6, baseMidi: 48, colStep: 1, roles, now: [0] });
    const cell = (m) => el.querySelector(`rect[data-midi="${m}"]`);
    expect(cell(48).getAttribute("fill")).toBe("var(--es-accent)"); // chord solid
    expect(cell(50).getAttribute("stroke-dasharray")).toBeNull(); // scale solid outline
    expect(cell(52).getAttribute("stroke-dasharray")).toBe("2 2"); // tension dotted
    expect(cell(53).getAttribute("stroke-dasharray")).toBe("3 2"); // avoid dashed
    expect([...el.querySelectorAll("text")].some((t) => t.textContent === "⊘")).toBe(true); // avoid glyph
    expect(cell(48).classList.contains("es-pg-now")).toBe(true); // sounding pulse
  });

  it("colorByPc paints each cell by its pitch class (Exquis pad tokens)", () => {
    const el = document.createElement("div");
    createPitchGrid(el, { layout: "square", rows: 1, cols: 3, baseMidi: 48, colStep: 2, colorByPc: true });
    // 48=C(pc0), 50=D(pc2), 52=E(pc4)
    expect(el.querySelector('rect[data-midi="48"]').getAttribute("fill")).toBe("var(--es-pc-pad-0)");
    expect(el.querySelector('rect[data-midi="50"]').getAttribute("fill")).toBe("var(--es-pc-pad-2)");
    expect(el.querySelector("text").getAttribute("fill")).toBe("var(--es-pc-pad-ink-0)");
  });
});

describe("canonical pitch-class colours (Exquis Chromeful)", () => {
  it("has 12 entries, pc0 = yellow C with black ink", () => {
    expect(PITCH_CLASS_COLORS).toHaveLength(12);
    expect(PITCH_CLASS_COLORS[0]).toEqual({ name: "C", pad: "#f2f20d", ink: "#0d0d0d" });
    expect(padColor(1)).toBe("#7f0df2"); // C♯ purple
    expect(padInk(1)).toBe("#ffffff");   // white ink on purple
    expect(padInk(6)).toBe("#ffffff");   // white ink on blue F♯
  });
  it("wraps octaves", () => {
    expect(padColor(12)).toBe(padColor(0));
    expect(padColor(-1)).toBe(padColor(11));
  });
});

describe("piano roll layout (pure)", () => {
  const notes = [
    { startBeat: 0, lengthBeats: 2, pitch: 60, velocity: 100 },
    { startBeat: 2, lengthBeats: 2, pitch: 64 },
  ];

  it("maps beats to x and pitch to descending y", () => {
    const { rects, pxPerBeat } = layoutNotes(notes, { width: 400, height: 100, lengthBeats: 4 });
    expect(pxPerBeat).toBe(100);
    expect(rects[0].x).toBe(0);
    expect(rects[1].x).toBe(200);
    expect(rects[1].y).toBeLessThan(rects[0].y); // higher pitch sits higher
  });

  it("guarantees at least an octave of vertical range", () => {
    const { lo, hi } = layoutNotes([{ startBeat: 0, lengthBeats: 1, pitch: 60 }], { width: 100, height: 100 });
    expect(hi - lo).toBeGreaterThanOrEqual(12);
  });

  it("handles empty input", () => {
    expect(layoutNotes([], { width: 100, height: 100 }).rects).toEqual([]);
  });
});

describe("range slider (dual-thumb output range)", () => {
  it("midiName maps notes (middle C = C4)", () => {
    expect(midiName(60)).toBe("C4");
    expect(midiName(69)).toBe("A4");
    expect(midiName(0)).toBe("C-1");
  });

  it("renders two role=slider thumbs with aria values and a band", () => {
    const el = document.createElement("div");
    createRangeSlider(el, { min: 24, max: 96, values: [36, 84], format: midiName });
    const thumbs = el.querySelectorAll('[role="slider"]');
    expect(thumbs).toHaveLength(2);
    expect(thumbs[0].getAttribute("aria-valuenow")).toBe("36");
    expect(thumbs[1].getAttribute("aria-valuetext")).toBe("C6"); // 84
    expect(el.querySelector(".es-range-band")).not.toBeNull();
  });

  it("emits onChange and exposes values; update() re-renders", () => {
    const el = document.createElement("div");
    const onChange = vi.fn();
    const slider = createRangeSlider(el, { min: 0, max: 100, values: [25, 75], onChange });
    expect(onChange).toHaveBeenLastCalledWith(25, 75); // fires once on init
    expect(slider.values).toEqual([25, 75]);
    slider.update({ values: [10, 90] });
    expect(slider.values).toEqual([10, 90]);
  });

  it("keyboard: arrows step, shift jumps an octave, thumbs never cross", () => {
    const el = document.createElement("div");
    const onChange = vi.fn();
    const slider = createRangeSlider(el, { min: 0, max: 48, step: 1, values: [10, 12], onChange });
    const [lo, hi] = el.querySelectorAll('[role="slider"]');
    lo.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", shiftKey: true, bubbles: true }));
    // +12 would be 22, but the high thumb at 12 is the ceiling → pinned to 12
    expect(slider.values[0]).toBe(12);
    hi.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
    expect(slider.values[1]).toBe(48);
  });
});

describe("collapsible section", () => {
  it("builds the es-section shell and reports toggles", () => {
    const host = document.createElement("div");
    const onToggle = vi.fn();
    const { body, details } = createSection(host, { title: "Quantizer", open: false, onToggle });
    expect(details.className).toBe("es-section");
    expect(details.open).toBe(false);
    expect(details.querySelector("summary").textContent).toBe("Quantizer");
    body.textContent = "content";
    details.open = true;
    details.dispatchEvent(new Event("toggle"));
    expect(onToggle).toHaveBeenCalledWith(true);
  });
});
