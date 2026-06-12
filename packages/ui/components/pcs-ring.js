/**
 * PCS ring — the suite's pitch-class-set dial (PickPCS's Explorer ring,
 * promoted). Framework-agnostic SVG: createPcsRing(el, opts) → handle.
 *
 * Pitch-class sets follow the suite bit convention (CONVENTIONS.md):
 * MSB-first — bit for pc i is (mask >> (11 - i)) & 1, so C ionian
 * 0b101011010101 = 2773. `pcs` also accepts a Set/array of pcs directly.
 *
 * Colors come from the paper & ink tokens; per-pc hues (--es-pc-N) are
 * opt-in (colorByPc) and always paired with the label (a11y ground rule).
 */

const TAU = Math.PI * 2;

/** Decode an MSB-first 12-bit mask into a Set of pitch classes. */
export function maskToPcs(mask) {
  const pcs = new Set();
  for (let pc = 0; pc < 12; pc++) if ((mask >> (11 - pc)) & 1) pcs.add(pc);
  return pcs;
}

/** Encode a Set/array of pitch classes as an MSB-first 12-bit mask. */
export function pcsToMask(pcs) {
  let mask = 0;
  for (const pc of pcs) mask |= 1 << (11 - pc);
  return mask;
}

const NOTE_NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];

function polar(cx, cy, r, angle) {
  return [cx + r * Math.sin(angle), cy - r * Math.cos(angle)];
}

function segmentPath(cx, cy, rInner, rOuter, start, end) {
  const [x1, y1] = polar(cx, cy, rOuter, start);
  const [x2, y2] = polar(cx, cy, rOuter, end);
  const [x3, y3] = polar(cx, cy, rInner, end);
  const [x4, y4] = polar(cx, cy, rInner, start);
  return `M ${x1} ${y1} A ${rOuter} ${rOuter} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${rInner} ${rInner} 0 0 0 ${x4} ${y4} Z`;
}

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * @param {Element} el host element (emptied)
 * @param {object} [opts]
 * @param {number|Iterable<number>} [opts.pcs] active set (mask or pcs)
 * @param {number|null} [opts.root] root pc (ring marker), null = none
 * @param {"note"|"pc"|"none"} [opts.labels]
 * @param {Map<number,string>} [opts.names] spelled names per pc (overrides)
 * @param {boolean} [opts.colorByPc] use --es-pc-N for active segments
 * @param {number} [opts.size] CSS pixels (square)
 * @param {(pc:number, active:boolean)=>void} [opts.onToggle] click handler;
 *   omit for a read-only ring
 */
export function createPcsRing(el, opts = {}) {
  const state = {
    pcs: new Set(),
    root: null,
    labels: "note",
    names: null,
    colorByPc: false,
    size: 240,
    onToggle: null,
    ...normalize(opts),
  };

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 240 240");
  svg.setAttribute("role", "group");
  svg.setAttribute("aria-label", "Pitch-class ring");
  el.replaceChildren(svg);

  function normalize(o) {
    const out = { ...o };
    if (out.pcs !== undefined)
      out.pcs = typeof out.pcs === "number" ? maskToPcs(out.pcs) : new Set(out.pcs);
    return out;
  }

  function render() {
    svg.style.width = `${state.size}px`;
    svg.style.height = `${state.size}px`;
    const cx = 120, cy = 120, rOuter = 112, rInner = 74;
    const children = [];

    for (let pc = 0; pc < 12; pc++) {
      const start = (pc - 0.5) * (TAU / 12) + 0.012;
      const end = (pc + 0.5) * (TAU / 12) - 0.012;
      const active = state.pcs.has(pc);

      const path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("d", segmentPath(cx, cy, rInner, rOuter, start, end));
      path.setAttribute("fill", active
        ? (state.colorByPc ? `var(--es-pc-${pc})` : "var(--es-accent)")
        : "var(--es-bg-sunken)");
      path.setAttribute("stroke", active ? "var(--es-border-strong)" : "var(--es-border)");
      path.setAttribute("stroke-width", "1");
      path.dataset.pc = String(pc);
      if (state.onToggle) {
        path.setAttribute("role", "button");
        path.setAttribute("tabindex", "0");
        path.setAttribute("aria-pressed", String(active));
        path.style.cursor = "pointer";
        path.addEventListener("click", () => state.onToggle(pc, !active));
        path.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            state.onToggle(pc, !active);
          }
        });
      }
      const title = document.createElementNS(SVG_NS, "title");
      title.textContent = labelFor(pc);
      path.appendChild(title);
      children.push(path);

      if (state.labels !== "none") {
        const [tx, ty] = polar(cx, cy, (rOuter + rInner) / 2, (pc * TAU) / 12);
        const text = document.createElementNS(SVG_NS, "text");
        text.setAttribute("x", tx);
        text.setAttribute("y", ty);
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("dominant-baseline", "central");
        text.setAttribute("font-size", "15");
        text.setAttribute("font-family", "var(--es-font-sans)");
        text.setAttribute("fill", active ? activeInk(pc) : "var(--es-fg-muted)");
        text.setAttribute("pointer-events", "none");
        text.textContent = labelFor(pc);
        children.push(text);
      }

      if (state.root === pc) {
        const [mx, my] = polar(cx, cy, rInner - 12, (pc * TAU) / 12);
        const dot = document.createElementNS(SVG_NS, "circle");
        dot.setAttribute("cx", mx);
        dot.setAttribute("cy", my);
        dot.setAttribute("r", "5");
        dot.setAttribute("fill", "var(--es-fg)");
        dot.setAttribute("aria-label", `root ${labelFor(pc)}`);
        children.push(dot);
      }
    }
    svg.replaceChildren(...children);
  }

  function labelFor(pc) {
    if (state.names?.has(pc)) return state.names.get(pc);
    return state.labels === "pc" ? String(pc) : NOTE_NAMES[pc];
  }

  function activeInk(pc) {
    // Per-pc fills vary in lightness; keep the label readable by using
    // the theme ink (per-theme palette already guarantees ≥3:1 vs bg —
    // the label sits ON the segment, so pick by segment fill class).
    return state.colorByPc ? "var(--es-bg)" : "var(--es-accent-fg)";
  }

  render();

  return {
    update(next) {
      Object.assign(state, normalize(next));
      render();
    },
    get pcs() {
      return new Set(state.pcs);
    },
    get mask() {
      return pcsToMask(state.pcs);
    },
    destroy() {
      svg.remove();
    },
  };
}
