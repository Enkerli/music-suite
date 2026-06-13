// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { createPcsRing, maskToPcs, pcsToMask } from "./pcs-ring.js";
import { createPitchGrid, layoutCells } from "./pitch-grid.js";
import { layoutNotes } from "./piano-roll.js";
import { createSection } from "./section.js";
import { createRangeSlider, midiName } from "./range-slider.js";

describe("pcs mask codec (MSB-first, CONVENTIONS.md)", () => {
  it("C ionian 2773 decodes leftmost-bit-first", () => {
    expect([...maskToPcs(2773)].sort((a, b) => a - b)).toEqual([0, 2, 4, 5, 7, 9, 11]);
  });
  it("round-trips", () => {
    expect(pcsToMask(maskToPcs(0x92 << 4))).toBe(0x92 << 4);
    expect(pcsToMask([0])).toBe(0b100000000000);
    expect(pcsToMask([11])).toBe(1);
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
