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

  it("absolute display leads with the chord name, degree below (functional/absolute toggle)", () => {
    const el = document.createElement("div");
    createLeadsheetEditor(el, { text: "D7", key: C, display: "absolute" });
    const chip = el.querySelector(".es-ls-chord");
    expect(chip.querySelector("span").textContent).toBe("D7"); // chord name leads
    expect(chip.querySelector(".es-ls-real").textContent).toBe("II7"); // degree below
  });

  it("toggling display via update() swaps the readings for a degree chord", () => {
    const el = document.createElement("div");
    const ed = createLeadsheetEditor(el, { text: "IIm7", key: C, showKey: false });
    expect(el.querySelector(".es-ls-name").textContent).toBe("IIm7"); // functional default
    ed.update({ display: "absolute" });
    expect(el.querySelector(".es-ls-name").textContent).toBe("Dm7"); // chord name leads
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

  it("press-and-hold lifts a chord; a quick tap still opens the inspector", () => {
    vi.useFakeTimers();
    try {
      const el = document.createElement("div");
      createLeadsheetEditor(el, { text: "Dm7 G7 Cmaj7", key: C, showKey: false });
      const chips = () => el.querySelectorAll(".es-ls-chord");
      // Quick tap (release before the hold fires) → inspector opens.
      chips()[0].dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
      vi.advanceTimersByTime(120);
      chips()[0].dispatchEvent(new MouseEvent("pointerup", { bubbles: true }));
      click(chips()[0]);
      expect(el.querySelector(".es-ls-inspector")).not.toBeNull();
      click(el.querySelector(".es-ls-insp-close"));
      // Press-and-hold (no release) → the chord lifts for a move.
      chips()[2].dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
      vi.advanceTimersByTime(500);
      expect(el.querySelector(".es-ls-chord.moving")).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
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

  it("renders an unnamed (auto-generated) modulation quietly — divider, no badge header", () => {
    const el = document.createElement("div");
    const unnamed = {
      key: { tonic: "C", mode: "major" },
      sections: [
        { bars: [{ chords: [deg("I", "maj7")] }] },
        { key: { tonic: "G", mode: "major" }, bars: [{ chords: [deg("I", "maj7")] }] },
      ],
    };
    createLeadsheetEditor(el, { progression: unnamed, showKey: false });
    expect(el.querySelectorAll(".es-ls-sectbadge")).toHaveLength(0); // no heavy headers
    expect(el.querySelector(".es-ls-kchange-pill").textContent).toBe("→ G major"); // just the quiet seam
    expect([...el.querySelectorAll(".es-ls-real")].map((r) => r.textContent)).toEqual(["Cmaj7", "Gmaj7"]); // still re-anchored
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

describe("leadsheet editor — implied modulation (subtle key areas, design B)", () => {
  const abs = (root, suffix) => ({ symbol: { root, suffix }, inputText: root + suffix });

  it("re-spells a chord span in its local key with a quiet tag, no divider", () => {
    const el = document.createElement("div");
    createLeadsheetEditor(el, {
      progression: { key: C, sections: [{ bars: [{ chords: [abs("A", "m7"), abs("D", "7"), abs("G", "maj7")] }] }] },
      showKey: false,
      keyAreas: [{ start: 0, end: 2, key: { tonic: "G", mode: "major" } }],
    });
    // Am7 D7 Gmaj7 read in G = IIm7 V7 Imaj7 (functional default).
    expect([...el.querySelectorAll(".es-ls-name")].map((n) => n.textContent)).toEqual(["IIm7", "V7", "Imaj7"]);
    expect(el.querySelectorAll(".es-ls-kchange")).toHaveLength(0); // no heavy divider
    expect(el.querySelector(".es-ls-keymark").textContent).toBe("G"); // one quiet tag at the start
    expect(el.querySelectorAll(".es-ls-chord.in-keyarea")).toHaveLength(3); // span tinted
  });

  it("the quiet key tag keeps the tonic's accidental (C♯m, not Cm)", () => {
    const el = document.createElement("div");
    createLeadsheetEditor(el, {
      progression: { key: C, sections: [{ bars: [{ chords: [abs("G♯", "7"), abs("C♯", "m7")] }] }] },
      showKey: false,
      keyAreas: [{ start: 0, end: 1, key: { tonic: "C♯", mode: "minor" } }],
    });
    expect(el.querySelector(".es-ls-keymark").textContent).toBe("C♯m");
  });

  it("a key area can start mid-bar (home chord then a re-spelled span)", () => {
    const el = document.createElement("div");
    createLeadsheetEditor(el, {
      progression: { key: C, sections: [{ bars: [{ chords: [abs("C", "maj7"), abs("A", "m7")] }, { chords: [abs("D", "7"), abs("G", "maj7")] }] }] },
      showKey: false,
      keyAreas: [{ start: 1, end: 3, key: { tonic: "G", mode: "major" } }], // from Am7 (mid-bar)
    });
    // Cmaj7 stays home (Imaj7); Am7 D7 Gmaj7 read in G.
    expect([...el.querySelectorAll(".es-ls-name")].map((n) => n.textContent)).toEqual(["Imaj7", "IIm7", "V7", "Imaj7"]);
    expect(el.querySelector(".es-ls-keymark").textContent).toBe("G");
  });
});

describe("leadsheet editor — motion overlay (Q4)", () => {
  it("marks fifths (↝) and steps (underline) from motionOf, never the first chord", () => {
    const el = document.createElement("div");
    createLeadsheetEditor(el, {
      text: "Dm7 G7 Cmaj7", key: C, showKey: false,
      motionOf: (i) => (i === 1 ? "fifth" : i === 2 ? "step" : null),
    });
    expect(el.querySelectorAll(".es-ls-motion.fifth")).toHaveLength(1);
    expect(el.querySelectorAll(".es-ls-motion.step")).toHaveLength(1);
    // The first chord has no incoming motion.
    expect(el.querySelectorAll(".es-ls-chord")[0].querySelector(".es-ls-motion")).toBeNull();
  });
});

describe("leadsheet editor — write cursor & inline ghost (Q1)", () => {
  it("marks the trailing + as the write cursor by default", () => {
    const el = document.createElement("div");
    createLeadsheetEditor(el, { text: "Dm7 G7", key: C, showKey: false });
    expect(el.querySelector(".es-ls-caret.trail.cursor")).not.toBeNull();
  });

  it("renders the inline ghost at the cursor; ✓ writes it (locking the voicing) and clears", () => {
    const el = document.createElement("div");
    let consumed = false;
    const ed = createLeadsheetEditor(el, {
      text: "Dm7 G7", key: C, showKey: false,
      ghost: { label: "Am7", confirm: { token: "Am7", voicing: [57, 60, 64] }, options: [], onConsumed: () => { consumed = true; } },
    });
    expect(el.querySelector(".es-ls-ghost-cell")).not.toBeNull();
    click(el.querySelector(".es-ls-ghost-add"));
    expect(ed.getText()).toBe("Dm7 G7 Am7");
    expect(consumed).toBe(true);
    expect(ed.value.sections[0].bars[0].chords[2].voicing).toEqual([57, 60, 64]);
  });

  it("the ghost's options disclosure writes a chosen completion / voicing", () => {
    const el = document.createElement("div");
    const ed = createLeadsheetEditor(el, {
      text: "Cmaj7", key: C, showKey: false,
      ghost: {
        label: "Am", confirm: { token: "Am", voicing: [57] },
        options: [{ label: "Am7", detail: "+ G", insert: { token: "Am7", voicing: [57, 60, 64, 67] } }],
        onConsumed: () => {},
      },
    });
    click([...el.querySelectorAll(".es-ls-ghost-cell .es-btn")].find((b) => b.textContent === "▸")); // open options
    click([...el.querySelectorAll(".es-ls-ghost-opts .es-btn")][0]); // pick Am7
    expect(ed.getText()).toBe("Cmaj7 Am7");
  });

  it("hides the ghost when update clears it", () => {
    const el = document.createElement("div");
    const ed = createLeadsheetEditor(el, {
      text: "Dm7", key: C, showKey: false,
      ghost: { label: "G7", confirm: { token: "G7" }, options: [], onConsumed: () => {} },
    });
    expect(el.querySelector(".es-ls-ghost-cell")).not.toBeNull();
    ed.update({ ghost: null });
    expect(el.querySelector(".es-ls-ghost-cell")).toBeNull();
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
