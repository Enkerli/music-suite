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

// ── Bridge: the CLI pipe's landing spot in the browser — FULL DUPLEX ─────────
// `msuite accompany --play | msuite bridge` serves SuiteMessages over SSE on
// localhost; this module subscribes and republishes them onto the bus — the
// BroadcastChannel then fans them out to every tab (Vane hears note messages
// and SOUNDS). One line of shell reaches real audio in a real browser.
//
// The other direction: this tab's OWN bus activity (a knob move, a click —
// anything published locally, not something that arrived via BroadcastChannel
// from another tab) gets POSTed back to the bridge's /send, which echoes it to
// the bridge's stdout — so `msuite accompany --play | msuite bridge | msuite
// recv` shows the browser's traffic arriving on the far end of the pipe.
// A message the bridge just handed US is never re-forwarded (recentlyIn),
// which is what keeps this from becoming an echo loop.

/** Republish one SSE data payload onto the bus. Pure over the bus — the
 *  testable half; bus.publish re-validates, so garbage never propagates. */
export function republishBridgeText(bus, text) {
  let msg;
  try { msg = JSON.parse(text); } catch { return false; }
  return bus.publish(msg);
}

/**
 * Should a bus message be forwarded back to the bridge? Only messages that
 * originated in THIS tab (`!meta.remote` — not relayed in via another tab's
 * BroadcastChannel) and that aren't something the bridge itself just handed
 * us (tracked by id in `recentIds`, a Map of id → timestamp). Pure — the
 * testable half of the forwarding decision.
 */
export function shouldForwardToBridge(msg, meta, recentIds) {
  if (!msg || meta?.remote) return false;
  return !(msg.id && recentIds.has(msg.id));
}

function bridgeModule(ctx, bodyEl, state) {
  const urlInput = el("input", { class: "ws-text", type: "text",
    value: state.url ?? "http://localhost:8765", "aria-label": "Bridge URL", spellcheck: "false" });
  const status = el("span", { class: "ws-readout", text: "not connected" });
  const info = el("div", { class: "ws-readout",
    text: "msuite accompany --play | msuite bridge  ·  full duplex: this tab's own actions POST back" });
  let source = null;
  let offForward = null;
  let inCount = 0, outCount = 0;
  const recentlyIn = new Map(); // id → receivedAt: what the bridge just gave us

  function remember(id) {
    if (!id) return;
    const now = Date.now();
    recentlyIn.set(id, now);
    for (const [k, t] of recentlyIn) if (now - t > 5000) recentlyIn.delete(k);
  }
  const paint = (label) => { status.textContent = `${label} · in ${inCount} · out ${outCount}`; };

  function disconnect() {
    source?.close();
    source = null;
    offForward?.();
    offForward = null;
    btn.textContent = "connect";
    status.textContent = "not connected";
  }
  function connect() {
    if (typeof EventSource === "undefined") { status.textContent = "no EventSource in this browser"; return; }
    disconnect();
    state.url = urlInput.value; ctx.save();
    inCount = 0; outCount = 0;
    const base = urlInput.value.replace(/\/$/, "");
    source = new EventSource(`${base}/events`);
    btn.textContent = "disconnect";
    status.textContent = "connecting…";
    source.onopen = () => paint("connected");
    source.onerror = () => { status.textContent = "retrying… (is the bridge running?)"; };
    source.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      remember(msg.id);
      if (republishBridgeText(ctx.bus, e.data)) { inCount++; paint("connected"); }
    };
    offForward = ctx.bus.subscribe((msg, meta) => {
      if (typeof fetch !== "function" || !shouldForwardToBridge(msg, meta, recentlyIn)) return;
      fetch(`${base}/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(msg) })
        .then(() => { outCount++; paint("connected"); })
        .catch(() => {});
    });
  }
  const btn = el("button", { class: "ws-btn", text: "connect",
    onclick: () => (source ? disconnect() : connect()) });

  bodyEl.append(el("div", { class: "ws-row" }, urlInput, btn), status, info);
  return () => disconnect();
}

// ── GloriArp: the accompaniment engine as a STANDALONE surface ───────────────
// The same isomorphic pipeline the CLI runs (@enkerli/accompaniment groove)
// running IN the browser: pick a style, a progression, a rhythm, the
// articulation knobs — press play and the bassline goes out as control-plane
// `note` messages, so the Vane tab SOUNDS it. ⬇ .mid hands the identical
// take to a DAW/plugin (same bytes the CLI writes — one engine everywhere).

import { groove } from "@enkerli/accompaniment";
import { formatLeadsheet } from "@enkerli/theory";
import walkingBass from "../../packages/accompaniment/vectors/source-walking-bass.json";
import funkGhost from "../../packages/accompaniment/vectors/source-funk-ghost.json";
import bossa from "../../packages/accompaniment/vectors/source-bossa.json";
import twoFeel from "../../packages/accompaniment/vectors/source-two-feel.json";
import { makeNote } from "@enkerli/protocol";

export const GROOVE_STYLES = {
  "walking-bass": walkingBass, "funk-ghost": funkGhost, "bossa": bossa, "two-feel": twoFeel,
};

/**
 * Perform a phrase as timed `note` messages on the bus. Injectable clock and
 * timers (the testable half); scheduling is off ONE absolute start per pass,
 * so loops never drift — the same discipline as the CLI's performPhrase.
 *
 * LIVE LOOPS (docs/GLORIARP_NEXT.md, slice B): `start` also accepts a
 * FUNCTION (pass → phrase). It's called fresh at every pass boundary, so
 * knob changes, a new progression off the bus, and per-pass morphing all
 * take effect at the end of the current loop — no stop/regenerate. A pass
 * whose regeneration throws keeps the previous phrase sounding (mid-edit
 * errors never silence a groove — the Serpe rule, applied here).
 */
export function createGroovePlayer({ bus, now = () => Date.now(), schedule = (fn, ms) => setTimeout(fn, ms), clear = clearTimeout }) {
  let timers = [];
  let running = false;
  const stop = () => { running = false; timers.forEach(clear); timers = []; };
  function start(phraseOrFn, { bpm = 100, loop = false, to = "vane", onPass } = {}) {
    stop();
    running = true;
    const build = typeof phraseOrFn === "function" ? phraseOrFn : () => phraseOrFn;
    const t0 = now();
    let lastPhrase = null;
    const schedulePass = (pass, startAt) => {
      let phrase;
      try { phrase = build(pass); } catch (e) { phrase = lastPhrase; if (onPass) onPass(pass, null, e); }
      if (!phrase) { running = false; return; }
      lastPhrase = phrase;
      const msPerTick = 60000 / (bpm * phrase.ticksPerBeat);
      const periodMs = phrase.lengthTicks * msPerTick;
      if (onPass && phrase !== null) onPass(pass, phrase, null);
      for (const e of phrase.events) {
        if (e.note === undefined) continue;
        const at = startAt + e.onset * msPerTick;
        timers.push(schedule(() => {
          if (!running) return;
          bus.publish(makeNote("external", {
            notes: [e.note], velocity: e.velocity,
            durationMs: Math.max(1, Math.round(e.duration * msPerTick)),
          }, { to }));
        }, Math.max(0, at - now())));
      }
      if (loop) timers.push(schedule(() => { if (running) { timers = timers.filter(Boolean); schedulePass(pass + 1, startAt + periodMs); } }, Math.max(0, startAt + periodMs - now())));
    };
    schedulePass(0, t0);
  }
  return { start, stop, isRunning: () => running };
}

function gloriarpModule(ctx, bodyEl, state) {
  const S = (k, d) => state[k] ?? d;
  const player = createGroovePlayer({ bus: ctx.bus });
  const status = el("div", { class: "ws-readout", text: "set a progression, press ▶" });

  const progression = el("input", { class: "ws-text", type: "text", value: S("progression", "Dm7 | G7 | Cmaj7 | A7"), "aria-label": "Progression (bar notation)", spellcheck: "false" });
  const style = el("select", { class: "ws-select", "aria-label": "Style" },
    ...Object.keys(GROOVE_STYLES).map((s) => el("option", { value: s, text: s, ...(s === S("style", "walking-bass") ? { selected: "" } : {}) })));
  const rhythm = el("input", { class: "ws-text", type: "text", value: S("rhythm", ""), placeholder: "rhythm UPI (E(3,8)…)", "aria-label": "Rhythm UPI", spellcheck: "false" });
  const seed = el("input", { class: "ws-text ws-num", type: "number", value: S("seed", 42), "aria-label": "Seed" });
  const bpm = el("input", { class: "ws-text ws-num", type: "number", min: 30, max: 300, value: S("bpm", 100), "aria-label": "BPM" });
  const gate = el("select", { class: "ws-select", "aria-label": "Gate" },
    ...["legato", "tenuto", "staccato", "mixed"].map((g) => el("option", { value: g, text: g, ...(g === S("gate", "legato") ? { selected: "" } : {}) })));
  const knob = (key, label, dflt) => {
    const input = el("input", { class: "ws-text ws-num", type: "number", min: 0, max: 1, step: 0.1, value: S(key, dflt), "aria-label": label });
    return { input, row: el("label", { class: "ws-ctl", text: label + " " }, input) };
  };
  const dynamics = knob("dynamics", "dynamics", 0.6);
  const rests = knob("rests", "rests", 0);
  const anticipation = knob("anticipation", "push", 0);
  const variety = knob("variety", "variety", 0);
  const pocket = knob("pocket", "pocket", 0);
  const morph = knob("morph", "morph", 0);
  const loopBox = el("input", { type: "checkbox", ...(S("loop", true) ? { checked: "" } : {}), "aria-label": "Loop" });

  function build(pass = 0) {
    // Read every control LIVE: this runs at each pass boundary, so a knob
    // turned (or a progression received off the bus) lands on the next loop.
    const opts = {
      progression: progression.value,
      seed: Number(seed.value) || 42,
      bpm: Number(bpm.value) || 100,
      gate: gate.value,
      dynamics: Number(dynamics.input.value) || 0,
      rests: Number(rests.input.value) || 0,
      anticipation: Number(anticipation.input.value) || 0,
      variety: Number(variety.input.value) || 0,
      pocket: Number(pocket.input.value) || 0,
      morph: Number(morph.input.value) || 0,
      pass,
      ...(rhythm.value.trim() && { rhythm: rhythm.value.trim() }),
    };
    Object.assign(state, opts, { style: style.value, loop: loopBox.checked });
    ctx.save();
    return groove(GROOVE_STYLES[style.value], opts);
  }
  function play() {
    try {
      build(0); // validate now so an immediate error is immediate
      player.start((pass) => build(pass).phrase, {
        bpm: Number(bpm.value) || 100, loop: loopBox.checked,
        onPass: (pass, phrase, err) => {
          if (err) { status.textContent = `✗ pass ${pass + 1}: ${err.message || err} — keeping last good take`; return; }
          status.textContent = `▶ pass ${pass + 1} · ${phrase.events.length} notes · ${progression.value}`
            + (Number(morph.input.value) > 0 ? " · morphing" : "") + (loopBox.checked ? " · looping (tweaks land next pass)" : "");
        },
      });
    } catch (e) { status.textContent = "✗ " + (e && e.message || e); }
  }
  function stop() { player.stop(); status.textContent = "stopped"; }

  // ProgGenie (or anything) → this module: a `progression` message on the bus
  // carries the canonical Progression; adopt it as the bar-notation text. If
  // we're looping, it simply takes effect at the next pass — live handoff.
  const offProg = ctx.bus.subscribe((msg) => {
    if (msg.type !== "progression" || !msg.body || !msg.body.prog) return;
    try {
      const text = formatLeadsheet(msg.body.prog);
      if (!text.trim()) return;
      progression.value = text;
      state.progression = text; ctx.save();
      status.textContent = player.isRunning()
        ? `♪ progression from ${msg.from} — lands at the next pass`
        : `♪ progression from ${msg.from} — press ▶`;
    } catch { /* not a formattable progression — leave the field alone */ }
  });
  function download() {
    try {
      const r = build();
      const blob = new Blob([r.smf], { type: "audio/midi" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `gloriarp-${style.value}-s${seed.value}.mid`;
      a.click();
      URL.revokeObjectURL(a.href);
      status.textContent = `⬇ ${a.download} — drop it in a DAW / plugin`;
    } catch (e) { status.textContent = "✗ " + (e && e.message || e); }
  }

  bodyEl.append(
    el("div", { class: "ws-row" }, progression),
    el("div", { class: "ws-row", style: "flex-wrap:wrap" }, style, rhythm),
    el("div", { class: "ws-row", style: "flex-wrap:wrap" },
      el("label", { class: "ws-ctl", text: "seed " }, seed),
      el("label", { class: "ws-ctl", text: "bpm " }, bpm),
      el("label", { class: "ws-ctl", text: "gate " }, gate),
      dynamics.row, rests.row, anticipation.row),
    el("div", { class: "ws-row", style: "flex-wrap:wrap" },
      variety.row, pocket.row, morph.row),
    el("div", { class: "ws-row" },
      el("button", { class: "ws-btn", text: "▶ play", onclick: play }),
      el("button", { class: "ws-btn", text: "■ stop", onclick: stop }),
      el("label", { class: "ws-ctl" }, loopBox, " loop"),
      el("button", { class: "ws-btn", text: "⬇ .mid", title: "Download the identical take the CLI would write — for a DAW or plugin", onclick: download })),
    status);
  return () => { player.stop(); offProg && offProg(); };
}

export const MODULES = {
  "control-surface": { title: "Control Surface", make: controlSurfaceModule },
  "pattern": { title: "Pattern (UPI)", make: patternModule },
  "bindings": { title: "Bindings", make: bindingsModule },
  "monitor": { title: "Bus Monitor", make: monitorModule },
  "bridge": { title: "Bridge (CLI)", make: bridgeModule },
  "gloriarp": { title: "GloriArp", make: gloriarpModule },
};
