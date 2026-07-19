/**
 * Suite Workspace — the single-page, movable-module projection of the control
 * & interop plane (docs/MASTER_PLAN.md §1.2 B2). Modules float on a canvas, are
 * dragged around, and talk over a shared SuiteBus. It is deliberately a *thin
 * adapter*: the control surface is generated from tool manifests, the pattern
 * module is @enkerli/upi, the messages are @enkerli/protocol — the workspace
 * just hosts them on a bus and lets you move them. This file is the shell
 * (styles, canvas, drag, persistence); the modules live in modules.js.
 */
import { SuiteBus } from "./bus.js";
import { MODULES, el } from "./modules.js";
import { juceAvailable, juceEmit, juceOn, sendNoteOut, sendState } from "./juce-bridge.js";
import tokensCss from "@enkerli/ui/tokens.css";
import componentsCss from "@enkerli/ui/components.css";
import workspaceCss from "./workspace.css";

const STORE_KEY = "enkerli.workspace.v1";

function injectStyles() {
  const s = document.createElement("style");
  s.textContent = [tokensCss, componentsCss, workspaceCss].join("\n");
  document.head.append(s);
}

function main() {
  injectStyles();
  const bus = new SuiteBus({ channelName: "enkerli-workspace" }); // cross-tab too

  // ── Plugin mode (docs/WORKSPACE_PLUGIN.md): the bus's edges swap ──────────
  // Browser: notes reach the Vane TAB over BroadcastChannel. Plugin: every
  // bus `note` ALSO exits as real MIDI through the host — the GloriArp
  // module needs zero changes to drive any synth on the next track.
  if (juceAvailable()) {
    bus.subscribe((msg) => { if (msg.type === "note" && msg.body) sendNoteOut(msg.body); });
    // Host MIDI in → a page event the bindings module feeds to its engine
    // (@enkerli/control already speaks midi-cc/midi-note — the workspace
    // just never had a MIDI source until the plugin supplied one).
    juceOn("midiIn", (e) => {
      try { window.dispatchEvent(new CustomEvent("enkerli-midi", { detail: e })); } catch { /* page teardown */ }
    });
  }
  const canvas = el("div", { class: "ws-canvas" });
  const store = loadStore();
  let seq = store.seq ?? 0;

  const live = new Map(); // id → { def, cleanup, panel }
  const ctx = { bus, save };

  function save() {
    const state = { seq, modules: [...live.values()].map((v) => v.def) };
    persist(state);
    // Plugin: mirror into the DAW session too (getStateInformation stores it),
    // so a saved project reopens with this exact layout on any machine.
    if (juceAvailable()) { try { sendState(JSON.stringify(state)); } catch { /* bridge gone */ } }
  }

  function addModule(type, def = {}) {
    const meta = MODULES[type];
    if (!meta) return;
    const id = def.id ?? `m${++seq}`;
    const d = { id, type, app: def.app, upi: def.upi,
      x: def.x ?? 24 + (live.size * 28) % 240, y: def.y ?? 24 + (live.size * 24) % 200 };
    const body = el("div", { class: "ws-body" });
    const panel = el("section", { class: "ws-module", style: `left:${d.x}px; top:${d.y}px`, "aria-label": meta.title },
      el("header", { class: "ws-head" },
        el("span", { class: "ws-title", text: meta.title }),
        el("button", { class: "ws-x", text: "✕", title: "Remove", "aria-label": `Remove ${meta.title}`,
          onclick: () => removeModule(id) })),
      body);
    canvas.append(panel);
    makeDraggable(panel, panel.querySelector(".ws-head"), d, save);
    const cleanup = meta.make(ctx, body, d);
    live.set(id, { def: d, cleanup, panel });
    save();
  }
  function removeModule(id) {
    const v = live.get(id);
    if (!v) return;
    if (typeof v.cleanup === "function") v.cleanup();
    v.panel.remove();
    live.delete(id);
    save();
  }

  const adder = el("select", { class: "ws-select", "aria-label": "Add a module",
    onchange: () => { if (adder.value) { addModule(adder.value); adder.value = ""; } } },
    el("option", { value: "", text: "+ add module" }),
    ...Object.entries(MODULES).map(([k, v]) => el("option", { value: k, text: v.title })));

  // Host transport chip (plugin only): bpm + play state from the C++ side.
  const hostChip = juceAvailable() ? el("span", { class: "ws-readout", text: "host —" }) : null;
  if (hostChip) juceOn("transport", (t) => {
    if (!t) return;
    hostChip.textContent = `host ${Math.round(t.bpm || 0)} bpm ${t.playing ? "▶" : "■"}`;
  });

  document.body.append(
    el("header", { class: "ws-topbar" },
      el("span", { class: "ws-brand", text: "Suite Workspace" }),
      el("span", { class: "ws-tagline", text: "modules on one bus — drag to arrange" }),
      ...(hostChip ? [hostChip] : []),
      adder,
      el("button", { class: "ws-btn ghost", text: "reset", title: "Clear layout",
        onclick: () => { localStorage.removeItem(STORE_KEY); location.reload(); } })),
    canvas);

  function boot(fromStore) {
    if (fromStore.modules && fromStore.modules.length) {
      seq = fromStore.seq ?? seq;
      for (const d of fromStore.modules) addModule(d.type, d);
    }
    else { addModule("control-surface", { app: "vane", x: 24, y: 24 });
           addModule("pattern", { x: 360, y: 24 });
           addModule("bindings", { x: 360, y: 300 });
           addModule("monitor", { x: 24, y: 300 }); }
  }

  if (juceAvailable()) {
    // The DAW session's saved layout wins over the container's localStorage;
    // wait briefly for it after the uiReady handshake, then fall back — a
    // fresh session (no state yet) must never hang the page.
    let booted = false;
    const bootOnce = (fromStore) => { if (!booted) { booted = true; boot(fromStore); } };
    juceOn("state", (s) => {
      try {
        const parsed = typeof s?.json === "string" ? JSON.parse(s.json) : s;
        if (parsed && parsed.modules) { bootOnce(parsed); return; }
      } catch { /* malformed session state — fall through to local */ }
      bootOnce(store);
    });
    setTimeout(() => bootOnce(store), 400);
    juceEmit("uiReady", {});
  } else {
    boot(store);
  }
}

function makeDraggable(panel, handle, def, save) {
  let sx = 0, sy = 0, ox = 0, oy = 0, dragging = false;
  handle.style.cursor = "grab";
  handle.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".ws-x")) return;
    dragging = true; sx = e.clientX; sy = e.clientY; ox = def.x; oy = def.y;
    handle.setPointerCapture?.(e.pointerId);
    handle.style.cursor = "grabbing"; panel.classList.add("dragging");
  });
  handle.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    def.x = Math.max(0, ox + (e.clientX - sx));
    def.y = Math.max(0, oy + (e.clientY - sy));
    panel.style.left = def.x + "px"; panel.style.top = def.y + "px";
  });
  const end = () => { if (dragging) { dragging = false; handle.style.cursor = "grab"; panel.classList.remove("dragging"); save(); } };
  handle.addEventListener("pointerup", end);
  handle.addEventListener("pointercancel", end);
}

function loadStore() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; }
}
function persist(state) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* private mode */ }
}

if (typeof document !== "undefined") main();
