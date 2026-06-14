// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { createLeadsheetEditor } from "./leadsheet-editor.js";

const C = { tonic: "C", mode: "major" };

function editChip(el, selector, value) {
  el.querySelector(selector).dispatchEvent(new MouseEvent("click", { bubbles: true }));
  const input = el.querySelector("input.es-ls-input");
  input.value = value;
  input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
}

describe("leadsheet editor", () => {
  it("renders bars and chord chips from bar notation", () => {
    const el = document.createElement("div");
    createLeadsheetEditor(el, { text: "Dm7 G7 | Cmaj7", key: C });
    expect(el.querySelectorAll(".es-ls-bar")).toHaveLength(2);
    const chips = [...el.querySelectorAll(".es-ls-chord")].map((c) => c.textContent);
    expect(chips[0]).toContain("Dm7");
    expect(chips[2]).toContain("Cmaj7");
  });

  it("shows the realized spelling under a degree chord", () => {
    const el = document.createElement("div");
    createLeadsheetEditor(el, { text: "IIm7", key: C });
    const chip = el.querySelector(".es-ls-chord");
    expect(chip.textContent).toContain("IIm7"); // token as authored
    expect(chip.querySelector(".es-ls-real").textContent).toBe("Dm7"); // realized
  });

  it("commits an edited chord and fires onChange", () => {
    const el = document.createElement("div");
    const onChange = vi.fn();
    const ed = createLeadsheetEditor(el, { text: "Dm7 | Cmaj7", key: C, showKey: false, onChange });
    editChip(el, '.es-ls-chord[data-bar="0"][data-chord="0"]', "Em7");
    expect(onChange).toHaveBeenCalled();
    expect(ed.getText()).toBe("Em7 | Cmaj7");
  });

  it("empty edit deletes the chord (and its empty bar)", () => {
    const el = document.createElement("div");
    const ed = createLeadsheetEditor(el, { text: "Dm7 | Cmaj7", key: C, showKey: false });
    editChip(el, '.es-ls-chord[data-bar="0"][data-chord="0"]', "");
    expect(ed.getText()).toBe("Cmaj7");
    expect(el.querySelectorAll(".es-ls-bar")).toHaveLength(1);
  });

  it("re-realizes degree chords when the key changes", () => {
    const el = document.createElement("div");
    const ed = createLeadsheetEditor(el, { text: "V7", key: { ...C } });
    const sel = el.querySelector("select.es-control");
    sel.value = "F♯";
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    expect(el.querySelector(".es-ls-real").textContent).toBe("C♯7"); // V7 in F♯
    expect(ed.value.key.tonic).toBe("F♯");
  });

  it("getText round-trips to bar notation", () => {
    const el = document.createElement("div");
    const ed = createLeadsheetEditor(el, { text: "Dm7 G7 | Cmaj7", key: C });
    expect(ed.getText()).toBe("Dm7 G7 | Cmaj7");
  });
});
