/**
 * Collapsible section — JS sugar over the .es-section CSS shell
 * (components.css) for vanilla apps and WebViews. React apps can write
 * the <details class="es-section"> markup directly; both routes share
 * the same look, keyboarding, and density behavior.
 */

/**
 * @param {Element} host element the section is appended to
 * @param {object} opts
 * @param {string} opts.title
 * @param {boolean} [opts.open]
 * @param {(open:boolean)=>void} [opts.onToggle]
 * @returns {{ body: HTMLElement, details: HTMLDetailsElement, destroy(): void }}
 */
export function createSection(host, { title, open = true, onToggle } = {}) {
  const details = document.createElement("details");
  details.className = "es-section";
  details.open = open;

  const summary = document.createElement("summary");
  summary.textContent = title;
  const body = document.createElement("div");
  body.className = "es-section-body";

  details.append(summary, body);
  if (onToggle) details.addEventListener("toggle", () => onToggle(details.open));
  host.appendChild(details);

  return { body, details, destroy: () => details.remove() };
}
