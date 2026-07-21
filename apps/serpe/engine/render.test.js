// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { createCircleView, createPolyCircleView } from "./render.js";

const lane = (steps, accents = steps.map(() => 0)) => ({ steps, accents });

describe("createCircleView — onset duration arcs (DESIGN_AGENT_ANSWERS.md §1)", () => {
  it("draws one arc path per onset, none for rests", () => {
    const host = document.createElement("div");
    const view = createCircleView(host, {});
    view.update({ steps: [1, 0, 1, 0], accents: [0, 0, 0, 0] });
    const arcs = host.querySelectorAll("svg path");
    expect(arcs.length).toBe(2); // two onsets, two arcs — no dots, no polygon
  });

  it("draws NOTHING for an all-rest pattern beyond the guide ring and spokes", () => {
    const host = document.createElement("div");
    const view = createCircleView(host, {});
    view.update({ steps: [0, 0, 0, 0], accents: [0, 0, 0, 0] });
    expect(host.querySelectorAll("svg path").length).toBe(0);
  });

  it("never draws a <polygon> — the arc replaces it outright", () => {
    const host = document.createElement("div");
    const view = createCircleView(host, {});
    view.update({ steps: [1, 1, 1, 1], accents: [0, 0, 0, 0] });
    expect(host.querySelectorAll("svg polygon").length).toBe(0);
  });

  it("a single onset in a multi-step ring draws a near-full-circle arc (large-arc, clockwise)", () => {
    const host = document.createElement("div");
    const view = createCircleView(host, {});
    view.update({ steps: [1, 0, 0, 0, 0, 0, 0, 0], accents: [0] });
    const arc = host.querySelector("svg path");
    expect(arc).toBeTruthy();
    expect(arc.getAttribute("d")).toMatch(/A \d+ \d+ 0 1 1/); // large-arc-flag=1, sweep-flag=1 (clockwise)
  });

  it("an accented onset gets a heavier stroke AND an accent tick — two channels, not color alone", () => {
    const host = document.createElement("div");
    const view = createCircleView(host, {});
    view.update({ steps: [1, 0, 1, 0], accents: [1, 0, 0, 0] });
    const paths = host.querySelectorAll("svg path");
    const accentedWidth = Number(paths[0].getAttribute("stroke-width"));
    const plainWidth = Number(paths[1].getAttribute("stroke-width"));
    expect(accentedWidth).toBeGreaterThan(plainWidth);
    expect(paths[0].getAttribute("stroke")).toBe("var(--es-dim-pressure)"); // accent-amber token
    const ticks = host.querySelectorAll("svg line");
    // spokes (one per step, 4) + the one accent tick
    expect(ticks.length).toBe(5);
  });

  it("the guide ring uses the neutral border token at width 1, not the lane accent", () => {
    const host = document.createElement("div");
    const view = createCircleView(host, { lane: "moss" });
    view.update({ steps: [1, 0], accents: [0, 0] });
    const guide = host.querySelector("svg circle");
    expect(guide.getAttribute("stroke")).toBe("var(--es-border)");
    expect(guide.getAttribute("stroke-width")).toBe("1");
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

describe("createPolyCircleView — nested rings, one arc set per lane (KT item 9 + DESIGN_AGENT_ANSWERS.md §1)", () => {
  it("draws one ring group per lane, outer→inner in declaration order", () => {
    const host = document.createElement("div");
    const view = createPolyCircleView(host, {});
    view.update({
      lanes: [lane([1, 0, 1, 0]), lane([1, 1, 0])],
      lanePh: [-1, -1],
      muted: [false, false],
    });
    const groups = host.querySelectorAll("svg > g > g");
    expect(groups.length).toBe(2);
    const r0 = Number(groups[0].querySelector("circle").getAttribute("r"));
    const r1 = Number(groups[1].querySelector("circle").getAttribute("r"));
    expect(r0).toBeGreaterThan(r1); // lane 0 (declared first) is outermost
  });

  it("a single lane uses the full outer radius — R = 118, same as the mono ring", () => {
    const host = document.createElement("div");
    const view = createPolyCircleView(host, {});
    view.update({ lanes: [lane([1, 0, 1, 1])], lanePh: [-1], muted: [false] });
    const guide = host.querySelector("svg > g > g > circle");
    expect(Number(guide.getAttribute("r"))).toBe(118);
  });

  it("draws a downbeat tick and one arc per onset, none for rests", () => {
    const host = document.createElement("div");
    const view = createPolyCircleView(host, {});
    view.update({ lanes: [lane([1, 0, 1, 0])], lanePh: [-1], muted: [false] });
    const g = host.querySelector("svg > g > g");
    expect(g.querySelectorAll("line").length).toBe(1); // downbeat tick only, no accents, no playhead
    expect(g.querySelectorAll("path").length).toBe(2); // two onsets
  });

  it("an accented onset gets an accent tick line, not a halo circle", () => {
    const host = document.createElement("div");
    const view = createPolyCircleView(host, {});
    view.update({ lanes: [lane([1, 1, 1, 1], [1, 0, 0, 0])], lanePh: [-1], muted: [false] });
    const g = host.querySelector("svg > g > g");
    expect(g.querySelectorAll("line").length).toBe(2); // downbeat tick + 1 accent tick
    expect(g.querySelectorAll("path").length).toBe(4); // 4 onsets, one arc each
  });

  it("the playhead is a small marker at this ring's own current step, absent when there is none", () => {
    const host = document.createElement("div");
    const view = createPolyCircleView(host, {});
    view.update({ lanes: [lane([1, 1, 1, 1])], lanePh: [-1], muted: [false] });
    let g = host.querySelector("svg > g > g");
    // guide ring is the only circle when there's no playhead
    expect(g.querySelectorAll("circle").length).toBe(1);

    view.update({ lanes: [lane([1, 1, 1, 1])], lanePh: [2], muted: [false] });
    g = host.querySelector("svg > g > g");
    expect(g.querySelectorAll("circle").length).toBe(2); // guide ring + playhead marker
  });

  it("a muted lane's ring group is dimmed via opacity, not removed", () => {
    const host = document.createElement("div");
    const view = createPolyCircleView(host, {});
    view.update({ lanes: [lane([1, 0]), lane([1, 1])], lanePh: [-1, -1], muted: [false, true] });
    const groups = host.querySelectorAll("svg > g > g");
    expect(Number(groups[0].getAttribute("opacity"))).toBe(1);
    expect(Number(groups[1].getAttribute("opacity"))).toBeLessThan(1);
  });

  it("update() re-renders in place — moving the playhead doesn't grow the DOM", () => {
    const host = document.createElement("div");
    const view = createPolyCircleView(host, {});
    view.update({ lanes: [lane([1, 1, 1, 1])], lanePh: [0], muted: [false] });
    const before = host.querySelectorAll("*").length;
    view.update({ lanes: [lane([1, 1, 1, 1])], lanePh: [3], muted: [false] });
    const after = host.querySelectorAll("*").length;
    expect(after).toBe(before);
  });

  it("no lane's downbeat tick / arc color collides with the accent-amber highlight (contrast regression)", () => {
    const host = document.createElement("div");
    const view = createPolyCircleView(host, {});
    // 4 lanes cycles the full rotation at least once; none of them — including
    // what used to be the 2nd lane's 'rose' — may resolve to --es-dim-pressure,
    // the same token accented onsets use, or an accent there would be
    // invisible (arc color unchanged from its own unaccented onsets).
    view.update({
      lanes: [lane([1, 0]), lane([1, 0]), lane([1, 0]), lane([1, 0])],
      lanePh: [-1, -1, -1, -1], muted: [false, false, false, false],
    });
    const groups = host.querySelectorAll("svg > g > g");
    for (const g of groups) {
      const downbeat = g.querySelector("line");
      expect(downbeat.getAttribute("stroke")).not.toBe("var(--es-dim-pressure)");
      const arc = g.querySelector("path");
      expect(arc.getAttribute("stroke")).not.toBe("var(--es-dim-pressure)");
    }
  });

  it("an accented onset's arc stroke differs from its own ring's unaccented onsets, on every lane in the rotation", () => {
    const host = document.createElement("div");
    const view = createPolyCircleView(host, {});
    // Regression for the specific bug: lane index 1 used to be 'rose', which
    // IS --es-dim-pressure — an accented onset there had the same stroke as
    // an unaccented one, losing the only color signal (the accent tick still
    // drew, but the stroke swap that works for every other lane silently didn't).
    view.update({
      lanes: [0, 1, 2, 3].map(() => ({ steps: [1, 1], accents: [1, 0] })),
      lanePh: [-1, -1, -1, -1], muted: [false, false, false, false],
    });
    const groups = host.querySelectorAll("svg > g > g");
    for (const g of groups) {
      const arcs = g.querySelectorAll("path");
      const accentedStroke = arcs[0].getAttribute("stroke");
      const unaccentedStroke = arcs[1].getAttribute("stroke");
      expect(accentedStroke).not.toBe(unaccentedStroke);
    }
  });
});
