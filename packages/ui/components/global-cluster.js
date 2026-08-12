/**
 * The global-controls cluster — the constant of the shared frame.
 * Order, everywhere: theme · MIDI · density · Library. Stable ids:
 * #theme-toggle #midi-chip #density-toggle #library-toggle.
 *
 * Framework-agnostic (the createSection idiom); React apps mount it in
 * a ref'd host. The theme slot is wired to the ONE shared mechanism
 * (@enkerli/ui/theme — [data-theme] + localStorage "enkerli.theme");
 * MIDI is presentation-only: the app feeds port lists and selection
 * callbacks from its own manager (@enkerli/webmidi or bespoke).
 *
 * Spec: the "Shared Frame — Consistency Pass" design document.
 */

import { resolvedTheme, toggleTheme } from "../theme.js";

/** The suite's ONE DIN-5 MIDI icon (was copy-pasted per app). */
export const DIN5_SVG =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">' +
  '<circle cx="12" cy="12" r="9.2"/>' +
  '<circle cx="12" cy="7.6" r="1.15" fill="currentColor" stroke="none"/>' +
  '<circle cx="7.2" cy="10.2" r="1.15" fill="currentColor" stroke="none"/>' +
  '<circle cx="16.8" cy="10.2" r="1.15" fill="currentColor" stroke="none"/>' +
  '<circle cx="8.6" cy="14.8" r="1.15" fill="currentColor" stroke="none"/>' +
  '<circle cx="15.4" cy="14.8" r="1.15" fill="currentColor" stroke="none"/>' +
  "</svg>";

const LIB_SVG =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
  '<path d="M4 20V5a1 1 0 0 1 1-1h3v16H5a1 1 0 0 1-1-1Z"/><path d="M8 4h4v16H8z"/>' +
  '<path d="m13.3 5.2 3.8-1 4.2 15.5-3.9 1z"/></svg>';

function el(tag, className, html) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (html != null) n.innerHTML = html;
  return n;
}

/** One .es-device-select endpoint (In or Out) inside the MIDI panel. */
function endpoint({ label, kind, ports, selectedId, sysex, noneOption, onSelect }) {
  // A port that is SELECTED is not necessarily a port that is THERE. Hardware
  // MIDI ports are exclusive on ALSA and WinMM, so a DAW taking the device
  // makes it disappear from the list while our selection still names it. The
  // old test was "is anything selected", which in that state reported
  // "Connected · SysEx" over a <select> rendering blank -- confident and wrong,
  // about the one device the panel exists to talk to.
  const present = ports.some((p) => p.id === selectedId);
  const connected = ports.length > 0 && (noneOption ? present : true);
  const box = el("div", "es-device-select");
  box.dataset.state = ports.length ? (connected ? "connected" : "available") : "empty";
  const head = el("div", "es-device-select-head");
  head.append(
    el("span", "es-device-icon", DIN5_SVG),
    Object.assign(el("span", "es-device-name"), { textContent: label }),
  );
  const status = el("span", "es-device-status");
  status.append(el("span", "es-device-led"));
  status.append(document.createTextNode(
    ports.length ? (connected ? (sysex ? "Connected · SysEx" : "Connected") : "None") : "None",
  ));
  head.append(status);
  box.append(head);
  if (ports.length) {
    const sel = el("select", "es-control");
    sel.setAttribute("aria-label", label);
    const opt = (text, value) => Object.assign(document.createElement("option"), { textContent: text, value });
    if (noneOption) sel.append(opt(noneOption, ""));
    for (const p of ports) sel.append(opt(p.name, p.id));
    // Same reason: assigning an id with no matching <option> leaves the select
    // showing nothing at all. Fall back to the none option so a vanished
    // device reads as disconnected rather than as an empty box.
    sel.value = present ? selectedId : "";
    sel.addEventListener("change", () => onSelect?.(sel.value || null));
    box.append(sel);
  } else {
    box.append(el("div", "es-device-empty",
      `No ${kind === "in" ? "input" : "output"} — connect a device`));
  }
  return box;
}

/**
 * @param {Element} host
 * @param {object} opts
 * @param {(theme:"light"|"dark")=>void} [opts.onThemeChange] app hook after the shared toggle runs
 * @param {object|null} [opts.midi] omit/null to skip slot 2 (apps with no MIDI).
 *   { unavailable?:boolean, native?:boolean, sysex?:boolean,
 *     // native: MIDI is handled by the app/host itself (JUCE standalone,
 *     // plugin) — the chip reads "MIDI · native" instead of the misleading
 *     // "No Web MIDI", and the popover says where routing actually lives.
 *     inputs?:{id,name}[]|null, outputs?:{id,name}[]|null,   // null = app has no such direction
 *     selectedInId?, selectedOutId?, noneOption?:string,     // e.g. "Internal (Web Audio)"
 *     onSelectIn?, onSelectOut?, badge?:string }             // e.g. "Standalone"
 * @param {Element|null} [opts.densityTarget] gets .es-dense toggled; omit/null to skip slot 3
 * @param {object|null} [opts.library] omit/null to skip slot 4.
 *   { count?:number, onToggle:()=>void }
 * @param {string|null} [opts.build] omit/null to skip slot 5 — a rightmost,
 *   non-interactive build-id chip ("which build am I looking at?" — the Vane
 *   diagnostic blessed suite-wide; design audit 2026-07-19 D3). Pass the id
 *   your build stamps (e.g. a __BUILD_ID__ sed step).
 * @returns {{ root:HTMLElement, update(next?:object):void, destroy():void }}
 */
export function createGlobalCluster(host, opts = {}) {
  let state = { ...opts };
  const root = el("div", "es-cluster");
  root.setAttribute("role", "group");
  root.setAttribute("aria-label", "Global controls");
  host.appendChild(root);

  let popover = null;
  const closePopover = () => { popover?.remove(); popover = null; };
  const onDocDown = (e) => { if (popover && !root.contains(e.target)) closePopover(); };
  const onKey = (e) => { if (e.key === "Escape") closePopover(); };
  document.addEventListener("mousedown", onDocDown, true);
  document.addEventListener("keydown", onKey);

  function render() {
    closePopover();
    root.textContent = "";

    // slot 1 · theme — the one toggle, the one mechanism
    const themeBtn = el("button", "es-btn es-small es-theme-toggle");
    themeBtn.id = "theme-toggle";
    themeBtn.title = "Switch theme";
    const labelTheme = () => {
      const dark = resolvedTheme() === "dark";
      themeBtn.innerHTML = `<span class="glyph" aria-hidden="true">${dark ? "☀︎" : "●"}</span>${dark ? "Light" : "Dark"}`;
      themeBtn.setAttribute("aria-pressed", String(dark));
    };
    labelTheme();
    themeBtn.addEventListener("click", () => {
      const next = toggleTheme();
      labelTheme();
      state.onThemeChange?.(next);
    });
    root.append(themeBtn);

    // slot 2 · MIDI status chip → popover panel (omitted when the app has no MIDI)
    if (state.midi) {
      const m = state.midi;
      const ins = m.inputs ?? null, outs = m.outputs ?? null;
      const n = (ins?.length ?? 0) + (outs?.length ?? 0);
      const chipState = m.native ? "connected" : m.unavailable ? "unavailable" : n > 0 ? "connected" : "none";
      const anchor = el("div", "pop-anchor");
      const chip = el("button", "es-btn es-small midi-chip");
      chip.id = "midi-chip";
      chip.dataset.state = chipState;
      chip.title = "MIDI devices";
      chip.setAttribute("aria-haspopup", "dialog");
      chip.setAttribute("aria-expanded", "false");
      chip.innerHTML = `<span class="midi-led"></span>${DIN5_SVG}${
        m.native ? "MIDI · native" : m.unavailable ? "No Web MIDI" : `MIDI · ${n}`}`;
      chip.addEventListener("click", () => {
        if (popover) { closePopover(); chip.setAttribute("aria-expanded", "false"); return; }
        popover = el("div", "es-popover");
        popover.setAttribute("role", "dialog");
        popover.setAttribute("aria-label", "MIDI devices");
        const head = el("div", "pop-head");
        head.append(el("span", "es-eyebrow", "MIDI Devices"));
        if (m.badge) head.append(el("span", "feat-badge standalone", m.badge));
        popover.append(head);
        const bar = el("div", "es-device-bar");
        if (m.native) {
          bar.append(el("div", "es-device-empty",
            "MIDI is handled by the app itself — choose devices in its audio/MIDI settings (standalone) or route in the host (plugin)."));
        } else if (m.unavailable) {
          const empty = el("div", "es-device-empty", "MIDI unavailable — use Chrome, Edge or Brave");
          empty.style.borderColor = "var(--es-danger)";
          bar.append(empty);
        } else {
          if (ins) bar.append(endpoint({ label: "MIDI In", kind: "in", ports: ins,
            selectedId: m.selectedInId, sysex: m.sysex, onSelect: m.onSelectIn }));
          if (outs) bar.append(endpoint({ label: "MIDI Out", kind: "out", ports: outs,
            selectedId: m.selectedOutId, sysex: m.sysex, noneOption: m.noneOption,
            onSelect: m.onSelectOut }));
        }
        popover.append(bar);
        anchor.append(popover);
        // Keep the popover on-screen: it's right-anchored (opens leftward), but
        // when the chip sits near the left edge (e.g. exquisite-fingerings) that
        // runs off the viewport — flip it to open rightward instead.
        const rect = popover.getBoundingClientRect?.();
        if (rect && rect.left < 8) { popover.style.right = "auto"; popover.style.left = "0"; }
        chip.setAttribute("aria-expanded", "true");
      });
      anchor.append(chip);
      root.append(anchor);
    }

    // slot 3 · density (stage-performer persona)
    if (state.densityTarget) {
      const dBtn = el("button", "es-btn es-small");
      dBtn.id = "density-toggle";
      dBtn.title = "Control density";
      const labelDense = () => {
        const dense = state.densityTarget.classList.contains("es-dense");
        dBtn.innerHTML = `<span class="glyph" aria-hidden="true">≡</span>${dense ? "Dense" : "Cozy"}`;
        dBtn.setAttribute("aria-pressed", String(dense));
      };
      labelDense();
      dBtn.addEventListener("click", () => {
        state.densityTarget.classList.toggle("es-dense");
        labelDense();
      });
      root.append(dBtn);
    }

    // slot 4 · Library — rightmost: the destination slot
    if (state.library) {
      const lBtn = el("button", "es-btn es-small");
      lBtn.id = "library-toggle";
      lBtn.title = "Your saved things";
      lBtn.setAttribute("aria-haspopup", "dialog");
      lBtn.innerHTML = `${LIB_SVG}Library${
        state.library.count != null ? `<span class="lib-count-badge">${state.library.count}</span>` : ""}`;
      lBtn.addEventListener("click", () => state.library.onToggle?.());
      root.append(lBtn);
    }

    // slot 5 · build-id — rightmost of all, non-interactive (D3): the
    // "which build am I looking at?" chip, generalized from Vane.
    if (state.build) {
      const bChip = el("span", "es-btn es-small es-build-chip");
      bChip.id = "build-chip";
      bChip.title = "Build id";
      bChip.setAttribute("aria-label", `Build ${state.build}`);
      bChip.style.cursor = "default";
      bChip.style.pointerEvents = "none";
      bChip.style.opacity = "0.75";
      bChip.textContent = state.build;
      root.append(bChip);
    }
  }

  render();
  return {
    root,
    update(next = {}) { state = { ...state, ...next }; render(); },
    destroy() {
      document.removeEventListener("mousedown", onDocDown, true);
      document.removeEventListener("keydown", onKey);
      root.remove();
    },
  };
}
