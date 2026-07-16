// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { SuiteBus } from "./bus.js";
import { controlSurfaceModule, patternModule, monitorModule, summarize } from "./modules.js";

const ctx = () => {
  const bus = new SuiteBus();
  return { bus, ctxObj: { bus, save() {} } };
};

describe("control surface module (manifest-driven)", () => {
  it("renders a slider per Vane param and publishes a param message on input", () => {
    const { bus, ctxObj } = ctx();
    const seen = [];
    bus.subscribe((m) => seen.push(m));
    const body = document.createElement("div");
    controlSurfaceModule(ctxObj, body, { app: "vane" });

    const sliders = body.querySelectorAll(".ws-slider");
    expect(sliders.length).toBe(36); // Vane's 36 continuous params
    const cutoff = body.querySelector('[data-param="filter-cutoff"]');
    cutoff.value = "1";
    cutoff.dispatchEvent(new Event("input"));

    expect(seen).toHaveLength(1);
    expect(seen[0].type).toBe("param");
    expect(seen[0].to).toBe("vane");
    expect(seen[0].body.id).toBe("filter-cutoff");
    expect(seen[0].body.value).toBe(20000); // slider at 1.0 → log max
  });

  it("renders command buttons for Serpe and publishes a command on click", () => {
    const { bus, ctxObj } = ctx();
    const seen = [];
    bus.subscribe((m) => seen.push(m), { to: "serpe" });
    const body = document.createElement("div");
    controlSurfaceModule(ctxObj, body, { app: "serpe" });

    body.querySelector('[data-cmd="mutate"]').dispatchEvent(new MouseEvent("click"));
    expect(seen).toHaveLength(1);
    expect(seen[0].type).toBe("command");
    expect(seen[0].body).toMatchObject({ name: "mutate", args: { amount: 0.5 } });
  });
});

describe("pattern module (UPI, both source and sink)", () => {
  it("emits a pattern message and renders the step lane", () => {
    const { bus, ctxObj } = ctx();
    const seen = [];
    bus.subscribe((m) => seen.push(m));
    const body = document.createElement("div");
    patternModule(ctxObj, body, { upi: "E(3,8)" }); // send() runs on init

    // one pattern message emitted (tresillo: 8 steps, mask 73)
    const pat = seen.find((m) => m.type === "pattern");
    expect(pat.body).toMatchObject({ steps: 8, mask: 73 });
    // lane shows 8 steps, 3 lit
    expect(body.querySelectorAll(".ws-step").length).toBe(8);
    expect(body.querySelectorAll(".ws-step.on").length).toBe(3);
  });

  it("re-renders when another module puts a pattern on the bus (tool-to-tool)", () => {
    const { bus, ctxObj } = ctx();
    const body = document.createElement("div");
    patternModule(ctxObj, body, { upi: "E(3,8)" });
    // a different sender broadcasts a 4-step pattern (mask 5 = steps 0 and 2)
    bus.publish({ protocol: "enkerli-suite", v: 1, id: "ext-pattern-1", from: "serpe", to: "*",
      sentAt: "2026-07-15T00:00:00Z", type: "pattern", body: { steps: 4, mask: 5, name: "ext" } });
    expect(body.querySelectorAll(".ws-step").length).toBe(4);
    expect(body.querySelectorAll(".ws-step.on").length).toBe(2);
  });
});

describe("monitor module", () => {
  it("logs each bus message it hears", () => {
    const { bus, ctxObj } = ctx();
    const body = document.createElement("div");
    monitorModule(ctxObj, body);
    bus.publish({ protocol: "enkerli-suite", v: 1, id: "mon-test-1", from: "external", to: "vane",
      sentAt: "2026-07-15T00:00:00Z", type: "param", body: { mode: "set", id: "morph", value: 0.5 } });
    const lines = body.querySelectorAll(".ws-logline");
    expect(lines.length).toBe(1);
    expect(lines[0].textContent).toContain("morph=0.5");
  });
});

describe("summarize", () => {
  it("renders each message type on one line", () => {
    expect(summarize({ from: "external", to: "vane", type: "param", body: { id: "morph", value: 0.5 } })).toContain("morph=0.5");
    expect(summarize({ from: "external", to: "serpe", type: "command", body: { name: "mutate", args: { amount: 0.3 } } })).toContain("mutate(amount=0.3)");
    expect(summarize({ from: "serpe", to: "*", type: "pattern", body: { steps: 8, mask: 73 } })).toContain("8 steps");
  });
});

// ── bindings module (the control-map editor that runs the map) ────────────────

import { MODULES } from "./modules.js";

describe("bindings module", () => {
  const mount = (state = {}) => {
    const bus = new SuiteBus();
    const seen = [];
    bus.subscribe((m) => seen.push(m));
    const body = document.createElement("div");
    const cleanup = MODULES["bindings"].make({ bus, save() {} }, body, state);
    return { bus, seen, body, cleanup };
  };

  it("renders the default bindings and runs them: a keystroke fires a message on the bus", () => {
    const { seen, body, cleanup } = mount();
    // default map binds "]" → serpe rotate
    expect(body.querySelectorAll(".ws-param").length).toBe(3);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "]" }));
    expect(seen).toHaveLength(1);
    expect(seen[0].type).toBe("command");
    expect(seen[0].to).toBe("serpe");
    expect(seen[0].body.name).toBe("rotate");
    cleanup();
  });

  it("does not fire while typing in an input (the editor's own fields)", () => {
    const { seen, body, cleanup } = mount();
    const input = body.querySelector(".ws-text");
    const ev = new KeyboardEvent("keydown", { key: "]", bubbles: true });
    Object.defineProperty(ev, "target", { value: input });
    window.dispatchEvent(ev);
    expect(seen).toHaveLength(0);
    cleanup();
  });

  it("removing a binding drops it and stops firing it", () => {
    const state = {};
    const { seen, body, cleanup } = mount(state);
    body.querySelectorAll(".ws-param .ws-x")[2].dispatchEvent(new MouseEvent("click")); // remove "m" → mutate
    expect(body.querySelectorAll(".ws-param").length).toBe(2);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "m" }));
    expect(seen).toHaveLength(0); // "m" no longer bound
    cleanup();
  });

  it("adding a binding wires a new key to a command", () => {
    const { seen, body, cleanup } = mount();
    body.querySelector('[aria-label="Trigger key"]').dispatchEvent(new KeyboardEvent("keydown", { key: "i" }));
    // default app is vane (first); switch to serpe and pick complement
    const appSel = body.querySelector('[aria-label="Target app"]');
    appSel.value = "serpe"; appSel.dispatchEvent(new Event("change"));
    const actSel = body.querySelector('[aria-label="Action"]');
    actSel.value = "cmd:complement";
    body.querySelectorAll(".ws-btn")[0].dispatchEvent(new MouseEvent("click")); // + add
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "i" }));
    const cmd = seen.find((m) => m.body.name === "complement");
    expect(cmd).toBeTruthy();
    expect(cmd.to).toBe("serpe");
    cleanup();
  });
});
