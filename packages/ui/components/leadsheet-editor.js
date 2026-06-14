/**
 * Leadsheet editor — the suite's shared progression editor (Track A UI
 * half; SUITE_AUDIT_AND_PLAN §7). Framework-agnostic: createLeadsheetEditor
 * (el, opts) → handle, matching the create*(el, opts) convention.
 *
 * Edits the theory `Leadsheet`/`Progression` directly: bars in a wrapping
 * grid, each holding editable chord chips. A chip shows its token as
 * authored (Roman degree or absolute symbol); when the realized spelling
 * differs (degree chords), it's shown dimmed beneath. Typing a token
 * re-parses it through theory, so both ProgGenie (degree-authored) and
 * MIDIcurator (absolute) drive the same editor.
 *
 * Visual style lives in components.css (.es-ls*); this module is behavior.
 */

import { formatLeadsheet, parseLeadsheet, realizeChord } from "@enkerli/theory";

const ROOTS = ["C", "G", "D", "A", "E", "B", "F♯", "C♯", "F", "B♭", "E♭", "A♭", "D♭", "G♭", "C♭"];

/** The token text for a chord — what the user sees and edits. */
function tokenOf(chord) {
  if (chord.inputText) return chord.inputText;
  if (chord.source === "degree" && chord.degree) {
    return chord.degree.numeral + chord.degree.suffix + (chord.symbol?.bass ? "/" + chord.symbol.bass : "");
  }
  const s = chord.symbol ?? { root: "", suffix: "" };
  return s.root + s.suffix + (s.bass ? "/" + s.bass : "");
}

/** Parse one typed token into a ProgChord (via the leadsheet grammar). */
function parseChordToken(text, key) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const prog = parseLeadsheet(trimmed, key);
  return prog.sections[0]?.bars[0]?.chords[0] ?? null;
}

/**
 * @param {Element} el host element (emptied)
 * @param {object} [opts]
 * @param {object} [opts.progression] a theory Progression (wins over text)
 * @param {string} [opts.text] bar notation to parse with `key`
 * @param {object} [opts.key] { tonic, mode } (default C major)
 * @param {boolean} [opts.showKey] render the key toolbar (default true)
 * @param {boolean} [opts.editable] (default true)
 * @param {(prog:object)=>void} [opts.onChange]
 */
export function createLeadsheetEditor(el, opts = {}) {
  const key = opts.key ?? opts.progression?.key ?? { tonic: "C", mode: "major" };
  const state = {
    prog: opts.progression ?? parseLeadsheet(opts.text ?? "", key),
    showKey: opts.showKey !== false,
    editable: opts.editable !== false,
    /** Flattened chord index to highlight (chord-follow); -1 = none. */
    activeIndex: opts.activeIndex ?? -1,
    onChange: opts.onChange ?? null,
  };
  if (!state.prog.sections.length) state.prog.sections = [{ bars: [] }];

  const root = document.createElement("div");
  root.className = "es-ls";
  el.replaceChildren(root);

  const bars = () => state.prog.sections[0].bars;
  const emit = () => state.onChange?.(state.prog);

  function commitToken(bi, ci, text) {
    const chord = parseChordToken(text, state.prog.key);
    const bar = bars()[bi];
    if (!bar) return;
    if (!chord) {
      bar.chords.splice(ci, 1); // empty → delete the chip
      if (bar.chords.length === 0) bars().splice(bi, 1); // empty bar → drop
    } else if (ci >= bar.chords.length) {
      bar.chords.push(chord);
    } else {
      bar.chords[ci] = chord;
    }
    render();
    emit();
  }

  function beginEdit(chipEl, bi, ci, initial) {
    const input = document.createElement("input");
    input.className = "es-ls-input";
    input.value = initial;
    input.setAttribute("aria-label", "Edit chord");
    chipEl.replaceWith(input);
    input.focus();
    input.select();
    let done = false;
    const finish = (commit) => {
      if (done) return;
      done = true;
      if (commit) commitToken(bi, ci, input.value);
      else render();
    };
    input.addEventListener("blur", () => finish(true));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); finish(true); }
      else if (e.key === "Escape") { e.preventDefault(); finish(false); }
    });
  }

  function chordChip(bi, ci, chord, flatIndex) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "es-ls-chord" + (flatIndex === state.activeIndex ? " active" : "");
    chip.dataset.bar = String(bi);
    chip.dataset.chord = String(ci);
    const token = tokenOf(chord);
    const realized = realizeChord(chord, state.prog.key).symbol;
    chip.append(Object.assign(document.createElement("span"), { textContent: token || "—" }));
    if (realized && realized !== token) {
      chip.append(Object.assign(document.createElement("span"), { className: "es-ls-real", textContent: realized }));
    }
    chip.title = realized;
    if (state.editable) {
      chip.addEventListener("click", () => beginEdit(chip, bi, ci, token));
    }
    return chip;
  }

  function render() {
    const children = [];
    if (state.showKey) {
      const bar = document.createElement("div");
      bar.className = "es-ls-toolbar";
      const sel = document.createElement("select");
      sel.className = "es-control";
      sel.setAttribute("aria-label", "Key");
      for (const r of ROOTS) {
        const o = document.createElement("option");
        o.value = r; o.textContent = r;
        if (r === state.prog.key.tonic) o.selected = true;
        sel.append(o);
      }
      sel.addEventListener("change", () => { state.prog.key.tonic = sel.value; render(); emit(); });
      const mode = document.createElement("button");
      mode.type = "button"; mode.className = "es-btn";
      mode.textContent = state.prog.key.mode;
      mode.addEventListener("click", () => {
        state.prog.key.mode = state.prog.key.mode === "major" ? "minor" : "major";
        render(); emit();
      });
      bar.append(Object.assign(document.createElement("span"), { className: "es-eyebrow", textContent: "key" }), sel, mode);
      children.push(bar);
    }

    const barsEl = document.createElement("div");
    barsEl.className = "es-ls-bars";
    let flat = 0;
    bars().forEach((b, bi) => {
      const cell = document.createElement("div");
      cell.className = "es-ls-bar";
      if (b.repeat) {
        cell.append(Object.assign(document.createElement("span"), { className: "es-ls-chord", textContent: "%" }));
        flat += 1;
      } else {
        b.chords.forEach((c, ci) => cell.append(chordChip(bi, ci, c, flat++)));
        if (state.editable) {
          const add = document.createElement("button");
          add.type = "button"; add.className = "es-ls-add";
          add.textContent = "+"; add.setAttribute("aria-label", "Add chord to bar");
          add.addEventListener("click", () => {
            const placeholder = document.createElement("button");
            placeholder.className = "es-ls-chord";
            add.replaceWith(placeholder);
            beginEdit(placeholder, bi, b.chords.length, "");
          });
          cell.append(add);
        }
      }
      barsEl.append(cell);
    });
    if (state.editable) {
      const addBar = document.createElement("button");
      addBar.type = "button"; addBar.className = "es-ls-add bar";
      addBar.textContent = "+ bar"; addBar.setAttribute("aria-label", "Add bar");
      addBar.addEventListener("click", () => {
        bars().push({ chords: [] });
        render();
        const placeholders = barsEl.querySelectorAll(".es-ls-bar");
        // focus a fresh edit chip in the new bar
        const fresh = document.createElement("button");
        fresh.className = "es-ls-chord";
        const lastCell = root.querySelectorAll(".es-ls-bar");
        const cell = lastCell[lastCell.length - 1];
        if (cell) { cell.prepend(fresh); beginEdit(fresh, bars().length - 1, 0, ""); }
        void placeholders;
      });
      barsEl.append(addBar);
    }
    children.push(barsEl);
    root.replaceChildren(...children);
  }

  render();

  return {
    /** The current Progression (live reference). */
    get value() { return state.prog; },
    /** Bar-notation text of the current progression. */
    getText() { return formatLeadsheet(state.prog); },
    update(next) {
      if (next.progression) state.prog = next.progression;
      else if (next.text !== undefined) state.prog = parseLeadsheet(next.text, next.key ?? state.prog.key);
      if (next.key) state.prog.key = next.key;
      if (next.editable !== undefined) state.editable = next.editable;
      if (next.activeIndex !== undefined) state.activeIndex = next.activeIndex;
      if (!state.prog.sections.length) state.prog.sections = [{ bars: [] }];
      render();
    },
    destroy() { root.remove(); },
  };
}
