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

import { assertDegree, consonance, formatLeadsheet, parseLeadsheet, realizeChord } from "@enkerli/theory";

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

/**
 * Functional degree label for an absolute chord in the key (D7 in C → "II7");
 * "" when the root has no reading. Degree chords are already functional, so
 * this only applies to absolute ones.
 */
function functionalOf(chord, key) {
  const s = chord.symbol;
  if (!s?.root) return "";
  try {
    return assertDegree(s.root, key).numeral + (s.suffix ?? "") + (s.bass ? "/" + s.bass : "");
  } catch {
    return ""; // unparseable root — no functional reading
  }
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
 * @param {(flatIndex:number,dir:1|-1)=>void} [opts.onRate]
 *        Optional per-chord rating. When present, each chord (after the first)
 *        shows 👍/👎 — rating the transition into it. The first chord has no
 *        incoming transition, so it has no rating controls.
 * @param {(flatIndex:number)=>number} [opts.ratingOf]
 *        Current rating multiplier for the transition into a chord (>1 up,
 *        <1 down, 1 neutral) — drives the 👍/👎 highlight. Call refresh()
 *        after ratings change externally to re-reflect.
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
    onRate: opts.onRate ?? null,
    ratingOf: opts.ratingOf ?? null,
    /** Active tool: "edit" (default) | "rate-up" | "rate-down". A tap applies
     *  the tool, so cells stay uncluttered (no per-chip buttons). */
    tool: opts.tool ?? "edit",
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
      const row = (s) => {
        const r = document.createElement("button");
        r.type = "button";
        r.className = "es-ls-suggest-item" + (s.kind === "played" ? " played" : "");
        r.append(Object.assign(document.createElement("span"), { className: "es-ls-suggest-sym", textContent: s.symbol ?? s.label }));
        if (s.kind === "played") r.append(Object.assign(document.createElement("span"), { className: "es-badge", textContent: "played" }));
        else if (typeof s.movement === "number") r.append(Object.assign(document.createElement("span"), { className: "es-badge", textContent: `${s.movement} st` }));
        r.addEventListener("mousedown", (e) => { e.preventDefault(); close(); insertSuggestion(bi, s); });
        return r;
      };
      // Autocomplete: filter the suggestions by what's typed (accent- and
      // case-insensitive over both the symbol and the degree label).
      const norm = (t) => (t ?? "").toLowerCase().replace(/♭/g, "b").replace(/♯/g, "#").replace(/\s+/g, "");
      const renderList = (filter) => {
        const f = norm(filter);
        const shown = f ? suggestions.filter((s) => norm(s.symbol).includes(f) || norm(s.label).includes(f)) : suggestions;
        list.replaceChildren(...shown.map(row));
        list.style.display = shown.length ? "" : "none";
      };
      renderList("");
      input.addEventListener("input", () => renderList(input.value));
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
    const realized = realizeChord(chord, state.prog.key);
    // Functional reading on top, named spelling below. A degree chord is
    // authored functionally (token = IIm7), so its named spelling (Dm7) sits
    // below; an absolute chord (D7) leads with its degree (II7) and shows the
    // name below. Editing always operates on the authored `token`.
    let primary = token;
    let secondary = "";
    if (chord.source === "degree" && chord.degree) {
      secondary = realized.symbol;
    } else {
      const fn = functionalOf(chord, state.prog.key);
      if (fn) { primary = fn; secondary = token; }
    }
    chip.append(Object.assign(document.createElement("span"), { className: "es-ls-name", textContent: primary || "—" }));
    // Second line: the other reading + a small inline consonance dot
    // (dark = dissonant, bright = consonant). Inline so it never overlaps the
    // barline or the neighbouring chord the way an absolute badge did.
    const sub = document.createElement("span");
    sub.className = "es-ls-sub";
    if (secondary && secondary !== primary) {
      sub.append(Object.assign(document.createElement("span"), { className: "es-ls-real", textContent: secondary }));
    }
    if (realized.pcs.length >= 2) {
      const c = consonance(realized.pcs);
      const dot = document.createElement("span");
      dot.className = "es-ls-consonance";
      dot.style.background = `hsl(48, 85%, ${Math.round(22 + c * 56)}%)`;
      dot.title = `consonance ${(c * 100).toFixed(0)}%`;
      sub.append(dot);
    }
    if (sub.childNodes.length) chip.append(sub);
    chip.title = realized.symbol;
    // Subtle rating tint (no buttons — the toolbar's active tool does the
    // rating; cells are dense enough): the move into a boosted chord reads
    // warm, a suppressed one cool.
    if (state.ratingOf && flatIndex > 0) {
      const m = state.ratingOf(flatIndex);
      if (m > 1.001) chip.classList.add("rated-up");
      else if (m < 0.999) chip.classList.add("rated-down");
    }
    if (state.editable) {
      chip.addEventListener("click", () => {
        const tool = state.tool ?? "edit";
        if (tool === "rate-up") state.onRate?.(flatIndex, 1);
        else if (tool === "rate-down") state.onRate?.(flatIndex, -1);
        else beginEdit(chip, bi, ci, token);
      });
    }
    return chip;
  }

  function render() {
    root.className = "es-ls" + (state.tool && state.tool !== "edit" ? ` tool-${state.tool}` : "");
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
    // Index of the last chord-bar — the standalone "+" appends there.
    let lastChordBar = -1;
    bars().forEach((b, i) => { if (!b.repeat) lastChordBar = i; });
    bars().forEach((b, bi) => {
      const cell = document.createElement("div");
      cell.className = "es-ls-bar";
      if (b.repeat) {
        // A held chord — repeat sign, one bar wide (keeps the barline).
        const rep = Object.assign(document.createElement("span"), { className: "es-ls-chord es-ls-repeat", textContent: "%" });
        rep.title = "held — same chord as the previous bar";
        cell.append(rep);
        flat += 1;
      } else {
        b.chords.forEach((c, ci) => cell.append(chordChip(bi, ci, c, flat++)));
        // Each chord wants ~one column; the bar spans that many columns so
        // cells stay legible and bars align vertically (spreadsheet style).
        cell.style.gridColumn = `span ${Math.max(1, b.chords.length)}`;
      }
      barsEl.append(cell);
    });
    if (state.editable && state.tool === "edit") {
      // Standalone append "+": add a chord after the last bar (one append
      // point, its own grid cell — bars stay clean).
      const add = document.createElement("button");
      add.type = "button"; add.className = "es-ls-add";
      add.textContent = "+"; add.setAttribute("aria-label", "Add a chord");
      add.addEventListener("click", () => {
        let bi = lastChordBar;
        if (bi < 0) { bars().push({ chords: [] }); bi = bars().length - 1; }
        if (state.suggest) openPicker(add, bi);
        else openInlineAdd(add, bi, bars()[bi].chords.length);
      });
      barsEl.append(add);

      const addBar = document.createElement("button");
      addBar.type = "button"; addBar.className = "es-ls-add bar";
      addBar.textContent = "+ bar"; addBar.setAttribute("aria-label", "Add bar");
      addBar.addEventListener("click", () => {
        bars().push({ chords: [] });
        render();
        const fresh = root.querySelector(".es-ls-add:not(.bar)");
        if (!fresh) return;
        if (state.suggest) openPicker(fresh, bars().length - 1);
        else openInlineAdd(fresh, bars().length - 1, 0);
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
      if (next.tool !== undefined) state.tool = next.tool;
      if (!state.prog.sections.length) state.prog.sections = [{ bars: [] }];
      render();
    },
    /** Re-render in place (e.g. after ratings change, to re-reflect 👍/👎). */
    refresh() { render(); },
    destroy() { root.remove(); },
  };
}
