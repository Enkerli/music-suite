// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { createLeadsheetEditor } from "./leadsheet-editor.js";

const C = { tonic: "C", mode: "major" };
const click = (node) => node.dispatchEvent(new MouseEvent("click", { bubbles: true }));
const down = (node) => node.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));

/** Open a chord's inspector and retype it (the name field lives in the inspector). */
function retype(el, chordIndex, value) {
  click(el.querySelectorAll(".es-ls-chord")[chordIndex]);
  const input = el.querySelector(".es-ls-inspector input.es-ls-input");
  input.value = value;
  input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
}

describe("leadsheet editor — display", () => {
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
    expect(chip.textContent).toContain("IIm7");
    expect(chip.querySelector(".es-ls-real").textContent).toBe("Dm7");
  });

  it("leads an absolute chord with its functional degree, named spelling below", () => {
    const el = document.createElement("div");
    createLeadsheetEditor(el, { text: "D7", key: C });
    const chip = el.querySelector(".es-ls-chord");
    expect(chip.querySelector("span").textContent).toBe("II7");
    expect(chip.querySelector(".es-ls-real").textContent).toBe("D7");
  });

  it("keeps the cell glanceable — no consonance dot in the cell", () => {
    const el = document.createElement("div");
    createLeadsheetEditor(el, { text: "Cmaj7 | Dm7", key: C });
    expect(el.querySelectorAll(".es-ls-bars .es-ls-consonance")).toHaveLength(0);
  });

  it("highlights the active chord and moves it via update()", () => {
    const el = document.createElement("div");
    const ed = createLeadsheetEditor(el, { text: "Dm7 | G7 | Cmaj7", key: C, activeIndex: 0 });
    const active = () => [...el.querySelectorAll(".es-ls-chord.active")].map((c) => c.querySelector("span")?.textContent);
    expect(active()).toEqual(["IIm7"]);
    ed.update({ activeIndex: 2 });
    expect(active()).toEqual(["Imaj7"]);
  });

  it("getText round-trips to bar notation", () => {
    const el = document.createElement("div");
    const ed = createLeadsheetEditor(el, { text: "Dm7 G7 | Cmaj7", key: C });
    expect(ed.getText()).toBe("Dm7 G7 | Cmaj7");
  });

  it("re-realizes degree chords when the key changes", () => {
    const el = document.createElement("div");
    const ed = createLeadsheetEditor(el, { text: "V7", key: { ...C } });
    const sel = el.querySelector("select.es-control");
    sel.value = "F♯";
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    expect(el.querySelector(".es-ls-real").textContent).toBe("C♯7");
    expect(ed.value.key.tonic).toBe("F♯");
  });
});

describe("leadsheet editor — inspector (tap a chord)", () => {
  it("retypes a chord through the inspector and fires onChange", () => {
    const el = document.createElement("div");
    const onChange = vi.fn();
    const ed = createLeadsheetEditor(el, { text: "Dm7 | Cmaj7", key: C, showKey: false, onChange });
    retype(el, 0, "Em7");
    expect(onChange).toHaveBeenCalled();
    expect(ed.getText()).toBe("Em7 | Cmaj7");
  });

  it("retyping to empty deletes the chord and its bar", () => {
    const el = document.createElement("div");
    const ed = createLeadsheetEditor(el, { text: "Dm7 | Cmaj7", key: C, showKey: false });
    retype(el, 0, "");
    expect(ed.getText()).toBe("Cmaj7");
  });

  it("shows a consonance reading (brighter = more consonant)", () => {
    const el = document.createElement("div");
    createLeadsheetEditor(el, { text: "C | Cdim", key: C, showKey: false });
    const light = () => Number(/([\d.]+)%\)/.exec(el.querySelector(".es-ls-inspector .es-ls-consonance").style.background)[1]);
    click(el.querySelectorAll(".es-ls-chord")[0]); const cMaj = light();
    click(el.querySelectorAll(".es-ls-chord")[1]); const cDim = light();
    expect(cMaj).toBeGreaterThan(cDim);
  });

  it("shows a 'why this chord' rationale (curation lineage) in the inspector", () => {
    const el = document.createElement("div");
    createLeadsheetEditor(el, {
      text: "Dm7 | G7 | Cmaj7", key: C, showKey: false,
      rationaleOf: (i) => (i === 2 ? "You favor V7→I — boosted ×1.50 in your profile." : null),
    });
    click(el.querySelectorAll(".es-ls-chord")[2]); // open Cmaj7
    expect(el.querySelector(".es-ls-inspector").textContent).toContain("You favor V7→I");
    click(el.querySelectorAll(".es-ls-chord")[1]); // G7 has no lineage
    expect(el.querySelector(".es-ls-inspector").textContent).not.toContain("You favor");
  });

  it("shows a 'scale' row (chord-scale + avoid notes) in the inspector", () => {
    const el = document.createElement("div");
    createLeadsheetEditor(el, {
      text: "Dm7 | G7 | Cmaj7", key: C, showKey: false,
      scaleOf: (i) => (i === 1 ? "Mixolydian · avoid C" : null),
    });
    click(el.querySelectorAll(".es-ls-chord")[1]); // open G7
    expect(el.querySelector(".es-ls-inspector").textContent).toContain("Mixolydian · avoid C");
    click(el.querySelectorAll(".es-ls-chord")[0]); // Dm7 has none here
    expect(el.querySelector(".es-ls-inspector").textContent).not.toContain("Mixolydian");
  });

  it("deletes a chord from the inspector", () => {
    const el = document.createElement("div");
    const ed = createLeadsheetEditor(el, { text: "Dm7 G7 Cmaj7", key: C, showKey: false });
    click(el.querySelectorAll(".es-ls-chord")[1]); // open G7
    click(el.querySelector(".es-ls-insp-del"));
    expect(ed.getText()).toBe("Dm7 Cmaj7");
  });

  it("sets held bars (whole-bar chord → % repeat) and makes a whole bar", () => {
    const el = document.createElement("div");
    const ed = createLeadsheetEditor(el, { text: "Cmaj7 | Dm7 G7", key: C, showKey: false });
    click(el.querySelectorAll(".es-ls-chord")[0]); // Cmaj7 — sole in its bar
    const steps = el.querySelectorAll(".es-ls-insp-stepper .es-btn");
    click(steps[1]); // hold 2 bars
    expect(ed.getText()).toBe("Cmaj7 | % | Dm7 G7");
    // Dm7 shares its bar → Make whole bar splits it out
    click([...el.querySelectorAll(".es-ls-chord")].find((c) => c.textContent.includes("Dm7")));
    click([...el.querySelectorAll(".es-ls-inspector .es-btn")].find((b) => b.textContent === "Make whole bar"));
    expect(ed.getText()).toBe("Cmaj7 | % | Dm7 | G7");
  });
});

describe("leadsheet editor — carets (insert) & grip (move)", () => {
  it("a caret inserts at its slot, voiceled from the chord before it", () => {
    const el = document.createElement("div");
    const suggest = vi.fn(({ before }) => {
      expect(before?.inputText).toBe("Cmaj7");
      return [{ label: "A-7", symbol: "A-7", notes: [57, 60, 64] }];
    });
    const ed = createLeadsheetEditor(el, { text: "Cmaj7 G7", key: C, showKey: false, suggest });
    click(el.querySelectorAll(".es-ls-caret")[1]); // the slot between Cmaj7 and G7
    down(el.querySelector(".es-ls-suggest-item"));
    expect(ed.getText()).toBe("Cmaj7 A-7 G7");
    expect(ed.value.sections[0].bars[0].chords[1].voicing).toEqual([57, 60, 64]);
  });

  it("the trailing caret appends, with autocomplete and typed tokens", () => {
    const el = document.createElement("div");
    const suggest = vi.fn(({ atEnd }) => {
      expect(atEnd).toBe(true);
      return [{ label: "G7", symbol: "G7", notes: [55] }, { label: "IIm7", symbol: "Am7", notes: [57] }];
    });
    const ed = createLeadsheetEditor(el, { text: "Cmaj7", key: C, showKey: false, suggest });
    click(el.querySelector(".es-ls-caret.trail"));
    expect(el.querySelectorAll(".es-ls-suggest-item")).toHaveLength(2);
    const input = el.querySelector(".es-ls-suggest input.es-ls-input");
    input.value = "g"; input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(el.querySelectorAll(".es-ls-suggest-item")).toHaveLength(1);
    input.value = "A-7"; input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(ed.getText()).toBe("Cmaj7 A-7");
  });

  it("the grip picks a chord up; tapping a caret moves it", () => {
    const el = document.createElement("div");
    const ed = createLeadsheetEditor(el, { text: "Dm7 G7 Cmaj7", key: C, showKey: false });
    click(el.querySelectorAll(".es-ls-grip")[2]); // pick up Cmaj7
    click(el.querySelectorAll(".es-ls-caret")[0]); // drop before Dm7
    expect(ed.getText()).toBe("Cmaj7 Dm7 G7");
  });
});

describe("leadsheet editor — multi-section, per-section keys (Q2)", () => {
  const deg = (numeral, suffix) => ({ source: "degree", degree: { numeral, suffix }, inputText: numeral + suffix });
  const prog = () => ({
    key: { tonic: "C", mode: "major" },
    sections: [
      { label: "verse", bars: [{ chords: [deg("I", "maj7")] }] },
      { label: "bridge", key: { tonic: "G", mode: "major" }, bars: [{ chords: [deg("I", "maj7")] }] },
    ],
  });

  it("renders a badge per section and a quiet key-change divider on the seam", () => {
    const el = document.createElement("div");
    createLeadsheetEditor(el, { progression: prog(), showKey: false });
    expect([...el.querySelectorAll(".es-ls-sectbadge")].map((b) => b.textContent)).toEqual(["A", "B"]);
    expect(el.querySelector(".es-ls-kchange-pill").textContent).toBe("→ G major");
  });

  it("re-anchors each section's degrees to its own key (Imaj7 → Cmaj7, then Gmaj7)", () => {
    const el = document.createElement("div");
    createLeadsheetEditor(el, { progression: prog(), showKey: false });
    expect([...el.querySelectorAll(".es-ls-real")].map((r) => r.textContent)).toEqual(["Cmaj7", "Gmaj7"]);
  });

  it("typing into a section parses against that section's key", () => {
    const el = document.createElement("div");
    const ed = createLeadsheetEditor(el, { progression: prog(), showKey: false });
    // Retype the bridge chord (flat index 1) through the inspector.
    click(el.querySelectorAll(".es-ls-chord")[1]);
    const input = el.querySelector(".es-ls-inspector input.es-ls-input");
    input.value = "V7";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    // V7 in G realizes as D7.
    expect(el.querySelectorAll(".es-ls-real")[1].textContent).toBe("D7");
    expect(ed.value.sections[1].key.tonic).toBe("G");
  });
});

describe("leadsheet editor — rating modes", () => {
  it("a rating tool turns chord taps into transition ratings (and tints)", () => {
    const el = document.createElement("div");
    const rated = [];
    const ed = createLeadsheetEditor(el, {
      text: "Dm7 | G7 | Cmaj7", key: C, showKey: false,
      onRate: (i, dir) => rated.push([i, dir]),
      ratingOf: (i) => (i === 1 ? 2 : 1),
      tool: "rate-down",
    });
    const chips = () => [...el.querySelectorAll(".es-ls-chord")];
    expect(chips()[1].classList.contains("rated-up")).toBe(true);
    click(chips()[2]);
    expect(rated).toContainEqual([2, -1]);
    expect(el.querySelector(".es-ls-inspector")).toBeNull(); // rate mode doesn't open the inspector
    ed.update({ tool: "edit" });
    click(chips()[0]);
    expect(el.querySelector(".es-ls-inspector")).not.toBeNull(); // edit mode does
  });
});
