/**
 * LibraryBrowser — the suite's ONE library-browser pattern (Design pass · Q2).
 * Config-driven so every app instantiates the same component with its own
 * facet config + item stream: ProgGenie documents, Vane presets, MIDIcurator
 * clips, Serpe scenes are the SAME screen with different facets. Ported from
 * the convergence prototype (browser.jsx) to a framework-agnostic factory,
 * matching pcs-ring / pitch-grid.
 *
 *   createLibraryBrowser(el, { items, facets, ... }) → handle
 *
 * Anatomy: facet rail · search + autocomplete · active-facet chips · sort ·
 * front doors · list rows · row actions · suggestions · empty states. It
 * scales by COUNT — below `facetMin` items the rail hides and a suggestions
 * rail carries a first-run library; above it, facets and search earn their keep.
 *
 * Facet config (mirrors @enkerli/library's query layer):
 *   { key, label, kind: 'multi' | 'min' | 'bool',
 *     accessor(item) -> value | value[],   // 'min' reads the rating key
 *     values?: (string | { value, label?, dot? })[],  // omit → derived from data
 *     multi?: boolean,   // item value is an array; selecting requires ALL (AND)
 *     dot?: boolean,     // render the expression-dimension colour dot
 *     badge?: boolean,   // show this value as the row's category badge
 *     pip?: boolean,     // show this (array) value as row dot-pips
 *     tag?: boolean,     // show this (array) value as #tags in the row
 *     defaultOpen?: boolean, limit?: number }
 */

const NS_ICON = {
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
  import: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12m0 0 4-4m-4 4-4-4"/><path d="M5 21h14"/></svg>',
  open: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>',
  rename: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2 2 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  dup: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4Z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m2 0-1 13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 7"/></svg>',
};

const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** Highlight a case-insensitive match of `q` in `text`, HTML-escaped. */
function highlight(text, q) {
  if (!q) return esc(text);
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return esc(text);
  return esc(text.slice(0, i)) + "<mark>" + esc(text.slice(i, i + q.length)) + "</mark>" + esc(text.slice(i + q.length));
}

/** Normalise one facet value entry to { value, label, dot }. */
function normVal(v) {
  return typeof v === "object" && v !== null ? { value: v.value, label: v.label ?? v.value, dot: v.dot } : { value: v, label: v };
}

const DEFAULT_SORTS = [
  { value: "recent", label: "Recent" },
  { value: "name", label: "Name A–Z" },
  { value: "rating", label: "Rating" },
];

export function createLibraryBrowser(host, options = {}) {
  const opts = { ...options };
  const keys = { name: "name", favorite: "favorite", rating: "rating", date: "modified", ...(opts.keys || {}) };
  const facetMin = opts.facetMin ?? 12;
  const facets = opts.facets || [];
  const title = opts.title || "Library";
  const relTime = opts.formatDate || defaultRelTime;
  const sorts = opts.sorts || DEFAULT_SORTS;

  let items = (opts.items || []).slice();
  const state = {
    q: "", acIdx: -1, acOpen: false,
    sel: new Set(),          // "facetKey:value"
    minRating: 0, favOnly: false,
    sort: sorts[0] ? sorts[0].value : "recent",
    selectedId: null, menuOpen: null, renaming: null,
  };

  const showFav = opts.favorites !== false;
  const nameOf = (it) => it[keys.name] ?? "";
  const favOf = (it) => !!it[keys.favorite];
  const ratingOf = (it) => Number(it[keys.rating] || 0);
  const dateOf = (it) => it[keys.date];
  // Accept a numeric timestamp OR an ISO date string (ProgGenie stores savedAt
  // as ISO; Vane presets use ms) — coerce for both sort and relative time.
  const dateNum = (v) => { if (v == null) return 0; const n = typeof v === "number" ? v : Date.parse(v); return Number.isFinite(n) ? n : 0; };
  const facetVals = (f, it) => {
    const v = f.accessor ? f.accessor(it) : it[f.key];
    return v == null ? [] : Array.isArray(v) ? v : [v];
  };
  const hasSel = (k, v) => state.sel.has(k + ":" + v);
  const favFacet = facets.find((f) => f.kind === "bool");
  const ratingFacet = facets.find((f) => f.kind === "min");
  const multiFacets = facets.filter((f) => f.kind === "multi");

  // derived value lists for facets without an explicit `values` (by frequency)
  function facetValues(f) {
    if (f.values) return f.values.map(normVal);
    const freq = new Map();
    for (const it of items) for (const v of facetVals(f, it)) freq.set(v, (freq.get(v) || 0) + 1);
    const list = [...freq.keys()].sort((a, b) => freq.get(b) - freq.get(a));
    return (f.limit ? list.slice(0, f.limit) : list).map(normVal);
  }

  // does an item pass the active constraints? `skip` excludes one facet key
  // (or "favorite"/"rating") so a facet can count itself.
  function passes(it, skip) {
    if (state.q) {
      const hay = [nameOf(it), ...multiFacets.flatMap((f) => facetVals(f, it).map((v) => {
        const nv = (f.values || []).map(normVal).find((x) => x.value === v);
        return nv ? nv.label : v;
      }))].join(" ").toLowerCase();
      if (!hay.includes(state.q.toLowerCase())) return false;
    }
    if (favFacet && skip !== "favorite" && state.favOnly && !favOf(it)) return false;
    if (ratingFacet && skip !== "rating" && state.minRating && ratingOf(it) < state.minRating) return false;
    for (const f of multiFacets) {
      if (skip === f.key) continue;
      const chosen = [...state.sel].filter((s) => s.startsWith(f.key + ":")).map((s) => s.slice(f.key.length + 1));
      if (!chosen.length) continue;
      const vals = facetVals(f, it);
      if (f.multi) { if (!chosen.every((c) => vals.includes(c))) return false; }
      else if (!chosen.some((c) => vals.includes(c))) return false;
    }
    return true;
  }

  function countFor(f, value) {
    return items.filter((it) => passes(it, f.key) && facetVals(f, it).includes(value)).length;
  }
  const favCount = () => items.filter((it) => passes(it, "favorite") && favOf(it)).length;
  const ratingCount = (m) => items.filter((it) => passes(it, "rating") && ratingOf(it) >= m).length;

  function filtered() {
    const out = items.filter((it) => passes(it));
    const cmp = {
      recent: (a, b) => dateNum(dateOf(b)) - dateNum(dateOf(a)),
      name: (a, b) => nameOf(a).localeCompare(nameOf(b)),
      rating: (a, b) => ratingOf(b) - ratingOf(a) || nameOf(a).localeCompare(nameOf(b)),
    }[state.sort] || ((a, b) => nameOf(a).localeCompare(nameOf(b)));
    // custom sorts fall back to a facet-key localeCompare
    const custom = !["recent", "name", "rating"].includes(state.sort);
    return [...out].sort(custom
      ? (a, b) => String(facetVals(multiFacets.find((f) => f.key === state.sort) || {}, a)[0] || "").localeCompare(
          String(facetVals(multiFacets.find((f) => f.key === state.sort) || {}, b)[0] || "")) || nameOf(a).localeCompare(nameOf(b))
      : cmp);
  }

  // ── skeleton (built once; volatile regions re-rendered) ──
  // `compact` — for narrow rails (Serpe, MIDIcurator sidebars): single column,
  // facets in a collapsible bar above the list instead of a side rail.
  const compact = !!opts.compact;
  host.classList.add("lib");
  host.classList.toggle("no-fav", !showFav);
  host.classList.toggle("compact", compact);
  host.innerHTML = "";
  const aside = el("aside", "lib-facets");
  aside.setAttribute("aria-label", "Filters");
  const main = el("div", "lib-main");
  const toolbar = el("div", "lib-toolbar");
  const chipsRow = el("div", "chips-row");
  const suggest = el("div", "suggest");
  const list = el("div", "lib-list");
  // Where facet groups render, and the element toggled to show/hide them.
  let facetInner = aside, facetWrap = aside, filtersSummary = null;
  if (compact) {
    const filters = el("details", "lib-filters");
    filtersSummary = el("summary", null, "Filters");
    facetInner = el("div", "lib-filters-body");
    filters.append(filtersSummary, facetInner);
    facetWrap = filters;
    main.append(filters, toolbar, chipsRow, suggest, list);
    host.append(main);
  } else {
    main.append(toolbar, chipsRow, suggest, list);
    host.append(aside, main);
  }

  // toolbar: title · count · search · sort · front doors (search input persists)
  const titleEl = el("span", "lib-title", esc(title));
  const countEl = el("span", "lib-count");
  const searchWrap = el("div", "search-wrap");
  const searchIco = el("span", "ico", NS_ICON.search);
  const search = el("input", "search-input");
  search.type = "search"; search.setAttribute("aria-label", "Search");
  search.placeholder = "Search…";
  const clr = el("button", "clr"); clr.type = "button"; clr.title = "Clear"; clr.textContent = "×"; clr.hidden = true;
  const acMenu = el("div", "ac-menu"); acMenu.hidden = true;
  searchWrap.append(searchIco, search, clr, acMenu);
  const sortSel = el("select", "sort-sel");
  sortSel.setAttribute("aria-label", "Sort");
  sortSel.innerHTML = sorts.map((s) => `<option value="${esc(s.value)}">${esc(s.label)}</option>`).join("");
  const doors = el("div", "front-doors");
  const newBtn = el("button", "fd primary", NS_ICON.plus + " New"); newBtn.type = "button";
  const importBtn = el("button", "fd", NS_ICON.import + " Import"); importBtn.type = "button";
  doors.append(newBtn, importBtn);
  toolbar.append(titleEl, countEl, searchWrap, sortSel);
  // Front doors are optional — an app that already has its own New/Import
  // affordances (ProgGenie's outer four) hides the browser's to avoid duplicates.
  if (opts.frontDoors !== false) toolbar.append(doors);

  const hasAnyFacet = multiFacets.length > 0 || !!favFacet || !!ratingFacet;

  // ── render volatile regions ──
  function renderFacets() {
    const showFacets = hasAnyFacet && items.length >= facetMin;
    host.classList.toggle("no-facets", !showFacets);
    facetWrap.hidden = !showFacets;
    if (!showFacets) { facetInner.innerHTML = ""; return; }
    const groups = [];
    groups.push(`<p class="facet-search-hint">Facets narrow the library. Counts reflect the other active filters.</p>`);
    if (favFacet) {
      groups.push(group(favFacet.label || "Quick", true,
        facetRowHtml({ active: state.favOnly, label: "★ " + (favFacet.label || "Favorites"), count: favCount(), data: "fav:on" })));
    }
    for (const f of multiFacets) {
      const rows = facetValues(f).map((v) => {
        const n = countFor(f, v.value);
        return facetRowHtml({ active: hasSel(f.key, v.value), disabled: n === 0 && !hasSel(f.key, v.value),
          label: v.label, count: n, dot: f.dot ? v.dot || v.value : null, data: `f:${f.key}:${v.value}` });
      }).join("");
      groups.push(group(f.label, f.defaultOpen !== false, rows));
    }
    if (ratingFacet) {
      const rows = [3, 2, 1].map((m) => facetRowHtml({ active: state.minRating === m,
        label: m === 3 ? "★★★" : "★".repeat(m) + " & up", count: ratingCount(m), data: `rating:${m}` })).join("");
      groups.push(group(ratingFacet.label || "Rating", true, rows));
    }
    facetInner.innerHTML = groups.join("");
    if (filtersSummary) { const n = activeChips().length; filtersSummary.textContent = n ? `Filters · ${n}` : "Filters"; }
  }
  const group = (label, open, inner) =>
    `<details class="facet-group"${open ? " open" : ""}><summary>${esc(label)}</summary><div>${inner}</div></details>`;
  const facetRowHtml = ({ active, disabled, label, count, dot, data }) =>
    `<button class="facet-row" type="button" aria-pressed="${!!active}"${disabled ? " disabled" : ""} data-facet="${esc(data)}">` +
    `<span class="box">${active ? "✓" : ""}</span>` +
    `<span class="lbl">${dot ? `<span class="es-dot ${esc(dot)}"></span>` : ""}<span class="nm">${esc(label)}</span></span>` +
    `<span class="cnt">${count}</span></button>`;

  function activeChips() {
    const chips = [];
    if (favFacet && state.favOnly) chips.push({ k: "Favorites", v: "on", clear: "fav" });
    if (ratingFacet && state.minRating) chips.push({ k: "Rating", v: "≥ " + state.minRating + "★", clear: "rating" });
    for (const s of state.sel) {
      const i = s.indexOf(":"); const k = s.slice(0, i); const v = s.slice(i + 1);
      const f = multiFacets.find((x) => x.key === k);
      const nv = f && (f.values || []).map(normVal).find((x) => x.value === v);
      chips.push({ k: k[0].toUpperCase() + k.slice(1), v: nv ? nv.label : v, clear: "sel:" + s });
    }
    return chips;
  }
  function renderChips() {
    const chips = activeChips();
    chipsRow.innerHTML = chips.length
      ? chips.map((c) => `<span class="fchip"><span class="k">${esc(c.k)}</span>${esc(c.v)}` +
          `<button type="button" title="Remove" data-clear="${esc(c.clear)}">×</button></span>`).join("") +
        `<button class="chips-clear" type="button" data-clear="all">Clear all</button>`
      : "";
  }

  function renderList() {
    const rows = filtered();
    countEl.textContent = rows.length + (rows.length !== items.length ? " / " + items.length : "");
    const showFacets = items.length >= facetMin;
    const anyFilter = activeChips().length > 0 || state.q;

    // suggestions rail (sparse, unfiltered)
    if (!showFacets && !anyFilter && items.length) {
      suggest.hidden = false;
      const pipFacet = multiFacets.find((f) => f.dot);
      suggest.innerHTML = `<div class="sg-head">${esc(opts.suggestLabel || "Start from")}</div><div class="sg-items">` +
        items.slice(0, 3).map((it) => {
          const dot = pipFacet ? facetVals(pipFacet, it)[0] : null;
          return `<button class="sg-item" type="button" data-open="${esc(it.id)}">${dot ? `<span class="es-dot ${esc(dot)}"></span>` : ""}${esc(nameOf(it))}</button>`;
        }).join("") + `</div>`;
    } else suggest.hidden = true;

    if (!rows.length) {
      const emptyHint = opts.emptyHint || (opts.frontDoors === false ? "Save something to start your library." : "Make one with New, or bring some in with Import.");
      list.innerHTML = `<div class="empty"><div class="em-title">${anyFilter ? "Nothing matches" : "Your library is empty"}</div>` +
        `<p>${anyFilter ? "No items match the current search and filters." : esc(emptyHint)}</p>` +
        (anyFilter ? `<button class="fd" type="button" data-clear="all" style="margin:8px auto 0">Clear filters</button>` : "") + `</div>`;
      return;
    }
    list.innerHTML = rows.map((it) => rowHtml(it)).join("");
  }

  function rowHtml(it) {
    const badgeF = multiFacets.find((f) => f.badge);
    const pipF = multiFacets.find((f) => f.pip || f.dot);
    const tagF = multiFacets.find((f) => f.tag);
    const rating = ratingOf(it);
    const badge = badgeF ? facetVals(badgeF, it)[0] : null;
    const pips = pipF ? facetVals(pipF, it) : [];
    const tags = tagF ? facetVals(tagF, it) : [];
    const renaming = state.renaming === it.id;
    return `<div class="lib-row${state.selectedId === it.id ? " sel" : ""}" data-id="${esc(it.id)}">` +
      (showFav ? `<button class="fav-btn" type="button" aria-pressed="${favOf(it)}" title="${favOf(it) ? "Unfavorite" : "Favorite"}" data-fav="${esc(it.id)}">${favOf(it) ? "★" : "☆"}</button>` : "") +
      `<div class="row-main"><div class="row-name">` +
        (renaming
          ? `<input class="rename-input" value="${esc(nameOf(it))}" data-rename="${esc(it.id)}">`
          : highlight(nameOf(it), state.q)) +
      `</div><div class="row-meta">` +
        (badge ? `<span class="cat-badge">${esc(badge)}</span>` : "") +
        (pips.length ? `<span class="dims">${pips.map((d) => `<span class="dim-pip"><span class="es-dot ${esc(d)}"></span>${esc(labelFor(pipF, d))}</span>`).join("")}</span>` : "") +
        (tags.length ? `<span class="row-tags">${tags.map((t) => `<span class="row-tag">${esc(t)}</span>`).join("")}</span>` : "") +
      `</div></div>` +
      `<div class="row-right">` +
        (rating > 0 ? `<span class="row-stars" title="${rating}/3">${[1, 2, 3].map((i) => `<span class="${i <= rating ? "" : "off"}">★</span>`).join("")}</span>` : "") +
        (it[keys.source] ? `<span class="src-tag">${esc(it[keys.source])}</span>` : "") +
        (dateOf(it) != null ? `<span class="row-date">${esc(relTime(dateOf(it)))}</span>` : "") +
        (actionsFor(it).length
          ? `<div class="row-actions"><button class="kebab" type="button" aria-haspopup="menu" aria-expanded="${state.menuOpen === it.id}" title="Actions" data-menu="${esc(it.id)}">⋯</button>` +
            (state.menuOpen === it.id ? menuHtml(it) : "") + `</div>`
          : "") +
      `</div></div>`;
  }
  const labelFor = (f, v) => { const nv = f && (f.values || []).map(normVal).find((x) => x.value === v); return nv ? nv.label : v; };
  // Per-row actions: `rowActionsFor(item)` (e.g. Serpe presets get Open only,
  // saved patterns get Open + Delete) falls back to the global `rowActions`.
  const actionsFor = (it) => opts.rowActionsFor ? (opts.rowActionsFor(it) || []) : (opts.rowActions || ["open", "rename", "duplicate", "send", "delete"]);
  function menuHtml(it) {
    const acts = actionsFor(it);
    const parts = [];
    if (acts.includes("open")) parts.push(`<button role="menuitem" type="button" data-act="open">${NS_ICON.open} Open</button>`);
    if (acts.includes("rename")) parts.push(`<button role="menuitem" type="button" data-act="rename">${NS_ICON.rename} Rename</button>`);
    if (acts.includes("duplicate")) parts.push(`<button role="menuitem" type="button" data-act="duplicate">${NS_ICON.dup} Duplicate</button>`);
    if (acts.includes("send")) parts.push(`<button role="menuitem" type="button" data-act="send">${NS_ICON.send} ${esc(opts.sendLabel || "Send to…")}</button>`);
    if (acts.includes("delete")) parts.push(`<div class="sep"></div><button role="menuitem" type="button" class="danger" data-act="delete">${NS_ICON.trash} Delete</button>`);
    return `<div class="menu" role="menu">${parts.join("")}</div>`;
  }

  function renderAll() { renderFacets(); renderChips(); renderList(); }

  // ── autocomplete ──
  function acItems() {
    const q = state.q.trim(); if (!q) return [];
    const ql = q.toLowerCase(); const out = [];
    for (const f of multiFacets) {
      for (const v of facetValues(f)) {
        if (out.length >= 8) break;
        if (v.label.toLowerCase().includes(ql)) out.push({ kind: f.label, key: f.key, val: v.value, label: v.label, dot: f.dot ? v.dot || v.value : null, count: countFor(f, v.value) });
      }
    }
    for (const it of items) {
      if (out.length >= 10) break;
      if (nameOf(it).toLowerCase().includes(ql)) out.push({ kind: "Item", key: "name", val: nameOf(it), label: nameOf(it), id: it.id });
    }
    return out.slice(0, 10);
  }
  function renderAc() {
    const ac = state.acOpen ? acItems() : [];
    if (!ac.length) { acMenu.hidden = true; acMenu.innerHTML = ""; return; }
    acMenu.hidden = false;
    acMenu.innerHTML = ac.map((s, i) =>
      `<div class="ac-item${i === state.acIdx ? " active" : ""}" data-ac="${i}">` +
      (s.dot ? `<span class="es-dot ${esc(s.dot)}"></span>` : "") +
      `<span>${highlight(s.label, state.q)}</span><span class="ac-sec" style="padding:0;margin-left:6px">${esc(s.kind)}</span>` +
      (s.count != null ? `<span class="cnt">${s.count}</span>` : "") + `</div>`).join("");
    acMenu._items = ac;
  }
  function applyAc(s) {
    if (!s) return;
    if (s.key === "name") { state.q = ""; search.value = ""; state.selectedId = s.id; }
    else state.sel.add(s.key + ":" + s.val);
    state.q = s.key === "name" ? "" : state.q; search.value = s.key === "name" ? "" : search.value;
    state.acOpen = false; state.acIdx = -1;
    if (s.key !== "name") { state.q = ""; search.value = ""; }
    clr.hidden = !search.value; renderAc(); renderAll();
  }

  // ── item mutations ──
  const setItems = (next) => { items = next.slice(); opts.items = items; renderAll(); };
  const patch = (id, fn) => setItems(items.map((it) => (it.id === id ? fn(it) : it)));
  function doAction(a, it) {
    if (a === "open") { state.selectedId = it.id; opts.onOpen && opts.onOpen(it); }
    else if (a === "rename") { state.renaming = it.id; renderList(); const inp = list.querySelector(`[data-rename="${cssq(it.id)}"]`); if (inp) { inp.focus(); inp.select(); } return; }
    else if (a === "duplicate") {
      const copy = { ...it, id: "dup-" + Date.now(), [keys.name]: nameOf(it) + " copy", [keys.favorite]: false, [keys.date]: Date.now() };
      if ("source" in it || keys.source in it) copy[keys.source || "source"] = "User";
      setItems([copy, ...items]); state.selectedId = copy.id; opts.onDuplicate && opts.onDuplicate(copy, it); renderList();
    } else if (a === "send") { opts.onSend && opts.onSend(it); }
    else if (a === "delete") {
      const idx = items.findIndex((i) => i.id === it.id);
      setItems(items.filter((i) => i.id !== it.id));
      opts.onDelete && opts.onDelete(it);
      const restore = () => setItems((() => { const n = items.slice(); n.splice(Math.min(idx, n.length), 0, it); return n; })());
      if (opts.toast) opts.toast({ text: `Deleted ${nameOf(it)}`, undo: restore });
    }
  }
  const cssq = (s) => String(s).replace(/["\\]/g, "\\$&");

  // ── events (delegated; survive re-render) ──
  facetWrap.addEventListener("click", (e) => {
    const row = e.target.closest("[data-facet]"); if (!row) return;
    const d = row.getAttribute("data-facet");
    if (d === "fav:on") state.favOnly = !state.favOnly;
    else if (d.startsWith("rating:")) { const m = +d.slice(7); state.minRating = state.minRating === m ? 0 : m; }
    else if (d.startsWith("f:")) { const rest = d.slice(2); const i = rest.indexOf(":"); const key = rest.slice(0, i) + ":" + rest.slice(i + 1); state.sel.has(key) ? state.sel.delete(key) : state.sel.add(key); }
    renderAll();
  });
  chipsRow.addEventListener("click", (e) => {
    const b = e.target.closest("[data-clear]"); if (!b) return;
    const d = b.getAttribute("data-clear");
    if (d === "all") { state.sel.clear(); state.minRating = 0; state.favOnly = false; state.q = ""; search.value = ""; clr.hidden = true; }
    else if (d === "fav") state.favOnly = false;
    else if (d === "rating") state.minRating = 0;
    else if (d.startsWith("sel:")) state.sel.delete(d.slice(4));
    renderAll();
  });
  suggest.addEventListener("click", (e) => {
    const b = e.target.closest("[data-open]"); if (!b) return;
    const it = items.find((x) => String(x.id) === b.getAttribute("data-open"));
    if (it) { state.selectedId = it.id; opts.onOpen && opts.onOpen(it); }
  });
  list.addEventListener("click", (e) => {
    const fav = e.target.closest("[data-fav]");
    if (fav) { e.stopPropagation(); patch(fav.getAttribute("data-fav"), (it) => ({ ...it, [keys.favorite]: !favOf(it) })); const it = items.find((x) => String(x.id) === fav.getAttribute("data-fav")); opts.onFavorite && it && opts.onFavorite(it); return; }
    const kebab = e.target.closest("[data-menu]");
    if (kebab) { e.stopPropagation(); const id = kebab.getAttribute("data-menu"); state.menuOpen = state.menuOpen === id ? null : id; renderList(); return; }
    const act = e.target.closest("[data-act]");
    if (act) { e.stopPropagation(); const row = act.closest(".lib-row"); const it = items.find((x) => String(x.id) === row.getAttribute("data-id")); state.menuOpen = null; doAction(act.getAttribute("data-act"), it); return; }
    const row = e.target.closest(".lib-row");
    if (row) {
      state.selectedId = row.getAttribute("data-id");
      const it = items.find((x) => String(x.id) === state.selectedId);
      opts.onSelect && opts.onSelect(it);
      // Quick-pick surfaces (Serpe patterns) load on a single row click; the
      // default is select-only (open via the row menu) for surfaces where open
      // is heavier, like ProgGenie replacing the working document.
      if (opts.openOnRowClick && it) opts.onOpen && opts.onOpen(it);
      renderList();
    }
  });
  list.addEventListener("keydown", (e) => {
    const inp = e.target.closest("[data-rename]"); if (!inp) return;
    if (e.key === "Enter") commitRename(inp.getAttribute("data-rename"), inp.value);
    if (e.key === "Escape") commitRename(inp.getAttribute("data-rename"), null);
  });
  list.addEventListener("blur", (e) => {
    const inp = e.target.closest && e.target.closest("[data-rename]"); if (inp) commitRename(inp.getAttribute("data-rename"), inp.value);
  }, true);
  function commitRename(id, val) {
    state.renaming = null;
    if (val != null && val.trim()) { patch(id, (it) => ({ ...it, [keys.name]: val.trim() })); const it = items.find((x) => String(x.id) === id); opts.onRename && it && opts.onRename(it, val.trim()); }
    else renderList();
  }

  // document-level: close open row menu on outside click
  const onDocDown = (e) => { if (state.menuOpen && !e.target.closest(".row-actions")) { state.menuOpen = null; renderList(); } };
  document.addEventListener("mousedown", onDocDown);

  search.addEventListener("input", () => { state.q = search.value; state.acOpen = true; state.acIdx = -1; clr.hidden = !search.value; renderAc(); renderAll(); });
  search.addEventListener("focus", () => { if (state.q) { state.acOpen = true; renderAc(); } });
  search.addEventListener("blur", () => setTimeout(() => { state.acOpen = false; acMenu.hidden = true; }, 120));
  search.addEventListener("keydown", (e) => {
    const ac = acMenu._items || [];
    if (!state.acOpen || !ac.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); state.acIdx = Math.min(state.acIdx + 1, ac.length - 1); renderAc(); }
    if (e.key === "ArrowUp") { e.preventDefault(); state.acIdx = Math.max(state.acIdx - 1, 0); renderAc(); }
    if (e.key === "Enter" && state.acIdx >= 0) { e.preventDefault(); applyAc(ac[state.acIdx]); }
  });
  acMenu.addEventListener("mousedown", (e) => { const it = e.target.closest("[data-ac]"); if (!it) return; e.preventDefault(); applyAc((acMenu._items || [])[+it.getAttribute("data-ac")]); });
  clr.addEventListener("mousedown", (e) => { e.preventDefault(); state.q = ""; search.value = ""; state.acOpen = false; clr.hidden = true; acMenu.hidden = true; renderAll(); });
  sortSel.addEventListener("change", () => { state.sort = sortSel.value; renderList(); });
  newBtn.addEventListener("click", () => opts.onNew && opts.onNew());
  importBtn.addEventListener("click", () => opts.onImport && opts.onImport());

  renderAll();

  return {
    /** Replace the item stream (e.g. after an external add/remove). */
    setItems,
    /** Current items (post-mutation). */
    getItems: () => items.slice(),
    /** Re-render from current items (call after mutating an item in place). */
    update: (next) => { if (next && next.items) { items = next.items.slice(); } renderAll(); },
    /** The id of the row the user last opened/selected. */
    getSelectedId: () => state.selectedId,
    destroy() { document.removeEventListener("mousedown", onDocDown); host.innerHTML = ""; host.classList.remove("lib", "no-facets"); },
  };
}

function defaultRelTime(ts) {
  const now = Date.now();
  const n = typeof ts === "number" ? ts : Date.parse(ts);
  if (!Number.isFinite(n)) return "";
  const d = Math.round((now - n) / 86400000);
  if (d <= 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 30) return `${d}d ago`;
  if (d < 365) return `${Math.round(d / 30)}mo ago`;
  return `${Math.round(d / 365)}y ago`;
}
