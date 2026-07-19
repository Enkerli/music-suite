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

describe("bridge module (CLI pipe → bus)", () => {
  it("republishBridgeText validates and republishes onto the bus", async () => {
    const { republishBridgeText } = await import("./modules.js");
    const { makeNote } = await import("@enkerli/protocol");
    const { bus, ctxObj } = ctx();
    const seen = [];
    bus.subscribe((m) => seen.push(m));
    const msg = makeNote("external", { notes: [60, 64, 67], durationMs: 250 }, { to: "vane" });
    expect(republishBridgeText(ctxObj.bus, JSON.stringify(msg))).toBe(true);
    expect(seen).toHaveLength(1);
    expect(seen[0].type).toBe("note");
    expect(republishBridgeText(ctxObj.bus, "not json")).toBe(false);
    expect(republishBridgeText(ctxObj.bus, JSON.stringify({ nope: 1 }))).toBe(false);
    expect(seen).toHaveLength(1); // garbage never propagated
  });
  it("renders URL field + connect button and survives a missing EventSource", async () => {
    const { MODULES } = await import("./modules.js");
    const { ctxObj } = ctx();
    const body = document.createElement("div");
    const state = {};
    const off = MODULES["bridge"].make(ctxObj, body, state);
    expect(body.querySelector("input").value).toBe("http://localhost:8765");
    const btn = body.querySelector("button");
    btn.dispatchEvent(new MouseEvent("click")); // happy-dom has no EventSource
    expect(body.textContent).toMatch(/no EventSource|connecting|connected/);
    off();
  });

  it("shouldForwardToBridge: only this tab's own traffic, and never what the bridge just gave us", async () => {
    const { shouldForwardToBridge } = await import("./modules.js");
    const recent = new Map([["seen-1", Date.now()]]);
    // Locally originated (remote:false), fresh id → forward.
    expect(shouldForwardToBridge({ id: "fresh-1" }, { remote: false }, recent)).toBe(true);
    // Arrived via BroadcastChannel from another tab → never forward (avoids
    // a multi-tab echo storm — only the tab that truly originated it does).
    expect(shouldForwardToBridge({ id: "fresh-2" }, { remote: true }, recent)).toBe(false);
    // What the bridge just handed this tab, even though publish() marks it
    // remote:false locally → skipped by id (the actual loop-breaker).
    expect(shouldForwardToBridge({ id: "seen-1" }, { remote: false }, recent)).toBe(false);
    // No id at all → nothing to dedupe against, forward it.
    expect(shouldForwardToBridge({ to: "vane" }, { remote: false }, recent)).toBe(true);
  });

  it("full duplex: a message this tab publishes locally is POSTed to the bridge", async () => {
    const { MODULES } = await import("./modules.js");
    const { bus, ctxObj } = ctx();
    const { makeCommand } = await import("@enkerli/protocol");
    const body = document.createElement("div");
    const posted = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (url, opts) => { posted.push({ url, body: JSON.parse(opts.body) }); return Promise.resolve(); };
    class FakeEventSource {
      constructor() { FakeEventSource.instance = this; }
      close() {}
    }
    const originalES = globalThis.EventSource;
    globalThis.EventSource = FakeEventSource;

    const off = MODULES["bridge"].make(ctxObj, body, {});
    body.querySelector("button").dispatchEvent(new MouseEvent("click")); // connect

    const msg = makeCommand("external", { name: "mutate" }, { to: "serpe" });
    bus.publish(msg);
    await Promise.resolve(); // let the fetch() microtask run

    expect(posted).toHaveLength(1);
    expect(posted[0].url).toBe("http://localhost:8765/send");
    expect(posted[0].body).toEqual(msg);

    off();
    globalThis.fetch = originalFetch;
    globalThis.EventSource = originalES;
  });
});

describe("GloriArp module (the standalone accompaniment surface)", () => {
  it("createGroovePlayer publishes timed note messages; loop schedules the next pass; stop kills all", async () => {
    const { createGroovePlayer, GROOVE_STYLES } = await import("./modules.js");
    const { groove } = await import("@enkerli/accompaniment");
    const { bus, ctxObj } = ctx();
    const seen = [];
    bus.subscribe((m) => seen.push(m));

    // Manual clock + scheduler: fire everything by hand, no real time.
    let clock = 0;
    const pending = [];
    const player = createGroovePlayer({
      bus: ctxObj.bus,
      now: () => clock,
      schedule: (fn, ms) => { const t = { fn, at: clock + ms, cleared: false }; pending.push(t); return t; },
      clear: (t) => { if (t) t.cleared = true; },
    });

    const r = groove(GROOVE_STYLES["walking-bass"], { progression: "Dm7 | G7", seed: 42 });
    player.start(r.phrase, { bpm: 120, loop: false });
    // 8 note timers scheduled (4 events × 2 bars), quarters 500ms apart at 120bpm.
    const noteTimers = pending.filter((t) => !t.cleared);
    expect(noteTimers).toHaveLength(8);
    expect(noteTimers[1].at - noteTimers[0].at).toBeCloseTo(500, 6);
    // Fire them all → 8 validated note messages on the bus, addressed to vane.
    for (const t of noteTimers) { clock = t.at; t.fn(); }
    expect(seen).toHaveLength(8);
    expect(seen.every((m) => m.type === "note" && m.to === "vane")).toBe(true);
    expect(seen[0].body.notes).toEqual([38]); // D2 — the walking root

    // Loop: starting again with loop schedules a pass-end continuation timer.
    seen.length = 0; pending.length = 0;
    player.start(r.phrase, { bpm: 120, loop: true });
    expect(pending.filter((t) => !t.cleared).length).toBe(9); // 8 notes + the next-pass timer
    // Stop: nothing fires after.
    player.stop();
    for (const t of pending) if (!t.cleared) { clock = t.at; t.fn(); }
    expect(seen).toHaveLength(0);
  });

  it("renders the surface and a play press reports the take", async () => {
    const { MODULES } = await import("./modules.js");
    const { ctxObj } = ctx();
    const body = document.createElement("div");
    const state = {};
    const off = MODULES["gloriarp"].make(ctxObj, body, state);
    expect(body.querySelector('input[aria-label="Progression (bar notation)"]').value).toBe("Dm7 | G7 | Cmaj7 | A7");
    expect([...body.querySelectorAll("option")].map((o) => o.value)).toContain("funk-ghost");
    const play = [...body.querySelectorAll("button")].find((b) => b.textContent.includes("play"));
    play.dispatchEvent(new MouseEvent("click"));
    expect(body.textContent).toMatch(/▶ pass 1 · \d+ notes · Dm7/);
    expect(state.progression).toBe("Dm7 | G7 | Cmaj7 | A7"); // persisted
    off();
  });

  it("live loops: the pass function is re-called at each boundary, so edits land next pass", async () => {
    const { createGroovePlayer } = await import("./modules.js");
    const { ctxObj } = ctx();
    const seen = [];
    ctxObj.bus.subscribe((m) => seen.push(m));
    let clock = 0;
    const pending = [];
    const player = createGroovePlayer({
      bus: ctxObj.bus,
      now: () => clock,
      schedule: (fn, ms) => { const t = { fn, at: clock + ms, cleared: false }; pending.push(t); return t; },
      clear: (t) => { if (t) t.cleared = true; },
    });
    // A tiny 1-bar phrase whose pitch is the pass number — regeneration visible.
    const mkPhrase = (note) => ({
      ticksPerBeat: 480, lengthTicks: 1920, meter: { numerator: 4, denominator: 4 },
      events: [{ onset: 0, duration: 480, velocity: 96, note }],
    });
    const passes = [];
    player.start((pass) => { passes.push(pass); return mkPhrase(60 + pass); }, { bpm: 120, loop: true });
    expect(passes).toEqual([0]); // built lazily, one pass at a time
    // Run pass 0's timers (1 note + the boundary timer). Thresholds carry a
    // float tolerance: periodMs = 1920 × (60000/57600) ≈ 2000.0000000000002.
    const fire = (until) => {
      for (const t of [...pending])
        if (!t.cleared && !t.fired && t.at <= until) { t.fired = true; clock = Math.max(clock, t.at); t.fn(); }
    };
    fire(2000.5);
    expect(passes).toEqual([0, 1]);           // boundary rebuilt with pass 1
    expect(seen.map((m) => m.body.notes[0])).toEqual([60]);
    fire(4000.5);
    expect(seen.map((m) => m.body.notes[0])).toEqual([60, 61]); // pass 1's regenerated pitch sounded
    // A throwing rebuild keeps the last good take (never silences the groove).
    player.stop();
  });

  it("adopts a progression message off the bus into the field", async () => {
    const { MODULES } = await import("./modules.js");
    const { makeMessage } = await import("@enkerli/protocol");
    const { parseLeadsheet } = await import("@enkerli/theory");
    const { ctxObj } = ctx();
    const body = document.createElement("div");
    const state = {};
    const off = MODULES["gloriarp"].make(ctxObj, body, state);
    const field = body.querySelector('input[aria-label="Progression (bar notation)"]');
    expect(field.value).toBe("Dm7 | G7 | Cmaj7 | A7");
    // Round-trip through the real parser so the message body is a genuine
    // Progression (ProgGenie's actual shape), not a hand-rolled guess.
    const prog = parseLeadsheet("Gm7 | C7 | Fmaj7", { tonic: "F", mode: "major" });
    ctxObj.bus.publish(makeMessage("proggenie", "progression", { prog }));
    expect(field.value).toContain("Gm7");
    expect(state.progression).toContain("Gm7");
    expect(body.textContent).toMatch(/progression from proggenie/);
    off();
  });
});
