/**
 * Pitch grid — hex (Exquis-style offset rows) or square (pad-style)
 * isomorphic note grid. Generalized from exquisite-fingerings'
 * GridRenderer; framework-agnostic SVG.
 *
 * createPitchGrid(el, opts) → handle. Cells are pitched by row/column
 * intervals from baseMidi (defaults give the Exquis thirds/fourths
 * layout for hex and a fourths "string" layout for square).
 */

const SVG_NS = "http://www.w3.org/2000/svg";
const NOTE_NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];

/** Cell centers + pitches for a layout (pure — unit cell size). */
export function layoutCells({ layout, rows, cols, baseMidi, rowStep, colStep }) {
  const cells = [];
  for (let row = 0; row < rows; row++) {
    const rowLen = layout === "hex" ? cols - (row % 2) : cols;
    for (let col = 0; col < rowLen; col++) {
      const x = layout === "hex" ? col + (row % 2) * 0.5 : col;
      const y = layout === "hex" ? row * 0.866 : row; // hex rows interlock
      const midi = baseMidi + (rows - 1 - row) * rowStep + col * colStep;
      cells.push({ row, col, x, y, midi, pc: ((midi % 12) + 12) % 12 });
    }
  }
  return cells;
}

function hexPoints(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    pts.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`);
  }
  return pts.join(" ");
}

/**
 * @param {Element} el host element (emptied)
 * @param {object} [opts]
 * @param {"hex"|"square"} [opts.layout]
 * @param {number} [opts.rows] @param {number} [opts.cols]
 * @param {number} [opts.baseMidi] bottom-left pitch
 * @param {number} [opts.rowStep] semitones per row up
 * @param {number} [opts.colStep] semitones per column right
 * @param {Iterable<number>} [opts.highlight] pitch classes to mark
 * @param {Iterable<number>} [opts.highlight2] second set (e.g. chord vs scale)
 * @param {"note"|"pc"|"midi"|"none"} [opts.labels]
 * @param {Map<number,string>} [opts.names] spelled names per pc
 * @param {number} [opts.cellSize] CSS px per cell
 * @param {(cell:{row,col,midi,pc})=>void} [opts.onTap]
 */
export function createPitchGrid(el, opts = {}) {
  const state = {
    layout: "hex",
    rows: 7,
    cols: 6,
    baseMidi: 48,
    rowStep: 5,
    colStep: 2,
    highlight: new Set(),
    highlight2: new Set(),
    labels: "note",
    names: null,
    cellSize: 44, // touch target
    onTap: null,
    ...opts,
  };
  state.highlight = new Set(state.highlight);
  state.highlight2 = new Set(state.highlight2);

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("role", "group");
  svg.setAttribute("aria-label", "Pitch grid");
  el.replaceChildren(svg);

  function render() {
    const cells = layoutCells(state);
    const unit = state.cellSize;
    const maxX = Math.max(...cells.map((c) => c.x)) + 1;
    const maxY = Math.max(...cells.map((c) => c.y)) + 1;
    svg.setAttribute("viewBox", `-${unit * 0.6} -${unit * 0.6} ${maxX * unit + unit * 1.2} ${maxY * unit + unit * 1.2}`);
    svg.style.width = `${maxX * unit}px`;

    const children = [];
    for (const cell of cells) {
      const cx = cell.x * unit + unit / 2;
      const cy = cell.y * unit + unit / 2;
      const on = state.highlight.has(cell.pc);
      const on2 = state.highlight2.has(cell.pc);

      const shape = state.layout === "hex"
        ? document.createElementNS(SVG_NS, "polygon")
        : document.createElementNS(SVG_NS, "rect");
      if (state.layout === "hex") {
        shape.setAttribute("points", hexPoints(cx, cy, unit * 0.55));
      } else {
        shape.setAttribute("x", cx - unit * 0.46);
        shape.setAttribute("y", cy - unit * 0.46);
        shape.setAttribute("width", unit * 0.92);
        shape.setAttribute("height", unit * 0.92);
        shape.setAttribute("rx", unit * 0.18);
      }
      shape.setAttribute("fill", on ? "var(--es-dim-breath)" : on2 ? "var(--es-dim-pressure)" : "var(--es-bg-raised)");
      shape.setAttribute("stroke", on || on2 ? "var(--es-border-strong)" : "var(--es-border)");
      shape.setAttribute("stroke-width", "1");
      shape.dataset.midi = String(cell.midi);
      if (state.onTap) {
        shape.setAttribute("role", "button");
        shape.setAttribute("tabindex", "0");
        shape.style.cursor = "pointer";
        shape.addEventListener("click", () => state.onTap(cell));
        shape.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            state.onTap(cell);
          }
        });
      }
      children.push(shape);

      if (state.labels !== "none") {
        const text = document.createElementNS(SVG_NS, "text");
        text.setAttribute("x", cx);
        text.setAttribute("y", cy);
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("dominant-baseline", "central");
        text.setAttribute("font-size", String(unit * 0.32));
        text.setAttribute("font-family", "var(--es-font-sans)");
        text.setAttribute("fill", on || on2 ? "var(--es-accent-fg)" : "var(--es-fg-2)");
        text.setAttribute("pointer-events", "none");
        text.textContent = labelFor(cell);
        children.push(text);
      }
    }
    svg.replaceChildren(...children);
  }

  function labelFor(cell) {
    if (state.labels === "midi") return String(cell.midi);
    if (state.names?.has(cell.pc)) return state.names.get(cell.pc);
    return state.labels === "pc" ? String(cell.pc) : NOTE_NAMES[cell.pc];
  }

  render();

  return {
    update(next) {
      Object.assign(state, next);
      if (next.highlight !== undefined) state.highlight = new Set(next.highlight);
      if (next.highlight2 !== undefined) state.highlight2 = new Set(next.highlight2);
      render();
    },
    destroy() {
      svg.remove();
    },
  };
}
