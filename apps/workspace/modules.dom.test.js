// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { SuiteBus } from "./bus.js";
import { controlSurfaceModule, patternModule, monitorModule, summarize, pcsPadsModule, voiceSplitModule } from "./modules.js";

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

  it("imports a phrase.json and a model.json, adding each to the style list and using it", async () => {
    const { MODULES } = await import("./modules.js");
    const { extractPhrase, learnStyleModel, serializePhrase, serializeModel } = await import("@enkerli/accompaniment");
    const { ctxObj } = ctx();
    const body = document.createElement("div");
    const state = {};
    const off = MODULES["gloriarp"].make(ctxObj, body, state);

    const DM7 = { symbol: "Dm7", rootPc: 2, pcs: [2, 5, 9, 0] };
    const base = [{ pitch: 38, startTick: 0, durationTicks: 480, velocity: 96 },
                  { pitch: 41, startTick: 480, durationTicks: 480, velocity: 88 }];
    const mk = (id) => extractPhrase(base, { id, role: "bass", meter: { numerator: 4, denominator: 4 },
      ticksPerBeat: 480, lengthTicks: 1920, frame: DM7 });
    const phraseJson = serializePhrase(mk("imported-phrase"));
    const modelJson = serializeModel(learnStyleModel([mk("t0"), mk("t1")], { id: "imported-model" }));

    const importFile = async (text, filename) => {
      const input = body.querySelector('input[type="file"]');
      const file = new File([text], filename, { type: "application/json" });
      Object.defineProperty(input, "files", { value: [file], configurable: true });
      input.dispatchEvent(new Event("change"));
      for (let i = 0; i < 20 && !body.textContent.includes(filename.replace(/\.json$/, "")); i++)
        await new Promise((r) => setTimeout(r, 5));
    };

    await importFile(phraseJson, "my-phrase.json");
    expect(body.textContent).toMatch(/imported "my-phrase" — a source phrase/);
    const opts = [...body.querySelectorAll("option")].map((o) => o.value);
    expect(opts).toContain("my-phrase");
    const style = body.querySelector('select[aria-label="Style"]');
    expect(style.value).toBe("my-phrase"); // auto-selected

    await importFile(modelJson, "my-model.json");
    expect(body.textContent).toMatch(/imported "my-model" — a style MODEL \(2 takes/);
    expect(style.value).toBe("my-model");

    // The imported MODEL actually drives play (samples per pass, not a crash).
    const play = [...body.querySelectorAll("button")].find((b) => b.textContent.includes("play"));
    play.dispatchEvent(new MouseEvent("click"));
    expect(body.textContent).toMatch(/▶ pass 1 · \d+ notes/);
    off();
  });

  it("import in the PLUGIN: the button asks the native bridge instead of <input type=file>, and fileOpened lands it", async () => {
    // <input type="file"> doesn't work under WKWebView (docs/WORKSPACE_PLUGIN.md
    // §3) — this is the trap MIDIcurator hit first; the import button must
    // route through the bridge whenever a __JUCE__ backend is present.
    const emitted = [];
    let fileOpenedCb = null;
    window.__JUCE__ = {
      backend: {
        emitEvent: (id, payload) => emitted.push({ id, payload }),
        addEventListener: (id, cb) => { if (id === "fileOpened") fileOpenedCb = cb; },
      },
    };
    try {
      const { MODULES } = await import("./modules.js");
      const { extractPhrase, serializePhrase } = await import("@enkerli/accompaniment");
      const { ctxObj } = ctx();
      const body = document.createElement("div");
      const off = MODULES["gloriarp"].make(ctxObj, body, {});

      const importBtn = [...body.querySelectorAll("button")].find((b) => b.textContent.includes("import"));
      importBtn.dispatchEvent(new MouseEvent("click"));
      expect(emitted).toContainEqual({ id: "enkerliOpenFile", payload: { patterns: "*.json" } });
      expect(fileOpenedCb).toBeTypeOf("function"); // the module subscribed

      const DM7 = { symbol: "Dm7", rootPc: 2, pcs: [2, 5, 9, 0] };
      const phrase = extractPhrase(
        [{ pitch: 38, startTick: 0, durationTicks: 480, velocity: 96 }],
        { id: "p", role: "bass", meter: { numerator: 4, denominator: 4 }, ticksPerBeat: 480, lengthTicks: 480, frame: DM7 });
      const b64 = btoa(serializePhrase(phrase));
      fileOpenedCb({ name: "plugin-import.json", b64 });
      expect(body.textContent).toMatch(/imported "plugin-import" — a source phrase/);
      // A .mid on the same channel is NOT ours — ignored, no crash, no false import.
      fileOpenedCb({ name: "clip.mid", b64: btoa("whatever") });
      expect(body.textContent).not.toMatch(/import "clip"/);
      off();
    } finally {
      delete window.__JUCE__;
    }
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

  it("inflect: a groove result's per-note envelopes ride the note messages to Vane", async () => {
    const { createGroovePlayer, GROOVE_STYLES } = await import("./modules.js");
    const { groove } = await import("@enkerli/accompaniment");
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
    const r = groove(GROOVE_STYLES["walking-bass"], { progression: "Dm7 | G7", seed: 42, inflect: 1 });
    expect(r.inflections.length).toBeGreaterThan(0);
    player.start(r, { bpm: 120, loop: false }); // the FULL result, not just the phrase
    for (const t of [...pending]) if (!t.cleared) { clock = t.at; t.fn(); }
    expect(seen.length).toBeGreaterThan(0);
    for (const m of seen) {
      expect(Array.isArray(m.body.env)).toBe(true); // every note carries its curve
      expect(typeof m.body.articulation).toBe("string");
      expect(typeof m.body.attack).toBe("number");
    }
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

describe("plugin mode (docs/WORKSPACE_PLUGIN.md — fake __JUCE__ backend)", () => {
  /** Install a fake JUCE backend; returns emitted events + a teardown. */
  const fakeJuce = () => {
    const emitted = [];
    const listeners = new Map();
    window.__JUCE__ = {
      backend: {
        emitEvent: (id, payload) => emitted.push({ id, payload }),
        addEventListener: (id, cb) => listeners.set(id, cb),
      },
    };
    return { emitted, listeners, off: () => { delete window.__JUCE__; } };
  };

  it("bridge (CLI) module declares itself browser-only in the plugin", async () => {
    const { MODULES } = await import("./modules.js");
    const j = fakeJuce();
    const { ctxObj } = ctx();
    const body = document.createElement("div");
    const off = MODULES["bridge"].make(ctxObj, body, {});
    expect(body.textContent).toMatch(/browser-only/);
    expect(body.querySelector("input")).toBeNull(); // no URL field, no connect
    off();
    j.off();
  });

  it("GloriArp ⬇ .mid goes over the bridge (native save), never a blob anchor", async () => {
    const { MODULES } = await import("./modules.js");
    const j = fakeJuce();
    const { ctxObj } = ctx();
    const body = document.createElement("div");
    const state = {};
    const off = MODULES["gloriarp"].make(ctxObj, body, state);
    const dl = [...body.querySelectorAll("button")].find((b) => b.textContent.includes(".mid"));
    dl.dispatchEvent(new MouseEvent("click"));
    const save = j.emitted.find((e) => e.id === "enkerliSaveFile");
    expect(save).toBeDefined();
    expect(save.payload.name).toMatch(/^gloriarp-.*\.mid$/);
    expect(typeof save.payload.b64).toBe("string");
    expect(save.payload.b64.length).toBeGreaterThan(0);
    expect(body.textContent).toMatch(/native save/);
    off();
    j.off();
  });

  it("host MIDI in (enkerli-midi events) drives a midi-cc binding through the engine", async () => {
    const { MODULES } = await import("./modules.js");
    const j = fakeJuce();
    const { bus, ctxObj } = ctx();
    const seen = [];
    bus.subscribe((m) => seen.push(m));
    const body = document.createElement("div");
    // A control-map with a real MIDI trigger: CC 74 → Vane filter-cutoff.
    const state = { map: { id: "t", kind: "control-map", label: "t", bindings: [
      { trigger: { kind: "midi-cc", cc: 74 }, action: { app: "vane", param: "filter-cutoff" } },
    ] } };
    const off = MODULES["bindings"].make(ctxObj, body, state);
    window.dispatchEvent(new CustomEvent("enkerli-midi", { detail: { kind: "cc", cc: 74, channel: 1, value: 127 } }));
    expect(seen.length).toBeGreaterThan(0);
    expect(seen[0].type).toBe("param");
    expect(seen[0].to).toBe("vane");
    expect(seen[0].body.id).toBe("filter-cutoff");
    off();
    j.off();
  });
});

describe("the bento six (progression · keys · player · analysis · namer · recorder)", () => {
  it("progression: generate fills the field deterministically; → bus publishes; GloriArp adopts", async () => {
    const { MODULES } = await import("./modules.js");
    const { ctxObj } = ctx();
    const seen = [];
    ctxObj.bus.subscribe((m) => seen.push(m));
    const body = document.createElement("div");
    const state = {};
    MODULES["progression"].make(ctxObj, body, state);

    const gen = [...body.querySelectorAll("button")].find((b) => b.textContent.includes("generate"));
    gen.dispatchEvent(new MouseEvent("click"));
    const field = body.querySelector('input[aria-label="Progression (bar notation)"]');
    const first = field.value;
    expect(first).toMatch(/\|/); // bar notation with real bars
    gen.dispatchEvent(new MouseEvent("click"));
    expect(field.value).toBe(first); // same seed → same changes

    const pub = [...body.querySelectorAll("button")].find((b) => b.textContent.includes("bus"));
    pub.dispatchEvent(new MouseEvent("click"));
    const msg = seen.find((m) => m.type === "progression");
    expect(msg).toBeDefined();
    expect(msg.body.prog.sections[0].bars.length).toBeGreaterThan(1);

    // The loop closes in-workspace: GloriArp adopts it.
    const gBody = document.createElement("div");
    const gOff = MODULES["gloriarp"].make(ctxObj, gBody, {});
    pub.dispatchEvent(new MouseEvent("click"));
    // formatLeadsheet normalizes accidentals to Unicode (♭) on the way back —
    // same changes, suite display convention.
    const adopted = gBody.querySelector('input[aria-label="Progression (bar notation)"]').value;
    expect(adopted.replace(/♭/g, "b").replace(/♯/g, "#")).toBe(first.replace(/♭/g, "b").replace(/♯/g, "#"));
    gOff();
  });

  it("keys: a tap publishes a note message with the module's velocity/duration", async () => {
    const { MODULES } = await import("./modules.js");
    const { ctxObj } = ctx();
    const seen = [];
    ctxObj.bus.subscribe((m) => seen.push(m));
    const body = document.createElement("div");
    MODULES["keys"].make(ctxObj, body, { octave: 4, vel: 80, dur: 150 });
    body.querySelector('button[aria-label="Play D"]').dispatchEvent(new MouseEvent("click"));
    expect(seen).toHaveLength(1);
    expect(seen[0].type).toBe("note");
    expect(seen[0].body.notes).toEqual([62]); // D4
    expect(seen[0].body.velocity).toBe(80);
    expect(seen[0].body.durationMs).toBe(150);
  });

  it("player: latest bus pattern becomes an audible looping voice; analysis reads the same message", async () => {
    const { MODULES } = await import("./modules.js");
    const { makeMessage } = await import("@enkerli/protocol");
    const { ctxObj } = ctx();
    const seen = [];
    ctxObj.bus.subscribe((m) => { if (m.type === "note") seen.push(m); });
    const pBody = document.createElement("div");
    const pOff = MODULES["player"].make(ctxObj, pBody, { bpm: 120, note: 37 });
    const aBody = document.createElement("div");
    const aOff = MODULES["rhythm-analysis"].make(ctxObj, aBody, {});

    // Tresillo over 8 (leftmost = LSB): mask 73.
    ctxObj.bus.publish(makeMessage("serpe", "pattern", { steps: 8, mask: 73, name: "tresillo" }));
    expect(pBody.textContent).toMatch(/tresillo — press ▶/);
    expect(aBody.textContent).toMatch(/tresillo · 3\/8 onsets/);
    expect(aBody.textContent).toMatch(/0x94/);

    vi.useFakeTimers();
    try {
      [...pBody.querySelectorAll("button")].find((b) => b.textContent.includes("play"))
        .dispatchEvent(new MouseEvent("click"));
      // 8 steps of 16ths at 120bpm = 125ms/step; one full cycle:
      vi.advanceTimersByTime(8 * 125 - 5); // one full cycle, not a step into the next
      expect(seen.length).toBe(3); // three onsets of the tresillo
      expect(seen.every((m) => m.body.notes[0] === 37)).toBe(true);
      [...pBody.querySelectorAll("button")].find((b) => b.textContent.includes("stop"))
        .dispatchEvent(new MouseEvent("click"));
    } finally { vi.useRealTimers(); }
    pOff(); aOff();
  });

  it("chord namer names note messages crossing the bus", async () => {
    const { MODULES } = await import("./modules.js");
    const { makeNote } = await import("@enkerli/protocol");
    const { ctxObj } = ctx();
    const body = document.createElement("div");
    const off = MODULES["chord-namer"].make(ctxObj, body, {});
    ctxObj.bus.publish(makeNote("external", { notes: [60, 64, 67, 71] }));
    expect(body.textContent).toMatch(/C∆/); // the dictionary's display symbol for Cmaj7
    off();
  });

  it("recorder: captures bus traffic and replays it re-identified (dedupe-proof), looping", async () => {
    const { MODULES } = await import("./modules.js");
    const { makeNote } = await import("@enkerli/protocol");
    const { ctxObj } = ctx();
    const body = document.createElement("div");
    const state = {};
    const off = MODULES["recorder"].make(ctxObj, body, state);
    const btn = (t) => [...body.querySelectorAll("button")].find((b) => b.textContent.includes(t));

    vi.useFakeTimers();
    try {
      btn("rec").dispatchEvent(new MouseEvent("click"));
      ctxObj.bus.publish(makeNote("external", { notes: [60] }));
      vi.advanceTimersByTime(100);
      ctxObj.bus.publish(makeNote("external", { notes: [64] }));
      expect(body.textContent).toMatch(/● 2 messages/);

      const replayed = [];
      ctxObj.bus.subscribe((m) => { if (m.type === "note") replayed.push(m); });
      btn("play").dispatchEvent(new MouseEvent("click"));
      vi.advanceTimersByTime(200);
      expect(replayed.length).toBe(2); // both came back — new ids beat the dedupe
      expect(replayed.map((m) => m.body.notes[0])).toEqual([60, 64]);
      btn("stop").dispatchEvent(new MouseEvent("click"));
      expect(state.tape.length).toBe(2); // tape persisted to module state
    } finally { vi.useRealTimers(); }
    off();
  });
});

describe("vane synth · transforms · library", () => {
  it("the bundled worklet copy matches its source (drift guard)", async () => {
    const { readFileSync, existsSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    // jsdom rewrites import.meta.url to an http: URL, so anchor on cwd instead
    // (works from both the monorepo root and apps/workspace).
    const here = existsSync(resolve("vane-worklet.txt")) ? "." : "apps/workspace";
    const a = readFileSync(resolve(here, "vane-worklet.txt"), "utf8");
    const b = readFileSync(resolve(here, "../vane/synth/worklet.js"), "utf8");
    expect(a).toBe(b); // stale? run: npm run sync-worklet -w workspace-webui
  });

  it("wireVaneBus routes bus messages into the voice: breath before notes, params to wasm ids", async () => {
    const { wireVaneBus } = await import("./modules.js");
    const { makeNote, makeParam } = await import("@enkerli/protocol");
    const { ctxObj } = ctx();
    const posted = [];
    const off = wireVaneBus(ctxObj.bus, (m) => posted.push(m));

    ctxObj.bus.publish(makeNote("external", { notes: [60, 64], velocity: 100, durationMs: 10 }, { to: "vane" }));
    // The wind-model contract: CC2 breath FIRST, then the noteOns.
    expect(posted[0]).toMatchObject({ type: "cc", cc: 2 });
    expect(posted[1]).toMatchObject({ type: "noteOn", note: 60 });
    expect(posted[2]).toMatchObject({ type: "noteOn", note: 64 });

    posted.length = 0;
    ctxObj.bus.publish(makeParam("external", { id: "filter-cutoff", value: 1200 }, { to: "vane" }));
    expect(posted).toHaveLength(1);
    expect(posted[0]).toMatchObject({ type: "param", value: 1200 });
    expect(typeof posted[0].id).toBe("number"); // resolved to the wasm param id
    off();
  });

  it("vane synth module fails honestly where Web Audio is absent", async () => {
    const { MODULES } = await import("./modules.js");
    const { ctxObj } = ctx();
    const body = document.createElement("div");
    const off = MODULES["vane-synth"].make(ctxObj, body, {});
    [...body.querySelectorAll("button")].find((b) => b.textContent.includes("power"))
      .dispatchEvent(new MouseEvent("click"));
    await new Promise((r) => setTimeout(r, 0));
    expect(body.textContent).toMatch(/✗ audio:/); // happy-dom has no AudioContext — say so
    off();
  });

  it("transforms rework the bus pattern and republish (analysis follows)", async () => {
    const { MODULES } = await import("./modules.js");
    const { makeMessage } = await import("@enkerli/protocol");
    const { ctxObj } = ctx();
    const seen = [];
    ctxObj.bus.subscribe((m) => { if (m.type === "pattern") seen.push(m); });
    const tBody = document.createElement("div");
    const tOff = MODULES["transforms"].make(ctxObj, tBody, {});
    const aBody = document.createElement("div");
    const aOff = MODULES["rhythm-analysis"].make(ctxObj, aBody, {});

    ctxObj.bus.publish(makeMessage("serpe", "pattern", { steps: 8, mask: 73, name: "tresillo" }));
    const btn = (t) => [...tBody.querySelectorAll("button")].find((b) => b.getAttribute("title")?.includes(t));
    btn("Rotate one step later").dispatchEvent(new MouseEvent("click"));
    const rot = seen[seen.length - 1];
    expect(rot.body.steps).toBe(8);
    expect(rot.body.mask).toBe(146); // tresillo rotated one step later: 01001001₂(LSB-left) = 146
    expect(aBody.textContent).toMatch(/rot\+1/);

    btn("Complement").dispatchEvent(new MouseEvent("click"));
    expect(seen[seen.length - 1].body.mask).toBe(255 - 146); // onsets ↔ rests
    tOff(); aOff();
  });

  it("library captures bus items, survives reload, replays re-identified", async () => {
    const { MODULES } = await import("./modules.js");
    const { makeMessage } = await import("@enkerli/protocol");
    localStorage.removeItem("enkerli.workspace.library");
    const { ctxObj } = ctx();
    const body = document.createElement("div");
    const off = MODULES["library"].make(ctxObj, body, {});

    ctxObj.bus.publish(makeMessage("serpe", "pattern", { steps: 8, mask: 73, name: "tresillo" }));
    [...body.querySelectorAll("button")].find((b) => b.textContent.includes("+ pattern"))
      .dispatchEvent(new MouseEvent("click"));
    expect(body.textContent).toMatch(/tresillo/);
    off();

    // "Reload": a fresh module instance reads the same shelf.
    const body2 = document.createElement("div");
    const { ctxObj: ctx2 } = ctx();
    const seen = [];
    ctx2.bus.subscribe((m) => seen.push(m));
    const off2 = MODULES["library"].make(ctx2, body2, {});
    expect(body2.textContent).toMatch(/tresillo/);
    body2.querySelector('button[aria-label^="Load"]').dispatchEvent(new MouseEvent("click"));
    expect(seen).toHaveLength(1);
    expect(seen[0].type).toBe("pattern");
    expect(seen[0].body.mask).toBe(73); // the saved tresillo came back — new id, same music
    off2();
    localStorage.removeItem("enkerli.workspace.library");
  });
});

describe("PCS Pads module (docs/PITCHFOLD_AUDIT.md follow-up)", () => {
  it("renders 8 pads and broadcasts a scale message when one is tapped", () => {
    const { bus, ctxObj } = ctx();
    const seen = [];
    bus.subscribe((m) => seen.push(m));
    const body = document.createElement("div");
    const state = {};
    pcsPadsModule(ctxObj, body, state);

    expect(body.querySelectorAll(".ws-pad").length).toBe(8);
    body.querySelectorAll(".ws-pad-main")[1].dispatchEvent(new MouseEvent("click")); // Dorian
    const scale = seen.find((m) => m.type === "scale");
    expect(scale.body).toMatchObject({ mask: 0x06AD, root: 0, name: "Dorian" });
    expect(body.querySelectorAll(".ws-pad")[1].className).toMatch(/active/);
    expect(state.selected).toBe(1);
  });

  it("learn grabs the last scale heard on the bus into the tapped pad", () => {
    const { bus, ctxObj } = ctx();
    const body = document.createElement("div");
    const state = {};
    pcsPadsModule(ctxObj, body, state);

    // nothing heard yet — learn is a no-op, doesn't touch the pad
    body.querySelectorAll(".ws-pad-learn")[0].dispatchEvent(new MouseEvent("click"));
    expect(state.pads[0].label).toBe("Ionian");

    bus.publish({ protocol: "enkerli-suite", v: 1, id: "scale-msg-1", from: "pickpcs", to: "*",
      sentAt: "2026-07-20T00:00:00Z", type: "scale", body: { mask: 0x0555, root: 3, name: "Whole Tone" } });
    body.querySelectorAll(".ws-pad-learn")[0].dispatchEvent(new MouseEvent("click"));
    expect(state.pads[0]).toMatchObject({ mask: 0x0555, root: 3, label: "Whole Tone" });
    // pad 1's own broadcast now carries the learned scale, not the old default
    body.querySelectorAll(".ws-pad-main")[0].dispatchEvent(new MouseEvent("click"));
  });

  it("a fresh module instance restores pads from saved state (no re-seed)", () => {
    const { ctxObj } = ctx();
    const body = document.createElement("div");
    const saved = { pads: [{ mask: 0x0001, root: 0, label: "Custom" }, ...Array.from({ length: 7 }, () => ({ mask: 0, root: 0, label: "x" }))] };
    pcsPadsModule(ctxObj, body, saved);
    expect(body.querySelectorAll(".ws-pad-name")[0].textContent).toBe("Custom");
  });
});

describe("Voice Split module (docs/PITCHFOLD_AUDIT.md — @enkerli/voice-routing)", () => {
  const note = (from, notes, over = {}) => ({
    protocol: "enkerli-suite", v: 1, id: `n-${Math.random()}`, from, to: "*",
    sentAt: "2026-07-20T00:00:00Z", type: "note", body: { notes, ...over },
  });

  it("re-publishes incoming notes round-robinned across the configured channel span", () => {
    const { bus, ctxObj } = ctx();
    const seen = [];
    bus.subscribe((m) => { if (m.type === "note") seen.push(m); });
    const body = document.createElement("div");
    voiceSplitModule(ctxObj, body, { baseChannel: 3, channelSpan: 2, sendTo: "vane" });

    bus.publish(note("proggenie", [60]));
    bus.publish(note("proggenie", [62]));
    bus.publish(note("proggenie", [64]));

    const outs = seen.filter((m) => m.from === "external");
    expect(outs.map((m) => m.body.channel)).toEqual([3, 4, 3]);
    expect(outs.every((m) => m.to === "vane")).toBe(true);
  });

  it("never re-processes its own output (loop guard)", () => {
    const { bus, ctxObj } = ctx();
    const seen = [];
    bus.subscribe((m) => { if (m.type === "note") seen.push(m); });
    const body = document.createElement("div");
    voiceSplitModule(ctxObj, body, { baseChannel: 1, channelSpan: 4, sendTo: "vane" });

    bus.publish(note("external", [60])); // as if we'd somehow heard our own message
    expect(seen.filter((m) => m.from === "external" && m.to === "vane").length).toBe(0);
  });

  it("the 'from' filter ignores notes from apps other than the chosen source", () => {
    const { bus, ctxObj } = ctx();
    const seen = [];
    bus.subscribe((m) => { if (m.type === "note") seen.push(m); });
    const body = document.createElement("div");
    voiceSplitModule(ctxObj, body, { listenFrom: "proggenie", baseChannel: 1, channelSpan: 4, sendTo: "vane" });

    bus.publish(note("midicurator", [60])); // wrong source, ignored
    bus.publish(note("proggenie", [62]));   // right source, split
    const outs = seen.filter((m) => m.from === "external");
    expect(outs.length).toBe(1);
    expect(outs[0].body.notes).toEqual([62]);
  });

  it("reset restarts the rotation from the base channel", () => {
    const { bus, ctxObj } = ctx();
    const seen = [];
    bus.subscribe((m) => { if (m.type === "note") seen.push(m); });
    const body = document.createElement("div");
    voiceSplitModule(ctxObj, body, { baseChannel: 1, channelSpan: 3, sendTo: "vane" });

    bus.publish(note("proggenie", [60])); // ch 1
    bus.publish(note("proggenie", [61])); // ch 2
    [...body.querySelectorAll("button")].find((b) => b.textContent.includes("reset")).dispatchEvent(new MouseEvent("click"));
    bus.publish(note("proggenie", [62])); // back to ch 1
    const outs = seen.filter((m) => m.from === "external");
    expect(outs.map((m) => m.body.channel)).toEqual([1, 2, 1]);
  });
});
