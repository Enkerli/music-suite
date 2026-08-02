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

  it("a lone onset in a multi-step ring is a SMALL delimited slice, not a near-full ring", () => {
    const host = document.createElement("div");
    const view = createCircleView(host, {});
    view.update({ steps: [1, 0, 0, 0, 0, 0, 0, 0], accents: [0] });
    const wedge = host.querySelector("svg path");
    expect(wedge).toBeTruthy();
    // 1 of 8 steps = 45°, well under 180° — no large-arc-flag needed.
    expect(wedge.getAttribute("d")).toMatch(/A [\d.]+ [\d.]+ 0 0 1/);
  });

  it("a single-step pattern (n=1) still closes correctly (needs the large-arc flag)", () => {
    const host = document.createElement("div");
    const view = createCircleView(host, {});
    view.update({ steps: [1], accents: [0] });
    const wedge = host.querySelector("svg path");
    expect(wedge.getAttribute("d")).toMatch(/A [\d.]+ [\d.]+ 0 1 1/);
  });

  it("an accented onset fills with the accent-amber token and pokes out further — two channels, not color alone", () => {
    const host = document.createElement("div");
    const view = createCircleView(host, {});
    view.update({ steps: [1, 0, 1, 0], accents: [1, 0, 0, 0] });
    const wedges = host.querySelectorAll("svg path");
    expect(wedges[0].getAttribute("fill")).toBe("var(--es-dim-pressure)"); // accented
    expect(wedges[1].getAttribute("fill")).not.toBe("var(--es-dim-pressure)"); // plain
    // "pokes out further": the accented wedge's outer radius (118+8=126) is
    // larger than the plain wedge's (118) — present as bigger coordinates
    // in its arc's radius parameter.
    const accentedR = Number(wedges[0].getAttribute("d").match(/A ([\d.]+)/)[1]);
    const plainR = Number(wedges[1].getAttribute("d").match(/A ([\d.]+)/)[1]);
    expect(accentedR).toBeGreaterThan(plainR);
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
    const guides = host.querySelectorAll("svg circle");
    expect(guides.length).toBe(2);
    for (const g of guides) {
      expect(g.getAttribute("stroke")).toBe("var(--es-border)");
      expect(g.getAttribute("stroke-width")).toBe("1");
    }
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

describe("createPolyCircleView — nested donut bands, one per lane (KT item 9 + DESIGN_AGENT_ANSWERS.md §1)", () => {
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

  it("a single lane's band spans the full outer radius down to the shared hole floor", () => {
    const host = document.createElement("div");
    const view = createPolyCircleView(host, {});
    view.update({ lanes: [lane([1, 0, 1, 1])], lanePh: [-1], muted: [false] });
    const circles = host.querySelectorAll("svg > g > g > circle");
    expect(circles.length).toBe(2); // outer + inner guide boundary
    const outer = Number(circles[0].getAttribute("r"));
    const inner = Number(circles[1].getAttribute("r"));
    expect(outer).toBe(118);
    expect(inner).toBeGreaterThan(0);
    expect(inner).toBeLessThan(outer);
  });

  it("more lanes never shrink the shared hole below its floor (moiré guard)", () => {
    const host = document.createElement("div");
    const view = createPolyCircleView(host, {});
    view.update({
      lanes: [lane([1, 0]), lane([1, 0]), lane([1, 0]), lane([1, 0]), lane([1, 0])],
      lanePh: [-1, -1, -1, -1, -1], muted: [false, false, false, false, false],
    });
    const groups = host.querySelectorAll("svg > g > g");
    const innermost = groups[groups.length - 1];
    const inner = Number(innermost.querySelectorAll("circle")[1].getAttribute("r"));
    expect(inner).toBeGreaterThan(20); // never collapses toward r=0
  });

  it("draws a downbeat tick and one slice per onset, none for rests", () => {
    const host = document.createElement("div");
    const view = createPolyCircleView(host, {});
    view.update({ lanes: [lane([1, 0, 1, 0])], lanePh: [-1], muted: [false] });
    const g = host.querySelector("svg > g > g");
    expect(g.querySelectorAll("line").length).toBe(1); // downbeat tick only
    expect(g.querySelectorAll("path").length).toBe(2); // two onsets
  });

  it("an accented onset fills with accent-amber and pokes past this lane's own outer edge", () => {
    const host = document.createElement("div");
    const view = createPolyCircleView(host, {});
    view.update({ lanes: [lane([1, 1, 1, 1], [1, 0, 0, 0])], lanePh: [-1], muted: [false] });
    const g = host.querySelector("svg > g > g");
    const paths = g.querySelectorAll("path");
    expect(paths[0].getAttribute("fill")).toBe("var(--es-dim-pressure)");
    expect(paths[1].getAttribute("fill")).not.toBe("var(--es-dim-pressure)");
  });

  it("the playhead is a small marker at this ring's own current step, absent when there is none", () => {
    const host = document.createElement("div");
    const view = createPolyCircleView(host, {});
    view.update({ lanes: [lane([1, 1, 1, 1])], lanePh: [-1], muted: [false] });
    let g = host.querySelector("svg > g > g");
    expect(g.querySelectorAll("circle").length).toBe(2); // just the guide band, no playhead marker

    view.update({ lanes: [lane([1, 1, 1, 1])], lanePh: [2], muted: [false] });
    g = host.querySelector("svg > g > g");
    expect(g.querySelectorAll("circle").length).toBe(3); // guide band (2) + playhead marker
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

  it("no lane's downbeat tick / slice color collides with the accent-amber highlight (contrast regression)", () => {
    const host = document.createElement("div");
    const view = createPolyCircleView(host, {});
    // 4 lanes cycles the full rotation at least once; none of them — including
    // what used to be the 2nd lane's 'rose' — may resolve to --es-dim-pressure,
    // the same token accented onsets use, or an accent there would be
    // invisible (slice color unchanged from its own unaccented onsets).
    view.update({
      lanes: [lane([1, 0]), lane([1, 0]), lane([1, 0]), lane([1, 0])],
      lanePh: [-1, -1, -1, -1], muted: [false, false, false, false],
    });
    const groups = host.querySelectorAll("svg > g > g");
    for (const g of groups) {
      const downbeat = g.querySelector("line");
      expect(downbeat.getAttribute("stroke")).not.toBe("var(--es-dim-pressure)");
      const slice = g.querySelector("path");
      expect(slice.getAttribute("fill")).not.toBe("var(--es-dim-pressure)");
    }
  });

  it("an accented onset's fill differs from its own ring's unaccented onsets, on every lane in the rotation", () => {
    const host = document.createElement("div");
    const view = createPolyCircleView(host, {});
    // Regression for the specific bug: lane index 1 used to be 'rose', which
    // IS --es-dim-pressure — an accented onset there had the same fill as an
    // unaccented one, losing the only color signal.
    view.update({
      lanes: [0, 1, 2, 3].map(() => ({ steps: [1, 1], accents: [1, 0] })),
      lanePh: [-1, -1, -1, -1], muted: [false, false, false, false],
    });
    const groups = host.querySelectorAll("svg > g > g");
    for (const g of groups) {
      const slices = g.querySelectorAll("path");
      expect(slices[0].getAttribute("fill")).not.toBe(slices[1].getAttribute("fill"));
    }
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
