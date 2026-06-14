/**
 * Confirm / alert dialogs that work in plugin WebViews.
 *
 * window.confirm/alert/prompt are NO-OPS under WKWebView (JUCE wires no
 * native JS panel), so a "Delete"/"Clear all" guarded by `confirm()`
 * silently does nothing on iPad — the action never runs. These render a
 * token-styled DOM dialog instead and resolve a Promise. Self-contained
 * (injects its own style using the paper & ink tokens), so apps that load
 * only tokens.css still get it.
 */

const STYLE_ID = "es-dialog-style";
function ensureStyle() {
  if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = `
  .es-dialog-overlay {
    position: fixed; inset: 0; z-index: 9999; display: grid; place-items: center;
    background: rgba(28, 25, 20, 0.45); padding: 16px;
  }
  .es-dialog {
    background: var(--es-bg-raised); color: var(--es-fg);
    border: 1px solid var(--es-border); border-radius: var(--es-radius-md, 14px);
    box-shadow: var(--es-shadow, 0 6px 22px rgba(0,0,0,.28));
    max-width: 360px; width: 100%; padding: var(--es-space-4, 16px);
    font-family: var(--es-font-sans, system-ui);
  }
  .es-dialog-title { font-weight: 500; margin: 0 0 var(--es-space-2, 8px); }
  .es-dialog-msg { margin: 0 0 var(--es-space-4, 16px); color: var(--es-fg-2); font-size: var(--es-text-md, 1rem); line-height: 1.5; }
  .es-dialog-row { display: flex; justify-content: flex-end; gap: var(--es-gap, 10px); }
  .es-dialog-btn {
    min-height: var(--es-ctl-h, 32px); padding: 0 var(--es-space-3, 12px);
    border: 1px solid var(--es-border-strong, #9d8967); border-radius: var(--es-radius-sm, 10px);
    background: var(--es-bg-raised); color: var(--es-fg); cursor: pointer;
    font-family: inherit; font-size: var(--es-text-md, 1rem);
  }
  .es-dialog-btn:hover { background: var(--es-bg-sunken); }
  .es-dialog-btn:focus-visible { outline: var(--es-focus-ring, 2px solid var(--es-accent)); outline-offset: 2px; }
  .es-dialog-btn.primary { background: var(--es-accent); border-color: var(--es-accent); color: var(--es-accent-fg); }
  .es-dialog-btn.danger { background: var(--es-danger); border-color: var(--es-danger); color: #fff; }`;
  document.head.appendChild(s);
}

function dialog({ message, title, buttons }) {
  ensureStyle();
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "es-dialog-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    const box = document.createElement("div");
    box.className = "es-dialog";
    if (title) {
      const h = document.createElement("p");
      h.className = "es-dialog-title";
      h.textContent = title;
      box.append(h);
    }
    const msg = document.createElement("p");
    msg.className = "es-dialog-msg";
    msg.textContent = message;
    const row = document.createElement("div");
    row.className = "es-dialog-row";

    const close = (value) => {
      document.removeEventListener("keydown", onKey);
      overlay.remove();
      resolve(value);
    };
    const onKey = (e) => {
      if (e.key === "Escape") close(buttons.find((b) => b.escape)?.value ?? false);
    };

    for (const b of buttons) {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "es-dialog-btn" + (b.variant ? " " + b.variant : "");
      el.textContent = b.label;
      el.addEventListener("click", () => close(b.value));
      row.append(el);
    }
    box.append(msg, row);
    overlay.append(box);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(false); });
    document.addEventListener("keydown", onKey);
    document.body.appendChild(overlay);
    row.querySelector(".primary, .danger, .es-dialog-btn:last-child")?.focus();
  });
}

/** Promise<boolean> — true if confirmed. Works in WebViews (unlike confirm()). */
export function esConfirm(message, { confirmLabel = "OK", cancelLabel = "Cancel", danger = false, title } = {}) {
  return dialog({
    message, title,
    buttons: [
      { label: cancelLabel, value: false, escape: true },
      { label: confirmLabel, value: true, variant: danger ? "danger" : "primary" },
    ],
  });
}

/** Promise<void> — a WebView-safe alert(). */
export function esAlert(message, { okLabel = "OK", title } = {}) {
  return dialog({ message, title, buttons: [{ label: okLabel, value: true, variant: "primary", escape: true }] }).then(() => {});
}
