/**
 * Theme machinery: light is the default design target, dark is a
 * first-class variant, and the OS preference is respected until the
 * person chooses. Persisted per app; works in browsers, JUCE WebViews,
 * and SSR (no-ops without a DOM).
 */

const KEY = "enkerli.theme";

/** "light" | "dark" | "auto" */
export function getTheme() {
  try {
    const saved = globalThis.localStorage?.getItem(KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch { /* storage unavailable */ }
  return "auto";
}

export function setTheme(theme) {
  try {
    if (theme === "auto") globalThis.localStorage?.removeItem(KEY);
    else globalThis.localStorage?.setItem(KEY, theme);
  } catch { /* storage unavailable */ }
  apply(theme);
}

/** The theme actually in effect right now ("light" | "dark"). */
export function resolvedTheme() {
  const t = getTheme();
  if (t !== "auto") return t;
  try {
    return globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch { /* no matchMedia */ }
  return "light";
}

/** Flip between light and dark (an explicit choice, persisted). */
export function toggleTheme() {
  const next = resolvedTheme() === "dark" ? "light" : "dark";
  setTheme(next);
  return next;
}

/** Call once at startup. */
export function initTheme() {
  apply(getTheme());
}

function apply(theme) {
  const root = globalThis.document?.documentElement;
  if (!root) return;
  if (theme === "light" || theme === "dark") root.setAttribute("data-theme", theme);
  else root.removeAttribute("data-theme");
}
