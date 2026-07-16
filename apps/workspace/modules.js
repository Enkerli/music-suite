/**
 * Workspace module factories — the DOM-building logic, kept free of CSS/asset
 * imports so it runs under happy-dom in tests (main.js adds the shell, styles,
 * and drag). Each factory fills a body element from a bus + module state and
 * returns an optional cleanup fn. These are the plane's citizens: a
 * manifest-driven control surface, a @enkerli/upi pattern module, a bus
 * monitor — all talking SuiteMessages over the shared bus.
 */
import { sliderToNative, nativeToSlider, paramSet, commandInvoke, formatValue } from "./model.js";
import { makeMessage } from "@enkerli/protocol";
import { parseUPI, analyse } from "@enkerli/upi";
import { createBindingEngine, addBinding, removeBinding } from "@enkerli/control";
import vaneManifest from "../vane/manifest.json";
import serpeManifest from "../serpe/manifest.json";

export const MANIFESTS = { vane: vaneManifest, serpe: serpeManifest };
export const FROM = "external"; // the workspace is an external control surface on the plane

export const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") e.className = v;
    else if (k === "text") e.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
    else if (v != null) e.setAttribute(k, v);
  }
  for (const kid of kids) if (kid != null) e.append(kid);
  return e;
};

export function summarize(m) {
  const route = `${m.from}→${m.to}`;
  const b = m.body;
  if (m.type === "param") return b.params
    ? `param ${b.mode ?? "set"} [${route}] ${b.params.map((p) => `${p.id}=${p.value}`).join(" ")}`
    : `param ${b.mode ?? "set"} [${route}] ${b.id}=${typeof b.value === "number" ? +b.value.toFixed(3) : b.value}`;
  if (m.type === "command") return `command [${route}] ${b.name}${b.args ? `(${Object.entries(b.args).map(([k, v]) => `${k}=${v}`).join(",")})` : ""}`;
  if (m.type === "pattern") return `pattern [${route}] ${b.steps} steps, mask ${b.mask}${b.name ? ` (${b.name})` : ""}`;
  return `${m.type} [${route}]`;
}

export function controlSurfaceModule(ctx, bodyEl, state) {
  const app = state.app ?? "vane";
  const select = el("select", { class: "ws-select", "aria-label": "Target tool",
    onchange: () => { state.app = select.value; ctx.save(); render(); } },
    ...Object.keys(MANIFESTS).map((a) => el("option", { value: a, text: a, ...(a === app ? { selected: "" } : {}) })));
  select.value = app;
  const controls = el("div", { class: "ws-controls" });
  bodyEl.append(el("div", { class: "ws-row" }, el("span", { class: "ws-label", text: "tool" }), select), controls);

  function render() {
    const m = MANIFESTS[select.value];
    controls.replaceChildren();
    for (const spec of m.params) {
      const readout = el("span", { class: "ws-readout", text: formatValue(spec, spec.default) });
      const slider = el("input", { type: "range", min: "0", max: "1", step: "0.0001",
        value: String(nativeToSlider(spec.default, spec)), class: "ws-slider", "aria-label": spec.label,
        "data-param": spec.id });
      slider.addEventListener("input", () => {
        const native = sliderToNative(+slider.value, spec);
        readout.textContent = formatValue(spec, native);
        ctx.bus.publish(paramSet(FROM, select.value, spec.id, native));
      });
      controls.append(el("label", { class: "ws-param" },
        el("span", { class: "ws-param-name", text: spec.label }), slider, readout));
    }
    if (m.commands.length) {
      const row = el("div", { class: "ws-cmds" });
      for (const c of m.commands) {
        const args = (c.args ?? []).reduce((o, a) => (o[a.id] = a.default, o), {});
        row.append(el("button", { class: "ws-btn", text: c.label, "data-cmd": c.name,
          onclick: () => ctx.bus.publish(commandInvoke(FROM, select.value, c.name, Object.keys(args).length ? args : undefined)) }));
      }
      controls.append(row);
    }
  }
  render();
}

export function patternModule(ctx, bodyEl, state) {
  const input = el("input", { class: "ws-text", type: "text", value: state.upi ?? "E(3,8)",
    "aria-label": "UPI notation", spellcheck: "false" });
  const lane = el("div", { class: "ws-lane", "aria-hidden": "true" });
  const info = el("div", { class: "ws-readout" });

  function draw(steps, note) {
    lane.replaceChildren(...steps.map((s) => el("span", { class: `ws-step${s ? " on" : ""}` })));
    info.textContent = note;
  }
  function send() {
    const r = parseUPI(input.value, { n: 16 });
    if (!r.ok) { info.textContent = "unparsed"; return; }
    state.upi = input.value; ctx.save();
    const a = analyse(r.steps);
    draw(r.steps, `${a.n} steps · ${a.k} onsets · mask ${a.decimal} (${a.hex})`);
    ctx.bus.publish(makeMessage(FROM, "pattern", { steps: a.n, mask: a.decimal, name: r.label }, { to: "*" }));
  }
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });
  bodyEl.append(
    el("div", { class: "ws-row" }, input, el("button", { class: "ws-btn", text: "▶ send", onclick: send })),
    lane, info);
  const off = ctx.bus.subscribe((m) => {
    if (m.type !== "pattern") return;
    const steps = Array.from({ length: m.body.steps }, (_, i) => (m.body.mask >> i) & 1); // leftmost = LSB
    draw(steps, `via bus ← ${m.from}: ${m.body.name ?? ""} (mask ${m.body.mask})`);
  });
  send();
  return off;
}

export function monitorModule(ctx, bodyEl) {
  const log = el("div", { class: "ws-log", role: "log", "aria-live": "polite" });
  bodyEl.append(log);
  return ctx.bus.subscribe((m) => {
    const line = el("div", { class: "ws-logline", text: `${new Date().toLocaleTimeString()}  ${summarize(m)}` });
    log.prepend(line);
    while (log.childElementCount > 60) log.lastElementChild.remove();
  });
}

// ── Bindings: the in-app control-map editor, that RUNS the map ────────────────
// Edit a control-map (key → app command/param); the workspace runs it, so a
// keystroke fires a message on the bus and drives the real app (which receives).

const DEFAULT_BINDINGS = {
  id: "workspace-bindings", kind: "control-map", label: "Workspace bindings",
  bindings: [
    { trigger: { kind: "key", combo: "]" }, action: { app: "serpe", command: "rotate", args: { by: 1 } } },
    { trigger: { kind: "key", combo: "[" }, action: { app: "serpe", command: "rotate", args: { by: -1 } } },
    { trigger: { kind: "key", combo: "m" }, action: { app: "serpe", command: "mutate" } },
  ],
};

function comboFromKeyEvent(e) {
  const parts = [];
  if (e.ctrlKey) parts.push("ctrl");
  if (e.altKey) parts.push("alt");
  if (e.metaKey) parts.push("mod");
  if (e.shiftKey) parts.push("shift");
  const k = String(e.key).toLowerCase();
  if (!["control", "alt", "meta", "shift"].includes(k)) parts.push(k);
  return parts.join("+");
}
const isTyping = (t) => t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
const actionLabel = (a) => a.command ? `${a.app}.${a.command}${a.args ? `(${Object.entries(a.args).map(([k, v]) => `${k}=${v}`).join(",")})` : ""}` : `${a.app}.${a.param}=${a.value}`;

function bindingsModule(ctx, bodyEl, state) {
  let map = state.map ?? DEFAULT_BINDINGS;
  const manifests = Object.values(MANIFESTS);
  const engine = createBindingEngine({ map, manifests, send: (m) => ctx.bus.publish(m) });

  const list = el("div", { class: "ws-controls" });
  const captured = { combo: "" };
  const keyInput = el("input", { class: "ws-text", type: "text", readonly: "", placeholder: "press a key…", "aria-label": "Trigger key" });
  keyInput.addEventListener("keydown", (e) => { e.preventDefault(); captured.combo = comboFromKeyEvent(e); keyInput.value = captured.combo; });
  const appSel = el("select", { class: "ws-select", "aria-label": "Target app", onchange: () => fillActions() },
    ...Object.keys(MANIFESTS).map((a) => el("option", { value: a, text: a })));
  const actSel = el("select", { class: "ws-select", "aria-label": "Action" });
  function fillActions() {
    const m = MANIFESTS[appSel.value];
    actSel.replaceChildren(
      ...m.commands.map((c) => el("option", { value: `cmd:${c.name}`, text: `⚡ ${c.label}` })),
      ...m.params.map((p) => el("option", { value: `param:${p.id}`, text: `▸ ${p.label}` })));
  }
  fillActions();
  const addBtn = el("button", { class: "ws-btn", text: "+ add", onclick: () => {
    if (!captured.combo || !actSel.value) return;
    const [kind, id] = actSel.value.split(":");
    let action;
    if (kind === "cmd") {
      const cmd = MANIFESTS[appSel.value].commands.find((c) => c.name === id);
      const args = (cmd.args ?? []).reduce((o, a) => (o[a.id] = a.default, o), {});
      action = { app: appSel.value, command: id, ...(Object.keys(args).length ? { args } : {}) };
    } else {
      const p = MANIFESTS[appSel.value].params.find((x) => x.id === id);
      action = { app: appSel.value, param: id, value: p.default };
    }
    map = addBinding(map, { trigger: { kind: "key", combo: captured.combo }, action });
    captured.combo = ""; keyInput.value = "";
    persist();
  } });

  bodyEl.append(list, el("div", { class: "ws-row", style: "flex-wrap:wrap" }, keyInput, appSel, actSel, addBtn));

  function persist() { state.map = map; engine.setMap(map); ctx.save(); render(); }
  function render() {
    list.replaceChildren(...map.bindings.map((b, i) => el("div", { class: "ws-param" },
      el("span", { class: "ws-readout", style: "text-align:left", text: b.trigger.combo }),
      el("span", { class: "ws-param-name", style: "overflow:visible", text: actionLabel(b.action) }),
      el("button", { class: "ws-x", text: "✕", title: "Remove binding", "aria-label": `Remove ${b.trigger.combo}`,
        onclick: () => { map = removeBinding(map, i); persist(); } }))));
    if (!map.bindings.length) list.append(el("div", { class: "ws-readout", text: "no bindings — add one below" }));
  }
  render();

  const onKey = (e) => { if (isTyping(e.target)) return; engine.handle({ kind: "key", combo: comboFromKeyEvent(e) }); };
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}

export const MODULES = {
  "control-surface": { title: "Control Surface", make: controlSurfaceModule },
  "pattern": { title: "Pattern (UPI)", make: patternModule },
  "bindings": { title: "Bindings", make: bindingsModule },
  "monitor": { title: "Bus Monitor", make: monitorModule },
};
