// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { createPolyCircleView } from "./render.js";

const lane = (steps, accents = steps.map(() => 0)) => ({ steps, accents });

describe("createPolyCircleView — nested rings for poly lanes (KT item 9)", () => {
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

  it("a single lane uses the full outer radius (no gap math to divide by zero)", () => {
    const host = document.createElement("div");
    const view = createPolyCircleView(host, {});
    view.update({ lanes: [lane([1, 0, 1, 1])], lanePh: [-1], muted: [false] });
    const guide = host.querySelector("svg > g > g > circle");
    expect(Number(guide.getAttribute("r"))).toBe(150);
  });

  it("draws a downbeat tick and one dot per step, on-steps larger than off-steps", () => {
    const host = document.createElement("div");
    const view = createPolyCircleView(host, {});
    view.update({ lanes: [lane([1, 0, 1, 0])], lanePh: [-1], muted: [false] });
    const g = host.querySelector("svg > g > g");
    expect(g.querySelectorAll("line").length).toBe(1); // downbeat tick
    const dots = g.querySelectorAll("circle:not(:first-child)"); // guide ring is the first circle
    expect(dots.length).toBe(4);
    const onR = Number(dots[0].getAttribute("r"));
    const offR = Number(dots[1].getAttribute("r"));
    expect(onR).toBeGreaterThan(offR);
  });

  it("an accented onset gets an extra halo circle", () => {
    const host = document.createElement("div");
    const view = createPolyCircleView(host, {});
    view.update({ lanes: [lane([1, 1, 1, 1], [1, 0, 0, 0])], lanePh: [-1], muted: [false] });
    const g = host.querySelector("svg > g > g");
    // guide ring + downbeat tick already accounted for; 4 steps + 1 halo = 5 circles + 1 guide = 6
    expect(g.querySelectorAll("circle").length).toBe(6);
  });

  it("the playhead step gets a thicker stroke than other on-steps", () => {
    const host = document.createElement("div");
    const view = createPolyCircleView(host, {});
    view.update({ lanes: [lane([1, 1, 1, 1])], lanePh: [2], muted: [false] });
    const dots = host.querySelectorAll("svg > g > g > circle:not(:first-child)");
    expect(Number(dots[2].getAttribute("stroke-width"))).toBeGreaterThan(Number(dots[0].getAttribute("stroke-width")));
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
    const before = host.querySelectorAll("circle").length;
    view.update({ lanes: [lane([1, 1, 1, 1])], lanePh: [3], muted: [false] });
    const after = host.querySelectorAll("circle").length;
    expect(after).toBe(before);
    const dots = host.querySelectorAll("svg > g > g > circle:not(:first-child)");
    expect(Number(dots[3].getAttribute("stroke-width"))).toBeGreaterThan(Number(dots[0].getAttribute("stroke-width")));
  });
});
