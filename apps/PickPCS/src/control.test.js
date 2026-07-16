import { describe, it, expect } from "vitest";
import { scaleMessage } from "./control.js";
import { validateMessage } from "@enkerli/protocol";

describe("scaleMessage (PickPCS → the bus)", () => {
  it("builds a valid broadcast scale message from a selection", () => {
    const m = scaleMessage({ mask: 2741, root: 0, name: "C · 7-note" }); // C major
    expect(validateMessage(m).ok).toBe(true);
    expect(m.type).toBe("scale");
    expect(m.from).toBe("pickpcs");
    expect(m.to).toBe("*"); // broadcast — any listener may act
    expect(m.body).toMatchObject({ mask: 2741, root: 0, name: "C · 7-note" });
  });
  it("carries the mask leftmost = LSB (the suite convention)", () => {
    // pcs {0,2,4,5,7,9,11} → 2741; the receiver reads it the same way
    const m = scaleMessage({ mask: 2741, root: 0 });
    expect((m.body).mask).toBe(2741);
  });
});
