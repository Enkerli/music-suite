import { describe, it, expect, vi } from "vitest";
import { applyScaleMessage } from "./control.js";
import { makeMessage } from "@enkerli/protocol";

const scalePush = (body, to = "*") => makeMessage("pickpcs", "scale", body, { to });

describe("applyScaleMessage (the bus → PitchFold's onScale)", () => {
  it("routes a broadcast scale to onScale with body + sender", () => {
    const onScale = vi.fn();
    expect(applyScaleMessage(onScale, scalePush({ mask: 2741, root: 0, name: "C major" }))).toBe(true);
    expect(onScale).toHaveBeenCalledWith({ mask: 2741, root: 0, name: "C major" }, "pickpcs");
  });
  it("routes a scale addressed directly to pitchfold", () => {
    const onScale = vi.fn();
    expect(applyScaleMessage(onScale, scalePush({ mask: 1365 }, "pitchfold"))).toBe(true);
    expect(onScale).toHaveBeenCalled();
  });
  it("ignores a scale addressed to another app", () => {
    const onScale = vi.fn();
    expect(applyScaleMessage(onScale, scalePush({ mask: 2741 }, "vane"))).toBe(false);
    expect(onScale).not.toHaveBeenCalled();
  });
  it("ignores a non-scale message", () => {
    const onScale = vi.fn();
    expect(applyScaleMessage(onScale, makeMessage("serpe", "pattern", { steps: 8, mask: 73 }))).toBe(false);
    expect(onScale).not.toHaveBeenCalled();
  });
  it("ignores foreign / invalid data without throwing", () => {
    const onScale = vi.fn();
    expect(applyScaleMessage(onScale, { hello: "world" })).toBe(false);
    expect(applyScaleMessage(onScale, null)).toBe(false);
    expect(onScale).not.toHaveBeenCalled();
  });
});
