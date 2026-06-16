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
 * Multi-section (design decision Q2): the progression is a list of sections,
 * each with an optional `key`. A section realizes and spells its chords
 * against its own key, so a modulation reads in the new key's degrees
 * (IIm7 V7 Imaj7 in G, not home-frame VIm7 II7 V7). Sections show a header
 * (badge · name · key control) and a quiet "→ G major" divider on the seam;
 * a single unnamed section renders headerless, as before. Chords are
 * addressed (si, bi, ci) — section, bar, chord.
 *
 * Visual style lives in components.css (.es-ls*); this module is behavior.
 */

import { assertDegree, consonance, formatLeadsheet, parseLeadsheet, realizeChord } from "@enkerli/theory";

const ROOTS = ["C", "G", "D", "A", "E", "B", "F♯", "C♯", "F", "B♭", "E♭", "A♭", "D♭", "G♭", "C♭"];
const SECTION_BADGES = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

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

const keyLabel = (k) => `${k.tonic} ${k.mode}`;

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
 * @param {boolean} [opts.showKey] render the key toolbar for a single section (default true)
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
    /** Active tool: "edit" (default) | "rate-up" | "rate-down". Structural
     *  editing (insert/move/delete/duration) is direct manipulation inside
     *  Edit — carets, a grip, and a chord inspector — so it needs no mode. */
    tool: opts.tool ?? "edit",
    suggest: opts.suggest ?? null,
    /** Optional "why this chord" text for the inspector (rationale to come). */
    rationaleOf: opts.rationaleOf ?? null,
    /** Optional "chord-scale" text for the inspector (scale + avoid notes). */
    scaleOf: opts.scaleOf ?? null,
    /** Selected chord (opens the inspector): { si, bi, ci, flat } | null. */
    selected: null,
    /** Chord picked up for a move (grip): { si, bi, ci } | null — carets
     *  become drop targets. */
    moving: null,
  };
  if (!state.prog.sections.length) state.prog.sections = [{ bars: [] }];

  const root = document.createElement("div");
  root.className = "es-ls";
  el.replaceChildren(root);

  // ── section / addressing helpers ──────────────────────────────────────
  const sections = () => state.prog.sections;
  const barsOf = (si) => sections()[si].bars;
  /** The key a section realizes against — its own, else the progression's. */
  const keyOf = (si) => sections()[si]?.key ?? state.prog.key;
  const emit = () => state.onChange?.(state.prog);

  function commitToken(si, bi, ci, text) {
    const chord = parseChordToken(text, keyOf(si));
    const bar = barsOf(si)[bi];
    if (!bar) return;
    if (!chord) {
      bar.chords.splice(ci, 1); // empty → delete the chip
      if (bar.chords.length === 0) barsOf(si).splice(bi, 1); // empty bar → drop
    } else if (ci >= bar.chords.length) {
      bar.chords.push(chord);
    } else {
      bar.chords[ci] = chord;
    }
    render();
    emit();
  }

  /** The chord just before insertion position (si, bi, ci) — for the picker's
   *  voice-leading context: the chord before ci in the bar, else the last
   *  chord of an earlier bar, else of an earlier section. */
  function chordBeforeAt(si, bi, ci) {
    if (ci > 0) return barsOf(si)[bi].chords[ci - 1];
    for (let s = si; s >= 0; s--) {
      const bars = barsOf(s);
      const from = s === si ? bi - 1 : bars.length - 1;
      for (let i = from; i >= 0; i--) {
        const b = bars[i];
        if (!b.repeat && b.chords.length) return b.chords[b.chords.length - 1];
      }
    }
    return null;
  }

  /** Splice a fully-formed suggestion (token + locked voicing) into (si, bi)
   *  at index `ci` (ci ≥ length appends). */
  function insertSuggestion(si, bi, ci, sugg) {
    const chord = parseChordToken(sugg.label ?? sugg.symbol ?? "", keyOf(si));
    if (!chord) return;
    if (Array.isArray(sugg.notes) && sugg.notes.length) chord.voicing = [...sugg.notes];
    const bar = barsOf(si)[bi];
    if (!bar) return;
    bar.chords.splice(Math.min(ci, bar.chords.length), 0, chord);
    render();
    emit();
  }

  /** Splice a typed token into (si, bi) at index `ci` (empty → cancel). */
  function insertToken(si, bi, ci, text) {
    const chord = parseChordToken(text, keyOf(si));
    const bar = barsOf(si)[bi];
    if (!chord || !bar) return;
    bar.chords.splice(Math.min(ci, bar.chords.length), 0, chord);
    render();
    emit();
  }

  /** The picker: type a chord, or choose a voiceled suggestion, inserting at
   *  (si, bi, ci). Used for the append "+" (ci = end, atEnd true) and for the
   *  between-chord carets (splicing before a chord). */
  function openPicker(anchorEl, si, bi, ci, atEnd) {
    const before = chordBeforeAt(si, bi, ci);
    const suggestions = state.suggest({ before, atEnd, key: keyOf(si) }) ?? [];

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
      if (e.key === "Enter") { e.preventDefault(); const v = input.value; close(); insertToken(si, bi, ci, v); }
      else if (e.key === "Escape") { e.preventDefault(); close(); }
    });
    pop.append(input);

    if (suggestions.length) {
      const list = document.createElement("div");
      list.className = "es-ls-suggest-list";
      const mkRow = (s) => {
        const r = document.createElement("button");
        r.type = "button";
        r.className = "es-ls-suggest-item" + (s.kind === "played" ? " played" : "");
        r.append(Object.assign(document.createElement("span"), { className: "es-ls-suggest-sym", textContent: s.symbol ?? s.label }));
        if (s.kind === "played") r.append(Object.assign(document.createElement("span"), { className: "es-badge", textContent: "played" }));
        else if (typeof s.movement === "number") r.append(Object.assign(document.createElement("span"), { className: "es-badge", textContent: `${s.movement} st` }));
        r.addEventListener("mousedown", (e) => { e.preventDefault(); close(); insertSuggestion(si, bi, ci, s); });
        return r;
      };
      // Autocomplete: filter the suggestions by what's typed (accent- and
      // case-insensitive over both the symbol and the degree label).
      const norm = (t) => (t ?? "").toLowerCase().replace(/♭/g, "b").replace(/♯/g, "#").replace(/\s+/g, "");
      const renderList = (filter) => {
        const f = norm(filter);
        const shown = f ? suggestions.filter((s) => norm(s.symbol).includes(f) || norm(s.label).includes(f)) : suggestions;
        list.replaceChildren(...shown.map(mkRow));
        list.style.display = shown.length ? "" : "none";
      };
      renderList("");
      input.addEventListener("input", () => renderList(input.value));
      pop.append(list);
    }

    anchorEl.replaceWith(pop);
    input.focus();
    setTimeout(() => document.addEventListener("mousedown", onDoc, true));
  }

  /** Bare inline add (no suggester): "+" becomes an empty chip to type into. */
  function openInlineAdd(addEl, si, bi, count) {
    const placeholder = document.createElement("button");
    placeholder.className = "es-ls-chord";
    addEl.replaceWith(placeholder);
    beginEdit(placeholder, si, bi, count, "");
  }

  function beginEdit(chipEl, si, bi, ci, initial) {
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
      if (commit) commitToken(si, bi, ci, input.value);
      else render();
    };
    input.addEventListener("blur", () => finish(true));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); finish(true); }
      else if (e.key === "Escape") { e.preventDefault(); finish(false); }
    });
  }

  // ── small DOM builders (inspector) ────────────────────────────────────
  const SHARP = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
  const midiName = (m) => SHARP[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
  const span = (text, cls) => { const s = document.createElement("span"); if (cls) s.className = cls; s.textContent = text; return s; };
  const label = (text) => span(text, "es-ls-insp-label");
  const irow = () => { const d = document.createElement("div"); d.className = "es-ls-insp-row"; return d; };
  function btn(text, onClick, title) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "es-btn es-small"; b.textContent = text;
    if (title) b.title = title;
    b.addEventListener("click", onClick);
    return b;
  }

  // ── structural edits — direct manipulation, no modes ──────────────────

  /** Remove the chord at (si, bi, ci); drop the bar if it empties; a now-
   *  leading repeat bar can't repeat nothing, so shed it. */
  function deleteChord(si, bi, ci) {
    const bars = barsOf(si);
    const bar = bars[bi];
    if (!bar) return;
    bar.chords.splice(ci, 1);
    if (bar.chords.length === 0) bars.splice(bi, 1);
    while (bars[0]?.repeat) bars.shift();
    render(); emit();
  }

  /** A whole-bar chord holds `n` bars: set the trailing `%` repeat bars. */
  function setHeldBars(si, bi, n) {
    const arr = barsOf(si);
    while (arr[bi + 1]?.repeat) arr.splice(bi + 1, 1); // clear existing holds
    for (let k = 1; k < n; k++) arr.splice(bi + k, 0, { chords: [], repeat: true });
    render(); emit();
  }

  /** Pull the chord at (si, bi, ci) into its own whole bar (its bar-mates
   *  split off), so its duration becomes a full bar. */
  function makeWholeBar(si, bi, ci) {
    const arr = barsOf(si);
    const bar = arr[bi];
    if (!bar || bar.chords.length <= 1) return;
    const before = bar.chords.slice(0, ci);
    const after = bar.chords.slice(ci + 1);
    const repl = [];
    if (before.length) repl.push({ chords: before });
    repl.push({ chords: [bar.chords[ci]] });
    if (after.length) repl.push({ chords: after });
    arr.splice(bi, 1, ...repl);
    render(); emit();
  }

  /** Move the chord at `from` to the caret slot `to` (both {si,bi,ci}). The
   *  moved chord adopts the destination section's key for spelling. */
  function moveChord(from, to) {
    const srcBars = barsOf(from.si);
    const srcBar = srcBars[from.bi];
    const chord = srcBar?.chords[from.ci];
    if (!chord) return;
    srcBar.chords.splice(from.ci, 1);
    let { si, bi, ci } = to;
    if (si === from.si && bi === from.bi && ci > from.ci) ci -= 1; // target shifted left
    if (srcBar.chords.length === 0) {                              // source bar emptied
      const srcIdx = srcBars.indexOf(srcBar);
      srcBars.splice(srcIdx, 1);
      if (si === from.si && srcIdx < bi) bi -= 1;
    }
    const dstBars = barsOf(si);
    const dst = dstBars[bi];
    if (dst && !dst.repeat) dst.chords.splice(Math.min(ci, dst.chords.length), 0, chord);
    else dstBars.splice(Math.max(0, bi), 0, { chords: [chord] });
    while (dstBars[0]?.repeat) dstBars.shift();
    render(); emit();
  }

  /** A caret: the slot between chords that *is* the insertion point. In a
   *  move it's a drop target; otherwise it opens the picker at (si, bi, ci). */
  function caret(si, bi, ci, atEnd) {
    const c = document.createElement("button");
    c.type = "button";
    c.className = "es-ls-caret" + (state.moving ? " drop" : "");
    c.textContent = state.moving ? "▾" : "+";
    c.setAttribute("aria-label", state.moving ? "Move here" : "Insert a chord here");
    c.addEventListener("click", () => {
      if (state.moving) { const m = state.moving; state.moving = null; moveChord(m, { si, bi, ci }); }
      else if (state.suggest) openPicker(c, si, bi, ci, atEnd);
      else openInlineAdd(c, si, bi, ci);
    });
    return c;
  }

  /** The chord inspector — everything the cell defers: retype, consonance,
   *  duration, voicing, rating, why, move, delete. Opens on tap (Edit). */
  function inspectorPanel(sel) {
    const { si, bi, ci, flat } = sel;
    const bar = barsOf(si)?.[bi];
    const chord = bar?.chords[ci];
    if (!chord) return null;
    const realized = realizeChord(chord, keyOf(si));
    const panel = document.createElement("div");
    panel.className = "es-ls-inspector";

    const head = irow(); head.className = "es-ls-insp-head";
    head.append(span(realized.symbol, "es-ls-insp-title"));
    const x = btn("✕", () => { state.selected = null; render(); }, "Close"); x.classList.add("es-ls-insp-close");
    head.append(x);
    panel.append(head);

    const nameRow = irow();
    const input = document.createElement("input");
    input.className = "es-ls-input"; input.value = tokenOf(chord); input.setAttribute("aria-label", "Chord");
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); state.selected = null; commitToken(si, bi, ci, input.value); }
      else if (e.key === "Escape") { e.preventDefault(); state.selected = null; render(); }
    });
    nameRow.append(label("Chord"), input);
    panel.append(nameRow);

    if (realized.pcs.length >= 2) {
      const cval = consonance(realized.pcs);
      const r = irow();
      const dot = document.createElement("span"); dot.className = "es-ls-consonance";
      dot.style.background = `hsl(48, 85%, ${Math.round(22 + cval * 56)}%)`;
      r.append(label("Consonance"), dot, span(`${Math.round(cval * 100)}%`, "es-ls-insp-val"));
      panel.append(r);
    }

    const durRow = irow();
    if (bar.chords.length === 1) {
      let held = 1; while (barsOf(si)[bi + held]?.repeat) held++;
      const stepper = document.createElement("div"); stepper.className = "es-ls-insp-stepper";
      for (const n of [1, 2, 3, 4]) {
        const b = btn(n === 1 ? "1 bar" : `${n} bars`, () => setHeldBars(si, bi, n));
        if (n === held) b.classList.add("on");
        stepper.append(b);
      }
      durRow.append(label("Duration"), stepper);
    } else {
      durRow.append(label("Duration"), span(`shares the bar (${bar.chords.length})`, "es-ls-insp-val"), btn("Make whole bar", () => makeWholeBar(si, bi, ci)));
    }
    panel.append(durRow);

    const vRow = irow();
    if (chord.voicing?.length) {
      vRow.append(label("Voicing"), span(chord.voicing.map(midiName).join(" "), "es-ls-insp-val mono"),
        btn("Unlock", () => { delete chord.voicing; render(); emit(); }, "Auto-voice this chord"));
    } else {
      vRow.append(label("Voicing"), span("auto", "es-ls-insp-val"));
    }
    panel.append(vRow);

    if (state.onRate && flat > 0) {
      const m = state.ratingOf ? state.ratingOf(flat) : 1;
      const r = irow();
      const up = btn("👍", () => { state.onRate(flat, 1); render(); }, "Reinforce the move into this chord");
      const dn = btn("👎", () => { state.onRate(flat, -1); render(); }, "Weaken the move into this chord");
      if (m > 1.001) up.classList.add("on"); else if (m < 0.999) dn.classList.add("on");
      r.append(label("This move"), up, dn);
      panel.append(r);
    }

    const scaleText = state.scaleOf?.(flat);
    if (scaleText) { const r = irow(); r.append(label("Scale"), span(scaleText, "es-ls-insp-val")); panel.append(r); }

    const why = state.rationaleOf?.(flat);
    if (why) { const r = irow(); r.append(label("Why"), span(why, "es-ls-insp-val")); panel.append(r); }

    const actions = document.createElement("div"); actions.className = "es-ls-insp-actions";
    actions.append(
      btn("⠿ Move", () => { state.moving = { si, bi, ci }; state.selected = null; render(); }, "Pick up to move — then tap a caret"),
      Object.assign(btn("Delete", () => { state.selected = null; deleteChord(si, bi, ci); }, "Delete this chord"), { className: "es-btn es-small es-ls-insp-del" }),
    );
    panel.append(actions);
    return panel;
  }

  function chordChip(si, bi, ci, chord, flatIndex) {
    const k = keyOf(si);
    const sel = state.selected;
    const mv = state.moving;
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "es-ls-chord" + (flatIndex === state.activeIndex ? " active" : "")
      + (sel && sel.si === si && sel.bi === bi && sel.ci === ci ? " selected" : "")
      + (mv && mv.si === si && mv.bi === bi && mv.ci === ci ? " moving" : "");
    chip.dataset.section = String(si);
    chip.dataset.bar = String(bi);
    chip.dataset.chord = String(ci);
    const token = tokenOf(chord);
    const realized = realizeChord(chord, k);
    // Functional reading on top, named spelling below. A degree chord is
    // authored functionally (token = IIm7), so its named spelling (Dm7, in
    // this section's key) sits below; an absolute chord (D7) leads with its
    // degree (II7) and shows the name below. Editing operates on `token`.
    let primary = token;
    let secondary = "";
    if (chord.source === "degree" && chord.degree) {
      secondary = realized.symbol;
    } else {
      const fn = functionalOf(chord, k);
      if (fn) { primary = fn; secondary = token; }
    }
    chip.append(Object.assign(document.createElement("span"), { className: "es-ls-name", textContent: primary || "—" }));
    // Second line carries only the other reading — consonance, voicing,
    // duration, rating, and rationale all live in the inspector now, so the
    // cell stays glanceable (two readings + one state tint).
    if (secondary && secondary !== primary) {
      const sub = document.createElement("span"); sub.className = "es-ls-sub";
      sub.append(Object.assign(document.createElement("span"), { className: "es-ls-real", textContent: secondary }));
      chip.append(sub);
    }
    // Grip: in Edit, tap to pick the chord up for a move (carets become drops).
    if (state.editable && state.tool === "edit") {
      const grip = document.createElement("span");
      grip.className = "es-ls-grip"; grip.textContent = "⠿"; grip.title = "Move this chord";
      grip.addEventListener("click", (e) => { e.stopPropagation(); state.moving = { si, bi, ci }; state.selected = null; render(); });
      chip.append(grip);
    }
    chip.title = realized.symbol;
    // Subtle rating tint: the move into a boosted chord reads warm, cool if cut.
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
        else if (state.moving) { const m = state.moving; state.moving = null; moveChord(m, { si, bi, ci }); } // tap a chord = drop before it
        else { state.selected = { si, bi, ci, flat: flatIndex }; render(); } // open the inspector
      });
    }
    return chip;
  }

  /** A section's header — badge · name · key control. The key control edits
   *  the section's own key (section 0 edits the progression key, so a single
   *  section behaves as before). */
  function sectionHeader(si) {
    const section = sections()[si];
    const head = document.createElement("div");
    head.className = "es-ls-secthead";
    head.append(Object.assign(document.createElement("span"), { className: "es-ls-sectbadge", textContent: SECTION_BADGES[si] ?? String(si + 1) }));
    if (section.label) head.append(span(section.label, "es-ls-sectname"));

    const k = keyOf(si);
    const setKey = (next) => {
      if (si === 0 && !section.key) state.prog.key = next; // section 0 owns the progression key
      else section.key = next;
      render(); emit();
    };
    if (state.editable) {
      const sel = document.createElement("select");
      sel.className = "es-control es-ls-sectkey";
      sel.setAttribute("aria-label", `Section ${SECTION_BADGES[si] ?? si + 1} key`);
      for (const r of ROOTS) {
        const o = document.createElement("option");
        o.value = r; o.textContent = r;
        if (r === k.tonic) o.selected = true;
        sel.append(o);
      }
      sel.addEventListener("change", () => setKey({ tonic: sel.value, mode: k.mode }));
      const mode = btn(k.mode, () => setKey({ tonic: k.tonic, mode: k.mode === "major" ? "minor" : "major" }), "Toggle major/minor");
      head.append(sel, mode);
    } else {
      head.append(span(keyLabel(k), "es-ls-sectkey-label"));
    }
    return head;
  }

  /** The bars of one section as a grid; carets in Edit. Returns the grid el
   *  and advances the shared flat counter via `next`. */
  function sectionBars(si, flatStart) {
    const editing = state.editable && state.tool === "edit";
    const bars = barsOf(si);
    const barsEl = document.createElement("div");
    barsEl.className = "es-ls-bars" + (state.moving ? " moving" : "");
    let flat = flatStart;
    let lastChordBar = -1;
    bars.forEach((b, i) => { if (!b.repeat) lastChordBar = i; });
    bars.forEach((b, bi) => {
      const cell = document.createElement("div");
      cell.className = "es-ls-bar";
      if (b.repeat) {
        const rep = Object.assign(document.createElement("span"), { className: "es-ls-chord es-ls-repeat", textContent: "%" });
        rep.title = "held — same chord as the previous bar";
        cell.append(rep);
        flat += 1;
      } else {
        b.chords.forEach((c, ci) => {
          if (editing) cell.append(caret(si, bi, ci, false));
          cell.append(chordChip(si, bi, ci, c, flat++));
        });
        cell.style.gridColumn = `span ${Math.max(1, b.chords.length)}`;
      }
      barsEl.append(cell);
    });
    if (editing) {
      // Trailing caret = append at the end of this section (start a bar if empty).
      const tail = document.createElement("button");
      tail.type = "button"; tail.className = "es-ls-caret trail" + (state.moving ? " drop" : "");
      tail.textContent = state.moving ? "▾" : "+";
      tail.setAttribute("aria-label", state.moving ? "Move to the end" : "Add a chord");
      tail.addEventListener("click", () => {
        let bi = lastChordBar;
        if (bi < 0) { bars.push({ chords: [] }); bi = bars.length - 1; }
        const ci = bars[bi].chords.length;
        if (state.moving) { const m = state.moving; state.moving = null; moveChord(m, { si, bi, ci }); }
        else if (state.suggest) openPicker(tail, si, bi, ci, true);
        else openInlineAdd(tail, si, bi, ci);
      });
      barsEl.append(tail);

      const addBar = document.createElement("button");
      addBar.type = "button"; addBar.className = "es-ls-add bar";
      addBar.textContent = "+ bar"; addBar.setAttribute("aria-label", "Add bar");
      addBar.addEventListener("click", () => {
        bars.push({ chords: [] });
        render();
        const fresh = root.querySelectorAll(".es-ls-section")[si]?.querySelector(".es-ls-caret.trail");
        if (!fresh) return;
        if (state.suggest) openPicker(fresh, si, bars.length - 1, 0, true);
        else openInlineAdd(fresh, si, bars.length - 1, 0);
      });
      barsEl.append(addBar);
    }
    return { barsEl, flatEnd: flat };
  }

  function render() {
    root.className = "es-ls" + (state.tool && state.tool !== "edit" ? ` tool-${state.tool}` : "");
    const children = [];
    const multi = sections().length > 1;

    // Single-section legacy key toolbar (showKey) — multi-section uses per-
    // section headers instead.
    if (state.showKey && !multi) {
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

    let flat = 0;
    let prevKey = null;
    sections().forEach((section, si) => {
      const k = keyOf(si);
      // Quiet key-change divider on the seam (only when the key actually moved).
      if (si > 0 && prevKey && keyLabel(k) !== keyLabel(prevKey)) {
        const div = document.createElement("div");
        div.className = "es-ls-kchange";
        div.append(
          Object.assign(document.createElement("span"), { className: "es-ls-kchange-ln" }),
          span(`→ ${keyLabel(k)}`, "es-ls-kchange-pill"),
          Object.assign(document.createElement("span"), { className: "es-ls-kchange-ln" }),
        );
        children.push(div);
      }
      const sectEl = document.createElement("div");
      sectEl.className = "es-ls-section";
      // The formal badge header is for named form (verse / bridge) or an
      // explicit key editor (showKey). An auto-generated modulation has no
      // name, so it reads quietly: just the "→ G major" seam divider and its
      // re-spelled labels — the lighter treatment for an implied key change.
      if (multi && (section.label != null || state.showKey)) sectEl.append(sectionHeader(si));
      const { barsEl, flatEnd } = sectionBars(si, flat);
      flat = flatEnd;
      sectEl.append(barsEl);
      children.push(sectEl);
      prevKey = k;
    });

    if (state.moving) {
      const mvBar = document.createElement("div");
      mvBar.className = "es-ls-movebar";
      mvBar.append(span("Moving a chord — tap a caret to drop it", "es-ls-move-hint"),
        btn("Cancel", () => { state.moving = null; render(); }));
      children.push(mvBar);
    }
    if (state.selected) {
      const insp = inspectorPanel(state.selected);
      if (insp) children.push(insp); else state.selected = null;
    }
    root.replaceChildren(...children);
  }

  render();

  return {
    /** The current Progression (live reference). */
    get value() { return state.prog; },
    /** Bar-notation text of the current progression. */
    getText() { return formatLeadsheet(state.prog); },
    update(next) {
      if (next.progression || next.text !== undefined) { state.selected = null; state.moving = null; }
      if (next.progression) state.prog = next.progression;
      else if (next.text !== undefined) state.prog = parseLeadsheet(next.text, next.key ?? state.prog.key);
      if (next.key) state.prog.key = next.key;
      if (next.editable !== undefined) state.editable = next.editable;
      if (next.activeIndex !== undefined) state.activeIndex = next.activeIndex;
      if (next.tool !== undefined) { state.tool = next.tool; state.selected = null; state.moving = null; }
      if (!state.prog.sections.length) state.prog.sections = [{ bars: [] }];
      render();
    },
    /** Re-render in place (e.g. after ratings change, to re-reflect 👍/👎). */
    refresh() { render(); },
    destroy() { root.remove(); },
  };
}
