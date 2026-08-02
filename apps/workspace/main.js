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
import { initTheme } from "@enkerli/ui/theme";
import { createGlobalCluster } from "@enkerli/ui/global-cluster";
import tokensCss from "@enkerli/ui/tokens.css";
import componentsCss from "@enkerli/ui/components.css";
import workspaceCss from "./workspace.css";

// Shared frame: the ONE theme mechanism (`enkerli.theme` + [data-theme])
// stamps before first paint; the global cluster below carries the toggle.
initTheme();

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
  const canvas = el("main", { class: "ws-canvas" });
  const store = loadStore();
  let seq = store.seq ?? 0;

  // Bento layout (no free drag, no overlap — the grid aligns by
  // construction): modules are an ORDERED list; each has a span (s=1×1,
  // w=wide, t=tall, l=large). ◀/▶ reorder, ⤢ cycles the span. `dense`
  // grid flow back-fills, so mixed spans tile like a bento box.
  const order = []; // ids, in grid order
  const live = new Map(); // id → { def, cleanup, panel }
  const ctx = { bus, save };
  const SPANS = ["s", "w", "t", "l"];
  const SPAN_LABEL = { s: "1×1", w: "wide", t: "tall", l: "large" };

  function save() {
    const state = { seq, modules: order.map((id) => live.get(id)?.def).filter(Boolean) };
    persist(state);
    // Plugin: mirror into the DAW session too (getStateInformation stores it),
    // so a saved project reopens with this exact layout on any machine.
    if (juceAvailable()) { try { sendState(JSON.stringify(state)); } catch { /* bridge gone */ } }
  }

  function applySpan(panel, span) {
    panel.classList.remove("ws-span-w", "ws-span-t", "ws-span-l");
    if (span && span !== "s") panel.classList.add(`ws-span-${span}`);
  }
  function reflow() {
    for (const id of order) { const v = live.get(id); if (v) canvas.append(v.panel); }
  }
  function move(id, delta) {
    const i = order.indexOf(id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    reflow(); save();
  }

  function addModule(type, def = {}) {
    const meta = MODULES[type];
    if (!meta) return;
    const id = def.id ?? `m${++seq}`;
    const d = { id, type, app: def.app, upi: def.upi, span: SPANS.includes(def.span) ? def.span : "s" };
    const body = el("div", { class: "ws-body" });
    const spanBtn = el("button", { class: "ws-order", text: "⤢", title: `Size: ${SPAN_LABEL[d.span]} — click to cycle`,
      "aria-label": `Resize ${meta.title}`, onclick: () => {
        d.span = SPANS[(SPANS.indexOf(d.span) + 1) % SPANS.length];
        spanBtn.title = `Size: ${SPAN_LABEL[d.span]} — click to cycle`;
        applySpan(panel, d.span); save();
      } });
    const panel = el("section", { class: "ws-module", "aria-label": meta.title },
      el("header", { class: "ws-head" },
        el("span", { class: "ws-title", text: meta.title }),
        el("button", { class: "ws-order", text: "◀", title: "Move earlier", "aria-label": `Move ${meta.title} earlier`,
          onclick: () => move(id, -1) }),
        el("button", { class: "ws-order", text: "▶", title: "Move later", "aria-label": `Move ${meta.title} later`,
          onclick: () => move(id, +1) }),
        spanBtn,
        el("button", { class: "ws-x", text: "✕", title: "Remove", "aria-label": `Remove ${meta.title}`,
          onclick: () => removeModule(id) })),
      body);
    applySpan(panel, d.span);
    canvas.append(panel);
    const cleanup = meta.make(ctx, body, d);
    order.push(id);
    live.set(id, { def: d, cleanup, panel });
    save();
  }
  function removeModule(id) {
    const v = live.get(id);
    if (!v) return;
    if (typeof v.cleanup === "function") v.cleanup();
    v.panel.remove();
    live.delete(id);
    const i = order.indexOf(id);
    if (i >= 0) order.splice(i, 1);
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

  // Shared frame, slot-for-slot with the other apps: theme toggle + density.
  // MIDI and Library stay per-module here (the bus and the Library module own
  // them) — the cluster's own slots would duplicate, not unify.
  const clusterHost = el("span", { class: "ws-cluster" });
  createGlobalCluster(clusterHost, { densityTarget: document.body });

  document.body.append(
    el("header", { class: "ws-topbar" },
      el("h1", { class: "ws-brand", text: "Suite Workspace" }),
      el("span", { class: "ws-tagline", text: "modules on one bus — a bento grid: ◀ ▶ to reorder, ⤢ to resize" }),
      ...(hostChip ? [hostChip] : []),
      adder,
      el("button", { class: "ws-btn ghost", text: "reset", title: "Clear layout",
        onclick: () => { localStorage.removeItem(STORE_KEY); location.reload(); } }),
      clusterHost),
    canvas);

  function boot(fromStore) {
    if (fromStore.modules && fromStore.modules.length) {
      seq = fromStore.seq ?? seq;
      // Layouts saved before the bento grid carried x/y — order stood in
      // reading order (top-left first), so sort once and drop the coords.
      const defs = [...fromStore.modules];
      if (defs.some((d) => d.x !== undefined || d.y !== undefined))
        defs.sort((a, b) => (a.y ?? 0) - (b.y ?? 0) || (a.x ?? 0) - (b.x ?? 0));
      for (const d of defs) addModule(d.type, d);
    }
    else {
      // A default layout that MAKES SOUND. Until 2026-08-02 this opened with
      // Control Surface, Pattern, Bindings and Monitor — no synth and no
      // player, so typing a UPI pattern published a `pattern` message that
      // nothing turned into notes and nothing sounded. The workbench looked
      // mute, and the only way to hear anything was a second Vane tab.
      //
      // Pattern → Player → Vane Synth is the whole chain, so the first thing a
      // person does in Workspace can be heard in Workspace. (The synth still
      // needs its ⏻ — starting audio without a gesture is not ours to do.)
      addModule("control-surface", { app: "vane", span: "t" });
      addModule("pattern", {});
      addModule("player", {});
      addModule("vane-synth", {});
      addModule("bindings", {});
      addModule("monitor", {});
    }
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

function loadStore() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; }
}
function persist(state) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* private mode */ }
}

if (typeof document !== "undefined") main();
