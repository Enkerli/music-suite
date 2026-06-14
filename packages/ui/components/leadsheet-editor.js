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
 * @param {(ctx:{before:object|null,atEnd:boolean,key:object})=>Array<{label:string,symbol:string,notes?:number[],movement?:number,kind?:string}>} [opts.suggest]
 *        Optional next-chord suggester. When present, clicking a "+" opens a
 *        picker (type a token, or choose a voiceled suggestion); a chosen
 *        suggestion is inserted with its `notes` locked as the voicing.
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
    suggest: opts.suggest ?? null,
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

  /** The chord immediately before a new slot at the end of bar `bi`, in
   *  flattened order (skipping repeat bars) — the voice-leading anchor. */
  function chordBefore(bi) {
    let last = null;
    for (let i = 0; i <= bi && i < bars().length; i++) {
      const b = bars()[i];
      if (b.repeat || !b.chords.length) continue;
      last = b.chords[b.chords.length - 1];
    }
    return last;
  }

  /** Insert a fully-formed suggestion (token + locked voicing) at the end of
   *  bar `bi`. */
  function insertSuggestion(bi, sugg) {
    const chord = parseChordToken(sugg.label ?? sugg.symbol ?? "", state.prog.key);
    if (!chord) return;
    if (Array.isArray(sugg.notes) && sugg.notes.length) chord.voicing = [...sugg.notes];
    const bar = bars()[bi];
    if (!bar) return;
    bar.chords.push(chord);
    render();
    emit();
  }

  /** The "+" picker: type a chord, or choose a voiceled next-chord
   *  suggestion. Only used when opts.suggest is provided; otherwise "+"
   *  opens a bare inline input (openInlineAdd). */
  function openPicker(addEl, bi) {
    const before = chordBefore(bi);
    const atEnd = bi === bars().length - 1;
    const suggestions = state.suggest({ before, atEnd, key: state.prog.key }) ?? [];

    const pop = document.createElement("div");
    pop.className = "es-ls-suggest";

    const input = document.createElement("input");
    input.className = "es-ls-input";
    input.setAttribute("aria-label", "Type a chord");
    input.placeholder = "type a chord…";

    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      document.removeEventListener("mousedown", onDoc, true);
      render();
    };
    const onDoc = (e) => { if (!pop.contains(e.target)) close(); };

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); const v = input.value; close(); commitToken(bi, bars()[bi].chords.length, v); }
      else if (e.key === "Escape") { e.preventDefault(); close(); }
    });
    pop.append(input);

    if (suggestions.length) {
      const list = document.createElement("div");
      list.className = "es-ls-suggest-list";
      for (const s of suggestions) {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "es-ls-suggest-item" + (s.kind === "played" ? " played" : "");
        const name = Object.assign(document.createElement("span"), { className: "es-ls-suggest-sym", textContent: s.symbol ?? s.label });
        row.append(name);
        if (s.kind === "played") row.append(Object.assign(document.createElement("span"), { className: "es-badge", textContent: "played" }));
        else if (typeof s.movement === "number") row.append(Object.assign(document.createElement("span"), { className: "es-badge", textContent: `${s.movement} st` }));
        row.addEventListener("mousedown", (e) => { e.preventDefault(); close(); insertSuggestion(bi, s); });
        list.append(row);
      }
      pop.append(list);
    }

    addEl.replaceWith(pop);
    input.focus();
    setTimeout(() => document.addEventListener("mousedown", onDoc, true));
  }

  /** Bare inline add (no suggester): "+" becomes an empty chip to type into. */
  function openInlineAdd(addEl, bi, count) {
    const placeholder = document.createElement("button");
    placeholder.className = "es-ls-chord";
    addEl.replaceWith(placeholder);
    beginEdit(placeholder, bi, count, "");
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
            if (state.suggest) openPicker(add, bi);
            else openInlineAdd(add, bi, b.chords.length);
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
        const cells = root.querySelectorAll(".es-ls-bar");
        const cell = cells[cells.length - 1];
        if (!cell) return;
        if (state.suggest) {
          // open the picker on the new bar (first-chord → opener suggestions)
          const add = cell.querySelector(".es-ls-add");
          if (add) openPicker(add, bars().length - 1);
        } else {
          const fresh = document.createElement("button");
          fresh.className = "es-ls-chord";
          cell.prepend(fresh);
          beginEdit(fresh, bars().length - 1, 0, "");
        }
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
