/**
 * Knob — "a slider that looks like a knob" (docs/DESIGN_AGENT_ANSWERS.md
 * §3). Circular body for the compact "mixing board" read a row of 4-5
 * simultaneous mutation dials wants, but the skeuomorphism is VISUAL
 * only: the interaction contract is exactly the suite's slider/stepper
 * contract, never circular/angular drag — a knob a mouse can't actually
 * turn is hostile, so this one is turned by dragging straight up/down.
 * Framework-agnostic: createKnob(el, opts) → handle, matching the
 * create*(el, opts) convention of the other shared components
 * (range-slider.js, section.js, ...).
 *
 * Visual style lives in components.css (.es-knob*); this module is
 * behavior only.
 */

const NS = "http://www.w3.org/2000/svg";
const svgEl = (n, a = {}) => {
  const e = document.createElementNS(NS, n);
  for (const k in a) e.setAttribute(k, a[k]);
  return e;
};

/**
 * @param {Element} el host element (emptied)
 * @param {object} [opts]
 * @param {number} [opts.min] @param {number} [opts.max] @param {number} [opts.step]
 * @param {number} [opts.value]
 * @param {number} [opts.default] value restored by double-click / long-press (default: initial value)
 * @param {string} [opts.label] aria-label AND the visible caption under the dial
 * @param {(v:number)=>string} [opts.format] value → readout text (and aria-valuetext)
 * @param {string} [opts.hue] a var(--es-dim-*) (or any CSS color) for the indicator arc
 * @param {(v:number)=>void} [opts.onChange]
 */
export function createKnob(el, opts = {}) {
  const s = {
    min: 0, max: 1, step: 0.01, value: 0,
    label: "", format: (v) => String(v),
    hue: "var(--es-accent)",
    onChange: null,
    ...opts,
  };
  if (s.default === undefined) s.default = s.value;

  const root = document.createElement("div");
  root.className = "es-knob";
  root.style.setProperty("--es-knob-hue", s.hue);

  const body = document.createElement("button");
  body.type = "button";
  body.className = "es-knob-body";
  body.setAttribute("role", "slider");
  body.setAttribute("aria-label", s.label);
  body.setAttribute("aria-valuemin", String(s.min));
  body.setAttribute("aria-valuemax", String(s.max));

  const svg = svgEl("svg", { viewBox: "0 0 44 44", "aria-hidden": "true", class: "es-knob-face" });
  const well = svgEl("circle", { cx: 22, cy: 22, r: 18, class: "es-knob-well" });
  const arc = svgEl("path", { class: "es-knob-arc" });
  svg.append(well, arc);
  body.append(svg);

  const readout = document.createElement("input");
  readout.type = "number";
  readout.className = "es-knob-readout es-num";
  readout.step = String(s.step);
  readout.min = String(s.min);
  readout.max = String(s.max);
  readout.setAttribute("aria-label", s.label ? `${s.label} value` : "value");

  const labelEl = document.createElement("div");
  labelEl.className = "es-knob-label";
  labelEl.textContent = s.label;

  root.append(body, readout, labelEl);
  el.replaceChildren(root);

  const clamp = (v) => Math.min(s.max, Math.max(s.min, v));
  const snap = (v, stepSize) => Math.round(v / stepSize) * stepSize;

  // 270° of travel (matches a real synth knob's throw), starting at
  // "7 o'clock" and sweeping clockwise to "5 o'clock" — same arc-sweep
  // primitive spirit as the Serpe rings (render.js), a different radius.
  const START = Math.PI * 0.75, SWEEP = Math.PI * 1.5, R = 18, C = 22;
  function arcPath(frac) {
    const a0 = START, a1 = START + SWEEP * frac;
    const p = (a) => [C + R * Math.cos(a), C + R * Math.sin(a)];
    const [x0, y0] = p(a0);
    if (frac <= 0.0008) return `M ${x0.toFixed(2)} ${y0.toFixed(2)}`; // no meaningful arc at the floor
    const [x1, y1] = p(a1);
    const large = SWEEP * frac > Math.PI ? 1 : 0;
    return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  }

  function render() {
    const frac = clamp((s.value - s.min) / (s.max - s.min || 1));
    arc.setAttribute("d", arcPath(frac));
    body.setAttribute("aria-valuenow", String(s.value));
    body.setAttribute("aria-valuetext", s.format(s.value));
    if (document.activeElement !== readout) readout.value = s.format(s.value);
  }
  function commit(v, stepSize = s.step) {
    s.value = clamp(snap(v, stepSize));
    render();
    s.onChange?.(s.value);
  }

  // ── Pointer: VERTICAL drag only, never angular — ~200px spans the full
  // range; shift-drag = fine mode (¼ step). A long-press (600ms, cancelled
  // by real movement) resets to default, same gesture as touch elsewhere
  // in the suite; double-click does the same for a mouse. ──
  body.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    try { body.setPointerCapture(e.pointerId); } catch { /* no-op */ }
    body.classList.add("grab");
    const startY = e.clientY, startV = s.value;
    let moved = false;
    const longPress = setTimeout(() => { if (!moved) commit(s.default); }, 600);
    const move = (ev) => {
      const dy = startY - ev.clientY; // up = increase
      if (Math.abs(dy) > 3) moved = true;
      const perPixel = (s.max - s.min) / 200;
      commit(startV + dy * perPixel, ev.shiftKey ? s.step / 4 : s.step);
    };
    const up = () => {
      clearTimeout(longPress);
      try { body.releasePointerCapture?.(e.pointerId); } catch { /* no-op */ }
      body.removeEventListener("pointermove", move);
      body.removeEventListener("pointerup", up);
      body.classList.remove("grab");
    };
    body.addEventListener("pointermove", move);
    body.addEventListener("pointerup", up);
  });
  body.addEventListener("dblclick", () => commit(s.default));

  // ── Wheel: one step per notch. Gated on focus (not hover) so a knob
  // sitting in a scrollable panel never hijacks ambient page scroll. ──
  body.addEventListener("wheel", (e) => {
    if (document.activeElement !== body) return;
    e.preventDefault();
    commit(s.value + (e.deltaY < 0 ? s.step : -s.step));
  }, { passive: false });

  // ── Keyboard — identical contract to a range slider ──
  body.addEventListener("keydown", (e) => {
    const big = s.step * 10;
    if (e.key === "ArrowUp" || e.key === "ArrowRight") commit(s.value + s.step);
    else if (e.key === "ArrowDown" || e.key === "ArrowLeft") commit(s.value - s.step);
    else if (e.key === "PageUp") commit(s.value + big);
    else if (e.key === "PageDown") commit(s.value - big);
    else if (e.key === "Home") commit(s.min);
    else if (e.key === "End") commit(s.max);
    else return;
    e.preventDefault();
  });

  // ── Click-to-type: the readout is a real <input type=number> ──
  readout.addEventListener("change", () => {
    // A native number input silently empties itself on genuinely invalid
    // text (readout.value === ""), and Number("") is 0 — finite, so it
    // would otherwise slip past a bare isFinite check and commit a wrong
    // value instead of rejecting it.
    const v = Number(readout.value);
    if (readout.value !== "" && Number.isFinite(v)) commit(v);
    else render(); // bad/empty input — restore the last valid value
  });
  readout.addEventListener("keydown", (e) => { if (e.key === "Enter") readout.blur(); });

  render();
  return {
    get value() { return s.value; },
    update(next) {
      Object.assign(s, next);
      render();
    },
    destroy() { root.remove(); },
  };
}
