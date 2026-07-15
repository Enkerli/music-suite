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
  const canvas = el("div", { class: "ws-canvas" });
  const store = loadStore();
  let seq = store.seq ?? 0;

  const live = new Map(); // id → { def, cleanup, panel }
  const ctx = { bus, save };

  function save() { persist({ seq, modules: [...live.values()].map((v) => v.def) }); }

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

  document.body.append(
    el("header", { class: "ws-topbar" },
      el("span", { class: "ws-brand", text: "Suite Workspace" }),
      el("span", { class: "ws-tagline", text: "modules on one bus — drag to arrange" }),
      adder,
      el("button", { class: "ws-btn ghost", text: "reset", title: "Clear layout",
        onclick: () => { localStorage.removeItem(STORE_KEY); location.reload(); } })),
    canvas);

  if (store.modules && store.modules.length) for (const d of store.modules) addModule(d.type, d);
  else { addModule("control-surface", { app: "vane", x: 24, y: 24 });
         addModule("pattern", { x: 360, y: 24 });
         addModule("monitor", { x: 24, y: 300 }); }
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
