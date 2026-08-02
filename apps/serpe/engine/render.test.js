// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { createCircleView, createPolyCircleView, describeLanes } from "./render.js";

const lane = (steps, accents = steps.map(() => 0)) => ({ steps, accents });

describe("createCircleView — donut-slice steps (DESIGN_AGENT_ANSWERS.md §1)", () => {
  it("draws one wedge path per onset, none for rests", () => {
    const host = document.createElement("div");
    const view = createCircleView(host, {});
    view.update({ steps: [1, 0, 1, 0], accents: [0, 0, 0, 0] });
    const wedges = host.querySelectorAll("svg path");
    expect(wedges.length).toBe(2); // two onsets, two slices — no dots, no polygon
  });

  it("draws NOTHING for an all-rest pattern beyond the guide band and step stubs", () => {
    const host = document.createElement("div");
    const view = createCircleView(host, {});
    view.update({ steps: [0, 0, 0, 0], accents: [0, 0, 0, 0] });
    expect(host.querySelectorAll("svg path").length).toBe(0);
  });

  it("never draws a <polygon> — the slice replaces it outright", () => {
    const host = document.createElement("div");
    const view = createCircleView(host, {});
    view.update({ steps: [1, 1, 1, 1], accents: [0, 0, 0, 0] });
    expect(host.querySelectorAll("svg polygon").length).toBe(0);
  });

  it("a lone onset sweeps almost the whole ring — the arc IS its duration", () => {
    // The exact opposite of what the wedge model asserted here, and
    // deliberately so: one onset in eight steps sounds until it comes round
    // again, so its arc spans nearly the full cycle and takes the large-arc
    // flag. It still stops short, which is what keeps the ring from closing.
    const host = document.createElement("div");
    const view = createCircleView(host, {});
    view.update({ steps: [1, 0, 0, 0, 0, 0, 0, 0], accents: [0] });
    const arc = host.querySelector("svg path");
    expect(arc.getAttribute("d")).toMatch(/A 118 118 0 1 1/);
    expect(arc.getAttribute("fill")).toBe("none");
    expect(arc.getAttribute("stroke-linecap")).toBe("round");
  });

  it("a single-step pattern (n=1) still closes correctly (needs the large-arc flag)", () => {
    const host = document.createElement("div");
    const view = createCircleView(host, {});
    view.update({ steps: [1], accents: [0] });
    const wedge = host.querySelector("svg path");
    expect(wedge.getAttribute("d")).toMatch(/A [\d.]+ [\d.]+ 0 1 1/);
  });

  it("an accented onset is amber AND heavier — two channels, not colour alone", () => {
    const host = document.createElement("div");
    const view = createCircleView(host, {});
    view.update({ steps: [1, 0, 1, 0], accents: [1, 0, 0, 0] });
    const arcs = host.querySelectorAll("svg path");
    expect(arcs[0].getAttribute("stroke")).toBe("var(--es-dim-pressure)");
    expect(arcs[1].getAttribute("stroke")).not.toBe("var(--es-dim-pressure)");
    // The second channel is WEIGHT now, not radius — a wedge could poke out,
    // a stroked arc gets thicker.
    expect(Number(arcs[0].getAttribute("stroke-width")))
      .toBeGreaterThan(Number(arcs[1].getAttribute("stroke-width")));
  });

  it("adjacent onsets are delimited — their slices don't touch (real gap, not a continuous ring)", () => {
    const host = document.createElement("div");
    const view = createCircleView(host, {});
    view.update({ steps: [1, 1], accents: [0, 0] }); // two adjacent onsets, n=2
    const [a, b] = host.querySelectorAll("svg path");
    // Slice a's trailing edge and slice b's leading edge are both derived
    // from the SAME step boundary angle, minus/plus the gap respectively —
    // if there were no gap they'd land on the identical point.
    const aEnd = a.getAttribute("d").split(" ").slice(-7, -5).join(" ");
    const bStart = b.getAttribute("d").split(" ").slice(1, 3).join(" ");
    expect(aEnd).not.toBe(bStart);
  });

  it("the guide band has both an outer and an inner boundary — a real hole, not a thin ring", () => {
    const host = document.createElement("div");
    const view = createCircleView(host, { lane: "moss", showCog: false });
    view.update({ steps: [1, 0], accents: [0, 0] });
    // Onset NODES are circles too now, so select the guides by their token
    // rather than by counting every circle in the view.
    const guides = [...host.querySelectorAll("svg circle")]
      .filter((c) => c.getAttribute("stroke") === "var(--es-border)");
    expect(guides.length).toBe(2);
    for (const g of guides) expect(g.getAttribute("stroke-width")).toBe("1");
    const radii = [...guides].map((g) => Number(g.getAttribute("r"))).sort((x, y) => x - y);
    expect(radii[0]).toBeGreaterThan(0); // the hole itself is never r=0 (no moiré-prone center convergence)
    expect(radii[1]).toBeGreaterThan(radii[0]);
  });

  it("update() re-renders in place — no DOM growth across repeated updates", () => {
    const host = document.createElement("div");
    const view = createCircleView(host, {});
    view.update({ steps: [1, 0, 1, 0], accents: [0, 0, 0, 0], playhead: 0 });
    const before = host.querySelectorAll("*").length;
    view.update({ steps: [1, 0, 1, 0], accents: [0, 0, 0, 0], playhead: 2 });
    const after = host.querySelectorAll("*").length;
    expect(after).toBe(before);
  });
});

describe("createPolyCircleView — duration arcs + onset nodes (design handoff 2026-08-01)", () => {
  it("draws one ring group per lane, outer\u2192inner in declaration order", () => {
    const host = document.createElement("div");
    const view = createPolyCircleView(host, {});
    view.update({
      lanes: [lane([1, 0, 1, 0]), lane([1, 1, 0])],
      lanePh: [-1, -1], muted: [false, false],
    });
    const groups = host.querySelectorAll("svg > g > g");
    expect(groups.length).toBe(2);
    const r = [...groups].map((g) => Number(g.querySelector("circle").getAttribute("r")));
    expect(r[0]).toBeGreaterThan(r[1]);   // lane 0 outermost
  });

  it("one guide circle per lane at the handoff radius", () => {
    const host = document.createElement("div");
    const view = createPolyCircleView(host, {});
    view.update({ lanes: [lane([1, 0, 1, 1])], lanePh: [-1], muted: [false] });
    const guide = host.querySelector("svg > g > g > circle");
    expect(Number(guide.getAttribute("r"))).toBe(128);
    expect(guide.getAttribute("fill")).toBe("none");
  });

  it("adjacent onsets do NOT close into a continuous ring — the regression this replaces", () => {
    // Every step an onset: arcs tile the whole cycle, which is exactly the
    // case that defeated the first arc attempt. Each must stop short.
    const host = document.createElement("div");
    const view = createPolyCircleView(host, {});
    view.update({ lanes: [lane([1, 1, 1, 1])], lanePh: [-1], muted: [false] });
    const arcs = [...host.querySelectorAll("svg > g > g > path")];
    expect(arcs.length).toBe(4);
    // An arc's own sweep must be less than its full 1/4 turn, so a gap exists.
    for (const a of arcs) expect(a.getAttribute("d")).toMatch(/^M [\d.]+ [\d.]+ A 128 128 0 0 1/);
  });

  it("a lone onset sweeps almost the whole ring but still leaves a gap", () => {
    const host = document.createElement("div");
    const view = createPolyCircleView(host, {});
    view.update({ lanes: [lane([1, 0, 0, 0, 0, 0, 0, 0])], lanePh: [-1], muted: [false] });
    const d = host.querySelector("svg > g > g > path").getAttribute("d");
    expect(d).toContain("A 128 128 0 1 1");   // large-arc flag set
  });

  it("every onset gets a node on top of the arcs, so an attack is always discrete", () => {
    const host = document.createElement("div");
    const view = createPolyCircleView(host, {});
    view.update({ lanes: [lane([1, 0, 1, 0])], lanePh: [-1], muted: [false] });
    const g = host.querySelector("svg > g > g");
    const circles = [...g.querySelectorAll("circle")];
    // 1 guide + 2 onsets x (node + centre dot)
    expect(circles.length).toBe(1 + 2 * 2);
    const kids = [...g.children];
    // Nodes must come after every arc, or a long arc would paint over them.
    const lastPath = kids.map((k) => k.tagName).lastIndexOf("path");
    const firstNode = kids.findIndex((k, i) => k.tagName === "circle" && i > 0);
    expect(firstNode).toBeGreaterThan(lastPath);
  });

  it("an accent is heavier AND amber — two channels, never colour alone", () => {
    const host = document.createElement("div");
    const view = createPolyCircleView(host, {});
    view.update({ lanes: [lane([1, 0, 1, 0], [1, 0, 0, 0])], lanePh: [-1], muted: [false] });
    const arcs = [...host.querySelectorAll("svg > g > g > path")];
    expect(arcs[0].getAttribute("stroke")).toBe("var(--es-dim-pressure)");
    expect(Number(arcs[0].getAttribute("stroke-width")))
      .toBeGreaterThan(Number(arcs[1].getAttribute("stroke-width")));
  });

  it("step ticks mark every step, with the downbeat heavier", () => {
    const host = document.createElement("div");
    const view = createPolyCircleView(host, {});
    view.update({ lanes: [lane([1, 0, 1, 0])], lanePh: [-1], muted: [false] });
    const lines = [...host.querySelectorAll("svg > g > g > line")];
    expect(lines.length).toBe(4);                       // no playhead here
    expect(Number(lines[0].getAttribute("stroke-width"))).toBe(2);
    expect(lines[0].getAttribute("stroke")).toBe("var(--es-fg-muted)");
  });

  it("the playhead is a radial marker on this ring, absent when there is none", () => {
    const host = document.createElement("div");
    const view = createPolyCircleView(host, {});
    view.update({ lanes: [lane([1, 0, 1, 0])], lanePh: [2], muted: [false] });
    expect(host.querySelectorAll("svg > g > g > line").length).toBe(5);  // 4 ticks + playhead
    view.update({ lanes: [lane([1, 0, 1, 0])], lanePh: [-1], muted: [false] });
    expect(host.querySelectorAll("svg > g > g > line").length).toBe(4);
  });

  it("more lanes than fit still keep the innermost off the centre", () => {
    const host = document.createElement("div");
    const view = createPolyCircleView(host, {});
    const many = [1, 2, 3, 4, 5, 6].map(() => lane([1, 0]));
    view.update({ lanes: many, lanePh: many.map(() => -1), muted: many.map(() => false) });
    const groups = host.querySelectorAll("svg > g > g");
    const innermost = Number(groups[groups.length - 1].querySelector("circle").getAttribute("r"));
    expect(innermost).toBeGreaterThanOrEqual(26);
  });

  it("update() re-renders in place — no DOM growth", () => {
    const host = document.createElement("div");
    const view = createPolyCircleView(host, {});
    const d = { lanes: [lane([1, 0, 1, 0])], lanePh: [-1], muted: [false] };
    view.update(d); const a = host.querySelectorAll("*").length;
    view.update(d); view.update(d);
    expect(host.querySelectorAll("*").length).toBe(a);
  });
});

describe("describeLanes — the non-visual route (DESIGN_BRIEF §4)", () => {
  it("names onset POSITIONS, not just a count", () => {
    // "3 of 8 steps" is true of many different rhythms; which ones is the
    // entire point of the picture this text stands in for.
    expect(describeLanes([lane([1, 0, 0, 1, 0, 0, 1, 0])], [false]))
      .toBe("1 lane. Lane 1: 3 of 8 steps, on 1, 4, 7.");
  });

  it("speaks accents separately — two channels in text too", () => {
    expect(describeLanes([lane([1, 0, 1, 0], [1, 0, 0, 0])], [false]))
      .toBe("1 lane. Lane 1: 2 of 4 steps, on 1, 3; accented on 1.");
  });

  it("says which lane is muted, and keeps lanes in ring order", () => {
    const t = describeLanes([lane([1, 0]), lane([1, 0, 1])], [false, true]);
    expect(t).toContain("2 lanes.");
    expect(t).toContain("Lane 2: 2 of 3 steps, on 1, 3; muted");
  });

  it("does not pretend an empty lane has onsets", () => {
    expect(describeLanes([lane([0, 0, 0, 0])], [false]))
      .toBe("1 lane. Lane 1: 0 of 4 steps, on none.");
  });

  it("is what the SVG actually carries, not a parallel string", () => {
    const host = document.createElement("div");
    const view = createPolyCircleView(host, {});
    const lanes = [lane([1, 0, 1, 0]), lane([1, 0, 0])];
    view.update({ lanes, lanePh: [-1, -1], muted: [false, false] });
    expect(host.querySelector("svg").getAttribute("aria-label"))
      .toBe(describeLanes(lanes, [false, false]));
  });
});
