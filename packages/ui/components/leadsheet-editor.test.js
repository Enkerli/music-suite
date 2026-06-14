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

  it("leads an absolute chord with its functional degree, named spelling below", () => {
    const el = document.createElement("div");
    createLeadsheetEditor(el, { text: "D7", key: C });
    const chip = el.querySelector(".es-ls-chord");
    expect(chip.querySelector("span").textContent).toBe("II7");      // functional on top (D7 in C = II7)
    expect(chip.querySelector(".es-ls-real").textContent).toBe("D7"); // authored name below
  });

  it("renders a consonance badge whose brightness tracks consonance", () => {
    const el = document.createElement("div");
    createLeadsheetEditor(el, { text: "C | Cdim", key: C });
    const dots = [...el.querySelectorAll(".es-ls-consonance")];
    expect(dots).toHaveLength(2);
    const light = (s) => Number(/([\d.]+)%\)/.exec(s.style.background)[1]);
    expect(light(dots[0])).toBeGreaterThan(light(dots[1])); // C major brighter than C dim
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

  it("highlights the active chord (chord-follow) and moves it via update()", () => {
    const el = document.createElement("div");
    const ed = createLeadsheetEditor(el, { text: "Dm7 | G7 | Cmaj7", key: C, activeIndex: 0 });
    // absolute chords lead with their functional degree (Dm7 → IIm7, …)
    const activeChips = () => [...el.querySelectorAll(".es-ls-chord.active")].map((c) => c.querySelector("span")?.textContent);
    expect(activeChips()).toEqual(["IIm7"]);
    ed.update({ activeIndex: 2 });
    expect(activeChips()).toEqual(["Imaj7"]);
    ed.update({ activeIndex: -1 });
    expect(activeChips()).toEqual([]);
  });

  it("the + picker offers suggestions and inserts the picked chord with its voicing", () => {
    const el = document.createElement("div");
    const suggest = vi.fn(({ before, atEnd }) => {
      expect(before?.inputText ?? before?.degree?.numeral).toBeTruthy(); // gets the prior chord
      expect(atEnd).toBe(true);
      return [{ label: "G7", symbol: "G7", notes: [55, 59, 62, 65], movement: 4 }];
    });
    const ed = createLeadsheetEditor(el, { text: "Cmaj7", key: C, showKey: false, suggest });
    el.querySelector(".es-ls-add").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(suggest).toHaveBeenCalled();
    const item = el.querySelector(".es-ls-suggest-item");
    expect(item.textContent).toContain("G7");
    item.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(ed.getText()).toBe("Cmaj7 G7");
    // the picked suggestion's voicing is locked onto the inserted chord
    const inserted = ed.value.sections[0].bars[0].chords[1];
    expect(inserted.voicing).toEqual([55, 59, 62, 65]);
  });

  it("the + picker filters suggestions as you type (autocomplete)", () => {
    const el = document.createElement("div");
    const suggest = vi.fn(() => [
      { label: "G7", symbol: "G7", notes: [55] },
      { label: "IIm7", symbol: "Am7", notes: [57] },
    ]);
    createLeadsheetEditor(el, { text: "Cmaj7", key: C, showKey: false, suggest });
    el.querySelector(".es-ls-add").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(el.querySelectorAll(".es-ls-suggest-item")).toHaveLength(2);
    const input = el.querySelector(".es-ls-suggest input.es-ls-input");
    input.value = "g";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    const items = [...el.querySelectorAll(".es-ls-suggest-item")];
    expect(items).toHaveLength(1);
    expect(items[0].textContent).toContain("G7");
  });

  it("the + picker still accepts a typed token (Enter)", () => {
    const el = document.createElement("div");
    const suggest = vi.fn(() => []);
    const ed = createLeadsheetEditor(el, { text: "Cmaj7", key: C, showKey: false, suggest });
    el.querySelector(".es-ls-add").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const input = el.querySelector(".es-ls-suggest input.es-ls-input");
    input.value = "A-7";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(ed.getText()).toBe("Cmaj7 A-7");
  });

  it("a rating tool turns chord taps into transition ratings (and tints)", () => {
    const el = document.createElement("div");
    const rated = [];
    const ed = createLeadsheetEditor(el, {
      text: "Dm7 | G7 | Cmaj7", key: C, showKey: false,
      onRate: (i, dir) => rated.push([i, dir]),
      ratingOf: (i) => (i === 1 ? 2 : 1), // the move into chord 1 is boosted
      tool: "rate-down",
    });
    const chips = () => [...el.querySelectorAll(".es-ls-chord")];
    expect(chips()[1].classList.contains("rated-up")).toBe(true); // chord 1 tinted up
    // with the rate-down tool, a tap rates (no editor opens)
    chips()[2].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(rated).toContainEqual([2, -1]);
    expect(el.querySelector("input.es-ls-input")).toBeNull();
    // switch to the edit tool — a tap now opens the editor instead
    ed.update({ tool: "edit" });
    chips()[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(el.querySelector("input.es-ls-input")).not.toBeNull();
  });

  it("getText round-trips to bar notation", () => {
    const el = document.createElement("div");
    const ed = createLeadsheetEditor(el, { text: "Dm7 G7 | Cmaj7", key: C });
    expect(ed.getText()).toBe("Dm7 G7 | Cmaj7");
  });
});
