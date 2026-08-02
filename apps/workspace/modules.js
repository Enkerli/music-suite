/**
 * Workspace module factories — the DOM-building logic, kept free of CSS/asset
 * imports so it runs under happy-dom in tests (main.js adds the shell, styles,
 * and drag). Each factory fills a body element from a bus + module state and
 * returns an optional cleanup fn. These are the plane's citizens: a
 * manifest-driven control surface, a @enkerli/upi pattern module, a bus
 * monitor — all talking SuiteMessages over the shared bus.
 */
import { sliderToNative, nativeToSlider, paramSet, commandInvoke, formatValue } from "./model.js";
import { makeMessage, makeNote } from "@enkerli/protocol";
import { VoiceSplitter, MonoMerge } from "@enkerli/voice-routing";
import { APPS } from "@enkerli/library";
import { parseUPI, parsePolyUPI, analyse, analyzeSyncopation, rotate, invert, complement, barlowTransform, mutatePattern } from "@enkerli/upi";
import { createCircleView, createPolyCircleView } from "@enkerli/ui/rhythm-views";
import { createBindingEngine, addBinding, removeBinding } from "@enkerli/control";
import { parseLeadsheet, detectChord, rootName, realizeLeadsheet } from "@enkerli/theory";
import { generateLabels, realizeLabel } from "@enkerli/proggen";
import transitionTables from "@enkerli/proggen/data/transitions.json";
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
  const lanes = el("div", { class: "ws-lanes", "aria-hidden": "true" });
  const ring = el("div", { class: "ws-ring" });
  const info = el("div", { class: "ws-readout", role: "status", "aria-live": "polite" });

  // Steps AND circle, both wanted (DESIGN_BRIEF §3.4). The renderers are
  // Serpe's, now shared from @enkerli/ui/rhythm-views rather than
  // reimplemented here — one rhythm language across the suite, so a duration
  // arc means the same thing wherever it is drawn.
  state.view = state.view ?? "both";
  let view = null, viewIsPoly = null;
  // What we last put on the bus. The bus echoes our own publish back to us,
  // and the incoming path can only carry ONE mask — so without this the echo
  // immediately overwrote a freshly drawn poly with a single flattened lane.
  // It was invisible before this module drew lanes at all.
  let lastSent = null;

  function showRing(poly) {
    const wantPoly = poly.lanes.length > 1;
    if (!view || viewIsPoly !== wantPoly) {
      view = (wantPoly ? createPolyCircleView : createCircleView)(ring, {});
      viewIsPoly = wantPoly;
    }
    if (wantPoly) {
      view.update({ lanes: poly.lanes, lanePh: poly.lanes.map(() => -1), muted: poly.lanes.map(() => false) });
    } else {
      const l = poly.lanes[0];
      view.update({ steps: l.steps, accents: l.accents ?? [], playhead: -1, showCog: true });
    }
  }

  function drawLanes(poly) {
    lanes.replaceChildren(...poly.lanes.map((l) => {
      const row = el("div", { class: "ws-lane" });
      row.append(...l.steps.map((s, i) => el("span", {
        class: `ws-step${s ? " on" : ""}${l.accents && l.accents[i] ? " acc" : ""}`,
      })));
      return row;
    }));
  }

  function send() {
    // parsePolyUPI, not parseUPI: the mono parser rejects '|' outright and
    // knows nothing of lanes or progression, so this module could take none of
    // the notation the rest of the suite plays. Layering rule — anything
    // reading USER INPUT uses parsePolyUPI; only library internals use the
    // single-body parser (SERPE_DAW_FINDINGS F7).
    const p = parsePolyUPI(input.value, { n: 16 });
    if (!p.ok) { info.textContent = p.error ?? "unparsed"; return; }
    state.upi = input.value; ctx.save();

    drawLanes(p);
    showRing(p);

    const parts = p.lanes.map((l, i) => {
      const a = analyse(l.steps);
      const extra = [];
      if (l.sceneCount > 1) extra.push(`scene ${(l.sceneIndex ?? 0) + 1}/${l.sceneCount}`);
      if (l.progressive) extra.push(l.progressive.kind);
      if (l.accentPattern?.length) extra.push(`{${l.accentPattern.join("")}}`);
      return `${p.lanes.length > 1 ? `lane ${i + 1}: ` : ""}${a.n} steps · ${a.k} onsets`
        + (extra.length ? ` · ${extra.join(" · ")}` : "");
    });
    info.textContent = parts.join("   |   ")
      + (p.lanes.length > 1 ? `   ·   realign every ${p.lcm}` : "");

    // The bus contract is one mask, so poly publishes LANE 1 and says so in
    // the readout rather than silently flattening lanes into one number.
    const a0 = analyse(p.lanes[0].steps);
    lastSent = `${a0.n}:${a0.decimal}`;
    ctx.bus.publish(makeMessage(FROM, "pattern",
      { steps: a0.n, mask: a0.decimal, name: p.lanes[0].source ?? input.value }, { to: "*" }));
  }

  input.addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });
  bodyEl.append(
    el("div", { class: "ws-row" }, input, el("button", { class: "ws-btn", text: "▶ send", onclick: send })),
    ring, lanes, info);

  const off = ctx.bus.subscribe((m) => {
    if (m.type !== "pattern") return;
    // Our own echo — the local render is strictly richer (lanes, accents,
    // scenes), so redrawing it from one mask would be a downgrade.
    if (`${m.body.steps}:${m.body.mask}` === lastSent) return;
    const steps = Array.from({ length: m.body.steps }, (_, i) => (m.body.mask >> i) & 1); // leftmost = LSB
    const asPoly = { ok: true, lanes: [{ steps, accents: steps.map(() => 0) }], lcm: m.body.steps };
    drawLanes(asPoly); showRing(asPoly);
    info.textContent = `via bus ← ${m.from}: ${m.body.name ?? ""} (mask ${m.body.mask})`;
  });
  send();
  return off;
}

// ── PCS Pads: a compact chord/scale pad bank, Workspace-native, that
// broadcasts `scale` bus messages — the SAME contract PickPCS already sends
// (apps/PickPCS/src/control.js) and PitchFold already listens for
// (apps/pitchfold/control.js). Zero changes needed on either side: this
// interoperates today. Follow-up to docs/PITCHFOLD_AUDIT.md /
// KNOWLEDGE_TRANSFER.md item 8 ("might fit well in… the Workspace").
//
// Rather than reimplementing PitchFold's own pad-mask editor (a real UI
// investment — ChordPadBank + a wheel/lattice), pads here are populated by
// "learn": grab the last `scale` message heard on the bus (from PickPCS,
// PitchFold, another Workspace instance…) and store it. The bus IS the
// scale-editing surface already; this just gives it a memory.
//
// Progression-to-pads (2026-07-20): a `progression` message (ProgGenie)
// loads its chords straight onto the pad bank, pad 1 = first chord, in
// order — a progression already IS a sequence of chords, so this is a
// direct sequence-to-sequence load, not "which chord is playing right
// now" (no transport/playhead tracking involved, deliberately simpler).
const PCS_PAD_DEFAULTS = [
  { mask: 0x0AB5, root: 0, label: "Ionian" }, { mask: 0x06AD, root: 0, label: "Dorian" },
  { mask: 0x05AB, root: 0, label: "Phrygian" }, { mask: 0x0AD5, root: 0, label: "Lydian" },
  { mask: 0x06B5, root: 0, label: "Mixolydian" }, { mask: 0x05AD, root: 0, label: "Aeolian" },
  { mask: 0x056B, root: 0, label: "Locrian" }, { mask: 0x0091, root: 0, label: "Maj Triad" },
];
const PC_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const countBits = (m) => { let n = 0; for (let i = 0; i < 12; i++) n += (m >> i) & 1; return n; };

/** Flatten a Progression (bars of chords) into pad-shaped entries, in
 *  order — the progression-to-pads story: a progression IS a sequence of
 *  chords, so populating a sequence of pads from it is direct, not a
 *  "which chord is playing right now" problem. `realizeChord`'s absolute
 *  `pcs` becomes a root-relative mask (the suite's own convention). */
function chordsFromProgression(prog) {
  const bars = realizeLeadsheet(prog);
  const out = [];
  for (const bar of bars) {
    for (const chord of bar) {
      const mask = chord.pcs.reduce((m, pc) => m | (1 << (((pc - chord.rootPc) % 12 + 12) % 12)), 0);
      out.push({ mask, root: chord.rootPc, label: chord.symbol });
    }
  }
  return out;
}

export function pcsPadsModule(ctx, bodyEl, state) {
  if (!Array.isArray(state.pads) || state.pads.length !== PCS_PAD_DEFAULTS.length) {
    state.pads = PCS_PAD_DEFAULTS.map((p) => ({ ...p }));
    ctx.save();
  }
  if (typeof state.selected !== "number") state.selected = -1;
  let lastHeard = null; // { mask, root, name } — most recent `scale` seen on the bus

  const grid = el("div", { class: "ws-pads" });
  const status = el("div", { class: "ws-readout", text: "tap a pad to broadcast · ↓ learns the last scale heard · a progression on the bus loads its chords" });

  function broadcast(pad) {
    ctx.bus.publish(makeMessage(FROM, "scale", { mask: pad.mask, root: pad.root, name: pad.label }, { to: "*" }));
  }

  function render() {
    grid.replaceChildren(...state.pads.map((pad, i) => el("div", { class: "ws-pad" + (state.selected === i ? " active" : "") },
      el("button", { class: "ws-pad-main", title: "Broadcast this scale",
        onclick: () => {
          state.selected = i; ctx.save();
          broadcast(pad);
          status.textContent = `sent ${pad.label} (root ${PC_NAMES[((pad.root % 12) + 12) % 12]})`;
          render();
        } },
        el("div", { class: "ws-pad-name", text: pad.label }),
        el("div", { class: "ws-pad-sub", text: `${PC_NAMES[((pad.root % 12) + 12) % 12]} · ${countBits(pad.mask)} notes` })),
      el("button", { class: "ws-pad-learn", text: "↓", title: "Learn: store the last scale heard on the bus into this pad",
        onclick: () => {
          if (!lastHeard) { status.textContent = "nothing heard on the bus yet"; return; }
          state.pads[i] = { mask: lastHeard.mask, root: lastHeard.root ?? 0, label: lastHeard.name || "Custom" };
          ctx.save();
          status.textContent = `pad ${i + 1} learned ${state.pads[i].label}`;
          render();
        } }))));
  }

  bodyEl.append(grid, status);
  render();

  const off = ctx.bus.subscribe((m) => {
    if (m.type === "scale" && m.body && typeof m.body.mask === "number") {
      lastHeard = m.body;
      status.textContent = `heard ${m.body.name || "a scale"} from ${m.from} — tap ↓ on a pad to learn it`;
      return;
    }
    // Progression-to-pads: a progression IS a sequence of chords, so a
    // `progression` message (ProgGenie) populates the pad bank directly —
    // pad 1 = first chord, pad 2 = second, in order. Not "which chord is
    // sounding right now" (that would need transport/playhead tracking);
    // this is a one-shot "load this progression's chords onto pads" action.
    if (m.type === "progression" && m.body?.prog) {
      try {
        const chords = chordsFromProgression(m.body.prog);
        if (!chords.length) { status.textContent = `${m.from}'s progression has no chords to load`; return; }
        const n = Math.min(chords.length, state.pads.length);
        for (let i = 0; i < n; i++) state.pads[i] = chords[i];
        state.selected = -1;
        ctx.save();
        const overflow = chords.length - n;
        status.textContent = `loaded ${n} pad${n === 1 ? "" : "s"} from ${m.from}'s progression`
          + (overflow > 0 ? ` (${overflow} more chord${overflow === 1 ? "" : "s"} didn't fit)` : "");
        render();
      } catch (err) {
        status.textContent = `couldn't read ${m.from}'s progression: ${err instanceof Error ? err.message : err}`;
      }
    }
  });
  return () => off();
}

// ── Voice Split: round-robin channel distribution over the bus, using
// @enkerli/voice-routing — the shared VoiceSplitter extracted from
// PitchFold's VoiceProcessor (docs/PITCHFOLD_AUDIT.md singled this mode out
// as the one voice-routing feature with clean, genuinely reusable logic).
// Listens for `note` messages from a chosen source (or any app), and
// republishes each on the next channel in the rotation, addressed to a
// chosen destination — e.g. spread a melody across 4 channels feeding a
// multi-timbral synth. Splits per BUS MESSAGE (a message can already carry
// a whole chord in `notes[]`); it doesn't fragment one message's chord
// across channels, which would need a different, chord-aware design.
export function voiceSplitModule(ctx, bodyEl, state) {
  const splitter = new VoiceSplitter();
  // The full suite app vocabulary (@enkerli/library), not just the 2 apps
  // with manifests loaded here — this is a bus router, it needs to name any
  // app as a source or destination, not only the ones with a Control
  // Surface. "external" excluded: that's the Workspace's own outbound
  // identity, not a musical source/destination.
  const appIds = APPS.filter((a) => a !== "external");

  const fromSel = el("select", { class: "ws-select", "aria-label": "Split notes from" },
    el("option", { value: "*", text: "any app" }),
    ...appIds.map((a) => el("option", { value: a, text: a })));
  const toSel = el("select", { class: "ws-select", "aria-label": "Send split notes to" },
    ...appIds.map((a) => el("option", { value: a, text: a })));
  const baseCh = el("input", { class: "ws-text ws-num", type: "number", min: 1, max: 16, "aria-label": "Base channel" });
  const spanInput = el("input", { class: "ws-text ws-num", type: "number", min: 1, max: 16, "aria-label": "Span" });
  const status = el("div", { class: "ws-readout", text: "waiting for notes…" });

  fromSel.value = state.listenFrom ?? "*";
  toSel.value = state.sendTo ?? appIds[0];
  baseCh.value = state.baseChannel ?? 1;
  // NOT `state.span` — the module-slot object already reserves that key for
  // panel layout size ("s"/"m"/"l", set by main.js's addModule). Collided
  // with it here once (the string "s" landed in a type=number input, which
  // silently renders blank) — channelSpan avoids it for good.
  spanInput.value = state.channelSpan ?? 4;

  function persist() {
    Object.assign(state, {
      listenFrom: fromSel.value, sendTo: toSel.value,
      baseChannel: Number(baseCh.value) || 1, channelSpan: Number(spanInput.value) || 1,
    });
    ctx.save();
  }
  for (const input of [fromSel, toSel, baseCh, spanInput]) input.addEventListener("change", persist);

  bodyEl.append(
    el("div", { class: "ws-row", style: "flex-wrap:wrap" },
      el("label", { class: "ws-ctl", text: "from " }, fromSel),
      el("label", { class: "ws-ctl", text: "to " }, toSel)),
    el("div", { class: "ws-row" },
      el("label", { class: "ws-ctl", text: "base ch " }, baseCh),
      el("label", { class: "ws-ctl", text: "span " }, spanInput),
      el("button", { class: "ws-btn ghost", text: "⟲ reset", title: "Restart the rotation",
        onclick: () => { splitter.reset(); status.textContent = "rotation reset"; } })),
    status);

  const off = ctx.bus.subscribe((m) => {
    if (m.type !== "note" || !m.body || !Array.isArray(m.body.notes)) return;
    if (m.from === FROM) return; // never re-process our own output — loop guard
    const want = fromSel.value;
    if (want !== "*" && m.from !== want) return;
    const channel = splitter.next(Number(baseCh.value) || 1, Number(spanInput.value) || 1);
    ctx.bus.publish(makeNote(FROM, { ...m.body, channel }, { to: toSel.value }));
    status.textContent = `${m.from} → ch ${channel} → ${toSel.value} (${m.body.notes.join(",")})`;
  });
  return () => off();
}

const NS_SVG = "http://www.w3.org/2000/svg";
const svgEl = (tag, attrs = {}) => {
  const e = document.createElementNS(NS_SVG, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
};

const MONO_PRIORITIES = [
  ["last", "Last"], ["lowest", "Lowest"], ["highest", "Highest"], ["first", "First"],
];

// ── Mono Merge: hold to force monophonic — a live performance gesture, not
// a passthrough setting (docs/DESIGN_AGENT_ANSWERS.md §4). PitchFold's own
// Mono Merge mode was theater: a real monoSelect param neither C++/JS
// engine's processMono() ever read (docs/PITCHFOLD_AUDIT.md's headline
// finding). The 2026-07-20 "Reprioritized" note proposed a Workspace-level
// note-router instead of rebuilding it twice inside one plugin's two
// engines — this is that router. The actual priority-selection rule lives
// in @enkerli/voice-routing's MonoMerge class (engine, no bus/DOM
// knowledge); this module owns bus wiring, the hold gesture, and
// per-note attribute memory (velocity/channel/articulation), since the
// engine only ever sees bare note numbers.
//
// While DISENGAGED, notes pass through unchanged (from → to), same as
// Voice Split always transforms — the destination should keep hearing the
// source continuously, with mono-merge applied only while actually held.
// While ENGAGED, a MonoDecision's attack/release are turned into explicit
// gate:"on"/"off" note messages — a steal publishes BOTH in one incoming
// event (the new note attacks the instant the old one releases).
//
// Scope: operates on the SUSTAINED gate on/off note model. A one-shot
// (durationMs) note passes through unchanged regardless of engagement —
// it manages its own lifetime outside the held-notes model this is built
// around, and there's no principled way to time a matching release for it.
//
// Engaging starts a FRESH monophonic session: notes already physically
// held before engagement aren't known (this module never touches the
// engine while disengaged, so it has no shadow model of "what's actually
// down" to inherit) — documented, not silently assumed.
export function monoMergeModule(ctx, bodyEl, state) {
  const merge = new MonoMerge(MONO_PRIORITIES.some(([v]) => v === state.priority) ? state.priority : "last");
  const appIds = APPS.filter((a) => a !== FROM);
  const noteAttrs = new Map(); // note number -> last-seen { velocity, channel, articulation }
  let engaged = false; // live gesture state — deliberately NOT persisted (§4: momentary, not a setting)

  const fromSel = el("select", { class: "ws-select", "aria-label": "Merge notes from" },
    el("option", { value: "*", text: "any app" }),
    ...appIds.map((a) => el("option", { value: a, text: a })));
  const toSel = el("select", { class: "ws-select", "aria-label": "Send merged notes to" },
    ...appIds.map((a) => el("option", { value: a, text: a })));
  fromSel.value = state.listenFrom ?? "*";
  toSel.value = state.sendTo ?? appIds[0];

  const status = el("div", { class: "ws-readout", text: "hold the pad to force monophonic" });

  function publishDecision(decision) {
    if (decision.release != null) {
      const attrs = noteAttrs.get(decision.release) ?? {};
      ctx.bus.publish(makeNote(FROM,
        { notes: [decision.release], gate: "off", ...(attrs.channel != null ? { channel: attrs.channel } : {}) },
        { to: toSel.value }));
    }
    if (decision.attack != null) {
      const attrs = noteAttrs.get(decision.attack) ?? {};
      ctx.bus.publish(makeNote(FROM, {
        notes: [decision.attack], gate: "on",
        ...(attrs.velocity != null ? { velocity: attrs.velocity } : {}),
        ...(attrs.channel != null ? { channel: attrs.channel } : {}),
        ...(attrs.articulation ? { articulation: attrs.articulation } : {}),
      }, { to: toSel.value }));
    }
    if (decision.attack != null || decision.release != null) {
      status.textContent = `mono · sounding ${decision.attack ?? "—"} (held: ${merge.heldNotes.join(",") || "none"})`;
    }
  }

  const priorityBtns = MONO_PRIORITIES.map(([v, label]) =>
    el("button", { class: "ws-btn ghost", "aria-pressed": String(v === merge.mode), text: label }));
  priorityBtns.forEach((btn, i) => {
    btn.addEventListener("click", () => {
      const mode = MONO_PRIORITIES[i][0];
      publishDecision(merge.setMode(mode));
      state.priority = mode;
      ctx.save();
      priorityBtns.forEach((b, j) => b.setAttribute("aria-pressed", String(j === i)));
    });
  });

  function persist() {
    Object.assign(state, { listenFrom: fromSel.value, sendTo: toSel.value });
    ctx.save();
  }
  for (const input of [fromSel, toSel]) input.addEventListener("change", persist);

  // ── The hold pad (docs/DESIGN_AGENT_ANSWERS.md §4): momentary, not a
  // toggle — engaged only while actively held (pointer down / key down),
  // never left "stuck" (pointerleave/cancel/blur all release it). ──
  const ring = svgEl("svg", { viewBox: "0 0 40 40", class: "ws-hold-pad-ring", "aria-hidden": "true" });
  ring.append(svgEl("circle", { cx: 20, cy: 20, r: 16, class: "ws-hold-pad-ring-stroke" }));
  const pad = el("button", { type: "button", class: "ws-hold-pad", "aria-pressed": "false",
    "aria-label": "Hold to force monophonic (momentary)" }, "HOLD → MONO");
  pad.append(ring);

  function engage() {
    if (engaged) return;
    engaged = true;
    pad.classList.add("held");
    pad.setAttribute("aria-pressed", "true");
    status.textContent = "engaged — monophonic";
  }
  function disengage() {
    if (!engaged) return;
    engaged = false;
    pad.classList.remove("held");
    pad.setAttribute("aria-pressed", "false");
    publishDecision({ attack: null, release: merge.releaseAll() });
    status.textContent = "hold the pad to force monophonic";
  }
  pad.addEventListener("pointerdown", (e) => { e.preventDefault(); try { pad.setPointerCapture(e.pointerId); } catch { /* no-op */ } engage(); });
  pad.addEventListener("pointerup", disengage);
  pad.addEventListener("pointercancel", disengage);
  pad.addEventListener("pointerleave", () => { if (engaged) disengage(); }); // never gets "stuck" if the pointer strays off
  pad.addEventListener("keydown", (e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); engage(); } });
  pad.addEventListener("keyup", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); disengage(); } });
  pad.addEventListener("blur", () => { if (engaged) disengage(); });

  bodyEl.append(
    el("div", { class: "ws-row", style: "flex-wrap:wrap" },
      el("label", { class: "ws-ctl", text: "from " }, fromSel),
      el("label", { class: "ws-ctl", text: "to " }, toSel)),
    el("div", { class: "ws-row", style: "flex-wrap:wrap" }, ...priorityBtns),
    pad,
    status);

  const off = ctx.bus.subscribe((m) => {
    if (m.type !== "note" || !m.body || !Array.isArray(m.body.notes)) return;
    if (m.from === FROM) return; // never re-process our own output — loop guard
    const want = fromSel.value;
    if (want !== "*" && m.from !== want) return;

    if (m.body.durationMs != null || !engaged) {
      // one-shot notes, or simply disengaged: pass through unchanged.
      ctx.bus.publish(makeNote(FROM, { ...m.body }, { to: toSel.value }));
      return;
    }

    const isOff = m.body.gate === "off";
    for (const n of m.body.notes) {
      if (!isOff) noteAttrs.set(n, { velocity: m.body.velocity, channel: m.body.channel, articulation: m.body.articulation });
      publishDecision(isOff ? merge.noteOff(n) : merge.noteOn(n));
    }
  });
  return () => { off(); if (engaged) disengage(); };
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

  // Plugin mode: host MIDI in arrives as `enkerli-midi` page events
  // (main.js relays the bridge's midiIn) — feed the SAME engine that key
  // triggers use. The control-map layer finally gets real hardware MIDI.
  const onMidi = (ev) => {
    const d = ev.detail || {};
    if (d.kind === "cc") engine.handle({ kind: "midi-cc", cc: d.cc | 0, channel: d.channel | 0 || 1, value: d.value | 0 });
    else if (d.kind === "note" && d.velocity > 0) engine.handle({ kind: "midi-note", note: d.note | 0, channel: d.channel | 0 || 1, velocity: d.velocity | 0 });
  };
  if (typeof window !== "undefined") window.addEventListener("enkerli-midi", onMidi);

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
  return () => {
    window.removeEventListener("keydown", onKey);
    if (typeof window !== "undefined") window.removeEventListener("enkerli-midi", onMidi);
  };
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
  // Plugin mode: an SSE fetch from the juce:// scheme to http://localhost is
  // exactly the kind of cross-scheme WebView behavior TESTING.md says never
  // to assume — and the plugin already IS a bridge (bus notes → host MIDI).
  if (juceAvailable()) {
    bodyEl.append(el("div", { class: "ws-readout",
      text: "browser-only — in the plugin, the host is the bridge: bus notes go out as MIDI, host MIDI feeds the bindings" }));
    return () => {};
  }
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

import { groove, looksLikeModel, parseModel, parsePhrase, samplePhrase } from "@enkerli/accompaniment";
import { formatLeadsheet } from "@enkerli/theory";
import { juceAvailable, saveFileNative, openFileNative, juceOn, b64ToBytes } from "./juce-bridge.js";
import walkingBass from "../../packages/accompaniment/vectors/source-walking-bass.json";
import funkGhost from "../../packages/accompaniment/vectors/source-funk-ghost.json";
import bossa from "../../packages/accompaniment/vectors/source-bossa.json";
import twoFeel from "../../packages/accompaniment/vectors/source-two-feel.json";

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
    let lastTake = null;
    const schedulePass = (pass, startAt) => {
      let take;
      try {
        const built = build(pass);
        // A build may return a bare phrase or a full groove result — with
        // inflections, each note ships its own articulation envelope.
        take = built && built.phrase ? built : { phrase: built };
      } catch (e) { take = lastTake; if (onPass) onPass(pass, null, e); }
      if (!take || !take.phrase) { running = false; return; }
      lastTake = take;
      const phrase = take.phrase;
      const infByIndex = new Map((take.inflections || []).map((n) => [n.index, n]));
      const msPerTick = 60000 / (bpm * phrase.ticksPerBeat);
      const periodMs = phrase.lengthTicks * msPerTick;
      if (onPass) onPass(pass, phrase, null);
      phrase.events.forEach((e, i) => {
        if (e.note === undefined) return;
        const at = startAt + e.onset * msPerTick;
        const inf = infByIndex.get(i);
        timers.push(schedule(() => {
          if (!running) return;
          bus.publish(makeNote("external", {
            notes: [e.note], velocity: e.velocity,
            durationMs: Math.max(1, Math.round(e.duration * msPerTick)),
            ...(inf && { articulation: inf.articulation, env: inf.envelope, attack: inf.attack, glideMs: inf.glideMs ?? 0 }),
          }, { to }));
        }, Math.max(0, at - now())));
      });
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

  // Imported sources (phrase.json OR model.json — msuite style learn output,
  // a MIDIcurator export, anything honoring the contracts): session-local,
  // added to the same style list the bundled CC0 vectors live in. A MODEL
  // samples a fresh take per pass (parity with the CLI's `accompany
  // --source` dispatch); a PHRASE is used exactly like a bundled style.
  const imported = new Map(); // name → { kind: "phrase"|"model", value }

  const progression = el("input", { class: "ws-text", type: "text", value: S("progression", "Dm7 | G7 | Cmaj7 | A7"), "aria-label": "Progression (bar notation)", spellcheck: "false" });
  const style = el("select", { class: "ws-select", "aria-label": "Style" },
    ...Object.keys(GROOVE_STYLES).map((s) => el("option", { value: s, text: s, ...(s === S("style", "walking-bass") ? { selected: "" } : {}) })));
  const addStyleOption = (name, select = true) => {
    style.append(el("option", { value: name, text: name, ...(select ? { selected: "" } : {}) }));
    if (select) style.value = name;
  };
  function importJsonText(text, filename) {
    const name = filename.replace(/\.json$/i, "");
    try {
      let parsed;
      try { parsed = JSON.parse(text); } catch { throw new Error("not JSON"); }
      if (looksLikeModel(parsed)) {
        const model = parseModel(text);
        imported.set(name, { kind: "model", value: model });
        status.textContent = `imported "${name}" — a style MODEL (${model.takes} takes against ${model.frame.symbol}); every pass samples a fresh take`;
      } else {
        const phrase = parsePhrase(text);
        imported.set(name, { kind: "phrase", value: phrase });
        status.textContent = `imported "${name}" — a source phrase (${phrase.events.length} events, ${phrase.role})`;
      }
      const exists = [...style.options].some((o) => o.value === name);
      if (!exists) addStyleOption(name); else style.value = name;
    } catch (err) {
      status.textContent = `✗ import "${filename}": ${(err && err.message) || err}`;
    }
  }
  // Plugin: <input type="file"> doesn't work under WKWebView (enkerli-juce
  // FileImport.h) — the native picker answers "enkerliOpenFile" with a
  // fileOpened event ({name, b64}). Only .json is ours (another module could
  // own .mid on the same channel later). Browser: the input element, as
  // always.
  const offFileOpened = juceOn("fileOpened", (data) => {
    const name = data && data.name, b64 = data && data.b64;
    if (!name || !b64 || !/\.json$/i.test(name)) return;
    importJsonText(new TextDecoder().decode(b64ToBytes(b64)), name);
  });
  const fileInput = el("input", { type: "file", accept: ".json,application/json", style: "display:none", onchange: (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => importJsonText(String(reader.result), file.name);
    reader.readAsText(file);
    fileInput.value = ""; // allow re-importing the same filename later
  } });
  const importBtn = el("button", { class: "ws-btn ghost", text: "⬆ import .json", title: "Import a phrase.json or style-model.json (msuite style learn, MIDIcurator export…)",
    onclick: () => { if (!openFileNative("*.json")) fileInput.click(); } });
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
  const inflect = knob("inflect", "inflect", 0);
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
      inflect: Number(inflect.input.value) || 0,
      pass,
      ...(rhythm.value.trim() && { rhythm: rhythm.value.trim() }),
    };
    Object.assign(state, opts, { style: style.value, loop: loopBox.checked });
    ctx.save();
    const im = imported.get(style.value);
    const source = !im ? GROOVE_STYLES[style.value]
      : im.kind === "model" ? samplePhrase(im.value, { seed: opts.seed, pass })
      : im.value;
    if (!source) throw new Error(`unknown style "${style.value}"`);
    return groove(source, opts);
  }
  function play() {
    try {
      build(0); // validate now so an immediate error is immediate
      player.start((pass) => build(pass), {
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
      const safeStyle = style.value.replace(/[^A-Za-z0-9_-]+/g, "-");
      const name = `gloriarp-${safeStyle}-s${seed.value}.mid`;
      // Plugin: a blob: anchor kills the page under the juce:// scheme
      // (TESTING.md) — the bytes go over the bridge to a native save
      // (FileChooser on desktop, share sheet on iPadOS) instead.
      if (saveFileNative(name, r.smf)) {
        status.textContent = `⬇ ${name} — native save (share sheet on iPad)`;
        return;
      }
      const blob = new Blob([r.smf], { type: "audio/midi" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      URL.revokeObjectURL(a.href);
      status.textContent = `⬇ ${a.download} — drop it in a DAW / plugin`;
    } catch (e) { status.textContent = "✗ " + (e && e.message || e); }
  }

  bodyEl.append(
    el("div", { class: "ws-row" }, progression),
    el("div", { class: "ws-row", style: "flex-wrap:wrap" }, style, rhythm, importBtn, fileInput),
    el("div", { class: "ws-row", style: "flex-wrap:wrap" },
      el("label", { class: "ws-ctl", text: "seed " }, seed),
      el("label", { class: "ws-ctl", text: "bpm " }, bpm),
      el("label", { class: "ws-ctl", text: "gate " }, gate),
      dynamics.row, rests.row, anticipation.row),
    el("div", { class: "ws-row", style: "flex-wrap:wrap" },
      variety.row, pocket.row, morph.row, inflect.row),
    el("div", { class: "ws-row" },
      el("button", { class: "ws-btn", text: "▶ play", onclick: play }),
      el("button", { class: "ws-btn", text: "■ stop", onclick: stop }),
      el("label", { class: "ws-ctl" }, loopBox, " loop"),
      el("button", { class: "ws-btn", text: "⬇ .mid", title: "Download the identical take the CLI would write — for a DAW or plugin", onclick: download })),
    status);
  return () => { player.stop(); offProg && offProg(); offFileOpened(); };
}

// ── Progression: ProgGenie-lite — generate or type changes, put them on the
// bus. The GloriArp module (and anything else) adopts `progression` messages,
// so the compose→accompany loop closes INSIDE the workspace.
export function progressionModule(ctx, bodyEl, state) {
  const S = (k, d) => state[k] ?? d;
  const text = el("input", { class: "ws-text", type: "text", value: S("text", ""),
    placeholder: "Dm7 | G7 | Cmaj7  (or generate →)", "aria-label": "Progression (bar notation)", spellcheck: "false" });
  const tonic = el("select", { class: "ws-select", "aria-label": "Tonic" },
    ...["C", "D♭", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"].map((t) =>
      el("option", { value: t, text: t, ...(t === S("tonic", "C") ? { selected: "" } : {}) })));
  const mode = el("select", { class: "ws-select", "aria-label": "Mode" },
    ...["major", "minor"].map((m) => el("option", { value: m, text: m, ...(m === S("mode", "major") ? { selected: "" } : {}) })));
  const len = el("input", { class: "ws-text ws-num", type: "number", min: 2, max: 32, value: S("len", 4), "aria-label": "Length (bars)" });
  const seed = el("input", { class: "ws-text ws-num", type: "number", value: S("seed", 1), "aria-label": "Seed" });
  const status = el("div", { class: "ws-readout", text: "type changes, or generate from the corpus statistics" });

  function persist() {
    Object.assign(state, { text: text.value, tonic: tonic.value, mode: mode.value,
      len: Number(len.value) || 4, seed: Number(seed.value) || 1 });
    ctx.save();
  }
  function generate() {
    try {
      const labels = generateLabels(transitionTables[mode.value], mode.value,
        { length: Number(len.value) || 4, seed: Number(seed.value) || 1 });
      const key = { tonic: tonic.value, mode: mode.value };
      text.value = labels.map((l) => realizeLabel(l, key)?.symbol ?? l).join(" | ");
      persist();
      status.textContent = `generated (seed ${seed.value}) — same seed, same changes`;
    } catch (e) { status.textContent = "✗ " + (e && e.message || e); }
  }
  function publish() {
    try {
      const prog = parseLeadsheet(text.value, { tonic: tonic.value, mode: mode.value });
      if (!prog.sections.some((s) => s.bars.length)) { status.textContent = "✗ no bars parsed"; return; }
      persist();
      ctx.bus.publish(makeMessage(FROM, "progression", { prog }));
      status.textContent = "♪ on the bus — GloriArp (and friends) pick it up";
    } catch (e) { status.textContent = "✗ " + (e && e.message || e); }
  }

  bodyEl.append(
    el("div", { class: "ws-row" }, text),
    el("div", { class: "ws-row", style: "flex-wrap:wrap" },
      el("label", { class: "ws-ctl", text: "tonic " }, tonic),
      el("label", { class: "ws-ctl", text: "mode " }, mode),
      el("label", { class: "ws-ctl", text: "bars " }, len),
      el("label", { class: "ws-ctl", text: "seed " }, seed)),
    el("div", { class: "ws-row" },
      el("button", { class: "ws-btn", text: "⚄ generate", onclick: generate }),
      el("button", { class: "ws-btn", text: "→ bus", title: "Publish as a progression message", onclick: publish })),
    status);
}

// ── Keys: a playable surface — clicks/taps become bus `note` messages
// (Vane tab in the browser; real host MIDI in the plugin, for free).
export function keysModule(ctx, bodyEl, state) {
  const S = (k, d) => state[k] ?? d;
  const NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
  const octave = el("input", { class: "ws-text ws-num", type: "number", min: 0, max: 8, value: S("octave", 4), "aria-label": "Octave" });
  const vel = el("input", { class: "ws-text ws-num", type: "number", min: 1, max: 127, value: S("vel", 96), "aria-label": "Velocity" });
  const dur = el("input", { class: "ws-text ws-num", type: "number", min: 30, max: 4000, value: S("dur", 300), "aria-label": "Duration (ms)" });
  const to = el("select", { class: "ws-select", "aria-label": "Send to" },
    ...[["vane", "vane"], ["*", "all"]].map(([v, t]) => el("option", { value: v, text: t, ...(v === S("to", "vane") ? { selected: "" } : {}) })));
  const keys = el("div", { class: "ws-keys", role: "group", "aria-label": "Keyboard" });

  function playPc(pc) {
    const note = Math.max(0, Math.min(127, (Number(octave.value) + 1) * 12 + pc));
    Object.assign(state, { octave: Number(octave.value), vel: Number(vel.value), dur: Number(dur.value), to: to.value });
    ctx.save();
    ctx.bus.publish(makeNote(FROM, {
      notes: [note], velocity: Number(vel.value) || 96,
      durationMs: Number(dur.value) || 300,
    }, { to: to.value }));
  }
  NAMES.forEach((n, pc) => keys.append(
    el("button", { class: "ws-key" + (n.includes("♯") ? " black" : ""), text: n,
      "aria-label": `Play ${n}`, onclick: () => playPc(pc) })));

  bodyEl.append(
    keys,
    el("div", { class: "ws-row", style: "flex-wrap:wrap" },
      el("label", { class: "ws-ctl", text: "oct " }, octave),
      el("label", { class: "ws-ctl", text: "vel " }, vel),
      el("label", { class: "ws-ctl", text: "ms " }, dur),
      el("label", { class: "ws-ctl", text: "to " }, to)));
}

// ── Pattern Player: makes the Pattern module AUDIBLE — the latest `pattern`
// message on the bus, played as a looping voice (16ths at the bpm). In the
// plugin the notes exit as host MIDI: an instant metronome/drum lane.
export function playerModule(ctx, bodyEl, state) {
  const S = (k, d) => state[k] ?? d;
  let steps = null, label = "—";
  let timer = null, idx = -1, running = false;
  const bpm = el("input", { class: "ws-text ws-num", type: "number", min: 30, max: 300, value: S("bpm", 120), "aria-label": "BPM" });
  const note = el("input", { class: "ws-text ws-num", type: "number", min: 0, max: 127, value: S("note", 37), "aria-label": "MIDI note" });
  const to = el("select", { class: "ws-select", "aria-label": "Send to" },
    ...[["vane", "vane"], ["*", "all"]].map(([v, t]) => el("option", { value: v, text: t, ...(v === S("to", "vane") ? { selected: "" } : {}) })));
  const status = el("div", { class: "ws-readout", text: "waiting for a pattern on the bus…" });

  const off = ctx.bus.subscribe((m) => {
    if (m.type !== "pattern" || !m.body) return;
    const n = m.body.steps;
    steps = Array.from({ length: n }, (_, i) => Math.floor(m.body.mask / 2 ** i) % 2); // leftmost = LSB
    label = m.body.name || `${n} steps`;
    if (!running) status.textContent = `pattern: ${label} — press ▶`;
  });

  function tick(at) {
    if (!running || !steps) return;
    idx = (idx + 1) % steps.length;
    if (steps[idx]) {
      Object.assign(state, { bpm: Number(bpm.value), note: Number(note.value), to: to.value }); ctx.save();
      ctx.bus.publish(makeNote(FROM, {
        notes: [Number(note.value) || 37], velocity: 100,
        durationMs: Math.max(20, Math.round(stepMs() * 0.9)),
      }, { to: to.value }));
    }
    status.textContent = `▶ ${label} · step ${idx + 1}/${steps.length}`;
    const next = at + stepMs();
    timer = setTimeout(() => tick(next), Math.max(0, next - Date.now()));
  }
  const stepMs = () => 60000 / (Number(bpm.value) || 120) / 4; // 16ths
  function play() {
    if (!steps) { status.textContent = "no pattern yet — send one from the Pattern module"; return; }
    stop(); running = true; idx = -1; tick(Date.now());
  }
  function stop() { running = false; clearTimeout(timer); }

  bodyEl.append(
    el("div", { class: "ws-row", style: "flex-wrap:wrap" },
      el("label", { class: "ws-ctl", text: "bpm " }, bpm),
      el("label", { class: "ws-ctl", text: "note " }, note),
      el("label", { class: "ws-ctl", text: "to " }, to)),
    el("div", { class: "ws-row" },
      el("button", { class: "ws-btn", text: "▶ play", onclick: play }),
      el("button", { class: "ws-btn", text: "■ stop", onclick: () => { stop(); status.textContent = "stopped"; } })),
    status);
  return () => { stop(); off(); };
}

// ── Rhythm Analysis: the UPI lens on whatever pattern crosses the bus —
// evenness, balance, syncopation, notations. Analysis as a bus citizen.
export function rhythmAnalysisModule(ctx, bodyEl) {
  const out = el("div", { class: "ws-readout", text: "waiting for a pattern on the bus…" });
  const detail = el("div", { class: "ws-readout" });
  const off = ctx.bus.subscribe((m) => {
    if (m.type !== "pattern" || !m.body) return;
    const n = m.body.steps;
    const steps = Array.from({ length: n }, (_, i) => Math.floor(m.body.mask / 2 ** i) % 2);
    const a = analyse(steps);
    const s = analyzeSyncopation(steps, n);
    out.textContent = `${m.body.name || "pattern"} · ${a.k}/${n} onsets · ${a.hex} · dec ${a.decimal}`;
    detail.textContent = `evenness ${a.evenness.toFixed(3)} · balanced ${a.balanced}`
      + ` · syncopation ${typeof s?.overallSyncopation === "number" ? s.overallSyncopation.toFixed(3) : "—"}${s?.level ? ` (${s.level})` : ""}`
      + ` · intervals ${a.intervals.join(" ")}`;
  });
  bodyEl.append(out, detail);
  return () => off();
}

// ── Chord Namer: names what flows by — `note` and `chord` messages get the
// theory dictionary's verdict (the MIDIsplainer instinct, as a module).
export function chordNamerModule(ctx, bodyEl) {
  const out = el("div", { class: "ws-readout ws-chordname", text: "—" });
  const info = el("div", { class: "ws-readout", text: "plays a chord on the bus (Keys, GloriArp…) and I name it" });
  const off = ctx.bus.subscribe((m) => {
    let pitches = null;
    if (m.type === "note" && Array.isArray(m.body?.notes)) pitches = m.body.notes;
    else if (m.type === "chord" && Array.isArray(m.body?.notes)) pitches = m.body.notes;
    if (!pitches || !pitches.length) return;
    const match = detectChord(pitches);
    const names = pitches.map((p) => `${rootName(((p % 12) + 12) % 12)}${Math.floor(p / 12) - 1}`).join(" ");
    out.textContent = match ? match.symbol : (pitches.length === 1 ? names : "?");
    info.textContent = names;
  });
  bodyEl.append(out, info);
  return () => off();
}

// ── Recorder: a message looper — capture bus traffic with its timing, play
// it back (re-identified so the bus dedupe never eats it), loop it. Knob
// rides, notes, whole scenes: if it crossed the bus, it can come back.
export function recorderModule(ctx, bodyEl, state) {
  let tape = state.tape ?? [];   // { atMs, msg }
  let recording = false, recT0 = 0, playing = false;
  let timers = [];
  const status = el("div", { class: "ws-readout", text: tape.length ? `${tape.length} messages on tape` : "empty tape" });
  const loopBox = el("input", { type: "checkbox", ...(state.loop ? { checked: "" } : {}), "aria-label": "Loop" });

  const off = ctx.bus.subscribe((m) => {
    if (!recording || playing) return;
    if (m.type === "manifest") return; // chatter, not performance
    tape.push({ atMs: Date.now() - recT0, msg: m });
    status.textContent = `● ${tape.length} messages…`;
  });

  function record() {
    playing = false; timers.forEach(clearTimeout); timers = [];
    tape = []; recording = true; recT0 = Date.now();
    status.textContent = "● recording the bus…";
  }
  function stopAll() {
    recording = false; playing = false;
    timers.forEach(clearTimeout); timers = [];
    state.tape = tape; state.loop = loopBox.checked; ctx.save();
    status.textContent = tape.length ? `${tape.length} messages on tape` : "empty tape";
  }
  function play() {
    if (!tape.length) { status.textContent = "empty tape — record something first"; return; }
    recording = false; playing = true;
    timers.forEach(clearTimeout); timers = [];
    const t0 = Date.now();
    const span = Math.max(tape[tape.length - 1].atMs + 50, 100);
    const schedulePass = (passStart) => {
      for (const { atMs, msg } of tape) {
        timers.push(setTimeout(() => {
          if (!playing) return;
          // Re-identify: the bus dedupes by id, so a replay must be a NEW message.
          ctx.bus.publish({ ...msg, id: `rec-${Math.random().toString(36).slice(2)}`,
            sentAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z") });
        }, Math.max(0, passStart + atMs - Date.now())));
      }
      if (loopBox.checked) timers.push(setTimeout(() => { if (playing) schedulePass(passStart + span); },
        Math.max(0, passStart + span - Date.now())));
    };
    schedulePass(t0);
    status.textContent = `▶ replaying ${tape.length} messages${loopBox.checked ? " · looping" : ""}`;
  }

  bodyEl.append(
    el("div", { class: "ws-row" },
      el("button", { class: "ws-btn", text: "● rec", onclick: record }),
      el("button", { class: "ws-btn", text: "▶ play", onclick: play }),
      el("button", { class: "ws-btn", text: "■ stop", onclick: stopAll }),
      el("label", { class: "ws-ctl" }, loopBox, " loop")),
    status);
  return () => { playing = false; recording = false; timers.forEach(clearTimeout); off(); };
}

// ── Vane Synth: the SYNTH ITSELF in the page — the plugin's real DSP
// (vane-dsp.wasm, the same voice the C++ ships) in an audio worklet, fed by
// the bus. No second tab: notes and control-surface knob turns sound HERE.
// The worklet source and wasm are bundled (text/binary loaders), so this
// works from any origin — file://, juce://, GitHub Pages alike.

import workletText from "./vane-worklet.txt";
import { applyVaneParam, applyVaneNote, vaneIdToWasm } from "../vane/control.js";

/** Subscribe a bus to a Vane voice's post fn (exported for tests: the same
 *  param-or-note routing the Vane TAB uses, minus the BroadcastChannel). */
export function wireVaneBus(bus, post) {
  const idToWasm = vaneIdToWasm();
  return bus.subscribe((m) => { applyVaneParam(post, idToWasm, m) || applyVaneNote(post, m); });
}

export function vaneSynthModule(ctx, bodyEl) {
  let audioCtx = null, node = null, offBus = null;
  const status = el("div", { class: "ws-readout", text: "⏻ power on, then play the bus (Keys, GloriArp, Player…)" });
  const post = (msg) => { if (node) node.port.postMessage(msg); };

  // The hard-won Vane lesson (apps/vane/synth-main.js): building once is not
  // enough — a suspended AudioContext must be resumed on a USER GESTURE, and
  // the status must stay honest (never claim ready while suspended).
  async function power() {
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        audioCtx.onstatechange = paint;
        const url = URL.createObjectURL(new Blob([workletText], { type: "text/javascript" }));
        await audioCtx.audioWorklet.addModule(url);
        URL.revokeObjectURL(url);
        node = new AudioWorkletNode(audioCtx, "vane-voice", { numberOfInputs: 0, outputChannelCount: [2] });
        node.connect(audioCtx.destination);
        // Dynamic import: esbuild inlines the wasm bytes into the bundle
        // (binary loader); environments without Web Audio never reach here,
        // and vitest's vite (which can't parse wasm imports) never sees it.
        const { default: vaneDspWasm } = await import("../vane/synth/vane-dsp.wasm");
        node.port.postMessage({ type: "wasm", bytes: vaneDspWasm.buffer ?? vaneDspWasm });
        offBus = wireVaneBus(ctx.bus, post);
      }
      if (audioCtx.state !== "running") await audioCtx.resume();
      paint();
    } catch (e) { status.textContent = "✗ audio: " + (e && e.message || e); }
  }
  function paint() {
    if (!audioCtx) return;
    status.textContent = audioCtx.state === "running"
      ? "● voice live — bus notes and Vane knobs sound here"
      : "⏻ tap power again (audio suspended until a user gesture)";
  }

  bodyEl.append(
    el("div", { class: "ws-row" },
      el("button", { class: "ws-btn", text: "⏻ power", onclick: power }),
      el("button", { class: "ws-btn ghost", text: "silence", title: "All notes off",
        onclick: () => post({ type: "allOff" }) })),
    status,
    el("div", { class: "ws-readout", text: "the plugin's own DSP (wasm) — one voice, everywhere" }));
  return () => { offBus && offBus(); try { audioCtx && audioCtx.close(); } catch { /* already gone */ } };
}

// ── Pattern Transforms: Serpe's verbs on whatever pattern the bus carries —
// rotate, invert, complement, Barlow dilute/concentrate, mutate. Each result
// is republished, so Pattern redraws, Analysis re-reads, Player re-plays.
export function transformsModule(ctx, bodyEl) {
  let steps = null, name = "—";
  const status = el("div", { class: "ws-readout", text: "waiting for a pattern on the bus…" });
  const off = ctx.bus.subscribe((m) => {
    if (m.type !== "pattern" || !m.body || m.from === FROM + ":transforms") return;
    steps = Array.from({ length: m.body.steps }, (_, i) => Math.floor(m.body.mask / 2 ** i) % 2);
    name = m.body.name || `${m.body.steps} steps`;
    status.textContent = `pattern: ${name}`;
  });
  function publish(next, label) {
    steps = next; name = label;
    const mask = next.reduce((acc, s, i) => acc + (s ? 2 ** i : 0), 0); // leftmost = LSB
    ctx.bus.publish(makeMessage(FROM, "pattern", { steps: next.length, mask, name: label }));
    status.textContent = `→ ${label}`;
  }
  const need = () => { if (!steps) status.textContent = "no pattern yet — send one first"; return !!steps; };
  const btn = (text, title, fn) => el("button", { class: "ws-btn", text, title,
    onclick: () => { if (need()) fn(); } });
  const k = () => steps.reduce((a, s) => a + s, 0);

  bodyEl.append(
    el("div", { class: "ws-row", style: "flex-wrap:wrap" },
      btn("⟲", "Rotate one step earlier", () => publish(rotate(steps, -1), `rot−1 ${name}`)),
      btn("⟳", "Rotate one step later", () => publish(rotate(steps, 1), `rot+1 ${name}`)),
      btn("¬", "Complement (onsets ↔ rests)", () => publish(complement(steps), `comp ${name}`)),
      btn("↔", "Reverse (retrograde)", () => publish(invert(steps), `rev ${name}`)),
      btn("−1", "Barlow dilute: drop the most dispensable onset", () => {
        if (k() > 1) publish(barlowTransform(steps, k() - 1), `dilute ${name}`);
      }),
      btn("+1", "Barlow concentrate: add at the most indispensable rest", () => {
        if (k() < steps.length) publish(barlowTransform(steps, k() + 1), `concen ${name}`);
      }),
      btn("⚄", "Mutate (balanced, 30%)", () => publish(mutatePattern(steps, 0.3), `mut ${name}`))),
    status);
  return () => off();
}

// ── Library: the session's memory — capture what crosses the bus
// (progressions, patterns) as @enkerli/library-kind items, keep them across
// reloads, put them back on the bus later. Saved bindings live with the
// bindings module; this shelf holds the musical objects.
const LIB_KEY = "enkerli.workspace.library";

export function libraryModule(ctx, bodyEl) {
  let last = { progression: null, pattern: null };
  const load = () => { try { return JSON.parse(localStorage.getItem(LIB_KEY)) || []; } catch { return []; } };
  const store = (items) => { try { localStorage.setItem(LIB_KEY, JSON.stringify(items)); } catch { /* private mode */ } };
  let items = load();

  const list = el("div", { class: "ws-controls" });
  const status = el("div", { class: "ws-readout", text: items.length ? `${items.length} saved` : "capture something off the bus" });

  const off = ctx.bus.subscribe((m) => {
    if (m.type === "progression" && m.body?.prog) last.progression = m;
    else if (m.type === "pattern" && m.body) last.pattern = m;
  });

  function titleOf(m) {
    if (m.type === "pattern") return m.body.name || `${m.body.steps}-step pattern`;
    try {
      const bars = m.body.prog.sections.flatMap((s) => s.bars);
      const first = bars[0]?.chords?.map((c) => (c.symbol ? c.symbol.root + c.symbol.suffix : c.degree?.numeral)).join(" ");
      return `${first ?? "progression"} … (${bars.length} bars)`;
    } catch { return "progression"; }
  }
  function save(kind) {
    const m = last[kind];
    if (!m) { status.textContent = `no ${kind} heard on the bus yet`; return; }
    items.push({ id: `ws-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      kind, title: titleOf(m), savedAt: new Date().toISOString(), msg: m });
    store(items); render();
    status.textContent = `saved: ${items[items.length - 1].title}`;
  }
  function replay(item) {
    // Re-identify: the bus dedupes by id — a shelf item must return as new.
    ctx.bus.publish({ ...item.msg, id: `lib-${Math.random().toString(36).slice(2)}`,
      sentAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z") });
    status.textContent = `▶ ${item.title}`;
  }
  function remove(id) {
    items = items.filter((x) => x.id !== id);
    store(items); render();
  }
  function render() {
    list.replaceChildren(...items.map((item) => el("div", { class: "ws-param" },
      el("span", { class: "ws-param-name", text: `${item.kind === "pattern" ? "▦" : "♪"} ${item.title}` }),
      el("button", { class: "ws-btn", text: "▶", title: "Put it back on the bus", "aria-label": `Load ${item.title}`,
        onclick: () => replay(item) }),
      el("button", { class: "ws-x", text: "✕", title: "Delete", "aria-label": `Delete ${item.title}`,
        onclick: () => remove(item.id) }))));
  }
  render();

  bodyEl.append(
    el("div", { class: "ws-row" },
      el("button", { class: "ws-btn", text: "+ progression", title: "Save the last progression heard on the bus", onclick: () => save("progression") }),
      el("button", { class: "ws-btn", text: "+ pattern", title: "Save the last pattern heard on the bus", onclick: () => save("pattern") })),
    list, status);
  return () => off();
}

export const MODULES = {
  "control-surface": { title: "Control Surface", make: controlSurfaceModule },
  "vane-synth": { title: "Vane Synth", make: vaneSynthModule },
  "pattern": { title: "Pattern (UPI)", make: patternModule },
  "pcs-pads": { title: "PCS Pads", make: pcsPadsModule },
  "voice-split": { title: "Voice Split", make: voiceSplitModule },
  "mono-merge": { title: "Mono Merge", make: monoMergeModule },
  "transforms": { title: "Pattern Transforms", make: transformsModule },
  "player": { title: "Pattern Player", make: playerModule },
  "rhythm-analysis": { title: "Rhythm Analysis", make: rhythmAnalysisModule },
  "progression": { title: "Progression", make: progressionModule },
  "gloriarp": { title: "GloriArp", make: gloriarpModule },
  "keys": { title: "Keys", make: keysModule },
  "chord-namer": { title: "Chord Namer", make: chordNamerModule },
  "recorder": { title: "Recorder", make: recorderModule },
  "library": { title: "Library", make: libraryModule },
  "bindings": { title: "Bindings", make: bindingsModule },
  "monitor": { title: "Bus Monitor", make: monitorModule },
  "bridge": { title: "Bridge (CLI)", make: bridgeModule },
};
