/**
 * RND Companion — the WebUI.
 *
 * One UI codebase, three environments (CONVENTIONS F7): inside the JUCE plugin
 * over the __JUCE__ bridge, in a Chromium tab over Web MIDI, and in any other
 * browser as a read-only shell. The native side owns the ports and the seed
 * library either way; this is the view.
 *
 * It exists because the plugin's UI was a second, hand-maintained
 * implementation of the suite's design system — a LookAndFeel approximating
 * components.css by eye. Every design pass cost a round of geometry and colour
 * bugs that a stylesheet would simply not have had. Here the shipping classes
 * ARE the styling.
 */
import fontsCss from "@enkerli/ui/fonts.css";
// tokens.css DEFINES the --es-* variables; components.css only USES them.
// Without the first, every var() in the second is undefined and the whole
// declaration drops -- which renders as a completely unstyled page.
import tokensCss from "@enkerli/ui/tokens.css";
import componentsCss from "@enkerli/ui/components.css";
import { createGlobalCluster } from "@enkerli/ui/global-cluster";
import { initTheme, resolvedTheme } from "@enkerli/ui/theme";
import { formatSeed, parseSeed, rootName, scaleName, NUM_SCALES, NUM_ROOTS } from "@enkerli/rnd";
import { libraryItemToSeed } from "@enkerli/rnd/library";

import { createRndBridge } from "./bridge.js";
import shellCss from "./rnd-companion.css";

const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else if (k === "html") n.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
    else if (v != null) n.setAttribute(k, v);
  }
  for (const kid of kids) if (kid != null) n.append(kid);
  return n;
};

function injectStyles() {
  // fonts.css first: its @font-face rules must exist before anything uses
  // the --es-font-* stacks. Injected as text so the WebView needs no network.
  for (const css of [fontsCss, tokensCss, componentsCss, shellCss]) {
    document.head.append(el("style", { text: css }));
  }
}

function mount(host, bridge) {
  injectStyles();
  initTheme();

  const state = {
    status: {},          // seed, tempoBpm, root, scaleIndex, patchMode, engines
    items: [],           // library items, envelope form
    ports: { inputs: [], outputs: [], connected: false },
    transport: "direct",
    selected: null,
    filters: { unrated: true, keep: true, pass: false },
    // In a plugin build the bundle stamps itself through esbuild --inject
    // (write-build-tag.cmake); the webapp substitutes __BUILD_ID__ into the
    // page with sed. The plugin embeds the SOURCE index.html, so its data-build
    // is still the placeholder -- take the injected tag first.
    build: { ui: globalThis.__BUILD_TAG__
                 ?? (host.dataset.build?.includes("__BUILD_ID__") ? "dev" : host.dataset.build)
                 ?? "dev",
             native: null },
    mixTouched: false,
  };

  // ── Header: identity · Route · the shared cluster ────────────────────────
  const clusterHost = el("div", { class: "rc-cluster-host" });
  const connectionWord = el("span", { class: "rc-connection" });

  const routeSelect = el("select", { class: "es-control rc-route", "aria-label": "Route",
    onchange: () => bridge.send("setTransport", { transport: routeSelect.value }) },
    el("option", { value: "direct", text: "Direct MIDI port" }),
    el("option", { value: "host", text: "Plugin host stream" }),
    el("option", { value: "both", text: "Both" }));

  const header = el("header", { class: "rc-header" },
    el("span", { class: "rc-mark", "aria-hidden": "true" }),
    el("span", { class: "rc-appname", text: "RND Companion" }),
    el("span", { class: "es-eyebrow", text: "Route" }),
    routeSelect,
    connectionWord,
    clusterHost);

  // ── Device panel ─────────────────────────────────────────────────────────
  const seedBig = el("div", { class: "rc-seed num" , text: "——" });
  const seedDetail = el("div", { class: "rc-detail" });
  const seedInput = el("input", { class: "es-control rc-seedinput", type: "text",
    "aria-label": "Seed", placeholder: "0x00000000 or a decimal number" });

  const sendSeed = () => {
    const value = parseSeed(seedInput.value);
    if (value === null) { log(`"${seedInput.value}" is not a seed`); return; }
    bridge.send("sendSeed", { seed: value });
  };

  const devicePanel = el("section", { class: "es-panel rc-device" },
    el("div", { class: "es-eyebrow", text: "Device" }),
    seedBig,
    seedDetail,
    el("div", { class: "rc-row" },
      seedInput,
      el("button", { class: "es-btn es-primary", text: "Send", onclick: sendSeed }),
      el("button", { class: "es-btn", text: "Random",
        onclick: () => bridge.send("sendSeed", { seed: Math.floor(Math.random() * 0x100000000) }) })),
    el("div", { class: "rc-row" },
      el("button", { class: "es-btn", text: "Read device", onclick: () => bridge.send("readDevice") }),
      el("button", { class: "es-btn", text: "Capture", onclick: () => bridge.send("capture") })),
    el("p", { class: "rc-hint" },
      el("span", { class: "es-dot rc-dot-caution", "aria-hidden": "true" }),
      "Reading mutes the device briefly. Seeds arrive on their own when you turn the knob."));

  // ── Live ─────────────────────────────────────────────────────────────────
  const scaleSelect = el("select", { class: "es-control", "aria-label": "Scale",
    onchange: () => bridge.send("sendScale", { index: Number(scaleSelect.value) }) },
    el("option", { value: "", text: "from device" }),
    ...Array.from({ length: NUM_SCALES }, (_, i) => el("option", { value: String(i), text: scaleName(i) })));

  const rootSelect = el("select", { class: "es-control rc-narrow", "aria-label": "Root",
    onchange: () => bridge.send("sendRoot", { pitchClass: Number(rootSelect.value) }) },
    el("option", { value: "", text: "—" }),
    ...Array.from({ length: NUM_ROOTS }, (_, i) => el("option", { value: String(i), text: rootName(i) })));

  const mix = (id, label, initial, event) => {
    const out = el("output", { class: "rc-mixvalue", text: String(initial) });
    const range = el("input", { class: "rc-range", type: "range", min: "0", max: "127",
      value: String(initial), "aria-label": label,
      oninput: () => {
        out.textContent = range.value;
        state.mixTouched = true;
        live.classList.remove("rc-untouched");
        bridge.send(event, { value: Number(range.value) });
      } });
    return el("div", { class: "rc-mixrow" }, el("span", { class: "es-eyebrow", text: label }), range, out);
  };

  const live = el("section", { class: "es-panel rc-live rc-untouched" },
    el("div", { class: "es-eyebrow", text: "Live" }),
    el("div", { class: "rc-row" },
      el("span", { class: "es-eyebrow", text: "Scale" }), scaleSelect,
      el("span", { class: "es-eyebrow", text: "Root" }), rootSelect),
    mix("volume", "Volume", 100, "sendVolume"),
    mix("reverb", "Reverb", 40, "sendReverb"),
    el("p", { class: "rc-hint rc-muted", text:
      "Volume and reverb are send-only: the RND never reports them, so these show what will be sent, not where the hardware is." }),
    el("p", { class: "rc-hint rc-caution", text:
      "Scale and root lock on the hardware and change what a seed produces. Power-cycle to clear." }));

  // ── Library ──────────────────────────────────────────────────────────────
  const libraryEyebrow = el("div", { class: "es-eyebrow" });
  const libraryList = el("div", { class: "rc-list", role: "listbox", tabindex: "0",
    "aria-label": "Seed library" });
  const noteInput = el("input", { class: "es-control", type: "text",
    placeholder: "Note on the selected seed", "aria-label": "Note",
    onchange: () => state.selected != null
      && bridge.send("setNote", { seed: state.selected, note: noteInput.value }) });

  const act = (seed) => ({ seed });
  const libraryPanel = el("section", { class: "es-panel rc-library" },
    libraryEyebrow,
    libraryList,
    noteInput,
    el("div", { class: "rc-row rc-actions" },
      el("button", { class: "es-btn es-primary", text: "Keep",
        onclick: () => state.selected != null && bridge.send("rate", { ...act(state.selected), rating: "keep" }) }),
      el("button", { class: "es-btn", text: "Pass",
        onclick: () => state.selected != null && bridge.send("rate", { ...act(state.selected), rating: "pass" }) }),
      el("button", { class: "es-btn", text: "Send",
        onclick: () => state.selected != null && bridge.send("sendSeed", { seed: state.selected }) }),
      el("button", { class: "es-btn rc-danger", text: "Remove",
        onclick: () => state.selected != null && bridge.send("remove", act(state.selected)) })),
    el("p", { class: "rc-hint" },
      el("span", { class: "es-dot rc-dot-affirm", "aria-hidden": "true" }),
      "Remove undoes from a toast — no confirm dialog."));

  const logView = el("pre", { class: "rc-log", role: "log", "aria-live": "polite" });

  host.replaceChildren(header,
    el("div", { class: "rc-columns" },
      el("div", { class: "rc-col" }, devicePanel, live),
      libraryPanel),
    logView);

  // ── The shared cluster: theme · MIDI · density · Library · build ─────────
  let cluster = null;
  const renderCluster = () => {
    cluster?.destroy();
    cluster = createGlobalCluster(clusterHost, {
      onThemeChange: () => {},
      midi: {
        sysex: true,
        inputs: state.ports.inputs,
        outputs: state.ports.outputs,
        selectedInId: state.ports.selectedIn || null,
        selectedOutId: state.ports.selectedOut || null,
        // With a noneOption the shared endpoint() reports "Connected" only when
        // something really is selected, and its <select> gets an option whose
        // value is "" -- so an unselected picker shows "Not connected" instead
        // of rendering blank with selectedIndex -1.
        noneOption: "Not connected",
        onSelectIn: (id) => bridge.send("openInput", { id }),
        onSelectOut: (id) => bridge.send("openOutput", { id }),
        badge: bridge.kind === "juce" ? "Plugin" : undefined,
      },
      densityTarget: host,
      library: { count: state.items.length, onToggle: () => host.classList.toggle("rc-library-hidden") },
      build: state.build.native ? `${state.build.ui} / ${state.build.native}` : state.build.ui,
    });
  };

  // ── Rendering ────────────────────────────────────────────────────────────
  function log(line) {
    logView.textContent = `${new Date().toLocaleTimeString()}  ${line}\n` + logView.textContent;
  }

  function renderStatus() {
    const s = state.status;
    seedBig.textContent = s.seed != null ? formatSeed(s.seed) : "——";

    const lines = [];
    if (s.root != null && s.scaleIndex != null) lines.push(`${rootName(s.root)} ${scaleName(s.scaleIndex)}`);
    if (s.tempoBpm != null) lines.push(`${s.tempoBpm} BPM as reported`);
    if (s.patchMode != null) lines.push(`Patch mode ${s.patchMode}`);
    if (s.engines?.length) lines.push("Engines " + s.engines.map((e, i) => `${i + 1}: ${e}`).join("  "));

    seedDetail.replaceChildren(
      ...(lines.length ? lines : ["No status yet. Press Read device, or turn the RND's seed knob."])
        .map((t) => el("div", { text: t })));

    if (s.scaleIndex != null) scaleSelect.value = String(s.scaleIndex);
    if (s.root != null) rootSelect.value = String(s.root);
    if (s.seed != null) seedInput.value = formatSeed(s.seed);
  }

  function visibleItems() {
    return state.items
      .map((item) => ({ item, seed: libraryItemToSeed(item) }))
      .filter(({ seed }) => seed && state.filters[seed.rating === "unrated" ? "unrated" : seed.rating]);
  }

  function renderLibrary() {
    const rows = visibleItems();
    libraryEyebrow.textContent = `Library · ${rows.length}`;

    libraryList.replaceChildren(...rows.map(({ item, seed }) => {
      const mark = seed.rating === "keep" ? "K" : seed.rating === "pass" ? "P" : "–";
      const captured = item.payload?.captured;
      const short = captured
        ? `${rootName(captured.rootWhenCaptured)} ${scaleName(captured.scaleIndex)}`
        : "no status captured";

      // The full description is the accessible name and the tooltip: the row
      // shows the short form, but nothing is hidden from a screen reader.
      const full = captured
        ? `${short}, ${captured.tempoBpm} BPM${captured.engines?.length ? ", " + captured.engines.join(", ") : ""}`
        : short;

      return el("div", {
        class: `rc-item rc-${seed.rating}${state.selected === seed.seed ? " is-selected" : ""}`,
        role: "option", tabindex: "-1",
        "aria-selected": String(state.selected === seed.seed),
        "aria-label": `${formatSeed(seed.seed)}, ${seed.rating}, ${full}`,
        title: full,
        onclick: () => { state.selected = seed.seed; noteInput.value = seed.note ?? ""; renderLibrary(); },
        ondblclick: () => bridge.send("sendSeed", { seed: seed.seed }),
      },
        el("span", { class: "rc-item-seed num", text: formatSeed(seed.seed) }),
        el("span", { class: "rc-item-desc", text: short }),
        el("span", { class: "rc-item-mark", text: mark, "aria-hidden": "true" }));
    }));

    cluster?.update({ library: { count: rows.length, onToggle: () => host.classList.toggle("rc-library-hidden") } });
  }

  // ── Native → UI ──────────────────────────────────────────────────────────
  bridge.on("status", (s) => { state.status = s ?? {}; renderStatus(); });
  bridge.on("library", (payload) => { state.items = payload?.items ?? []; renderLibrary(); });
  bridge.on("log", (payload) => log(typeof payload === "string" ? payload : payload?.text ?? ""));
  bridge.on("ports", (p) => { state.ports = p ?? { inputs: [], outputs: [] }; renderPorts(); });
  bridge.on("transport", (p) => { routeSelect.value = p?.transport ?? "direct"; });
  bridge.on("build", (p) => { state.build.native = p?.native ?? null; renderCluster(); });

  function renderPorts() {
    connectionWord.textContent = state.ports.connected ? (state.ports.outputName ?? "Connected") : "Not connected";
    connectionWord.classList.toggle("is-connected", Boolean(state.ports.connected));
    renderCluster();
  }

  renderCluster();
  renderStatus();
  renderLibrary();
  renderPorts();

  bridge.send("uiReady", { theme: resolvedTheme() });
  return { state, log };
}

const host = document.getElementById("app");
if (host) mount(host, createRndBridge());
