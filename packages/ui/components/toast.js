/**
 * Toast — the suite's ONE destructive-action idiom (Design pass · Q4):
 * act immediately, then offer Undo in a toast for a few seconds. Replaces
 * `window.confirm` (dead in WKWebView) and the three bespoke confirm/undo
 * idioms; the successor to confirm.js. Framework-agnostic; one bottom-centre
 * stack shared across the page.
 *
 *   toast("Deleted Velvet Choir", { undo: () => restore() });
 *   toast({ text, undo, undoLabel, duration });   // object form
 *
 * Returns a handle: { dismiss() }. `undo` fires the callback and dismisses.
 */

let stack = null;

function ensureStack() {
  if (stack && document.body.contains(stack)) return stack;
  stack = document.createElement("div");
  stack.className = "toasts";
  stack.setAttribute("role", "status");
  stack.setAttribute("aria-live", "polite");
  document.body.appendChild(stack);
  return stack;
}

/** Set text that may be a string or a DOM node. */
function setText(el, text) {
  if (text == null) return;
  if (text instanceof Node) el.appendChild(text);
  else el.textContent = String(text);
}

export function toast(textOrOpts, maybeOpts) {
  const opts = typeof textOrOpts === "object" && textOrOpts !== null && !(textOrOpts instanceof Node)
    ? textOrOpts
    : { text: textOrOpts, ...(maybeOpts || {}) };
  const { text, undo, undoLabel = "Undo", duration = 6000 } = opts;

  const host = ensureStack();
  const el = document.createElement("div");
  el.className = "toast";

  const body = document.createElement("span");
  body.className = "ttext";
  setText(body, text);
  el.appendChild(body);

  let timer = null;
  const dismiss = () => {
    if (timer) { clearTimeout(timer); timer = null; }
    el.remove();
  };

  if (typeof undo === "function") {
    const btn = document.createElement("button");
    btn.className = "undo";
    btn.textContent = undoLabel;
    btn.addEventListener("click", () => { undo(); dismiss(); });
    el.appendChild(btn);
  }

  const close = document.createElement("button");
  close.className = "x";
  close.setAttribute("aria-label", "Dismiss");
  close.textContent = "×";
  close.addEventListener("click", dismiss);
  el.appendChild(close);

  host.appendChild(el);
  if (duration > 0) timer = setTimeout(dismiss, duration);

  return { dismiss };
}
