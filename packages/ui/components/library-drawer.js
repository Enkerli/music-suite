/**
 * The Library drawer — the suite's ONE save/recall surface (D4 of the
 * shared frame). Trigger and surface share the noun: the cluster button
 * says "Library", this drawer titles "Library" with the app's content
 * types as the subtitle. Items group by kind — document · patch ·
 * profile — mapping 1:1 onto @enkerli/library's wrap helpers.
 *
 * Destructive idiom: two-tap inline delete (tap ✕ → "Delete?" armed and
 * pulsing → tap again commits; 3 s or blur disarms). Never a modal —
 * window.confirm is a silent no-op in WKWebView.
 *
 * Framework-agnostic (the createSection idiom); apps own persistence
 * and pass plain item records here.
 */

const KIND_LABEL = { document: "Documents", patch: "Patches", profile: "Profiles" };
const KIND_ORDER = ["document", "patch", "profile"];

function el(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text != null) n.textContent = text;
  return n;
}

/** Two-tap delete control (exported for reuse in bespoke lists). */
export function createTwoTapDelete({ name, onDelete }) {
  const btn = el("button", "del-btn", "✕");
  btn.setAttribute("aria-label", `Delete ${name}`);
  btn.title = "Delete";
  let armed = false, timer = null;
  const disarm = () => {
    armed = false; clearTimeout(timer);
    btn.classList.remove("armed");
    btn.textContent = "✕";
    btn.title = "Delete";
    btn.setAttribute("aria-label", `Delete ${name}`);
  };
  btn.addEventListener("blur", disarm);
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (armed) { disarm(); onDelete(); return; }
    armed = true;
    btn.classList.add("armed");
    btn.textContent = "Delete?";
    btn.title = "Tap again to delete";
    btn.setAttribute("aria-label", `Confirm delete ${name}`);
    timer = setTimeout(disarm, 3000);
  });
  return btn;
}

/**
 * @param {Element} host the drawer appends here (position: fixed — host just owns lifecycle)
 * @param {object} opts
 * @param {string} opts.noun content types for the subtitle, e.g. "Progressions · Patches · Profile"
 * @param {string} [opts.thing] what "Save current …" saves, e.g. "progression"; omit to hide the save affordance
 * @param {Array<{id:string,name:string,kind:"document"|"patch"|"profile",meta?:string,source?:string}>} opts.items
 * @param {()=>void} [opts.onSave]
 * @param {(item)=>void} [opts.onRecall]
 * @param {(item)=>void} [opts.onDelete]
 * @param {()=>void} opts.onClose
 * @returns {{ root:HTMLElement, update(next?:object):void, destroy():void }}
 */
export function createLibraryDrawer(host, opts) {
  let state = { ...opts };
  const root = el("div", "lib-drawer");
  root.setAttribute("role", "dialog");
  host.appendChild(root);

  const onKey = (e) => { if (e.key === "Escape") state.onClose?.(); };
  document.addEventListener("keydown", onKey);

  function render() {
    root.setAttribute("aria-label", `Library — ${state.noun}`);
    root.textContent = "";

    const head = el("div", "ld-head");
    const row = el("div", "ld-title-row");
    const titles = el("div");
    titles.append(el("div", "ld-title", "Library"), el("div", "ld-sub", state.noun));
    const x = el("button", "ld-x", "×");
    x.title = "Close";
    x.setAttribute("aria-label", "Close Library");
    x.addEventListener("click", () => state.onClose?.());
    row.append(titles, x);
    head.append(row);
    root.append(head);

    if (state.thing && state.onSave) {
      const save = el("button", "es-btn ld-save", `+ Save current ${state.thing}`);
      save.addEventListener("click", () => state.onSave());
      root.append(save);
    }

    const body = el("div", "ld-body");
    const items = state.items ?? [];
    if (!items.length) {
      const empty = el("div", "lib-empty");
      empty.append(el("div", "t", "Nothing saved yet"));
      const p = el("p");
      p.textContent = state.thing
        ? `“Save current ${state.thing}” keeps it here — same place in every app.`
        : "Saved things appear here — same place in every app.";
      empty.append(p);
      body.append(empty);
    } else {
      for (const kind of KIND_ORDER) {
        const group = items.filter((i) => i.kind === kind);
        if (!group.length) continue;
        body.append(el("div", "es-eyebrow ld-kind", KIND_LABEL[kind]));
        for (const item of group) {
          const card = el("div", "lib-item");
          card.setAttribute("role", "button");
          card.tabIndex = 0;
          card.append(el("div", "li-name", item.name));
          const meta = el("div", "li-meta");
          if (item.meta) meta.append(Object.assign(el("span", "mono"), {
            textContent: item.meta, style: "font-family: var(--es-font-mono)" }));
          if (item.source) meta.append(el("span", null, `· ${item.source}`));
          card.append(meta);
          const side = el("div", "li-side");
          side.append(el("span", `kind-badge ${item.kind}`, item.kind));
          if (state.onDelete) side.append(createTwoTapDelete({
            name: item.name, onDelete: () => state.onDelete(item) }));
          card.append(side);
          const recall = () => state.onRecall?.(item);
          card.addEventListener("click", recall);
          card.addEventListener("keydown", (e) => { if (e.key === "Enter") recall(); });
          body.append(card);
        }
      }
    }
    root.append(body);
  }

  render();
  return {
    root,
    update(next = {}) { state = { ...state, ...next }; render(); },
    destroy() {
      document.removeEventListener("keydown", onKey);
      root.remove();
    },
  };
}
